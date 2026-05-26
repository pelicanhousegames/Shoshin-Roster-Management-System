document.addEventListener('DOMContentLoaded', function () {
  if (!window.SHOSHIN_RMS_GATE || !SHOSHIN_RMS_GATE.ajaxurl || !SHOSHIN_RMS_GATE.nonce) return;

  const FORMS = [
    { formId: 2247, subtypeFieldId: 6, errorFieldId: 6, subtypeLabel: 'Character Class' },   // Character Class
    { formId: 2501, subtypeFieldId: 4, errorFieldId: 4, subtypeLabel: 'Support Asset Type' }, // Support Asset Type
    { formId: 2799, subtypeFieldId: null, errorFieldId: 5, subtypeLabel: '' }                 // Clan Name
  ];

  // Find active form
  let active = null;
  for (const f of FORMS) {
    const el = document.getElementById('wpforms-form-' + f.formId);
    if (el) { active = { ...f, el }; break; }
  }
  if (!active) return;

  const { formId, subtypeFieldId, errorFieldId, subtypeLabel, el: formEl } = active;

  const errorInput = document.querySelector(`#wpforms-${formId}-field_${errorFieldId}`);
  if (!errorInput) return;

  const subtypeInput = subtypeFieldId
    ? document.querySelector(`#wpforms-${formId}-field_${subtypeFieldId}`)
    : null;

  const ERROR_CLASS = 'shoshin-rms-gate-error';

  function showFieldError(inputEl, message) {
    const wrap = inputEl ? inputEl.closest('.wpforms-field') : null;
    if (!wrap) return;

    const existing = wrap.querySelector('.' + ERROR_CLASS);
    if (existing) existing.remove();

    inputEl.classList.add('wpforms-error');
    inputEl.setAttribute('aria-invalid', 'true');

    const err = document.createElement('div');
    err.className = 'wpforms-error ' + ERROR_CLASS;
    err.textContent = message;
    err.style.color = '#c0392b';
    err.style.fontWeight = '500';
    err.style.marginTop = '6px';

    wrap.appendChild(err);
  }

  function clearFieldError(inputEl) {
    const wrap = inputEl ? inputEl.closest('.wpforms-field') : null;
    if (!wrap) return;

    inputEl.classList.remove('wpforms-error');
    inputEl.removeAttribute('aria-invalid');

    const existing = wrap.querySelector('.' + ERROR_CLASS);
    if (existing) existing.remove();
  }

function enableButtons() {
  formEl.querySelectorAll(
    '.wpforms-page-button.wpforms-page-next, .wpforms-submit, button[type="submit"], input[type="submit"]'
  ).forEach(b => {
    try { b.disabled = false; } catch (e) {}
  });
}

  function getSubtypeValue() {
    if (formId === 2799) return '';
    if (!subtypeInput) return '';
    return String(subtypeInput.value || '').trim();
  }

  // Clear errors and “unlock” UX on edits
  errorInput.addEventListener('input', function () {
    clearFieldError(errorInput);
    enableButtons();
  });

  if (subtypeInput) {
    subtypeInput.addEventListener('change', function () {
      clearFieldError(errorInput);
      enableButtons();
    });
  }

  let inFlight = false;

  async function gateCheck() {
    if (inFlight) return { ok: false, msg: 'Please wait...' };
    inFlight = true;

    try {
      const subtype = getSubtypeValue();

      const body = new URLSearchParams();
      body.append('action', 'shoshin_rms_gate_check');
      body.append('nonce', SHOSHIN_RMS_GATE.nonce);
      body.append('form_id', String(formId));
      body.append('subtype', subtype);

      const res = await fetch(SHOSHIN_RMS_GATE.ajaxurl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: body.toString()
      });

      const json = await res.json();
      return (json && typeof json.ok !== 'undefined')
        ? json
        : { ok: false, msg: 'Unexpected validation response. Please refresh and try again.' };

    } catch (e) {
      return { ok: false, msg: 'Validation failed. Please refresh and try again.' };
    } finally {
      inFlight = false;
    }
  }

  /**
   * KEY FIX:
   * - We intercept Next/Submit click early (capture)
   * - We ALWAYS prevent default while we async-check
   * - If allowed, we "replay" the click once, bypassing our interceptor,
   *   so WPForms processes it cleanly and advances.
   */
  let bypassOnce = false;

  async function handleActionClick(e, btn) {
    if (!btn) return;

    // If we're replaying, let WPForms handle it.
    if (bypassOnce) return;

    // Respect other validators (e.g., Ref ID min length) if they already blocked
    if (e.defaultPrevented) return;

    // We are going async — stop WPForms from acting yet.
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();

    clearFieldError(errorInput);

    // Require subtype selection before continuing (2247/2501)
    if (formId !== 2799) {
      const st = getSubtypeValue();
      if (!st) {
        showFieldError(errorInput, `Please select a ${subtypeLabel} before continuing.`);
        errorInput.focus();
        enableButtons();
        return;
      }
    }

    // Disable button while checking
    btn.disabled = true;

    try {
      const result = await gateCheck();

      if (!result.ok) {
        showFieldError(
          errorInput,
          result.msg || 'Your membership does not allow additional entries of this type.'
        );
        errorInput.focus();
        return;
      }

      // Allowed: replay the click so WPForms proceeds normally
      clearFieldError(errorInput);

      bypassOnce = true;
      btn.disabled = false;

      // Trigger WPForms' own handler
      btn.click();

      // Turn bypass off immediately after the replay
      setTimeout(function () { bypassOnce = false; }, 0);

    } finally {
      // Make sure we never leave the UI disabled
      btn.disabled = false;
    }
  }

  // Intercept NEXT (multi-step)
  formEl.addEventListener('click', function (e) {
    const btn = e.target.closest('.wpforms-page-button.wpforms-page-next');
    if (!btn) return;
    handleActionClick(e, btn);
  }, true);

  // Intercept SUBMIT (single-step)
  formEl.addEventListener('click', function (e) {
    const btn = e.target.closest('.wpforms-submit, button[type="submit"], input[type="submit"]');
    if (!btn) return;
    handleActionClick(e, btn);
  }, true);

});