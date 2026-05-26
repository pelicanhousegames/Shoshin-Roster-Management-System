(function () {
  'use strict';

  /* =========================================================
   * SHOSHIN — SHARED HELPERS
   * ======================================================= */

  function text(el) {
    return el ? (el.textContent || '').trim() : '';
  }

  function whenReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

    function storeCartScrollPosition() {
    if (!document.body.classList.contains('woocommerce-cart')) return;

    try {
      sessionStorage.setItem(
        'shoshinCartScrollY',
        String(window.scrollY || window.pageYOffset || 0)
      );
      sessionStorage.setItem('shoshinCartRestorePending', '1');
    } catch (e) {}
  }

  function restoreCartScrollPosition() {
    if (!document.body.classList.contains('woocommerce-cart')) return;

    try {
      var pending = sessionStorage.getItem('shoshinCartRestorePending');
      var stored = sessionStorage.getItem('shoshinCartScrollY');

      if (pending !== '1' || !stored) return;

      var targetY = parseInt(stored, 10) || 0;

      function doRestore() {
        window.scrollTo(0, targetY);
      }

      window.requestAnimationFrame(function () {
        doRestore();

        window.setTimeout(doRestore, 60);
        window.setTimeout(doRestore, 180);
        window.setTimeout(function () {
          doRestore();
          sessionStorage.removeItem('shoshinCartScrollY');
          sessionStorage.removeItem('shoshinCartRestorePending');
        }, 320);
      });
    } catch (e) {}
  }

  /* =========================================================
   * SHOSHIN — CART META HELPERS (BLOCKS + CLASSIC)
   * ======================================================= */

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

      if (value === 'Pre-Order' || value === 'Batch Production') {
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
      .map(function (line) {
        return line.trim();
      })
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

  /* =========================================================
   * SHOSHIN — CLASSIC CART ROW ENHANCEMENTS
   * ======================================================= */

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
        storeCartScrollPosition();
        updateButton.click();
      }, 120);
    }

    function syncButtons() {
      var min = input.min !== '' ? parseFloat(input.min) : 0;
      var max = input.max !== '' ? parseFloat(input.max) : Infinity;
      var current = parseFloat(input.value || '0');

      minus.disabled = current <= min;
      plus.disabled = current >= max;
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

  function getMiniCartAjaxUrl() {
    if (window.shoshinMiniCart && window.shoshinMiniCart.ajax_url) {
      return window.shoshinMiniCart.ajax_url;
    }
    if (window.shoshinCart && window.shoshinCart.ajax_url) {
      return window.shoshinCart.ajax_url;
    }
    return '';
  }

  function getMiniCartFragmentsUrl() {
    if (window.shoshinMiniCart && window.shoshinMiniCart.wc_ajax_url) {
      return window.shoshinMiniCart.wc_ajax_url
        .toString()
        .replace('%%endpoint%%', 'get_refreshed_fragments');
    }

    if (window.shoshinCart && window.shoshinCart.wc_ajax_url) {
      return window.shoshinCart.wc_ajax_url
        .toString()
        .replace('%%endpoint%%', 'get_refreshed_fragments');
    }

    return '';
  }


  function refreshMiniCartFragments(done) {
    var fragmentsUrl = getMiniCartFragmentsUrl();
    if (!fragmentsUrl) {
      if (typeof done === 'function') done(false);
      return;
    }

    var preservedExpressNodes = preserveClassicExpressMounts();

    fetch(fragmentsUrl, {
      method: 'POST',
      credentials: 'same-origin'
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data || !data.fragments) {
          if (typeof done === 'function') done(false);
          return;
        }

        Object.keys(data.fragments).forEach(function (selector) {
          document.querySelectorAll(selector).forEach(function (target) {
            target.outerHTML = data.fragments[selector];
          });
        });

        if (document.body.classList.contains('woocommerce-cart')) {
          applyAllCartEnhancements(document);
          restoreClassicExpressMounts(preservedExpressNodes);
        }

        hydrateMiniCartQtyControls();

        document.body.dispatchEvent(new CustomEvent('wc_fragments_refreshed'));
        if (window.jQuery) {
          window.jQuery(document.body).trigger('wc_fragments_refreshed');
        }

        if (typeof done === 'function') done(true);
      })
      .catch(function () {
        if (typeof done === 'function') done(false);
      });
  }

  function refreshClassicCheckoutPageState(done) {
    if (!document.body.classList.contains('woocommerce-checkout')) {
      if (typeof done === 'function') done(false);
      return;
    }

    if (!window.jQuery) {
      if (typeof done === 'function') done(false);
      return;
    }

    var $body = window.jQuery(document.body);
    var finished = false;

    function finish(result) {
      if (finished) return;
      finished = true;
      $body.off('updated_checkout', handleUpdatedCheckout);
      if (typeof done === 'function') done(result);
    }

    function handleUpdatedCheckout() {
      window.setTimeout(function () {
        finish(true);
      }, 350);
    }

    $body.on('updated_checkout', handleUpdatedCheckout);
    $body.trigger('update_checkout');

    window.setTimeout(function () {
      finish(false);
    }, 2500);
  }

    function refreshClassicCartPageFromServer(done) {
    if (!document.body.classList.contains('woocommerce-cart')) {
      if (typeof done === 'function') done(false);
      return;
    }

    var currentWoo = document.querySelector('body.woocommerce-cart .page-content .woocommerce');
    if (!currentWoo) {
      window.location.reload();
      return;
    }

    var preservedExpressNodes = preserveClassicExpressMounts();

    fetch(window.location.href, {
      credentials: 'same-origin',
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
      .then(function (response) {
        return response.text();
      })
      .then(function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var nextWoo = doc.querySelector('body.woocommerce-cart .page-content .woocommerce');

        if (!nextWoo) {
  window.location.href = '/cart/';
  return;
}

        currentWoo.replaceWith(nextWoo);
        applyAllCartEnhancements(document);
        restoreClassicExpressMounts(preservedExpressNodes);

        if (typeof done === 'function') done(true);
      })
      .catch(function () {
        window.location.reload();
      });
  }

  function refreshClassicCheckoutPageFromServer(done) {
    if (!document.body.classList.contains('woocommerce-checkout')) {
      if (typeof done === 'function') done(false);
      return;
    }

    var currentWoo = document.querySelector('body.woocommerce-checkout .page-content > .woocommerce');
    if (!currentWoo) {
      window.location.reload();
      return;
    }

    fetch(window.location.href, {
      credentials: 'same-origin',
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
      .then(function (response) {
        return response.text();
      })
      .then(function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var nextWoo = doc.querySelector('body.woocommerce-checkout .page-content > .woocommerce');

        if (!nextWoo) {
  window.location.href = '/cart/';
  return;
}

        currentWoo.replaceWith(nextWoo);

        if (window.jQuery) {
          window.jQuery(document.body).trigger('update_checkout');
          window.setTimeout(function () {
            window.jQuery(document.body).trigger('update_checkout');
          }, 180);
        }

        if (typeof done === 'function') done(true);
      })
      .catch(function () {
        window.location.reload();
      });
  }

  function requestMiniCartQuantityUpdate(control, nextQty) {
    var ajaxUrl = getMiniCartAjaxUrl();
    var nonce =
      window.shoshinMiniCart && window.shoshinMiniCart.nonce
        ? window.shoshinMiniCart.nonce
        : '';

    if (!ajaxUrl || !nonce || !control) return;
    if (control.dataset.shoshinMiniCartUpdating === '1') return;

    var cartItemKey = control.getAttribute('data-cart-item-key');
    var input = control.querySelector('input.qty');
    var row = control.closest('.elementor-menu-cart__product');

    if (!cartItemKey || !input) return;

    var formData = new FormData();
    formData.append('action', 'shoshin_update_mini_cart_qty');
    formData.append('nonce', nonce);
    formData.append('cart_item_key', cartItemKey);
    formData.append('quantity', String(nextQty));

    control.dataset.shoshinMiniCartUpdating = '1';
    control.classList.add('is-updating');
    if (row) row.classList.add('is-updating');

    fetch(ajaxUrl, {
      method: 'POST',
      body: formData,
      credentials: 'same-origin'
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data || !data.success || !data.data) {
          throw new Error('Mini-cart update failed');
        }

        var payload = data.data;

        if (row && payload.line_total_html) {
          var priceWrap = row.querySelector('.elementor-menu-cart__product-price');
          var existingLine = priceWrap
            ? priceWrap.querySelector('.shoshin-mini-cart-price-stack > .quantity, .shoshin-mini-cart-price-stack > span.quantity')
            : null;

          if (existingLine) {
            existingLine.outerHTML = payload.line_total_html;
          } else if (priceWrap) {
            var stack = priceWrap.querySelector('.shoshin-mini-cart-price-stack');
            if (stack) {
              stack.insertAdjacentHTML('afterbegin', payload.line_total_html);
            } else {
              priceWrap.innerHTML = payload.line_total_html;
            }
          }
        }

        if (typeof payload.cart_subtotal === 'string' && payload.cart_subtotal) {
          document.querySelectorAll(
            '.elementor-menu-cart__subtotal .amount, ' +
            '.elementor-menu-cart__subtotal .woocommerce-Price-amount, ' +
            '.elementor-menu-cart__footer .amount, ' +
            '.elementor-menu-cart__footer .woocommerce-Price-amount'
          ).forEach(function (el) {
            el.outerHTML = payload.cart_subtotal;
          });
        }

        if (typeof payload.cart_total === 'string' && payload.cart_total) {
          document.querySelectorAll(
            'body.woocommerce-cart .cart_totals .order-total td'
          ).forEach(function (el) {
            el.innerHTML = payload.cart_total;
          });
        }

        if (typeof payload.cart_count !== 'undefined') {
          document.querySelectorAll(
            '.hdr-right .elementor-menu-cart__counter, ' +
            '.hdr-right .elementor-button-icon-qty, ' +
            '.elementor-menu-cart__toggle .elementor-button-icon-qty'
          ).forEach(function (el) {
            el.textContent = String(payload.cart_count);
            el.setAttribute('data-counter', String(payload.cart_count));
          });
        }

        return new Promise(function (resolve) {
          refreshMiniCartFragments(function () {
            refreshClassicCartPageFromServer(function () {
              refreshClassicCheckoutPageState(function () {
                resolve();
              });
            });
          });
        });
      })
      .catch(function () {})
      .finally(function () {
        delete control.dataset.shoshinMiniCartUpdating;
        control.classList.remove('is-updating');
        if (row) row.classList.remove('is-updating');
      });
  }

    function hydrateMiniCartQtyControls() {
    var rows = document.querySelectorAll(
      '.elementor-menu-cart__container .elementor-menu-cart__product'
    );

    rows.forEach(function (row) {
      if (!row || row.dataset.shoshinMiniCartQtyHydrated === '1') return;

      var priceWrap = row.querySelector('.elementor-menu-cart__product-price');
      var removeLink = row.querySelector(
        '.elementor-menu-cart__product-remove a[data-cart_item_key]'
      );
      var qtyText = row.querySelector('.elementor-menu-cart__product-price .product-quantity');
      var existingControl = row.querySelector('.shoshin-mini-cart-qty');

      if (!priceWrap || !removeLink || !qtyText || existingControl) return;

      var cartItemKey = removeLink.getAttribute('data-cart_item_key');
      if (!cartItemKey) return;

      var qtyMatch = (qtyText.textContent || '').match(/(\d+)/);
      var currentQty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

      if (!currentQty || currentQty < 1) currentQty = 1;

      var stack = priceWrap.querySelector('.shoshin-mini-cart-price-stack');
      if (!stack) {
        stack = document.createElement('div');
        stack.className = 'shoshin-mini-cart-price-stack';

        while (priceWrap.firstChild) {
          stack.appendChild(priceWrap.firstChild);
        }

        priceWrap.appendChild(stack);
      }

      var control = document.createElement('div');
      control.className = 'shoshin-mini-cart-qty';
      control.setAttribute('data-cart-item-key', cartItemKey);
      control.innerHTML =
        '<button type="button" class="shoshin-mini-cart-qty__btn shoshin-mini-cart-qty__btn--minus" aria-label="Decrease quantity">−</button>' +
        '<span class="quantity">' +
          '<input type="number" class="input-text qty text shoshin-mini-cart-qty__input" step="1" min="1" value="' + String(currentQty) + '" inputmode="numeric" />' +
        '</span>' +
        '<button type="button" class="shoshin-mini-cart-qty__btn shoshin-mini-cart-qty__btn--plus" aria-label="Increase quantity">+</button>';

      stack.appendChild(control);
      row.dataset.shoshinMiniCartQtyHydrated = '1';
    });
  }

  function bindMiniCartQtyControls() {
    if (document.body.dataset.shoshinMiniCartQtyBound === '1') return;
    document.body.dataset.shoshinMiniCartQtyBound = '1';

    var timers = {};

    document.addEventListener(
      'click',
      function (event) {
        var button = event.target.closest('.shoshin-mini-cart-qty__btn');
        if (!button) return;

        var control = button.closest('.shoshin-mini-cart-qty');
        var input = control ? control.querySelector('input.qty') : null;
        if (!control || !input) return;

        event.preventDefault();

        var step = parseFloat(input.step || '1');
        var min = input.min !== '' ? parseFloat(input.min) : 0;
        var max = input.max !== '' ? parseFloat(input.max) : Infinity;
        var current = parseFloat(input.value || '0');

        if (!isFinite(step) || step <= 0) step = 1;
        if (!isFinite(current)) current = min || 0;
        if (!isFinite(max)) max = Infinity;

        var next =
          button.classList.contains('shoshin-mini-cart-qty__btn--plus')
            ? current + step
            : current - step;

        if (next < min) next = min;
        if (next > max) next = max;
        if (next === current) return;

        input.value = String(next);
        input.dispatchEvent(new Event('input', { bubbles: true }));

        control.dataset.shoshinMiniCartSkipChangeOnce = '1';
        requestMiniCartQuantityUpdate(control, next);
      },
      true
    );

    document.addEventListener(
      'change',
      function (event) {
        var input = event.target.closest('.shoshin-mini-cart-qty input.qty');
        if (!input) return;

        var control = input.closest('.shoshin-mini-cart-qty');
        if (!control) return;

        var key = control.getAttribute('data-cart-item-key');
        if (!key) return;

        if (control.dataset.shoshinMiniCartSkipChangeOnce === '1') {
          delete control.dataset.shoshinMiniCartSkipChangeOnce;
          return;
        }

        var min = input.min !== '' ? parseFloat(input.min) : 0;
        var max = input.max !== '' ? parseFloat(input.max) : Infinity;
        var next = parseFloat(input.value || '0');

        if (!isFinite(next)) next = min || 0;
        if (!isFinite(max)) max = Infinity;
        if (next < min) next = min;
        if (next > max) next = max;

        input.value = String(next);

        if (timers[key]) {
          window.clearTimeout(timers[key]);
        }

        timers[key] = window.setTimeout(function () {
          requestMiniCartQuantityUpdate(control, next);
        }, 260);
      },
      true
    );
  }

  function initMiniCartQtyHydration() {
    hydrateMiniCartQtyControls();
    bindMiniCartQtyControls();

    document.addEventListener('wc_fragments_refreshed', hydrateMiniCartQtyControls, true);

    if (window.jQuery && document.body.dataset.shoshinMiniCartHydrationBound !== '1') {
      document.body.dataset.shoshinMiniCartHydrationBound = '1';

      window.jQuery(document.body).on(
        'wc_fragments_loaded added_to_cart removed_from_cart updated_cart_totals',
        function (event) {
          window.setTimeout(hydrateMiniCartQtyControls, 0);
          window.setTimeout(hydrateMiniCartQtyControls, 120);
          window.setTimeout(hydrateMiniCartQtyControls, 320);

          if (event && event.type === 'removed_from_cart') {
            window.setTimeout(function () {
              refreshClassicCartPageFromServer(function () {
                refreshClassicCheckoutPageFromServer(function () {});
              });
            }, 140);
          }
        }
      );

      window.jQuery(document).on(
        'click',
        '.hdr-right .elementor-menu-cart__toggle a, ' +
          '.hdr-right .elementor-menu-cart__toggle .elementor-button, ' +
          '.elementor-widget-woocommerce-menu-cart a.elementor-menu-cart__toggle_button, ' +
          '.elementor-menu-cart__toggle a',
        function () {
          window.setTimeout(hydrateMiniCartQtyControls, 0);
          window.setTimeout(hydrateMiniCartQtyControls, 120);
          window.setTimeout(hydrateMiniCartQtyControls, 320);
          window.setTimeout(hydrateMiniCartQtyControls, 700);
        }
      );
    }

    if (document.body.dataset.shoshinMiniCartObserverBound !== '1') {
      document.body.dataset.shoshinMiniCartObserverBound = '1';

      var miniCartObserver = new MutationObserver(function (mutations) {
        var shouldHydrate = false;

        mutations.forEach(function (mutation) {
          mutation.addedNodes.forEach(function (node) {
            if (
              node &&
              node.nodeType === 1 &&
              (
                (node.matches && node.matches('.elementor-menu-cart__product')) ||
                (node.querySelector && node.querySelector('.elementor-menu-cart__product'))
              )
            ) {
              shouldHydrate = true;
            }
          });
        });

        if (shouldHydrate) {
          hydrateMiniCartQtyControls();
        }
      });

      miniCartObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  initMiniCartQtyHydration();

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
      .map(function (line) {
        return line.trim();
      })
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
    var rows = scope.querySelectorAll('body.woocommerce-cart .woocommerce-cart-form__cart-item');

    rows.forEach(function (row) {
      enhanceClassicMeta(row);
      ensureQtyButtons(row);
      moveClassicRemoveIntoControls(row);
    });
  }

  /* =========================================================
   * SHOSHIN — CLASSIC CART COUPON PANEL
   * ======================================================= */

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
      body.appendChild(coupon);
      body.appendChild(feedback);
      coupon.dataset.shoshinCouponMoved = '1';
    } else if (body.lastElementChild !== feedback) {
      body.appendChild(feedback);
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

    function rescanCouponNotices() {
      var hasCouponNotice = moveCouponNotices();

      if (hasCouponNotice) {
        setOpen(true);
      }

      return hasCouponNotice;
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
        var preservedExpressNodes = preserveClassicExpressMounts();

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
        restoreClassicExpressMounts(preservedExpressNodes);
      } catch (error) {
        feedback.innerHTML =
          '<div class="woocommerce-error">Unable to apply coupon right now. Please try again.</div>';
        setOpen(true);
      } finally {
        delete existingPanel.dataset.shoshinCouponLoading;
        syncCouponButtonState();
      }
    }

    if (toggle && toggle.dataset.shoshinBound !== '1') {
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

    if (!rescanCouponNotices()) {
      setOpen(false);
    }

    window.setTimeout(rescanCouponNotices, 50);
    window.setTimeout(rescanCouponNotices, 250);
  }

  /* =========================================================
   * SHOSHIN — CLASSIC CART STRUCTURE
   * ======================================================= */

  function ensureExpressDivider(expressCard) {
    if (!expressCard) return null;

    var divider = expressCard.querySelector('.shoshin-express-divider');
    if (!divider) {
      divider = document.createElement('div');
      divider.className = 'shoshin-express-divider';
      divider.textContent = 'OR';
      expressCard.appendChild(divider);
    }

    return divider;
  }

  function structureClassicSidebarCards() {
    var totals = document.querySelector(
      'body.woocommerce-cart .cart_totals.calculated_shipping, body.woocommerce-cart .cart_totals'
    );
    if (!totals) return;

    var heading = totals.querySelector(':scope > h2');
    var couponPanel = totals.querySelector(':scope > .shoshin-cart-coupon-panel');
    var totalsTable = totals.querySelector(':scope > table.shop_table');
    var proceed = totals.querySelector(':scope > .wc-proceed-to-checkout');

    if (!heading || !totalsTable || !proceed) return;

    var totalsCard = totals.querySelector(':scope > .shoshin-classic-cart-totals-card');
    if (!totalsCard) {
      totalsCard = document.createElement('div');
      totalsCard.className = 'shoshin-classic-cart-totals-card';
      totals.insertBefore(totalsCard, heading);
    }

    if (!totalsCard.contains(heading)) totalsCard.appendChild(heading);
    if (couponPanel && !totalsCard.contains(couponPanel)) totalsCard.appendChild(couponPanel);
    if (!totalsCard.contains(totalsTable)) totalsCard.appendChild(totalsTable);

    var expressCard = totals.querySelector(':scope > .shoshin-classic-cart-express-card');
    if (!expressCard) {
      expressCard = document.createElement('div');
      expressCard.className = 'shoshin-classic-cart-express-card';
      totals.appendChild(expressCard);
    }

    var ctaCard = totals.querySelector(':scope > .shoshin-classic-cart-cta-card');
    if (!ctaCard) {
      ctaCard = document.createElement('div');
      ctaCard.className = 'shoshin-classic-cart-cta-card';
      totals.appendChild(ctaCard);
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
        child.matches(
          '#wc-stripe-express-checkout-element, .ppc-button-wrapper, .wcpay-express-checkout-wrapper, #ppcp-recaptcha-v2-container'
        )
      ) {
        if (!expressCard.contains(child)) {
          expressCard.appendChild(child);
        }
      }
    });

    var floatingRecaptcha = totals.querySelector(':scope > #ppcp-recaptcha-v2-container');
    if (floatingRecaptcha && !expressCard.contains(floatingRecaptcha)) {
      expressCard.appendChild(floatingRecaptcha);
    }

    proceed.remove();

    var divider = ensureExpressDivider(expressCard);
    if (divider) {
      expressCard.appendChild(divider);
    }

    if (expressCard.parentNode === totals) {
      totals.appendChild(expressCard);
    }

    if (ctaCard.parentNode === totals) {
      totals.appendChild(ctaCard);
    }

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

    var form = woocommerce.querySelector('form.woocommerce-cart-form');
    var collaterals = woocommerce.querySelector('.cart-collaterals');
    if (!form || !collaterals) return;

    var totals = collaterals.querySelector('.cart_totals');
    if (!totals) return;

    var crossSells = collaterals.querySelector('.cross-sells');
    var mainColumn = woocommerce.querySelector('.shoshin-classic-cart-main-column');

    if (!mainColumn) {
      mainColumn = document.createElement('div');
      mainColumn.className = 'shoshin-classic-cart-main-column';
      woocommerce.insertBefore(mainColumn, woocommerce.firstElementChild || null);
    }

    if (form.parentNode !== mainColumn) {
      mainColumn.appendChild(form);
    }

    if (crossSells && crossSells.parentNode !== mainColumn) {
      mainColumn.appendChild(crossSells);
    }

    if (totals.parentNode !== woocommerce) {
      woocommerce.appendChild(totals);
    }

    if (!collaterals.querySelector('.cross-sells') && !collaterals.querySelector('.cart_totals')) {
      collaterals.remove();
    }
  }

  function relabelClassicCartEstimatedTotal() {
    var orderTotalHeader = document.querySelector(
      'body.woocommerce-cart .cart_totals > .shoshin-classic-cart-totals-card .order-total th'
    );

    if (!orderTotalHeader) return;

    var current = (orderTotalHeader.textContent || '').trim();
    if (current === 'Total') {
      orderTotalHeader.innerHTML = 'Estimated&nbsp;Total';
    }
  }

  function toggleClassicExpressCardForZeroTotal() {
    if (!document.body.classList.contains('woocommerce-cart')) return;

    var totalCell = document.querySelector(
      'body.woocommerce-cart .cart_totals .order-total td .woocommerce-Price-amount'
    );

    var expressCard = document.querySelector(
      'body.woocommerce-cart .cart_totals > .shoshin-classic-cart-express-card'
    );

    if (!expressCard || !totalCell) return;

    var raw = (totalCell.textContent || '').replace(/[^0-9.,-]/g, '').trim();
    var normalized = raw.replace(/,/g, '');
    var totalValue = parseFloat(normalized);

    if (!isNaN(totalValue) && totalValue <= 0) {
      expressCard.style.display = 'none';
    } else {
      expressCard.style.display = '';
    }
  }

    function toggleClassicCartPodOnlyShippingUi() {
    if (!document.body.classList.contains('woocommerce-cart')) return;

    var shippingRow = document.querySelector(
      'body.woocommerce-cart .cart_totals .shipping'
    );
    if (!shippingRow) return;

    var methodLabels = Array.from(
      shippingRow.querySelectorAll(
        'ul#shipping_method li label, .woocommerce-shipping-methods li label'
      )
    )
      .map(function (el) {
        return (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      })
      .filter(Boolean);

    var inlineLabel = shippingRow.querySelector('td[data-title="Shipment"]');
    var inlineText = inlineLabel
      ? (inlineLabel.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
      : '';

    var hasAnyPod =
      methodLabels.some(function (txt) {
        return txt.indexOf('print on demand') !== -1;
      }) ||
      inlineText.indexOf('print on demand') !== -1;

    var hasAnyNonPod =
      methodLabels.some(function (txt) {
        return txt.indexOf('print on demand') === -1;
      });

    var isPodOnly = hasAnyPod && !hasAnyNonPod;

    shippingRow
      .querySelectorAll(
        '.woocommerce-shipping-destination, ' +
        '.shipping-calculator-button, ' +
        '.woocommerce-shipping-calculator'
      )
      .forEach(function (el) {
        el.style.display = isPodOnly ? 'none' : '';
      });
  }

  /* =========================================================
   * SHOSHIN — CLASSIC CART INTERACTIONS
   * ======================================================= */

  function preserveClassicExpressMounts() {
    var totals = document.querySelector('body.woocommerce-cart .cart_totals');
    if (!totals) return [];

    var selectors = [
      '#wc-stripe-express-checkout-element',
      '.ppc-button-wrapper',
      '.wcpay-express-checkout-wrapper',
      '#ppcp-recaptcha-v2-container'
    ];

    var kept = [];

    selectors.forEach(function (selector) {
      totals.querySelectorAll(selector).forEach(function (node) {
        kept.push(node);
      });
    });

    return kept;
  }

  function restoreClassicExpressMounts(nodes) {
    if (!nodes || !nodes.length) return;

    var totals = document.querySelector('body.woocommerce-cart .cart_totals');
    if (!totals) return;

    var expressCard = totals.querySelector(':scope > .shoshin-classic-cart-express-card');
    if (!expressCard) return;

    nodes.forEach(function (node) {
      if (!node) return;
      if (!expressCard.contains(node)) {
        expressCard.appendChild(node);
      }
    });

    var divider = ensureExpressDivider(expressCard);
    if (divider) {
      expressCard.appendChild(divider);
    }
  }

  function bindClassicCartRemoveAjax() {
    if (document.body.dataset.shoshinClassicRemoveBound === '1') return;

    document.addEventListener(
      'click',
      function (event) {
        var removeLink = event.target.closest('a.remove');
        if (!removeLink) return;
        if (!document.body.classList.contains('woocommerce-cart')) return;
        if (!removeLink.closest('form.woocommerce-cart-form')) return;

        var href = removeLink.getAttribute('href');
        if (!href) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        var woocommerceRoot = document.querySelector(
          'body.woocommerce-cart .page-content .woocommerce'
        );

        if (!woocommerceRoot) {
          window.location.href = href;
          return;
        }

        if (woocommerceRoot.dataset.shoshinRemovingItem === '1') return;
        woocommerceRoot.dataset.shoshinRemovingItem = '1';
        woocommerceRoot.classList.add('is-updating');

        var preservedExpressNodes = preserveClassicExpressMounts();

        fetch(href, {
          credentials: 'same-origin'
        })
          .then(function (response) {
            return response.text();
          })
          .then(function (html) {
            var parser = new DOMParser();
            var doc = parser.parseFromString(html, 'text/html');

            var notices = doc.querySelectorAll(
              '.woocommerce-notices-wrapper, .woocommerce-message, .woocommerce-error'
            );
            notices.forEach(function (el) {
              el.remove();
            });

            var nextWoo = doc.querySelector('body.woocommerce-cart .page-content .woocommerce');
            if (!nextWoo) {
              window.location.href = href;
              return;
            }

            woocommerceRoot.replaceWith(nextWoo);
            applyAllCartEnhancements(document);
            restoreClassicExpressMounts(preservedExpressNodes);

            refreshMiniCartFragments(function () {
              refreshClassicCartPageFromServer(function () {
                refreshClassicCheckoutPageState(function () {});
              });
            });
          })
          .catch(function () {
            window.location.href = href;
          })
          .finally(function () {
            var freshRoot = document.querySelector(
              'body.woocommerce-cart .page-content .woocommerce'
            );

            if (freshRoot) {
              freshRoot.classList.remove('is-updating');
              delete freshRoot.dataset.shoshinRemovingItem;
            }
          });
      },
      true
    );

    document.body.dataset.shoshinClassicRemoveBound = '1';
  }

    function disableLiveSingleQuantityCtas(productId) {
    if (!productId) return;

    var selector = [
      'a.add_to_cart_button[data-product_id="' + productId + '"]',
      '.wc-block-grid__product-add-to-cart a[data-product_id="' + productId + '"]',
      'button.single_add_to_cart_button[value="' + productId + '"]',
      '.single-product form.cart [name="add-to-cart"][value="' + productId + '"]',
      '.single-product form.cart button.single_add_to_cart_button'
    ].join(',');

    document.querySelectorAll(selector).forEach(function (btn) {
      if (!btn) return;

      btn.classList.remove('ajax_add_to_cart');
      btn.classList.add('disabled', 'shoshin-disabled-add-to-cart');
      btn.setAttribute('aria-disabled', 'true');
      btn.setAttribute('tabindex', '-1');

      if (btn.tagName === 'BUTTON') {
        btn.disabled = true;
      }

      btn.textContent = 'Already in Cart';

      btn.addEventListener(
        'click',
        function (event) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return false;
        },
        true
      );
    });

    var singleForm = document.querySelector('.single-product form.cart');
    if (singleForm) {
      var qty = singleForm.querySelector('input.qty');
      if (qty) {
        qty.disabled = true;
      }
    }
  }

  function bindLiveSingleQuantityCtaSync() {
    if (document.body.dataset.shoshinSingleQtySyncBound === '1') return;

    if (window.jQuery) {
      window.jQuery(document.body).on('added_to_cart', function (event, fragments, cartHash, $button) {
        var source = $button && $button.length ? $button[0] : null;
        var productId = '';

        if (source) {
          productId =
            source.getAttribute('data-product_id') ||
            source.getAttribute('value') ||
            '';
        }

        if (!productId) {
          var singleForm = document.querySelector('.single-product form.cart');
          if (singleForm) {
            var hiddenAdd = singleForm.querySelector('[name="add-to-cart"]');
            if (hiddenAdd) {
              productId = hiddenAdd.value || '';
            }
          }
        }

        disableLiveSingleQuantityCtas(productId);
      });
    } else {
      document.body.addEventListener('added_to_cart', function (event) {
        var trigger = event.target;
        if (!trigger) return;

        var productId =
          trigger.getAttribute('data-product_id') ||
          trigger.getAttribute('value') ||
          '';

        if (!productId) {
          var singleForm = document.querySelector('.single-product form.cart');
          if (singleForm) {
            var hiddenAdd = singleForm.querySelector('[name="add-to-cart"]');
            if (hiddenAdd) {
              productId = hiddenAdd.value || '';
            }
          }
        }

        disableLiveSingleQuantityCtas(productId);
      });
    }

    document.body.dataset.shoshinSingleQtySyncBound = '1';
  }

  function applyAllCartEnhancements(root) {
    structureClassicMainColumn();
    applyBlocksCartMetaEnhancements(root);
    applyClassicCartEnhancements(root);
    relocateClassicCoupon();
    structureClassicSidebarCards();
    relabelClassicCartEstimatedTotal();
    toggleClassicExpressCardForZeroTotal();
    toggleClassicCartPodOnlyShippingUi();
  }

  function initShoshinCartEnhancements() {
    restoreCartScrollPosition();
    window.addEventListener('pageshow', restoreCartScrollPosition);
    window.addEventListener('load', restoreCartScrollPosition);
    window.setTimeout(restoreCartScrollPosition, 120);

    applyAllCartEnhancements(document);
    bindClassicCartRemoveAjax();
    bindLiveSingleQuantityCtaSync();

    /* EXPRESS GATING DISABLED FOR TESTING
    if (window.jQuery && document.body.dataset.shoshinCartExpressGateBound !== '1') {
      window.jQuery(document.body).on('change', 'input.shipping_method', function () {
        window.setTimeout(syncClassicCartExpressGate, 0);
        window.setTimeout(syncClassicCartExpressGate, 250);
      });

      window.jQuery(document.body).on('updated_cart_totals updated_wc_div', function () {
        syncClassicCartExpressGate();
      });

      document.body.dataset.shoshinCartExpressGateBound = '1';
    }
    */

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

  /* =========================================================
   * SHOSHIN — BOOT
   * ======================================================= */

  function init() {
    initShoshinCartEnhancements();
  }

  whenReady(init);
})();

  (function () {
  'use strict';

  /* =========================================================
   * SHOSHIN — CLASSIC CHECKOUT SHELL
   * Stable architecture:
   * - build structure once
   * - sync dynamic state repeatedly
   * - keep checkout shell self-contained (no leaked globals)
   * ======================================================= */

  var shoshinClassicCheckoutReconcileTimer = null;

  function isClassicCheckoutPage() {
    return document.body.classList.contains('woocommerce-checkout');
  }

  function getClassicCheckoutForm() {
    return document.querySelector('form.checkout.woocommerce-checkout');
  }

  function getClassicOrderReview() {
    return document.querySelector('#order_review');
  }

  function buildClassicCheckoutShell() {
    if (!isClassicCheckoutPage()) return;

    var form = getClassicCheckoutForm();
    if (!form) return;

    var orderReview = getClassicOrderReview();
    if (!orderReview) return;

    var existingShell = form.querySelector(':scope > .shoshin-checkout-shell');
    if (existingShell) {
      return;
    }

    form.classList.remove('shoshin-checkout-ready');

    var customerDetails = document.querySelector('#customer_details');
    var col1 = customerDetails ? customerDetails.querySelector('.col-1') : null;
    var col2 = customerDetails ? customerDetails.querySelector('.col-2') : null;

    var contact = document.querySelector('#contact_details');
    var accountFields = document.querySelector('.woocommerce-account-fields');

    var billing =
      (col1 && col1.querySelector('.woocommerce-billing-fields:not(#contact_details)')) ||
      document.querySelector('.col-1 .woocommerce-billing-fields:last-of-type');

    var shipping = document.querySelector('.woocommerce-shipping-fields');
    var notes = document.querySelector('.woocommerce-additional-fields');
    var payment = document.querySelector('#payment');
    var orderHeading = document.querySelector('#order_review_heading');

    var expressPrimary = document.querySelector('#wc-stripe-express-checkout-element');
    var expressWcPay = document.querySelector('.wcpay-express-checkout-wrapper');
    var expressPayPal = document.querySelector('.ppc-button-wrapper');
    var expressRecaptcha = document.querySelector('#ppcp-recaptcha-v2-container');
    var stripeExpressSeparator = document.querySelector(
      '#wc-stripe-express-checkout-button-separator'
    );

    function isSafeToMove(el) {
      if (!el) return false;
      if (el === form) return false;
      if (el.contains(form)) return false;
      return true;
    }

    function moveNode(node, target) {
      if (!node || !target) return;
      target.appendChild(node);
    }

    function createCard(className, headingText) {
      var card = document.createElement('div');
      card.className = 'shoshin-card ' + className;

      if (headingText) {
        var heading = document.createElement('h3');
        heading.className = 'shoshin-checkout-card-heading';
        heading.textContent = headingText;
        card.appendChild(heading);
      }

      return card;
    }

    function wrapCard(el, className, headingText) {
      if (!el || !isSafeToMove(el)) return null;

      var card = createCard(className, headingText);
      moveNode(el, card);
      return card;
    }

    var shell = document.createElement('div');
    shell.className = 'shoshin-checkout-shell';

    var main = document.createElement('div');
    main.className = 'shoshin-checkout-main';

    var sidebar = document.createElement('div');
    sidebar.className = 'shoshin-checkout-sidebar';

    /* EXPRESS */
var expressCard = createCard('card-express');

/*
  Always create the express card so late-mounted gateways
  have a stable destination container.
*/

/*
  Move any wallet containers that already exist (best case: BEFORE iframes render).
*/
if (isSafeToMove(expressPrimary)) moveNode(expressPrimary, expressCard);
if (isSafeToMove(expressWcPay)) moveNode(expressWcPay, expressCard);
if (isSafeToMove(expressPayPal)) moveNode(expressPayPal, expressCard);
if (isSafeToMove(expressRecaptcha)) moveNode(expressRecaptcha, expressCard);
if (isSafeToMove(stripeExpressSeparator)) moveNode(stripeExpressSeparator, expressCard);

main.appendChild(expressCard);


    /* CONTACT + ACCOUNT CREATION */
    if (contact) {
      var contactCard = wrapCard(contact, 'card-contact');
      if (contactCard) {
        if (accountFields && isSafeToMove(accountFields)) {
          contactCard.appendChild(accountFields);
        }
        main.appendChild(contactCard);
      }
    }

    /* SHIPPING */
    if (shipping) {
      var shippingCard = wrapCard(shipping, 'card-shipping');
      if (shippingCard) main.appendChild(shippingCard);
    }

    /* BILLING */
    if (billing) {
      var billingCard = wrapCard(billing, 'card-billing');
      if (billingCard) main.appendChild(billingCard);
    }

    /* NOTES */
    if (notes) {
      var notesCard = wrapCard(notes, 'card-notes');
      if (notesCard) main.appendChild(notesCard);
    }

    /* PAYMENT — keep native block intact */
    if (payment) {
      var paymentCard = createCard('card-payment', 'Payment Options');
      moveNode(payment, paymentCard);
      main.appendChild(paymentCard);
    }

    /* SIDEBAR — keep native order review intact */
    var sidebarCard = createCard('card-order-summary');

    if (orderHeading) {
      orderHeading.textContent = 'Order Summary';
      moveNode(orderHeading, sidebarCard);
    }

    if (orderReview) moveNode(orderReview, sidebarCard);

    sidebar.appendChild(sidebarCard);

    shell.appendChild(main);
    shell.appendChild(sidebar);
    form.prepend(shell);

    if (col1) col1.style.display = 'none';
    if (col2) col2.style.display = 'none';
    if (customerDetails) customerDetails.style.display = 'none';

    form.classList.add('shoshin-checkout-ready');
  }

  function syncClassicCheckoutCoreNodes() {
  if (!isClassicCheckoutPage()) return;

  var form = getClassicCheckoutForm();
  if (!form) return;

  var shell = form.querySelector('.shoshin-checkout-shell');
  if (!shell) return;

  var main = shell.querySelector('.shoshin-checkout-main');
  var sidebar = shell.querySelector('.shoshin-checkout-sidebar');

  var paymentCard = main ? main.querySelector('.card-payment') : null;
  var sidebarCard = sidebar ? sidebar.querySelector('.card-order-summary') : null;

  var payment = document.querySelector('#payment');
  var orderHeading = document.querySelector('#order_review_heading');
  var orderReview = document.querySelector('#order_review');

  if (payment && paymentCard && !paymentCard.contains(payment)) {
    paymentCard.appendChild(payment);
  }

  if (orderHeading && sidebarCard && !sidebarCard.contains(orderHeading)) {
    sidebarCard.insertBefore(orderHeading, sidebarCard.firstChild);
  }

  if (orderReview && sidebarCard && !sidebarCard.contains(orderReview)) {
    sidebarCard.appendChild(orderReview);
  }
}

  function hydrateClassicCheckoutExpressCard() {
    if (!isClassicCheckoutPage()) return;

    var form = getClassicCheckoutForm();
    if (!form) return;

    var expressCard = form.querySelector('.card-express');
    if (!expressCard) return;

    var lateMountSelectors = [
      '#wc-stripe-express-checkout-element',
      '.wcpay-express-checkout-wrapper',
      '.ppc-button-wrapper',
      '#ppcp-recaptcha-v2-container',
      '#wc-stripe-express-checkout-button-separator'
    ];

    lateMountSelectors.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (node) {
if (!node) return;

/*
  If the node is already inside the express card, do nothing.
  This prevents repeated remove+insert cycles.
*/
if (expressCard.contains(node)) {
  node.dataset.shoshinMounted = '1';
  return;
}

/*
  If we already marked it mounted, allow a “recovery move” only when it’s NOT in the card.
  This helps when other code or fragment updates displaced the node.
*/
if (node.dataset.shoshinMounted === '1') {
  expressCard.appendChild(node);
  return;
}

/*
  First-time move into the card.
*/
expressCard.appendChild(node);
node.dataset.shoshinMounted = '1';

/*
  Ensure the card is visible now that it has content.
*/
expressCard.style.display = '';
      });
    });

    expressCard
      .querySelectorAll('.ppc-button-wrapper > [id^="ppc-button-"]')
      .forEach(function (gateway) {
        var visibleFrame = gateway.querySelector('iframe.component-frame.visible');
        if (!visibleFrame) return;

        if (gateway.id !== 'ppc-button-ppcp-card-button-gateway') {
          gateway.style.display = 'block';
        }

        gateway.querySelectorAll('.paypal-buttons').forEach(function (buttonsWrap) {
          var frame = buttonsWrap.querySelector('iframe.component-frame.visible');
          if (!frame) return;

          var frameHeight = Math.ceil(
            frame.getBoundingClientRect().height || frame.offsetHeight || 0
          );

          if (frameHeight > 0) {
            buttonsWrap.style.height = frameHeight + 'px';
          }
        });
      });

    window.dispatchEvent(new Event('resize'));
  }

  function renderClassicCheckoutReviewItems() {
    if (!isClassicCheckoutPage()) return;

    var orderReview = getClassicOrderReview();
    var reviewTable = orderReview ? orderReview.querySelector('table.shop_table') : null;
    var tbody = reviewTable ? reviewTable.querySelector('tbody') : null;

    if (!orderReview || !reviewTable || !tbody) return;

    var rows = Array.from(tbody.querySelectorAll('tr.cart_item'));
    var existing = orderReview.querySelector(':scope > .shoshin-checkout-review-items');

    if (!rows.length) {
      if (existing) existing.remove();
      orderReview.classList.remove('shoshin-review-items-enhanced');
      return;
    }

    var itemsWrap = existing || document.createElement('div');
    itemsWrap.className = 'shoshin-checkout-review-items';
    itemsWrap.innerHTML = '';

    rows.forEach(function (row) {
      var nameCell = row.querySelector('td.product-name');
      var totalCell = row.querySelector('td.product-total');
      if (!nameCell || !totalCell) return;

var nameClone = nameCell.cloneNode(true);
nameClone
  .querySelectorAll(
    'strong.product-quantity, .product-quantity, dl.variation, .variation, .wc-item-meta, .shoshin-cart-meta-value'
  )
  .forEach(function (el) {
    el.remove();
  });

var nameHtml = nameClone.innerHTML.trim();
      var totalHtml = totalCell.innerHTML.trim();

      var itemRow = document.createElement('div');
      itemRow.className = 'shoshin-checkout-review-row';
      itemRow.innerHTML =
        '<div class="shoshin-checkout-review-row__name">' +
        nameHtml +
        '</div>' +
        '<div class="shoshin-checkout-review-row__total">' +
        totalHtml +
        '</div>';

      itemsWrap.appendChild(itemRow);
    });

    if (!existing) {
      orderReview.insertBefore(itemsWrap, reviewTable);
    }

    orderReview.classList.add('shoshin-review-items-enhanced');
  }

  function relocateClassicCheckoutCoupon() {
    if (!isClassicCheckoutPage()) return;

    var checkoutForm = getClassicCheckoutForm();
    var orderReview = getClassicOrderReview();
    var reviewTable = orderReview ? orderReview.querySelector('table.shop_table') : null;
    var couponForm =
      document.getElementById('woocommerce-checkout-form-coupon') ||
      document.querySelector('form.checkout_coupon.woocommerce-form-coupon');
    var couponToggle = document.querySelector('.woocommerce-form-coupon-toggle');
    var subtotalRow = reviewTable ? reviewTable.querySelector('tfoot .cart-subtotal') : null;

    if (!checkoutForm || !orderReview || !reviewTable || !subtotalRow) return;

    if (couponToggle) {
      couponToggle.style.display = 'none';
    }

    var nativeInput = null;
    var nativeButton = null;

    if (couponForm) {
      couponForm.style.display = 'none';
      nativeInput = couponForm.querySelector('input[name="coupon_code"]');
      nativeButton = couponForm.querySelector('button[name="apply_coupon"]');
    }

    var panelRow = reviewTable.querySelector('tfoot .shoshin-checkout-coupon-row');
    if (!panelRow) {
      panelRow = document.createElement('tr');
      panelRow.className = 'shoshin-checkout-coupon-row';
      panelRow.innerHTML =
        '<td colspan="2">' +
          '<div class="shoshin-checkout-coupon-panel">' +
            '<div class="shoshin-checkout-coupon-toggle" role="button" tabindex="0" aria-expanded="false">' +
              '<span class="shoshin-checkout-coupon-toggle__label">Add coupons</span>' +
              '<span class="shoshin-checkout-coupon-toggle__icon" aria-hidden="true">⌵</span>' +
            '</div>' +
            '<div class="shoshin-checkout-coupon-panel__body" hidden>' +
              '<div class="shoshin-checkout-coupon-ui">' +
                '<p class="form-row form-row-first">' +
                  '<label class="screen-reader-text" for="shoshin_checkout_coupon_code">Coupon:</label>' +
                  '<input type="text" class="input-text" placeholder="Coupon code" id="shoshin_checkout_coupon_code" value="">' +
                '</p>' +
                '<p class="form-row form-row-last">' +
                  '<button type="button" class="button" id="shoshin_checkout_apply_coupon">Apply</button>' +
                '</p>' +
                '<div class="clear"></div>' +
              '</div>' +
              '<div class="shoshin-checkout-coupon-feedback" aria-live="polite"></div>' +
            '</div>' +
          '</div>' +
        '</td>';

      subtotalRow.parentNode.insertBefore(panelRow, subtotalRow);
    }

    var panel = panelRow.querySelector('.shoshin-checkout-coupon-panel');
    var toggle = panelRow.querySelector('.shoshin-checkout-coupon-toggle');
    var body = panelRow.querySelector('.shoshin-checkout-coupon-panel__body');
    var uiInput = panelRow.querySelector('#shoshin_checkout_coupon_code');
    var uiButton = panelRow.querySelector('#shoshin_checkout_apply_coupon');
    var feedback = panelRow.querySelector('.shoshin-checkout-coupon-feedback');

    if (!panel || !toggle || !body || !uiInput || !uiButton || !feedback) return;

    function setOpen(open) {
      panel.classList.toggle('is-open', !!open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      body.hidden = !open;
    }

    function syncButtonState() {
      var code = (uiInput.value || '').trim();
      var loading = panel.dataset.shoshinCouponLoading === '1';
      var disabled = !code || loading;

      uiButton.disabled = disabled;
      uiButton.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }

    function moveCouponNotices() {
      if (!feedback) return false;

      var foundAny = false;

      var notices = document.querySelectorAll(
        '.woocommerce-notices-wrapper .woocommerce-error,' +
        '.woocommerce-notices-wrapper .woocommerce-message,' +
        '.woocommerce-notices-wrapper .woocommerce-info,' +
        '.woocommerce-message,' +
        '.woocommerce-info,' +
        '.woocommerce-error'
      );

      notices.forEach(function (notice) {
        if (!notice || !notice.parentNode) return;
        if (feedback.contains(notice)) {
          foundAny = true;
          return;
        }

        if (
          notice.closest('.woocommerce-form-coupon-toggle') ||
          notice.classList.contains('showcoupon') ||
          notice.querySelector('.showcoupon') ||
          notice.closest('.shoshin-checkout-coupon-feedback')
        ) {
          return;
        }

        var txt = (notice.textContent || '').trim();
        if (!/coupon/i.test(txt)) return;

        feedback.innerHTML = '';
        feedback.appendChild(notice);
        foundAny = true;
      });

      document.querySelectorAll('.woocommerce-notices-wrapper').forEach(function (wrapper) {
        if (!wrapper.children.length) {
          wrapper.style.display = 'none';
        }
      });

      return foundAny || feedback.children.length > 0;
    }

    function renderCouponNoticesFromDoc(doc) {
      if (!feedback) return false;

      feedback.innerHTML = '';

      var foundNotice = null;
      var notices = doc.querySelectorAll(
        '.woocommerce-notices-wrapper .woocommerce-error,' +
        '.woocommerce-notices-wrapper .woocommerce-message,' +
        '.woocommerce-notices-wrapper .woocommerce-info,' +
        '.woocommerce-message,' +
        '.woocommerce-info,' +
        '.woocommerce-error'
      );

      notices.forEach(function (notice) {
        if (foundNotice) return;

        if (
          notice.closest('.woocommerce-form-coupon-toggle') ||
          notice.classList.contains('showcoupon') ||
          notice.querySelector('.showcoupon')
        ) {
          return;
        }

        var txt = (notice.textContent || '').trim();
        if (!/coupon/i.test(txt)) return;

        foundNotice = notice.cloneNode(true);
      });

      if (foundNotice) {
        feedback.appendChild(foundNotice);
        return true;
      }

      return false;
    }

    function rescanCouponNotices() {
      var found = moveCouponNotices();
      if (found) {
        setOpen(true);
      }
      return found;
    }

    async function applyCheckoutCouponAjax() {
      if (!couponForm || !nativeInput || !nativeButton) return;

      var code = (uiInput.value || '').trim();
      if (!code) return;

      if (panel.dataset.shoshinCouponLoading === '1') return;
      panel.dataset.shoshinCouponLoading = '1';
      syncButtonState();

      feedback.innerHTML = '';
      setOpen(true);

      nativeInput.value = code;

      var formData = new FormData(couponForm);
      formData.set('coupon_code', code);
      formData.set('apply_coupon', 'Apply');

      try {
        var response = await fetch(couponForm.getAttribute('action') || window.location.href, {
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

        var hadCouponNotice = renderCouponNoticesFromDoc(doc);

        if (hadCouponNotice) {
          setOpen(true);
        }

        if (window.jQuery) {
          window.jQuery(document.body).trigger('update_checkout');
        }

        window.setTimeout(function () {
          moveCouponNotices();
        }, 120);

        window.setTimeout(function () {
          moveCouponNotices();
        }, 320);
      } catch (error) {
        feedback.innerHTML =
          '<ul class="woocommerce-error" role="alert"><li>Unable to apply coupon right now. Please try again.</li></ul>';
        setOpen(true);
      } finally {
        delete panel.dataset.shoshinCouponLoading;
        syncButtonState();
      }
    }

    if (toggle && toggle.dataset.shoshinBound !== '1') {
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

    if (uiInput && uiInput.dataset.shoshinBound !== '1') {
      uiInput.dataset.shoshinBound = '1';

      uiInput.addEventListener('input', function () {
        if (nativeInput) {
          nativeInput.value = uiInput.value;
        }
        syncButtonState();
      });

      uiInput.addEventListener('change', syncButtonState);

      uiInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          applyCheckoutCouponAjax();
        }
      });
    }

    if (uiButton && uiButton.dataset.shoshinBound !== '1') {
      uiButton.dataset.shoshinBound = '1';

      uiButton.addEventListener('click', function (event) {
        event.preventDefault();
        applyCheckoutCouponAjax();
      });
    }

    uiInput.value = nativeInput ? (nativeInput.value || '') : '';
    syncButtonState();

    if (!rescanCouponNotices()) {
      setOpen(false);
    }

    window.setTimeout(rescanCouponNotices, 50);
    window.setTimeout(rescanCouponNotices, 250);
  }

  function syncClassicCheckoutAddressSections() {
    if (!isClassicCheckoutPage()) return;

    var shippingCard = document.querySelector('.shoshin-checkout-main .card-shipping');
    var billingCard = document.querySelector('.shoshin-checkout-main .card-billing');
    var shippingFields = shippingCard
      ? shippingCard.querySelector('.woocommerce-shipping-fields')
      : null;
    var shippingAddress = shippingFields
      ? shippingFields.querySelector('.shipping_address')
      : null;
    var nativeHeading = shippingFields
      ? shippingFields.querySelector('#ship-to-different-address')
      : null;
    var nativeCheckbox = shippingFields
      ? shippingFields.querySelector('#ship-to-different-address-checkbox')
      : null;

    if (!shippingCard || !billingCard || !shippingFields || !shippingAddress) {
      return;
    }

    var cardHeading = shippingCard.querySelector(':scope > .shoshin-checkout-card-heading');
    if (!cardHeading) {
      cardHeading = document.createElement('h3');
      cardHeading.className = 'shoshin-checkout-card-heading';
      shippingCard.insertBefore(cardHeading, shippingCard.firstChild);
    }
    cardHeading.textContent = 'Shipping Details';

    if (nativeCheckbox && !nativeCheckbox.checked) {
      nativeCheckbox.checked = true;
      nativeCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (nativeHeading) {
      nativeHeading.style.display = 'none';
    }

    shippingAddress.style.display = '';

    var billingToggle = shippingFields.querySelector('#shoshin_use_same_billing');
    var billingToggleWrap = shippingFields.querySelector('.shoshin-billing-sync-toggle');

    if (!billingToggleWrap) {
      billingToggleWrap = document.createElement('div');
      billingToggleWrap.className = 'shoshin-billing-sync-toggle';
      billingToggleWrap.innerHTML =
        '<label class="shoshin-billing-sync-toggle__label" for="shoshin_use_same_billing">' +
          '<input type="checkbox" id="shoshin_use_same_billing" class="shoshin-billing-sync-toggle__input" checked="checked" />' +
          '<span>Use same address for billing</span>' +
        '</label>';

      shippingAddress.insertAdjacentElement('afterend', billingToggleWrap);
      billingToggle = billingToggleWrap.querySelector('#shoshin_use_same_billing');
    }

    function copyField(shippingName, billingName) {
      var shippingField = document.querySelector('[name="' + shippingName + '"]');
      var billingField = document.querySelector('[name="' + billingName + '"]');
      if (!shippingField || !billingField) return;

      var shippingValue = shippingField.value == null ? '' : shippingField.value;
      if (billingField.value !== shippingValue) {
        billingField.value = shippingValue;
        billingField.dispatchEvent(new Event('input', { bubbles: true }));
        billingField.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    function syncBillingFromShipping() {
      if (!billingToggle || !billingToggle.checked) return;

      copyField('shipping_first_name', 'billing_first_name');
      copyField('shipping_last_name', 'billing_last_name');
      copyField('shipping_company', 'billing_company');
      copyField('shipping_country', 'billing_country');
      copyField('shipping_address_1', 'billing_address_1');
      copyField('shipping_address_2', 'billing_address_2');
      copyField('shipping_city', 'billing_city');
      copyField('shipping_state', 'billing_state');
      copyField('shipping_postcode', 'billing_postcode');
      copyField('shipping_phone', 'billing_phone');
    }

    function syncBillingVisibility() {
      var sameBilling = !!(billingToggle && billingToggle.checked);
      billingCard.style.display = sameBilling ? 'none' : '';
      shippingCard.classList.toggle('is-billing-synced', sameBilling);

      if (sameBilling) {
        syncBillingFromShipping();
      }
    }

    if (billingToggle && billingToggle.dataset.shoshinBound !== '1') {
      billingToggle.dataset.shoshinBound = '1';

      billingToggle.addEventListener('change', function () {
        syncBillingVisibility();
      });
    }

    shippingFields
      .querySelectorAll(
        'input[name^="shipping_"], select[name^="shipping_"], textarea[name^="shipping_"]'
      )
      .forEach(function (field) {
        if (field.dataset.shoshinBillingMirrorBound === '1') return;
        field.dataset.shoshinBillingMirrorBound = '1';

        field.addEventListener('input', syncBillingFromShipping);
        field.addEventListener('change', syncBillingFromShipping);
      });

    syncBillingVisibility();
  }

    function syncClassicCheckoutNotesHeading() {
    if (!isClassicCheckoutPage()) return;

    var notesCard = document.querySelector('.shoshin-checkout-main .card-notes');
    if (!notesCard) return;

    var additionalFields = notesCard.querySelector('.woocommerce-additional-fields');
    if (!additionalFields) return;

    var nativeHeading = additionalFields.querySelector(':scope > h3');
    if (!nativeHeading) {
      nativeHeading = document.createElement('h3');
      additionalFields.insertBefore(nativeHeading, additionalFields.firstChild);
    }

    nativeHeading.textContent = 'Additional Information';
    nativeHeading.style.display = '';
  }

  function syncClassicCheckoutPaymentHeading() {
    if (!isClassicCheckoutPage()) return;

    var paymentCard = document.querySelector('.shoshin-checkout-main .card-payment');
    if (!paymentCard) return;

    var payment = paymentCard.querySelector('#payment');
    if (!payment) return;

    var heading = paymentCard.querySelector(':scope > .shoshin-checkout-card-heading');
    if (!heading) {
      heading = document.createElement('h3');
      heading.className = 'shoshin-checkout-card-heading';
      paymentCard.insertBefore(heading, paymentCard.firstChild);
    }

    var visibleMethods = Array.from(
      payment.querySelectorAll('ul.payment_methods > li')
    ).filter(function (item) {
      return item.offsetParent !== null;
    });

    heading.textContent = visibleMethods.length ? 'Payment Options' : 'Acknowledgement';
  }

  function syncClassicCheckoutAcknowledgementSection() {
    if (!isClassicCheckoutPage()) return;

    var paymentCard = document.querySelector('.shoshin-checkout-main .card-payment');
    if (!paymentCard) return;

    var payment = paymentCard.querySelector('#payment');
    if (!payment) return;

    var paymentMethods = payment.querySelector('ul.payment_methods');
    var placeOrderRow = payment.querySelector('.form-row.place-order');
    if (!paymentMethods || !placeOrderRow) return;

    var termsWrap = placeOrderRow.querySelector('.woocommerce-terms-and-conditions-wrapper');
    if (!termsWrap) return;

    var heading = placeOrderRow.querySelector(':scope > .shoshin-acknowledgements-heading');
    if (!heading) {
      heading = document.createElement('div');
      heading.className = 'shoshin-acknowledgements-heading';
      heading.textContent = 'Acknowledgement';
      placeOrderRow.insertBefore(heading, termsWrap);
    }

    var batchRow = placeOrderRow.querySelector('.shoshin-classic-batch-ack-row');
    var termsRow = placeOrderRow.querySelector('p.form-row.validate-required');

    if (batchRow && termsRow && batchRow !== termsRow.nextElementSibling) {
      termsRow.insertAdjacentElement('afterend', batchRow);
    }
  }

    function toggleClassicCheckoutExpressCardForZeroTotal() {
    if (!isClassicCheckoutPage()) return;

    var expressCard = document.querySelector('.shoshin-checkout-main .card-express');
    if (!expressCard) return;

    var totalCell = document.querySelector(
      '#order_review .order-total td .woocommerce-Price-amount, ' +
      '#order_review .order-total td .amount'
    );

    if (!totalCell) {
      expressCard.style.display = '';
      return;
    }

    var raw = (totalCell.textContent || '').replace(/[^0-9.,-]/g, '').trim();
    var normalized = raw.replace(/,/g, '');
    var totalValue = parseFloat(normalized);

    if (!isNaN(totalValue) && totalValue <= 0) {
      expressCard.style.display = 'none';
    } else {
      expressCard.style.display = '';
    }
  }

function toggleClassicCheckoutShippingCardForNoShipping() {
  if (!isClassicCheckoutPage()) return;

  var shippingCard = document.querySelector('.shoshin-checkout-main .card-shipping');
  if (!shippingCard) return;

  var shippingAddressFields = shippingCard.querySelector(
    '.shipping_address .woocommerce-shipping-fields__field-wrapper'
  );

  // If the shipping address fields exist in the card, keep the card visible.
  // Guests often won't have shipping methods/totals yet on initial load.
  if (shippingAddressFields) {
    shippingCard.style.display = '';
    return;
  }

  // Only hide if the shipping form fields are truly absent.
  shippingCard.style.display = 'none';
}

function dedupeClassicCheckoutZoneMatchNotices() {
  if (!isClassicCheckoutPage()) return;

  var updateGroup = document.querySelector('.woocommerce-NoticeGroup-updateOrderReview');
  if (!updateGroup) return;

  var liveTexts = Array.from(
    updateGroup.querySelectorAll('.woocommerce-info, .woocommerce-message')
  )
    .map(function (el) {
      return (el.textContent || '').replace(/\s+/g, ' ').trim();
    })
    .filter(function (txt) {
      return /customer matched zone/i.test(txt);
    });

  if (!liveTexts.length) return;

  document
    .querySelectorAll(
      '.page-content > .woocommerce > .woocommerce-info, ' +
      '.page-content > .woocommerce > .woocommerce-message, ' +
      'form.checkout.woocommerce-checkout > .woocommerce-info, ' +
      'form.checkout.woocommerce-checkout > .woocommerce-message'
    )
    .forEach(function (notice) {
      var txt = (notice.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/customer matched zone/i.test(txt)) return;
      if (liveTexts.indexOf(txt) === -1) return;

      notice.remove();
    });
}

  function syncClassicCheckoutPaymentMethods() {
    if (!isClassicCheckoutPage()) return;

    var paymentCard = document.querySelector('.shoshin-checkout-main .card-payment');
    if (!paymentCard) return;

    var hiddenGateway = paymentCard.querySelector(
      '#payment_method_ppcp-card-button-gateway'
    );
    var stripeGateway = paymentCard.querySelector('#payment_method_stripe');
    var paypalGateway = paymentCard.querySelector('#payment_method_ppcp-gateway');

    if (!hiddenGateway) return;

    var hiddenItem = hiddenGateway.closest('li');
    if (hiddenItem) {
      hiddenItem.style.display = 'none';
    }

    if (hiddenGateway.checked) {
      if (stripeGateway) {
        stripeGateway.checked = true;
        stripeGateway.dispatchEvent(new Event('change', { bubbles: true }));
        stripeGateway.dispatchEvent(new Event('click', { bubbles: true }));
      } else if (paypalGateway) {
        paypalGateway.checked = true;
        paypalGateway.dispatchEvent(new Event('change', { bubbles: true }));
        paypalGateway.dispatchEvent(new Event('click', { bubbles: true }));
      }
    }
  }

function reconcileClassicCheckoutShell() {
  buildClassicCheckoutShell();
  syncClassicCheckoutCoreNodes();
  hydrateClassicCheckoutExpressCard();
  renderClassicCheckoutReviewItems();
  relocateClassicCheckoutCoupon();
  syncClassicCheckoutAddressSections();
  toggleClassicCheckoutShippingCardForNoShipping();
  syncClassicCheckoutNotesHeading();
  syncClassicCheckoutPaymentHeading();
  syncClassicCheckoutAcknowledgementSection();
  dedupeClassicCheckoutZoneMatchNotices();
  syncClassicCheckoutPaymentMethods();
  toggleClassicCheckoutExpressCardForZeroTotal();
}

  function scheduleClassicCheckoutReconcile(delay) {
    window.clearTimeout(shoshinClassicCheckoutReconcileTimer);

    shoshinClassicCheckoutReconcileTimer = window.setTimeout(function () {
      reconcileClassicCheckoutShell();
    }, typeof delay === 'number' ? delay : 0);
  }


function initClassicCheckoutShell() {
  reconcileClassicCheckoutShell();

  // Single delayed stabilization pass only
  window.setTimeout(reconcileClassicCheckoutShell, 300);
}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initClassicCheckoutShell);
  } else {
    initClassicCheckoutShell();
  }

jQuery(document.body).on('updated_checkout', function () {
  /*
    After Woo replaces checkout fragments, re-seat the fresh native nodes
    into the existing shell, then re-bind address mirroring and run the
    lighter sync helpers.
  */
  window.setTimeout(function () {
    syncClassicCheckoutCoreNodes();
    hydrateClassicCheckoutExpressCard();
    renderClassicCheckoutReviewItems();
    relocateClassicCheckoutCoupon();
    syncClassicCheckoutPaymentHeading();
    syncClassicCheckoutAcknowledgementSection();
    dedupeClassicCheckoutZoneMatchNotices();
    syncClassicCheckoutPaymentMethods();
    toggleClassicCheckoutShippingCardForNoShipping();
    toggleClassicCheckoutExpressCardForZeroTotal();
  }, 0);

  window.setTimeout(function () {
    syncClassicCheckoutAddressSections();
    hydrateClassicCheckoutExpressCard();
    syncClassicCheckoutPaymentMethods();
    toggleClassicCheckoutExpressCardForZeroTotal();
  }, 350);

  window.setTimeout(function () {
    hydrateClassicCheckoutExpressCard();
    syncClassicCheckoutPaymentMethods();
    toggleClassicCheckoutExpressCardForZeroTotal();
  }, 900);
});


})();

