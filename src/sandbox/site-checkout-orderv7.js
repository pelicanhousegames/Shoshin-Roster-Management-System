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

  var isHidden = input.type === 'hidden';
  if (isHidden) {
    qtyWrap.dataset.shoshinQtyEnhanced = '1';
    qtyCell.classList.add('shoshin-qty-readonly');
    return;
  }

  qtyCell.classList.remove('shoshin-qty-readonly');

  qtyWrap.querySelectorAll('.minus, .plus').forEach(function (btn) {
    btn.remove();
  });

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

  function requestClassicCartUpdate() {
    var form = row.closest('form.woocommerce-cart-form');
    if (!form) return;

    var updateButton = form.querySelector('button[name="update_cart"]');
    if (!updateButton) return;

    if (row.dataset.shoshinCartUpdating === '1') return;
    row.dataset.shoshinCartUpdating = '1';

    window.setTimeout(function () {
      row.dataset.shoshinCartUpdating = '0';
      updateButton.disabled = false;
      updateButton.removeAttribute('aria-disabled');
      updateButton.click();
    }, 120);
  }

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
    if (next === current) return;

    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    syncButtons();
    requestClassicCartUpdate();
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

  input.addEventListener('change', function () {
    syncButtons();
    requestClassicCartUpdate();
  });

  input.addEventListener('input', syncButtons);

  syncButtons();
  qtyWrap.dataset.shoshinQtyEnhanced = String(Date.now());
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

  var form = cart.querySelector('form.woocommerce-cart-form');
  var totals = cart.querySelector('.cart_totals');
  var actionsCell = cart.querySelector('td.actions');
  var coupon = actionsCell ? actionsCell.querySelector('.coupon') : null;

  if (!form || !totals || !coupon) return;

  if (!form.id) {
    form.id = 'shoshin-classic-cart-form';
  }

  var existingPanel = totals.querySelector('.shoshin-cart-coupon-panel');
  if (!existingPanel) {
    existingPanel = document.createElement('div');
    existingPanel.className = 'shoshin-cart-coupon-panel';
    existingPanel.innerHTML =
      '<div class="shoshin-cart-coupon-toggle" role="button" tabindex="0" aria-expanded="false">' +
        '<span class="shoshin-cart-coupon-toggle__label">Add coupons</span>' +
        '<span class="shoshin-cart-coupon-toggle__icon" aria-hidden="true">⌵</span>' +
      '</div>' +
      '<div class="shoshin-cart-coupon-panel__body" hidden>' +
        '<div class="shoshin-cart-coupon-feedback" aria-live="polite"></div>' +
      '</div>';

    totals.insertBefore(existingPanel, totals.querySelector('table.shop_table'));
  }

  var body = existingPanel.querySelector('.shoshin-cart-coupon-panel__body');
  var feedback = existingPanel.querySelector('.shoshin-cart-coupon-feedback');
  var toggle = existingPanel.querySelector('.shoshin-cart-coupon-toggle');

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    body.hidden = !open;
    existingPanel.classList.toggle('is-open', open);
  }

  if (!coupon.dataset.shoshinCouponMoved) {
    body.insertBefore(coupon, feedback);
    coupon.dataset.shoshinCouponMoved = '1';
  }

  var input = coupon.querySelector('input[name="coupon_code"]');
  var button = coupon.querySelector('button[name="apply_coupon"]');

  if (input) {
    input.setAttribute('form', form.id);
    input.setAttribute('autocomplete', 'off');
  }

  if (button) {
    button.setAttribute('form', form.id);
  }

  coupon.querySelectorAll('input[type="hidden"], select, textarea').forEach(function (field) {
    field.setAttribute('form', form.id);
  });

  function syncCouponButtonState() {
    if (!input || !button) return;
    var hasValue = input.value.trim().length > 0;
    var isLoading = existingPanel.dataset.shoshinCouponLoading === '1';

    button.disabled = !hasValue || isLoading;
    button.setAttribute('aria-disabled', (!hasValue || isLoading) ? 'true' : 'false');
  }

function moveCouponNotices() {
  if (!feedback) return false;

  var foundAny = false;

  var notices = cart.querySelectorAll(
    '.woocommerce-notices-wrapper .woocommerce-error,' +
    '.woocommerce-notices-wrapper .woocommerce-message,' +
    '.woocommerce-notices-wrapper .woocommerce-info,' +
    '.woocommerce-error,' +
    '.woocommerce-message,' +
    '.woocommerce-info'
  );

  notices.forEach(function (notice) {
    if (!notice || !notice.parentNode) return;
    if (feedback.contains(notice)) {
      foundAny = true;
      return;
    }

    var txt = (notice.textContent || '').trim();
    if (!/coupon/i.test(txt)) return;

    feedback.appendChild(notice);
    foundAny = true;
  });

  cart.querySelectorAll('.woocommerce-notices-wrapper').forEach(function (wrapper) {
    if (!wrapper.children.length) {
      wrapper.style.display = 'none';
    }
  });

  return foundAny || feedback.children.length > 0;
}

  async function applyCouponAjax() {
    if (!form || !input || !button) return;

    var code = input.value.trim();
    if (!code) {
      syncCouponButtonState();
      setOpen(true);
      return;
    }

    if (existingPanel.dataset.shoshinCouponLoading === '1') return;
    existingPanel.dataset.shoshinCouponLoading = '1';
    syncCouponButtonState();

    feedback.innerHTML = '';
    setOpen(true);

    var formData = new FormData(form);
    formData.set('coupon_code', code);
    formData.set('apply_coupon', button.value || 'Apply');

    try {
      var response = await fetch(form.getAttribute('action') || window.location.href, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      var html = await response.text();
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');

      var newWoo =
        doc.querySelector('body.woocommerce-cart .woocommerce') ||
        doc.querySelector('.woocommerce');

      var currentWoo =
        document.querySelector('body.woocommerce-cart .woocommerce') ||
        document.querySelector('.woocommerce');

      if (!newWoo || !currentWoo) {
        throw new Error('Coupon response markup not found.');
      }

      currentWoo.innerHTML = newWoo.innerHTML;
      applyAllCartEnhancements(document);
    } catch (error) {
      feedback.innerHTML =
        '<div class="woocommerce-error">Unable to apply coupon right now. Please try again.</div>';
      setOpen(true);
    } finally {
      delete existingPanel.dataset.shoshinCouponLoading;
      syncCouponButtonState();
    }
  }

  if (toggle.dataset.shoshinBound !== '1') {
    toggle.dataset.shoshinBound = '1';

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    toggle.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(toggle.getAttribute('aria-expanded') !== 'true');
      }
    });
  }

  if (input && input.dataset.shoshinBound !== '1') {
    input.dataset.shoshinBound = '1';

    input.addEventListener('input', syncCouponButtonState);
    input.addEventListener('change', syncCouponButtonState);

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyCouponAjax();
      }
    });
  }

  if (button && button.dataset.shoshinBound !== '1') {
    button.dataset.shoshinBound = '1';

    button.addEventListener('click', function (event) {
      event.preventDefault();
      applyCouponAjax();
    });
  }

  syncCouponButtonState();

var hasCouponNotice = moveCouponNotices();
if (hasCouponNotice) {
  setOpen(true);
} else {
  setOpen(false);
}

window.setTimeout(function () {
  var hasDelayedCouponNotice = moveCouponNotices();
  if (hasDelayedCouponNotice) {
    setOpen(true);
  }
}, 50);

window.setTimeout(function () {
  var hasLateCouponNotice = moveCouponNotices();
  if (hasLateCouponNotice) {
    setOpen(true);
  }
}, 250);
}

function structureClassicSidebarCards() {
  var totals = document.querySelector('body.woocommerce-cart .cart_totals.calculated_shipping, body.woocommerce-cart .cart_totals');
  if (!totals) return;

  var heading = totals.querySelector(':scope > h2');
  var couponPanel = totals.querySelector(':scope > .shoshin-cart-coupon-panel');
  var totalsTable = totals.querySelector(':scope > table.shop_table');
  var proceed = totals.querySelector(':scope > .wc-proceed-to-checkout');

  if (!heading || !couponPanel || !totalsTable || !proceed) return;

  var totalsCard = totals.querySelector(':scope > .shoshin-classic-cart-totals-card');
  if (!totalsCard) {
    totalsCard = document.createElement('div');
    totalsCard.className = 'shoshin-classic-cart-totals-card';
    totals.insertBefore(totalsCard, heading);
  }

  if (!totalsCard.contains(heading)) totalsCard.appendChild(heading);
  if (!totalsCard.contains(couponPanel)) totalsCard.appendChild(couponPanel);
  if (!totalsCard.contains(totalsTable)) totalsCard.appendChild(totalsTable);

  var ctaCard = totals.querySelector(':scope > .shoshin-classic-cart-cta-card');
  if (!ctaCard) {
    ctaCard = document.createElement('div');
    ctaCard.className = 'shoshin-classic-cart-cta-card';
    totals.appendChild(ctaCard);
  }

  var expressCard = totals.querySelector(':scope > .shoshin-classic-cart-express-card');
  if (!expressCard) {
    expressCard = document.createElement('div');
    expressCard.className = 'shoshin-classic-cart-express-card';
    totals.appendChild(expressCard);
  }

  var checkoutRow = proceed.querySelector(':scope > p');
  var checkoutButton =
    proceed.querySelector(':scope > p .checkout-button') ||
    proceed.querySelector(':scope > .checkout-button, :scope > a.checkout-button');

  if (checkoutRow && checkoutButton) {
    if (!ctaCard.contains(checkoutRow)) {
      ctaCard.appendChild(checkoutRow);
    }
  } else if (checkoutButton) {
    if (!ctaCard.contains(checkoutButton)) {
      ctaCard.appendChild(checkoutButton);
    }
  }

  Array.from(proceed.children).forEach(function (child) {
    if (child === checkoutRow) return;

    if (
      child.matches('#wc-stripe-express-checkout-element, .ppc-button-wrapper, .wcpay-express-checkout-wrapper, #ppcp-recaptcha-v2-container')
    ) {
      if (!expressCard.contains(child)) {
        expressCard.appendChild(child);
      }
    }
  });

  proceed.remove();

  if (!ctaCard.children.length) {
    ctaCard.remove();
  }

  if (!expressCard.children.length) {
    expressCard.remove();
  }
}

function structureClassicMainColumn() {
  var woocommerce = document.querySelector('body.woocommerce-cart .page-content .woocommerce');
  if (!woocommerce) return;

  var form = woocommerce.querySelector(':scope > form.woocommerce-cart-form');
  var collaterals = woocommerce.querySelector(':scope > .cart-collaterals');
  if (!form || !collaterals) return;

  var crossSells = collaterals.querySelector(':scope > .cross-sells');
  var totals = collaterals.querySelector(':scope > .cart_totals');
  if (!crossSells || !totals) return;

  var mainColumn = woocommerce.querySelector(':scope > .shoshin-classic-cart-main-column');
  if (!mainColumn) {
    mainColumn = document.createElement('div');
    mainColumn.className = 'shoshin-classic-cart-main-column';
    woocommerce.insertBefore(mainColumn, form);
  }

  if (!mainColumn.contains(form)) {
    mainColumn.appendChild(form);
  }

  if (!mainColumn.contains(crossSells)) {
    mainColumn.appendChild(crossSells);
  }

  if (totals.parentNode !== woocommerce) {
    woocommerce.appendChild(totals);
  }

  if (!collaterals.children.length) {
    collaterals.remove();
  }
}

function applyAllCartEnhancements(root) {
  structureClassicMainColumn();
  applyBlocksCartMetaEnhancements(root);
  applyClassicCartEnhancements(root);
  relocateClassicCoupon();
  structureClassicSidebarCards();
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