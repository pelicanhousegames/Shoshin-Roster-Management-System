(function () {
  function markSingleImageGalleries() {
    var galleries = document.querySelectorAll(
      '.elementor-element.elementor-element-1599068 .woocommerce-product-gallery'
    );

    galleries.forEach(function (gallery) {
      var thumbs = gallery.querySelectorAll('.flex-control-thumbs li');

      // Reset state first
      gallery.classList.remove('shoshin-single-image-gallery');

      // If 0 or 1 thumbs, treat as single-image gallery
      if (thumbs.length <= 1) {
        gallery.classList.add('shoshin-single-image-gallery');
      }
    });
  }

  function initShoshinCappedGallery() {
    var galleryWidget = document.querySelector('.elementor-element.elementor-element-1599068');
    if (!galleryWidget) return;

    var gallery = galleryWidget.querySelector('.woocommerce-product-gallery');
    if (!gallery) return;

    var thumbs = gallery.querySelector('.flex-control-thumbs');

    // If no thumbs at all, still mark single-image state and exit
    if (!thumbs) {
      markSingleImageGalleries();
      return;
    }

    var thumbItems = Array.prototype.slice.call(thumbs.querySelectorAll('li'));

    // Mark single-image gallery before any capped-strip logic
    markSingleImageGalleries();

    // If 0 or 1 thumbs, do not run capped-strip logic
    if (thumbItems.length <= 1) {
      return;
    }

    // Avoid duplicate init for multi-image galleries only
    if (thumbs.dataset.shoshinEnhanced === '1') return;
    thumbs.dataset.shoshinEnhanced = '1';

    var visibleCount = 5;
    var hiddenCount = Math.max(0, thumbItems.length - visibleCount);

    // Hover should activate visible thumbs
    thumbItems.forEach(function (li) {
      var img = li.querySelector('img');
      if (!img) return;

      img.addEventListener('mouseenter', function () {
        // WooCommerce/Flexslider usually binds click to the thumb image
        img.click();
      });
    });

    if (hiddenCount <= 0) return;

    // Hide thumbs beyond visibleCount
    thumbItems.forEach(function (li, index) {
      if (index >= visibleCount) {
        li.classList.add('shoshin-thumb-hidden');
      }
    });

    // Build +N More tile
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

  function runInit() {
    markSingleImageGalleries();
    initShoshinCappedGallery();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInit);
  } else {
    runInit();
  }

  // Elementor / Woo refresh safety
  window.addEventListener('load', function () {
    setTimeout(runInit, 100);
    setTimeout(runInit, 300);
    setTimeout(runInit, 600);
  });
})();