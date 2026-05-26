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
    var defaultHtml = priceWidget.innerHTML;
    var defaultStockHtml = stockWidget ? stockWidget.outerHTML : '';

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

      var form = variationForm.closest('.summary') ? variationForm.closest('.summary').querySelector('form.cart') : null;
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

      var form = variationForm.closest('.summary') ? variationForm.closest('.summary').querySelector('form.cart') : null;
      if (form) {
        form.insertAdjacentHTML('beforebegin', html);
      }
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
      });

      $form.on('reset_data hide_variation woocommerce_variation_has_changed', function () {
        var variationIdInput = variationForm.querySelector('input[name="variation_id"]');
        var variationId = variationIdInput ? variationIdInput.value : '';

        if (!variationId) {
          setTimeout(function () {
            restoreDefaultPriceBlock();
            restoreDefaultStockBlock();
          }, 50);
        }
      });
    }

    variationForm.addEventListener('reset', function () {
      setTimeout(function () {
        restoreDefaultPriceBlock();
        restoreDefaultStockBlock();
      }, 50);
    });

    variationForm.addEventListener('change', function () {
      var variationIdInput = variationForm.querySelector('input[name="variation_id"]');
      var variationId = variationIdInput ? variationIdInput.value : '';

      if (!variationId) {
        setTimeout(function () {
          restoreDefaultPriceBlock();
          restoreDefaultStockBlock();
        }, 50);
      }
    });

    restoreDefaultPriceBlock();
  }

  function runInit() {
    initShoshinCappedGallery();
    initShoshinVariableTopPrice();
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

