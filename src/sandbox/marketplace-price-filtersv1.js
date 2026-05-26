(function () {
  console.log('SHOSHIN price filter JS loaded');

  var MIN_LIMIT = 0;
  var MAX_LIMIT = 1000;
  var STEP = 10;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function snap(value) {
    return Math.round(value / STEP) * STEP;
  }

  function parseMoney(value, fallback) {
    var cleaned = String(value || '').replace(/[^\d]/g, '');
    if (!cleaned) return fallback;
    var num = parseInt(cleaned, 10);
    return Number.isNaN(num) ? fallback : num;
  }

  function getWrap(el) {
    return el ? el.closest('[data-price-filter]') : document.querySelector('[data-price-filter]');
  }

  function getParts(wrap) {
    if (!wrap) return null;

    var sliderMin = wrap.querySelector('#shoshin-price-range-min');
    var sliderMax = wrap.querySelector('#shoshin-price-range-max');
    var inputMin  = wrap.querySelector('#shoshin-price-min');
    var inputMax  = wrap.querySelector('#shoshin-price-max');
    var applyBtn  = wrap.querySelector('#shoshin-price-apply');
    var clearBtn  = wrap.querySelector('#shoshin-price-clear');
    var rangeFill = wrap.querySelector('#shoshin-price-range-fill');

    if (!sliderMin || !sliderMax || !inputMin || !inputMax || !applyBtn || !clearBtn || !rangeFill) {
      return null;
    }

    return {
      wrap: wrap,
      sliderMin: sliderMin,
      sliderMax: sliderMax,
      inputMin: inputMin,
      inputMax: inputMax,
      applyBtn: applyBtn,
      clearBtn: clearBtn,
      rangeFill: rangeFill
    };
  }

  function paintRange(parts, minVal, maxVal) {
    var minPercent = ((minVal - MIN_LIMIT) / (MAX_LIMIT - MIN_LIMIT)) * 100;
    var maxPercent = ((maxVal - MIN_LIMIT) / (MAX_LIMIT - MIN_LIMIT)) * 100;

    parts.rangeFill.style.left = minPercent + '%';
    parts.rangeFill.style.width = (maxPercent - minPercent) + '%';
  }

  function syncFromSliders(parts, source) {
    var minVal = clamp(snap(parseInt(parts.sliderMin.value, 10) || MIN_LIMIT), MIN_LIMIT, MAX_LIMIT);
    var maxVal = clamp(snap(parseInt(parts.sliderMax.value, 10) || MAX_LIMIT), MIN_LIMIT, MAX_LIMIT);

    if (minVal > maxVal) {
      if (source === 'min') {
        maxVal = minVal;
        parts.sliderMax.value = String(maxVal);
      } else {
        minVal = maxVal;
        parts.sliderMin.value = String(minVal);
      }
    }

    parts.inputMin.value = String(minVal);
    parts.inputMax.value = String(maxVal);
    paintRange(parts, minVal, maxVal);
  }

  function syncFromInputs(parts, source) {
    var minVal = clamp(snap(parseMoney(parts.inputMin.value, MIN_LIMIT)), MIN_LIMIT, MAX_LIMIT);
    var maxVal = clamp(snap(parseMoney(parts.inputMax.value, MAX_LIMIT)), MIN_LIMIT, MAX_LIMIT);

    if (minVal > maxVal) {
      if (source === 'min') {
        maxVal = minVal;
      } else {
        minVal = maxVal;
      }
    }

    parts.sliderMin.value = String(minVal);
    parts.sliderMax.value = String(maxVal);
    parts.inputMin.value = String(minVal);
    parts.inputMax.value = String(maxVal);
    paintRange(parts, minVal, maxVal);
  }

function applyPriceFilter(parts) {
  var url = new URL(window.location.href);
  var minVal = clamp(snap(parseMoney(parts.inputMin.value, MIN_LIMIT)), MIN_LIMIT, MAX_LIMIT);
  var maxVal = clamp(snap(parseMoney(parts.inputMax.value, MAX_LIMIT)), MIN_LIMIT, MAX_LIMIT);

  if (minVal > maxVal) maxVal = minVal;

  var isDefaultRange = (minVal === MIN_LIMIT && maxVal === MAX_LIMIT);

  if (isDefaultRange) {
    url.searchParams.delete('min_price');
    url.searchParams.delete('max_price');
  } else {
    url.searchParams.set('min_price', String(minVal));
    url.searchParams.set('max_price', String(maxVal));
  }

  url.searchParams.delete('paged');

  applyPriceFilterAjax(url.toString());
}

function applyPriceFilterFromSliders(parts) {
  var url = new URL(window.location.href);
  var minVal = clamp(snap(parseMoney(parts.inputMin.value, MIN_LIMIT)), MIN_LIMIT, MAX_LIMIT);
  var maxVal = clamp(snap(parseMoney(parts.inputMax.value, MAX_LIMIT)), MIN_LIMIT, MAX_LIMIT);

  if (minVal > maxVal) maxVal = minVal;

  var isDefaultRange = (minVal === MIN_LIMIT && maxVal === MAX_LIMIT);

  if (isDefaultRange) {
    url.searchParams.delete('min_price');
    url.searchParams.delete('max_price');
  } else {
    url.searchParams.set('min_price', String(minVal));
    url.searchParams.set('max_price', String(maxVal));
  }

  url.searchParams.delete('paged');

  applyPriceFilterAjax(url.toString());
}

function clearPriceFilter() {

  var url = new URL(window.location.href);

  /* parameters we want to keep */
  var allowedParams = ['orderby', 's'];

  /* remove everything else */
  var params = Array.from(url.searchParams.keys());

  params.forEach(function(param){
    if (!allowedParams.includes(param)) {
      url.searchParams.delete(param);
    }
  });

  window.location.href = url.toString();

}

function applyPriceFilterAjax(url) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

  xhr.onload = function () {
    if (xhr.status < 200 || xhr.status >= 300) {
      window.location.href = url;
      return;
    }

    var parser = new DOMParser();
    var doc = parser.parseFromString(xhr.responseText, 'text/html');

    /* Replace main product/archive content */
    var currentProducts = document.querySelector('.products');
    var newProducts = doc.querySelector('.products');

    if (currentProducts && newProducts) {
      currentProducts.innerHTML = newProducts.innerHTML;
    } else {
      window.location.href = url;
      return;
    }

    /* Replace result count if present */
    var currentResultCount = document.querySelector('.woocommerce-result-count');
    var newResultCount = doc.querySelector('.woocommerce-result-count');
    if (currentResultCount && newResultCount) {
      currentResultCount.innerHTML = newResultCount.innerHTML;
    }

    /* Replace ordering UI if present */
    var currentOrdering = document.querySelector('.woocommerce-ordering');
    var newOrdering = doc.querySelector('.woocommerce-ordering');
    if (currentOrdering && newOrdering) {
      currentOrdering.innerHTML = newOrdering.innerHTML;
    }

    /* Replace pagination if present */
    var currentPagination = document.querySelector('.woocommerce-pagination');
    var newPagination = doc.querySelector('.woocommerce-pagination');
    if (currentPagination && newPagination) {
      currentPagination.innerHTML = newPagination.innerHTML;
    } else if (currentPagination && !newPagination) {
      currentPagination.remove();
    }

    history.pushState({}, '', url);
    toggleClearFiltersVisibility();
  };

  xhr.onerror = function () {
    window.location.href = url;
  };

  xhr.send();
}

function toggleClearFiltersVisibility() {
  var clearBtn = document.querySelector('#shoshin-price-clear');
  if (!clearBtn) return;

  var url = new URL(window.location.href);

  var ignoredParams = ['orderby', 's', 'paged'];
  var hasActiveFilters = false;

  var minParam = url.searchParams.get('min_price');
  var maxParam = url.searchParams.get('max_price');

  var hasMinParam = (minParam !== null && minParam !== '');
  var hasMaxParam = (maxParam !== null && maxParam !== '');

  var minIsDefault = !hasMinParam || Number(minParam) === Number(MIN_LIMIT);
  var maxIsDefault = !hasMaxParam || Number(maxParam) === Number(MAX_LIMIT);
  var priceRangeIsDefault = minIsDefault && maxIsDefault;

  url.searchParams.forEach(function (value, key) {
    if (ignoredParams.includes(key) || value === '') return;

    if ((key === 'min_price' || key === 'max_price') && priceRangeIsDefault) {
      return;
    }

    hasActiveFilters = true;
  });

  var checkedFilters = document.querySelectorAll(
    '.wpc-filters-section input[type="checkbox"]:checked, ' +
    '.wpc-filters-section input[type="radio"]:checked'
  );

  if (checkedFilters.length > 0) {
    hasActiveFilters = true;
  }

  clearBtn.style.display = hasActiveFilters ? 'inline-block' : 'none';
}

function initPriceFilter() {
  var wrap = document.querySelector('[data-price-filter]');
  var parts = getParts(wrap);
  if (!parts) return;

  var currentUrl = new URL(window.location.href);
  var urlMin = currentUrl.searchParams.get('min_price');
  var urlMax = currentUrl.searchParams.get('max_price');

  var startMin = MIN_LIMIT;
  var startMax = MAX_LIMIT;

  if (urlMin !== null && urlMin !== '') {
    startMin = clamp(snap(parseMoney(urlMin, MIN_LIMIT)), MIN_LIMIT, MAX_LIMIT);
  }

  if (urlMax !== null && urlMax !== '') {
    startMax = clamp(snap(parseMoney(urlMax, MAX_LIMIT)), MIN_LIMIT, MAX_LIMIT);
  }

  if (startMin > startMax) {
    startMax = startMin;
  }

  /* force both slider handles to the URL values */
  parts.sliderMin.value = String(startMin);
  parts.sliderMax.value = String(startMax);

  /* force both text boxes to the same values */
  parts.inputMin.value = String(startMin);
  parts.inputMax.value = String(startMax);

  /* force the visual range bar to match */
  paintRange(parts, startMin, startMax);

  toggleClearFiltersVisibility();
}

  document.addEventListener('DOMContentLoaded', initPriceFilter);
  window.addEventListener('load', initPriceFilter);
  window.addEventListener('pageshow', initPriceFilter);

  document.addEventListener('input', function (e) {
    var target = e.target;
    var wrap = getWrap(target);
    var parts = getParts(wrap);

    if (parts) {
      if (target.id === 'shoshin-price-range-min') {
        syncFromSliders(parts, 'min');
      }

      if (target.id === 'shoshin-price-range-max') {
        syncFromSliders(parts, 'max');
      }
    }

    toggleClearFiltersVisibility();
  });

  document.addEventListener('mouseup', function (e) {
  var target = e.target;
  var wrap = getWrap(target);
  var parts = getParts(wrap);
  if (!parts) return;

  if (
    target.id === 'shoshin-price-range-min' ||
    target.id === 'shoshin-price-range-max'
  ) {
    applyPriceFilterFromSliders(parts);
  }
});

document.addEventListener('touchend', function (e) {
  var target = e.target;
  var wrap = getWrap(target);
  var parts = getParts(wrap);
  if (!parts) return;

  if (
    target.id === 'shoshin-price-range-min' ||
    target.id === 'shoshin-price-range-max'
  ) {
    applyPriceFilterFromSliders(parts);
  }
});

  document.addEventListener('change', function (e) {
    var target = e.target;
    var wrap = getWrap(target);
    var parts = getParts(wrap);

    if (parts) {
      if (target.id === 'shoshin-price-min') {
        syncFromInputs(parts, 'min');
      }

      if (target.id === 'shoshin-price-max') {
        syncFromInputs(parts, 'max');
      }
    }

    toggleClearFiltersVisibility();
  });

  document.addEventListener('blur', function (e) {
    var target = e.target;
    var wrap = getWrap(target);
    var parts = getParts(wrap);
    if (!parts) return;

    if (target.id === 'shoshin-price-min') {
      syncFromInputs(parts, 'min');
    }

    if (target.id === 'shoshin-price-max') {
      syncFromInputs(parts, 'max');
    }
  }, true);

  document.addEventListener('keydown', function (e) {
    var target = e.target;
    var wrap = getWrap(target);
    var parts = getParts(wrap);
    if (!parts) return;

    if (e.key === 'Enter' && target.id === 'shoshin-price-min') {
      syncFromInputs(parts, 'min');
      applyPriceFilter(parts);
    }

    if (e.key === 'Enter' && target.id === 'shoshin-price-max') {
      syncFromInputs(parts, 'max');
      applyPriceFilter(parts);
    }
  });

  document.addEventListener('click', function (e) {
    var applyBtn = e.target.closest('#shoshin-price-apply');
    var clearBtn = e.target.closest('#shoshin-price-clear');

    if (applyBtn) {
      var wrap = getWrap(applyBtn);
      var parts = getParts(wrap);
      if (parts) {
        e.preventDefault();
        applyPriceFilter(parts);
      }
    }

    if (clearBtn) {
      e.preventDefault();
      clearPriceFilter();
    }

    toggleClearFiltersVisibility();
  });

function injectNoResultsMessage() {
  var slotContainer = document.querySelector('.shoshin-products-slot');
  if (!slotContainer) return;

  var archiveSlot =
    slotContainer.querySelector('.e-con-inner') ||
    slotContainer;

  var existingMessage = archiveSlot.querySelector('.shoshin-no-results-message-js');
  var archive = document.querySelector('.shoshin-products-archive');
  var productCards = archive ? archive.querySelectorAll('li.product') : [];

  var shouldShow = productCards.length === 0;

  if (shouldShow && !existingMessage) {
    var msg = document.createElement('div');
    msg.className = 'shoshin-no-results-message shoshin-no-results-message-js';
    msg.innerHTML =
      '<h3>No products match your current filters.</h3>' +
      '<p>Try widening your price range or clearing one or more filters.</p>';

    archiveSlot.appendChild(msg);
  }

  if (!shouldShow && existingMessage) {
    existingMessage.remove();
  }
}

  document.addEventListener('DOMContentLoaded', injectNoResultsMessage);
  window.addEventListener('load', injectNoResultsMessage);

var shoshinNoResultsObserver = new MutationObserver(function () {
  initPriceFilter();
  injectNoResultsMessage();
  toggleClearFiltersVisibility();
});

  shoshinNoResultsObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

    document.addEventListener('mouseup', function (e) {
    var target = e.target;
    var wrap = getWrap(target);
    var parts = getParts(wrap);
    if (!parts) return;

    if (
      target.id === 'shoshin-price-range-min' ||
      target.id === 'shoshin-price-range-max'
    ) {
      applyPriceFilterFromSliders(parts);
    }
  });

  document.addEventListener('touchend', function (e) {
    var target = e.target;
    var wrap = getWrap(target);
    var parts = getParts(wrap);
    if (!parts) return;

    if (
      target.id === 'shoshin-price-range-min' ||
      target.id === 'shoshin-price-range-max'
    ) {
      applyPriceFilterFromSliders(parts);
    }
  });

})();