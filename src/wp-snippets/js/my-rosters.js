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
    var iconUrl =
      r.icon ||
      r.icon_url ||
      r.roster_icon ||
      r.field_8 ||
      r['8'] ||
      '';
    iconUrl = String(iconUrl || '').trim();
    if (!iconUrl) iconUrl = '/wp-content/uploads/2025/12/Helmet-grey.jpg';
    return iconUrl;
  }

  function renderAssignedStripRow(u, rosterEntryId) {
    var img = String(u.img || u.image || u.imgUrl || '').trim();
    if (!img) img = '/wp-content/uploads/2025/12/Helmet-grey.jpg';

    var unitType = String(u.cls || u.class || u.supportType || '').trim() || '—';
    var refId = String(u.refId || u.ref_id || '').trim() || '—';
    var qty = asInt(u.qty, 1);
    if (qty < 0) qty = 0;

    function pick() {
      for (var i = 0; i < arguments.length; i++) {
        var v = u[arguments[i]];
        if (v != null && String(v).trim() !== '') return v;
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

        // 2) REF ID
        '<td class="shoshin-assigned-plain-td">' +
          '<div class="shoshin-stat-cell">' +
            '<div class="shoshin-stat-label"></div>' +
            '<div class="shoshin-stat-value">' + esc(refId) + '</div>' +
          '</div>' +
        '</td>' +

        // 3) CLASS TYPE
        '<td class="shoshin-assigned-plain-td">' +
          '<div class="shoshin-stat-cell">' +
            '<div class="shoshin-stat-label"></div>' +
            '<div class="shoshin-stat-value">' + esc(unitType) + '</div>' +
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
          '<button type="button" class="shoshin-btn shoshin-btn-unassign" title="Unassign Units" aria-label="Unassign Units" data-entry-id="' + esc(rosterEntryId) + '">' +
            iconImg(ICONS.unassign, 'Unassign', '📤') +
          '</button>' +
          '<button type="button" class="shoshin-btn shoshin-btn-remove" title="Remove Units" aria-label="Remove Units" data-entry-id="' + esc(rosterEntryId) + '">' +
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

    card.innerHTML =
      // ROW 1
      '<div class="shoshin-asset-row1">' +

        '<div class="shoshin-asset-avatar">' +
          '<img src="' + esc(iconUrl) + '" alt="" />' +
        '</div>' +

        '<div class="shoshin-asset-header-main">' +
          '<h2 class="shoshin-asset-class-name">' + esc(clanName) + '</h2>' +
          '<div class="shoshin-asset-class-desc"><strong>Total Clan Points:</strong> ' + esc(clanPoints) + '</div>' +
          '<div class="shoshin-asset-class-desc"><strong>Master Class Abilities:</strong> <strong>' + esc(masterClassAvail) + '</strong></div>' +
        '</div>' +

        '<div class="shoshin-asset-actions row1-actions">' +

          '<button type="button" class="shoshin-btn shoshin-btn-assign shoshin-btn-assign-roster" data-tooltip="Assign Units" aria-label="Assign Units">' +
            iconImg(ICONS.assign, 'Assign', '＋') +
          '</button>' +

          '<button type="button" class="shoshin-btn shoshin-btn-edit" data-tooltip="Edit Roster" aria-label="Edit Roster">' +
            iconImg(ICONS.edit, 'Edit', '✏️') +
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
    if (btn.classList.contains('shoshin-btn-assign-roster')) {
      window.location.href = '/my-assets';
      return;
    }

    // Row1 Delete button (stub confirm only for now)
    if (btn.classList.contains('shoshin-btn-delete')) {
      var okDel = window.confirm('Are you sure? Deleting a clan is permanent and not a recoverable action.');
      if (!okDel) return;
      alert('Delete is scoped for a later phase (PHP entry delete).');
      return;
    }

    // -----------------------------
    // Row3 Remove (set qty=0)
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

      var ok = window.confirm('Are you sure? This will remove all assigned quantity for this unit build.');
      if (!ok) return;

      postAjax('shoshin_set_unit_qty', {
        rosterEntryId: String(entryId),
        unitKey: unitKey,
        qty: '0'
      }).then(function () {
        tr.parentNode && tr.parentNode.removeChild(tr);

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
      }).catch(function (err) {
        alert(err && err.message ? err.message : 'Failed to remove assignment.');
      });

      return;
    }

    // -----------------------------
    // Row3 Unassign: focus qty input
    // -----------------------------
      if (btn.classList.contains('shoshin-btn-unassign')) {
        alert('Unassign will be implemented next (this row is display-only for now).');
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
