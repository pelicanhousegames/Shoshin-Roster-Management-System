(function () {
  function isCustomMetaValue(el) {
    if (!el) return false;

    var txt = (el.textContent || '').trim();

    return (
      txt.indexOf('In-Stock') === 0 ||
      txt.indexOf('Currently Available') === 0 ||
      txt.indexOf('Pre-Order') === 0 ||
      txt.indexOf('Batch Production') === 0
    );
  }

  function getLineType(line, index) {
    var text = (line || '').trim();

    if (!text) return 'default';

    if (index === 0) {
      if (text === 'In-Stock' || text === 'Currently Available') {
        return 'availability available';
      }

      if (text === 'Pre-Order' || text === 'Batch Production') {
        return 'availability future';
      }
    }

    if (text.indexOf('Estimated delivery:') === 0 || text.indexOf('🚚 Estimated delivery:') === 0) {
      return 'delivery';
    }

if (
  text.indexOf('This item is produced in a batch run') === 0 || text.indexOf('cannot be canceled after purchase') !== -1
) {
  return 'warning';
}

    if (text.indexOf('Membership discount applied') !== -1 || text.indexOf('✔️ Membership discount applied') !== -1) {
      return 'membership';
    }

    return 'default';
  }

  function enhanceCustomMetaValue(metaValueEl) {
    if (!metaValueEl) return;
    if (metaValueEl.dataset.shoshinMetaEnhanced === '1') return;

    var raw = (metaValueEl.textContent || '').replace(/\r/g, '').trim();
    if (!raw) return;

    var lines = raw
      .split('\n')
      .map(function (line) { return line.trim(); })
      .filter(Boolean);

    if (!lines.length) return;

    metaValueEl.classList.add('shoshin-cart-meta-value');
    metaValueEl.innerHTML = '';

    lines.forEach(function (line, index) {
      var row = document.createElement('span');
      var type = getLineType(line, index);

      row.className = 'shoshin-cart-meta-row shoshin-cart-meta-row--' + type.replace(/\s+/g, ' shoshin-cart-meta-row--');

      row.textContent = line;
      metaValueEl.appendChild(row);
    });

    metaValueEl.dataset.shoshinMetaEnhanced = '1';
  }

  function reorderMetaBlocks(productWrap) {
    if (!productWrap) return;

    var metadata = productWrap.querySelector('.wc-block-components-product-metadata');
    if (!metadata) return;

    var detailBlocks = metadata.querySelectorAll(':scope > .wc-block-components-product-details');
    if (!detailBlocks.length) return;

    var customBlock = null;
    var scaleBlock = null;

    detailBlocks.forEach(function (block) {
      if (!customBlock) {
        var customValue = block.querySelector('.wc-block-components-product-details__value');
        if (isCustomMetaValue(customValue)) {
          customBlock = block;
        }
      }

      if (!scaleBlock && block.querySelector('.wc-block-components-product-details__scale')) {
        scaleBlock = block;
      }
    });

    if (!customBlock || !scaleBlock) return;
    if (customBlock === scaleBlock) return;

    if (scaleBlock.nextElementSibling === customBlock) return;

    metadata.insertBefore(customBlock, scaleBlock.nextElementSibling);
  }

  function applyCartMetaEnhancements(root) {
    var scope = root && root.querySelectorAll ? root : document;

    var productWraps = scope.querySelectorAll(
      '.woocommerce-cart .wc-block-cart-item__product, ' +
      '.woocommerce-checkout .wc-block-cart-item__product'
    );

    productWraps.forEach(function (productWrap) {
      var detailsValues = productWrap.querySelectorAll('.wc-block-components-product-details__value');

      detailsValues.forEach(function (el) {
        if (isCustomMetaValue(el)) {
          enhanceCustomMetaValue(el);
        }
      });

      reorderMetaBlocks(productWrap);
    });
  }

  function initShoshinCartMeta() {
    applyCartMetaEnhancements(document);

    var cartRoot = document.querySelector('.wp-block-woocommerce-cart, .wp-block-woocommerce-checkout');
    if (!cartRoot) return;

    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) {
            applyCartMetaEnhancements(node);
          }
        });
      });
    });

    observer.observe(cartRoot, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShoshinCartMeta);
  } else {
    initShoshinCartMeta();
  }
})();

document.addEventListener('DOMContentLoaded', function () {
  let autoApplied = false;

  function setBillingSameAsShipping() {
    if (autoApplied) return;

    const checkbox = document.querySelector(
      '.wc-block-checkout__use-address-for-billing .wc-block-components-checkbox__input'
    );

    if (checkbox && !checkbox.checked) {
      checkbox.click();
      autoApplied = true;
    }
  }

  setBillingSameAsShipping();

  const observer = new MutationObserver(function () {
    setBillingSameAsShipping();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
});

document.addEventListener('DOMContentLoaded', function () {
  function getCheckoutRoot() {
    return document.querySelector('.shoshin-checkout .wc-block-checkout');
  }

  function findBatchAckCheckbox() {
    var root = getCheckoutRoot();
    if (!root) return null;

    return root.querySelector(
      'input[type="checkbox"][name*="batch-production-ack"], ' +
      'input[type="checkbox"][id*="batch-production-ack"], ' +
      'input[type="checkbox"][name*="shoshin/batch-production-ack"]'
    );
  }

  function findBatchAckFieldWrap() {
    var checkbox = findBatchAckCheckbox();
    if (!checkbox) return null;

    return checkbox.closest('.wc-block-components-checkbox') || checkbox.closest('label') || checkbox.parentElement;
  }

  function findPlaceOrderButton() {
    var root = getCheckoutRoot();
    if (!root) return null;

    return root.querySelector('.wc-block-components-checkout-place-order-button');
  }

  function moveBatchAckAboveTerms() {
    var root = getCheckoutRoot();
    if (!root) return;

    var additionalBlock = root.querySelector('.wp-block-woocommerce-checkout-additional-information-block');
    var termsBlock = root.querySelector('.wp-block-woocommerce-checkout-terms-block');
    var fieldWrap = findBatchAckFieldWrap();

    if (!additionalBlock || !termsBlock || !fieldWrap) return;

    var mount = termsBlock.querySelector('.shoshin-batch-ack-mount');

if (!mount) {
  mount = document.createElement('div');
  mount.className = 'shoshin-batch-ack-mount';

  var header = document.createElement('div');
  header.className = 'shoshin-batch-ack-title';
  header.textContent = 'Acknowledgements';

  mount.appendChild(header);
  termsBlock.appendChild(mount);
}

/* move ALL existing native Woo terms content under the header,
   except the mount itself */
var nativeTermsNodes = Array.from(termsBlock.childNodes).filter(function (node) {
  return node !== mount;
});

nativeTermsNodes.forEach(function (node) {
  mount.appendChild(node);
});

    if (!mount.contains(fieldWrap)) {
      mount.appendChild(fieldWrap);
    }

    additionalBlock.classList.add('shoshin-batch-ack-source-empty');
  }

  function isBatchAckLocked() {
    var checkbox = findBatchAckCheckbox();
    if (!checkbox) return false;
    return !checkbox.checked;
  }

  function syncBatchAckButtonState() {
    var button = findPlaceOrderButton();
    if (!button) return;

    var locked = isBatchAckLocked();

    button.disabled = locked;
    button.setAttribute('aria-disabled', locked ? 'true' : 'false');
    button.classList.toggle('shoshin-batch-ack-lock', locked);

    if (locked) {
      button.setAttribute('data-shoshin-batch-locked', '1');
    } else {
      button.removeAttribute('data-shoshin-batch-locked');
    }
  }

  function bindBatchAckCheckbox() {
    var checkbox = findBatchAckCheckbox();

    if (!checkbox) {
      syncBatchAckButtonState();
      return;
    }

    if (checkbox.dataset.shoshinBatchAckBound !== '1') {
      checkbox.dataset.shoshinBatchAckBound = '1';
      checkbox.addEventListener('change', syncBatchAckButtonState);
      checkbox.addEventListener('input', syncBatchAckButtonState);
      checkbox.addEventListener('click', function () {
        setTimeout(syncBatchAckButtonState, 0);
      });
    }

    syncBatchAckButtonState();
  }

  function hardBlockPlaceOrder(event) {
    var button = event.target.closest('.shoshin-checkout .wc-block-components-checkout-place-order-button');
    if (!button) return;

    if (!isBatchAckLocked()) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    var checkbox = findBatchAckCheckbox();
    if (checkbox) {
      checkbox.focus();
      checkbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function initBatchAckUI() {
    moveBatchAckAboveTerms();
    bindBatchAckCheckbox();
  }

  initBatchAckUI();

  document.addEventListener('click', hardBlockPlaceOrder, true);

  var observer = new MutationObserver(function () {
    initBatchAckUI();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
});