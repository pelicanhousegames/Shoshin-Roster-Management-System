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

document.querySelectorAll('.wc-block-grid__product').forEach(card => {

  if (card.querySelector('.shoshin-card-rating')) return;

  const title = card.querySelector('.wc-block-grid__product-title');
  if (!title) return;

  const rating = document.createElement('div');
  rating.className = 'shoshin-card-rating';
  rating.innerHTML =
      '<span class="shoshin-unrated-placeholder">No reviews yet</span>';

  title.insertAdjacentElement('afterend', rating);

});