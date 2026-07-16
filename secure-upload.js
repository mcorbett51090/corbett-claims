/**
 * secure-upload.js — framework-agnostic drop-in client for the raven-site-kit
 * secure-upload Worker. Progressive enhancement, no build step required:
 * works as a plain `<script type="module" src="secure-upload.js"></script>`
 * on a static page (see ../README.md for the full adoption runbook and
 * SecureUploadField.astro for the Astro-wrapped version of this same markup
 * contract).
 *
 * Three ways to use this module:
 *
 *   1. AUTO-BIND (default, zero JS wiring) — drop the script tag on a page
 *      with a `form[data-secure-upload]` and this module wires the whole
 *      submit → presign → PUT → /complete flow for you. Auto-bind treats
 *      "no file selected" as a hard error and owns the entire form submit —
 *      only use it when the file field is REQUIRED.
 *
 *   2. PROGRAMMATIC, files-only (`uploadFiles`) — call this directly from
 *      your own submit handler when the file field is OPTIONAL, when you
 *      need to merge in fields from a form the module doesn't own, or when
 *      you're running an existing (e.g. mailto) submission path side by side
 *      and only want to hand files to this Worker. See `uploadFiles` below.
 *
 *   3. PROGRAMMATIC, whole-form (`submitForm`) — the plan-v2 unified entry
 *      point: one call sends the WHOLE form, text ± files, no mailto. Files
 *      present → delegates to `uploadFiles` (which already sends fields
 *      alongside each file); no files → posts fields-only to the Worker's
 *      `POST /submit` (no presign/R2/byte-validation needed — simpler, see
 *      worker/src/index.ts). This is what `SecureFormScript.astro` calls,
 *      and the recommended entry point for any NEW site (it replaces the
 *      kit's former Web3Forms convention — see ../README.md).
 *
 * MARKUP CONTRACT — every `form[data-secure-upload]` (auto-bind) must contain:
 *   - `data-worker-url`         the deployed Worker's public URL (no trailing slash)
 *   - `data-site-id`            this site's siteId, as configured in the Worker
 *   - `data-turnstile-site-key` the PUBLIC Turnstile site key for this site
 *   - a Turnstile widget:       `<div class="cf-turnstile" data-sitekey="...">`
 *                               (load `https://challenges.cloudflare.com/turnstile/v0/api.js`
 *                               separately — SecureUploadField.astro does this for you)
 *   - a honeypot checkbox:      `<input type="checkbox" name="botcheck" class="hp"
 *                               tabindex="-1" autocomplete="off" aria-hidden="true">`
 *   - one or more file inputs:  `<input type="file" data-secure-upload-file>`
 *   - a status region:          `<p data-form-status role="status" aria-live="polite" hidden></p>`
 *   - optionally a progress el: `<progress data-secure-upload-progress value="0" max="100" hidden></progress>`
 *
 * PROGRAMMATIC CONTRACT — `uploadFiles(config, files, fields, opts)` needs
 * none of the above markup; it is entirely form-agnostic. See the JSDoc on
 * `uploadFiles` for the exact shape.
 *
 * SCOPE: `uploadFiles`/auto-bind upload FILES ONLY — non-file form fields are
 * read (or, in the programmatic path, passed in by the caller) and sent
 * along with each /complete call so the Worker can include them in the owner
 * email, but that path alone does not replace an existing text-field
 * submission path (e.g. Web3Forms/mailto): PLAN.md's original corbett-claims
 * adoption (P6) was explicitly additive — keep the proven text-field
 * channel, route only file attachments through this Worker.
 *
 * `submitForm` (plan-v2) removes that limitation: it sends the WHOLE form —
 * text ± files — through this Worker in one call, which is why it's now the
 * kit-standard entry point for new sites (see ../README.md and
 * `SecureFormScript.astro`). Existing additive adopters can keep using
 * `uploadFiles` side by side with their own text-field handler; new sites
 * should prefer `submitForm` + `SecureFormScript.astro` instead.
 *
 * NO SECRETS ARE EVER READ OR SENT FROM HERE. The only credential-shaped
 * value in this file is the Turnstile SITE key, which is public by design.
 */

const ALLOWED_ACCEPT_DEFAULT = 'image/jpeg,image/png,image/gif,image/webp,application/pdf';
const DEFAULT_MAX_BYTES = 26214400; // 25MB — must not exceed the Worker's per-site maxBytes; see README.

// --- Client-side image compression (iOS Mail-style Small/Medium/Large/Actual)
// Lets a visitor shrink photos IN THE BROWSER before upload so a photo-heavy
// submission fits under the Worker's per-site total-size cap (email-attach
// mode). Each preset caps the longest edge + JPEG quality. 'actual' = no change.
const QUALITY_PRESETS = {
  actual: null,
  large: { maxDim: 2560, quality: 0.82 },
  medium: { maxDim: 1600, quality: 0.72 },
  small: { maxDim: 1024, quality: 0.6 },
};
// Only raster photos are recompressed. PDFs, GIFs (may be animated), and
// anything the browser can't decode (e.g. some HEIC) pass through untouched.
const COMPRESSIBLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function mb(bytes) {
  return (bytes / 1048576).toFixed(1);
}

async function compressOneImage(file, preset) {
  if (!COMPRESSIBLE_TYPES.has(file.type)) return file;
  try {
    // `imageOrientation: 'from-image'` bakes in EXIF rotation so an iPhone photo
    // never lands sideways after the canvas re-encode.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, preset.maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    if (typeof bitmap.close === 'function') bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', preset.quality));
    // If re-encoding didn't actually shrink it (already-small / already-JPEG),
    // keep the original so we never upload a LARGER file than the visitor chose.
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    // Decode/encode failed (e.g. a HEIC the browser can't read) — upload as-is.
    return file;
  }
}

/**
 * Recompress a set of files per a quality preset ('actual'|'large'|'medium'|'small').
 * Returns a new array (originals preserved for non-images / 'actual'). Never throws.
 */
export async function compressImages(files, quality) {
  const preset = QUALITY_PRESETS[quality];
  const list = Array.from(files || []);
  if (!preset) return list; // 'actual' or unknown → no change
  const out = [];
  for (const f of list) {
    // eslint-disable-next-line no-await-in-loop -- bounded by the file count; keeps peak memory to one bitmap.
    out.push(await compressOneImage(f, preset));
  }
  return out;
}

function totalBytes(files) {
  return Array.from(files || []).reduce((sum, f) => sum + (f.size || 0), 0);
}

function say(statusEl, msg, kind) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.dataset.kind = kind;
  statusEl.hidden = false;
}

function setProgress(progressEl, pct) {
  if (!progressEl) return;
  progressEl.hidden = false;
  progressEl.value = Math.max(0, Math.min(100, pct));
}

async function sha256Hex(arrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function readTurnstileToken(form) {
  // The Turnstile widget script auto-populates this hidden input on solve.
  const input = form.querySelector('input[name="cf-turnstile-response"]');
  return input ? input.value : '';
}

function collectFormFields(form) {
  const fields = {};
  const skip = new Set(['botcheck', 'cf-turnstile-response']);
  new FormData(form).forEach((value, key) => {
    if (skip.has(key) || value instanceof File) return;
    fields[key] = String(value);
  });
  return fields;
}

function collectFiles(form) {
  const inputs = form.querySelectorAll('input[type="file"][data-secure-upload-file]');
  const files = [];
  inputs.forEach((input) => {
    Array.from(input.files || []).forEach((f) => files.push(f));
  });
  return files;
}

/** XHR (not fetch) so we get real upload progress events for the aria-live/progress UI. */
function putWithProgress(url, file, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('network error during upload'));
    xhr.send(file);
  });
}

/**
 * Upload a single File through presign → PUT → /complete, which STAGES the
 * validated file server-side (no email yet — `uploadFiles` calls /finalize
 * once at the end to send ONE owner email for the whole submission). Form-
 * agnostic: takes an explicit `turnstileToken` instead of reading a `<form>`.
 * Form fields are NOT sent here — they go to /finalize. Throws on any failure.
 * `onProgress(pct)` is called with 0-100 for THIS file only (0-90 during the
 * PUT, 90-100 reserved for /complete).
 *
 * F7: the Turnstile token is single-use, so it must be sent only on the
 * FIRST file of a multi-file submission; every subsequent file reuses the
 * submissionId the Worker minted on that first /presign call. Callers loop
 * (see `uploadFiles`) and share one `submissionIdRef` across the whole loop
 * so this function never re-sends a token once a submissionId exists.
 */
async function uploadOneFile(config, file, turnstileToken, submissionIdRef, onProgress) {
  const buf = await file.arrayBuffer();
  if (buf.byteLength > config.maxBytes) {
    throw new Error(`"${file.name}" is larger than the ${Math.round(config.maxBytes / 1024 / 1024)}MB limit.`);
  }
  const sha256 = await sha256Hex(buf);

  const presignBody = {
    siteId: config.siteId,
    filename: file.name,
    contentType: file.type,
    size: file.size,
    sha256,
  };
  if (submissionIdRef.value) {
    presignBody.submissionId = submissionIdRef.value;
  } else {
    presignBody.turnstileToken = turnstileToken || '';
  }

  const presignRes = await fetch(`${config.workerUrl}/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(presignBody),
  });
  const presignData = await presignRes.json().catch(() => ({}));
  if (!presignRes.ok || !presignData.success) {
    throw new Error(presignData.message || 'Could not start the upload.');
  }
  submissionIdRef.value = presignData.submissionId;

  await putWithProgress(presignData.uploadUrl, file, presignData.requiredHeaders, (frac) =>
    onProgress(Math.round(frac * 90)) // reserve the last 10% for /complete
  );

  const completeRes = await fetch(`${config.workerUrl}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteId: config.siteId,
      pendingToken: presignData.pendingToken,
      objectKey: presignData.objectKey,
    }),
  });
  const completeData = await completeRes.json().catch(() => ({}));
  if (!completeRes.ok || !completeData.success) {
    throw new Error(completeData.message || `Could not upload "${file.name}".`);
  }
  onProgress(100);
}

/**
 * Programmatic, form-agnostic upload entry point — the primitive `bindForm`
 * itself is built on. Use this directly when the file field is OPTIONAL
 * (auto-bind's "no file = error" behavior doesn't fit) or when you need to
 * merge fields from a form this module doesn't own (e.g. an existing mailto
 * submit handler).
 *
 * @param {object} config
 * @param {string} config.workerUrl        deployed Worker's public URL (trailing slash ok)
 * @param {string} config.siteId           this site's siteId, as configured in the Worker
 * @param {string} [config.turnstileSiteKey] PUBLIC Turnstile site key (not used by this
 *                                            function directly — carried for callers that
 *                                            also need it to mount the widget)
 * @param {number} [config.maxBytes]       per-file size cap; defaults to 25MB
 * @param {File[]|FileList} files          one or more files to deliver
 * @param {object} [fields]                plain object merged into every /complete's
 *                                          formFields (e.g. { claim_number, email })
 * @param {object} [opts]
 * @param {string} [opts.turnstileToken]   solved Turnstile token for this submission;
 *                                          sent on the first file only (F7)
 * @param {(fileIndex: number, file: File, pct: number) => void} [opts.onProgress]
 *
 * @returns {Promise<{fileCount:number, failures:{name:string,message:string}[]}>}
 *   Resolves once the owner email has been sent (via /finalize) for the files
 *   that uploaded successfully. Individual files that fail are collected in
 *   `failures` rather than aborting the whole submission — so one bad photo in
 *   a 50-photo claim doesn't lose the other 49. Still throws (never silently
 *   resolves as success) if EVERY file failed, or if the final delivery fails.
 */
export async function uploadFiles(config, files, fields = {}, opts = {}) {
  if (!config || !config.workerUrl || !config.siteId) {
    throw new Error('secure-upload: config.workerUrl and config.siteId are required.');
  }
  const cfg = {
    maxBytes: DEFAULT_MAX_BYTES,
    ...config,
    workerUrl: config.workerUrl.replace(/\/+$/, ''),
  };
  const list = Array.from(files || []);
  if (list.length === 0) {
    throw new Error('secure-upload: no files to upload.');
  }

  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : () => {};
  const submissionIdRef = { value: '' }; // F7: shared across the loop — one token, many files
  const failures = [];
  let staged = 0;

  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    try {
      // eslint-disable-next-line no-await-in-loop -- files must upload sequentially: each
      // presign after the first depends on the submissionId minted by the previous call.
      await uploadOneFile(cfg, file, opts.turnstileToken, submissionIdRef, (pct) => onProgress(i, file, pct));
      staged += 1;
    } catch (err) {
      // Collect and keep going — a single rejected file (wrong format, network
      // blip) must not discard the rest of the claim's photos.
      failures.push({ name: file.name, message: (err && err.message) || 'upload failed' });
    }
  }

  if (staged === 0) {
    // Nothing reached the server — do NOT finalize (that would send a fields-
    // only email that hides the fact every file failed). Fail loudly instead.
    const names = failures.map((f) => f.name).join(', ');
    throw new Error(`None of your files could be uploaded${names ? ` (${names})` : ''}. Please try again.`);
  }

  // Finalize: ONE owner email listing every staged file + the form fields.
  const finalizeRes = await fetch(`${cfg.workerUrl}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteId: cfg.siteId,
      submissionId: submissionIdRef.value,
      formFields: fields || {},
    }),
  });
  const finalizeData = await finalizeRes.json().catch(() => ({}));
  if (!finalizeRes.ok || !finalizeData.success) {
    throw new Error(finalizeData.message || 'Could not send your submission.');
  }

  // Trust the server's authoritative delivered count — `??` (not `||`) so a
  // legitimate 0 isn't silently replaced by the local staged count.
  const delivered = finalizeData.fileCount ?? staged;
  if (delivered === 0 && staged > 0) {
    // Files uploaded but none were delivered (e.g. the session outran the
    // retention window). Never claim success on that.
    throw new Error('Your files took too long to upload and expired before sending. Please try again.');
  }
  if (delivered < staged) {
    // Some staged files didn't make the final batch — surface it honestly
    // rather than reporting a full send.
    failures.push({
      name: `${staged - delivered} earlier file(s)`,
      message: 'expired before sending — please re-upload',
    });
  }

  return { fileCount: delivered, failures };
}

/**
 * Unified whole-form submission entry point (plan-v2): text ± files, one
 * call, no mailto. Files present → delegates to `uploadFiles` (which already
 * sends `fields` alongside each file, so the owner email carries both).
 * No files → posts fields-only to the Worker's `POST /submit` — there is no
 * presign/PUT/complete cycle for that path, since there's no file to
 * validate; the Worker still reuses every other control (CORS allow-list,
 * Turnstile, rate-limit, HTML-escaped fields).
 *
 * Throws on ANY failure — same "resolved promise means delivered, full
 * stop" contract as `uploadFiles`. Never resolves on a network error, a
 * non-2xx, or a Worker response that didn't report `success: true` (which
 * itself only happens after the Worker's Resend call is accepted — F2).
 *
 * @param {object} config                same shape as `uploadFiles`'s config
 *   (`workerUrl`, `siteId`, optionally `turnstileSiteKey`/`maxBytes`)
 * @param {object} [opts]
 * @param {object} [opts.fields]          plain object of form field values,
 *                                         e.g. { name, email, message }
 * @param {File[]|FileList} [opts.files]  zero or more files; omit/empty for
 *                                         the fields-only /submit path
 * @param {string} [opts.turnstileToken]  solved Turnstile token for this
 *                                         submission (required either way)
 * @param {(fileIndex:number, file:File, pct:number)=>void} [opts.onProgress]
 *   forwarded to `uploadFiles` when files are present; ignored on the
 *   fields-only path (nothing to report progress on for a single JSON POST)
 * @returns {Promise<{fileCount:number, failures:{name:string,message:string}[]}>}
 *   `fileCount` is how many files were delivered (0 on the fields-only path);
 *   `failures` lists any individual files that couldn't be uploaded.
 */
export async function submitForm(config, opts = {}) {
  if (!config || !config.workerUrl || !config.siteId) {
    throw new Error('secure-upload: config.workerUrl and config.siteId are required.');
  }
  const { fields = {}, turnstileToken, onProgress, quality, maxTotalBytes } = opts;
  let list = Array.from(opts.files || []);

  // Compress photos in the browser (unless quality is 'actual'/unset) BEFORE the
  // size check + upload, so a photo-heavy submission can be shrunk to fit under
  // the email-attach cap.
  if (list.length > 0 && quality) {
    list = await compressImages(list, quality);
  }

  // Client-side total-size pre-check (email-attach cap): fail fast with a clear
  // message rather than uploading everything only to be rejected server-side.
  if (list.length > 0 && maxTotalBytes) {
    const total = totalBytes(list);
    if (total > maxTotalBytes) {
      throw new Error(
        `Your files total ${mb(total)} MB, over the ${mb(maxTotalBytes)} MB limit. ` +
          'Choose a smaller photo quality, or send fewer files.'
      );
    }
  }

  if (list.length > 0) {
    return await uploadFiles(config, list, fields, { turnstileToken, onProgress });
  }

  const workerUrl = config.workerUrl.replace(/\/+$/, '');
  const res = await fetch(`${workerUrl}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteId: config.siteId,
      turnstileToken: turnstileToken || '',
      formFields: fields || {},
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Could not send your submission.');
  }
  return { fileCount: 0, failures: [] };
}

function readConfigFromForm(form, overrides) {
  const cfg = {
    workerUrl: overrides.workerUrl || form.dataset.workerUrl || '',
    siteId: overrides.siteId || form.dataset.siteId || '',
    turnstileSiteKey: overrides.turnstileSiteKey || form.dataset.turnstileSiteKey || '',
    accept: overrides.accept || form.dataset.accept || ALLOWED_ACCEPT_DEFAULT,
    maxBytes: overrides.maxBytes || Number(form.dataset.maxBytes) || DEFAULT_MAX_BYTES,
    // Whole-submission cap for the email-attach total-size pre-check; 0 = skip
    // (the Worker still enforces its own maxTotalBytes regardless).
    maxTotalBytes: overrides.maxTotalBytes || Number(form.dataset.maxTotalBytes) || 0,
    // Default photo-quality preset when the form has no per-submission selector.
    quality: overrides.quality || form.dataset.quality || null,
  };
  cfg.workerUrl = cfg.workerUrl.replace(/\/+$/, '');
  return cfg;
}

// Reads a per-submission quality selector (`[data-secure-upload-quality]`, e.g.
// a <select> with actual/large/medium/small) if the form has one.
function readQuality(form) {
  const el = form.querySelector('[data-secure-upload-quality]');
  if (!el) return null;
  const v = (el.value || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(QUALITY_PRESETS, v) ? v : null;
}

function bindForm(form, overrides) {
  const config = readConfigFromForm(form, overrides);
  const statusEl = form.querySelector('[data-form-status]');
  const progressEl = form.querySelector('[data-secure-upload-progress]');
  const button = form.querySelector('button[type="submit"]');

  if (!config.workerUrl || !config.siteId) {
    // Fail loud in the console for the site builder, not silently to the visitor.
    console.error('secure-upload: form is missing data-worker-url or data-site-id', form);
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const bot = form.querySelector('input[name="botcheck"]');
    if (bot && bot.checked) {
      say(statusEl, 'Thank you — your file has been sent.', 'ok');
      form.reset();
      return;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const files = collectFiles(form);
    if (files.length === 0) {
      say(statusEl, 'Choose a file to attach first.', 'err');
      return;
    }

    if (button) button.disabled = true;
    const total = files.length;
    // "Preparing…" covers the in-browser compression step before uploads start.
    say(statusEl, 'Preparing…', 'info');
    setProgress(progressEl, 0);

    try {
      const result = await submitForm(config, {
        fields: collectFormFields(form),
        files,
        turnstileToken: readTurnstileToken(form),
        quality: readQuality(form) || config.quality || null,
        maxTotalBytes: config.maxTotalBytes,
        onProgress: (fileIndex, _file, pct) => {
          // Overall progress across the whole batch (not just the current file),
          // plus a running "N of M" so a 50-photo upload reads sensibly.
          setProgress(progressEl, Math.round(((fileIndex + pct / 100) / total) * 100));
          if (total > 1) say(statusEl, `Uploading ${Math.min(fileIndex + 1, total)} of ${total}…`, 'info');
        },
      });
      if (result.failures && result.failures.length > 0) {
        // Honesty over politeness: say exactly what didn't make it, and leave
        // the form untouched so the visitor can retry the failed files.
        const names = result.failures.map((f) => f.name).join(', ');
        say(
          statusEl,
          `Sent ${result.fileCount} file${result.fileCount === 1 ? '' : 's'}. ${
            result.failures.length
          } could not be processed (${names}). Please re-upload those or email them to us.`,
          'warn'
        );
      } else {
        say(statusEl, 'Thank you — your files have been sent.', 'ok');
        form.reset();
      }
    } catch (err) {
      // Never claim success on a failed upload/delivery.
      say(statusEl, (err && err.message) || 'Something went wrong. Please call or email us instead.', 'err');
    } finally {
      if (button) button.disabled = false;
      if (progressEl) progressEl.hidden = true;
    }
  });
}

/**
 * Programmatic init. `overrides` (all optional) win over each form's
 * data-* attributes: { workerUrl, siteId, turnstileSiteKey, accept, maxBytes, selector }.
 */
export function initSecureUpload(overrides = {}) {
  const selector = overrides.selector || 'form[data-secure-upload]';
  document.querySelectorAll(selector).forEach((form) => bindForm(form, overrides));
}

// ---------------------------------------------------------------------------
// Attachment preview grid — OPT-IN removable thumbnails
// ---------------------------------------------------------------------------
// Renders a thumbnail grid for a file input, each tile with an X that removes
// that ONE file. Keeps `input.files` the SINGLE source of truth by resyncing it
// from a rebuilt DataTransfer on every add/remove — so `collectFiles`,
// `submitForm`, and any host-page submit handler that reads `input.files` need
// NO changes. Entirely opt-in: only an `input[data-secure-upload-file]` that
// ALSO carries `data-secure-upload-preview` gets a grid, so every existing page
// is byte-behavior-unchanged (the init scan is otherwise an empty query).

const PREVIEWABLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const THUMB_MAX_DIM = 256; // longest edge of the generated thumbnail (~2x a 96-128px tile, for retina)

function previewFileKey(f) {
  return `${f.name}::${f.size}::${f.lastModified}`;
}

function previewHumanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function previewExtLabel(f) {
  const m = /\.([^.]+)$/.exec(f.name);
  return (m ? m[1] : (f.type.split('/')[1] || 'file')).toUpperCase().slice(0, 4);
}

/**
 * Build a small DOWNSCALED thumbnail as a blob: URL for a raster image — never
 * the full-resolution file. A 12-MP photo decodes to ~48 MB of RGBA bitmap no
 * matter how small the tile's CSS box is; 50 concurrently would exhaust mobile
 * Safari's per-tab image budget and crash the whole form. Reuses the same
 * createImageBitmap → canvas path as compressOneImage; the full decode is
 * transient (one at a time, closed immediately) while the rendered <img> holds
 * only the ~256px blob. Returns null for PDFs / undecodable (HEIC) / any failure
 * — the caller then shows a generic file tile and mints no URL. Never throws.
 */
async function makeThumbUrl(file) {
  if (!PREVIEWABLE_IMAGE_TYPES.has(file.type)) return null;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, THUMB_MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (typeof bitmap.close === 'function') bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    if (typeof bitmap.close === 'function') bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

function resolvePreviewContainer(input) {
  const forId = input.getAttribute('data-secure-upload-preview-for');
  if (forId) {
    const byId = document.getElementById(forId);
    if (byId) return byId;
  }
  const sibling =
    input.parentElement && input.parentElement.querySelector('[data-secure-upload-preview-target]');
  if (sibling) return sibling;
  // No container declared — insert one right after the input so the capability
  // works with zero extra markup on the host page.
  const div = document.createElement('div');
  div.setAttribute('data-secure-upload-preview-target', '');
  input.after(div);
  return div;
}

/**
 * Wire a removable thumbnail grid for one file input. `input.files` stays
 * authoritative; a shadow File[] is the working buffer, so re-opening the native
 * picker (which REPLACES input.files wholesale) APPENDS instead of silently
 * discarding previously-kept files. Returns a small handle: { clear }.
 */
export function mountAttachmentPreview(input, container) {
  const files = []; // shadow buffer — the memory the native input doesn't keep
  const urls = new Map(); // fileKey -> blob: URL (image tiles only)
  const nodes = new Map(); // fileKey -> tile element
  const tileTag = /^(?:UL|OL)$/.test(container.tagName) ? 'li' : 'div';

  // Concise announcements go through a DEDICATED visually-hidden live region —
  // NOT an aria-live on the grid container itself (that would re-read every tile
  // + every "Remove <file>" button label on each add/remove).
  const live = document.createElement('span');
  live.setAttribute('aria-live', 'polite');
  live.className = 'su-preview__sr';
  live.style.cssText =
    'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
  container.after(live);

  const announce = (msg) => {
    live.textContent = msg;
  };

  // Rebuild input.files from the shadow buffer. Assigning input.files does NOT
  // fire change/input, so this cannot loop.
  function syncInput() {
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    input.files = dt.files;
  }

  function focusAfterRemove(removedIndex) {
    const buttons = container.querySelectorAll('button[data-su-remove]');
    if (buttons.length === 0) {
      input.focus();
      return;
    }
    const next = buttons[Math.min(removedIndex, buttons.length - 1)];
    if (next) next.focus();
  }

  function removeByKey(key) {
    const i = files.findIndex((f) => previewFileKey(f) === key);
    if (i === -1) return;
    const removed = files[i];
    files.splice(i, 1);
    const url = urls.get(key);
    if (url) {
      URL.revokeObjectURL(url);
      urls.delete(key);
    }
    const node = nodes.get(key);
    if (node) {
      node.remove();
      nodes.delete(key);
    }
    syncInput();
    announce(`Removed ${removed.name}. ${files.length} attachment${files.length === 1 ? '' : 's'} remaining.`);
    focusAfterRemove(i);
  }

  async function addTile(file) {
    const key = previewFileKey(file);
    const tile = document.createElement(tileTag);
    tile.className = 'su-thumb';

    const media = document.createElement('div');
    media.className = 'su-thumb__media';
    const thumbUrl = await makeThumbUrl(file);
    if (thumbUrl) {
      urls.set(key, thumbUrl);
      const img = document.createElement('img');
      img.src = thumbUrl;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      // A file whose MIME passed the allow-list but is actually corrupt/mislabeled:
      // drop to a generic tile and free the URL rather than showing a broken image.
      img.addEventListener('error', () => {
        URL.revokeObjectURL(thumbUrl);
        urls.delete(key);
        img.remove();
        media.classList.add('su-thumb__media--file');
        media.textContent = previewExtLabel(file);
      });
      media.appendChild(img);
    } else {
      media.classList.add('su-thumb__media--file');
      media.textContent = previewExtLabel(file);
    }

    // Filenames are attacker-controllable — always textContent, never innerHTML.
    const name = document.createElement('span');
    name.className = 'su-thumb__name';
    name.textContent = file.name;
    name.title = file.name;

    const size = document.createElement('span');
    size.className = 'su-thumb__size';
    size.textContent = previewHumanSize(file.size);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'su-thumb__remove';
    remove.setAttribute('data-su-remove', key);
    remove.setAttribute('aria-label', `Remove ${file.name}`);
    remove.textContent = '×'; // ×
    remove.addEventListener('click', () => removeByKey(key));

    tile.append(media, name, size, remove);
    nodes.set(key, tile);
    container.appendChild(tile);
  }

  // Merge a native pick (or the initial input.files) into the shadow buffer with
  // dedupe, resync input.files, then render only the newly-added tiles.
  async function merge(fileList) {
    const incoming = Array.from(fileList || []);
    const added = [];
    for (const f of incoming) {
      const key = previewFileKey(f);
      if (files.some((x) => previewFileKey(x) === key)) continue; // dedupe (name+size+lastModified)
      files.push(f);
      added.push(f);
    }
    // Always resync — the native picker REPLACED input.files with just this pick,
    // so even when every file was a duplicate we must restore the full shadow set
    // (otherwise re-picking only already-present files would silently drop the rest).
    syncInput();
    if (added.length === 0) return;
    for (const f of added) {
      // eslint-disable-next-line no-await-in-loop -- bounded by the pick size; one bitmap decode at a time keeps peak memory flat.
      await addTile(f);
    }
    announce(`${files.length} attachment${files.length === 1 ? '' : 's'} selected.`);
  }

  // Revoke every URL + empty the grid + drop the shadow buffer. Does NOT touch
  // input.files (the host's reset/success path owns that). Idempotent.
  function clear() {
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls.clear();
    nodes.clear();
    files.length = 0;
    container.textContent = '';
  }

  input.addEventListener('change', () => {
    merge(input.files);
  });
  // Render-on-bind catch-up: a pick made before this async-imported module bound
  // is already in input.files — render it now so it is never silently dropped.
  if (input.files && input.files.length) merge(input.files);
  // Backstop teardown: form.reset() fires a synchronous 'reset' event, so the
  // grid + object URLs are cleaned on every reset-based success/clear path.
  if (input.form) input.form.addEventListener('reset', clear);

  return { clear };
}

const _attachmentPreviewControllers = [];

/**
 * Scan for opt-in file inputs (`[data-secure-upload-file][data-secure-upload-preview]`)
 * and mount a removable thumbnail grid on each. A no-op — an empty
 * querySelectorAll — for every page that hasn't opted in, so it is always safe
 * to call. Idempotent per input (guards with a `data-su-preview-bound` marker).
 */
export function initAttachmentPreviews(root = document) {
  root
    .querySelectorAll('input[type="file"][data-secure-upload-file][data-secure-upload-preview]')
    .forEach((input) => {
      if (input.dataset.suPreviewBound) return;
      input.dataset.suPreviewBound = '1';
      const container = resolvePreviewContainer(input);
      _attachmentPreviewControllers.push(mountAttachmentPreview(input, container));
    });
}

/**
 * Clear every mounted preview grid (revoke URLs + empty). For host pages whose
 * success/teardown path does NOT call form.reset() (e.g. a mailto-only submit)
 * and that want the grid cleared anyway; reset-based flows are already covered
 * by each controller's own 'reset' listener.
 */
export function clearAttachmentPreviews() {
  _attachmentPreviewControllers.forEach((c) => c.clear());
}

// Auto-init on module load so the common case is just dropping in the
// <script type="module"> tag + data-* attributes, matching the kit's
// Web3FormScript.astro convention of "no JS wiring required per page."
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initSecureUpload();
      initAttachmentPreviews();
    });
  } else {
    initSecureUpload();
    initAttachmentPreviews();
  }
}
