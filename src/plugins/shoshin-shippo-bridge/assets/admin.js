jQuery(function ($) {
  'use strict';

  var state = {
  selectedRateId: '',
  selectedRateLabel: '',
  selectedRateAmount: '',
  selectedRateAmountRaw: '',
  selectedRateCurrency: '',
  selectedRateProvider: '',
  selectedRateProviderImage: '',
  ratesLoaded: false,
  allRates: [],
  visibleRates: [],
  rateFilterCarrier: 'all',
  rateSortMode: 'cheapest',
  selectedAddonsByRateId: {},
    insuranceEnabled: false,
    rateAdjustments: {},
  shipmentState: (window.SSB_Admin && window.SSB_Admin.shipment_state) || 'none',
  hasPurchasedLabel: !!((window.SSB_Admin && window.SSB_Admin.has_purchased_label) || false),
  fulfillmentGroups: (window.SSB_Admin && window.SSB_Admin.fulfillment_groups) || null,
  activeShipmentNumber: 1,
  lastRateRequestSignature: '',
  autoRatesTimer: null,
  ratesLoading: false,
  labelFileType: 'PDF_4x6'
};

  function getBox() { return $('#ssb-shippo-box'); }
  function getCard() { return $('#ssb-shipping-label-card'); }
  function getCardBody() { return $('#ssb-shipping-label-body'); }
  function getCardToggle() { return $('#ssb-card-toggle'); }
  function getOrderId() { return parseInt((window.SSB_Admin && window.SSB_Admin.order_id) || 0, 10) || 0; }
  function getNonce() { return (window.SSB_Admin && window.SSB_Admin.nonce) || ''; }
  function getStrings() { return (window.SSB_Admin && window.SSB_Admin.strings) || {}; }

    function getFulfillmentGroups() {
    var groups = state.fulfillmentGroups;
    return groups && groups.groups ? groups : { groups: [] };
  }

  function getImmediateGroup() {
    var groups = getFulfillmentGroups().groups || [];

    for (var i = 0; i < groups.length; i++) {
      if (groups[i] && groups[i].group_key === 'immediate') {
        return groups[i];
      }
    }

    return null;
  }

  function getImmediateShipments() {
    var group = getImmediateGroup();
    return group && $.isArray(group.shipments) ? group.shipments : [];
  }

  function hasUnassignedItems() {
    var group = getImmediateGroup();

    if (!group || !$.isArray(group.items)) {
      return false;
    }

    return group.items.some(function (item) {
      return (parseInt(item.unassigned_qty || 0, 10) || 0) > 0;
    });
  }

  function isUnassignedTabActive() {
    return String(state.activeShipmentNumber || '') === 'unassigned';
  }

  function getActiveShipment() {
    var shipments = getImmediateShipments();

    if (isUnassignedTabActive()) {
      return null;
    }

    for (var i = 0; i < shipments.length; i++) {
      if ((parseInt(shipments[i].shipment_number, 10) || 0) === (parseInt(state.activeShipmentNumber, 10) || 0)) {
        return shipments[i];
      }
    }

    return null;
  }

  function normalizeActiveShipmentNumber(candidate) {
    var shipments = getImmediateShipments();
    var unassignedPresent = hasUnassignedItems();
    var parsedCandidate = String(candidate || '');

    if (!shipments.length) {
      return unassignedPresent ? 'unassigned' : 1;
    }

    if (parsedCandidate === 'unassigned') {
      return unassignedPresent ? 'unassigned' : (parseInt(shipments[0].shipment_number, 10) || 1);
    }

    var numericCandidate = parseInt(parsedCandidate, 10) || 0;

    if (numericCandidate > 0) {
      for (var i = 0; i < shipments.length; i++) {
        if ((parseInt(shipments[i].shipment_number, 10) || 0) === numericCandidate) {
          return numericCandidate;
        }
      }
    }

    return unassignedPresent ? 'unassigned' : (parseInt(shipments[0].shipment_number, 10) || 1);
  }

  function setActiveShipmentNumber(candidate) {
    state.activeShipmentNumber = normalizeActiveShipmentNumber(candidate);
    return state.activeShipmentNumber;
  }

  function getShipmentAllocationQty(shipment, orderItemId) {
    var allocations = shipment && $.isArray(shipment.allocations) ? shipment.allocations : [];

    for (var i = 0; i < allocations.length; i++) {
      if (parseInt(allocations[i].order_item_id || 0, 10) === parseInt(orderItemId || 0, 10)) {
        return parseInt(allocations[i].qty || 0, 10) || 0;
      }
    }

    return 0;
  }

  function renderAllocationPanel() {
    var $panel = $('#ssb-allocation-panel');
    var group = getImmediateGroup();
    var shipments = getImmediateShipments();
    var activeShipment = getActiveShipment();
    var unassignedTabActive = isUnassignedTabActive();
    var itemStateMap = {};
    var hasAnyUnassigned = hasUnassignedItems();
    var singleShipment = shipments.length <= 1;
    var visibleRowCount = 0;

    if (!$panel.length || !group || !$.isArray(group.items)) {
      return;
    }

    group.items.forEach(function (item) {
      var orderItemId = parseInt(item.order_item_id || 0, 10) || 0;

      if (!orderItemId) {
        return;
      }

      itemStateMap[orderItemId] = {
        qtyOrdered: parseInt(item.qty_ordered || 0, 10) || 0,
        unassignedQty: parseInt(item.unassigned_qty || 0, 10) || 0
      };
    });

    $panel.find('tbody tr[data-order-item-id]').each(function () {
      var $row = $(this);
      var orderItemId = parseInt($row.attr('data-order-item-id') || '0', 10) || 0;
      var itemState = itemStateMap[orderItemId] || { qtyOrdered: 0, unassignedQty: 0 };
      var thisShipmentQty = 0;
      var allocatedElsewhere = 0;
      var unassignedQty = itemState.unassignedQty;
      var actionText = '';
      var actionDisabled = false;
      var actionReason = '';

      shipments.forEach(function (shipment) {
        var shipmentQty = getShipmentAllocationQty(shipment, orderItemId);

        if (!unassignedTabActive && activeShipment && parseInt(shipment.shipment_number || 0, 10) === parseInt(activeShipment.shipment_number || 0, 10)) {
          thisShipmentQty = shipmentQty;
          return;
        }

        allocatedElsewhere += shipmentQty;
      });

      if (unassignedTabActive) {
        thisShipmentQty = unassignedQty;
        actionText = 'Allocate';
        actionDisabled = unassignedQty < 1;
      } else {
        actionText = 'Remove';
        actionDisabled = thisShipmentQty < 1;

        if (!actionDisabled && activeShipment && shipmentHasAnyLabels(activeShipment)) {
          actionDisabled = true;
          actionReason = 'This shipment must be voided before allocations can be changed.';
        }

        if (!actionDisabled && singleShipment && !hasAnyUnassigned && parseInt(activeShipment && activeShipment.shipment_number || 0, 10) === 1) {
          actionDisabled = true;
          actionReason = 'Allocation removal is disabled in the default single-shipment state.';
        }
      }

      $row.attr('data-qty-ordered', itemState.qtyOrdered);
      $row.find('.ssb-allocation-col-on-order').text(itemState.qtyOrdered);
      $row.find('.ssb-allocation-col-allocated .ssb-allocation-input-allocated').val(thisShipmentQty);
      $row.find('.ssb-allocation-col-other-shipment').text(allocatedElsewhere);
      $row.find('.ssb-allocation-col-unassigned').text(unassignedQty);

      var $action = $row.find('.ssb-allocation-row-action');
      $action
        .text(actionText)
        .prop('disabled', actionDisabled)
        .attr('data-order-item-id', orderItemId)
        .attr('data-max-qty', thisShipmentQty)
        .attr('data-unassigned-qty', unassignedQty)
        .toggleClass('is-disabled', actionDisabled);

      if (actionReason) {
        $action.attr('title', actionReason);
      } else {
        $action.removeAttr('title');
      }

      if (thisShipmentQty > 0) {
        $row.show();
        visibleRowCount++;
      } else {
        $row.hide();
      }
    });

    $('#ssb-edit-allocation').prop('disabled', singleShipment && !hasUnassignedItems());

    var $empty = $('#ssb-allocation-empty-state');
    if (!$empty.length) {
      $panel.find('tbody').after(
        '<div id="ssb-allocation-empty-state" class="ssb-package-helper" style="display:none; margin-top:12px;">No items are currently allocated to this view.</div>'
      );
      $empty = $('#ssb-allocation-empty-state');
    }

    if (visibleRowCount === 0) {
      $panel.find('.ssb-allocation-panel__table-wrap').hide();
      $empty.show();
    } else {
      $panel.find('.ssb-allocation-panel__table-wrap').show();
      $empty.hide();
    }
  }

    function ensureActiveShipmentWorkspaceState() {
    var shipment = getActiveShipment();

    if (!shipment) {
      return null;
    }

    if (!shipment.parcel || typeof shipment.parcel !== 'object') {
      shipment.parcel = {};
    }

    if (!shipment.draft || typeof shipment.draft !== 'object') {
      shipment.draft = {};
    }

    if (!$.isArray(shipment.draft.rates)) {
      shipment.draft.rates = [];
    }

    return shipment;
  }

  function saveParcelToActiveShipmentState() {
    var shipment = ensureActiveShipmentWorkspaceState();
    var parcel;

    if (!shipment) {
      return;
    }

    parcel = collectParcel();

    shipment.parcel = $.extend({}, shipment.parcel || {}, {
      weight: parcel.weight,
      length: parcel.length,
      width: parcel.width,
      height: parcel.height
    });
  }

  function saveSelectedRateToActiveShipmentState() {
    var shipment = ensureActiveShipmentWorkspaceState();

    if (!shipment) {
      return;
    }

    shipment.draft.selected_rate_id = state.selectedRateId || '';
  }

  function saveRatesToActiveShipmentState(data) {
    var shipment = ensureActiveShipmentWorkspaceState();

    if (!shipment) {
      return;
    }

    shipment.draft.shipment_id = (data && data.shipment_id) ? data.shipment_id : '';
    shipment.draft.rates = (data && $.isArray(data.rates)) ? data.rates.slice() : [];
    shipment.draft.selected_rate_id = state.selectedRateId || '';
    shipment.draft.updated_at = new Date().toISOString();
  }

  function resetWorkspaceSelectionState() {
    state.selectedRateId = '';
    state.selectedRateLabel = '';
    state.selectedRateAmount = '';
    state.selectedRateAmountRaw = '';
    state.selectedRateCurrency = '';
    state.selectedRateProvider = '';
    state.selectedRateProviderImage = '';
    state.ratesLoaded = false;
    state.allRates = [];
    state.visibleRates = [];
  }

  function hydrateWorkspaceForActiveShipment() {
    var shipment = ensureActiveShipmentWorkspaceState();
    var parcel, draft, selectedRate;

    if (isUnassignedTabActive()) {
      resetWorkspaceSelectionState();
      clearFeedback();
      clearWorkspaceBanner();
      $('#ssb-processing-banner').hide();
      clearLiveShipmentMetaDisplay();
      $('#ssb-post-purchase-actions').hide();
      $('#ssb-tracking-section').hide();
      $('#ssb_shippo_weight').val('');
      $('#ssb_shippo_length').val('');
      $('#ssb_shippo_width').val('');
      $('#ssb_shippo_height').val('');
      $('#ssb-meta-shipment-id').text('—');
      $('#ssb-sidebar-shipment-id').text('—');
      $('#ssb-sidebar-selected-service').text('—');
      $('#ssb-sidebar-selected-rate').text('—');
      $('#ssb-sidebar-declared-value').text('—');
      $('#ssb-sidebar-included-coverage').text('—');
      $('#ssb-sidebar-additional-coverage').text('—');
      $('#ssb-sidebar-insurance-charge').text('—');
      $('#ssb-sidebar-purchase-label').prop('disabled', true).addClass('is-disabled');
      $('#ssb-shippo-rates').html('<p class="description">Unassigned items must be moved into a shipment before rates or labels can be generated.</p>');
      updateSidebarPackageSummary();
      updateGetRatesState();
      return;
    }

    if (!shipment) {
      return;
    }

    parcel = shipment.parcel || {};
    draft = shipment.draft || {};

    $('#ssb_shippo_weight').val(parcel.weight || '');
    $('#ssb_shippo_length').val(parcel.length || '');
    $('#ssb_shippo_width').val(parcel.width || '');
    $('#ssb_shippo_height').val(parcel.height || '');

    resetWorkspaceSelectionState();
    clearFeedback();
    clearWorkspaceBanner();
    $('#ssb-processing-banner').hide();

    clearLiveShipmentMetaDisplay();
    $('#ssb-post-purchase-actions').hide();
    $('#ssb-tracking-section').hide();

    state.allRates = $.isArray(draft.rates) ? draft.rates.slice() : [];
    state.visibleRates = state.allRates.slice();
    state.selectedRateId = draft.selected_rate_id || '';
    state.ratesLoaded = state.allRates.length > 0;

    if (draft.shipment_id) {
      $('#ssb-meta-shipment-id').text(draft.shipment_id);
      $('#ssb-sidebar-shipment-id').text(draft.shipment_id);
    }

    updateSidebarPackageSummary();
    updateGetRatesState();
    renderRates(state.allRates);

    if (state.selectedRateId) {
      selectedRate = null;

      (state.allRates || []).some(function (rate) {
        if ((rate.rate_id || '') === state.selectedRateId) {
          selectedRate = rate;
          return true;
        }
        return false;
      });

      if (selectedRate) {
        applySelectedRateState(selectedRate);
      }
    } else {
      $('#ssb-sidebar-selected-service').text('—');
      $('#ssb-sidebar-selected-rate').text('—');
      $('#ssb-sidebar-declared-value').text('—');
      $('#ssb-sidebar-included-coverage').text('—');
      $('#ssb-sidebar-additional-coverage').text('—');
      $('#ssb-sidebar-insurance-charge').text('—');
      $('#ssb-sidebar-purchase-label').prop('disabled', true).addClass('is-disabled');
    }
  }

  function shipmentHasAnyLabels(shipment) {
    var fulfillment = shipment && shipment.fulfillment ? shipment.fulfillment : {};
    var labels = $.isArray(fulfillment.labels) ? fulfillment.labels : [];
    var returnLabels = $.isArray(fulfillment.return_labels) ? fulfillment.return_labels : [];
    return labels.length > 0 || returnLabels.length > 0;
  }

  function shipmentCanSplit() {
    var group = getImmediateGroup();
    var activeShipment = getActiveShipment();
    var allocations = activeShipment && $.isArray(activeShipment.allocations) ? activeShipment.allocations : [];

    if (!group || isUnassignedTabActive()) {
      return false;
    }

    if (!allocations.length || shipmentHasAnyLabels(activeShipment)) {
      return false;
    }

    if (allocations.length > 1) {
      return true;
    }

    return allocations.some(function (allocation) {
      return parseInt(allocation.qty || 0, 10) > 1;
    });
  }

  function renderShipmentShell() {
    var shipments = getImmediateShipments();
    var $shell = $('#ssb-shipment-shell');
    var $tabs = $('#ssb-shipment-tabs');
    var $remove = $('#ssb-remove-shipment');
    var $split = $('#ssb-split-shipment-trigger');
    var unassignedPresent = hasUnassignedItems();

    if (!$shell.length) {
      return;
    }

    if (!shipments.length) {
      $shell.hide();
      return;
    }

    $shell.show();
    setActiveShipmentNumber(state.activeShipmentNumber);

    var html = '';
    var shipmentCount = shipments.length;

    if (unassignedPresent) {
      html += '<button type="button" class="ssb-shipment-tab' + (isUnassignedTabActive() ? ' is-active' : '') + '" data-shipment-number="unassigned" aria-pressed="' + (isUnassignedTabActive() ? 'true' : 'false') + '">Unassigned</button>';
    }

    shipments.forEach(function (shipment, index) {
      var shipmentNumber = parseInt(shipment.shipment_number, 10) || (index + 1);
      var isActive = !isUnassignedTabActive() && shipmentNumber === (parseInt(state.activeShipmentNumber, 10) || 0);
      var activeClass = isActive ? ' is-active' : '';
      html += '<button type="button" class="ssb-shipment-tab' + activeClass + '" data-shipment-number="' + shipmentNumber + '" aria-pressed="' + (isActive ? 'true' : 'false') + '">Shipment ' + shipmentNumber + '/' + shipmentCount + '</button>';
    });

    $tabs.html(html).show();

    if (isUnassignedTabActive()) {
      $split.text('Create Shipment').show();
    } else if (shipmentCanSplit()) {
      $split.text('Split Shipment').show();
    } else {
      $split.hide();
    }

    if (!isUnassignedTabActive() && shipments.length > 1 && (parseInt(state.activeShipmentNumber, 10) || 0) > 1) {
      $remove.show();
    } else {
      $remove.hide();
    }
  }

  function buildSplitRowHtml(row) {
    var rowClass = 'ssb-split-row ssb-split-row--' + row.row_type;
    var isParentRow = row.row_type === 'parent';
    var isChildRow = row.row_type === 'child';
    var toggleControl = isParentRow
      ? '<button type="button" class="ssb-split-row__toggle" data-order-item-id="' + row.order_item_id + '">▾</button>'
      : '<span class="ssb-split-row__toggle-placeholder" aria-hidden="true"></span>';
    var checkboxValue = row.order_item_id + ':' + row.unit_index;
    var checkboxHtml = isParentRow
      ? '<input type="checkbox" class="ssb-split-parent-check" data-order-item-id="' + row.order_item_id + '">'
      : '<input type="checkbox" class="ssb-split-unit-check" value="' + checkboxValue + '">';

    return ''
      + '<tr class="' + rowClass + '" data-order-item-id="' + row.order_item_id + '" data-row-type="' + row.row_type + '"' + (isChildRow ? ' style="display:none;"' : '') + '>'
      +   '<td class="ssb-split-row__select">' + checkboxHtml + '</td>'
      +   '<td>'
      +     '<div class="ssb-split-product">'
      +       '<span class="ssb-split-row__toggle-slot">' + toggleControl + '</span>'
      +       '<span class="ssb-split-product__thumb">' + (row.thumbnail_html || '') + '</span>'
      +       '<span class="ssb-split-product__name">' + escapeHtml(row.product_name || '') + '</span>'
      +     '</div>'
      +   '</td>'
      +   '<td>' + escapeHtml(row.qty_label || '') + '</td>'
      +   '<td>' + escapeHtml(row.variation || '—') + '</td>'
      +   '<td>' + escapeHtml(row.weight || '—') + '</td>'
      +   '<td>' + (row.price_html || '—') + '</td>'
      + '</tr>';
  }

  function refreshSplitShipmentSelectionUi() {
    var checkedCount = $('.ssb-split-unit-check:checked').length;
    var totalUnits = $('.ssb-split-unit-check').length;

    $('#ssb-split-shipment-selected-count').text(checkedCount + ' selected');
    $('#ssb-split-shipment-create').prop('disabled', checkedCount < 1);
    $('#ssb-split-shipment-master-toggle').prop('checked', totalUnits > 0 && checkedCount === totalUnits);

    $('.ssb-split-parent-check').each(function () {
      var $parent = $(this);
      var orderItemId = String($parent.attr('data-order-item-id') || '');
      var $children = $('.ssb-split-row--child[data-order-item-id="' + orderItemId + '"] .ssb-split-unit-check');
      var checkedChildren = $children.filter(':checked').length;
      var totalChildren = $children.length;

      $parent.prop('checked', totalChildren > 0 && checkedChildren === totalChildren);
    });
  }

function openSplitShipmentModal() {
  var $modal = $('#ssb-split-shipment-modal');
  var $rows = $('#ssb-split-shipment-rows');
  var $title = $('#ssb-split-shipment-title');
  var sourceShipmentNumber = String(state.activeShipmentNumber || '');
  var isUnassignedSource = (sourceShipmentNumber === 'unassigned');

  if (!sourceShipmentNumber) {
    setFeedback('Select a valid shipment before continuing.', 'error');
    return;
  }

  if ($title.length) {
    $title.text(isUnassignedSource ? 'Create Shipment' : 'Split Shipment');
  }

  $modal.attr('data-source-shipment-number', sourceShipmentNumber);

  $rows.html(
    '<tr class="ssb-split-shipment-loading-row">' +
      '<td colspan="6" style="padding:16px; text-align:center;">Loading available items…</td>' +
    '</tr>'
  );

  $('#ssb-split-shipment-master-toggle').prop('checked', false);
  $('#ssb-split-shipment-selected-count').text('Loading...');
  $('#ssb-split-shipment-create')
    .text('Create Shipment')
    .prop('disabled', true);

  $modal.show();
  $('body').addClass('ssb-modal-open');

  $.ajax({
    url: window.SSB_Admin.ajax_url,
    method: 'POST',
    dataType: 'json',
    data: {
      action: 'ssb_get_split_candidates',
      nonce: getNonce(),
      order_id: getOrderId(),
      active_shipment_number: sourceShipmentNumber
    }
  }).done(function (response) {
    if (!response || !response.success || !response.data || !$.isArray(response.data.rows)) {
      $rows.html(
        '<tr>' +
          '<td colspan="6" style="padding:16px; text-align:center;">Unable to load shipment items.</td>' +
        '</tr>'
      );
      setFeedback((response && response.data && response.data.message) ? response.data.message : 'Unable to load shipment items.', 'error');
      $('#ssb-split-shipment-selected-count').text('0 selected');
      return;
    }

    var html = '';
    response.data.rows.forEach(function (row) {
      html += buildSplitRowHtml(row);
    });

    $rows.html(html);
    refreshSplitShipmentSelectionUi();
  }).fail(function () {
    $rows.html(
      '<tr>' +
        '<td colspan="6" style="padding:16px; text-align:center;">Unable to load shipment items.</td>' +
      '</tr>'
    );
    $('#ssb-split-shipment-selected-count').text('0 selected');
    setFeedback('Unable to load shipment items.', 'error');
  });
}

  function closeSplitShipmentModal() {
    $('#ssb-split-shipment-modal')
      .hide()
      .removeAttr('data-source-shipment-number');

    $('body').removeClass('ssb-modal-open');
    $('#ssb-split-shipment-rows').empty();
    $('#ssb-split-shipment-master-toggle').prop('checked', false);
    $('#ssb-split-shipment-selected-count').text('0 selected');
    $('#ssb-split-shipment-create').prop('disabled', true);
  }

  function openAllocationModal(mode, orderItemId, maxQty) {
    var $modal = $('#ssb-allocation-action-modal');
    var shipments = getImmediateShipments();
    var activeShipment = getActiveShipment();
    var optionsHtml = '';

    if (!$modal.length) {
      return;
    }

    $('#ssb-allocation-action-order-item-id').val(orderItemId);
    $('#ssb-allocation-action-mode').val(mode);
    $('#ssb-allocation-action-max-qty').val(maxQty);
    $('#ssb-allocation-action-qty').val(1).attr('max', maxQty);
    $('#ssb-allocation-action-qty-help').text('Available: ' + maxQty);

    if (mode === 'allocate') {
      $('#ssb-allocation-action-title').text('Allocate item');
      $('#ssb-allocation-action-confirm').text('Allocate');
      $('#ssb-allocation-action-target-row').show();

      shipments.forEach(function (shipment) {
        if (shipmentHasAnyLabels(shipment)) {
          return;
        }

        var shipmentNumber = parseInt(shipment.shipment_number || 0, 10) || 0;
        if (shipmentNumber > 0) {
          optionsHtml += '<option value="' + shipmentNumber + '">Shipment ' + shipmentNumber + '</option>';
        }
      });

      optionsHtml += '<option value="new">Create new shipment</option>';
      $('#ssb-allocation-action-target').html(optionsHtml);
    } else {
      $('#ssb-allocation-action-title').text('Remove allocation');
      $('#ssb-allocation-action-confirm').text('Remove allocation');
      $('#ssb-allocation-action-target-row').hide();
    }

    if (activeShipment && !isUnassignedTabActive()) {
      $('#ssb-allocation-action-source-shipment').val(parseInt(activeShipment.shipment_number || 0, 10) || 1);
    } else {
      $('#ssb-allocation-action-source-shipment').val('');
    }

    $modal.show();
  }

  function closeAllocationModal() {
    $('#ssb-allocation-action-modal').hide();
    $('#ssb-allocation-action-order-item-id').val('');
    $('#ssb-allocation-action-mode').val('');
    $('#ssb-allocation-action-max-qty').val('');
    $('#ssb-allocation-action-qty').val('1');
    $('#ssb-allocation-action-source-shipment').val('');
    $('#ssb-allocation-action-target').empty();
  }

  function openSplitUnsavedModal() {
    $('#ssb-split-shipment-unsaved-modal').show();
  }

  function closeSplitUnsavedModal() {
    $('#ssb-split-shipment-unsaved-modal').hide();
  }

  function getSelectedLabelFileType() {
    var value = $.trim($('#ssb_shippo_label_file_type').val() || '');
    if (value !== 'PDF_4x6' && value !== 'PDF') {
      value = 'PDF_4x6';
    }
    return value;
  }

  function setFeedback(message, type) {
    var $feedback = $('#ssb-shippo-feedback');
    if (!$feedback.length) return;

    $feedback
      .removeClass('ssb-feedback--error ssb-feedback--success ssb-feedback--info ssb-feedback--warning')
      .addClass('ssb-feedback--' + (type || 'info'))
      .html(message)
      .show();
  }

  function clearFeedback() {
    var $feedback = $('#ssb-shippo-feedback');
    if (!$feedback.length) return;

    $feedback.hide().html('').removeClass('ssb-feedback--error ssb-feedback--success ssb-feedback--info ssb-feedback--warning');
  }

    function ensureForceRefreshControl() {
    if ($('#ssb-force-refresh-wrap').length) return;

    var $button = $('#ssb-shippo-get-rates');
    if (!$button.length) return;

    $button.after(
      '<label id="ssb-force-refresh-wrap" style="display:none; margin-top:8px;">' +
        '<input type="checkbox" id="ssb-force-refresh"> ' +
        'Refresh Carriers' +
      '</label>'
    );
  }

  function syncForceRefreshVisibility() {
    ensureForceRefreshControl();

    $.ajax({
      url: window.SSB_Admin.ajax_url,
      method: 'POST',
      dataType: 'json',
      data: {
        action: 'ssb_get_rate_cache_setting',
        nonce: getNonce(),
        order_id: getOrderId()
      }
    }).done(function (response) {
      if (response && response.success && response.data && response.data.enabled) {
        $('#ssb-force-refresh-wrap').show();
      } else {
        $('#ssb-force-refresh-wrap').hide();
      }
    }).fail(function () {
      $('#ssb-force-refresh-wrap').hide();
    });
  }

    function loadRateAdjustments() {
    $.ajax({
      url: window.SSB_Admin.ajax_url,
      method: 'POST',
      dataType: 'json',
      data: {
        action: 'ssb_get_rate_adjustment_settings',
        nonce: getNonce(),
        order_id: getOrderId()
      }
    }).done(function (response) {
      if (response && response.success && response.data && response.data.adjustments) {
        state.rateAdjustments = response.data.adjustments || {};
      } else {
        state.rateAdjustments = {};
      }
    }).fail(function () {
      state.rateAdjustments = {};
    });
  }

    function applyRatesFeedback(response, isAuto) {
    var strings = getStrings();
    var data = (response && response.data) ? response.data : {};
    var rates = (data && data.rates) ? data.rates : [];
    var rateNotice = (data && data.rate_notice && data.rate_notice.message) ? $.trim(data.rate_notice.message) : '';

    if (rateNotice) {
      setFeedback(rateNotice, 'warning');
      return;
    }

    if (!rates || !rates.length) {
      setFeedback(strings.no_rates || 'No rates found.', 'info');
      return;
    }

    clearFeedback();
  }

    function clearWorkspaceBanner() {
  $('#ssb-success-banner')
    .stop(true, true)
    .hide()
    .empty()
    .removeAttr('style')
    .removeClass('ssb-is-cleared');
}

  function setLoading($button, isLoading, loadingText, normalText) {
    if (!$button || !$button.length) return;

    if (isLoading) {
      $button.data('ssb-original-text', $button.text());
      $button.prop('disabled', true).addClass('is-busy').text(loadingText || 'Loading...');
      return;
    }

    $button.prop('disabled', false).removeClass('is-busy').text(
      normalText || $button.data('ssb-original-text') || $button.text()
    );
  }

  function collectParcel() {
    return {
      weight: $.trim($('#ssb_shippo_weight').val() || ''),
      length: $.trim($('#ssb_shippo_length').val() || ''),
      width: $.trim($('#ssb_shippo_width').val() || ''),
      height: $.trim($('#ssb_shippo_height').val() || '')
    };
  }

  function parcelSignature(parcel) {
    return [parcel.weight, parcel.length, parcel.width, parcel.height].join('|');
  }

  function validateParcel(parcel) {
    if (!parcel.weight || !parcel.length || !parcel.width || !parcel.height) {
      return 'Parcel weight, length, width, and height are all required.';
    }
    return '';
  }

  function isValidParcel(parcel) {
    return validateParcel(parcel) === '';
  }

  function getShippableItemQuantity() {
    var raw = $.trim($('#ssb-sidebar-item-count').text() || '0');
    var count = parseInt(raw, 10);
    return isNaN(count) ? 0 : count;
  }

  function getUseItemWeightTotal() {
    var raw = $.trim($('#ssb_use_item_weight').attr('data-item-weight-total') || '0');
    var total = parseFloat(raw || '0');
    return isNaN(total) ? 0 : total;
  }

  function formatWeightValue(value) {
    var numeric = parseFloat(value || '0');
    if (isNaN(numeric) || numeric <= 0) {
      return '';
    }

    return numeric.toFixed(2).replace(/\.00$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  }

  function applyUseItemWeightState() {
    var $checkbox = $('#ssb_use_item_weight');
    var $weight = $('#ssb_shippo_weight');

    if (!$checkbox.length || !$weight.length) {
      return;
    }

    if (getBox().hasClass('ssb-shippo-box--purchased')) {
      return;
    }

    var totalItemWeight = getUseItemWeightTotal();
    var hasWeight = totalItemWeight > 0;
    var isChecked = $checkbox.is(':checked');

    if (!hasWeight) {
      $checkbox.prop('checked', false).prop('disabled', true);
      $weight.prop('disabled', false);
      return;
    }

    $checkbox.prop('disabled', false);

    if (isChecked) {
      $weight
        .val(formatWeightValue(totalItemWeight))
        .prop('disabled', true);
    } else {
      $weight.prop('disabled', false);
    }
  }

  function syncUseItemWeightAvailability() {
    var $checkbox = $('#ssb_use_item_weight');
    if (!$checkbox.length) return;

    var totalItemWeight = getUseItemWeightTotal();
    var shouldEnable = totalItemWeight > 0;
    var wasChecked = $checkbox.is(':checked');

    if (!getBox().hasClass('ssb-shippo-box--purchased')) {
      if (!shouldEnable) {
        $checkbox.prop('checked', false).prop('disabled', true);
      } else {
        $checkbox.prop('disabled', false);
      }
    }

    applyUseItemWeightState();

    if (!shouldEnable && wasChecked) {
      saveShipmentOptionsAndMaybeRefreshRates(true);
    }
  }

  function updateGetRatesState() {
    var parcel = collectParcel();
    var isPurchased = getBox().hasClass('ssb-shippo-box--purchased');
    $('#ssb-shippo-get-rates').prop('disabled', !(isValidParcel(parcel) && !isPurchased));
  }

  function updateSidebarPackageSummary() {
    var parcel = collectParcel();
    var dimensions = '—';
    var weight = '—';

    if (parcel.length && parcel.width && parcel.height) {
      dimensions = parcel.length + ' × ' + parcel.width + ' × ' + parcel.height + ' in';
    }

    if (parcel.weight) {
      weight = parcel.weight + ' lb';
    }

    $('#ssb-sidebar-package-dimensions').text(dimensions);
    $('#ssb-sidebar-package-weight').text(weight);
    syncUseItemWeightAvailability();
  }

  function formatMoney(amount, currency) {
    if (amount === undefined || amount === null || amount === '') return '—';
    return currency ? amount + ' ' + currency : String(amount);
  }

    function formatAdjustmentMoney(amount) {
    var numeric = parseFloat(amount || '0');
    if (isNaN(numeric) || numeric < 0) {
      numeric = 0;
    }
    return '$' + numeric.toFixed(2);
  }

  function getRateAdjustments() {
    return state.rateAdjustments || {};
  }

  function getAdjustmentValue(key, fallback) {
    var adjustments = getRateAdjustments();
    var raw = adjustments && Object.prototype.hasOwnProperty.call(adjustments, key)
      ? adjustments[key]
      : fallback;

    var numeric = parseFloat(raw || '0');
    if (isNaN(numeric) || numeric < 0) {
      numeric = parseFloat(fallback || '0') || 0;
    }

    return numeric.toFixed(2);
  }

  function calculateAdjustedTotal(rate) {
  if (!rate) return { base: 0, addons: 0, insurance: 0, total: 0 };

  var base = parseFloat(rate.amount || '0');
  if (isNaN(base)) base = 0;

  var rateId = rate.rate_id || '';
  var selected = state.selectedAddonsByRateId[rateId] || {};

  var addonTotal = 0;

  Object.keys(selected).forEach(function(key) {
    if (!selected[key]) return;

    var value = parseFloat(getAdjustmentValue(resolveAdjustmentKey(rate, key), '0'));
    if (!isNaN(value)) {
      addonTotal += value;
    }
  });

  var insurance = calculateInsuranceCharge(rate).charge || 0;
  var total = base + addonTotal + insurance;

  return {
    base: base,
    addons: addonTotal,
    insurance: insurance,
    total: Math.max(0, total)
  };
}

function resolveAdjustmentKey(rate, addonKey) {
  var provider = String((rate && rate.provider) || '').toLowerCase();

  if (provider === 'usps') {
    if (addonKey === 'signature_required') return 'usps_signature_required';
    if (addonKey === 'adult_signature_required') return 'usps_adult_signature_required';
    if (addonKey === 'insurance') return 'usps_insurance';
  }

  if (provider === 'ups') {
    if (addonKey === 'signature_required') return 'ups_signature_required';
    if (addonKey === 'adult_signature_required') return 'ups_adult_signature_required';
    if (addonKey === 'carbon_neutral') return 'ups_carbon_neutral';
    if (addonKey === 'saturday_delivery') return 'ups_saturday_delivery';
    if (addonKey === 'additional_handling') return 'ups_additional_handling';
    if (addonKey === 'insurance') return 'ups_insurance';
  }

  return '';
}

    function getCarrierLogoMap() {
    return {
      USPS: '/wp-content/uploads/2026/04/usps.webp',
      UPS: '/wp-content/uploads/2026/04/ups.webp',
      FEDEX: '/wp-content/uploads/2026/04/fedex-scaled.webp',
      DHL: '/wp-content/uploads/2026/04/dhl.webp'
    };
  }

  function resolveProviderLogo(rate) {
    var provider = String((rate && rate.provider) || '').toUpperCase();
    var localMap = getCarrierLogoMap();
    var raw = (rate && rate.raw) ? rate.raw : {};
    var localLogo = localMap[provider] || '';
    var largeShippoLogo = raw && raw.provider_image_200 ? raw.provider_image_200 : '';
    var standardShippoLogo = rate && rate.provider_image ? rate.provider_image : '';

    return localLogo || largeShippoLogo || standardShippoLogo || '';
  }

    function setReturnPreviewLogo(provider) {
    var $logo = $('#ssb-return-preview-logo');

    if (!$logo.length) {
      return;
    }

    provider = $.trim(String(provider || '')).toUpperCase();

    if (!provider) {
      $logo.attr('src', '').attr('alt', '').hide();
      return;
    }

    var src = getCarrierLogoMap()[provider] || '';

    if (!src) {
      $logo.attr('src', '').attr('alt', '').hide();
      return;
    }

    $logo
      .attr('src', src)
      .attr('alt', provider + ' logo')
      .show();
  }

  function getUniqueRateProviders(rates) {
    var seen = {};
    var providers = [];

    (rates || []).forEach(function (rate) {
      var provider = $.trim((rate.provider || '').toUpperCase());
      if (!provider || seen[provider]) return;
      seen[provider] = true;
      providers.push(provider);
    });

    providers.sort();
    return providers;
  }

  function getSortedRates(rates, sortMode) {
    var cloned = (rates || []).slice();

    if (sortMode === 'fastest') {
      cloned.sort(function (a, b) {
        var aDays = parseInt(a.estimated_days || '9999', 10);
        var bDays = parseInt(b.estimated_days || '9999', 10);
        if (isNaN(aDays)) aDays = 9999;
        if (isNaN(bDays)) bDays = 9999;

        if (aDays !== bDays) return aDays - bDays;

        var aAmount = parseFloat(a.amount || '0');
        var bAmount = parseFloat(b.amount || '0');
        return aAmount - bAmount;
      });
      return cloned;
    }

    cloned.sort(function (a, b) {
      var aAmount = parseFloat(a.amount || '0');
      var bAmount = parseFloat(b.amount || '0');
      return aAmount - bAmount;
    });

    return cloned;
  }

  function getFilteredRates(rates, providerFilter) {
    if (!providerFilter || providerFilter === 'all') {
      return (rates || []).slice();
    }

    return (rates || []).filter(function (rate) {
      return String(rate.provider || '').toUpperCase() === String(providerFilter).toUpperCase();
    });
  }

function getRateServiceKey(rate) {
  var provider = String((rate && rate.provider) || '').toUpperCase();
  var service = String((rate && rate.service) || '').toLowerCase().trim();

  service = service
    .replace(/[®™]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (provider === 'USPS') {
    if (service.indexOf('ground advantage') !== -1) return 'usps_ground_advantage';
    if (service.indexOf('priority mail express') !== -1 || service.indexOf('express mail') !== -1) return 'usps_express_mail';
    if (service.indexOf('priority mail') !== -1) return 'usps_priority_mail';
    if (service.indexOf('media mail') !== -1) return 'usps_media_mail';
  }

  if (provider === 'UPS') {
    if (service.indexOf('ground saver') !== -1) return 'ups_ground_saver';
    if (service.indexOf('3 day select') !== -1) return 'ups_3_day_select';
    if (service.indexOf('2nd day air') !== -1 || service.indexOf('second day air') !== -1) return 'ups_2nd_day_air';
    if (service.indexOf('next day air early') !== -1 || service.indexOf('next day air early a.m.') !== -1) return 'ups_next_day_air_early';
    if (service.indexOf('next day air saver') !== -1) return 'ups_next_day_air_saver';
    if (service.indexOf('next day air') !== -1) return 'ups_next_day_air';
    if (service === 'ground' || service.indexOf('ups ground') !== -1) return 'ups_ground';
  }

  return '';
}

function getRateServiceConfig(rate) {
  var key = getRateServiceKey(rate);

  var map = {
    usps_ground_advantage: {
      included: [
        'Tracking',
        'Insurance (up to $100.00)',
        'Free pickup'
      ],
      optional: [
        'signature_required',
        'adult_signature_required'
      ],
      footer_html: 'Includes tracking, insurance (up to $100.00), free pickup'
    },

    ups_ground_saver: {
      included: [
        'Tracking',
        'Insurance (up to $20.00)'
      ],
      optional: [
        'carbon_neutral',
        'additional_handling'
      ],
      footer_html: 'Includes tracking, insurance (up to $20.00)'
    },

    usps_priority_mail: {
      included: [
        'Tracking',
        'Insurance (up to $100.00)',
        'Free pickup'
      ],
      optional: [
        'signature_required',
        'adult_signature_required'
      ],
      footer_html: 'Includes tracking, insurance (up to $100.00), free pickup'
    },

    ups_ground: {
      included: [
        'Tracking',
        'Insurance (up to $100.00)'
      ],
      optional: [
        'signature_required',
        'adult_signature_required',
        'carbon_neutral',
        'additional_handling'
      ],
      footer_html: 'Includes tracking, insurance (up to $100.00)'
    },

    ups_3_day_select: {
      included: [
        'Tracking',
        'Insurance (up to $100.00)'
      ],
      optional: [
        'signature_required',
        'adult_signature_required',
        'carbon_neutral',
        'additional_handling'
      ],
      footer_html: 'Includes tracking, insurance (up to $100.00)'
    },

    ups_2nd_day_air: {
      included: [
        'Tracking',
        'Insurance (up to $100.00)'
      ],
      optional: [
        'signature_required',
        'adult_signature_required',
        'carbon_neutral',
        'additional_handling',
        'saturday_delivery'
      ],
      footer_html: 'Includes tracking, insurance (up to $100.00)'
    },

    ups_next_day_air_saver: {
      included: [
        'Tracking',
        'Insurance (up to $100.00)'
      ],
      optional: [
        'signature_required',
        'adult_signature_required',
        'carbon_neutral',
        'additional_handling'
      ],
      footer_html: 'Includes tracking, insurance (up to $100.00)'
    },

    ups_next_day_air: {
      included: [
        'Tracking',
        'Insurance (up to $100.00)'
      ],
      optional: [
        'signature_required',
        'adult_signature_required',
        'carbon_neutral',
        'additional_handling',
        'saturday_delivery'
      ],
      footer_html: 'Includes tracking, insurance (up to $100.00)'
    },

    usps_express_mail: {
      included: [
        'Tracking',
        'Insurance (up to $100.00)',
        'Free pickup'
      ],
      optional: [
        'signature_required',
        'adult_signature_required'
      ],
      footer_html: 'Includes tracking, insurance (up to $100.00)'
    },

    ups_next_day_air_early: {
      included: [
        'Tracking',
        'Insurance (up to $100.00)'
      ],
      optional: [
        'adult_signature_required',
        'carbon_neutral',
        'additional_handling',
        'saturday_delivery'
      ],
      footer_html: 'Includes tracking, insurance (up to $100.00)'
    },

    usps_media_mail: {
      included: [
        'Tracking'
      ],
      optional: [
        'signature_required'
      ],
      footer_html: 'Books and <a href="https://pe.usps.com/text/DMM300/273.htm#a_3_0" target="_blank" rel="noopener noreferrer">other media</a> only<br>Includes tracking'
    }
  };

  return map[key] || {
    included: [],
    optional: [],
    footer_html: ''
  };
}

function getIncludedInsuranceAmount(rate) {
  var key = getRateServiceKey(rate);

  if (key === 'ups_ground_saver') {
    return 20;
  }

  if (
    key === 'usps_ground_advantage' ||
    key === 'usps_priority_mail' ||
    key === 'usps_express_mail' ||
    key === 'ups_ground' ||
    key === 'ups_3_day_select' ||
    key === 'ups_2nd_day_air' ||
    key === 'ups_next_day_air_saver' ||
    key === 'ups_next_day_air' ||
    key === 'ups_next_day_air_early'
  ) {
    return 100;
  }

  return 0;
}

function getDeclaredMerchandiseValue() {
  var total = 0;

  $('.woocommerce_order_items .item').each(function () {
    var $row = $(this);

    if ($row.hasClass('shipping') || $row.hasClass('fee')) {
      return;
    }

    var $totalInput = $row.find('input.line_total, input[name*="[line_total]"]').first();
    var raw = $.trim($totalInput.val() || '');

    if (!raw) {
      var text = $.trim($row.find('.line_total .view').text() || '');
      raw = text.replace(/[^0-9.\-]/g, '');
    }

    var value = parseFloat(raw || '0');
    if (!isNaN(value) && value > 0) {
      total += value;
    }
  });

  return total;
}

function getInsuranceRatePer100(rate) {
  var provider = String((rate && rate.provider) || '').toUpperCase();

  if (provider === 'USPS') {
    return parseFloat(getAdjustmentValue('usps_insurance', '0.00')) || 0;
  }

  if (provider === 'UPS') {
    return parseFloat(getAdjustmentValue('ups_insurance', '0.00')) || 0;
  }

  return 0;
}

function calculateInsuranceCharge(rate) {
  if (!rate || !state.insuranceEnabled) {
    return {
      declaredValue: getDeclaredMerchandiseValue(),
      includedCoverage: getIncludedInsuranceAmount(rate),
      additionalCoverage: 0,
      units: 0,
      charge: 0
    };
  }

  var declaredValue = getDeclaredMerchandiseValue();
  var includedCoverage = getIncludedInsuranceAmount(rate);
  var additionalCoverage = Math.max(0, declaredValue - includedCoverage);
  var units = additionalCoverage > 0 ? Math.ceil(additionalCoverage / 100) : 0;
  var charge = units * getInsuranceRatePer100(rate);

  return {
    declaredValue: declaredValue,
    includedCoverage: includedCoverage,
    additionalCoverage: additionalCoverage,
    units: units,
    charge: charge
  };
}

function getRateFeatureRows(rate) {
  return getRateServiceConfig(rate).included || [];
}

function getRateAddonRows(rate) {
  var provider = String((rate && rate.provider) || '').toUpperCase();
  var rateId = rate && rate.rate_id ? rate.rate_id : '';
  var selected = state.selectedAddonsByRateId[rateId] || {};
  var config = getRateServiceConfig(rate);
  var optionalKeys = config.optional || [];

  var catalog = {};

  if (provider === 'USPS') {
    catalog = {
      signature_required: {
        key: 'signature_required',
        label: 'Signature required',
        amount: formatAdjustmentMoney(getAdjustmentValue('usps_signature_required', '3.95')),
        checked: !!selected.signature_required
      },
      adult_signature_required: {
        key: 'adult_signature_required',
        label: 'Adult signature required',
        amount: formatAdjustmentMoney(getAdjustmentValue('usps_adult_signature_required', '9.70')),
        checked: !!selected.adult_signature_required
      }
    };
  } else if (provider === 'UPS') {
    catalog = {
      signature_required: {
        key: 'signature_required',
        label: 'Signature required',
        amount: formatAdjustmentMoney(getAdjustmentValue('ups_signature_required', '6.25')),
        checked: !!selected.signature_required
      },
      adult_signature_required: {
        key: 'adult_signature_required',
        label: 'Adult signature required',
        amount: formatAdjustmentMoney(getAdjustmentValue('ups_adult_signature_required', '7.50')),
        checked: !!selected.adult_signature_required
      },
      carbon_neutral: {
        key: 'carbon_neutral',
        label: 'Carbon neutral',
        amount: formatAdjustmentMoney(getAdjustmentValue('ups_carbon_neutral', '0.05')),
        checked: !!selected.carbon_neutral
      },
      saturday_delivery: {
        key: 'saturday_delivery',
        label: 'Saturday delivery',
        amount: formatAdjustmentMoney(getAdjustmentValue('ups_saturday_delivery', '16.00')),
        checked: !!selected.saturday_delivery
      },
      additional_handling: {
        key: 'additional_handling',
        label: 'Additional handling',
        amount: formatAdjustmentMoney(getAdjustmentValue('ups_additional_handling', '14.25')),
        checked: !!selected.additional_handling
      }
    };
  }

  return optionalKeys
    .filter(function (key) { return !!catalog[key]; })
    .map(function (key) { return catalog[key]; });
}

  function buildRateFeatureHtml(rate) {
    var html = '';
    var features = getRateFeatureRows(rate);

    features.forEach(function (feature) {
      html += ''
        + '<div class="ssb-rate-feature-row">'
        +   '<span class="ssb-rate-feature-row__icon" aria-hidden="true">✓</span>'
        +   '<span class="ssb-rate-feature-row__text">' + escapeHtml(feature) + '</span>'
        + '</div>';
    });

    return html;
  }

  function buildRateAddonHtml(rate) {
    var html = '';
    var addons = getRateAddonRows(rate);
    var rateId = rate && rate.rate_id ? rate.rate_id : '';

    addons.forEach(function (addon, index) {
      var inputId = 'ssb-addon-' + escapeHtml(rateId) + '-' + index;

      html += ''
        + '<div class="ssb-rate-addon-row">'
        +   '<label class="ssb-rate-addon-row__label" for="' + inputId + '">'
        +     '<input class="ssb-rate-addon-row__input" type="checkbox" id="' + inputId + '" data-rate-id="' + escapeHtml(rateId) + '" data-addon-key="' + escapeHtml(addon.key) + '"' + (addon.checked ? ' checked' : '') + '>'
        +     '<span class="ssb-rate-addon-row__text">' + escapeHtml(addon.label + ' ( +' + addon.amount + ' )') + '</span>'
        +   '</label>'
        + '</div>';
    });

    return html;
  }

    function buildPurchasedOptionHtml(rate) {
    var html = '';
    var rateId = rate && rate.rate_id ? rate.rate_id : '';
    var selected = state.selectedAddonsByRateId[rateId] || {};
    var config = getRateServiceConfig(rate);
    var optionalRows = getRateAddonRows(rate);

    (config.included || []).forEach(function (feature) {
      html += ''
        + '<div class="ssb-rate-feature-row">'
        +   '<span class="ssb-rate-feature-row__icon" aria-hidden="true">✓</span>'
        +   '<span class="ssb-rate-feature-row__text">' + escapeHtml(feature) + '</span>'
        + '</div>';
    });

    optionalRows.forEach(function (addon) {
      if (!selected[addon.key]) return;

      html += ''
        + '<div class="ssb-rate-feature-row">'
        +   '<span class="ssb-rate-feature-row__icon" aria-hidden="true">✓</span>'
        +   '<span class="ssb-rate-feature-row__text">' + escapeHtml(addon.label) + '</span>'
        + '</div>';
    });

    if ($('#ssb_additional_insurance').is(':checked')) {
      html += ''
        + '<div class="ssb-rate-feature-row">'
        +   '<span class="ssb-rate-feature-row__icon" aria-hidden="true">✓</span>'
        +   '<span class="ssb-rate-feature-row__text">Additional Insurance</span>'
        + '</div>';
    }

    return html;
  }

  function buildRateFooterHtml(rate) {
  var config = getRateServiceConfig(rate);

  if (!config.footer_html) {
    return '';
  }

  return '<span class="ssb-rate-row__footer-text">' + config.footer_html + '</span>';
}

  function renderRateToolbar(rates) {
    var providers = getUniqueRateProviders(rates);
    var html = '';

    html += ''
      + '<div class="ssb-rate-toolbar">'
      +   '<div class="ssb-rate-toolbar__group">'
      +     '<label class="ssb-rate-toolbar__label" for="ssb-rate-filter-carrier">Carrier</label>'
      +     '<select id="ssb-rate-filter-carrier" class="ssb-rate-toolbar__select">'
      +       '<option value="all">All carriers</option>';

    providers.forEach(function (provider) {
      html += '<option value="' + escapeHtml(provider) + '"' + (state.rateFilterCarrier === provider ? ' selected' : '') + '>' + escapeHtml(provider) + '</option>';
    });

    html += ''
      +     '</select>'
      +   '</div>'
      +   '<div class="ssb-rate-toolbar__group">'
      +     '<label class="ssb-rate-toolbar__label" for="ssb-rate-sort-mode">Sort by</label>'
      +     '<select id="ssb-rate-sort-mode" class="ssb-rate-toolbar__select">'
      +       '<option value="cheapest"' + (state.rateSortMode === 'cheapest' ? ' selected' : '') + '>Cheapest</option>'
      +       '<option value="fastest"' + (state.rateSortMode === 'fastest' ? ' selected' : '') + '>Fastest</option>'
      +     '</select>'
      +   '</div>'
      + '</div>';

    return html;
  }

  function recomputeVisibleRates() {
    var filtered = getFilteredRates(state.allRates, state.rateFilterCarrier);
    state.visibleRates = getSortedRates(filtered, state.rateSortMode);
  }

function updateInsuranceSidebar(rate) {
  var calc = calculateInsuranceCharge(rate);
  var $checkbox = $('#ssb_additional_insurance');
  var hasActiveRate = !!rate && !!state.ratesLoaded && !!state.selectedRateId;
  var exceedsThreshold = hasActiveRate && calc.declaredValue > calc.includedCoverage;
  var shouldEnable = hasActiveRate && exceedsThreshold;

  $('#ssb-sidebar-declared-value').text(hasActiveRate ? ('$' + calc.declaredValue.toFixed(2)) : '—');
  $('#ssb-sidebar-included-coverage').text(hasActiveRate ? ('$' + calc.includedCoverage.toFixed(2)) : '—');
  $('#ssb-sidebar-additional-coverage').text(
    hasActiveRate ? ('$' + calc.additionalCoverage.toFixed(2)) : '—'
  );
  $('#ssb-sidebar-insurance-charge').text(
    shouldEnable && state.insuranceEnabled && calc.charge > 0
      ? ('$' + calc.charge.toFixed(2))
      : '—'
  );

  if ($checkbox.length) {
    if (getBox().hasClass('ssb-shippo-box--purchased')) {
      $checkbox.prop('disabled', true);
      return;
    }

    $checkbox.prop('disabled', !shouldEnable);

    if (!shouldEnable) {
      $checkbox.prop('checked', false);
      state.insuranceEnabled = false;
      $('#ssb-sidebar-insurance-charge').text('—');
    }
  }
}

function hasLiveOutboundUiState() {
  var outboundLabelUrl = $.trim($('#ssb-workspace-print-label').attr('href') || '');
  var outboundTransactionId = $.trim($('#ssb-sidebar-transaction-id').text() || '');
  var outboundService = $.trim($('#ssb-sidebar-service').text() || '');
  var selectedService = $.trim($('#ssb-sidebar-selected-service').text() || '');

  outboundLabelUrl = (outboundLabelUrl === '' || outboundLabelUrl === '#') ? '' : outboundLabelUrl;
  outboundTransactionId = (outboundTransactionId === '' || outboundTransactionId === '—') ? '' : outboundTransactionId;
  outboundService = (outboundService === '' || outboundService === '—') ? '' : outboundService;
  selectedService = (selectedService === '' || selectedService === '—') ? '' : selectedService;

  return !!(outboundLabelUrl || outboundTransactionId || outboundService || selectedService);
}

function hydrateReturnOnlyCoverageSummary() {
  var returnLabelUrl = $.trim($('#ssb-workspace-return-label').attr('data-label-url') || '');
  var returnService = $.trim($('#ssb-sidebar-return-service').text() || '');
  var returnCarrier = $.trim($('#ssb-sidebar-return-carrier').text() || '');
  var returnCost = $.trim($('#ssb-sidebar-return-cost').text() || '');

  var hasReturn = returnLabelUrl !== '';
  var hasOutbound = hasLiveOutboundUiState();

  returnService = (returnService === '' || returnService === '—') ? '' : returnService;
  returnCarrier = (returnCarrier === '' || returnCarrier === '—') ? '' : returnCarrier;
  returnCost = (returnCost === '' || returnCost === '—') ? '' : returnCost;

  if (!hasReturn || hasOutbound || !returnService || !returnCarrier) {
    return;
  }

  var declaredValue = getDeclaredMerchandiseValue();
  var includedCoverage = getIncludedInsuranceAmount({
    provider: returnCarrier,
    service: returnService
  });
  var additionalCoverage = Math.max(0, declaredValue - includedCoverage);

  $('#ssb-sidebar-selected-service').text(returnService);
  $('#ssb-sidebar-selected-rate').text(returnCost || '—');
  $('#ssb-sidebar-declared-value').text('$' + declaredValue.toFixed(2));
  $('#ssb-sidebar-included-coverage').text('$' + includedCoverage.toFixed(2));
  $('#ssb-sidebar-additional-coverage').text('$' + additionalCoverage.toFixed(2));
  $('#ssb-sidebar-insurance-charge').text('—');

  $('#ssb_additional_insurance')
    .prop('checked', false)
    .prop('disabled', true);

  state.insuranceEnabled = false;
}

    function applySelectedRateState(rate) {
  if (!rate) return;

  var logoUrl = resolveProviderLogo(rate);
  var service = rate.service || 'Service';
  var provider = rate.provider || 'Carrier';
  var calc = calculateAdjustedTotal(rate);
  var amount = '$' + calc.total.toFixed(2);

  state.selectedRateId = rate.rate_id || '';
  state.selectedRateLabel = provider + ' — ' + service;
  state.selectedRateAmount = amount;
  state.selectedRateAmountRaw = calc.total.toFixed(2);
  state.selectedRateCurrency = rate.currency || '';
  state.selectedRateProvider = provider;
  state.selectedRateProviderImage = logoUrl;

  saveSelectedRateToActiveShipmentState();

  $('#ssb-sidebar-selected-service').text(service);
  $('#ssb-sidebar-selected-rate').text(amount);

    updateInsuranceSidebar(rate);

  var paidText = $('#ssb-sidebar-user-paid').text() || '';
  var paidMatch = paidText.replace(/[^0-9.\-]/g, '');
  var paidValue = parseFloat(paidMatch || '0');
  var selectedValue = parseFloat(calc.total || 0);

  $('#ssb-sidebar-user-paid')
    .removeClass('ssb-money-positive ssb-money-negative')
    .addClass((paidValue - selectedValue) >= 0 ? 'ssb-money-positive' : 'ssb-money-negative');

  if (state.selectedRateId) {
    $('#ssb-sidebar-purchase-label').prop('disabled', false).removeClass('is-disabled');
    clearFeedback();
  } else {
    $('#ssb-sidebar-purchase-label').prop('disabled', true).addClass('is-disabled');
  }
}

  function renderRatesLoading() {
    $('#ssb-shippo-rates').html(
      '<div class="ssb-rates-loading">' +
        '<div class="ssb-rates-loading__line"></div>' +
        '<div class="ssb-rates-loading__line"></div>' +
        '<div class="ssb-rates-loading__line"></div>' +
      '</div>'
    );
  }

  function renderRates(rates) {
    var $target = $('#ssb-shippo-rates');
    var html = '';
    var selectedRateStillVisible = false;

    state.allRates = (rates || []).slice();
    recomputeVisibleRates();

    if (!state.selectedRateId) {
      $('#ssb-sidebar-purchase-label').prop('disabled', true).addClass('is-disabled');
      $('#ssb-sidebar-selected-service').text('—');
      $('#ssb-sidebar-selected-rate').text('—');

      $('#ssb_additional_insurance').prop('disabled', true);
      $('#ssb-sidebar-declared-value').text('—');
      $('#ssb-sidebar-included-coverage').text('—');
      $('#ssb-sidebar-additional-coverage').text('—');
      $('#ssb-sidebar-insurance-charge').text('—');
    }

    if (!state.allRates.length) {
      state.selectedRateId = '';
      state.selectedRateLabel = '';
      state.selectedRateAmount = '';
      state.selectedRateAmountRaw = '';
      state.selectedRateCurrency = '';
      state.selectedRateProvider = '';
      state.selectedRateProviderImage = '';
      state.ratesLoaded = false;

      $target.html('<p class="description">' + (getStrings().no_rates || 'No rates found.') + '</p>');
      $('#ssb-customer-paid-banner').hide();
      return;
    }

    state.visibleRates.forEach(function (rate) {
      if ((rate.rate_id || '') === state.selectedRateId) {
        selectedRateStillVisible = true;
      }
    });

    if (!selectedRateStillVisible) {
      state.selectedRateId = '';
      state.selectedRateLabel = '';
      state.selectedRateAmount = '';
      state.selectedRateAmountRaw = '';
      state.selectedRateCurrency = '';
      state.selectedRateProvider = '';
      state.selectedRateProviderImage = '';

      $('#ssb-sidebar-purchase-label').prop('disabled', true).addClass('is-disabled');
      $('#ssb-sidebar-selected-service').text('—');
      $('#ssb-sidebar-selected-rate').text('—');
      $('#ssb_additional_insurance').prop('disabled', true);
      $('#ssb-sidebar-declared-value').text('—');
      $('#ssb-sidebar-included-coverage').text('—');
      $('#ssb-sidebar-additional-coverage').text('—');
      $('#ssb-sidebar-insurance-charge').text('—');
    }

    html += renderRateToolbar(state.allRates);
    html += '<div class="ssb-rate-list ssb-rate-list--wc">';

    state.visibleRates.forEach(function (rate, index) {
      var rateId = rate.rate_id || '';
      var provider = rate.provider || 'Carrier';
      var service = rate.service || 'Service';
      var amount = formatMoney(rate.amount, rate.currency);
      var logoUrl = resolveProviderLogo(rate);
      var etaText = '';

      if (rate.estimated_days) {
        etaText = rate.estimated_days === '1'
          ? '1 business day'
          : rate.estimated_days + ' business days';
      } else if (rate.duration_terms) {
        etaText = rate.duration_terms;
      }

      var isSelected = state.selectedRateId === rateId;
      var badge = (!state.rateSortMode || state.rateSortMode === 'cheapest') && index === 0
        ? '<span class="ssb-rate-row__badge">Lowest rate</span>'
        : (state.rateSortMode === 'fastest' && index === 0
            ? '<span class="ssb-rate-row__badge">Fastest</span>'
            : '');

      var logoHtml = '';
      if (logoUrl) {
        logoHtml = '<span class="ssb-rate-row__logo-wrap ssb-rate-row__logo-wrap--wc"><img class="ssb-rate-row__logo ssb-rate-row__logo--wc" src="' + escapeHtml(logoUrl) + '" alt="' + escapeHtml(provider) + '"></span>';
      } else {
        logoHtml = '<span class="ssb-rate-row__logo-wrap ssb-rate-row__logo-wrap--fallback">' + escapeHtml(provider.charAt(0)) + '</span>';
      }

            var calc = calculateAdjustedTotal(rate);
      var hasAddons = calc.addons > 0;
      var displayAmount = '$' + calc.total.toFixed(2);
      var originalAmount = '$' + calc.base.toFixed(2);
      var wasHtml = hasAddons
        ? '<span class="ssb-rate-row__was">(was ' + escapeHtml(originalAmount) + ')</span>'
        : '';

      html += ''
        + '<label class="ssb-rate-row ssb-rate-row--wc' + (isSelected ? ' is-selected is-expanded' : '') + '" data-provider="' + escapeHtml(provider) + '" data-provider-image="' + escapeHtml(logoUrl) + '" data-service="' + escapeHtml(service) + '" data-amount="' + escapeHtml(amount) + '" data-amount-raw="' + escapeHtml(rate.amount || '') + '" data-currency="' + escapeHtml(rate.currency || '') + '">'
        +   '<input class="ssb-rate-row__radio" type="radio" name="ssb_shippo_rate" value="' + escapeHtml(rateId) + '"' + (isSelected ? ' checked' : '') + '>'
        +   '<span class="ssb-rate-row__left ssb-rate-row__left--wc">'
        +     logoHtml
        +     '<span class="ssb-rate-row__meta ssb-rate-row__meta--wc">'
        +       '<span class="ssb-rate-row__providerline">'
        +         '<span class="ssb-rate-row__provider">' + escapeHtml(provider) + '</span>'
        +         badge
        +       '</span>'
        +       '<span class="ssb-rate-row__service">' + escapeHtml(service) + '</span>'
        +     '</span>'
        +   '</span>'
        +   '<span class="ssb-rate-row__center ssb-rate-row__center--wc">'
        +     (isSelected
                ? '<span class="ssb-rate-row__details is-open">'
                  + '<span class="ssb-rate-row__features">'
                    + buildRateFeatureHtml(rate)
                  + '</span>'
                  + '<span class="ssb-rate-row__addons">'
                    + buildRateAddonHtml(rate)
                  + '</span>'
                + '</span>'
                : '<span class="ssb-rate-row__footer">' + buildRateFooterHtml(rate) + '</span>')
        +   '</span>'
        +   '<span class="ssb-rate-row__right ssb-rate-row__right--wc">'
        +     '<span class="ssb-rate-row__amount ssb-rate-row__amount--wc">' + escapeHtml(displayAmount) + '</span>'
        +     wasHtml
        +     '<span class="ssb-rate-row__eta ssb-rate-row__eta--wc">' + escapeHtml(etaText || '') + '</span>'
        +   '</span>'
        + '</label>';

        });

    html += '</div>';

    $target.html(html);
    state.ratesLoaded = true;
  }

  function buildTrackingUrl(carrier, trackingNumber) {
    if (!trackingNumber) return '#';

    var carrierLc = String(carrier || '').toLowerCase();

    if (carrierLc === 'usps') {
      return 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' + encodeURIComponent(trackingNumber);
    }

    return 'https://track.goshippo.com/track/' + encodeURIComponent(trackingNumber);
  }

  function updateShipmentMeta(data) {
    if (!data) return;

    if (data.shipment_id) {
      $('#ssb-meta-shipment-id').text(data.shipment_id);
      $('#ssb-sidebar-shipment-id').text(data.shipment_id);
    }

    if (data.transaction_id) {
      $('#ssb-meta-transaction-id').text(data.transaction_id);
      $('#ssb-sidebar-transaction-id').text(data.transaction_id);
    }

    var returnData = (data.auto_return_label && typeof data.auto_return_label === 'object')
      ? data.auto_return_label
      : null;

    var displayCarrier = data.carrier || (returnData && returnData.provider) || '';
    var displayService = data.service || (returnData && returnData.service) || '';
    var displayTracking = data.tracking_number || (returnData && returnData.tracking_number) || '';
    var displayStatus = data.status || data.tracking_status || (returnData && (returnData.status || returnData.tracking_status)) || '';
    var displayTrackingUrl = data.tracking_url || (returnData && returnData.tracking_url) || '';
    var displayLabelUrl = data.label_url || (returnData && returnData.label_url) || '';

    if (displayCarrier) {
      $('#ssb-meta-carrier').text(displayCarrier);
      $('#ssb-sidebar-carrier').text(displayCarrier);
    }

    if (displayService) {
      $('#ssb-meta-service').text(displayService);
      $('#ssb-sidebar-service').text(displayService);
      $('#ssb-sidebar-selected-service').text(displayService);
    }

    if (displayTracking) {
      $('#ssb-meta-tracking').text(displayTracking);
      $('#ssb-sidebar-tracking').text(displayTracking);
    }

    if (!displayTrackingUrl && displayTracking) {
      displayTrackingUrl = buildTrackingUrl(displayCarrier || state.selectedRateProvider, displayTracking);
    }

    if (displayTrackingUrl && displayTrackingUrl !== '#') {
      $('#ssb-workspace-track-shipment').attr('href', displayTrackingUrl).show();
    }

    if (displayStatus) {
      $('#ssb-meta-status').text(displayStatus);
      $('#ssb-sidebar-status').text(displayStatus);
    }

    if (displayLabelUrl) {
      $('#ssb-workspace-print-label').attr('href', displayLabelUrl).show();
    }

    if (returnData) {
      updateReturnSidebarMeta(returnData);
    }
  }

    function updateReturnSidebarMeta(returnData) {
      returnData = returnData || {};

      var returnTracking = $.trim(returnData.tracking_number || '');
      var returnCarrier = $.trim(returnData.provider || returnData.carrier || '');
      var returnService = $.trim(returnData.service || '');
      var returnTransactionId = $.trim(
        returnData.transaction_id ||
        returnData.return_transaction_id ||
        ''
      );
      var returnAmount = $.trim(returnData.amount || returnData.return_amount || '');
      var returnCurrency = $.trim(returnData.currency || returnData.return_currency || '');

      $('#ssb-sidebar-return-tracking-row').show();
      $('#ssb-sidebar-return-carrier-row').show();
      $('#ssb-sidebar-return-service-row').show();
      $('#ssb-sidebar-return-transaction-row').show();
      $('#ssb-sidebar-return-cost-row').show();

      $('#ssb-sidebar-return-tracking').text(returnTracking || '—');
      $('#ssb-sidebar-return-carrier').text(returnCarrier || '—');
      $('#ssb-sidebar-return-service').text(returnService || '—');
      $('#ssb-sidebar-return-transaction-id').text(returnTransactionId || '—');
      $('#ssb-sidebar-return-cost').text(returnAmount ? ('$' + parseFloat(returnAmount).toFixed(2) + (returnCurrency ? ' ' + returnCurrency : '')) : '—');
    }

      function syncCardToggleLabel(forceExpanded) {
    var $toggle = getCardToggle();
    if (!$toggle.length) return;

    var isOpen = typeof forceExpanded === 'boolean'
      ? forceExpanded
      : (getCard().attr('data-expanded') === '1');

    var openLabel = $toggle.attr('data-open-label') || 'Open Fulfillment Station';
    var closeLabel = $toggle.attr('data-close-label') || 'Close Fulfillment Station';

    $toggle.text(isOpen ? closeLabel : openLabel);
  }

  function updateCardSummary(summaryText, buttonText) {
    var $toggle = getCardToggle();

    if (summaryText) {
      $('#ssb-card-summary-line').text(summaryText);
    }

    if (buttonText) {
      $toggle.text(buttonText);
    }

    $toggle.removeClass('button-primary button-secondary ssb-button-close ssb-button-open');

    var isPurchased = state.hasPurchasedLabel || getCard().hasClass('ssb-card--purchased');
    var isExpanded = getCard().attr('data-expanded') === '1';

    if (isPurchased && isExpanded) {
      $toggle.addClass('button button-secondary ssb-button-close');
    } else if (isPurchased) {
      $toggle.addClass('button button-primary ssb-button-open');
    } else {
      $toggle.addClass('button button-primary');
    }
  }

    function getCurrentSummaryText() {
    var cardState = String(getCard().attr('data-state') || state.shipmentState || 'none');
    var hasReturnLabelUrl = $.trim($('#ssb-workspace-return-label').attr('data-label-url') || '') !== '';
    var hasReturnTracking = $.trim($('#ssb-sidebar-return-tracking').text() || '') !== '' &&
      $.trim($('#ssb-sidebar-return-tracking').text() || '') !== '—';

    if (cardState === 'both') {
      if (hasReturnLabelUrl) {
        return 'Outbound and return labels are active and ready to print';
      }
      if (hasReturnTracking) {
        return 'Outbound label is ready to print; return tracking is active';
      }
      return 'Shipping label purchased — ready to print';
    }

    if (cardState === 'return_only') {
      if (hasReturnLabelUrl) {
        return 'Return label is active and ready to print';
      }
      if (hasReturnTracking) {
        return 'Return tracking is active';
      }
      return 'Return label is active';
    }

    if (cardState === 'outbound_only') {
      return 'Shipping label purchased — ready to print';
    }

    return (window.SSB_Admin && window.SSB_Admin.summary_text) || 'Create shipping label';
  }

  function ensureTrackingSectionVisible() {
    $('#ssb-tracking-section').show();
  }

  function showSuccessActions() {
    $('#ssb-post-purchase-actions').show();
  }

  function setPostPurchaseActionStatus(message, type) {
  var $status = $('#ssb-post-purchase-action-status');
  var $banner = $('#ssb-success-banner');

  if ($status.length) {
    $status
      .hide()
      .text('')
      .removeClass('ssb-feedback--error ssb-feedback--success ssb-feedback--info');
  }

  if (!$banner.length) return;

  if (!message) {
    clearWorkspaceBanner();
    return;
  }

  var bg = '#e5f7ec';
  var border = '#2e7d32';
  var color = '#1b5e20';

  if (type === 'error') {
    bg = '#ffe5e5';
    border = '#dc3232';
    color = '#7a0000';
  } else if (type === 'warning') {
    bg = '#fff4e5';
    border = '#ff9800';
    color = '#663c00';
  }

  $banner
  .stop(true, true)
  .removeAttr('style')
  .html('<strong>' + escapeHtml(message) + '</strong>')
  .css({
    display: 'block',
    borderColor: border,
    background: bg,
    color: color
  })
  .show();
}

  function resetPostPurchaseActionUi() {
  var $status = $('#ssb-post-purchase-action-status');
  var $voidLink = $('#ssb-workspace-void-label');

  $status
    .hide()
    .text('')
    .removeClass('ssb-feedback--error ssb-feedback--success ssb-feedback--info');

  clearWorkspaceBanner();

  if ($voidLink.length) {
    $voidLink
      .prop('disabled', false)
      .removeClass('ssb-button-link-disabled')
      .text('Void Shipping Label');
  }
}

  function restoreSidebarPurchaseControls() {
    var html = ''
      + '<button type="button" class="button button-primary button-hero" id="ssb-sidebar-purchase-label" disabled>'
      +   'Purchase Shipping Label'
      + '</button>'
      + '<label class="ssb-complete-order-check">'
      +   '<input type="checkbox" id="ssb_complete_order_after_purchase" checked>'
      +   '<span>After purchasing a label, mark this order as complete and notify the customer</span>'
      + '</label>';

    $('#ssb-sidebar-toggle-shipment-info').remove();
    $('#ssb-sidebar-action-rail').append(html);
  }

  function clearLiveShipmentMetaDisplay() {
    $('#ssb-meta-shipment-id, #ssb-sidebar-shipment-id').text('—');
    $('#ssb-meta-transaction-id, #ssb-sidebar-transaction-id').text('—');
    $('#ssb-meta-tracking, #ssb-sidebar-tracking').text('—');
    $('#ssb-meta-carrier, #ssb-sidebar-carrier').text('—');
    $('#ssb-meta-service, #ssb-sidebar-service').text('—');
    $('#ssb-meta-status, #ssb-sidebar-status').text('—');

    $('#ssb-sidebar-selected-service').text('—');
    $('#ssb-sidebar-selected-rate').text('—');
    $('#ssb-sidebar-declared-value').text('—');
    $('#ssb-sidebar-included-coverage').text('—');
    $('#ssb-sidebar-additional-coverage').text('—');
    $('#ssb-sidebar-insurance-charge').text('—');

    $('#ssb-workspace-print-label').attr('href', '#');
    $('#ssb-workspace-track-shipment').attr('href', '#').hide();
  }

    function syncOrderStatusToProcessingUi() {
    var $statusSelect = $('#order_status');
    var $statusLabel = $('.order-status');

    if ($statusSelect.length) {
      $statusSelect.val('wc-processing').trigger('change');
    }

    if ($statusLabel.length) {
      $statusLabel
        .removeClass(function (index, className) {
          return (className.match(/(^|\s)status-\S+/g) || []).join(' ');
        })
        .addClass('status-processing')
        .text('Processing');
    }
  }

function unlockVoidedLabelState(message) {
  var $box = getBox();
  var hasReturnLabel = $.trim($('#ssb-workspace-return-label').attr('data-label-url') || '') !== '';
  var returnTrackingUrl = $.trim($('#ssb-workspace-track-return-label').attr('href') || '');

  state.selectedRateId = '';
  state.selectedRateLabel = '';
  state.selectedRateAmount = '';
  state.selectedRateAmountRaw = '';
  state.selectedRateCurrency = '';
  state.selectedRateProvider = '';
  state.selectedRateProviderImage = '';
  state.ratesLoaded = false;
  state.hasPurchasedLabel = false;
  state.shipmentState = hasReturnLabel ? 'return_only' : 'none';

  $box.removeClass('ssb-shippo-box--purchased');

  $('#ssb_shippo_weight, #ssb_shippo_length, #ssb_shippo_width, #ssb_shippo_height, #ssb_shippo_package_type, #ssb_shippo_weight_unit, #ssb_shippo_label_file_type, #ssb_use_item_weight, #ssb_contains_alcohol, #ssb_contains_dry_ice, #ssb_create_return_label, #ssb_contains_hazmat, #ssb_additional_insurance')
    .prop('disabled', false);

  // Reset outbound shipment options after void
  $('#ssb_use_item_weight').prop('checked', false);
  $('#ssb_contains_alcohol').prop('checked', false);
  $('#ssb_contains_dry_ice').prop('checked', false);
  $('#ssb_create_return_label').prop('checked', false);
  $('#ssb_contains_hazmat').prop('checked', false);
  $('#ssb_additional_insurance').prop('checked', false).prop('disabled', true);

  state.insuranceEnabled = false;

  clearLiveShipmentMetaDisplay();
  resetPostPurchaseActionUi();

  $('#ssb-shippo-rates').html('<p class="description">The previous label was voided. Get rates to purchase a replacement label.</p>');

  restoreSidebarPurchaseControls();
  updateGetRatesState();
  getCard().attr('data-state', state.shipmentState).removeClass('ssb-card--purchased');

  if (hasReturnLabel) {
    getCard().addClass('ssb-card--purchased');
    updateCardSummary('Return label is active and ready to print', 'Open Fulfillment Station');

    applyReturnLabelState(
      $('#ssb-workspace-return-label').attr('data-label-url') || '',
      returnTrackingUrl
    );

    syncPurchasedActionLinks({
      provider: '',
      transaction_id: ''
    });

    if (message) {
      setPostPurchaseActionStatus(message, 'success');
    }
  } else {
    $('#ssb-post-purchase-actions').hide();
    $('#ssb-tracking-section').hide();
    updateCardSummary('Shipping label voided — ready to purchase a replacement', 'Close Fulfillment Station');

    if (message) {
      setPostPurchaseActionStatus(message, 'success');
    }
  }

  setTimeout(function () {
    $('#ssb-sidebar-declared-value').text('—');
    $('#ssb-sidebar-included-coverage').text('—');
    $('#ssb-sidebar-additional-coverage').text('—');
    $('#ssb-sidebar-insurance-charge').text('—');
    $('#ssb_additional_insurance').prop('checked', false).prop('disabled', true);
    state.insuranceEnabled = false;
  }, 0);
}

  function saveLabelFileType() {
    var labelFileType = getSelectedLabelFileType();

    state.labelFileType = labelFileType;

    $.ajax({
      url: window.SSB_Admin.ajax_url,
      method: 'POST',
      dataType: 'json',
      data: {
        action: 'ssb_save_label_file_type',
        nonce: getNonce(),
        order_id: getOrderId(),
        label_file_type: labelFileType
      }
    }).fail(function () {
      setFeedback('Unable to save label format.', 'error');
    });
  }

  function saveShipmentOptionsAndMaybeRefreshRates(shouldRefreshRates) {
  var parcel = collectParcel();
  var isPurchased = getBox().hasClass('ssb-shippo-box--purchased');

  $.ajax({
    url: window.SSB_Admin.ajax_url,
    method: 'POST',
    dataType: 'json',
    data: {
      action: 'ssb_save_shipment_options',
      nonce: getNonce(),
      order_id: getOrderId(),
      use_item_weight: $('#ssb_use_item_weight').is(':checked') ? '1' : '0',
      contains_alcohol: $('#ssb_contains_alcohol').is(':checked') ? '1' : '0',
      contains_dry_ice: $('#ssb_contains_dry_ice').is(':checked') ? '1' : '0',
      create_return_label: $('#ssb_create_return_label').is(':checked') ? '1' : '0',
      contains_hazmat: $('#ssb_contains_hazmat').is(':checked') ? '1' : '0',
      additional_insurance: $('#ssb_additional_insurance').is(':checked') ? '1' : '0'
    }
  })
    .done(function (response) {
      if (!response || !response.success) {
        var message = (response && response.data && response.data.message) ? response.data.message : 'Unable to save shipment options.';
        setFeedback(message, 'error');
        return;
      }

      updateGetRatesState();

      if (isPurchased || !shouldRefreshRates || !isValidParcel(parcel)) {
        return;
      }

      state.lastRateRequestSignature = '';
      state.selectedRateId = '';
      state.selectedRateLabel = '';
      state.selectedRateAmount = '';
      state.selectedRateAmountRaw = '';
      state.selectedRateCurrency = '';
      state.selectedRateProvider = '';
      state.selectedRateProviderImage = '';
      state.ratesLoaded = false;

      $('#ssb-sidebar-purchase-label').prop('disabled', true).addClass('is-disabled');
      $('#ssb-sidebar-selected-service').text('—');
      $('#ssb-sidebar-selected-rate').text('—');
      $('#ssb-shippo-rates').html('<p class="description">Refreshing rates…</p>');

      performGetRates(parcel, true);
    })
    .fail(function () {
      setFeedback('Unable to save shipment options.', 'error');
    });
}

  function lockPurchasedState() {
    var $box = getBox();

    $box.addClass('ssb-shippo-box--purchased');

    $('#ssb_shippo_weight, #ssb_shippo_length, #ssb_shippo_width, #ssb_shippo_height, #ssb_shippo_package_type, #ssb_shippo_weight_unit, #ssb_shippo_label_file_type, #ssb_use_item_weight, #ssb_contains_alcohol, #ssb_contains_dry_ice, #ssb_create_return_label, #ssb_contains_hazmat, #ssb_additional_insurance')
  .prop('disabled', true);

    $('#ssb-shippo-get-rates').prop('disabled', true);

    ensureTrackingSectionVisible();
    showSuccessActions();
    resetPostPurchaseActionUi();

    $('#ssb-processing-banner').hide();
setPostPurchaseActionStatus(
  'Label purchased successfully. ' + (getStrings().label_ready || 'Your shipping label is ready to print.'),
  'success'
);

    $('#ssb-sidebar-purchase-label').remove();
    $('#ssb_complete_order_after_purchase').closest('.ssb-complete-order-check').remove();

    if (!$('#ssb-sidebar-toggle-shipment-info').length) {
      $('#ssb-sidebar-action-rail').append(
        '<button type="button" class="button button-primary" id="ssb-sidebar-toggle-shipment-info" data-expanded="0">Expand Shipment Info</button>'
      );
    } else {
      $('#ssb-sidebar-toggle-shipment-info')
        .text('Expand Details')
        .attr('data-expanded', '0');
    }

    $('#ssb-sidebar-collapsible-details').hide();

    if (state.selectedRateLabel || state.selectedRateAmount) {
      var purchasedLogoHtml = '';

      if (state.selectedRateProviderImage) {
        purchasedLogoHtml =
          '<span class="ssb-rate-row__logo-wrap">' +
            '<img class="ssb-rate-row__logo" src="' + escapeHtml(state.selectedRateProviderImage) + '" alt="' + escapeHtml(state.selectedRateProvider || '') + '">' +
          '</span>';
      } else {
        purchasedLogoHtml =
          '<span class="ssb-rate-row__logo-wrap ssb-rate-row__logo-wrap--fallback">' +
            escapeHtml((state.selectedRateProvider || 'S').charAt(0).toUpperCase()) +
          '</span>';
      }

            var selectedRate = null;

      (state.allRates || []).some(function (rate) {
        if ((rate.rate_id || '') === state.selectedRateId) {
          selectedRate = rate;
          return true;
        }
        return false;
      });

      var purchasedDetailsHtml = selectedRate ? buildPurchasedOptionHtml(selectedRate) : '';

      var purchasedHtml = ''
        + '<p class="description">Selected Shipping Service:</p>'
        + '<div class="ssb-rate-list ssb-rate-list--wc">'
        +   '<div class="ssb-rate-row ssb-rate-row--wc is-selected is-purchased is-static">'
        +     '<span class="ssb-rate-row__left ssb-rate-row__left--wc">'
        +       purchasedLogoHtml
        +       '<span class="ssb-rate-row__meta ssb-rate-row__meta--wc">'
        +         '<span class="ssb-rate-row__providerline">'
        +           '<span class="ssb-rate-row__provider">' + escapeHtml(state.selectedRateProvider || '') + '</span>'
        +           '<span class="ssb-rate-row__badge ssb-rate-row__badge--purchased">Purchased</span>'
        +         '</span>'
        +         '<span class="ssb-rate-row__service">' + escapeHtml($('#ssb-sidebar-selected-service').text() || '') + '</span>'
        +       '</span>'
        +     '</span>'
        +     '<span class="ssb-rate-row__center ssb-rate-row__center--wc">'
        +       '<span class="ssb-rate-row__details is-open">'
        +         '<span class="ssb-rate-row__features">' + purchasedDetailsHtml + '</span>'
        +       '</span>'
        +     '</span>'
        +     '<span class="ssb-rate-row__right ssb-rate-row__right--wc">'
        +       '<span class="ssb-rate-row__amount ssb-rate-row__amount--wc">' + escapeHtml(state.selectedRateAmount || '') + '</span>'
        +     '</span>'
        +   '</div>'
        + '</div>';

      $('#ssb-shippo-rates').html(purchasedHtml);
    }

    state.shipmentState = getCard().attr('data-state') || state.shipmentState || 'outbound_only';
    if (state.shipmentState !== 'both' && state.shipmentState !== 'return_only') {
      state.shipmentState = 'outbound_only';
    }

    state.hasPurchasedLabel = true;
getCard().attr('data-state', state.shipmentState).addClass('ssb-card--purchased');
updateCardSummary(getCurrentSummaryText(), 'Close Fulfillment Station');
}

function performGetRates(parcel, isAuto) {
  var strings = getStrings();
  var orderId = getOrderId();
  var $button = $('#ssb-shippo-get-rates');

  if (!orderId || !isValidParcel(parcel)) return;

  var forceRefresh = !isAuto || $('#ssb-force-refresh').is(':checked');

  updateSidebarPackageSummary();
  state.ratesLoading = true;
  clearFeedback();
  renderRatesLoading();

  if (forceRefresh) {
    $('#ssb-force-refresh').prop('checked', false);
  }

  if (!isAuto) {
    clearFeedback();
    setLoading($button, true, strings.loading_rates || 'Loading rates...', strings.get_rates || 'Fetch Rates');
  } else {
    $button.prop('disabled', true).addClass('is-busy');
  }

  $.ajax({
    url: window.SSB_Admin.ajax_url,
    method: 'POST',
    dataType: 'json',
    data: {
      action: 'ssb_get_rates',
      nonce: getNonce(),
      order_id: orderId,
      weight: parcel.weight,
      length: parcel.length,
      width: parcel.width,
      height: parcel.height,
      force_refresh: forceRefresh ? '1' : '0'
    }
  })
    .done(function (response) {
      if (!response || !response.success || !response.data) {
        var message = (response && response.data && response.data.message) ? response.data.message : (strings.generic_error || 'Something went wrong.');
        setFeedback(message, 'error');
        renderRates([]);
        return;
      }

      renderRates(response.data.rates || []);
      saveParcelToActiveShipmentState();
      saveRatesToActiveShipmentState(response.data || {});
      updateShipmentMeta({ shipment_id: response.data.shipment_id || '' });
      applyRatesFeedback(response, isAuto);
    })
    .fail(function () {
      setFeedback(strings.generic_error || 'Something went wrong.', 'error');
      renderRates([]);
    })
    .always(function () {
      state.ratesLoading = false;
      if (!isAuto) {
        setLoading($button, false, '', strings.get_rates || 'Fetch Rates');
      } else {
        $button.removeClass('is-busy');
        updateGetRatesState();
      }
    });
}

  function scheduleAutoRates() {
    var parcel = collectParcel();
    var signature = parcelSignature(parcel);
    var isPurchased = getBox().hasClass('ssb-shippo-box--purchased');

    updateSidebarPackageSummary();

    if (isPurchased || !isValidParcel(parcel)) return;
    if (state.lastRateRequestSignature === signature && state.ratesLoaded) return;

    if (state.autoRatesTimer) {
      window.clearTimeout(state.autoRatesTimer);
    }

    state.autoRatesTimer = window.setTimeout(function () {
      state.lastRateRequestSignature = signature;
      performGetRates(parcel, true);
    }, 1000);
  }

  function openUpsTermsModal() {
    $('#ssb-ups-terms-modal').show();
    $('#ssb-ups-terms-confirm').prop('disabled', true);
    $('.ssb-ups-terms-check').prop('checked', false);
  }

  function closeUpsTermsModal() {
    $('#ssb-ups-terms-modal').hide();
  }

  function openVoidLabelModal() {
    $('#ssb-void-label-modal').show();
  }

  function closeVoidLabelModal() {
    $('#ssb-void-label-modal').hide();
    $('#ssb-void-label-modal').attr('data-void-type', 'shipping');
    $('#ssb-void-label-title').text('Void this shipping label?');
    $('#ssb-void-label-confirm').text('Void Shipping Label');
  }

    function openVoidReturnLabelModal() {
    $('#ssb-void-label-modal').attr('data-void-type', 'return');
    $('#ssb-void-label-title').text('Void this return label?');
    $('#ssb-void-label-confirm').text('Void Return Label');
    $('#ssb-void-label-modal').show();
  }

    function openSchedulePickupModal() {
    $('#ssb-schedule-pickup-modal').show();
  }

  function closeSchedulePickupModal() {
    $('#ssb-schedule-pickup-modal').hide();
  }

  function openReturnLabelModal() {
    $('#ssb-return-label-modal').show();
  }

  function closeReturnLabelModal() {
    $('#ssb-return-label-modal').hide();
  }

  function getReturnModalSelections() {
    return {
      contains_alcohol: $('#ssb_return_contains_alcohol').is(':checked'),
      contains_dry_ice: $('#ssb_return_contains_dry_ice').is(':checked'),
      contains_hazmat: $('#ssb_return_contains_hazmat').is(':checked'),
      additional_insurance: $('#ssb_return_additional_insurance').is(':checked')
    };
  }

  function setReturnPreviewFeedback(message, type) {
    var $feedback = $('#ssb-return-preview-feedback');
    if (!$feedback.length) return;

    if (!message) {
      $feedback
        .hide()
        .html('')
        .removeClass('ssb-feedback--error ssb-feedback--success ssb-feedback--info ssb-feedback--warning');
      return;
    }

    $feedback
      .show()
      .html(message)
      .removeClass('ssb-feedback--error ssb-feedback--success ssb-feedback--info ssb-feedback--warning')
      .addClass('ssb-feedback--' + (type || 'info'));
  }

  function resetReturnPreviewDisplay() {
    $('#ssb-return-preview-carrier').text('—');
    $('#ssb-return-preview-service').text('—');
    $('#ssb-return-preview-base').text('—');
    $('#ssb-return-preview-options').text('—');
    $('#ssb-return-preview-insurance').text('—');
    $('#ssb-return-preview-total').text('—');
    setReturnPreviewLogo('');
    setReturnPreviewFeedback('', 'info');
  }

  function getReturnPreviewDryIceWeightKg() {
    var parcel = collectParcel();
    var pounds = parseFloat(parcel.weight || '0');

    if (isNaN(pounds) || pounds <= 0) {
      return '';
    }

    return (pounds * 0.45359237).toFixed(3);
  }

  function applyReturnPreviewCapabilities(data) {
    var caps = (data && data.capabilities) ? data.capabilities : {};

    if (!caps.supports_alcohol) {
      $('#ssb_return_contains_alcohol').prop('checked', false).prop('disabled', true);
    } else {
      $('#ssb_return_contains_alcohol').prop('disabled', false);
    }

    if (!caps.supports_dry_ice) {
      $('#ssb_return_contains_dry_ice').prop('checked', false).prop('disabled', true);
    } else {
      $('#ssb_return_contains_dry_ice').prop('disabled', false);
    }

    if (!caps.supports_hazmat) {
      $('#ssb_return_contains_hazmat').prop('checked', false).prop('disabled', true);
    } else {
      $('#ssb_return_contains_hazmat').prop('disabled', false);
    }

    if (!caps.supports_insurance || !caps.insurance_eligible) {
      $('#ssb_return_additional_insurance').prop('checked', false).prop('disabled', true);
    } else {
      $('#ssb_return_additional_insurance').prop('disabled', false);
    }
  }

  function refreshReturnLabelPreview() {
    var selections = getReturnModalSelections();

    setReturnPreviewFeedback('', 'info');
    $('#ssb-return-preview-carrier').text('Loading...');
    $('#ssb-return-preview-service').text('Loading...');
    $('#ssb-return-preview-base').text('Loading...');
    $('#ssb-return-preview-options').text('Loading...');
    $('#ssb-return-preview-insurance').text('Loading...');
    $('#ssb-return-preview-total').text('Loading...');

    $.ajax({
      url: window.SSB_Admin.ajax_url,
      method: 'POST',
      dataType: 'json',
      data: {
        action: 'ssb_preview_return_label',
        nonce: getNonce(),
        order_id: getOrderId(),
        contains_alcohol: selections.contains_alcohol ? '1' : '0',
        contains_dry_ice: selections.contains_dry_ice ? '1' : '0',
        contains_hazmat: selections.contains_hazmat ? '1' : '0',
        additional_insurance: selections.additional_insurance ? '1' : '0',
        dry_ice_weight_kg: selections.contains_dry_ice ? getReturnPreviewDryIceWeightKg() : ''
      }
    })
      .done(function (response) {
        if (!response || !response.success || !response.data) {
          var message = (response && response.data && response.data.message)
            ? response.data.message
            : 'Unable to preview the return label.';
          resetReturnPreviewDisplay();
          setReturnPreviewLogo('');
          setReturnPreviewFeedback(message, 'error');
          return;
        }

        applyReturnPreviewCapabilities(response.data);

        $('#ssb-return-preview-carrier').text(response.data.provider || '—');
        setReturnPreviewLogo(response.data.provider || '');
        $('#ssb-return-preview-service').text(response.data.service || '—');
        $('#ssb-return-preview-base').text(response.data.base_amount_formatted || '—');
        $('#ssb-return-preview-insurance').text(response.data.insurance_formatted || '—');
        $('#ssb-return-preview-total').text(response.data.total_formatted || '—');

        if (response.data.notice) {
          setReturnPreviewFeedback(response.data.notice, 'info');
        } else {
          setReturnPreviewFeedback('', 'info');
        }
      })
      .fail(function () {
        resetReturnPreviewDisplay();
        setReturnPreviewFeedback('Unable to preview the return label.', 'error');
      });
  }

  function openReturnLabelModal() {
    resetReturnPreviewDisplay();
    $('#ssb-return-label-modal').show();
    refreshReturnLabelPreview();
  }

  function applyPickupScheduledState() {
    var $button = $('#ssb-workspace-schedule-pickup');

    if ($button.length) {
      $button
        .prop('disabled', true)
        .addClass('ssb-button-link-disabled')
        .text('Pickup scheduled');
    }
  }

  function applyReturnLabelState(labelUrl, trackingUrl) {
  var $button = $('#ssb-workspace-return-label');
  var $voidButton = $('#ssb-workspace-void-return-label');
  var $trackLink = $('#ssb-workspace-track-return-label');
  var $checkbox = $('#ssb_create_return_label');
  var $checkboxLabel = $checkbox.closest('.ssb-check-card').find('span');
  var url = $.trim(labelUrl || '');
  var track = $.trim(trackingUrl || '');

  if ($button.length && url) {
    $button
      .attr('data-label-url', url)
      .prop('disabled', false)
      .removeClass('ssb-button-link-disabled')
      .text('Print Return Label')
      .show();
  }

  if ($voidButton.length) {
    $voidButton
      .prop('disabled', false)
      .removeClass('ssb-button-link-disabled')
      .show();
  }

  if ($trackLink.length) {
    if (track && track !== '#') {
      $trackLink.attr('href', track).show();
    } else {
      $trackLink.attr('href', '#').hide();
    }
  }

  if ($checkbox.length) {
    $checkbox.prop('checked', true).prop('disabled', true);
  }

  if ($checkboxLabel.length) {
    $checkboxLabel.text('Return label already exists');
  }

  hydrateReturnOnlyCoverageSummary();
}

function clearReturnLabelState() {
  var $button = $('#ssb-workspace-return-label');
  var $voidButton = $('#ssb-workspace-void-return-label');
  var $trackLink = $('#ssb-workspace-track-return-label');
  var $checkbox = $('#ssb_create_return_label');
  var $checkboxLabel = $checkbox.closest('.ssb-check-card').find('span');

  if ($button.length) {
    $button
      .attr('data-label-url', '')
      .prop('disabled', false)
      .removeClass('ssb-button-link-disabled')
      .text('Return Label');
  }

  if ($voidButton.length) {
    $voidButton
      .prop('disabled', true)
      .addClass('ssb-button-link-disabled')
      .hide();
  }

  if ($trackLink.length) {
    $trackLink.attr('href', '#').hide();
  }

  if ($checkbox.length && !getBox().hasClass('ssb-shippo-box--purchased')) {
    $checkbox.prop('disabled', false).prop('checked', false);
  }

  if ($checkboxLabel.length) {
    $checkboxLabel.text('Create a return label');
  }

  $('#ssb-sidebar-return-tracking-row, #ssb-sidebar-return-carrier-row, #ssb-sidebar-return-service-row, #ssb-sidebar-return-transaction-row, #ssb-sidebar-return-cost-row').show();
$('#ssb-sidebar-return-tracking, #ssb-sidebar-return-carrier, #ssb-sidebar-return-service, #ssb-sidebar-return-transaction-id, #ssb-sidebar-return-cost').text('—');
}

function restoreUncheckedReturnCheckboxLabel() {
  var $checkbox = $('#ssb_create_return_label');
  var $checkboxLabel = $checkbox.closest('.ssb-check-card').find('span');
  var hasRealReturnLabel = $.trim($('#ssb-workspace-return-label').attr('data-label-url') || '') !== '';

  if (hasRealReturnLabel) {
    return;
  }

  if ($checkbox.length) {
    $checkbox.prop('checked', false);
  }

  if ($checkboxLabel.length) {
    $checkboxLabel.text('Create a return label');
  }
}

function getActionUiState(data) {
  var outboundLabelUrl = $.trim($('#ssb-workspace-print-label').attr('href') || '');
  var outboundTrackingUrl = $.trim($('#ssb-workspace-track-shipment').attr('href') || '');
  var sidebarProvider = $.trim($('#ssb-sidebar-carrier').text() || '');
  var sidebarTransactionId = $.trim($('#ssb-sidebar-transaction-id').text() || '');
  var cardState = String(getCard().attr('data-state') || state.shipmentState || 'none');

  function normalizeText(value) {
    value = $.trim(String(value || ''));
    return (value === '' || value === '—') ? '' : value;
  }

  function normalizeUrl(value) {
    value = $.trim(String(value || ''));
    return (value === '' || value === '#') ? '' : value;
  }

  var provider = normalizeText((data && (data.provider || data.carrier)) || sidebarProvider).toUpperCase();
  var transactionId = normalizeText((data && data.transaction_id) || sidebarTransactionId);
  var returnLabelUrl = normalizeUrl(
    (data && data.auto_return_label && data.auto_return_label.label_url) ||
    ($('#ssb-workspace-return-label').attr('data-label-url') || '')
  );
  var returnTrackingUrl = normalizeUrl(
    (data && data.auto_return_label && data.auto_return_label.tracking_url) ||
    ($('#ssb-workspace-track-return-label').attr('href') || '')
  );

  outboundLabelUrl = normalizeUrl(outboundLabelUrl);
  outboundTrackingUrl = normalizeUrl(outboundTrackingUrl);

  var hasOutboundFromState = (
    cardState === 'outbound_only' ||
    cardState === 'both' ||
    state.hasPurchasedLabel === true
  );

  var hasReturnFromState = (
    cardState === 'return_only' ||
    cardState === 'both'
  );

  var hasOutbound = transactionId !== '' || outboundLabelUrl !== '' || hasOutboundFromState;
  var hasReturn = returnLabelUrl !== '' || hasReturnFromState;

  var pickupSupported = hasOutbound && transactionId !== '' && (provider === 'USPS' || provider.indexOf('DHL') !== -1);
  var returnSupported = transactionId !== '' && (provider === 'USPS' || provider === 'UPS' || provider === 'FEDEX');

  return {
    provider: provider,
    transactionId: transactionId,
    outboundLabelUrl: outboundLabelUrl,
    outboundTrackingUrl: outboundTrackingUrl,
    returnLabelUrl: returnLabelUrl,
    returnTrackingUrl: returnTrackingUrl,
    hasOutbound: hasOutbound,
    hasReturn: hasReturn,
    pickupSupported: pickupSupported,
    returnSupported: returnSupported
  };
}

function syncPurchasedActionLinks(data) {
  var ui = getActionUiState(data);

  var $actions = $('#ssb-post-purchase-actions');
  var $tracking = $('#ssb-tracking-section');
  var $printPackingSlip = $('#ssb-workspace-print-packing-slip');
  var $printLabel = $('#ssb-workspace-print-label');
  var $trackShipment = $('#ssb-workspace-track-shipment');
  var $pickup = $('#ssb-workspace-schedule-pickup');
  var $voidLabel = $('#ssb-workspace-void-label');
  var $return = $('#ssb-workspace-return-label');
  var $voidReturn = $('#ssb-workspace-void-return-label');
  var $trackReturn = $('#ssb-workspace-track-return-label');

  if (!ui.hasOutbound && !ui.hasReturn) {
    if ($printPackingSlip.length) {
      $printPackingSlip.hide();
    }

    if ($return.length) {
      $return.hide();
    }

    if ($voidReturn.length) {
      $voidReturn.hide();
    }

    if ($trackReturn.length) {
      $trackReturn.hide();
    }

    $actions.hide();
    $tracking.hide();
    clearReturnLabelState();
    return;
  }

  $actions.show();
  $tracking.show();

  if ($printPackingSlip.length) {
    $printPackingSlip.show();
  }

  if (ui.hasOutbound) {
    $printLabel.show();

    if (ui.outboundTrackingUrl && ui.outboundTrackingUrl !== '#') {
      $trackShipment.show();
    } else {
      $trackShipment.hide();
    }

    if (ui.pickupSupported) {
      if ($pickup.text() !== 'Pickup scheduled') {
        $pickup
          .prop('disabled', false)
          .removeClass('ssb-button-link-disabled')
          .show();
      } else {
        $pickup.show();
      }
    } else {
      $pickup.hide();
    }

    $voidLabel
      .prop('disabled', false)
      .removeClass('ssb-button-link-disabled')
      .text('Void Shipping Label')
      .show();
  } else {
    $printLabel.hide();
    $trackShipment.hide();
    $pickup.hide();
    $voidLabel.hide();
  }

  if (ui.hasReturn) {
    applyReturnLabelState(ui.returnLabelUrl, ui.returnTrackingUrl);

    if ($trackReturn.length) {
      if (ui.returnTrackingUrl && ui.returnTrackingUrl !== '#') {
        $trackReturn.attr('href', ui.returnTrackingUrl).show();
      } else {
        $trackReturn.hide();
      }
    }

    if ($voidReturn.length) {
      $voidReturn
        .prop('disabled', false)
        .removeClass('ssb-button-link-disabled')
        .show();
    }
  } else {
    clearReturnLabelState();

    if ($return.length) {
      if (ui.returnSupported) {
        $return
          .prop('disabled', false)
          .removeClass('ssb-button-link-disabled')
          .text('Return Label')
          .show();
      } else {
        $return.hide();
      }
    }

    if ($voidReturn.length) {
      $voidReturn.hide();
    }

    if ($trackReturn.length) {
      $trackReturn.hide();
    }
  }
}

  function maybeRequireTermsThenBuy() {
    if (String(state.selectedRateProvider || '').toLowerCase().indexOf('ups') !== -1) {
      setFeedback(getStrings().ups_terms_required || 'UPS requires terms acceptance before label purchase.', 'info');
      openUpsTermsModal();
      return;
    }

    buyLabel();
  }

  function buyLabel() {
    var strings = getStrings();
    var orderId = getOrderId();
    var $button = $('#ssb-sidebar-purchase-label');

    clearFeedback();

    if (!orderId) {
      setFeedback('Missing order ID.', 'error');
      return;
    }

    if (!state.selectedRateId) {
      setFeedback(strings.choose_rate || 'Please select a rate first.', 'error');
      return;
    }

    $('#ssb-processing-banner')
      .html('<strong>' + (strings.processing_purchase || 'Please wait while we process your shipping label purchase.') + '</strong>')
      .show();

    setLoading($button, true, strings.buying_label || 'Buying label...', 'Purchase Shipping Label');

    $.ajax({
      url: window.SSB_Admin.ajax_url,
      method: 'POST',
      dataType: 'json',
      data: {
        action: 'ssb_buy_label',
        nonce: getNonce(),
        order_id: orderId,
        rate_id: state.selectedRateId,
        label_file_type: getSelectedLabelFileType(),
        selected_provider: state.selectedRateProvider || '',
        selected_service: $('#ssb-sidebar-selected-service').text() || '',
        selected_amount: state.selectedRateAmountRaw || '',
        selected_currency: state.selectedRateCurrency || '',
        selected_provider_image: state.selectedRateProviderImage || '',
        create_return_label: $('#ssb_create_return_label').is(':checked') ? '1' : '0',
        complete_order: $('#ssb_complete_order_after_purchase').is(':checked') ? '1' : '0',
        addons: state.selectedAddonsByRateId[state.selectedRateId] || {},
        base_amount: (function () {
          var rate = (state.allRates || []).find(function (r) {
            return (r.rate_id || '') === state.selectedRateId;
          });
          return rate ? (rate.amount || '0') : '0';
        })(),
        adjusted_total: state.selectedRateAmountRaw || '0'
      }
    })
      .done(function (response) {
        if (!response || !response.success || !response.data) {
          var message = (response && response.data && response.data.message) ? response.data.message : (strings.generic_error || 'Something went wrong.');
          setFeedback(message, 'error');
          $('#ssb-processing-banner').hide();
          return;
        }

        updateShipmentMeta(response.data);
        lockPurchasedState();
        updateGetRatesState();

        if (response.data.auto_return_label && response.data.auto_return_label.label_url) {
          applyReturnLabelState(
            response.data.auto_return_label.label_url,
            response.data.auto_return_label.tracking_url || ''
          );
        } else if ($('#ssb-workspace-return-label').attr('data-label-url')) {
          applyReturnLabelState(
            $('#ssb-workspace-return-label').attr('data-label-url') || '',
            $('#ssb-workspace-track-return-label').attr('href') || ''
          );
        } else {
          restoreUncheckedReturnCheckboxLabel();
        }

        syncPurchasedActionLinks(response.data);

        if (response.data.auto_return_label && response.data.auto_return_label.error) {
          setPostPurchaseActionStatus(
            'Shipping label purchased successfully, but the return label was not created automatically. ' +
            response.data.auto_return_label.error,
            'error'
          );
        }
      })
      .fail(function () {
        setFeedback(strings.generic_error || 'Something went wrong.', 'error');
        $('#ssb-processing-banner').hide();
      })
      .always(function () {
        setLoading($button, false, '', 'Purchase Shipping Label');
      });
  }

  function setExpanded(isExpanded) {
    var $card = getCard();
    var $body = getCardBody();

    if (!$card.length || !$body.length) return;

    $card.attr('data-expanded', isExpanded ? '1' : '0');

    if (isExpanded) {
      $body.stop(true, true).slideDown(180);
    } else {
      $body.stop(true, true).slideUp(180);
    }

    if (state.hasPurchasedLabel || $card.hasClass('ssb-card--purchased')) {
      updateCardSummary(
        getCurrentSummaryText(),
        isExpanded ? 'Close Fulfillment Station' : 'Open Fulfillment Station'
      );
    }

    syncCardToggleLabel(isExpanded);
  }

  function bindEvents() {
    $(document).on('click', '#ssb-card-toggle', function (event) {
      event.preventDefault();
      setExpanded(getCard().attr('data-expanded') !== '1');
    });

    $(document).on('click', '#ssb-sidebar-toggle-shipment-info', function (event) {
      event.preventDefault();

      var $toggle = $(this);
      var $details = $('#ssb-sidebar-collapsible-details');

      if (!$details.length) {
        return;
      }

      var expanded = $details.is(':visible');

      if (expanded) {
        $details.stop(true, true).slideUp(180);
        $toggle.text('Expand Shipment Info').attr('data-expanded', '0');
      } else {
        $details.stop(true, true).slideDown(180);
        $toggle.text('Collapse Details').attr('data-expanded', '1');
      }
    });

    $(document).on('click', '#ssb-shippo-get-rates', function (event) {
      event.preventDefault();
      performGetRates(collectParcel(), false);
    });

        $(document).on('change', '#ssb-rate-filter-carrier', function () {
      state.rateFilterCarrier = $(this).val() || 'all';
      renderRates(state.allRates || []);
    });

    $(document).on('change', '#ssb-rate-sort-mode', function () {
      state.rateSortMode = $(this).val() || 'cheapest';
      renderRates(state.allRates || []);
    });

    $(document).on('click', '.ssb-rate-addon-row__input', function (event) {
      event.stopPropagation();
    });

        $(document).on('change', '.ssb-rate-addon-row__input', function (event) {
      event.stopPropagation();

      var $input = $(this);
      var rateId = $input.attr('data-rate-id') || '';
      var addonKey = $input.attr('data-addon-key') || '';
      var selectedRate = null;

      if (!rateId || !addonKey) return;

      if (!state.selectedAddonsByRateId[rateId]) {
        state.selectedAddonsByRateId[rateId] = {};
      }

      state.selectedAddonsByRateId[rateId][addonKey] = $input.is(':checked');

      if (rateId === state.selectedRateId) {
        (state.allRates || []).some(function (rate) {
          if ((rate.rate_id || '') === rateId) {
            selectedRate = rate;
            return true;
          }
          return false;
        });

        if (selectedRate) {
          applySelectedRateState(selectedRate);
        }
      }

      renderRates(state.allRates || []);
    });

    $(document).on('change click', 'input[name="ssb_shippo_rate"], .ssb-rate-row', function (event) {
      var $input = $(event.target).is('input[name="ssb_shippo_rate"]')
        ? $(event.target)
        : $(this).find('input[name="ssb_shippo_rate"]');

      if (!$input.length) return;

      var rateId = $input.val() || '';
      var selectedRate = null;
      var previousRateId = state.selectedRateId || '';

      (state.allRates || []).some(function (rate) {
        if ((rate.rate_id || '') === rateId) {
          selectedRate = rate;
          return true;
        }
        return false;
      });

      if (!selectedRate) return;

      if (previousRateId && previousRateId !== rateId) {
        delete state.selectedAddonsByRateId[previousRateId];
      }

      applySelectedRateState(selectedRate);
      renderRates(state.allRates || []);
    });

    $(document).on('click', '#ssb-sidebar-purchase-label', function (event) {
      event.preventDefault();
      maybeRequireTermsThenBuy();
    });

        $(document).on('click', '#ssb-toggle-packing-note', function (event) {
      event.preventDefault();
      $('#ssb-packing-note-editor').stop(true, true).slideToggle(160);
    });

    $(document).on('click', '#ssb-save-packing-note', function (event) {
      event.preventDefault();

      var $button = $(this);
      var $status = $('#ssb-packing-note-status');

      $status.text('');
      setLoading($button, true, 'Saving...', 'Save note');

      $.ajax({
        url: window.SSB_Admin.ajax_url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: 'ssb_save_packing_note',
          nonce: getNonce(),
          order_id: getOrderId(),
          packing_note: $('#ssb_packing_note').val() || ''
        }
      })
        .done(function (response) {
          if (!response || !response.success) {
            $status.text('Unable to save note.');
            return;
          }

          $status.text('Note saved.');
        })
        .fail(function () {
          $status.text('Unable to save note.');
        })
        .always(function () {
          setLoading($button, false, '', 'Save note');
        });
    });

    $(document).on('change', '.ssb-ups-terms-check', function () {
      var allChecked = $('.ssb-ups-terms-check').length === $('.ssb-ups-terms-check:checked').length;
      $('#ssb-ups-terms-confirm').prop('disabled', !allChecked);
    });

    $(document).on('click', '#ssb-ups-terms-confirm', function (event) {
      event.preventDefault();
      closeUpsTermsModal();
      buyLabel();
    });

    $(document).on('click', '#ssb-ups-terms-close, #ssb-ups-terms-cancel, #ssb-ups-terms-modal .ssb-modal__backdrop', function (event) {
      event.preventDefault();
      closeUpsTermsModal();
    });

    $(document).on('click', '.ssb-package-tab', function (event) {
      event.preventDefault();

      var target = $(this).attr('data-ssb-package-tab') || 'custom';

      $('.ssb-package-tab')
        .removeClass('is-active')
        .attr('aria-pressed', 'false');

      $(this)
        .addClass('is-active')
        .attr('aria-pressed', 'true');

      $('.ssb-package-panel').hide();
      $('.ssb-package-panel[data-ssb-package-panel="' + target + '"]').show();
    });

    $(document).on('input change', '#ssb_shippo_weight, #ssb_shippo_length, #ssb_shippo_width, #ssb_shippo_height', function () {
      saveParcelToActiveShipmentState();
      updateGetRatesState();
      updateSidebarPackageSummary();
      scheduleAutoRates();
    });

    $(document).on('change', '#ssb_use_item_weight, #ssb_contains_alcohol, #ssb_contains_dry_ice, #ssb_create_return_label, #ssb_contains_hazmat, #ssb_additional_insurance', function () {
      var isInsuranceToggle = $(this).is('#ssb_additional_insurance');
      var isUseItemWeightToggle = $(this).is('#ssb_use_item_weight');
      var shouldRefreshRates = !$(this).is('#ssb_create_return_label') && !isInsuranceToggle;

      if (isUseItemWeightToggle) {
        applyUseItemWeightState();
      }

      if (isInsuranceToggle) {
        state.insuranceEnabled = $(this).is(':checked');

        if (state.selectedRateId) {
          var selectedRate = null;

          (state.allRates || []).some(function (rate) {
            if ((rate.rate_id || '') === state.selectedRateId) {
              selectedRate = rate;
              return true;
            }
            return false;
          });

          if (selectedRate) {
            applySelectedRateState(selectedRate);
          }
        }

        renderRates(state.allRates || []);
      }

      updateGetRatesState();
      updateSidebarPackageSummary();
      saveShipmentOptionsAndMaybeRefreshRates(shouldRefreshRates);
    });

        $(document).on('click', '#ssb-workspace-schedule-pickup', function (event) {
      event.preventDefault();

      var $button = $(this);

      if ($button.prop('disabled')) {
        return;
      }

      openSchedulePickupModal();
    });

    $(document).on('click', '#ssb-schedule-pickup-close, #ssb-schedule-pickup-cancel', function (event) {
      event.preventDefault();
      closeSchedulePickupModal();
    });

    $(document).on('click', '#ssb-schedule-pickup-modal .ssb-modal__backdrop', function (event) {
      event.preventDefault();
      closeSchedulePickupModal();
    });

    $(document).on('click', '#ssb-schedule-pickup-confirm', function (event) {
      event.preventDefault();

      var $confirm = $(this);

      setLoading($confirm, true, 'Scheduling pickup...', 'Schedule pickup');
      setPostPurchaseActionStatus('', 'info');

      $.ajax({
        url: window.SSB_Admin.ajax_url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: 'ssb_schedule_pickup',
          nonce: getNonce(),
          order_id: getOrderId(),
          transaction_id: $.trim($('#ssb-sidebar-transaction-id').text() || ''),
          pickup_date: $('#ssb-pickup-date').val() || '',
          pickup_start_time: $('#ssb-pickup-start-time').val() || '',
          pickup_end_time: $('#ssb-pickup-end-time').val() || '',
          pickup_instructions: $('#ssb-pickup-instructions').val() || ''
        }
      })
        .done(function (response) {
          if (!response || !response.success || !response.data) {
            var message = (response && response.data && response.data.message) ? response.data.message : 'Unable to schedule pickup.';
            setPostPurchaseActionStatus(message, 'error');
            return;
          }

          closeSchedulePickupModal();
          applyPickupScheduledState();

          var message = 'Pickup scheduled successfully.';
          if (response.data.confirmation_code) {
            message += ' Confirmation code: ' + response.data.confirmation_code;
          }

          setPostPurchaseActionStatus(message, 'success');
        })
        .fail(function () {
          setPostPurchaseActionStatus('Unable to schedule pickup.', 'error');
        })
        .always(function () {
          setLoading($confirm, false, '', 'Schedule pickup');
        });
    });

    $(document).on('click', '#ssb-workspace-return-label', function (event) {
      event.preventDefault();

      var $button = $(this);
      var labelUrl = $.trim($button.attr('data-label-url') || '');
      var hasReturnTracking = $.trim($('#ssb-sidebar-return-tracking').text() || '') !== '' &&
        $.trim($('#ssb-sidebar-return-tracking').text() || '') !== '—';

      if ($button.prop('disabled')) {
        return;
      }

      if (labelUrl) {
        window.open(labelUrl, '_blank', 'noopener');
        return;
      }

      if (hasReturnTracking) {
        setPostPurchaseActionStatus('A return transaction exists, but no printable return label URL is available for this order.', 'error');
        return;
      }

      openReturnLabelModal();
    });

    $(document).on('click', '#ssb-return-label-close, #ssb-return-label-cancel', function (event) {
      event.preventDefault();
      closeReturnLabelModal();
    });

    $(document).on('click', '#ssb-return-label-modal .ssb-modal__backdrop', function (event) {
      event.preventDefault();
      closeReturnLabelModal();
    });

    $(document).on('click', '#ssb-return-label-confirm', function (event) {
      event.preventDefault();

      var $confirm = $(this);
      var selections = getReturnModalSelections();

      setLoading($confirm, true, 'Creating return label...', 'Create return label');
      setPostPurchaseActionStatus('', 'info');

      $.ajax({
        url: window.SSB_Admin.ajax_url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: 'ssb_create_return_label',
          nonce: getNonce(),
          order_id: getOrderId(),
          contains_alcohol: selections.contains_alcohol ? '1' : '0',
          contains_dry_ice: selections.contains_dry_ice ? '1' : '0',
          contains_hazmat: selections.contains_hazmat ? '1' : '0',
          additional_insurance: selections.additional_insurance ? '1' : '0',
          dry_ice_weight_kg: selections.contains_dry_ice ? getReturnPreviewDryIceWeightKg() : ''
        }
      })
        .done(function (response) {
          if (!response || !response.success || !response.data) {
            var message = (response && response.data && response.data.message) ? response.data.message : 'Unable to create return label.';
            setPostPurchaseActionStatus(message, 'error');
            return;
          }

          closeReturnLabelModal();
          applyReturnLabelState(
            response.data.label_url || '',
            response.data.tracking_url || ''
          );
          updateShipmentMeta({
            auto_return_label: response.data
          });
          ensureTrackingSectionVisible();

          setPostPurchaseActionStatus('Return label created successfully.', 'success');
        })
        .fail(function () {
          setPostPurchaseActionStatus('Unable to create return label.', 'error');
        })
        .always(function () {
          setLoading($confirm, false, '', 'Create return label');
        });
    });

    $(document).on(
      'change',
      '#ssb_return_contains_alcohol, #ssb_return_contains_dry_ice, #ssb_return_contains_hazmat, #ssb_return_additional_insurance',
      function () {
        if ($('#ssb-return-label-modal').is(':visible')) {
          refreshReturnLabelPreview();
        }
      }
    );

    $(document).on('click', '#ssb-workspace-void-label', function (event) {
      event.preventDefault();

      var $button = $(this);

      if ($button.prop('disabled')) {
        return;
      }

      openVoidLabelModal();
    });

    $(document).on('click', '#ssb-workspace-void-return-label', function (event) {
      event.preventDefault();

      var $button = $(this);

      if ($button.prop('disabled')) {
        return;
      }

      openVoidReturnLabelModal();
    });

    $(document).on('click', '#ssb-void-label-close, #ssb-void-label-cancel', function (event) {
      event.preventDefault();
      closeVoidLabelModal();
    });

    $(document).on('click', '#ssb-void-label-modal .ssb-modal__backdrop', function (event) {
      event.preventDefault();
      closeVoidLabelModal();
    });

    $(document).on('click', '#ssb-void-label-confirm', function (event) {
      event.preventDefault();

      var $confirm = $(this);
      var isReturnVoid = $('#ssb-void-label-modal').attr('data-void-type') === 'return';
      var actionName = isReturnVoid ? 'ssb_request_return_refund' : 'ssb_request_refund';
      var loadingText = isReturnVoid ? 'Voiding return label...' : 'Voiding label...';
      var normalText = isReturnVoid ? 'Void Return Label' : 'Void Shipping Label';
      var transactionId = isReturnVoid
        ? $.trim($('#ssb-sidebar-return-transaction-id').text() || '')
        : $.trim($('#ssb-sidebar-transaction-id').text() || '');

      setLoading($confirm, true, loadingText, normalText);
      setPostPurchaseActionStatus('', 'info');

      $.ajax({
        url: window.SSB_Admin.ajax_url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: actionName,
          nonce: getNonce(),
          order_id: getOrderId(),
          transaction_id: transactionId
        }
      })
        .done(function (response) {
          if (!response || !response.success || !response.data) {
            var message = (response && response.data && response.data.message)
              ? response.data.message
              : (isReturnVoid ? 'Unable to void return label.' : 'Unable to void label.');
            setPostPurchaseActionStatus(message, 'error');
            return;
          }

          closeVoidLabelModal();

          if (isReturnVoid) {
            clearReturnLabelState();
            setPostPurchaseActionStatus('Return label refund requested successfully.', 'success');
          } else {
            unlockVoidedLabelState('Shipping label refund requested successfully.');
            syncOrderStatusToProcessingUi();

            $('#ssb-workspace-void-label')
              .prop('disabled', true)
              .addClass('ssb-button-link-disabled')
              .text('Voided');
          }
        })
        .fail(function () {
          setPostPurchaseActionStatus(
            isReturnVoid ? 'Unable to void return label.' : 'Unable to void label.',
            'error'
          );
        })
        .always(function () {
          setLoading($confirm, false, '', normalText);
        });
    });

    $(document).on('click', '#ssb-woo-order-edit-helper-link', function (event) {
      event.preventDefault();

      var $row = $('.wc-order-data-row.wc-order-add-item.wc-order-data-row-toggle');

      $row.show();
      hideWooOrderEditHelper();
    });

    $(document).on('change', '#ssb_shippo_label_file_type', function () {
      saveLabelFileType();
    });

  }

  function getNormalizedUiText(selector) {
  var value = $.trim($(selector).text() || '');
  return (value === '' || value === '—') ? '' : value;
}

function getNormalizedUiUrl(selector) {
  var value = $.trim($(selector).attr('href') || '');
  return (value === '' || value === '#') ? '' : value;
}

function getNormalizedUiData(selector, attrName) {
  var value = $.trim($(selector).attr(attrName) || '');
  return (value === '' || value === '#') ? '' : value;
}

function getWooOrderEditDescriptionHost() {
  var $host = $('#woocommerce-order-items').find('.wc-order-bulk-actions .description').first();

  if (!$host.length) {
    $host = $('#woocommerce-order-items').find('.add-items .description').first();
  }

  return $host;
}

function ensureWooOrderEditHelper() {
  var $host = getWooOrderEditDescriptionHost();

  if (!$host.length) {
    return;
  }

  if (!$host.find('#ssb-woo-order-edit-helper').length) {
    $host.empty().append(
      '<span id="ssb-woo-order-edit-helper" style="display:none;">' +
        '<a href="#" id="ssb-woo-order-edit-helper-link" style="color:#2271b1; text-decoration:underline;">' +
          'Edit order? New shippable items will be added to Unassigned.' +
        '</a>' +
      '</span>'
    );
  }
}

function showWooOrderEditHelper() {
  var $helper = $('#ssb-woo-order-edit-helper');
  var $link = $('#ssb-woo-order-edit-helper-link');

  if (!$helper.length || !$link.length) {
    return;
  }

  $link
    .text('Edit order? New shippable items will be added to Unassigned.')
    .css({ color: '#2271b1', textDecoration: 'underline', cursor: 'pointer' })
    .show();

  $helper.show();
}

function hideWooOrderEditHelper() {
  $('#ssb-woo-order-edit-helper').hide();
}

function syncWooOrderEditHelper() {
  var $addItemRow = $('.wc-order-data-row.wc-order-add-item.wc-order-data-row-toggle');

  ensureWooOrderEditHelper();

  if (!$addItemRow.length) {
    return;
  }

  if ($addItemRow.is(':visible')) {
    hideWooOrderEditHelper();
  } else {
    showWooOrderEditHelper();
  }
}

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function init() {
  if (!getCard().length) return;

bindEvents();
state.labelFileType = getSelectedLabelFileType();
state.insuranceEnabled = $('#ssb_additional_insurance').is(':checked');
setExpanded(false);
syncCardToggleLabel();

$('#ssb-sidebar-collapsible-details').hide();
$('#ssb-sidebar-toggle-shipment-info')
  .text('Expand Shipment Info')
  .attr('data-expanded', '0');

updateSidebarPackageSummary();
  syncForceRefreshVisibility();
  loadRateAdjustments();
  renderShipmentShell();
  renderAllocationPanel();
  hydrateWorkspaceForActiveShipment();

  $(document).on('click', '.ssb-shipment-tab:not(.ssb-shipment-tab--action)', function () {
    var rawShipmentNumber = String($(this).attr('data-shipment-number') || '1');

    setActiveShipmentNumber(rawShipmentNumber);

    $('#ssb-shipment-delete-notice').hide();
    renderShipmentShell();
    renderAllocationPanel();
    hydrateWorkspaceForActiveShipment();
  });

  $(document).on('click', '#ssb-split-shipment-trigger', function (event) {
    event.preventDefault();
    openSplitShipmentModal();
  });

  $(document).on('click', '.ssb-allocation-row-action', function (event) {
    event.preventDefault();

    var $button = $(this);
    if ($button.prop('disabled')) {
      return;
    }

    var orderItemId = parseInt($button.attr('data-order-item-id') || '0', 10) || 0;
    var maxQty = isUnassignedTabActive()
      ? (parseInt($button.attr('data-unassigned-qty') || '0', 10) || 0)
      : (parseInt($button.attr('data-max-qty') || '0', 10) || 0);

    if (!orderItemId || maxQty < 1) {
      return;
    }

    openAllocationModal(isUnassignedTabActive() ? 'allocate' : 'remove', orderItemId, maxQty);
  });

  $(document).on('click', '#ssb-allocation-action-close, #ssb-allocation-action-cancel, #ssb-allocation-action-modal .ssb-modal__backdrop', function (event) {
    event.preventDefault();
    closeAllocationModal();
  });

  $(document).on('click', '#ssb-allocation-action-confirm', function (event) {
    event.preventDefault();

    var mode = String($('#ssb-allocation-action-mode').val() || '');
    var orderItemId = parseInt($('#ssb-allocation-action-order-item-id').val() || '0', 10) || 0;
    var qty = parseInt($('#ssb-allocation-action-qty').val() || '0', 10) || 0;
    var maxQty = parseInt($('#ssb-allocation-action-max-qty').val() || '0', 10) || 0;
    var sourceShipment = parseInt($('#ssb-allocation-action-source-shipment').val() || '0', 10) || 0;
    var targetShipment = String($('#ssb-allocation-action-target').val() || '');

    if (!orderItemId || qty < 1 || qty > maxQty) {
      setFeedback('Enter a valid quantity for this allocation action.', 'error');
      return;
    }

    var ajaxData = {
      nonce: getNonce(),
      order_id: getOrderId(),
      order_item_id: orderItemId,
      qty: qty
    };

    if (mode === 'allocate') {
      ajaxData.action = 'ssb_allocate_unassigned_item';
      ajaxData.target_shipment_number = targetShipment;
    } else {
      ajaxData.action = 'ssb_remove_item_allocation';
      ajaxData.shipment_number = sourceShipment;
    }

    $.ajax({
      url: window.SSB_Admin.ajax_url,
      method: 'POST',
      dataType: 'json',
      data: ajaxData
    }).done(function (response) {
      if (!response || !response.success || !response.data) {
        setFeedback((response && response.data && response.data.message) ? response.data.message : 'Unable to update allocation.', 'error');
        return;
      }

      state.fulfillmentGroups = response.data.groups || state.fulfillmentGroups;
      setActiveShipmentNumber(response.data.active_shipment_number);
      closeAllocationModal();
      renderShipmentShell();
      renderAllocationPanel();
      hydrateWorkspaceForActiveShipment();
    }).fail(function () {
      setFeedback('Unable to update allocation.', 'error');
    });
  });

  $(document).on('click', '#ssb-split-shipment-close, #ssb-split-shipment-cancel, #ssb-split-shipment-modal .ssb-modal__backdrop', function (event) {
    event.preventDefault();

    if ($('.ssb-split-unit-check:checked').length) {
      openSplitUnsavedModal();
      return;
    }

    closeSplitShipmentModal();
  });

  $(document).on('click', '#ssb-split-unsaved-continue', function (event) {
    event.preventDefault();
    closeSplitUnsavedModal();
  });

  $(document).on('click', '#ssb-split-unsaved-discard', function (event) {
    event.preventDefault();
    closeSplitUnsavedModal();
    closeSplitShipmentModal();
  });

  $(document).on('change', '.ssb-split-parent-check', function () {
    var $checkbox = $(this);
    var orderItemId = $checkbox.attr('data-order-item-id') || '';

    $('.ssb-split-row--child[data-order-item-id="' + orderItemId + '"] .ssb-split-unit-check')
      .prop('checked', $checkbox.is(':checked'));

    refreshSplitShipmentSelectionUi();
  });

  $(document).on('change', '.ssb-split-unit-check', function () {
    refreshSplitShipmentSelectionUi();
  });

  $(document).on('change', '#ssb-split-shipment-master-toggle', function () {
    var checked = $(this).is(':checked');
    $('.ssb-split-unit-check').prop('checked', checked);
    refreshSplitShipmentSelectionUi();
  });

  $(document).on('click', '#ssb-split-shipment-select-all', function (event) {
    event.preventDefault();
    $('.ssb-split-unit-check').prop('checked', true);
    $('.ssb-split-parent-check').prop('checked', true);
    refreshSplitShipmentSelectionUi();
  });

  $(document).on('click', '#ssb-split-shipment-clear', function (event) {
    event.preventDefault();
    $('.ssb-split-unit-check').prop('checked', false);
    $('.ssb-split-parent-check').prop('checked', false);
    refreshSplitShipmentSelectionUi();
  });

  $(document).on('click', '.ssb-split-row__toggle', function (event) {
    event.preventDefault();
    var orderItemId = $(this).attr('data-order-item-id');
    var $children = $('.ssb-split-row--child[data-order-item-id="' + orderItemId + '"]');
    var isVisible = $children.is(':visible');

    $children.toggle(!isVisible);
    $(this).text(isVisible ? '▾' : '▴');
  });

  $(document).on('click', '#ssb-split-shipment-create', function (event) {
    event.preventDefault();

    var selectedUnits = [];
    var sourceShipmentNumber = String($('#ssb-split-shipment-modal').attr('data-source-shipment-number') || '');

    $('.ssb-split-unit-check:checked').each(function () {
      selectedUnits.push($(this).val());
    });

    if (!selectedUnits.length) {
      return;
    }

    if (!sourceShipmentNumber) {
      setFeedback('Select a valid shipment before continuing.', 'error');
      return;
    }

    $.ajax({
      url: window.SSB_Admin.ajax_url,
      method: 'POST',
      dataType: 'json',
      data: {
        action: 'ssb_save_split_shipment',
        nonce: getNonce(),
        order_id: getOrderId(),
        active_shipment_number: sourceShipmentNumber,
        selected_units: selectedUnits
      }
    }).done(function (response) {
      if (!response || !response.success || !response.data) {
        setFeedback((response && response.data && response.data.message) ? response.data.message : 'Unable to save split shipment.', 'error');
        return;
      }

      state.fulfillmentGroups = response.data.groups || state.fulfillmentGroups;
      setActiveShipmentNumber(response.data.active_shipment_number);
      $('#ssb-shipment-delete-notice').hide();
      closeSplitShipmentModal();
      renderShipmentShell();
      renderAllocationPanel();
      hydrateWorkspaceForActiveShipment();
    }).fail(function () {
      setFeedback('Unable to save split shipment.', 'error');
    });
  });

  $(document).on('click', '#ssb-remove-shipment', function () {
    var shipment = getActiveShipment();

    if (!shipment) {
      return;
    }

    $.ajax({
      url: window.SSB_Admin.ajax_url,
      method: 'POST',
      dataType: 'json',
      data: {
        action: 'ssb_remove_shipment_shell',
        nonce: getNonce(),
        order_id: getOrderId(),
        shipment_number: shipment.shipment_number
      }
    }).done(function (response) {
      if (!response || !response.success || !response.data) {
        var code = response && response.data && response.data.code ? response.data.code : '';
        if (code === 'shipment_has_labels') {
          $('#ssb-shipment-delete-notice').show();
        } else {
          setFeedback((response && response.data && response.data.message) ? response.data.message : 'Unable to remove shipment.', 'error');
        }
        return;
      }

      state.fulfillmentGroups = response.data.groups || state.fulfillmentGroups;
      setActiveShipmentNumber(response.data.active_shipment_number);
      $('#ssb-shipment-delete-notice').hide();
      renderShipmentShell();
      renderAllocationPanel();
      hydrateWorkspaceForActiveShipment();
    }).fail(function () {
      setFeedback('Unable to remove shipment.', 'error');
    });
  });

      updateGetRatesState();
      syncUseItemWeightAvailability();
      syncWooOrderEditHelper();

  var hasReturnLabel = $.trim($('#ssb-workspace-return-label').attr('data-label-url') || '') !== '';

  if (state.hasPurchasedLabel) {
    lockPurchasedState();
  }

  syncPurchasedActionLinks({
    provider: $('#ssb-sidebar-carrier').text() || '',
    transaction_id: $('#ssb-sidebar-transaction-id').text() || ''
  });

  if (state.hasPurchasedLabel || hasReturnLabel) {
    getCard().addClass('ssb-card--purchased');
    updateCardSummary(
      getCurrentSummaryText(),
      getCard().attr('data-expanded') === '1' ? 'Close Fulfillment Station' : 'Open Fulfillment Station'
    );
  }

  hydrateReturnOnlyCoverageSummary();
}

  init();

  $(document).on('click', '#ssb-return-fetch-rate', function (event) {
    event.preventDefault();

    var $btn = $(this);

    if ($btn.prop('disabled')) {
      return;
    }

    setLoading($btn, true, 'Fetching rate...', 'Fetch New Rate');

    if (typeof refreshReturnLabelPreview === 'function') {
      var result = refreshReturnLabelPreview();

      if (result && typeof result.always === 'function') {
        result.always(function () {
          setLoading($btn, false, '', 'Fetch New Rate');
        });
      } else {
        setLoading($btn, false, '', 'Fetch New Rate');
      }
    } else {
      setLoading($btn, false, '', 'Fetch New Rate');
    }
  });
});