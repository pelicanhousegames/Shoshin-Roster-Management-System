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
// ===========================================================================

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // GLOBAL NAMESPACE
  // -------------------------------------------------------------------------
  const Shoshin = (window.Shoshin = window.Shoshin || {});
  Shoshin.config = Shoshin.config || {
    debug: false,
    enableMyAssetsRenderer: true,
    enableSupportForm2501: true
  };

  function log() {
    if (!Shoshin.config.debug) return;
    try { console.log.apply(console, arguments); } catch (e) {}
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
      .map(s => s.trim())
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
    (arr || []).forEach(v => {
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

  Data.CLASS_META = {
    Daimyo:   { size: 'Medium', displayName: 'Daimyo',   description: '<em>Clan Lord</em>' },
    Samurai:  { size: 'Medium', displayName: 'Samurai',  description: '<em>Military Noble</em>' },
    Ashigaru: { size: 'Medium', displayName: 'Ashigaru', description: '<em>Peasant Conscript</em>' },
    Sohei:    { size: 'Medium', displayName: 'Sohei',    description: '<em>Buddhist Warrior Monk</em>' },
    Ninja:    { size: 'Medium', displayName: 'Ninja',    description: '<em>Stealth Operative</em>' },
    Onmyoji:  { size: 'Medium', displayName: 'Onmyoji',  description: '<em>Spiritual Diviner</em>' },

    // Support Assets buckets
    Artillery:       { size: 'Medium', displayName: 'Ozutsu',        description: '<em>Lightweight Cannon</em>' },
    'Sailing Ships': { size: 'Medium', displayName: 'Mokuzo Hansen', description: '<em>Wooden Sailing Ship</em>' }
  };

  Data.CLASS_IMAGES = {
    default: FALLBACK_IMAGE,

    Daimyo:   '/wp-content/uploads/2025/12/daimyo2.jpg',
    Samurai:  '/wp-content/uploads/2025/12/samurai3.jpg',
    Ashigaru: '/wp-content/uploads/2025/12/ashigaru2.jpg',
    Sohei:    '/wp-content/uploads/2025/12/sohei3.jpg',
    Ninja:    '/wp-content/uploads/2025/12/ninja2.jpg',
    Onmyoji:  '/wp-content/uploads/2025/12/onmyoji3.jpg',

    Artillery:       '/wp-content/uploads/2025/12/cannon.jpeg',
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
    'Martial Mastery':    { image: FALLBACK_IMAGE, capability: 'Martial Mastery',    attributes: 'May train any one proficiency for free.' },
    'Sword Master':       { image: FALLBACK_IMAGE, capability: 'Sword Master',       attributes: 'Pays one-half points cost to train either Kenjutsu or Iaijutsu.' },
    'General Ineptitude': { image: FALLBACK_IMAGE, capability: 'General Ineptitude', attributes: 'Pays double points cost to train any available proficiency.' },
    'Martial Artist':     { image: FALLBACK_IMAGE, capability: 'Martial Artist',     attributes: 'Proficient in Jujutsu (free).' },
    'Polearms Adept':     { image: FALLBACK_IMAGE, capability: 'Polearms Adept',     attributes: 'Pays one-half points cost to train either Sojutsu or Naginatajutsu.' },
    'Espionage Expert':   { image: FALLBACK_IMAGE, capability: 'Espionage Expert',   attributes: 'Proficient in Ninjutsu (included).' },
    'Mysticism and Ritualism': { image: FALLBACK_IMAGE, capability: 'Mysticism and Ritualism', attributes: 'Proficient in Onmyodo (included).' }
  };

  Data.ABILITIES = {
    'Divine Inspiration': { image: FALLBACK_IMAGE, capability: 'Divine Inspiration', attributes: 'All friendly clan units located within 2" receive +1 to all saving throws.' },
    'Honor Duel':         { image: FALLBACK_IMAGE, capability: 'Honor Duel',         attributes: 'May initiate an honor duel against an enemy samurai or daimyō.' },
    'Iron Fists':         { image: FALLBACK_IMAGE, capability: 'Iron Fists',         attributes: 'Unarmed combat deals damage to armor and stone.' },
    'Missile Deflection': { image: FALLBACK_IMAGE, capability: 'Missile Deflection', attributes: 'Spend an action to negate any non-firearm (arquebus, bombs, artillery) ranged attack once per round. Must be declared before an attack roll is made.' },
    'Ki Resilience':      { image: FALLBACK_IMAGE, capability: 'Ki Resilience',      attributes: 'Permanently add +1 Body.' },
    'Heal':               { image: FALLBACK_IMAGE, capability: 'Heal',               attributes: 'Spend an action to restore 1 Body and/or remove the Poison condition from any engaged unit, including yourself.' },
    'Wall Crawling':      { image: FALLBACK_IMAGE, capability: 'Wall Crawling',      attributes: 'May move upon any vertical surface as long as there is enough movement to end turn on a horizontal surface.' },
    'Light-footed':       { image: FALLBACK_IMAGE, capability: 'Light-footed',       attributes: 'Disengaging from an enemy does not provoke an opportunity attack.' },
    'Assassinate':        { image: FALLBACK_IMAGE, capability: 'Assassinate',        attributes: 'Permanently add +1 Damage and Critical hits bypass High Defense.' },
    'Shadow Strikes':     { image: FALLBACK_IMAGE, capability: 'Shadow Strikes',     attributes: 'Permanently add +2 To-Hit during nighttime.' },
    'Concealment':        { image: FALLBACK_IMAGE, capability: 'Concealment',        attributes: 'Permanently add +1 Defense and gain the ability to spend an action to become concealed (hidden) during daytime. Automatically becomes concealed at the start of nighttime rounds.' },
    'Agile':              { image: FALLBACK_IMAGE, capability: 'Agile',              attributes: 'Permanently add +2 to base movement.' },
    'Aura of Resolve':    { image: FALLBACK_IMAGE, capability: 'Aura of Resolve',    attributes: 'All friendly units (including onmyoji) within 3" gain High Defense.' },
    'Omen of Wrath':      { image: FALLBACK_IMAGE, capability: 'Omen of Wrath',      attributes: 'All friendly units (including onmyoji) within 3" gain +1 Attack.' },
    'Enduring Ward':      { image: FALLBACK_IMAGE, capability: 'Enduring Ward',      attributes: 'All friendly units (including onmyoji) within 3" gain +1 Defense.' },
    'Beyond the Veil':    { image: FALLBACK_IMAGE, capability: 'Beyond the Veil',    attributes: 'Summon any Yokai up to 12" away with unobstructed line of sight.' }
  };

  Data.MELEE_WEAPONS = {
    'Unarmed Combat': { image: '/wp-content/uploads/2025/12/Unarmed1.jpeg', type: 'Fists, Kicks, etc', attributes: 'Does not damage armored units.' },
    'Jutte':         { image: '/wp-content/uploads/2025/12/Club1.jpeg',    type: 'Truncheon or Club', attributes: 'May be combined with Shirube (Pitch/Tar).' },
    'Bo':            { image: '/wp-content/uploads/2025/12/Staff1.jpeg',   type: 'Pole or Staff', attributes: '--' },
    'Tanto':         { image: '/wp-content/uploads/2025/12/Dagger1.jpeg',  type: 'Dagger', attributes: '--' },
    'Kusarigama':    { image: '/wp-content/uploads/2025/12/Sickle1.jpeg',  type: 'Sickle and Chain', attributes: '--' },
    'Kanabo':        { image: '/wp-content/uploads/2025/12/Studded1.jpeg', type: 'Studded War Club', attributes: 'Can damage Stone objects.' },
    'Yari':          { image: '/wp-content/uploads/2025/12/Spear1.jpeg',   type: 'Spear', attributes: 'Receives +1 To-Hit vs Cavalry units.' },
    'Katana':        { image: '/wp-content/uploads/2025/12/katana1.jpeg',  type: 'Sword', attributes: 'May decapitate Restrained units.' },
    'Naginata':      { image: '/wp-content/uploads/2025/12/Naginata1.jpeg',type: 'Bladed Polearm', attributes: 'Receives +1 To-Hit vs Cavalry units.' },
    'Nodachi':       { image: '/wp-content/uploads/2025/12/Nodachi1.jpeg', type: 'Great Sword', attributes: 'May decapitate Restrained units.' }
  };

  Data.RANGED_WEAPONS = {
    'Kunai':         { image: '/wp-content/uploads/2025/12/Shuriken1.jpeg', type: 'Utility Tool', attributes: '<em>(Ninja only)</em>' },
    'Shuriken':      { image: '/wp-content/uploads/2025/12/Shuriken1.jpeg', type: 'Throwing Stars', attributes: '--' },
    'Fukiya':        { image: '/wp-content/uploads/2025/12/dart1.jpeg',     type: 'Blowgun and Darts', attributes: '--' },
    'Hankyu':        { image: '/wp-content/uploads/2025/12/Bow.jpeg',      type: 'Half Bow', attributes: 'May be combined with Shirube.<br><strong>Extended Range:</strong> -1 To-Hit from 9" to 15".' },
    'Daikyu':        { image: '/wp-content/uploads/2025/12/Bow.jpeg',      type: 'Great Bow', attributes: 'Not a cavalry weapon.<br>May be combined with Shirube.<br><strong>Extended Range:</strong> -1 To-Hit from 18" to 30".' },
    'Tanegashima':   { image: '/wp-content/uploads/2025/12/Arquebus1.jpeg',type: 'Arquebus', attributes: 'Not a cavalry weapon.<br>Requires reload after use.<br><strong>Extended Range:</strong> -1 To-Hit from 12" to 18".' },
    'Houroku-Hiya':  { image: '/wp-content/uploads/2025/12/bomb1.jpeg',    type: 'Gunpowder Bombs', attributes: 'Not a cavalry weapon.<br>Single To-Hit roll for all units within 2" of target.<br><strong>Critical Miss:</strong> Roll damage for all units within 2".' }
  };

  Data.ARMOR = {
    'Do-maru':      { image: '/wp-content/uploads/2025/12/Basic1.jpeg',  type: 'Basic Armor',  attributes: 'Permanently gain +1 Defense.' },
    'O-yoroi':      { image: '/wp-content/uploads/2025/12/Great.jpeg',   type: 'Great Armor',  attributes: 'Permanently gain +2 Defense.' },
    'Tosei-gusoku': { image: '/wp-content/uploads/2025/12/Modern.jpeg',  type: 'Modern Armor', attributes: 'Permanently gain +3 Defense.' }
  };

  Data.SUPPORT_ITEMS = {
    'Torinawa':   { image: '/wp-content/uploads/2025/12/Rope.jpeg',       type: 'Capture Rope', attributes: 'Grants abilities to Arrest and Rescue <em>(Hojojutsu required)</em>.' },
    'Shirube':    { image: '/wp-content/uploads/2025/12/Pitch.jpeg',      type: 'Pitch or Tar', attributes: 'May be combined with Jutte, Hankyu or Daikyu weapons.<br>Inflicts the Burn condition upon a successful hit.' },
    'Kanpo':      { image: '/wp-content/uploads/2025/12/Medicine.jpeg',   type: 'Herbal Medicine', attributes: 'Grants Immunity to Poison.' },
    'Shakuhachi': { image: '/wp-content/uploads/2025/12/Flute.jpeg',      type: 'Bamboo Flute', attributes: 'Grants Immunity to Fear.' },
    'Sashimono':  { image: '/wp-content/uploads/2025/12/Sashimono.png',   type: 'Clan Banner', attributes: 'Permanently gain +1 Leadership.' },
    'Emakimono':  { image: '/wp-content/uploads/2025/12/Handscrolls.jpeg',type: 'Illustrated Handscrolls', attributes: 'Permanently gain +1 Initiative.' },
    'Uma':        { image: '/wp-content/uploads/2025/12/Horse.jpeg',      type: 'Horse', attributes:
      '<strong>Mounted Advantage (Movement):</strong> Permanently add +8" to base movement.<br>' +
      '<strong>Mounted Advantage (Toughness):</strong> Permanently add +1 to Body <em>(Bajutsu required)</em>.<br>' +
      '<strong>Mounted Advantage (High Ground):</strong> +1 To-Hit vs non-mounted units <em>(Bajutsu required)</em>.'
    }
  };

  Data.TRAINING = {
    'Jujutsu':        { image: '/wp-content/uploads/2025/12/Unarmed1.jpeg', ryu: 'Jujutsu', discipline: 'Unarmed Combat', equipment: 'Fists, Kicks, etc.' },
    'Juttejutsu':     { image: '/wp-content/uploads/2025/12/Club1.jpeg',    ryu: 'Juttejutsu', discipline: 'Truncheon or Club', equipment: 'Jutte' },
    'Bojutsu':        { image: '/wp-content/uploads/2025/12/Staff1.jpeg',   ryu: 'Bojutsu', discipline: 'Pole or Staff', equipment: 'Bo' },
    'Tantojutsu':     { image: '/wp-content/uploads/2025/12/Dagger1.jpeg',  ryu: 'Tantojutsu', discipline: 'Dagger', equipment: 'Tanto' },
    'Kusarigamajutsu':{ image: '/wp-content/uploads/2025/12/Sickle1.jpeg',  ryu: 'Kusarigamajutsu', discipline: 'Sickle and Chain', equipment: 'Kusarigama' },
    'Mojirijutsu':    { image: '/wp-content/uploads/2025/12/Studded1.jpeg', ryu: 'Mojirijutsu', discipline: 'Studded War Club', equipment: 'Kanabo' },
    'Sojutsu':        { image: '/wp-content/uploads/2025/12/Spear1.jpeg',   ryu: 'Sojutsu', discipline: 'Spear', equipment: 'Yari' },
    'Kenjutsu':       { image: '/wp-content/uploads/2025/12/katana1.jpeg',  ryu: 'Kenjutsu', discipline: 'Sword', equipment: 'Katana' },
    'Naginatajutsu':  { image: '/wp-content/uploads/2025/12/Naginata1.jpeg',ryu: 'Naginatajutsu', discipline: 'Bladed Polearm', equipment: 'Naginata' },
    'Iaijutsu':       { image: '/wp-content/uploads/2025/12/Nodachi1.jpeg', ryu: 'Iaijutsu', discipline: 'Great Sword', equipment: 'Nodachi' },
    'Shurikenjutsu':  { image: '/wp-content/uploads/2025/12/Shuriken1.jpeg',ryu: 'Shurikenjutsu', discipline: 'Throwing Stars', equipment: 'Shuriken' },
    'Fukumibarijutsu':{ image: '/wp-content/uploads/2025/12/dart1.jpeg',    ryu: 'Fukumibarijutsu', discipline: 'Blowgun & Darts', equipment: 'Fukiya' },
    'Kyujutsu':       { image: '/wp-content/uploads/2025/12/Bow.jpeg',      ryu: 'Kyujutsu', discipline: 'Bows', equipment: 'Hankyu, Daikyu' },
    'Kayakujutsu':    { image: '/wp-content/uploads/2025/12/Arquebus1.jpeg',ryu: 'Kayakujutsu', discipline: 'Gunpowder Firearms & Explosives', equipment: 'Tanegashima, Houroku-Hiya, Ozutsu' },
    'Hojojutsu':      { image: '/wp-content/uploads/2025/12/Rope.jpeg',     ryu: 'Hojojutsu', discipline: 'Arresting Rope', equipment: 'Torinawa' },
    'Suieijutsu':     { image: '/wp-content/uploads/2025/12/Water.jpeg',    ryu: 'Suieijutsu', discipline: 'Water Combat', equipment: 'Mokuzo Hansen' },
    'Bajutsu':        { image: '/wp-content/uploads/2025/12/Horse.jpeg',    ryu: 'Bajutsu', discipline: 'Horsemanship', equipment: 'Uma' },
    'Ninjutsu':       { image: '/wp-content/uploads/2025/12/Ninjutsu.jpeg', ryu: 'Ninjutsu', discipline: 'Espionage', equipment: 'Kunai' },
    'Onmyodo':        { image: '/wp-content/uploads/2025/12/Sorcery.jpeg',  ryu: 'Onmyodo', discipline: 'Sorcery', equipment: '—' }
  };

  // Support munitions used by My Assets renderer (from asset_equip_items #39)
  Data.MUNITIONS = {
    'Tetsuho': {
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

      cards.forEach(card => {
        const cardClass = (card.dataset.className || '').trim();
        let show = false;

        if (filterLabel === 'All') {
          show = true;
        } else if (filterLabel === 'Support Assets') {
          show = (cardClass === 'Artillery' || cardClass === 'Sailing Ships');
        } else {
          show = (cardClass === filterLabel);
        }

        card.style.display = show ? '' : 'none';
        if (show) visibleCount++;
      });

      if (msgEl) {
        if (visibleCount === 0) {
          let htmlMsg = '';
          if (filterLabel === 'All') {
            htmlMsg = '<h2><em>You have not created any Character or Support Asset entries.</em></h2>';
          } else if (filterLabel === 'Support Assets') {
            htmlMsg = '<h2><em>No entries exist for these Support Assets.</em></h2>';
          } else {
            htmlMsg = '<h2><em>No entries exist for this Character Class.</em></h2>';
          }
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

      availableFilters.forEach(label => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'shoshin-asset-filter-btn';
        btn.dataset.filter = label;
        btn.textContent = (label === 'All') ? 'All Units' : label;

        if (label === currentFilter) btn.classList.add('is-active');

        btn.addEventListener('click', () => {
          bar.querySelectorAll('.shoshin-asset-filter-btn').forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          applyFilter(label);
        });

        bar.appendChild(btn);
      });

      return bar;
    }

    if (wrapperEl) {
      const bar = buildFilterBar();
      if (bar) wrapperEl.insertBefore(bar, listEl);
    }

    const INEPT_PROFS = new Set([
      'Inept: Melee Combat',
      'Inept: Ranged Combat',
      'Inept: Water Combat',
      'Inept: Horsemanship'
    ]);

    function buildProfAbilitiesRows(block) {
      const names = Core.splitLines(block);
      const rows = [];

      names.forEach(name => {
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

      names.forEach(name => {
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

      names.forEach(name => {
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

      lines.forEach(line => {
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

      names.forEach(name => {
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
      const toggleBtn   = card.querySelector('.shoshin-asset-toggle');
      const detailsPane = card.querySelector('.shoshin-asset-details');
      const iconEl      = card.querySelector('.shoshin-asset-toggle-icon');
      const textEl      = card.querySelector('.shoshin-asset-toggle-text');
      if (!toggleBtn || !detailsPane) return;

      toggleBtn.addEventListener('click', function () {
        const isOpen = !detailsPane.classList.contains('is-open');
        detailsPane.classList.toggle('is-open', isOpen);
        detailsPane.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        if (iconEl) iconEl.textContent = isOpen ? '−' : '+';
        if (textEl) textEl.textContent = isOpen ? 'Collapse build profile' : 'Expand to view complete build profile';
      });
    }

    function renderCommonExpansion(profRows, equipRows, ryuRows, mods) {
      function renderProfTable() {
        if (!profRows.length) return '<p class="shoshin-asset-empty"><em>No proficiencies or abilities.</em></p>';

        const rowsHtml = profRows.map(row => `
          <tr class="${row.isInept ? 'shoshin-red' : ''}">
            <td class="shoshin-cell-image"><img src="${Core.esc(row.image)}" alt="${Core.esc(row.capability)} icon" loading="lazy"></td>
            <td class="shoshin-cell-capability">${Core.esc(row.capability)}</td>
            <td class="shoshin-cell-attributes">${row.attributes}</td>
          </tr>
        `).join('');

        return `
          <table class="shoshin-table shoshin-expansion-table shoshin-profab-table">
            <thead><tr><th>Image</th><th>Capability</th><th>Attributes</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        `;
      }

      function renderEquipTable() {
        if (!equipRows.length) return '<p class="shoshin-asset-empty"><em>No equipment or items.</em></p>';

        const rowsHtml = equipRows.map(row => `
          <tr>
            <td class="shoshin-cell-image"><img src="${Core.esc(row.image)}" alt="${Core.esc(row.equipment)} icon" loading="lazy"></td>
            <td class="shoshin-cell-equipment">${Core.esc(row.equipment)}</td>
            <td class="shoshin-cell-type">${Core.esc(row.type)}</td>
            <td class="shoshin-cell-attributes">${row.attributes}</td>
          </tr>
        `).join('');

        return `
          <table class="shoshin-table shoshin-expansion-table shoshin-equip-table">
            <thead><tr><th>Image</th><th>Equipment</th><th>Type</th><th>Attributes</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        `;
      }

      function renderRyuTable() {
        if (!ryuRows.length) return '<p class="shoshin-asset-empty"><em>Untrained.</em></p>';

        const rowsHtml = ryuRows.map(row => `
          <tr>
            <td class="shoshin-cell-image"><img src="${Core.esc(row.image)}" alt="${Core.esc(row.ryu)} icon" loading="lazy"></td>
            <td>${Core.esc(row.ryu)}</td>
            <td>${Core.esc(row.discipline)}</td>
            <td>${Core.esc(row.equipment)}</td>
          </tr>
        `).join('');

        return `
          <table class="shoshin-table shoshin-expansion-table shoshin-ryu-table">
            <thead><tr><th>Image</th><th>Ryū</th><th>Discipline</th><th>Equipment</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        `;
      }

      function renderModsTable() {
        const cols = { M: mods.M || [], R: mods.R || [], B: mods.B || [], P: mods.P || [], A: mods.A || [] };
        const hasAny = Object.values(cols).some(arr => arr.length > 0);
        if (!hasAny) return '<p class="shoshin-asset-empty"><em>No combat modifiers.</em></p>';

        function listHtml(arr) {
          if (!arr.length) return '<span class="shoshin-modifiers-none">None</span>';
          return '<ul>' + arr.map(t => `<li>${Core.esc(t)}</li>`).join('') + '</ul>';
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
      const meta      = Data.CLASS_META[className] || {};

      const size      = asset.size || meta.size || 'Medium';
      const descHtml  = meta.description || '';
      const imgSrc    = Data.CLASS_IMAGES[className] || Data.CLASS_IMAGES.default;
      const refId     = asset.refId || '';
      const displayName = meta.displayName || className;

      const detailsId = `shoshin-asset-details-${asset.entryId || Math.random().toString(36).slice(2)}`;

      const profRows = buildProfAbilitiesRows(asset.profAbilBlock || '');
      const equipRows = buildEquipRows(asset.equipBlock || '');
      const ryuRows = buildRyuRows(asset.ryuBlock || '');
      const mods = parseModifiers(asset.modsBlock || '');

      const profNames = Core.splitLines(asset.profAbilBlock || '');
      const hasIneptMelee  = profNames.includes('Inept: Melee Combat');
      const hasIneptRanged = profNames.includes('Inept: Ranged Combat');
      const hasIneptHorse  = profNames.includes('Inept: Horsemanship');

      const equipNames = equipRows.map(r => r.equipment);
      const hasUma = equipNames.includes('Uma');

      const { renderProfTable, renderEquipTable, renderRyuTable, renderModsTable } =
        renderCommonExpansion(profRows, equipRows, ryuRows, mods);

      const card = createBaseCard(detailsId);
      card.dataset.className = className;

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
            <button
              type="button"
              class="shoshin-btn shoshin-btn-assign"
              aria-label="Assign to roster"
              data-tooltip="Assign to roster">
              Assign
            </button>

            <button
              type="button"
              class="shoshin-btn shoshin-btn-edit"
              aria-label="Edit asset"
              data-tooltip="Edit asset">
              Edit
            </button>

            <button
              type="button"
              class="shoshin-btn shoshin-btn-delete"
              aria-label="Delete asset"
              data-tooltip="Delete asset">
              Delete
            </button>
          </div>

        </div>

        <div class="shoshin-asset-stat-row">
          <table class="shoshin-stat-strip">
            <tbody>
              <tr>
                <td class="shoshin-ref-td">
                  <div class="shoshin-stat-cell shoshin-stat-ref">
                    <div class="shoshin-stat-value">${refId ? Core.esc(refId) : '—'}</div>
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
              ${renderProfTable()}
            </div>

            <div class="shoshin-asset-block">
              <h3>Equipment &amp; Items</h3>
              ${renderEquipTable()}
            </div>

            <div class="shoshin-asset-block">
              <h3>Ryū Discipline</h3>
              ${renderRyuTable()}
            </div>

            <div class="shoshin-asset-block">
              <h3>Combat Modifiers</h3>
              ${renderModsTable()}
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
      const className   = asset.className || 'Support Assets'; // Artillery / Sailing Ships
      const meta        = Data.CLASS_META[className] || {};
      const supportType = asset.supportType || '';

      let size        = asset.size || meta.size || 'Medium';
      let descHtml    = meta.description || '';
      let imgSrc      = Data.CLASS_IMAGES[className] || Data.CLASS_IMAGES.default;
      let displayName = meta.displayName || className;

      if (supportType) {
        displayName = supportType;
        if (supportType === 'Ozutsu') {
          descHtml = '<em>Lightweight Cannon</em>';
          imgSrc   = Data.CLASS_IMAGES['Artillery'] || imgSrc;
        } else if (supportType === 'Mokuzo Hansen') {
          descHtml = '<em>Wooden Sailing Ship</em>';
          imgSrc   = Data.CLASS_IMAGES['Sailing Ships'] || imgSrc;
        }
      }

      const dimension =
	  (asset.dimension && String(asset.dimension).trim() !== '')
		? asset.dimension
		: (supportType === 'Ozutsu' ? '1" × 2"' : '--');
		
		if (supportType === 'Ozutsu' && (!size || size === '--')) size = 'Medium';


      const refId = asset.refId || '';
      const detailsId = `shoshin-asset-details-${asset.entryId || Math.random().toString(36).slice(2)}`;

      // Training block (prefer field; fallback by type)
      const trainingBlock = getSupportTrainingBlock(asset, supportType);
      const trainingRows = buildRyuRows(trainingBlock);

      // Munitions come ONLY from asset_equip_items (#39) (but accept legacy keys)
      const equipItemsBlock = Core.firstNonEmptyString(
        asset.asset_equip_items,   // canonical
        asset.assetEquipItems,
        asset.equipItemsBlock,
        asset.equip_items,
        asset.equipBlock,          // last-resort legacy
        asset.equipBlockRaw
      );
      const munRows = buildMunitionsRowsFromEquipItems(equipItemsBlock);

      // Mods
      const modsBlock = Core.firstNonEmptyString(
        asset.asset_mrbpa_modifiers, // canonical
        asset.modsBlock,
        asset.assetMrbpaModifiers,
        asset.asset_mrbpa,
        asset.assetMrbpa
      );
      const mods = parseModifiers(modsBlock);

      // IMPORTANT (requested): remove Cost column from BOTH tables below.

      function renderTrainingTable() {
        if (!trainingRows.length) return '<p class="shoshin-asset-empty"><em>None.</em></p>';

        const rowsHtml = trainingRows.map(row => `
          <tr>
            <td class="shoshin-cell-image"><img src="${Core.esc(row.image)}" alt="${Core.esc(row.ryu)} icon" loading="lazy"></td>
            <td>${Core.esc(row.ryu)}</td>
            <td>${Core.esc(row.discipline)}</td>
            <td>${Core.esc(row.equipment)}</td>
          </tr>
        `).join('');

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

        const rowsHtml = rows.map(r => `
          <tr>
            <td class="shoshin-cell-image"><img src="${Core.esc(r.image)}" alt="${Core.esc(r.munition)} icon" loading="lazy"></td>
            <td style="font-weight:600; white-space:nowrap;">${Core.esc(r.munition)}</td>
            <td>${Core.esc(r.type)}</td>
            <td style="text-align:center;">${Core.esc(r.damage)}</td>
            <td style="text-align:center;">${Core.esc(r.critical)}</td>
            <td style="text-align:center;">${Core.esc(r.distance)}</td>
            <td class="shoshin-cell-attributes">${r.attributes}</td>
          </tr>
        `).join('');

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

      const { renderModsTable } = renderCommonExpansion([], [], [], mods);

      const card = createBaseCard(detailsId);
      card.dataset.className = className;

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
            <button
              type="button"
              class="shoshin-btn shoshin-btn-assign"
              aria-label="Assign to roster"
              data-tooltip="Assign to roster">
              Assign
            </button>

            <button
              type="button"
              class="shoshin-btn shoshin-btn-edit"
              aria-label="Edit asset"
              data-tooltip="Edit asset">
              Edit
            </button>

            <button
              type="button"
              class="shoshin-btn shoshin-btn-delete"
              aria-label="Delete asset"
              data-tooltip="Delete asset">
              Delete
            </button>
          </div>

        </div>

        <div class="shoshin-asset-stat-row">
          <table class="shoshin-stat-strip">
            <tbody>
              <tr>
                <td class="shoshin-ref-td">
                  <div class="shoshin-stat-cell shoshin-stat-ref">
                    <div class="shoshin-stat-value">${refId ? Core.esc(refId) : '—'}</div>
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
              ${renderModsTable()}
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
    assets.forEach(asset => {
      const kind = asset.kind || 'character';
      const isSupport = (kind === 'support');

      const card = isSupport ? renderSupportAssetCard(asset) : renderCharacterAssetCard(asset);
      if (card) listEl.appendChild(card);
    });

    applyFilter(currentFilter);
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
    const FIELD_ID_ASSET_TYPE  = 4;
    const FIELD_ID_MUNITIONS   = 8;
    const FIELD_ID_VESSEL_SIZE = 13;
    const FIELD_ID_VESSEL_DIM  = 18;

    // DISPLAY-ONLY (ignored)
    const FIELD_ID_DETACHMENT  = 19;

    // Hidden asset_* fields
    const FIELD_ID_ASSET_MELEE_DMG   = 21;
    const FIELD_ID_ASSET_MELEE_CRIT  = 22;
    const FIELD_ID_ASSET_MELEE_DIST  = 23;
    const FIELD_ID_ASSET_RANGED_DMG  = 24;
    const FIELD_ID_ASSET_RANGED_CRIT = 25;
    const FIELD_ID_ASSET_RANGED_DIST = 26;

    const FIELD_ID_ASSET_ATK         = 27;
    const FIELD_ID_ASSET_DEF         = 28;
    const FIELD_ID_ASSET_MOV         = 29;
    const FIELD_ID_ASSET_BOD         = 30;
    const FIELD_ID_ASSET_LDR         = 31;
    const FIELD_ID_ASSET_INI         = 32;
    const FIELD_ID_ASSET_TOTAL_COST  = 33;

    const FIELD_ID_ASSET_MRBPA       = 34;
    const FIELD_ID_ASSET_RULES       = 35;
    const FIELD_ID_ASSET_SIZE        = 36;
    const FIELD_ID_ASSET_DIMENSION   = 37;

    const FIELD_ID_ASSET_RYU         = 38;
    const FIELD_ID_ASSET_EQUIP_ITEMS = 39;

    const SUPPORT_ASSET_IMAGES = {
      default:         '/wp-content/uploads/2025/12/Helmet-grey.jpg',
      Ozutsu:          '/wp-content/uploads/2025/12/cannon.jpeg',
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
        meleeDamage: '--', meleeCrit: '--', meleeDistance: '--',
        rangedDamage: 'Variable', rangedCrit: 'Variable', rangedDistance: 'Variable',
        atk: 'Variable', def: '4', mov: 'Variable', bod: '3', ldr: '--', ini: 'Highest', cost: 8
      },
      'Mokuzo Hansen': {
        meleeDamage: '--', meleeCrit: '--', meleeDistance: '--',
        rangedDamage: '--', rangedCrit: '--', rangedDistance: '--',
        atk: '--', def: '3', mov: '--', bod: '--', ldr: '--', ini: 'Captain', cost: 0
      }
    };

    const MUNITIONS_DATA = {
      'Tetsuho': {
        cost: 5, damage: '1d6', critical: '1d3', distance: '18"',
        modifiers: ['[R] 18–24": -1 To-Hit', '[R] 1" wide AOE Line', '[P] May damage stone & metal']
      },
      'Bo-Hiya': {
        cost: 5, damage: '1d6', critical: '1d2', distance: '24"',
        modifiers: ['[R] 24–36": -1 To-Hit', '[R] Inflicts Burn on Hit']
      },
      'Tama-ire': {
        cost: 5, damage: '1d3', critical: '1', distance: '12"',
        modifiers: ['[R] 12" 30° AOE cone', '[P] May damage stone & metal']
      }
    };

    const HULL_STATS_BY_DIMENSION = {
      '1x3':  { body:  4, cost:  8 },
      '2x4':  { body:  6, cost: 12 },
      '2x5':  { body:  7, cost: 14 },
      '2x6':  { body:  8, cost: 16 },
      '3x6':  { body: 12, cost: 24 },
      '3x7':  { body: 13, cost: 26 },
      '3x8':  { body: 14, cost: 28 },
      '3x9':  { body: 15, cost: 30 },
      '4x8':  { body: 20, cost: 40 },
      '4x9':  { body: 21, cost: 42 },
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
      el.value = (value == null) ? '' : String(value);
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
      return Array.from(checked).map(cb => String(cb.value || '').trim()).filter(Boolean);
    }
    function getVesselDimensionsLabel() {
      const select = getFieldEl(FIELD_ID_VESSEL_DIM);
      if (!select || !select.options || select.selectedIndex < 0) return '';
      const opt = select.options[select.selectedIndex];
      if (!opt) return '';
      const label = String(opt.text || '').trim();
      const val   = String(opt.value || '').trim();
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
    function normalizeHullKey(label) {
      return String(label).replace(/\s+/g, '').replace(/[×x]/, 'x');
    }
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

      return {
        width, length, category,
        toughness: base.body,
        movement: movementByCategory[category] || 4,
        operators: operatorsByCategory[category] || 1,
        cost: base.cost
      };
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
      style.textContent = `
        #shoshin-munitions-table tbody tr { display: table-row !important; }
      `;
      document.head.appendChild(style);
    }
    function forceMunitionsRowsVisible() {
      const table = document.getElementById('shoshin-munitions-table');
      if (!table) return;
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(r => {
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
      const imgEl  = document.getElementById('shoshin-support-image');
      const descEl = document.getElementById('shoshin-support-description');
      const sizeEl = document.getElementById('shoshin-support-type');

      if (!nameEl && !imgEl && !descEl && !sizeEl) return;

      if (!assetName) {
        if (nameEl) nameEl.textContent = 'Select a Support Asset';
        if (descEl) descEl.textContent = 'Choose the asset to see its stats, cost, and special rules.';
        if (sizeEl) sizeEl.textContent = '--';
        if (imgEl)  imgEl.src = SUPPORT_ASSET_IMAGES.default;
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

      const atkEl   = document.getElementById('shoshin-stat-attack');
      const resEl   = document.getElementById('shoshin-stat-resistance');
      const movEl   = document.getElementById('shoshin-stat-movement');
      const toughEl = document.getElementById('shoshin-stat-toughness');
      const ldrEl   = document.getElementById('shoshin-stat-leadership');
      const iniEl   = document.getElementById('shoshin-stat-initiative');

      if (!atkEl || !resEl || !movEl || !toughEl || !ldrEl || !iniEl) return;

      const base = SUPPORT_ASSET_STATS[assetName] || null;
      if (!base) {
        atkEl.textContent   = '--';
        resEl.textContent   = '--';
        movEl.textContent   = '--';
        toughEl.textContent = '--';
        ldrEl.textContent   = '--';
        iniEl.textContent   = '--';
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

      // Crew Selection field (19) is DISPLAY-ONLY and ignored by design.

      atkEl.textContent   = atk || '--';
      resEl.textContent   = base.def || '--';
      movEl.textContent   = formatInches(mov) || '--';
      toughEl.textContent = bod || '--';
      ldrEl.textContent   = base.ldr || '--';
      iniEl.textContent   = base.ini || '--';
    }

    function updateRangedFromMunitions() {
      const assetName = getSupportAssetName();
      const rdEl = document.getElementById('shoshin-support-ranged-dmg');
      const rcEl = document.getElementById('shoshin-support-ranged-crit');
      const rrEl = document.getElementById('shoshin-support-ranged-dist');
      if (!rdEl || !rcEl || !rrEl) return;

      if (assetName !== 'Ozutsu') {
        rdEl.textContent = '--'; rcEl.textContent = '--'; rrEl.textContent = '--';
        return;
      }

      const selected = getSelectedMunitions();
      if (!selected.length) {
        rdEl.textContent = '--'; rcEl.textContent = '--'; rrEl.textContent = '--';
        return;
      }
      if (selected.length > 1) {
        rdEl.textContent = 'Variable'; rcEl.textContent = 'Variable'; rrEl.textContent = 'Variable';
        return;
      }

      const def = MUNITIONS_DATA[selected[0]];
      if (!def) {
        rdEl.textContent = '--'; rcEl.textContent = '--'; rrEl.textContent = '--';
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
        selected.forEach(name => {
          const def = MUNITIONS_DATA[name];
          if (def && typeof def.cost === 'number') baseCost += def.cost;
        });
        return baseCost;
      }

      if (assetName === 'Mokuzo Hansen') {
        const hull = getMokuzoHullStatsFromForm();
        return (hull && typeof hull.cost === 'number') ? hull.cost : 0;
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

      const safe = (Array.isArray(items) && items.length) ? items : ['None'];
      const mid = Math.ceil(safe.length / 2);
      const left = safe.slice(0, mid);
      const right = safe.slice(mid);

      left.forEach(t => { const li = document.createElement('li'); li.textContent = t; col1.appendChild(li); });
      right.forEach(t => { const li = document.createElement('li'); li.textContent = t; col2.appendChild(li); });
    }

    function computeModifiersList() {
      const assetName = getSupportAssetName();
      if (!assetName) return ['None'];

      let mods = [];

      if (assetName === 'Ozutsu') {
        mods.push('[P] Neutral Asset');
        const selected = getSelectedMunitions();
        selected.forEach(name => {
          const def = MUNITIONS_DATA[name];
          if (def && Array.isArray(def.modifiers)) mods.push(...def.modifiers);
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
      const dimContainer  = document.querySelector(fieldContainerSel(FIELD_ID_VESSEL_DIM));

      const munSection = document.getElementById('shoshin-munitions-section');
      const munTable   = document.getElementById('shoshin-munitions-table');
      const munEmpty   = document.getElementById('shoshin-munitions-empty');
      const munWrap = document.querySelector(fieldContainerSel(FIELD_ID_MUNITIONS)) || getFieldEl(FIELD_ID_MUNITIONS);

      const isOzutsu = assetName === 'Ozutsu';
      const isMokuzo = assetName === 'Mokuzo Hansen';

      if (sizeContainer) sizeContainer.style.display = isMokuzo ? '' : 'none';
      if (dimContainer)  dimContainer.style.display  = isMokuzo ? '' : 'none';

      if (munSection) munSection.style.display = isOzutsu ? '' : 'none';
      if (munTable)   munTable.style.display   = isOzutsu ? '' : 'none';
      if (munWrap)    munWrap.style.display    = isOzutsu ? '' : 'none';

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

      rows.forEach(row => {
        const rowAsset = String(row.dataset.asset || '').trim();
        if (!assetName) row.style.display = '';
        else row.style.display = (rowAsset === assetName) ? '' : 'none';
      });
    }

    function updateSupportTrainingTableFilter() {
      const table = document.getElementById('shoshin-support-training-table');
      const emptyMsg = document.getElementById('shoshin-support-training-empty');
      if (!table) return;

      const assetName = getSupportAssetName();
      const rows = table.querySelectorAll('tbody tr');

      if (!assetName) {
        rows.forEach(r => r.style.display = 'none');
        if (emptyMsg) emptyMsg.style.display = 'none';
        return;
      }

      let visible = 0;
      rows.forEach(row => {
        const assetsAttr = String(row.dataset.supportAssets || '');
        const allowed = assetsAttr.split(',').map(s => s.trim()).filter(Boolean);
        const show = !allowed.length || allowed.includes(assetName);
        row.style.display = show ? '' : 'none';
        if (show) visible++;
      });

      if (emptyMsg) emptyMsg.style.display = (visible === 0) ? '' : 'none';
    }

    function updateHiddenFields() {
      const assetName = getSupportAssetName();
      const base = SUPPORT_ASSET_STATS[assetName] || null;

      // Always keep Game System populated
      const gs = getFieldEl(FIELD_ID_GAME_SYSTEM);
      if (gs && !String(gs.value || '').trim()) {
        gs.value = 'Shoshin: The Path of Ascension';
        gs.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (!assetName || !base) {
        setHidden(FIELD_ID_ASSET_MELEE_DMG,   '');
        setHidden(FIELD_ID_ASSET_MELEE_CRIT,  '');
        setHidden(FIELD_ID_ASSET_MELEE_DIST,  '');
        setHidden(FIELD_ID_ASSET_RANGED_DMG,  '');
        setHidden(FIELD_ID_ASSET_RANGED_CRIT, '');
        setHidden(FIELD_ID_ASSET_RANGED_DIST, '');

        setHidden(FIELD_ID_ASSET_ATK,        '');
        setHidden(FIELD_ID_ASSET_DEF,        '');
        setHidden(FIELD_ID_ASSET_MOV,        '');
        setHidden(FIELD_ID_ASSET_BOD,        '');
        setHidden(FIELD_ID_ASSET_LDR,        '');
        setHidden(FIELD_ID_ASSET_INI,        '');
        setHidden(FIELD_ID_ASSET_TOTAL_COST, '');

        setHidden(FIELD_ID_ASSET_MRBPA,      '');
        setHidden(FIELD_ID_ASSET_RULES,      '');
        setHidden(FIELD_ID_ASSET_SIZE,       '');
        setHidden(FIELD_ID_ASSET_DIMENSION,  '');
        setHidden(FIELD_ID_ASSET_RYU,        '');
        setHidden(FIELD_ID_ASSET_EQUIP_ITEMS,'');
        return;
      }

      // Training requirement block
      if (assetName === 'Ozutsu') setHidden(FIELD_ID_ASSET_RYU, 'Kayakujutsu');
      else if (assetName === 'Mokuzo Hansen') setHidden(FIELD_ID_ASSET_RYU, 'Suieijutsu');
      else setHidden(FIELD_ID_ASSET_RYU, '');

      // size + dimension hidden fields
		let sizeText = '';
		let dimText  = '';

		if (assetName === 'Mokuzo Hansen') {
		  const hull = getMokuzoHullStatsFromForm();
		  if (hull) {
			sizeText = hull.category;
			dimText  = hull.width + '" × ' + hull.length + '"';
		  } else {
			sizeText = getSingleSelectText(FIELD_ID_VESSEL_SIZE).trim() || '';
			dimText  = getVesselDimensionsLabel() || '';
		  }
		} else if (assetName === 'Ozutsu') {
		  // ✅ Always persist Ozutsu display values for My Assets
		  sizeText = 'Medium';
		  dimText  = (SUPPORT_ASSET_META.Ozutsu && SUPPORT_ASSET_META.Ozutsu.dimensionFallback)
			? SUPPORT_ASSET_META.Ozutsu.dimensionFallback
			: '1" × 2"';
		} else {
		  sizeText = (SUPPORT_ASSET_META[assetName] && SUPPORT_ASSET_META[assetName].sizeFallback)
			? SUPPORT_ASSET_META[assetName].sizeFallback
			: '';
		  dimText = '';
		}

		setHidden(FIELD_ID_ASSET_SIZE, sizeText);
		setHidden(FIELD_ID_ASSET_DIMENSION, dimText);


      // Melee always --
      setHidden(FIELD_ID_ASSET_MELEE_DMG,  base.meleeDamage);
      setHidden(FIELD_ID_ASSET_MELEE_CRIT, base.meleeCrit);
      setHidden(FIELD_ID_ASSET_MELEE_DIST, base.meleeDistance);

      // Ranged from munitions if Ozutsu
      let rangedDmg  = base.rangedDamage;
      let rangedCrit = base.rangedCrit;
      let rangedDist = base.rangedDistance;

      if (assetName === 'Ozutsu') {
        const selected = getSelectedMunitions();
        if (selected.length === 1 && MUNITIONS_DATA[selected[0]]) {
          const def = MUNITIONS_DATA[selected[0]];
          rangedDmg  = def.damage;
          rangedCrit = def.critical;
          rangedDist = def.distance;
        } else if (selected.length > 1) {
          rangedDmg  = 'Variable';
          rangedCrit = 'Variable';
          rangedDist = 'Variable';
        } else {
          rangedDmg  = '--';
          rangedCrit = '--';
          rangedDist = '--';
        }
      }

      setHidden(FIELD_ID_ASSET_RANGED_DMG,  rangedDmg);
      setHidden(FIELD_ID_ASSET_RANGED_CRIT, rangedCrit);
      setHidden(FIELD_ID_ASSET_RANGED_DIST, formatInches(rangedDist));

      // Core strip values
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

      // Crew Selection field (19) ignored
      setHidden(FIELD_ID_ASSET_ATK, atk);                // Ozutsu always "Variable"
      setHidden(FIELD_ID_ASSET_DEF, base.def);
      setHidden(FIELD_ID_ASSET_MOV, formatInches(mov));  // Ozutsu always "Variable"
      setHidden(FIELD_ID_ASSET_BOD, bod);
      setHidden(FIELD_ID_ASSET_LDR, base.ldr);
      setHidden(FIELD_ID_ASSET_INI, base.ini);

      // Cost
      const totalCost = computeTotalCost();
      setHidden(FIELD_ID_ASSET_TOTAL_COST, totalCost > 0 ? totalCost : '');

      // Equipment & Items block (munitions) saved to asset_equip_items (#39)
      if (assetName === 'Ozutsu') {
        const selected = getSelectedMunitions();
        setHidden(FIELD_ID_ASSET_EQUIP_ITEMS, selected.length ? selected.join('\n') : '');
      } else {
        setHidden(FIELD_ID_ASSET_EQUIP_ITEMS, '');
      }

      // MRBPA block
      const mods = computeModifiersList();
      setHidden(FIELD_ID_ASSET_MRBPA, mods.filter(m => m !== 'None').join('\n'));

      // Rules
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

    // Bindings
    const typeEl = getFieldEl(FIELD_ID_ASSET_TYPE);
    const sizeEl = getFieldEl(FIELD_ID_VESSEL_SIZE);
    const dimEl  = getFieldEl(FIELD_ID_VESSEL_DIM);

    if (typeEl) { typeEl.addEventListener('change', recomputeAll); typeEl.addEventListener('input', recomputeAll); }
    if (sizeEl) { sizeEl.addEventListener('change', recomputeAll); sizeEl.addEventListener('input', recomputeAll); }
    if (dimEl)  { dimEl.addEventListener('change', recomputeAll); dimEl.addEventListener('input', recomputeAll); }

    const munWrap = document.querySelector(fieldContainerSel(FIELD_ID_MUNITIONS)) || getFieldEl(FIELD_ID_MUNITIONS);
    if (munWrap) { munWrap.addEventListener('change', recomputeAll); munWrap.addEventListener('input', recomputeAll); }

    // Crew Selection (field 19) is display-only: DO NOT bind.

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
