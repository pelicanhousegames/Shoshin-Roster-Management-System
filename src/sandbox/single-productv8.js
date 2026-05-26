(function () {
  function initShoshinCappedGallery() {
    var galleryWidget = document.querySelector('.elementor-element.elementor-element-1599068');
    if (!galleryWidget) return;

    var gallery = galleryWidget.querySelector('.woocommerce-product-gallery');
    if (!gallery) return;

    var thumbs = gallery.querySelector('.flex-control-thumbs');
    var wrapper = gallery.querySelector('.woocommerce-product-gallery__wrapper');
    var images = wrapper ? wrapper.querySelectorAll('.woocommerce-product-gallery__image') : [];

    // Single-image product: no thumbs, no cap logic needed
    if (!thumbs || images.length <= 1) {
      if (gallery.classList) {
        gallery.classList.add('shoshin-single-image-gallery');
      }
      return;
    }

    // Avoid duplicate init
    if (thumbs.dataset.shoshinEnhanced === '1') return;
    thumbs.dataset.shoshinEnhanced = '1';

    var thumbItems = Array.prototype.slice.call(thumbs.querySelectorAll('li'));
    if (!thumbItems.length) return;

    var visibleCount = 5;
    var hiddenCount = Math.max(0, thumbItems.length - visibleCount);

    thumbItems.forEach(function (li) {
      var img = li.querySelector('img');
      if (!img) return;

      img.addEventListener('mouseenter', function () {
        img.click();
      });
    });

    if (hiddenCount <= 0) return;

    thumbItems.forEach(function (li, index) {
      if (index >= visibleCount) {
        li.classList.add('shoshin-thumb-hidden');
      }
    });

    var moreLi = document.createElement('li');
    moreLi.className = 'shoshin-thumb-more';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'View all product images');

    var inner = document.createElement('div');
    inner.className = 'shoshin-thumb-more-inner';

    var count = document.createElement('div');
    count.className = 'shoshin-thumb-more-count';
    count.textContent = '+' + hiddenCount;

    var label = document.createElement('div');
    label.className = 'shoshin-thumb-more-label';
    label.textContent = 'More';

    inner.appendChild(count);
    inner.appendChild(label);
    btn.appendChild(inner);
    moreLi.appendChild(btn);

    btn.addEventListener('click', function () {
      var trigger = gallery.querySelector('.woocommerce-product-gallery__trigger');
      if (trigger) {
        trigger.click();
      }
    });

    thumbs.appendChild(moreLi);
  }

  function ensureShoshinPurchaseUiStyles() {
    if (document.getElementById('shoshin-purchase-ui-styles')) return;

    var style = document.createElement('style');
    style.id = 'shoshin-purchase-ui-styles';
    style.textContent = ''
      + '.single-product .product.shoshin-hide-purchase-ui form.cart .woocommerce-variation-add-to-cart,'
      + '.single-product .product.shoshin-hide-purchase-ui form.cart .quantity,'
      + '.single-product .product.shoshin-hide-purchase-ui form.cart .single_add_to_cart_button,'
      + '.single-product .product.shoshin-hide-purchase-ui .wcpay-payment-request-wrapper,'
      + '.single-product .product.shoshin-hide-purchase-ui .wc-stripe-product-checkout-container,'
      + '.single-product .product.shoshin-hide-purchase-ui .payment_request_button,'
      + '.single-product .product.shoshin-hide-purchase-ui .payment-request-button,'
      + '.single-product .product.shoshin-hide-purchase-ui .paypal-buttons,'
      + '.single-product .product.shoshin-hide-purchase-ui .ppc-button-wrapper,'
      + '.single-product .product.shoshin-hide-purchase-ui .ppcp-button-wrapper,'
      + '.single-product .product.shoshin-hide-purchase-ui .woocommerce-payments-express-payment-type-button,'
      + '.single-product .product.shoshin-hide-purchase-ui .woocommerce-payments-express-payment-wrapper,'
      + '.single-product .product.shoshin-hide-purchase-ui .wc_payment_request_buttons,'
      + '.single-product .product.shoshin-hide-purchase-ui .wc_payment_request_button,'
      + '.single-product .product.shoshin-hide-purchase-ui #wc-stripe-payment-request-wrapper,'
      + '.single-product .product.shoshin-hide-purchase-ui [class*="amazon-pay"],'
      + '.single-product .product.shoshin-hide-purchase-ui [class*="payment-request"],'
      + '.single-product .product.shoshin-hide-purchase-ui [class*="express-payment"]'
      + '{display:none !important;}'

      + '.single-product .product.shoshin-hide-express-ui .wcpay-payment-request-wrapper,'
      + '.single-product .product.shoshin-hide-express-ui .wc-stripe-product-checkout-container,'
      + '.single-product .product.shoshin-hide-express-ui .payment_request_button,'
      + '.single-product .product.shoshin-hide-express-ui .payment-request-button,'
      + '.single-product .product.shoshin-hide-express-ui .paypal-buttons,'
      + '.single-product .product.shoshin-hide-express-ui .ppc-button-wrapper,'
      + '.single-product .product.shoshin-hide-express-ui .ppcp-button-wrapper,'
      + '.single-product .product.shoshin-hide-express-ui .woocommerce-payments-express-payment-type-button,'
      + '.single-product .product.shoshin-hide-express-ui .woocommerce-payments-express-payment-wrapper,'
      + '.single-product .product.shoshin-hide-express-ui .wc_payment_request_buttons,'
      + '.single-product .product.shoshin-hide-express-ui .wc_payment_request_button,'
      + '.single-product .product.shoshin-hide-express-ui #wc-stripe-payment-request-wrapper,'
      + '.single-product .product.shoshin-hide-express-ui [class*="amazon-pay"],'
      + '.single-product .product.shoshin-hide-express-ui [class*="payment-request"],'
      + '.single-product .product.shoshin-hide-express-ui [class*="express-payment"]'
      + '{display:none !important;}';
    document.head.appendChild(style);
  }
  
  function initShoshinVariableTopPrice() {
    var variationForm = document.querySelector('form.variations_form');
    if (!variationForm) return;

    if (variationForm.dataset.shoshinTopPriceInit === '1') return;
    variationForm.dataset.shoshinTopPriceInit = '1';

    var priceWidget = document.querySelector('.elementor-element.elementor-element-984b738');
    if (!priceWidget) return;

    var productRoot = variationForm.closest('.product');
    if (!productRoot) return;

    var stockWidget = productRoot.querySelector('.shoshin-stock-status');
    var defaultHtml = priceWidget.innerHTML;
    var defaultStockHtml = stockWidget ? stockWidget.outerHTML : '';
    var purchaseUiState = 'hidden';

    ensureShoshinPurchaseUiStyles();

    function currentDisplayedPriceIsZero() {
      var priceNodes = priceWidget.querySelectorAll('.shoshin-price-final, .woocommerce-Price-amount, .amount');
      var values = [];

      Array.prototype.forEach.call(priceNodes, function (node) {
        var text = (node.textContent || '').trim();
        if (!text) return;

        var value = parseFloat(text.replace(/[^0-9.\-]/g, ''));
        if (!isNaN(value)) {
          values.push(value);
        }
      });

      if (!values.length) return false;

      return Math.min.apply(null, values) <= 0;
    }

    function applyPurchaseUiState() {
      productRoot.classList.remove('shoshin-hide-purchase-ui');
      productRoot.classList.remove('shoshin-hide-express-ui');

      if (purchaseUiState === 'hidden') {
        productRoot.classList.add('shoshin-hide-purchase-ui');
        return;
      }

      if (purchaseUiState === 'visible-no-express') {
        productRoot.classList.add('shoshin-hide-express-ui');
      }
    }

    function getVariationDomState() {
      var variationIdInput = variationForm.querySelector('input[name="variation_id"]');
      var variationId = variationIdInput ? variationIdInput.value : '';

      var addToCartWrap = variationForm.querySelector('.woocommerce-variation-add-to-cart');
      var addToCartBtn = variationForm.querySelector('.single_add_to_cart_button');

      var noSelection = (!variationId || variationId === '0');

      var buttonDisabled = false;
      if (addToCartBtn) {
        buttonDisabled =
          !!addToCartBtn.disabled ||
          addToCartBtn.classList.contains('disabled') ||
          addToCartBtn.classList.contains('wc-variation-selection-needed');
      }

      var wrapDisabled = false;
      if (addToCartWrap) {
        wrapDisabled =
          addToCartWrap.classList.contains('woocommerce-variation-add-to-cart-disabled') ||
          addToCartWrap.classList.contains('disabled');
      }

      return {
        noSelection: noSelection,
        disabled: buttonDisabled || wrapDisabled
      };
    }

    function syncPurchaseUiFromDom() {
      var state = getVariationDomState();

      if (state.noSelection) {
        purchaseUiState = 'hidden';
      } else if (state.disabled) {
        purchaseUiState = 'hidden';
      } else if (currentDisplayedPriceIsZero()) {
        purchaseUiState = 'visible-no-express';
      } else {
        purchaseUiState = 'visible';
      }

      applyPurchaseUiState();
    }

    function restoreDefaultPriceBlock() {
      priceWidget.innerHTML = defaultHtml;
    }

    function restoreDefaultStockBlock() {
      if (!defaultStockHtml) return;

      var currentStock = productRoot.querySelector('.shoshin-stock-status');
      if (currentStock) {
        currentStock.outerHTML = defaultStockHtml;
        return;
      }

      var form = productRoot.querySelector('form.cart');
      if (form) {
        form.insertAdjacentHTML('beforebegin', defaultStockHtml);
      }
    }

    function setResolvedPriceBlock(html) {
      if (!html) return;
      priceWidget.innerHTML = html;
    }

    function setResolvedStockBlock(html) {
      if (!html) return;

      var currentStock = productRoot.querySelector('.shoshin-stock-status');
      if (currentStock) {
        currentStock.outerHTML = html;
        return;
      }

      var form = productRoot.querySelector('form.cart');
      if (form) {
        form.insertAdjacentHTML('beforebegin', html);
      }
    }

    if (window.MutationObserver) {
      var observer = new MutationObserver(function () {
        syncPurchaseUiFromDom();
      });

      observer.observe(productRoot, {
        childList: true,
        subtree: true
      });
    }

    if (window.jQuery) {
      var $form = window.jQuery(variationForm);

      $form.on('found_variation', function (evt, variation) {
        if (variation && variation.price_html) {
          setResolvedPriceBlock(variation.price_html);
        }

        if (variation && variation.stock_html) {
          setResolvedStockBlock(variation.stock_html);
        }

        setTimeout(syncPurchaseUiFromDom, 0);
        setTimeout(syncPurchaseUiFromDom, 50);
        setTimeout(syncPurchaseUiFromDom, 150);
      });

      $form.on('show_variation', function (evt, variation) {
        if (variation && variation.price_html) {
          setResolvedPriceBlock(variation.price_html);
        }

        if (variation && variation.stock_html) {
          setResolvedStockBlock(variation.stock_html);
        }

        setTimeout(syncPurchaseUiFromDom, 0);
        setTimeout(syncPurchaseUiFromDom, 50);
        setTimeout(syncPurchaseUiFromDom, 150);
      });

      $form.on('reset_data hide_variation', function () {
        setTimeout(function () {
          restoreDefaultPriceBlock();
          restoreDefaultStockBlock();
          syncPurchaseUiFromDom();
        }, 50);
      });

      $form.on('woocommerce_variation_has_changed', function () {
        setTimeout(function () {
          var variationIdInput = variationForm.querySelector('input[name="variation_id"]');
          var variationId = variationIdInput ? variationIdInput.value : '';

          if (!variationId || variationId === '0') {
            restoreDefaultPriceBlock();
            restoreDefaultStockBlock();
          }

          syncPurchaseUiFromDom();
        }, 150);
      });
    }

    variationForm.addEventListener('reset', function () {
      setTimeout(function () {
        restoreDefaultPriceBlock();
        restoreDefaultStockBlock();
        syncPurchaseUiFromDom();
      }, 50);
    });

    variationForm.addEventListener('change', function () {
      setTimeout(function () {
        var variationIdInput = variationForm.querySelector('input[name="variation_id"]');
        var variationId = variationIdInput ? variationIdInput.value : '';

        if (!variationId || variationId === '0') {
          restoreDefaultPriceBlock();
          restoreDefaultStockBlock();
        }

        syncPurchaseUiFromDom();
      }, 150);
    });

    restoreDefaultPriceBlock();
    syncPurchaseUiFromDom();

    setTimeout(syncPurchaseUiFromDom, 300);
    setTimeout(syncPurchaseUiFromDom, 1000);
  }

  function initShoshinSimpleProductExpressVisibility() {
    if (document.querySelector('form.variations_form')) return;

    var productRoot = document.querySelector('.single-product .product');
    var priceWidget = document.querySelector('.elementor-element.elementor-element-984b738');

    if (!productRoot || !priceWidget) return;
    if (productRoot.dataset.shoshinSimpleExpressInit === '1') return;

    productRoot.dataset.shoshinSimpleExpressInit = '1';
    ensureShoshinPurchaseUiStyles();

    function currentDisplayedPriceIsZero() {
      var priceNodes = priceWidget.querySelectorAll('.shoshin-price-final, .woocommerce-Price-amount, .amount');
      var values = [];

      Array.prototype.forEach.call(priceNodes, function (node) {
        var text = (node.textContent || '').trim();
        if (!text) return;

        var value = parseFloat(text.replace(/[^0-9.\-]/g, ''));
        if (!isNaN(value)) {
          values.push(value);
        }
      });

      if (!values.length) return false;

      return Math.min.apply(null, values) <= 0;
    }

    function applyExpressVisibility() {
      productRoot.classList.remove('shoshin-hide-express-ui');

      if (currentDisplayedPriceIsZero()) {
        productRoot.classList.add('shoshin-hide-express-ui');
      }
    }

    if (window.MutationObserver) {
      var observer = new MutationObserver(function () {
        applyExpressVisibility();
      });

      observer.observe(productRoot, {
        childList: true,
        subtree: true
      });
    }

    applyExpressVisibility();
    setTimeout(applyExpressVisibility, 300);
    setTimeout(applyExpressVisibility, 1000);
  }

  function initShoshinExpressDivider() {
  var productRoot = document.querySelector('.single-product .product');
  if (!productRoot) return;

  function getExpressNodes() {
    var selectors = [
      '.wcpay-payment-request-wrapper',
      '.wc-stripe-product-checkout-container',
      '.payment_request_button',
      '.payment-request-button',
      '.paypal-buttons',
      '.ppc-button-wrapper',
      '.ppcp-button-wrapper',
      '.woocommerce-payments-express-payment-type-button',
      '.woocommerce-payments-express-payment-wrapper',
      '.wc_payment_request_buttons',
      '.wc_payment_request_button',
      '#wc-stripe-payment-request-wrapper',
      '[class*="amazon-pay"]',
      '[class*="payment-request"]',
      '[class*="express-payment"]'
    ];

    var nodes = [];

    selectors.forEach(function (selector) {
      productRoot.querySelectorAll(selector).forEach(function (node) {
        if (nodes.indexOf(node) === -1) {
          nodes.push(node);
        }
      });
    });

    return nodes.filter(function (node) {
      var style = window.getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  function placeDivider() {
    var existing = productRoot.querySelector('.shoshin-express-divider');
    if (existing) existing.remove();

    var expressNodes = getExpressNodes();
    if (!expressNodes.length) return;

    var firstExpress = expressNodes[0];

    var divider = document.createElement('div');
    divider.className = 'shoshin-express-divider';
    divider.innerHTML = '<span>OR EXPRESS CHECKOUT</span>';

    firstExpress.parentNode.insertBefore(divider, firstExpress);
  }

  if (window.MutationObserver) {
    var observer = new MutationObserver(function () {
      placeDivider();
    });

    observer.observe(productRoot, {
      childList: true,
      subtree: true
    });
  }

  placeDivider();
  setTimeout(placeDivider, 300);
  setTimeout(placeDivider, 1000);
}

function runInit() {
  initShoshinCappedGallery();
  initShoshinVariableTopPrice();
  initShoshinSimpleProductExpressVisibility();
  initShoshinExpressDivider();
}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInit);
  } else {
    runInit();
  }

  window.addEventListener('load', function () {
    setTimeout(runInit, 200);
  });
})();

