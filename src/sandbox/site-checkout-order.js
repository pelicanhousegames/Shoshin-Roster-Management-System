(function () {
  function text(el) {
    return el ? (el.textContent || '').trim() : '';
  }

  function isCustomMetaValue(el) {
    if (!el) return false;

    var txt = text(el);

    return (
      txt.indexOf('In-Stock') === 0 ||
      txt.indexOf('Currently Available') === 0 ||
      txt.indexOf('Pre-Order') === 0 ||
      txt.indexOf('Batch Production') === 0 ||
      txt.indexOf('Available to Purchase') === 0
    );
  }

  function getLineType(line, index) {
    var value = (line || '').trim();

    if (!value) return 'default';

    if (index === 0) {
      if (
        value === 'In-Stock' ||
        value === 'Currently Available' ||
        value === 'Available to Purchase'
      ) {
        return 'availability available';
      }

      if (
        value === 'Pre-Order' ||
        value === 'Batch Production'
      ) {
        return 'availability future';
      }
    }

    if (
      value.indexOf('Estimated delivery:') === 0 ||
      value.indexOf('🚚 Estimated delivery:') === 0
    ) {
      return 'delivery';
    }

    if (
      value.indexOf('This item is produced in a batch run') === 0 ||
      value.indexOf('cannot be canceled after purchase') !== -1
    ) {
      return 'warning';
    }

    if (
      value.indexOf('Digital files are delivered after purchase') !== -1 ||
      value.indexOf('📥 Digital files are delivered after purchase') === 0
    ) {
      return 'digital';
    }

    if (
      value.indexOf('Membership discount applied') !== -1 ||
      value.indexOf('✔️ Membership discount applied') !== -1
    ) {
      return 'membership';
    }

    return 'default';
  }

  function buildMetaRows(lines) {
    var frag = document.createDocumentFragment();

    lines.forEach(function (line, index) {
      var row = document.createElement('span');
      var type = getLineType(line, index);

      row.className =
        'shoshin-cart-meta-row shoshin-cart-meta-row--' +
        type.replace(/\s+/g, ' shoshin-cart-meta-row--');

      row.textContent = line;
      frag.appendChild(row);
    });

    return frag;
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
    metaValueEl.appendChild(buildMetaRows(lines));
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

  function applyBlocksCartMetaEnhancements(root) {
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

  function ensureQtyButtons(row) {
    if (!row) return;

    var qtyCell = row.querySelector('td.product-quantity');
    if (!qtyCell) return;

    var qtyWrap = qtyCell.querySelector('.quantity');
    var input = qtyWrap ? qtyWrap.querySelector('input.qty') : null;
    if (!qtyWrap || !input) return;

    if (qtyWrap.dataset.shoshinQtyEnhanced === '1') return;

    var isHidden = input.type === 'hidden';
    if (isHidden) {
      qtyWrap.dataset.shoshinQtyEnhanced = '1';
      qtyCell.classList.add('shoshin-qty-readonly');
      return;
    }

    var minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'minus';
    minus.setAttribute('aria-label', 'Decrease quantity');
    minus.textContent = '−';

    var plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'plus';
    plus.setAttribute('aria-label', 'Increase quantity');
    plus.textContent = '+';

    qtyWrap.insertBefore(minus, input);
    qtyWrap.appendChild(plus);

    function stepValue(dir) {
      var step = parseFloat(input.step || '1');
      var min = input.min !== '' ? parseFloat(input.min) : 0;
      var max = input.max !== '' ? parseFloat(input.max) : Infinity;
      var current = parseFloat(input.value || '0');

      if (!isFinite(step) || step <= 0) step = 1;
      if (!isFinite(current)) current = min || 0;
      if (!isFinite(max)) max = Infinity;

      var next = dir === 'up' ? current + step : current - step;

      if (next < min) next = min;
      if (next > max) next = max;

      input.value = String(next);
      input.dispatchEvent(new Event('change', { bubbles: true }));
      syncButtons();
    }

    function syncButtons() {
      var min = input.min !== '' ? parseFloat(input.min) : 0;
      var max = input.max !== '' ? parseFloat(input.max) : Infinity;
      var current = parseFloat(input.value || '0');

      minus.disabled = current <= min;
      plus.disabled = current >= max;
    }

    minus.addEventListener('click', function () {
      stepValue('down');
    });

    plus.addEventListener('click', function () {
      stepValue('up');
    });

    input.addEventListener('change', syncButtons);
    input.addEventListener('input', syncButtons);

    syncButtons();
    qtyWrap.dataset.shoshinQtyEnhanced = '1';
  }

  function moveClassicRemoveIntoControls(row) {
    if (!row) return;

    var qtyCell = row.querySelector('td.product-quantity');
    var removeCell = row.querySelector('td.product-remove');
    var removeLink = removeCell ? removeCell.querySelector('a.remove') : null;

    if (!qtyCell || !removeLink) return;
    if (row.dataset.shoshinClassicControlsEnhanced === '1') return;

    var controls = qtyCell.querySelector('.shoshin-classic-cart-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'shoshin-classic-cart-controls';
    }

    var qtyWrap = qtyCell.querySelector('.quantity');
    if (qtyWrap && !controls.contains(qtyWrap)) {
      controls.appendChild(qtyWrap);
    }

    if (!controls.contains(removeLink)) {
      controls.appendChild(removeLink);
    }

    qtyCell.appendChild(controls);
    removeCell.remove();

    row.dataset.shoshinClassicControlsEnhanced = '1';
  }

  function enhanceClassicMeta(row) {
    if (!row) return;

    var nameCell = row.querySelector('td.product-name');
    if (!nameCell) return;

    var variation = nameCell.querySelector('dl.variation');
    if (!variation || variation.dataset.shoshinClassicMetaEnhanced === '1') return;

    var dd = variation.querySelector('dd');
    if (!dd) return;

    var raw = text(dd).replace(/\r/g, '');
    if (!raw) return;

    var lines = raw
      .split('\n')
      .map(function (line) { return line.trim(); })
      .filter(Boolean);

    if (!lines.length) return;

    var meta = document.createElement('div');
    meta.className = 'shoshin-cart-meta-value shoshin-cart-meta-value--classic';
    meta.appendChild(buildMetaRows(lines));

    variation.insertAdjacentElement('afterend', meta);
    variation.style.display = 'none';
    variation.dataset.shoshinClassicMetaEnhanced = '1';
  }

  function applyClassicCartEnhancements(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var rows = scope.querySelectorAll(
      'body.woocommerce-cart .woocommerce-cart-form__cart-item'
    );

    rows.forEach(function (row) {
      enhanceClassicMeta(row);
      ensureQtyButtons(row);
      moveClassicRemoveIntoControls(row);
    });
  }

  function relocateClassicCoupon() {
    var cart = document.querySelector('body.woocommerce-cart .woocommerce');
    if (!cart) return;

    var totals = cart.querySelector('.cart_totals');
    var actionsCell = cart.querySelector('td.actions');
    var coupon = actionsCell ? actionsCell.querySelector('.coupon') : null;

    if (!totals || !coupon) return;
    if (coupon.dataset.shoshinCouponMoved === '1') return;

    var existingPanel = totals.querySelector('.shoshin-cart-coupon-panel');
    if (!existingPanel) {
      existingPanel = document.createElement('div');
      existingPanel.className = 'shoshin-cart-coupon-panel';
      existingPanel.innerHTML =
        '<div class="shoshin-cart-coupon-toggle" role="button" tabindex="0" aria-expanded="false">' +
          '<span class="shoshin-cart-coupon-toggle__label">Add coupons</span>' +
          '<span class="shoshin-cart-coupon-toggle__icon" aria-hidden="true">⌄</span>' +
        '</div>' +
        '<div class="shoshin-cart-coupon-panel__body" hidden></div>';

      totals.insertBefore(existingPanel, totals.querySelector('table.shop_table'));
    }

    var body = existingPanel.querySelector('.shoshin-cart-coupon-panel__body');
    body.appendChild(coupon);
    coupon.dataset.shoshinCouponMoved = '1';

    var toggle = existingPanel.querySelector('.shoshin-cart-coupon-toggle');
    if (toggle.dataset.shoshinBound !== '1') {
      toggle.dataset.shoshinBound = '1';

      function setOpen(open) {
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        body.hidden = !open;
        existingPanel.classList.toggle('is-open', open);
      }

      toggle.addEventListener('click', function () {
        setOpen(toggle.getAttribute('aria-expanded') !== 'true');
      });

      toggle.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setOpen(toggle.getAttribute('aria-expanded') !== 'true');
        }
      });

      setOpen(false);
    }
  }

  function applyAllCartEnhancements(root) {
    applyBlocksCartMetaEnhancements(root);
    applyClassicCartEnhancements(root);
    relocateClassicCoupon();
  }

  function initShoshinCartEnhancements() {
    applyAllCartEnhancements(document);

    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) {
            applyAllCartEnhancements(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShoshinCartEnhancements);
  } else {
    initShoshinCartEnhancements();
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

  if (!termsBlock) return;

  /* ensure static heading exists inside live rendered Terms block */
  var heading = termsBlock.querySelector('.shoshin-acknowledgements-heading');
  if (!heading) {
    heading = document.createElement('div');
    heading.className = 'shoshin-acknowledgements-heading';
    heading.textContent = 'Acknowledgements';
    termsBlock.prepend(heading);
  }

  /* move conditional acknowledgement below native Woo terms text */
  if (additionalBlock && fieldWrap) {
    if (!termsBlock.contains(fieldWrap)) {
      termsBlock.appendChild(fieldWrap);
    }
    additionalBlock.classList.add('shoshin-batch-ack-source-empty');
  } else if (additionalBlock) {
    additionalBlock.classList.remove('shoshin-batch-ack-source-empty');
  }
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