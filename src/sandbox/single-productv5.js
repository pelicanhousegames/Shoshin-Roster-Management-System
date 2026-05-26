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

    var cartSelectors = [
      'form.cart .single_variation_wrap',
      'form.cart .woocommerce-variation-add-to-cart',
      'form.cart .quantity',
      'form.cart .single_add_to_cart_button'
    ];

    var expressSelectors = [
      '.wcpay-payment-request-wrapper',
      '.wc-stripe-product-checkout-container',
      '.payment_request_button',
      '.payment-request-button',
      '.paypal-buttons',
      '.ppc-button-wrapper',
      '.ppcp-button-wrapper',
      '.woocommerce-payments-express-payment-type-button'
    ];

    function getUniqueNodes(selectors) {
      var nodes = [];

      selectors.forEach(function (selector) {
        var found = summary.querySelectorAll(selector);

        Array.prototype.forEach.call(found, function (node) {
          if (nodes.indexOf(node) === -1) {
            nodes.push(node);
          }
        });
      });

      return nodes;
    }

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
      var cartNodes = getUniqueNodes(cartSelectors);
      var expressNodes = getUniqueNodes(expressSelectors);

      if (purchaseUiState === 'hidden') {
        cartNodes.forEach(function (node) {
          node.style.display = 'none';
        });

        expressNodes.forEach(function (node) {
          node.style.display = 'none';
        });

        return;
      }

      if (purchaseUiState === 'visible-no-express') {
        cartNodes.forEach(function (node) {
          node.style.display = '';
        });

        expressNodes.forEach(function (node) {
          node.style.display = 'none';
        });

        return;
      }

      cartNodes.forEach(function (node) {
        node.style.display = '';
      });

      expressNodes.forEach(function (node) {
        node.style.display = '';
      });
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

    var summary = document.querySelector('.single-product .summary');
    var priceWidget = document.querySelector('.elementor-element.elementor-element-984b738');

    if (!summary || !priceWidget) return;
    if (summary.dataset.shoshinSimpleExpressInit === '1') return;

    summary.dataset.shoshinSimpleExpressInit = '1';

    var expressSelectors = [
      '.wcpay-payment-request-wrapper',
      '.wc-stripe-product-checkout-container',
      '.payment_request_button',
      '.payment-request-button',
      '.paypal-buttons',
      '.ppc-button-wrapper',
      '.ppcp-button-wrapper',
      '.woocommerce-payments-express-payment-type-button'
    ];

    function getUniqueNodes(selectors) {
      var nodes = [];

      selectors.forEach(function (selector) {
        var found = summary.querySelectorAll(selector);

        Array.prototype.forEach.call(found, function (node) {
          if (nodes.indexOf(node) === -1) {
            nodes.push(node);
          }
        });
      });

      return nodes;
    }

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
      var expressNodes = getUniqueNodes(expressSelectors);
      var hideExpress = currentDisplayedPriceIsZero();

      expressNodes.forEach(function (node) {
        node.style.display = hideExpress ? 'none' : '';
      });
    }

    if (window.MutationObserver) {
      var observer = new MutationObserver(function () {
        applyExpressVisibility();
      });

      observer.observe(summary, {
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

