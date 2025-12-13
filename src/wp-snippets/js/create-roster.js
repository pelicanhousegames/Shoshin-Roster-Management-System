document.addEventListener('DOMContentLoaded', function () {
  // =============================================================================
  // SHOSHIN /create-roster — Phase 4A (Option A)
  // - Metadata-only roster creation
  // - Live summary preview + Ref ID normalization ONLY
  // - Validation handled by WPForms + shared data-validation.js
  // =============================================================================

  const FORM_ID = 2799;

  // WPForms field IDs (confirmed from your mapping)
  const FIELD_ID_ROSTER_REF  = 3; // "Reference ID"
  const FIELD_ID_ROSTER_NAME = 5; // "Clan Name"

  const formEl = document.querySelector(`#wpforms-form-${FORM_ID}`);
  if (!formEl) return;

  function fieldEl(fieldId) {
    // Prefer the standard WPForms input ID
    let el = formEl.querySelector(`#wpforms-${FORM_ID}-field_${fieldId}`);
    if (el) return el;

    // Fallback: name-based selector
    el = formEl.querySelector(`[name="wpforms[fields][${fieldId}]"]`);
    if (el) return el;

    // Fallback: first input inside the field container
    const container = formEl.querySelector(`#wpforms-${FORM_ID}-field_${fieldId}-container`);
    if (!container) return null;
    return container.querySelector('input, textarea, select');
  }

  const nameInput = fieldEl(FIELD_ID_ROSTER_NAME);
  const refInput  = fieldEl(FIELD_ID_ROSTER_REF);

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function normalizeRefId(raw) {
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/[\s_]+/g, '-')   // spaces/underscores -> hyphen
      .replace(/-+/g, '-');      // collapse repeated hyphens
  }

  // Guardrails
  if (!nameInput || !refInput) {
    setHtml(
      'shoshin-roster-errors',
      `<div><strong>Config error:</strong> Could not find WPForms inputs for Form ${FORM_ID}.</div>
       <div>Expected fields: Ref ID (#${FIELD_ID_ROSTER_REF}) and Clan Name (#${FIELD_ID_ROSTER_NAME}).</div>`
    );
    return;
  }

  function render() {
    const clanName = String(nameInput.value || '').trim();
    const rawRef   = refInput.value || '';
    const ref      = normalizeRefId(rawRef);

    // Normalize input value (best-effort caret restore)
    if (rawRef !== ref) {
      const start = refInput.selectionStart;
      const end = refInput.selectionEnd;
      refInput.value = ref;
      try { refInput.setSelectionRange(start, end); } catch (_) {}
    }

    // Update summary block (IDs exist in your HTML block)
    setText('shoshin-roster-name-preview', clanName || '—');
    setText('shoshin-roster-ref-preview', ref || '—');

    // Show a simple status if non-empty (no validation messaging here)
    if (ref) {
      setHtml('shoshin-roster-ref-status', `<span style="color:#1b5e20;">✓</span>`);
    } else {
      setHtml('shoshin-roster-ref-status', '');
    }

    // Errors handled centrally by WPForms + data-validation.js
    setHtml('shoshin-roster-errors', '');
  }

  // Live updates
  nameInput.addEventListener('input', render);
  refInput.addEventListener('input', render);

  // Initial paint
  render();
});
