(function () {
function markAvailabilityState(metaValueEl) {
  var raw = (metaValueEl.textContent || '').replace(/\r/g, '').trim();
  if (!raw) return;

  var firstLine = raw.split('\n')[0].trim();

  metaValueEl.classList.remove(
    'shoshin-meta--available',
    'shoshin-meta--future',
    'shoshin-meta--has-membership'
  );

  if (firstLine === 'In-Stock' || firstLine === 'Currently Available') {
    metaValueEl.classList.add('shoshin-meta--available');
  } else if (firstLine === 'Pre-Order' || firstLine === 'Batch Production') {
    metaValueEl.classList.add('shoshin-meta--future');
  }

  if (raw.indexOf('Membership discount applied') !== -1) {
    metaValueEl.classList.add('shoshin-meta--has-membership');
  }
}

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

    // Already in the correct place
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
          markAvailabilityState(el);
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