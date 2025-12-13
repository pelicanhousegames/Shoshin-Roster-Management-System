document.addEventListener('DOMContentLoaded', function () {
  // Apply behavior to these WPForms IDs
  const FORM_IDS = [2247, 2501, 2799];

  /**
   * Injects the "Create Another" and "My Assets" buttons
   * into a given confirmation container.
   */
  function injectShoshinPostSubmitButtons(container) {
    if (!container) return;

    // Prevent duplicate injection
    if (container.dataset.shoshinButtonsAdded === 'true') return;
    container.dataset.shoshinButtonsAdded = 'true';

    // Wrapper for buttons
    const wrapper = document.createElement('div');
    wrapper.style.marginTop = '1rem';
    wrapper.style.display = 'flex';
    wrapper.style.flexWrap = 'wrap';
    wrapper.style.gap = '0.5rem';

    // --- "Create Another" button ---
    const btnCreateAnother = document.createElement('button');
    btnCreateAnother.type = 'button';
    btnCreateAnother.textContent = 'Create Another';
    btnCreateAnother.style.padding = '6px 12px';
    btnCreateAnother.style.borderRadius = '4px';
    btnCreateAnother.style.border = 'none';
    btnCreateAnother.style.cursor = 'pointer';
    btnCreateAnother.style.fontSize = '0.9rem';
    btnCreateAnother.style.backgroundColor = '#2e7d32'; // green
    btnCreateAnother.style.color = '#fff';

    btnCreateAnother.addEventListener('click', function () {
      // Simply reload the current page to start a new entry
      window.location.reload();
    });

    // --- "My Assets" button ---
    const btnMyAssets = document.createElement('a');
    btnMyAssets.href = '/my-assets';
    btnMyAssets.textContent = 'My Assets';
    btnMyAssets.style.display = 'inline-block';
    btnMyAssets.style.padding = '6px 12px';
    btnMyAssets.style.borderRadius = '4px';
    btnMyAssets.style.border = 'none';
    btnMyAssets.style.cursor = 'pointer';
    btnMyAssets.style.fontSize = '0.9rem';
    btnMyAssets.style.textDecoration = 'none';
    btnMyAssets.style.backgroundColor = '#1976d2'; // blue-ish
    btnMyAssets.style.color = '#fff';

    // Add buttons to wrapper, wrapper to confirmation container
    wrapper.appendChild(btnCreateAnother);
    wrapper.appendChild(btnMyAssets);
    container.appendChild(wrapper);
  }

  // For each form ID, look for its confirmation container
  FORM_IDS.forEach(function (formId) {
    // Standard WPForms confirmation container ID pattern
    const confirmId = 'wpforms-confirmation-' + formId;
    const confirmEl = document.getElementById(confirmId);

    // If the confirmation is already in the DOM (non-AJAX submit)
    if (confirmEl) {
      injectShoshinPostSubmitButtons(confirmEl);
    }

    // Defensive: if in future you enable AJAX, we can hook into DOM changes
    // by watching for the confirmation container to appear.
    // Lightweight MutationObserver on the form wrapper:
    const formWrapper = document.getElementById('wpforms-' + formId);
    if (!formWrapper) return;

    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (
            node.nodeType === 1 && // ELEMENT_NODE
            node.id === confirmId
          ) {
            injectShoshinPostSubmitButtons(node);
          }
        });
      });
    });

    observer.observe(formWrapper, {
      childList: true,
      subtree: true
    });
  });
});
