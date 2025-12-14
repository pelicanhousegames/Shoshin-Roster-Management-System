document.addEventListener('DOMContentLoaded', function () {
  // =============================================================================
  // Shoshin /my-rosters — Row 3 (Task 4B)
  // - Unassign now persists to WPForms via admin-ajax.php (Task 4A PHP)
  // - Live UI update: decrement qty or remove row; show empty state if none left
  // =============================================================================

  var listEl = document.querySelector('.shoshin-roster-list[data-shoshin-rosters-json]');
  if (!listEl) return;

  // AJAX config injected by shortcode PHP
  var ajaxUrl = String(listEl.getAttribute('data-shoshin-ajax-url') || '').trim();
  var ajaxNonce = String(listEl.getAttribute('data-shoshin-ajax-nonce') || '').trim();

  // ---------------------------------------------------------------------------
  // Helpers (safe + minimal)
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

  function normalizeKind(k) {
    k = String(k || '').toLowerCase();
    if (k === 'character' || k === 'char') return 'character';
    if (k === 'support' || k === 'asset') return 'support';
    return k || 'asset';
  }

  function classOrderKey(kind, cls) {
    var k = normalizeKind(kind);
    var prefix = (k === 'character') ? '0' : '1';
    return prefix + '|' + String(cls || '').toLowerCase();
  }

  function buildEmptyAssignedHtml() {
    return '<div class="shoshin-expansion-empty">No units assigned yet.</div>';
  }

  // Robust JSON parsing helper
  function safeJsonParse(str, fallback) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
  }

  // ---------------------------------------------------------------------------
  // Parse rosters JSON payload
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

  // Sort roster cards by Ref ID ASC (extra safety)
  rosters = rosters.slice().sort(function (a, b) {
    var ar = String((a && (a.refId || a.ref_id)) || '');
    var br = String((b && (b.refId || b.ref_id)) || '');
    return ar.localeCompare(br, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Render
  listEl.innerHTML = '';

  for (var i = 0; i < rosters.length; i++) {
    var r = rosters[i] || {};

    // ---------------------------------------------------------
    // Roster Icon (WPForms Field #8) + default
    // ---------------------------------------------------------
    var iconUrl =
      r.icon ||
      r.icon_url ||
      r.roster_icon ||
      r.field_8 ||
      r['8'] ||
      '';
    iconUrl = String(iconUrl || '').trim();
    if (!iconUrl) iconUrl = '/wp-content/uploads/2025/12/Helmet-grey.jpg';

    // ---------------------------------------------------------
    // Roster core fields
    // ---------------------------------------------------------
    var refIdRaw = r.refId || r.ref_id || '';
    var refId = refIdRaw ? String(refIdRaw) : '';
    var clanName = String(r.name || r.roster_name || 'Untitled Roster');

    var clanPoints = asInt(r.points || r.clanPoints, 0);
    var masterClassAvail = Math.floor(clanPoints / 125);

    var rosterEntryId = asInt(r.entryId, 0);

    // ---------------------------------------------------------
    // Assigned Units JSON (WPForms Field #9)
    // Accepts: assigned_units_json, field_9, "9"
    // ---------------------------------------------------------
    var assignedRaw =
      r.assigned_units_json ||
      r.field_9 ||
      r['9'] ||
      '';
    assignedRaw = String(assignedRaw || '').trim();

    var assigned = [];
    if (assignedRaw) {
      var parsed = safeJsonParse(assignedRaw, null);
      if (Array.isArray(parsed)) assigned = parsed;
    }
    if (!Array.isArray(assigned)) assigned = [];

    // ---------------------------------------------------------
    // Normalize + group by qty (if qty missing, group duplicates)
    // key = kind|cls|refId|name|img
    // ---------------------------------------------------------
    var groupedMap = {};
    for (var j = 0; j < assigned.length; j++) {
      var u = assigned[j] || {};
      var kind = normalizeKind(u.kind);
      var cls = String(u.cls || u.class || u.supportType || '');
      var uRef = String(u.refId || u.ref_id || '').trim();
      var name = String(u.name || u.title || '');
      var img = String(u.img || u.image || u.imgUrl || '').trim();

      var qty = (u.qty != null) ? asInt(u.qty, 1) : 1;
      if (qty < 1) qty = 1;

      var points = asInt(u.points, 0);
      var ini = asInt(u.ini || u.initiative, 0);
      var honor = asInt(u.honor, 0);

      // IMPORTANT: This is the grouping key used by UI
      var key = kind + '|' + cls + '|' + uRef + '|' + name + '|' + img;

      if (!groupedMap[key]) {
        groupedMap[key] = {
          key: key,
          kind: kind,
          cls: cls,
          refId: uRef,
          name: name,
          img: img,
          qty: qty,
          points: points,
          ini: ini,
          honor: honor
        };
      } else {
        groupedMap[key].qty += qty;
      }
    }

    var grouped = Object.keys(groupedMap).map(function (k) { return groupedMap[k]; });

    // Sort: Class/Support Type then Ref ID ASC
    grouped.sort(function (a2, b2) {
      var ak = classOrderKey(a2.kind, a2.cls);
      var bk = classOrderKey(b2.kind, b2.cls);
      if (ak !== bk) return ak.localeCompare(bk, undefined, { sensitivity: 'base' });

      var ar2 = String(a2.refId || '');
      var br2 = String(b2.refId || '');
      var cmp = ar2.localeCompare(br2, undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;

      return String(a2.name || '').localeCompare(String(b2.name || ''), undefined, { sensitivity: 'base' });
    });

    // ---------------------------------------------------------
    // Build card
    // ---------------------------------------------------------
    var detailsId = 'shoshin-roster-details-' + i + '-' + (refId ? esc(refId).replace(/[^a-zA-Z0-9_-]/g, '') : 'x');

    var card = document.createElement('div');
    card.className = 'shoshin-asset-card shoshin-roster-card';

    // Row 3 body (includes Unassign UI)
    var row3Html = '';
    if (!grouped.length) {
      row3Html = buildEmptyAssignedHtml();
    } else {
      row3Html =
        '<table class="shoshin-table shoshin-assigned-table">' +
          '<thead>' +
            '<tr>' +
              '<th style="width:40px;"></th>' +
              '<th>Unit</th>' +
              '<th>Type</th>' +
              '<th>Ref</th>' +
              '<th style="text-align:center;width:60px;">Qty</th>' +
              '<th style="text-align:center;width:70px;">Points</th>' +
              '<th style="text-align:center;width:70px;">Ini</th>' +
              '<th style="text-align:center;width:70px;">Honor</th>' +
              '<th style="width:44px;"></th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>';

      for (var k2 = 0; k2 < grouped.length; k2++) {
        var g = grouped[k2];
        var imgSrc = g.img ? esc(g.img) : esc('/wp-content/uploads/2025/12/Helmet-grey.jpg');
        var unitName = g.name ? esc(g.name) : '—';
        var typeLabel = g.cls ? esc(g.cls) : (g.kind === 'character' ? 'Character' : 'Support');
        var refLabel = g.refId ? esc(g.refId) : '—';

        row3Html +=
          '<tr data-unit-key="' + esc(g.key) + '">' +
            '<td class="shoshin-cell-image"><img src="' + imgSrc + '" alt="" /></td>' +
            '<td>' + unitName + '</td>' +
            '<td>' + typeLabel + '</td>' +
            '<td>' + refLabel + '</td>' +
            '<td class="shoshin-qty-cell" style="text-align:center;">' + asInt(g.qty, 1) + '</td>' +
            '<td style="text-align:center;">' + asInt(g.points, 0) + '</td>' +
            '<td style="text-align:center;">' + asInt(g.ini, 0) + '</td>' +
            '<td style="text-align:center;">' + asInt(g.honor, 0) + '</td>' +
            '<td style="text-align:center;">' +
              '<button type="button" ' +
                'class="shoshin-btn shoshin-btn-unassign shoshin-unassign-btn" '
 +
                'title="Unassign from roster" ' +
                'data-roster-entry-id="' + esc(String(rosterEntryId)) + '" ' +
                'data-unit-key="' + esc(g.key) + '"' +
              '>Unassign</button>' +
            '</td>' +
          '</tr>';
      }

      row3Html +=
          '</tbody>' +
        '</table>';
    }

    card.innerHTML =
      // ROW 1
      '<div class="shoshin-asset-row1">' +

        '<div class="shoshin-asset-avatar">' +
          '<img src="' + esc(iconUrl) + '" alt="" />' +
        '</div>' +

        '<div class="shoshin-asset-header-main">' +
          '<h2 class="shoshin-asset-class-name">' + esc(clanName) + '</h2>' +
          '<div class="shoshin-asset-class-desc"><strong>Points:</strong> ' + clanPoints + '</div>' +
          '<div class="shoshin-asset-class-desc">Master Class Available: <strong>' + masterClassAvail + '</strong></div>' +
        '</div>' +

        '<div class="shoshin-asset-actions row1-actions">' +
          '<button type="button" class="shoshin-btn shoshin-btn-print" disabled aria-disabled="true" aria-label="Print (future)" data-tooltip="Available in a future phase">Print</button>' +
          '<button type="button" class="shoshin-btn shoshin-btn-edit" disabled aria-disabled="true" aria-label="Edit (future)" data-tooltip="Available in a future phase">Edit</button>' +
          '<button type="button" class="shoshin-btn shoshin-btn-delete" disabled aria-disabled="true" aria-label="Delete (future)" data-tooltip="Available in a future phase">Delete</button>' +
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
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Initiative</div><div class="shoshin-stat-value">0</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Honor</div><div class="shoshin-stat-value">0</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Units</div><div class="shoshin-stat-value">0</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Daimyo</div><div class="shoshin-stat-value">0</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Samurai</div><div class="shoshin-stat-value">0</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Ashigaru</div><div class="shoshin-stat-value">0</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Sohei</div><div class="shoshin-stat-value">0</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Ninja</div><div class="shoshin-stat-value">0</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Onmyoji</div><div class="shoshin-stat-value">0</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Artillery</div><div class="shoshin-stat-value">0</div></div></td>' +
              '<td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">Ships</div><div class="shoshin-stat-value">0</div></div></td>' +
            '</tr>' +
          '</tbody>' +
        '</table>' +
      '</div>' +

      // ROW 3
      '<div class="shoshin-asset-row3">' +
        '<div class="shoshin-asset-actions row3-actions">' +
          '<button type="button" class="shoshin-btn shoshin-asset-toggle" aria-controls="' + esc(detailsId) + '" aria-expanded="false">' +
            '<span class="shoshin-asset-toggle-icon" aria-hidden="true">+</span>' +
            '<span class="shoshin-asset-toggle-text">Assigned Units</span>' +
          '</button>' +
        '</div>' +

        '<div id="' + esc(detailsId) + '" class="shoshin-asset-details" aria-hidden="true">' +
          '<div class="shoshin-asset-details-inner">' +
            '<div class="shoshin-asset-block shoshin-assigned-block">' +
              '<h3>Assigned Units</h3>' +
              '<div class="shoshin-assigned-body">' + row3Html + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Toggle behavior
    (function bindToggle(scopeCard, id) {
      var btn = scopeCard.querySelector('.shoshin-asset-toggle');
      var details = scopeCard.querySelector('#' + CSS.escape(id));
      if (!btn || !details) return;

      btn.addEventListener('click', function () {
        var isOpen = details.classList.contains('is-open');
        if (isOpen) {
          details.classList.remove('is-open');
          details.setAttribute('aria-hidden', 'true');
          btn.setAttribute('aria-expanded', 'false');
          var icon = btn.querySelector('.shoshin-asset-toggle-icon');
          if (icon) icon.textContent = '+';
        } else {
          details.classList.add('is-open');
          details.setAttribute('aria-hidden', 'false');
          btn.setAttribute('aria-expanded', 'true');
          var icon2 = btn.querySelector('.shoshin-asset-toggle-icon');
          if (icon2) icon2.textContent = '–';
        }
      });
    })(card, detailsId);

    // Unassign persistence + UI update
    (function bindUnassign(scopeCard) {
      var buttons = scopeCard.querySelectorAll('.shoshin-unassign-btn');
      if (!buttons || !buttons.length) return;

      function postUnassign(rosterEntryId, unitKey) {
        if (!ajaxUrl || !ajaxNonce) {
          return Promise.reject(new Error('Missing ajaxUrl or ajaxNonce on roster container.'));
        }

        var body = new URLSearchParams();
        body.set('action', 'shoshin_unassign_unit');
        body.set('nonce', ajaxNonce);
        body.set('rosterEntryId', String(rosterEntryId || ''));
        body.set('unitKey', String(unitKey || ''));

        return fetch(ajaxUrl, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: body.toString()
        }).then(function (res) {
          return res.json();
        });
      }

      function applyUiRemoval(unitKey) {
        var row = scopeCard.querySelector('tr[data-unit-key="' + CSS.escape(unitKey) + '"]');
        if (!row) return;

        var qtyCell = row.querySelector('.shoshin-qty-cell');
        var currentQty = qtyCell ? asInt(qtyCell.textContent, 1) : 1;

        if (currentQty > 1) {
          qtyCell.textContent = String(currentQty - 1);
          return;
        }

        // qty === 1 → remove row
        var tbody = row.parentElement;
        row.remove();

        // if table is now empty → show empty state
        if (tbody && tbody.querySelectorAll('tr').length === 0) {
          var bodyEl = scopeCard.querySelector('.shoshin-assigned-body');
          if (bodyEl) bodyEl.innerHTML = buildEmptyAssignedHtml();
        }
      }

      for (var b = 0; b < buttons.length; b++) {
        buttons[b].addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();

          var btn = ev.currentTarget;
          var rosterId = asInt(btn.getAttribute('data-roster-entry-id'), 0);
          var unitKey = String(btn.getAttribute('data-unit-key') || '');

          if (!rosterId || !unitKey) return;

          var ok = window.confirm('Unassign this unit from the roster?');
          if (!ok) return;

          // lock button to prevent double clicks
          btn.disabled = true;
          btn.setAttribute('aria-disabled', 'true');

          postUnassign(rosterId, unitKey)
            .then(function (payload) {
              if (!payload || payload.success !== true) {
                var msg = (payload && payload.data && payload.data.message) ? payload.data.message : 'Unassign failed.';
                throw new Error(msg);
              }

              // UI update based on current row qty (client-side)
              applyUiRemoval(unitKey);
            })
            .catch(function (err) {
              console.error('[Shoshin] Unassign error', err);
              window.alert(err && err.message ? err.message : 'Unassign failed.');
            })
            .finally(function () {
              // If row still exists, re-enable button; if row removed, no need.
              var stillThere = scopeCard.querySelector('.shoshin-unassign-btn[data-unit-key="' + CSS.escape(unitKey) + '"]');
              if (stillThere) {
                stillThere.disabled = false;
                stillThere.removeAttribute('aria-disabled');
              }
            });
        });
      }
    })(card);

    listEl.appendChild(card);
  }
});
