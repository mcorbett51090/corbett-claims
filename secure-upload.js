/**
 * secure-upload.js — framework-agnostic drop-in client for the raven-site-kit
 * secure-upload Worker. Progressive enhancement, no build step required:
 * works as a plain `<script type="module" src="secure-upload.js"></script>`
 * on a static page (see ../README.md for the full adoption runbook and
 * SecureUploadField.astro for the Astro-wrapped version of this same markup
 * contract).
 *
 * Two ways to use this module:
 *
 *   1. AUTO-BIND (default, zero JS wiring) — drop the script tag on a page
 *      with a `form[data-secure-upload]` and this module wires the whole
 *      submit → presign → PUT → /complete flow for you. Auto-bind treats
 *      "no file selected" as a hard error and owns the entire form submit —
 *      only use it when the file field is REQUIRED.
 *
 *   2. PROGRAMMATIC (`uploadFiles`) — call this directly from your own
 *      submit handler when the file field is OPTIONAL, when you need to
 *      merge in fields from a form the module doesn't own, or when you're
 *      running an existing (e.g. mailto) submission path side by side and
 *      only want to hand files to this Worker. See `uploadFiles` below.
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
 * SCOPE: this module uploads FILES ONLY. Non-file form fields are read (or,
 * in the programmatic path, passed in by the caller) and sent along with
 * each /complete call so the Worker can include them in the owner email,
 * but this module does not replace your existing text-field submission path
 * (e.g. Web3Forms/mailto) — PLAN.md's corbett-claims adoption (P6) is
 * explicitly additive: keep the proven text-field channel, route only file
 * attachments through this Worker. Wire both handlers to the same `<form>`
 * if you want one submit button to do both.
 *
 * NO SECRETS ARE EVER READ OR SENT FROM HERE. The only credential-shaped
 * value in this file is the Turnstile SITE key, which is public by design.
 */

const ALLOWED_ACCEPT_DEFAULT = 'image/jpeg,image/png,image/gif,image/webp,application/pdf';
const DEFAULT_MAX_BYTES = 26214400; // 25MB — must not exceed the Worker's per-site maxBytes; see README.

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
 * Upload a single File through presign → PUT → /complete. Form-agnostic:
 * takes an explicit `turnstileToken` and `fields` object instead of reading
 * either off a `<form>`. Throws on any failure — never resolves on a failed
 * delivery. `onProgress(pct)` is called with 0-100 for THIS file only
 * (0-90 during the PUT, 90-100 reserved for /complete).
 *
 * F7: the Turnstile token is single-use, so it must be sent only on the
 * FIRST file of a multi-file submission; every subsequent file reuses the
 * submissionId the Worker minted on that first /presign call. Callers loop
 * (see `uploadFiles`) and share one `submissionIdRef` across the whole loop
 * so this function never re-sends a token once a submissionId exists.
 */
async function uploadOneFile(config, file, fields, turnstileToken, submissionIdRef, onProgress) {
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
      formFields: fields || {},
    }),
  });
  const completeData = await completeRes.json().catch(() => ({}));
  if (!completeRes.ok || !completeData.success) {
    throw new Error(completeData.message || `Could not deliver "${file.name}".`);
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
 * @returns {Promise<void>} resolves ONLY once every file has been delivered.
 *   Throws (never silently resolves) on any failure — a resolved promise
 *   means delivered, full stop.
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
  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    // eslint-disable-next-line no-await-in-loop -- files must upload sequentially: each
    // presign after the first depends on the submissionId minted by the previous call.
    await uploadOneFile(cfg, file, fields, opts.turnstileToken, submissionIdRef, (pct) =>
      onProgress(i, file, pct)
    );
  }
}

function readConfigFromForm(form, overrides) {
  const cfg = {
    workerUrl: overrides.workerUrl || form.dataset.workerUrl || '',
    siteId: overrides.siteId || form.dataset.siteId || '',
    turnstileSiteKey: overrides.turnstileSiteKey || form.dataset.turnstileSiteKey || '',
    accept: overrides.accept || form.dataset.accept || ALLOWED_ACCEPT_DEFAULT,
    maxBytes: overrides.maxBytes || Number(form.dataset.maxBytes) || DEFAULT_MAX_BYTES,
  };
  cfg.workerUrl = cfg.workerUrl.replace(/\/+$/, '');
  return cfg;
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
    say(statusEl, 'Uploading…', 'info');
    setProgress(progressEl, 0);

    try {
      await uploadFiles(config, files, collectFormFields(form), {
        turnstileToken: readTurnstileToken(form),
        onProgress: (_fileIndex, _file, pct) => setProgress(progressEl, pct),
      });
      say(statusEl, 'Thank you — your file has been sent.', 'ok');
      form.reset();
    } catch (err) {
      // Honesty over politeness: never claim success on a failed upload/delivery.
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
