document.addEventListener('DOMContentLoaded', function () {

  // === Register all forms that use Reference ID validation ===
  const FORMS = [
    { formId: 2247, refFieldId: 4 }, // Character Creator
    { formId: 2501, refFieldId: 3 }  // Support Asset Creator
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
});
