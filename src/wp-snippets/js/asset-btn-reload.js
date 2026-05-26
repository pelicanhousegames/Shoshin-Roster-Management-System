document.addEventListener('DOMContentLoaded', function () {
  // Apply behavior to these WPForms IDs
  const FORM_IDS = [2247, 2501, 2799];

  /**
   * Injects a "What would you like to do next?" action area
   * into a given confirmation container.
   */
  function injectShoshinPostSubmitButtons(container) {
    if (!container) return;

    // Prevent duplicate injection
    if (container.dataset.shoshinButtonsAdded === 'true') return;
    container.dataset.shoshinButtonsAdded = 'true';

    // Normalize current path (no trailing slash)
    var path = (window.location && window.location.pathname) ? window.location.pathname : '';
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

    // --- Outer wrapper (centered) ---
    var outer = document.createElement('div');
    outer.style.marginTop = '1.25rem';
    outer.style.textAlign = 'center';

    // Title
    var title = document.createElement('div');
    title.textContent = 'What would you like to do next?';
    title.style.fontWeight = '700';
    title.style.fontSize = '1.05rem';
    title.style.marginBottom = '0.75rem';
    outer.appendChild(title);

    // Buttons wrapper
    var wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexWrap = 'wrap';
    wrapper.style.gap = '0.5rem';
    wrapper.style.justifyContent = 'center';
    wrapper.style.alignItems = 'center';
    outer.appendChild(wrapper);

    function styleAsBtn(el, bg) {
      el.style.display = 'inline-block';
      el.style.padding = '8px 14px';
      el.style.borderRadius = '6px';
      el.style.border = 'none';
      el.style.cursor = 'pointer';
      el.style.fontSize = '0.95rem';
      el.style.fontWeight = '600';
      el.style.textDecoration = 'none';
      el.style.backgroundColor = bg;
      el.style.color = '#fff';
      el.style.lineHeight = '1.1';
    }

    // --- Primary: Context-aware Create (blue) ---
    var btnPrimaryCreate = document.createElement('button');
    btnPrimaryCreate.type = 'button';

    if (isCreateCharacter) {
      btnPrimaryCreate.textContent = 'Create Character';
    } else if (isCreateAsset) {
      btnPrimaryCreate.textContent = 'Create Support Asset';
    } else if (isCreateRoster) {
      btnPrimaryCreate.textContent = 'Create Clan Roster';
    } else {
      btnPrimaryCreate.textContent = 'Create Another';
    }

    styleAsBtn(btnPrimaryCreate, '#ffcc39'); // yellow (primary action)
    btnPrimaryCreate.style.color = '#000';



    btnPrimaryCreate.addEventListener('click', function () {
      window.location.reload();
    });

    wrapper.appendChild(btnPrimaryCreate);



    // --- Conditional yellow CTAs ---
    // Blue (your modal accent tone); black text for readability
    function styleAsBlueBtn(el) {
      el.style.display = 'inline-block';
      el.style.padding = '8px 14px';
      el.style.borderRadius = '6px';
      el.style.border = 'none';
      el.style.cursor = 'pointer';
      el.style.fontSize = '0.95rem';
      el.style.fontWeight = '600';
      el.style.textDecoration = 'none';
      el.style.backgroundColor = '#1976d2'; // blue
      el.style.color = '#fff';
      el.style.lineHeight = '1.1';
    }


    var isCreateCharacter = (path === '/create-character');
    var isCreateAsset     = (path === '/create-asset');
    var isCreateRoster    = (path === '/create-roster');

    if (isCreateCharacter) {
      var btnCreateAsset = document.createElement('a');
      btnCreateAsset.href = '/create-asset';
      btnCreateAsset.textContent = 'Create Support Asset';
      styleAsBlueBtn(btnCreateAsset);
      wrapper.appendChild(btnCreateAsset);

      var btnCreateRoster = document.createElement('a');
      btnCreateRoster.href = '/create-roster';
      btnCreateRoster.textContent = 'Create Clan Roster';
      styleAsBlueBtn(btnCreateRoster);
      wrapper.appendChild(btnCreateRoster);
    } else if (isCreateAsset) {
      var btnCreateChar = document.createElement('a');
      btnCreateChar.href = '/create-character';
      btnCreateChar.textContent = 'Create Character';
      styleAsBlueBtn(btnCreateChar);
      wrapper.appendChild(btnCreateChar);

      var btnCreateRoster2 = document.createElement('a');
      btnCreateRoster2.href = '/create-roster';
      btnCreateRoster2.textContent = 'Create Clan Roster';
      styleAsBlueBtn(btnCreateRoster2);
      wrapper.appendChild(btnCreateRoster2);
    } else if (isCreateRoster) {
      var btnCreateChar2 = document.createElement('a');
      btnCreateChar2.href = '/create-character';
      btnCreateChar2.textContent = 'Create Character';
      styleAsBlueBtn(btnCreateChar2);
      wrapper.appendChild(btnCreateChar2);

      var btnCreateAsset2 = document.createElement('a');
      btnCreateAsset2.href = '/create-asset';
      btnCreateAsset2.textContent = 'Create Support Asset';
      styleAsBlueBtn(btnCreateAsset2);
      wrapper.appendChild(btnCreateAsset2);
    }

    // Add to confirmation container
    container.appendChild(outer);
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
