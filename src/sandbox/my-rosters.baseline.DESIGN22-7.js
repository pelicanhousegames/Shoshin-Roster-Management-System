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
  if (v === null || typeof v === 'undefined') return '--';
  var s = String(v).trim();
  if (!s) return '--';

  // If it already has an inch/quote mark, keep it
  if (s.indexOf('″') !== -1 || s.indexOf('"') !== -1) return s;

  // Append inches ONLY if purely numeric
  if (/^\d+(\.\d+)?$/.test(s)) return s + '″';

  // Otherwise preserve verbatim (e.g., (e), --, Variable, Highest)
  return s;
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
    var cls = String(
      u.cls ||
      u.class ||
      u.className ||
      u.type ||
      u.role ||
      u.archetype ||
      u.supportType ||
      ''
    ).trim();
    var refId = String(u.refId || u.ref_id || '').trim();
        var name = String(
      u.name ||
      u.title ||
      // Support assets: name segment must be the subtype (e.g., Ozutsu / Mokuzo Hansen)
      (normalizeKind(u.kind) === 'support' ? (u.supportType || u.subType || u.subtype || '') : '') ||
      // Characters: name segment should match cls when missing
      cls ||
      ''
    ).trim();


    // IMPORTANT: Bulk Assign owned assets do not carry img.
    // unitKey MUST include canonical img so it matches assigned_units_json keys.
    var img = assignUnitsResolveCanonicalImg(u);

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

 // BEGIN SHOSHIN PRINT — HELPERS (favicon + safe HTML escape)
/**
 * Returns the site favicon href (best effort).
 * Kept for backward compatibility with older print writers.
 */
function getSiteFaviconHref() {
  var el =
    document.querySelector('link[rel="icon"]') ||
    document.querySelector('link[rel="shortcut icon"]') ||
    document.querySelector('link[rel~="icon"]') ||
    document.querySelector('link[rel="apple-touch-icon"]') ||
    null;
  return el && el.href ? String(el.href) : '';
}

/**
 * Returns a string of <link ...> tags for icon-like rels, with absolute hrefs.
 * This is the only favicon mechanism we use for print tabs.
 */
function getSiteFaviconLinksHTML() {
  try {
    var out = [];
    var seen = {};
    var nodes = Array.prototype.slice.call(document.querySelectorAll('link[rel]') || []);
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n) continue;

      var rel = String(n.getAttribute('rel') || '').trim();
      if (!rel) continue;

      // Accept common icon rels
      var relLower = rel.toLowerCase();
      var isIconLike =
        (relLower === 'icon') ||
        (relLower === 'shortcut icon') ||
        (relLower.indexOf('icon') !== -1) ||     // e.g., rel="icon preload"
        (relLower === 'apple-touch-icon') ||
        (relLower === 'mask-icon');

      if (!isIconLike) continue;

      var hrefAttr = String(n.getAttribute('href') || '').trim();
      if (!hrefAttr) continue;

      // Resolve to absolute
      var hrefAbs = hrefAttr;
      try { hrefAbs = String(new URL(hrefAttr, document.baseURI || window.location.href)); } catch(e) {}

      var type = String(n.getAttribute('type') || '').trim();
      var sizes = String(n.getAttribute('sizes') || '').trim();
      var color = String(n.getAttribute('color') || '').trim();

      var key = relLower + '|' + hrefAbs + '|' + type + '|' + sizes + '|' + color;
      if (seen[key]) continue;
      seen[key] = true;

      // Build tag (attributes are already safe-ish, but we still escape quotes via escapeHtmlForPrintTitle)
      var esc = (typeof escapeHtmlForPrintTitle === 'function') ? escapeHtmlForPrintTitle : function(s){ return String(s); };
      var tag = '<link rel="' + esc(rel) + '" href="' + esc(hrefAbs) + '"';
      if (type) tag += ' type="' + esc(type) + '"';
      if (sizes) tag += ' sizes="' + esc(sizes) + '"';
      if (color) tag += ' color="' + esc(color) + '"';
      tag += '>';
      out.push(tag);
    }
    return out.join('');
  } catch (e) {
    return '';
  }
}

function escapeHtmlForPrintTitle(s) {
  s = String(s == null ? '' : s);
  return s.replace(/[&<>"']/g, function (ch) {
    return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[ch];
  });
}

/** Canonical escaper used by preview + print renderers. */
function escapeHtml(s) {
  return escapeHtmlForPrintTitle(s);
}
// END SHOSHIN PRINT — HELPERS (favicon + safe HTML escape)


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



            var cls = String(u.cls || u.class || u.className || '').trim();


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

            // Points: support legacy fields AND /my-rosters ownedAssets model (totalCost)
      var points = asInt(
        u.points,
        asInt(
          u.cost,
          asInt(u.totalCost, 0)
        )
      );
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


function setDeleteModalRosterStrip(rosterObj) {
  if (!deleteModal) return;
  var host = deleteModal.querySelector('.shoshin-delete-preview');
  if (!host) return;

  if (!rosterObj) {
    host.innerHTML = '';
    host.style.display = 'none';
    return;
  }

  // Build totals from assigned_units_json (same logic as Unassign preview)
  var assigned = parseAssigned(rosterObj);
  var grouped  = groupAssigned(assigned);
  var totals   = computeRosterTotalsFromAssigned(grouped);

  // Reuse the EXACT unassign preview row renderer
  host.innerHTML = renderUnassignPreviewRow(rosterObj, totals);
  host.style.display = 'block';
}

function setDeleteModalAssetCard(assetObj) {
  if (!deleteModal) return;
  var host = deleteModal.querySelector('.shoshin-delete-preview');
  if (!host) return;

  if (!assetObj) {
    host.innerHTML = '';
    host.style.display = 'none';
    return;
  }

  var img  = String(assetObj.img || '').trim();
  if (!img) img = '/wp-content/uploads/2025/11/Header_logo_300x150_1.png';

  var type = String(assetObj.type || '').trim();
  var ref  = String(assetObj.refId || '').trim();
  var qty  = (assetObj.totalQty != null) ? String(assetObj.totalQty) : '';
  var cost = (assetObj.totalCost != null) ? String(assetObj.totalCost) : '';

  host.innerHTML =
    '<div class="shoshin-assign-asset">' +
      '<img class="shoshin-assign-asset-img" src="' + esc(img) + '" alt="">' +
      '<div class="shoshin-assign-asset-meta">' +
        '<div class="shoshin-assign-asset-class">' + esc(type || '—') + '</div>' +
        '<div class="shoshin-assign-asset-ref"><strong>REF ID:</strong> ' + esc(ref || '—') + '</div>' +
        '<div class="shoshin-assign-asset-qty"><strong>Total QTY:</strong> ' + esc(qty || '—') + '</div>' +
        '<div class="shoshin-assign-asset-cost"><strong>Total Cost:</strong> ' + esc(cost || '—') + '</div>' +
      '</div>' +
    '</div>';

  host.style.display = 'flex';
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
        '<div class="shoshin-delete-preview" style="display:none"></div>' +
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


    setDeleteModalRosterStrip(null);
        setDeleteModalAssetCard(null);


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
    if (imgEl) imgEl.src = '/wp-content/uploads/2025/12/helmet.jpg';
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
// ASSIGN UNITS MODAL (Row1) — Phase A (EMPTY-STATE ONLY; NO REDIRECT)
// - Per discovery: if no owned assets exist, DO NOT redirect.
// - Show the same empty-state message strings as /my-assets, per filter.
// ==========================================================================

var assignUnitsModal = null;
var assignUnitsModalBackdrop = null;
var assignUnitsEscBound = false;

var assignUnitsCtx = null; // { rosterEntryId, focusReturnEl, filter }


// -------------------------------------------------------------------------
// Bulk Assign (Modal) — Load More / Paging (JS-only)
// - Prevent doom scrolling in the Assign Units modal.
// - Hides rows beyond a visible limit and adds a Load More button.
// - No changes to filters or row markup; purely display toggling.
// -------------------------------------------------------------------------
var ASSIGN_UNITS_PAGE_SIZE = 6;

function ensureAssignUnitsLoadMoreEl(listEl) {
  if (!assignUnitsModal || !listEl) return null;

  var wrap = assignUnitsModal.querySelector('.shoshin-assign-units-load-more-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'shoshin-assign-units-load-more-wrap';
    wrap.style.display = 'none';
    wrap.style.justifyContent = 'center';
    wrap.style.padding = '10px 0';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shoshin-btn shoshin-btn-secondary shoshin-assign-units-load-more-btn';
    btn.textContent = 'Load More';

    btn.addEventListener('click', function () {
      if (!assignUnitsCtx) return;
      var cur = asInt(assignUnitsCtx.visibleLimit, ASSIGN_UNITS_PAGE_SIZE);
      assignUnitsCtx.visibleLimit = cur + ASSIGN_UNITS_PAGE_SIZE;
      applyAssignUnitsPaging();
      try { btn.focus(); } catch (_) {}
    });

    wrap.appendChild(btn);

    // Insert directly AFTER the list (keeps layout stable; no filter/layout changes)
    if (listEl.parentNode) {
      if (listEl.nextSibling) listEl.parentNode.insertBefore(wrap, listEl.nextSibling);
      else listEl.parentNode.appendChild(wrap);
    }
  }
  return wrap;
}

function applyAssignUnitsPaging() {
  if (!assignUnitsModal || !assignUnitsCtx) return;

  var list = assignUnitsModal.querySelector('.shoshin-assign-units-list');
  if (!list) return;

  var rows = Array.from(list.querySelectorAll('.shoshin-assign-units-row[data-unit-key]'));
  var limit = asInt(assignUnitsCtx.visibleLimit, ASSIGN_UNITS_PAGE_SIZE);

  // Show/hide rows by limit
  for (var i = 0; i < rows.length; i++) {
    rows[i].style.display = (i < limit) ? '' : 'none';
  }

  // Load More UI
   var wrap = ensureAssignUnitsLoadMoreEl(list);
if (wrap) {
  // DOM-truth: how many rows are currently visible?
  var visible = 0;
  for (var v = 0; v < rows.length; v++) {
    if (rows[v].style.display !== 'none') visible++;
  }

  var remaining = rows.length - visible;

  if (remaining > 0) {
    wrap.style.display = 'flex';

    var btn = wrap.querySelector('.shoshin-assign-units-load-more-btn') || wrap.querySelector('button');
    if (btn) {
      btn.textContent = 'Load More (' + remaining + ' more)';
    }
  } else {
    wrap.style.display = 'none';
  }
}


  // Keep % cells synced even when paging changes visibility
  recomputeAssignUnitsPercentages();
}




// -------------------------------------------------------------------------
// Bulk Assign — Canonical Image Resolver (JS-only)
// Users cannot customize images; derive deterministically like /my-assets.
// -------------------------------------------------------------------------
var ASSIGN_UNITS_FALLBACK_IMAGE = '/wp-content/uploads/2025/12/Helmet-grey.jpg';

var ASSIGN_UNITS_CLASS_IMAGES = {
  Daimyo: '/wp-content/uploads/2025/12/daimyo2.jpg',
  Samurai: '/wp-content/uploads/2025/12/samurai3.jpg',
  Ashigaru: '/wp-content/uploads/2025/12/ashigaru2.jpg',
  Sohei: '/wp-content/uploads/2025/12/sohei3.jpg',
  Ninja: '/wp-content/uploads/2025/12/ninja2.jpg',
  Onmyoji: '/wp-content/uploads/2025/12/onmyoji3.jpg',

  Artillery: '/wp-content/uploads/2025/12/cannon.jpeg',
  'Sailing Ships': '/wp-content/uploads/2025/12/makuzo.jpeg'
};

function assignUnitsResolveCanonicalImg(uOrAsset) {
  if (!uOrAsset) return ASSIGN_UNITS_FALLBACK_IMAGE;

  // Prefer explicit img if present
  var direct = String(uOrAsset.img || uOrAsset.image || uOrAsset.imgUrl || uOrAsset.imageUrl || '').trim();
  if (direct) return direct;

  // Derive from class/type
  var cls = String(
    uOrAsset.cls ||
    uOrAsset.class ||
    uOrAsset.className ||
    uOrAsset.type ||
    uOrAsset.supportType ||
    ''
  ).trim();

  if (cls && ASSIGN_UNITS_CLASS_IMAGES[cls]) return ASSIGN_UNITS_CLASS_IMAGES[cls];

  return ASSIGN_UNITS_FALLBACK_IMAGE;
}


function ensureAssignUnitsModal() {
  // -----------------------------------------------------------------------
  // DEDUPE: If the page already has a stale/older modal in DOM, keep only ONE.
  // This prevents us from rebuilding a different node than the one being shown.
  // -----------------------------------------------------------------------
  var existingModals = Array.prototype.slice.call(
    document.querySelectorAll('#shoshin-assign-units-modal, .shoshin-modal.shoshin-assign-units-modal')
  );

  // Prefer an existing modal that already has the new Before/After panel nodes
  var preferred = null;
  for (var i = 0; i < existingModals.length; i++) {
    var m = existingModals[i];
    if (m && m.querySelector && m.querySelector('#shoshinAssignPreviewBefore') && m.querySelector('#shoshinAssignPreviewAfter')) {
      preferred = m;
      break;
    }
  }

  // Otherwise take the first one if it exists
  if (!preferred && existingModals.length) preferred = existingModals[0];

  // Remove any duplicates so future queries can't "pick the wrong one"
  if (preferred) {
    for (var j = 0; j < existingModals.length; j++) {
      if (existingModals[j] && existingModals[j] !== preferred && existingModals[j].parentNode) {
        existingModals[j].parentNode.removeChild(existingModals[j]);
      }
    }
  }

  // Reuse the preferred modal node if present
  if (!assignUnitsModal) {
    assignUnitsModal = preferred || null;
  } else {
    // If our cached reference got detached, re-sync to preferred
    if (!assignUnitsModal.parentNode && preferred) assignUnitsModal = preferred;
  }

  // Backdrop dedupe
  var existingBackdrops = Array.prototype.slice.call(
    document.querySelectorAll('.shoshin-modal-backdrop.shoshin-assign-units-backdrop')
  );
  var preferredBackdrop = existingBackdrops.length ? existingBackdrops[0] : null;
  if (preferredBackdrop) {
    for (var b = 1; b < existingBackdrops.length; b++) {
      if (existingBackdrops[b] && existingBackdrops[b].parentNode) {
        existingBackdrops[b].parentNode.removeChild(existingBackdrops[b]);
      }
    }
  }

  if (!assignUnitsModalBackdrop) {
    assignUnitsModalBackdrop = preferredBackdrop || null;
  } else {
    if (!assignUnitsModalBackdrop.parentNode && preferredBackdrop) assignUnitsModalBackdrop = preferredBackdrop;
  }

  // Create backdrop if missing
  if (!assignUnitsModalBackdrop) {
    assignUnitsModalBackdrop = document.createElement('div');
    assignUnitsModalBackdrop.className = 'shoshin-modal-backdrop shoshin-assign-units-backdrop';
    assignUnitsModalBackdrop.setAttribute('aria-hidden', 'true');
  } else {
    if (assignUnitsModalBackdrop.className.indexOf('shoshin-assign-units-backdrop') === -1) {
      assignUnitsModalBackdrop.className += ' shoshin-assign-units-backdrop';
    }
  }

  // Create modal shell if missing
  if (!assignUnitsModal) {
    assignUnitsModal = document.createElement('div');
    assignUnitsModal.className = 'shoshin-modal shoshin-assign-units-modal';
    assignUnitsModal.setAttribute('role', 'dialog');
    assignUnitsModal.setAttribute('aria-modal', 'true');
    assignUnitsModal.setAttribute('aria-labelledby', 'shoshin-assign-units-title');
    assignUnitsModal.id = 'shoshin-assign-units-modal';
  } else {
    if (assignUnitsModal.className.indexOf('shoshin-assign-units-modal') === -1) {
      assignUnitsModal.className += ' shoshin-assign-units-modal';
    }
    if (!assignUnitsModal.id) assignUnitsModal.id = 'shoshin-assign-units-modal';
    if (!assignUnitsModal.getAttribute('role')) assignUnitsModal.setAttribute('role', 'dialog');
    if (!assignUnitsModal.getAttribute('aria-modal')) assignUnitsModal.setAttribute('aria-modal', 'true');
    if (!assignUnitsModal.getAttribute('aria-labelledby')) assignUnitsModal.setAttribute('aria-labelledby', 'shoshin-assign-units-title');
  }

  // -----------------------------------------------------------------------
  // REBUILD SKELETON if missing Before/After panel nodes (old stale DOM case)
  // -----------------------------------------------------------------------
  var hasBefore = !!assignUnitsModal.querySelector('#shoshinAssignPreviewBefore');
  var hasAfter  = !!assignUnitsModal.querySelector('#shoshinAssignPreviewAfter');

  if (!hasBefore || !hasAfter) {
    // IMPORTANT: clear bound flag because we are replacing innerHTML (new buttons)
    assignUnitsModal.removeAttribute('data-shoshin-bound');

    assignUnitsModal.innerHTML =
      '<div class="shoshin-modal-header">' +
        '<img class="shoshin-modal-logo" src="/wp-content/uploads/2025/11/Header_logo_300x150_1.png" alt="Site logo" />' +
        '<button type="button" class="shoshin-modal-x" aria-label="Close">×</button>' +
      '</div>' +

      '<div class="shoshin-modal-body">' +
        '<div id="shoshin-assign-units-title" class="shoshin-modal-title">Bulk Unit Assignment</div>' +
        '<div class="shoshin-modal-body-wrap">' +

          '<div class="shoshin-assign-units-roster">' +
            '<div class="shoshin-unassign-preview-wrap">' +
              '<div class="shoshin-unassign-preview-title">Roster Preview</div>' +
              '<div class="shoshin-unassign-preview-columns">' +

                '<div class="shoshin-unassign-preview-col">' +
                  '<div class="shoshin-unassign-preview-col-title">Before <span id="shoshin-assign-pct-before" class="shoshin-unassign-preview-pct">(100%)</span></div>' +
                  '<div id="shoshinAssignPreviewBefore" class="shoshin-unassign-preview-panel"></div>' +
                '</div>' +

                '<div class="shoshin-unassign-preview-col">' +
                  '<div class="shoshin-unassign-preview-col-title">After <span id="shoshin-assign-pct-after" class="shoshin-unassign-preview-pct">(100%)</span></div>' +
                  '<div id="shoshinAssignPreviewAfter" class="shoshin-unassign-preview-panel"></div>' +
                '</div>' +

              '</div>' +
            '</div>' +
          '</div>' +

         '<div class="shoshin-assign-units-messages">' +
            '<div class="shoshin-assign-units-restriction"></div>' +
            '<div class="shoshin-modal-error" style="display:none"></div>' +
          '</div>' +



          '<div class="shoshin-assign-units-controls">' +
            '<div class="shoshin-assign-units-filters">' +
              '<button type="button" class="shoshin-asset-filter-btn is-active" data-filter="all">All Units</button>' +
              '<button type="button" class="shoshin-asset-filter-btn" data-filter="assigned">Assigned</button>' +
              '<button type="button" class="shoshin-asset-filter-btn" data-filter="daimyo">Daimyo</button>' +
              '<button type="button" class="shoshin-asset-filter-btn" data-filter="samurai">Samurai</button>' +
              '<button type="button" class="shoshin-asset-filter-btn" data-filter="ashigaru">Ashigaru</button>' +
              '<button type="button" class="shoshin-asset-filter-btn" data-filter="sohei">Sohei</button>' +
              '<button type="button" class="shoshin-asset-filter-btn" data-filter="ninja">Ninja</button>' +
              '<button type="button" class="shoshin-asset-filter-btn" data-filter="onmyoji">Onmyoji</button>' +
              '<button type="button" class="shoshin-asset-filter-btn" data-filter="support">Support Assets</button>' +
            '</div>' +
            '<div class="shoshin-assign-units-list"></div>' +
          '</div>' +

        '</div>' +
      '</div>' +

      '<div class="shoshin-modal-actions">' +
        '<button type="button" class="shoshin-modal-btn shoshin-modal-btn-cancel">Cancel</button>' +
        '<button type="button" class="shoshin-modal-btn shoshin-modal-btn-confirm">Assign</button>' +
      '</div>';
  }

  // Ensure nodes are in the DOM (do not duplicate)
  if (!assignUnitsModalBackdrop.parentNode) document.body.appendChild(assignUnitsModalBackdrop);
  if (!assignUnitsModal.parentNode) document.body.appendChild(assignUnitsModal);

  function close() { closeAssignUnitsModal(); }

  // Bind events exactly once per modal instance (but allow rebinding after rebuild)
  if (!assignUnitsModal.getAttribute('data-shoshin-bound')) {
    assignUnitsModal.setAttribute('data-shoshin-bound', '1');

    assignUnitsModalBackdrop.addEventListener('click', close);

    var closeBtn = assignUnitsModal.querySelector('.shoshin-modal-x');
    if (closeBtn) closeBtn.addEventListener('click', close);

    var cancelBtn = assignUnitsModal.querySelector('.shoshin-modal-btn-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', close);

        // ---------------------------------------------------------------------
    // FILTER BUTTONS (restore): clicking a filter must update ctx + re-render
    // ---------------------------------------------------------------------
    var filterBtns = assignUnitsModal.querySelectorAll('.shoshin-assign-units-filters .shoshin-asset-filter-btn');
    for (var fb = 0; fb < filterBtns.length; fb++) {
      (function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();

          // active state
          for (var k = 0; k < filterBtns.length; k++) {
            filterBtns[k].classList.remove('is-active');
          }
          btn.classList.add('is-active');

          // update ctx + redraw
          if (assignUnitsCtx) assignUnitsCtx.filter = String(btn.getAttribute('data-filter') || 'all');
          renderAssignUnitsList();
          assignUnitsRecomputePreview();

        });
      })(filterBtns[fb]);
    }


    var assignBtn = assignUnitsModal.querySelector('.shoshin-modal-btn-confirm');
    if (assignBtn) assignBtn.addEventListener('click', function () {
      assignUnitsSubmit();
    });
  }

  if (!assignUnitsEscBound) {
    assignUnitsEscBound = true;
    document.addEventListener('keydown', function (e) {
      if (!assignUnitsModalBackdrop || assignUnitsModalBackdrop.getAttribute('aria-hidden') === 'true') return;
      if (e.key === 'Escape' || e.key === 'Esc') closeAssignUnitsModal();
    });
  }
}


function getAssignUnitsEmptyMessageHtml(filterLabel) {
  // Match /my-assets empty-state messaging (strings)
  if (filterLabel === 'all') {
    return '<h5><em>You have not created any Character or Support Asset entries.</em></h5>';
  }
  if (filterLabel === 'Support Assets') {
    return '<h5><em>No entries exist for these Support Assets.</em></h5>';
  }
  return '<h5><em>No entries exist for this Character Class.</em></h5>';
}

function renderAssignUnitsEmptyState() {
  if (!assignUnitsModal) return;

  var list = assignUnitsModal.querySelector('.shoshin-assign-units-list');
  if (!list) return;

  // IMPORTANT: For this step, we are only handling "no owned assets exist".
  // Asset list rendering will be wired next.
  var f = (assignUnitsCtx && assignUnitsCtx.filter) ? String(assignUnitsCtx.filter) : 'all';
  list.innerHTML =
    '<div class="shoshin-assets-empty" style="padding:10px 4px;">' +
      getAssignUnitsEmptyMessageHtml(f === 'all' ? 'all' : f) +
    '</div>';
}


// ---------------------------------------------------------------------------
// Assign Units Modal (Row1) — Rendering + Additive Submit (Phase B/C)
// ---------------------------------------------------------------------------

function assignUnitsSetError(msg) {
  if (!assignUnitsModal) return;
  var el = assignUnitsModal.querySelector('.shoshin-modal-error');
  if (!el) return;
  if (!msg) {
    el.textContent = '';
    el.style.display = 'none';
    return;
  }
  el.textContent = String(msg);
  el.style.display = 'block';
}

function assignUnitsSetBusy(isBusy) {
  if (!assignUnitsModal) return;
  var btn = assignUnitsModal.querySelector('.shoshin-modal-btn-confirm');
  if (!btn) return;
  btn.disabled = !!isBusy;
  btn.textContent = isBusy ? 'Assigning…' : 'Assign';
}

function getRosterCardElByEntryId(rid) {
  return document.querySelector('.shoshin-roster-card[data-roster-entry-id="' + String(rid) + '"]');
}

function buildRosterAssignedQtyMapForRoster(rosterObj) {
  var map = {};
  try {
    var grouped = groupAssigned(parseAssigned(rosterObj || {}));
    for (var i = 0; i < grouped.length; i++) {
      var u = grouped[i] || {};
      var k = String(u.unitKey || '').trim();
      if (!k) k = makeUnitKey(u);
      map[k] = asInt(u.qty, 1);
    }
  } catch (e) {}
  return map;
}

function rosterHasAssignedDaimyo(rosterObj) {
  try {
    var grouped = groupAssigned(parseAssigned(rosterObj || {}));
    for (var i = 0; i < grouped.length; i++) {
      var u = grouped[i] || {};
      var clsKey = String(u.cls || u.class || u.className || u.type || u.role || u.archetype || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (clsKey === 'daimyo' && asInt(u.qty, 1) >= 1) return true;
    }
  } catch (e) {}
  return false;
}



function assignUnitsGetOwnedAssetByUnitKey(unitKey) {
  if (!Array.isArray(ownedAssets)) return null;
  for (var i = 0; i < ownedAssets.length; i++) {
    var a = ownedAssets[i] || {};
    var k = String(a.unitKey || '').trim();
    if (!k) k = makeUnitKey(a);
    if (k === unitKey) return a;
  }
  return null;
}

function assignUnitsGetPoints(asset) {
  // Your owned-assets payload uses totalCost as the per-unit cost/points
  // (e.g., data-shoshin-assets-json sample keys include totalCost)
  var p = asset && (
    asset.totalCost != null ? asset.totalCost :
    (asset.points != null ? asset.points : asset.cost)
  );
  return asInt(p, 0);
}




function assignUnitsGetInitiative(asset) {
  var v = (asset && (
    asset.initiative != null ? asset.initiative :
    asset.ini != null ? asset.ini :
    asset.INI != null ? asset.INI :
    (asset.stats ? (
      asset.stats.initiative != null ? asset.stats.initiative :
      asset.stats.ini != null ? asset.stats.ini :
      asset.stats.INI != null ? asset.stats.INI :
      null
    ) : null)
  ));
  return asInt(v, 0);
}


function assignUnitsGetLeadership(asset) {
  var v = (asset && (
    // Leadership / Honor aliases (Honor = Leadership)
    asset.leadership != null ? asset.leadership :
    asset.honor != null ? asset.honor :
    asset.ldr != null ? asset.ldr :
    asset.LDR != null ? asset.LDR :
    asset.HONOR != null ? asset.HONOR :
    (asset.stats ? (
      asset.stats.leadership != null ? asset.stats.leadership :
      asset.stats.honor != null ? asset.stats.honor :
      asset.stats.ldr != null ? asset.stats.ldr :
      asset.stats.LDR != null ? asset.stats.LDR :
      asset.stats.HONOR != null ? asset.stats.HONOR :
      null
    ) : null)
  ));
  return asInt(v, 0);
}


function assignUnitsGetDisplayType(asset) {
  var kind = String(asset.kind || '').toLowerCase().trim();
  if (kind === 'support') {
    return String(asset.name || asset.title || asset.supportType || asset.cls || asset.class || '').trim() || '—';
  }
   return String(asset.cls || asset.class || asset.className || '').trim() || '—';

}

function assignUnitsMatchesFilter(asset, filterLabel) {
  filterLabel = String(filterLabel || 'all').trim();
  if (!filterLabel || filterLabel === 'all') return true;

  var kind = normalizeKind(asset.kind);
  if (filterLabel === 'Support Assets') return kind === 'support';

    var cls = String(asset.cls || asset.class || asset.className || '').trim();
  return cls === filterLabel;

}

function assignUnitsRenderRestriction(rosterObj) {
  if (!assignUnitsModal) return;

  var el = assignUnitsModal.querySelector('.shoshin-assign-units-restriction');
  if (!el) return;

    // Hard block: Daimyo already assigned to roster
  var hasAssigned = rosterHasAssignedDaimyo(rosterObj);

  // Soft block: Daimyo currently staged via Bulk Assign
  var hasStaged = false;
  if (assignUnitsCtx && assignUnitsCtx.selected) {
    for (var k in assignUnitsCtx.selected) {
      if (!assignUnitsCtx.selected.hasOwnProperty(k)) continue;
      var parts = String(k || '').split('|');
      var cls = String(parts[1] || '').toLowerCase().trim();
      if (cls === 'daimyo' && asInt(assignUnitsCtx.selected[k], 0) > 0) {
        hasStaged = true;
        break;
      }
    }
  }

  var blocked = hasAssigned || hasStaged;

  // Message varies ONLY when Daimyo is already assigned
  if (hasAssigned) {
    el.innerHTML = '<b>Restriction:</b> This clan currently has an assigned Daimyo.';
  } else {
    el.innerHTML = '<b>Restriction:</b> Only one Daimyo may be assigned to a clan.';
  }

  el.style.display = 'block';
  el.classList.add('is-visible');

    /*
  // Previous conditional behavior (kept for easy revert)
  if (blocked) {
    el.classList.add('is-blocked');   // red
  } else {
    el.classList.remove('is-blocked'); // grey
  }
  */

  // Simplified: always show restriction as blocked (red)
  el.classList.add('is-blocked');


}



function assignUnitsBuildPreviewAssignedList(rosterObj) {
  var base = [];
  try {
    base = groupAssigned(parseAssigned(rosterObj || {}));
  } catch (e) {
    base = [];
  }

  var map = {};
  for (var i = 0; i < base.length; i++) {
    var u = base[i] || {};
    var k = String(u.unitKey || '').trim();
    if (!k) k = makeUnitKey(u);
    map[k] = Object.assign({}, u, { unitKey: k, qty: asInt(u.qty, 1) });
  }

  // apply additions as preview
  if (assignUnitsCtx && assignUnitsCtx.selected) {
    Object.keys(assignUnitsCtx.selected).forEach(function (k) {
      var add = asInt(assignUnitsCtx.selected[k], 0);
      if (add < 1) return;

      if (!map[k]) {
        var a = assignUnitsGetOwnedAssetByUnitKey(k);
        if (!a) return;
        map[k] = Object.assign({}, a, { unitKey: k, qty: add });
      } else {
        var clsKey = String(map[k].cls || map[k].class || map[k].className || map[k].type || map[k].role || map[k].archetype || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (clsKey === 'daimyo') map[k].qty = 1;
        else map[k].qty = asInt(map[k].qty, 1) + add;
      }
    });
  }

  return Object.keys(map).map(function (k) { return map[k]; });
}

function assignUnitsRenderRosterStrip(rosterObj) {
  if (!assignUnitsModal) return;

  // Correct host (exists in modal skeleton)
  var host = assignUnitsModal.querySelector('.shoshin-assign-units-roster');
  if (!host) return;

  // New Before/After panel targets (added in Edit 1)
  var beforeEl = assignUnitsModal.querySelector('#shoshinAssignPreviewBefore');
  var afterEl  = assignUnitsModal.querySelector('#shoshinAssignPreviewAfter');

  if (!rosterObj) {
    // If panels exist, write into them; else fall back to host
    if (beforeEl) beforeEl.innerHTML = '<div class="shoshin-muted" style="text-align:center;">Roster not found.</div>';
    if (afterEl)  afterEl.innerHTML  = '<div class="shoshin-muted" style="text-align:center;">Roster not found.</div>';
    if (!beforeEl && !afterEl) {
      host.innerHTML = '<div class="shoshin-muted" style="text-align:center;">Roster not found.</div>';
    }
    return;
  }

  // BEFORE = current roster assignments only (no preview additions)
  var beforeAssigned = [];
  try {
    beforeAssigned = groupAssigned(parseAssigned(rosterObj || {}));
  } catch (e) {
    beforeAssigned = [];
  }
  var beforeTotals = computeRosterTotalsFromAssigned(beforeAssigned);

  // AFTER = includes preview additions (assignUnitsCtx.selected)
  var afterAssigned = assignUnitsBuildPreviewAssignedList(rosterObj);
  var afterTotals = computeRosterTotalsFromAssigned(afterAssigned);

  // Render into panels (preferred)
  if (beforeEl) beforeEl.innerHTML = renderUnassignPreviewRow(rosterObj, beforeTotals);
  if (afterEl)  afterEl.innerHTML  = renderUnassignPreviewRow(rosterObj, afterTotals);

  // Fallback (if Edit 1 markup isn't present for any reason)
  if (!beforeEl && !afterEl) {
    host.innerHTML = renderUnassignPreviewRow(rosterObj, afterTotals);
  }
}


function assignUnitsRecomputePreview() {
  if (!assignUnitsCtx) return;
  var rosterObj = getRosterObjByEntryId(assignUnitsCtx.rosterEntryId);
  assignUnitsRenderRestriction(rosterObj);
  assignUnitsRenderRosterStrip(rosterObj);

  // Keep % cells synced to AFTER preview points for all changes (not just Daimyo rerenders)
  if (typeof recomputeAssignUnitsPercentages === 'function') {
    recomputeAssignUnitsPercentages();
  }
}


// ---------------------------------------------------------------------------
// Bulk Assign — Single Source of Truth
// assignUnitsUpdateRowFromUi(rowEl) is the ONLY authority for:
// - Reading the UI (toggle + qty)
// - Writing staged selection state (assignUnitsCtx.selected)
// - Daimyo rules (hard block, exclusivity)
// - Triggering rerenders when Daimyo state changes
//
// Do NOT enforce Daimyo rules in event handlers or other helpers.
// ---------------------------------------------------------------------------


function assignUnitsUpdateRowFromUi(rowEl) {
  if (!rowEl || !assignUnitsCtx) return;

  var unitKey = String(rowEl.getAttribute('data-unit-key') || '').trim();
  if (!unitKey) return;

    var curQty = asInt(rowEl.getAttribute('data-cur-qty'), 0);


   var toggle = rowEl.querySelector('.shoshin-assign-units-toggle-input');
  var qtySel = rowEl.querySelector('.shoshin-assign-units-qty-select');

  // Live-display fields (Bulk Assign row)
  var qtyValEl = rowEl.querySelector('.shoshin-assign-units-cur .shoshin-assign-units-value');
  var iniEl = rowEl.querySelector('.shoshin-assign-units-ini');
  var ldrEl = rowEl.querySelector('.shoshin-assign-units-ldr');

  var totalEl = rowEl.querySelector('.shoshin-assign-units-total');

    // Live display fields
  var qtyValEl = rowEl.querySelector('.shoshin-assign-units-cur .shoshin-assign-units-value');
  var iniEl = rowEl.querySelector('.shoshin-assign-units-ini');
  var ldrEl = rowEl.querySelector('.shoshin-assign-units-ldr');

  // % cells
  var pctEl = rowEl.querySelector('.shoshin-assign-units-pct');
  var qtyPctEl = rowEl.querySelector('.shoshin-assign-units-qtypct');
  var iniPctEl = rowEl.querySelector('.shoshin-assign-units-inipct');
  var ldrPctEl = rowEl.querySelector('.shoshin-assign-units-ldrpct');



  var a = assignUnitsGetOwnedAssetByUnitKey(unitKey);
  if (!a) return;

  var isOn = !!(toggle && toggle.checked);

  var ukParts = unitKey.split('|');
  var isDaimyoKey = (ukParts.length > 1 && String(ukParts[1] || '').toLowerCase().trim() === 'daimyo');

  // If Daimyo exclusivity changes other rows, we must rerender AFTER state commit,
  // otherwise All Units view rebuilds from stale state and the toggle appears OFF.
  var needsRerender = false;

  var addQty = isOn ? asInt(qtySel && qtySel.value, 1) : 0;
  if (isDaimyoKey && isOn) addQty = 1;



  if (isDaimyoKey && isOn) {
    var activeRosterObj = getRosterObjByEntryId(assignUnitsCtx && assignUnitsCtx.rosterEntryId);
    var rosterAlreadyHasDaimyo = rosterHasDaimyoAssigned(activeRosterObj);

    if (rosterAlreadyHasDaimyo) {
      // Hard block: revert toggle + clear any staged selection for this Daimyo
      if (toggle) toggle.checked = false;
      if (assignUnitsCtx && assignUnitsCtx.selected) delete assignUnitsCtx.selected[unitKey];
            assignUnitsRecomputePreview();
      return;

    }

    // Enforce exclusivity: turning ON a Daimyo turns OFF all other staged Daimyos
    if (assignUnitsCtx && assignUnitsCtx.selected) {
      Object.keys(assignUnitsCtx.selected).forEach(function (k) {
        var p = String(k || '').split('|');
        var kIsDaimyo = (p.length > 1 && String(p[1] || '').toLowerCase().trim() === 'daimyo');
        if (kIsDaimyo && k !== unitKey) delete assignUnitsCtx.selected[k];
      });
    }

        // Re-render so other Daimyo rows reflect the new locked state
    // (deferred until AFTER selected state is committed)
    needsRerender = true;

  }

    // If a Daimyo is toggled OFF, we must rerender so other Daimyos become enabled again.
  if (isDaimyoKey && !isOn) {
    needsRerender = true;
  }



  if (!assignUnitsCtx.selected) assignUnitsCtx.selected = {};

if (isOn && addQty > 0) {
  assignUnitsCtx.selected[unitKey] = addQty;

  // SYNC: keep the other renderer/state helpers aligned
  if (typeof setAssignUnitsSelectedAddQty === 'function') {
    setAssignUnitsSelectedAddQty(unitKey, addQty);
  }
} else {
  delete assignUnitsCtx.selected[unitKey];

  // SYNC: clear staged qty in helper store too
  if (typeof setAssignUnitsSelectedAddQty === 'function') {
    setAssignUnitsSelectedAddQty(unitKey, 0);
  }
}


  // If Daimyo selection changed, we must rebuild rows AFTER state commit,
  // otherwise All Units view renders the toggle from stale selected-state.
   if (needsRerender) {
    renderAssignUnitsList();
    assignUnitsRecomputePreview();

    // Bulk Assign: enable Assign button only if at least one unit is selected
    try {
      var confirmBtnR = assignUnitsModal.querySelector('.shoshin-modal-btn-confirm');
      if (confirmBtnR) {
        var anySelectedR = false;
        if (assignUnitsCtx && assignUnitsCtx.selected) {
          Object.keys(assignUnitsCtx.selected).some(function (k) {
            if (asInt(assignUnitsCtx.selected[k], 0) > 0) {
              anySelectedR = true;
              return true;
            }
            return false;
          });
        }
        confirmBtnR.disabled = !anySelectedR;
      }
    } catch (_) {}

    return;
  }




    if (qtySel) {
    qtySel.disabled = !isOn;

    // Enhancement: when toggle is OFF, show blank in the disabled selector
    if (!isOn) {
      if (!(qtySel.options && qtySel.options.length && qtySel.options[0].value === '')) {
        var blankOpt = document.createElement('option');
        blankOpt.value = '';
        blankOpt.textContent = '';
        qtySel.insertBefore(blankOpt, qtySel.firstChild);
      }
      qtySel.value = '';
      qtySel.selectedIndex = 0;
    } else {
      // Toggle ON: remove blank option if present
      if (qtySel.options && qtySel.options.length && qtySel.options[0].value === '') {
        qtySel.remove(0);
      }
      // If empty somehow, default to 1
      if (!qtySel.value) qtySel.value = '1';
    }
  }

      // Re-read addQty after any selector normalization above (display-only)
  addQty = isOn ? asInt(qtySel && qtySel.value, 1) : 0;
  if (isDaimyoKey && isOn) addQty = 1;

    // UX: Grey out unassigned rows while toggle is OFF (display-only; do not disable)
  // Rule: curQty==0 && !isOn => row appears muted
  if (curQty === 0 && !isOn) {
    rowEl.classList.add('shoshin-assign-units-row-muted');
  } else {
    rowEl.classList.remove('shoshin-assign-units-row-muted');
  }


    var liveQty = curQty + addQty;

  // Dash state: unassigned + toggle OFF => show placeholders instead of confusing zeros
  var isDashState = (curQty === 0 && !isOn);

  if (isDashState) {
    if (qtyValEl) qtyValEl.textContent = '--';
    if (iniEl) iniEl.textContent = '--';
    if (ldrEl) ldrEl.textContent = '--';
    if (totalEl) totalEl.textContent = '--';

    // % cells: recomputeAssignUnitsPercentages() also protects these,
    // but we set them immediately to avoid any visible flicker.
    if (pctEl) pctEl.textContent = '--';
    if (qtyPctEl) qtyPctEl.textContent = '--';
    if (iniPctEl) iniPctEl.textContent = '--';
    if (ldrPctEl) ldrPctEl.textContent = '--';
  } else {
    if (qtyValEl) qtyValEl.textContent = String(liveQty);
    if (iniEl) iniEl.textContent = String(assignUnitsGetInitiative(a) * liveQty);
    if (ldrEl) ldrEl.textContent = String(assignUnitsGetLeadership(a) * liveQty);
    if (totalEl) totalEl.textContent = String(assignUnitsGetPoints(a) * liveQty);
    // % cells are handled by recomputeAssignUnitsPercentages()
  }

  assignUnitsRecomputePreview();

    // Bulk Assign: enable Assign button only if at least one unit is selected
  try {
    var confirmBtn = assignUnitsModal.querySelector('.shoshin-modal-btn-confirm');
    if (confirmBtn) {
      var anySelected = false;
      if (assignUnitsCtx && assignUnitsCtx.selected) {
        Object.keys(assignUnitsCtx.selected).some(function (k) {
          if (asInt(assignUnitsCtx.selected[k], 0) > 0) {
            anySelected = true;
            return true;
          }
          return false;
        });
      }
      confirmBtn.disabled = !anySelected;
    }
  } catch (_) {}

}

function assignUnitsBindListEventsOnce() {
  if (!assignUnitsModal) return;
  if (assignUnitsModal.__assignUnitsListBound) return;
  assignUnitsModal.__assignUnitsListBound = true;

  var list = assignUnitsModal.querySelector('.shoshin-assign-units-list');
  if (!list) return;

  list.addEventListener('change', function (e) {
    var t = e && e.target ? e.target : null;
    if (!t) return;

    if (!(t.classList && (t.classList.contains('shoshin-assign-units-toggle-input') || t.classList.contains('shoshin-assign-units-qty-select')))) {
      return;
    }

    var row = t.closest ? t.closest('.shoshin-assign-units-row') : null;
    if (!row) return;

    assignUnitsUpdateRowFromUi(row);
  });
}



function assignUnitsBuildRow3BodyHtmlForRoster(rosterObj, clanPoints) {
  var grouped = groupAssigned(parseAssigned(rosterObj || {}));
  if (!grouped.length) {
    return '<div class="shoshin-expansion-empty">This clan currently has no assigned units.</div>';
  }

    var html =
    '<div class="shoshin-roster-assigned-scroll">' +
      '<div class="shoshin-roster-assigned-scroll-inner">' +
        '<table class="shoshin-stat-strip shoshin-assigned-strip">' +
          '<tbody>';


        var percentMap = computeAssignedStripPercentMapForce100(grouped, clanPoints);


  for (var i = 0; i < grouped.length; i++) {
    html += renderAssignedStripRow(grouped[i], asInt(rosterObj.entryId || rosterObj.id || rosterObj.entry_id, 0), clanPoints, percentMap);

  }

   html +=
          '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';


  return html;
}

function assignUnitsApplyRosterUpdateToDom(rosterObj) {
  var rid = asInt(rosterObj && (rosterObj.entryId || rosterObj.id || rosterObj.entry_id), 0);
  if (!rid) return;

  var cardEl = getRosterCardElByEntryId(rid);
  if (!cardEl) return;

  // recompute totals from updated assigned_units_json
  var grouped = groupAssigned(parseAssigned(rosterObj || {}));
  var totals = computeRosterTotalsFromAssigned(grouped);

  updateRosterCardStatsInDom(cardEl, rosterObj, totals);

  // update Row3 block HTML (assigned strip / empty state)
  var block = cardEl.querySelector('.shoshin-asset-block');
  if (block) {
    block.innerHTML = assignUnitsBuildRow3BodyHtmlForRoster(rosterObj, asInt(totals.points, 0));
  }

  // ensure filters/paging respect updated points
  if (typeof applyRosterFilterAndPaging === 'function') {
    applyRosterFilterAndPaging();
  }
}

  // ---------------------------------------------------------------------------
  // Bulk Assign — payload sanitizer (prevents invalid assigned_units_json)
  // Why: any raw double-quotes (") inside unit string values can corrupt JSON
  // when persisted, causing JSON.parse to fail on refresh.
  // This ONLY affects what we send to the server (storage payload), not UI.
  // ---------------------------------------------------------------------------
  function assignUnitsSanitizeForStorage(v) {
    if (v == null) return v;

    if (typeof v === 'string') {
      // Replace raw " with a safe visual equivalent (double-prime).
      // Prevents JSON corruption while preserving meaning (e.g., 12″).
      return v.replace(/"/g, '″');
    }

    if (Array.isArray(v)) {
      return v.map(assignUnitsSanitizeForStorage);
    }

    if (typeof v === 'object') {
      var out = {};
      Object.keys(v).forEach(function (k) {
        out[k] = assignUnitsSanitizeForStorage(v[k]);
      });
      return out;
    }

    return v;
  }


// -------------------------------------------------------------------------
// Bulk Assign — stat normalization helpers (JS-only)
// - Preserve display values like "Variable", "Highest", "Captain", "--"
// - Normalize smart quotes in distances (e.g., 2″ -> 2")
// -------------------------------------------------------------------------
function assignUnitsStatRaw(v, fallback) {
  var s = String(v == null ? '' : v).trim();
  return s ? s : (fallback || '--');
}

function assignUnitsNormalizeQuotes(s) {
  s = String(s == null ? '' : s);

  // Normalize a wider set of Unicode “double quote / double-prime” variants to plain "
  // Includes:
  // - curly quotes: “ ”
  // - double prime: ″
  // - reversed double prime / low double quote variants
  // - modifier letter double prime
  return s
    .replace(/[\u201C\u201D\u201E\u2033\u2036\u02DD]/g, '"')
    .trim();
}




function assignUnitsBuildCanonicalAssignedUnitFromOwnedAsset(asset, unitKey) {
  if (!asset) return null;

  var kind = String(asset.kind || '').trim() || 'character';
  var cls  = String(asset.cls || asset.class || asset.className || '').trim() || '—';
  var refId = String(asset.refId || asset.ref_id || '').trim() || '—';

  // Display name:
  // - Characters: class label (Samurai/Ashigaru/etc.)
  // - Support: actual support name/type (Ozutsu/Mokuzo Hansen/etc.)
  var name = (String(kind).toLowerCase() === 'support')
    ? (String(asset.name || asset.title || asset.supportType || cls).trim() || cls)
    : cls;


    // Image: owned assets on /my-rosters do NOT include img; derive deterministically.
  var img = assignUnitsResolveCanonicalImg(asset);


  // Points/cost (your /my-rosters ownedAssets model uses totalCost)
  var points = asInt(assignUnitsGetPoints(asset), 0);

  // Initiative + Leadership (Honor derives from Leadership)
  // Preserve RAW display values in stats (e.g., "Highest", "--"), but keep numeric for totals.
  var iniRaw = assignUnitsStatRaw(asset.ini, assignUnitsStatRaw((asset.stats && asset.stats.ini), '--'));
  var ldrRaw = assignUnitsStatRaw(asset.ldr, assignUnitsStatRaw((asset.stats && asset.stats.ldr), '--'));

  var ini = asInt(iniRaw, 0);       // numeric for totals
  var ldrNum = asInt(ldrRaw, 0);    // numeric for honor aggregation
  var honor = ldrNum;


  // Combat/stat block for Row3 rendering
  // Row3 expects m_dmg/m_crt/m_dis and r_dmg/r_crt/r_dis keys.
  // /my-rosters ownedAssets provides meleeDamage/meleeCrit/meleeDistance/rangedDamage/rangedCrit/rangedDistance.
  var stats = {
    m_dmg: String(
      (asset.stats && (asset.stats.m_dmg || asset.stats.mDmg)) ||
      asset.meleeDamage || ''
    ).trim() || '--',
    m_crt: String(
      (asset.stats && (asset.stats.m_crt || asset.stats.mCrt)) ||
      asset.meleeCrit || ''
    ).trim() || '--',
      m_dis: assignUnitsNormalizeQuotes(String(
      (asset.stats && (asset.stats.m_dis || asset.stats.mDis)) ||
      asset.meleeDistance || ''
    )) || '--',

    r_dmg: String(
      (asset.stats && (asset.stats.r_dmg || asset.stats.rDmg)) ||
      asset.rangedDamage || ''
    ).trim() || '--',
    r_crt: String(
      (asset.stats && (asset.stats.r_crt || asset.stats.rCrt)) ||
      asset.rangedCrit || ''
    ).trim() || '--',
        r_dis: assignUnitsNormalizeQuotes(String(
      (asset.stats && (asset.stats.r_dis || asset.stats.rDis)) ||
      asset.rangedDistance || ''
    )) || '--',

    // Preserve raw display values (Variable/Highest/Captain/--) in stats
    atk: assignUnitsStatRaw(asset.atk, assignUnitsStatRaw((asset.stats && asset.stats.atk), '--')),
    def: assignUnitsStatRaw(asset.def, assignUnitsStatRaw((asset.stats && asset.stats.def), '--')),
    mov: assignUnitsStatRaw(asset.mov, assignUnitsStatRaw((asset.stats && asset.stats.mov), '--')),
    bod: assignUnitsStatRaw(asset.bod, assignUnitsStatRaw((asset.stats && asset.stats.bod), '--')),
    ldr: ldrRaw,
    ini: iniRaw
  };


   // unitKey MUST remain stable (do not rewrite format) so currentQtyMap matches existing assignments
  var safeUnitKey = String(unitKey || asset.unitKey || '').trim();
  if (!safeUnitKey) safeUnitKey = makeUnitKey(asset);

  var out = {
    entryId: String(asset.entryId != null ? asset.entryId : ''),
    kind: kind,
    cls: cls,
    refId: refId,
    name: name,
    img: img,
    points: points,
    ini: ini,
    honor: honor,
    stats: stats,
    unitKey: safeUnitKey
  };

  // Final hygiene pass (save-time): normalize smart quotes on stored string fields
  if (out && out.stats) {
    if (out.stats.m_dis != null) out.stats.m_dis = assignUnitsNormalizeQuotes(out.stats.m_dis);
    if (out.stats.r_dis != null) out.stats.r_dis = assignUnitsNormalizeQuotes(out.stats.r_dis);
    if (out.stats.mov   != null) out.stats.mov   = assignUnitsNormalizeQuotes(out.stats.mov);
  }

  return out;
}



function assignUnitsBuildSubmitUnits(rosterObj) {
  // returns array: [{ unit: {...}, qty: finalQty }]
  var out = [];
  if (!assignUnitsCtx || !assignUnitsCtx.selected) return out;

  var currentMap = buildRosterAssignedQtyMapForRoster(rosterObj);

  Object.keys(assignUnitsCtx.selected).forEach(function (unitKey) {
    var addQty = asInt(assignUnitsCtx.selected[unitKey], 0);
    if (addQty < 1) return;

    var asset = assignUnitsGetOwnedAssetByUnitKey(unitKey);
    if (!asset) return;

    var currentQty = asInt(currentMap[unitKey], 0);
    var finalQty = currentQty + addQty;

       // Daimyo hard cap at 1
    var clsKey = String(asset.cls || asset.class || asset.className || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (clsKey === 'daimyo') finalQty = 1;


    if (finalQty < 1) finalQty = 1;
    if (finalQty > 99) finalQty = 99;

           // IMPORTANT:
    // Do NOT submit the full owned-asset blob. It lacks canonical assignment fields
    // and can contain long blocks that risk JSON breakage.
    // Submit a stable, canonical assigned-unit object instead.

    var unitKeySafe = String(unitKey || '').trim();

    // Build the rich canonical unit object from ownedAssets (includes img + melee/ranged stats, etc.)
    var unit = assignUnitsBuildCanonicalAssignedUnitFromOwnedAsset(asset, unitKeySafe);
    if (!unit) return;

    // Sanitize ONLY the storage payload (prevents invalid JSON on refresh)
    unit = assignUnitsSanitizeForStorage(unit);

    out.push({ unit: unit, qty: finalQty });


  });

  return out;
}

function assignUnitsSubmit() {
  if (!assignUnitsCtx) return;

  assignUnitsSetError('');

  var rosterObj = getRosterObjByEntryId(assignUnitsCtx.rosterEntryId);
  if (!rosterObj) {
    assignUnitsSetError('Roster not found.');
    return;
  }

  // Build payload
  var units = assignUnitsBuildSubmitUnits(rosterObj);
  if (!units.length) {
    assignUnitsSetError('⚠️ Select at least one unit to assign.');
    return;
  }

  if (!AJAX_URL || !AJAX_NONCE) {
    assignUnitsSetError('Assign is not configured (missing ajaxUrl/nonce).');
    return;
  }

  assignUnitsSetBusy(true);

  var fd = new FormData();
  fd.append('action', 'shoshin_bulk_assign_units_to_roster');
  fd.append('nonce', AJAX_NONCE);
  fd.append('rosterEntryId', String(asInt(assignUnitsCtx.rosterEntryId, 0)));
  fd.append('units', JSON.stringify(units));

  fetch(AJAX_URL, {
    method: 'POST',
    credentials: 'same-origin',
    body: fd
  })
    .then(function (r) { return r.json(); })
    .then(function (json) {
      if (!json || !json.success) {
        var msg = (json && json.data && json.data.message) ? json.data.message : 'Assign failed.';
        throw new Error(msg);
      }

      // Update in-memory roster snapshot
      var rid = asInt((json.data && json.data.rosterEntryId), 0);
      var newAssignedJson = (json.data && json.data.assigned_units_json) ? String(json.data.assigned_units_json) : '';
      var newDigest = (json.data && json.data.digest) ? String(json.data.digest) : '';

      // Find roster in array and update common aliases
      for (var i = 0; i < rosters.length; i++) {
        var r = rosters[i] || {};
        var id = asInt((r.entryId || r.id || r.entry_id), 0);
        if (id === rid) {
          r.assigned_units_json = newAssignedJson;
          r.field_9 = newAssignedJson;
          r['9'] = newAssignedJson;

          r.digest = newDigest;
          r.field_10 = newDigest;
          r['10'] = newDigest;

          assignUnitsApplyRosterUpdateToDom(r);
          break;
        }
      }

      // Close modal
      closeAssignUnitsModal();
    })
    .catch(function (err) {
      assignUnitsSetError(err && err.message ? err.message : 'Assign failed.');
    })
    .finally(function () {
      assignUnitsSetBusy(false);
    });
}


// --------------------------------------------------------------------------
// Assign Units (Row1) — Phase B UI wiring (client-side only)
// - Renders ownedAssets list with filter + toggle + add qty (1–99)
// - Live recompute updates roster strip totals (preview only)
// --------------------------------------------------------------------------

function pickStatFromAsset(u, key) {
  if (!u || typeof u !== 'object') return null;

  // 1) Prefer top-level
  if (u[key] != null && String(u[key]).trim() !== '') return u[key];

  // 2) Nested stats object (common in your payloads)
  var stats = (u.stats && typeof u.stats === 'object') ? u.stats : null;
  if (stats && stats[key] != null && String(stats[key]).trim() !== '') return stats[key];

  return null;
}

function getAssetPoints(u) {
  // Points/cost are used interchangeably in various payloads
  // NOTE: /my-rosters owned-assets payload uses totalCost as unit cost/points
  var p = pickStatFromAsset(u, 'points');
  if (p == null) p = pickStatFromAsset(u, 'cost');
  if (p == null && u && u.totalCost != null) p = u.totalCost;
  return asInt(p, 0);
}



function getAssetInitiative(u) {
  var v = pickStatFromAsset(u, 'initiative');
  if (v == null) v = pickStatFromAsset(u, 'init');
  if (v == null) v = pickStatFromAsset(u, 'ini');
  return asInt(v, 0);
}

function getAssetLeadership(u) {
  // Honor is display label; internally leadership/ldr
  var v = pickStatFromAsset(u, 'leadership');
  if (v == null) v = pickStatFromAsset(u, 'ldr');
  if (v == null) v = pickStatFromAsset(u, 'LDR');
  return asInt(v, 0);
}

  function getAssignUnitsDisplayType(u) {
    var kind = String(u.kind || '').toLowerCase().trim();

    // Support assets show name/title (Ozutsu, Mokuzo Hansen) but allow type fallbacks
    if (kind === 'support') {
      return String(
        u.name ||
        u.title ||
        u.supportType ||
        u.cls ||
        u.class ||
        u.className ||
        u.type ||
        u.role ||
        u.archetype ||
        ''
      ).trim() || '—';
    }

    // Characters show class (Daimyo/Samurai/etc.) — your data uses className
    return String(
      u.cls ||
      u.class ||
      u.className ||
      u.type ||
      u.role ||
      u.archetype ||
      ''
    ).trim() || '—';
  }


function normalizeAssignUnitsFilterLabel(label) {
  label = String(label || 'all').trim();
  if (!label) return 'all';

  // Map UI slugs -> canonical labels used by asset data (className/cls/etc.)
  // (Do NOT change data model; just normalize the filter input.)
  var map = {
    all: 'all',
    assigned: 'assigned',
    daimyo: 'Daimyo',
    samurai: 'Samurai',
    ashigaru: 'Ashigaru',
    sohei: 'Sohei',
    ninja: 'Ninja',
    onmyoji: 'Onmyoji',
    support: 'Support Assets'
  };

  // exact match on known slugs
  if (Object.prototype.hasOwnProperty.call(map, label)) return map[label];

  // also accept case-insensitive slugs (defensive)
  var low = label.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(map, low)) return map[low];

  return label;
}


function assetMatchesAssignUnitsFilter(u, filterLabel) {
  filterLabel = normalizeAssignUnitsFilterLabel(filterLabel);

  if (filterLabel === 'all') return true;

  var kind = normalizeKind(u.kind);

  if (filterLabel === 'Support Assets') return (kind === 'support');

  var cls = String(
    u.cls ||
    u.class ||
    u.className ||
    u.type ||
    u.role ||
    u.archetype ||
    ''
  ).trim();

  // Character class filter
  return cls === filterLabel;
}


function buildRosterAssignedQtyMap(rosterObj) {
  // Map multiple keys -> currentQty (grouped)
  // Primary: unitKey (as stored)
  // Fallbacks: kind|cls/type|refId, kind|refId, refId
  var map = {};
  try {
    var grouped = groupAssigned(parseAssigned(rosterObj || {}));
    for (var i = 0; i < grouped.length; i++) {
      var u = grouped[i] || {};
      var qty = asInt(u.qty, 1);

      var k = String(u.unitKey || '').trim();
      if (!k) k = makeUnitKey(u);
      if (k) map[k] = qty;

      var kind = normalizeKind(u.kind);
      var ref = String(u.refId || u.ref_id || '').trim();

      var cls = String(
        u.cls ||
        u.class ||
        u.className ||
        u.supportType ||
        u.type ||
        u.role ||
        u.archetype ||
        ''
      ).trim();

      if (kind && cls && ref) map['k:' + kind + '|' + cls + '|' + ref] = qty;
      if (kind && ref)       map['k:' + kind + '|' + ref] = qty;

      // last-ditch fallback (only if not already set)
      if (ref && map['ref:' + ref] == null) map['ref:' + ref] = qty;
    }
  } catch (_) {}
  return map;
}


function getRosterAssignedQtyForAsset(assetOrUnit, currentQtyMap) {
  if (!assetOrUnit || !currentQtyMap) return 0;

  // 1) exact unitKey
  var unitKey = String(assetOrUnit.unitKey || '').trim();
  if (!unitKey) unitKey = makeUnitKey(assetOrUnit);
  if (unitKey && currentQtyMap[unitKey] != null) return asInt(currentQtyMap[unitKey], 0);

  // 2) fallback identity keys
  var kind = normalizeKind(assetOrUnit.kind);
  var ref = String(assetOrUnit.refId || assetOrUnit.ref_id || '').trim();

  var cls = String(
    assetOrUnit.cls ||
    assetOrUnit.class ||
    assetOrUnit.className ||
    assetOrUnit.supportType ||
    assetOrUnit.type ||
    assetOrUnit.role ||
    assetOrUnit.archetype ||
    ''
  ).trim();

  var k1 = (kind && cls && ref) ? ('k:' + kind + '|' + cls + '|' + ref) : '';
  if (k1 && currentQtyMap[k1] != null) return asInt(currentQtyMap[k1], 0);

  var k2 = (kind && ref) ? ('k:' + kind + '|' + ref) : '';
  if (k2 && currentQtyMap[k2] != null) return asInt(currentQtyMap[k2], 0);

  var k3 = ref ? ('ref:' + ref) : '';
  if (k3 && currentQtyMap[k3] != null) return asInt(currentQtyMap[k3], 0);

  return 0;
}


function rosterHasDaimyoAssigned(rosterObj) {
  try {
    var grouped = groupAssigned(parseAssigned(rosterObj || {}));
    for (var i = 0; i < grouped.length; i++) {
      var u = grouped[i] || {};
      var clsKey = String(u.cls || u.class || u.className || u.type || u.role || u.archetype || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (clsKey === 'daimyo' && asInt(u.qty, 1) >= 1) return true;
    }
  } catch (_) {}
  return false;
}


function getAssignUnitsSelectedAddQty(unitKey) {
  if (!assignUnitsCtx || !assignUnitsCtx.selected) return 0;
  return asInt(assignUnitsCtx.selected[unitKey], 0);
}

function setAssignUnitsSelectedAddQty(unitKey, addQty) {
  if (!assignUnitsCtx) return;
  if (!assignUnitsCtx.selected) assignUnitsCtx.selected = {};
  addQty = asInt(addQty, 0);

  if (addQty > 0) assignUnitsCtx.selected[unitKey] = addQty;
  else delete assignUnitsCtx.selected[unitKey];
}

function buildPreviewAssignedList(rosterObj) {
  // Returns a grouped-like array representing: current assigned + selected additions
  var baseGrouped = [];
  try {
    baseGrouped = groupAssigned(parseAssigned(rosterObj || {}));
  } catch (_) {
    baseGrouped = [];
  }

  var map = {};
  for (var i = 0; i < baseGrouped.length; i++) {
    var u = baseGrouped[i] || {};
    var k = String(u.unitKey || '').trim();
    if (!k) k = makeUnitKey(u);
    map[k] = Object.assign({}, u, { unitKey: k, qty: asInt(u.qty, 1) });
  }

  // Apply additions (additive preview)
  if (assignUnitsCtx && assignUnitsCtx.selected) {
    Object.keys(assignUnitsCtx.selected).forEach(function (k) {
      var add = asInt(assignUnitsCtx.selected[k], 0);
      if (add < 1) return;

      if (!map[k]) {
        // If unit not already assigned, we need a representative unit object
        // Find it from ownedAssets so totals can use points/initiative/leadership
        var found = null;
        for (var j = 0; j < ownedAssets.length; j++) {
          var a = ownedAssets[j] || {};
          var ak = String(a.unitKey || '').trim();
          if (!ak) ak = makeUnitKey(a);
          if (ak === k) { found = a; break; }
        }
        if (!found) return;

          map[k] = Object.assign({}, found, { unitKey: k, qty: add });

        // Ensure preview entries always carry points for computeRosterTotalsFromAssigned()
        map[k].points = asInt(getAssetPoints(found), 0);

      } else {
        // Daimyo cap at 1 even in preview
        var clsKey = String(map[k].cls || map[k].class || map[k].className || map[k].type || map[k].role || map[k].archetype || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (clsKey === 'daimyo') {
          map[k].qty = 1;
        } else {
          map[k].qty = asInt(map[k].qty, 1) + add;
        }
      }
    });
  }

  var out = Object.keys(map).map(function (k) { return map[k]; });
  // Keep consistent ordering with assigned strip
  out.sort(function (a, b) {
    var ak = classOrderKey(a.kind, a.cls || a.class || a.supportType);
    var bk = classOrderKey(b.kind, b.cls || b.class || b.supportType);
    if (ak !== bk) return ak.localeCompare(bk, undefined, { sensitivity: 'base' });

    var ar = String(a.refId || a.ref_id || '').trim();
    var br = String(b.refId || b.ref_id || '').trim();
    var cmp = ar.localeCompare(br, undefined, { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) return cmp;

    return String(a.name || a.title || '').localeCompare(String(b.name || b.title || ''), undefined, { sensitivity: 'base' });
  });

  return out;
}



function buildAssignUnitsRowHtml(u, rosterObj, currentQtyMap, rosterHasDaimyo, selectedDaimyoKey) {
  var unitKey = String(u.unitKey || '').trim();
  if (!unitKey) unitKey = makeUnitKey(u);

    var img = assignUnitsResolveCanonicalImg(u);


  var typeText = getAssignUnitsDisplayType(u);
  var refText = String(u.refId || u.ref_id || '').trim() || '—';

  var curQty = getRosterAssignedQtyForAsset(u, currentQtyMap);


  var points = getAssetPoints(u);
  var ini = getAssetInitiative(u);
  var ldr = getAssetLeadership(u);

  var selectedAdd = getAssignUnitsSelectedAddQty(unitKey);
  if (selectedAdd < 1) selectedAdd = 1;

    var isDaimyoRow = String(u.cls || u.class || u.className || '').toLowerCase().trim() === 'daimyo';

  // Daimyo is capped at 1 for Add QTY
  if (isDaimyoRow) selectedAdd = 1;

  // Disable rules:
  // 1) If roster already has a Daimyo: disable ALL Daimyo rows
  // 2) Else if user selected a Daimyo in this modal: disable all OTHER Daimyo rows
  var isDisabled = false;
  if (isDaimyoRow) {
    if (rosterHasDaimyo) {
      isDisabled = true;
    } else if (selectedDaimyoKey && selectedDaimyoKey !== unitKey) {
      isDisabled = true;
    }
  }

  var checked = !isDisabled && (getAssignUnitsSelectedAddQty(unitKey) > 0);
  var qtyDisabled = !checked;

    // Display-only dash state:
  // If unit is unassigned AND toggle is OFF, show '--' instead of 0/0%.
  var isDashState = (curQty === 0 && !checked);

  // Live "after qty" for initial render (matches row updater behavior)
  var addQty0 = checked ? asInt(getAssignUnitsSelectedAddQty(unitKey), 0) : 0;
  if (isDaimyoRow && checked) addQty0 = 1;

  var liveQty0 = curQty + addQty0;

  var qtyText0   = isDashState ? '--' : String(liveQty0);
  var iniText0   = isDashState ? '--' : String(ini * liveQty0);
  var ldrText0   = isDashState ? '--' : String(ldr * liveQty0);
  var totalText0 = isDashState ? '--' : String(points * liveQty0);

  // Percent placeholders (will be overwritten by recompute, but dash state must persist)
  var pctText0      = isDashState ? '--' : '0%';
  var qtyPctText0   = isDashState ? '--' : '0%';
  var iniPctText0   = isDashState ? '--' : '0%';
  var ldrPctText0   = isDashState ? '--' : '0%';


    // Build 1–99 options
  // Enhancement: when toggle is OFF (checked=false), disabled select should appear blank.
  var opts = '';

  // If OFF, prepend a blank selected option so the disabled selector shows no number.
  if (!checked) {
    opts += '<option value="" selected></option>';
  }

  for (var q = 1; q <= 99; q++) {
    // Daimyo: only allow 1
    if (isDaimyoRow && q !== 1) continue;

    // Only select a number when toggle is ON
    var sel = (checked && (q === selectedAdd)) ? ' selected' : '';
    opts += '<option value="' + q + '"' + sel + '>' + q + '</option>';
  }


  return (
    '<div class="shoshin-assign-units-row' + (isDashState ? ' shoshin-assign-units-row-muted' : '') + (isDisabled ? ' is-disabled' : '') +
  '" data-unit-key="' + esc(unitKey) +
  '" data-cur-qty="' + esc(String(curQty)) +
  '" data-filter-kind="' + esc(normalizeKind(u.kind)) +
  '" data-filter-cls="' + esc(String(u.cls || u.class || u.className || '').trim()) + '">' +


      '<div class="shoshin-assign-units-toggle">' +
        '<label class="shoshin-ios-toggle">' +
          '<input type="checkbox" class="shoshin-assign-units-toggle-input"' + (checked ? ' checked' : '') + (isDisabled ? ' disabled' : '') + ' />' +
          '<span class="shoshin-ios-slider"></span>' +
        '</label>' +
      '</div>' +

      '<div class="shoshin-assign-units-image">' +
        '<img src="' + esc(img) + '" alt="" loading="lazy" />' +
      '</div>' +

      '<div class="shoshin-assign-units-mid">' +
        '<div class="shoshin-assign-units-type">' + esc(typeText) + '</div>' +
        '<div class="shoshin-assign-units-ref">' + esc(refText) + '</div>' +
      '</div>' +


      '<div class="shoshin-assign-units-add">' +
        '<div class="shoshin-assign-units-label">Add</div>' +
        '<select class="shoshin-assign-units-qty-select"' + (qtyDisabled ? ' disabled' : '') + (isDisabled ? ' disabled' : '') + '>' +
          opts +
        '</select>' +
      '</div>' +

      '<div class="shoshin-assign-units-cur">' +
        '<div class="shoshin-assign-units-label">QTY</div>' +
        '<div class="shoshin-assign-units-value">' + esc(qtyText0) + '</div>' +
      '</div>' +

      '<div class="shoshin-assign-units-qtypct">' + esc(qtyPctText0) + '</div>' +

      '<div class="shoshin-assign-units-ini">' + esc(iniText0) + '</div>' +

      '<div class="shoshin-assign-units-inipct">' + esc(iniPctText0) + '</div>' +

      '<div class="shoshin-assign-units-ldr">' + esc(ldrText0) + '</div>' +

      '<div class="shoshin-assign-units-ldrpct">' + esc(ldrPctText0) + '</div>' +

      '<div class="shoshin-assign-units-totalwrap">' +
        '<div class="shoshin-assign-units-label">Total</div>' +
        '<div class="shoshin-assign-units-total">' + esc(totalText0) + '</div>' +
      '</div>' +


      '<div class="shoshin-assign-units-pct">' + esc(pctText0) + '</div>' +

    '</div>'
  );
}


function renderAssignUnitsList() {
  if (!assignUnitsModal || !assignUnitsCtx) return;

  var rosterObj = getRosterObjByEntryId(assignUnitsCtx.rosterEntryId);
  var list = assignUnitsModal.querySelector('.shoshin-assign-units-list');
  if (!list) return;

  // If no assets at all, keep the existing empty-state behavior
  if (!Array.isArray(ownedAssets) || ownedAssets.length === 0) {
    renderAssignUnitsEmptyState();
    return;
  }

  var filterLabel = normalizeAssignUnitsFilterLabel(assignUnitsCtx.filter);

    var rawFilter = String(assignUnitsCtx.filter || 'all').toLowerCase().trim();
  var isAssignedFilter = (rawFilter === 'assigned');


  // Map of already-assigned qty for this roster (CURRENT state, not preview)
  var currentQtyMap = buildRosterAssignedQtyMap(rosterObj);

  // Daimyo restriction:
  // - If roster already has a Daimyo: ALL Daimyo rows disabled (cannot toggle on)
  // - Else: if user selects a Daimyo in this modal, ALL OTHER Daimyo rows disabled
  var rosterHasDaimyo = rosterHasDaimyoAssigned(rosterObj);

    // Fallback: if helper fails, infer Daimyo presence from currentQtyMap unitKeys
  if (!rosterHasDaimyo && currentQtyMap) {
    try {
      Object.keys(currentQtyMap).some(function (k) {
        if (String(k).indexOf('|Daimyo|') !== -1 && asInt(currentQtyMap[k], 0) >= 1) {
          rosterHasDaimyo = true;
          return true;
        }
        return false;
      });
    } catch (_) {}
  }


  var selectedDaimyoKey = '';
  if (!rosterHasDaimyo && assignUnitsCtx && assignUnitsCtx.selected) {
    try {
      Object.keys(assignUnitsCtx.selected).some(function (k) {
        var add = asInt(assignUnitsCtx.selected[k], 0);
        if (add < 1) return false;

        // find owned asset for this unitKey and test class
        var asset = assignUnitsGetOwnedAssetByUnitKey(k);
if (!asset) return false;

var clsKey = String(asset.cls || asset.class || asset.className || '').toLowerCase().trim();

        if (clsKey === 'daimyo') {
          selectedDaimyoKey = String(k);
          return true;
        }
        return false;
      });
    } catch (_) {}
  }

  // Filter + sort
    var items = ownedAssets.slice().filter(function (u) {
    if (isAssignedFilter) {
      // Show only CURRENTLY assigned units for this roster (mirrors Row3 current roster card)
      var k = String(u.unitKey || '').trim();
      if (!k) k = makeUnitKey(u);
      return (asInt(currentQtyMap[k], 0) > 0);

    }

    return assetMatchesAssignUnitsFilter(u, filterLabel);
  });


  items.sort(function (a, b) {
    var ak = classOrderKey(a.kind, a.cls || a.class || a.className || a.type || a.role || a.archetype || a.supportType || a.name || a.title);
    var bk = classOrderKey(b.kind, b.cls || b.class || b.className || b.type || b.role || b.archetype || b.supportType || b.name || b.title);
    if (ak !== bk) return ak.localeCompare(bk, undefined, { sensitivity: 'base' });

    var ar = String(a.refId || a.ref_id || '').trim();
    var br = String(b.refId || b.ref_id || '').trim();
    var cmp = ar.localeCompare(br, undefined, { sensitivity: 'base' });
    if (cmp !== 0) return cmp;

    return String(a.name || a.title || '').localeCompare(String(b.name || b.title || ''), undefined, { sensitivity: 'base' });
  });

  if (!items.length) {
    list.innerHTML =
      '<div class="shoshin-assets-empty" style="padding:10px 4px;">' +
        getAssignUnitsEmptyMessageHtml(filterLabel === 'all' ? 'all' : filterLabel) +
      '</div>';
    return;
  }

  // Render rows
  var html = '';
    for (var i = 0; i < items.length; i++) {
    html += buildAssignUnitsRowHtml(items[i], rosterObj, currentQtyMap, rosterHasDaimyo, selectedDaimyoKey);
  }
  list.innerHTML = html;

   // Apply paging after render (no re-render required)
  applyAssignUnitsPaging();
  recomputeAssignUnitsPercentages();
}



// Percentages are always computed from the FULL AFTER roster.
// Filtered views must NOT renormalize to 100%, otherwise
// switching filters produces incorrect % values.

function recomputeAssignUnitsPercentages() {
  if (!assignUnitsModal || !assignUnitsCtx) return;

  // Denominators = AFTER preview totals (current + staged selections)
  var rosterObj = getRosterObjByEntryId(assignUnitsCtx.rosterEntryId);
  if (!rosterObj) return;

  var afterAssigned = [];
  try { afterAssigned = buildPreviewAssignedList(rosterObj); } catch (_) { afterAssigned = []; }

  var afterTotals = null;
  try { afterTotals = computeRosterTotalsFromAssigned(afterAssigned); } catch (_) { afterTotals = null; }

  var denomPoints = asInt(afterTotals && afterTotals.points, 0);
  if (denomPoints < 1) denomPoints = 0;

  var denomUnits = asInt(afterTotals && afterTotals.unitCount, 0);
  if (denomUnits < 1) denomUnits = 0;

  var denomIni = asInt(afterTotals && afterTotals.initiative, 0);
  if (denomIni < 1) denomIni = 0;

  var denomLdr = asInt(afterTotals && afterTotals.honor, 0);
  if (denomLdr < 1) denomLdr = 0;

  var list = assignUnitsModal.querySelector('.shoshin-assign-units-list');
  if (!list) return;

  var rows = Array.from(list.querySelectorAll('.shoshin-assign-units-row[data-unit-key]'));
  if (!rows.length) return;

  // If nothing assigned, show 0% everywhere.
  if (!afterAssigned || !afterAssigned.length) {
    for (var r0 = 0; r0 < rows.length; r0++) {
      var elP0 = rows[r0].querySelector('.shoshin-assign-units-pct');
      if (elP0) elP0.textContent = '0%';
      var elQ0 = rows[r0].querySelector('.shoshin-assign-units-qtypct');
      if (elQ0) elQ0.textContent = '0%';
      var elI0 = rows[r0].querySelector('.shoshin-assign-units-inipct');
      if (elI0) elI0.textContent = '0%';
      var elL0 = rows[r0].querySelector('.shoshin-assign-units-ldrpct');
      if (elL0) elL0.textContent = '0%';
    }
    return;
  }

  // -----------------------------------------------------------------------
  // IMPORTANT:
  // Percentages must be based on the FULL AFTER roster, not the currently
  // visible/filter subset. Otherwise filters renormalize to 100% incorrectly.
  // -----------------------------------------------------------------------

  // Build per-metric totals list from AFTER assigned items (full roster after staging)
  var itemsPoints = [];
  var itemsUnits = [];
  var itemsIni = [];
  var itemsLdr = [];

  for (var i = 0; i < afterAssigned.length; i++) {
    var u = afterAssigned[i] || {};
    var k = String(u.unitKey || '').trim();
    if (!k) continue;

    var qty = asInt(u.qty, 0);
    if (qty < 1) continue;

    // Daimyo hard-cap at 1
    var parts = k.split('|');
    if (parts.length >= 2) {
      var clsKey = String(parts[1] || '').toLowerCase().trim();
      if (clsKey === 'daimyo') qty = 1;
    }

    var points = asInt(u.points, 0);
    var rowPoints = points * qty;
    if (rowPoints < 0) rowPoints = 0;

    itemsPoints.push({ unitKey: k, rowTotal: rowPoints });
    itemsUnits.push({ unitKey: k, rowTotal: qty });

    var ini = asInt((u.ini != null ? u.ini : (u.stats && u.stats.ini)), 0);
    var rowIni = ini * qty;
    if (rowIni < 0) rowIni = 0;
    itemsIni.push({ unitKey: k, rowTotal: rowIni });

    // Honor = Leadership (LDR)
    var ldr = asInt((u.ldr != null ? u.ldr : (u.stats && u.stats.ldr)), 0);
    var rowLdr = ldr * qty;
    if (rowLdr < 0) rowLdr = 0;
    itemsLdr.push({ unitKey: k, rowTotal: rowLdr });
  }

  function applyLargestRemainder(items, denom, selector) {
    // denom 0 => 0% everywhere (for this metric)
    if (!items || !items.length || denom === 0) {
      for (var z = 0; z < rows.length; z++) {
        var el0 = rows[z].querySelector(selector);
        if (el0) el0.textContent = '0%';
      }
      return;
    }

    var floors = [];
    var sumFloor = 0;

    for (var p = 0; p < items.length; p++) {
      var exact = (items[p].rowTotal / denom) * 100;
      if (!isFinite(exact) || exact < 0) exact = 0;

      var fl = Math.floor(exact);
      var rem = exact - fl;

      floors.push({ unitKey: items[p].unitKey, floor: fl, rem: rem });
      sumFloor += fl;
    }

    var remaining = 100 - sumFloor;
    if (remaining < 0) remaining = 0;

    floors.sort(function (a, b) { return b.rem - a.rem; });

    for (var a = 0; a < remaining; a++) {
      if (a < floors.length) floors[a].floor += 1;
    }

    var pctMap = {};
    for (var m = 0; m < floors.length; m++) {
      pctMap[floors[m].unitKey] = floors[m].floor;
    }

    // Map to currently rendered rows (any filter)
    for (var r = 0; r < rows.length; r++) {
      var k2 = String(rows[r].getAttribute('data-unit-key') || '').trim();

      // Do not overwrite dash state rows (unassigned + toggle OFF)
      var cur0 = asInt(rows[r].getAttribute('data-cur-qty'), 0);
      var t0 = rows[r].querySelector('.shoshin-assign-units-toggle-input');
      var off0 = !(t0 && t0.checked);

      if (cur0 === 0 && off0) {
        var elDash = rows[r].querySelector(selector);
        if (elDash) elDash.textContent = '--';
        continue;
      }


      if (!k2) continue;

      var pctEl = rows[r].querySelector(selector);
      if (!pctEl) continue;

      var val = (pctMap[k2] != null) ? asInt(pctMap[k2], 0) : 0;
      pctEl.textContent = String(val) + '%';
    }
  }

  // Apply per-metric percentage distributions (no decimals; force 100% via remainder)
  applyLargestRemainder(itemsPoints, denomPoints, '.shoshin-assign-units-pct');
  applyLargestRemainder(itemsUnits, denomUnits, '.shoshin-assign-units-qtypct');
  applyLargestRemainder(itemsIni, denomIni, '.shoshin-assign-units-inipct');
  applyLargestRemainder(itemsLdr, denomLdr, '.shoshin-assign-units-ldrpct');
}






function openAssignUnitsModalForRosterEntryId(rosterEntryId, focusReturnEl) {
  ensureAssignUnitsModal();

  assignUnitsCtx = {
    rosterEntryId: asInt(rosterEntryId, 0),
    focusReturnEl: focusReturnEl || null,
    filter: 'all',
    visibleLimit: ASSIGN_UNITS_PAGE_SIZE
  };


    // Debug/trace: persist active roster id on the modal DOM (no behavioral change)
  try {
    assignUnitsModal.setAttribute('data-roster-entry-id', String(assignUnitsCtx.rosterEntryId || ''));
  } catch (_) {}


  // Default filter button state to All
  try {
    var wrap = assignUnitsModal.querySelector('.shoshin-assign-units-filters');
    if (wrap) {
      var btns = wrap.querySelectorAll('button[data-filter]');
      Array.prototype.forEach.call(btns, function (b) { b.classList.remove('is-active'); });
      var allBtn = wrap.querySelector('button[data-filter="all"]');
      if (allBtn) allBtn.classList.add('is-active');
    }
  } catch (_) {}

  // initialize selection map for this open
assignUnitsCtx.selected = {};

  // Bulk Assign: disable Assign button until at least one unit is selected
  try {
    var confirmBtn0 = assignUnitsModal.querySelector('.shoshin-modal-btn-confirm');
    if (confirmBtn0) confirmBtn0.disabled = true;
  } catch (_) {}


// initial renders
renderAssignUnitsList();
assignUnitsBindListEventsOnce();
assignUnitsRecomputePreview();


  setModalVisible(assignUnitsModal, assignUnitsModalBackdrop, true);

  var confirmBtn = assignUnitsModal.querySelector('.shoshin-modal-btn-confirm');
  if (confirmBtn) confirmBtn.focus();
}

function closeAssignUnitsModal() {
  if (!assignUnitsModal || !assignUnitsModalBackdrop) return;

  setModalVisible(assignUnitsModal, assignUnitsModalBackdrop, false);

  if (assignUnitsCtx && assignUnitsCtx.focusReturnEl && assignUnitsCtx.focusReturnEl.focus) {
    try { assignUnitsCtx.focusReturnEl.focus(); } catch (_) {}
  }
  assignUnitsCtx = null;
}

// BEGIN SHOSHIN PRINT P1-B — PRINT MODAL + LAYOUT #1 RENDERER (Phase 1)
// ==========================================================================
// PRINT MODAL (Row1) — Phase 1
// - Opens from Row1 Print button
// - Layout #1 (Landscape) only; Layout #2 thumbnail placeholder (Phase 2)
// - Mode: Consolidated OR Comprehensive (radio)
// - Output opens in NEW TAB (no iframe), isolated HTML/CSS, then triggers print
// ==========================================================================

var printModal = null;
var printModalBackdrop = null;
var printCtx = null; // { rosterEntryId, focusReturnEl }

var PRINT_MODE_DEFAULT = 'consolidated'; // per SOW default

var PRINT_BUCKETS_ORDER = [
  'Daimyo',
  'Samurai',
  'Ashigaru',
  'Sohei',
  'Ninja',
  'Onmyoji',
  'Artillery',
  'Sailing Ships'
];

// Explicit MRBPA order (authoritative)
var MRBPA_ORDER = ['M', 'R', 'B', 'P', 'A'];

// BEGIN SHOSHIN PRINT P1-C — REPLACE ensurePrintModal() FOR POLISHED UI
function ensurePrintModal() {
  if (printModal && printModalBackdrop) return;

  // Backdrop
  printModalBackdrop = document.createElement('div');
  printModalBackdrop.className = 'shoshin-modal-backdrop shoshin-print-modal-backdrop';
  printModalBackdrop.style.display = 'none';

  // Modal
  printModal = document.createElement('div');
  printModal.className = 'shoshin-modal shoshin-print-modal';
  printModal.style.display = 'none';

  // ARIA (matches other modals pattern)
  printModal.setAttribute('role', 'dialog');
  printModal.setAttribute('aria-modal', 'true');
  printModal.setAttribute('aria-labelledby', 'shoshin-print-modal-title');


  // Static thumbnails (you provided)
  var THUMB_LANDSCAPE = '/wp-content/uploads/2026/01/printtestlandscape-scaled.jpg';
  var THUMB_PORTRAIT  = '/wp-content/uploads/2026/01/printtestportrait-scaled.jpg';

  // Layout selection state (Layout #1 default)
  var defaultLayout = 'layout1';

  // NOTE: This skeleton is intentionally the same 3-part structure used by other modals:
  // header (fixed) + body (scroll) + footer (fixed)
  printModal.innerHTML =
    '<div class="shoshin-modal-header shoshin-print-header">' +
      '<img class="shoshin-modal-logo" src="/wp-content/uploads/2025/11/Header_logo_300x150_1.png" alt="Site logo" />' +
      '<button type="button" class="shoshin-modal-x" aria-label="Close">×</button>' +
    '</div>' +


    '<div class="shoshin-modal-body shoshin-print-body">' +
      '<h2 id="shoshin-print-modal-title" class="shoshin-modal-title shoshin-print-title">Print Clan Roster Sheet</h2>' +

      // Roster Preview host (single panel styled like Bulk Assign preview)
      '<div class="shoshin-print-preview-wrap">' +
        '<div class="shoshin-print-preview-host"></div>' +
      '</div>' +

      '<div class="shoshin-print-layout-instructions">Click on a print layout to select it.</div>' +

      // Layout cards
      '<div class="shoshin-print-layouts">' +

        '<button type="button" class="shoshin-print-layout-card is-active" data-layout="layout1" aria-pressed="true">' +
          '<div class="shoshin-print-layout-card-title">Layout #1</div>' +
          '<div class="shoshin-print-layout-card-sub">Landscape • Statbox</div>' +
          '<div class="shoshin-print-thumb-frame">' +
            '<img class="shoshin-print-thumb-img" src="' + THUMB_LANDSCAPE + '" alt="Layout #1">' +
          '</div>' +
          '<div class="shoshin-print-layout-note">Paper Intensive • Vision Saver</div>' +
        '</button>' +

        '<button type="button" class="shoshin-print-layout-card" data-layout="layout2" aria-pressed="false">' +
          '<div class="shoshin-print-layout-card-title">Layout #2</div>' +
          '<div class="shoshin-print-layout-card-sub">Portrait • Table</div>' +
          '<div class="shoshin-print-thumb-frame">' +
            '<img class="shoshin-print-thumb-img" src="' + THUMB_PORTRAIT + '" alt="Layout #2">' +
          '</div>' +
          '<div class="shoshin-print-layout-note">Vision Intensive • Paper Saver</div>' +
        '</button>' +

      '</div>' +

      // Print Options (toggles; consolidated/comprehensive mutually exclusive)

  '<div class="shoshin-print-modes">' +
  '<div class="shoshin-print-modes-title">Print Options</div>' +

    // Include Images (default ON) — MUST be last per your request
  '<div class="shoshin-print-option">' +
    '<label class="shoshin-ios-toggle shoshin-print-toggle">' +
            '<input type="checkbox" id="shoshin_print_toggle_images" checked>' +
      '<span class="track"></span>' +
      '<span class="thumb"></span>' +
    '</label>' +
    '<div class="shoshin-print-option-text">' +
      '<div class="shoshin-print-option-label">Display Images?</div>' +
      '<div class="shoshin-print-option-sub">Show/hide thumbnails, dividers & background</div>' +
    '</div>' +
  '</div>' +

  // Consolidated (default ON)
  '<div class="shoshin-print-option">' +
    '<label class="shoshin-ios-toggle shoshin-print-toggle">' +
      '<input type="checkbox" id="shoshin_print_toggle_consolidated" checked>' +
      '<span class="track"></span>' +
      '<span class="thumb"></span>' +
    '</label>' +
    '<div class="shoshin-print-option-text">' +
      '<div class="shoshin-print-option-label">Consolidated View</div>' +
      '<div class="shoshin-print-option-sub">Grouped by REF ID; shows total QTY</div>' +
    '</div>' +
  '</div>' +

  // Comprehensive (default OFF)
  '<div class="shoshin-print-option">' +
    '<label class="shoshin-ios-toggle shoshin-print-toggle">' +
      '<input type="checkbox" id="shoshin_print_toggle_comprehensive">' +
      '<span class="track"></span>' +
      '<span class="thumb"></span>' +
    '</label>' +
    '<div class="shoshin-print-option-text">' +
      '<div class="shoshin-print-option-label">Comprehensive View</div>' +
      '<div class="shoshin-print-option-sub">One model per line item</div>' +
    '</div>' +
  '</div>' +

 /* BEGIN SHOSHIN PRINT — QUICK REFERENCE TOGGLE (MODAL UI) */
// Add Quick Reference? (default OFF)
  '<div class="shoshin-print-option">' +
    '<label class="shoshin-ios-toggle shoshin-print-toggle">' +
      '<input type="checkbox" id="shoshin_print_toggle_quickref">' +
      '<span class="track"></span>' +
      '<span class="thumb"></span>' +
    '</label>' +
    '<div class="shoshin-print-option-text">' +
      '<div class="shoshin-print-option-label">Add Quick Reference?</div>' +
      '<div class="shoshin-print-option-sub">Appends a 1-page quick reference sheet</div>' +
    '</div>' +
  '</div>' +
/* END SHOSHIN PRINT — QUICK REFERENCE TOGGLE (MODAL UI) */

'</div>' +

      // Error area
      '<div class="shoshin-print-error shoshin-modal-error" style="display:none;"></div>' +
    '</div>' +

    // Footer buttons (fixed)
    '<div class="shoshin-modal-footer shoshin-print-footer">' +
      '<button type="button" class="shoshin-modal-btn shoshin-modal-btn-confirm shoshin-print-btn-print">Print</button>' +
      '<button type="button" class="shoshin-modal-btn shoshin-modal-btn-cancel shoshin-print-btn-cancel">Cancel</button>' +
    '</div>';

  document.body.appendChild(printModalBackdrop);
  document.body.appendChild(printModal);

  // --------------------------
  // Helpers — layout selection
  // --------------------------
  function getSelectedLayout() {
    var active = printModal.querySelector('.shoshin-print-layout-card.is-active');
    return active ? String(active.getAttribute('data-layout') || '') : 'layout1';
  }

  function setSelectedLayout(layout) {
    layout = String(layout || '').toLowerCase();
    if (layout !== 'layout1' && layout !== 'layout2') layout = 'layout1';

    var cards = printModal.querySelectorAll('.shoshin-print-layout-card');
    Array.prototype.forEach.call(cards, function (c) {
      var isActive = String(c.getAttribute('data-layout')) === layout;
      c.classList.toggle('is-active', isActive);
      c.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  // --------------------------
// Helpers — print options (toggles)
// --------------------------
function getEl(id) { return printModal.querySelector('#' + id); }

function syncModeToggles(changedId) {
  var tCon = getEl('shoshin_print_toggle_consolidated');
  var tCmp = getEl('shoshin_print_toggle_comprehensive');
  if (!tCon || !tCmp) return;

  // Enforce mutual exclusivity + never allow both OFF
  if (changedId === 'shoshin_print_toggle_consolidated') {
    if (tCon.checked) tCmp.checked = false;
    else tCmp.checked = true;
  } else if (changedId === 'shoshin_print_toggle_comprehensive') {
    if (tCmp.checked) tCon.checked = false;
    else tCon.checked = true;
  } else {
    // safety pass
    if (!tCon.checked && !tCmp.checked) tCon.checked = true;
    if (tCon.checked && tCmp.checked) tCmp.checked = false;
  }
}

function getSelectedPrintMode() {
  var tCon = getEl('shoshin_print_toggle_consolidated');
  var tCmp = getEl('shoshin_print_toggle_comprehensive');

  // Defaults/safety
  if (!tCon && !tCmp) return PRINT_MODE_DEFAULT;

  // Enforce safety if something weird happens
  if (tCon && tCmp) {
    if (tCon.checked && tCmp.checked) tCmp.checked = false;
    if (!tCon.checked && !tCmp.checked) tCon.checked = true;
  }

  if (tCon && tCon.checked) return 'consolidated';
  if (tCmp && tCmp.checked) return 'comprehensive';
  return PRINT_MODE_DEFAULT;
}

function getIncludeImages() {
  var tImg = getEl('shoshin_print_toggle_images');
  return !!(tImg && tImg.checked);
}

// Wire toggle events
var tCon = getEl('shoshin_print_toggle_consolidated');
var tCmp = getEl('shoshin_print_toggle_comprehensive');
var tImg = getEl('shoshin_print_toggle_images');

if (tCon) tCon.addEventListener('change', function () { syncModeToggles('shoshin_print_toggle_consolidated'); });
if (tCmp) tCmp.addEventListener('change', function () { syncModeToggles('shoshin_print_toggle_comprehensive'); });

// images toggle is independent; no sync needed, but hook exists for later if you want
if (tImg) tImg.addEventListener('change', function () { /* no-op for now */ });

// Ensure initial state is valid (Consolidated ON, Comprehensive OFF, Images OFF)
syncModeToggles('init');


  // Card click selects layout
  printModal.addEventListener('click', function (e) {
    var btn = e.target.closest('.shoshin-print-layout-card');
    if (!btn) return;
    e.preventDefault();
    var layout = btn.getAttribute('data-layout');
    setSelectedLayout(layout);
  });

    // Mode toggles: mutually exclusive
  printModal.addEventListener('change', function (e) {
    var t = e.target;
    if (!t) return;

    if (t.id === 'shoshin_print_toggle_consolidated') {
      if (t.checked) {
        var other = printModal.querySelector('#shoshin_print_toggle_comprehensive');
        if (other) other.checked = false;
      } else {
        // never allow both OFF — snap back to consolidated if user tries to turn it off
        t.checked = true;
      }
    }

    if (t.id === 'shoshin_print_toggle_comprehensive') {
      if (t.checked) {
        var other2 = printModal.querySelector('#shoshin_print_toggle_consolidated');
        if (other2) other2.checked = false;
      } else {
        // never allow both OFF — snap back to comprehensive if user tries to turn it off
        t.checked = true;
      }
    }
  });


  // Close handlers
  printModalBackdrop.addEventListener('click', closePrintModal);

  var xBtn = printModal.querySelector('.shoshin-modal-x');
  var cancelBtn = printModal.querySelector('.shoshin-print-btn-cancel');
  if (xBtn) xBtn.addEventListener('click', closePrintModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closePrintModal);

  // Print handler
  var confirmBtn = printModal.querySelector('.shoshin-print-btn-print');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', function () {
      if (!printCtx || !printCtx.rosterEntryId) return;

      clearPrintModalError();

      var layout = getSelectedLayout();


      var mode = getSelectedPrintMode();
      if (!mode) {
        showPrintModalError('Select an output mode.');
        return;
      }

      var rosterObj = getRosterObjByEntryId(printCtx.rosterEntryId);
      if (!rosterObj) {
        showPrintModalError('Roster not found.');
        return;
      }

      var includeImages = getSelectedIncludeImages();
      /* BEGIN SHOSHIN PRINT — READ QR TOGGLE */
var includeQuickRef = getSelectedIncludeQuickRef();
/* END SHOSHIN PRINT — READ QR TOGGLE */


      try {
        if (layout === 'layout2') {
          openPrintTabLayout2(rosterObj, mode, includeImages, includeQuickRef);
        } else {
          openPrintTabLayout1(rosterObj, mode, includeImages, includeQuickRef);
        }



      } catch (e) {
        console.error('Shoshin Print: failed to open print tab', e);
        showPrintModalError('Unable to generate print output.');
        return;
      }

      closePrintModal();
    });
  }

  // Default layout
  setSelectedLayout(defaultLayout);
}
// END SHOSHIN PRINT P1-C — REPLACE ensurePrintModal() FOR POLISHED UI



function openPrintModalForRosterEntryId(rosterEntryId, focusReturnEl) {
  ensurePrintModal();

  printCtx = {
    rosterEntryId: asInt(rosterEntryId, 0),
    focusReturnEl: focusReturnEl || null
  };

// BEGIN SHOSHIN PRINT P1-D — Roster Preview injection (Bulk Assign style)
var rosterObj = getRosterObjByEntryId(printCtx.rosterEntryId);

var host = printModal.querySelector('.shoshin-print-preview-host');
if (host) {
  host.innerHTML = '';

  // ✅ IMPORTANT: roster units come from assigned_units_json (string or array)
  // Use the existing helper (defined later in the file; function hoisting is OK).
  var assigned = [];
  try {
    assigned = parseAssignedUnits(rosterObj);
  } catch (_) {
    assigned = [];
  }

  // Totals use the same trusted engine as roster cards
  var totals = computeRosterTotalsFromAssigned(assigned);

  var icon = String((rosterObj && rosterObj.icon) || '').trim();
  var name = String((rosterObj && rosterObj.name) || '').trim();
  var ref  = String((rosterObj && (rosterObj.refId || rosterObj.ref_id)) || '').trim();

  host.innerHTML =
    '<div class="shoshin-unassign-preview-panel shoshin-print-preview-panel">' +
      '<div class="shoshin-unassign-preview-row">' +

        '<div class="shoshin-unassign-preview-roster">' +
          '<div class="shoshin-unassign-preview-avatar">' +
            (icon ? '<img src="' + escapeHtml(icon) + '" alt="">' : '') +
          '</div>' +
          '<div class="shoshin-unassign-preview-meta">' +
            '<div class="shoshin-unassign-preview-name">' + escapeHtml(name) + '</div>' +
            '<div class="shoshin-unassign-preview-ref">' + escapeHtml(ref) + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="shoshin-unassign-preview-stats">' +
          '<table class="shoshin-stat-strip">' +
            '<tbody><tr>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">POINTS</div><div class="shoshin-stat-value">' + escapeHtml(String(totals.points)) + '</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">UNITS</div><div class="shoshin-stat-value">' + escapeHtml(String(totals.unitCount)) + '</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">INITIATIVE</div><div class="shoshin-stat-value">' + escapeHtml(String(totals.initiative)) + '</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">HONOR</div><div class="shoshin-stat-value">' + escapeHtml(String(totals.honor)) + '</div></div></td>' +
            '</tr></tbody>' +
          '</table>' +
        '</div>' +

      '</div>' +
    '</div>';
}
// END SHOSHIN PRINT P1-D — Roster Preview injection (Bulk Assign style)

  // Defaults (mode ON, images ON)
  setSelectedPrintMode(PRINT_MODE_DEFAULT);
  setSelectedIncludeImages(true);
/* BEGIN SHOSHIN PRINT — DEFAULT QR TOGGLE OFF */
setSelectedIncludeQuickRef(false);
/* END SHOSHIN PRINT — DEFAULT QR TOGGLE OFF */


  setModalVisible(printModal, printModalBackdrop, true);
}

function closePrintModal() {
  if (!printModal || !printModalBackdrop) return;

  clearPrintModalError();
  setModalVisible(printModal, printModalBackdrop, false);

  if (printCtx && printCtx.focusReturnEl && printCtx.focusReturnEl.focus) {
    try { printCtx.focusReturnEl.focus(); } catch (_) {}
  }
  printCtx = null;
}

function getSelectedPrintMode() {
  if (!printModal) return '';
  var c = printModal.querySelector('#shoshin_print_toggle_consolidated');
  var p = printModal.querySelector('#shoshin_print_toggle_comprehensive');

  var cOn = !!(c && c.checked);
  var pOn = !!(p && p.checked);

  if (cOn) return 'consolidated';
  if (pOn) return 'comprehensive';
  return '';
}

function setSelectedPrintMode(mode) {
  if (!printModal) return;
  mode = String(mode || '').toLowerCase();

  var c = printModal.querySelector('#shoshin_print_toggle_consolidated');
  var p = printModal.querySelector('#shoshin_print_toggle_comprehensive');

  if (!c || !p) return;

  if (mode === 'comprehensive') {
    c.checked = false;
    p.checked = true;
  } else {
    // default consolidated
    c.checked = true;
    p.checked = false;
  }
}

function getSelectedIncludeImages() {
  if (!printModal) return false;
  var t = printModal.querySelector('#shoshin_print_toggle_images');
  return !!(t && t.checked);
}

function setSelectedIncludeImages(on) {
  if (!printModal) return;
  var t = printModal.querySelector('#shoshin_print_toggle_images');
  if (!t) return;
  t.checked = !!on;
}

/* BEGIN SHOSHIN PRINT — QUICK REFERENCE TOGGLE (GET/SET) */
function getSelectedIncludeQuickRef() {
  if (!printModal) return false;
  var t = printModal.querySelector('#shoshin_print_toggle_quickref');
  return !!(t && t.checked);
}

function setSelectedIncludeQuickRef(on) {
  if (!printModal) return;
  var t = printModal.querySelector('#shoshin_print_toggle_quickref');
  if (!t) return;
  t.checked = !!on;
}
/* END SHOSHIN PRINT — QUICK REFERENCE TOGGLE (GET/SET) */

function showPrintModalError(msg) {
  if (!printModal) return;
  var el = printModal.querySelector('.shoshin-print-error');
  if (!el) return;
  el.textContent = String(msg || 'Error');
  el.style.display = 'block';
}

function clearPrintModalError() {
  if (!printModal) return;
  var el = printModal.querySelector('.shoshin-print-error');
  if (!el) return;
  el.textContent = '';
  el.style.display = 'none';
}

// --------------------------------------------------------------------------
// PRINT: Layout #1 renderer + new tab writer
// --------------------------------------------------------------------------

function buildOwnedAssetsIndex() {
  var idx = Object.create(null);
  if (!Array.isArray(ownedAssets)) return idx;
  for (var i = 0; i < ownedAssets.length; i++) {
    var a = ownedAssets[i];
    var id = asInt(a && (a.entryId || a.id || a.entry_id), 0);
    if (id) idx[id] = a;
  }
  return idx;
}

function safeArray(val) {
  return Array.isArray(val) ? val : [];
}

function parseAssignedUnits(rosterObj) {
  // rosterObj.assigned_units_json may be:
  // - already an array
  // - a JSON string
  // - missing/empty
  var raw = rosterObj && (rosterObj.assigned_units_json || rosterObj.assignedUnitsJson || rosterObj.assigned_units);
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;

  try {
    var parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function normalizeStat(v) {
  // Print wants verbatim short tokens; ensure string, avoid null/undefined
  if (v === null || typeof v === 'undefined') return '--';
  return String(v);
}

function computeRosterTotalsFromUnits(units) {
  var totals = {
    units: 0,
    points: 0,
    ini: 0,
    honor: 0
  };

  for (var i = 0; i < units.length; i++) {
    var u = units[i] || {};
    var qty = asInt(u.qty, 0);
    if (qty < 1) qty = 1;

    totals.units += qty;

    var pts = Number(u.points);
    if (!isFinite(pts)) pts = 0;
    totals.points += (pts * qty);

    var ini = Number(u.ini);
    if (!isFinite(ini)) ini = 0;
    totals.ini += (ini * qty);

    var hon = Number(u.honor);
    if (!isFinite(hon)) hon = 0;
    totals.honor += (hon * qty);
  }

  return totals;
}

function readMasterClassAbilitiesFallback(rosterEntryId) {
  // MVP: safe read from DOM only if needed
  // Looks for the roster card and parses the "Master Class Abilities:" line
  var card = listEl.querySelector('.shoshin-roster-card[data-roster-entry-id="' + String(rosterEntryId) + '"]');
  if (!card) return 0;

  var descs = card.querySelectorAll('.shoshin-asset-class-desc');
  var i;
  for (i = 0; i < descs.length; i++) {
    var t = (descs[i] && descs[i].textContent) ? descs[i].textContent : '';
    if (t && t.toLowerCase().indexOf('master class abilities') !== -1) {
      // extract first int
      var m = t.match(/(\d+)/);
      return m ? asInt(m[1], 0) : 0;
    }
  }
  return 0;
}

function parseModsBlockToLines(modsBlock) {
  // modsBlock is already "print-ready" per tech debt resolution.
  // Example line: "[R] 12\" 30° AOE cone"
  var lines = String(modsBlock || '')
    .split(/\r?\n/)
    .map(function (s) { return String(s || '').trim(); })
    .filter(function (s) { return !!s; });

  // Keep only MRBPA-tagged lines (drop neutral/untyped + any other tags)
  // Must begin with [M]/[R]/[B]/[P]/[A] + whitespace
  lines = lines.filter(function (s) {
    return /^\[(M|R|B|P|A)\]\s+/i.test(s);
  });

  // Sort by explicit MRBPA order; stable within group
  var buckets = { M: [], R: [], B: [], P: [], A: [] };
  for (var i = 0; i < lines.length; i++) {
    var tag = lines[i].charAt(1).toUpperCase();
    if (buckets[tag]) buckets[tag].push(lines[i]);
  }

  var out = [];
  for (var k = 0; k < MRBPA_ORDER.length; k++) {
    out = out.concat(buckets[MRBPA_ORDER[k]] || []);
  }

  // Max 16 tags (4×4 grid). Drop the rest.
  if (out.length > 16) out = out.slice(0, 16);

  return out;
}


function chooseModsGrid(linesCount) {
  // Phase 3 decision: fixed 4×4 grid (max 16 tags).
  // Any extra tags are trimmed upstream in parseModsBlockToLines().
  return { cols: 4, rows: 4 };
}


function groupUnitsConsolidated(units) {
  // Group by cls bucket then refId
  var out = [];
  var byBucket = Object.create(null);

  for (var i = 0; i < units.length; i++) {
    var u = units[i] || {};
    var cls = String(u.cls || u.className || u.class || '').trim();
    var ref = String(u.refId || '').trim();
    if (!cls || !ref) continue;

    if (!byBucket[cls]) byBucket[cls] = Object.create(null);
    if (!byBucket[cls][ref]) {
      byBucket[cls][ref] = {
        cls: cls,
        refId: ref,
        sample: u,
        qty: 0
      };
    }

    var q = asInt(u.qty, 0);
    if (q < 1) q = 1;
    byBucket[cls][ref].qty += q;
  }

  // Flatten in bucket order
  for (var b = 0; b < PRINT_BUCKETS_ORDER.length; b++) {
    var bucketName = PRINT_BUCKETS_ORDER[b];
    var grp = byBucket[bucketName];
    if (!grp) continue;

    var refs = Object.keys(grp).sort(function (a, c) {
      return a.localeCompare(c, undefined, { numeric: true, sensitivity: 'base' });
    });

    var bucketRows = refs.map(function (r) { return grp[r]; });
    out.push({ bucket: bucketName, rows: bucketRows });
  }

  return out;
}

function expandUnitsComprehensive(units) {
  // Expand qty into N identical rows (qty=1)
  var out = [];
  var byBucket = Object.create(null);

  for (var i = 0; i < units.length; i++) {
    var u = units[i] || {};
    var cls = String(u.cls || u.className || u.class || '').trim();
    var ref = String(u.refId || '').trim();
    if (!cls || !ref) continue;

    var q = asInt(u.qty, 0);
    if (q < 1) q = 1;

    if (!byBucket[cls]) byBucket[cls] = [];
    for (var n = 0; n < q; n++) {
      byBucket[cls].push({
        cls: cls,
        refId: ref,
        sample: u,
        qty: 1
      });
    }
  }

  // Bucket order, then REF ID sort (stable)
  for (var b = 0; b < PRINT_BUCKETS_ORDER.length; b++) {
    var bucketName = PRINT_BUCKETS_ORDER[b];
    var arr = byBucket[bucketName];
    if (!arr || !arr.length) continue;

    arr.sort(function (a, c) {
      return a.refId.localeCompare(c.refId, undefined, { numeric: true, sensitivity: 'base' });
    });

    out.push({ bucket: bucketName, rows: arr });
  }

  return out;
}

/* =====================================================================
[SHOSHIN PRINT BASELINE REBUILD] (Option 1 — exact page shell in inches)
Purpose:
- Create a NEW authoritative baseline for print work.
- Print-only first: DO NOT touch /@media screen beyond the local baseline shell.
- No pagination / justify / measure-mode logic here. We will add later in a new branch.

How to disable:
- Set SHOSHIN_PRINT_BASELINE_REBUILD = false
===================================================================== */

var SHOSHIN_PRINT_BASELINE_REBUILD = false;

/* Page shell uses inches (future portrait is a 1-line swap). */
function getPrintBaselineCSS() {
  return (
`@page{ size: letter landscape; margin: 0; }

/* Normalize */
html, body{ margin:0; padding:0; }
body{
  font-family: Arial, sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* PAGE SHELL (inches; browser will scale for preview) */
.print-pages-wrap{ width: 11in; margin: 0 auto; }
.print-frag{
  width: 11in;
  height: 8.5in;
  box-sizing: border-box;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
}
.print-frag:last-child{
  page-break-after: auto;
  break-after: auto;
}
.print-frag-inner{
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* GLOBAL HEADER (inside the page shell) */
.print-header{
  flex: 0 0 auto;
  padding: 0.25in 0.35in 0.15in 0.35in;
  border-bottom: 1px solid #000;

}

.print-header .ph-title{
  font-size: 16pt;
  font-weight: 800;
  line-height: 1.1;
}
.print-header .ph-sub{
  margin-top: 2px;
  font-size: 10pt;
  opacity: 0.85;
}

/* BODY STACK (we will paginate later; for now it is ONE page of test content) */
.print-frag-body{
  flex: 1 1 auto;
  min-height: 0;
  padding: 0.20in 0.35in 0.25in 0.35in;
  display: flex !important;
  flex-direction: column !important;
  gap: 0.12in;
}

/* UNIT BLOCK */
.print-unit-block{ display:flex; gap: 0.12in; align-items:flex-start; }
.print-section-thumb{
  width: 0.55in;
  height: 0.55in;
  border: 1px solid #000;
  background: #eee;
  flex: 0 0 auto;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size: 9pt;
  font-weight: 800;
}
.print-section-title{
  font-size: 14pt;
  font-weight: 800;
  line-height: 1.1;
}
.print-unit-row{
  margin-top: 0.06in;
  border: 1px solid #000;
  padding: 0.08in 0.10in;
  font-size: 10pt;
  line-height: 1.15;
}

/* DIVIDER ROW */
.shoshin-divider-row{
  height: 0.18in;
  display:flex;
  align-items:center;
}
.print-section-divider{
  height: 1px;
  width: 100%;
  background: #000;
}

/* SCREEN PREVIEW (minimal; do not touch your existing screen rules elsewhere) */
@media screen{
  body{ background:#f2f2f2; padding: 24px 0; }
  .print-pages-wrap{ display:flex; flex-direction:column; align-items:center; gap:24px; }
    .print-frag{
    background:#fff;
    background-image: url("/wp-content/uploads/2026/01/bgland50.webp");
    background-repeat: no-repeat;
    background-position: 0 0;
    background-size: 100% 100%;
    box-shadow: 0 6px 18px rgba(0,0,0,0.25);
  }

}`
  );
}

/* Minimal test page: header + 4 units + 3 dividers (tune later). */
function renderPrintBaselineHTML(opts){
  const includeImages = !!(opts && opts.includeImages);
  const rosterName = (opts && opts.rosterName) ? String(opts.rosterName) : "BASELINE TEST — SHOSHIN";
  const rosterRef  = (opts && opts.rosterRef)  ? String(opts.rosterRef)  : "TEST-000";

  function esc(s){
    return String(s)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/\"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  function unitHTML(i){
    return (
      '<div class="print-group print-unit-group">' +
        '<div class="print-unit-block">' +
          '<div class="print-section-thumb">' + (includeImages ? 'IMG' : '') + '</div>' +
          '<div class="print-unit-meta">' +
            '<div class="print-section-title">Unit ' + (i+1) + ' — Test Name</div>' +
            '<div class="print-unit-row">Row 1: Stats / Tags / Costs (placeholder)</div>' +
            '<div class="print-unit-row">Row 2: Abilities / Equipment (placeholder)</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function dividerHTML(){
    return (
      '<div class="print-group print-divider-group">' +
        '<div class="shoshin-divider-row"><div class="print-section-divider"></div></div>' +
      '</div>'
    );
  }



  return (
        '<div class="print-pages-wrap">' +

      '<div class="print-frag">' +
        '<div class="print-frag-inner">' +
          '<div class="print-header">' +
            '<div class="ph-title">' + esc(rosterName) + '</div>' +
            '<div class="ph-sub">Ref: ' + esc(rosterRef) + ' — Baseline print shell (11in × 8.5in)</div>' +
          '</div>' +
          '<div class="print-frag-body">' +
            seq +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}



/* Simplified print-tab writer (bypasses old paginate/justify/measure-mode). */
function openPrintTabDocumentBaseline(cfg){
  var title   = (cfg && cfg.title) ? String(cfg.title) : "Print";
  var cssText = (cfg && cfg.cssText) ? String(cfg.cssText) : "";
  var bodyHTML= (cfg && cfg.bodyHTML) ? String(cfg.bodyHTML) : "";



  // local escape for <title>
  function esc(s){
    return String(s)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/\"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  // BEGIN SHOSHIN PRINT WINDOW OPEN (OPTION B SAFE)
  // Popup-blocker friendly: do NOT pass a features string.
  // Open synchronously in the click gesture, then write into it.
  var w = window.open("about:blank", "_blank");
  if (!w) return;

  // Optional: emulate noopener without triggering popup heuristics
  try { w.opener = null; } catch(e) {}
  // END SHOSHIN PRINT WINDOW OPEN (OPTION B SAFE)


  var doc = w.document;
  doc.open();
  doc.write(
    '<!doctype html><html><head>' +
      '<meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +

      '<style>' + cssText + '</style>' +
    '</head><body>' +
      bodyHTML +


/* =====================================================================
DO NOT EDIT THIS BLOCK UNLESS WE ARE WORKING ON THE BASELINE HARNESS.
The REAL print pipeline pagination lives under:
  /* BEGIN SHOSHIN PRINT — BODY WRITE WITH PAGINATION (REAL PIPELINE) */
  /* BEGIN SHOSHIN PRINT — RUNTIME PAGINATION (REAL PRINT WINDOW ONLY) */
/* ===================================================================== */



/* BEGIN SHOSHIN PRINT BASELINE — RUNTIME PAGINATION (PRINT WINDOW ONLY) */
/* (disabled) Baseline writer no longer injects a paginator. The real pipeline paginator runs in the REAL writer block. */
/* END SHOSHIN PRINT BASELINE — RUNTIME PAGINATION (PRINT WINDOW ONLY) */


    '</body></html>'
  );
  doc.close();



  // Keep the print tab URL stable for diagnostics/tools.
  // (Safe no-op if blocked by browser.)
  try { w.history.replaceState(null, "", "about:blank"); } catch(e) {}

  // Auto-print once paint is ready (WAIT for paginator/justify to finish)
  var fired = false;

  function fire(){
    if (fired) return;
    fired = true;
    try { w.focus(); } catch(e){}
    try { w.print(); } catch(e){}
  }

  function waitForPaginationThenFire(){
    if (fired) return;
    if (!w || w.closed) return;

    var tries = 0;
    var maxTries = 90;     // 90 * 30ms ≈ 2.7s
    var intervalMs = 30;

    (function tick(){
      if (fired) return;
      tries++;

      // If print window has finished paginate+justify, print now.
      // Expecting: w.__SHOSHIN_PAGINATION_DONE__ = { ts, pages, ... }
      try{
        if (w.__SHOSHIN_PAGINATION_DONE__) {
          fire();
          return;
        }
      }catch(e){}

      // Fail-safe: don't hang forever; print anyway.
      if (tries >= maxTries) {
        fire();
        return;
      }

      setTimeout(tick, intervalMs);
    })();
  }

  // Start the wait after the print window load event (lets CSS + DOM paint first)
  w.addEventListener("load", () => setTimeout(waitForPaginationThenFire, 25), { once:true });

  // Hard fallback: if load never fires, still attempt after a short delay
  setTimeout(waitForPaginationThenFire, 250);
}

/* =====================================================================
END SHOSHIN PRINT BASELINE REBUILD
===================================================================== */


function openPrintTabLayout1(rosterObj, mode, includeImages, includeQuickRef) {

  mode = String(mode || '').toLowerCase();
  if (mode !== 'consolidated' && mode !== 'comprehensive') mode = 'consolidated';

  var rosterEntryId = asInt(rosterObj.entryId || rosterObj.id || rosterObj.entry_id, 0);
  var rosterName = String(rosterObj.name || 'Roster');
  var rosterRef  = String(rosterObj.refId || '');

// [BASELINE REBUILD] Use dummy baseline HTML, but keep the REAL print window pipeline (single paginator system).
if (SHOSHIN_PRINT_BASELINE_REBUILD) {
  /* BEGIN SHOSHIN PRINT — BASELINE REBUILD ROUTE (V7) */
  openPrintTabDocument(
    "Shoshin — Print Baseline",
    getPrintBaselineCSS(),
    renderPrintBaselineHTML({
      rosterName: rosterName || "BASELINE TEST — SHOSHIN",
      rosterRef: rosterRef || "TEST-000",
      includeImages: !!includeImages
    })
  );
  return;
  /* END SHOSHIN PRINT — BASELINE REBUILD ROUTE (V7) */
}
var ownedIndex = buildOwnedAssetsIndex();
  var units = parseAssignedUnits(rosterObj);

  // Build totals from units (authoritative & stable)
  var totals = computeRosterTotalsFromUnits(units);

  // Master Class Abilities: prefer roster object field if it exists, otherwise DOM fallback
  var mca = 0;
  if (typeof rosterObj.masterClassAbilities !== 'undefined') mca = asInt(rosterObj.masterClassAbilities, 0);
  else if (typeof rosterObj.masterClassAvail !== 'undefined') mca = asInt(rosterObj.masterClassAvail, 0);
  else mca = readMasterClassAbilitiesFallback(rosterEntryId);

  // Group rows based on mode
  var grouped = (mode === 'consolidated') ? groupUnitsConsolidated(units) : expandUnitsComprehensive(units);

  // Build printable HTML body
  var html = renderPrintLayout1HTML({
    rosterName: rosterName,
    rosterRef: rosterRef,
    rosterIcon: String(rosterObj.icon || ''),
    totals: totals,
    masterClassAbilities: mca,
    mode: mode,
    includeImages: !!includeImages,
    grouped: grouped,
    ownedIndex: ownedIndex
  });

    /* BEGIN SHOSHIN PRINT — APPEND QUICK REFERENCE (LAYOUT1) */
if (!!includeQuickRef) {
  html += renderQuickReferenceLayout1HTML({
    rosterName: rosterName,
    rosterRef: rosterRef
  });
}
/* END SHOSHIN PRINT — APPEND QUICK REFERENCE (LAYOUT1) */


  var css = getPrintBaseCSS() + "\n" + getPrintLayout1CSS();


  // New tab writer
  var title = 'Shoshin Roster — ' + rosterName + (rosterRef ? ' (' + rosterRef + ')' : '');
  openPrintTabDocument(title, css, html);
}

/* =======================================================================
   [SHOSHIN] Layout #2 Stub (kept intentionally)
   - selectable in modal, still blocked from printing for now
   - next task will implement the actual one-page layout
======================================================================= */
function getPrintLayout2CSS() {
  return (
`/* =======================================================================
   [SHOSHIN] Layout #2 — Portrait • Table (Scaffold)
   - Portrait letter: 8.5" x 11"
   - Single page (no Layout1 pagination logic)
   - Background ONLY on Layout2 main page
   - Background obeys "Display Images?"
   - QR pages are handled separately (no background; enforced globally by Task 1)
======================================================================= */

@page { size: letter portrait; margin: 0; }
html, body { margin: 0; padding: 0; }

:root{
  --page-inset: 0.25in;
  --bg-port-url: url("/wp-content/uploads/2026/01/bgport50.webp");
}

/* SCREEN preview (print tab) — MUST mirror the print “page contract”
   so the runtime paginator can produce multiple visible pages instead of spillover. */
@media screen{
  .print-page.print-layout-2{
    display:flex;
    justify-content:center;
  }

  /* Portrait page width in the screen stack */
  .print-page.print-layout-2 .print-pages-wrap{
    width: 8.5in;
    margin: 0 auto;
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:24px; /* visible separation between pages in about:blank */
  }

  .print-page.print-layout-2 .print-frag{
    width: 8.5in;
    height: 11in;
    box-shadow: 0 2px 12px rgba(0,0,0,0.25);
    margin: 12px 0;
    overflow: hidden !important; /* CRITICAL: prevents “spill into gray void” */
    background-color: #fff;
    background-repeat: no-repeat;
    background-position: 0 0;
    background-size: 100% 100%;
  }

  .print-page.print-layout-2 .print-frag-inner{
    height: 100%;
    display:flex;
    flex-direction:column;
    padding: var(--page-inset);
  }

  .print-page.print-layout-2 .print-frag-body{
    flex: 1 1 auto;
    min-height: 0;
    display:flex;
    flex-direction:column;

    /* BEGIN SHOSHIN L2 — page bottom breathing room (match top feel) */
    padding-bottom: 0.12in;
    /* END SHOSHIN L2 — page bottom breathing room (match top feel) */
  }

}


/* PRINT contract (portrait single page) */
@media print{
  .print-page.print-layout-2 .print-frag{
    width: 8.5in;
    height: 11in;
    min-height: 11in;
    margin: 0;
    background-color: #fff;
    background-repeat: no-repeat;
    background-position: 0 0;
    background-size: 100% 100%;
    overflow: hidden !important;
  }

  .print-page.print-layout-2 .print-frag-inner{
    height: 100%;
    display:flex;
    flex-direction:column;
    padding: var(--page-inset);
  }

  .print-page.print-layout-2 .print-frag-body{
    flex: 1 1 auto;
    min-height: 0;
    display:flex;
    flex-direction:column;

    /* BEGIN SHOSHIN L2 — page bottom breathing room (match top feel) */
    padding-bottom: 0.12in;
    /* END SHOSHIN L2 — page bottom breathing room (match top feel) */
  }

}

/* Background behavior (Layout2 main page ONLY) */
.print-page.print-layout-2.print-images-on  .print-frag{ background-image: var(--bg-port-url); }
.print-page.print-layout-2.print-images-off .print-frag{ background-image: none !important; }

/* Layout2: when IMAGES=OFF remove divider atoms completely (not just the image) */
.print-page.print-layout-2.print-images-off .l2-divider-atom{
  display:none !important;
}


/* =======================================================================
   [SHOSHIN] Layout2 — Portrait Table Prototype Styles
   - Bucket labels reuse Layout1 .print-row2-group-title (NO thickness override)
   - The underline you referenced is the table header bottom border (2px)
   - QTY hidden in Comprehensive uses visibility (keeps column width)
======================================================================= */

/* =======================================================================
   Layout2 Header (RowA logo + centered roster name; RowB stat boxes centered)
======================================================================= */

.print-page.print-layout-2 .l2-header{
  width: 100%;
  padding: 0.06in 0 0.04in 0;
}

/* Row A: logo at top-left, roster name centered */
.print-page.print-layout-2 .l2-header-rowA{
  position: relative;
  min-height: 44px; /* keeps room for logo without pushing title */
}

.print-page.print-layout-2 .l2-header-logo{
  position: absolute;
  left: 0;
  top: 0;
  display:flex;
  align-items:flex-start;
}

.print-page.print-layout-2 .l2-header-logo img{
  height: 40px;     /* portrait-friendly */
  width: auto;
  display:block;
}

.print-page.print-layout-2 .l2-header-title{
  text-align: center;
  font-family: "Viner Hand ITC", "Viner Hand", cursive;
  font-weight: 400;
  font-size: 24px;
  padding-top: 4px; /* subtle optical align */
}

/* Row B: Layout1 stat boxes, centered */
.print-page.print-layout-2 .l2-header-rowB{
  display:flex;
  justify-content:center;
  align-items:flex-start;
  margin-top: 4px;
  padding: 6px 0;
}

/* ============================================================
   Layout2 Header RowB — scale down stat boxes (Layout1 parity, smaller)
============================================================ */

/* Tighten spacing between boxes */
.print-page.print-layout-2 .l2-header-rowB .print-header-boxes{
  gap: 6px;                  /* was wider in Layout1 */
  margin-left:64px
}

/* Reduce box padding */
.print-page.print-layout-2 .l2-header-rowB .print-hbox{
  padding: 4px 6px;          /* tighter box */
  min-width: 46px;           /* prevents collapse */
}

/* Reduce number size */
.print-page.print-layout-2 .l2-header-rowB .print-hbox-num{
  font-size: 14px;           /* Layout1 ~18px */
  line-height: 1.05;
}

/* Reduce label size */
.print-page.print-layout-2 .l2-header-rowB .print-hbox-label{
  font-size: 14px;            /* Layout1 ~11px */
  line-height: 1.05;
}


.print-page.print-layout-2 .l2-table-wrap{
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  display:flex;
  flex-direction:column;
}

.print-page.print-layout-2 table.l2-roster-table{
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-family: Arial, sans-serif;
  font-size: 9px;
}

.print-page.print-layout-2 table.l2-roster-table thead th{
  padding: 4px 4px;
  vertical-align: middle;
  text-align: center;
  white-space: nowrap;
}

.print-page.print-layout-2 table.l2-roster-table thead tr.l2-buckets th{
  padding-top: 2px;
  padding-bottom: 2px;
}

.print-page.print-layout-2 table.l2-roster-table thead tr.l2-cols th{
  border-bottom: 2px solid rgba(0,0,0,0.75); /* <-- your referenced underline */
  padding-top: 6px;
  padding-bottom: 6px;
}

.print-page.print-layout-2 table.l2-roster-table tbody td{
  padding: 3px 4px;
  vertical-align: top;
  overflow: hidden;
  text-overflow: ellipsis;

}

/* Zebra striping ONLY for unit line items */
.print-page.print-layout-2 table.l2-roster-table tbody tr.l2-unit.l2-even{
  background: rgba(0,0,0,0.06);
}

/* Unit-row REF ID styling (Layout2): right-aligned and top-aligned */
.print-page.print-layout-2 table.l2-roster-table td.l2-refcell{
  display: flex;                 /* explicit vertical control */
  align-items: flex-start;       /* <-- TOP aligned */
  justify-content: flex-end;     /* RIGHT aligned */
  padding-right: 12px;           /* buffer from QTY column */
  vertical-align: top;           /* keep table alignment consistent */
}

.print-page.print-layout-2 table.l2-roster-table td.l2-refcell .l2-reftext{
  /*max-width: 0.60in;*/
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  margin-right: 18px;             /* nudges left */
}


.print-page.print-layout-2 .l2-ref{
  text-align: left;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.print-page.print-layout-2 .l2-num{
  text-align: center;
}

.print-page.print-layout-2 .l2-mods{
  text-align: left;
  font-style: italic;
  font-weight: 500;      /* slightly heavier without going bold */
  line-height: 1.12;
  white-space: normal;
  padding-left: 6px;
  font-size: 8px;
}


/* MRBPA tokens: never wrap within a tag; wrap only between tags */
.print-page.print-layout-2 .l2-mods-inner{
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 2px 6px;            /* row gap / column gap */
}

.print-page.print-layout-2 .l2-modtag{
  white-space: nowrap;      /* <-- key: tag never breaks mid-string */
}


.print-page.print-layout-2 .l2-typehdr{
  font-family: "Viner Hand ITC", "Viner Hand", cursive;
  font-weight: 700;
  text-align:center;
}

.print-page.print-layout-2 .l2-mods-hdr{
  font-weight: 700;
}

.print-page.print-layout-2 .l2-thumb{
  width: 24px;
  height: 24px;
  object-fit: cover;
  border: 1px solid rgba(0,0,0,0.25);
  border-radius: 6px;
  display:block;
}

/* Group header left cell (thumb + title). Left aligned, vertically centered */
.print-page.print-layout-2 .l2-hdr-left{
  text-align: left;
  vertical-align: bottom;
  padding-left: 6px;
}
.print-page.print-layout-2 .l2-hdr-left .l2-hdr-flex{
  display:flex;
  align-items:flex-end; /* bottom align thumb + title/meta */
  gap:8px;
}

/* Larger title; meta matches DMG/CRT/etc sizing */
.print-page.print-layout-2 .l2-hdr-left .l2-hdr-title{
  font-weight: 700;
  line-height: 1.05;
  font-size: 9px;       /* larger than table’s 8px body */
  display:flex;
  align-items:flex-end;
  gap:4px;
}
.print-page.print-layout-2 .l2-hdr-left .l2-hdr-meta{
  font-style: italic;
  font-weight: 500;
  font-size: 8px;        /* matches your DMG/CRT/DIS header scale */
  line-height: 1;
  margin-left: 0;        /* gap handled by flex now */
}

/* Hide (QTY) only in consolidated mode (keep % always) */
.print-page.print-layout-2.print-mode-consolidated .l2-meta-qty{
  display:none;
}

.print-page.print-layout-2 .l2-hdr-left .l2-hdr-title{
  font-weight: 700;
  line-height: 1.05;
}
.print-page.print-layout-2 .l2-hdr-left .l2-hdr-meta{
  font-style: italic;
  font-weight: 500;
  margin-left: 6px;
}

/* Layout2 — keep Group Title + (Qty)(%) on ONE line (no stacking) */
.print-page.print-layout-2 .l2-hdr-left .l2-hdr-flex{
  flex-wrap: nowrap;
}

/* Layout2 — ellipsis ONLY the title text, never the meta */
.print-page.print-layout-2 .l2-hdr-left .l2-hdr-title{
  white-space: nowrap;
  overflow: visible;     /* do NOT clip children (meta) */
  min-width: 0;          /* allow flex shrink */
}

/* assumes markup: <span class="l2-hdr-label">TITLE</span><span class="l2-hdr-meta">...</span> */
.print-page.print-layout-2 .l2-hdr-left .l2-hdr-title .l2-hdr-label{
  display: inline-block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
}

.print-page.print-layout-2 .l2-hdr-left .l2-hdr-meta{
  position: relative;
  z-index: 5;
  white-space: nowrap;
  flex: 0 0 auto;
}


.print-page.print-layout-2 .l2-hdr-left .l2-hdr-meta{
  white-space: nowrap;
  flex: 0 0 auto;
}


/* If images are OFF, thumb collapses entirely and title shifts left */
.print-page.print-layout-2.print-images-off .l2-hdr-left .l2-thumb{
  display:none;
}

/* Bucket labels: same font-size as subcolumn headers; centered lines; tight side dashes */
.print-page.print-layout-2 table.l2-roster-table .print-row2-group-title{
  font-size: inherit;
  display: flex;
  align-items: center;        /* <-- this centers the before/after lines vertically */
  justify-content: center;
  gap: 2px;                   /* tight spacing (≈1 character) */
}


/* Header alignment: bottom-align bucket row and the rowspan headers */
.print-page.print-layout-2 table.l2-roster-table tr.l2-buckets th{
  vertical-align: bottom;
  padding-top: 6px;
  padding-bottom: 2px;
  text-transform: uppercase;
}

/* Bucket bottom padding: add space before divider */
.print-page.print-layout-2 table.l2-roster-table tbody tr.l2-unit + tr.l2-bucket-divider td{
  padding-top: 6px;    /* <-- bottom padding for bucket */
}

/* Bucket bottom padding when no divider follows (last bucket) */
.print-page.print-layout-2 table.l2-roster-table tbody tr.l2-unit:last-child td{
  padding-bottom: 4px;
}



.print-page.print-layout-2 table.l2-roster-table th.l2-qtyhdr,
.print-page.print-layout-2 table.l2-roster-table th.l2-tothdr{
  vertical-align: bottom;
}

/* Combat Modifiers (Row1 group title): behave like other group titles */
.print-page.print-layout-2 table.l2-roster-table th.l2-modshdr{
  vertical-align: bottom;
  text-align: center;
  padding-left: 0;
}

/* Combat Modifiers (Row2): centered keyline */
.print-page.print-layout-2 table.l2-roster-table th.l2-modskeyhdr{
  text-align: center;
  vertical-align: bottom;
  padding: 2px 6px;
}

.print-page.print-layout-2 table.l2-roster-table .l2-mods-keyline{
  white-space: nowrap;
  display: inline-block;

  font-size: 7px;        /* slightly smaller than 8px stat headers */
  font-weight: 500;     /* lighter than headers, heavier than body */
  letter-spacing: 0.02em;
}



/* Full-width underline under the header block (your reference underline).
   Apply to ALL header cells that visually sit on the bottom edge of the header area. */
.print-page.print-layout-2 table.l2-roster-table tr.l2-cols th{
  border-bottom: 1.5px solid rgba(0,0,0,0.75);
}
.print-page.print-layout-2 table.l2-roster-table th.l2-hdr-left,
.print-page.print-layout-2 table.l2-roster-table th.l2-qtyhdr,
.print-page.print-layout-2 table.l2-roster-table th.l2-tothdr{
  border-bottom: 1.5px solid rgba(0,0,0,0.75);
}

/* Layout2: Combat Modifiers top header has NO underline */
.print-page.print-layout-2 table.l2-roster-table th.l2-modshdr{
  border-bottom: none;
}

/* Layout2: Combat Modifiers title size = stat column headers */
.print-page.print-layout-2 table.l2-roster-table th.l2-modshdr{
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.04em;
}


/* QTY hiding rule (Comprehensive): keep column width AND keep zebra backgrounds.
   DO NOT use visibility:hidden because it hides the cell background too. */
.print-page.print-layout-2 table.l2-roster-table.l2-hide-qty th.l2-qty,
.print-page.print-layout-2 table.l2-roster-table.l2-hide-qty td.l2-qty{
  color: transparent;        /* hides text only */
  text-shadow: none !important;
}

/* Safety: if anything inside becomes a span later, keep it hidden too */
.print-page.print-layout-2 table.l2-roster-table.l2-hide-qty th.l2-qty *,
.print-page.print-layout-2 table.l2-roster-table.l2-hide-qty td.l2-qty *{
  color: transparent !important;
  text-shadow: none !important;
}

/* Divider between bucket/group blocks (inside the table). Honors Display Images toggle. */
.print-page.print-layout-2 tr.l2-bucket-divider td{
  padding: 0; /* do not spend height here */
}

/* Layout2 — add breathing room above divider (survives images OFF) */
.print-page.print-layout-2 .l2-bucket-atom{
  padding-bottom: 12px; /* adjust to taste: 10–16px is the safe range */
}


/* Layout2 divider atoms (between buckets) */
.print-page.print-layout-2 .l2-divider-atom{
  height: auto;              /* image height target */
  padding: 8px 0;
  display:flex;
  align-items:center;
  justify-content:center;
  margin: 0;
  padding: 6px 0;            /* 6px top/bottom padding (requested) */
}

.print-page.print-layout-2 .l2-divider-atom img{
  height: 12px !important;
  width: auto !important;
  display:block;
}

/* When images are OFF, remove divider rows entirely */
.print-page.print-layout-2.print-images-off tr.l2-bucket-divider{
  display: none;
}


/* Tighten all cell padding to remove the huge column gaps */
.print-page.print-layout-2 table.l2-roster-table th,
.print-page.print-layout-2 table.l2-roster-table td{
  padding: 2px 2px;
}


/* Slightly smaller table font for density */
.print-page.print-layout-2 table.l2-roster-table{
  font-size: 8px;
}



`
  );
}


function renderPrintLayout2HTML(ctx) {
  ctx = ctx || {};
  var mode = String(ctx.mode || '').toLowerCase();
  if (mode !== 'consolidated' && mode !== 'comprehensive') mode = 'consolidated';

  var onOff = (ctx.includeImages === false) ? 'off' : 'on';
  var grouped = Array.isArray(ctx.grouped) ? ctx.grouped : [];

  function esc(s) {
    s = String(s == null ? '' : s);
    return s.replace(/[&<>"']/g, function (ch) {
      return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[ch];
    });
  }

  function asNumOrToken(v) {
    if (v == null) return '--';
    var t = String(v).trim();
    if (!t) return '--';
    // abbreviations (locked)
    if (t.toLowerCase() === 'variable') return 'Var';
    if (t.toLowerCase() === 'highest') return 'High';
    if (t.toLowerCase() === 'captain') return 'Capt';
    return t;
  }

  function pick(u) {
    var stats = (u && typeof u === 'object' && u.stats && typeof u.stats === 'object') ? u.stats : null;
    for (var i = 1; i < arguments.length; i++) {
      var key = arguments[i];
      var v = (u && typeof u === 'object') ? u[key] : null;
      if (v != null && String(v).trim() !== '') return v;
      if (stats) {
        var sv = stats[key];
        if (sv != null && String(sv).trim() !== '') return sv;
      }
    }
    return null;
  }

  function normalizeAbsUrl(url) {
    url = String(url || '').trim();
    if (!url) return '';
    if (url.charAt(0) === '/') {
      try { url = window.location.origin + url; } catch (_) {}
    }
    return url;
  }

  function unitKind(u) {
    return String(u && (u.kind || u.unitKind) ? (u.kind || u.unitKind) : '').toLowerCase().trim();
  }

  // Build lookup maps by bucket (cls) for easy access
  var byBucket = Object.create(null);
  for (var i = 0; i < grouped.length; i++) {
    var b = grouped[i] || {};
    var bucketName = String(b.bucket || '').trim();
    if (!bucketName) continue;
    byBucket[bucketName] = Array.isArray(b.rows) ? b.rows : [];
  }

  // Locked bucket order (you provided) — unified table after Onmyoji
  var BUCKET_DEFS = [
    { name:'Daimyo',       isSupport:false },
    { name:'Samurai',      isSupport:false },
    { name:'Ashigaru',     isSupport:false },
    { name:'Sohei',        isSupport:false },
    { name:'Ninja',        isSupport:false },
    { name:'Onmyoji',      isSupport:false },
    { name:'Artillery',    isSupport:true  },
    { name:'Sailing Ships',isSupport:true  }
  ];


  function computeSectionTotals(rows, isComprehensive) {
    var out = { qty: 0, cost: 0 };
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r] || {};
      var u = row.sample || {};
      var qty = isComprehensive ? 1 : asInt(row.qty, 1);
      if (qty < 1) qty = 1;

      var cost = pick(u, 'cost','points','pt','pts');
      var unitCost = (isNumericLike(cost) ? asInt(cost, 0) : 0);

      out.qty += qty;
      out.cost += (unitCost * qty);
    }
    return out;
  }

  function pctOf(total, part) {
    total = asInt(total, 0);
    part  = asInt(part, 0);
    if (total <= 0 || part <= 0) return 0;
    return Math.round((part / total) * 100);
  }

function renderMods(row, sample) {
  sample = sample || {};
var unitEntryId =
  asInt(
    (sample && (
      sample.unitEntryId ||
      sample.unit_entry_id ||
      sample.entryId ||
      sample.entry_id ||
      sample.id
    )) ||
    (row && (
      row.unitEntryId ||
      row.unit_entry_id ||
      row.entryId ||
      row.entry_id ||
      row.id
    )) ||
    0,
    0
  );


  // Prefer ownedIndex (Layout1 precedent): modsBlock lives reliably there
  var assetForTags = null;
  try { assetForTags = (ctx && ctx.ownedIndex) ? ctx.ownedIndex[unitEntryId] : null; } catch(e) { assetForTags = null; }

  var modsBlock = '';
  if (assetForTags && assetForTags.modsBlock != null) modsBlock = String(assetForTags.modsBlock || '');
  else if (sample.modsBlock != null) modsBlock = String(sample.modsBlock || '');

  var lines = parseModsBlockToLines(modsBlock); // already capped upstream
  if (!lines || !lines.length) return '';

  // Token-wrap: tags never wrap within themselves.
  // We do NOT force 4-per-line anymore (that creates wasted whitespace).
  // Instead we let the container wrap naturally based on available width.
  var toks = lines.map(function(s){ return String(s).trim(); }).filter(Boolean);

var html = '<div class="l2-mods-inner">';
for (var i = 0; i < toks.length; i++) {
  var t = toks[i];
  var suffix = (i !== toks.length - 1) ? '; ' : '';

  // BEGIN SHOSHIN — DANGER TAGS IN RED (Layout1 parity)
  var vv = (t == null) ? '' : String(t);
  vv = vv.trim();

  var isDangerTag =
    (vv.indexOf('[M] Lucky Hits on 6 only') === 0) ||
    (vv.indexOf('[R] Lucky Hits on 6 only') === 0) ||
    (vv.indexOf('[B] May not attack in water') === 0) ||
    (vv.indexOf('[P] May not operate ship') === 0);

  var cls = 'l2-modtag' + (isDangerTag ? ' shoshin-red' : '');
  // END SHOSHIN — DANGER TAGS IN RED

  html += '<span class="' + cls + '">' + esc(vv + suffix) + '</span>';
}
html += '</div>';
return html;

}


 function renderGroupHeaderRows(groupLabel, totalsQty, pct, thumbUrl, isSupport) {
  var statsLabel = isSupport ? 'SUPPORT ASSET STATS' : 'CHARACTER STATS';

  // Left mega-cell spans both header rows; it contains THUMB + GROUP TITLE
var meta =
  '<span class="l2-hdr-meta">' +
    '<span class="l2-meta-qty">(' + esc(totalsQty) + ')</span> ' +
    '<span class="l2-meta-pct">(' + esc(pct) + '%)</span>' +
  '</span>';

  var thumb = (thumbUrl ? ('<img class="l2-thumb" src="' + esc(thumbUrl) + '" alt="" aria-hidden="true">') : '');

  var leftCell =
    '<th class="l2-hdr-left" rowspan="2">' +
      '<div class="l2-hdr-flex">' +
        thumb +
        '<div class="l2-hdr-title">' + esc(groupLabel) + meta + '</div>' +
      '</div>' +
    '</th>';

  // NOTE: QTY column always exists. In Comprehensive we hide via visibility (keeps whitespace).
  var qtyTh = '<th class="l2-qty l2-qtyhdr" rowspan="2">QTY</th>';
  var totTh = '<th class="l2-tothdr" rowspan="2">TOT</th>';

  var row1 =
    '<tr class="l2-buckets">' +
      leftCell +
      qtyTh +
      totTh +
      '<th colspan="3"><div class="print-row2-group-title">MELEE</div></th>' +
      '<th colspan="3"><div class="print-row2-group-title">RANGED</div></th>' +
      '<th colspan="6"><div class="print-row2-group-title">' + esc(statsLabel) + '</div></th>' +
      '<th class="l2-modshdr" colspan="1"><div class="print-row2-group-title">COMBAT MODIFIERS</div></th>' +

    '</tr>';

  function th(txt){ return '<th>' + txt + '</th>'; }

  var row2 =
    '<tr class="l2-cols">' +
      th('DMG') + th('CRT') + th('DIS') +
      th('DMG') + th('CRT') + th('DIS') +
      th('ATK') +
      th(isSupport ? 'RES' : 'DEF') +
      th('MOV') +
      th(isSupport ? 'TGH' : 'BOD') +
      th('LDR') +
      th('INI') +
      '<th class="l2-modskeyhdr"><div class="l2-mods-keyline">Key: <b>[M]</b> Melee &nbsp;&nbsp; <b>[R]</b> Ranged &nbsp;&nbsp; <b>[B]</b> Both &nbsp;&nbsp; <b>[P]</b> Passive &nbsp;&nbsp; <b>[A]</b> Action</div></th>' +
    '</tr>';


  return row1 + row2;
}


  function renderSectionHeaderRow(label, totalsQty, pct, thumbUrl) {
    var thumb = thumbUrl ? ('<img class="l2-thumb" src="' + esc(thumbUrl) + '" alt="" />') : '';
    return (
      '<tr class="l2-section">' +
        '<td class="l2-ref" colspan="1">' +
          '<div style="text-align:center;">' +
            thumb +
            '<div class="l2-typehdr">' + esc(label) + ' <span style="font-style:italic;font-weight:500;">(' + esc(totalsQty) + ') (' + esc(pct) + '%)</span></div>' +
          '</div>' +
        '</td>' +
        // fill rest of the row with empties to keep table structure stable
        '<td colspan="14"></td>' +
      '</tr>'
    );
  }

  /* BEGIN SHOSHIN — Layout2 CRT abbreviation helper */
function abbreviateCRT(v){
  if (v == null) return v;
  var s = String(v).trim();
  if (!s) return s;

  // Normalize case for comparison; output uses normal case
  var k = s.toLowerCase();
  if (k === 'poison') return 'Psn';
  if (k === 'bleed')  return 'Bld';
  if (k === 'stun')   return 'Stun';
  if (k === 'fear')   return 'Fear';
  if (k === 'burn')   return 'Burn';

  // Fallback: return original token (e.g., Var/Max/-- already handled elsewhere)
  return s;
}
/* END SHOSHIN — Layout2 CRT abbreviation helper */


function renderUnitRow(row, isSupport, isComprehensive, zebraClass) {

    var u = row.sample || {};
    var refId = String(u.refId || u.ref_id || row.refId || '').trim() || '—';

    var qty = isComprehensive ? 1 : asInt(row.qty, 1);
    if (qty < 1) qty = 1;

    var cost = pick(u, 'cost','points','pt','pts');
    var unitCost = (isNumericLike(cost) ? asInt(cost, 0) : 0);

    // TOT rule:
    // - Consolidated: base cost * qty
    // - Comprehensive: base cost (qty is 1 anyway)
    var tot = isComprehensive ? unitCost : (unitCost * qty);

    // Stats (token-safe)
    var mDmg = asNumOrToken(pick(u,'m_dmg','mDmg','meleeDmg'));
    var mDis = asNumOrToken(assignUnitsNormalizeQuotes(pick(u,'m_dis','mDis','meleeDis','meleeRange')));
    var mCrt = asNumOrToken(pick(u,'m_crt','mCrt','meleeCrt'));

    var rDmg = asNumOrToken(pick(u,'r_dmg','rDmg','rangedDmg'));
    var rCrt = asNumOrToken(pick(u,'r_crt','rCrt','rangedCrt'));

    /* BEGIN SHOSHIN — Layout2 CRT abbreviations */
mCrt = abbreviateCRT(mCrt);
rCrt = abbreviateCRT(rCrt);
/* END SHOSHIN — Layout2 CRT abbreviations */

    var rDis = asNumOrToken(assignUnitsNormalizeQuotes(pick(u,'r_dis','rDis','rangedDis','rangedRange')));

    var atk  = asNumOrToken(pick(u,'atk','attack'));
    var def  = asNumOrToken(pick(u,'def','defense'));
    var mov  = asNumOrToken(assignUnitsNormalizeQuotes(pick(u,'mov','move')));

    /* BEGIN SHOSHIN — Layout2 MOV inches suffix (Layout1 parity) */
mov = withInchesIfNumeric(mov);
/* END SHOSHIN — Layout2 MOV inches suffix (Layout1 parity) */

    var bod  = asNumOrToken(pick(u,'bod','body'));
    var ldr  = asNumOrToken(pick(u,'ldr','leadership'));
    var ini  = asNumOrToken(pick(u,'ini','initiative'));

    // Support substitutions + semantics
    if (isSupport) {
// Support assets: ATK and MOV are semantically N/A when stored as 0
if (String(atk) === '0') atk = '--';
if (String(mov) === '0') mov = '--';


      // "DEF->RES" and "BOD->TGH" are labels; values come from same keys by default
      // INI support rule: if top-level ini numeric 0, prefer stats.ini semantic token
      if (String(ini) === '0') {
        var statsIni = (u && u.stats && u.stats.ini != null) ? String(u.stats.ini).trim() : '';
        if (statsIni) ini = asNumOrToken(statsIni);
      }
    }

    // BEGIN SHOSHIN — Lucky tag detection (Layout1 parity: affects weapon stat cell color)
var _unitEntryId =
  asInt(
    (u && (u.unitEntryId || u.unit_entry_id || u.entryId || u.entry_id || u.id)) ||
    (row && (row.unitEntryId || row.unit_entry_id || row.entryId || row.entry_id || row.id)) ||
    0,
    0
  );

var _assetForTags = null;
try{ _assetForTags = (ctx && ctx.ownedIndex) ? ctx.ownedIndex[_unitEntryId] : null; }catch(e){ _assetForTags = null; }

var _mods = '';
if (_assetForTags && _assetForTags.modsBlock != null) _mods = String(_assetForTags.modsBlock || '');
else if (u && u.modsBlock != null) _mods = String(u.modsBlock || '');

var _tagText = '';
try{ _tagText = parseModsBlockToLines(_mods).join('\n'); }catch(e){ _tagText = ''; }

var _hasMLucky = /\[M\]/.test(_tagText) && /Lucky Hits on 6 only/.test(_tagText);
var _hasRLucky = /\[R\]/.test(_tagText) && /Lucky Hits on 6 only/.test(_tagText);
// END SHOSHIN — Lucky tag detection


var modsHtml = renderMods(row, u);
    return (
'<tr class="l2-unit ' + esc(zebraClass || '') + '">' +

'<td class="l2-refcell"><span class="l2-reftext">' + esc(refId) + '</span></td>' +

        '<td class="l2-num l2-qty">' + esc(qty) + '</td>' +
        '<td class="l2-num">' + esc(tot) + '</td>' +

'<td class="l2-num' + (_hasMLucky ? ' shoshin-red' : '') + '">' + esc(mDmg) + '</td>' +
'<td class="l2-num' + (_hasMLucky ? ' shoshin-red' : '') + '">' + esc(mCrt) + '</td>' +
'<td class="l2-num' + (_hasMLucky ? ' shoshin-red' : '') + '">' + esc(mDis) + '</td>' +


'<td class="l2-num' + (_hasRLucky ? ' shoshin-red' : '') + '">' + esc(rDmg) + '</td>' +
'<td class="l2-num' + (_hasRLucky ? ' shoshin-red' : '') + '">' + esc(rCrt) + '</td>' +
'<td class="l2-num' + (_hasRLucky ? ' shoshin-red' : '') + '">' + esc(rDis) + '</td>' +


        '<td class="l2-num">' + esc(atk) + '</td>' +
        '<td class="l2-num">' + esc(def) + '</td>' +
        '<td class="l2-num">' + esc(mov) + '</td>' +
        '<td class="l2-num">' + esc(bod) + '</td>' +
        '<td class="l2-num">' + esc(ldr) + '</td>' +
        '<td class="l2-num">' + esc(ini) + '</td>' +

        '<td class="l2-mods">' + (modsHtml || '') + '</td>' +
      '</tr>'
    );
  }

  function renderUnifiedTable(bucketDefs) {
    var isComprehensive = (mode === 'comprehensive');
    var clanPoints = asInt(ctx.totals && ctx.totals.points, 0);

    var tblClass = 'l2-roster-table' + (isComprehensive ? ' l2-hide-qty' : '');

    var html = '';
    html += '<div class="l2-table-block">';
    html += '<table class="' + tblClass + '">';

    // Fixed column widths to keep numeric columns at ~2–3 chars max.
    // (Thumb+Title) | QTY | TOT | 12 stat cols | Mods
    html += '<colgroup>' +
      '<col style="width:1.35in;">' +   // Thumb + Group Title (collapses image internally when images off)
      '<col style="width:0.30in;">' +   // QTY
      '<col style="width:0.42in;">' +   // TOT
      '<col style="width:0.26in;">'.repeat(12) + // DMG/DIS/CRT x2 + ATK/DEF/RES/MOV/BOD/TGH/LDR/INI
      '<col style="width:auto;">' +     // Combat Modifiers (takes remaining width)
    '</colgroup>';

    html += '<tbody>';
    var zebra = 0; // counts ONLY unit rows (across ALL buckets)

    function nextNonEmptyBucketIndex(startIdx) {
      for (var j = startIdx; j < bucketDefs.length; j++) {
        var def = bucketDefs[j] || {};
        var nm = String(def.name || '').trim();
        if (!nm) continue;
        var rr = byBucket[nm] || [];
        if (rr.length) return j;
      }
      return -1;
    }

    function renderBucketDividerRow(dividerSrc) {
      return (
        '<tr class="l2-bucket-divider">' +
          '<td colspan="16">' +
            '<div class="l2-between-buckets">' +
              '<img src="' + esc(dividerSrc) + '" alt="" aria-hidden="true" />' +
            '</div>' +
          '</td>' +
        '</tr>'
      );
    }

    for (var bi = 0; bi < bucketDefs.length; bi++) {
      var def = bucketDefs[bi] || {};
      var bucketName = String(def.name || '').trim();
      if (!bucketName) continue;

      var isSupport = !!def.isSupport;

      var rows = byBucket[bucketName] || [];
      if (!rows.length) continue;

      // Section totals
      var secTotals = computeSectionTotals(rows, isComprehensive);
      var secPct = pctOf(clanPoints, secTotals.cost);

      // Thumbnail for section (use first row sample img if present)
      var sample0 = rows[0] && rows[0].sample ? rows[0].sample : {};
      var thumbUrl = String(sample0.img || sample0.image || sample0.imgUrl || '').trim();
      if (!thumbUrl) thumbUrl = '';

      html += renderGroupHeaderRows(bucketName, secTotals.qty, secPct, thumbUrl, isSupport);

      for (var ri = 0; ri < rows.length; ri++) {
        zebra++;
        var zc = (zebra % 2 === 0) ? 'l2-even' : 'l2-odd';
        html += renderUnitRow(rows[ri], isSupport, isComprehensive, zc);
      }

      // Divider between bucket blocks if another non-empty bucket exists
      var nextIdx = nextNonEmptyBucketIndex(bi + 1);
      if (nextIdx !== -1) {
        html += renderBucketDividerRow(dividerSrc);
      }
    }

    html += '</tbody></table></div>';
    return html;


  }

  /* BEGIN SHOSHIN — Layout2 atoms renderer (correct scope) */
function renderLayout2Atoms(bucketDefs) {
  var isComprehensive = (mode === 'comprehensive');
  var clanPoints = asInt(ctx.totals && ctx.totals.points, 0);

  var dividerSrc = normalizeAbsUrl('/wp-content/uploads/2026/01/divider.png');

    // Bucket % must sum to 100 across ALL rendered buckets (avoid rounding drift)
  var bucketPctMap = Object.create(null);

  // 1) Collect costs for non-empty buckets
  var _bCosts = [];
  var _bTotal = 0;

  for (var _bi = 0; _bi < bucketDefs.length; _bi++) {
    var _def = bucketDefs[_bi] || {};
    var _name = String(_def.name || '').trim();
    if (!_name) continue;

    var _rows = byBucket[_name] || [];
    if (!_rows.length) continue;

    var _tot = computeSectionTotals(_rows, isComprehensive);
    var _cost = asInt(_tot.cost, 0);
    if (_cost < 0) _cost = 0;

    _bCosts.push({ name: _name, cost: _cost, idx: _bi });
    _bTotal += _cost;
  }

  // 2) Largest remainder allocation to force sum = 100
  if (_bTotal > 0 && _bCosts.length) {
    var _baseSum = 0;

    for (var _i = 0; _i < _bCosts.length; _i++) {
      var _x = (_bCosts[_i].cost / _bTotal) * 100;
      var _floor = Math.floor(_x);
      _bCosts[_i].base = _floor;
      _bCosts[_i].rem  = (_x - _floor);
      _baseSum += _floor;
    }

    var _need = 100 - _baseSum;
    if (_need < 0) _need = 0;

    _bCosts.sort(function(a,b){
      // remainder desc, then bucket order asc (deterministic)
      if (b.rem !== a.rem) return (b.rem - a.rem);
      return (a.idx - b.idx);
    });

    for (var _k = 0; _k < _bCosts.length; _k++) {
      var _add = (_k < _need) ? 1 : 0;
      bucketPctMap[_bCosts[_k].name] = _bCosts[_k].base + _add;
    }

    // restore original order not required; map lookup only
  }


  function hasRows(bucketName){
    var rr = byBucket[bucketName] || [];
    return !!rr.length;
  }

  function nextNonEmptyIdx(start) {
    for (var j = start; j < bucketDefs.length; j++) {
      var d = bucketDefs[j] || {};
      var nm = String(d.name || '').trim();
      if (!nm) continue;
      if (hasRows(nm)) return j;
    }
    return -1;
  }

  function renderDividerAtom() {
    return (
      '<div class="shoshin-divider-row l2-divider-atom" aria-hidden="true">' +
        '<img src="' + esc(dividerSrc) + '" alt="" />' +
      '</div>'
    );
  }

  function renderBucketAtom(bucketName, isSupport, zebraStart) {
    var rows = byBucket[bucketName] || [];
    if (!rows.length) return { html:'', zebra:zebraStart };

    var secTotals = computeSectionTotals(rows, isComprehensive);
var secPct = (bucketPctMap && bucketPctMap[bucketName] != null)
  ? asInt(bucketPctMap[bucketName], 0)
  : pctOf(clanPoints, secTotals.cost);


    var sample0 = rows[0] && rows[0].sample ? rows[0].sample : {};
    var thumbUrl = String(sample0.img || sample0.image || sample0.imgUrl || '').trim();

    var tblClass = 'l2-roster-table' + (isComprehensive ? ' l2-hide-qty' : '');

    var zebra = zebraStart;
    var html = '';

    html += '<div class="print-unit-group l2-bucket-atom">';
    html += '<table class="' + tblClass + '">';

    // Keep existing colgroup widths
    html += '<colgroup>' +
      '<col style="width:1.35in;">' +
      '<col style="width:0.30in;">' +
      '<col style="width:0.42in;">' +
      '<col style="width:0.26in;">'.repeat(12) +
      '<col style="width:auto;">' +
    '</colgroup>';

    html += '<tbody>';
    html += renderGroupHeaderRows(bucketName, secTotals.qty, secPct, thumbUrl, isSupport);

    for (var ri = 0; ri < rows.length; ri++) {
      zebra++;
      var zc = (zebra % 2 === 0) ? 'l2-even' : 'l2-odd';
      html += renderUnitRow(rows[ri], isSupport, isComprehensive, zc);
    }

    html += '</tbody></table>';
    html += '</div>';

    return { html: html, zebra: zebra };
  }

  var html = '';
  var zebra = 0;

  for (var bi = 0; bi < bucketDefs.length; bi++) {
    var def = bucketDefs[bi] || {};
    var bucketName = String(def.name || '').trim();
    if (!bucketName) continue;
    if (!hasRows(bucketName)) continue;

    var out = renderBucketAtom(bucketName, !!def.isSupport, zebra);
    zebra = out.zebra;
    html += out.html;

    // divider between buckets only
    if (nextNonEmptyIdx(bi + 1) !== -1) {
      html += renderDividerAtom();
    }
  }

  return html;
}
/* END SHOSHIN — Layout2 atoms renderer (correct scope) */


  var dividerSrc = normalizeAbsUrl('/wp-content/uploads/2026/01/divider.png');

  // Layout2 Header:
  // RowA: logo top-left + roster name centered (24px Viner Hand)
  // RowB: Layout1 stat boxes centered + add MC Abilities as box #2
  var headerHtml =
    '<div class="l2-header">' +

      '<div class="l2-header-rowA">' +
        '<div class="l2-header-logo">' +
          '<img class="print-logo site-logo" src="/wp-content/uploads/2025/11/Header_logo_300x150_1.png" alt="Shoshin" />' +
        '</div>' +
        '<div class="l2-header-title">' + esc(ctx.rosterName || 'ROSTER') + '</div>' +
      '</div>' +

      '<div class="l2-header-rowB">' +
        '<div class="print-header-boxes">' +

          '<div class="print-hbox">' +
            '<div class="print-hbox-num">' + esc(asInt(ctx.totals && ctx.totals.points, 0)) + '</div>' +
            '<div class="print-hbox-label">Clan Points</div>' +
          '</div>' +

          '<div class="print-hbox">' +
            '<div class="print-hbox-num">' + esc(asInt(ctx.masterClassAbilities, 0)) + '</div>' +
            '<div class="print-hbox-label">MC Abilities</div>' +
          '</div>' +

          '<div class="print-hbox">' +
            '<div class="print-hbox-num">' + esc(asInt(ctx.totals && ctx.totals.ini, 0)) + '</div>' +
            '<div class="print-hbox-label">Initiative</div>' +
          '</div>' +

          '<div class="print-hbox">' +
            '<div class="print-hbox-num">' + esc(asInt(ctx.totals && ctx.totals.honor, 0)) + '</div>' +
            '<div class="print-hbox-label">Honor (XP)</div>' +
          '</div>' +

        '</div>' +
      '</div>' +

    '</div>';


var atomsHtml = renderLayout2Atoms(BUCKET_DEFS);

return (
  '<div class="print-page print-layout-2 print-mode-' + esc(mode) + ' print-images-' + onOff + '" data-print-layout="layout2-main">' +
      '<div class="print-pages-wrap">' +
        '<div class="print-frag">' +
          '<div class="print-frag-inner">' +

            headerHtml +


'<div class="print-frag-body">' +
  atomsHtml +
'</div>' +


          '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}


function openPrintTabLayout2(rosterObj, mode, includeImages, includeQuickRef) {
  // Layout2 — portrait, single page, table-driven. Uses Layout1 wiring for values.
  mode = String(mode || '').toLowerCase();
  if (mode !== 'consolidated' && mode !== 'comprehensive') mode = 'consolidated';

  var rosterName = String(rosterObj && rosterObj.name ? rosterObj.name : 'Roster');
  var rosterRef  = String(rosterObj && rosterObj.refId ? rosterObj.refId : '');
  var rosterEntryId = asInt(rosterObj && (rosterObj.entryId || rosterObj.id || rosterObj.entry_id), 0);

  var units = parseAssignedUnits(rosterObj);
  var totals = computeRosterTotalsFromUnits(units);

  // Master Class Abilities parity with Layout1
  var mca = 0;
  if (typeof rosterObj.masterClassAbilities !== 'undefined') mca = asInt(rosterObj.masterClassAbilities, 0);
  else if (typeof rosterObj.masterClassAvail !== 'undefined') mca = asInt(rosterObj.masterClassAvail, 0);
  else mca = readMasterClassAbilitiesFallback(rosterEntryId);

  // Mode grouping (same source as Layout1; Layout2 will render differently)
  var grouped = (mode === 'consolidated') ? groupUnitsConsolidated(units) : expandUnitsComprehensive(units);

    var ownedIndex = buildOwnedAssetsIndex();


  var html = renderPrintLayout2HTML({
    rosterName: rosterName,
    rosterRef: rosterRef,
    ownedIndex: ownedIndex,
    totals: totals,
    masterClassAbilities: mca,
    mode: mode,
    includeImages: !!includeImages,
    grouped: grouped
  });

  /* BEGIN SHOSHIN PRINT — APPEND QUICK REFERENCE (LAYOUT2) */
  if (!!includeQuickRef) {
    html += renderQuickReferenceLayout2HTML({
      rosterName: rosterName,
      rosterRef: rosterRef
    });
  }
  /* END SHOSHIN PRINT — APPEND QUICK REFERENCE (LAYOUT2) */

  // IMPORTANT: inherit Layout1 signed-off styling + add Layout2 portrait/table overrides last
  var css = getPrintBaseCSS() + "\n" + getPrintLayout1CSS() + "\n" + getPrintLayout2CSS();

  var title = 'Shoshin Roster — ' + rosterName + (rosterRef ? ' (' + rosterRef + ')' : '') + ' — Layout2';
  openPrintTabDocument(title, css, html);
}

// BEGIN SHOSHIN PRINT — OPEN PRINT TAB DOCUMENT (reliable new-tab print)
function openPrintTabDocument(title, cssText, bodyHtml) {
// BEGIN SHOSHIN PRINT WINDOW OPEN (OPTION B SAFE)
// Popup-blocker friendly: do NOT pass a features string.
// This reduces "window.open => null" and about:blank white screens.
var w = window.open('about:blank', '_blank');
try { w.opener = null; } catch(e) {}
// END SHOSHIN PRINT WINDOW OPEN (OPTION B SAFE)



/* BEGIN SHOSHIN PRINT — HARD STOP ON POPUP BLOCK (NO FALLBACK) */
if (!w) {
  try { console.warn('[SHOSHIN PRINT] Popup blocked — aborting (no fallback).'); } catch(e) {}
  try { alert('Popup blocked. Please allow popups for this site to print.'); } catch(e) {}
  return null;
}
/* END SHOSHIN PRINT — HARD STOP ON POPUP BLOCK (NO FALLBACK) */



  // Escape helper (safe fallback)
  var esc = (typeof escapeHtmlForPrintTitle === 'function')
    ? escapeHtmlForPrintTitle
    : function (s) {
        s = String(s == null ? '' : s);
        return s.replace(/[&<>"']/g, function (ch) {
          return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[ch];
        });
      };
  // Favicon injection (single mechanism: clone icon-like <link> tags from opener)
  var faviconLinksHTML = '';
  try {
    faviconLinksHTML = (typeof getSiteFaviconLinksHTML === 'function') ? String(getSiteFaviconLinksHTML() || '') : '';
  } catch (e) { faviconLinksHTML = ''; }



/* =======================================================================
   [SHOSHIN] PRINT CSS (baseline-only)
   - PRINT_CONTRACT_CSS: "never change" structural rules for print stability
   - EXTRA_PRINT_CSS is now contract-only (baseline is authoritative)
======================================================================= */
var PRINT_CONTRACT_CSS =
`/* Contract CSS — keep minimal and deterministic */
.print-page{ position:relative; }
.print-frag{ box-sizing:border-box; }
.print-frag-inner{ box-sizing:border-box; }
.print-frag-body{ display:flex; flex-direction:column; }
`;

var EXTRA_PRINT_CSS = PRINT_CONTRACT_CSS;




// BEGIN PRINT JUSTIFY — MIN GAP THRESHOLD
var PRINT_JUSTIFY_MIN_GAP_PX = 12; // if computed gap would be smaller, don't justify that page
var PRINT_JUSTIFY_MAX_GAP_PX = 0; // safety cap to prevent absurd gaps on sparse pages (raise if you want fuller fill)
// END PRINT JUSTIFY — MIN GAP THRESHOLD

  var didPrint = false;

  function tryPrintNow() {
    if (didPrint) return;
    didPrint = true;
    try { w.focus(); } catch (_) {}
    try { w.print(); } catch (_) {}
  }

  function tryPrintWhenReady() {
    if (didPrint) return;

    // Wait for all images in the print window (Images ON mode)
    try {
      var imgs = w.document && w.document.images ? w.document.images : [];
      for (var i = 0; i < imgs.length; i++) {
        if (!imgs[i].complete) {
          setTimeout(tryPrintWhenReady, 120);
          return;
        }
      }
    } catch (_) {}

/* BEGIN SHOSHIN PRINT — TASK 11: LEGACY PAGINATOR DISABLED (DETERMINISTIC PAGINATOR OWNS PRINT) */
// Intentionally disabled: legacy paginateAndSpaceEvenly() caused regressions and conflicts.
/* END SHOSHIN PRINT — TASK 11: LEGACY PAGINATOR DISABLED (DETERMINISTIC PAGINATOR OWNS PRINT) */

    setTimeout(tryPrintNow, 60);
  }

  w.addEventListener('load', function () {
    setTimeout(tryPrintWhenReady, 120);
  });
  setTimeout(tryPrintWhenReady, 120);

  var doc = w.document;
  doc.open();
  doc.write(
    '<!doctype html>' +
    '<html>' +
      '<head>' +
        '<meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<title>' + esc(title) + '</title>' +
        faviconLinksHTML +
        '<style>' + (cssText || '') + EXTRA_PRINT_CSS + '</style>' +
      '</head>' +
/* BEGIN SHOSHIN PRINT — BODY WRITE WITH PAGINATION (REAL PIPELINE) */
'<body>' +
  (bodyHtml || '') +

  /* BEGIN SHOSHIN PRINT — RUNTIME PAGINATION (REAL PRINT WINDOW ONLY) */
  '<script>(function(){' +
    'function q(sel,root){ return (root||document).querySelector(sel); }' +
    'function rectH(el){ return el ? el.getBoundingClientRect().height : 0; }' +
'function cssNum(el, prop){ if(!el) return 0; var v=getComputedStyle(el).getPropertyValue(prop); var n=parseFloat(v); return isFinite(n)?n:0; }' +
'function setStage(s){}' +


    // Divider detection: ONLY actual divider atoms (prevents wrapper misclassification)
    /* BEGIN SHOSHIN PRINT — DIVIDER DETECTION (ATOM-ONLY) */
'function isDivider(node){' +
  'if(!node || node.nodeType!==1) return false;' +
  // Layout2: only treat explicit divider atoms as dividers
  'if(node.classList && node.classList.contains("l2-divider-atom")) return true;' +
  // Keep legacy marker in case older L2 divider class remains
  'if(node.classList && node.classList.contains("print-divider-group")) return true;' +
  'return false;' +
'}' +

    /* END SHOSHIN PRINT — DIVIDER DETECTION (ATOM-ONLY) */


    'function buildFragFromTemplate(tpl, pageIndex){' +
      'var frag = tpl.cloneNode(true);' +
      'var body = q(".print-frag-body", frag);' +
      'if(body){ body.innerHTML=""; }' +
      'if(pageIndex>0){' +
        'var hdr = q(".print-header", frag);' +
        'if(hdr && hdr.parentNode) hdr.parentNode.removeChild(hdr);' +
      '}' +
      'return frag;' +
    '}' +

/* BEGIN SHOSHIN PRINT — AVAIL HEIGHT (PAGE CONTRACT, PPI-BASED FALLBACK) */
'function measurePPI(){' +
  'var ppi=96;' +
  'try{' +
    'var m=document.createElement("div");' +
    'm.style.cssText="position:absolute;left:-9999px;top:0;width:1in;height:1in;";' +
    'document.body.appendChild(m);' +
    'var r=m.getBoundingClientRect();' +
    'if(r && r.height) ppi=r.height;' +
    'm.parentNode.removeChild(m);' +
  '}catch(e){}' +
  'return ppi;' +
'}' +
'var __PAGE_H_IN = 8.5;' +
'var __PAGE_H_PX = measurePPI() * __PAGE_H_IN;' +
'function getAvailPx(templateFrag, pageIndex){' +
'var __mode = "unknown";' +
'var __geom = 0;' +

  // Primary (deterministic): compute usable height from actual DOM geometry:
  // avail = frag.bottom - body.top - body paddings
  'var bodyEl = q(".print-frag-body", templateFrag);' +
  'var padTop = bodyEl ? cssNum(bodyEl,"padding-top") : 0;' +
  'var padBot = bodyEl ? cssNum(bodyEl,"padding-bottom") : 0;' +

  'var avail = 0;' +
  'try{' +
    'var fr = (templateFrag && templateFrag.getBoundingClientRect) ? templateFrag.getBoundingClientRect() : null;' +
    'var br = (bodyEl && bodyEl.getBoundingClientRect) ? bodyEl.getBoundingClientRect() : null;' +
    'if(fr && br && isFinite(fr.bottom) && isFinite(br.top)){' +
      'avail = (fr.bottom - br.top) - padTop - padBot;' +
      '__mode = "geom"; __geom = avail;' +

    '}' +
  '}catch(e){ avail = 0; }' +

  // Fallback: PPI-based contract height (only if geometry is unavailable)
  'if(!avail || avail < 200){' +
    'var fragH = rectH(templateFrag);' +
    'if(!fragH || fragH < 400){ fragH = __PAGE_H_PX; }' +
    // If we can't use geometry, subtract header via selector that matches both variants
    'var header = q(".print-header, .print-frag-header", templateFrag);' +
    'var headerH = (pageIndex===0 && header) ? rectH(header) : 0;' +
    'avail = fragH - headerH - padTop - padBot;' +
    '__mode = "fallback";' +

  '}' +

'' +

  'return Math.max(0, avail);' +
'}' +

'' +

/* END SHOSHIN PRINT — AVAIL HEIGHT (PAGE CONTRACT, PPI-BASED FALLBACK) */


    'function paginate(){' +
      'setStage("enter_paginate");' +
      'var wrap = q(".print-pages-wrap");' +
      'if(!wrap){ setStage("no_wrap"); return; }' +

      // Idempotent guard (prevents double-pagination from load+beforeprint)
      /* BEGIN SHOSHIN PRINT — IDEMPOTENT PAGINATION (V7) */
'if(window.__SHOSHIN_PAGINATION_RUNNING__){ setStage("already_running"); return; }' +
'window.__SHOSHIN_PAGINATION_RUNNING__ = true;' +
// NOTE: We intentionally DO NOT early-return on data-shoshin-paginated.
// We always rebuild from the current atoms so load/beforeprint can be re-run safely.
/* END SHOSHIN PRINT — IDEMPOTENT PAGINATION (V7) */

      'var firstFrag = q(".print-frag", wrap);' +
      'if(!firstFrag){ setStage("no_first_frag"); return; }' +
 'var firstBody = q(".print-frag-body", firstFrag);' +
'if(!firstBody){ setStage("no_first_body"); return; }' +

/* BEGIN SHOSHIN PRINT — COLLECT ATOMS FROM ALL FRAGS (PREVENT LOST UNITS) */
'var bodies = Array.prototype.slice.call(wrap.querySelectorAll(".print-frag .print-frag-body") || []);' +
'if(!bodies.length) bodies = [firstBody];' +

'function pushAtomListFrom(containerEl){' +
  'if(!containerEl) return;' +
  'var kids = Array.prototype.slice.call(containerEl.children || []);' +
  'for(var ki=0; ki<kids.length; ki++){' +
    'var el = kids[ki];' +
    'if(!el || el.nodeType !== 1) continue;' +

    // IMPORTANT: if someone accidentally nested a .print-frag-body inside the body,
    // flatten it so we paginate the real atoms inside (buckets, dividers, etc.)
    'if(el.classList && el.classList.contains("print-frag-body")){' +
      'pushAtomListFrom(el);' +
      'continue;' +
    '}' +

    'atoms.push(el);' +
  '}' +
'}' +

'var atoms = [];' +
'for(var bi=0; bi<bodies.length; bi++){' +
  'pushAtomListFrom(bodies[bi]);' +
'}' +

'if(!atoms.length){ setStage("no_atoms"); return; }' +

// CRITICAL: pre-measure atom heights WHILE still in the DOM (before wrap.innerHTML="")
'var atomH = new Array(atoms.length);' +
'for(var hi=0; hi<atoms.length; hi++){' +
  'var h = rectH(atoms[hi]);' +
  'atomH[hi] = (h && isFinite(h) && h > 0) ? h : 0;' +
'}' +
'' +

/* END SHOSHIN PRINT — COLLECT ATOMS FROM ALL FRAGS (PREVENT LOST UNITS) */


      'wrap.innerHTML = "";' +

      'var pageIndex = 0;' +
      'var frag = buildFragFromTemplate(firstFrag, pageIndex);' +
      'wrap.appendChild(frag);' +
      'var body = q(".print-frag-body", frag);' +
/* BEGIN SHOSHIN PRINT — AVAIL FROM IN-DOM FRAG (V7) */
'var avail = getAvailPx(frag, pageIndex);' +
/* END SHOSHIN PRINT — AVAIL FROM IN-DOM FRAG (V7) */

      'var used = 0;' +
      'var countOnPage = 0;' +

      'function startNewPage(){' +
        'pageIndex++;' +
        'frag = buildFragFromTemplate(firstFrag, pageIndex);' +
        'wrap.appendChild(frag);' +
        'body = q(".print-frag-body", frag);' +
/* BEGIN SHOSHIN PRINT — AVAIL FROM IN-DOM FRAG (V7) */
'avail = getAvailPx(frag, pageIndex);' +
/* END SHOSHIN PRINT — AVAIL FROM IN-DOM FRAG (V7) */


        'used = 0;' +
        'countOnPage = 0;' +
      '}' +

      /* BEGIN SHOSHIN PRINT — STRIP TRAILING DIVIDER BEFORE PAGE BREAK */
'function stripTrailingDividerIfAny(){' +
  'try{' +
    'var last = (body && body.lastElementChild) ? body.lastElementChild : null;' +
    'if(last && isDivider(last)){' +
      'body.removeChild(last);' +
      // NOTE: we do NOT recompute used/countOnPage because we only call this immediately before startNewPage()
    '}' +
  '}catch(e){}' +
'}' +
/* END SHOSHIN PRINT — STRIP TRAILING DIVIDER BEFORE PAGE BREAK */


/* BEGIN SHOSHIN PRINT — APPEND ATOM (HEIGHT-CONSISTENT) */
/* NOTE: Flex column gap is NOT included in atom rect heights.
         We must add it into `used` so pagination matches the actual stacked layout. */
'var GAP_PX = 0;' +
'function getGapPx(){' +
  'try{' +
    'if(!body) return 0;' +
'var st = window.getComputedStyle(body);' +

    'var g = (st && st.rowGap && st.rowGap !== "normal") ? st.rowGap : ((st && st.gap && st.gap !== "normal") ? st.gap : "0px");' +
    'var n = parseFloat(g);' +
    'return (isFinite(n) && n > 0) ? n : 0;' +
  '}catch(e){ return 0; }' +
'}' +

'function appendAtom(node, h){' +
  // lazily resolve gap once we have a body
  'if(!GAP_PX) GAP_PX = getGapPx();' +

  // account for flex gap BETWEEN atoms
  'if(countOnPage > 0 && GAP_PX){ used += GAP_PX; }' +

  'body.appendChild(node);' +
  'used += (h && isFinite(h) && h > 0) ? h : rectH(node);' +
  'countOnPage++;' +
'}' +
/* END SHOSHIN PRINT — APPEND ATOM (HEIGHT-CONSISTENT) */

// NOTE: Do not repaginate on beforeprint if already paginated successfully.
// Closing/opening print dialogs changes layout metrics and can cause UU adjacency if repacked.


/* BEGIN SHOSHIN PRINT — BONDED DIVIDER+UNIT PACKING (REPLACED BY L2 SEGMENT MODEL) */



'var __IS_L2__ = !!document.querySelector(".print-page.print-layout-2");' +
'if(__IS_L2__){(function(){' +


/* BEGIN SHOSHIN PRINT — PROJECTION FIT (GAP-AWARE, L2-ONLY) */
'function projWillFit(addHeights, usedNow, countNow, availNow){' +
  'var u=usedNow; var c=countNow; var g=GAP_PX||0;' +
  'for(var ai=0; ai<addHeights.length; ai++){' +
    'var h = addHeights[ai] || 0;' +
    'if(c>0 && g){ u += g; }' +
    'u += h; c++;' +
  '}' +
  'return u <= availNow;' +
'}' +
/* END SHOSHIN PRINT — PROJECTION FIT (GAP-AWARE, L2-ONLY) */


  // ------------------------------------------------------------
  // L2: Build a divider template (if images ON) and remove all divider atoms
  // ------------------------------------------------------------
  'var __DIV_TPL__ = null;' +
  'try{' +
    'for(var di=0; di<atoms.length; di++){' +
      'if(atoms[di] && isDivider(atoms[di])){ __DIV_TPL__ = atoms[di].cloneNode(true); break; }' +
    '}' +
  '}catch(e){}' +

  // strip divider atoms from stream; we will synthesize dividers as preludes
  'try{' +
    'for(var di2=atoms.length-1; di2>=0; di2--){' +
      'if(atoms[di2] && isDivider(atoms[di2])){ atoms.splice(di2,1); atomH.splice(di2,1); }' +
    '}' +
  '}catch(e){}' +

  // images ON?
  'var __IMG_ON__ = true;' +
  'try{' +
    'var root = document.querySelector(".print-page.print-layout-2");' +
    'if(root && root.classList && root.classList.contains("print-images-off")) __IMG_ON__ = false;' +
  '}catch(e){}' +

  // ------------------------------------------------------------
  // measurer: used only to measure candidate segments reliably
  // ------------------------------------------------------------
  'var __MEAS__ = null;' +
  'function __ensureMeas__(){' +
    'if(__MEAS__) return __MEAS__;' +
    'try{' +
      '__MEAS__ = document.createElement("div");' +
      '__MEAS__.setAttribute("data-shoshin-l2-measure","1");' +
      '__MEAS__.style.cssText="position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;box-sizing:border-box;";' +
      // IMPORTANT: place measurer INSIDE the Layout2 print subtree so Layout2-scoped CSS applies
      'var host = document.querySelector(".print-page.print-layout-2") || document.body;' +
      'host.appendChild(__MEAS__);' +
    '}catch(e){ __MEAS__ = null; }' +
    'return __MEAS__;' +
  '}' +


  'function __syncMeasWidth__(){' +
    'try{' +
      'var m=__ensureMeas__();' +
      'if(!m || !body) return;' +
      'm.style.width = Math.round(body.getBoundingClientRect().width) + "px";' +
    '}catch(e){}' +
  '}' +

  'function __measureH__(node){' +
    'var m = __ensureMeas__();' +
    'if(!m || !node) return 0;' +
    'try{' +
      '__syncMeasWidth__();' +
      'm.innerHTML="";' +
      'm.appendChild(node);' +
      'var h = rectH(node);' +
      'm.innerHTML="";' +
      'return (h && isFinite(h)) ? h : 0;' +
    '}catch(e){ try{ m.innerHTML=""; }catch(_e){} return 0; }' +
  '}' +

  // ------------------------------------------------------------
  // Bucket segment helpers
  // ------------------------------------------------------------
  'function __unitRows__(bucket){' +
    'try{ return Array.prototype.slice.call(bucket.querySelectorAll("tr.l2-unit") || []); }catch(e){ return []; }' +
  '}' +

  'function __cloneSeg__(bucket, startIdx, count){' +
    'var c = bucket.cloneNode(true);' +
    'try{' +
      'var rows = Array.prototype.slice.call(c.querySelectorAll("tr.l2-unit") || []);' +
      'for(var i=rows.length-1; i>=0; i--){' +
        'if(i < startIdx || i >= (startIdx+count)) rows[i].parentNode.removeChild(rows[i]);' +
      '}' +
    '}catch(e){}' +
    'return c;' +
  '}' +

  // minimum viable segment = header + 1 row (if rows exist); otherwise the whole bucket
  'function __minSegH__(bucket){' +
    'try{' +
      'var rows = bucket ? (bucket.querySelectorAll("tr.l2-unit") || []) : null;' +
      'if(!rows || rows.length===0){ return __measureH__(bucket.cloneNode(true)); }' +
    '}catch(e){}' +
    'var seg = __cloneSeg__(bucket, 0, 1);' +
    'return __measureH__(seg);' +
  '}' +


  // ------------------------------------------------------------
  // Divider as PRELUDE for next bucket (never first, never last)
  // We only place divider if [divider + (bucket header + 1 row)] fits.
  // ------------------------------------------------------------
  'function __maybePreludeDivider__(nextBucket){' +
    'if(!__IMG_ON__ || !__DIV_TPL__) return false;' +
    'if(countOnPage===0) return false;' +
    'var div = __DIV_TPL__.cloneNode(true);' +
    'var hDiv = __measureH__(div);' +
    'var hMin = __minSegH__(nextBucket);' +
    'if(!projWillFit([hDiv, hMin], used, countOnPage, avail)) return false;' +
    'appendAtom(div, hDiv);' +
    'return true;' +
  '}' +

  // ------------------------------------------------------------
  // MAIN: iterate buckets, emit segments
  // ------------------------------------------------------------
  'for(var bi=0; bi<atoms.length; bi++){' +
    'var bucket = atoms[bi];' +
    'if(!bucket || !bucket.classList || !bucket.classList.contains("l2-bucket-atom")){' +
      // Non-bucket: keep existing simple behavior (rare in L2)
      'var hh = atomH[bi] || rectH(bucket);' +
      'if(countOnPage>0 && !projWillFit([hh], used, countOnPage, avail)){' +
        'startNewPage();' +
      '}' +
      'appendAtom(bucket, hh);' +
      'continue;' +
    '}' +

    // If this is not the first bucket, try to insert a divider prelude (only if it fits with min segment)
    'if(bi > 0){ __maybePreludeDivider__(bucket); }' +

    'var rows = __unitRows__(bucket);' +
    'var total = rows.length;' +
    'if(total<=0){' +
      // no unit rows; just place it
      'var bh = __measureH__(bucket);' +
      'if(countOnPage>0 && !projWillFit([bh], used, countOnPage, avail)) startNewPage();' +
      'appendAtom(bucket, bh);' +
      'continue;' +
    '}' +

    // segment emission
    'var start = 0;' +
    'while(start < total){' +

      // rule: never leave just a header at bottom; if header+1row doesn't fit and page has content, start new page
      'var minH = __measureH__(__cloneSeg__(bucket, start, 1));' +
      'if(countOnPage>0 && !projWillFit([minH], used, countOnPage, avail)){' +
        'startNewPage();' +
      '}' +

      // choose max rows that fit (binary-ish incremental, small row heights so linear is fine)
      'var best = 1;' +
      'for(var k=2; (start+k)<=total; k++){' +
        'var test = __cloneSeg__(bucket, start, k);' +
        'var th = __measureH__(test);' +
        'if(projWillFit([th], used, countOnPage, avail)) best = k; else break;' +
      '}' +

      // append best segment
      'var seg = __cloneSeg__(bucket, start, best);' +
      'var segH = __measureH__(seg);' +
      'appendAtom(seg, segH);' +

      'start += best;' +

      // if there is remaining tail, force new page (your rule: continue bucket on fresh page)
      'if(start < total){ startNewPage(); }' +
    '}' +
  '}' +

  // final: ensure no divider begins/ends a page (should already be prevented)
  'try{' +
    'var fr = Array.prototype.slice.call(document.querySelectorAll(".print-pages-wrap .print-frag") || []);' +
    'for(var p=0; p<fr.length; p++){' +
      'var b = q(".print-frag-body", fr[p]);' +
      'if(!b) continue;' +
      'while(b.firstElementChild && isDivider(b.firstElementChild)) b.removeChild(b.firstElementChild);' +
      'while(b.lastElementChild && isDivider(b.lastElementChild)) b.removeChild(b.lastElementChild);' +
    '}' +
  '}catch(e){}' +

    // done (L2 path ends here)
  '' +

'})();} else {(function(){' +


/* BEGIN SHOSHIN PRINT — PROJECTION FIT (GAP-AWARE, L1-ONLY) */
'function projWillFit(addHeights, usedNow, countNow, availNow){' +
  'var u=usedNow; var c=countNow; var g=GAP_PX||0;' +
  'for(var ai=0; ai<addHeights.length; ai++){' +
    'var h = addHeights[ai] || 0;' +
    'if(c>0 && g){ u += g; }' +
    'u += h; c++;' +
  '}' +
  'return u <= availNow;' +
'}' +
/* END SHOSHIN PRINT — PROJECTION FIT (GAP-AWARE, L1-ONLY) */


/* BEGIN SHOSHIN PRINT — NON-L2 PACKING (RESTORE LAYOUT1 SIGNED-OFF BEHAVIOR) */
'for(var i=0;i<atoms.length;i++){' +
  'var node = atoms[i];' +
  'if(!node){ continue; }' +

  'var nodeIsDiv = isDivider(node);' +

  // Always resolve GAP fresh (match appendAtom spacing decisions)
  'if(!GAP_PX) GAP_PX = getGapPx();' +

  // Divider between units/buckets:
  // - never first on a page
  // - never last on a page (enforced by stripping before page breaks)
  // - never force a page break just to place a divider
  'if(nodeIsDiv){' +
    'if(countOnPage===0){ continue; }' +
    'var hDiv = atomH[i] || rectH(node);' +
    'if(!projWillFit([hDiv], used, countOnPage, avail)){' +
      'continue;' +
    '}' +
    'appendAtom(node, hDiv);' +
    'continue;' +
  '}' +

  // Normal atom flow
  'var h = atomH[i] || rectH(node);' +
  'if(countOnPage>0 && !projWillFit([h], used, countOnPage, avail)){' +
    'stripTrailingDividerIfAny();' +
    'startNewPage();' +
  '}' +
  'appendAtom(node, h);' +
'}' +

/* Final safety: no page can begin OR end with divider (sweep ALL pages) */
'try{' +
  'var frags2 = Array.prototype.slice.call(document.querySelectorAll(".print-pages-wrap .print-frag") || []);' +
  'for(var p=0; p<frags2.length; p++){' +
    'var bdy = q(".print-frag-body", frags2[p]);' +
    'if(!bdy) continue;' +
    'while(bdy.firstElementChild && isDivider(bdy.firstElementChild)) bdy.removeChild(bdy.firstElementChild);' +
    'while(bdy.lastElementChild && isDivider(bdy.lastElementChild)) bdy.removeChild(bdy.lastElementChild);' +
  '}' +
'}catch(e){}' +
/* END SHOSHIN PRINT — NON-L2 PACKING (RESTORE LAYOUT1 SIGNED-OFF BEHAVIOR) */

'})();}' + // end __IS_L2__



/* END SHOSHIN PRINT — L2 BUCKET→SEGMENT PAGINATION (TASK 3) */

/* END SHOSHIN PRINT — BONDED DIVIDER+UNIT PACKING (REPLACED BY L2 SEGMENT MODEL) */



/* BEGIN SHOSHIN PRINT — TASK 0: TAG FIRST UNIT PER PAGE (TOP BUFFER) */
'try{' +
  'var frags = Array.prototype.slice.call(document.querySelectorAll(".print-pages-wrap .print-frag") || []);' +
  'for(var pi=0; pi<frags.length; pi++){' +
    'var frag = frags[pi];' +
    'var body = q(".print-frag-body", frag);' +
    'if(!body) continue;' +

    // HARD RESET: ensure ONLY one "first unit" per page
    'try{' +
      'var prior = body.querySelectorAll(".shoshin-page-first-unit");' +
      'if(prior && prior.length){ for(var i=0;i<prior.length;i++){ prior[i].classList.remove("shoshin-page-first-unit"); } }' +
    '}catch(e){}' +

    // first unit atom on this page (move Row1+Row2 together)
    'var firstUnit = body.querySelector(":scope > .print-unit-group, :scope > .print-unit-row");' +
    'if(firstUnit && firstUnit.classList){ firstUnit.classList.add("shoshin-page-first-unit"); }' +
  '}' +
'}catch(e){}' +
/* END SHOSHIN PRINT — TASK 0: TAG FIRST UNIT PER PAGE (TOP BUFFER) */



/* BEGIN SHOSHIN PRINT — TASK 1: VERTICAL JUSTIFY (POST-PAGINATION, POLICY: childCount>=4 && slack<=160px) */
'try{' +
  'var frags = Array.prototype.slice.call(document.querySelectorAll(".print-pages-wrap .print-frag") || []);' +
  'for(var pi=0; pi<frags.length; pi++){' +
    'var frag = frags[pi];' +
    'var body = q(".print-frag-body", frag);' +
    'if(!body) continue;' +

    // childCount = direct children of .print-frag-body (this matches your audit)
    'var childCount = 0;' +
    'try{ childCount = (body.children && body.children.length) ? body.children.length : 0; }catch(e){ childCount = 0; }' +

    // compute avail (page usable height) via existing paginator helper
    'var avail = 0;' +
    'try{ avail = getAvailPx(frag, pi); }catch(e){ avail = 0; }' +

    // compute gap between children (row-gap/gap if present; else 0)
    'var gapPx = 0;' +
    'try{' +
      'var st = window.getComputedStyle(body);' +
      'var g = (st && st.rowGap && st.rowGap !== "normal") ? st.rowGap : ((st && st.gap && st.gap !== "normal") ? st.gap : "0px");' +
      'var gn = parseFloat(g);' +
      'gapPx = (isFinite(gn) && gn > 0) ? gn : 0;' +
    '}catch(e){ gapPx = 0; }' +

    // compute used = sum(child heights) + (gaps * (childCount-1))
    'var used = 0;' +
    'try{' +
      'var kids = Array.prototype.slice.call(body.children || []);' +
      'for(var k=0; k<kids.length; k++){' +
        'if(k > 0 && gapPx){ used += gapPx; }' +
        'used += rectH(kids[k]);' +
      '}' +
    '}catch(e){ used = 0; }' +

    'var slack = avail - used;' +

    // ensure flex column so justifyContent is meaningful (visual only)
    'try{ body.style.display = "flex"; body.style.flexDirection = "column"; }catch(e){}' +

    // POLICY (Option A): justify only when enough children AND slack is not absurd
    'var MAX_SLACK_FOR_JUSTIFY = 160;' +
    'if(childCount >= 4 && slack <= MAX_SLACK_FOR_JUSTIFY){' +
      'try{ body.style.justifyContent = "space-between"; }catch(e){}' +
    '}else{' +
      'try{ body.style.justifyContent = "flex-start"; }catch(e){}' +
    '}' +
  '}' +
'}catch(e){}' +
/* END SHOSHIN PRINT — TASK 1: VERTICAL JUSTIFY (POST-PAGINATION, POLICY: childCount>=4 && slack<=160px) */




      'wrap.setAttribute("data-shoshin-paginated","1");' +
      'setStage("done");' +
      'window.__SHOSHIN_PAGINATION_DONE__ = { pages: pageIndex+1, ts: Date.now() };' +



      'window.__SHOSHIN_PAGINATION_RUNNING__ = false;' +
    '}' +

/* BEGIN SHOSHIN PRINT — RUN INIT + BEFOREPRINT (NO POST-PRINT TIMERS) */
'var __SHOSHIN_PRINTING__ = false;' +
'var __SHOSHIN_INIT_RAN__ = false;' +

'function run(reason){' +
  'try{' +
    'paginate();' +
  '}catch(e){' +
    'try{ console.warn("[SHOSHIN PRINT] paginate failed ("+(reason||"")+"):", e); }catch(__e){}' +
    'try{ window.__SHOSHIN_PAGINATION_RUNNING__ = false; }catch(__e2){}' +
  '}' +
'}' +

/* INIT:
   Run once as soon as the print tab DOM is ready, BEFORE the print dialog.
   Use rAF x2 (no setTimeout) so it cannot “wake up” after the print dialog closes. */
'function runInitOnce(){' +
  'if(__SHOSHIN_INIT_RAN__) return;' +
  'if(__SHOSHIN_PRINTING__) return;' +
  '__SHOSHIN_INIT_RAN__ = true;' +
  'try{' +
    'requestAnimationFrame(function(){' +
      'requestAnimationFrame(function(){ run("init"); });' +
    '});' +
  '}catch(e){ run("init_fallback"); }' +
'}' +
'if(document.readyState === "loading"){' +
  'document.addEventListener("DOMContentLoaded", runInitOnce);' +
'}else{' +
  'runInitOnce();' +
'}' +

/* PRINT:
   Do NOT repaginate if we already paginated successfully.
   Chromium's print dialog can trigger a reflow; re-running pagination here
   is what causes the post-dialog "UU" adjacency regression. */
'window.addEventListener("beforeprint", function(){' +
  '__SHOSHIN_PRINTING__ = true;' +

  // If pagination already succeeded, do nothing (keep the stable layout).
  'try{' +
    'var wrap = document.querySelector(".print-pages-wrap");' +
    'var done = !!window.__SHOSHIN_PAGINATION_DONE__ && !!wrap && (String(wrap.getAttribute("data-shoshin-paginated")||"") === "1");' +
    'if(done){ return; }' +
  '}catch(e){}' +

  'run("beforeprint");' +
'});' +


/* AFTERPRINT:
   Do NOT repaginate. Just clear printing flag. */
'window.addEventListener("afterprint", function(){' +
  '__SHOSHIN_PRINTING__ = false;' +
'});' +
/* END SHOSHIN PRINT — RUN INIT + BEFOREPRINT (NO POST-PRINT TIMERS) */

  '})();</scr' + 'ipt>' +
  /* END SHOSHIN PRINT — RUNTIME PAGINATION (REAL PRINT WINDOW ONLY) */

'</body>' +
/* END SHOSHIN PRINT — BODY WRITE WITH PAGINATION (REAL PIPELINE) */


    '</html>'
  );
  doc.close();

    // BEGIN SHOSHIN PRINT — FORCE about:blank URL STABILITY (legacy writer)
try {
  if (w && w.history && w.history.replaceState) {
    w.history.replaceState(null, '', 'about:blank');
  }
} catch(e) {}
// END SHOSHIN PRINT — FORCE about:blank URL STABILITY (legacy writer)


  // Force the JS-visible URL back to about:blank for cleaner diagnostics.
  // (This does not change the address bar, but it prevents location.href from
  // reading as the opener URL on some Chromium builds.)
  try {
    if (w.history && w.history.replaceState) w.history.replaceState(null, '', 'about:blank');
  } catch (e) {}

}
// END SHOSHIN PRINT — OPEN PRINT TAB DOCUMENT (reliable new-tab print)



function renderPrintLayout1HTML(ctx) {
  // ctx: rosterName, rosterRef, rosterIcon, totals, masterClassAbilities, mode, grouped, ownedIndex

  function esc(s) {
    s = String(s == null ? '' : s);
    return s.replace(/[&<>"']/g, function (ch) {
      return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[ch];
    });
  }

  function fmtInt(n) {
    n = Number(n);
    if (!isFinite(n)) n = 0;
    return String(Math.round(n));
  }

    function normalizeAbsUrl(url) {
    url = String(url || '').trim();
    if (!url) return '';
    // print tab is about:blank; make relative paths absolute
    if (url.charAt(0) === '/') {
      try { url = window.location.origin + url; } catch (_) {}
    }
    return url;
  }

function pickBucketThumbFromRows(rows) {
  // Use the same source that determines the bucket: the rows themselves.
  // assigned_units_json includes `img` per unit (static per class across the ecosystem).
  var first = (rows && rows.length) ? (rows[0] || {}) : null;
  var sample = first ? (first.sample || first) : null;
  if (!sample) return '';

  // Prefer explicit image field on the unit payload
  var src =
    sample.img ||
    sample.image ||
    sample.imageUrl ||
    sample.image_url ||
    '';

  // Last-resort: attempt to extract from unitKey (if ever needed later)
  // unitKey format: kind|cls|refId|name|img
  if (!src && sample.unitKey) {
    var parts = String(sample.unitKey).split('|');
    if (parts.length >= 5) src = parts[4] || '';
  }

  return normalizeAbsUrl(src);
}

function stat(u, key) {
  var st = (u && u.stats) ? u.stats : null;
  if (!st) return '--';

  var v = normalizeStat(st[key]);

  // Only these keys can be inches-formatted when numeric-only.
  // Everything else stays verbatim.
  if (key === 'mov' || key === 'm_dis' || key === 'r_dis') {
    v = withInchesIfNumeric(v);
  }

  return v;
}

// Layout1: COST(%) must sum to exactly 100 across ALL printed CM rows.
// We compute once, keyed by unitEntryId (the same value passed into buildCombatModifiersBlockHTML).
var __L1_COST_PCT_MAP = (function(){
  var map = Object.create(null);

  // Collect (unitEntryId, cost) in the same order rows are rendered.
  var items = [];
  var totalCost = 0;

  // ctx.grouped is bucket -> rows[]
  var grouped = (ctx && ctx.grouped) ? ctx.grouped : null;
  if (!grouped) return map;

  var keys = Object.keys(grouped);
  var idx = 0;

  for (var k = 0; k < keys.length; k++) {
    var bucket = keys[k];
    var rows = grouped[bucket] || [];
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r] || {};

      // unitEntryId should exist on the row; fallbacks are safe.
      var id = row.unitEntryId != null ? row.unitEntryId
             : (row.entryId != null ? row.entryId
             : (row.unit_entry_id != null ? row.unit_entry_id : ''));

      id = String(id).trim();
      if (!id) continue;

      var c = asInt(row.cost, 0);
      if (c < 0) c = 0;

      items.push({ id: id, cost: c, idx: idx++ });
      totalCost += c;
    }
  }

  if (totalCost <= 0 || !items.length) return map;

  // Largest remainder allocation -> integer % that sum to 100
  var baseSum = 0;
  for (var i = 0; i < items.length; i++) {
    var exact = (items[i].cost / totalCost) * 100;
    var floor = Math.floor(exact);
    items[i].base = floor;
    items[i].rem = exact - floor;
    baseSum += floor;
  }

  var need = 100 - baseSum;
  if (need < 0) need = 0;

  items.sort(function(a,b){
    if (b.rem !== a.rem) return b.rem - a.rem;
    return a.idx - b.idx; // deterministic
  });

  for (var j = 0; j < items.length; j++) {
    items[j].final = items[j].base + (j < need ? 1 : 0);
  }

  // Write map (keyed by unitEntryId)
  for (var n = 0; n < items.length; n++) {
    map[items[n].id] = items[n].final;
  }

  return map;
})();


function buildCombatModifiersBlockHTML(unitEntryId, refId, qty, cost, sample) {
  var asset = ctx.ownedIndex[asInt(unitEntryId, 0)];
  sample = sample || {};

  // Prefer "sample" for identity fields (name/img) because ownedIndex objects are not guaranteed
  // to carry them even when they carry modsBlock.
  var displayTitle =
    (sample && (sample.name || sample.cls)) ||
    (asset && (asset.name || asset.cls || asset.title || asset.className || asset.class)) ||
    '';

  var displayImg =
    (sample && sample.img) ||
    (asset && (asset.img || asset.icon || asset.image || asset.photo)) ||
    '';

    var modsBlock = asset && asset.modsBlock ? String(asset.modsBlock) : '';
    var linesAll = parseModsBlockToLines(modsBlock);

    // Layout decision (locked):
    // - Max 16 tags (4x4)
    // - Drop beyond 16
    // - Fill bottom-up; within a row fill left-to-right, then move upward
    var lines = linesAll.slice(0, 16);

    var TAG_COLS = 4;
    var TAG_ROWS = 4;
    var total = TAG_COLS * TAG_ROWS;

    // Build cells in visual order (top row -> bottom row), but place tags bottom-up.
    var placed = new Array(total);
    for (var i = 0; i < total; i++) placed[i] = '';

    // Center band placement (keeps 4x4 always, but doesn't force bottom alignment)
    var rowsUsed = Math.ceil(lines.length / TAG_COLS); // 0..4
    if (rowsUsed < 0) rowsUsed = 0;
    if (rowsUsed > TAG_ROWS) rowsUsed = TAG_ROWS;

    // Place the content band starting at:
    // rowsUsed=1 => startRow=1 (row 2)
    // rowsUsed=2 => startRow=1 (rows 2-3)
    // rowsUsed=3 => startRow=0 (rows 1-3)
    // rowsUsed=4 => startRow=0 (rows 1-4)
     var startRow = (rowsUsed === 1)
      ? 1
      : Math.floor((TAG_ROWS - rowsUsed + 1) / 2);


    for (var n = 0; n < lines.length; n++) {
      var rowWithin = Math.floor(n / TAG_COLS);
      var col = n % TAG_COLS;
      var row = startRow + rowWithin;
      var idx = (row * TAG_COLS) + col;
      if (idx >= 0 && idx < total) placed[idx] = lines[n];
    }

    // Flag odd-row counts (1 or 3) for a half-row optical nudge via CSS
    var rowsClass = (rowsUsed === 1) ? ' is-rows-1'
                 : (rowsUsed === 3) ? ' is-rows-3'
                 : '';



    var out = '';
    out += '<div class="print-cm-block">';



    // ==========================================================
    // ROW1 (containerized)
    // - Col1: REF/(QTY) + COST/(%)
    // - Col2: "Combat Modifiers"
    // - Col3: "{"
    // - Col4-7: 4x4 tag grid (fixed, isolated)
    // ==========================================================
    var clanPointsTotal = Number(ctx && ctx.totals ? ctx.totals.points : 0);
    if (!isFinite(clanPointsTotal)) clanPointsTotal = 0;

    var qtyPart = (ctx.mode === 'consolidated')
      ? (' <span class="print-cm-col1-qty">(' + esc(String(qty)) + ')</span>')
      : '';

var pct = (clanPointsTotal > 0) ? ((cost / clanPointsTotal) * 100) : 0;

// Layout1: prefer normalized map (sum = 100 across rows)
var _uk1 = '';
try{
  _uk1 = String(sample && sample.unitKey ? sample.unitKey : '').trim();
  if (!_uk1 && (typeof makeUnitKey === 'function')) _uk1 = String(makeUnitKey(sample || {}) || '').trim();
}catch(e){ _uk1 = ''; }

var pctStr = (_uk1 && __L1_UNIT_PCT_MAP && (__L1_UNIT_PCT_MAP[_uk1] != null))
  ? (String(__L1_UNIT_PCT_MAP[_uk1]) + '%')
  : ((clanPointsTotal > 0) ? (pct.toFixed(0) + '%') : '0%');


    out += '<div class="print-cm-row1">';

    // Col 1 container
    out += ''
      + '<div class="print-cm-col1box">'
      +   '<div class="print-cm-col1media">' +
((ctx.includeImages && displayImg)
  ? ('<img class="print-cm-thumb" src="' + esc(normalizeAbsUrl(String(displayImg))) + '" alt="" aria-hidden="true">')
  : '') +
'<div class="print-cm-col1stack">' +
  '<div class="print-cm-col1-title">' + esc(String(displayTitle || '')) + '</div>' +

            '<div class="print-cm-cell print-cm-col1 print-cm-col1-ref">' +
              '<div class="print-cm-col1-refline">' +
                '<span class="print-cm-col1-refid">' + esc(String(refId)) + '</span>' +
                qtyPart +
              '</div>' +
            '</div>' +
            '<div class="print-cm-cell print-cm-col1 print-cm-col1-cost">' +
              '<div class="print-cm-col1-costline">' +
                '<span class="print-cm-col1-costlabel">COST:</span> ' +
                '<span class="print-cm-col1-costval">' + esc(fmtInt(cost)) + '</span> ' +
                '<span class="print-cm-col1-costpct">(' + esc(pctStr) + ')</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Col 2 container
    out += ''
      + '<div class="print-cm-col2box">'
      +   '<div class="print-cm-combat-inner">Combat Modifiers</div>'
      + '</div>';

    // Col 3 container
    out += ''
      + '<div class="print-cm-col3box">'
      +   '<div class="print-cm-brace-inner">{</div>'
      + '</div>';

    // Col 4–7 container (isolated 4x4 grid)
    out += '<div class="print-cm-tagsbox">';
    out += '<div class="print-cm-keyline"><b>Key:</b> <b>[M]</b> Melee &nbsp;&nbsp; <b>[R]</b> Ranged &nbsp;&nbsp; <b>[B]</b> Both &nbsp;&nbsp; <b>[P]</b> Passive &nbsp;&nbsp; <b>[A]</b> Action</div>';
    out += '<div class="print-cm-tags-grid' + rowsClass + '">';



for (var i2 = 0; i2 < total; i2++) {
  var v = placed[i2] || '';

  /* BEGIN SHOSHIN — DANGER TAGS IN RED (NO WRAP REGRESSION) */
  var vv = (v == null) ? '' : String(v);
  vv = vv.trim();

  // Exact strings can vary (extra spaces). Match by stable phrases.
  var isDangerTag =
    (vv.indexOf('[M] Lucky Hits on 6 only') === 0) ||
    (vv.indexOf('[R] Lucky Hits on 6 only') === 0) ||
    (vv.indexOf('[B] May not attack in water') === 0) ||
    (vv.indexOf('[P] May not operate ship') === 0);

  var tagClass = isDangerTag ? ' shoshin-red' : '';
  /* END SHOSHIN — DANGER TAGS IN RED (NO WRAP REGRESSION) */

  out += '<div class="print-cm-cell print-cm-tag' + tagClass + '">' + (v ? esc(v) : '&nbsp;') + '</div>';
}


    out += '</div>'; // .print-cm-tags-grid
    out += '</div>'; // .print-cm-tagsbox

    out += '</div>'; // .print-cm-row1

    out += '</div>'; // .print-cm-block
    return out;
  }

function renderRow(rowObj, allowCmOverlap, prefixHtml) {
  var sample = rowObj.sample || {};
  var refId = String(rowObj.refId || '');
  var qty = asInt(rowObj.qty, 1);
  if (qty < 1) qty = 1;

  var perModelPoints = Number(sample.points);
  if (!isFinite(perModelPoints)) perModelPoints = 0;

  var cost = (ctx.mode === 'consolidated') ? (perModelPoints * qty) : perModelPoints;
  var unitEntryId = asInt(sample.entryId, 0);

  var cmClass = 'print-row-block print-row-block-cm' + (allowCmOverlap ? ' is-overlap-ok' : '');

  // =========================================================
  // BEGIN // SHOSHIN — Lucky tag detection (for conditional red styling on tags + weapon stats)
    // IMPORTANT: modsBlock lives reliably on the ownedIndex asset; sample may not carry it.
    var _assetForTags = null;
    try{ _assetForTags = ctx && ctx.ownedIndex ? ctx.ownedIndex[asInt(unitEntryId, 0)] : null; }catch(e){ _assetForTags = null; }

    var _mods = '';
    if (_assetForTags && _assetForTags.modsBlock != null) _mods = String(_assetForTags.modsBlock || '');
    else if (sample && sample.modsBlock != null) _mods = String(sample.modsBlock || '');

    var _tagText = '';
    try{ _tagText = parseModsBlockToLines(_mods).join('\n'); }catch(e){ _tagText = ''; }

    var _hasMLucky = /\[M\]/.test(_tagText) && /Lucky Hits on 6 only/.test(_tagText);
    var _hasRLucky = /\[R\]/.test(_tagText) && /Lucky Hits on 6 only/.test(_tagText);

      // END // SHOSHIN — Lucky tag detection


  // =========================================================
  // BEGIN SHOSHIN — ROW2 STATS LABEL OVERRIDES (SUPPORT ASSETS)
  // =========================================================
    var _sb = '';
  try { _sb = String(supportBucketFromUnit(sample || {}) || ''); } catch (e) { _sb = ''; }

  // normalize (supportBucketFromUnit is not guaranteed to return a single canonical string)
  var _bucket = _sb.trim().toLowerCase(); // e.g. "artillery", "ships", "ship"

  // Only for Support Assets that are Artillery or Sailing Ship(s)
  var _isSupportStats = (_bucket === 'artillery' || _bucket === 'ships' || _bucket === 'ship');

  var _statsTitle = _isSupportStats ? "SUPPORT ASSET STATS" : "CHARACTER STATS";
  var _defLabel   = _isSupportStats ? "Resistance" : "Defense";
  var _bodLabel   = _isSupportStats ? "Toughness"  : "Body";

  // =========================================================
  // END SHOSHIN — ROW2 STATS LABEL OVERRIDES (SUPPORT ASSETS)
  // =========================================================

  /* BEGIN SHOSHIN — ROW2 VCELL HELPER (RESTORE; REQUIRED FOR PRINT) */
  // SCREEN ONLY concern: some Row2 values are words (e.g., "Variable", "Highest", "Captain")
  // We tag them at render time so CSS can shrink ONLY those cells in @media screen.
  function row2VCell(val, extraCls) {
    var raw = (val == null) ? '' : String(val);
    raw = raw.trim();

    var cls = 'print-row2-v';
    if (extraCls) cls += ' ' + String(extraCls);

    if (raw && /[A-Za-z]/.test(raw)) cls += ' is-text';
    if (raw && raw.length >= 8) cls += ' is-long'; // e.g., "Variable", "Highest"

    return '<div class="' + cls + '">' + (raw ? esc(raw) : '&nbsp;') + '</div>';
  }
  /* END SHOSHIN — ROW2 VCELL HELPER (RESTORE; REQUIRED FOR PRINT) */


  return (
    '<div class="print-unit-row">' +

      // Block 1: Combat Modifiers grid (6x4)
      '<div class="' + cmClass + '">' +
        buildCombatModifiersBlockHTML(unitEntryId, refId, qty, cost, sample) +
      '</div>' +

      // Block 2: ROW2 — Melee Weapon | Range Weapon | Character/Support Stats
      '<div class="print-row-block print-row-block-row2">' +
        '<div class="print-row2">' +

          // (1) MELEE WEAPON
          '<div class="print-row2-group print-row2-group-melee">' +
            '<div class="print-row2-group-title">MELEE WEAPON</div>' +
            '<div class="print-row2-grid print-row2-grid-3">' +
              '<div class="print-row2-h print-row2-h-melee">Damage</div>' +
              '<div class="print-row2-h print-row2-h-melee">Critical</div>' +
              '<div class="print-row2-h print-row2-h-melee">Distance</div>' +

              row2VCell(stat(sample, 'm_dmg'), _hasMLucky ? 'shoshin-red' : '') +
              row2VCell(stat(sample, 'm_crt'), _hasMLucky ? 'shoshin-red' : '') +
              row2VCell(stat(sample, 'm_dis'), _hasMLucky ? 'shoshin-red' : '') +

            '</div>' +
          '</div>' +

          // (2) RANGE WEAPON
          '<div class="print-row2-group print-row2-group-ranged">' +
            '<div class="print-row2-group-title">RANGED WEAPON</div>' +
            '<div class="print-row2-grid print-row2-grid-3">' +
              '<div class="print-row2-h print-row2-h-ranged">Damage</div>' +
              '<div class="print-row2-h print-row2-h-ranged">Critical</div>' +
              '<div class="print-row2-h print-row2-h-ranged">Distance</div>' +

              row2VCell(stat(sample, 'r_dmg'), _hasRLucky ? 'shoshin-red' : '') +
              row2VCell(stat(sample, 'r_crt'), _hasRLucky ? 'shoshin-red' : '') +
              row2VCell(stat(sample, 'r_dis'), _hasRLucky ? 'shoshin-red' : '') +

            '</div>' +
          '</div>' +

          // (3) STATS
          '<div class="print-row2-group print-row2-group-stats">' +
            '<div class="print-row2-group-title">' + esc(_statsTitle) + '</div>' +
            '<div class="print-row2-grid print-row2-grid-6">' +
              '<div class="print-row2-h print-row2-h-stats">Attack</div>' +
              '<div class="print-row2-h print-row2-h-stats">' + esc(_defLabel) + '</div>' +
              '<div class="print-row2-h print-row2-h-stats">Movement</div>' +
              '<div class="print-row2-h print-row2-h-stats">' + esc(_bodLabel) + '</div>' +
              '<div class="print-row2-h print-row2-h-stats">Leadership</div>' +
              '<div class="print-row2-h print-row2-h-stats">Initiative</div>' +

              row2VCell(stat(sample, 'atk')) +
              row2VCell(stat(sample, 'def')) +
              row2VCell(stat(sample, 'mov')) +
              row2VCell(stat(sample, 'bod')) +
              row2VCell(stat(sample, 'ldr')) +
              row2VCell(stat(sample, 'ini')) +

            '</div>' +
          '</div>' +

        '</div>' +
      '</div>' +

    '</div>'
  );
}

  function renderStatBox(label, value) {
    return (
      '<div class="print-statbox">' +
        '<div class="print-stat-label">' + esc(label) + '</div>' +
        '<div class="print-stat-value">' + esc(value) + '</div>' +
      '</div>'
    );
  }

  var header =
    '<div class="print-header">' +

      // Left: Logo + Clan name
      '<div class="print-header-left">' +
        '<img class="print-logo" src="/wp-content/uploads/2025/11/Header_logo_300x150_1.png" alt="Shoshin" />' +
        '<div class="print-header-titles">' +
          '<div class="print-roster-name">' + esc(ctx.rosterName) + '</div>' +
          '<div class="print-roster-sub">Master Class Abilities: ' + esc(fmtInt(ctx.masterClassAbilities)) + '</div>' +
        '</div>' +
      '</div>' +

      // Right: 3 stat boxes
      '<div class="print-header-right">' +
                '<div class="print-header-boxes">' +

          '<div class="print-hbox">' +
            '<div class="print-hbox-num">' + esc(fmtInt(ctx.totals.points)) + '</div>' +
            '<div class="print-hbox-label">Clan Points</div>' +
          '</div>' +

          '<div class="print-hbox">' +
            '<div class="print-hbox-num">' + esc(fmtInt(ctx.totals.ini)) + '</div>' +
            '<div class="print-hbox-label">Initiative</div>' +
          '</div>' +

          '<div class="print-hbox">' +
            '<div class="print-hbox-num">' + esc(fmtInt(ctx.totals.honor)) + '</div>' +
            '<div class="print-hbox-label">Honor (XP)</div>' +
          '</div>' +

        '</div>' +

      '</div>' +

    '</div>';


  var body = '';
  var renderedRows = 0;


  var dividerSrc = normalizeAbsUrl('/wp-content/uploads/2026/01/divider.png');

  /* BEGIN SHOSHIN — DIVIDERS HONOR IMAGES TOGGLE */
var showDividers = !(ctx && ctx.includeImages === false); // default ON unless explicitly OFF
/* END SHOSHIN — DIVIDERS HONOR IMAGES TOGGLE */



/* BEGIN SHOSHIN PRINT — FLAT ATOMS (DIVIDER + UNIT), NO BUCKET/TITLE ROWS */
  // New contract:
  // - Direct children of .print-frag-body are atoms the paginator can pack:
  //   (A) .print-divider-group  -> Divider atom
  //   (B) .print-unit-group     -> Unit atom (contains exactly ONE .print-unit-row)
  // - No thumb/bucket rows; title/thumb move into Row1 Col1.
  // - Divider may be omitted at page start (paginator-driven). We do not compensate.

/* BEGIN SHOSHIN — DIVIDER ATOM (CENTERED; HIDE IMAGE ONLY WHEN IMAGES OFF) */
function renderDividerAtom() {
  // Keep divider height for pagination even when images are OFF
  var imagesOn = !(ctx && ctx.includeImages === false);

  var imgStyle = imagesOn
    ? 'height:18px;width:auto;display:block;'
    : 'height:18px;width:auto;display:block;opacity:0;';

  return (
    '<div class="print-divider-group">' +
      '<div class="shoshin-divider-row" style="display:flex;align-items:center;justify-content:center;">' +
        '<img class="print-section-divider" src="' + esc(dividerSrc) + '" alt="" aria-hidden="true" style="' + imgStyle + '">' +
      '</div>' +
    '</div>'
  );
}
/* END SHOSHIN — DIVIDER ATOM (CENTERED; HIDE IMAGE ONLY WHEN IMAGES OFF) */



  function renderUnitAtom(rowHtml) {
    return '<div class="print-unit-group">' + rowHtml + '</div>';
  }

    // =========================================================
  // Layout1: COST (%) must sum to exactly 100 across printed unit rows
  // We compute a normalized integer map keyed by unitKey (stable across the system).
  // =========================================================
  var __L1_UNIT_PCT_MAP = (function(){
    var map = Object.create(null);

    // Flatten rows in the same order Layout1 renders them
    var items = [];
    var totalCost = 0;

    var clanPointsTotal = Number(ctx && ctx.totals ? ctx.totals.points : 0);
    if (!isFinite(clanPointsTotal)) clanPointsTotal = 0;
    if (clanPointsTotal <= 0) return map;

    for (var s2 = 0; s2 < ctx.grouped.length; s2++) {
      var section2 = ctx.grouped[s2];
      var rows2 = safeArray(section2 && section2.rows);
      if (!rows2.length) continue;

      for (var r2 = 0; r2 < rows2.length; r2++) {
        var rowObj2 = rows2[r2] || {};
        var sample2 = rowObj2.sample || {};

        // Build stable unitKey
        var uk = '';
        try {
          uk = String(sample2.unitKey || '').trim();
          if (!uk && (typeof makeUnitKey === 'function')) uk = String(makeUnitKey(sample2) || '').trim();
        } catch(e) { uk = ''; }
        if (!uk) continue;

        // Use the SAME cost logic as renderRow()
        var qty2 = asInt(rowObj2.qty, 1);
        if (qty2 < 1) qty2 = 1;

        var perModelPoints2 = Number(sample2.points);
        if (!isFinite(perModelPoints2)) perModelPoints2 = 0;

        var rowCost2 = (ctx.mode === 'consolidated') ? (perModelPoints2 * qty2) : perModelPoints2;
        if (!isFinite(rowCost2) || rowCost2 < 0) rowCost2 = 0;

        items.push({ unitKey: uk, cost: rowCost2, idx: items.length });
        totalCost += rowCost2;
      }
    }

    if (totalCost <= 0 || !items.length) return map;

    // Largest remainder allocation => integers that sum to 100
    var baseSum = 0;
    for (var i = 0; i < items.length; i++) {
      var exact = (items[i].cost / totalCost) * 100;
      var floor = Math.floor(exact);
      items[i].base = floor;
      items[i].rem  = exact - floor;
      baseSum += floor;
    }

    var need = 100 - baseSum;
    if (need < 0) need = 0;

    items.sort(function(a,b){
      if (b.rem !== a.rem) return b.rem - a.rem;
      return a.idx - b.idx; // deterministic
    });

    for (var j = 0; j < items.length; j++) {
      var val = items[j].base + (j < need ? 1 : 0);
      map[items[j].unitKey] = val;
    }

    return map;
  })();


  var firstUnit = true;

  for (var s = 0; s < ctx.grouped.length; s++) {
    var section = ctx.grouped[s];
    var rows = safeArray(section && section.rows);
    if (!rows.length) continue;

    for (var r = 0; r < rows.length; r++) {
      // No more per-bucket header overlap contract (thumb moved into unit Row1).
      var allowCmOverlap = false;

      var rowHtml = renderRow(rows[r], allowCmOverlap);
      if (!rowHtml) continue;

      if (!firstUnit) body += renderDividerAtom();
      body += renderUnitAtom(rowHtml);

      firstUnit = false;
      renderedRows++;
    }
  }
  /* END SHOSHIN PRINT — FLAT ATOMS (DIVIDER + UNIT), NO BUCKET/TITLE ROWS */

/* BEGIN SHOSHIN PRINT — TASK 11: RENDER SINGLE SOURCE FRAG */
return (
  '<div class="print-page print-layout-1 print-images-' + (ctx.includeImages ? 'on' : 'off') + ' print-mode-' + (ctx.mode === 'consolidated' ? 'consolidated' : 'comprehensive') + '">' +
    '<div class="print-bg"></div>' +


    '<div class="print-pages-wrap">' +
      '<div class="print-frag">' +
        '<div class="print-frag-inner">' +
          header +
          '<div class="print-frag-body">' +
            (body || '<div class="print-empty">No units assigned.</div>') +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +

  '</div>'
);
/* END SHOSHIN PRINT — TASK 11: RENDER SINGLE SOURCE FRAG */

}

/* BEGIN SHOSHIN PRINT — QUICK REFERENCE PAGE (PRODUCTION) */
function renderQuickReferenceLayout1HTML(qr) {
  qr = qr || {};
  return (
    '<div class="print-page print-page-qr" data-print-layout="layout1-qr">' +
      '<div class="print-frag">' +
        '<div class="print-frag-inner">' +
          '<div class="print-frag-body qr-body">' +
            renderQuickReferenceCoreHTML(qr) +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

function renderQuickReferenceLayout2HTML(qr) {
  qr = qr || {};
  return (
    '<div class="print-page print-page-qr" data-print-layout="layout2-qr">' +
      '<div class="print-frag">' +
        '<div class="print-frag-inner">' +
          '<div class="print-frag-body qr-body">' +
            renderQuickReferenceCoreHTML(qr) +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

/**
 * One markup source for BOTH layouts.
 * CSS switches grid geometry for layout1-qr (landscape) vs layout2-qr (portrait).
 */
function renderQuickReferenceCoreHTML(qr){
  qr = qr || {};

  function esc(s){
    s = String(s == null ? '' : s);
    return s.replace(/[&<>"']/g, function (ch) {
      return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[ch];
    });
  }

  // Title line: required for QR (Layout2 header style)
  var title = esc(qr.title || 'Quick Reference');

  // Logo (allowed decorative element). Survives images ON/OFF due to QR image rules.
  var logoSrc = esc(qr.logoSrc || '/wp-content/uploads/2025/11/Header_logo_300x150_1.png');

  function outlineBlock(h, body){
    return (
      '<section class="qr-sec qr-sec-outline">' +
        '<div class="qr-sec-h">' + h + '</div>' +
        '<div class="qr-sec-b">' + body + '</div>' +
      '</section>'
    );
  }

  function tableBlock(h, tableHtml){
    return (
      '<section class="qr-sec qr-sec-table">' +
        '<div class="qr-sec-h">' + h + '</div>' +
        '<div class="qr-sec-b">' + tableHtml + '</div>' +
      '</section>'
    );
  }

  // =========================
  // COLUMN 1 (LEFT)
  // Order:
  // 1) Turn Sequence
  // 2) Movement & Engagement
  // 3) Movement Modifiers (Table)
  // 4) Combat Modifiers (Table)
  // =========================

  var turnSeqHtml =
    '<ol class="qr-ol">' +
      '<li><b>Initiative Phase:</b> Initiative Phase: Recalculate total clan Initiative. Player order = highest → lowest. Highest may choose to go last.</li>' +
      '<li><b>Movement Phase:</b> Players alternate moving one unit at a time, following player order.</li>' +
      '<li><b>Action Phase:</b> Players alternate activating one unit to attack/use abilities/interact, following player order.</li>' +
      '<li><b>Resolve Conditions:</b> Resolve all active conditions (skip Round 1).</li>' +
      '<li><b>End Round:</b> Proceed to the next round.</li>' +
    '</ol>';

  var moveEngageHtml =
    '<div class="qr-tight">' +
      '<div><b>March:</b> Move up to base Movement.</div>' +
      '<div><b>Sprint:</b> Move up to 2× base Movement; ends turn.</div>' +
      '<div><b>Charge:</b> Move up to 1.5× base Movement to melee range; immediately make 1 melee attack at -1 To-Hit; ends turn.</div>' +
      '<div><b>Climb:</b> Must end on a horizontal surface; cannot climb through units.</div>' +
      '<div><b>Overwatch:</b> Arquebus/Artillery may forgo movement; may fire during enemy movement (halts movement on hit). No extended range.</div>' +
      '<div class="qr-sp6"></div>' +
      '<div><b>Engaged:</b> Bases touching.</div>' +
      '<ul class="qr-ul">' +
        '<li>No ranged attacks while engaged.</li>' +
        '<li>Engaged units cannot be targeted by ranged attacks if engaged by 2+ enemy units.</li>' +
        '<li>Disengaging may provoke an Opportunity Attack unless prohibited.</li>' +
      '</ul>' +
    '</div>';

  var moveModsTable =
    '<table class="qr-mini">' +
      '<thead><tr><th>Terrain</th><th>Effect</th></tr></thead>' +
      '<tbody>' +
        '<tr><td><b>Rough</b></td><td>Small/Medium: -1&quot; • Cavalry/Large+: unaffected</td></tr>' +
        '<tr><td><b>Difficult</b></td><td>Small/Medium: -2&quot; • Cavalry: -4&quot; • Large+: unaffected</td></tr>' +
        '<tr><td><b>Water</b></td><td>Small/Medium unarmored: -3&quot; • Armored: requires Suieijutsu • Cavalry: max 4&quot; • Large: halved • Huge+: unaffected</td></tr>' +
      '</tbody>' +
    '</table>';

  var combatModsTable =
    '<table class="qr-mini">' +
      '<thead><tr><th>Modifier</th><th>Effect</th></tr></thead>' +
      '<tbody>' +
        '<tr><td>High Ground (≥1&quot;)</td><td>+1 To-Hit</td></tr>' +
        '<tr><td>Mounted vs Unmounted</td><td>+1 To-Hit</td></tr>' +
        '<tr><td>Cavalry Piercer (Yari/Naginata)</td><td>+1 To-Hit vs cavalry</td></tr>' +
        '<tr><td>Flank (first friendly striking)</td><td>+1 To-Hit</td></tr>' +
        '<tr><td>Nighttime</td><td>-1 To-Hit (ranged)</td></tr>' +
        '<tr><td>Partial Cover (≤50%)</td><td>-1 To-Hit</td></tr>' +
        '<tr><td>Charge Attack</td><td>-1 To-Hit</td></tr>' +
        '<tr><td>Extended Range</td><td>-1 To-Hit</td></tr>' +
      '</tbody>' +
    '</table>';

    
  var keyRulesHtml =
    '<div class="qr-tight">' +
      '<div class="qr-sp6"></div>' +
      '<div><b>Nighttime:</b> Game begins in daytime; night phases occur every two rounds.</div>' +
      '<div><b>Disputes:</b> LOS, Cover, or Targeting → roll d6; highest wins.</div>' +
      '<div><b>Tiebreakers:</b> Higher Initiative wins; if tied, roll d6; highest succeeds.</div>' +
      '<div><b>Halving:</b> Always round down; minimum 1.</div>' +
      '<div><b>Master Class Abilities:</b> Once used, the mastery is bound to that unit for the rest of the game. If the unit is removed, the mastery is lost.</div>' +
    '</div>';

      var moraleHtml =
    '<div class="qr-tight">' +
      '<div><b>Morale Check:</b> Roll d6 ≤ <b>Leadership</b>. Failure = <b>Routed</b>.</div>' +
      '<div class="qr-sp6"></div>' +
      '<div><b>When to check:</b></div>' +
      '<ul class="qr-ul">' +
        '<li>Daimyō removed from play.</li>' +
        '<li>50% of clan units (round down) removed in a single round.</li>' +
        '<li>Losing an objective.</li>' +
        '<li>Forced by abilities/auras.</li>' +
      '</ul>' +
      '<div class="qr-sp6"></div>' +
      '<div><b>Routed:</b> Sprint toward nearest table edge each activation; no attacks/abilities. If it exits, it flees and grants XP. Test Morale each round until passed.</div>' +
    '</div>';

var honorHtml =
  '<div class="qr-tight">' +
    '<div><b>Honor (XP):</b> XP gained when:</div>' +
    '<ul class="qr-ul">' +
      '<li>You reduce an enemy’s Body to 0 (removed).</li>' +
      '<li>A routed enemy flees off the table.</li>' +
      '<li>You capture an enemy (Restrained at end of game = <b>double XP</b>).</li>' +
    '</ul>' +
    '<div><b>No XP</b> for voluntary fleeing.</div>' +
    '<div><b>XP gained =</b> defeated enemy’s <b>Leadership</b>.</div>' +
  '</div>';

var losTargetHtml =
  '<div class="qr-tight">' +
    '<div><b>LOS:</b> Draw base edge → base edge.</div>' +
    '<div><b>Partial LOS:</b> Ranged attacks allowed; apply cover penalties if applicable.</div>' +
    '<div><b>Full Cover (≥50% obscured):</b> Target cannot be selected.</div>' +
    '<div class="qr-sp6"></div>' +
    '<div><b>Targeting restriction:</b> You cannot target a unit with ranged attacks if it is engaged by <b>2+</b> enemy units.</div>' +
    '<div><b>Disputes:</b> LOS / Cover / Targeting disputes = roll d6; highest result decides.</div>' +
  '</div>';


var col1 =
  '<div class="qr-col">' +
    outlineBlock('Turn Sequence', turnSeqHtml) +
    outlineBlock('Key Rules', keyRulesHtml) +
    outlineBlock('Morale', moraleHtml) +
    outlineBlock('Gaining Honor (XP)', honorHtml) +
    outlineBlock('LOS & Targeting', losTargetHtml) +
    outlineBlock('Movement & Engagement', moveEngageHtml) +
    tableBlock('Movement Modifiers', moveModsTable) +
  '</div>';

  // =========================
  // COLUMN 2 (RIGHT)
  // Order:
  // 1) Key Rules (add nighttime blurb)
  // 2) Combat Resolution
  // 3) Conditions & Saving Throws (Table)
  // =========================


  var combatResHtml =
    '<ol class="qr-ol">' +
      '<li><b>To-Hit:</b> Roll d6 vs target <b>Defense</b> or object <b>Resistance</b>; hit on <b>≥ TN</b> after modifiers.</li>' +
      '<li><b>Criticals:</b> Natural 6 = Critical Hit. Natural 1 = Critical Miss.</li>' +
      '<li><b>Auto Criticals:</b> Modified 7+ = Auto Critical Hit; modified 0− = Auto Critical Miss.</li>' +
      '<li><b>Multi-Attack:</b> Roll attacks consecutively. First hit ends remaining attempts. A Critical Miss ends all attempts.</li>' +
      '<li><b>Lucky Hit:</b> If you can only hit on a 6 (ineptitude/penalties), a natural 6 hits, but <b>no critical effects</b>.</li>' +
      '<li><b>High Defense:</b> When critically hit, defender saves vs Defense (roll ≤ Defense). Success negates critical effect; treat as normal hit. Defense 6 = High Defense.</li>' +
      '<li><b>Friendly Fire:</b> Ranged Critical Miss + LOS passes through a single friendly: on a Critical Miss, that friendly is hit instead.</li>' +
    '</ol>';

  var condTable =
    '<table class="qr-mini qr-conds">' +
      '<thead><tr><th>Condition</th><th>Saving Throw</th><th>Specification</th></tr></thead>' +
      '<tbody>' +
        '<tr><td><b>Morale Check</b></td><td>≤ Leadership</td><td>Causes Condition: <b>Routed</b></td></tr>' +
        '<tr><td><b>Routed</b></td><td>≤ Leadership</td><td>Unit must run to nearest table edge; remove if it runs beyond table edge</td></tr>' +
        '<tr><td><b>Stunned</b></td><td>—</td><td>Unit loses remaining move/action turns of round; remove at end of round</td></tr>' +
        '<tr><td><b>Concentration</b></td><td>≤ Initiative</td><td>Loss of ability effect; make saving throw only when damage is sustained</td></tr>' +
        '<tr><td><b>Frightened</b></td><td>≤ Leadership</td><td>Suffer -1 To-Hit penalty</td></tr>' +
        '<tr><td><b>Poisoned</b></td><td>≤ Body</td><td>Suffer 1 damage; must save against current Body</td></tr>' +
        '<tr><td><b>Bleeding</b></td><td>≤ Body</td><td>Suffer 1 damage; must save against current Body; do not remove condition if save is successful</td></tr>' +
        '<tr><td><b>Burning</b></td><td>≤ Defense<br>OR<br>General Action</td><td>Suffer 1 damage; lasts up to two consecutive rounds</td></tr>' +
        '<tr><td><b>Concealed (Alert)</b></td><td>≥ Initiative</td><td>Make check against concealed unit’s Initiative; must be within 2&quot; of concealed unit</td></tr>' +
        '<tr><td><b>Restrained (Arrest)</b></td><td>≥ Initiative</td><td>Make check against target unit’s Initiative; Hojojutsu required and must be engaged</td></tr>' +
        '<tr><td><b>Restrained (Rescue)</b></td><td>≥ Initiative</td><td>Make check against restrained unit’s Initiative; Hojojutsu required and must be engaged</td></tr>' +
        '<tr><td><b>Restrained (Decapitate)</b></td><td>&gt; 1 To-Hit<br>(unmodified)</td><td>Katana or Nodachi required; must cause enough damage to kill Restrained unit; all enemy units within 3&quot; make a Morale Check</td></tr>' +
        '<tr><td><b>Move Object</b><br>(up to 1&quot;)</td><td>≥ Resistance<br>(Defense)</td><td>Target object must be ≤ the unit’s base size; must be engaged with object; not a throwing mechanic</td></tr>' +
      '</tbody>' +
    '</table>';

var col2 =
  '<div class="qr-col">' +
    outlineBlock('Combat Resolution', combatResHtml) +
    tableBlock('Combat Modifiers', combatModsTable) +
    tableBlock('Conditions & Saving Throws', condTable) +
  '</div>';


  return (
    '<div class="qr-page">' +
      '<div class="qr-head">' +
        '<img class="print-logo qr-logo" src="' + logoSrc + '" alt="" aria-hidden="true">' +
        '<div class="qr-title">' + title + '</div>' +
      '</div>' +

      '<div class="qr-cols">' +
        col1 +
        col2 +
      '</div>' +
    '</div>'
  );
}

/* END SHOSHIN PRINT — QUICK REFERENCE PAGE (PRODUCTION) */




function getPrintBaseCSS() {
  // NOTE: Layout-agnostic print "normalization".
  // IMPORTANT: No @page rules here (layout-owned for future-proofing).
  return (
`html, body { padding:0; margin:0; }
* { box-sizing: border-box; }

body{
  font-family: Arial, sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

img{ max-width:100%; height:auto; }

/* hygiene */
.print-page, .print-page * { box-sizing: border-box; }
/* (layout-owned) pagination rules live in layout CSS */


/* BEGIN SHOSHIN PRINT — QR PAGES: FORCE NO BACKGROUND */
.print-page-qr .print-frag,
.print-page[data-print-layout$="qr"] .print-frag{
  background-image: none !important;
  background: #fff !important;
}
/* END SHOSHIN PRINT — QR PAGES: FORCE NO BACKGROUND */

/* BEGIN SHOSHIN PRINT — QR PAGE SIZE CONTRACT (Task 7) */
/* QR1 (Landscape) */
@media print{
  .print-page[data-print-layout="layout1-qr"] .print-frag{
    width: 11in !important;
    height: 8.5in !important;
    min-height: 8.5in !important;
  }
  /* QR2 (Portrait) */
  .print-page[data-print-layout="layout2-qr"] .print-frag{
    width: 8.5in !important;
    height: 11in !important;
    min-height: 11in !important;
  }
}
@media screen{
  .print-page[data-print-layout="layout1-qr"] .print-frag{
    width: 11in !important;
    height: 8.5in !important;
  }
  .print-page[data-print-layout="layout2-qr"] .print-frag{
    width: 8.5in !important;
    height: 11in !important;
  }
}
/* END SHOSHIN PRINT — QR PAGE SIZE CONTRACT (Task 7) */


/* BEGIN SHOSHIN PRINT — QR STYLES (PRODUCTION, NO ROTATION) */
.print-page[data-print-layout$="qr"] .qr-body{
  padding: 0.24in 0.24in 0.24in !important; /* tighter; still safe under margin changes */
  position: relative; /* QR logo can anchor to print-frag-body edge */
}



/* Page shell */
.print-page[data-print-layout$="qr"] .qr-page{
  height: 100%;
  width: 100%;
  font-family: Arial, sans-serif;
  display: flex;
  flex-direction: column;
}

/* Header line (Layout2 style: logo left, title centered) */
.print-page[data-print-layout$="qr"] .qr-head{
  /* IMPORTANT: do NOT position:relative here, or the logo is trapped inside the header box */
  position: static;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 0 10px 0;
  height: 36px;     

}


.print-page[data-print-layout$="qr"] .qr-title{
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
}

.print-page[data-print-layout$="qr"] .qr-logo{
  position: absolute;

  /* KEY: these are now relative to .print-frag-body.qr-body (because qr-head is no longer positioned) */
  left: 0;
  top: 0;

  width: auto;
  height: 40px;
  display: block;
}



/* TWO COLUMNS (AoC portrait). Collapse-height blocks. */
.print-page[data-print-layout$="qr"] .qr-cols{
  display: flex;
  gap: 24px;
  height: 100%;        /* REQUIRED */
  align-items: stretch;
}


.print-page[data-print-layout$="qr"] .qr-col{
  display: flex;
  flex-direction: column;
  justify-content: space-between; /* 🔑 THIS IS THE FIX */
}

/* Ensure children don’t add their own vertical spacing */
.print-page[data-print-layout$="qr"] .qr-col > *{
  margin-top: 0;
  margin-bottom: 0;
}


/* Section base (NO box styling by default) */
.print-page[data-print-layout$="qr"] .qr-sec{
  display: block;
}

.print-page[data-print-layout$="qr"] .qr-sec-h{
  font-weight: 800;
  font-size: 12px;
  text-align: center; /* AoC-style headings */
  margin: 0 0 4px 0;
}

.print-page[data-print-layout$="qr"] .qr-sec-b{
  font-size: 10px;
  line-height: 1.15;
}

/* Outline sections: explicitly unboxed */
.print-page[data-print-layout$="qr"] .qr-sec-outline{
  border: none;
  background: transparent;
  box-shadow: none;
  padding: 0;
}

/* Table sections: boxed + subtle pop (grayscale) */
.print-page[data-print-layout$="qr"] .qr-sec-table{
  border: 1px solid rgba(0,0,0,0.60);
  padding: 6px 6px 6px 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  background: #fff;
}

/* Tight helpers */
.print-page[data-print-layout$="qr"] .qr-tight{ font-size: 10px; line-height: 1.15; }
.print-page[data-print-layout$="qr"] .qr-sp6{ height: 6px; }
.print-page[data-print-layout$="qr"] .qr-ol{ margin: 0; padding-left: 16px; }
.print-page[data-print-layout$="qr"] .qr-ol li{ margin: 0 0 3px 0; }
.print-page[data-print-layout$="qr"] .qr-ul{ margin: 4px 0 0 0; padding-left: 16px; }
.print-page[data-print-layout$="qr"] .qr-ul li{ margin: 0 0 2px 0; }

/* Tables (AoC: hard borders + shaded headers) */
.print-page[data-print-layout$="qr"] .qr-mini{
  width: 100%;
  border-collapse: collapse;
  font-size: 9.4px;
}

.print-page[data-print-layout$="qr"] .qr-mini th,
.print-page[data-print-layout$="qr"] .qr-mini td{
  border: 1px solid rgba(0,0,0,0.65);
  padding: 3px 5px;
  text-align: left;
  vertical-align: middle;

}

.print-page[data-print-layout$="qr"] .qr-mini thead th{
  background: #d9d9d9;
  font-weight: 800;
}

/* Conditions table tighter + stable column widths */
.print-page[data-print-layout$="qr"] .qr-conds{
  font-size: 9px;
}
.print-page[data-print-layout$="qr"] .qr-conds th:nth-child(1),
.print-page[data-print-layout$="qr"] .qr-conds td:nth-child(1){ width: 34%; }
.print-page[data-print-layout$="qr"] .qr-conds th:nth-child(2),
.print-page[data-print-layout$="qr"] .qr-conds td:nth-child(2){ width: 18%; }
.print-page[data-print-layout$="qr"] .qr-conds th:nth-child(2),
.print-page[data-print-layout$="qr"] .qr-conds td:nth-child(2){
  text-align: center;
  white-space: nowrap;
}

.print-page[data-print-layout$="qr"] .qr-conds th:nth-child(3),
.print-page[data-print-layout$="qr"] .qr-conds td:nth-child(3){ width: 48%; }
/* END SHOSHIN PRINT — QR STYLES (PRODUCTION, NO ROTATION) */





/* BEGIN SHOSHIN PRINT — QR IGNORE IMAGES TOGGLE (Task 8) */
/* Treat QR pages as images-OFF regardless of toggle state */
.print-page-qr.print-images-on,
.print-page[data-print-layout$="qr"].print-images-on{
  /* Neutralize any image-coupled styles that may be added later */
  --images-enabled: 0;
}

/* QR pages: hide images EXCEPT the logo (logo must always show) */
.print-page-qr .print-frag img:not(.print-logo),
.print-page[data-print-layout$="qr"] .print-frag img:not(.print-logo){
  display: none !important;
}

/* Force logo to render even if other global rules exist */
.print-page-qr .print-logo,
.print-page[data-print-layout$="qr"] .print-logo{
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}

/* SCREEN PREVIEW: ensure QR pages look like their own “paper sheet” in Layout2 viewport too */
@media screen{
  .print-page-qr{
    background: transparent !important;
  }
  .print-page-qr .print-frag,
  .print-page[data-print-layout$="qr"] .print-frag{
    margin: 0 auto 24px auto !important;
    background: #fff !important;
    box-shadow: 0 8px 28px rgba(0,0,0,.12) !important;
  }
}

/* Ensure no image-related filters/effects apply on QR pages */
.print-page-qr,
.print-page[data-print-layout$="qr"]{
  filter: none !important;
}
/* END SHOSHIN PRINT — QR IGNORE IMAGES TOGGLE (Task 8) */

`
  );
}


function getPrintLayout1CSS() {
  // NOTE: This CSS is embedded into the print tab only (no impact on live UI).
  // Goal: stable structure + measured compaction for 4 units + 3 dividers on page 2+
  return (
`@page { size: letter landscape; margin: 0; }

/* Normalize */
html, body { margin: 0; padding: 0; }

/* =========================================================
   ROOT TOKENS (screen + print)
========================================================= */
/* BEGIN SHOSHIN — FORCE RED UTILITY (PRINT TAB SAFE) */
:root{
  /* Print-tab-safe: do NOT self-reference the variable */
  --shoshin-red: #D64040;
}

/* Bulletproof: target the exact cells we are classing in JS */
.print-cm-cell.print-cm-tag.shoshin-red{
  color: var(--shoshin-red) !important;
}
.print-row2-v.shoshin-red{
  color: var(--shoshin-red) !important;
}

/* Layout2: table tags + numeric cells */
.print-page.print-layout-2 .l2-modtag.shoshin-red,
.print-page.print-layout-2 .l2-num.shoshin-red{
  color: var(--shoshin-red) !important;
  font-weight: 500;
}

/* END SHOSHIN — FORCE RED UTILITY (PRINT TAB SAFE) */

:root{
  /* Row2 deterministic width math */
  --row2-colw: 76px; /* screen-safe default */

  /* Row2 visual spacing control (virtual gaps between groups) */
  --row2-gap: 16px;

  /* Derived widths */
  --row2-stats-w: calc(6 * var(--row2-colw));

  /* DESIGN: page inset for ALL elements (header + body) inside the paper */
  --page-inset: 4px;

  /* DESIGN: first unit drop per page (breathing room for keyline) */
  --first-unit-drop: 12px;
}

/* =========================================================
   SCREEN PREVIEW (tall-sheet, no clamping)
========================================================= */
@media screen{
  html, body{ height: auto; }

  body{
    background: #f2f2f2;
    /* padding: 24px 0;  desk space (optional) */
  }

  /* SCREEN ONLY: neutral wrapper */
  .print-page{
    width: auto;
    min-height: auto;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    background: transparent;
    box-shadow: none;
    overflow: visible; /* CRITICAL */
  }

  /* SCREEN ONLY: paper height lock */
  .print-frag{
    width: 11in;
    height: 8.5in;
    min-height: 8.5in;
    margin: 0 auto 24px auto;
    background: #fff;
    box-shadow: 0 8px 28px rgba(0,0,0,.12);
    box-sizing: border-box;

    display: flex;
    flex-direction: column;
  }

.print-frag-inner{
  flex: 1 1 auto;
  min-height: 0 !important;
  height: auto !important;
}

.print-frag-body{
  flex: 1 1 auto;
  min-height: 0 !important;
  height: auto !important;
}


  /* SCREEN ONLY: wordy Row2 values */
  .print-row2-v.is-text{ font-size: 14px; }
  .print-row2-v.is-long{ font-size: 13px; }

  /* SCREEN ONLY: tag text can be slightly larger */
  .print-cm-cell.print-cm-tag{ font-size: 7.5px; }
}

/* =========================================================
   PRINT NORMALIZATION
========================================================= */
@media print{
  :root{
    --row2-colw: 82px; /* PRINT ONLY */
  }

/* BEGIN SHOSHIN — LAYOUT1 PRINT CONTRACT SCOPE (Task 3) */
.print-page.print-layout-1 .print-frag{

    width: 11in;
    height: 8.5in;
    min-height: 8.5in;
    margin: 0;
    box-sizing: border-box;

    /* keep bg behavior consistent in print */
    background-repeat: no-repeat;
    background-position: 0 0;
    background-size: 100% 100%;
  }

.print-page.print-layout-1 .print-frag-inner{

    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;

    /* PRINT-SAFE BOTTOM INSET:
       prevents physical printers from clipping the very bottom edge */
    padding-bottom: calc(var(--page-inset) + 10px) !important;
  }

.print-page.print-layout-1 .print-frag-body{
/* END SHOSHIN — LAYOUT1 PRINT CONTRACT SCOPE (Task 3) */

    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    /* justification is controlled by your paginator (.style.justifyContent) */
  }
  /* END SHOSHIN — PRINT HEIGHT LOCK (ENABLE TRUE JUSTIFICATION) */

  .print-page{
    width: auto !important;
    max-width: none !important;
    min-height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    -webkit-box-decoration-break: slice;
    box-decoration-break: slice;
  }

  .print-header{
    position: relative !important;
    top: auto !important;
    left: auto !important;
    right: auto !important;
    height: auto !important;
    margin: 0 !important;
  }
}

/* =========================================================
   COMMON (screen + print)
========================================================= */
.print-page{ position: relative; }

/* BEGIN SHOSHIN — FLEX CONTRACT (screen + print) */
.print-frag{
  display: flex;
  flex-direction: column;
}

.print-frag-inner{
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.print-frag-body{
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
/* END SHOSHIN — FLEX CONTRACT (screen + print) */


/* BEGIN SHOSHIN — FULL PAGE BACKGROUND IMAGE (screen + print) */
/* BEGIN SHOSHIN — LAYOUT BACKGROUNDS (IMAGES TOGGLE AWARE) */
:root{
  --bg-land-url: url("/wp-content/uploads/2026/01/bgland50.webp");
  --bg-port-url: url("/wp-content/uploads/2026/01/bgport50.webp"); /* reserved for Layout2 */
}

/* Layout1: ONLY show background when Images toggle is ON */
.print-page.print-layout-1.print-images-on .print-frag{
  background-image: var(--bg-land-url);
  background-repeat: no-repeat;
  background-position: 0 0;
  background-size: 100% 100%;
}

.print-page.print-layout-1.print-images-off .print-frag{
  background-image: none !important;
}
/* END SHOSHIN — LAYOUT BACKGROUNDS (IMAGES TOGGLE AWARE) */



/* BEGIN SHOSHIN — NEUTRALIZE GLOBAL PRINT-FRAG BG DEFAULT (Task 2) */
/* Put bg on the full paper, not the padded inner wrapper */
.print-frag{
  background-color:#fff;
  /* IMPORTANT: No global default background image.
     Backgrounds are controlled ONLY by layout-scoped rules
     (e.g., .print-page.print-layout-1.print-images-on ...) */
  background-image: none;
  background-repeat: no-repeat;
  background-position: 0 0;
  background-size: 100% 100%;
}
/* END SHOSHIN — NEUTRALIZE GLOBAL PRINT-FRAG BG DEFAULT (Task 2) */


/* Disable the inner overlay bg so it doesn't fight the image */
.print-bg{
  display: none !important;
}
/* END SHOSHIN — FULL PAGE BACKGROUND IMAGE (screen + print) */


/* BEGIN SHOSHIN — DIVIDER IMAGE DROP (visual-only, no height change) */
:root{
  --divider-img-drop: 4px; /* tweak: 4px, 6px, 8px */
}

.shoshin-divider-row{
  position: relative;
  overflow: visible; /* allow overlap into Row1 below */
}

/* move ONLY the divider image, not the container */
.shoshin-divider-row img.print-section-divider{
  transform: translateY(var(--divider-img-drop));
  transform-origin: center;
}
/* END SHOSHIN — DIVIDER IMAGE DROP (visual-only, no height change) */


/* DESIGN: unified inset for header + body within the paper */
.print-frag-inner{
  padding: var(--page-inset);
  box-sizing: border-box;
}

.print-bg{
  position:absolute; inset:0;
  opacity: 0.06;
  background: radial-gradient(circle at 20% 10%, #000 0%, transparent 55%),
              radial-gradient(circle at 80% 90%, #000 0%, transparent 55%);
  pointer-events:none;
}

/* HEADER LAYOUT CONTRACT */
.print-header{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
  position: relative;
  z-index: 1;
}

.print-header-left{
  display: flex;
  align-items: flex-end;
  gap: 18px;
  min-width: 0;
  flex: 1 1 auto;
  padding-top:12px;
  padding-left:12px;
}

.print-logo{
  width: 180px;
  height: auto;
  display: block;
  flex: 0 0 auto;
}

.print-header-titles{
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.print-roster-name{
  font-family: "Viner Hand ITC", "Viner Hand", cursive;
  font-size: 24px;
  line-height: 1.05;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.print-roster-sub{
  font-family: Arial, sans-serif;
  font-size: 10px;
  color:#333;
  font-weight: 600;
  opacity: 0.95;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.print-header-right{
  display: flex;
  align-items: flex-start;
  flex: 0 0 auto;
  white-space: nowrap;
  padding-top:8px;
  padding-right:12px;
}

.print-header-boxes{
  display: flex;
  gap: 16px;
  justify-content: flex-end;
  flex-wrap: nowrap;
}

.print-hbox{ display:flex; align-items:center; gap:10px; }

.print-hbox-num{
  border: 1px solid #111;
  width: 54px;
  height: 36px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-family: Arial, sans-serif;
  font-size: 18px;
  font-weight: 400;
  line-height: 1;
  background-color:#fff;
}

.print-hbox-label{
  font-family: "Viner Hand ITC", "Viner Hand", cursive;
  font-size: 17px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}



/* =========================================================
   FIRST UNIT ROW DROP (per page)
========================================================= */
.print-frag-body > .print-unit-group:first-child,
.print-frag-body > .print-unit-row:first-child{
  margin-top: var(--first-unit-drop) !important;
}

/* =========================================================
   ATOMIC UNITS (pagination hard-guard lives here)
========================================================= */
.print-unit-row{
  margin-top: 0;
  padding: 2px 10px;

  break-inside: avoid;
  page-break-inside: avoid;
  -webkit-column-break-inside: avoid;
}

/* =========================================================
   ROW1 / Combat Modifiers
========================================================= */
.print-cm-keyline{
  position: absolute;
  left: 0; right: 0;
  top: -14px; /* keep above tagbox */
  font-size: 10px;
  line-height: 1.1;
  text-align: center;
  color: #111;
  white-space: nowrap;
  pointer-events: none;
  margin: 0;
}

.print-cm-row1{
  display:flex;
  width:100%;
  gap:10px;
  justify-content: space-between;
  align-items: flex-start;
}

/* positioning context for absolute keyline */
.print-row-block-cm{
  margin-top: 4px;
  position: relative;
  z-index: 2;
}

/* Col1: thumb + title + ref + cost */
.print-cm-col1box{
  width: 230px;
  display:flex;
  align-items:center;
  justify-content:flex-start;
  padding-left: 8px;
  min-width: 0;
}

.print-cm-col1media{
  display:flex;
  align-items:center;
  gap:10px;
  min-width:0;
}

.print-cm-thumb{
  width: 64px;
  height: 64px;
  display:block;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #111;
  flex: 0 0 auto;
}

.print-cm-col1stack{
  display:flex;
  flex-direction:column;
  justify-content:center;
  gap:2px;
  min-width:0;
}

.print-cm-col1-title{
  font-family: "Viner Hand ITC", "Viner Hand", cursive;
  font-size: 21px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Col2 spacer / right aligned */
.print-cm-col2box{
  flex: 1 1 auto;
    font-family: "Viner Hand ITC", "Viner Hand", cursive;
  font-size: 16px;
  text-align: right;
  display:flex;
  align-items:center;
  justify-content:flex-end;
  min-width:0;
  align-self:center;
}

/* Col3 brace */
.print-cm-col3box{
  /*width: 26px;*/
  display:flex;
  align-items:center;
  justify-content:center;
  align-self:center;
}

/* Tags block */
.print-cm-tagsbox{
  background:#fff;
  border:1px solid #111;
  border-radius:0;
  padding: 4px;
  flex: 0 0 auto;
  position: relative;

  /* Match Row2 stats width so right edges can align */
  width: var(--row2-stats-w);
  box-sizing: border-box;
}

/* Tag grid: FIT TO BOX (screen + print) */
.print-cm-tags-grid{
  width: 100%;
  box-sizing: border-box;

  display:grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: repeat(4, 12px);
  gap: 4px;
  align-items: stretch;
}

.print-cm-tags-grid.is-rows-1{ transform: translateY(8px); }
.print-cm-tags-grid.is-rows-3{ transform: translateY(-8px); }

.print-cm-cell{
  padding: 2px 4px;
  line-height: 1.1;
  min-height: 0;
  box-sizing: border-box;
  font-size: 10px;
}

/* TAG TEXT: AUTO-FIT (NO WRAP, NO ELLIPSIS, NO CLIP) */
.print-cm-cell.print-cm-tag{
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;

  /* fit tuning */
  font-size: 8.5px;
  line-height: 1;
  letter-spacing: -0.15px;

  /* gentle horizontal squeeze (no hiding/truncation) */
  display: inline-block;
  transform: scaleX(0.96);
  transform-origin: left center;
}

/* Col1 ref/cost styling */
.print-cm-col1{ border-color: transparent; background: transparent; padding: 0; }

.print-cm-col1-refline{ display:flex; align-items:baseline; gap:6px; white-space:nowrap; }
.print-cm-col1-refid{ font-size:12px; font-weight:600; letter-spacing:0.2px; vertical-align:bottom; }
.print-cm-col1-qty{ font-size:11px; font-weight:500; vertical-align:bottom; font-style:italic; }

.print-cm-col1-costline{ display:flex; align-items:baseline; gap:6px; white-space:nowrap; text-transform:uppercase; font-weight:400; }
.print-cm-col1-costlabel{ font-weight:600; vertical-align:bottom; }
.print-cm-col1-costval{ font-weight:600; vertical-align:bottom; }
.print-cm-col1-costpct{ font-weight:500; vertical-align:bottom; font-style:italic; }

/* Brace glyph */
.print-cm-brace-inner{
  font-size: 56px;
  line-height: 1;
  font-weight: 100;
  font-family:
    "Palace Script MT",
    Candara,
    "Eras Light ITC",
    Gabriola,
    "Helvetica Light",
    "Segoe UI",
    Perpetua,
    Parchment,
    "Times New Roman",
    serif;
  transform: translateY(-4px);
}

/* =========================================================
   ROW2
========================================================= */
.print-row-block-row2{ margin-top: 4px; }

/* FULL WIDTH + FIXED SPACERS (no gap; we use margins on middle group) */
.print-row2{
  display:flex;
  width:100%;
  align-items:flex-start;
  justify-content: space-between; /* occupy full width */
  gap: 0 !important;              /* we are not using gap */
}

.print-row2-group{
  border:none;
  background:transparent;
  box-sizing:border-box;
}

.print-row2-group-melee{ width: calc(3 * var(--row2-colw)); }
.print-row2-group-ranged{ width: calc(3 * var(--row2-colw)); }
.print-row2-group-stats{ width: var(--row2-stats-w); }

/* “virtual” gaps */
.print-row2-group-ranged{
  margin-left: var(--row2-gap);
  margin-right: var(--row2-gap);
}

.print-row2-group-title{
  text-align:center;
  font-weight:600;
  letter-spacing:0.6px;
  font-size: 12px;
  padding: 2px 8px 4px;
  line-height:1;
  position:relative;
  background:transparent;
  border:none;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:12px;
}

.print-row2-group-title::before,
.print-row2-group-title::after{
  content:"";
  flex:1 1 auto;
  height:0;
  border-top:1px solid #333;
  opacity:0.65;
}

.print-row2-grid{
  display:grid;
  gap:0;
  width:100%;
  background:#fff;
  border:1px solid #333;
  box-sizing:border-box;
  overflow:hidden;
}

.print-row2-grid-3{ grid-template-columns: repeat(3, var(--row2-colw)); }
.print-row2-grid-6{ grid-template-columns: repeat(6, var(--row2-colw)); }

.print-row2-h,
.print-row2-v{
  box-sizing:border-box;
  border:0;
  border-right:1px solid #333;
  border-bottom:1px solid #333;
  min-width:0;
}

.print-row2-grid-3 > :nth-child(3n).print-row2-h,
.print-row2-grid-3 > :nth-child(3n).print-row2-v{ border-right:0; }

.print-row2-grid-6 > :nth-child(6n).print-row2-h,
.print-row2-grid-6 > :nth-child(6n).print-row2-v{ border-right:0; }

.print-row2-v{ border-bottom:0; }

/* headers */
.print-row2-h{
  color:#fff;
  font-weight:600;
  text-align:center;
  padding: 6px 6px;
  font-size: 12px;
  line-height:1;
  white-space:nowrap;
}

/* values */
.print-row2-v{
  text-align:center;
  font-weight:400;
  font-size: 18px;
  line-height:1;
  padding: 8px 6px;

  /* guard against 5 units per page */
  min-height: 40px !important;

  display:flex;
  align-items:center;
  justify-content:center;
}

/* color scheme */
.print-row2-h-melee{ background:#a34f2f; }
.print-row2-h-ranged{ background:#3e556e; }
.print-row2-h-stats{ background:#2f6b4e; }

/* =========================================================
   COMPACTION (applies to screen + print; matches your 1:1 goal)
========================================================= */
@media screen, print{
  /* tighten unit padding */
  .print-unit-row{ padding: 2px 8px; }

  /* tighten Row2 title band + cell rhythm */
  .print-row2-group-title{
    padding: 1px 6px 2px;
    font-size: 11px;
  }

  .print-row2-h{
    padding: 4px 4px;
    font-size: 11px;
  }

  .print-row2-v{
    font-size: 16px;
    padding: 4px 4px;
    min-height: 40px !important;
  }

/* BEGIN SHOSHIN — DIVIDER BREATHING ROOM (SLACK-ONLY) */
/* Divider spacing must be applied to the TOP-LEVEL divider wrapper. */
.print-divider-group{
  padding-top: 6px;
  padding-bottom: 6px;
  box-sizing: border-box;
}

/* Keep the inner visual wrapper “clean” so we don’t double-spend padding. */
.shoshin-divider-row{
  padding-top: 0;
  padding-bottom: 0;
  box-sizing: border-box;
}
/* END SHOSHIN — DIVIDER BREATHING ROOM (SLACK-ONLY) */



}
`
  );
}



// (favicon helpers defined earlier; duplicate block removed)


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
          '<div class="shoshin-unassign-preview-ref">' + (refId ? esc(refId) : '—') + '</div>' +
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
           '<div class="shoshin-unassign-preview-col-title">Before <span id="shoshin-unassign-pct-before" class="shoshin-unassign-preview-pct"></span></div>' +

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


    // -------------------------------------------------------------------------
  // OWNED ASSETS (2247 + 2501) payload for Row1 "Assign Units" modal
  // Source: data-shoshin-assets-json on the roster list container
  // -------------------------------------------------------------------------
  var ownedAssets = [];
  try {
    ownedAssets = JSON.parse(listEl.getAttribute('data-shoshin-assets-json') || '[]');
    if (!Array.isArray(ownedAssets)) ownedAssets = [];
  } catch (e2) {
    ownedAssets = [];
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
    if (label === '~500') return (points >= 0 && points <= 500);
    if (label === '~1000') return (points >= 501 && points <= 1000);
    if (label === '~2500') return (points >= 1001 && points <= 2500);
    if (label === '2500+') return (points >= 2501);
    return true;
  }

  function buildPointsFilterBar() {
    if (!wrapperEl) return null;

    var existing = wrapperEl.querySelector('.shoshin-roster-filters');
    if (existing) return existing;

    var labels = ['All Rosters', '~500', '~1000', '~2500', '2500+'];

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
      (r && r.assigned_units_json != null ? r.assigned_units_json : null) ||
      r.field_9 ||
      r['9'] ||
      '';

    // Accept already-parsed arrays (some roster JSON sources provide this)
    if (Array.isArray(assignedRaw)) return assignedRaw;

    // Accept already-parsed objects that contain an array (defensive)
    if (assignedRaw && typeof assignedRaw === 'object') {
      // If someone stored {assigned: [...]}, etc. try common shapes
      if (Array.isArray(assignedRaw.assigned)) return assignedRaw.assigned;
      // Otherwise fall through to string parse
    }

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
      var clsKey = String(u.cls || u.class || u.className || '').toLowerCase().replace(/\s+/g, ' ').trim();
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

  function computeAssignedStripPercentMapForce100(grouped, clanPoints) {
  var out = {};
  clanPoints = asInt(clanPoints, 0);
  if (!grouped || !grouped.length || clanPoints <= 0) return out;

  // Build items (unitKey + rowTotalPoints)
  var items = [];
  var anyPositive = false;

  function pickCost(u) {
    if (!u || typeof u !== 'object') return 0;
    var stats = (u.stats && typeof u.stats === 'object') ? u.stats : null;

    function pick() {
      for (var i = 0; i < arguments.length; i++) {
        var k = arguments[i];

        // top-level
        if (u[k] != null && String(u[k]).trim() !== '') return u[k];

        // stats fallback
        if (stats && stats[k] != null && String(stats[k]).trim() !== '') return stats[k];
      }
      return null;
    }

    var cost = pick('cost', 'points', 'pt', 'pts');
    return isNumericLike(cost) ? asInt(cost, 0) : 0;
  }

  for (var i = 0; i < grouped.length; i++) {
    var u = grouped[i] || {};
    var unitKey = String(u.unitKey || '').trim();
    if (!unitKey) unitKey = makeUnitKey(u);

    var qty = asInt(u.qty, 0);
    if (qty < 0) qty = 0;

    var unitCost = pickCost(u);
    var rowTotal = qty * unitCost;
    if (rowTotal < 0) rowTotal = 0;

    if (rowTotal > 0) anyPositive = true;

    var exact = (rowTotal / clanPoints) * 100;
    var base = Math.floor(exact);
    var rem = exact - base;

    if (base < 0) base = 0;
    if (base > 100) base = 100;

    items.push({ unitKey: unitKey, base: base, rem: rem, rowTotal: rowTotal, idx: i });
  }

  if (!anyPositive) return out;

  // Sum floors
  var sumBase = 0;
  for (var j = 0; j < items.length; j++) sumBase += items[j].base;

  var remaining = 100 - sumBase;

  // Sort by remainder desc, then rowTotal desc, then stable index
  items.sort(function (a, b) {
    if (b.rem !== a.rem) return b.rem - a.rem;
    if (b.rowTotal !== a.rowTotal) return b.rowTotal - a.rowTotal;
    return a.idx - b.idx;
  });

  if (remaining > 0) {
    // Distribute only among positive rows
    var positives = items.filter(function (x) { return x.rowTotal > 0; });
    var pool = positives.length ? positives : items;
    for (var k = 0; k < remaining; k++) pool[k % pool.length].base += 1;
  } else if (remaining < 0) {
    // Rare clamp edge: subtract from smallest remainders first
    items.sort(function (a, b) {
      if (a.rem !== b.rem) return a.rem - b.rem;
      if (a.rowTotal !== b.rowTotal) return a.rowTotal - b.rowTotal;
      return a.idx - b.idx;
    });

    var take = Math.abs(remaining);
    for (var m = 0; m < take; m++) {
      var t = items[m % items.length];
      if (t.base > 0) t.base -= 1;
    }
  }

  // Emit map
  for (var p = 0; p < items.length; p++) {
    var v = items[p].base;
    if (v < 0) v = 0;
    if (v > 100) v = 100;
    out[items[p].unitKey] = v;
  }

  return out;
}


  function renderAssignedStripRow(u, rosterEntryId, clanPointsForPercent, percentMap) {


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

        // Display hygiene: normalize smart quotes in distance fields immediately
mDis = assignUnitsNormalizeQuotes(mDis);
rDis = assignUnitsNormalizeQuotes(rDis);
mov  = assignUnitsNormalizeQuotes(mov);

    // Support assets: ATK and MOV are semantically N/A when stored as 0
    if (kind === 'support') {
      if (String(atk) === '0') atk = '--';
      if (String(mov) === '0') mov = '--';
    }

      var bod  = pick('bod', 'body');
    var ldr  = pick('ldr', 'leadership');
    var ini  = pick('ini', 'initiative');

    // Row3 display rule (support assets):
    // If top-level ini is numeric 0, prefer the semantic display value from stats.ini (e.g., "Highest").
    if (kind === 'support' && (ini === 0 || String(ini) === '0')) {
      var statsIni = (u && u.stats && u.stats.ini != null) ? String(u.stats.ini).trim() : '';
      if (statsIni) ini = statsIni;
    }


    var unitCost = isNumericLike(cost) ? asInt(cost, 0) : 0;
    var totalCost = qty * unitCost;

    var unitKey = String(u.unitKey || '').trim();
if (!unitKey) unitKey = makeUnitKey(u);


   // % of Clan Points (forced to sum to 100 across all rows)
var clanPoints = asInt(clanPointsForPercent, 0);

var percentOfClan = 0;
if (percentMap && unitKey && percentMap[unitKey] != null) {
  percentOfClan = asInt(percentMap[unitKey], 0);
} else if (clanPoints > 0) {
  // Fallback (should not be hit once wired)
  percentOfClan = Math.floor((totalCost / clanPoints) * 100);
}





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
if ((clanPoints <= 0 || !asInt(r.unitCount, 0)) && Array.isArray(grouped) && grouped.length) {
  var totalsBootstrap = computeRosterTotalsFromAssigned(grouped);

  // Points
  clanPoints = asInt(totalsBootstrap.points, 0);
  r.points = clanPoints;

  // Also bootstrap Row2 fields so initial render is accurate
  r.unitCount   = asInt(totalsBootstrap.unitCount, 0);
  r.initiative  = asInt(totalsBootstrap.initiative, 0);
  r.honor       = asInt(totalsBootstrap.honor, 0);
  r.counts      = totalsBootstrap.counts || r.counts || {};
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
          '<div class="shoshin-roster-assigned-scroll-inner">' +
            '<table class="shoshin-stat-strip shoshin-assigned-strip">' +
              '<tbody>';


            var percentMap = computeAssignedStripPercentMapForce100(grouped, clanPoints);


      for (var i = 0; i < grouped.length; i++) {
  row3BodyHtml += renderAssignedStripRow(grouped[i], rosterEntryId, clanPoints, percentMap);

}


            row3BodyHtml +=
              '</tbody>' +
            '</table>' +
          '</div>' +
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

          '<button type="button" class="shoshin-btn shoshin-btn-assign shoshin-btn-assign-roster" data-tooltip="Bulk Assignment" aria-label="Bulk Assignment">' +
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
    // Row1 Assign button (open Assign Units modal)
    // -----------------------------
    if (btn.classList.contains('shoshin-btn-assign-roster')) {
      var cardAssign = btn.closest('.shoshin-roster-card');
      if (!cardAssign) return;

      var ridAssign = asInt(cardAssign.getAttribute('data-roster-entry-id'), 0);
      if (!ridAssign) {
        console.warn('Shoshin: Assign click missing roster entryId.');
        return;
      }

      openAssignUnitsModalForRosterEntryId(ridAssign, btn);
      return;
    }

    // BEGIN SHOSHIN PRINT P1-A — Row1 Print button (open Print modal)
if (btn.classList.contains('shoshin-btn-print')) {
  var cardPrint = btn.closest('.shoshin-roster-card');
  if (!cardPrint) return;

  var ridPrint = asInt(cardPrint.getAttribute('data-roster-entry-id'), 0);
  if (!ridPrint) {
    console.warn('Shoshin: Print click missing roster entryId.');
    return;
  }

  openPrintModalForRosterEntryId(ridPrint, btn);
  return;
}
// END SHOSHIN PRINT P1-A



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


      // Ensure modal DOM exists BEFORE we inject the roster strip
      ensureDeleteModal();
      setDeleteModalRosterStrip(rosterObj);

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


                // Build asset summary (same sources as the assigned strip uses)
      var typeTextA = unitLabel || '';
      var refTextA  = unitRef || '';
      var imgA      = '';
      var totalQtyA = 0;
      var totalCostA = 0;

      try {
        var groupedA = groupAssigned(parseAssigned(rosterObj2 || {}));
        for (var kA = 0; kA < groupedA.length; kA++) {
          var rowA = groupedA[kA] || {};
          if (String(rowA.unitKey || '').trim() === unitKey) {
            // Type
            if (!typeTextA) typeTextA = String(rowA.cls || rowA.class || rowA.supportType || '').trim();

            // REF ID
            if (!refTextA) refTextA = String(rowA.refId || rowA.ref_id || '').trim();

            // Image
            imgA = String(rowA.img || rowA.image || rowA.imgUrl || '').trim();

            // Total QTY (grouped)
            totalQtyA = (rowA.qty != null) ? asInt(rowA.qty, 1) : 1;

            // Total Cost = unit points * qty
            var unitPtsA = asInt(rowA.points, asInt(rowA.cost, 0));
            totalCostA = unitPtsA * totalQtyA;
            break;
          }
        }
      } catch (_) {}

      // Ensure modal exists, then inject the asset card into the shared preview host
      ensureDeleteModal();
      setDeleteModalRosterStrip(null); // prevent roster strip from occupying the same preview host
      setDeleteModalAssetCard({
        img: imgA,
        type: typeTextA || 'Unit',
        refId: refTextA || '—',
        totalQty: totalQtyA || 1,
        totalCost: totalCostA
      });



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


          // 3) Ensure rosterObj2.assigned_units_json stays consistent even if server did not echo it back
if (rosterObj2 && (!data || data.assigned_units_json == null)) {
  try {
    var a = parseAssigned(rosterObj2 || {});
    var filtered = [];
    for (var fi = 0; fi < a.length; fi++) {
      var ak = String(a[fi] && a[fi].unitKey || '').trim();
      if (ak && ak === unitKey) continue;
      filtered.push(a[fi]);
    }
    rosterObj2.assigned_units_json = JSON.stringify(filtered);
  } catch (_) {}
}

// 4) Canonical in-place refresh (rebuild Row3 rows + recalc totals/%)
if (typeof assignUnitsApplyRosterUpdateToDom === 'function' && rosterObj2) {
  assignUnitsApplyRosterUpdateToDom(rosterObj2);
} else {
  // Safety fallback (should not hit)
  var totals = computeRosterTotalsFromAssigned(parseAssigned(rosterObj2 || {}));
  updateRosterCardStatsInDom(card2, rosterObj2, totals);
  if (typeof applyRosterFilterAndPaging === 'function') applyRosterFilterAndPaging();
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


  // ===========================================================================
  // Row3 Tooltip Portal (FIRST assigned row only)
  // - Needed because CSS pseudo-element tooltips cannot escape overflow:auto clipping
  // - Creates a single tooltip element appended to <body> and positions it on hover/focus
  // ===========================================================================

  (function initRow3TooltipPortal() {
    var portalEl = null;
    var activeBtn = null;

    function ensurePortal() {
      if (portalEl) return portalEl;
      portalEl = document.createElement('div');
      portalEl.id = 'shoshin-tooltip-portal';
      portalEl.setAttribute('role', 'tooltip');
      document.body.appendChild(portalEl);
      portalEl.style.left = '-9999px';
      portalEl.style.top = '-9999px';
      portalEl.style.visibility = 'hidden';

      return portalEl;
    }

    function isRow3FirstAssignedRowTooltip(btn) {
      if (!btn || !btn.matches || !btn.matches('.shoshin-btn[data-tooltip]')) return false;

      var scroller = btn.closest('.shoshin-roster-assigned-scroll');
      if (!scroller) return false;

      // Must be inside the assigned strip table
      var tr = btn.closest('tr');
      if (!tr) return false;

      var tbody = tr.parentElement;
      if (!tbody || tbody.tagName !== 'TBODY') return false;

      // Only the FIRST row of that tbody
      if (tbody.firstElementChild !== tr) return false;

      // Extra guard: ensure this is the assigned strip table
      var table = btn.closest('table.shoshin-assigned-strip');
      if (!table) return false;

      return true;
    }

        function positionPortal(btn) {
      if (!portalEl || !btn) return;

      var rect = btn.getBoundingClientRect();

      // Center X of button
      var x = rect.left + rect.width / 2;

      // Tooltip should sit above button with 10px gap (same intent as your pseudo tooltips)
      var gap = 10;

      // Set text first
      portalEl.textContent = btn.getAttribute('data-tooltip') || '';

      // Prepare for measurement without showing
      portalEl.classList.remove('is-open');
      portalEl.style.visibility = 'hidden';
      portalEl.style.left = '0px';
      portalEl.style.top = '0px';

      // Measure (invisible, but on-screen so it has dimensions)
      var tipRect = portalEl.getBoundingClientRect();

      // Clamp X so tooltip never goes offscreen
      var margin = 8;
      var halfW = tipRect.width / 2;
      var minX = margin + halfW;
      var maxX = window.innerWidth - margin - halfW;
      if (x < minX) x = minX;
      if (x > maxX) x = maxX;

      // Compute top so tooltip is above the button
      var top = Math.round(rect.top - gap - tipRect.height);

      // Position using left as CENTER, CSS transform handles -50% translateX
      portalEl.style.left = Math.round(x) + 'px';
      portalEl.style.top = top + 'px';
            portalEl.style.visibility = 'visible';


      // Reveal + animate next frame (prevents any origin flash/jitter)
      requestAnimationFrame(function () {
        if (!portalEl) return;
        portalEl.classList.add('is-open');
      });
    }



    function openPortal(btn) {
      if (!isRow3FirstAssignedRowTooltip(btn)) return;

      ensurePortal();
      activeBtn = btn;

      // Mark button so CSS pseudo-tooltip is suppressed
      btn.classList.add('shoshin-tooltip-portal');

      positionPortal(btn);
    }

    function closePortal(btn) {
      if (!portalEl) return;

      // Only close if we're closing the active one (or no button passed)
      if (btn && activeBtn && btn !== activeBtn) return;

            portalEl.classList.remove('is-open');
      portalEl.style.left = '-9999px';
      portalEl.style.top = '-9999px';
      portalEl.style.visibility = 'hidden';


      if (activeBtn) activeBtn.classList.remove('shoshin-tooltip-portal');
      activeBtn = null;
    }

    // Delegated events: support both mouse and keyboard
    document.addEventListener('mouseenter', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.shoshin-btn[data-tooltip]') : null;
      if (!btn) return;
      openPortal(btn);
    }, true);

    document.addEventListener('mouseleave', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.shoshin-btn[data-tooltip]') : null;
      if (!btn) return;
      closePortal(btn);
    }, true);

    document.addEventListener('focusin', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.shoshin-btn[data-tooltip]') : null;
      if (!btn) return;
      openPortal(btn);
    });

    document.addEventListener('focusout', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.shoshin-btn[data-tooltip]') : null;
      if (!btn) return;
      closePortal(btn);
    });

    // Keep tooltip positioned on scroll/resize
    window.addEventListener('scroll', function () {
      if (portalEl && activeBtn) positionPortal(activeBtn);
    }, true);

    window.addEventListener('resize', function () {
      if (portalEl && activeBtn) positionPortal(activeBtn);
    });
  })();



  // Minimal fallback display if an icon fails and sets data-icon-fallback
  // (Your existing CSS hides button text via font-size:0; this ensures something still shows.)
  var style = document.createElement('style');
  style.textContent =
    '.shoshin-btn[data-icon-fallback]::before{content:attr(data-icon-fallback);font-size:16px;line-height:1;}' +
    '.shoshin-btn .shoshin-btn-icon{pointer-events:none;}';
  document.head.appendChild(style);
});
