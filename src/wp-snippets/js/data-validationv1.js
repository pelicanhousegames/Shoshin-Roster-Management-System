document.addEventListener('DOMContentLoaded', function () {

  // === Register all forms that use Reference ID validation ===
  const FORMS = [
  { formId: 2247, refFieldId: 4 }, // Character Creator
  { formId: 2501, refFieldId: 3 }, // Support Asset Creator
  { formId: 2799, refFieldId: 3 }  // Clan Roster Creator
  ];


  // === Find which form is currently on this page ===
  let activeForm = null;
  for (const f of FORMS) {
    const formEl = document.getElementById('wpforms-form-' + f.formId);
    if (formEl) {
      activeForm = { ...f, el: formEl };
      break;
    }
  }

  if (!activeForm) return; // no relevant form found

  const { formId, refFieldId, el: formEl } = activeForm;

  // === Locate the reference ID input ===
  const refSelector = `#wpforms-${formId}-field_${refFieldId}`;
  const refInput = document.querySelector(refSelector);
  if (!refInput) return;

  // === Standardized error handlers ===
  function showRefError(message) {
    const fieldWrapper = refInput.closest('.wpforms-field');
    if (!fieldWrapper) return;

    let existing = fieldWrapper.querySelector('.shoshin-refid-error');
    if (existing) existing.remove();

    refInput.classList.add('wpforms-error');
    refInput.setAttribute('aria-invalid', 'true');

       const err = document.createElement('div');
    err.className = 'wpforms-error shoshin-refid-error';
    err.textContent = message;

    // Ensure red even if theme CSS is different
    err.style.color = '#c0392b';
    err.style.fontWeight = '500';
    err.style.marginTop = '6px';

    fieldWrapper.appendChild(err);

  }

  function clearRefError() {
    const fieldWrapper = refInput.closest('.wpforms-field');
    if (!fieldWrapper) return;

    refInput.classList.remove('wpforms-error');
    refInput.removeAttribute('aria-invalid');

    let existing = fieldWrapper.querySelector('.shoshin-refid-error');
    if (existing) existing.remove();
  }

    // === Generic field error handlers (for conditional validation) ===
  function showFieldError(inputEl, message, errorClass) {
    const fieldWrapper = inputEl ? inputEl.closest('.wpforms-field') : null;
    if (!fieldWrapper) return;

    const cls = errorClass || 'shoshin-field-error';
    let existing = fieldWrapper.querySelector('.' + cls);
    if (existing) existing.remove();

    inputEl.classList.add('wpforms-error');
    inputEl.setAttribute('aria-invalid', 'true');

    const err = document.createElement('div');
    err.className = 'wpforms-error ' + cls;
    err.textContent = message;

    // Ensure red even if theme CSS is different
    err.style.color = '#c0392b';
    err.style.fontWeight = '500';
    err.style.marginTop = '6px';

    fieldWrapper.appendChild(err);

  }

  function clearFieldError(inputEl, errorClass) {
    const fieldWrapper = inputEl ? inputEl.closest('.wpforms-field') : null;
    if (!fieldWrapper) return;

    const cls = errorClass || 'shoshin-field-error';
    inputEl.classList.remove('wpforms-error');
    inputEl.removeAttribute('aria-invalid');

    let existing = fieldWrapper.querySelector('.' + cls);
    if (existing) existing.remove();
  }


  // === Live typing clears the error ===
  refInput.addEventListener('input', function () {
    if (refInput.value.trim().length >= 3) {
      clearRefError();
    }
  });

  // === Validate whenever NEXT PAGE is clicked ===
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.wpforms-page-button.wpforms-page-next');
    if (!btn) return;

    // Confirm this Next button belongs to the active form
    if (!formEl.contains(btn)) return;

    const value = refInput.value.trim();

    if (value.length < 3) {
      e.preventDefault();
      e.stopImmediatePropagation();
      showRefError('Please enter at least 3 characters for the Reference ID.');
      refInput.focus();
    }
  }, true); // capture first




    // === Validate on FORM SUBMIT as well (covers single-step forms like 2799) ===
formEl.addEventListener('submit', function (e) {

  // --- Ref ID validation (existing behavior) ---
  const value = refInput.value.trim();
  if (value.length < 3) {
    e.preventDefault();
    e.stopImmediatePropagation();
    showRefError('Please enter at least 3 characters for the Reference ID.');
    refInput.focus();
    return;
  }

  // --- Support Asset Creator (2501): Wasen requires Hull Size + Vessel Dimensions ---
  if (formId === 2501) {
    const supportTypeEl = document.querySelector(`#wpforms-${formId}-field_4`);
    const hullEl        = document.querySelector(`#wpforms-${formId}-field_13`);
    const dimEl         = document.querySelector(`#wpforms-${formId}-field_18`);

    const supportType = supportTypeEl ? String(supportTypeEl.value || '').trim() : '';

    // Clear stale errors so switching Ozutsu <-> Wasen is reversible
    if (hullEl) clearFieldError(hullEl, 'shoshin-wasen-hull-error');
    if (dimEl)  clearFieldError(dimEl,  'shoshin-wasen-dim-error');

    if (supportType === 'Wasen') {
      const hullVal = hullEl ? String(hullEl.value || '').trim() : '';
      const dimVal  = dimEl ? String(dimEl.value || '').trim() : '';

      let ok = true;

      if (!hullVal) {
        ok = false;
        if (hullEl) showFieldError(hullEl, 'Required when Wasen is selected.', 'shoshin-wasen-hull-error');
      }
      if (!dimVal) {
        ok = false;
        if (dimEl) showFieldError(dimEl, 'Required when Wasen is selected.', 'shoshin-wasen-dim-error');
      }

      if (!ok) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!hullVal && hullEl) hullEl.focus();
        else if (!dimVal && dimEl) dimEl.focus();
        return;
      }
    }
  }

}, true);


    // === Live-clear Wasen validation errors on user change ===
  if (formId === 2501) {
    const supportTypeEl = document.querySelector(`#wpforms-${formId}-field_4`);
    const hullEl        = document.querySelector(`#wpforms-${formId}-field_13`);
    const dimEl         = document.querySelector(`#wpforms-${formId}-field_18`);

    function clearWasenErrorsIfResolved() {
      const supportType = supportTypeEl ? String(supportTypeEl.value || '').trim() : '';

      // If not Wasen, clear both errors unconditionally
      if (supportType !== 'Wasen') {
        if (hullEl) clearFieldError(hullEl, 'shoshin-wasen-hull-error');
        if (dimEl)  clearFieldError(dimEl,  'shoshin-wasen-dim-error');
        return;
      }

      // Wasen: clear each error if its field now has a value
      const hullVal = hullEl ? String(hullEl.value || '').trim() : '';
      const dimVal  = dimEl ? String(dimEl.value || '').trim() : '';

      if (hullVal && hullEl) clearFieldError(hullEl, 'shoshin-wasen-hull-error');
      if (dimVal && dimEl)   clearFieldError(dimEl,  'shoshin-wasen-dim-error');
    }

    if (supportTypeEl) supportTypeEl.addEventListener('change', clearWasenErrorsIfResolved);
    if (hullEl)        hullEl.addEventListener('change', clearWasenErrorsIfResolved);
    if (dimEl)         dimEl.addEventListener('change', clearWasenErrorsIfResolved);
  }


});
