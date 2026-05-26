document.addEventListener('DOMContentLoaded', function () {
  // =============================================================================
  // Shoshin /my-rosters — Task 6
  // - FIX: expand/collapse via delegated handler (no CSS.escape)
  // - FIX: icon rendering via <img> with fallback (your provided paths)
  // =============================================================================

  var listEl = document.querySelector('.shoshin-roster-list[data-shoshin-rosters-json]');
  if (!listEl) return;

  var AJAX_URL = listEl.getAttribute('data-shoshin-ajax-url') || '';
  var AJAX_NONCE = listEl.getAttribute('data-shoshin-ajax-nonce') || '';

  // ---------------------------------------------------------------------------
  // ICON PATHS (your provided URLs)
  // ---------------------------------------------------------------------------
  var ICONS = {
    unassign: '/wp-content/uploads/2025/12/Out.webp',
    assign:   '/wp-content/uploads/2025/12/In.webp',
    edit:     '/wp-content/uploads/2025/12/edit.webp',
    view:     '/wp-content/uploads/2025/12/view.webp',
    picture:  '/wp-content/uploads/2025/12/picture.webp',
    print:    '/wp-content/uploads/2025/12/print.webp',
    add:      '/wp-content/uploads/2025/12/add.webp',
    del:      '/wp-content/uploads/2025/12/delete.webp'
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function asInt(n, fallback) {
    var x = parseInt(n, 10);
    return Number.isFinite(x) ? x : (fallback || 0);
  }

  function isNumericLike(v) {
    if (v == null) return false;
    var s = String(v).trim();
    if (!s) return false;
    return /^-?\d+(\.\d+)?$/.test(s);
  }

  function withInchesIfNumeric(v) {
    if (v == null) return '—';
    var s = String(v).trim();
    if (!s) return '—';
    return isNumericLike(s) ? (s + '"') : s;
  }

  function normalizeKind(k) {
    k = String(k || '').toLowerCase();
    if (k === 'character' || k === 'char') return 'character';
    if (k === 'support' || k === 'asset') return 'support';
    return k || 'asset';
  }

    function classOrderKey(kind, cls) {
    var k = normalizeKind(kind);
    var c = String(cls || '').trim();

    // Desired display order:
    // Daimyo, Samurai, Ashigaru, Sohei, Ninja, Onmyoji, Ozutsu, Mokuzo Hansen
    var ORDER = {
      'daimyo': 0,
      'samurai': 1,
      'ashigaru': 2,
      'sohei': 3,
      'ninja': 4,
      'onmyoji': 5,
      'ozutsu': 6,
      'mokuzo hansen': 7,
      'makuzo hansen': 7 // tolerate historical spelling variance
    };

    var key = String(c || '').toLowerCase();
    key = key.replace(/\s+/g, ' ').trim();

    // Unknown classes/types go to the bottom
    var ord = (ORDER[key] != null) ? ORDER[key] : 999;

    // We still keep character vs support consistent if you want later,
    // but order above is the primary sorter.
    return String(ord).padStart(3, '0') + '|' + key + '|' + k;
  }


  // IMPORTANT: must match server-side unitKey identity
  function makeUnitKey(u) {
    var kind = normalizeKind(u.kind);
    var cls = String(u.cls || u.class || u.supportType || '').trim();
    var refId = String(u.refId || u.ref_id || '').trim();
    var name = String(u.name || u.title || '').trim();
    var img = String(u.img || u.image || u.imgUrl || '').trim();
    return kind + '|' + cls + '|' + refId + '|' + name + '|' + img;
  }

  function postAjax(action, payload) {
    if (!AJAX_URL) return Promise.reject(new Error('Missing AJAX URL'));
    if (!AJAX_NONCE) return Promise.reject(new Error('Missing AJAX nonce'));

    var fd = new FormData();
    fd.append('action', action);
    fd.append('nonce', AJAX_NONCE);
    fd.append('security', AJAX_NONCE);

    Object.keys(payload || {}).forEach(function (k) {
      fd.append(k, payload[k]);
    });

    return fetch(AJAX_URL, { method: 'POST', body: fd, credentials: 'same-origin' })
      .then(function (res) {
        return res.json().then(function (j) {
          return { ok: res.ok, json: j };
        });
      })
      .then(function (out) {
        if (!out.json || out.json.success !== true) {
          var msg = (out.json && out.json.data && out.json.data.message) ? out.json.data.message : 'Request failed.';
          throw new Error(msg);
        }
        return out.json.data;
      });
  }


function bannerValueToUrl(raw) {
  raw = String(raw || '').trim();
  if (!raw) return '';

  // WPForms file upload often stores JSON array of objects in the field value
  if (raw[0] === '[' || raw[0] === '{') {
    try {
      var j = JSON.parse(raw);
      var obj = Array.isArray(j) ? (j[0] || null) : j;
      var url = obj && obj.url ? String(obj.url).trim() : '';
      return url;
    } catch (_) {
      return '';
    }
  }

  // Already a URL/path
  return raw;
}


function resetBannerDropzoneState() {
  // Clears WPForms Dropzone + its previews + its hidden stored values
  try {
    if (clanBannerDz && typeof clanBannerDz.removeAllFiles === 'function') {
      clanBannerDz.removeAllFiles(true); // true = also cancel uploads
    }
  } catch (_) {}

  // Remove lingering preview DOM (WPForms sometimes leaves these behind)
  try {
    if (clanBannerFieldNode) {
      var previews = clanBannerFieldNode.querySelectorAll('.dz-preview, .dz-error-message, .wpforms-error, .wpforms-field-file-upload-error');
      previews.forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
    }
  } catch (_) {}

  // Clear any hidden stored-value inputs WPForms uses
  try {
    if (clanBannerHostForm) {
      var n1 = clanBannerHostForm.querySelector('input[name="wpforms[fields][8]"]');
      var n2 = clanBannerHostForm.querySelector('input[name="wpforms[files][8]"]');
      var n3 = clanBannerHostForm.querySelector('input[name="wpforms_2799_8"]');
      if (n1) n1.value = '';
      if (n2) n2.value = '';
      if (n3) n3.value = '';
    }
  } catch (_) {}

  bannerUploadedValue = '';
}

function waitForBannerValue(maxMs) {
  maxMs = maxMs || 2500;
  var start = Date.now();

  return new Promise(function (resolve) {
    (function tick() {
      var v = findWpformsUploadedValueForField8(clanBannerHostForm);
      if (v) return resolve(v);
      if (Date.now() - start >= maxMs) return resolve('');
      setTimeout(tick, 150);
    })();
  });
}



    // ---------------------------------------------------------------------------
  // ROSTER TOTALS RECOMPUTE (client-side, based on assigned_units_json)
  // ---------------------------------------------------------------------------

  function getRosterObjByEntryId(entryId) {
    entryId = asInt(entryId, 0);
    if (!entryId || !Array.isArray(rosters)) return null;
    for (var i = 0; i < rosters.length; i++) {
      var rid = asInt(rosters[i] && (rosters[i].entryId || rosters[i].id || rosters[i].entry_id), 0);
      if (rid === entryId) return rosters[i];
    }
    return null;
  }

  function supportBucketFromUnit(u) {
    // Mirror your PHP semantics: Ozutsu => Artillery, Mokuzo Hansen => Ships
    var name = String((u && (u.name || u.title)) || '').trim().toLowerCase();
    var cls  = String((u && (u.cls || u.class || u.className)) || '').trim().toLowerCase();
    var st   = String((u && u.supportType) || '').trim().toLowerCase();

    if (name === 'mokuzo hansen' || name === 'makuzo hansen' || cls === 'ships' || st === 'ships') return 'Ships';
    if (name === 'ozutsu' || cls === 'artillery' || st === 'ozutsu') return 'Artillery';
    return '';
  }

  function computeRosterTotalsFromAssigned(assignedArr) {
    var totals = {
      points: 0,
      unitCount: 0,
      initiative: 0,
      honor: 0,
      counts: {
        Daimyo: 0, Samurai: 0, Ashigaru: 0, Sohei: 0, Ninja: 0, Onmyoji: 0, Artillery: 0, Ships: 0
      }
    };

    if (!Array.isArray(assignedArr)) return totals;

    for (var i = 0; i < assignedArr.length; i++) {
      var u = assignedArr[i] || {};
      var kind = normalizeKind(u.kind);
      var qty = asInt(u.qty, 0);
      if (qty <= 0) continue;

      var cls = String(u.cls || u.class || '').trim();

      // Daimyo hard-cap at 1
      var effQty = qty;
      if (cls && cls.toLowerCase() === 'daimyo') effQty = 1;

      var points = asInt(u.points, asInt(u.cost, 0));
      totals.points += (points * effQty);
      totals.unitCount += effQty;

      var ini = asInt((u.ini != null ? u.ini : (u.stats && u.stats.ini)), 0);
      totals.initiative += (ini * effQty);

      // Honor = Leadership (LDR)
      var ldr = asInt((u.ldr != null ? u.ldr : (u.stats && u.stats.ldr)), 0);
      totals.honor += (ldr * effQty);

      if (kind === 'character') {
        if (totals.counts[cls] != null) {
          totals.counts[cls] += effQty;
          if (cls === 'Daimyo' && totals.counts.Daimyo > 1) totals.counts.Daimyo = 1;
        }
      } else if (kind === 'support') {
        var bucket = supportBucketFromUnit(u);
        if (bucket && totals.counts[bucket] != null) totals.counts[bucket] += effQty;
      }
    }

    return totals;
  }

  function updateRosterCardStatsInDom(cardEl, rosterObj, totals) {
    if (!cardEl || !totals) return;

    // Update Row1: Total Clan Points + Master Class Abilities
    var headerMain = cardEl.querySelector('.shoshin-asset-header-main');
    if (headerMain) {
      var descs = headerMain.querySelectorAll('.shoshin-asset-class-desc');
      if (descs && descs.length >= 2) {
        descs[0].innerHTML = '<strong>Total Clan Points:</strong> ' + esc(asInt(totals.points, 0));
        var mca = Math.floor(asInt(totals.points, 0) / 125);
        descs[1].innerHTML = '<strong>Master Class Abilities:</strong> <strong>' + esc(mca) + '</strong>';
      }
    }

    // Update dataset for filters/paging
    cardEl.setAttribute('data-clan-points', String(asInt(totals.points, 0)));

    // Update Row2 cells by index:
    // 1 Ref, 2 Units, 3 Initiative, 4 Honor, 5 Daimyo, 6 Samurai, 7 Ashigaru, 8 Sohei, 9 Ninja, 10 Onmyoji, 11 Artillery, 12 Ships
    var row2 = cardEl.querySelector('.shoshin-asset-stat-row table.shoshin-stat-strip tbody tr');
    if (row2) {
      var tds = row2.querySelectorAll('td');

      function setTdVal(idx1Based, val) {
        var td = tds && tds[idx1Based - 1];
        if (!td) return;
        var v = td.querySelector('.shoshin-stat-value');
        if (v) v.textContent = String(val);
      }

      setTdVal(2, asInt(totals.unitCount, 0));
      setTdVal(3, asInt(totals.initiative, 0));
      setTdVal(4, asInt(totals.honor, 0));

      setTdVal(5, (totals.counts && totals.counts.Daimyo) || 0);
      setTdVal(6, (totals.counts && totals.counts.Samurai) || 0);
      setTdVal(7, (totals.counts && totals.counts.Ashigaru) || 0);
      setTdVal(8, (totals.counts && totals.counts.Sohei) || 0);
      setTdVal(9, (totals.counts && totals.counts.Ninja) || 0);
      setTdVal(10, (totals.counts && totals.counts.Onmyoji) || 0);
      setTdVal(11, (totals.counts && totals.counts.Artillery) || 0);
      setTdVal(12, (totals.counts && totals.counts.Ships) || 0);
    }

    // Sync in-memory roster object so future operations use updated snapshot
    if (rosterObj) {
      rosterObj.points = asInt(totals.points, 0);
      rosterObj.unitCount = asInt(totals.unitCount, 0);
      rosterObj.initiative = asInt(totals.initiative, 0);
      rosterObj.honor = asInt(totals.honor, 0);
      rosterObj.counts = totals.counts || rosterObj.counts || {};
    }
  }


    // -------------------------------------------------------------------------
  // DELETE MODAL (Roster delete) — mirror /my-assets delete modal UX
  // -------------------------------------------------------------------------
  var deleteModal = null;
  var deleteModalBackdrop = null;
  var deleteModalOnConfirm = null;
  var deleteModalBusy = false;
  var deleteModalEscBound = false;

  function setModalVisible(modalEl, backdropEl, isOpen) {
    if (backdropEl) {
      backdropEl.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      backdropEl.style.display = isOpen ? 'block' : 'none';
      backdropEl.style.pointerEvents = isOpen ? 'auto' : 'none';
    }

    if (modalEl) {
      if (isOpen) modalEl.classList.add('is-open');
      else modalEl.classList.remove('is-open');

      modalEl.style.display = isOpen ? 'flex' : 'none';
      modalEl.style.pointerEvents = isOpen ? 'auto' : 'none';
    }

    if (!isOpen) {
      var anyOpen = !!document.querySelector('.shoshin-modal.is-open');
      if (!anyOpen) document.body.classList.remove('shoshin-modal-open');
    } else {
      document.body.classList.add('shoshin-modal-open');
    }
  }

  function clearDeleteModalError() {
    if (!deleteModal) return;
    var el = deleteModal.querySelector('.shoshin-modal-error');
    if (el) {
      el.style.display = 'none';
      el.textContent = '';
    }
  }

  function showDeleteModalError(msg) {
    if (!deleteModal) return;
    var el = deleteModal.querySelector('.shoshin-modal-error');
    if (el) {
      el.textContent = String(msg || 'Delete failed.');
      el.style.display = 'block';
    }
  }

  function setDeleteModalBusy(isBusy) {
    if (!deleteModal) return;
    var confirmBtn = deleteModal.querySelector('.shoshin-modal-btn-confirm');
    var cancelBtn = deleteModal.querySelector('.shoshin-modal-btn-cancel');
    var xBtn = deleteModal.querySelector('.shoshin-modal-x');

    if (confirmBtn) confirmBtn.disabled = !!isBusy;
    if (cancelBtn) cancelBtn.disabled = !!isBusy;
    if (xBtn) xBtn.disabled = !!isBusy;

    if (confirmBtn) confirmBtn.textContent = isBusy ? 'Working…' : 'Confirm';
  }

  function setDeleteModalBodyText(titleText, descText) {
    if (!deleteModal) return;
    var titleEl = deleteModal.querySelector('#shoshin-delete-modal-title');
    var descEl = deleteModal.querySelector('#shoshin-delete-modal-desc');
    if (titleEl) titleEl.textContent = titleText || 'Are you sure?';
    if (descEl) descEl.textContent = descText || 'Deleting this roster is permanent and is not recoverable!';
  }

  function ensureDeleteModal() {
    if (deleteModal && deleteModalBackdrop) return;

    deleteModalBackdrop = document.createElement('div');
    deleteModalBackdrop.className = 'shoshin-modal-backdrop';
    deleteModalBackdrop.setAttribute('aria-hidden', 'true');

    deleteModal = document.createElement('div');
    deleteModal.className = 'shoshin-modal shoshin-delete-modal';
    deleteModal.setAttribute('role', 'dialog');
    deleteModal.setAttribute('aria-modal', 'true');
    deleteModal.setAttribute('aria-labelledby', 'shoshin-delete-modal-title');
    deleteModal.setAttribute('aria-describedby', 'shoshin-delete-modal-desc');

    deleteModal.innerHTML =
      '<div class="shoshin-modal-header">' +
        '<img class="shoshin-modal-logo" src="/wp-content/uploads/2025/11/Header_logo_300x150_1.png" alt="Site logo" />' +
        '<button type="button" class="shoshin-modal-x" aria-label="Close">×</button>' +
      '</div>' +
      '<div class="shoshin-modal-body">' +
        '<div id="shoshin-delete-modal-title" class="shoshin-modal-title">Are you sure?</div>' +
        '<div id="shoshin-delete-modal-desc" class="shoshin-modal-desc">Deleting this roster is permanent and is not recoverable!</div>' +
        '<div class="shoshin-modal-error" style="display:none"></div>' +
      '</div>' +
      '<div class="shoshin-modal-actions">' +
        '<button type="button" class="shoshin-modal-btn shoshin-modal-btn-cancel">Cancel</button>' +
        '<button type="button" class="shoshin-modal-btn shoshin-modal-btn-confirm">Confirm</button>' +
      '</div>';

    document.body.appendChild(deleteModalBackdrop);
    document.body.appendChild(deleteModal);

    deleteModalBackdrop.addEventListener('click', closeDeleteModal);

    var xBtn = deleteModal.querySelector('.shoshin-modal-x');
    var cancelBtn = deleteModal.querySelector('.shoshin-modal-btn-cancel');
    if (xBtn) xBtn.addEventListener('click', closeDeleteModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeDeleteModal);

    var confirmBtn = deleteModal.querySelector('.shoshin-modal-btn-confirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        if (deleteModalBusy) return;

        var fn = deleteModalOnConfirm;
        if (typeof fn !== 'function') {
          clearDeleteModalError();
          showDeleteModalError('Delete handler not configured.');
          return;
        }

        deleteModalBusy = true;
        clearDeleteModalError();
        setDeleteModalBusy(true);

        Promise.resolve()
          .then(function () { return fn(); })
          .then(function () { closeDeleteModal(); })
          .catch(function (err) {
            var msg = err && err.message ? err.message : 'Delete failed.';
            showDeleteModalError(msg);
          })
          .finally(function () {
            deleteModalBusy = false;
            setDeleteModalBusy(false);
            try { confirmBtn.focus(); } catch (_) {}
          });
      });
    }

    if (!deleteModalEscBound) {
      deleteModalEscBound = true;
      document.addEventListener('keydown', function (e) {
        if (!deleteModalBackdrop || deleteModalBackdrop.getAttribute('aria-hidden') === 'true') return;
        if (e.key === 'Escape') closeDeleteModal();
      });
    }
  }

  function openDeleteModal(titleText, descText, onConfirm) {
    ensureDeleteModal();
    deleteModalOnConfirm = onConfirm || null;

    deleteModalBusy = false;
    clearDeleteModalError();
    setDeleteModalBusy(false);

    setDeleteModalBodyText(titleText, descText);

    setModalVisible(deleteModal, deleteModalBackdrop, true);

    var confirmBtn = deleteModal.querySelector('.shoshin-modal-btn-confirm');
    if (confirmBtn) confirmBtn.focus();
  }

  function closeDeleteModal() {
    if (!deleteModalBackdrop || !deleteModal) return;

    deleteModalOnConfirm = null;
    deleteModalBusy = false;
    clearDeleteModalError();
    setDeleteModalBusy(false);

    setModalVisible(deleteModal, deleteModalBackdrop, false);
  }

    // -------------------------------------------------------------------------
  // UNASSIGN MODAL (Row3) — Assign-modal look/feel + preview, uses shoshin_set_unit_qty
  // Option A (consolidated): selector chooses FINAL quantity (including 0 for full removal)
  // -------------------------------------------------------------------------
  var unassignModal = null;
  var unassignModalBackdrop = null;
  var unassignBusy = false;
  var unassignCtx = null;
  // ctx: { cardEl, trEl, rosterEntryId, unitKey, unitLabel, refId, img, rosterObj, assignedArr, currentQty }

  function ensureUnassignModal() {
    if (unassignModal && unassignModalBackdrop) return;

    unassignModalBackdrop = document.createElement('div');
    unassignModalBackdrop.className = 'shoshin-modal-backdrop';
    unassignModalBackdrop.style.display = 'none';
    unassignModalBackdrop.setAttribute('aria-hidden', 'true');

    unassignModal = document.createElement('div');
    unassignModal.className = 'shoshin-modal shoshin-modal-delete'; // reuse baseline modal styling
    unassignModal.style.display = 'none';
    unassignModal.setAttribute('role', 'dialog');
    unassignModal.setAttribute('aria-modal', 'true');
    unassignModal.setAttribute('aria-labelledby', 'shoshin-unassign-modal-title');
    unassignModal.setAttribute('aria-describedby', 'shoshin-unassign-modal-desc');

    // NOTE: We intentionally reuse Assign-modal class names for Row1 + roster preview skeleton (no toggle)
    unassignModal.innerHTML =
      '<div class="shoshin-modal-header">' +
        '<img class="shoshin-modal-logo" src="/wp-content/uploads/2025/11/Header_logo_300x150_1.png" alt="Site logo" />' +
        '<button type="button" class="shoshin-modal-x" aria-label="Close">×</button>' +
      '</div>' +
      '<div class="shoshin-modal-body">' +
        '<div id="shoshin-unassign-modal-title" class="shoshin-modal-title"></div>' +

        '<div class="shoshin-assign-row1" style="margin-top:10px;">' +
          '<div class="shoshin-assign-asset">' +
            '<img class="shoshin-assign-asset-img" alt="Asset image" />' +
            '<div class="shoshin-assign-asset-meta">' +
              '<div class="shoshin-assign-asset-class"></div>' +
              '<div class="shoshin-assign-asset-ref"></div>' +
              '<div class="shoshin-unassign-current-qty"></div>' +
            '</div>' +

          '</div>' +
          '<div class="shoshin-assign-qty">' +
            '<div class="shoshin-assign-qty-title">New Quantity</div>' +
            '<select class="shoshin-assign-qty-select"></select>' +
          '</div>' +
        '</div>' +

        '<div id="shoshin-unassign-modal-desc" class="shoshin-modal-desc" style="margin-top:12px;"></div>' +

        '<div class="shoshin-unassign-preview" style="margin-top:12px;"></div>' +

        '<div class="shoshin-modal-error" style="display:none"></div>' +
      '</div>' +
      '<div class="shoshin-modal-actions">' +
        '<button type="button" class="shoshin-modal-btn shoshin-modal-btn-cancel">Cancel</button>' +
        '<button type="button" class="shoshin-modal-btn shoshin-modal-btn-confirm">Unassign</button>' +
      '</div>';

    document.body.appendChild(unassignModalBackdrop);
    document.body.appendChild(unassignModal);

    // Close handlers
    unassignModalBackdrop.addEventListener('click', closeUnassignModal);
    var xBtn = unassignModal.querySelector('.shoshin-modal-x');
    var cancelBtn = unassignModal.querySelector('.shoshin-modal-btn-cancel');
    if (xBtn) xBtn.addEventListener('click', closeUnassignModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeUnassignModal);

    // Qty select change -> update preview
    var qtySel = unassignModal.querySelector('.shoshin-assign-qty-select');
    if (qtySel) {
      qtySel.addEventListener('change', function () {
        if (!unassignCtx) return;
        unassignCtx.selectedQty = asInt(qtySel.value, 0);
        recomputeUnassignPreview();
      });
    }

    // Confirm
    var confirmBtn = unassignModal.querySelector('.shoshin-modal-btn-confirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        if (unassignBusy) return;
        if (!unassignCtx) return;

        var newQty = asInt(unassignCtx.selectedQty, 0);
        if (newQty === unassignCtx.currentQty) {
          // should never happen because we don't offer current qty option
          closeUnassignModal();
          return;
        }

        unassignBusy = true;
        clearUnassignModalError();
        setUnassignModalBusy(true);

        postAjax('shoshin_set_unit_qty', {
          rosterEntryId: String(unassignCtx.rosterEntryId),
          unitKey: String(unassignCtx.unitKey),
          qty: String(newQty)
        }).then(function (data) {
          // Expect: { entryId, assigned_units_json, assigned_units_digest }
          if (data && data.assigned_units_json != null) {
            if (unassignCtx.rosterObj) {
              unassignCtx.rosterObj.assigned_units_json = String(data.assigned_units_json || '');
            }
          }

          // Parse updated assigned units
          var updatedAssigned = [];
          try {
            updatedAssigned = JSON.parse(String((unassignCtx.rosterObj && unassignCtx.rosterObj.assigned_units_json) || '[]')) || [];
          } catch (e) { updatedAssigned = []; }

          // Find this unit row in updated list
          var found = null;
          for (var i = 0; i < updatedAssigned.length; i++) {
            if (String(updatedAssigned[i] && updatedAssigned[i].unitKey) === String(unassignCtx.unitKey)) {
              found = updatedAssigned[i];
              break;
            }
          }

          // Update DOM row
          if (!found) {
            if (unassignCtx.trEl && unassignCtx.trEl.parentNode) {
              unassignCtx.trEl.parentNode.removeChild(unassignCtx.trEl);
            }
          } else {
            var tds = unassignCtx.trEl ? unassignCtx.trEl.querySelectorAll('td') : null;
            if (tds && tds.length >= 3) {
              tds[2].textContent = String(asInt(found.qty, 1));
            }
          }

          // Update totals on the roster card
          var totals = computeRosterTotalsFromAssigned(updatedAssigned);
          updateRosterCardStatsInDom(unassignCtx.cardEl, unassignCtx.rosterObj, totals);

          // Empty state if no assigned left
          var tbody = unassignCtx.cardEl ? unassignCtx.cardEl.querySelector('.shoshin-assigned-strip tbody') : null;
          if (tbody && tbody.children.length === 0) {
            var block = unassignCtx.cardEl.querySelector('.shoshin-asset-block');
            if (block) {
              var scroll = unassignCtx.cardEl.querySelector('.shoshin-roster-assigned-scroll');
              if (scroll) scroll.parentNode.removeChild(scroll);

              var empty = document.createElement('div');
              empty.className = 'shoshin-expansion-empty';
              empty.textContent = 'This clan currently has no assigned units.';
              block.appendChild(empty);
            }
          }

          // Re-run filter/paging since points may have changed
          if (typeof applyRosterFilterAndPaging === 'function') {
            applyRosterFilterAndPaging();
          }

          closeUnassignModal();
        }).catch(function (err) {
          showUnassignModalError(err && err.message ? err.message : 'Unassign failed.');
        }).finally(function () {
          unassignBusy = false;
          setUnassignModalBusy(false);
        });
      });
    }
  }

  function setUnassignModalBusy(isBusy) {
    if (!unassignModal) return;
    var confirmBtn = unassignModal.querySelector('.shoshin-modal-btn-confirm');
    var cancelBtn = unassignModal.querySelector('.shoshin-modal-btn-cancel');
    var xBtn = unassignModal.querySelector('.shoshin-modal-x');
    if (confirmBtn) confirmBtn.disabled = !!isBusy;
    if (cancelBtn) cancelBtn.disabled = !!isBusy;
    if (xBtn) xBtn.disabled = !!isBusy;
  }

  function clearUnassignModalError() {
    if (!unassignModal) return;
    var errEl = unassignModal.querySelector('.shoshin-modal-error');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  }

  function showUnassignModalError(msg) {
    if (!unassignModal) return;
    var errEl = unassignModal.querySelector('.shoshin-modal-error');
    if (errEl) { errEl.textContent = String(msg || 'Request failed.'); errEl.style.display = 'block'; }
  }

  function buildUnassignAfterAssigned(selectedQty) {
    var after = [];
    var src = (unassignCtx && Array.isArray(unassignCtx.assignedArr)) ? unassignCtx.assignedArr : [];
    for (var i = 0; i < src.length; i++) {
      var row = src[i];
      if (!row) continue;
      if (String(row.unitKey) === String(unassignCtx.unitKey)) {
        if (selectedQty > 0) {
          var copy = Object.assign({}, row);
          copy.qty = selectedQty;
          after.push(copy);
        }
        // if selectedQty === 0 => omit row entirely
      } else {
        after.push(row);
      }
    }
    return after;
  }

  function renderUnassignPreviewRow(rosterObj, totals) {
    // Mirror /my-assets Assign modal roster row skeleton (no toggle)
    var name = (rosterObj && (rosterObj.name || rosterObj.rosterName)) ? String(rosterObj.name || rosterObj.rosterName) : 'Untitled Roster';
    var refId = (rosterObj && (rosterObj.refId || rosterObj.ref_id)) ? String(rosterObj.refId || rosterObj.ref_id) : '';
    var avatarRaw = (rosterObj && (rosterObj.icon || rosterObj.img || rosterObj.image)) ? String(rosterObj.icon || rosterObj.img || rosterObj.image) : '';
var avatar = bannerValueToUrl(avatarRaw) || '/wp-content/uploads/2025/12/Helmet-grey.jpg';


    var pts = asInt(totals.points, 0);
    var units = asInt((totals.units != null ? totals.units : totals.unitCount), 0);

    var ini = asInt(totals.initiative, 0);
    var honor = asInt(totals.honor, 0);

    return (
      '<div class="shoshin-assign-roster-row" style="margin-top:10px;">' +
        '<div class="shoshin-roster-left">' +
          '<img class="shoshin-roster-avatar" src="' + esc(avatar) + '" alt="Roster icon" />' +
        '</div>' +
        '<div class="shoshin-roster-main">' +
          '<div class="shoshin-roster-title">' +
            '<div class="shoshin-roster-name">' + esc(name) + '</div>' +
            '<div class="shoshin-roster-ref">' + (refId ? ('REF ID: ' + esc(refId)) : '') + '</div>' +
          '</div>' +
          '<div class="shoshin-roster-stats">' +
            '<table class="shoshin-stat-strip"><tbody><tr>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">CLAN POINTS</div><div class="shoshin-stat-value">' + esc(pts) + '</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">UNITS</div><div class="shoshin-stat-value">' + esc(units) + '</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">INITIATIVE</div><div class="shoshin-stat-value">' + esc(ini) + '</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">HONOR</div><div class="shoshin-stat-value">' + esc(honor) + '</div></div></td>' +
            '</tr></tbody></table>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function recomputeUnassignPreview() {
    if (!unassignModal || !unassignCtx) return;

    var selectedQty = asInt(unassignCtx.selectedQty, 0);
    var afterAssigned = buildUnassignAfterAssigned(selectedQty);
    var totals = computeRosterTotalsFromAssigned(afterAssigned);

    var previewWrap = unassignModal.querySelector('.shoshin-unassign-preview');
    if (previewWrap) {
      previewWrap.innerHTML = renderUnassignPreviewRow(unassignCtx.rosterObj, totals);
    }
  }

  function openUnassignModal(ctx) {
    ensureUnassignModal();
    unassignCtx = ctx || null;
    clearUnassignModalError();

    // Fill top row content
    var titleEl = unassignModal.querySelector('#shoshin-unassign-modal-title');
    var descEl = unassignModal.querySelector('#shoshin-unassign-modal-desc');
    var imgEl = unassignModal.querySelector('.shoshin-assign-asset-img');
    var clsEl = unassignModal.querySelector('.shoshin-assign-asset-class');
    var refEl = unassignModal.querySelector('.shoshin-assign-asset-ref');
    var curQtyEl = unassignModal.querySelector('.shoshin-unassign-current-qty');
    var qtySel = unassignModal.querySelector('.shoshin-assign-qty-select');

    var label = String((ctx && ctx.unitLabel) || '');
    var refId = String((ctx && ctx.refId) || '');
    var img = String((ctx && ctx.img) || '');
    if (!img) img = '/wp-content/uploads/2025/12/Helmet-grey.jpg';

    if (imgEl) imgEl.src = img;
    if (clsEl) clsEl.textContent = label;
    if (refEl) refEl.textContent = refId;

    var currentQty = asInt((ctx && ctx.currentQty), 1);
    if (curQtyEl) {
  curQtyEl.textContent = 'Current QTY: ' + currentQty;
}


    // Header + message rules
    if (currentQty === 1) {
      if (titleEl) titleEl.textContent = 'Unassign completely from this clan?';
      if (descEl) {
        descEl.textContent = 'Removing ' + label + ' ' + refId + ' from this clan? ' +
          'This action will completely remove this unit and cannot be undone!';
      }
    } else {
      if (titleEl) titleEl.textContent = 'How many units to Unassign?';
      if (descEl) {
        descEl.textContent = 'Select the qty of ' + label + ' ' + refId + ' to unassign from this clan? ' +
          'This action will completely remove these units and cannot be undone!';
      }
    }

    // Build selector options: 0..(currentQty-1) (no "current qty" option)
    if (qtySel) {
      qtySel.innerHTML = '';

      if (currentQty === 1) {
        // Locked to 0
        var opt0 = document.createElement('option');
        opt0.value = '0';
        opt0.textContent = '0';
        qtySel.appendChild(opt0);
        qtySel.value = '0';
        qtySel.disabled = true;
        unassignCtx.selectedQty = 0;
      } else {
        // 0 option (full removal)
        var o0 = document.createElement('option');
        o0.value = '0';
        o0.textContent = '0';
        qtySel.appendChild(o0);

        for (var q = 1; q <= currentQty - 1; q++) {
          var o = document.createElement('option');
          o.value = String(q);
          o.textContent = String(q);
          qtySel.appendChild(o);
        }
        // default selection: currentQty - 1 (remove 1)
        qtySel.value = String(currentQty - 1);
        qtySel.disabled = false;
        unassignCtx.selectedQty = currentQty - 1;
      }
    }

    // Compute preview
    recomputeUnassignPreview();

    setModalVisible(unassignModal, unassignModalBackdrop, true);
  }

  function closeUnassignModal() {
    if (!unassignModal || !unassignModalBackdrop) return;
    unassignCtx = null;
    clearUnassignModalError();
    setUnassignModalBusy(false);
    setModalVisible(unassignModal, unassignModalBackdrop, false);
  }

  // -------------------------------------------------------------------------
// CLAN BANNER MODAL — Helpers/Constants (MUST be defined before modal opens)
// -------------------------------------------------------------------------
var DEFAULT_BANNER = '/wp-content/uploads/2025/12/Helmet-grey.jpg';

// --- Banner modal: one-time WPForms AJAX bind guard
// --- Banner modal: uses global window.ShoshinAjax (Option 1)
function bannerAjax(action, payload) {
  if (!window.ShoshinAjax || !window.ShoshinAjax.ajaxUrl || !window.ShoshinAjax.nonce) {
    return Promise.reject(new Error('Banner update is not configured (missing ajaxUrl/nonce).'));
  }

  var fd = new FormData();
  fd.append('action', action);
  fd.append('nonce', window.ShoshinAjax.nonce);
  fd.append('security', window.ShoshinAjax.nonce);

  Object.keys(payload || {}).forEach(function (k) {
    fd.append(k, payload[k]);
  });

  return fetch(window.ShoshinAjax.ajaxUrl, {
    method: 'POST',
    body: fd,
    credentials: 'same-origin'
  })
  .then(function (res) {
    return res.json().then(function (j) {
      if (!j || j.success !== true) {
        var msg = (j && j.data && j.data.message) ? j.data.message : 'Request failed.';
        throw new Error(msg);
      }
      return j.data;
    });
  });
}


// --- Update roster card avatar in DOM (no refresh)
function updateRosterCardAvatar(entryId, newSrc) {
  entryId = String(entryId || '').trim();
  newSrc = String(newSrc || '').trim();
  if (!entryId || !newSrc) return;

  var card = document.querySelector('.shoshin-roster-card[data-roster-entry-id="' + entryId.replace(/"/g, '\\"') + '"]');
  if (!card) return;

  var imgEl = card.querySelector('.shoshin-asset-avatar img');
  if (imgEl) imgEl.setAttribute('src', newSrc);
}


  // Also clear WPForms' Dropzone host state classes + shadow input
  try {
    if (clanBannerFieldNode) {
      var uploader = clanBannerFieldNode.querySelector('.wpforms-uploader');
      if (uploader) {
        uploader.classList.remove('dz-started');
        uploader.classList.remove('dz-max-files-reached');
      }

      // Clear the Dropzone "shadow" input WPForms uses (NOT wpforms[fields][8])
      var shadow = clanBannerFieldNode.querySelector('input.dropzone-input#wpforms-2799-field_8');
      if (shadow) shadow.value = '';
    }
  } catch (_) {}



var bannerPreviewObjectUrl = null;
var clanBannerDz = null; // track Dropzone instance for field_8
var bannerUploadedValue = '';     // Last known stored value WPForms wrote for field 8

function findWpformsUploadedValueForField8(formEl) {
  if (!formEl) return '';

  // 0) Dropzone shadow input (THIS is what your HTML shows)
  var shadow = formEl.querySelector('#wpforms-2799-field_8, input[name="wpforms_2799_8"]');
  if (shadow && String(shadow.value || '').trim()) return String(shadow.value).trim();

  // 1) Some WPForms configs also write a hidden JSON field
  var primary = formEl.querySelector('input[name="wpforms[fields][8]"]');
  if (primary && String(primary.value || '').trim()) return String(primary.value).trim();

  var secondary = formEl.querySelector('input[name="wpforms[files][8]"]');
  if (secondary && String(secondary.value || '').trim()) return String(secondary.value).trim();

  return '';
}



function getRosterCardMeta(card) {
  if (!card) return { name:'', ref:'', imgRaw:'', imgShown:'' };

  var nameEl = card.querySelector('.shoshin-asset-class-name');
  var refEl  = card.querySelector('.shoshin-ref-td .shoshin-stat-value');
  var imgEl  = card.querySelector('.shoshin-asset-avatar img');

  var name = nameEl ? String(nameEl.textContent || '').trim() : '';
  var ref  = refEl ? String(refEl.textContent || '').trim() : '';

  // What the card is currently displaying
  var imgShown = imgEl ? String(imgEl.getAttribute('src') || '').trim() : '';

  // Try to read the "real" stored banner from the in-memory roster object (field_8)
  var entryId = asInt(card.getAttribute('data-roster-entry-id'), 0);
  var rosterObj = getRosterObjByEntryId(entryId);

    var imgRaw = '';
  if (rosterObj) {
    imgRaw = String(
      rosterObj.icon ||
      rosterObj.icon_url ||
      rosterObj.roster_icon ||
      rosterObj.field_8 ||
      rosterObj['8'] ||
      ''
    ).trim();
  }

  var imgUrl = bannerValueToUrl(imgRaw); // ✅ normalize for display decisions

  return { name:name, ref:ref, imgRaw:imgRaw, imgUrl:imgUrl, imgShown:imgShown };

}

function setBannerPreview(src) {
  if (!clanBannerModal) return;
  var img = clanBannerModal.querySelector('.shoshin-banner-preview-img');
  if (img) img.src = (src && String(src).trim()) ? String(src).trim() : DEFAULT_BANNER;
}

function syncRemoveToggleState(hasCustomBanner) {
  if (!clanBannerModal) return;

  var toggle = clanBannerModal.querySelector('.shoshin-banner-remove-toggle');
  var hint   = clanBannerModal.querySelector('.shoshin-banner-remove-hint');
  if (!toggle) return;

  if (!hasCustomBanner) {
    toggle.checked = false;
    toggle.disabled = true;
    if (hint) hint.textContent = 'No banner to remove.';
  } else {
    toggle.disabled = false;
    if (hint) hint.textContent = 'Toggle ON to delete current banner.';
  }
}

function bindBannerFieldPreview() {
  if (!clanBannerModal) return;
  if (!clanBannerFieldNode) return;

  // -----
  // 1) Clear stacked Dropzone UI each time modal opens
  // -----
  try {
    // Remove any prior previews/errors that might be lingering
    var previews = clanBannerFieldNode.querySelectorAll('.dz-preview, .dz-error-message, .wpforms-error, .wpforms-field-file-upload-error');
    previews.forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });

    // Also clear any "error" classes that make text overlay/stack
    var errWrap = clanBannerFieldNode.querySelector('.wpforms-error-container');
    if (errWrap) errWrap.textContent = '';

    // If there's a hidden input WPForms uses for uploaded file value, clear it
    try {
  var v1 = clanBannerFieldNode.querySelector('#wpforms-2799-field_8');
  var v2 = clanBannerFieldNode.querySelector('input[name="wpforms_2799_8"]');
  var v3 = clanBannerHostForm && clanBannerHostForm.querySelector('input[name="wpforms[fields][8]"]');
  var v4 = clanBannerHostForm && clanBannerHostForm.querySelector('input[name="wpforms[files][8]"]');

  if (v1) v1.value = '';
  if (v2) v2.value = '';
  if (v3) v3.value = '';
  if (v4) v4.value = '';
} catch (_) {}

  } catch (_) {}

  // -----
  // 2) Bind to Dropzone events (WPForms uploader)
  // -----
  // WPForms typically attaches Dropzone to a container element; when it exists, it will be:
  //   element.dropzone (Dropzone instance)
  // We hunt for a likely dropzone host inside field #8 container.
    // WPForms attaches Dropzone to .wpforms-uploader for this field
  var dzHost = clanBannerFieldNode.querySelector('.wpforms-uploader');
  var dz = (dzHost && dzHost.dropzone) ? dzHost.dropzone : null;

  // Fallback: some builds require Dropzone.forElement()
  if (!dz && dzHost && window.Dropzone && typeof window.Dropzone.forElement === 'function') {
    try { dz = window.Dropzone.forElement(dzHost); } catch (_) { dz = null; }
  }

  clanBannerDz = dz || null;

  // Cache the WPForms-stored value after upload finishes
if (dz) {
  dz.on('success', function () {
    bannerUploadedValue = findWpformsUploadedValueForField8(clanBannerHostForm) || bannerUploadedValue;
  });
  dz.on('queuecomplete', function () {
    bannerUploadedValue = findWpformsUploadedValueForField8(clanBannerHostForm) || bannerUploadedValue;
  });
}



  // If Dropzone isn't available for any reason, fall back to file input change.
  if (!dz) {
    var fileInput =
      clanBannerFieldNode.querySelector('#wpforms-2799-field_8') ||
      clanBannerFieldNode.querySelector('input[type="file"][name^="wpforms[fields][8]"]');

    if (!fileInput) return;

    if (fileInput.dataset.shoshinPreviewBound === '1') return;
    fileInput.dataset.shoshinPreviewBound = '1';

    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

      var toggle = clanBannerModal.querySelector('.shoshin-banner-remove-toggle');
      if (toggle) toggle.checked = false;

      if (bannerPreviewObjectUrl) {
        try { URL.revokeObjectURL(bannerPreviewObjectUrl); } catch (_) {}
        bannerPreviewObjectUrl = null;
      }

      if (f) {
        bannerPreviewObjectUrl = URL.createObjectURL(f);
        setBannerPreview(bannerPreviewObjectUrl);
      }
    });

    return;
  }

  // Avoid re-binding if modal opened multiple times
  if (dz.__shoshinBound === true) return;
  dz.__shoshinBound = true;

  dz.on('addedfile', function (file) {

    // HARD ENFORCE max-1 at Dropzone state level (prevents "max number allowed (1)" after delete/upload/delete/upload)
    try {
      if (dz.files && dz.files.length > 1) {
        // remove all but the newest file (the last one in the array)
        for (var i = 0; i < dz.files.length - 1; i++) {
          dz.removeFile(dz.files[i]);
        }
      }
    } catch (_) {}


    // Ensure only one preview item "wins" visually (prevents stacking overlap)
    try {
      var previews = dz.previewsContainer ? dz.previewsContainer.querySelectorAll('.dz-preview') : null;
      if (previews && previews.length > 1) {
        for (var i = 0; i < previews.length - 1; i++) {
          previews[i].parentNode && previews[i].parentNode.removeChild(previews[i]);
        }
      }
    } catch (_) {}

    // Turn OFF remove toggle if a new file is selected
    var toggle = clanBannerModal.querySelector('.shoshin-banner-remove-toggle');
    if (toggle) toggle.checked = false;

    // Update our 96x96 preview with the selected file immediately
    if (bannerPreviewObjectUrl) {
      try { URL.revokeObjectURL(bannerPreviewObjectUrl); } catch (_) {}
      bannerPreviewObjectUrl = null;
    }
    try {
      if (file) {
        bannerPreviewObjectUrl = URL.createObjectURL(file);
        setBannerPreview(bannerPreviewObjectUrl);
      }
    } catch (_) {}
  });

  dz.on('error', function () {
    // When Dropzone errors, it tends to stack UI; keep it trimmed to one
    try {
      var previews = dz.previewsContainer ? dz.previewsContainer.querySelectorAll('.dz-preview') : null;
      if (previews && previews.length > 1) {
        for (var i = 0; i < previews.length - 1; i++) {
          previews[i].parentNode && previews[i].parentNode.removeChild(previews[i]);
        }
      }
    } catch (_) {}
  });
}



  // -------------------------------------------------------------------------
  // CLAN BANNER MODAL (Picture icon) — WPForms File Upload Field #8
  // -------------------------------------------------------------------------
  var clanBannerModal = null;
  var clanBannerBackdrop = null;
  var clanBannerEscBound = false;

  function ensureClanBannerModal() {
    if (clanBannerModal && clanBannerBackdrop) return;

    // Reuse the SAME backdrop class as other modals
    clanBannerBackdrop = document.createElement('div');
    clanBannerBackdrop.className = 'shoshin-modal-backdrop';
    clanBannerBackdrop.setAttribute('aria-hidden', 'true');
    clanBannerBackdrop.style.display = 'none';

    // Reuse modal shell styling
    clanBannerModal = document.createElement('div');
    clanBannerModal.className = 'shoshin-modal shoshin-modal-delete';
    clanBannerModal.setAttribute('role', 'dialog');
    clanBannerModal.setAttribute('aria-modal', 'true');
    clanBannerModal.setAttribute('aria-labelledby', 'shoshin-clan-banner-modal-title');

    clanBannerModal.style.display = 'none';

    clanBannerModal.innerHTML =
  '<div class="shoshin-modal-header">' +
    '<img class="shoshin-modal-logo" src="/wp-content/uploads/2025/11/Header_logo_300x150_1.png" alt="Site logo" />' +
    '<button type="button" class="shoshin-modal-x" aria-label="Close">×</button>' +
  '</div>' +

  '<div class="shoshin-modal-body">' +
    '<div id="shoshin-clan-banner-modal-title" class="shoshin-modal-title" style="text-align:center;">Update the clan banner?</div>' +

    // ROW 1 (preview + roster meta + remove toggle)
    '<div class="shoshin-banner-row1">' +
      '<div class="shoshin-banner-left">' +
        '<div class="shoshin-banner-preview-label">Banner Preview</div>' +
        '<img class="shoshin-banner-preview-img" alt="Banner preview" />' +
      '</div>' +

      '<div class="shoshin-banner-mid">' +
        '<div class="shoshin-banner-roster-name"></div>' +
        '<div class="shoshin-banner-roster-ref"></div>' +
      '</div>' +

      '<div class="shoshin-banner-right">' +
        '<div class="shoshin-banner-remove-label">Remove Banner?</div>' +
        '<label class="shoshin-toggle">' +
          '<input type="checkbox" class="shoshin-banner-remove-toggle" />' +
          '<span class="shoshin-toggle-ui" aria-hidden="true"></span>' +
        '</label>' +
        '<div class="shoshin-banner-remove-hint"></div>' +
      '</div>' +
    '</div>' +

    // WPForms slot (field #8 gets moved here)
    '<div class="shoshin-clan-banner-slot" style="margin-top:14px;"></div>' +

    '<div class="shoshin-modal-error" style="display:none"></div>' +
  '</div>' +

  '<div class="shoshin-modal-actions">' +
    '<button type="button" class="shoshin-modal-btn shoshin-modal-btn-cancel shoshin-clan-banner-cancel">Cancel</button>' +
    '<button type="button" class="shoshin-modal-btn shoshin-modal-btn-confirm shoshin-clan-banner-update">Update</button>' +
  '</div>';


    document.body.appendChild(clanBannerBackdrop);
    document.body.appendChild(clanBannerModal);

    // Close handlers
    clanBannerBackdrop.addEventListener('click', closeClanBannerModal);

    var xBtn = clanBannerModal.querySelector('.shoshin-modal-x');
    var cancelBtn = clanBannerModal.querySelector('.shoshin-clan-banner-cancel');

    if (xBtn) xBtn.addEventListener('click', closeClanBannerModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeClanBannerModal);

    // Update handler — click REAL WPForms submit (AJAX) and close ONLY on success
      // Update handler — DO NOT submit WPForms. Persist banner via custom AJAX update to existing entry.
var updateBtn = clanBannerModal.querySelector('.shoshin-clan-banner-update');
if (updateBtn) {
  updateBtn.addEventListener('click', function () {
    clearClanBannerModalError();

    var entryId = clanBannerModal && clanBannerModal.dataset ? String(clanBannerModal.dataset.rosterEntryId || '') : '';
    entryId = String(entryId || '').trim();
    if (!entryId) {
      showClanBannerModalError('Missing roster entryId context.');
      return;
    }

    var toggle = clanBannerModal.querySelector('.shoshin-banner-remove-toggle');
    var doRemove = !!(toggle && toggle.checked);

    // If removing, send empty value
    var value = doRemove ? '[]' : '';
    if (!doRemove) {
      if (!clanBannerFieldNode) {
        showClanBannerModalError('Banner upload field not found.');
        return;
      }

      // Guard: user may click Update before WPForms finishes uploading
if (clanBannerDz) {
  try {
    var uploading = (clanBannerDz.getUploadingFiles && clanBannerDz.getUploadingFiles().length) ? clanBannerDz.getUploadingFiles().length : 0;
    var queued    = (clanBannerDz.getQueuedFiles && clanBannerDz.getQueuedFiles().length) ? clanBannerDz.getQueuedFiles().length : 0;
    if (uploading > 0 || queued > 0) {
      showClanBannerModalError('Upload still in progress — please wait for it to finish, then click Update.');
      return;
    }
  } catch (_) {}
}


      // WPForms uploader stores final uploaded value in a hidden input
// ALWAYS re-scan the host form at click-time (most reliable)
Promise.resolve()
  .then(function () {
    value = findWpformsUploadedValueForField8(clanBannerHostForm) || String(bannerUploadedValue || '').trim();
    if (value) return value;
    return waitForBannerValue(2500);
  })
  .then(function (v) {
    value = String(v || '').trim();
    if (!value) {
      showClanBannerModalError('Upload finished visually, but WPForms still did not write a stored value. Try removing + re-uploading, or refresh once.');
      throw new Error('no-value');
    }

    // ...continue with bannerAjax(...) using `value`
  })
  .catch(function (e) {
    if (e && e.message === 'no-value') return;
    // existing error handling
  });




      if (!value) {
        showClanBannerModalError('Please upload a banner before clicking Update (or toggle Remove Banner).');
        return;
      }
    }

    // Disable buttons while saving
    var ub = clanBannerModal.querySelector('.shoshin-clan-banner-update');
    var cb = clanBannerModal.querySelector('.shoshin-clan-banner-cancel');
    var xb = clanBannerModal.querySelector('.shoshin-modal-x');
    if (ub) ub.disabled = true;
    if (cb) cb.disabled = true;
    if (xb) xb.disabled = true;

    // Final normalization: WPForms file fields should never be saved as '' / null
if (typeof value !== 'string') value = String(value || '');
value = value.trim();
if (!value) value = '[]';


    bannerAjax('shoshin_update_roster_banner', {
      entryId: entryId,
      value: doRemove ? '' : value
    })
    .then(function (data) {
// Choose new avatar source (ALWAYS normalize raw -> URL for display)
var rawSaved = (data && typeof data.banner === 'string') ? data.banner : value;

// Display URL must be a real URL/path, not JSON
var newSrc = bannerValueToUrl(rawSaved) || DEFAULT_BANNER;

// If we *still* don't have a usable URL and this was an upload, fall back to the preview (object URL)
if (!doRemove && newSrc === DEFAULT_BANNER) {
  var previewImg = clanBannerModal.querySelector('.shoshin-banner-preview-img');
  var src = previewImg ? String(previewImg.getAttribute('src') || '').trim() : '';
  if (src) newSrc = src;
}

// Update the roster card avatar immediately
updateRosterCardAvatar(entryId, newSrc);

// Update in-memory roster object with the RAW saved value (JSON), not the display URL
var ro = getRosterObjByEntryId(entryId);
if (ro) {
  ro.icon = doRemove ? '[]' : String(rawSaved || '').trim();
}


      // Re-enable + close
      if (ub) ub.disabled = false;
      if (cb) cb.disabled = false;
      if (xb) xb.disabled = false;

      closeClanBannerModal();
    })
    .catch(function (err) {
      if (ub) ub.disabled = false;
      if (cb) cb.disabled = false;
      if (xb) xb.disabled = false;

      showClanBannerModalError(err && err.message ? err.message : 'Update failed.');
    });
  });
}




    // --- WPForms AJAX hooks (bind once)


    // Esc handler (only while open)
    if (!clanBannerEscBound) {
      clanBannerEscBound = true;
      document.addEventListener('keydown', function (e) {
        if (!clanBannerBackdrop) return;
        if (clanBannerBackdrop.getAttribute('aria-hidden') === 'true') return;
        if (e.key === 'Escape') closeClanBannerModal();
      });
    }
  }

  function showClanBannerModalError(msg) {
    if (!clanBannerModal) return;
    var err = clanBannerModal.querySelector('.shoshin-modal-error');
    if (err) {
      err.textContent = String(msg || 'Update failed.');
      err.style.display = 'block';
    }
  }

  function clearClanBannerModalError() {
    if (!clanBannerModal) return;
    var err = clanBannerModal.querySelector('.shoshin-modal-error');
    if (err) {
      err.textContent = '';
      err.style.display = 'none';
    }
  }

            // This assumes WPForms field #8 is already rendered somewhere on the page.
      // We MOVE the REAL WPForms form into the modal while open, then MOVE it back on close.
      var clanBannerFormHome = null;     // placeholder where FORM returns
      var clanBannerHostForm = null;     // the REAL WPForms <form> we move
      var clanBannerFieldNode = null;    // optional: field_8 container reference
      var clanBannerFieldHome = null;    // (legacy) placeholder if you ever move ONLY the field
      var clanBannerModalForm = null;    // (legacy) wrapper form (we will NOT use it anymore)




      function openClanBannerModal(btn) {
        ensureClanBannerModal();
        clearClanBannerModalError();

        // Capture roster context for later wiring (entryId etc.)
        var card = btn && btn.closest ? btn.closest('.shoshin-roster-card') : null;
        var entryId = card ? String(card.getAttribute('data-roster-entry-id') || '') : '';
        console.log('Shoshin: Banner modal open for roster entryId:', entryId);

        clanBannerModal.dataset.rosterEntryId = entryId;

        var cardMeta = getRosterCardMeta(card);


                        // STRICT: only pull from the hidden host form so we never grab the wrong field
        var hostForm = document.querySelector('#shoshin-banner-form-host #wpforms-form-2799');
        if (!hostForm) {
          showClanBannerModalError('Hidden host form (2799) was not found. Add #shoshin-banner-form-host with [wpforms id="2799"] to /my-rosters.');
          setModalVisible(clanBannerModal, clanBannerBackdrop, true);
          return;
        }

      
        clanBannerHostForm = hostForm;

        // HARD GUARD: never allow the real WPForms form to submit while used in the banner modal.
// This prevents validation, POST resubmission warnings, and accidental creation of NEW entries.
if (clanBannerHostForm && clanBannerHostForm.dataset && clanBannerHostForm.dataset.shoshinNoSubmit !== '1') {
  clanBannerHostForm.dataset.shoshinNoSubmit = '1';
  clanBannerHostForm.addEventListener('submit', function (e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  });
}


        function setAlways(selList, val) {
  val = String(val || '').trim();
  for (var i = 0; i < selList.length; i++) {
    var el = clanBannerHostForm ? clanBannerHostForm.querySelector(selList[i]) : null;
    if (el) {
      el.value = val;
      try { el.dispatchEvent(new Event('input', { bubbles:true })); } catch (_) {}
      try { el.dispatchEvent(new Event('change', { bubbles:true })); } catch (_) {}
      return true;
    }
  }
  return false;
}

// ALWAYS set these so validation passes
setAlways(['#wpforms-2799-field_1', 'input[name="wpforms[fields][1]"]'], cardMeta.ref);
setAlways(['#wpforms-2799-field_2', 'input[name="wpforms[fields][2]"]'], cardMeta.name);


        // Optional reference (your preview binder uses this)
        clanBannerFieldNode = hostForm.querySelector('#wpforms-2799-field_8-container');

        // Create a hidden “home” placeholder right before the FORM (first time only)
        if (!clanBannerFormHome) {
          clanBannerFormHome = document.createElement('div');
          clanBannerFormHome.style.display = 'none';
          clanBannerHostForm.parentNode.insertBefore(clanBannerFormHome, clanBannerHostForm);
        }

               // Move the ENTIRE WPForms form into the modal slot (keeps WPForms AJAX intact)
        var slot = clanBannerModal.querySelector('.shoshin-clan-banner-slot');
        if (slot) {
          slot.innerHTML = '';
          slot.appendChild(clanBannerHostForm);
          clanBannerHostForm.style.display = 'block';

          // IMPORTANT: mark form as "banner mode" so we can hide everything except field #8
          clanBannerHostForm.classList.add('shoshin-banner-mode');
        }

       
// Fill roster name/ref
var nameEl = clanBannerModal.querySelector('.shoshin-banner-roster-name');
var refEl  = clanBannerModal.querySelector('.shoshin-banner-roster-ref');
if (nameEl) nameEl.textContent = cardMeta.name || 'Untitled Roster';

        // Fill the hidden required inputs inside WPForms (so Update passes validation)
        // Try common selectors first (update these two if your WPForms field IDs are different)
        setAlways(['#wpforms-2799-field_1', 'input[name="wpforms[fields][1]"]'], cardMeta.ref);
        setAlways(['#wpforms-2799-field_2', 'input[name="wpforms[fields][2]"]'], cardMeta.name);


// Determine if a custom banner exists (normalize first)
var currentUrl = cardMeta.imgUrl || cardMeta.imgShown || DEFAULT_BANNER;
var hasCustom = !!cardMeta.imgUrl;


syncRemoveToggleState(hasCustom);
setBannerPreview(currentUrl);







        // One-time CSS: hide all WPForms fields except file upload field #8, hide the WPForms submit button
        if (!document.getElementById('shoshin-banner-mode-css')) {
          var css = document.createElement('style');
          css.id = 'shoshin-banner-mode-css';
          css.textContent =
            '#wpforms-form-2799.shoshin-banner-mode .wpforms-field{display:none!important;}' +
            '#wpforms-form-2799.shoshin-banner-mode #wpforms-2799-field_8-container{display:block!important;}' +
            '#wpforms-form-2799.shoshin-banner-mode .wpforms-submit-container{display:none!important;}' +
            '#wpforms-form-2799.shoshin-banner-mode .wpforms-field-description, ' +
            '#wpforms-form-2799.shoshin-banner-mode .wpforms-title, ' +
            '#wpforms-form-2799.shoshin-banner-mode .wpforms-description{display:none!important;}';
          document.head.appendChild(css);
        }

        resetBannerDropzoneState();
        
        setModalVisible(clanBannerModal, clanBannerBackdrop, true);
        // Prevent Enter key from causing accidental submits while banner modal is open
clanBannerModal.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') e.preventDefault();
}, { once: true });

        bindBannerFieldPreview();

      }

      function closeClanBannerModal() {
        if (!clanBannerModal || !clanBannerBackdrop) return;

        // Revoke any temporary blob preview URL to avoid memory leaks
if (bannerPreviewObjectUrl) {
  try { URL.revokeObjectURL(bannerPreviewObjectUrl); } catch (_) {}
  bannerPreviewObjectUrl = null;
}

resetBannerDropzoneState();

bannerUploadedValue = '';
clanBannerDz = null;


// Reset modal preview to default so next open starts clean
try { setBannerPreview(DEFAULT_BANNER); } catch (_) {}


        
                // Move REAL form back to its hidden host container
        if (clanBannerHostForm && clanBannerFormHome && clanBannerFormHome.parentNode) {
          clanBannerHostForm.classList.remove('shoshin-banner-mode');
          clanBannerFormHome.parentNode.insertBefore(clanBannerHostForm, clanBannerFormHome.nextSibling);
          clanBannerHostForm.style.display = '';
        }

        // Clear references
        clanBannerFieldNode = null;
        clanBannerHostForm = null;
        clanBannerModalForm = null; // legacy var; unused




        setModalVisible(clanBannerModal, clanBannerBackdrop, false);
      }

      // Keep the naming you already called
      function injectClanBannerModal() {
        // This is just an alias so your click hook remains valid
        ensureClanBannerModal();
      }



  // Create icon <img> with inline fallback (no CSS dependency)
  function iconImg(src, alt, fallbackEmoji) {
    var safeAlt = alt || '';
    var safeSrc = src || '';
    var safeEmoji = fallbackEmoji || '•';

    // onerror: hide the <img> and inject emoji so the button still shows "something"
    return (
      '<img class="shoshin-btn-icon" src="' + esc(safeSrc) + '" alt="' + esc(safeAlt) + '" ' +
        'style="width:18px;height:18px;display:block;" ' +
        'onerror="this.style.display=\'none\'; if(this.parentNode){this.parentNode.setAttribute(\'data-icon-fallback\',\'' + esc(safeEmoji) + '\');}"' +
      ' />'
    );
  }

  // ---------------------------------------------------------------------------
  // Parse rosters JSON
  // ---------------------------------------------------------------------------
  var rosters = [];
  try {
    var raw = listEl.getAttribute('data-shoshin-rosters-json') || '[]';
    rosters = JSON.parse(raw);
  } catch (e) {
    console.error('Shoshin: invalid rosters JSON', e);
    listEl.innerHTML =
      '<div class="shoshin-empty">' +
        '<div class="shoshin-empty-title">Roster data could not be loaded</div>' +
        '<div class="shoshin-empty-body">Please refresh the page and try again.</div>' +
      '</div>';
    return;
  }

  if (!Array.isArray(rosters) || rosters.length === 0) {
    listEl.innerHTML =
      '<div class="shoshin-empty">' +
        '<div class="shoshin-empty-title">No rosters yet</div>' +
        '<div class="shoshin-empty-body">Create your first clan roster to begin managing units.</div>' +
        '<a class="shoshin-btn shoshin-btn-primary" href="/create-roster">Create a Roster</a>' +
      '</div>';
    return;
  }

  rosters = rosters.slice().sort(function (a, b) {
    var ar = String((a && (a.refId || a.ref_id)) || '');
    var br = String((b && (b.refId || b.ref_id)) || '');
    return ar.localeCompare(br, undefined, { numeric: true, sensitivity: 'base' });
  });

  listEl.innerHTML = '';
  // =============================================================================
  // TASK 1 — UX Refinement
  // 1) Load more (10 at a time, filter-aware)
  // 2) Only one roster card expanded at a time
  // 3) Filter bar by Total Clan Points
  // =============================================================================

  var PAGE_SIZE = 10;
  var visibleLimit = PAGE_SIZE;
  var currentPointsFilter = 'All Rosters';

  var wrapperEl = listEl.closest('.shoshin-roster-list-wrapper') || listEl.parentElement;

  var emptyFilterEl = null;
  function ensureFilterEmptyEl() {
    if (!wrapperEl) return null;
    if (!emptyFilterEl) {
      emptyFilterEl = document.createElement('div');
      emptyFilterEl.className = 'shoshin-asset-empty-state';
      emptyFilterEl.style.display = 'none';
      wrapperEl.insertBefore(emptyFilterEl, listEl);
    }
    return emptyFilterEl;
  }

  var loadMoreWrap = null;
  var loadMoreBtn = null;
  function ensureLoadMoreEl() {
    if (!wrapperEl) return null;
    if (!loadMoreWrap) {
      loadMoreWrap = document.createElement('div');
      loadMoreWrap.className = 'shoshin-load-more-wrap';
      loadMoreWrap.style.display = 'none';
      loadMoreWrap.style.justifyContent = 'center';
      loadMoreWrap.style.width = '100%';


      loadMoreBtn = document.createElement('button');
      loadMoreBtn.type = 'button';
      loadMoreBtn.className = 'shoshin-load-more-btn shoshin-btn';
      loadMoreBtn.textContent = 'Load more';
      loadMoreBtn.addEventListener('click', function () {
        visibleLimit += PAGE_SIZE;
        applyRosterFilterAndPaging();
        loadMoreBtn && loadMoreBtn.focus && loadMoreBtn.focus();
      });

      loadMoreWrap.appendChild(loadMoreBtn);
      wrapperEl.appendChild(loadMoreWrap);
    }
    return loadMoreWrap;
  }

  function pointsMatchFilter(points, label) {
    if (label === 'All Rosters') return true;
    if (label === '~ 500') return (points >= 0 && points <= 500);
    if (label === '~ 1000') return (points >= 501 && points <= 1000);
    if (label === '~ 2500') return (points >= 1001 && points <= 2500);
    if (label === '2500+') return (points >= 2501);
    return true;
  }

  function buildPointsFilterBar() {
    if (!wrapperEl) return null;

    var existing = wrapperEl.querySelector('.shoshin-roster-filters');
    if (existing) return existing;

    var labels = ['All Rosters', '~ 500', '~ 1000', '~ 2500', '2500+'];

    var bar = document.createElement('div');
    bar.className = 'shoshin-asset-filters shoshin-roster-filters';

    labels.forEach(function (label) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shoshin-asset-filter-btn';
      btn.textContent = label;

      if (label === currentPointsFilter) btn.classList.add('is-active');

      btn.addEventListener('click', function () {
        bar.querySelectorAll('.shoshin-asset-filter-btn').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');

        currentPointsFilter = label;
        visibleLimit = PAGE_SIZE; // reset paging when filter changes
        applyRosterFilterAndPaging();
      });

      bar.appendChild(btn);
    });

    wrapperEl.insertBefore(bar, listEl);
    return bar;
  }

  function collapseRosterCard(card) {
    var details = card.querySelector('.shoshin-asset-details');
    if (!details || !details.classList.contains('is-open')) return;

    details.classList.remove('is-open');
    details.setAttribute('aria-hidden', 'true');

    var btn = card.querySelector('.shoshin-asset-toggle');
    var icon = card.querySelector('.shoshin-asset-toggle-icon');
    var text = card.querySelector('.shoshin-asset-toggle-text');

    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (icon) icon.textContent = '+';
    if (text) text.textContent = btn && btn.getAttribute('data-expand-msg') ? btn.getAttribute('data-expand-msg') : 'Expand';
  }

  function applyRosterFilterAndPaging() {
    if (!wrapperEl) return;

    var msgEl = ensureFilterEmptyEl();
    var moreEl = ensureLoadMoreEl();
    var cards = Array.prototype.slice.call(wrapperEl.querySelectorAll('.shoshin-roster-card'));

    // 1) build matching list
    var matching = cards.filter(function (card) {
      var pts = asInt(card.getAttribute('data-clan-points'), 0);
      return pointsMatchFilter(pts, currentPointsFilter);
    });

    // 2) deterministic hide all
    cards.forEach(function (c) { c.style.display = 'none'; });

    var showCount = Math.min(visibleLimit, matching.length);
    for (var i = 0; i < showCount; i++) matching[i].style.display = '';

    // 3) empty message
    if (msgEl) {
      if (matching.length === 0) {
        msgEl.innerHTML = '<h2><em>You currently do not have any clans with these points totals.</em></h2>';
        msgEl.style.display = 'block';
      } else {
        msgEl.style.display = 'none';
      }
    }

    // 4) load more visibility
    if (moreEl) {
      moreEl.style.display = (matching.length > visibleLimit) ? 'flex' : 'none';
      if (loadMoreBtn) {
        var remaining = Math.max(0, matching.length - showCount);
        loadMoreBtn.textContent = remaining > 0 ? ('Load more (' + remaining + ' more)') : 'Load more';
      }
    }

    // 5) if open card is now hidden, collapse it
    var openDetails = wrapperEl.querySelectorAll('.shoshin-asset-details.is-open');
    openDetails.forEach(function (d) {
      var card = d.closest('.shoshin-roster-card');
      if (card && card.style.display === 'none') collapseRosterCard(card);
    });
  }


  // ---------------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------------
  function parseAssigned(r) {
    var assignedRaw =
      r.assigned_units_json ||
      r.field_9 ||
      r['9'] ||
      '';
    assignedRaw = String(assignedRaw || '').trim();
    if (!assignedRaw) return [];

    try {
      var arr = JSON.parse(assignedRaw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn('Shoshin: invalid assigned_units_json for roster', (r && r.refId) ? r.refId : '(no ref)', e);
      return [];
    }
  }

  function groupAssigned(assigned) {
  var map = {};

  for (var i = 0; i < assigned.length; i++) {
    var u = assigned[i] || {};
    var unitKey = String(u.unitKey || '').trim();
    if (!unitKey) unitKey = makeUnitKey(u);

    var qty = (u.qty != null) ? asInt(u.qty, 1) : 1;
    if (qty < 1) qty = 1;

    if (!map[unitKey]) {
      map[unitKey] = Object.assign({}, u, { unitKey: unitKey, qty: qty });
    } else {
      map[unitKey].qty += qty;
    }
  }

  var out = Object.keys(map).map(function (k) { return map[k]; });

  out.sort(function (a, b) {
    // 1) Sort by the exact class/type order we want
    var ak = classOrderKey(a.kind, a.cls || a.class || a.supportType);
    var bk = classOrderKey(b.kind, b.cls || b.class || b.supportType);
    if (ak !== bk) return ak.localeCompare(bk, undefined, { sensitivity: 'base' });

    // 2) Then by REF ID within that type (SAM001, SAM002, etc.)
    var ar = String(a.refId || a.ref_id || '').trim();
    var br = String(b.refId || b.ref_id || '').trim();
    var cmp = ar.localeCompare(br, undefined, { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) return cmp;

    // 3) Then by name as a final tie-breaker
    return String(a.name || a.title || '').localeCompare(
      String(b.name || b.title || ''),
      undefined,
      { sensitivity: 'base' }
    );
  });

  return out;
}


function getRosterIcon(r) {
  var raw =
    r.icon ||
    r.icon_url ||
    r.roster_icon ||
    r.field_8 ||
    r['8'] ||
    '';

  var url = bannerValueToUrl(raw);
  if (!url) url = DEFAULT_BANNER || '/wp-content/uploads/2025/12/Helmet-grey.jpg';
  return url;
}



  function renderAssignedStripRow(u, rosterEntryId) {
    var img = String(u.img || u.image || u.imgUrl || '').trim();
    if (!img) img = '/wp-content/uploads/2025/12/Helmet-grey.jpg';

    var kind = String(u.kind || '').toLowerCase().trim();

    // Characters: show class (Daimyo/Samurai/etc.)
    // Support: show the asset name (Ozutsu/Mokuzo Hansen/etc.)
    var unitType;
    if (kind === 'support') {
      unitType = String(u.name || u.title || u.supportType || u.cls || u.class || '').trim() || '—';
    } else {
      unitType = String(u.cls || u.class || u.supportType || '').trim() || '—';
    }

    var refId = String(u.refId || u.ref_id || '').trim() || '—';
    var qty = asInt(u.qty, 1);
    if (qty < 0) qty = 0;

        function pick() {
      var stats = (u && typeof u === 'object' && u.stats && typeof u.stats === 'object') ? u.stats : null;

      for (var i = 0; i < arguments.length; i++) {
        var key = arguments[i];

        // 1) Prefer top-level
        var v = (u && typeof u === 'object') ? u[key] : null;
        if (v != null && String(v).trim() !== '') return v;

        // 2) Fallback to nested stats
        if (stats) {
          var sv = stats[key];
          if (sv != null && String(sv).trim() !== '') return sv;
        }
      }
      return null;
    }


    var cost = pick('cost', 'points', 'pt', 'pts');
    var mDmg = pick('m_dmg', 'mDmg', 'meleeDmg');
    var mCrt = pick('m_crt', 'mCrt', 'meleeCrt');
    var mDis = pick('m_dis', 'mDis', 'meleeDis', 'meleeRange');
    var rDmg = pick('r_dmg', 'rDmg', 'rangedDmg');
    var rCrt = pick('r_crt', 'rCrt', 'rangedCrt');
    var rDis = pick('r_dis', 'rDis', 'rangedDis', 'rangedRange');
    var atk  = pick('atk', 'attack');
    var def  = pick('def', 'defense');
    var mov  = pick('mov', 'move');

    // Support assets: ATK and MOV are semantically N/A when stored as 0
    if (kind === 'support') {
    if (String(atk) === '0') atk = '--';
    if (String(mov) === '0') mov = '--';
  }

    var bod  = pick('bod', 'body');
    var ldr  = pick('ldr', 'leadership');
    var ini  = pick('ini', 'initiative');

    var unitCost = isNumericLike(cost) ? asInt(cost, 0) : 0;
    var totalCost = qty * unitCost;

    var unitKey = String(u.unitKey || '').trim();
    if (!unitKey) unitKey = makeUnitKey(u);

    function cell(label, value) {
      var v = (value == null || String(value).trim() === '') ? '—' : String(value);
      return (
        '<td>' +
          '<div class="shoshin-stat-cell">' +
            '<div class="shoshin-stat-label">' + esc(label) + '</div>' +
            '<div class="shoshin-stat-value">' + esc(v) + '</div>' +
          '</div>' +
        '</td>'
      );
    }

      return (
      '<tr data-unit-key="' + esc(unitKey) + '">' +

        // 1) IMG
        '<td class="shoshin-assigned-img-td">' +
          '<div class="shoshin-assigned-img-wrap">' +
            '<img src="' + esc(img) + '" alt="" style="width:32px;height:32px;object-fit:cover;border:1px solid #ddd;border-radius:4px;" />' +
          '</div>' +
        '</td>' +    

                // 2) INFO (CLASS/TYPE above REF ID)
        '<td class="shoshin-assigned-plain-td shoshin-assigned-info-td">' +
          '<div class="shoshin-stat-cell">' +
            '<div class="shoshin-stat-label"></div>' +
            '<div class="shoshin-stat-value">' + esc(unitType) + '</div>' +
            '<div class="shoshin-stat-subvalue">' + esc(refId) + '</div>' +
          '</div>' +
        '</td>' +


        // 4) QTY (DISPLAY ONLY)
        '<td class="shoshin-assigned-qty-td">' +
          '<div class="shoshin-stat-cell">' +
            '<div class="shoshin-stat-label">QTY</div>' +
            '<div class="shoshin-stat-value">' + esc(qty) + '</div>' +
          '</div>' +
        '</td>' +


        cell('M DMG', mDmg) +
        cell('M CRT', mCrt) +
        cell('M DIS', withInchesIfNumeric(mDis)) +
        cell('R DMG', rDmg) +
        cell('R CRT', rCrt) +
        cell('R DIS', withInchesIfNumeric(rDis)) +
        cell('ATK', atk) +
        cell('DEF', def) +
        cell('MOV', withInchesIfNumeric(mov)) +
        cell('BOD', bod) +
        cell('LDR', ldr) +
        cell('INI', ini) +

        '<td>' +
          '<div class="shoshin-stat-cell">' +
            '<div class="shoshin-stat-label">TOTAL</div>' +
            '<div class="shoshin-stat-value">' + esc(totalCost || 0) + '</div>' +
          '</div>' +
        '</td>' +

        '<td class="shoshin-assigned-actions-td" style="text-align:center;white-space:nowrap;">' +
  '<button type="button" class="shoshin-btn shoshin-btn-unassign" data-tooltip="Unassign Units" aria-label="Unassign Units" data-entry-id="' + esc(rosterEntryId) + '">' +
    iconImg(ICONS.unassign, 'Unassign', '📤') +
  '</button>' +
  '<button type="button" class="shoshin-btn shoshin-btn-remove" data-tooltip="Remove All" aria-label="Remove All" data-entry-id="' + esc(rosterEntryId) + '">' +
    iconImg(ICONS.del, 'Remove', '🗑️') +
  '</button>' +
'</td>' +


      '</tr>'
    );
  }

  function renderRosterCard(r, idx) {
    var refId = String(r.refId || r.ref_id || '').trim();
    var clanName = String(r.name || r.roster_name || 'Untitled Roster');

    var clanPoints = asInt(r.points, 0);
    var masterClassAvail = Math.floor(clanPoints / 125);

    var rosterEntryId = asInt(r.entryId, 0);
    var iconUrl = getRosterIcon(r);

    var detailsId = 'shoshin-roster-details-' + idx + '-' + (refId ? refId.replace(/[^a-zA-Z0-9_-]/g, '') : 'x');

    var assigned = parseAssigned(r);
    var grouped = groupAssigned(assigned);

    var expandMsg = 'Expand to view / edit units assigned to this clan.';
    var collapseMsg = 'Collapse clan roster assignment profile.';

    var row3BodyHtml = '';
    if (!grouped.length) {
      row3BodyHtml = '<div class="shoshin-expansion-empty">This clan currently has no assigned units.</div>';
    } else {
      row3BodyHtml =
        '<div class="shoshin-roster-assigned-scroll">' +
          '<table class="shoshin-stat-strip shoshin-assigned-strip">' +
            '<tbody>';

      for (var i = 0; i < grouped.length; i++) {
        row3BodyHtml += renderAssignedStripRow(grouped[i], rosterEntryId);
      }

      row3BodyHtml +=
            '</tbody>' +
          '</table>' +
        '</div>';
    }

    var card = document.createElement('div');
    card.className = 'shoshin-asset-card shoshin-roster-card';
    card.setAttribute('data-roster-entry-id', String(rosterEntryId));
    card.setAttribute('data-clan-points', String(clanPoints));

    card.innerHTML =
      // ROW 1
      '<div class="shoshin-asset-row1">' +

        '<div class="shoshin-asset-avatar">' +
          '<img src="' + esc(iconUrl) + '" alt="" />' +
        '</div>' +

        '<div class="shoshin-asset-header-main">' +
          '<h2 class="shoshin-asset-class-name">' + esc(clanName) + '</h2>' +
          '<div class="shoshin-asset-class-desc"><strong>Total Clan Points:</strong> ' + esc(clanPoints) + '</div>' +
          '<div class="shoshin-asset-class-desc"><strong>Master Class Abilities:</strong> ' + esc(masterClassAvail) + '</div>' +
        '</div>' +

        '<div class="shoshin-asset-actions row1-actions">' +

          '<button type="button" class="shoshin-btn shoshin-btn-picture shoshin-btn-picture-roster" data-tooltip="Update Clan Banner" aria-label="Update Clan Banner">' +
            iconImg(ICONS.picture, 'Picture', '🖼️') +
          '</button>' +

          '<button type="button" class="shoshin-btn shoshin-btn-assign shoshin-btn-assign-roster" data-tooltip="Assign Units" aria-label="Assign Units">' +
            iconImg(ICONS.assign, 'Assign', '📥') +
          '</button>' +

        

          '<button type="button" class="shoshin-btn shoshin-btn-print" data-tooltip="Print Clan Roster Sheet" aria-label="Print Clan Roster">' +
            iconImg(ICONS.print, 'Print', '🖨️') +
          '</button>' +

          '<button type="button" class="shoshin-btn shoshin-btn-delete" data-tooltip="Delete Clan" aria-label="Delete Clan">' +
            iconImg(ICONS.del, 'Delete', '🗑️') +
          '</button>' +

        '</div>' +
      '</div>' +

      // ROW 2
      '<div class="shoshin-asset-stat-row">' +
        '<table class="shoshin-stat-strip">' +
          '<tbody>' +
            '<tr>' +

              '<td class="shoshin-ref-td">' +
                '<div class="shoshin-stat-cell shoshin-stat-ref">' +
                  '<div class="shoshin-stat-value">' + (refId ? esc(refId) : '—') + '</div>' +
                '</div>' +
              '</td>' +

              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Units</div><div class="shoshin-stat-value">' + esc(asInt(r.unitCount, 0)) + '</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Initiative</div><div class="shoshin-stat-value">' + esc(asInt(r.initiative, 0)) + '</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Honor</div><div class="shoshin-stat-value">' + esc(asInt(r.honor, 0)) + '</div></div></td>' +

              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Daimyo</div><div class="shoshin-stat-value">' + esc(((r.counts || {}).Daimyo) || 0) + '</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Samurai</div><div class="shoshin-stat-value">' + esc(((r.counts || {}).Samurai) || 0) + '</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Ashigaru</div><div class="shoshin-stat-value">' + esc(((r.counts || {}).Ashigaru) || 0) + '</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Sohei</div><div class="shoshin-stat-value">' + esc(((r.counts || {}).Sohei) || 0) + '</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Ninja</div><div class="shoshin-stat-value">' + esc(((r.counts || {}).Ninja) || 0) + '</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Onmyoji</div><div class="shoshin-stat-value">' + esc(((r.counts || {}).Onmyoji) || 0) + '</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Artillery</div><div class="shoshin-stat-value">' + esc(((r.counts || {}).Artillery) || 0) + '</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Ships</div><div class="shoshin-stat-value">' + esc(((r.counts || {}).Ships) || 0) + '</div></div></td>' +

            '</tr>' +
          '</tbody>' +
        '</table>' +
      '</div>' +

      // ROW 3
      '<div class="shoshin-asset-row3">' +
        '<div class="shoshin-asset-actions row3-actions">' +
          '<button type="button" class="shoshin-btn shoshin-asset-toggle" aria-controls="' + esc(detailsId) + '" aria-expanded="false" data-expand-msg="' + esc(expandMsg) + '" data-collapse-msg="' + esc(collapseMsg) + '">' +
            '<span class="shoshin-asset-toggle-icon" aria-hidden="true">+</span>' +
            '<span class="shoshin-asset-toggle-text">' + esc(expandMsg) + '</span>' +
          '</button>' +
        '</div>' +

        '<div id="' + esc(detailsId) + '" class="shoshin-asset-details" aria-hidden="true">' +
          '<div class="shoshin-asset-details-inner">' +
            '<div class="shoshin-asset-block">' +
              row3BodyHtml +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    return card;
  }

  for (var i = 0; i < rosters.length; i++) {
    listEl.appendChild(renderRosterCard(rosters[i], i));
  }

  buildPointsFilterBar();
  applyRosterFilterAndPaging();

  // =============================================================================
  // Delegated handlers (FIX: expand/collapse works even before DOM append timing)
  // =============================================================================
  listEl.addEventListener('click', function (evt) {
    var t = evt.target;

    // If user clicked inside a button/icon, normalize to nearest button
    var btn = t && t.closest ? t.closest('button') : null;
    if (!btn) return;

    // -----------------------------
    // Row3 toggle (Expand/Collapse)
    // -----------------------------
    if (btn.classList.contains('shoshin-asset-toggle')) {
      var card = btn.closest('.shoshin-roster-card');
      if (!card) return;

      var id = btn.getAttribute('aria-controls') || '';
      if (!id) return;

      var details = card.querySelector('[id="' + id.replace(/"/g, '\\"') + '"]');
      if (!details) return;

      var isOpen = details.classList.contains('is-open');
      var icon = btn.querySelector('.shoshin-asset-toggle-icon');
      var text = btn.querySelector('.shoshin-asset-toggle-text');

      if (isOpen) {
        details.classList.remove('is-open');
        details.setAttribute('aria-hidden', 'true');
        btn.setAttribute('aria-expanded', 'false');
        if (icon) icon.textContent = '+';
        if (text) text.textContent = btn.getAttribute('data-expand-msg') || 'Expand';
      } else {
        // TASK 1: Only one expanded at a time (scope: this roster list wrapper)
        var scope = card.closest('.shoshin-roster-list-wrapper') || card.parentElement;
        if (scope) {
          scope.querySelectorAll('.shoshin-roster-card').forEach(function (c) {
            if (c !== card) collapseRosterCard(c);
          });
        }

        details.classList.add('is-open');
        details.setAttribute('aria-hidden', 'false');
        btn.setAttribute('aria-expanded', 'true');
        if (icon) icon.textContent = '–';
        if (text) text.textContent = btn.getAttribute('data-collapse-msg') || 'Collapse';
      }
      return;
    }

    // -----------------------------
    // Row1 Assign button (scoped nav only for now)
    // -----------------------------

      // -----------------------------
      // Row1 Picture button (UI-only for now; wiring later)
      // -----------------------------
      if (btn.classList.contains('shoshin-btn-picture-roster')) {
        injectClanBannerModal();
        openClanBannerModal(btn);
        return;
      }



    if (btn.classList.contains('shoshin-btn-assign-roster')) {
      window.location.href = '/my-assets';
      return;
    }

        // Row1 Delete button (modal + real WPForms entry delete)
    if (btn.classList.contains('shoshin-btn-delete')) {
      var cardDel = btn.closest('.shoshin-roster-card');
      if (!cardDel) return;

      var rosterEntryId = asInt(cardDel.getAttribute('data-roster-entry-id'), 0);
      if (!rosterEntryId) {
        alert('Missing roster entryId.');
        return;
      }

      // Pull roster name/ref for display (from in-memory array)
      var rosterObj = null;
      if (Array.isArray(rosters)) {
        rosterObj = rosters.find(function (r) {
          var rid = asInt(r.entryId || r.id || r.entry_id, 0);
          return rid === rosterEntryId;
        }) || null;
      }

      var rName = rosterObj ? String(rosterObj.name || '').trim() : '';
      var rRef  = rosterObj ? String(rosterObj.refId || rosterObj.ref_id || '').trim() : '';

      var titleText = 'Delete roster?';
      var descText = 'Deleting this roster is permanent and is not recoverable!';
      if (rName || rRef) {
        descText = 'Delete ' + (rName || 'this roster') + (rRef ? ' (' + rRef + ')' : '') + '? Deleting this roster is permanent and is not recoverable!';
      }

      openDeleteModal(titleText, descText, function () {
        // Use the shared hub delete endpoint (same as /my-assets)
        return postAjax('shoshin_delete_wpforms_entry', {
          entryId: String(rosterEntryId),
          formId: '2799',
          kind: 'roster',
          refId: rRef || ''
        }).then(function () {
          // Remove from in-memory model
          if (Array.isArray(rosters)) {
            rosters = rosters.filter(function (r) {
              var rid = asInt(r.entryId || r.id || r.entry_id, 0);
              return rid !== rosterEntryId;
            });
          }

          // Remove card from DOM
          cardDel.remove();

          // Re-apply filter/paging
          if (typeof applyRosterFilterAndPaging === 'function') {
            applyRosterFilterAndPaging();
          }
        });
      });

      return;
    }


        // -----------------------------
    // Row3 Remove (FULL UNASSIGN via modal) — set qty=0 + update roster stats
    // -----------------------------
    if (btn.classList.contains('shoshin-btn-remove')) {
      var card2 = btn.closest('.shoshin-roster-card');
      if (!card2) return;

      var entryId = asInt(card2.getAttribute('data-roster-entry-id'), 0);
      if (!entryId) return;

      var tr = btn.closest('tr');
      if (!tr) return;

      var unitKey = String(tr.getAttribute('data-unit-key') || '').trim();
      if (!unitKey) return;

      var rosterObj2 = getRosterObjByEntryId(entryId);

      // Friendly label for the modal (use INFO column if present)
            var unitLabel = '';
      var unitRef = '';
      var infoCell = tr.querySelector('.shoshin-assigned-info-td');
      if (infoCell) {
        var top = infoCell.querySelector('.shoshin-stat-value');
        var sub = infoCell.querySelector('.shoshin-stat-subvalue');
        unitLabel = top ? String(top.textContent || '').trim() : '';
        unitRef   = sub ? String(sub.textContent || '').trim() : '';
      }


            var titleText = 'Remove unit from clan?';
      var descText =
        'This action will completely unassign and remove the unit and all quantities from this clan. ' +
        'This action cannot be undone.';

      if (unitLabel || unitRef) {
        var display = unitLabel || 'this unit';
        if (unitRef) display += ' (' + unitRef + ')';
        descText =
          'Remove ' + display + ' from this clan? ' +
          'This action will completely unassign and remove the unit and all quantities from this clan. ' +
          'This action cannot be undone.';
      }


      openDeleteModal(titleText, descText, function () {
        return postAjax('shoshin_set_unit_qty', {
          rosterEntryId: String(entryId),
          unitKey: unitKey,
          qty: '0'
        }).then(function (data) {
          // 1) Remove the row visually
          tr.parentNode && tr.parentNode.removeChild(tr);

          // 2) Update assigned_units_json snapshot if server returns it
          if (data && data.assigned_units_json != null) {
            if (rosterObj2) rosterObj2.assigned_units_json = String(data.assigned_units_json || '');
          }

          // 3) Recompute totals + update Row1/Row2 immediately
          var newAssigned = [];
          try {
            newAssigned = JSON.parse(String((rosterObj2 && rosterObj2.assigned_units_json) || '[]')) || [];
          } catch (e) { newAssigned = []; }

          var totals = computeRosterTotalsFromAssigned(newAssigned);
          updateRosterCardStatsInDom(card2, rosterObj2, totals);

          // 4) If no assigned rows left, show empty state
          var tbody = card2.querySelector('.shoshin-assigned-strip tbody');
          if (tbody && tbody.children.length === 0) {
            var block = card2.querySelector('.shoshin-asset-block');
            if (block) {
              var scroll = card2.querySelector('.shoshin-roster-assigned-scroll');
              if (scroll) scroll.parentNode.removeChild(scroll);

              var empty = document.createElement('div');
              empty.className = 'shoshin-expansion-empty';
              empty.textContent = 'This clan currently has no assigned units.';
              block.appendChild(empty);
            }
          }

          // 5) Re-run filter/paging since points may have changed
          if (typeof applyRosterFilterAndPaging === 'function') {
            applyRosterFilterAndPaging();
          }
        });
      });

      return;
    }


    // -----------------------------
    // Row3 Unassign (modal): set FINAL qty (including 0 for full removal)
    // -----------------------------
    if (btn.classList.contains('shoshin-btn-unassign')) {
      var trU = btn.closest('tr[data-unit-key]');
      var cardU = btn.closest('.shoshin-roster-card');
      if (!trU || !cardU) return;

      var rosterEntryIdU = asInt(cardU.getAttribute('data-roster-entry-id'), 0);
      var unitKeyU = String(trU.getAttribute('data-unit-key') || '');

      if (!rosterEntryIdU || !unitKeyU) {
        alert('Missing roster entryId or unitKey.');
        return;
      }

      // Resolve roster object from in-memory rosters array
      var rosterObjU = null;
      if (Array.isArray(rosters)) {
        for (var iU = 0; iU < rosters.length; iU++) {
          var rU = rosters[iU];
          var ridU = asInt(rU && (rU.entryId || rU.id || rU.entry_id), 0);
          if (ridU === rosterEntryIdU) { rosterObjU = rU; break; }
        }
      }

      // Parse assigned array snapshot for preview calculations
      var assignedArrU = [];
      try {
        assignedArrU = JSON.parse(String((rosterObjU && rosterObjU.assigned_units_json) || '[]')) || [];
      } catch (eU) { assignedArrU = []; }

      // Find the unit row for label/ref/img/qty
      var unitRowU = null;
      for (var jU = 0; jU < assignedArrU.length; jU++) {
        if (String(assignedArrU[jU] && assignedArrU[jU].unitKey) === unitKeyU) {
          unitRowU = assignedArrU[jU];
          break;
        }
      }
      if (!unitRowU) {
        alert('Unit not found in roster assignments.');
        return;
      }

      var kindU = String(unitRowU.kind || '');
      var unitLabelU = '';
      if (kindU === 'support') {
        unitLabelU = String(unitRowU.name || unitRowU.supportType || unitRowU.cls || '');
      } else {
        unitLabelU = String(unitRowU.cls || unitRowU.name || '');
      }

      openUnassignModal({
        cardEl: cardU,
        trEl: trU,
        rosterEntryId: rosterEntryIdU,
        unitKey: unitKeyU,
        unitLabel: unitLabelU,
        refId: String(unitRowU.refId || ''),
        img: String(unitRowU.img || unitRowU.image || ''),
        rosterObj: rosterObjU,
        assignedArr: assignedArrU,
        currentQty: asInt(unitRowU.qty, 1)
      });
      return;
    }


  });

  // Qty change (delegated) — Daimyo max 1 + persist qty


  // Minimal fallback display if an icon fails and sets data-icon-fallback
  // (Your existing CSS hides button text via font-size:0; this ensures something still shows.)
  var style = document.createElement('style');
  style.textContent =
    '.shoshin-btn[data-icon-fallback]::before{content:attr(data-icon-fallback);font-size:16px;line-height:1;}' +
    '.shoshin-btn .shoshin-btn-icon{pointer-events:none;}';
  document.head.appendChild(style);
});
