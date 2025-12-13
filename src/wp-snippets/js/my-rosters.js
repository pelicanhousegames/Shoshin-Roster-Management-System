document.addEventListener('DOMContentLoaded', function () {
  const listEl = document.querySelector('.shoshin-roster-list[data-shoshin-rosters-json]');
  if (!listEl) return;

  let rosters = [];
  try {
    const raw = listEl.getAttribute('data-shoshin-rosters-json') || '[]';
    rosters = JSON.parse(raw);
  } catch (e) {
    console.error('Shoshin: invalid rosters JSON', e);
    listEl.innerHTML = '<div style="border:1px solid #ddd;padding:14px;border-radius:6px;">Roster data could not be loaded.</div>';
    return;
  }

  // Empty state
  if (!Array.isArray(rosters) || rosters.length === 0) {
    listEl.innerHTML = `
      <div style="border:1px solid #ddd;padding:14px;border-radius:6px;">
        <div style="font-weight:700;margin-bottom:6px;">No rosters yet</div>
        <div style="opacity:.9;margin-bottom:10px;">Create your first clan roster to begin managing units.</div>
        <a href="/create-roster" style="display:inline-block;padding:8px 12px;border:1px solid #333;border-radius:6px;text-decoration:none;">
          Create a Roster
        </a>
      </div>
    `;
    return;
  }

  // Sort by Reference ID ASC (PHP already sorts; extra safety)
  rosters = rosters.slice().sort((a, b) => (a.refId || '').localeCompare(b.refId || ''));

  listEl.innerHTML = '';
  listEl.style.display = 'flex';
  listEl.style.flexDirection = 'column';
  listEl.style.gap = '12px';

  rosters.forEach((r) => {
    const clanName = escapeHtml(r.name || 'Unnamed Clan');
    const refId = escapeHtml(r.refId || '—');

    const card = document.createElement('div');
    card.style.border = '1px solid #ddd';
    card.style.borderRadius = '6px';
    card.style.padding = '12px';

    // Phase 4A placeholders
    const points = 0;
    const initiative = 0;
    const honor = 0;
    const units = 0;

    const masterClassAvail = Math.floor(points / 125);

    card.innerHTML = `
      <!-- ROW 1: Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:16px;line-height:1.2;">${clanName}</div>
          <div style="margin-top:4px;opacity:.85;font-size:13px;">
            Master Class Available: <strong>${masterClassAvail}</strong>
          </div>
        </div>

        <div style="display:flex;gap:8px;flex:0 0 auto;">
          <button type="button" disabled style="opacity:.6;cursor:not-allowed;">Print</button>
          <button type="button" disabled style="opacity:.6;cursor:not-allowed;">Edit</button>
          <button type="button" disabled style="opacity:.6;cursor:not-allowed;">Delete</button>
        </div>
      </div>

      <!-- ROW 2: Stat Strip -->
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;font-size:13px;">
        <div><strong>${refId}</strong></div>
        <div>Clan Points: ${points}</div>
        <div>Initiative: ${initiative}</div>
        <div>Total Honor (XP): ${honor}</div>
        <div>Units: ${units}</div>
        <div>Daimyo: 0</div>
        <div>Samurai: 0</div>
        <div>Ashigaru: 0</div>
        <div>Sohei: 0</div>
        <div>Ninja: 0</div>
        <div>Onmyoji: 0</div>
        <div>Artillery: 0</div>
        <div>Ships: 0</div>
      </div>

      <!-- ROW 3: Expansion -->
      <div style="margin-top:10px;">
        <button type="button" class="shoshin-expand-btn" style="margin-right:8px;">+</button>
        <span style="opacity:.85;">Expand roster details</span>

        <div class="shoshin-expand-body" style="display:none;margin-top:10px;opacity:.95;">
          <div style="border-top:1px solid #eee;padding-top:10px;">
            No units assigned yet.
            <br><br>
            <em>If you have not created any Characters or Support Assets yet, create them first to assign to this roster.</em>
          </div>
        </div>
      </div>
    `;

    const btn = card.querySelector('.shoshin-expand-btn');
    const body = card.querySelector('.shoshin-expand-body');

    btn.addEventListener('click', () => {
      const open = body.style.display === 'block';
      body.style.display = open ? 'none' : 'block';
      btn.textContent = open ? '+' : '–';
    });

    listEl.appendChild(card);
  });

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
});
