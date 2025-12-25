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
    return (isNaN(x) ? (fallback || 0) : x);
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
    var ordStr = String(ord);
    while (ordStr.length < 3) ordStr = '0' + ordStr;
    return ordStr + '|' + key + '|' + k;
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
        // Always read as text first (handles HTML/WAF/fatal errors cleanly)
        return res.text().then(function (txt) {
          var json = null;

          // Try to parse JSON, but don’t assume it exists
          try {
            json = JSON.parse(txt);
          } catch (_) {
            json = null;
          }

          // If JSON parsed, use it; otherwise surface a readable snippet
          if (!json) {
            var snippet = String(txt || '').trim();
            if (snippet.length > 350) snippet = snippet.slice(0, 350) + '…';

            // If server returned an HTTP error, show that context
            var httpMsg = 'Request failed (non-JSON response).';
            if (!res.ok) httpMsg = 'Request failed (' + res.status + ' ' + (res.statusText || 'HTTP error') + ').';

            // Include snippet only if it’s non-empty
            throw new Error(httpMsg + (snippet ? (' ' + snippet) : ''));
          }

          // JSON exists but may still represent an error
          if (json.success !== true) {
            var msg =
              (json && json.data && json.data.message) ? json.data.message :
              (json && json.data && typeof json.data === 'string') ? json.data :
              (json && json.message) ? json.message :
              'Request failed.';
            throw new Error(String(msg));
          }

          // Happy path
          return json.data;
        });
      })
      .catch(function (err) {
        // Normalize to a useful Error
        if (err && err.message) throw err;
        throw new Error('Request failed.');
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
    if (name === 'ozutsu' || cls === 'artillery' || st === 'ozutsu' || st === 'artillery') return 'Artillery';

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
      // Defensive: if caller passed raw items without grouping, group first.
     assignedArr = groupAssigned(assignedArr);



    for (var i = 0; i < assignedArr.length; i++) {
      var u = assignedArr[i] || {};
      var kind = normalizeKind(u.kind);

      // ✅ FIX #2: default qty to 1 if missing (legacy safety)
      // Default missing/invalid qty to 1 (align with UI grouping behavior)
              var qty = (u.qty != null) ? asInt(u.qty, 1) : 1;
      if (qty < 1) qty = 1;

      // Daimyo hard-cap at 1 (enforced at grouping layer so UI + totals match)
      var clsKey = String(u.cls || u.class || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (clsKey === 'daimyo') qty = 1;



      var cls = String(u.cls || u.class || '').trim();

            // Normalize class key for counting (handles casing + extra spaces)
      var clsKeyNorm = cls.toLowerCase().replace(/\s+/g, ' ').trim();
      var CLS_MAP = {
        'daimyo': 'Daimyo',
        'samurai': 'Samurai',
        'ashigaru': 'Ashigaru',
        'sohei': 'Sohei',
        'ninja': 'Ninja',
        'onmyoji': 'Onmyoji'
      };
      var clsCanon = CLS_MAP[clsKeyNorm] || cls;


      // Daimyo hard-cap at 1
      var effQty = qty;
      if (clsKey === 'daimyo') effQty = 1;

      var points = asInt(u.points, asInt(u.cost, 0));
      totals.points += (points * effQty);
      totals.unitCount += effQty;

      var ini = asInt((u.ini != null ? u.ini : (u.stats && u.stats.ini)), 0);
      totals.initiative += (ini * effQty);

      // Honor = Leadership (LDR)
      var ldr = asInt((u.ldr != null ? u.ldr : (u.stats && u.stats.ldr)), 0);
      totals.honor += (ldr * effQty);

      if (kind === 'character') {
        if (totals.counts[clsCanon] != null) {
          totals.counts[clsCanon] += effQty;
          if (clsCanon === 'Daimyo' && totals.counts.Daimyo > 1) totals.counts.Daimyo = 1;
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
        descs[1].innerHTML = '<strong>Master Class Abilities:</strong> ' + esc(mca) + '';
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

  // ---------------------------------------------------------------------------
  // BANNER MODAL (Clan Banner) — SKELETON (Phase 1 baseline)
  // - Opens from Row1 Picture button
  // - Row1: preview image (96x96) + roster name + ref
  // - Row2: Remove Banner toggle (locked if no existing banner)
  // - Row3: WPForms Field #8 upload UI moved into modal if available
  // ---------------------------------------------------------------------------

  var bannerModal = null;
  var bannerModalBackdrop = null;
  var bannerModalEscBound = false;

  var bannerModalOnCloseFocusEl = null;
  var bannerCurrentRoster = null;

  // we physically move the WPForms field container into the modal,
  // so we need to restore it back on close.
  var bannerField8Container = null;
  var bannerField8OriginalParent = null;
  var bannerField8OriginalNextSibling = null;
  var bannerTempPreviewObjectUrl = null;
  var bannerUploaderWired = false;
  var bannerFormHost = null;
  var bannerFormHostOriginalParent = null;
  var bannerFormHostOriginalNextSibling = null;
  var bannerFormHostPrevDisplay = '';
  var bannerUploaderObserver = null;
  var bannerUploaderChangeHandlerBound = false;
  var bannerUploaderBoundScope = null;
  var bannerUploaderClickHandlerBound = false;
  var bannerUpdateBusy = false;

  function clearBannerModalError() {
    if (!bannerModal) return;
    var el = bannerModal.querySelector('.shoshin-modal-error');
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  }
  function showBannerModalError(msg) {
    if (!bannerModal) return;
    var el = bannerModal.querySelector('.shoshin-modal-error');
    if (el) { el.style.display = 'block'; el.textContent = String(msg || 'Update failed.'); }
  }
  function setBannerUpdateBusy(isBusy) {
    bannerUpdateBusy = !!isBusy;
    if (!bannerModal) return;
    var updateBtn = bannerModal.querySelector('.shoshin-banner-update-btn');
    var cancelBtn = bannerModal.querySelector('.shoshin-modal-btn-cancel');
    var xBtn = bannerModal.querySelector('.shoshin-modal-x');
    if (updateBtn) {
      updateBtn.disabled = !!isBusy;
      updateBtn.textContent = isBusy ? 'Working…' : 'Update';
    }
    if (cancelBtn) cancelBtn.disabled = !!isBusy;
    if (xBtn) xBtn.disabled = !!isBusy;
  }

  function ensureBannerModal() {
    if (bannerModal && bannerModalBackdrop) return;

    bannerModalBackdrop = document.createElement('div');
    bannerModalBackdrop.className = 'shoshin-modal-backdrop';
    bannerModalBackdrop.setAttribute('aria-hidden', 'true');

    bannerModal = document.createElement('div');
    bannerModal.className = 'shoshin-modal shoshin-banner-modal';
    bannerModal.setAttribute('role', 'dialog');
    bannerModal.setAttribute('aria-modal', 'true');
    bannerModal.setAttribute('aria-labelledby', 'shoshin-banner-modal-title');
    bannerModal.setAttribute('aria-describedby', 'shoshin-banner-modal-desc');

    bannerModal.innerHTML =
      '<div class="shoshin-modal-header">' +
        '<img class="shoshin-modal-logo" src="/wp-content/uploads/2025/11/Header_logo_300x150_1.png" alt="Site logo" />' +
        '<button type="button" class="shoshin-modal-x" aria-label="Close">×</button>' +
      '</div>' +

      '<div class="shoshin-modal-body">' +
        // accessible title/desc (hidden visually if you prefer later)
        '<div id="shoshin-banner-modal-title" class="shoshin-modal-title" style="display:none;">Update Clan Banner</div>' +
        '<div id="shoshin-banner-modal-desc" class="shoshin-modal-desc" style="display:none;">Update the clan banner image for this roster.</div>' +

        // Row 1
        '<div class="shoshin-banner-row1">' +
          '<div class="shoshin-banner-row1-title">Banner Preview</div>' +
          '<div class="shoshin-banner-preview">' +
            '<img class="shoshin-banner-img" src="/wp-content/uploads/2025/12/Helmet-grey.jpg" alt="" />' +
            '<div class="shoshin-banner-meta">' +
              '<div class="shoshin-banner-name">Roster</div>' +
              '<div class="shoshin-banner-ref">REF —</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Row 2
        '<div class="shoshin-banner-row2">' +
          '<div class="shoshin-banner-remove is-locked" data-locked="1">' +
            '<div class="shoshin-banner-remove-title">Remove Banner?</div>' +

            // iOS toggle (reuse your assign modal toggle visuals)
            '<label class="shoshin-ios-toggle">' +
              '<input type="checkbox" id="shoshinBannerRemoveToggle" />' +
              '<span class="track"><span class="thumb"></span></span>' +
            '</label>' +

            '<p class="shoshin-banner-remove-note">If enabled, the current banner will be removed when you click Update.</p>' +
          '</div>' +
        '</div>' +

        // Row 3
        '<div class="shoshin-banner-row3">' +
          '<div class="shoshin-clan-banner-slot" data-slot="banner">' +
            '<div class="shoshin-muted" style="text-align:center;">Uploader loading…</div>' +
          '</div>' +
        '</div>' +

        // error placeholder (for Phase 2 wiring)
        '<div class="shoshin-modal-error" style="display:none"></div>' +
      '</div>' +

      // actions
      '<div class="shoshin-modal-actions">' +
        '<button type="button" class="shoshin-modal-btn shoshin-modal-btn-cancel">Cancel</button>' +
        '<button type="button" class="shoshin-modal-btn shoshin-modal-btn-confirm shoshin-banner-update-btn">Update</button>' +
      '</div>';

    document.body.appendChild(bannerModalBackdrop);
    document.body.appendChild(bannerModal);

    bannerModalBackdrop.addEventListener('click', closeBannerModal);

    var xBtn = bannerModal.querySelector('.shoshin-modal-x');
    var cancelBtn = bannerModal.querySelector('.shoshin-modal-btn-cancel');
    if (xBtn) xBtn.addEventListener('click', closeBannerModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeBannerModal);

    var updateBtn = bannerModal.querySelector('.shoshin-banner-update-btn');
    if (updateBtn) {
      updateBtn.addEventListener('click', function () {
        if (bannerUpdateBusy) return;

        clearBannerModalError();

        if (!bannerCurrentRoster) {
          showBannerModalError('Missing roster context.');
          return;
        }

        var entryId = asInt(bannerCurrentRoster.entryId || bannerCurrentRoster.id || bannerCurrentRoster.entry_id, 0);
        if (!entryId) {
          showBannerModalError('Missing roster entryId.');
          return;
        }

        var removeToggle = bannerModal.querySelector('#shoshinBannerRemoveToggle');
        var removeOn = !!(removeToggle && removeToggle.checked);

        var fieldInput = document.querySelector('#wpforms-2799-field_8');
        var rawVal = fieldInput ? String(fieldInput.value || '') : '';

        var valueToSave = removeOn ? '' : rawVal;

        // Validate: must choose something
        if (!removeOn && !String(valueToSave).trim()) {
          showBannerModalError('Upload a banner image or enable “Remove Banner?” then click Update.');
          return;
        }

        setBannerUpdateBusy(true);

        postAjax('shoshin_update_roster_banner', {
          entryId: String(entryId),
          value: valueToSave
        })
          .then(function (data) {            // Update in-memory snapshot

            // Ensure in-memory roster data reflects the new banner state immediately.
            // Also clear any legacy icon fields on removal to prevent stale previews.
            try {
              var rawVal = (data && data.bannerRaw != null) ? String(data.bannerRaw) : valueToSave;
              // Keep canonical field_8 in sync
              bannerCurrentRoster.field_8 = rawVal;

              // Some older entries may also have banner/icon URLs stored on other keys.
              // When removing, clear them so the modal preview can't "stick" until refresh.
              if (removeOn) {
                bannerCurrentRoster.icon = '';
                bannerCurrentRoster.icon_url = '';
                bannerCurrentRoster.roster_icon = '';
                bannerCurrentRoster.banner = '';
                bannerCurrentRoster.banner_url = '';
                bannerCurrentRoster.bannerUrl = '';
              }

              // Also update the object inside the rosters array by entryId (defensive)
              for (var ri = 0; ri < rosters.length; ri++) {
                if (String(rosters[ri].entryId) === String(entryId)) {
                  rosters[ri].field_8 = rawVal;
                  if (removeOn) {
                    rosters[ri].icon = '';
                    rosters[ri].icon_url = '';
                    rosters[ri].roster_icon = '';
                    rosters[ri].banner = '';
                    rosters[ri].banner_url = '';
                    rosters[ri].bannerUrl = '';
                  }
                  break;
                }
              }
            } catch (eSync) {}

            // Update roster card avatar immediately
            var card = document.querySelector('.shoshin-roster-card[data-roster-entry-id="' + String(entryId) + '"]');
            if (card) {
              var avatarImg = card.querySelector('.shoshin-asset-avatar img');
              if (avatarImg) {
                avatarImg.src = (data && data.bannerUrl) ? String(data.bannerUrl) : '/wp-content/uploads/2025/12/Helmet-grey.jpg';
              }
            }

            // Update modal preview too
            var previewImg = bannerModal.querySelector('.shoshin-banner-img');
            if (previewImg) {
              previewImg.src = (data && data.bannerUrl) ? String(data.bannerUrl) : '/wp-content/uploads/2025/12/Helmet-grey.jpg';
            }            // Important: clear queued UI so “max files reached” doesn’t persist
            // If we removed the banner, also nuke any lingering Dropzone previews/objectURLs.
            try { 
              if (removeOn) { 
                clearBannerTempPreviewObjectUrl(); 
              }
              clearField8QueuedUi();
            } catch(e) {}

            // Re-sync row1 preview from the roster object before closing (prevents "sticky" previews).
            try { if (bannerCurrentRoster) syncBannerModalFromRoster(bannerCurrentRoster); } catch(e) {}

            closeBannerModal();})
          .catch(function (err) {
            showBannerModalError(err && err.message ? err.message : 'Update failed.');
          })
          .finally(function () {
            setBannerUpdateBusy(false);
          });
      });
    }

    // Esc closes
    if (!bannerModalEscBound) {
      bannerModalEscBound = true;
      document.addEventListener('keydown', function (e) {
        if (!bannerModalBackdrop || bannerModalBackdrop.getAttribute('aria-hidden') === 'true') return;
        if (e.key === 'Escape') closeBannerModal();
      });
    }
  }

  function setBannerModalVisible(isOpen) {
    setModalVisible(bannerModal, bannerModalBackdrop, isOpen);
  }

  function getRosterBannerUrlFromRosterObj(r) {
    var v =
      (r && (r.field_8 || r['8'] || r.icon || r.icon_url || r.roster_icon)) ||
      '';

    v = String(v || '').trim();
    if (!v) return '';

    // If it's already a URL, use it.
    if (/^https?:\/\//i.test(v) || v.indexOf('/wp-content/') === 0) return v;

    // If it's WPForms JSON, extract url/file.
    if (v[0] === '[' || v[0] === '{') {
      try {
        var parsed = JSON.parse(v);
        var obj = Array.isArray(parsed) ? (parsed[0] || null) : parsed;
        if (obj && obj.url) return String(obj.url).trim();
        // fallback: sometimes only "file" exists
        if (obj && obj.file) {
          // tmp path is what WPForms uses during upload; keep it conservative
          return '/wp-content/uploads/wpforms/tmp/' + String(obj.file).trim();
        }
      } catch (_) {}
    }

    // If it's just a filename, try resolving to tmp (best-effort).
    // (If you later store a final location, adjust here.)
    if (/^[^\/]+\.(png|bmp|jpe?g|webp)$/i.test(v)) {
      return '/wp-content/uploads/wpforms/tmp/' + v;
    }

    return '';
  }

  function getField8ContainerInModal() {
    if (!bannerModal) return null;
    return bannerModal.querySelector('#wpforms-2799-field_8-container') || null;
  }

  // ===== STEP 2A BEGIN — queued file detection (file + previewUrl) =====
  // Returns { hasQueued: bool, file: File|null, previewUrl: string|null }
  function readUploaderQueuedState() {
    var field8 = getField8ContainerInModal();
    if (!field8) return { hasQueued: false, file: null, previewUrl: null };

    // 1) Best case: actual <input type="file"> has a File object
    try {
      var fileInputs = field8.querySelectorAll('input[type="file"]');
      for (var i = 0; i < fileInputs.length; i++) {
        var inp = fileInputs[i];
        if (inp && inp.files && inp.files.length > 0) {
          return { hasQueued: true, file: (inp.files[0] || null), previewUrl: null };
        }
      }
    } catch (_) {}

    // 2) WPForms/Dropzone case: use rendered preview <img src="...">
    var img =
      field8.querySelector('.wpforms-uploader-preview img') ||
      field8.querySelector('.dz-image img') ||
      field8.querySelector('.dz-preview img') ||
      field8.querySelector('img');

    var previewUrl = (img && img.getAttribute && img.getAttribute('src')) ? String(img.getAttribute('src')) : null;

    // 3) DOM-based queued detection
    var hasQueued =
      !!field8.querySelector('.wpforms-uploader-preview') ||
      !!field8.querySelector('.dz-preview') ||
      !!field8.querySelector('.dz-filename') ||
      !!field8.querySelector('.dz-size') ||
      !!field8.querySelector('.wpforms-file-upload-name') ||
      !!field8.querySelector('.wpforms-file-upload-file') ||
      !!field8.querySelector('.wpforms-uploader-files') ||
      !!field8.querySelector('[data-name]');

    // If we have a previewUrl, treat as queued (even if other selectors vary)
    if (previewUrl) hasQueued = true;

    return { hasQueued: hasQueued, file: null, previewUrl: previewUrl };
  }
  // ===== STEP 2A END =====

  // ===== STEP 2B BEGIN — clear queued uploader state safely (WPForms/Dropzone) =====
  function clearField8QueuedUi() {
    try {
      var raw = document.querySelector('#wpforms-2799-field_8');
      if (raw) {
        raw.value = '';
        try { raw.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
      }
    } catch (_) {}

    var field8 = getField8ContainerInModal();
    if (!field8) return;

    // 1) Click any visible "remove" control WPForms renders
    // (We prefer clicking the real control so WPForms updates its internal state.)
    try {
      var removeBtn =
        field8.querySelector('.wpforms-uploader-preview .wpforms-uploader-remove') ||
        field8.querySelector('.dz-preview .dz-remove') ||
        field8.querySelector('.dz-preview [data-dz-remove]') ||
        field8.querySelector('.wpforms-file-upload-file-remove');

      if (removeBtn && typeof removeBtn.click === 'function') {
        removeBtn.click();
      }
    } catch (_) {}

    // 2) Clear any hidden inputs WPForms uses to remember uploaded file(s)
    // (This is what prevents the "max number allowed (1)" ghost state.)
    try {
      var hiddenInputs = field8.querySelectorAll('input[type="hidden"], input[type="text"][readonly]');
      for (var i = 0; i < hiddenInputs.length; i++) {
        var h = hiddenInputs[i];
        if (!h) continue;

        var name = String(h.getAttribute('name') || '').toLowerCase();
        var id   = String(h.getAttribute('id') || '').toLowerCase();

        // Heuristics: only clear fields that look like uploader storage
        if (
          name.indexOf('wpforms') !== -1 &&
          (name.indexOf('[fields]') !== -1 || name.indexOf('fields') !== -1) &&
          (name.indexOf('[8]') !== -1 || name.indexOf('field_8') !== -1 || id.indexOf('field_8') !== -1)
        ) {
          h.value = '';
          try { h.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
        }
      }
    } catch (_) {}

    // 3) If Dropzone instance exists, removeAllFiles(true)
    // (Some WPForms builds attach it on the clickable element.)
    try {
      var dzRoot = field8.querySelector('.dz-clickable') || field8.querySelector('.dropzone') || field8;
      if (dzRoot && dzRoot.dropzone && typeof dzRoot.dropzone.removeAllFiles === 'function') {
        dzRoot.dropzone.removeAllFiles(true);
      }
    } catch (_) {}

    // 4) Last resort: remove preview nodes only (avoid nuking the entire field markup)
    try {
      var previews = field8.querySelectorAll('.wpforms-uploader-preview, .dz-preview');
      for (var p = 0; p < previews.length; p++) {
        if (previews[p] && previews[p].parentNode) previews[p].parentNode.removeChild(previews[p]);
      }
    } catch (_) {}
  }
  // ===== STEP 2B END =====

  function restoreBannerFormHostToPage() {
    if (!bannerFormHost) return;

    // Undo any "hide everything except field 8" changes we made
    try {
      var touched = bannerFormHost.querySelectorAll('[data-shoshin-prev-display]');
      Array.prototype.forEach.call(touched, function (el) {
        el.style.display = el.getAttribute('data-shoshin-prev-display') || '';
        el.removeAttribute('data-shoshin-prev-display');
      });
    } catch (_) {}

    // Remove from modal slot
    try {
      if (bannerFormHost.parentNode) {
        bannerFormHost.parentNode.removeChild(bannerFormHost);
      }
    } catch (_) {}

    // Put it back exactly where it was
    if (bannerFormHostOriginalParent) {
      try {
        if (bannerFormHostOriginalNextSibling && bannerFormHostOriginalNextSibling.parentNode === bannerFormHostOriginalParent) {
          bannerFormHostOriginalParent.insertBefore(bannerFormHost, bannerFormHostOriginalNextSibling);
        } else {
          bannerFormHostOriginalParent.appendChild(bannerFormHost);
        }
      } catch (_) {}
    }

    // Restore original display state (so Field 8 doesn't show on the page after modal close)
    try {
      // Restore exactly what the page had before opening the modal.
      // If it was hidden, it'll go back hidden.
      bannerFormHost.style.display = bannerFormHostPrevDisplay || 'none';

    } catch (_) {}

    bannerFormHost = null;
    bannerFormHostOriginalParent = null;
    bannerFormHostOriginalNextSibling = null;
    bannerFormHostPrevDisplay = '';

  }

  function clearBannerTempPreviewObjectUrl() {
    if (bannerTempPreviewObjectUrl) {
      try { URL.revokeObjectURL(bannerTempPreviewObjectUrl); } catch (_) {}
      bannerTempPreviewObjectUrl = null;
    }
  }

  function wireBannerUploaderEvents() {
    if (!bannerModal) return;

    // We wire against the moved host so it works even if WPForms swaps field DOM.
    var scope = bannerFormHost || bannerModal;
    if (!scope) return;

    // If scope changed since last open, allow re-binding
    if (bannerUploaderBoundScope !== scope) {
      bannerUploaderChangeHandlerBound = false;
      bannerUploaderClickHandlerBound = false;
      bannerUploaderBoundScope = scope;
    }

    function setToggleState(hasQueued) {
      var removeToggle = bannerModal.querySelector('#shoshinBannerRemoveToggle');
      var removeWrap = bannerModal.querySelector('.shoshin-banner-remove');

      var existingUrl = bannerCurrentRoster ? getRosterBannerUrlFromRosterObj(bannerCurrentRoster) : '';

      if (removeToggle) {
        if (hasQueued) {
          removeToggle.checked = false;     // force OFF
          removeToggle.disabled = true;     // disable
        } else {
          removeToggle.checked = false;     // default OFF
          removeToggle.disabled = !existingUrl; // enable only if existing banner
        }
      }

      if (removeWrap) {
        if (removeToggle && removeToggle.disabled) {
          removeWrap.classList.add('is-locked');
          removeWrap.setAttribute('data-locked', '1');
        } else {
          removeWrap.classList.remove('is-locked');
          removeWrap.setAttribute('data-locked', '0');
        }
      }
    }

    function setRow1PreviewFromFile(file) {
      var imgEl = bannerModal.querySelector('.shoshin-banner-img');
      if (!imgEl) return;

      // If we already created an object URL earlier, revoke it
      clearBannerTempPreviewObjectUrl();

      try {
        bannerTempPreviewObjectUrl = URL.createObjectURL(file);
        imgEl.src = bannerTempPreviewObjectUrl;
      } catch (_) {}
    }

    function setRow1PreviewFromRosterOrFallback() {
      var imgEl = bannerModal.querySelector('.shoshin-banner-img');
      if (!imgEl) return;

      var existingUrl = bannerCurrentRoster ? getRosterBannerUrlFromRosterObj(bannerCurrentRoster) : '';
      var fallbackUrl = '/wp-content/uploads/2025/12/Helmet-grey.jpg';
      imgEl.src = existingUrl || fallbackUrl;
    }

    function applyBannerStateNow() {
      var st = readUploaderQueuedState();

      if (st.hasQueued) {
        setToggleState(true);

        // Prefer real File object if available
        if (st.file) {
          setRow1PreviewFromFile(st.file);
          return;
        }

        // Otherwise mirror WPForms rendered preview image
        if (st.previewUrl) {
          var imgEl = bannerModal.querySelector('.shoshin-banner-img');
          if (imgEl) imgEl.src = st.previewUrl;
          return;
        }

        return;
      }

      // no queued file
      clearBannerTempPreviewObjectUrl();
      setToggleState(false);
      setRow1PreviewFromRosterOrFallback();
    }

    // --- 1) Capture-phase change handler for ANY file input in the moved host ---
    if (!bannerUploaderChangeHandlerBound) {
      bannerUploaderChangeHandlerBound = true;

      scope.addEventListener('change', function (e) {
        var t = e && e.target ? e.target : null;
        if (!t) return;

        // Only react to file inputs
        if (t.tagName && String(t.tagName).toLowerCase() === 'input' && String(t.type).toLowerCase() === 'file') {
          applyBannerStateNow();
          setTimeout(applyBannerStateNow, 50);
          setTimeout(applyBannerStateNow, 250);
          setTimeout(applyBannerStateNow, 800);
        }
      }, true);
    }

    // Also react on clicks inside the uploader area (Dropzone can be finicky)
    if (!bannerUploaderClickHandlerBound) {
      bannerUploaderClickHandlerBound = true;
      scope.addEventListener('click', function (e) {
        var field8 = getField8ContainerInModal();
        if (!field8) return;
        if (e && e.target && field8.contains(e.target)) {
          setTimeout(applyBannerStateNow, 30);
        }
      }, true);
    }

    // --- 2) MutationObserver: WPForms may rebuild the preview DOM after change/remove ---
    try {
      if (bannerUploaderObserver) {
        try { bannerUploaderObserver.disconnect(); } catch (_) {}
        bannerUploaderObserver = null;
      }

      bannerUploaderObserver = new MutationObserver(function () {
        applyBannerStateNow();
      });

      bannerUploaderObserver.observe(scope, { childList: true, subtree: true });
    } catch (_) {}

    applyBannerStateNow();
  }

  function mountBannerFormHostIntoModal() {
    if (!bannerModal) return;

    var slot = bannerModal.querySelector('.shoshin-clan-banner-slot');
    if (!slot) return;

    // Clear slot content first
    slot.innerHTML = '';

    // Move the *whole* WPForms host (contains the <form>) into the modal
    var host = document.getElementById('shoshin-banner-form-host');
    if (!host) {
      slot.innerHTML =
        '<div class="shoshin-muted" style="text-align:center;">' +
          'Banner uploader is not available on this page (missing #shoshin-banner-form-host).' +
        '</div>';
      return;
    }

    bannerFormHost = host;
    bannerFormHostOriginalParent = host.parentNode;
    bannerFormHostOriginalNextSibling = host.nextSibling;

    // Store computed display so restore is accurate even if hidden via CSS
      try {
        bannerFormHostPrevDisplay = window.getComputedStyle(host).display || '';
      } catch (_) {
        bannerFormHostPrevDisplay = host.style.display || '';
      }
      host.style.display = 'block';



    // Hide everything except Field #8 container while in modal
    try {
      var hideSelectors = [
        '.wpforms-title',
        '.wpforms-description',
        '.wpforms-submit-container',
        '.wpforms-page-indicator',
        '.wpforms-field:not(#wpforms-2799-field_8-container)'
      ];

      hideSelectors.forEach(function (sel) {
        var nodes = host.querySelectorAll(sel);
        Array.prototype.forEach.call(nodes, function (el) {
          if (!el.hasAttribute('data-shoshin-prev-display')) {
            el.setAttribute('data-shoshin-prev-display', el.style.display || '');
          }
          el.style.display = 'none';
        });
      });
    } catch (_) {}

    slot.appendChild(host);
  }

  function syncBannerModalFromRoster(rosterObj) {
    if (!bannerModal) return;

  // Defensive: if an objectURL preview was set previously, revoke it before syncing.
  try { clearBannerTempPreviewObjectUrl(); } catch(e) {}
    var imgEl = bannerModal.querySelector('.shoshin-banner-img');
    var nameEl = bannerModal.querySelector('.shoshin-banner-name');
    var refEl = bannerModal.querySelector('.shoshin-banner-ref');

    var removeWrap = bannerModal.querySelector('.shoshin-banner-remove');
    var removeToggle = bannerModal.querySelector('#shoshinBannerRemoveToggle');

    var name = rosterObj ? String(rosterObj.name || rosterObj.roster_name || 'Untitled Roster') : 'Roster';
    var ref = rosterObj ? String(rosterObj.refId || rosterObj.ref_id || '').trim() : '';

    var bannerUrl = rosterObj ? getRosterBannerUrlFromRosterObj(rosterObj) : '';
    var fallbackUrl = '/wp-content/uploads/2025/12/Helmet-grey.jpg';

    if (nameEl) nameEl.textContent = name;
    if (refEl) refEl.textContent = ref ? ('REF ID ' + ref) : 'REF —';

    if (imgEl) imgEl.src = bannerUrl || fallbackUrl;

    // Toggle lock state
    var hasExisting = !!bannerUrl;
    if (removeToggle) {
      removeToggle.checked = false;
      removeToggle.disabled = !hasExisting;
    }
    if (removeWrap) {
      if (hasExisting) {
        removeWrap.classList.remove('is-locked');
        removeWrap.setAttribute('data-locked', '0');
      } else {
        removeWrap.classList.add('is-locked');
        removeWrap.setAttribute('data-locked', '1');
      }
    }
  }

  function openBannerModalForRosterEntryId(rosterEntryId, focusReturnEl) {
    ensureBannerModal();

    bannerModalOnCloseFocusEl = focusReturnEl || null;

    var rObj = getRosterObjByEntryId(rosterEntryId);
    bannerCurrentRoster = rObj || null;

    syncBannerModalFromRoster(bannerCurrentRoster);
    mountBannerFormHostIntoModal();

    clearField8QueuedUi();
    wireBannerUploaderEvents();

    setBannerModalVisible(true);

    var updateBtn = bannerModal.querySelector('.shoshin-banner-update-btn');
    if (updateBtn) updateBtn.focus();
  }

  function closeBannerModal() {
    if (!bannerModalBackdrop || !bannerModal) return;

    clearBannerTempPreviewObjectUrl();
    clearField8QueuedUi();
    restoreBannerFormHostToPage();

  // Reset the modal preview so a removed banner can't visually persist between openings.
  try {
    var imgEl = bannerModal.querySelector('.shoshin-banner-img');
    if (imgEl) imgEl.src = '/wp-content/uploads/2025/12/helmet.webp';
  } catch(e) {}

  bannerCurrentRoster = null;

    if (bannerUploaderObserver) {
      try { bannerUploaderObserver.disconnect(); } catch (_) {}
      bannerUploaderObserver = null;
    }

    bannerUploaderWired = false;
    bannerUploaderChangeHandlerBound = false;
    bannerUploaderClickHandlerBound = false;

    setBannerModalVisible(false);

    if (bannerModalOnCloseFocusEl && bannerModalOnCloseFocusEl.focus) {
      try { bannerModalOnCloseFocusEl.focus(); } catch (_) {}
    }
    bannerModalOnCloseFocusEl = null;
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


// ==========================================================================
// UNASSIGN MODAL (Row3) — PERSISTED (Phase 2)
// - Confirm persists final qty via AJAX (shoshin_set_unit_qty)
// - Updates Row3 DOM + recomputes totals (Row1/Row2)
// - Clean open/close lifecycle + ESC support + busy lock
// ==========================================================================
var unassignModal = null;
var unassignModalBackdrop = null;
var unassignCtx = null; // { cardEl, trEl, rosterEntryId, unitKey, unitLabel, refId, img, currentQty }

var unassignBusy = false;
var unassignEscBound = false;

function clearUnassignModalError() {
  if (!unassignModal) return;
  var errEl = unassignModal.querySelector('.shoshin-modal-error');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
}

function showUnassignModalError(msg) {
  if (!unassignModal) return;
  var errEl = unassignModal.querySelector('.shoshin-modal-error');
  if (errEl) {
    errEl.textContent = String(msg || 'Unassign failed.');
    errEl.style.display = 'block';
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

  if (confirmBtn) confirmBtn.textContent = isBusy ? 'Working…' : 'Unassign';
}

// ==========================================================================
// UNASSIGN MODAL — PREVIEW (restore from regressed behavior)
// - Shows Current vs After totals before confirm
// - Recomputes on qty select change
// ==========================================================================

function buildUnassignAfterAssigned(groupedAssignedArr, unitKey, selectedQty) {
  // groupedAssignedArr MUST be grouped (1 row per unitKey)
  var out = [];
  for (var i = 0; i < (groupedAssignedArr || []).length; i++) {
    var u = groupedAssignedArr[i];
    if (!u) continue;

    var uk = String(u.unitKey || '').trim();
    if (!uk) uk = makeUnitKey(u);

    if (uk === String(unitKey)) {
      var q = asInt(selectedQty, 0);
      if (q > 0) {
        out.push(Object.assign({}, u, { unitKey: uk, qty: q }));
      }
      // if q <= 0 => removed entirely
    } else {
      out.push(Object.assign({}, u, { unitKey: uk, qty: asInt(u.qty, 1) }));
    }
  }
  return out;
}

function renderUnassignPreviewRow(rosterObj, totals) {
  var name =
    (rosterObj && (rosterObj.name || rosterObj.roster_name || rosterObj.rosterName)) ?
      String(rosterObj.name || rosterObj.roster_name || rosterObj.rosterName) :
      'Untitled Roster';

  var refId =
    (rosterObj && (rosterObj.refId || rosterObj.ref_id)) ?
      String(rosterObj.refId || rosterObj.ref_id) :
      '';

  // Use the same icon resolver you’re using elsewhere (banner-aware)
  var avatar = getRosterIcon(rosterObj);

  var pts   = asInt(totals && totals.points, 0);
  var units = asInt(totals && (totals.unitCount != null ? totals.unitCount : totals.units), 0);
  var ini   = asInt(totals && totals.initiative, 0);
  var honor = asInt(totals && totals.honor, 0);

  return (
    '<div class="shoshin-unassign-preview-row">' +
      '<div class="shoshin-unassign-preview-roster">' +
        '<div class="shoshin-unassign-preview-avatar">' +
          '<img src="' + esc(avatar) + '" alt="" />' +
        '</div>' +
        '<div class="shoshin-unassign-preview-meta">' +
          '<div class="shoshin-unassign-preview-name">' + esc(name) + '</div>' +
          '<div class="shoshin-unassign-preview-ref">' + (refId ? ('REF ID ' + esc(refId)) : 'REF —') + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="shoshin-unassign-preview-stats">' +
        '<table class="shoshin-stat-strip"><tbody><tr>' +
          '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Points</div><div class="shoshin-stat-value">' + esc(pts) + '</div></div></td>' +
          '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Units</div><div class="shoshin-stat-value">' + esc(units) + '</div></div></td>' +
          '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Initiative</div><div class="shoshin-stat-value">' + esc(ini) + '</div></div></td>' +
          '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Honor</div><div class="shoshin-stat-value">' + esc(honor) + '</div></div></td>' +
        '</tr></tbody></table>' +
      '</div>' +
    '</div>'
  );
}

function recomputeUnassignPreview() {
  if (!unassignModal || !unassignCtx) return;

  var beforeEl = unassignModal.querySelector('#shoshinUnassignPreviewBefore');
  var afterEl  = unassignModal.querySelector('#shoshinUnassignPreviewAfter');
  if (!beforeEl || !afterEl) return;

  // Must have grouped snapshot in ctx
  var grouped = (unassignCtx.assignedGrouped && Array.isArray(unassignCtx.assignedGrouped))
    ? unassignCtx.assignedGrouped
    : [];

  var qtySel = unassignModal.querySelector('.shoshin-assign-qty-select');
  var selectedQty = qtySel ? asInt(qtySel.value, 0) : 0;

  var beforeTotals = computeRosterTotalsFromAssigned(grouped);

  var afterGrouped = buildUnassignAfterAssigned(grouped, unassignCtx.unitKey, selectedQty);
  var afterTotals  = computeRosterTotalsFromAssigned(afterGrouped);

  // =======================================================
// % of Clan Points (Current vs After) — Unassign Preview
// =======================================================

var pctBeforeEl = unassignModal.querySelector('#shoshin-unassign-pct-before');
var pctAfterEl  = unassignModal.querySelector('#shoshin-unassign-pct-after');

var unitCost = asInt(unassignCtx.unitCost, 0);

// unit contribution BEFORE / AFTER
var unitPtsBefore = unitCost * asInt(unassignCtx.currentQty, 1);
var unitPtsAfter  = unitCost * selectedQty;

// roster totals BEFORE / AFTER
var denomBefore = asInt(beforeTotals && beforeTotals.points, 0);
var denomAfter  = asInt(afterTotals  && afterTotals.points, 0);

// round UP, no decimals
var pctBefore = denomBefore > 0
  ? Math.ceil((unitPtsBefore / denomBefore) * 100)
  : 0;

var pctAfter = denomAfter > 0
  ? Math.ceil((unitPtsAfter / denomAfter) * 100)
  : 0;

// render "(33%)"
if (pctBeforeEl) pctBeforeEl.textContent = '(' + pctBefore + '%)';
if (pctAfterEl)  pctAfterEl.textContent  = '(' + pctAfter  + '%)';


  var rosterObj = getRosterObjByEntryId(unassignCtx.rosterEntryId) || null;

  beforeEl.innerHTML = renderUnassignPreviewRow(rosterObj, beforeTotals);
  afterEl.innerHTML  = renderUnassignPreviewRow(rosterObj, afterTotals);
}


function ensureUnassignModal() {
  if (unassignModal && unassignModalBackdrop) return;

  unassignModalBackdrop = document.createElement('div');
  unassignModalBackdrop.className = 'shoshin-modal-backdrop';
  
  unassignModalBackdrop.setAttribute('aria-hidden', 'true');

  unassignModal = document.createElement('div');
  unassignModal.className = 'shoshin-modal shoshin-unassign-modal';

  
  unassignModal.setAttribute('role', 'dialog');
  unassignModal.setAttribute('aria-modal', 'true');
  unassignModal.setAttribute('aria-labelledby', 'shoshin-unassign-modal-title');
  unassignModal.setAttribute('aria-describedby', 'shoshin-unassign-modal-desc');

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
            '<div class="shoshin-unassign-unit-cost"></div>' +
            '<div class="shoshin-unassign-current-qty"></div>' +
          '</div>' +
        '</div>' +
        '<div class="shoshin-assign-qty">' +
          '<div class="shoshin-assign-qty-title">New Quantity</div>' +
          '<select class="shoshin-assign-qty-select"></select>' +
        '</div>' +
      '</div>' +

      '<!-- PREVIEW (Current vs After) -->' +
      '<div class="shoshin-unassign-preview-wrap">' +
        '<div class="shoshin-unassign-preview-title">Roster Preview</div>' +

        '<div class="shoshin-unassign-preview-columns">' +
          '<div class="shoshin-unassign-preview-col">' +
           '<div class="shoshin-unassign-preview-col-title">Current <span id="shoshin-unassign-pct-before" class="shoshin-unassign-preview-pct"></span></div>' +

            '<div id="shoshinUnassignPreviewBefore" class="shoshin-unassign-preview-panel"></div>' +
          '</div>' +

          '<div class="shoshin-unassign-preview-col">' +
            '<div class="shoshin-unassign-preview-col-title">After <span id="shoshin-unassign-pct-after" class="shoshin-unassign-preview-pct"></span></div>' +
            '<div id="shoshinUnassignPreviewAfter" class="shoshin-unassign-preview-panel"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div id="shoshin-unassign-modal-desc" class="shoshin-modal-desc" style="margin-top:12px;"></div>' +

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

  // ESC closes (bind once)
  if (!unassignEscBound) {
    unassignEscBound = true;
    document.addEventListener('keydown', function (e) {
      if (!unassignModal || !unassignModalBackdrop) return;
      if (unassignModalBackdrop.getAttribute('aria-hidden') === 'true') return;
      if (e.key === 'Escape' || e.key === 'Esc') closeUnassignModal();
    });
  }

  // Recompute preview when qty changes
var qtySel = unassignModal.querySelector('.shoshin-assign-qty-select');
if (qtySel) {
  qtySel.addEventListener('change', function () {
    recomputeUnassignPreview();
  });
}


  // Confirm persists final qty
  var confirmBtn = unassignModal.querySelector('.shoshin-modal-btn-confirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', function () {
      if (unassignBusy) return;
      if (!unassignCtx) return;

      var qtySel = unassignModal.querySelector('.shoshin-assign-qty-select');
      var selectedQty = qtySel ? asInt(qtySel.value, 0) : 0;

      unassignBusy = true;
      clearUnassignModalError();
      setUnassignModalBusy(true);

      postAjax('shoshin_set_unit_qty', {
        rosterEntryId: String(unassignCtx.rosterEntryId),
        unitKey: String(unassignCtx.unitKey),
        qty: String(selectedQty)
      })
        .then(function (data) {
          // Update in-memory roster snapshot if server returned it
          if (data && data.assigned_units_json != null) {
            var rosterObj = getRosterObjByEntryId(unassignCtx.rosterEntryId);
            if (rosterObj) rosterObj.assigned_units_json = String(data.assigned_units_json || '');
          }

          var rosterObj2 = getRosterObjByEntryId(unassignCtx.rosterEntryId) || null;

          // Build grouped list ONCE (needed for Row3 qty lookup)
            var grouped = groupAssigned(parseAssigned(rosterObj2 || {}));

            // Update Row3 DOM
            if (selectedQty <= 0) {
              if (unassignCtx.trEl && unassignCtx.trEl.parentNode) {
                unassignCtx.trEl.parentNode.removeChild(unassignCtx.trEl);
              }
            } else {
              // Find grouped qty for this unitKey and write only the value span
              var found = null;
              for (var i = 0; i < grouped.length; i++) {
                if (String(grouped[i] && grouped[i].unitKey) === String(unassignCtx.unitKey)) {
                  found = grouped[i];
                  break;
                }
              }

              var qtyTd = unassignCtx.trEl ? unassignCtx.trEl.querySelector('td.shoshin-assigned-qty-td') : null;
              var qtyVal = qtyTd ? qtyTd.querySelector('.shoshin-stat-value') : null;
              if (qtyVal && found) qtyVal.textContent = String(asInt(found.qty, 1));
            }

            // Totals recompute + update Row1/Row2
            // Pass RAW assigned list (totals fn groups defensively)
            var totals = computeRosterTotalsFromAssigned(parseAssigned(rosterObj2 || {}));
            updateRosterCardStatsInDom(unassignCtx.cardEl, rosterObj2, totals);


          // Empty-state handling if last row removed
          var tbody = unassignCtx.cardEl ? unassignCtx.cardEl.querySelector('.shoshin-assigned-strip tbody') : null;
          if (tbody && tbody.children.length === 0) {
            var block = unassignCtx.cardEl.querySelector('.shoshin-asset-block');
            if (block) {
              var scroll = unassignCtx.cardEl.querySelector('.shoshin-roster-assigned-scroll');
              if (scroll && scroll.parentNode) scroll.parentNode.removeChild(scroll);

              var empty = document.createElement('div');
              empty.className = 'shoshin-expansion-empty';
              empty.textContent = 'This clan currently has no assigned units.';
              block.appendChild(empty);
            }
          }

          // Filter/paging may change due to points changes
          if (typeof applyRosterFilterAndPaging === 'function') {
            applyRosterFilterAndPaging();
          }

          closeUnassignModal();
        })
        .catch(function (err) {
          showUnassignModalError(err && err.message ? err.message : 'Unassign failed.');
        })
        .finally(function () {
          unassignBusy = false;
          setUnassignModalBusy(false);
        });
    });
  }
}

function closeUnassignModal() {
  if (!unassignModal || !unassignModalBackdrop) return;

  unassignBusy = false;
  clearUnassignModalError();
  setUnassignModalBusy(false);

  setModalVisible(unassignModal, unassignModalBackdrop, false);

  unassignCtx = null;
}

function openUnassignModal(ctx) {
  ensureUnassignModal();
  unassignCtx = ctx || null;

  clearUnassignModalError();
  setUnassignModalBusy(false);

  var titleEl = unassignModal.querySelector('#shoshin-unassign-modal-title');
  var descEl  = unassignModal.querySelector('#shoshin-unassign-modal-desc');
  var imgEl   = unassignModal.querySelector('.shoshin-assign-asset-img');
  var clsEl   = unassignModal.querySelector('.shoshin-assign-asset-class');
  var refEl   = unassignModal.querySelector('.shoshin-assign-asset-ref');
  var qtyCur  = unassignModal.querySelector('.shoshin-unassign-current-qty');
  var qtySel  = unassignModal.querySelector('.shoshin-assign-qty-select');

  var label = String((ctx && ctx.unitLabel) || 'Unit');
  var refId = String((ctx && ctx.refId) || '');
  var img   = String((ctx && ctx.img) || '');
  var curQ  = asInt((ctx && ctx.currentQty), 1);

// Header + message rules (restored from regressed version)
if (curQ === 1) {
  if (titleEl) titleEl.textContent = 'Unassign completely from this clan?';
  if (descEl) {
    descEl.textContent =
      'Removing ' + label + (refId ? ' ' + refId : '') +
      ' from this clan will completely remove this unit and cannot be undone!';
  }
} else {
  if (titleEl) titleEl.textContent = 'How many units to Unassign?';
  if (descEl) {
    descEl.textContent =
      'Select the quantity of ' + label + (refId ? ' ' + refId : '') +
      ' to unassign from this clan. This action cannot be undone!';
  }
}

  if (clsEl)   clsEl.textContent   = label;
  if (refEl)   refEl.textContent   = refId ? ('REF: ' + refId) : '';
  if (qtyCur)  qtyCur.textContent  = 'Current QTY: ' + String(curQ);

  var unitCostEl = unassignModal.querySelector('.shoshin-unassign-unit-cost');
  if (unitCostEl) unitCostEl.textContent = 'Unit Cost: ' + String(asInt((ctx && ctx.unitCost), 0));
  if (imgEl) {
    if (img) {
      imgEl.src = img;
      imgEl.style.display = '';
    } else {
      imgEl.removeAttribute('src');
      imgEl.style.display = 'none';
    }
  }

  // Select options:
// - Normal units: 0..(curQ-1) (reduction-only UX)
// - Daimyo: ONLY 0 or 1 (hard cap), even if bad data shows >1
var isDaimyo = !!(ctx && ctx.isDaimyo);

if (qtySel) {
  qtySel.innerHTML = '';

  if (isDaimyo) {
      // Daimyo can only ever be 0 or 1; we do NOT offer "1" as a selectable option here.
      var opt0 = document.createElement('option');
      opt0.value = '0';
      opt0.textContent = '0 (Remove from roster)';
      qtySel.appendChild(opt0);
      qtySel.value = '0';
    } else {
    for (var q = 0; q <= Math.max(0, curQ - 1); q++) {
      var opt = document.createElement('option');
      opt.value = String(q);
      opt.textContent = (q === 0) ? '0 (Remove from roster)' : String(q);
      qtySel.appendChild(opt);
    }

    // default to "curQ - 1" (first reduction) if possible, otherwise 0
    qtySel.value = String(Math.max(0, curQ - 1));
  }
}



  
  // ---- PREVIEW SNAPSHOT (grouped assigned) ----
  try {
    var rosterObjP = getRosterObjByEntryId(unassignCtx.rosterEntryId);
    unassignCtx.assignedGrouped = groupAssigned(parseAssigned(rosterObjP || {}));
  } catch (_) {
    unassignCtx.assignedGrouped = [];
  }

  // Render preview BEFORE visible + after open (layout-safe)
  recomputeUnassignPreview();
  setTimeout(recomputeUnassignPreview, 0);

  setModalVisible(unassignModal, unassignModalBackdrop, true);

  // One more tick after visible (some CSS transitions/layout can delay)
  setTimeout(recomputeUnassignPreview, 30);

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
        Array.prototype.forEach.call(bar.querySelectorAll('.shoshin-asset-filter-btn'), function (b) { b.classList.remove('is-active'); });

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
    for (var i2 = 0; i2 < cards.length; i2++) cards[i2].style.display = 'none';

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
    Array.prototype.forEach.call(openDetails, function (d) {
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

      // Daimyo hard-cap at 1 (grouping layer)
      var clsKey = String(u.cls || u.class || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (clsKey === 'daimyo') qty = 1;


             if (!map[unitKey]) {
        map[unitKey] = Object.assign({}, u, { unitKey: unitKey, qty: qty });
      } else {
        // If Daimyo, enforce cap; otherwise aggregate normally
        if (clsKey === 'daimyo') {
          map[unitKey].qty = 1;
        } else {
          map[unitKey].qty += qty;
        }
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
    var iconUrl =
      r.icon ||
      r.icon_url ||
      r.roster_icon ||
      getRosterBannerUrlFromRosterObj(r) ||
      '';
    iconUrl = String(iconUrl || '').trim();
    if (!iconUrl) iconUrl = '/wp-content/uploads/2025/12/Helmet-grey.jpg';
    return iconUrl;
  }

  function renderAssignedStripRow(u, rosterEntryId, clanPointsForPercent) {

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

    // % of Clan Points (rounded up, no decimals)
// Prefer passed-in clan points (computed during roster render / recompute).
var clanPoints = asInt(clanPointsForPercent, 0);

var percentOfClan = clanPoints > 0
  ? Math.ceil((totalCost / clanPoints) * 100)
  : 0;




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

        // % column (Totals share of Clan Points)
'<td class="shoshin-assigned-percent-td">' +
  '<div class="shoshin-stat-cell">' +
    '<div class="shoshin-stat-label"></div>' +
    '<div class="shoshin-stat-value">' + esc(percentOfClan) + '%</div>' +
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

    // Prefer stored points if present, otherwise compute from assigned_units_json
var clanPoints = asInt(r.points, 0);

var assigned = parseAssigned(r);
var grouped = groupAssigned(assigned);

// If points aren't stored (or are 0), compute from assigned list
if (clanPoints <= 0 && Array.isArray(grouped) && grouped.length) {
  var totalsBootstrap = computeRosterTotalsFromAssigned(grouped);
  clanPoints = asInt(totalsBootstrap.points, 0);

  // Keep in-memory roster object aligned (helps later UI refreshes)
  r.points = clanPoints;
}

var masterClassAvail = Math.floor(clanPoints / 125);


    var rosterEntryId = asInt((r.entryId || r.id || r.entry_id), 0);

    var iconUrl = getRosterIcon(r);

    var detailsId = 'shoshin-roster-details-' + idx + '-' + (refId ? refId.replace(/[^a-zA-Z0-9_-]/g, '') : 'x');

   
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
  row3BodyHtml += renderAssignedStripRow(grouped[i], rosterEntryId, clanPoints);
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
          // (unchanged: your original no-space formatting)
          '<div class="shoshin-asset-class-desc"><strong>Master Class Abilities:</strong> ' + esc(masterClassAvail) + '</div>' +
        '</div>' +

        '<div class="shoshin-asset-actions row1-actions">' +

          '<button type="button" class="shoshin-btn shoshin-btn-picture shoshin-btn-picture-roster" data-tooltip="Update Clan Banner" aria-label="Update Clan Banner">' +
            iconImg(ICONS.picture, 'Update Clan Banner', '🖼️') +
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

      var details = document.getElementById(id);
      if (!details || !card.contains(details)) return;

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
          Array.prototype.forEach.call(scope.querySelectorAll('.shoshin-roster-card'), function (c) {
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
    // Row1 Picture button (TEMP ANCHOR ONLY)
    // -----------------------------
    if (btn.classList.contains('shoshin-btn-picture-roster')) {
      var cardPic = btn.closest('.shoshin-roster-card');
      if (!cardPic) return;

      var ridPic = asInt(cardPic.getAttribute('data-roster-entry-id'), 0);
      if (!ridPic) {
        console.warn('Shoshin: Banner click missing roster entryId.');
        return;
      }

      openBannerModalForRosterEntryId(ridPic, btn);
      return;
    }

    // -----------------------------
    // Row1 Assign button (scoped nav only for now)
    // -----------------------------
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
      // ✅ FIX #1: remove Array.prototype.find() usage (compat)
      var rosterObj = null;
      if (Array.isArray(rosters)) {
        for (var ri = 0; ri < rosters.length; ri++) {
          var r = rosters[ri];
          var rid = asInt(r && (r.entryId || r.id || r.entry_id), 0);
          if (rid === rosterEntryId) { rosterObj = r; break; }
        }
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

      var titleText2 = 'Remove unit from clan?';
      var descText2 =
        'This action will completely unassign and remove the unit and all quantities from this clan. ' +
        'This action cannot be undone.';

      if (unitLabel || unitRef) {
        var display = unitLabel || 'this unit';
        if (unitRef) display += ' (' + unitRef + ')';
        descText2 =
          'Remove ' + display + ' from this clan? ' +
          'This action will completely unassign and remove the unit and all quantities from this clan. ' +
          'This action cannot be undone.';
      }

      openDeleteModal(titleText2, descText2, function () {
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

          
          // Totals recompute (totals fn groups defensively)
            var totals = computeRosterTotalsFromAssigned(parseAssigned(rosterObj2 || {}));
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
    // Row3 Unassign: focus qty input
    // -----------------------------
    // REPLACE: Row3 Unassign opens modal (Phase 1: UI only)
    // Row3 Unassign opens modal (persisted via Confirm)
    if (btn.classList.contains('shoshin-btn-unassign')) {
      var trU = btn.closest('tr[data-unit-key]');
      var cardU = btn.closest('.shoshin-roster-card');
      if (!trU || !cardU) return;

      var rosterEntryIdU = asInt(cardU.getAttribute('data-roster-entry-id'), 0);
      var unitKeyU = String(trU.getAttribute('data-unit-key') || '').trim();

      if (!rosterEntryIdU || !unitKeyU) {
        alert('Missing roster entryId or unitKey.');
        return;
      }

      var rosterObjU = getRosterObjByEntryId(rosterEntryIdU);

     // Prefer grouped assigned (so qty matches what user sees)
var unitLabelU = '';
var refIdU = '';
var imgU = '';
var currentQtyU = 1;
var unitCostU = 0;

// Daimyo lock (selector should never allow > 1)
var isDaimyoU = false;


      try {
  var assignedGroupedU = groupAssigned(parseAssigned(rosterObjU || {}));
  for (var jU = 0; jU < assignedGroupedU.length; jU++) {
    var rowU = assignedGroupedU[jU];
    if (String(rowU && rowU.unitKey) === unitKeyU) {
      // For display: support uses name/title; characters use class/type
      unitLabelU = String(rowU.name || rowU.title || rowU.cls || rowU.class || rowU.supportType || '').trim();
      refIdU = String(rowU.refId || rowU.ref_id || '').trim();
      imgU = String(rowU.img || rowU.image || '').trim();
      currentQtyU = asInt(rowU.qty, 1);


      // Unit cost (per unit)
      (function () {
        var statsU = (rowU && rowU.stats && typeof rowU.stats === 'object') ? rowU.stats : null;
        function pickU(key) {
          var v = rowU ? rowU[key] : null;
          if (v != null && String(v).trim() !== '') return v;
          if (statsU) {
            var sv = statsU[key];
            if (sv != null && String(sv).trim() !== '') return sv;
          }
          return null;
        }
        var costRaw = pickU('cost');
        if (costRaw == null) costRaw = pickU('points');
        if (costRaw == null) costRaw = pickU('pt');
        if (costRaw == null) costRaw = pickU('pts');
        unitCostU = isNumericLike(costRaw) ? asInt(costRaw, 0) : 0;
      })();


      // Daimyo detection (normalized)
      var clsRaw = String(rowU.cls || rowU.class || '').toLowerCase().replace(/\s+/g, ' ').trim();
      isDaimyoU = (clsRaw === 'daimyo');

      break;
    }
  }
} catch (_) {}


      // DOM fallback for qty if needed
      if (!currentQtyU || currentQtyU < 1) {
        var qtyValEl = trU.querySelector('.shoshin-assigned-qty-td .shoshin-stat-value');
        if (qtyValEl) currentQtyU = asInt(qtyValEl.textContent, 1);
        if (!currentQtyU || currentQtyU < 1) currentQtyU = 1;
      }

      // DOM fallback for label/ref (correct selectors)
      if (!unitLabelU) {
        var lblEl = trU.querySelector('.shoshin-assigned-info-td .shoshin-stat-value');
        if (lblEl) unitLabelU = String(lblEl.textContent || '').trim();
      }
      if (!refIdU) {
        var refEl = trU.querySelector('.shoshin-assigned-info-td .shoshin-stat-subvalue');
        if (refEl) refIdU = String(refEl.textContent || '').trim();
      }

      openUnassignModal({
  cardEl: cardU,
  trEl: trU,
  rosterEntryId: rosterEntryIdU,
  unitKey: unitKeyU,
  unitLabel: unitLabelU,
  refId: refIdU,
  img: imgU,
  currentQty: currentQtyU,
  unitCost: unitCostU,

  // Daimyo lock (selector max 1)
  isDaimyo: !!isDaimyoU
});


      return;
    }


  });

  // Minimal fallback display if an icon fails and sets data-icon-fallback
  // (Your existing CSS hides button text via font-size:0; this ensures something still shows.)
  var style = document.createElement('style');
  style.textContent =
    '.shoshin-btn[data-icon-fallback]::before{content:attr(data-icon-fallback);font-size:16px;line-height:1;}' +
    '.shoshin-btn .shoshin-btn-icon{pointer-events:none;}';
  document.head.appendChild(style);
});
