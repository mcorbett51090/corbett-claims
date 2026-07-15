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

// Auto-init on module load so the common case is just dropping in the
// <script type="module"> tag + data-* attributes, matching the kit's
// Web3FormScript.astro convention of "no JS wiring required per page."
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initSecureUpload());
  } else {
    initSecureUpload();
  }
}
