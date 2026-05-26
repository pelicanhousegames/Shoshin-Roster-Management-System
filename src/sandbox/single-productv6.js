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
      + '.single-product .summary.shoshin-hide-purchase-ui form.cart .single_variation_wrap,'
      + '.single-product .summary.shoshin-hide-purchase-ui form.cart .woocommerce-variation-add-to-cart,'
      + '.single-product .summary.shoshin-hide-purchase-ui form.cart .quantity,'
      + '.single-product .summary.shoshin-hide-purchase-ui form.cart .single_add_to_cart_button,'
      + '.single-product .summary.shoshin-hide-purchase-ui .wcpay-payment-request-wrapper,'
      + '.single-product .summary.shoshin-hide-purchase-ui .wc-stripe-product-checkout-container,'
      + '.single-product .summary.shoshin-hide-purchase-ui .payment_request_button,'
      + '.single-product .summary.shoshin-hide-purchase-ui .payment-request-button,'
      + '.single-product .summary.shoshin-hide-purchase-ui .paypal-buttons,'
      + '.single-product .summary.shoshin-hide-purchase-ui .ppc-button-wrapper,'
      + '.single-product .summary.shoshin-hide-purchase-ui .ppcp-button-wrapper,'
      + '.single-product .summary.shoshin-hide-purchase-ui .woocommerce-payments-express-payment-type-button,'
      + '.single-product .summary.shoshin-hide-purchase-ui .woocommerce-payments-express-payment-wrapper,'
      + '.single-product .summary.shoshin-hide-purchase-ui .wc_payment_request_buttons,'
      + '.single-product .summary.shoshin-hide-purchase-ui .wc_payment_request_button,'
      + '.single-product .summary.shoshin-hide-purchase-ui #wc-stripe-payment-request-wrapper,'
      + '.single-product .summary.shoshin-hide-purchase-ui [class*="amazon-pay"],'
      + '.single-product .summary.shoshin-hide-purchase-ui [class*="payment-request"],'
      + '.single-product .summary.shoshin-hide-purchase-ui [class*="express-payment"]'
      + '{display:none !important;}'

      + '.single-product .summary.shoshin-hide-express-ui .wcpay-payment-request-wrapper,'
      + '.single-product .summary.shoshin-hide-express-ui .wc-stripe-product-checkout-container,'
      + '.single-product .summary.shoshin-hide-express-ui .payment_request_button,'
      + '.single-product .summary.shoshin-hide-express-ui .payment-request-button,'
      + '.single-product .summary.shoshin-hide-express-ui .paypal-buttons,'
      + '.single-product .summary.shoshin-hide-express-ui .ppc-button-wrapper,'
      + '.single-product .summary.shoshin-hide-express-ui .ppcp-button-wrapper,'
      + '.single-product .summary.shoshin-hide-express-ui .woocommerce-payments-express-payment-type-button,'
      + '.single-product .summary.shoshin-hide-express-ui .woocommerce-payments-express-payment-wrapper,'
      + '.single-product .summary.shoshin-hide-express-ui .wc_payment_request_buttons,'
      + '.single-product .summary.shoshin-hide-express-ui .wc_payment_request_button,'
      + '.single-product .summary.shoshin-hide-express-ui #wc-stripe-payment-request-wrapper,'
      + '.single-product .summary.shoshin-hide-express-ui [class*="amazon-pay"],'
      + '.single-product .summary.shoshin-hide-express-ui [class*="payment-request"],'
      + '.single-product .summary.shoshin-hide-express-ui [class*="express-payment"]'
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

    var stockWidget = document.querySelector('.single-product .summary .shoshin-stock-status');
    var summary = variationForm.closest('.summary');
    if (!summary) return;

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
      summary.classList.remove('shoshin-hide-purchase-ui');
      summary.classList.remove('shoshin-hide-express-ui');

      if (purchaseUiState === 'hidden') {
        summary.classList.add('shoshin-hide-purchase-ui');
        return;
      }

      if (purchaseUiState === 'visible-no-express') {
        summary.classList.add('shoshin-hide-express-ui');
      }
    }

    function restoreDefaultPriceBlock() {
      priceWidget.innerHTML = defaultHtml;
    }

    function restoreDefaultStockBlock() {
      if (!defaultStockHtml) return;

      var currentStock = document.querySelector('.single-product .summary .shoshin-stock-status');
      if (currentStock) {
        currentStock.outerHTML = defaultStockHtml;
        return;
      }

      var form = summary.querySelector('form.cart');
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

      var currentStock = document.querySelector('.single-product .summary .shoshin-stock-status');
      if (currentStock) {
        currentStock.outerHTML = html;
        return;
      }

      var form = summary.querySelector('form.cart');
      if (form) {
        form.insertAdjacentHTML('beforebegin', html);
      }
    }

    if (window.MutationObserver) {
      var observer = new MutationObserver(function () {
        applyPurchaseUiState();
      });

      observer.observe(summary, {
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

        if (variation && variation.is_purchasable === false) {
          purchaseUiState = 'hidden';
        } else if (currentDisplayedPriceIsZero()) {
          purchaseUiState = 'visible-no-express';
        } else {
          purchaseUiState = 'visible';
        }

        applyPurchaseUiState();
      });

      $form.on('reset_data hide_variation woocommerce_variation_has_changed', function () {
        var variationIdInput = variationForm.querySelector('input[name="variation_id"]');
        var variationId = variationIdInput ? variationIdInput.value : '';

        if (!variationId) {
          setTimeout(function () {
            restoreDefaultPriceBlock();
            restoreDefaultStockBlock();
            purchaseUiState = 'hidden';
            applyPurchaseUiState();
          }, 50);
        }
      });
    }

    variationForm.addEventListener('reset', function () {
      setTimeout(function () {
        restoreDefaultPriceBlock();
        restoreDefaultStockBlock();
        purchaseUiState = 'hidden';
        applyPurchaseUiState();
      }, 50);
    });

    variationForm.addEventListener('change', function () {
      var variationIdInput = variationForm.querySelector('input[name="variation_id"]');
      var variationId = variationIdInput ? variationIdInput.value : '';

      if (!variationId) {
        setTimeout(function () {
          restoreDefaultPriceBlock();
          restoreDefaultStockBlock();
          purchaseUiState = 'hidden';
          applyPurchaseUiState();
        }, 50);
      }
    });

    restoreDefaultPriceBlock();
    purchaseUiState = 'hidden';
    applyPurchaseUiState();
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

  function runInit() {
    initShoshinCappedGallery();
    initShoshinVariableTopPrice();
    initShoshinSimpleProductExpressVisibility();
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

