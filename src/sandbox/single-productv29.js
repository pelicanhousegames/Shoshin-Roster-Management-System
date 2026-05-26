(function () {
  function initShoshinCappedGallery() {
    var gallery = document.querySelector('.single-product .woocommerce-product-gallery');
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

    // Multi-image product: make sure single-image class is removed
    if (gallery.classList) {
      gallery.classList.remove('shoshin-single-image-gallery');
    }

    // Avoid duplicate init
    if (thumbs.dataset.shoshinEnhanced === '1') return;
    thumbs.dataset.shoshinEnhanced = '1';

    var thumbItems = Array.prototype.slice.call(thumbs.querySelectorAll('li'));
    if (!thumbItems.length) return;

    var visibleCount = 5;
    var hiddenCount = Math.max(0, thumbItems.length - visibleCount);

    function refreshGalleryLayout() {
      var viewport = gallery.querySelector('.flex-viewport');
      var activeThumb = gallery.querySelector('.flex-control-thumbs img.flex-active');
      var activeSlideImg = gallery.querySelector('.woocommerce-product-gallery__image.flex-active-slide img, .woocommerce-product-gallery__image img.wp-post-image');

      function runRefresh() {
        if (window.jQuery) {
          window.jQuery(window).trigger('resize');
        }

        if (typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new Event('resize'));
        }

        if (viewport) {
          viewport.style.minHeight = viewport.offsetWidth + 'px';
        }
      }

      runRefresh();
      setTimeout(runRefresh, 50);
      setTimeout(runRefresh, 150);
      setTimeout(runRefresh, 300);

      if (activeSlideImg && !activeSlideImg.complete) {
        activeSlideImg.addEventListener('load', function handleLoad() {
          activeSlideImg.removeEventListener('load', handleLoad);
          runRefresh();
          setTimeout(runRefresh, 100);
        });
      }

      if (activeThumb && !activeThumb.complete) {
        activeThumb.addEventListener('load', function handleThumbLoad() {
          activeThumb.removeEventListener('load', handleThumbLoad);
          runRefresh();
        });
      }
    }

    thumbItems.forEach(function (li) {
      var img = li.querySelector('img');
      if (!img) return;

      img.addEventListener('mouseenter', function () {
        img.click();
        setTimeout(refreshGalleryLayout, 0);
        setTimeout(refreshGalleryLayout, 100);
      });

      img.addEventListener('click', function () {
        setTimeout(refreshGalleryLayout, 0);
        setTimeout(refreshGalleryLayout, 100);
      });
    });

    refreshGalleryLayout();
    window.addEventListener('load', function () {
      setTimeout(refreshGalleryLayout, 0);
      setTimeout(refreshGalleryLayout, 150);
      setTimeout(refreshGalleryLayout, 400);
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

    function openGalleryModal() {
      var trigger = gallery.querySelector('.woocommerce-product-gallery__trigger');
      if (trigger) {
        trigger.click();
      }
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openGalleryModal();
    });

    var mainImageLinks = gallery.querySelectorAll('.woocommerce-product-gallery__image > a');

    Array.prototype.forEach.call(mainImageLinks, function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openGalleryModal();
      });
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
      + '.single-product .product.shoshin-hide-purchase-ui #wc-stripe-payment-request-wrapper'
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
      + '.single-product .product.shoshin-hide-express-ui #wc-stripe-payment-request-wrapper'
      + '{display:none !important;}'

      + '.single-product .product.shoshin-hide-purchase-ui .shoshin-express-divider,'
      + '.single-product .product.shoshin-hide-express-ui .shoshin-express-divider'
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

      var positiveValues = values.filter(function (value) {
        return value > 0;
      });

      if (positiveValues.length) {
        return false;
      }

      return true;
    }

    function applyPurchaseUiState() {
      productRoot.classList.remove('shoshin-hide-purchase-ui');
      productRoot.classList.remove('shoshin-hide-express-ui');

      if (purchaseUiState === 'hidden') {
        productRoot.classList.add('shoshin-hide-purchase-ui');
      } else if (purchaseUiState === 'visible-no-express') {
        productRoot.classList.add('shoshin-hide-express-ui');
      }

      if (window.shoshinExpressDividerController && typeof window.shoshinExpressDividerController.refresh === 'function') {
        setTimeout(window.shoshinExpressDividerController.refresh, 0);
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
  } else if (zeroPriceFromPhp || currentDisplayedPriceIsZero()) {
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

    var syncTimer = null;

    function scheduleVariableUiSync(delay) {
      if (syncTimer) {
        clearTimeout(syncTimer);
      }

      syncTimer = setTimeout(function () {
        syncPurchaseUiFromDom();
        syncTimer = null;
      }, delay || 0);
    }

    function queueVariableUiSyncPasses(delays) {
      if (!delays || !delays.length) return;

      delays.forEach(function (delay) {
        setTimeout(function () {
          syncPurchaseUiFromDom();
        }, delay);
      });
    }

    if (window.jQuery) {
      var $form = window.jQuery(variationForm);

      $form.on('found_variation show_variation', function (evt, variation) {
        if (variation && variation.price_html) {
          setResolvedPriceBlock(variation.price_html);
        }

        if (variation && variation.stock_html) {
          setResolvedStockBlock(variation.stock_html);
        }

        queueVariableUiSyncPasses([80, 180, 360]);
      });

      $form.on('reset_data hide_variation woocommerce_variation_has_changed', function () {
        setTimeout(function () {
          var variationIdInput = variationForm.querySelector('input[name="variation_id"]');
          var variationId = variationIdInput ? variationIdInput.value : '';

          if (!variationId || variationId === '0') {
            restoreDefaultPriceBlock();
            restoreDefaultStockBlock();
          }

          queueVariableUiSyncPasses([80, 180, 360]);
        }, 80);
      });
    }

    variationForm.addEventListener('reset', function () {
      setTimeout(function () {
        restoreDefaultPriceBlock();
        restoreDefaultStockBlock();
        queueVariableUiSyncPasses([60, 160, 320]);
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

        queueVariableUiSyncPasses([80, 180, 360]);
      }, 80);
    });

    restoreDefaultPriceBlock();
    syncPurchaseUiFromDom();
    queueVariableUiSyncPasses([250, 700]);
  }

  function initShoshinSimpleProductExpressVisibility() {
    if (document.querySelector('form.variations_form')) return;

    var productRoot = document.querySelector('.single-product .product');
    var priceWidget = document.querySelector('.elementor-element.elementor-element-984b738');

    if (!productRoot) return;

    var zeroPriceFlagNode = productRoot.querySelector('.shoshin-product-runtime-flags[data-shoshin-zero-price]');
    var zeroPriceFromPhp = zeroPriceFlagNode && zeroPriceFlagNode.getAttribute('data-shoshin-zero-price') === '1';

    if (!priceWidget && !zeroPriceFromPhp) return;
    if (productRoot.dataset.shoshinSimpleExpressInit === '1') return;

    productRoot.dataset.shoshinSimpleExpressInit = '1';
    ensureShoshinPurchaseUiStyles();

    function currentDisplayedPriceIsZero() {
      if (zeroPriceFromPhp) {
        return true;
      }

      if (!priceWidget) {
        return false;
      }

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

      var positiveValues = values.filter(function (value) {
        return value > 0;
      });

      if (positiveValues.length) {
        return false;
      }

      return true;
    }

    function applyExpressVisibility() {
      productRoot.classList.remove('shoshin-hide-express-ui');

if (zeroPriceFromPhp || currentDisplayedPriceIsZero()) {
        productRoot.classList.add('shoshin-hide-express-ui');
      }

      if (window.shoshinExpressDividerController && typeof window.shoshinExpressDividerController.refresh === 'function') {
        setTimeout(window.shoshinExpressDividerController.refresh, 0);
      }
    }

    var expressInitPasses = 0;

    function scheduleSimpleExpressRefresh() {
      if (expressInitPasses >= 2) return;
      expressInitPasses++;
      setTimeout(applyExpressVisibility, expressInitPasses === 1 ? 250 : 700);
    }

    applyExpressVisibility();
    scheduleSimpleExpressRefresh();
    scheduleSimpleExpressRefresh();
  }

  function initShoshinExpressDivider() {
    var productRoot = document.querySelector('.single-product .product');
    if (!productRoot) return;

    function hasVisibleExpressNodes() {
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
        '#wc-stripe-payment-request-wrapper'
      ];

      for (var i = 0; i < selectors.length; i++) {
        var nodes = productRoot.querySelectorAll(selectors[i]);

        for (var j = 0; j < nodes.length; j++) {
          var style = window.getComputedStyle(nodes[j]);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            return true;
          }
        }
      }

      return false;
    }

    function placeDivider() {
      var existing = productRoot.querySelector('.shoshin-express-divider');
      var cartForm = productRoot.querySelector('form.cart');

      if (!cartForm) {
        if (existing) existing.remove();
        return;
      }

      if (!hasVisibleExpressNodes()) {
        if (existing) existing.remove();
        return;
      }

      if (!existing) {
        existing = document.createElement('div');
        existing.className = 'shoshin-express-divider';
        existing.innerHTML = '<span>OR EXPRESS CHECKOUT</span>';
      }

      if (cartForm.nextSibling !== existing) {
        cartForm.insertAdjacentElement('afterend', existing);
      }
    }

    placeDivider();
    setTimeout(placeDivider, 300);
    setTimeout(placeDivider, 1000);

    return {
      refresh: placeDivider
    };
  }

  function initShoshinPhotoSwipeNoZoom() {
    if (window.__shoshinPhotoSwipeNoZoomInit === true) return;
    window.__shoshinPhotoSwipeNoZoomInit = true;

    document.addEventListener('photoswipeInit', function (e) {
      var pswp = e && e.detail ? e.detail.instance : null;
      if (!pswp) return;

      pswp.options.maxSpreadZoom = 1;
      pswp.options.minSpreadZoom = 1;
      pswp.options.scaleMode = 'fit';
      pswp.options.getDoubleTapZoom = function () {
        return 1;
      };
      pswp.options.pinchToClose = false;
      pswp.options.closeOnVerticalDrag = false;
      pswp.options.tapToToggleControls = false;
      pswp.options.clickToCloseNonZoomable = false;
      pswp.options.allowPanToNext = true;
      pswp.options.wheelToZoom = false;
      pswp.options.bgOpacity = 0.88;

      function suppressImageZoomUi() {
        var root = pswp.template || document.querySelector('.pswp');
        if (!root) return;

        if (!root.__shoshinImageClickBlocked) {
          root.__shoshinImageClickBlocked = true;

          root.addEventListener('click', function (evt) {
            var target = evt.target;
            if (target && target.closest && target.closest('.pswp__img')) {
              evt.preventDefault();
              evt.stopPropagation();
              if (typeof evt.stopImmediatePropagation === 'function') {
                evt.stopImmediatePropagation();
              }
              return false;
            }
          }, true);

          root.addEventListener('dblclick', function (evt) {
            var target = evt.target;
            if (target && target.closest && target.closest('.pswp__img')) {
              evt.preventDefault();
              evt.stopPropagation();
              if (typeof evt.stopImmediatePropagation === 'function') {
                evt.stopImmediatePropagation();
              }
              return false;
            }
          }, true);
        }

        var imgs = root.querySelectorAll('.pswp__img');
        for (var i = 0; i < imgs.length; i++) {
          imgs[i].style.cursor = 'default';
          imgs[i].style.pointerEvents = 'auto';
          imgs[i].style.maxWidth = '100%';
          imgs[i].style.maxHeight = '100%';

          imgs[i].ondblclick = function (evt) {
            evt.preventDefault();
            evt.stopPropagation();
            return false;
          };

          imgs[i].onclick = function (evt) {
            evt.preventDefault();
            evt.stopPropagation();
            return false;
          };

          imgs[i].onwheel = function (evt) {
            evt.preventDefault();
            evt.stopPropagation();
            return false;
          };
        }

        var containers = root.querySelectorAll('.pswp__zoom-wrap, .pswp__container, .pswp__item');
        for (var j = 0; j < containers.length; j++) {
          containers[j].style.cursor = 'default';
        }
      }

      pswp.listen('initialZoomInEnd', suppressImageZoomUi);
      pswp.listen('afterChange', suppressImageZoomUi);
      pswp.listen('resize', suppressImageZoomUi);

      setTimeout(suppressImageZoomUi, 0);
      setTimeout(suppressImageZoomUi, 100);
    });
  }

function runInit() {
  initShoshinCappedGallery();
  initShoshinVariableTopPrice();
  initShoshinSimpleProductExpressVisibility();
  window.shoshinExpressDividerController = initShoshinExpressDivider();
  initShoshinPhotoSwipeNoZoom();
}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInit);
  } else {
    runInit();
  }

})();

/* =========================================
   SHOSHIN — PRODUCT DESCRIPTION READ MORE
   Robust accordion-targeted version
   ========================================= */
document.addEventListener('DOMContentLoaded', function () {
  function initShoshinDescriptionReadMore() {
    if (document.querySelector('.shoshin-desc-readmore-btn')) return;

    var accordionItems = document.querySelectorAll('.elementor-accordion-item, .e-n-accordion-item, .elementor-tab-title');
    if (!accordionItems.length) return;

    var descriptionItem = null;
    var descriptionPanel = null;

    var items = document.querySelectorAll('.elementor-accordion-item, .e-n-accordion-item');

    Array.prototype.forEach.call(items, function (item) {
      if (descriptionItem) return;

      var title =
        item.querySelector('.elementor-tab-title') ||
        item.querySelector('.e-n-accordion-item-title') ||
        item.querySelector('[role="button"]');

      var text = title ? (title.textContent || '').trim().toLowerCase() : '';
      if (text.indexOf('product description') !== -1) {
        descriptionItem = item;
        descriptionPanel =
          item.querySelector('.elementor-tab-content') ||
          item.querySelector('.e-n-accordion-item-content') ||
          item.querySelector('[role="region"]');
      }
    });

    if (!descriptionItem || !descriptionPanel) return;

    var content =
      descriptionPanel.querySelector('.elementor-widget-theme-post-content .elementor-widget-container') ||
      descriptionPanel.querySelector('.elementor-widget-theme-post-content') ||
      descriptionPanel.querySelector('.elementor-widget-container') ||
      descriptionPanel;

    if (!content) return;
    if (content.querySelector('.shoshin-desc-readmore-content')) return;

    var originalChildren = Array.prototype.slice.call(content.childNodes);
    if (!originalChildren.length) return;

    var wrapper = document.createElement('div');
    wrapper.className = 'shoshin-desc-readmore-content is-collapsed';

    originalChildren.forEach(function (node) {
      wrapper.appendChild(node);
    });

    content.appendChild(wrapper);

    var buttonRow = document.createElement('div');
    buttonRow.className = 'shoshin-desc-readmore-wrap';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shoshin-desc-readmore-btn';
    btn.textContent = 'Learn more about this item';

    buttonRow.appendChild(btn);
    content.appendChild(buttonRow);

    function refreshVisibility() {
      var needsClamp = wrapper.scrollHeight > 270;

      if (!needsClamp) {
        buttonRow.style.display = 'none';
        wrapper.classList.remove('is-collapsed', 'is-expanded');
        wrapper.style.maxHeight = 'none';
        return;
      }

      buttonRow.style.display = '';
      wrapper.style.maxHeight = '';

      if (!wrapper.classList.contains('is-expanded')) {
        wrapper.classList.add('is-collapsed');
        wrapper.classList.remove('is-expanded');
      }
    }

    btn.addEventListener('click', function () {
      var expanded = wrapper.classList.contains('is-expanded');

      if (expanded) {
        wrapper.classList.remove('is-expanded');
        wrapper.classList.add('is-collapsed');
        btn.textContent = 'Learn more about this item';
      } else {
        wrapper.classList.remove('is-collapsed');
        wrapper.classList.add('is-expanded');
        btn.textContent = 'Show less';
      }
    });

    setTimeout(refreshVisibility, 100);
    setTimeout(refreshVisibility, 300);
    setTimeout(refreshVisibility, 700);

    window.addEventListener('resize', refreshVisibility);
  }

  initShoshinDescriptionReadMore();
  setTimeout(initShoshinDescriptionReadMore, 300);
  setTimeout(initShoshinDescriptionReadMore, 800);
});

/* =========================================
   SHOSHIN — REVIEW BODY READ MORE
   ========================================= */
document.addEventListener('DOMContentLoaded', function () {
  function initShoshinReviewReadMore() {
    var reviewsRoot = document.querySelector('.shoshin-product-reviews');
    if (!reviewsRoot) return;

    var descriptions = reviewsRoot.querySelectorAll('.comment-text .description');

    Array.prototype.forEach.call(descriptions, function (desc) {
      if (!desc) return;
      if (desc.querySelector('.shoshin-review-readmore-content')) return;

      var originalChildren = Array.prototype.slice.call(desc.childNodes);
      if (!originalChildren.length) return;

      var wrapper = document.createElement('div');
      wrapper.className = 'shoshin-review-readmore-content is-collapsed';

      originalChildren.forEach(function (node) {
        wrapper.appendChild(node);
      });

      desc.appendChild(wrapper);

      var buttonRow = document.createElement('div');
      buttonRow.className = 'shoshin-review-readmore-wrap';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shoshin-review-readmore-btn';
      btn.textContent = '∨ Read More';

      buttonRow.appendChild(btn);
      desc.appendChild(buttonRow);

      function refreshVisibility() {
        var needsClamp = wrapper.scrollHeight > 132;

        if (!needsClamp) {
          buttonRow.style.display = 'none';
          wrapper.classList.remove('is-collapsed', 'is-expanded');
          wrapper.style.maxHeight = 'none';
          return;
        }

        buttonRow.style.display = '';
        wrapper.style.maxHeight = '';

        if (!wrapper.classList.contains('is-expanded')) {
          wrapper.classList.add('is-collapsed');
          wrapper.classList.remove('is-expanded');
          btn.textContent = '∨ Read More';
        }
      }

      btn.addEventListener('click', function () {
        var expanded = wrapper.classList.contains('is-expanded');

        if (expanded) {
          wrapper.classList.remove('is-expanded');
          wrapper.classList.add('is-collapsed');
          btn.textContent = '∨ Read More';
        } else {
          wrapper.classList.remove('is-collapsed');
          wrapper.classList.add('is-expanded');
          btn.textContent = '^ Show Less';
        }
      });

      setTimeout(refreshVisibility, 50);
      setTimeout(refreshVisibility, 250);
    });
  }

  initShoshinReviewReadMore();
  setTimeout(initShoshinReviewReadMore, 300);
  window.addEventListener('resize', initShoshinReviewReadMore);
});

