// ===========================================================================
// Shoshin - UNIFIED ASSETS JS (My Assets Renderer + Support Asset Form 2501)
// COMPLETE DROP-IN REPLACEMENT (single global snippet)
//
// Includes:
// - My Assets renderer (characters + support assets) with filter bar + expansion blocks
// - Support Asset Tool (WPForms 2501) renderer + hidden field wiring + munitions hard-guard
//
// IMPORTANT CHANGE (requested):
// - In My Assets expansion blocks (Support Asset cards), remove Cost column from:
//   1) Training Requirements table
//   2) Equipment & Items table
//
// LATEST ADDITION (requested):
// - Delete confirm modal
// - Modal body content vertically centered
//
// FIX (requested):
// - "Delete failed." on confirm now shows real server response details.
// - Robustly handles non-JSON (e.g. "0", HTML) responses from admin-ajax.php.
// - Sends extra fields (formId/kind/refId) to help server handler (backwards compatible).
// ===========================================================================

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // GLOBAL NAMESPACE
  // -------------------------------------------------------------------------
  const Shoshin = (window.Shoshin = window.Shoshin || {});
  Shoshin.config = Shoshin.config || {
    debug: true,
    enableMyAssetsRenderer: true,
    enableSupportForm2501: true
  };

  function log() {
    if (!Shoshin.config.debug) return;
    try {
      console.log.apply(console, arguments);
    } catch (e) {}
  }

  // -------------------------------------------------------------------------
  // CORE HELPERS (shared)
  // -------------------------------------------------------------------------
  const Core = (Shoshin.Core = Shoshin.Core || {});

  Core.esc = function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  Core.splitLines = function splitLines(str) {
    if (!str) return [];
    return String(str)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  };

  Core.fmtInches = function fmtInches(val) {
    if (val === null || val === undefined) return '';
    const s = String(val).trim();
    if (!s) return s;
    if (s === '—' || s === '--') return s;
    if (/^\d+$/.test(s)) return s + '"';
    if (/[″"]$/.test(s)) return s;
    return s;
  };

  Core.firstNonEmptyString = function firstNonEmptyString() {
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      if (v !== null && v !== undefined && String(v).trim() !== '') return String(v);
    }
    return '';
  };

  Core.canonicalLabel = function canonicalLabel(text) {
    if (!text) return '';
    let cleaned = String(text).replace(/\s*\(.*?\)\s*$/, '').trim();
    try {
      cleaned = cleaned.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (e) {}
    return cleaned;
  };

  Core.dedupePreserveOrder = function dedupePreserveOrder(arr) {
    const seen = new Set();
    const out = [];
    (arr || []).forEach((v) => {
      const key = String(v || '').trim();
      if (!key) return;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(key);
    });
    return out;
  };

  Core.bindOnce = function bindOnce(el, key) {
    if (!el) return false;
    const k = 'shoshinBound_' + key;
    if (el.dataset && el.dataset[k] === '1') return false;
    if (el.dataset) el.dataset[k] = '1';
    return true;
  };

  // -------------------------------------------------------------------------
  // SHARED DATA (used by My Assets renderer)
  // -------------------------------------------------------------------------
  const Data = (Shoshin.Data = Shoshin.Data || {});
  const FALLBACK_IMAGE = '/wp-content/uploads/2025/12/Helmet-grey.jpg';
  const VIEW_ICON_URL = '/wp-content/uploads/2025/12/view.webp';

  Data.CLASS_META = {
    Daimyo: { size: 'Medium', displayName: 'Daimyo', description: '<em>Clan Lord</em>' },
    Samurai: { size: 'Medium', displayName: 'Samurai', description: '<em>Military Noble</em>' },
    Ashigaru: { size: 'Medium', displayName: 'Ashigaru', description: '<em>Peasant Conscript</em>' },
    Sohei: { size: 'Medium', displayName: 'Sohei', description: '<em>Buddhist Warrior Monk</em>' },
    Ninja: { size: 'Medium', displayName: 'Ninja', description: '<em>Stealth Operative</em>' },
    Onmyoji: { size: 'Medium', displayName: 'Onmyoji', description: '<em>Spiritual Diviner</em>' },

    // Support Assets buckets
    Artillery: { size: 'Medium', displayName: 'Ozutsu', description: '<em>Lightweight Cannon</em>' },
    'Sailing Ships': { size: 'Medium', displayName: 'Mokuzo Hansen', description: '<em>Wooden Sailing Ship</em>' }
  };

  Data.CLASS_IMAGES = {
    default: FALLBACK_IMAGE,

    Daimyo: '/wp-content/uploads/2025/12/daimyo2.jpg',
    Samurai: '/wp-content/uploads/2025/12/samurai3.jpg',
    Ashigaru: '/wp-content/uploads/2025/12/ashigaru2.jpg',
    Sohei: '/wp-content/uploads/2025/12/sohei3.jpg',
    Ninja: '/wp-content/uploads/2025/12/ninja2.jpg',
    Onmyoji: '/wp-content/uploads/2025/12/onmyoji3.jpg',

    Artillery: '/wp-content/uploads/2025/12/cannon.jpeg',
    'Sailing Ships': '/wp-content/uploads/2025/12/makuzo.jpeg'
  };

  Data.PROFICIENCIES = {
    'Inept: Melee Combat': {
      image: FALLBACK_IMAGE,
      capability: 'Inept: Melee Combat',
      attributes:
        'Melee attack rolls successful on natural 6 (Lucky Hit) only. ' +
        'Melee weapons lose all additional benefits and their range is reduced to engagement only.'
    },
    'Inept: Ranged Combat': {
      image: FALLBACK_IMAGE,
      capability: 'Inept: Ranged Combat',
      attributes:
        'Ranged attack rolls successful on natural 6 (Lucky Hit) only. ' +
        'Ranged weapons lose all additional benefits and their effective range is halved.'
    },
    'Inept: Water Combat': {
      image: FALLBACK_IMAGE,
      capability: 'Inept: Water Combat',
      attributes:
        'May not attack while located within water terrain. ' +
        'Must start round at water terrain edge to move within water terrain. ' +
        'May not captain or crew a sailing ship.'
    },
    'Inept: Horsemanship': {
      image: FALLBACK_IMAGE,
      capability: 'Inept: Horsemanship',
      attributes:
        'Does not benefit from Mounted Advantage (Toughness) +1 Body or from ' +
        'Mounted Advantage (High Ground) +1 To-Hit versus non-mounted targets.'
    },
    'Ancestral Prestige': { image: FALLBACK_IMAGE, capability: 'Ancestral Prestige', attributes: 'May choose any armor at one-half points cost.' },
    'Martial Mastery': { image: FALLBACK_IMAGE, capability: 'Martial Mastery', attributes: 'May train any one proficiency for free.' },
    'Sword Master': { image: FALLBACK_IMAGE, capability: 'Sword Master', attributes: 'Pays one-half points cost to train either Kenjutsu or Iaijutsu.' },
    'General Ineptitude': { image: FALLBACK_IMAGE, capability: 'General Ineptitude', attributes: 'Pays double points cost to train any available proficiency.' },
    'Martial Artist': { image: FALLBACK_IMAGE, capability: 'Martial Artist', attributes: 'Proficient in Jujutsu (free).' },
    'Polearms Adept': { image: FALLBACK_IMAGE, capability: 'Polearms Adept', attributes: 'Pays one-half points cost to train either Sojutsu or Naginatajutsu.' },
    'Espionage Expert': { image: FALLBACK_IMAGE, capability: 'Espionage Expert', attributes: 'Proficient in Ninjutsu (included).' },
    'Mysticism and Ritualism': { image: FALLBACK_IMAGE, capability: 'Mysticism and Ritualism', attributes: 'Proficient in Onmyodo (included).' }
  };

  Data.ABILITIES = {
    'Divine Inspiration': { image: FALLBACK_IMAGE, capability: 'Divine Inspiration', attributes: 'All friendly clan units located within 2" receive +1 to all saving throws.' },
    'Honor Duel': { image: FALLBACK_IMAGE, capability: 'Honor Duel', attributes: 'May initiate an honor duel against an enemy samurai or daimyō.' },
    'Iron Fists': { image: FALLBACK_IMAGE, capability: 'Iron Fists', attributes: 'Unarmed combat deals damage to armor and stone.' },
    'Missile Deflection': { image: FALLBACK_IMAGE, capability: 'Missile Deflection', attributes: 'Spend an action to negate any non-firearm (arquebus, bombs, artillery) ranged attack once per round. Must be declared before an attack roll is made.' },
    'Ki Resilience': { image: FALLBACK_IMAGE, capability: 'Ki Resilience', attributes: 'Permanently add +1 Body.' },
    Heal: { image: FALLBACK_IMAGE, capability: 'Heal', attributes: 'Spend an action to restore 1 Body and/or remove the Poison condition from any engaged unit, including yourself.' },
    'Wall Crawling': { image: FALLBACK_IMAGE, capability: 'Wall Crawling', attributes: 'May move upon any vertical surface as long as there is enough movement to end turn on a horizontal surface.' },
    'Light-footed': { image: FALLBACK_IMAGE, capability: 'Light-footed', attributes: 'Disengaging from an enemy does not provoke an opportunity attack.' },
    Assassinate: { image: FALLBACK_IMAGE, capability: 'Assassinate', attributes: 'Permanently add +1 Damage and Critical hits bypass High Defense.' },
    'Shadow Strikes': { image: FALLBACK_IMAGE, capability: 'Shadow Strikes', attributes: 'Permanently add +2 To-Hit during nighttime.' },
    Concealment: {
      image: FALLBACK_IMAGE,
      capability: 'Concealment',
      attributes:
        'Permanently add +1 Defense and gain the ability to spend an action to become concealed (hidden) during daytime. Automatically becomes concealed at the start of nighttime rounds.'
    },
    Agile: { image: FALLBACK_IMAGE, capability: 'Agile', attributes: 'Permanently add +2 to base movement.' },
    'Aura of Resolve': { image: FALLBACK_IMAGE, capability: 'Aura of Resolve', attributes: 'All friendly units (including onmyoji) within 3" gain High Defense.' },
    'Omen of Wrath': { image: FALLBACK_IMAGE, capability: 'Omen of Wrath', attributes: 'All friendly units (including onmyoji) within 3" gain +1 Attack.' },
    'Enduring Ward': { image: FALLBACK_IMAGE, capability: 'Enduring Ward', attributes: 'All friendly units (including onmyoji) within 3" gain +1 Defense.' },
    'Beyond the Veil': { image: FALLBACK_IMAGE, capability: 'Beyond the Veil', attributes: 'Summon any Yokai up to 12" away with unobstructed line of sight.' }
  };

  Data.MELEE_WEAPONS = {
    'Unarmed Combat': { image: '/wp-content/uploads/2025/12/Unarmed1.jpeg', type: 'Fists, Kicks, etc', attributes: 'Does not damage armored units.' },
    Jutte: { image: '/wp-content/uploads/2025/12/Club1.jpeg', type: 'Truncheon or Club', attributes: 'May be combined with Shirube (Pitch/Tar).' },
    Bo: { image: '/wp-content/uploads/2025/12/Staff1.jpeg', type: 'Pole or Staff', attributes: '--' },
    Tanto: { image: '/wp-content/uploads/2025/12/Dagger1.jpeg', type: 'Dagger', attributes: '--' },
    Kusarigama: { image: '/wp-content/uploads/2025/12/Sickle1.jpeg', type: 'Sickle and Chain', attributes: '--' },
    Kanabo: { image: '/wp-content/uploads/2025/12/Studded1.jpeg', type: 'Studded War Club', attributes: 'Can damage Stone objects.' },
    Yari: { image: '/wp-content/uploads/2025/12/Spear1.jpeg', type: 'Spear', attributes: 'Receives +1 To-Hit vs Cavalry units.' },
    Katana: { image: '/wp-content/uploads/2025/12/katana1.jpeg', type: 'Sword', attributes: 'May decapitate Restrained units.' },
    Naginata: { image: '/wp-content/uploads/2025/12/Naginata1.jpeg', type: 'Bladed Polearm', attributes: 'Receives +1 To-Hit vs Cavalry units.' },
    Nodachi: { image: '/wp-content/uploads/2025/12/Nodachi1.jpeg', type: 'Great Sword', attributes: 'May decapitate Restrained units.' }
  };

  Data.RANGED_WEAPONS = {
    Kunai: { image: '/wp-content/uploads/2025/12/Shuriken1.jpeg', type: 'Utility Tool', attributes: '<em>(Ninja only)</em>' },
    Shuriken: { image: '/wp-content/uploads/2025/12/Shuriken1.jpeg', type: 'Throwing Stars', attributes: '--' },
    Fukiya: { image: '/wp-content/uploads/2025/12/dart1.jpeg', type: 'Blowgun and Darts', attributes: '--' },
    Hankyu: {
      image: '/wp-content/uploads/2025/12/Bow.jpeg',
      type: 'Half Bow',
      attributes: 'May be combined with Shirube.<br><strong>Extended Range:</strong> -1 To-Hit from 9" to 15".'
    },
    Daikyu: {
      image: '/wp-content/uploads/2025/12/Bow.jpeg',
      type: 'Great Bow',
      attributes: 'Not a cavalry weapon.<br>May be combined with Shirube.<br><strong>Extended Range:</strong> -1 To-Hit from 18" to 30".'
    },
    Tanegashima: {
      image: '/wp-content/uploads/2025/12/Arquebus1.jpeg',
      type: 'Arquebus',
      attributes: 'Not a cavalry weapon.<br>Requires reload after use.<br><strong>Extended Range:</strong> -1 To-Hit from 12" to 18".'
    },
    'Houroku-Hiya': {
      image: '/wp-content/uploads/2025/12/bomb1.jpeg',
      type: 'Gunpowder Bombs',
      attributes:
        'Not a cavalry weapon.<br>Single To-Hit roll for all units within 2" of target.<br><strong>Critical Miss:</strong> Roll damage for all units within 2".'
    }
  };

  Data.ARMOR = {
    'Do-maru': { image: '/wp-content/uploads/2025/12/Basic1.jpeg', type: 'Basic Armor', attributes: 'Permanently gain +1 Defense.' },
    'O-yoroi': { image: '/wp-content/uploads/2025/12/Great.jpeg', type: 'Great Armor', attributes: 'Permanently gain +2 Defense.' },
    'Tosei-gusoku': { image: '/wp-content/uploads/2025/12/Modern.jpeg', type: 'Modern Armor', attributes: 'Permanently gain +3 Defense.' }
  };

  Data.SUPPORT_ITEMS = {
    Torinawa: { image: '/wp-content/uploads/2025/12/Rope.jpeg', type: 'Capture Rope', attributes: 'Grants abilities to Arrest and Rescue <em>(Hojojutsu required)</em>.' },
    Shirube: {
      image: '/wp-content/uploads/2025/12/Pitch.jpeg',
      type: 'Pitch or Tar',
      attributes: 'May be combined with Jutte, Hankyu or Daikyu weapons.<br>Inflicts the Burn condition upon a successful hit.'
    },
    Kanpo: { image: '/wp-content/uploads/2025/12/Medicine.jpeg', type: 'Herbal Medicine', attributes: 'Grants Immunity to Poison.' },
    Shakuhachi: { image: '/wp-content/uploads/2025/12/Flute.jpeg', type: 'Bamboo Flute', attributes: 'Grants Immunity to Fear.' },
    Sashimono: { image: '/wp-content/uploads/2025/12/Sashimono.png', type: 'Clan Banner', attributes: 'Permanently gain +1 Leadership.' },
    Emakimono: { image: '/wp-content/uploads/2025/12/Handscrolls.jpeg', type: 'Illustrated Handscrolls', attributes: 'Permanently gain +1 Initiative.' },
    Uma: {
      image: '/wp-content/uploads/2025/12/Horse.jpeg',
      type: 'Horse',
      attributes:
        '<strong>Mounted Advantage (Movement):</strong> Permanently add +8" to base movement.<br>' +
        '<strong>Mounted Advantage (Toughness):</strong> Permanently add +1 to Body <em>(Bajutsu required)</em>.<br>' +
        '<strong>Mounted Advantage (High Ground):</strong> +1 To-Hit vs non-mounted units <em>(Bajutsu required)</em>.'
    }
  };

  Data.TRAINING = {
    Jujutsu: { image: '/wp-content/uploads/2025/12/Unarmed1.jpeg', ryu: 'Jujutsu', discipline: 'Unarmed Combat', equipment: 'Fists, Kicks, etc.' },
    Juttejutsu: { image: '/wp-content/uploads/2025/12/Club1.jpeg', ryu: 'Juttejutsu', discipline: 'Truncheon or Club', equipment: 'Jutte' },
    Bojutsu: { image: '/wp-content/uploads/2025/12/Staff1.jpeg', ryu: 'Bojutsu', discipline: 'Pole or Staff', equipment: 'Bo' },
    Tantojutsu: { image: '/wp-content/uploads/2025/12/Dagger1.jpeg', ryu: 'Tantojutsu', discipline: 'Dagger', equipment: 'Tanto' },
    Kusarigamajutsu: { image: '/wp-content/uploads/2025/12/Sickle1.jpeg', ryu: 'Kusarigamajutsu', discipline: 'Sickle and Chain', equipment: 'Kusarigama' },
    Mojirijutsu: { image: '/wp-content/uploads/2025/12/Studded1.jpeg', ryu: 'Mojirijutsu', discipline: 'Studded War Club', equipment: 'Kanabo' },
    Sojutsu: { image: '/wp-content/uploads/2025/12/Spear1.jpeg', ryu: 'Sojutsu', discipline: 'Spear', equipment: 'Yari' },
    Kenjutsu: { image: '/wp-content/uploads/2025/12/katana1.jpeg', ryu: 'Kenjutsu', discipline: 'Sword', equipment: 'Katana' },
    Naginatajutsu: { image: '/wp-content/uploads/2025/12/Naginata1.jpeg', ryu: 'Naginatajutsu', discipline: 'Bladed Polearm', equipment: 'Naginata' },
    Iaijutsu: { image: '/wp-content/uploads/2025/12/Nodachi1.jpeg', ryu: 'Iaijutsu', discipline: 'Great Sword', equipment: 'Nodachi' },
    Shurikenjutsu: { image: '/wp-content/uploads/2025/12/Shuriken1.jpeg', ryu: 'Shurikenjutsu', discipline: 'Throwing Stars', equipment: 'Shuriken' },
    Fukumibarijutsu: { image: '/wp-content/uploads/2025/12/dart1.jpeg', ryu: 'Fukumibarijutsu', discipline: 'Blowgun & Darts', equipment: 'Fukiya' },
    Kyujutsu: { image: '/wp-content/uploads/2025/12/Bow.jpeg', ryu: 'Kyujutsu', discipline: 'Bows', equipment: 'Hankyu, Daikyu' },
    Kayakujutsu: { image: '/wp-content/uploads/2025/12/Arquebus1.jpeg', ryu: 'Kayakujutsu', discipline: 'Gunpowder Firearms & Explosives', equipment: 'Tanegashima, Houroku-Hiya, Ozutsu' },
    Hojojutsu: { image: '/wp-content/uploads/2025/12/Rope.jpeg', ryu: 'Hojojutsu', discipline: 'Arresting Rope', equipment: 'Torinawa' },
    Suieijutsu: { image: '/wp-content/uploads/2025/12/Water.jpeg', ryu: 'Suieijutsu', discipline: 'Water Combat', equipment: 'Mokuzo Hansen' },
    Bajutsu: { image: '/wp-content/uploads/2025/12/Horse.jpeg', ryu: 'Bajutsu', discipline: 'Horsemanship', equipment: 'Uma' },
    Ninjutsu: { image: '/wp-content/uploads/2025/12/Ninjutsu.jpeg', ryu: 'Ninjutsu', discipline: 'Espionage', equipment: 'Kunai' },
    Onmyodo: { image: '/wp-content/uploads/2025/12/Sorcery.jpeg', ryu: 'Onmyodo', discipline: 'Sorcery', equipment: '—' }
  };

  // Support munitions used by My Assets renderer (from asset_equip_items #39)
  Data.MUNITIONS = {
    Tetsuho: {
      image: '/wp-content/uploads/2025/12/Cannonball.jpeg',
      munition: 'Tetsuho',
      type: 'Iron Cannonball',
      damage: '1d6',
      critical: '1d3',
      distance: '18"',
      attributes: 'Can damage multiple targets within 1" Line AOE.<br>Extended Range: -1 To-Hit from 18" to 24".',
      cost: '5'
    },
    'Bo-Hiya': {
      image: '/wp-content/uploads/2025/12/Flame-Arrow.jpeg',
      munition: 'Bo-Hiya',
      type: 'Flaming Arrow',
      damage: '1d6',
      critical: '1d2',
      distance: '24"',
      attributes: 'Condition: Burn upon successful hit.<br>Extended Range: -1 To-Hit from 24" to 36".',
      cost: '5'
    },
    'Tama-ire': {
      image: '/wp-content/uploads/2025/12/Grapeshot.jpeg',
      munition: 'Tama-ire',
      type: 'Grapeshot',
      damage: '1d3',
      critical: '1',
      distance: '12"',
      attributes: 'Can damage multiple targets within a 30° cone up to 12".',
      cost: '5'
    }
  };

  // -------------------------------------------------------------------------
  // MY ASSETS RENDERER
  // -------------------------------------------------------------------------
  function initMyAssetsRenderer() {
    if (!Shoshin.config.enableMyAssetsRenderer) return;

    


    const listEl = document.querySelector('.shoshin-asset-list[data-shoshin-assets-json]');
    if (!listEl) return;

    // Prevent double init
    if (!Core.bindOnce(listEl, 'MyAssetsRenderer')) return;

    let assets = [];
    try {
      const raw = listEl.getAttribute('data-shoshin-assets-json') || '[]';
      assets = JSON.parse(raw);
    } catch (e) {
      console.error('Shoshin: invalid assets JSON', e);
      return;
    }

    const wrapperEl = listEl.closest('.shoshin-asset-list-wrapper') || listEl.parentElement;

    // ---------------------------------------------------------------------
    // DELETE CONFIRM MODAL (My Assets) - REAL DELETE via admin-ajax.php
    // ---------------------------------------------------------------------
    let deleteModal = null;
    let deleteModalBackdrop = null;
    let deleteModalOnConfirm = null;

    let deleteModalErrorEl = null;
    let deleteModalConfirmBtn = null;
    let deleteModalCancelBtn = null;

    let deleteModalBusy = false;

    function setModalBusy(isBusy) {
      if (!deleteModal) return;
      if (!deleteModalConfirmBtn) deleteModalConfirmBtn = deleteModal.querySelector('.shoshin-modal-btn-confirm');
      if (!deleteModalCancelBtn) deleteModalCancelBtn = deleteModal.querySelector('.shoshin-modal-btn-cancel');

      if (deleteModalConfirmBtn) {
        deleteModalConfirmBtn.disabled = !!isBusy;
        deleteModalConfirmBtn.textContent = isBusy ? 'Deleting…' : 'Confirm';
      }
      if (deleteModalCancelBtn) deleteModalCancelBtn.disabled = !!isBusy;
      const xBtn = deleteModal.querySelector('.shoshin-modal-x');
      if (xBtn) xBtn.disabled = !!isBusy;
    }

    function showModalError(msg) {
      if (!deleteModal) return;
      if (!deleteModalErrorEl) deleteModalErrorEl = deleteModal.querySelector('.shoshin-modal-error');
      if (!deleteModalErrorEl) return;
      deleteModalErrorEl.textContent = msg || 'Delete failed.';
      deleteModalErrorEl.style.display = 'block';
    }

      
    function clearModalError() {
      if (!deleteModal) return;
      if (!deleteModalErrorEl) deleteModalErrorEl = deleteModal.querySelector('.shoshin-modal-error');
      if (!deleteModalErrorEl) return;
      deleteModalErrorEl.textContent = '';
      deleteModalErrorEl.style.display = 'none';
    }

    // ---- Robust AJAX response parsing (handles JSON, "0", HTML, etc.) ----
    function parseAjaxResponse(response) {
      const ct = (response && response.headers && response.headers.get) ? (response.headers.get('content-type') || '') : '';
      return response
        .text()
        .then(function (txt) {
          const text = (txt == null) ? '' : String(txt);

          // Try JSON first (even if content-type is wrong)
          let json = null;
          try {
            json = JSON.parse(text);
          } catch (e) {}

          return { ct, text, json };
        });
    }

    function normalizeAjaxErrorMessage(info, status) {
      // info: {ct, text, json}
      const json = info && info.json ? info.json : null;

      // WP sends { success:false, data:{message:"..."} } commonly
      if (json && typeof json === 'object') {
        if (json && json.data && typeof json.data.message === 'string' && json.data.message.trim()) {
          return json.data.message.trim();
        }
        if (typeof json.message === 'string' && json.message.trim()) return json.message.trim();
        // Sometimes data is string
        if (typeof json.data === 'string' && json.data.trim()) return json.data.trim();
      }

      const raw = (info && typeof info.text === 'string') ? info.text.trim() : '';

      // Common WP admin-ajax "0" = nonce/permission/action mismatch
      if (raw === '0') {
        return 'Delete failed: server returned "0" (typically nonce/permission/action mismatch).';
      }

      // If HTML, surface a short hint
      if (raw && /<\s*html[\s>]/i.test(raw)) {
        return 'Delete failed: server returned HTML (check if you were logged out or redirected).';
      }

      if (raw) {
        // Keep it short but informative
        const clipped = raw.length > 240 ? raw.slice(0, 240) + '…' : raw;
        return 'Delete failed: ' + clipped;
      }

      if (status && status !== 200) return 'Delete failed (HTTP ' + status + ').';
      return 'Delete failed.';
    }

    function ajaxDeleteEntry(entryId, extra) {
      return new Promise(function (resolve, reject) {
        const cfg = window.ShoshinAjax || {};
        const ajaxUrl = cfg.ajaxUrl;
        const nonce = cfg.nonce;

        if (!ajaxUrl || !nonce) {
          reject(new Error('Delete is not configured (missing ajaxUrl/nonce).'));
          return;
        }

        const fd = new FormData();
        fd.append('action', 'shoshin_delete_wpforms_entry');
        fd.append('entryId', String(entryId || ''));

        // Backwards-compatible nonce fields (some handlers check nonce, some check security)
        fd.append('nonce', String(nonce || ''));
        fd.append('security', String(nonce || ''));

        // Extra context (harmless if server ignores it)
        try {
          if (extra && extra.formId) fd.append('formId', String(extra.formId));
          if (extra && extra.kind) fd.append('kind', String(extra.kind));
          if (extra && extra.refId) fd.append('refId', String(extra.refId));
        } catch (_) {}

        fetch(ajaxUrl, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          body: fd
        })
          .then(function (r) {
            return parseAjaxResponse(r).then(function (info) {
              const status = r.status;

              // If we got JSON and it says success true -> ok
              if (info.json && info.json.success === true) {
                resolve(info.json.data || {});
                return;
              }

              // Otherwise, build a better error
              const msg = normalizeAjaxErrorMessage(info, status);

              // Debug payload in console (helps pinpoint why WP returned "0"/HTML/etc.)
              log('Shoshin delete debug', {
                entryId: entryId,
                status: status,
                contentType: info.ct,
                json: info.json,
                text: info.text
              });

              reject(new Error(msg));
            });
          })
          .catch(function (err) {
            reject(err || new Error('Network error.'));
          });
      });
    }

    function setModalVisible(modalEl, backdropEl, isOpen) {
      if (backdropEl) {
        backdropEl.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        backdropEl.style.display = isOpen ? 'block' : 'none';
        backdropEl.style.pointerEvents = isOpen ? 'auto' : 'none';
      }

      if (modalEl) {
        if (isOpen) modalEl.classList.add('is-open');
        else modalEl.classList.remove('is-open');

        // IMPORTANT: use flex when visible (modal layout depends on it)
        modalEl.style.display = isOpen ? 'flex' : 'none';
        modalEl.style.pointerEvents = isOpen ? 'auto' : 'none';
      }

      // Only remove body lock if NO modals are open
      if (!isOpen) {
        const anyOpen = !!document.querySelector('.shoshin-modal.is-open');
        if (!anyOpen) document.body.classList.remove('shoshin-modal-open');
      } else {
        document.body.classList.add('shoshin-modal-open');
      }
    }

    function ensureDeleteModal() {
      if (deleteModal && deleteModalBackdrop) return;

      deleteModalBackdrop = document.createElement('div');
      deleteModalBackdrop.className = 'shoshin-modal-backdrop';
      deleteModalBackdrop.setAttribute('aria-hidden', 'true');

      deleteModal = document.createElement('div');
      deleteModal.className = 'shoshin-modal shoshin-delete-modal';
      deleteModal.classList.add('shoshin-delete-modal');
      deleteModal.setAttribute('role', 'dialog');
      deleteModal.setAttribute('aria-modal', 'true');
      deleteModal.setAttribute('aria-labelledby', 'shoshin-delete-modal-title');
      deleteModal.setAttribute('aria-describedby', 'shoshin-delete-modal-desc');

      deleteModal.innerHTML = `
        <div class="shoshin-modal-header">
          <img class="shoshin-modal-logo"
               src="/wp-content/uploads/2025/11/Header_logo_300x150_1.png"
               alt="Site logo" />
          <button type="button" class="shoshin-modal-x" aria-label="Close">×</button>
        </div>

                       <div class="shoshin-modal-body">
          <div id="shoshin-delete-modal-title" class="shoshin-modal-title">Delete asset?</div>

          <!-- Asset Summary (same data sources as Preview Modal) -->
          <div class="shoshin-delete-preview" style="margin: 10px 0 14px; display:flex;">
            <div class="shoshin-assign-asset">
              <img class="shoshin-delete-asset-img shoshin-assign-asset-img" src="${Core.esc(FALLBACK_IMAGE)}" alt="Asset image" loading="lazy">
              <div class="shoshin-assign-asset-meta">
                <div class="shoshin-delete-asset-type shoshin-assign-asset-class">—</div>
                <div class="shoshin-delete-asset-ref shoshin-assign-asset-ref"><strong>REF ID</strong> —</div>
                <div class="shoshin-delete-asset-cost shoshin-assign-asset-cost"><strong>Total Cost:</strong> —</div>
              </div>
            </div>
          </div>

          <div id="shoshin-delete-modal-desc" class="shoshin-modal-desc">
            Deleting this asset is permanent and is not recoverable!
          </div>

          <div class="shoshin-modal-error" style="display:none"></div>
        </div>

        <div class="shoshin-modal-actions">
          <button type="button" class="shoshin-modal-btn shoshin-modal-btn-cancel">Cancel</button>
          <button type="button" class="shoshin-modal-btn shoshin-modal-btn-confirm">Confirm</button>
        </div>
      `;

      document.body.appendChild(deleteModalBackdrop);
      document.body.appendChild(deleteModal);

      // Backdrop click cancels
      deleteModalBackdrop.addEventListener('click', closeDeleteModal);

      // X and Cancel
      const xBtn = deleteModal.querySelector('.shoshin-modal-x');
      const cancelBtn = deleteModal.querySelector('.shoshin-modal-btn-cancel');
      if (xBtn) xBtn.addEventListener('click', closeDeleteModal);
      if (cancelBtn) cancelBtn.addEventListener('click', closeDeleteModal);

      // Confirm
      const confirmBtn = deleteModal.querySelector('.shoshin-modal-btn-confirm');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', function () {
          if (deleteModalBusy) return;

          const fn = deleteModalOnConfirm;
          if (typeof fn !== 'function') {
            clearModalError();
            showModalError('Delete handler not configured.');
            return;
          }

          deleteModalBusy = true;
          clearModalError();
          setModalBusy(true);

          Promise.resolve()
            .then(function () {
              return fn(); // run the caller's delete handler
            })
            .then(function () {
              // only close after success
              closeDeleteModal();
            })
            .catch(function (err) {
              // keep modal open on failure and show error
              const msg = err && err.message ? err.message : 'Delete failed.';
              showModalError(msg);
            })
            .finally(function () {
              deleteModalBusy = false;
              setModalBusy(false);
              try {
                confirmBtn.focus();
              } catch (_) {}
            });
        });
      }

      // ESC cancels (bind once globally)
      if (Core.bindOnce(document.documentElement, 'DeleteModalEsc')) {
        document.addEventListener('keydown', function (e) {
          if (!deleteModalBackdrop || deleteModalBackdrop.getAttribute('aria-hidden') === 'true') return;
          if (e.key === 'Escape') closeDeleteModal();
        });
      }
    }

    function setDeleteModalPreview(preview) {
  ensureDeleteModal();
  const host = deleteModal ? deleteModal.querySelector('.shoshin-delete-preview') : null;
  if (!host) return;

  if (!preview) {
    host.innerHTML = '';
    host.style.display = 'none';
    return;
  }

  const img  = String(preview.img || '').trim();
  const type = String(preview.type || '').trim();
  const desc = String(preview.desc || '').trim();
  const size = String(preview.size || '').trim();

  // Allow only <em> tags in description (everything else stripped)
  const safeDesc = desc.replace(/<(?!\/?em\b)[^>]*>/gi, '');

  host.innerHTML =
    '<div class="shoshin-delete-asset">' +
      '<img class="shoshin-delete-asset-img" src="' + Core.esc(img || FALLBACK_IMAGE) + '" alt="">' +
      '<div class="shoshin-delete-asset-meta">' +
        '<div class="shoshin-delete-asset-type">' + Core.esc(type || '—') + '</div>' +
        '<div class="shoshin-delete-asset-desc">' + (safeDesc || '—') + '</div>' +
        '<div class="shoshin-delete-asset-size"><strong>Size:</strong> ' + Core.esc(size || '—') + '</div>' +
      '</div>' +
    '</div>';

  host.style.display = 'flex';
}


      function setDeleteAssetSummary(assetCtx) {
  ensureDeleteModal();
  if (!deleteModal) return;

  try {
    const img  = deleteModal.querySelector('.shoshin-delete-asset-img');
    const cls  = deleteModal.querySelector('.shoshin-delete-asset-type');
    const ref  = deleteModal.querySelector('.shoshin-delete-asset-ref');
    const cost = deleteModal.querySelector('.shoshin-delete-asset-cost');

    if (img) img.src = assetCtx && assetCtx.img ? assetCtx.img : FALLBACK_IMAGE;

      // Type: match Preview Modal behavior:
    // - Support assets: show the "displayName" from CLASS_INFO (e.g., Ozutsu, Mokuzo Hansen)
    // - Characters: keep the class key (e.g., Daimyo, Samurai)
    let typeText = '—';

    if (assetCtx) {
      const clsKey = String(assetCtx.cls || '').trim();

           if (assetCtx.kind === 'support') {
        // Support assets use bucket keys (e.g., "Artillery") but the UI should show displayName (e.g., "Ozutsu")
        const metaMap = (Data && (Data.CLASS_META || Data.CLASS_INFO)) ? (Data.CLASS_META || Data.CLASS_INFO) : null;
        const info = (metaMap && clsKey) ? metaMap[clsKey] : null;
        const disp = info && info.displayName ? String(info.displayName).trim() : '';
        typeText = disp || clsKey || String(assetCtx.name || '').trim() || '—';
      } else {

        typeText = clsKey || String(assetCtx.name || '').trim() || '—';
      }
    }

    if (cls) cls.textContent = typeText;


    if (ref) ref.innerHTML = '<strong>REF ID</strong> ' + Core.esc(assetCtx && assetCtx.refId ? assetCtx.refId : '—');

    // Total Cost in Preview Modal is sourced from assetCtx.points (from card cost cell)
    const pts = (assetCtx && assetCtx.points != null) ? assetCtx.points : '—';
    if (cost) cost.innerHTML = '<strong>Total Cost:</strong> ' + Core.esc(String(pts));
  } catch (_) {}
}


    function openDeleteModal(onConfirm) {
      ensureDeleteModal();
      deleteModalOnConfirm = onConfirm || null;

      // Clear any prior error and reset busy UI
      deleteModalBusy = false;
      clearModalError();
      setModalBusy(false);

      setModalVisible(deleteModal, deleteModalBackdrop, true);

      const confirmBtn = deleteModal.querySelector('.shoshin-modal-btn-confirm');
      if (confirmBtn) confirmBtn.focus();
    }

    function closeDeleteModal() {
      if (!deleteModalBackdrop || !deleteModal) return;

      // Always reset state on close
      deleteModalOnConfirm = null;
      deleteModalBusy = false;
      clearModalError();
      setModalBusy(false);

      setDeleteAssetSummary(null);


      setModalVisible(deleteModal, deleteModalBackdrop, false);
    }

    // ---------------------------------------------------------------------
    // ASSIGN MODAL (My Assets) - UI/UX COMPLETE (UI ONLY; no persistence yet)
    // ---------------------------------------------------------------------
    let assignModal = null;
    let assignModalBackdrop = null;

    let assignState = {
      mode: 'one_to_many', // 'one_to_many' | 'many_to_one'
      qty: 1,
      selectedRosterIds: new Set(),
      rosters: [],
      asset: null,
      isDaimyoAsset: false,

    };

        function ajaxFetchMyRosters() {
  return new Promise(function (resolve) {
    const cfg = window.ShoshinAjax || {};
    const ajaxUrl = cfg.ajaxUrl;
    const nonce = cfg.nonce;

    if (!ajaxUrl || !nonce) {
      // IMPORTANT: keep UI functional, but make it obvious in debug
      log('Shoshin rosters: missing ajaxUrl/nonce', { ajaxUrl: !!ajaxUrl, nonce: !!nonce });
      resolve([]);
      return;
    }

    const fd = new FormData();
    fd.append('action', 'shoshin_get_my_rosters');
    fd.append('nonce', String(nonce || ''));
    fd.append('security', String(nonce || ''));

    fetch(ajaxUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      body: fd
    })
      .then(function (r) {
        return parseAjaxResponse(r).then(function (info) {
          // Expected: { success:true, data:{ rosters:[...] } }
          if (info.json && info.json.success === true) {
            const rows = info.json.data && Array.isArray(info.json.data.rosters) ? info.json.data.rosters : [];
            resolve(rows);
            return;
          }

          // If we got WP "0" or HTML or garbage, DO NOT silently swallow it.
          const msg = normalizeAjaxErrorMessage(info, r.status);
          log('Shoshin rosters fetch failed', {
            status: r.status,
            contentType: info.ct,
            json: info.json,
            text: info.text
          });

          // Still resolve([]) to keep UI stable, but leave a breadcrumb.
          resolve([]);
        });
      })
      .catch(function (err) {
        log('Shoshin rosters fetch network error', err);
        resolve([]);
      });
  });
}


            function ajaxAssignAssetToRosters(payload) {
  return new Promise(function (resolve, reject) {
    const cfg = window.ShoshinAjax || {};
    const ajaxUrl = cfg.ajaxUrl;
    const nonce = cfg.nonce;

    if (!ajaxUrl || !nonce) {
      reject(new Error('Assign is not configured (missing ajaxUrl/nonce).'));
      return;
    }

    const rosterIds =
      (payload && payload.assignments && payload.assignments.length)
        ? payload.assignments.map(function (a) { return a.rosterEntryId; }).filter(Boolean)
        : (payload && payload.rosterIds && payload.rosterIds.length)
          ? payload.rosterIds.map(String)
          : [];

    const unit = payload && payload.asset ? payload.asset : null;

    if (!unit || !unit.unitKey) {
      reject(new Error('Invalid unit payload (missing unitKey).'));
      return;
    }
    if (!rosterIds.length) {
      reject(new Error('No rosters selected.'));
      return;
    }

    const fd = new FormData();
    fd.append('action', 'shoshin_assign_asset_to_rosters');
    fd.append('nonce', String(nonce || ''));
    fd.append('security', String(nonce || ''));

    fd.append('rosterIds', JSON.stringify(rosterIds));
    fd.append('unit', JSON.stringify(unit));
    fd.append('assignments', JSON.stringify((payload && payload.assignments) ? payload.assignments : []));
    fd.append('mode', String((payload && payload.mode) ? payload.mode : ''));

    fetch(ajaxUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      body: fd
    })
      .then(function (r) {
        return parseAjaxResponse(r).then(function (info) {
          if (info.json && info.json.success === true) {
            const updated = (info.json.data && Array.isArray(info.json.data.updatedRosterIds))
              ? info.json.data.updatedRosterIds
              : [];
            resolve({ updatedRosterIds: updated });
            return;
          }

          const msg = normalizeAjaxErrorMessage(info, r.status);

          log('Shoshin assign failed debug', {
            status: r.status,
            contentType: info.ct,
            json: info.json,
            text: info.text,
            rosterIds: rosterIds,
            unitKey: unit.unitKey
          });

          reject(new Error(msg || 'Assign failed.'));
        });
      })
      .catch(function (err) {
        reject(err || new Error('Network error.'));
      });
  });
}



    function normalizeRoster(r) {
  // Supports multiple shapes without forcing server field renames yet.
  const entryId = r && (r.entryId || r.id || r.entry_id) ? String(r.entryId || r.id || r.entry_id) : '';
  const name = Core.firstNonEmptyString(r.clanName, r.name, r.title, r.rosterName, r.roster_name);
  const refId = Core.firstNonEmptyString(r.refId, r.ref, r.reference, r.referenceId, r.reference_id);
  const img = Core.firstNonEmptyString(r.img, r.image, r.imageUrl, r.image_url, FALLBACK_IMAGE) || FALLBACK_IMAGE;

  const points = parseInt(Core.firstNonEmptyString(r.points, r.clanPoints, r.clan_points, (r.totals && r.totals.points)), 10) || 0;
  const units = parseInt(Core.firstNonEmptyString(r.units, r.totalUnits, r.total_units, (r.totals && r.totals.units)), 10) || 0;
  const ini = parseInt(Core.firstNonEmptyString(r.ini, r.initiative, (r.totals && r.totals.ini)), 10) || 0;
  const honor = parseInt(Core.firstNonEmptyString(r.honor, r.totalHonor, r.total_honor, r.leadership, (r.totals && r.totals.honor)), 10) || 0;

  // NEW: detect if roster already has a Daimyo assigned (future-proof for when assigned_units_json is populated)
        let hasDaimyo = false;
        try {
            const rawAssigned = Core.firstNonEmptyString(
            r.assigned_units_json,
            r.assignedUnitsJson,
            r.assigned_units,
            r.assignedUnits
            );

            let arr = null;

if (rawAssigned && typeof rawAssigned === 'string') {
  try { arr = JSON.parse(rawAssigned); } catch (_) { arr = null; }
} else if (Array.isArray(rawAssigned)) {
  arr = rawAssigned;
} else if (rawAssigned && typeof rawAssigned === 'object') {
  // Some APIs return { units:[...] } or similar — try common shapes
  if (Array.isArray(rawAssigned.units)) arr = rawAssigned.units;
  else if (Array.isArray(rawAssigned.assigned_units)) arr = rawAssigned.assigned_units;
}

if (Array.isArray(arr)) {
  hasDaimyo = arr.some(function (u) {
    if (!u || typeof u !== 'object') return false;

    const uk = (u.unitKey != null) ? String(u.unitKey) : '';
    if (uk && uk.indexOf('|Daimyo|') !== -1) return true;

    const cls = (u.cls != null) ? String(u.cls) : '';
    const name2 = (u.name != null) ? String(u.name) : '';
    return cls === 'Daimyo' || name2 === 'Daimyo';
  });
}

        } catch (_) {}

                const assigned_units_json =
          (r && r.assigned_units_json != null) ? r.assigned_units_json :
          (r && r.assignedUnitsJson != null) ? r.assignedUnitsJson :
          '';

        return { entryId, name, refId, img, points, units, ini, honor, hasDaimyo, assigned_units_json };
}


          // -------------------------------------------------------------------------
    // Preview Modal (View Assignments) — display-only shell (Step 1)
    // -------------------------------------------------------------------------
    let previewModalBackdrop = null;
    let previewModal = null;

        // Preview modal state (Step 2)
    let previewState = {
      asset: null,
      rostersAll: [],
      rostersAssigned: [],
      filterLabel: 'All Rosters',
      requestToken: 0
    };


    function ensurePreviewModal() {
      if (previewModal && previewModalBackdrop) return;

      previewModalBackdrop = document.createElement('div');
      previewModalBackdrop.className = 'shoshin-modal-backdrop';
      previewModalBackdrop.setAttribute('aria-hidden', 'true');

      previewModal = document.createElement('div');
      previewModal.className = 'shoshin-modal';
      previewModal.classList.add('shoshin-preview-modal');

      previewModal.setAttribute('role', 'dialog');
      previewModal.setAttribute('aria-modal', 'true');
      previewModal.setAttribute('aria-labelledby', 'shoshin-preview-modal-title');

      previewModal.innerHTML = `
        <div class="shoshin-modal-header">
          <img class="shoshin-modal-logo"
               src="/wp-content/uploads/2025/11/Header_logo_300x150_1.png"
               alt="Site logo" />
          <button type="button" class="shoshin-modal-x" aria-label="Close">×</button>
        </div>

        <div class="shoshin-modal-body shoshin-preview-body-wrap">
          <h2 id="shoshin-preview-modal-title" style="margin-top:0;">Clan Roster Assignments</h2>

          <!-- Row A: Asset Summary -->
          <div class="shoshin-assign-asset" style="margin-bottom:12px;">
            <img class="shoshin-preview-asset-img shoshin-assign-asset-img" src="${Core.esc(FALLBACK_IMAGE)}" alt="Asset image" loading="lazy">
            <div class="shoshin-assign-asset-meta">
              <div class="shoshin-preview-asset-type shoshin-assign-asset-class">—</div>
              <div class="shoshin-preview-asset-ref shoshin-assign-asset-ref"><strong>REF ID</strong> —</div>
              <div class="shoshin-preview-asset-cost shoshin-assign-asset-cost"><strong>Total Cost:</strong> 0</div>
            </div>
          </div>

                    <!-- Row B: Current Assignments -->
          <div class="shoshin-preview-assignments">
            <div class="shoshin-assign-rosters-head">Current Assignments</div>
            <div class="shoshin-assign-roster-filters shoshin-preview-roster-filters"></div>
            <div class="shoshin-assign-roster-list shoshin-preview-roster-list" aria-live="polite"></div>

            <div class="shoshin-preview-empty shoshin-preview-empty-global" style="display:none;"></div>
            <div class="shoshin-preview-empty shoshin-preview-empty-filter" style="display:none;"></div>
          </div>


        <div class="shoshin-modal-footer">
          <button type="button" class="shoshin-modal-btn shoshin-modal-btn-cancel">Close</button>
        </div>
      `;

      // Close handlers
      previewModal.addEventListener('click', function (e) {
        const x = e.target && e.target.closest ? e.target.closest('.shoshin-modal-x') : null;
        const cancel = e.target && e.target.closest ? e.target.closest('.shoshin-modal-btn-cancel') : null;
        if (x || cancel) closePreviewModal();
      });

      previewModalBackdrop.addEventListener('click', function () {
        closePreviewModal();
      });

      document.body.appendChild(previewModalBackdrop);
      document.body.appendChild(previewModal);
    }

        function openPreviewModal(assetCtx) {
      ensurePreviewModal();

      previewState.asset = assetCtx || null;
      previewState.filterLabel = 'All Rosters';
      previewState.rostersAll = [];
      previewState.rostersAssigned = [];

      // Fill Row A
      try {
        const img = previewModal.querySelector('.shoshin-preview-asset-img');
        const cls = previewModal.querySelector('.shoshin-preview-asset-type');
        const ref = previewModal.querySelector('.shoshin-preview-asset-ref');
        const cost = previewModal.querySelector('.shoshin-preview-asset-cost');

        if (img) img.src = assetCtx && assetCtx.img ? assetCtx.img : FALLBACK_IMAGE;
        if (cls) cls.textContent = assetCtx && assetCtx.name ? assetCtx.name : '—';
        if (ref) ref.innerHTML = '<strong>REF ID</strong> ' + Core.esc(assetCtx && assetCtx.refId ? assetCtx.refId : '—');
        if (cost) cost.innerHTML = '<strong>Total Cost:</strong> ' + Core.esc(String(assetCtx && assetCtx.points ? assetCtx.points : 0));
      } catch (_) {}

      // Show modal now (matches existing patterns)
      setModalVisible(previewModal, previewModalBackdrop, true);

      const xBtn = previewModal.querySelector('.shoshin-modal-x');
      if (xBtn) xBtn.focus();

      // Prepare UI placeholders
      renderPreviewRosterFilters();
      renderPreviewRosterList(); // shows loading/empties based on current state

      // Fetch rosters on open (Option 2)
      previewState.requestToken += 1;
      const myToken = previewState.requestToken;

      ajaxFetchMyRosters()
        .then(function (rows) {
          // If modal was reopened since request started, drop this response
          if (myToken !== previewState.requestToken) return;

          var norm = (rows || []).map(normalizeRoster).filter(function (r) { return !!r.entryId; });

          // Sort rosters ASC by REF ID (case-insensitive)
          norm.sort(function (a, b) {
            var ra = (a.refId || '').toString().toUpperCase();
            var rb = (b.refId || '').toString().toUpperCase();
            if (ra < rb) return -1;
            if (ra > rb) return 1;
            return 0;
          });

          previewState.rostersAll = norm;
          previewState.rostersAssigned = computeAssignedRosters(norm, previewState.asset);

          renderPreviewRosterFilters();
          renderPreviewRosterList();
        })
        .catch(function () {
          if (myToken !== previewState.requestToken) return;
          previewState.rostersAll = [];
          previewState.rostersAssigned = [];
          renderPreviewRosterFilters();
          renderPreviewRosterList();
        });
    }


    function closePreviewModal() {
      if (!previewModalBackdrop || !previewModal) return;
      setModalVisible(previewModal, previewModalBackdrop, false);
    }

        // -------------------------------------------------------------------------
    // Preview Modal (Step 2) — render logic (display-only)
    // -------------------------------------------------------------------------

    function getRosterAssignedUnitsArray(r) {
      try {
        const rawAssigned = Core.firstNonEmptyString(
          r && r.assigned_units_json,
          r && r.assignedUnitsJson,
          r && r.assigned_units,
          r && r.assignedUnits
        );

        let arr = null;

        if (rawAssigned && typeof rawAssigned === 'string') {
          try { arr = JSON.parse(rawAssigned); } catch (_) { arr = null; }
        } else if (Array.isArray(rawAssigned)) {
          arr = rawAssigned;
        } else if (rawAssigned && typeof rawAssigned === 'object') {
          if (Array.isArray(rawAssigned.units)) arr = rawAssigned.units;
          else if (Array.isArray(rawAssigned.assigned_units)) arr = rawAssigned.assigned_units;
        }

        return Array.isArray(arr) ? arr : [];
      } catch (_) {
        return [];
      }
    }

    function computeAssignedRosters(allRosters, assetCtx) {
  const wantRefId = assetCtx && assetCtx.refId != null ? String(assetCtx.refId).trim() : '';
  const unitPoints = assetCtx && typeof assetCtx.points === 'number' ? assetCtx.points : 0;

  if (!wantRefId) return [];

  const out = [];

  (allRosters || []).forEach(function (r) {
    const unitsArr = getRosterAssignedUnitsArray(r);

    // Find matching unit by REF ID
    let match = null;
    for (let i = 0; i < unitsArr.length; i++) {
      const u = unitsArr[i];
      if (!u || typeof u !== 'object') continue;

      const uRef = (u.refId != null) ? String(u.refId).trim() : '';
      if (uRef && uRef === wantRefId) { match = u; break; }
    }
    if (!match) return;

    const qty = parseInt((match.qty != null ? match.qty : match.quantity), 10) || 0;
    if (qty <= 0) return;

    const rosterPoints = parseInt(r.points, 10) || 0;
    const assignedCost = (unitPoints || 0) * qty;
    const pct = rosterPoints > 0 ? Math.ceil((assignedCost / rosterPoints) * 100) : 0;

    out.push({
      roster: r,
      qty: qty,
      assignedCost: assignedCost,
      pct: pct
    });
  });

  return out;
}


      
    function renderPreviewRosterFilters() {
      if (!previewModal) return;

      var host = previewModal.querySelector('.shoshin-preview-roster-filters');
      if (!host) return;

      host.innerHTML = '';

      // Match assign modal UX: centered row of buttons
      host.style.display = 'flex';
      host.style.justifyContent = 'center';
      host.style.gap = '10px';
      host.style.flexWrap = 'wrap';
      host.style.margin = '0 0 12px 0';

      var filters = ['All Rosters', '~ 500', '~ 1000', '~ 2500', '2500+'];

      filters.forEach(function (label) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'shoshin-asset-filter-btn' + (previewState.filterLabel === label ? ' is-active' : '');
        btn.textContent = label;

        btn.addEventListener('click', function () {
          previewState.filterLabel = label;
          renderPreviewRosterFilters();
          renderPreviewRosterList();
        });

        host.appendChild(btn);
      });
    }

    function getPreviewFilteredAssigned() {
      var assigned = previewState.rostersAssigned || [];
      return assigned.filter(function (x) {
        var r = x && x.roster ? x.roster : null;
        if (!r) return false;
        return pointsMatchFilter(r.points, previewState.filterLabel);
      });
    }

    function renderPreviewRosterList() {
      if (!previewModal) return;

      var list = previewModal.querySelector('.shoshin-preview-roster-list');
      var emptyGlobal = previewModal.querySelector('.shoshin-preview-empty-global');
      var emptyFilter = previewModal.querySelector('.shoshin-preview-empty-filter');

      if (!list || !emptyGlobal || !emptyFilter) return;

      list.innerHTML = '';
      emptyGlobal.style.display = 'none';
      emptyFilter.style.display = 'none';

      // Loading state: before fetch resolves, we can show “Loading…” via global empty
      // Detect “loading” as: modal open + rostersAll empty + rostersAssigned empty but we *do* have an asset
      var isLoading = !!previewState.asset && (previewState.rostersAll.length === 0) && (previewState.requestToken > 0) && (previewState.rostersAssigned.length === 0);

      if (isLoading) {
        emptyGlobal.style.display = '';
        emptyGlobal.innerHTML = '<em>Loading assignments…</em>';
        return;
      }

      var assignedAll = previewState.rostersAssigned || [];
      if (!assignedAll.length) {
        emptyGlobal.style.display = '';
        emptyGlobal.innerHTML = '<em>There are currently no clan rosters this unit is assigned to.</em>';
        return;
      }

      var filtered = getPreviewFilteredAssigned();
      if (!filtered.length) {
        emptyFilter.style.display = '';
        emptyFilter.innerHTML = '<em>No assigned rosters in this points range.</em>';
        return;
      }

      filtered.forEach(function (x) {
        var r = x.roster;

        var row = document.createElement('div');
        row.className = 'shoshin-assign-roster-row shoshin-preview-roster-row';

        row.innerHTML = `
            <div class="shoshin-roster-left">
              
              <img class="shoshin-roster-avatar"
                  src="${Core.esc(r.img || FALLBACK_IMAGE)}"
                  alt="Roster image"
                  loading="lazy">
            </div>

            <div class="shoshin-roster-mid">
              <div class="shoshin-roster-name">${Core.esc(r.name || 'Untitled Roster')}</div>
              <div class="shoshin-roster-ref">${r.refId ? 'REF ID: ' + Core.esc(r.refId) : ''}</div>
            </div>

            <div class="shoshin-roster-stats">
              <table class="shoshin-stat-strip">
                <tbody>
                  <tr>
                    <td>
                      <div class="shoshin-stat-cell">
                        <div class="shoshin-stat-label">POINTS</div>
                        <div class="shoshin-stat-value">${Core.esc(String(r.points || 0))}</div>
                      </div>
                    </td>

                    <td>
                      <div class="shoshin-stat-cell">
                        <div class="shoshin-stat-label">UNITS</div>
                        <div class="shoshin-stat-value">${Core.esc(String(r.units || 0))}</div>
                      </div>
                    </td>

                    <td>
                      <div class="shoshin-stat-cell">
                        <div class="shoshin-stat-label">INITIATIVE</div>
                        <div class="shoshin-stat-value">${Core.esc(String(r.ini || 0))}</div>
                      </div>
                    </td>

                    <td>
                      <div class="shoshin-stat-cell">
                        <div class="shoshin-stat-label">HONOR</div>
                        <div class="shoshin-stat-value">${Core.esc(String(r.honor || 0))}</div>
                      </div>
                    </td>

                    <td>
                      <div class="shoshin-stat-cell">
                        <div class="shoshin-stat-label">QTY</div>
                        <div class="shoshin-stat-value">${Core.esc(String(x.qty))}</div>
                      </div>
                    </td>

                    <td>
                      <div class="shoshin-stat-cell">
                        <div class="shoshin-stat-value">${Core.esc(String(x.pct))}%</div>
                      </div>
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          `;


        list.appendChild(row);
      });
    }




    function ensureAssignModal() {
      if (assignModal && assignModalBackdrop) return;

      assignModalBackdrop = document.createElement('div');
      assignModalBackdrop.className = 'shoshin-modal-backdrop';
      assignModalBackdrop.setAttribute('aria-hidden', 'true');

      assignModal = document.createElement('div');
      assignModal.className = 'shoshin-modal';
      assignModal.classList.add('shoshin-assign-modal');

      assignModal.setAttribute('role', 'dialog');
      assignModal.setAttribute('aria-modal', 'true');
      assignModal.setAttribute('aria-labelledby', 'shoshin-assign-modal-title');

      assignModal.innerHTML = `
  <div class="shoshin-modal-header">
    <img class="shoshin-modal-logo"
         src="/wp-content/uploads/2025/11/Header_logo_300x150_1.png"
         alt="Site logo" />
    <button type="button" class="shoshin-modal-x" aria-label="Close">×</button>
  </div>

  <div class="shoshin-modal-body shoshin-assign-body-wrap">
    <!-- ROW 1 -->
    <div class="shoshin-assign-row1">
      <!-- Column 1: Asset summary -->
      <div class="shoshin-assign-asset">
        <img class="shoshin-assign-asset-img" src="${Core.esc(FALLBACK_IMAGE)}" alt="Asset image" loading="lazy">

        <div class="shoshin-assign-asset-meta">
          <div class="shoshin-assign-asset-class">—</div>
          <div class="shoshin-assign-asset-ref"><strong>REF ID</strong> —</div>
          <div class="shoshin-assign-asset-cost"><strong>Total Cost:</strong> 0</div>
        </div>
      </div>

      <!-- Column 2: Quantity -->
      <div class="shoshin-assign-qty">
        <div class="shoshin-assign-qty-title">Select Quantity</div>
        <select class="shoshin-assign-qty-select" aria-label="Select quantity"></select>
      </div>
    </div>

    <!-- ROW 2 -->
    <div class="shoshin-assign-row2">
      <div class="shoshin-assign-mode">
        <label class="shoshin-mode-switch">
          <input type="checkbox" id="assignModeToggle">
          <span class="track"><span class="thumb"></span></span>
        </label>
        <div class="shoshin-mode-label" data-off="One → Many" data-on="Many → One">
          One → Many
        </div>
        <div class="shoshin-assign-mode-note" aria-live="polite"></div>
      </div>
    </div>

    <!-- ROW 3 -->
    <div class="shoshin-assign-row3">
      <div class="shoshin-assign-rosters-head">Available Clan Rosters</div>
      <div class="shoshin-assign-roster-filters"></div>
      <div class="shoshin-assign-roster-list" aria-live="polite"></div>

      <div class="shoshin-assign-empty" style="display:block;">
        <em>No rosters found.</em><br>
        Create one in <strong>/my-rosters</strong> or <strong>/create-roster</strong>.
      </div>      
    </div>
  </div>

  <div class="shoshin-modal-actions shoshin-assign-actions">
    <button type="button" class="shoshin-modal-btn shoshin-modal-btn-cancel">Cancel</button>
    <button type="button" class="shoshin-modal-btn shoshin-modal-btn-confirm shoshin-assign-save" disabled>Assign</button>
  </div>
`;


      function nudgeSelectAtLeastOneRoster() {
      // Show a clear instruction
      showAssignInlineError('You must select at least one clan roster to assign this unit to.');

      // Optional: ensure the message is visible
      try {
        const noteEl = assignModal.querySelector('.shoshin-assign-mode-note');
          if (noteEl) noteEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

          } catch (_) {}
        }

          // If user tries to click Assign while it is disabled, show a helpful message.
          // NOTE: Disabled buttons don't emit click, so we listen on the actions container instead.
          const actionsEl = assignModal.querySelector('.shoshin-assign-actions');
          const assignBtn = assignModal.querySelector('.shoshin-assign-save');

          function shouldNudge() {
            return assignState.selectedRosterIds.size === 0;
          }

          function nudgeFromAnyEvent(e) {
            // We only care about "user is trying to interact with Assign"
            // When disabled, the event target might be the container, not the button.
            const clickedAssign =
              (e.target === assignBtn) ||
              (e.target && e.target.closest && e.target.closest('.shoshin-assign-save'));

            // If the click/tap happened in the right-side action area near the Assign button,
            // treat it as an attempt even if the button is disabled and doesn't receive events.
            const withinActions = actionsEl && actionsEl.contains(e.target);

            // If we can positively detect the Assign button, use it.
            // Otherwise, if the user interacted inside the actions area and Assign is disabled,
            // nudge anyway (Cancel still works; but we can exclude it).
            const clickedCancel = e.target && e.target.closest && e.target.closest('.shoshin-modal-btn-cancel');

            if (clickedCancel) return;

            const assignIsDisabled = assignBtn ? !!assignBtn.disabled : true;

            if ((clickedAssign || (withinActions && assignIsDisabled)) && shouldNudge()) {
              // Stop accidental form submits / focus weirdness
              try { e.preventDefault(); } catch (_) {}
              try { e.stopPropagation(); } catch (_) {}
              nudgeSelectAtLeastOneRoster();
            }
          }

          if (actionsEl) {
            actionsEl.addEventListener('click', nudgeFromAnyEvent, true);
            actionsEl.addEventListener('mousedown', nudgeFromAnyEvent, true);
            actionsEl.addEventListener('touchstart', nudgeFromAnyEvent, { passive: false, capture: true });
          }




      document.body.appendChild(assignModalBackdrop);
      document.body.appendChild(assignModal);

      // Backdrop cancels
      assignModalBackdrop.addEventListener('click', closeAssignModal);

      // X and Cancel
      const xBtn = assignModal.querySelector('.shoshin-modal-x');
      const cancelBtn = assignModal.querySelector('.shoshin-modal-btn-cancel');
      if (xBtn) xBtn.addEventListener('click', closeAssignModal);
      if (cancelBtn) cancelBtn.addEventListener('click', closeAssignModal);

      // ESC cancels (bind once globally)
      if (Core.bindOnce(document.documentElement, 'AssignModalEsc')) {
        document.addEventListener('keydown', function (e) {
          if (!assignModalBackdrop || assignModalBackdrop.getAttribute('aria-hidden') === 'true') return;
          if (e.key === 'Escape') closeAssignModal();
        });
      }

      // Qty select
      const qtySel = assignModal.querySelector('.shoshin-assign-qty-select');
      if (qtySel) {
        qtySel.addEventListener('change', function () {
          const v = parseInt(qtySel.value, 10);
          assignState.qty = isFinite(v) && v >= 1 ? Math.min(v, 99) : 1;
          renderRosterList();
          updateAssignButtonState();
        });
      }

      // Sync toggle UI every time modal opens
      const modeToggle = assignModal.querySelector('#assignModeToggle');
      const modeLabel = assignModal.querySelector('.shoshin-mode-label');
      if (modeToggle) modeToggle.checked = assignState.mode === 'many_to_one';
      if (modeLabel) modeLabel.textContent = assignState.mode === 'many_to_one' ? modeLabel.dataset.on : modeLabel.dataset.off;

      if (modeToggle) {
        modeToggle.checked = assignState.mode === 'many_to_one';
        if (modeLabel) modeLabel.textContent = modeToggle.checked ? modeLabel.dataset.on : modeLabel.dataset.off;

        modeToggle.addEventListener('change', function () {
          const newMode = modeToggle.checked ? 'many_to_one' : 'one_to_many';
          setAssignMode(newMode);
          if (modeLabel) modeLabel.textContent = modeToggle.checked ? modeLabel.dataset.on : modeLabel.dataset.off;
        });

        renderAssignModeNote();
      }

      // Roster toggle change (delegated)
      assignModal.addEventListener('change', function (e) {
        const input = e.target;
        if (!input || !input.classList || !input.classList.contains('shoshin-roster-toggle')) return;

        const rosterId = input.getAttribute('data-roster-id') || '';
        if (!rosterId) return;

        if (assignState.mode === 'many_to_one') {
          assignState.selectedRosterIds.clear();
          if (input.checked) assignState.selectedRosterIds.add(rosterId);

          const all = assignModal.querySelectorAll('.shoshin-roster-toggle');
          all.forEach(function (cb) {
            if (cb === input) return;
            cb.checked = false;
          });
        } else {
          if (input.checked) assignState.selectedRosterIds.add(rosterId);
          else assignState.selectedRosterIds.delete(rosterId);
        }

        if (assignState.selectedRosterIds.size > 0) clearAssignInlineError();


        renderRosterList();
        updateAssignButtonState();
      });

      // Assign button (REAL persistence via admin-ajax.php)
        const saveBtn = assignModal.querySelector('.shoshin-assign-save');
        if (saveBtn) {
          saveBtn.addEventListener('click', function () {
            // IMPORTANT: do not gate on saveBtn.disabled, because disabled buttons
            // may not fire click consistently and we want to show the instruction.
            if (assignModalBusy) return;

            // Safety guard (shouldn't happen if disabled logic is correct)
            if (!assignState.selectedRosterIds.size) {
              showAssignInlineError('You must select at least one clan roster to assign this unit to.');
              return;
            }

            clearAssignInlineError();



            const payload = buildAssignPayload();

            log('assign debug typeof ajaxAssignAssetToRosters', typeof ajaxAssignAssetToRosters);

            assignModalBusy = true;
            setAssignBusy(true);

            ajaxAssignAssetToRosters(payload)
              .then(function (res) {
                // Optional: keep local rosters in sync (so next open reflects assignments without refresh)
                // We only bump the summary stats in memory; server is source of truth.
                const updatedIds = (res && res.updatedRosterIds) ? res.updatedRosterIds.map(String) : [];
                const qty = (payload.mode === 'one_to_many') ? 1 : (payload.assignments[0] && payload.assignments[0].qty ? payload.assignments[0].qty : 1);

                // Many→One: only one roster in updatedIds anyway; One→Many: qty always 1
                assignState.rosters = (assignState.rosters || []).map(function (r) {
                  if (!updatedIds.includes(String(r.entryId))) return r;

                  const addQty = (payload.mode === 'one_to_many') ? 1 : (assignState.qty || 1);
                  return Object.assign({}, r, {
                    points: (parseInt(r.points, 10) || 0) + ((payload.asset.points || 0) * addQty),
                    units: (parseInt(r.units, 10) || 0) + addQty,
                    ini: (parseInt(r.ini, 10) || 0) + ((payload.asset.ini || 0) * addQty),
                    honor: (parseInt(r.honor, 10) || 0) + ((payload.asset.honor || 0) * addQty)
                  });
                });

                const assignedCount = updatedIds.length;

                // Show success state on button
                const btn = assignModal.querySelector('.shoshin-assign-save');
                if (btn) {
                  btn.disabled = true;
                  btn.textContent =
                    'Assigned to ' +
                    assignedCount +
                    ' roster' +
                    (assignedCount === 1 ? '' : 's');
                }

                // Hold for 2 seconds, then close
                setTimeout(function () {
                  closeAssignModal();

                  // Reset button for next open
                  if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Assign';
                  }
                }, 2000);
              })
              .catch(function (err) {
                const msg = err && err.message ? err.message : 'Assign failed.';
                showAssignInlineError(msg);

              })
              .finally(function () {
                assignModalBusy = false;
                setAssignBusy(false);
                try { saveBtn.focus(); } catch (_) {}
              });
          });
        }



      // Build qty options 1..99
      if (qtySel) {
        qtySel.innerHTML = '';
        for (let i = 1; i <= 99; i++) {
          const opt = document.createElement('option');
          opt.value = String(i);
          opt.textContent = String(i);
          qtySel.appendChild(opt);
        }
      }

      updateQtyUI();
    }

    function setAssignMode(mode) {
        // NEW: Daimyo hard-rule: mode must remain One→Many
        if (assignState.isDaimyoAsset && mode !== 'one_to_many') return;


      if (assignState.mode === mode) return;
      assignState.mode = mode;

      assignState.selectedRosterIds.clear();

      if (mode === 'one_to_many') {
        assignState.qty = 1;
      }

      renderAssignModeNote();
      updateQtyUI();
      renderRosterList();
      updateAssignButtonState();
    }

    function renderAssignModeNote() {
  if (!assignModal) return;
  var noteEl = assignModal.querySelector('.shoshin-assign-mode-note');
  if (!noteEl) return;

  // Keep any existing inline error node, but clear the base note content first.
  var existingErr = noteEl.querySelector('.shoshin-assign-inline-error');

  // Clear note content
  noteEl.innerHTML = '';

  // Rebuild the base note
    if (assignState.isDaimyoAsset) {
    var rosters = Array.isArray(assignState.rosters) ? assignState.rosters : [];
    var anyAssignable = rosters.some(function (r) { return r && !r.hasDaimyo; });
    var blocked = (rosters.length > 0) && !anyAssignable;

    if (blocked) {
      noteEl.innerHTML =
        '<strong style="color:#c0392b;">Restriction:</strong> ' +
        '<span style="color:#c0392b; font-weight:700;">Only one Daimyo is allowed to be assigned to a clan.</span>';
    } else {
      noteEl.innerHTML = '<strong>Restriction:</strong> Only one Daimyo is allowed to be assigned to a clan.';
    }

  } else if (assignState.mode === 'one_to_many') {
    noteEl.innerHTML = '<strong>One \u2192 Many:</strong> Quantity is locked to 1 but can be assigned to multiple rosters.';
  } else {
    noteEl.innerHTML = '<strong>Many \u2192 One:</strong> Quantity is adjustable but can only be assigned to a single roster.';
  }

  // Re-append existing inline error (if any)
  if (existingErr) {
    noteEl.appendChild(existingErr);
  }
}


function showAssignInlineError(msg) {
  if (!assignModal) return;

  const noteEl = assignModal.querySelector('.shoshin-assign-mode-note');
  if (!noteEl) return;

  // Remove any prior error
  const old = noteEl.querySelector('.shoshin-assign-inline-error');
  if (old && old.parentNode) old.parentNode.removeChild(old);

  if (!msg) return;

  const err = document.createElement('div');
  err.className = 'shoshin-assign-inline-error';
  err.textContent = String(msg);

  // Visual styling (already agreed)
  err.style.textAlign = 'center';
  err.style.color = '#c0392b';
  err.style.fontWeight = '700';
  err.style.marginTop = '8px';
  err.style.lineHeight = '1.25';

  noteEl.appendChild(err);

  // 🔽 NEW: Auto-scroll to the message
  // Use requestAnimationFrame so DOM/layout is settled
  requestAnimationFrame(function () {
    try {
      noteEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',   // aligns nicely without hiding header
        inline: 'nearest'
      });
    } catch (_) {}
  });
}


function clearAssignInlineError() {
  showAssignInlineError('');
}



    function updateQtyUI() {
      if (!assignModal) return;
      const qtySel = assignModal.querySelector('.shoshin-assign-qty-select');
      if (!qtySel) return;

      if (assignState.mode === 'one_to_many') {
        qtySel.value = '1';
        qtySel.disabled = true;
      } else {
        qtySel.disabled = false;
        qtySel.value = String(assignState.qty || 1);
      }
    }

    function updateAssignButtonState() {
      if (!assignModal) return;
      const btn = assignModal.querySelector('.shoshin-assign-save');
      if (!btn) return;

      const ok = assignState.selectedRosterIds.size > 0;

      // Enable/disable for real (so click works when ok)
      btn.disabled = !ok;

      // Keep visual state synced
      btn.classList.toggle('is-disabled', !ok);
      btn.setAttribute('aria-disabled', ok ? 'false' : 'true');
    }

        // Busy state for Assign modal buttons
        let assignModalBusy = false;
        function setAssignBusy(isBusy) {
        if (!assignModal) return;
        const btnAssign = assignModal.querySelector('.shoshin-assign-save');
        const btnCancel = assignModal.querySelector('.shoshin-modal-btn-cancel');
        const xBtn = assignModal.querySelector('.shoshin-modal-x');

        if (btnAssign) {
          // Only truly disable during busy network work
          btnAssign.disabled = !!isBusy;
          btnAssign.textContent = isBusy ? 'Assigning…' : 'Assign';

          // Keep visual disabled state in sync
          const ok = assignState.selectedRosterIds.size > 0;
          btnAssign.classList.toggle('is-disabled', !ok);
          btnAssign.setAttribute('aria-disabled', ok ? 'false' : 'true');
        }

        if (btnCancel) btnCancel.disabled = !!isBusy;
        if (xBtn) xBtn.disabled = !!isBusy;
        }


    function buildAssignPayload() {
      const asset = assignState.asset || {};
      const selected = Array.from(assignState.selectedRosterIds);

      const assignments = selected.map(function (rosterId) {
        return {
          rosterEntryId: rosterId,
          qty: assignState.mode === 'one_to_many' ? 1 : assignState.qty || 1
        };
      });

     
      return {
        mode: assignState.mode,
                asset: {
          entryId: asset.entryId || null,
          kind: asset.kind || '',
          cls: asset.cls || '',
          refId: asset.refId || '',
          name: asset.name || '',
          img: asset.img || '',

          // Cost/Points
          points: typeof asset.points === 'number' ? asset.points : 0,

          // Keep for server-side totals logic (your current backend expects these)
          ini: (asset.stats && typeof asset.stats.ini === 'number') ? asset.stats.ini : (typeof asset.ini === 'number' ? asset.ini : 0),

          // IMPORTANT: honor should be LDR (you already map honor=ldr in UI)
          honor: (asset.stats && typeof asset.stats.ldr === 'number') ? asset.stats.ldr : (typeof asset.honor === 'number' ? asset.honor : 0),

          // ✅ NEW: send the full stats object so it can be written into assigned_units_json
          stats: asset.stats ? asset.stats : {},

          unitKey: asset.unitKey || ''
        },

        assignments: assignments
      };
    }

    // -------------------------------
    // Assign Modal: Roster filtering + paging  (REFRACTOR to match /my-rosters UX)
    // -------------------------------
    var ROSTER_PAGE_SIZE = 6;
    var rosterVisibleLimit = ROSTER_PAGE_SIZE;

    // Points filter labels (mirrors /my-rosters)
    var rosterCurrentFilter = 'All Rosters'; // 'All Rosters' | '~ 500' | '~ 1000' | '~ 2500' | '2500+'

    var rosterLoadMoreWrap = null;
    var rosterLoadMoreBtn = null;

    function ensureRosterLoadMoreEl() {
      if (!assignModal) return null;

      if (!rosterLoadMoreWrap) {
        rosterLoadMoreWrap = document.createElement('div');
        rosterLoadMoreWrap.className = 'shoshin-load-more-wrap';
        rosterLoadMoreWrap.style.display = 'flex';
        rosterLoadMoreWrap.style.justifyContent = 'center';
        rosterLoadMoreWrap.style.width = '100%';

        rosterLoadMoreBtn = document.createElement('button');
        rosterLoadMoreBtn.type = 'button';
        rosterLoadMoreBtn.className = 'shoshin-load-more-btn shoshin-btn';
        rosterLoadMoreBtn.textContent = 'Load more';

        rosterLoadMoreBtn.addEventListener('click', function () {
          rosterVisibleLimit += ROSTER_PAGE_SIZE;
          applyRosterFilterAndPaging();
          try { rosterLoadMoreBtn.focus(); } catch (_) {}
        });

        rosterLoadMoreWrap.appendChild(rosterLoadMoreBtn);

        var row3 = assignModal.querySelector('.shoshin-assign-row3');
        if (row3) row3.appendChild(rosterLoadMoreWrap);
      }

      return rosterLoadMoreWrap;
    }

    function pointsMatchFilter(points, label) {
      points = parseInt(points, 10) || 0;

      if (label === 'All Rosters') return true;
      if (label === '~ 500')  return (points >= 0   && points <= 500);
      if (label === '~ 1000') return (points >= 501 && points <= 1000);
      if (label === '~ 2500') return (points >= 1001 && points <= 2500);
      if (label === '2500+')  return (points >= 2501);
      return true;
    }

    function getFilteredRosters() {
      var rosters = assignState.rosters || [];
      return rosters.filter(function (r) {
        return pointsMatchFilter(r.points, rosterCurrentFilter);
      });
    }

    function renderRosterFilters() {
      if (!assignModal) return;

      var host = assignModal.querySelector('.shoshin-assign-roster-filters');
      if (!host) {
        var row3 = assignModal.querySelector('.shoshin-assign-row3');
        var list = assignModal.querySelector('.shoshin-assign-roster-list');
        if (row3 && list) {
          host = document.createElement('div');
          host.className = 'shoshin-assign-roster-filters';
          row3.insertBefore(host, list);
        }
      }
      if (!host) return;

      host.innerHTML = '';

      // Center-aligned like /my-rosters
      host.style.display = 'flex';
      host.style.justifyContent = 'center';
      host.style.gap = '10px';
      host.style.flexWrap = 'wrap';
      host.style.margin = '0 0 12px 0';

      var filters = ['All Rosters', '~ 500', '~ 1000', '~ 2500', '2500+'];

      filters.forEach(function (label) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'shoshin-asset-filter-btn';
        btn.textContent = label;

        if (label === rosterCurrentFilter) btn.classList.add('is-active');

        btn.addEventListener('click', function () {
          rosterCurrentFilter = label;
          rosterVisibleLimit = ROSTER_PAGE_SIZE;

          var all = host.querySelectorAll('button');
          all.forEach(function (b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');

          applyRosterFilterAndPaging();
        });

        host.appendChild(btn);
      });
    }


    function renderRosterListWith(rostersToRender) {
      if (!assignModal) return;

      var list = assignModal.querySelector('.shoshin-assign-roster-list');
      var empty = assignModal.querySelector('.shoshin-assign-empty');
      if (!list || !empty) return;

      list.innerHTML = '';

            if (!rostersToRender || !rostersToRender.length) {
        // Distinguish: "no rosters exist" vs "filter has zero matches"
        var anyRostersExist = (assignState.rosters && assignState.rosters.length) ? true : false;

        empty.style.display = '';

        if (anyRostersExist && rosterCurrentFilter !== 'All Rosters') {
          // EXACT empty message from /my-rosters for active filter with 0 matches
          empty.innerHTML = '<h2><em>You currently do not have any clans with these points totals.</em></h2>';
        } else {
          // Original baseline message
          empty.innerHTML =
            '<em>No rosters found.</em><br>' +
            'Create one in <strong>/my-rosters</strong> or <strong>/create-roster</strong>.';
        }

        return;
      }
      empty.style.display = 'none';


      function fmtWithDelta(base, delta) {
        var b = parseInt(base, 10) || 0;
        var d = parseInt(delta, 10) || 0;
        return String(b + d);
      }

      rostersToRender.forEach(function (r) {
        var isSelected = assignState.selectedRosterIds.has(r.entryId);

        // NEW: if assigning Daimyo, any roster that already has a Daimyo must be locked
        var isDaimyoLocked = !!(assignState.isDaimyoAsset && r.hasDaimyo);

        // Safety: ensure a locked roster can never remain selected
        if (isDaimyoLocked && isSelected) {
        assignState.selectedRosterIds.delete(r.entryId);
        isSelected = false;
        }

        var perRosterQty = isSelected ? (assignState.mode === 'one_to_many' ? 1 : assignState.qty || 1) : 0;

        var asset = assignState.asset || {};
        var deltaPoints = (asset.points || 0) * perRosterQty;
        var deltaUnits = perRosterQty;
        var deltaIni = (asset.ini || 0) * perRosterQty;
        var deltaHonor = (asset.honor || 0) * perRosterQty;

        var row = document.createElement('div');
        row.className = 'shoshin-assign-roster-row';

        row.innerHTML = `
      <div class="shoshin-roster-left">
        <label class="shoshin-ios-toggle ${r.entryId ? '' : 'is-disabled'}">
          <input type="checkbox"
                 class="shoshin-roster-toggle"
                 data-roster-id="${Core.esc(r.entryId)}"
                 ${isSelected ? 'checked' : ''}>
          <span class="track"><span class="thumb"></span></span>
        </label>
        <img class="shoshin-roster-avatar"
             src="${Core.esc(r.img || FALLBACK_IMAGE)}"
             alt="Roster image"
             loading="lazy">
      </div>

      <div class="shoshin-roster-main">
        <div class="shoshin-roster-title">
          <div class="shoshin-roster-name">${Core.esc(r.name || 'Untitled Roster')}</div>
          <div class="shoshin-roster-ref">${r.refId ? 'REF ID: ' + Core.esc(r.refId) : ''}</div>
        </div>

        <div class="shoshin-roster-stats">
          <table class="shoshin-stat-strip">
            <tbody>
              <tr>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">CLAN POINTS</div><div class="shoshin-stat-value">${Core.esc(fmtWithDelta(r.points, deltaPoints))}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">UNITS</div><div class="shoshin-stat-value">${Core.esc(fmtWithDelta(r.units, deltaUnits))}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">INITIATIVE</div><div class="shoshin-stat-value">${Core.esc(fmtWithDelta(r.ini, deltaIni))}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">HONOR</div><div class="shoshin-stat-value">${Core.esc(fmtWithDelta(r.honor, deltaHonor))}</div></div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

        var cb = row.querySelector('.shoshin-roster-toggle');
        if (cb && (!r.entryId || r.entryId === '')) {
          cb.disabled = true;
          var wrap = row.querySelector('.shoshin-ios-toggle');
          if (wrap) wrap.classList.add('is-disabled');
        }

        // NEW: Daimyo lock styling + disable
        if (assignState.isDaimyoAsset && r.hasDaimyo) {
          if (cb) cb.disabled = true;

          var wrap = row.querySelector('.shoshin-ios-toggle');
          if (wrap) {
            wrap.classList.add('is-disabled', 'is-daimyo-locked');
          }

          row.classList.add('shoshin-roster-daimyo-locked');
        }



        list.appendChild(row);
      });

      if (assignState.mode === 'many_to_one' && assignState.selectedRosterIds.size > 1) {
        var first = Array.from(assignState.selectedRosterIds)[0];
        assignState.selectedRosterIds = new Set([first]);
      }
    }

    function applyRosterFilterAndPaging() {
      if (!assignModal) return;

      ensureRosterLoadMoreEl();

      var filtered = getFilteredRosters();
      var showCount = Math.min(rosterVisibleLimit, filtered.length);
      var slice = filtered.slice(0, showCount);

      renderRosterListWith(slice);

      if (rosterLoadMoreWrap) {
        rosterLoadMoreWrap.style.display = filtered.length > rosterVisibleLimit ? 'flex' : 'none';
        if (rosterLoadMoreBtn) {
          var remaining = Math.max(0, filtered.length - showCount);
          rosterLoadMoreBtn.textContent = remaining > 0 ? 'Load more (' + remaining + ' more)' : 'Load more';
        }
      }

      updateAssignButtonState();
    }

    function renderRosterList() {
      applyRosterFilterAndPaging();
    }

    function openAssignModal(assetCtx) {
        ensureAssignModal();
        clearAssignInlineError();

        assignModalBusy = false;
        setAssignBusy(false);


        assignState.asset = assetCtx || null;
        assignState.selectedRosterIds.clear();

        // ✅ Ensure Daimyo constraints are computed BEFORE rendering the mode note
        assignState.isDaimyoAsset =
            !!(assignState.asset && String(assignState.asset.cls || '').trim().toLowerCase() === 'daimyo');

        // If Daimyo: force One → Many + qty locked to 1
        if (assignState.isDaimyoAsset) {
            assignState.mode = 'one_to_many';
            assignState.qty = 1;
        }

        // ✅ Now render the correct message for the current asset
        renderAssignModeNote();


      const modeToggle = assignModal.querySelector('#assignModeToggle');
      const modeLabel = assignModal.querySelector('.shoshin-mode-label');

      if (modeToggle) modeToggle.checked = assignState.mode === 'many_to_one';
      if (modeLabel) modeLabel.textContent = assignState.mode === 'many_to_one' ? modeLabel.dataset.on : modeLabel.dataset.off;

      // NEW: lock the One/Many toggle if Daimyo
        if (modeToggle) {
        modeToggle.disabled = assignState.isDaimyoAsset;
        // If disabled, also prevent click/visual confusion
        var sw = modeToggle.closest ? modeToggle.closest('.shoshin-mode-switch') : null;
        if (sw && sw.classList) sw.classList.toggle('is-disabled', assignState.isDaimyoAsset);
        }


      updateQtyUI();

      try {
        const img = assignModal.querySelector('.shoshin-assign-asset-img');
        const cls = assignModal.querySelector('.shoshin-assign-asset-class');
        const ref = assignModal.querySelector('.shoshin-assign-asset-ref');
        const cost = assignModal.querySelector('.shoshin-assign-asset-cost');

        if (img) img.src = assetCtx && assetCtx.img ? assetCtx.img : FALLBACK_IMAGE;
        if (cls) cls.textContent = assetCtx && assetCtx.name ? assetCtx.name : '—';
        if (ref) ref.innerHTML = '<strong>REF ID</strong> ' + Core.esc(assetCtx && assetCtx.refId ? assetCtx.refId : '—');
        if (cost) cost.innerHTML = '<strong>Total Cost:</strong> ' + Core.esc(String(assetCtx && assetCtx.points ? assetCtx.points : 0));
      } catch (_) {}

      try {
        var emptyMsg = assignModal.querySelector('.shoshin-assign-empty');
        var listEl2 = assignModal.querySelector('.shoshin-assign-roster-list');
        if (emptyMsg) {
          emptyMsg.style.display = 'block';
          emptyMsg.innerHTML = '<em>Loading rosters…</em>';
        }
        if (listEl2) listEl2.innerHTML = '';
      } catch (_) {}

            rosterCurrentFilter = 'All Rosters';
            rosterVisibleLimit = ROSTER_PAGE_SIZE;


      ajaxFetchMyRosters()
        .then(function (rows) {
          var norm = (rows || []).map(normalizeRoster).filter(function (r) { return !!r.entryId; });
          // Sort rosters ASC by REF ID (case-insensitive)
            norm.sort(function (a, b) {
            var ra = (a.refId || '').toString().toUpperCase();
            var rb = (b.refId || '').toString().toUpperCase();

            if (ra < rb) return -1;
            if (ra > rb) return 1;
            return 0;
            });

            assignState.rosters = norm;

            renderAssignModeNote();


          renderRosterFilters();
          applyRosterFilterAndPaging();
        })
        .catch(function () {
          assignState.rosters = [];
          renderRosterFilters();
          applyRosterFilterAndPaging();
        });

      setModalVisible(assignModal, assignModalBackdrop, true);

      const confirmBtn = assignModal.querySelector('.shoshin-modal-btn-confirm');
      if (confirmBtn) confirmBtn.focus();

      updateAssignButtonState();
    }

    function closeAssignModal() {

        clearAssignInlineError();

        assignModalBusy = false;
        setAssignBusy(false);


      if (!assignModalBackdrop || !assignModal) return;
      setModalVisible(assignModal, assignModalBackdrop, false);
    }

    // Filters
    const FILTER_ORDER = ['All', 'Daimyo', 'Samurai', 'Ashigaru', 'Sohei', 'Ninja', 'Onmyoji', 'Support Assets'];
    const availableFilters = FILTER_ORDER.slice();
    let currentFilter = 'All';
    let emptyEl = null;

    function ensureEmptyEl() {
      if (!wrapperEl) return null;
      if (!emptyEl) {
        emptyEl = document.createElement('div');
        emptyEl.className = 'shoshin-asset-empty-state';
        emptyEl.style.display = 'none';
        wrapperEl.insertBefore(emptyEl, listEl);
      }
      return emptyEl;
    }

    function applyFilter(filterLabel) {
      currentFilter = filterLabel;
      if (!wrapperEl) return;

      const msgEl = ensureEmptyEl();
      const cards = wrapperEl.querySelectorAll('.shoshin-asset-card');
      let visibleCount = 0;

      cards.forEach((card) => {
        const cardClass = (card.dataset.className || '').trim();
        let show = false;

        if (filterLabel === 'All') {
          show = true;
        } else if (filterLabel === 'Support Assets') {
          show = cardClass === 'Artillery' || cardClass === 'Sailing Ships';
        } else {
          show = cardClass === filterLabel;
        }

        card.dataset.shoshinMatch = show ? '1' : '0';
        if (show) visibleCount++;
      });

      if (msgEl) {
        if (visibleCount === 0) {
          let htmlMsg = '';
          if (filterLabel === 'All') htmlMsg = '<h2><em>You have not created any Character or Support Asset entries.</em></h2>';
          else if (filterLabel === 'Support Assets') htmlMsg = '<h2><em>No entries exist for these Support Assets.</em></h2>';
          else htmlMsg = '<h2><em>No entries exist for this Character Class.</em></h2>';
          msgEl.innerHTML = htmlMsg;
          msgEl.style.display = 'block';
        } else {
          msgEl.style.display = 'none';
        }
      }
    }

    function buildFilterBar() {
      if (!wrapperEl || availableFilters.length === 0) return null;

      const bar = document.createElement('div');
      bar.className = 'shoshin-asset-filters';

      availableFilters.forEach((label) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'shoshin-asset-filter-btn';
        btn.dataset.filter = label;
        btn.textContent = label === 'All' ? 'All Units' : label;

        if (label === currentFilter) btn.classList.add('is-active');

        btn.addEventListener('click', function () {
          const all = bar.querySelectorAll('.shoshin-asset-filter-btn');
          all.forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');

          assetVisibleLimit = ASSET_PAGE_SIZE;

          applyFilter(label);
          applyAssetFilterAndPaging();
        });

        bar.appendChild(btn);
      });

      return bar;
    }

    if (wrapperEl) {
      const bar = buildFilterBar();
      if (bar) wrapperEl.insertBefore(bar, listEl);
    }

    // Delete buttons (delegated)
        function wireDeleteButtons() {
      if (!wrapperEl) return;

      wrapperEl.addEventListener('click', function (e) {
        const btn = e.target && e.target.closest ? e.target.closest('.shoshin-btn-delete') : null;
        if (!btn) return;

        const card = btn.closest('.shoshin-asset-card');
        if (!card) return;

        // Build a minimal assetCtx using the SAME DOM sources as Preview modal
        const entryId = card && card.dataset ? (card.dataset.entryId || null) : null;

        const displayNameEl = card.querySelector('.shoshin-asset-class-name');
        const displayName = displayNameEl && displayNameEl.textContent ? displayNameEl.textContent.trim() : '';

        const refIdEl = card.querySelector('.shoshin-asset-ref');
        const refId = refIdEl && refIdEl.textContent ? refIdEl.textContent.trim() : '';

        // Avatar image (same selector used by preview/assign capture)
        const imgEl = card.querySelector('.shoshin-asset-avatar img');
        const img = imgEl ? (imgEl.getAttribute('src') || FALLBACK_IMAGE) : FALLBACK_IMAGE;

        // Cost (points) (same DOM source used by Preview modal capture)
        let points = '—';
        const costEl = card.querySelector('.shoshin-stat-cost-cell .cost-value');
        if (costEl) {
          const m = String(costEl.textContent || '').match(/-?\d+/);
          if (m) points = parseInt(m[0], 10) || 0;
        }

        const cardClass = (card.dataset.className || '').trim();
        const kind = (cardClass === 'Artillery' || cardClass === 'Sailing Ships') ? 'support' : 'character';
        const formId = kind === 'support' ? 2501 : 2247;

        const assetCtx = {
          entryId,
          kind,
          cls: cardClass || '',
          refId,
          name: (displayName || refId || cardClass || ''),
          img,
          points
        };

        // Fill delete modal header + summary (before opening)
        ensureDeleteModal();

        var titleEl = document.getElementById('shoshin-delete-modal-title');
        if (titleEl) titleEl.textContent = 'Delete asset?';

        setDeleteAssetSummary(assetCtx);

        var descEl = document.getElementById('shoshin-delete-modal-desc');
        if (descEl) {
          descEl.textContent = 'Deleting this asset is permanent and is not recoverable!';
        }

        openDeleteModal(function () {
          if (!entryId) return Promise.reject(new Error('Missing entry id.'));

          return ajaxDeleteEntry(entryId, { kind: kind, formId: formId, refId: refId }).then(function () {
            if (card && card.parentNode) card.parentNode.removeChild(card);

            try {
              if (typeof applyFilter === 'function') applyFilter(currentFilter);
            } catch (_) {}

            console.info('Shoshin: entry deleted', { entryId, refId });
          });
        });
      });
    }



        // -------------------------------------------------------------------------
    // Preview Assignments (display-only modal) — View button
    // -------------------------------------------------------------------------
    function wirePreviewButtons() {
      if (!wrapperEl) return;

      wrapperEl.addEventListener('click', function (e) {
        const btn = e.target && e.target.closest ? e.target.closest('.shoshin-btn-view') : null;
        if (!btn) return;

        const card = btn.closest('.shoshin-asset-card');
        if (!card) return;

        // Build a minimal assetCtx using the SAME DOM sources as Assign modal
        const entryId = card && card.dataset ? (card.dataset.entryId || null) : null;

        const displayNameEl = card.querySelector('.shoshin-asset-class-name');
        const displayName = displayNameEl && displayNameEl.textContent ? displayNameEl.textContent.trim() : '';

        const refIdEl = card.querySelector('.shoshin-asset-ref');
        const refId = refIdEl && refIdEl.textContent ? refIdEl.textContent.trim() : '';

        // Avatar image (same selector used by assign modal capture)
        const imgEl = card.querySelector('.shoshin-asset-avatar img');
        const img = imgEl ? (imgEl.getAttribute('src') || FALLBACK_IMAGE) : FALLBACK_IMAGE;

        // Cost (points) (same DOM source as assign modal capture)
        let points = 0;
        const costEl = card.querySelector('.shoshin-stat-cost-cell .cost-value');
        if (costEl) {
          const m = String(costEl.textContent || '').match(/-?\d+/);
          if (m) points = parseInt(m[0], 10) || 0;
        }

        // Determine kind + cls (mirrors existing logic)
        const cardClass = (card.dataset.className || '').trim();
        const kind = (cardClass === 'Artillery' || cardClass === 'Sailing Ships') ? 'support' : 'character';
        const cls = cardClass || '';
        const name = displayName || refId || cls || '';

                // Normalize image to a site-relative path so unitKey matches assigned_units_json
let imgKey = String(img || '').trim();
try {
  // If img is absolute, convert to pathname (e.g. https://site.com/wp-content/... -> /wp-content/...)
  if (imgKey) imgKey = new URL(imgKey, window.location.origin).pathname || imgKey;
} catch (_) {}

const unitKey =
  String(kind).trim() + '|' +
  String(cls).trim() + '|' +
  String(refId).trim() + '|' +
  String(name).trim() + '|' +
  String(imgKey).trim();


        openPreviewModal({
          entryId,
          kind,
          cls,
          refId,
          name,
          img,
          points,
          unitKey
        });

      });
    }



        // Assign buttons (delegated)
    function wireAssignButtons() {
      if (!wrapperEl) return;

      // Helper: read a numeric stat value from a card by its label (e.g., "INI", "LDR")
      function getNumericStatFromCard(card, labelText) {
        if (!card) return 0;
        const cells = card.querySelectorAll('.shoshin-stat-cell');
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const lab = cell.querySelector('.shoshin-stat-label');
          const val = cell.querySelector('.shoshin-stat-value');
          if (!lab || !val) continue;

          const labTxt = String(lab.textContent || '').trim().toUpperCase();
          if (labTxt !== String(labelText || '').trim().toUpperCase()) continue;

          // Parse first integer; non-numeric (e.g. "Highest", "--") becomes 0
          const m = String(val.textContent || '').match(/-?\d+/);
          return m ? (parseInt(m[0], 10) || 0) : 0;
        }
        return 0;
      }

            // NEW: read a raw stat value from a card by its label (keeps strings like "1d6", "Highest", "Variable")
      function getRawStatFromCard(card, labelText) {
        if (!card) return '';
        const cells = card.querySelectorAll('.shoshin-stat-cell');
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const lab = cell.querySelector('.shoshin-stat-label');
          const val = cell.querySelector('.shoshin-stat-value');
          if (!lab || !val) continue;

          const labTxt = String(lab.textContent || '').trim().toUpperCase();
          if (labTxt !== String(labelText || '').trim().toUpperCase()) continue;

          return String(val.textContent || '').trim();
        }
        return '';
      }

            // NEW: parse int-like values safely (returns 0 if not numeric)
      function toInt(val) {
        const m = String(val || '').match(/-?\d+/);
        return m ? (parseInt(m[0], 10) || 0) : 0;
      }

      // NEW: sanitize stat strings that may include inch quotes (") that can break JSON if unslashed server-side
      function cleanStatString(val) {
        if (val === null || val === undefined) return '';
        return String(val).trim().replace(/"/g, ''); // remove literal inch quote
      }



      wrapperEl.addEventListener('click', function (e) {
        const btn = e.target && e.target.closest ? e.target.closest('.shoshin-btn-assign') : null;
        if (!btn) return;

        const card = btn.closest('.shoshin-asset-card');
        if (!card) return;

        const entryId = card.dataset ? (card.dataset.entryId || null) : null;

        // Display name in your HTML
        const displayNameEl = card.querySelector('.shoshin-asset-class-name');
        const displayName = displayNameEl ? displayNameEl.textContent.trim() : '';

        // REF ID value
        const refIdEl = card.querySelector('.shoshin-asset-ref');
        const refId = refIdEl ? refIdEl.textContent.trim() : '';

        // Avatar image
        const imgEl = card.querySelector('.shoshin-asset-avatar img');
        const img = imgEl ? (imgEl.getAttribute('src') || FALLBACK_IMAGE) : FALLBACK_IMAGE;

        // Cost (points)
        let points = 0;
        const costEl = card.querySelector('.shoshin-stat-cost-cell .cost-value');
        if (costEl) {
          const m = String(costEl.textContent || '').match(/-?\d+/);
          if (m) points = parseInt(m[0], 10) || 0;
        }

                // ✅ FULL STAT CAPTURE (from the stat strip)
                const m_dmg = getRawStatFromCard(card, 'M DMG');
        const m_crt = getRawStatFromCard(card, 'M CRT');
        const m_dis = cleanStatString(getRawStatFromCard(card, 'M DIS'));

        const r_dmg = getRawStatFromCard(card, 'R DMG');
        const r_crt = getRawStatFromCard(card, 'R CRT');
        const r_dis = cleanStatString(getRawStatFromCard(card, 'R DIS'));


        const atk_raw = getRawStatFromCard(card, 'ATK');
        const def_raw = getRawStatFromCard(card, 'DEF');
        const mov_raw = getRawStatFromCard(card, 'MOV');
        const bod_raw = getRawStatFromCard(card, 'BOD');
        const ldr_raw = getRawStatFromCard(card, 'LDR');
        const ini_raw = getRawStatFromCard(card, 'INI');

        // Numeric-normalized where appropriate (keeps 0 for non-numeric)
        const atk = toInt(atk_raw);
        const def = toInt(def_raw);
        const mov = toInt(mov_raw);  // store as number; UI renders with Core.fmtInches()
        const bod = toInt(bod_raw);
        const ldr = toInt(ldr_raw);
        const ini = toInt(ini_raw);


        // Determine kind (characters vs support assets)
        const cardClass = (card.dataset.className || '').trim();
        const kind = (cardClass === 'Artillery' || cardClass === 'Sailing Ships') ? 'support' : 'character';

        // cls = bucket/class (Samurai, Artillery, etc.)
        const cls = cardClass || '';
        const name = displayName || refId || cls || '';

        const unitKey =
          String(kind).trim() + '|' +
          String(cls).trim() + '|' +
          String(refId).trim() + '|' +
          String(name).trim() + '|' +
          String(img).trim();

                openAssignModal({
          entryId,
          kind,
          cls,
          refId,
          name,
          img,

          // Points/cost
          points,

          // Keep these for your existing delta preview UI
          ini: ini,        // initiative delta in modal preview
          honor: ldr,      // honor delta comes from leadership

          // ✅ ADD: all stats to be persisted into roster JSON
          stats: {
            // keep raw (dice/variable strings) AND normalized numbers where needed
            m_dmg: String(m_dmg || '').trim() || '—',
            m_crt: String(m_crt || '').trim() || '—',
            m_dis: cleanStatString(m_dis) || '—',

            r_dmg: String(r_dmg || '').trim() || '—',
            r_crt: String(r_crt || '').trim() || '—',
            r_dis: cleanStatString(r_dis) || '—',

            atk: atk,
            def: def,
            mov: mov,   // number, inches added in /my-rosters display
            bod: bod,
            ldr: ldr,
            ini: ini
          },

          unitKey
        });

      });
    }


    const INEPT_PROFS = new Set(['Inept: Melee Combat', 'Inept: Ranged Combat', 'Inept: Water Combat', 'Inept: Horsemanship']);

    function buildProfAbilitiesRows(block) {
      const names = Core.splitLines(block);
      const rows = [];

      names.forEach((name) => {
        if (Data.PROFICIENCIES[name]) {
          const p = Data.PROFICIENCIES[name];
          rows.push({ image: p.image || FALLBACK_IMAGE, capability: p.capability, attributes: p.attributes, isInept: INEPT_PROFS.has(name) });
        } else if (Data.ABILITIES[name]) {
          const a = Data.ABILITIES[name];
          rows.push({ image: a.image || FALLBACK_IMAGE, capability: a.capability, attributes: a.attributes, isInept: false });
        }
      });

      return rows;
    }

    function buildEquipRows(block) {
      const names = Core.splitLines(block);
      const rows = [];

      names.forEach((name) => {
        if (Data.MELEE_WEAPONS[name]) {
          const m = Data.MELEE_WEAPONS[name];
          rows.push({ image: m.image || FALLBACK_IMAGE, equipment: name, type: m.type, attributes: m.attributes });
        } else if (Data.RANGED_WEAPONS[name]) {
          const r = Data.RANGED_WEAPONS[name];
          rows.push({ image: r.image || FALLBACK_IMAGE, equipment: name, type: r.type, attributes: r.attributes });
        } else if (Data.ARMOR[name]) {
          const a = Data.ARMOR[name];
          rows.push({ image: a.image || FALLBACK_IMAGE, equipment: name, type: a.type, attributes: a.attributes });
        } else if (Data.SUPPORT_ITEMS[name]) {
          const s = Data.SUPPORT_ITEMS[name];
          rows.push({ image: s.image || FALLBACK_IMAGE, equipment: name, type: s.type, attributes: s.attributes });
        }
      });

      return rows;
    }

    function buildRyuRows(block) {
      const names = Core.splitLines(block);
      const rows = [];

      names.forEach((name) => {
        if (Data.TRAINING[name]) {
          const t = Data.TRAINING[name];
          rows.push({ image: t.image || FALLBACK_IMAGE, ryu: t.ryu, discipline: t.discipline, equipment: t.equipment });
        }
      });

      return rows;
    }

    function parseModifiers(block) {
      const lines = Core.splitLines(block);
      const buckets = { M: [], R: [], B: [], P: [], A: [] };

      lines.forEach((line) => {
        const m = line.match(/^\s*\[([MRBPA])\]\s*(.+)$/i);
        if (!m) return;
        const tag = m[1].toUpperCase();
        const text = m[2].trim();
        if (buckets[tag]) buckets[tag].push(text);
      });

      return buckets;
    }

    function buildMunitionsRowsFromEquipItems(block) {
      const names = Core.splitLines(block);
      const rows = [];

      names.forEach((name) => {
        const m = Data.MUNITIONS[name];
        if (!m) return;
        rows.push({
          image: m.image || FALLBACK_IMAGE,
          munition: m.munition || name,
          type: m.type || '--',
          damage: m.damage || '--',
          critical: m.critical || '--',
          distance: m.distance || '--',
          attributes: m.attributes || '--',
          cost: m.cost || '--'
        });
      });

      return rows;
    }

    function createBaseCard(detailsId) {
      const card = document.createElement('div');
      card.className = 'shoshin-asset-card';
      card.dataset.detailsId = detailsId;
      return card;
    }

    function wireToggle(card) {
      const toggleBtn = card.querySelector('.shoshin-asset-toggle');
      const detailsPane = card.querySelector('.shoshin-asset-details');
      const iconEl = card.querySelector('.shoshin-asset-toggle-icon');
      const textEl = card.querySelector('.shoshin-asset-toggle-text');
      if (!toggleBtn || !detailsPane) return;

      toggleBtn.addEventListener('click', function () {
        const willOpen = !detailsPane.classList.contains('is-open');

        if (willOpen && typeof collapseAssetCard === 'function') {
          const scope = card.closest('.shoshin-asset-list-wrapper') || card.parentElement;
          if (scope) {
            const others = scope.querySelectorAll('.shoshin-asset-card .shoshin-asset-details.is-open');
            others.forEach(function (openPane) {
              const otherCard = openPane.closest('.shoshin-asset-card');
              if (otherCard && otherCard !== card) collapseAssetCard(otherCard);
            });
          }
        }

        detailsPane.classList.toggle('is-open', willOpen);
        detailsPane.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
        if (iconEl) iconEl.textContent = willOpen ? '−' : '+';
        if (textEl) textEl.textContent = willOpen ? 'Collapse build profile' : 'Expand to view complete build profile';
      });
    }

    function renderCommonExpansion(profRows, equipRows, ryuRows, mods) {
      function renderProfTable() {
        if (!profRows.length) return '<p class="shoshin-asset-empty"><em>No proficiencies or abilities.</em></p>';

        const rowsHtml = profRows
          .map(
            (row) => `
          <tr class="${row.isInept ? 'shoshin-red' : ''}">
            <td class="shoshin-cell-image"><img src="${Core.esc(row.image)}" alt="${Core.esc(row.capability)} icon" loading="lazy"></td>
            <td class="shoshin-cell-capability">${Core.esc(row.capability)}</td>
            <td class="shoshin-cell-attributes">${row.attributes}</td>
          </tr>
        `
          )
          .join('');

        return `
          <table class="shoshin-table shoshin-expansion-table shoshin-profab-table">
            <thead><tr><th>Image</th><th>Capability</th><th>Attributes</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        `;
      }

      function renderEquipTable() {
        if (!equipRows.length) return '<p class="shoshin-asset-empty"><em>No equipment or items.</em></p>';

        const rowsHtml = equipRows
          .map(
            (row) => `
          <tr>
            <td class="shoshin-cell-image"><img src="${Core.esc(row.image)}" alt="${Core.esc(row.equipment)} icon" loading="lazy"></td>
            <td class="shoshin-cell-equipment">${Core.esc(row.equipment)}</td>
            <td class="shoshin-cell-type">${Core.esc(row.type)}</td>
            <td class="shoshin-cell-attributes">${row.attributes}</td>
          </tr>
        `
          )
          .join('');

        return `
          <table class="shoshin-table shoshin-expansion-table shoshin-equip-table">
            <thead><tr><th>Image</th><th>Equipment</th><th>Type</th><th>Attributes</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        `;
      }

      function renderRyuTable() {
        if (!ryuRows.length) return '<p class="shoshin-asset-empty"><em>Untrained.</em></p>';

        const rowsHtml = ryuRows
          .map(
            (row) => `
          <tr>
            <td class="shoshin-cell-image"><img src="${Core.esc(row.image)}" alt="${Core.esc(row.ryu)} icon" loading="lazy"></td>
            <td>${Core.esc(row.ryu)}</td>
            <td>${Core.esc(row.discipline)}</td>
            <td>${Core.esc(row.equipment)}</td>
          </tr>
        `
          )
          .join('');

        return `
          <table class="shoshin-table shoshin-expansion-table shoshin-ryu-table">
            <thead><tr><th>Image</th><th>Ryū</th><th>Discipline</th><th>Equipment</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        `;
      }

      function renderModsTable() {
        const cols = { M: mods.M || [], R: mods.R || [], B: mods.B || [], P: mods.P || [], A: mods.A || [] };
        const hasAny = Object.values(cols).some((arr) => arr.length > 0);
        if (!hasAny) return '<p class="shoshin-asset-empty"><em>No combat modifiers.</em></p>';

        function listHtml(arr) {
          if (!arr.length) return '<span class="shoshin-modifiers-none">None</span>';
          return '<ul>' + arr.map((t) => `<li>${Core.esc(t)}</li>`).join('') + '</ul>';
        }

        return `
          <table class="shoshin-table shoshin-expansion-table shoshin-mods-table">
            <thead>
              <tr>
                <th data-tag="[M]"><span class="tag-hidden">[M]</span>Melee</th>
                <th data-tag="[R]"><span class="tag-hidden">[R]</span>Ranged</th>
                <th data-tag="[B]"><span class="tag-hidden">[B]</span>Both</th>
                <th data-tag="[P]"><span class="tag-hidden">[P]</span>Passive</th>
                <th data-tag="[A]"><span class="tag-hidden">[A]</span>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${listHtml(cols.M)}</td>
                <td>${listHtml(cols.R)}</td>
                <td>${listHtml(cols.B)}</td>
                <td>${listHtml(cols.P)}</td>
                <td>${listHtml(cols.A)}</td>
              </tr>
            </tbody>
          </table>
        `;
      }

      return { renderProfTable, renderEquipTable, renderRyuTable, renderModsTable };
    }

    function getSupportTrainingBlock(asset, supportType) {
      const explicit = Core.firstNonEmptyString(asset.asset_ryu, asset.assetRyu, asset.ryuBlock);
      if (explicit) return explicit;
      if (supportType === 'Ozutsu') return 'Kayakujutsu';
      if (supportType === 'Mokuzo Hansen') return 'Suieijutsu';
      return '';
    }

    // ----------------------------
    // CHARACTER CARD
    // ----------------------------
    function renderCharacterAssetCard(asset) {
      const className = asset.className || 'Unknown Class';
      const meta = Data.CLASS_META[className] || {};

      const size = asset.size || meta.size || 'Medium';
      const descHtml = meta.description || '';
      const imgSrc = Data.CLASS_IMAGES[className] || Data.CLASS_IMAGES.default;
      const refId = asset.refId || '';
      const displayName = meta.displayName || className;

      const detailsId = `shoshin-asset-details-${asset.entryId || Math.random().toString(36).slice(2)}`;

      const profRows = buildProfAbilitiesRows(asset.profAbilBlock || '');
      const equipRows = buildEquipRows(asset.equipBlock || '');
      const ryuRows = buildRyuRows(asset.ryuBlock || '');
      const mods = parseModifiers(asset.modsBlock || '');

      const profNames = Core.splitLines(asset.profAbilBlock || '');
      const hasIneptMelee = profNames.includes('Inept: Melee Combat');
      const hasIneptRanged = profNames.includes('Inept: Ranged Combat');
      const hasIneptHorse = profNames.includes('Inept: Horsemanship');

      const equipNames = equipRows.map((r) => r.equipment);
      const hasUma = equipNames.includes('Uma');

      const expansion = renderCommonExpansion(profRows, equipRows, ryuRows, mods);

      const card = createBaseCard(detailsId);
      card.dataset.className = className;
      if (asset && asset.entryId) card.dataset.entryId = String(asset.entryId);

      card.innerHTML = `
        <div class="shoshin-asset-row1">
          <div class="shoshin-asset-avatar">
            <img src="${Core.esc(imgSrc)}" alt="${Core.esc(displayName)} portrait" loading="lazy">
          </div>

          <div class="shoshin-asset-header-main">
            <h2 class="shoshin-asset-class-name">${Core.esc(displayName)}</h2>
            <div class="shoshin-asset-class-desc">${descHtml}</div>
            <div class="shoshin-asset-size"><strong>Size:</strong> ${Core.esc(size)}</div>
          </div>

          <div class="shoshin-asset-actions row1-actions">
            <button type="button" class="shoshin-btn shoshin-btn-view" aria-label="View Assignments" data-tooltip="View Assignments">
              <img class="shoshin-btn-icon" src="${Core.esc(VIEW_ICON_URL)}" alt="View">
            </button>

            <button type="button" class="shoshin-btn shoshin-btn-assign" aria-label="Assign to Roster" data-tooltip="Assign to Roster">Assign</button>

            <button type="button" class="shoshin-btn shoshin-btn-delete" aria-label="Delete Asset" data-tooltip="Delete Asset">Delete</button>
          </div>

        </div>

        <div class="shoshin-asset-stat-row">
          <table class="shoshin-stat-strip">
            <tbody>
              <tr>
                <td class="shoshin-ref-td">
                  <div class="shoshin-stat-cell shoshin-stat-ref">
                    <div class="shoshin-stat-value shoshin-asset-ref">${refId ? Core.esc(refId) : '—'}</div>
                  </div>
                </td>

                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">M DMG</div><div class="shoshin-stat-value ${hasIneptMelee ? 'shoshin-red' : ''}">${Core.esc(asset.meleeDamage || '—')}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">M CRT</div><div class="shoshin-stat-value ${hasIneptMelee ? 'shoshin-red' : ''}">${Core.esc(asset.meleeCrit || '—')}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">M DIS</div><div class="shoshin-stat-value ${hasIneptMelee ? 'shoshin-red' : ''}">${Core.esc(asset.meleeDistance || '—')}</div></div></td>

                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">R DMG</div><div class="shoshin-stat-value ${hasIneptRanged ? 'shoshin-red' : ''}">${Core.esc(asset.rangedDamage || '—')}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">R CRT</div><div class="shoshin-stat-value ${hasIneptRanged ? 'shoshin-red' : ''}">${Core.esc(asset.rangedCrit || '—')}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">R DIS</div><div class="shoshin-stat-value ${hasIneptRanged ? 'shoshin-red' : ''}">${Core.esc(asset.rangedDistance || '—')}</div></div></td>

                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">ATK</div><div class="shoshin-stat-value">${Core.esc(asset.atk || '—')}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">DEF</div><div class="shoshin-stat-value">${Core.esc(asset.def || '—')}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">MOV</div><div class="shoshin-stat-value">${Core.esc(Core.fmtInches(asset.mov || '—'))}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">BOD</div><div class="shoshin-stat-value ${hasIneptHorse && hasUma ? 'shoshin-red' : ''}">${Core.esc(asset.bod || '—')}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">LDR</div><div class="shoshin-stat-value">${Core.esc(asset.ldr || '—')}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">INI</div><div class="shoshin-stat-value">${Core.esc(asset.ini || '—')}</div></div></td>

                <td class="shoshin-stat-cost-cell">
                  <div class="cost-label">COST</div>
                  <div class="cost-value">${asset.totalCost ? Core.esc(asset.totalCost) : '—'}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <button type="button" class="shoshin-asset-toggle" data-target="${Core.esc(detailsId)}">
          <span class="shoshin-asset-toggle-icon">+</span>
          <span class="shoshin-asset-toggle-text">Expand to view complete build profile</span>
        </button>

        <div id="${Core.esc(detailsId)}" class="shoshin-asset-details" aria-hidden="true">
          <div class="shoshin-asset-grid">
            <div class="shoshin-asset-block">
              <h3>Proficiencies &amp; Abilities</h3>
              ${expansion.renderProfTable()}
            </div>

            <div class="shoshin-asset-block">
              <h3>Equipment &amp; Items</h3>
              ${expansion.renderEquipTable()}
            </div>

            <div class="shoshin-asset-block">
              <h3>Ryū Discipline</h3>
              ${expansion.renderRyuTable()}
            </div>

            <div class="shoshin-asset-block">
              <h3>Combat Modifiers</h3>
              ${expansion.renderModsTable()}
            </div>
          </div>
        </div>
      `;

      wireToggle(card);
      return card;
    }

    // ----------------------------
    // SUPPORT ASSET CARD
    // ----------------------------
    function renderSupportAssetCard(asset) {
      const className = asset.className || 'Support Assets'; // Artillery / Sailing Ships
      const meta = Data.CLASS_META[className] || {};
      const supportType = asset.supportType || '';

      let size = asset.size || meta.size || 'Medium';
      let descHtml = meta.description || '';
      let imgSrc = Data.CLASS_IMAGES[className] || Data.CLASS_IMAGES.default;
      let displayName = meta.displayName || className;

      if (supportType) {
        displayName = supportType;
        if (supportType === 'Ozutsu') {
          descHtml = '<em>Lightweight Cannon</em>';
          imgSrc = Data.CLASS_IMAGES.Artillery || imgSrc;
        } else if (supportType === 'Mokuzo Hansen') {
          descHtml = '<em>Wooden Sailing Ship</em>';
          imgSrc = Data.CLASS_IMAGES['Sailing Ships'] || imgSrc;
        }
      }

      const dimension =
        asset.dimension && String(asset.dimension).trim() !== ''
          ? asset.dimension
          : supportType === 'Ozutsu'
          ? '1" × 2"'
          : '--';

      if (supportType === 'Ozutsu' && (!size || size === '--')) size = 'Medium';

      const refId = asset.refId || '';
      const detailsId = `shoshin-asset-details-${asset.entryId || Math.random().toString(36).slice(2)}`;

      const trainingBlock = getSupportTrainingBlock(asset, supportType);
      const trainingRows = buildRyuRows(trainingBlock);

      const equipItemsBlock = Core.firstNonEmptyString(
        asset.asset_equip_items,
        asset.assetEquipItems,
        asset.equipItemsBlock,
        asset.equip_items,
        asset.equipBlock,
        asset.equipBlockRaw
      );
      const munRows = buildMunitionsRowsFromEquipItems(equipItemsBlock);

      const modsBlock = Core.firstNonEmptyString(asset.asset_mrbpa_modifiers, asset.modsBlock, asset.assetMrbpaModifiers, asset.asset_mrbpa, asset.assetMrbpa);
      const mods = parseModifiers(modsBlock);

      function renderTrainingTable() {
        if (!trainingRows.length) return '<p class="shoshin-asset-empty"><em>None.</em></p>';

        const rowsHtml = trainingRows
          .map(
            (row) => `
          <tr>
            <td class="shoshin-cell-image"><img src="${Core.esc(row.image)}" alt="${Core.esc(row.ryu)} icon" loading="lazy"></td>
            <td>${Core.esc(row.ryu)}</td>
            <td>${Core.esc(row.discipline)}</td>
            <td>${Core.esc(row.equipment)}</td>
          </tr>
        `
          )
          .join('');

        return `
          <table class="shoshin-table shoshin-expansion-table shoshin-ryu-table">
            <thead>
              <tr><th>Image</th><th>Ryū</th><th>Discipline</th><th>Equipment</th></tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        `;
      }

      function renderSupportMunitionsTable(rows) {
        if (!rows.length) return '<p class="shoshin-asset-empty"><em>No equipment or items.</em></p>';

        const rowsHtml = rows
          .map(
            (r) => `
          <tr>
            <td class="shoshin-cell-image"><img src="${Core.esc(r.image)}" alt="${Core.esc(r.munition)} icon" loading="lazy"></td>
            <td style="font-weight:600; white-space:nowrap;">${Core.esc(r.munition)}</td>
            <td>${Core.esc(r.type)}</td>
            <td style="text-align:center;">${Core.esc(r.damage)}</td>
            <td style="text-align:center;">${Core.esc(r.critical)}</td>
            <td style="text-align:center;">${Core.esc(r.distance)}</td>
            <td class="shoshin-cell-attributes">${r.attributes}</td>
          </tr>
        `
          )
          .join('');

        return `
          <table class="shoshin-table shoshin-expansion-table shoshin-equip-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Munition</th>
                <th>Type</th>
                <th style="text-align:center;">Damage</th>
                <th style="text-align:center;">Critical</th>
                <th style="text-align:center;">Distance</th>
                <th>Attributes</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        `;
      }

      const expansion = renderCommonExpansion([], [], [], mods);

      const card = createBaseCard(detailsId);
      card.dataset.className = className;
      if (asset && asset.entryId) card.dataset.entryId = String(asset.entryId);

      card.innerHTML = `
        <div class="shoshin-asset-row1">
          <div class="shoshin-asset-avatar">
            <img src="${Core.esc(imgSrc)}" alt="${Core.esc(displayName)} portrait" loading="lazy">
          </div>

          <div class="shoshin-asset-header-main">
            <h2 class="shoshin-asset-class-name">${Core.esc(displayName)}</h2>
            <div class="shoshin-asset-class-desc">${descHtml}</div>
            <div class="shoshin-asset-size"><strong>Size:</strong> ${Core.esc(size)}</div>
            <div class="shoshin-asset-size"><strong>Dimensions:</strong> ${Core.esc(dimension)}</div>
          </div>

          <div class="shoshin-asset-actions row1-actions">
            <button type="button" class="shoshin-btn shoshin-btn-view" aria-label="View Assignments" data-tooltip="View Assignments">
              <img class="shoshin-btn-icon" src="${Core.esc(VIEW_ICON_URL)}" alt="View">
            </button>

            <button type="button" class="shoshin-btn shoshin-btn-assign" aria-label="Assign to Roster" data-tooltip="Assign to Roster">Assign</button>

            <button type="button" class="shoshin-btn shoshin-btn-delete" aria-label="Delete Asset" data-tooltip="Delete Asset">Delete</button>
          </div>

        </div>

        <div class="shoshin-asset-stat-row">
          <table class="shoshin-stat-strip">
            <tbody>
              <tr>
                <td class="shoshin-ref-td">
                  <div class="shoshin-stat-cell shoshin-stat-ref">
                    <div class="shoshin-stat-value shoshin-asset-ref">${refId ? Core.esc(refId) : '—'}</div>
                  </div>
                </td>

                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">M DMG</div><div class="shoshin-stat-value">${Core.esc(asset.meleeDamage || '—')}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">M CRT</div><div class="shoshin-stat-value">${Core.esc(asset.meleeCrit || '—')}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">M DIS</div><div class="shoshin-stat-value">${Core.esc(asset.meleeDistance || '—')}</div></div></td>

                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">R DMG</div><div class="shoshin-stat-value">${Core.esc(asset.rangedDamage || '—')}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">R CRT</div><div class="shoshin-stat-value">${Core.esc(asset.rangedCrit || '—')}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">R DIS</div><div class="shoshin-stat-value">${Core.esc(asset.rangedDistance || '—')}</div></div></td>

                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">ATK</div><div class="shoshin-stat-value">${Core.esc(asset.atk || '—')}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">DEF</div><div class="shoshin-stat-value">${Core.esc(asset.def || '—')}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">MOV</div><div class="shoshin-stat-value">${Core.esc(Core.fmtInches(asset.mov || '—'))}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">BOD</div><div class="shoshin-stat-value">${Core.esc(asset.bod || '—')}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">LDR</div><div class="shoshin-stat-value">${Core.esc(asset.ldr || '—')}</div></div></td>
                <td><div class="shoshin-stat-cell"><div class="shoshin-stat-label">INI</div><div class="shoshin-stat-value">${Core.esc(asset.ini || '—')}</div></div></td>

                <td class="shoshin-stat-cost-cell">
                  <div class="cost-label">COST</div>
                  <div class="cost-value">${asset.totalCost ? Core.esc(asset.totalCost) : '—'}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <button type="button" class="shoshin-asset-toggle" data-target="${Core.esc(detailsId)}">
          <span class="shoshin-asset-toggle-icon">+</span>
          <span class="shoshin-asset-toggle-text">Expand to view complete build profile</span>
        </button>

        <div id="${Core.esc(detailsId)}" class="shoshin-asset-details" aria-hidden="true">
          <div class="shoshin-asset-grid">
            <div class="shoshin-asset-block">
              <h3>Training Requirements</h3>
              ${renderTrainingTable()}
            </div>

            <div class="shoshin-asset-block">
              <h3>Equipment &amp; Items</h3>
              ${renderSupportMunitionsTable(munRows)}
            </div>

            <div class="shoshin-asset-block">
              <h3>Combat Modifiers</h3>
              ${expansion.renderModsTable()}
            </div>
          </div>
        </div>
      `;

      wireToggle(card);
      return card;
    }

    // ----------------------------
    // RENDER LOOP
    // ----------------------------
    listEl.innerHTML = '';

    // =============================================================================
    // /my-assets — Paging + Single-Open Expansion (mirrors /my-rosters UX)
    // =============================================================================
    var ASSET_PAGE_SIZE = 10;
    var assetVisibleLimit = ASSET_PAGE_SIZE;

    var assetWrapperEl = listEl.closest('.shoshin-asset-list-wrapper') || listEl.parentElement;

    var assetLoadMoreWrap = null;
    var assetLoadMoreBtn = null;

    function ensureAssetLoadMoreEl() {
      if (!assetWrapperEl) return null;
      if (!assetLoadMoreWrap) {
        assetLoadMoreWrap = document.createElement('div');
        assetLoadMoreWrap.className = 'shoshin-load-more-wrap';
        assetLoadMoreWrap.style.display = 'none';

        assetLoadMoreBtn = document.createElement('button');
        assetLoadMoreBtn.type = 'button';
        assetLoadMoreBtn.className = 'shoshin-load-more-btn shoshin-btn';
        assetLoadMoreBtn.textContent = 'Load more';

        assetLoadMoreBtn.addEventListener('click', function () {
          assetVisibleLimit += ASSET_PAGE_SIZE;
          applyAssetFilterAndPaging();
          assetLoadMoreBtn && assetLoadMoreBtn.focus && assetLoadMoreBtn.focus();
        });

        assetLoadMoreWrap.appendChild(assetLoadMoreBtn);
        assetWrapperEl.appendChild(assetLoadMoreWrap);
      }
      return assetLoadMoreWrap;
    }

    function collapseAssetCard(card) {
      if (!card) return;

      var details = card.querySelector('.shoshin-asset-details');
      if (!details || !details.classList.contains('is-open')) return;

      details.classList.remove('is-open');
      details.setAttribute('aria-hidden', 'true');

      var btn = card.querySelector('.shoshin-asset-toggle');
      var icon = card.querySelector('.shoshin-asset-toggle-icon');
      var text = card.querySelector('.shoshin-asset-toggle-text');

      if (btn) btn.setAttribute('aria-expanded', 'false');
      if (icon) icon.textContent = '+';
      if (text) text.textContent = (btn && btn.getAttribute('data-expand-msg')) ? btn.getAttribute('data-expand-msg') : 'Expand';
    }

    function applyAssetFilterAndPaging() {
      if (!assetWrapperEl) return;

      ensureAssetLoadMoreEl();

      var cards = Array.prototype.slice.call(assetWrapperEl.querySelectorAll('.shoshin-asset-card'));

      var matching = cards.filter(function (c) {
        return c.dataset && c.dataset.shoshinMatch === '1';
      });

      cards.forEach(function (c) { c.style.display = 'none'; });

      var showCount = Math.min(assetVisibleLimit, matching.length);
      for (var i = 0; i < showCount; i++) matching[i].style.display = '';

      if (assetLoadMoreWrap) {
        assetLoadMoreWrap.style.display = matching.length > assetVisibleLimit ? 'flex' : 'none';
        if (assetLoadMoreBtn) {
          var remaining = Math.max(0, matching.length - showCount);
          assetLoadMoreBtn.textContent = remaining > 0 ? 'Load more (' + remaining + ' more)' : 'Load more';
        }
      }

      var openDetails = assetWrapperEl.querySelectorAll('.shoshin-asset-details.is-open');
      openDetails.forEach(function (d) {
        var card = d.closest('.shoshin-asset-card');
        if (card && card.style.display === 'none') collapseAssetCard(card);
      });
    }

    assets.forEach((asset) => {
      const kind = asset.kind || 'character';
      const isSupport = kind === 'support';
      const card = isSupport ? renderSupportAssetCard(asset) : renderCharacterAssetCard(asset);
      if (card) listEl.appendChild(card);
    });

    wireDeleteButtons();
    wireAssignButtons();
    wirePreviewButtons();
    applyFilter(currentFilter);
    applyAssetFilterAndPaging();

    log('Shoshin MyAssetsRenderer initialized');
  }

  // -------------------------------------------------------------------------
  // SUPPORT ASSET FORM 2501 (your latest working version; unchanged behavior)
  // -------------------------------------------------------------------------
  function initSupportForm2501() {
    if (!Shoshin.config.enableSupportForm2501) return;

    const FORM_ID_SUPPORT = 2501;
    const formEl =
      document.getElementById('wpforms-form-' + FORM_ID_SUPPORT) ||
      document.getElementById('wpforms-form_' + FORM_ID_SUPPORT) ||
      document.querySelector('form[data-formid="' + FORM_ID_SUPPORT + '"]');

    if (!formEl) return;
    if (!Core.bindOnce(formEl, 'SupportForm2501')) return;

    // Visible fields
    const FIELD_ID_GAME_SYSTEM = 2;
    const FIELD_ID_ASSET_TYPE = 4;
    const FIELD_ID_MUNITIONS = 8;
    const FIELD_ID_VESSEL_SIZE = 13;
    const FIELD_ID_VESSEL_DIM = 18;

    // DISPLAY-ONLY (ignored)
    const FIELD_ID_DETACHMENT = 19;

    // Hidden asset_* fields
    const FIELD_ID_ASSET_MELEE_DMG = 21;
    const FIELD_ID_ASSET_MELEE_CRIT = 22;
    const FIELD_ID_ASSET_MELEE_DIST = 23;
    const FIELD_ID_ASSET_RANGED_DMG = 24;
    const FIELD_ID_ASSET_RANGED_CRIT = 25;
    const FIELD_ID_ASSET_RANGED_DIST = 26;

    const FIELD_ID_ASSET_ATK = 27;
    const FIELD_ID_ASSET_DEF = 28;
    const FIELD_ID_ASSET_MOV = 29;
    const FIELD_ID_ASSET_BOD = 30;
    const FIELD_ID_ASSET_LDR = 31;
    const FIELD_ID_ASSET_INI = 32;
    const FIELD_ID_ASSET_TOTAL_COST = 33;

    const FIELD_ID_ASSET_MRBPA = 34;
    const FIELD_ID_ASSET_RULES = 35;
    const FIELD_ID_ASSET_SIZE = 36;
    const FIELD_ID_ASSET_DIMENSION = 37;

    const FIELD_ID_ASSET_RYU = 38;
    const FIELD_ID_ASSET_EQUIP_ITEMS = 39;

    const SUPPORT_ASSET_IMAGES = {
      default: '/wp-content/uploads/2025/12/Helmet-grey.jpg',
      Ozutsu: '/wp-content/uploads/2025/12/cannon.jpeg',
      'Mokuzo Hansen': '/wp-content/uploads/2025/12/makuzo.jpeg'
    };

    const SUPPORT_ASSET_META = {
      Ozutsu: {
        shortDescription: 'Lightweight Cannon',
        sizeFallback: 'Medium',
        dimensionFallback: '1" × 2"',
        rules: 'Lightweight cannon mounted on a wooden frame.'
      },
      'Mokuzo Hansen': {
        shortDescription: 'Wooden Sailing Ship',
        sizeFallback: 'Medium – 1" × 3"',
        rules: 'Wooden sailing ship suitable for coastal engagements.'
      }
    };

    const SUPPORT_ASSET_STATS = {
      Ozutsu: {
        meleeDamage: '--',
        meleeCrit: '--',
        meleeDistance: '--',
        rangedDamage: 'Variable',
        rangedCrit: 'Variable',
        rangedDistance: 'Variable',
        atk: 'Variable',
        def: '4',
        mov: 'Variable',
        bod: '3',
        ldr: '--',
        ini: 'Highest',
        cost: 8
      },
      'Mokuzo Hansen': {
        meleeDamage: '--',
        meleeCrit: '--',
        meleeDistance: '--',
        rangedDamage: '--',
        rangedCrit: '--',
        rangedDistance: '--',
        atk: '--',
        def: '3',
        mov: '--',
        bod: '--',
        ldr: '--',
        ini: 'Captain',
        cost: 0
      }
    };

    const MUNITIONS_DATA = {
      Tetsuho: { cost: 5, damage: '1d6', critical: '1d3', distance: '18"', modifiers: ['[R] 18–24": -1 To-Hit', '[R] 1" wide AOE Line', '[P] May damage stone & metal'] },
      'Bo-Hiya': { cost: 5, damage: '1d6', critical: '1d2', distance: '24"', modifiers: ['[R] 24–36": -1 To-Hit', '[R] Inflicts Burn on Hit'] },
      'Tama-ire': { cost: 5, damage: '1d3', critical: '1', distance: '12"', modifiers: ['[R] 12" 30° AOE cone', '[P] May damage stone & metal'] }
    };

    const HULL_STATS_BY_DIMENSION = {
      '1x3': { body: 4, cost: 8 },
      '2x4': { body: 6, cost: 12 },
      '2x5': { body: 7, cost: 14 },
      '2x6': { body: 8, cost: 16 },
      '3x6': { body: 12, cost: 24 },
      '3x7': { body: 13, cost: 26 },
      '3x8': { body: 14, cost: 28 },
      '3x9': { body: 15, cost: 30 },
      '4x8': { body: 20, cost: 40 },
      '4x9': { body: 21, cost: 42 },
      '4x10': { body: 22, cost: 44 },
      '4x11': { body: 23, cost: 46 },
      '4x12': { body: 24, cost: 48 },
      '5x10': { body: 30, cost: 60 },
      '5x11': { body: 31, cost: 62 },
      '5x12': { body: 32, cost: 64 },
      '5x13': { body: 33, cost: 66 },
      '5x14': { body: 34, cost: 68 },
      '5x15': { body: 35, cost: 70 }
    };

    function fieldSel(fieldId) { return '#wpforms-' + FORM_ID_SUPPORT + '-field_' + fieldId; }
    function fieldContainerSel(fieldId) { return '#wpforms-' + FORM_ID_SUPPORT + '-field_' + fieldId + '-container'; }
    function getFieldEl(fieldId) { return document.querySelector(fieldSel(fieldId)); }
    function setHidden(fieldId, value) {
      const el = getFieldEl(fieldId);
      if (!el) return;
      el.value = value == null ? '' : String(value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function getSingleSelectText(fieldId) {
      const select = getFieldEl(fieldId);
      if (!select || !select.options || select.selectedIndex < 0) return '';
      const opt = select.options[select.selectedIndex];
      return opt ? String(opt.text || '').trim() : '';
    }
    function getSupportAssetName() {
      const el = getFieldEl(FIELD_ID_ASSET_TYPE);
      if (!el) return '';
      const v = Core.canonicalLabel(el.value || '');
      if (v) return v;
      return Core.canonicalLabel(getSingleSelectText(FIELD_ID_ASSET_TYPE));
    }
    function getSelectedMunitions() {
      const container = document.querySelector(fieldContainerSel(FIELD_ID_MUNITIONS));
      if (!container) return [];
      const checked = container.querySelectorAll('input[type="checkbox"]:checked');
      return Array.from(checked).map((cb) => String(cb.value || '').trim()).filter(Boolean);
    }
    function getVesselDimensionsLabel() {
      const select = getFieldEl(FIELD_ID_VESSEL_DIM);
      if (!select || !select.options || select.selectedIndex < 0) return '';
      const opt = select.options[select.selectedIndex];
      if (!opt) return '';
      const label = String(opt.text || '').trim();
      const val = String(opt.value || '').trim();
      if (!val || /^select\b/i.test(label)) return '';
      return label;
    }
    function formatInches(raw) {
      if (raw == null) return '';
      const trimmed = String(raw).trim();
      if (!trimmed) return '';
      if (/[″"]$/.test(trimmed)) return trimmed;
      if (/^\d+$/.test(trimmed)) return trimmed + '"';
      return trimmed;
    }
    function parseHullLabel(label) {
      if (!label) return null;
      const m = String(label).match(/(\d+)\s*[×x]\s*(\d+)/i);
      if (!m) return null;
      return { width: parseInt(m[1], 10), length: parseInt(m[2], 10) };
    }
    function normalizeHullKey(label) { return String(label).replace(/\s+/g, '').replace(/[×x]/, 'x'); }
    function getCategoryFromWidth(width) {
      switch (width) {
        case 1: return 'Medium';
        case 2: return 'Large';
        case 3: return 'Huge';
        case 4: return 'Gargantuan';
        case 5: return 'Colossal';
        default: return 'Medium';
      }
    }
    function computeHullStats(width, length) {
      const key = normalizeHullKey(width + 'x' + length);
      const base = HULL_STATS_BY_DIMENSION[key];
      if (!base) return null;

      const category = getCategoryFromWidth(width);
      const movementByCategory = { Medium: 6, Large: 6, Huge: 5, Gargantuan: 5, Colossal: 4 };
      const operatorsByCategory = { Medium: 1, Large: 2, Huge: 3, Gargantuan: 4, Colossal: 5 };

      return { width, length, category, toughness: base.body, movement: movementByCategory[category] || 4, operators: operatorsByCategory[category] || 1, cost: base.cost };
    }
    function getMokuzoHullStatsFromForm() {
      if (getSupportAssetName() !== 'Mokuzo Hansen') return null;
      const label = getVesselDimensionsLabel();
      const dims = parseHullLabel(label);
      if (!dims) return null;
      return computeHullStats(dims.width, dims.length);
    }

    // Munitions hard-guard
    function ensureMunitionsRowCSSOverride() {
      if (document.getElementById('shoshin-munitions-force-visible-style')) return;
      const style = document.createElement('style');
      style.id = 'shoshin-munitions-force-visible-style';
      style.textContent = `#shoshin-munitions-table tbody tr { display: table-row !important; }`;
      document.head.appendChild(style);
    }
    function forceMunitionsRowsVisible() {
      const table = document.getElementById('shoshin-munitions-table');
      if (!table) return;
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach((r) => {
        if (r.style && r.style.display) r.style.display = '';
        r.removeAttribute('hidden');
        r.classList.remove('is-hidden');
      });
    }
    function installMunitionsObserverIfNeeded() {
      const table = document.getElementById('shoshin-munitions-table');
      if (!table || table.dataset.shoshinMunObs === '1') return;
      const tbody = table.querySelector('tbody');
      if (!tbody) return;

      table.dataset.shoshinMunObs = '1';

      const obs = new MutationObserver(() => {
        if (getSupportAssetName() !== 'Ozutsu') return;
        forceMunitionsRowsVisible();
      });

      obs.observe(tbody, { subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    }

    function updateSummaryPanel() {
      const assetName = getSupportAssetName();
      const nameEl = document.getElementById('shoshin-support-name');
      const imgEl = document.getElementById('shoshin-support-image');
      const descEl = document.getElementById('shoshin-support-description');
      const sizeEl = document.getElementById('shoshin-support-type');

      if (!nameEl && !imgEl && !descEl && !sizeEl) return;

      if (!assetName) {
        if (nameEl) nameEl.textContent = 'Select a Support Asset';
        if (descEl) descEl.textContent = 'Choose the asset to see its stats, cost, and special rules.';
        if (sizeEl) sizeEl.textContent = '--';
        if (imgEl) imgEl.src = SUPPORT_ASSET_IMAGES.default;
        return;
      }

      const meta = SUPPORT_ASSET_META[assetName] || {};
      if (nameEl) nameEl.textContent = assetName;
      if (descEl) descEl.textContent = meta.shortDescription || 'Support asset ready to be deployed.';

      if (sizeEl) {
        if (assetName === 'Mokuzo Hansen') {
          const hull = getMokuzoHullStatsFromForm();
          if (hull) sizeEl.textContent = hull.category + ' – ' + hull.width + '" × ' + hull.length + '"';
          else sizeEl.textContent = meta.sizeFallback || '--';
        } else {
          sizeEl.textContent = meta.sizeFallback || '--';
        }
      }

      if (imgEl) imgEl.src = SUPPORT_ASSET_IMAGES[assetName] || SUPPORT_ASSET_IMAGES.default;
    }

    function updateStatStrip() {
      const assetName = getSupportAssetName();

      const atkEl = document.getElementById('shoshin-stat-attack');
      const resEl = document.getElementById('shoshin-stat-resistance');
      const movEl = document.getElementById('shoshin-stat-movement');
      const toughEl = document.getElementById('shoshin-stat-toughness');
      const ldrEl = document.getElementById('shoshin-stat-leadership');
      const iniEl = document.getElementById('shoshin-stat-initiative');

      if (!atkEl || !resEl || !movEl || !toughEl || !ldrEl || !iniEl) return;

      const base = SUPPORT_ASSET_STATS[assetName] || null;
      if (!base) {
        atkEl.textContent = '--';
        resEl.textContent = '--';
        movEl.textContent = '--';
        toughEl.textContent = '--';
        ldrEl.textContent = '--';
        iniEl.textContent = '--';
        return;
      }

      let atk = base.atk;
      let mov = base.mov;
      let bod = base.bod;

      if (assetName === 'Mokuzo Hansen') {
        const hull = getMokuzoHullStatsFromForm();
        if (hull) {
          mov = String(hull.movement);
          bod = String(hull.toughness);
        } else {
          mov = '--';
          bod = '--';
        }
      }

      atkEl.textContent = atk || '--';
      resEl.textContent = base.def || '--';
      movEl.textContent = formatInches(mov) || '--';
      toughEl.textContent = bod || '--';
      ldrEl.textContent = base.ldr || '--';
      iniEl.textContent = base.ini || '--';
    }

    function updateRangedFromMunitions() {
      const assetName = getSupportAssetName();
      const rdEl = document.getElementById('shoshin-support-ranged-dmg');
      const rcEl = document.getElementById('shoshin-support-ranged-crit');
      const rrEl = document.getElementById('shoshin-support-ranged-dist');
      if (!rdEl || !rcEl || !rrEl) return;

      if (assetName !== 'Ozutsu') {
        rdEl.textContent = '--';
        rcEl.textContent = '--';
        rrEl.textContent = '--';
        return;
      }

      const selected = getSelectedMunitions();
      if (!selected.length) {
        rdEl.textContent = '--';
        rcEl.textContent = '--';
        rrEl.textContent = '--';
        return;
      }
      if (selected.length > 1) {
        rdEl.textContent = 'Variable';
        rcEl.textContent = 'Variable';
        rrEl.textContent = 'Variable';
        return;
      }

      const def = MUNITIONS_DATA[selected[0]];
      if (!def) {
        rdEl.textContent = '--';
        rcEl.textContent = '--';
        rrEl.textContent = '--';
        return;
      }

      rdEl.textContent = def.damage || '--';
      rcEl.textContent = def.critical || '--';
      rrEl.textContent = formatInches(def.distance || '--');
    }

    function computeTotalCost() {
      const assetName = getSupportAssetName();
      if (!assetName) return 0;

      let baseCost = 0;

      if (assetName === 'Ozutsu') {
        baseCost = SUPPORT_ASSET_STATS.Ozutsu.cost || 0;
        const selected = getSelectedMunitions();
        selected.forEach((name) => {
          const def = MUNITIONS_DATA[name];
          if (def && typeof def.cost === 'number') baseCost += def.cost;
        });
        return baseCost;
      }

      if (assetName === 'Mokuzo Hansen') {
        const hull = getMokuzoHullStatsFromForm();
        return hull && typeof hull.cost === 'number' ? hull.cost : 0;
      }

      return 0;
    }

    function updateCostBox() {
      const el = document.getElementById('shoshin-support-cost');
      if (!el) return;
      const total = computeTotalCost();
      el.textContent = total > 0 ? String(total) : '--';
    }

    function setTwoColList(col1Id, col2Id, items) {
      const col1 = document.getElementById(col1Id);
      const col2 = document.getElementById(col2Id);
      if (!col1 || !col2) return;

      col1.innerHTML = '';
      col2.innerHTML = '';

      const safe = Array.isArray(items) && items.length ? items : ['None'];
      const mid = Math.ceil(safe.length / 2);
      const left = safe.slice(0, mid);
      const right = safe.slice(mid);

      left.forEach((t) => {
        const li = document.createElement('li');
        li.textContent = t;
        col1.appendChild(li);
      });
      right.forEach((t) => {
        const li = document.createElement('li');
        li.textContent = t;
        col2.appendChild(li);
      });
    }

    function computeModifiersList() {
      const assetName = getSupportAssetName();
      if (!assetName) return ['None'];

      let mods = [];

      if (assetName === 'Ozutsu') {
        mods.push('[P] Neutral Asset');
        const selected = getSelectedMunitions();
        selected.forEach((name) => {
          const def = MUNITIONS_DATA[name];
          if (def && Array.isArray(def.modifiers)) mods.push.apply(mods, def.modifiers);
        });
      }

      if (assetName === 'Mokuzo Hansen') {
        mods.push('[P] Neutral Asset', '[P] Flammable');
        const hull = getMokuzoHullStatsFromForm();
        if (hull && hull.operators) mods.push('[P] Requires ' + hull.operators + ' ' + (hull.operators === 1 ? 'operator' : 'operators'));
      }

      mods = Core.dedupePreserveOrder(mods);
      return mods.length ? mods : ['None'];
    }

    function computeTrainingReqList() {
      const assetName = getSupportAssetName();
      if (!assetName) return ['None'];
      if (assetName === 'Ozutsu') return ['Kayakujutsu'];
      if (assetName === 'Mokuzo Hansen') return ['Suieijutsu'];
      return ['None'];
    }

    function computeEquipmentItemsList() {
      const assetName = getSupportAssetName();
      if (!assetName) return ['None'];

      if (assetName === 'Ozutsu') {
        const selected = getSelectedMunitions();
        return selected.length ? selected : ['None'];
      }
      return ['None'];
    }

    function updateTwoColumnBlocks() {
      setTwoColList('shoshin-support-modifiers-col1', 'shoshin-support-modifiers-col2', computeModifiersList());
      setTwoColList('shoshin-support-training-req-col1', 'shoshin-support-training-req-col2', computeTrainingReqList());
      setTwoColList('shoshin-support-equipment-items-col1', 'shoshin-support-equipment-items-col2', computeEquipmentItemsList());
    }

    function updateFieldVisibility() {
      const assetName = getSupportAssetName();

      const sizeContainer = document.querySelector(fieldContainerSel(FIELD_ID_VESSEL_SIZE));
      const dimContainer = document.querySelector(fieldContainerSel(FIELD_ID_VESSEL_DIM));

      const munSection = document.getElementById('shoshin-munitions-section');
      const munTable = document.getElementById('shoshin-munitions-table');
      const munEmpty = document.getElementById('shoshin-munitions-empty');
      const munWrap = document.querySelector(fieldContainerSel(FIELD_ID_MUNITIONS)) || getFieldEl(FIELD_ID_MUNITIONS);

      const isOzutsu = assetName === 'Ozutsu';
      const isMokuzo = assetName === 'Mokuzo Hansen';

      if (sizeContainer) sizeContainer.style.display = isMokuzo ? '' : 'none';
      if (dimContainer) dimContainer.style.display = isMokuzo ? '' : 'none';

      if (munSection) munSection.style.display = isOzutsu ? '' : 'none';
      if (munTable) munTable.style.display = isOzutsu ? '' : 'none';
      if (munWrap) munWrap.style.display = isOzutsu ? '' : 'none';

      if (munEmpty) munEmpty.style.display = 'none';

      if (isOzutsu) {
        ensureMunitionsRowCSSOverride();
        installMunitionsObserverIfNeeded();
        forceMunitionsRowsVisible();
      }
    }

    function updateSupportRulesTableFilter() {
      const table = document.getElementById('shoshin-support-rules-table');
      if (!table) return;

      const assetName = getSupportAssetName();
      const rows = table.querySelectorAll('tbody tr');

      rows.forEach((row) => {
        const rowAsset = String(row.dataset.asset || '').trim();
        if (!assetName) row.style.display = '';
        else row.style.display = rowAsset === assetName ? '' : 'none';
      });
    }

    function updateSupportTrainingTableFilter() {
      const table = document.getElementById('shoshin-support-training-table');
      const emptyMsg = document.getElementById('shoshin-support-training-empty');
      if (!table) return;

      const assetName = getSupportAssetName();
      const rows = table.querySelectorAll('tbody tr');

      if (!assetName) {
        rows.forEach((r) => (r.style.display = 'none'));
        if (emptyMsg) emptyMsg.style.display = 'none';
        return;
      }

      let visible = 0;
      rows.forEach((row) => {
        const assetsAttr = String(row.dataset.supportAssets || '');
        const allowed = assetsAttr.split(',').map((s) => s.trim()).filter(Boolean);
        const show = !allowed.length || allowed.includes(assetName);
        row.style.display = show ? '' : 'none';
        if (show) visible++;
      });

      if (emptyMsg) emptyMsg.style.display = visible === 0 ? '' : 'none';
    }

    function updateHiddenFields() {
      const assetName = getSupportAssetName();
      const base = SUPPORT_ASSET_STATS[assetName] || null;

      const gs = getFieldEl(FIELD_ID_GAME_SYSTEM);
      if (gs && !String(gs.value || '').trim()) {
        gs.value = 'Shoshin: The Path of Ascension';
        gs.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (!assetName || !base) {
        setHidden(FIELD_ID_ASSET_MELEE_DMG, '');
        setHidden(FIELD_ID_ASSET_MELEE_CRIT, '');
        setHidden(FIELD_ID_ASSET_MELEE_DIST, '');
        setHidden(FIELD_ID_ASSET_RANGED_DMG, '');
        setHidden(FIELD_ID_ASSET_RANGED_CRIT, '');
        setHidden(FIELD_ID_ASSET_RANGED_DIST, '');

        setHidden(FIELD_ID_ASSET_ATK, '');
        setHidden(FIELD_ID_ASSET_DEF, '');
        setHidden(FIELD_ID_ASSET_MOV, '');
        setHidden(FIELD_ID_ASSET_BOD, '');
        setHidden(FIELD_ID_ASSET_LDR, '');
        setHidden(FIELD_ID_ASSET_INI, '');
        setHidden(FIELD_ID_ASSET_TOTAL_COST, '');

        setHidden(FIELD_ID_ASSET_MRBPA, '');
        setHidden(FIELD_ID_ASSET_RULES, '');
        setHidden(FIELD_ID_ASSET_SIZE, '');
        setHidden(FIELD_ID_ASSET_DIMENSION, '');
        setHidden(FIELD_ID_ASSET_RYU, '');
        setHidden(FIELD_ID_ASSET_EQUIP_ITEMS, '');
        return;
      }

      if (assetName === 'Ozutsu') setHidden(FIELD_ID_ASSET_RYU, 'Kayakujutsu');
      else if (assetName === 'Mokuzo Hansen') setHidden(FIELD_ID_ASSET_RYU, 'Suieijutsu');
      else setHidden(FIELD_ID_ASSET_RYU, '');

      let sizeText = '';
      let dimText = '';

      if (assetName === 'Mokuzo Hansen') {
        const hull = getMokuzoHullStatsFromForm();
        if (hull) {
          sizeText = hull.category;
          dimText = hull.width + '" × ' + hull.length + '"';
        } else {
          sizeText = getSingleSelectText(FIELD_ID_VESSEL_SIZE).trim() || '';
          dimText = getVesselDimensionsLabel() || '';
        }
      } else if (assetName === 'Ozutsu') {
        sizeText = 'Medium';
        dimText = SUPPORT_ASSET_META.Ozutsu && SUPPORT_ASSET_META.Ozutsu.dimensionFallback ? SUPPORT_ASSET_META.Ozutsu.dimensionFallback : '1" × 2"';
      } else {
        sizeText = SUPPORT_ASSET_META[assetName] && SUPPORT_ASSET_META[assetName].sizeFallback ? SUPPORT_ASSET_META[assetName].sizeFallback : '';
        dimText = '';
      }

      setHidden(FIELD_ID_ASSET_SIZE, sizeText);
      setHidden(FIELD_ID_ASSET_DIMENSION, dimText);

      setHidden(FIELD_ID_ASSET_MELEE_DMG, base.meleeDamage);
      setHidden(FIELD_ID_ASSET_MELEE_CRIT, base.meleeCrit);
      setHidden(FIELD_ID_ASSET_MELEE_DIST, base.meleeDistance);

      let rangedDmg = base.rangedDamage;
      let rangedCrit = base.rangedCrit;
      let rangedDist = base.rangedDistance;

      if (assetName === 'Ozutsu') {
        const selected = getSelectedMunitions();
        if (selected.length === 1 && MUNITIONS_DATA[selected[0]]) {
          const def = MUNITIONS_DATA[selected[0]];
          rangedDmg = def.damage;
          rangedCrit = def.critical;
          rangedDist = def.distance;
        } else if (selected.length > 1) {
          rangedDmg = 'Variable';
          rangedCrit = 'Variable';
          rangedDist = 'Variable';
        } else {
          rangedDmg = '--';
          rangedCrit = '--';
          rangedDist = '--';
        }
      }

      setHidden(FIELD_ID_ASSET_RANGED_DMG, rangedDmg);
      setHidden(FIELD_ID_ASSET_RANGED_CRIT, rangedCrit);
      setHidden(FIELD_ID_ASSET_RANGED_DIST, formatInches(rangedDist));

      let atk = base.atk;
      let mov = base.mov;
      let bod = base.bod;

      if (assetName === 'Mokuzo Hansen') {
        const hull = getMokuzoHullStatsFromForm();
        if (hull) {
          mov = String(hull.movement);
          bod = String(hull.toughness);
        } else {
          mov = '--';
          bod = '--';
        }
      }

      setHidden(FIELD_ID_ASSET_ATK, atk);
      setHidden(FIELD_ID_ASSET_DEF, base.def);
      setHidden(FIELD_ID_ASSET_MOV, formatInches(mov));
      setHidden(FIELD_ID_ASSET_BOD, bod);
      setHidden(FIELD_ID_ASSET_LDR, base.ldr);
      setHidden(FIELD_ID_ASSET_INI, base.ini);

      const totalCost = computeTotalCost();
      setHidden(FIELD_ID_ASSET_TOTAL_COST, totalCost > 0 ? totalCost : '');

      if (assetName === 'Ozutsu') {
        const selected = getSelectedMunitions();
        setHidden(FIELD_ID_ASSET_EQUIP_ITEMS, selected.length ? selected.join('\n') : '');
      } else {
        setHidden(FIELD_ID_ASSET_EQUIP_ITEMS, '');
      }

      const mods = computeModifiersList();
      setHidden(FIELD_ID_ASSET_MRBPA, mods.filter((m) => m !== 'None').join('\n'));

      const meta = SUPPORT_ASSET_META[assetName] || {};
      setHidden(FIELD_ID_ASSET_RULES, meta.rules || '');
    }

    function recomputeAll() {
      updateSummaryPanel();
      updateStatStrip();
      updateRangedFromMunitions();
      updateCostBox();
      updateTwoColumnBlocks();
      updateFieldVisibility();
      updateSupportRulesTableFilter();
      updateSupportTrainingTableFilter();
      updateHiddenFields();

      if (getSupportAssetName() === 'Ozutsu') {
        ensureMunitionsRowCSSOverride();
        forceMunitionsRowsVisible();
        setTimeout(forceMunitionsRowsVisible, 0);
        setTimeout(forceMunitionsRowsVisible, 50);
        setTimeout(forceMunitionsRowsVisible, 250);
      }
    }

    const typeEl = getFieldEl(FIELD_ID_ASSET_TYPE);
    const sizeEl = getFieldEl(FIELD_ID_VESSEL_SIZE);
    const dimEl = getFieldEl(FIELD_ID_VESSEL_DIM);

    if (typeEl) {
      typeEl.addEventListener('change', recomputeAll);
      typeEl.addEventListener('input', recomputeAll);
    }
    if (sizeEl) {
      sizeEl.addEventListener('change', recomputeAll);
      sizeEl.addEventListener('input', recomputeAll);
    }
    if (dimEl) {
      dimEl.addEventListener('change', recomputeAll);
      dimEl.addEventListener('input', recomputeAll);
    }

    const munWrap = document.querySelector(fieldContainerSel(FIELD_ID_MUNITIONS)) || getFieldEl(FIELD_ID_MUNITIONS);
    if (munWrap) {
      munWrap.addEventListener('change', recomputeAll);
      munWrap.addEventListener('input', recomputeAll);
    }

    void FIELD_ID_DETACHMENT;

    ensureMunitionsRowCSSOverride();
    installMunitionsObserverIfNeeded();
    recomputeAll();

    log('Shoshin SupportForm2501 initialized (detachment ignored)');
  }

  // -------------------------------------------------------------------------
  // BOOTSTRAP
  // -------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    initMyAssetsRenderer();
    initSupportForm2501();
  });
})();
