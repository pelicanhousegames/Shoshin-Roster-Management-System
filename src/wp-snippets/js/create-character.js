document.addEventListener('DOMContentLoaded', function() {
  // ====================================================================================================================================
  // CONFIG: FORM & FIELD IDS
  // ====================================================================================================================================
  const FORM_ID = 2247;
  const FIELD_ID_CLASS    = 6;
  const FIELD_ID_ABIL     = 21;
  const FIELD_ID_MELEE    = 25;
  const FIELD_ID_RANGED   = 28;
  const FIELD_ID_ARMOR    = 31;
  const FIELD_ID_SUPPORT  = 38;
  const FIELD_ID_TRAINING = 37;

  // Labels for "always allowed" options
  const NO_ARMOR_LABEL         = 'No Armor';
  const NO_RANGED_WEAPON_LABEL = 'No Ranged Weapon';

  // Locked (auto-selected & cannot be turned off) options per class
  const LOCKED_ABILITIES = {
    'Daimyo':  ['Divine Inspiration'],
    'Samurai': ['Honor Duel']
  };

  const LOCKED_TRAINING = {
    'Ninja':   ['Ninjutsu'],
    'Onmyoji': ['Onmyodo']
  };

  // Inept proficiencies
  const INEPT_PROF_NAMES = [
    'Inept: Melee Combat',
    'Inept: Ranged Combat',
    'Inept: Water Combat',
    'Inept: Horsemanship'
  ];

  // ==================================================================
  // CLASS IMAGES & META
  // ==================================================================
  const CLASS_IMAGES = {
    'default': '/wp-content/uploads/2025/12/Helmet-grey.jpg',
    'Daimyo':  '/wp-content/uploads/2025/12/daimyo2.jpg',
    'Samurai': '/wp-content/uploads/2025/12/samurai3.jpg',
    'Ashigaru':'/wp-content/uploads/2025/12/ashigaru2.jpg',
    'Sohei':   '/wp-content/uploads/2025/12/sohei3.jpg',
    'Ninja':   '/wp-content/uploads/2025/12/ninja2.jpg',
    'Onmyoji': '/wp-content/uploads/2025/12/onmyoji3.jpg'
  };

  const CLASS_META = {
    'Daimyo':  { size: 'Medium', description: '<em>Clan Lord</em>' },
    'Samurai': { size: 'Medium', description: '<em>Military Noble</em>' },
    'Ashigaru':{ size: 'Medium', description: '<em>Peasant Conscript</em>' },
    'Sohei':   { size: 'Medium', description: '<em>Buddhist Warrior Monk</em>' },
    'Ninja':   { size: 'Medium', description: '<em>Stealth Operative</em>' },
    'Onmyoji': { size: 'Medium', description: '<em>Spiritual Diviner</em>' }
  };

  const CLASS_BASE_STATS = {
    'Daimyo':  { attack: 3, defense: 2, movement: 4, body: 4, leadership: 4, initiative: 4, cost: 25 },
    'Samurai': { attack: 2, defense: 2, movement: 4, body: 3, leadership: 4, initiative: 3, cost: 12 },
    'Ashigaru':{ attack: 1, defense: 2, movement: 4, body: 2, leadership: 2, initiative: 2, cost: 3 },
    'Sohei':   { attack: 1, defense: 2, movement: 4, body: 2, leadership: 3, initiative: 3, cost: 9 },
    'Ninja':   { attack: 1, defense: 2, movement: 4, body: 3, leadership: 3, initiative: 3, cost: 11 },
    'Onmyoji': { attack: 1, defense: 2, movement: 4, body: 2, leadership: 4, initiative: 3, cost: 10 }
  };

  // ==================================================================
  // CLASS RULES: WHICH OPTIONS EACH CLASS CAN SEE
  // ==================================================================
  const CLASS_RULES = {
    'Daimyo': {
      abilities: ['Divine Inspiration'],
      ranged: [NO_RANGED_WEAPON_LABEL, 'Shuriken', 'Fukiya', 'Hankyu', 'Daikyu', 'Tanegashima', 'Houroku-Hiya'],
      armor: [NO_ARMOR_LABEL, 'Do-maru', 'O-yoroi', 'Tosei-gusoku'],
      support: ['Shirube', 'Kanpo', 'Shakuhachi', 'Sashimono', 'Emakimono', 'Torinawa', 'Uma'],
      training: [
        'Jujutsu','Juttejutsu','Bojutsu','Tantojutsu','Kusarigamajutsu','Mojirijutsu','Sojutsu','Kenjutsu',
        'Naginatajutsu','Iaijutsu','Shurikenjutsu','Fukumibarijutsu','Kyujutsu','Kayakujutsu','Hojojutsu',
        'Suieijutsu','Bajutsu'
      ]
    },
    'Samurai': {
      abilities: ['Honor Duel'],
      ranged: [NO_RANGED_WEAPON_LABEL, 'Shuriken', 'Fukiya', 'Hankyu', 'Daikyu', 'Tanegashima', 'Houroku-Hiya'],
      armor: [NO_ARMOR_LABEL, 'Do-maru', 'O-yoroi', 'Tosei-gusoku'],
      support: ['Shirube', 'Kanpo', 'Shakuhachi', 'Sashimono', 'Emakimono', 'Torinawa', 'Uma'],
      training: [
        'Jujutsu','Juttejutsu','Bojutsu','Tantojutsu','Kusarigamajutsu','Mojirijutsu','Sojutsu','Kenjutsu',
        'Naginatajutsu','Iaijutsu','Shurikenjutsu','Fukumibarijutsu','Kyujutsu','Kayakujutsu','Hojojutsu',
        'Suieijutsu','Bajutsu'
      ]
    },
    'Ashigaru': {
      abilities: [],
      ranged: [NO_RANGED_WEAPON_LABEL, 'Shuriken', 'Fukiya', 'Hankyu', 'Daikyu', 'Tanegashima', 'Houroku-Hiya'],
      armor: [NO_ARMOR_LABEL, 'Do-maru'],
      support: ['Shirube', 'Kanpo', 'Shakuhachi', 'Sashimono', 'Emakimono'],
      training: [
        'Jujutsu','Juttejutsu','Bojutsu','Mojirijutsu','Sojutsu','Naginatajutsu','Shurikenjutsu',
        'Fukumibarijutsu','Kyujutsu','Kayakujutsu','Suieijutsu'
      ]
    },
    'Sohei': {
      abilities: ['Iron Fists', 'Missile Deflection', 'Ki Resilience', 'Heal'],
      ranged: [NO_RANGED_WEAPON_LABEL, 'Shuriken', 'Fukiya', 'Hankyu', 'Daikyu', 'Tanegashima', 'Houroku-Hiya'],
      armor: [NO_ARMOR_LABEL, 'Do-maru', 'O-yoroi'],
      support: ['Shirube', 'Kanpo', 'Shakuhachi', 'Sashimono', 'Emakimono', 'Torinawa', 'Uma'],
      training: [
        'Jujutsu','Juttejutsu','Bojutsu','Tantojutsu','Kusarigamajutsu','Mojirijutsu','Sojutsu','Naginatajutsu',
        'Shurikenjutsu','Fukumibarijutsu','Kyujutsu','Hojojutsu','Suieijutsu','Bajutsu'
      ]
    },
    'Ninja': {
      abilities: ['Wall Crawling','Light-footed','Assassinate','Shadow Strikes','Concealment','Agile'],
      ranged: [NO_RANGED_WEAPON_LABEL,'Shuriken','Fukiya','Hankyu','Daikyu','Tanegashima','Kunai','Houroku-Hiya'],
      armor: [NO_ARMOR_LABEL, 'Do-maru'],
      support: ['Shirube','Kanpo','Shakuhachi','Emakimono','Torinawa'],
      training: [
        'Jujutsu','Juttejutsu','Bojutsu','Tantojutsu','Kusarigamajutsu','Kenjutsu','Shurikenjutsu','Fukumibarijutsu',
        'Kyujutsu','Kayakujutsu','Hojojutsu','Suieijutsu','Ninjutsu'
      ]
    },
    'Onmyoji': {
      abilities: ['Aura of Resolve','Omen of Wrath','Enduring Ward','Beyond the Veil'],
      ranged: [NO_RANGED_WEAPON_LABEL,'Shuriken','Fukiya','Hankyu','Daikyu','Tanegashima','Houroku-Hiya'],
      armor: [NO_ARMOR_LABEL],
      support: ['Shirube','Kanpo','Shakuhachi','Emakimono'],
      training: ['Jujutsu','Juttejutsu','Bojutsu','Suieijutsu','Shurikenjutsu','Fukumibarijutsu','Onmyodo']
    }
  };

  // ==================================================================
  // CLASS COST RULES
  // ==================================================================
  const CLASS_COST_RULES = {
    'Daimyo': { armorMultiplier: 0.5 },
    'Ashigaru': { trainingMultiplier: 2 },
    'Sohei': { freeTraining: ['Jujutsu'], halfTraining: ['Sojutsu','Naginatajutsu'] }
  };

  // ==================================================================
  // WEAPON → TRAINING MAP
  // ==================================================================
  const WEAPON_TRAINING_MAP = {
    'Unarmed Combat': 'Jujutsu',
    'Jutte':          'Juttejutsu',
    'Bo':             'Bojutsu',
    'Tanto':          'Tantojutsu',
    'Kusarigama':     'Kusarigamajutsu',
    'Kanabo':         'Mojirijutsu',
    'Yari':           'Sojutsu',
    'Katana':         'Kenjutsu',
    'Naginata':       'Naginatajutsu',
    'Nodachi':        'Iaijutsu',

    'Shuriken':       'Shurikenjutsu',
    'Fukiya':         'Fukumibarijutsu',
    'Hankyu':         'Kyujutsu',
    'Daikyu':         'Kyujutsu',
    'Tanegashima':    'Kayakujutsu',
    'Houroku-Hiya':   'Kayakujutsu',

    'Torinawa':       'Hojojutsu',
    'Uma':            'Bajutsu',
    'Kunai':          'Ninjutsu'
  };

  // ==================================================================
  // TRAINING: gear dependencies
  // ==================================================================
  const TRAINING_DEPENDENCIES = {
    'Jujutsu':         { melee: ['Unarmed Combat'], ranged: [], support: [] },
    'Juttejutsu':      { melee: ['Jutte'], ranged: [], support: [] },
    'Bojutsu':         { melee: ['Bo'], ranged: [], support: [] },
    'Tantojutsu':      { melee: ['Tanto'], ranged: [], support: [] },
    'Kusarigamajutsu': { melee: ['Kusarigama'], ranged: [], support: [] },
    'Mojirijutsu':     { melee: ['Kanabo'], ranged: [], support: [] },
    'Sojutsu':         { melee: ['Yari'], ranged: [], support: [] },
    'Kenjutsu':        { melee: ['Katana'], ranged: [], support: [] },
    'Naginatajutsu':   { melee: ['Naginata'], ranged: [], support: [] },
    'Iaijutsu':        { melee: ['Nodachi'], ranged: [], support: [] },

    'Shurikenjutsu':   { melee: [], ranged: ['Shuriken'], support: [] },
    'Fukumibarijutsu': { melee: [], ranged: ['Fukiya'], support: [] },
    'Kyujutsu':        { melee: [], ranged: ['Hankyu','Daikyu'], support: [] },
    'Kayakujutsu':     { melee: [], ranged: ['Tanegashima','Houroku-Hiya'], support: [] },

    'Hojojutsu':       { melee: [], ranged: [], support: ['Torinawa'] },
    'Bajutsu':         { melee: [], ranged: [], support: ['Uma'] }
  };

  const TRAINING_ALWAYS_AVAILABLE = ['Suieijutsu','Ninjutsu','Onmyodo'];

  // ==================================================================
  // DERIVED PROFS
  // ==================================================================
  const DERIVED_PROFS = [
    { name: 'Inflict: Burn', when: s => s.support.includes('Shirube') },
    { name: 'Immunity: Poison', when: s => s.support.includes('Kanpo') },
    { name: 'Immunity: Fear', when: s => s.support.includes('Shakuhachi') },
    { name: 'Arrest & Rescue', when: s => s.support.includes('Torinawa') && s.training.includes('Hojojutsu') },
    { name: 'Mounted Advantage', when: s => s.support.includes('Uma') && s.training.includes('Bajutsu') },

    { name: 'Decapitate', when: s =>
      (s.melee === 'Katana'  && s.training.includes('Kenjutsu')) ||
      (s.melee === 'Nodachi' && s.training.includes('Iaijutsu'))
    },
    { name: 'Cavalry Piercer', when: s =>
      (s.melee === 'Yari'     && s.training.includes('Sojutsu')) ||
      (s.melee === 'Naginata' && s.training.includes('Naginatajutsu'))
    },
    { name: 'Stonecrusher', when: s =>
      (s.melee === 'Kanabo' && s.training.includes('Mojirijutsu')) ||
      (s.melee === 'Unarmed Combat' && s.abilities.includes('Iron Fists'))
    },
    { name: 'Extended Range', when: s =>
      (s.ranged === 'Hankyu'      && s.training.includes('Kyujutsu')) ||
      (s.ranged === 'Daikyu'      && s.training.includes('Kyujutsu')) ||
      (s.ranged === 'Tanegashima' && s.training.includes('Kayakujutsu'))
    },
    { name: 'Captain & Crew', when: s => s.training.includes('Suieijutsu') }
  ];

  // ======================================================================
  // PHASE 4: CHARACTER HIDDEN FIELD CONFIG
  // ======================================================================
  const CHARACTER_FORM_ID = 2247;
  const HIDDEN_CHAR_FIELDS = {
    gameSystem:   53,
    meleeDamage:  54,
    meleeCrit:    55,
    meleeDistance:56,
    rangedDamage: 57,
    rangedCrit:   58,
    rangedDistance:59,
    atk:          60,
    def:          61,
    mov:          62,
    bod:          63,
    ldr:          64,
    ini:          65,
    totalCost:    66,
    mrbpa:        67,
    profAbil:     68,
    equipItems:   69,
    ryu:          70,
    size:         71
  };

  function setCharacterHidden(fieldKey, value) {
    const fieldId = HIDDEN_CHAR_FIELDS[fieldKey];
    if (!fieldId) return;
    const selector = `#wpforms-${CHARACTER_FORM_ID}-field_${fieldId}`;
    const input = document.querySelector(selector);
    if (input) input.value = (value != null) ? String(value) : '';
  }

  // ==================================================================
  // GLOBALS
  // ==================================================================
  let DAIMYO_FREE_TRAINING = null;

  // ==================================================================
  // WEAPON STATS CACHES
  // ==================================================================
  const MELEE_STATS  = {};
  const RANGED_STATS = {};
  const ARMOR_COSTS    = {};
  const SUPPORT_COSTS  = {};
  const ABILITY_COSTS  = {};
  const TRAINING_COSTS = {};

  // ====================================================================================================================================
  // GENERIC HELPERS
  // ====================================================================================================================================
  function fieldSelector(fieldId) { return '#wpforms-' + FORM_ID + '-field_' + fieldId; }

  function canonicalLabel(text) {
    if (!text) return '';
    return text.replace(/\s*\(.*?\)\s*$/, '').trim();
  }

  function getClassValue() {
    const el = document.querySelector(fieldSelector(FIELD_ID_CLASS));
    return el ? el.value : '';
  }

  function getSingleSelectText(fieldId) {
  const select = document.querySelector(fieldSelector(fieldId));
  if (!select) return '';

  // If nothing selected OR selected option has an empty value, treat as "no selection"
  if (select.selectedIndex < 0) return '';
  if (!select.value) return '';

  const opt = select.options[select.selectedIndex];
  return opt ? opt.text.trim() : '';
}


  function setSelectByText(fieldId, labelText) {
    const select = document.querySelector(fieldSelector(fieldId));
    if (!select) return;
    const target = labelText.trim().toLowerCase();
    let found = false;
    Array.from(select.options).forEach(opt => {
      if (opt.text.trim().toLowerCase() === target) {
        select.value = opt.value;
        found = true;
      }
    });
    if (!found) select.value = '';
  }

  function getCheckedFromCheckboxField(fieldId) {
    const container =
      document.querySelector('#wpforms-' + FORM_ID + '-field_' + fieldId + '-container') ||
      document.querySelector(fieldSelector(fieldId));
    if (!container) return [];
    const chosen = [];
    container.querySelectorAll('li').forEach(li => {
      const input = li.querySelector('input[type="checkbox"], input[type="radio"]');
      const labelEl = li.querySelector('label');
      if (!input || !labelEl) return;
      if (input.checked) chosen.push(canonicalLabel(labelEl.innerText.trim()));
    });
    return chosen;
  }

  function getCheckedSupportItems() { return getCheckedFromCheckboxField(FIELD_ID_SUPPORT); }
  function getCheckedAbilities()    { return getCheckedFromCheckboxField(FIELD_ID_ABIL); }
  function getCheckedTraining()     { return getCheckedFromCheckboxField(FIELD_ID_TRAINING); }

  function applyCostMultiplier(base, factor) { return Math.max(0, Math.ceil(base * factor)); }

  function formatDistance(val) {
    if (val === '(e)' || val === '(E)') return '(e)';
    if (val == null || val === '') return '';
    if (typeof val === 'string' && val.trim().endsWith('"')) return val;
    const num = Number(val);
    if (!isNaN(num)) return `${num}"`;
    return val;
  }

  function halfDistanceValue(value) {
    if (!value) return value;
    const m = String(value).match(/^(\d+)(.*)$/);
    if (!m) return value;
    const num = parseInt(m[1], 10);
    if (!num) return value;
    let half = Math.floor(num / 2);
    if (half < 1) half = 1;
    return String(half) + (m[2] || '');
  }

  // ==================================================================
  // MISMATCH TAG SYSTEM (NO STACKING)
  // ==================================================================
  const MISMATCH_PRIORITY = ['ability mismatch', 'weapon mismatch', 'item mismatch'];

	  function formatMismatchTag(reasons) {
	  if (!reasons || !reasons.length) return '';

	  // unique + prioritized ordering
	  const uniq = Array.from(new Set(reasons)).sort((a, b) => {
		const ia = MISMATCH_PRIORITY.indexOf(a);
		const ib = MISMATCH_PRIORITY.indexOf(b);
		return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
	  });

	  // single mismatch
	  if (uniq.length === 1) return `(${uniq[0]})`;

	  // multiple mismatches -> show primary + count of additional
	  return `(${uniq[0]} +${uniq.length - 1})`;
	}


  function getOptionBaseLabel(opt) {
    if (!opt) return '';
    if (!opt.dataset.shoshinBaseLabel) {
      opt.dataset.shoshinBaseLabel = (opt.text || '')
        .replace(/\s*\((ability|weapon|item)\s+mismatch[^)]*\)\s*$/i, '')
        .replace(/\s*\(\+\d+\s+mismatches\)\s*$/i, '')
        .replace(/\s*\(half price\)\s*$/i, '')
        .trim();
    }
    return opt.dataset.shoshinBaseLabel;
  }

  function resetOptionVisual(opt) {
    opt.hidden = false;
    opt.disabled = false;
    opt.style.fontStyle = '';
    opt.style.color = '';
  }

  function resetLabel(labelEl) {
    labelEl.style.opacity = '';
    labelEl.style.color = '';
    labelEl.style.fontStyle = '';
  }

  function greyOutLabel(labelEl) {
    labelEl.style.opacity = '0.5';
    labelEl.style.color = '#999';
    labelEl.style.fontStyle = 'italic';
  }

  function setInlineTag(labelEl, className, reasons) {
    const old = labelEl.querySelector(`.${className}`);
    if (old) old.remove();
    const tag = formatMismatchTag(reasons);
    if (!tag) return;
    const span = document.createElement('span');
    span.className = className;
    span.style.fontSize = '0.8em';
    span.style.marginLeft = '4px';
    span.style.fontStyle = 'italic';
    span.textContent = tag;
    labelEl.appendChild(span);
  }

  // ==================================================================
  // STATE
  // ==================================================================
  function readCurrentState() {
    const cls = getClassValue();

    let melee  = canonicalLabel(getSingleSelectText(FIELD_ID_MELEE));
    let ranged = canonicalLabel(getSingleSelectText(FIELD_ID_RANGED));
    let armor  = canonicalLabel(getSingleSelectText(FIELD_ID_ARMOR));

    if (ranged === canonicalLabel(NO_RANGED_WEAPON_LABEL)) ranged = '';
    if (armor === canonicalLabel(NO_ARMOR_LABEL)) armor = '';

    return {
      cls,
      melee,
      ranged,
      armor,
      support:   getCheckedSupportItems(),
      abilities: getCheckedAbilities(),
      training:  getCheckedTraining()
    };
  }

  // ==================================================================
  // INEPT RULES
  // ==================================================================
  const INEPT_RULES = {
    'Inept: Melee Combat': state => {
      if (!state.melee) return true;
      const needed = WEAPON_TRAINING_MAP[state.melee];
      if (!needed) return true;
      return !state.training.includes(needed);
    },
    'Inept: Ranged Combat': state => {
      if (!state.ranged) return true;
      if (state.cls === 'Ninja' && state.ranged === 'Kunai') {
        return !state.training.includes('Ninjutsu');
      }
      const needed = WEAPON_TRAINING_MAP[state.ranged];
      if (!needed) return true;
      return !state.training.includes(needed);
    },
    'Inept: Water Combat': state => !state.training.includes('Suieijutsu'),
    'Inept: Horsemanship': state => {
      const hasUma = state.support.includes('Uma');
      const hasBaj = state.training.includes('Bajutsu');
      return !(hasUma && hasBaj);
    }
  };

  function computeActiveInepts(state) {
    return INEPT_PROF_NAMES.filter(n => (INEPT_RULES[n] ? INEPT_RULES[n](state) : true));
  }

  // ==================================================================
  // TABLE CACHES
  // ==================================================================
  function buildWeaponStatsCache() {
    const meleeTable = document.getElementById('shoshin-melee-table');
    if (meleeTable) {
      meleeTable.querySelectorAll('tbody tr').forEach(row => {
        const raw = (row.dataset.weapon || '').trim();
        if (!raw) return;
        const name = canonicalLabel(raw);
        MELEE_STATS[name] = {
          damage:   row.dataset.damage   || '--',
          critical: row.dataset.critical || '--',
          distance: row.dataset.distance || '--',
          cost:     parseInt(row.dataset.cost, 10) || 0
        };
      });
    }

    const rangedTable = document.getElementById('shoshin-ranged-table');
    if (rangedTable) {
      rangedTable.querySelectorAll('tbody tr').forEach(row => {
        const raw = (row.dataset.weapon || '').trim();
        if (!raw) return;
        const name = canonicalLabel(raw);
        RANGED_STATS[name] = {
          damage:   row.dataset.damage   || '--',
          critical: row.dataset.critical || '--',
          distance: row.dataset.distance || '--',
          cost:     parseInt(row.dataset.cost, 10) || 0
        };
      });
    }
  }

  function buildCostCaches() {
    const abilTable = document.getElementById('shoshin-abilities-table');
    if (abilTable) {
      abilTable.querySelectorAll('tbody tr').forEach(row => {
        const raw = (row.dataset.ability || '').trim();
        if (!raw) return;
        ABILITY_COSTS[canonicalLabel(raw)] = parseInt(row.dataset.cost, 10) || 0;
      });
    }

    const trainingTable = document.getElementById('shoshin-training-table');
    if (trainingTable) {
      trainingTable.querySelectorAll('tbody tr').forEach(row => {
        const raw = (row.dataset.training || '').trim();
        if (!raw) return;
        TRAINING_COSTS[canonicalLabel(raw)] = parseInt(row.dataset.cost, 10) || 0;
      });
    }

    const armorTable = document.getElementById('shoshin-armor-table');
    if (armorTable) {
      armorTable.querySelectorAll('tbody tr').forEach(row => {
        const nameCell = row.querySelector('td:nth-child(2)');
        const raw = nameCell ? nameCell.textContent.trim() : '';
        if (!raw) return;
        ARMOR_COSTS[canonicalLabel(raw)] = parseInt(row.dataset.cost, 10) || 0;
      });
    }

    const supportTable = document.getElementById('shoshin-support-table');
    if (supportTable) {
      supportTable.querySelectorAll('tbody tr').forEach(row => {
        const nameCell = row.querySelector('td:nth-child(2)');
        const raw = nameCell ? nameCell.textContent.trim() : '';
        if (!raw) return;
        SUPPORT_COSTS[canonicalLabel(raw)] = parseInt(row.dataset.cost, 10) || 0;
      });
    }
  }

  // ==================================================================
  // UI MODEL BUILDER
  // ==================================================================
  function buildUiModel(state) {
    const cls = state.cls || '';
    const rules = cls ? (CLASS_RULES[cls] || null) : null;

    const model = {
      cls,
      dropdowns: {
        melee:  {}, // optName -> { hidden, disabled, reasons[] }
        ranged: {},
        armor:  {}
      },
      lists: {
        abilities: {}, // name -> { visible, disabled, reasons[] }
        support:   {},
        training:  {}
      },
      locks: {
        abilities: new Set((LOCKED_ABILITIES[cls] || []).map(canonicalLabel)),
        training:  new Set((LOCKED_TRAINING[cls]  || []).map(canonicalLabel))
      },
      costTags: { training: {}, armorHalf: false, daimyo: false, samurai: false, ashigaru: false, sohei: false }
    };

    const melee  = state.melee || '';
	const ranged = state.ranged || '';
	const armor  = state.armor || '';

	// ✅ Sohei: If Unarmed Combat is selected, Jujutsu is Included/Locked
	if (cls === 'Sohei' && canonicalLabel(melee) === 'Unarmed Combat') {
	  model.locks.training.add('Jujutsu');
	}


    const abilities = state.abilities || [];
    const support   = state.support || [];
    const training  = state.training || [];

    const hasAssassinate = abilities.includes('Assassinate'); // Ninja only
    const hasIronFists   = abilities.includes('Iron Fists');  // Sohei only
    const hasConcealment = abilities.includes('Concealment');

    const hasUma      = support.includes('Uma');
    const hasTorinawa = support.includes('Torinawa');
    const hasShirube  = support.includes('Shirube');

    // ---- Allowed lists by class ----
    const allowedAbilities = rules ? (rules.abilities || []).map(canonicalLabel) : [];
    const allowedSupport   = rules ? (rules.support   || []).map(canonicalLabel) : [];
    const allowedTraining  = rules ? (rules.training  || []).map(canonicalLabel) : [];
    const allowedRanged    = rules ? (rules.ranged    || []).map(canonicalLabel) : [];
    const allowedArmor     = rules ? (rules.armor     || []).map(canonicalLabel) : [];

    // ---- Lists default visibility: only if class selected ----
    // Abilities
    allowedAbilities.forEach(name => {
      model.lists.abilities[name] = { visible: true, disabled: false, reasons: [] };
    });

    // Support (class visible baseline, but Shirube is weapon-dependent)
    allowedSupport.forEach(name => {
      model.lists.support[name] = { visible: true, disabled: false, reasons: [] };
    });

    // Training: visible ONLY if class-allowed (your #6)
    allowedTraining.forEach(name => {
      model.lists.training[name] = { visible: true, disabled: false, reasons: [] };
    });
	
	// ALSO show "relevant but class-forbidden" trainings as disabled (weapon mismatch)
	// Example: Sohei + Nodachi => Iaijutsu should appear disabled with (weapon mismatch)
	(function addRelevantForbiddenTrainings() {
	  const relevant = new Set();

	  // From currently selected melee / ranged
	  if (melee && WEAPON_TRAINING_MAP[melee]) relevant.add(WEAPON_TRAINING_MAP[melee]);
	  if (ranged && WEAPON_TRAINING_MAP[ranged]) relevant.add(WEAPON_TRAINING_MAP[ranged]);

	  // From currently selected support items (e.g., Uma->Bajutsu, Torinawa->Hojojutsu)
	  (support || []).forEach(item => {
		const t = WEAPON_TRAINING_MAP[item];
		if (t) relevant.add(t);
	  });

	  relevant.forEach(t => {
		t = canonicalLabel(t);
		if (!t) return;

		// If the class cannot learn it, show it as a disabled mismatch (for rule comprehension)
		if (cls && !allowedTraining.includes(t)) {
		  if (!model.lists.training[t]) {
			model.lists.training[t] = { visible: true, disabled: true, reasons: ['weapon mismatch'] };
		  } else {
			model.lists.training[t].visible = true;
			model.lists.training[t].disabled = true;
			model.lists.training[t].reasons.push('weapon mismatch');
		  }
		}
	  });
	})();


    // ---- Dropdowns baseline: ranged/armor filtered by class rules ----
    // Melee is not class-restricted in your current schema, so we don't hide anything by class.
    Object.keys(MELEE_STATS).forEach(w => {
      model.dropdowns.melee[w] = { hidden: false, disabled: false, reasons: [] };
    });

    // Ranged filtered by class list (and Kunai special)
    Object.keys(RANGED_STATS).forEach(w => {
      const inClass = !cls ? true : allowedRanged.includes(w);
      model.dropdowns.ranged[w] = {
        hidden: cls ? !inClass : false,
        disabled: false,
        reasons: []
      };
    });

    // Armor filtered by class list
    Object.keys(ARMOR_COSTS).forEach(a => {
      const inClass = !cls ? false : allowedArmor.includes(a);
      model.dropdowns.armor[a] = {
        hidden: cls ? !inClass : true,
        disabled: false,
        reasons: []
      };
    });

    // Ensure "No Armor" / "No Ranged Weapon" behave
    // (they may not exist in caches; render uses select options)
    model.costTags.armorHalf = (cls === 'Daimyo');

    // ==================================================================
    // HARD RULES + PRIOR SELECTION WINS (#8)
    // ==================================================================

    // 1) Kunai is Ninja-only (disable for non-ninja, but do not auto-change selection)
    if (cls && cls !== 'Ninja') {
      if (model.dropdowns.ranged['Kunai']) {
        model.dropdowns.ranged['Kunai'].disabled = true;
        model.dropdowns.ranged['Kunai'].reasons.push('weapon mismatch');
      }
    }

    // 2) Uma weapon mismatch: Uma cannot be selected if ranged is Tanegashima/Daikyu/Houroku
    const umaRangedMismatch = (ranged === 'Tanegashima' || ranged === 'Daikyu' || ranged === 'Houroku-Hiya');

    if (hasUma) {
      ['Tanegashima','Daikyu','Houroku-Hiya'].forEach(w => {
        if (model.dropdowns.ranged[w]) {
          model.dropdowns.ranged[w].disabled = true;
          model.dropdowns.ranged[w].reasons.push('weapon mismatch');
        }
      });
    } else if (umaRangedMismatch) {
  if (allowedSupport.includes('Uma') && model.lists.support['Uma']) {

        model.lists.support['Uma'].disabled = true;
        model.lists.support['Uma'].reasons.push('weapon mismatch');
      }
    }

    // 3) Torinawa ↔ Uma mutual exclusion (period)
		// IMPORTANT: only apply if Uma exists for this class (don’t create Uma for Ninja)
		const classHasUma = allowedSupport.includes('Uma');

		if (classHasUma) {
		  if (hasUma && !hasTorinawa) {
			if (model.lists.support['Torinawa']) {
			  model.lists.support['Torinawa'].disabled = true;
			  model.lists.support['Torinawa'].reasons.push('item mismatch');
			}
		  }

		  if (hasTorinawa && !hasUma) {
			if (model.lists.support['Uma']) {
			  model.lists.support['Uma'].disabled = true;
			  model.lists.support['Uma'].reasons.push('item mismatch');
			}
		  }
		}


    // 4) Shirube is weapon-dependent (Jutte / Hankyu / Daikyu), not class-dependent
    const shirubeWeaponOK = (melee === 'Jutte') || (ranged === 'Hankyu') || (ranged === 'Daikyu');

    // If Shirube not in the DOM for this class, forcing it visible won't matter; renderer safely no-ops.
    if (!model.lists.support['Shirube']) {
      // keep an entry so we can control it if the option exists in the form
      model.lists.support['Shirube'] = { visible: true, disabled: false, reasons: [] };
    }

    if (shirubeWeaponOK) {
      model.lists.support['Shirube'].visible = true;
      // enabled unless blocked by Concealment
    } else {
      // Hide if not OK, unless Concealment is selected (show mismatch for comprehension)
      if (hasConcealment) {
        model.lists.support['Shirube'].visible = true;
        model.lists.support['Shirube'].disabled = true;
        model.lists.support['Shirube'].reasons.push('ability mismatch');
      } else {
        model.lists.support['Shirube'].visible = false;
      }
    }

    // 5) Shirube ↔ Concealment mutual exclusion (prior selection wins)
    // If Shirube already selected, disable Concealment. If Concealment selected, disable Shirube.
    if (hasShirube) {
      if (model.lists.abilities['Concealment']) {
        model.lists.abilities['Concealment'].disabled = true;
        model.lists.abilities['Concealment'].reasons.push('item mismatch');
      }
    }
    if (hasConcealment) {
      model.lists.support['Shirube'].visible = true; // always show mismatch
      model.lists.support['Shirube'].disabled = true;
      model.lists.support['Shirube'].reasons.push('ability mismatch');
    }

    // 6) Iron Fists (Sohei ability) + prior selection wins
    // If Iron Fists selected => disable all melee except Unarmed Combat.
    // If melee != Unarmed, disable Iron Fists ability checkbox (cannot be selected).
    if (model.lists.abilities['Iron Fists']) {
      if (melee && melee !== 'Unarmed Combat') {
        if (!hasIronFists) {
          model.lists.abilities['Iron Fists'].disabled = true;
          model.lists.abilities['Iron Fists'].reasons.push('weapon mismatch');
        }
      }
    }
    if (hasIronFists) {
      Object.keys(model.dropdowns.melee).forEach(w => {
        if (w !== 'Unarmed Combat') {
          model.dropdowns.melee[w].disabled = true;
          model.dropdowns.melee[w].reasons.push('ability mismatch');
        }
      });
    }

    // 7) Assassinate (Ninja ability) + prior selection wins + must disable illegal weapons when checked
    const assassinateMeleeAllowed  = new Set(['Tanto']);
    const assassinateRangedAllowed = new Set(['Shuriken','Fukiya']); // plus "No Ranged Weapon" stays available
    const noRangedCanonical = canonicalLabel(NO_RANGED_WEAPON_LABEL);

    if (model.lists.abilities['Assassinate']) {
      // If weapons are illegal, disable Assassinate unless already checked.
      const meleeOK  = !melee || assassinateMeleeAllowed.has(melee);
      const rangedOK = !ranged || assassinateRangedAllowed.has(ranged);

      if (!hasAssassinate && (!meleeOK || !rangedOK)) {
        model.lists.abilities['Assassinate'].disabled = true;
        model.lists.abilities['Assassinate'].reasons.push('weapon mismatch');
      }
    }

    if (hasAssassinate) {
      // disable illegal melee options
      Object.keys(model.dropdowns.melee).forEach(w => {
        if (!assassinateMeleeAllowed.has(w)) {
          model.dropdowns.melee[w].disabled = true;
          model.dropdowns.melee[w].reasons.push('ability mismatch');
        }
      });
      // disable illegal ranged options BUT keep "No Ranged Weapon" available
      Object.keys(model.dropdowns.ranged).forEach(w => {
        if (w === noRangedCanonical) return;
        if (w && !assassinateRangedAllowed.has(w)) {
          model.dropdowns.ranged[w].disabled = true;
          model.dropdowns.ranged[w].reasons.push('ability mismatch');
        }
      });
    }

    // ==================================================================
    // TRAINING: visible only if class-allowed, disabled if gear mismatch (#5/#6)
    // ==================================================================
    allowedTraining.forEach(t => {
      // Locked training stays enabled (we enforce lock behavior separately), but can still show mismatch UI if you want.
      if (TRAINING_ALWAYS_AVAILABLE.includes(t)) return;

      const dep = TRAINING_DEPENDENCIES[t];
      if (!dep) return;

      let ok = false;
      if (dep.melee && dep.melee.length && melee) {
        if (dep.melee.includes(melee)) ok = true;
      }
      if (dep.ranged && dep.ranged.length && ranged) {
        if (dep.ranged.includes(ranged)) ok = true;
      }
      if (dep.support && dep.support.length && support.length) {
        if (support.some(s => dep.support.includes(s))) ok = true;
      }

            if (!ok && model.lists.training[t]) {
        const reason = (dep.support && dep.support.length) ? 'item mismatch' : 'weapon mismatch';

        // NEW RULE:
        // If training is unavailable due to current gear, HIDE it (unless it's already selected)
        if (!training.includes(t)) {
          model.lists.training[t].visible = false;   // hide in the Training step
          model.lists.training[t].disabled = true;   // defensive
        } else {
          // If already selected, keep visible so user can uncheck (prior selection wins)
          model.lists.training[t].visible = true;
          model.lists.training[t].disabled = true;
          model.lists.training[t].reasons.push(reason);
        }
      }

    });

    // Ninja special training mismatch rules (still class-allowed only)
    if (cls === 'Ninja') {
      if (ranged === 'Daikyu' && model.lists.training['Kyujutsu']) {
        model.lists.training['Kyujutsu'].disabled = true;
        model.lists.training['Kyujutsu'].reasons.push('weapon mismatch');
      }
      if (ranged === 'Tanegashima' && model.lists.training['Kayakujutsu']) {
        model.lists.training['Kayakujutsu'].disabled = true;
        model.lists.training['Kayakujutsu'].reasons.push('weapon mismatch');
      }
    }

    // ==================================================================
    // COST TAG FLAGS
    // ==================================================================
    model.costTags.daimyo   = (cls === 'Daimyo');
    model.costTags.samurai  = (cls === 'Samurai');
    model.costTags.ashigaru = (cls === 'Ashigaru');
    model.costTags.sohei    = (cls === 'Sohei');

    return model;
  }

  // ==================================================================
  // RENDERERS
  // ==================================================================
  function renderClassHeader() {
    const cls = getClassValue();
    const nameEl = document.getElementById('shoshin-class-name');
    const imgEl  = document.getElementById('shoshin-class-image');

    if (nameEl) nameEl.textContent = cls || 'Select a Class';
    if (imgEl)  imgEl.src = CLASS_IMAGES[cls] || CLASS_IMAGES['default'];

    const sizeEl = document.getElementById('shoshin-size');
    const descEl = document.getElementById('shoshin-short-description');

    if (CLASS_META[cls]) {
      if (descEl) descEl.innerHTML = CLASS_META[cls].description;
      if (sizeEl) sizeEl.textContent = CLASS_META[cls].size;
      setCharacterHidden('size', CLASS_META[cls].size || '');
    } else {
      if (descEl) descEl.innerHTML = 'Choose a character class to see its details, stats, and equipment summary.';
      if (sizeEl) sizeEl.textContent = '--';
      setCharacterHidden('size', '');
    }
  }

  function renderDropdown(fieldId, modelMap, halfPriceMode) {
    const select = document.querySelector(fieldSelector(fieldId));
    if (!select) return;

    Array.from(select.options).forEach(opt => {
      if (!opt.value) return;

      const base = getOptionBaseLabel(opt);
      const name = canonicalLabel(base);

      resetOptionVisual(opt);
      opt.text = base;

      // Half price label for armor (Daimyo)
      if (halfPriceMode && fieldId === FIELD_ID_ARMOR && base !== NO_ARMOR_LABEL) {
        opt.text = base + ' (half price)';
      }

      const rule = modelMap ? modelMap[name] : null;
      if (!rule) return;

      if (rule.hidden) opt.hidden = true;

      if (rule.disabled) {
        opt.disabled = true;
        const tag = formatMismatchTag(rule.reasons);
        if (tag) opt.text = `${opt.text} ${tag}`;
        opt.style.fontStyle = 'italic';
        opt.style.color = '#999';
      }
    });
  }

  function renderCheckboxField(fieldId, modelMap, lockedSet) {
    const container =
      document.querySelector('#wpforms-' + FORM_ID + '-field_' + fieldId + '-container') ||
      document.querySelector(fieldSelector(fieldId));
    if (!container) return;

    container.querySelectorAll('li').forEach(li => {
      const input = li.querySelector('input[type="checkbox"], input[type="radio"]');
      const labelEl = li.querySelector('label');
      if (!input || !labelEl) return;

      const name = canonicalLabel(labelEl.innerText.trim());

      // Clear mismatch tag
      setInlineTag(labelEl, 'shoshin-mismatch-tag', []);

      // Baseline reset (do not wipe included styling; we'll re-apply)
      if (input.dataset.shoshinLocked !== 'true') {
        input.disabled = false;
        resetLabel(labelEl);
      }

      const rule = modelMap ? modelMap[name] : null;

      // Default: if no class selected or not in model => hide
      if (!rule) {
        li.style.display = 'none';
        return;
      }

      li.style.display = rule.visible ? '' : 'none';
      if (!rule.visible) return;

      const isLocked = lockedSet && lockedSet.has(name);

      if (isLocked) {
        // force checked and prevent uncheck (but do not disable input)
        input.checked = true;
        input.dataset.shoshinLocked = 'true';

        labelEl.style.fontWeight = '400';
        labelEl.style.opacity    = '0.6';
        labelEl.style.color      = '#555';

        let tag = labelEl.querySelector('.shoshin-locked-tag');
        if (!tag) {
          tag = document.createElement('span');
          tag.className = 'shoshin-locked-tag';
          tag.style.fontSize = '0.8em';
          tag.style.marginLeft = '4px';
          tag.style.fontStyle = 'italic';
          labelEl.appendChild(tag);
        }
        tag.textContent = '(Included)';

        if (!input._shoshinLockHandler) {
          input._shoshinLockHandler = function () {
            if (input.dataset.shoshinLocked === 'true') input.checked = true;
          };
          input.addEventListener('change', input._shoshinLockHandler);
        }
        return;
      } else {
        // Not locked: remove lock styling/tag if present
        const tag = labelEl.querySelector('.shoshin-locked-tag');
        if (tag) tag.remove();
        if (input.dataset.shoshinLocked) delete input.dataset.shoshinLocked;
      }

      // Apply disable + mismatch UI (do not auto-uncheck per #8)
      if (rule.disabled) {
        input.disabled = true;
        greyOutLabel(labelEl);
        setInlineTag(labelEl, 'shoshin-mismatch-tag', rule.reasons);
      }
    });
  }

  function updateNoAbilitiesMessage(cls) {
    const container = document.querySelector('#wpforms-' + FORM_ID + '-field_' + FIELD_ID_ABIL + '-container fieldset');
    if (!container) return;

    const rules = CLASS_RULES[cls] || {};
    const allowed = Array.isArray(rules.abilities) ? rules.abilities : [];

    let msgEl = container.querySelector('.shoshin-no-abilities-msg');

    if (cls && allowed.length === 0) {
      if (!msgEl) {
        msgEl = document.createElement('div');
        msgEl.className = 'shoshin-no-abilities-msg';
        msgEl.style.fontSize = '0.85rem';
        msgEl.style.fontStyle = 'italic';
        msgEl.style.color = '#666';
        msgEl.style.marginTop = '4px';
        msgEl.textContent = 'No character abilities are available.';
        const ul = container.querySelector('ul');
        if (ul && ul.parentNode) ul.parentNode.insertBefore(msgEl, ul.nextSibling);
        else container.appendChild(msgEl);
      } else {
        msgEl.style.display = '';
      }
    } else {
      if (msgEl) msgEl.style.display = 'none';
    }
  }

  // ==================================================================
  // REFERENCE TABLE FILTERS
  // ==================================================================
  function updateProficiencyTable() {
    const table = document.getElementById('shoshin-proficiency-table');
    const emptyMsg = document.getElementById('shoshin-proficiency-empty');
    if (!table) return;

    const cls = getClassValue();
    const rows = table.querySelectorAll('tbody tr');

    if (!cls) {
      rows.forEach(row => {
        const nameCell = row.querySelector('td');
        const name = nameCell ? nameCell.textContent.trim() : '';
        row.style.display = INEPT_PROF_NAMES.includes(name) ? '' : 'none';
      });
      if (emptyMsg) emptyMsg.style.display = 'none';
      return;
    }

    let visibleCount = 0;
    rows.forEach(row => {
      const nameCell = row.querySelector('td');
      const name = nameCell ? nameCell.textContent.trim() : '';
      if (INEPT_PROF_NAMES.includes(name)) {
        row.style.display = 'none';
        return;
      }
      const classes = (row.dataset.classes || '').split(',').map(s=>s.trim()).filter(Boolean);
      const show = classes.includes(cls);
      row.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });

    if (emptyMsg) emptyMsg.style.display = visibleCount === 0 ? '' : 'none';
  }

  function updateAbilitiesTable(uiModel) {
    const table = document.getElementById('shoshin-abilities-table');
    const emptyMsg = document.getElementById('shoshin-abilities-empty');
    if (!table) return;

    const cls = getClassValue();
    const rows = table.querySelectorAll('tbody tr');

    if (!cls) {
      rows.forEach(r => r.style.display = 'none');
      if (emptyMsg) emptyMsg.style.display = 'none';
      return;
    }

    const allowed = (CLASS_RULES[cls] && CLASS_RULES[cls].abilities) ? CLASS_RULES[cls].abilities.map(canonicalLabel) : [];
    let visible = 0;

    rows.forEach(row => {
          const ability = canonicalLabel((row.dataset.ability || '').trim());

    const uiRule = uiModel && uiModel.lists && uiModel.lists.abilities
      ? uiModel.lists.abilities[ability]
      : null;

    const show = !!uiRule && uiRule.visible && !uiRule.disabled;

    row.style.display = show ? '' : 'none';
    if (show) visible++;

    });

    if (emptyMsg) emptyMsg.style.display = visible === 0 ? '' : 'none';
  }

  function updateRangedTable(uiModel) {
    const table = document.getElementById('shoshin-ranged-table');
    if (!table) return;

    const cls = getClassValue();
    const rows = table.querySelectorAll('tbody tr');

    rows.forEach(row => {
          const weapon = canonicalLabel((row.dataset.weapon || '').trim());

    const uiRule = uiModel && uiModel.dropdowns && uiModel.dropdowns.ranged
      ? uiModel.dropdowns.ranged[weapon]
      : null;

    const show = !!uiRule && !uiRule.hidden && !uiRule.disabled;

    row.style.display = show ? '' : 'none';

    });
  }

  function updateArmorTable(uiModel) {
    const table = document.getElementById('shoshin-armor-table');
    const emptyMsg = document.getElementById('shoshin-armor-empty');
    if (!table) return;

    const cls = getClassValue();
    const rows = table.querySelectorAll('tbody tr');

    if (!cls) {
      rows.forEach(r => r.style.display = 'none');
      if (emptyMsg) emptyMsg.style.display = 'none';
      return;
    }

    let visible = 0;
    rows.forEach(row => {
          const nameCell = row.querySelector('td:nth-child(2)');
    const name = nameCell ? canonicalLabel(nameCell.textContent.trim()) : '';

    const uiRule = uiModel && uiModel.dropdowns && uiModel.dropdowns.armor
      ? uiModel.dropdowns.armor[name]
      : null;

    const show = !!uiRule && !uiRule.hidden && !uiRule.disabled;

    row.style.display = show ? '' : 'none';
    if (show) visible++;

    });

    if (emptyMsg) emptyMsg.style.display = visible === 0 ? '' : 'none';
  }

  function updateSupportTable(uiModel) {
    const table = document.getElementById('shoshin-support-table');
    const emptyMsg = document.getElementById('shoshin-support-empty');
    if (!table) return;

    const cls = getClassValue();
    const rows = table.querySelectorAll('tbody tr');

    if (!cls) {
      rows.forEach(r => r.style.display = 'none');
      if (emptyMsg) emptyMsg.style.display = 'none';
      return;
    }

    // Support table remains class-based visibility; Shirube is weapon dependent in checkbox list UI.
    const allowed = (CLASS_RULES[cls] && CLASS_RULES[cls].support) ? CLASS_RULES[cls].support.map(canonicalLabel) : [];
    let visibleCount = 0;

    rows.forEach(row => {
      const nameCell = row.querySelector('td:nth-child(2)');
      const name = nameCell ? canonicalLabel(nameCell.textContent.trim()) : '';
       const uiRule = uiModel && uiModel.lists && uiModel.lists.support
        ? uiModel.lists.support[name]
        : null;

      const show = !!uiRule && uiRule.visible && !uiRule.disabled;
      row.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });

    if (emptyMsg) emptyMsg.style.display = (visibleCount === 0) ? '' : 'none';
  }

  function updateTrainingTable(uiModel) {
  const table = document.getElementById('shoshin-training-table');
  if (!table) return;

  const cls = getClassValue();
  const rows = table.querySelectorAll('tbody tr');

  if (!cls) {
    rows.forEach(r => r.style.display = 'none');
    return;
  }

  // Class-allowed list
  const allowed = (CLASS_RULES[cls] && CLASS_RULES[cls].training)
    ? CLASS_RULES[cls].training.map(canonicalLabel)
    : [];

    rows.forEach(row => {
    const name = canonicalLabel((row.dataset.training || '').trim());

    // Must be class-allowed AND visible+selectable per ui model
    const isClassAllowed = allowed.includes(name);
    const uiRule = uiModel && uiModel.lists && uiModel.lists.training
      ? uiModel.lists.training[name]
      : null;

    const canSelect = uiRule ? (uiRule.visible && !uiRule.disabled) : false;

    row.style.display = (isClassAllowed && canSelect) ? '' : 'none';
  });
}


  // ==================================================================
  // SPECIAL COST UI TAGS (FREE/HALF/DOUBLE)
  // ==================================================================
  function handleDaimyoFreeTrainingChange(changedInput) {
    const cls = getClassValue();
    if (cls !== 'Daimyo') { DAIMYO_FREE_TRAINING = null; return; }

    const li = changedInput.closest('li');
    if (!li) return;
    const labelEl = li.querySelector('label');
    if (!labelEl) return;
    const name = canonicalLabel(labelEl.innerText.trim());

    if (changedInput.checked) {
      if (!DAIMYO_FREE_TRAINING) DAIMYO_FREE_TRAINING = name;
    } else {
      if (DAIMYO_FREE_TRAINING === name) DAIMYO_FREE_TRAINING = null;
    }
  }

  function updateDaimyoFreeTrainingUI() {
    const cls = getClassValue();
    const container =
      document.querySelector('#wpforms-' + FORM_ID + '-field_' + FIELD_ID_TRAINING + '-container') ||
      document.querySelector(fieldSelector(FIELD_ID_TRAINING));
    if (!container) return;

    const items = container.querySelectorAll('li');

    // Clear prior free tags (do not wipe mismatch tags)
    items.forEach(li => {
      const labelEl = li.querySelector('label');
      const input = li.querySelector('input[type="checkbox"], input[type="radio"]');
      if (!labelEl || !input) return;
      const tag = labelEl.querySelector('.shoshin-free-training-tag');
      if (tag) tag.remove();
      if (labelEl.dataset && labelEl.dataset.shoshinFreeTraining) delete labelEl.dataset.shoshinFreeTraining;
    });

    if (cls !== 'Daimyo') { DAIMYO_FREE_TRAINING = null; return; }

    const visibleOptions = [];
    const checked = [];

    items.forEach(li => {
      if (li.style.display === 'none') return;
      const input = li.querySelector('input[type="checkbox"], input[type="radio"]');
      const labelEl = li.querySelector('label');
      if (!input || !labelEl) return;

      // skip disabled by mismatches (still can be checked; but practical)
      const name = canonicalLabel(labelEl.innerText.trim());
      const cost = TRAINING_COSTS[name] || 0;

      visibleOptions.push({ name, cost, labelEl, input });
      if (input.checked) checked.push(name);
    });

    if (!visibleOptions.length) return;

    let maxCost = 0;
    visibleOptions.forEach(o => { if (o.cost > maxCost) maxCost = o.cost; });

    // If nothing checked, show all with (free) and dim cheaper ones
    if (checked.length === 0) {
      DAIMYO_FREE_TRAINING = null;
      visibleOptions.forEach(({ cost, labelEl }) => {
        const tag = document.createElement('span');
        tag.className = 'shoshin-free-training-tag';
        tag.style.fontSize = '0.8em';
        tag.style.marginLeft = '4px';
        tag.style.fontStyle = 'italic';
        tag.textContent = '(free)';
        labelEl.appendChild(tag);

        if (cost < maxCost) {
          labelEl.style.opacity = '0.7';
          labelEl.style.color = '#777';
          labelEl.style.fontStyle = 'italic';
        }
      });
      return;
    }

    if (!DAIMYO_FREE_TRAINING || !checked.includes(DAIMYO_FREE_TRAINING)) {
      DAIMYO_FREE_TRAINING = checked[0];
    }

    visibleOptions.forEach(({ name, labelEl }) => {
      if (name === DAIMYO_FREE_TRAINING) {
        const tag = document.createElement('span');
        tag.className = 'shoshin-free-training-tag';
        tag.style.fontSize = '0.8em';
        tag.style.marginLeft = '4px';
        tag.style.fontStyle = 'italic';
        tag.textContent = '(free)';
        labelEl.appendChild(tag);

        labelEl.dataset.shoshinFreeTraining = 'true';
        labelEl.style.opacity = '0.7';
        labelEl.style.color = '#555';
        labelEl.style.fontStyle = 'italic';
      }
    });
  }

  function updateSamuraiHalfTrainingUI() {
    const cls = getClassValue();
    const container =
      document.querySelector('#wpforms-' + FORM_ID + '-field_' + FIELD_ID_TRAINING + '-container') ||
      document.querySelector(fieldSelector(FIELD_ID_TRAINING));
    if (!container) return;

    const items = container.querySelectorAll('li');

    // clear
    items.forEach(li => {
      const labelEl = li.querySelector('label');
      if (!labelEl) return;
      const tag = labelEl.querySelector('.shoshin-half-training-tag');
      if (tag) tag.remove();
    });

    if (cls !== 'Samurai') return;

    const TARGET = ['Kenjutsu','Iaijutsu'];
    const visibleTargets = [];
    const checkedTargets = [];

    items.forEach(li => {
      if (li.style.display === 'none') return;
      const input = li.querySelector('input[type="checkbox"], input[type="radio"]');
      const labelEl = li.querySelector('label');
      if (!input || !labelEl) return;
      const name = canonicalLabel(labelEl.innerText.trim());
      if (!TARGET.includes(name)) return;
      visibleTargets.push({ name, labelEl });
      if (input.checked) checkedTargets.push(name);
    });

    if (!visibleTargets.length) return;

    if (checkedTargets.length === 0) {
      visibleTargets.forEach(({ labelEl }) => {
        const tag = document.createElement('span');
        tag.className = 'shoshin-half-training-tag';
        tag.style.fontSize = '0.8em';
        tag.style.marginLeft = '4px';
        tag.style.fontStyle = 'italic';
        tag.textContent = '(half price)';
        labelEl.appendChild(tag);
      });
      return;
    }

    const chosen = checkedTargets[0];
    visibleTargets.forEach(({ name, labelEl }) => {
      if (name === chosen) {
        const tag = document.createElement('span');
        tag.className = 'shoshin-half-training-tag';
        tag.style.fontSize = '0.8em';
        tag.style.marginLeft = '4px';
        tag.style.fontStyle = 'italic';
        tag.textContent = '(half price)';
        labelEl.appendChild(tag);
        labelEl.style.opacity = '0.7';
        labelEl.style.color = '#555';
        labelEl.style.fontStyle = 'italic';
      }
    });
  }

  function updateAshigaruDoubleTrainingUI() {
    const cls = getClassValue();
    const container =
      document.querySelector('#wpforms-' + FORM_ID + '-field_' + FIELD_ID_TRAINING + '-container') ||
      document.querySelector(fieldSelector(FIELD_ID_TRAINING));
    if (!container) return;

    const items = container.querySelectorAll('li');

    // clear
    items.forEach(li => {
      const labelEl = li.querySelector('label');
      if (!labelEl) return;
      const tag = labelEl.querySelector('.shoshin-double-training-tag');
      if (tag) tag.remove();
    });

    if (cls !== 'Ashigaru') return;

    items.forEach(li => {
      if (li.style.display === 'none') return;
      const input = li.querySelector('input[type="checkbox"], input[type="radio"]');
      const labelEl = li.querySelector('label');
      if (!input || !labelEl) return;
      if (input.dataset.shoshinLocked === 'true') return;

      const tag = document.createElement('span');
      tag.className = 'shoshin-double-training-tag';
      tag.style.fontSize = '0.8em';
      tag.style.marginLeft = '4px';
      tag.style.fontStyle = 'italic';
      tag.textContent = '(double cost)';
      labelEl.appendChild(tag);
    });
  }

  function updateSoheiHalfPolearmTrainingUI() {
    const cls = getClassValue();
    const container =
      document.querySelector('#wpforms-' + FORM_ID + '-field_' + FIELD_ID_TRAINING + '-container') ||
      document.querySelector(fieldSelector(FIELD_ID_TRAINING));
    if (!container) return;

    const items = container.querySelectorAll('li');

    // clear
    items.forEach(li => {
      const labelEl = li.querySelector('label');
      if (!labelEl) return;
      const tag = labelEl.querySelector('.shoshin-sohei-half-training-tag');
      if (tag) tag.remove();
    });

    if (cls !== 'Sohei') return;

    const TARGET = ['Sojutsu','Naginatajutsu'];
    const visibleTargets = [];
    const checkedTargets = [];

    items.forEach(li => {
      if (li.style.display === 'none') return;
      const input = li.querySelector('input[type="checkbox"], input[type="radio"]');
      const labelEl = li.querySelector('label');
      if (!input || !labelEl) return;
      const name = canonicalLabel(labelEl.innerText.trim());
      if (!TARGET.includes(name)) return;
      visibleTargets.push({ name, labelEl });
      if (input.checked) checkedTargets.push(name);
    });

    if (!visibleTargets.length) return;

    if (checkedTargets.length === 0) {
      visibleTargets.forEach(({ labelEl }) => {
        const tag = document.createElement('span');
        tag.className = 'shoshin-sohei-half-training-tag';
        tag.style.fontSize = '0.8em';
        tag.style.marginLeft = '4px';
        tag.style.fontStyle = 'italic';
        tag.textContent = '(half price)';
        labelEl.appendChild(tag);
      });
      return;
    }

    const chosen = checkedTargets[0];
    visibleTargets.forEach(({ name, labelEl }) => {
      if (name === chosen) {
        const tag = document.createElement('span');
        tag.className = 'shoshin-sohei-half-training-tag';
        tag.style.fontSize = '0.8em';
        tag.style.marginLeft = '4px';
        tag.style.fontStyle = 'italic';
        tag.textContent = '(half price)';
        labelEl.appendChild(tag);
        labelEl.style.opacity = '0.7';
        labelEl.style.color = '#555';
        labelEl.style.fontStyle = 'italic';
      }
    });
  }

  // ==================================================================
  // STATS + SUMMARIES + COSTS
  // ==================================================================
  function updateCharacterStats() {
    const cls = getClassValue();
    const stats = CLASS_BASE_STATS[cls] || null;

    const atkEl  = document.getElementById('shoshin-stat-attack');
    const defEl  = document.getElementById('shoshin-stat-defense');
    const movEl  = document.getElementById('shoshin-stat-movement');
    const bodEl  = document.getElementById('shoshin-stat-body');
    const ldrEl  = document.getElementById('shoshin-stat-leadership');
    const iniEl  = document.getElementById('shoshin-stat-initiative');
    if (!atkEl || !defEl || !movEl || !bodEl || !ldrEl || !iniEl) return;

    atkEl.style.color = '';
    defEl.style.color = '';
    movEl.style.color = '';
    bodEl.style.color = '';
    ldrEl.style.color = '';
    iniEl.style.color = '';

    if (!stats) {
      atkEl.textContent = '--'; defEl.textContent = '--'; movEl.textContent = '--';
      bodEl.textContent = '--'; ldrEl.textContent = '--'; iniEl.textContent = '--';
      setCharacterHidden('atk', 0);
      setCharacterHidden('def', 0);
      setCharacterHidden('mov', 0);
      setCharacterHidden('bod', 0);
      setCharacterHidden('ldr', 0);
      setCharacterHidden('ini', 0);
      return;
    }

    let attack     = stats.attack;
    let defense    = stats.defense;
    let movement   = stats.movement;
    let body       = stats.body;
    let leadership = stats.leadership;
    let initiative = stats.initiative;

    const state = readCurrentState();
    const activeInepts = computeActiveInepts(state);

    // Armor
    if (state.armor === 'Do-maru') defense += 1;
    else if (state.armor === 'O-yoroi') defense += 2;
    else if (state.armor === 'Tosei-gusoku') defense += 3;

    // Support
    const hasUma = state.support.includes('Uma');
    const hasBaj = state.training.includes('Bajutsu');
    const hasSash = state.support.includes('Sashimono');
    const hasEma  = state.support.includes('Emakimono');

    if (hasUma) movement += 8;

    const horseInept = activeInepts.includes('Inept: Horsemanship');
    if (hasUma && hasBaj && !horseInept) body += 1;
    if (hasUma && horseInept) bodEl.style.color = 'red';

    if (hasSash) leadership += 1;
    if (hasEma) initiative += 1;

    // Abilities
    if (state.abilities.includes('Agile')) movement += 2;
    if (state.abilities.includes('Concealment')) defense += 1;
    if (state.abilities.includes('Ki Resilience')) body += 1;

    atkEl.textContent = attack;
    defEl.textContent = defense;
    movEl.textContent = formatDistance(movement);
    bodEl.textContent = body;
    ldrEl.textContent = leadership;
    iniEl.textContent = initiative;

    setCharacterHidden('atk', attack);
    setCharacterHidden('def', defense);
    setCharacterHidden('mov', movement);
    setCharacterHidden('bod', body);
    setCharacterHidden('ldr', leadership);
    setCharacterHidden('ini', initiative);
  }

  function updateWeaponSummary() {
    const meleeDmgEl   = document.getElementById('shoshin-melee-dmg');
    const meleeCritEl  = document.getElementById('shoshin-melee-crit');
    const meleeDistEl  = document.getElementById('shoshin-melee-dist');
    const rangedDmgEl  = document.getElementById('shoshin-ranged-dmg');
    const rangedCritEl = document.getElementById('shoshin-ranged-crit');
    const rangedDistEl = document.getElementById('shoshin-ranged-dist');
    if (!meleeDmgEl || !meleeCritEl || !meleeDistEl || !rangedDmgEl || !rangedCritEl || !rangedDistEl) return;

    const state = readCurrentState();
    const activeInepts = computeActiveInepts(state);

    const hasMeleeInept  = activeInepts.includes('Inept: Melee Combat');
    const hasRangedInept = activeInepts.includes('Inept: Ranged Combat');

    const meleeName = state.melee || '';
    const rangedName = state.ranged || '';

    const hasAssassinate = state.abilities.includes('Assassinate');

    function bumpNumericDamage(val) {
      if (val == null) return val;
      const trimmed = String(val).trim();
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num === 1 && trimmed === String(num)) return '2';
      return val;
    }

    let meleeStats  = { damage: '--', critical: '--', distance: '--' };
    let rangedStats = { damage: '--', critical: '--', distance: '--' };

    if (meleeName && MELEE_STATS[meleeName]) meleeStats = MELEE_STATS[meleeName];
    if (rangedName && RANGED_STATS[rangedName]) rangedStats = RANGED_STATS[rangedName];

    let meleeDmgVal   = meleeStats.damage;
    let meleeCritVal  = meleeStats.critical;
    let meleeDistVal  = meleeStats.distance;

    let rangedDmgVal  = rangedStats.damage;
    let rangedCritVal = rangedStats.critical;
    let rangedDistVal = rangedStats.distance;

    if (hasAssassinate) {
      if (meleeName === 'Tanto') meleeDmgVal = bumpNumericDamage(meleeDmgVal);
      if (rangedName === 'Shuriken' || rangedName === 'Fukiya') rangedDmgVal = bumpNumericDamage(rangedDmgVal);
    }

    if (hasMeleeInept) {
      meleeCritVal = '--';
      meleeDistVal = halfDistanceValue(meleeDistVal);
      meleeDmgEl.style.color  = 'red';
      meleeCritEl.style.color = 'red';
      meleeDistEl.style.color = 'red';
    } else {
      meleeDmgEl.style.color  = '';
      meleeCritEl.style.color = '';
      meleeDistEl.style.color = '';
    }

    if (hasRangedInept && rangedName) {
      rangedCritVal = '--';
      rangedDistVal = halfDistanceValue(rangedDistVal);
      rangedDmgEl.style.color  = 'red';
      rangedCritEl.style.color = 'red';
      rangedDistEl.style.color = 'red';
    } else {
      rangedDmgEl.style.color  = '';
      rangedCritEl.style.color = '';
      rangedDistEl.style.color = '';
    }

    meleeDmgEl.textContent   = meleeDmgVal;
    meleeCritEl.textContent  = meleeCritVal;
    meleeDistEl.textContent  = formatDistance(meleeDistVal);

    rangedDmgEl.textContent  = rangedDmgVal;
    rangedCritEl.textContent = rangedCritVal;
    rangedDistEl.textContent = formatDistance(rangedDistVal);

    setCharacterHidden('meleeDamage', meleeDmgVal);
    setCharacterHidden('meleeCrit', meleeCritVal);
    setCharacterHidden('meleeDistance', formatDistance(meleeDistVal));

    setCharacterHidden('rangedDamage', rangedDmgVal);
    setCharacterHidden('rangedCrit', rangedCritVal);
    setCharacterHidden('rangedDistance', formatDistance(rangedDistVal));
  }

  function computeTotalCost() {
    const state = readCurrentState();
    const cls = state.cls;
    let total = 0;

    if (CLASS_BASE_STATS[cls]) total += (CLASS_BASE_STATS[cls].cost || 0);
    const rules = CLASS_COST_RULES[cls] || {};

    if (state.melee && MELEE_STATS[state.melee]) total += (MELEE_STATS[state.melee].cost || 0);
    if (state.ranged && RANGED_STATS[state.ranged]) total += (RANGED_STATS[state.ranged].cost || 0);

    let armorCost = 0;
    if (state.armor && ARMOR_COSTS[state.armor] != null) armorCost = ARMOR_COSTS[state.armor];
    if (armorCost > 0 && typeof rules.armorMultiplier === 'number') {
      armorCost = applyCostMultiplier(armorCost, rules.armorMultiplier);
    }
    total += armorCost;

    state.support.forEach(n => { if (SUPPORT_COSTS[n] != null) total += SUPPORT_COSTS[n]; });
    state.abilities.forEach(n => { const k = canonicalLabel(n); if (ABILITY_COSTS[k] != null) total += ABILITY_COSTS[k]; });

    if (cls === 'Daimyo') {
      state.training.forEach(n => {
        let c = TRAINING_COSTS[n] || 0;
        if (DAIMYO_FREE_TRAINING && n === DAIMYO_FREE_TRAINING) c = 0;
        total += c;
      });
      return total;
    }

    if (cls === 'Samurai') {
      const HALF = ['Kenjutsu','Iaijutsu'];
      let halfApplied = false;
      state.training.forEach(n => {
        let c = TRAINING_COSTS[n] || 0;
        if (!halfApplied && HALF.includes(n)) {
          c = applyCostMultiplier(c, 0.5);
          halfApplied = true;
        }
        total += c;
      });
      return total;
    }

    state.training.forEach(n => {
      let c = TRAINING_COSTS[n] || 0;

      if (rules.freeTraining && rules.freeTraining.includes(n)) {
        c = 0;
      } else {
        if (rules.halfTraining && rules.halfTraining.includes(n)) c = applyCostMultiplier(c, 0.5);
        if (typeof rules.trainingMultiplier === 'number') c = applyCostMultiplier(c, rules.trainingMultiplier);
      }
      total += c;
    });

    return total;
  }

  function updateTotalCostBox() {
    const box = document.getElementById('shoshin-total-cost');
    if (!box) return;
    const total = computeTotalCost();
    box.textContent = total > 0 ? total : '--';
    setCharacterHidden('totalCost', total > 0 ? total : 0);
  }

  function updateEquipmentSummary() {
    const col1 = document.getElementById('shoshin-equipment-col1');
    const col2 = document.getElementById('shoshin-equipment-col2');
    if (!col1 || !col2) return;

    col1.innerHTML = '';
    col2.innerHTML = '';

    const items = [];

        const meleeName = canonicalLabel(getSingleSelectText(FIELD_ID_MELEE));

    // Only show the Unarmed flavor text when Unarmed Combat is explicitly selected.
    // If nothing is selected yet, show nothing.
    if (meleeName === 'Unarmed Combat') {
      items.push('Fists, Kicks, etc.');
    } else if (meleeName) {
      items.push(meleeName);
    }


    const rangedName = canonicalLabel(getSingleSelectText(FIELD_ID_RANGED));
    if (rangedName && rangedName !== canonicalLabel(NO_RANGED_WEAPON_LABEL)) items.push(rangedName);

    const armorName = canonicalLabel(getSingleSelectText(FIELD_ID_ARMOR));
    if (armorName && armorName !== canonicalLabel(NO_ARMOR_LABEL)) items.push(armorName);

    getCheckedSupportItems().forEach(n => items.push(n));

    if (!items.length) {
      setCharacterHidden('equipItems', 'No equipment selected');
      const li = document.createElement('li');
      li.textContent = 'No equipment selected';
      col1.appendChild(li);
      return;
    }

    setCharacterHidden('equipItems', items.join('\n'));

    const mid = Math.ceil(items.length / 2);
    items.slice(0, mid).forEach(t => { const li = document.createElement('li'); li.textContent = t; col1.appendChild(li); });
    items.slice(mid).forEach(t => { const li = document.createElement('li'); li.textContent = t; col2.appendChild(li); });
  }

  function updateTrainingSummary() {
    const col1 = document.getElementById('shoshin-training-col1');
    const col2 = document.getElementById('shoshin-training-col2');
    if (!col1 || !col2) return;

    col1.innerHTML = '';
    col2.innerHTML = '';

    const items = getCheckedTraining();
    if (!items.length) {
      const li = document.createElement('li');
      li.textContent = 'Untrained';
      col1.appendChild(li);
      setCharacterHidden('ryu', '');
      return;
    }

    const unique = Array.from(new Set(items)).sort();
    setCharacterHidden('ryu', unique.join('\n'));

    const mid = Math.ceil(unique.length / 2);
    unique.slice(0, mid).forEach(n => { const li = document.createElement('li'); li.textContent = n; col1.appendChild(li); });
    unique.slice(mid).forEach(n => { const li = document.createElement('li'); li.textContent = n; col2.appendChild(li); });
  }

  function updateCombatModifiersSummary() {
    const col1 = document.getElementById('shoshin-modifiers-col1');
    const col2 = document.getElementById('shoshin-modifiers-col2');
    if (!col1 || !col2) return;
    col1.innerHTML = '';
    col2.innerHTML = '';

    const state = readCurrentState();
    const cls = state.cls;
    const activeInepts = computeActiveInepts(state);

    const meleeName = state.melee;
    const rangedName = state.ranged;
    const abilities = state.abilities || [];
    const training = state.training || [];
    const support = state.support || [];

    const hasSojutsu       = training.includes('Sojutsu');
    const hasNaginatajutsu = training.includes('Naginatajutsu');
    const hasKenjutsu      = training.includes('Kenjutsu');
    const hasIaijutsu      = training.includes('Iaijutsu');
    const hasKyujutsu      = training.includes('Kyujutsu');
    const hasKayakujutsu   = training.includes('Kayakujutsu');
    const hasBajutsu       = training.includes('Bajutsu');
    const hasHojojutsu     = training.includes('Hojojutsu');
    const hasSuieijutsu    = training.includes('Suieijutsu');

    const hasShirube       = support.includes('Shirube');
    const hasUma           = support.includes('Uma');
    const hasTorinawa      = support.includes('Torinawa');
    const hasKanpo         = support.includes('Kanpo');
    const hasShakuhachi    = support.includes('Shakuhachi');

    const hasIronFists     = abilities.includes('Iron Fists');

    const meleeIneptActive  = activeInepts.includes('Inept: Melee Combat');
	const rangedIneptActive = activeInepts.includes('Inept: Ranged Combat');
	const horseIneptActive  = activeInepts.includes('Inept: Horsemanship');
	const waterIneptActive  = activeInepts.includes('Inept: Water Combat');

	const mods = [];

	// ------------------------------------------------------
	// INEPT-BASED COMBAT MODIFIERS
	// ------------------------------------------------------

	// Only treat Lucky Hits as melee/ranged-capable if an actual weapon is selected
	const hasActualMelee  = !!meleeName;
	const hasActualRanged = !!rangedName;

	// Lucky Hits (show one tag depending on which are active)
	// [M] only shows if a real melee weapon is selected
	// [R] only shows if a real ranged weapon is selected
	// [B] only shows if BOTH a real melee AND ranged weapon are selected
	if (meleeIneptActive && rangedIneptActive && hasActualMelee && hasActualRanged) {
	  mods.push('[B] Lucky Hits on 6 only');
	} else if (meleeIneptActive && hasActualMelee) {
	  mods.push('[M] Lucky Hits on 6 only');
	} else if (rangedIneptActive && hasActualRanged) {
	  mods.push('[R] Lucky Hits on 6 only');
	}



	// Water Combat restriction
	if (waterIneptActive) {
	  mods.push('[B] May not attack in water');
	}

	
	  // ------------------------------------------------------
  // PROFICIENCY GATES (weapon tags cannot show while Inept)
  // ------------------------------------------------------
  function isMeleeProficient() {
    if (!meleeName) return false;
    if (meleeIneptActive) return false;

    const needed = WEAPON_TRAINING_MAP[meleeName];
    if (!needed) return false;

    return training.includes(needed);
  }

  function isRangedProficient() {
    if (!rangedName) return false;
    if (rangedIneptActive) return false;

    // Ninja + Kunai special case
    if (cls === 'Ninja' && rangedName === 'Kunai') {
      return training.includes('Ninjutsu');
    }

    const needed = WEAPON_TRAINING_MAP[rangedName];
    if (!needed) return false;

    return training.includes(needed);
  }

  const meleeProficient  = isMeleeProficient();
  const rangedProficient = isRangedProficient();


    // High Defense => Crit immunity
    if (cls && CLASS_BASE_STATS[cls]) {
      let defense = CLASS_BASE_STATS[cls].defense;
      if (state.armor === 'Do-maru') defense += 1;
      else if (state.armor === 'O-yoroi') defense += 2;
      else if (state.armor === 'Tosei-gusoku') defense += 3;
      if (abilities.includes('Concealment')) defense += 1;
      if (defense >= 6) mods.push('[P] Immunity: Critical Hits');
    }

    if (hasSuieijutsu) {
      mods.push('[P] May operate ship');
      mods.push('[P] May attack in water');
    }
    if (hasKanpo) mods.push('[P] Immunity: Poison');
    if (hasShakuhachi) mods.push('[P] Immunity: Fear');

      // Unarmed Combat baseline vs. Iron Fists upgrade
		// RULE (exception):
		// - If Unarmed Combat is selected AND Iron Fists is NOT selected -> ALWAYS show "[M] May not damage armor"
		//   (regardless of Jujutsu / Inept)
		// - If Iron Fists IS selected -> remove that default tag.
		//   Optionally show the upgrade only when proficient (so it doesn't leak while Inept).
		if (meleeName === 'Unarmed Combat') {
		  if (!hasIronFists) {
			// Default always-on baseline while Unarmed is selected
			mods.push('[M] May not damage armor');
		  } else {
			// Iron Fists selected: baseline removed.
			// Show upgrade ONLY when proficient (prevents tag showing while Inept).
			if (!meleeIneptActive && training.includes('Jujutsu')) {
			  mods.push('[M] May damage armor & stone');
			}
		  }
		}


      // Kanabo: can smash stone (ONLY when proficient)
  if (meleeName === 'Kanabo' && meleeProficient) {
    mods.push('[M] May damage stone objects');
  }


    if (
      (meleeName === 'Yari' && hasSojutsu) ||
      (meleeName === 'Naginata' && hasNaginatajutsu)
    ) mods.push('[M] +1 To-Hit vs mounted');

    if (hasUma && hasBajutsu && !horseIneptActive) mods.push('[B] +1 To-Hit vs non-mounted');

    if (!meleeIneptActive) {
      if ((meleeName === 'Katana' && hasKenjutsu) || (meleeName === 'Nodachi' && hasIaijutsu)) {
        mods.push('[M] >1 vs Restrained: 3" Morale');
      }
    }

    if (rangedName === 'Houroku-Hiya') mods.push('[R] 1 To-Hit for all w/in 2" AOE');

    if (!rangedIneptActive) {
      if (rangedName === 'Hankyu' && hasKyujutsu) mods.push('[R] 9–15": -1 To-Hit');
      if (rangedName === 'Daikyu' && hasKyujutsu) mods.push('[R] 18–30": -1 To-Hit');
      if (rangedName === 'Tanegashima' && hasKayakujutsu) mods.push('[R] 12–18": -1 To-Hit');
    }

    const hasJutte = (meleeName === 'Jutte');
    const hasBow   = (rangedName === 'Hankyu' || rangedName === 'Daikyu');
    if (hasShirube) {
      if (hasJutte && hasBow) mods.push('[B] Hits inflict Burn');
      else if (hasJutte) mods.push('[M] Hits inflict Burn');
      else if (hasBow) mods.push('[R] Hits inflict Burn');
    }

    if (hasTorinawa && hasHojojutsu) mods.push('[A] Roll vs Init to Restrain');

    if (cls === 'Daimyo' && abilities.includes('Divine Inspiration')) mods.push('[P] Units w/in 2" AOE +1 Saves');
    if (cls === 'Samurai' && abilities.includes('Honor Duel')) mods.push('[M] 1v1 vs Daimyo/Samurai');

    if (abilities.includes('Missile Deflection')) mods.push('[A] Negate a ranged attack*');
    if (abilities.includes('Light-footed')) mods.push('[P] Ignore opportunity attacks');
    if (abilities.includes('Shadow Strikes')) mods.push('[B] +2 To-Hit at night');
    if (abilities.includes('Assassinate')) mods.push('[B] Crits bypass High Def');

    if (abilities.includes('Concealment')) {
      mods.push('[A] Conceal self');
      mods.push('[P] Auto-hidden at start of night');
    }
    if (abilities.includes('Wall Crawling')) mods.push('[P] Navigate any surface');
    if (abilities.includes('Heal')) mods.push('[A] Add +1 Body & Cure Poison');

    if (abilities.includes('Aura of Resolve')) mods.push('[A] Units w/in 3" AOE +High Def');
    if (abilities.includes('Omen of Wrath')) mods.push('[A] Units w/in 3" AOE +1 Atk');
    if (abilities.includes('Enduring Ward')) mods.push('[A] Units w/in 3" AOE +1 Def');
    if (abilities.includes('Beyond the Veil')) mods.push('[A] Summon Yokai up to 12"');

    // Dedup + sort tags
    const seen = new Set();
    let unique = mods.filter(m => (seen.has(m) ? false : (seen.add(m), true)));

    if (!unique.length) {
      const li = document.createElement('li');
      li.textContent = 'None';
      col1.appendChild(li);
      setCharacterHidden('mrbpa', '');
      return;
    }

    const ORDER = { '[M]': 0, '[R]': 1, '[B]': 2, '[P]': 3, '[A]': 4 };
    unique.sort((a,b) => {
      const ta = a.slice(0,3), tb = b.slice(0,3);
      const wa = (ORDER[ta] !== undefined) ? ORDER[ta] : 999;
      const wb = (ORDER[tb] !== undefined) ? ORDER[tb] : 999;
      if (wa !== wb) return wa - wb;
      return a.localeCompare(b);
    });

    const mid = Math.ceil(unique.length / 2);
    unique.slice(0, mid).forEach(t => { const li = document.createElement('li'); li.textContent = t; col1.appendChild(li); });
    unique.slice(mid).forEach(t => { const li = document.createElement('li'); li.textContent = t; col2.appendChild(li); });

    setCharacterHidden('mrbpa', unique.slice(0,16).join('\n'));
  }

  function updateProficienciesSummary() {
    const col1 = document.getElementById('shoshin-proficiencies-col1');
    const col2 = document.getElementById('shoshin-proficiencies-col2');
    if (!col1 || !col2) return;

    const state = readCurrentState();
    const cls = state.cls;
    const activeInepts = computeActiveInepts(state);

    let items = [];
    if (activeInepts.length) items.push(...activeInepts);

    const STAT_ONLY = ['Agile','Ki Resilience'];
    const checkedAbilities = getCheckedAbilities();

    let abilitiesForProfs = checkedAbilities.filter(n => !STAT_ONLY.includes(n));
    if (cls === 'Ninja' && checkedAbilities.includes('Agile')) abilitiesForProfs.push('Agile');
    if (cls === 'Sohei' && checkedAbilities.includes('Ki Resilience')) abilitiesForProfs.push('Ki Resilience');

    if (abilitiesForProfs.length) items.push(...abilitiesForProfs);

    let derived = [];
    DERIVED_PROFS.forEach(def => {
      try { if (def && typeof def.when === 'function' && def.when(state)) derived.push(def.name); } catch(e){}
    });

    derived = derived.filter(n => n !== 'Immunity: Poison' && n !== 'Immunity: Fear');
    if (derived.length) items.push(...derived);

    if (activeInepts.includes('Inept: Melee Combat')) {
      const blocked = ['Cavalry Piercer','Decapitate','Stonecrusher'];
      items = items.filter(n => !blocked.includes(n));
    }
    if (activeInepts.includes('Inept: Ranged Combat')) {
      items = items.filter(n => n !== 'Extended Range');
    }

    if (items.includes('Iron Fists')) items = items.filter(n => n !== 'Stonecrusher');

    // High Defense tag
    (function addHighDefense() {
      if (!cls || !CLASS_BASE_STATS[cls]) return;
      let defense = CLASS_BASE_STATS[cls].defense;
      if (state.armor === 'Do-maru') defense += 1;
      else if (state.armor === 'O-yoroi') defense += 2;
      else if (state.armor === 'Tosei-gusoku') defense += 3;
      if (state.abilities.includes('Concealment')) defense += 1;
      if (defense >= 6) items.push('High Defense');
    })();

    const seen = new Set();
    items = items.filter(n => (seen.has(n) ? false : (seen.add(n), true)));

    col1.innerHTML = '';
    col2.innerHTML = '';

    setCharacterHidden('profAbil', items.length ? items.join('\n') : 'None');

    if (!items.length) {
      const li = document.createElement('li');
      li.textContent = 'None';
      col1.appendChild(li);
      return;
    }

    items.forEach((name, idx) => {
      const li = document.createElement('li');
      li.textContent = name;
      if (INEPT_PROF_NAMES.includes(name)) li.classList.add('shoshin-red');
      if (idx % 2 === 0) col1.appendChild(li);
      else col2.appendChild(li);
    });
  }

  // ==================================================================
  // RESET ON CLASS CHANGE (kept)
  // ==================================================================
  function resetClassDependentFields() {
    // Clear checkboxes/radios
    [FIELD_ID_ABIL, FIELD_ID_SUPPORT, FIELD_ID_TRAINING].forEach(fid => {
      const container =
        document.querySelector('#wpforms-' + FORM_ID + '-field_' + fid + '-container') ||
        document.querySelector(fieldSelector(fid));
      if (!container) return;

      container.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => {
        input.checked = false;
        if (input._shoshinLockHandler) {
          input.removeEventListener('change', input._shoshinLockHandler);
          delete input._shoshinLockHandler;
        }
        if (input.dataset && input.dataset.shoshinLocked) delete input.dataset.shoshinLocked;
      });

      container.querySelectorAll('.shoshin-locked-tag,.shoshin-free-training-tag,.shoshin-half-training-tag,.shoshin-double-training-tag,.shoshin-sohei-half-training-tag,.shoshin-mismatch-tag')
        .forEach(tag => tag.remove());
    });

    // Reset selects to sane defaults
    clearSelect(FIELD_ID_MELEE);
    setSelectByText(FIELD_ID_RANGED, NO_RANGED_WEAPON_LABEL);
    setSelectByText(FIELD_ID_ARMOR, NO_ARMOR_LABEL);
  }
  
	  function clearSelect(fieldId) {
	  const select = document.querySelector(fieldSelector(fieldId));
	  if (!select) return;

	  // Prefer an explicit empty-value option if it exists
	  const emptyOpt = Array.from(select.options).find(o => !o.value || o.value === '');
	  if (emptyOpt) {
		select.value = emptyOpt.value;
		return;
	  }

	  // Otherwise, force no selection (works in most browsers)
	  select.selectedIndex = -1;
	}
	
	let _shoshinPruningTraining = false;

function pruneInvalidTrainingSelections(state) {
  const cls = state.cls;
  if (!cls) return false;

  const classAllowed = (CLASS_RULES[cls] && CLASS_RULES[cls].training)
    ? CLASS_RULES[cls].training.map(canonicalLabel)
    : [];

  const locked = new Set((LOCKED_TRAINING[cls] || []).map(canonicalLabel));

  const container =
    document.querySelector('#wpforms-' + FORM_ID + '-field_' + FIELD_ID_TRAINING + '-container') ||
    document.querySelector(fieldSelector(FIELD_ID_TRAINING));
  if (!container) return false;

  let changed = false;

  container.querySelectorAll('li').forEach(li => {
    const input = li.querySelector('input[type="checkbox"], input[type="radio"]');
    const labelEl = li.querySelector('label');
    if (!input || !labelEl || !input.checked) return;

    const t = canonicalLabel(labelEl.innerText.trim());

    // Never auto-uncheck included/locked trainings
    if (locked.has(t)) return;

    // If class no longer allows it, drop it
    if (!classAllowed.includes(t)) {
      input.checked = false;
      changed = true;
      return;
    }

    // If training has dependencies, enforce them
    if (TRAINING_ALWAYS_AVAILABLE.includes(t)) return;

    const dep = TRAINING_DEPENDENCIES[t];
    if (!dep) return;

    let ok = false;

    if (dep.melee && dep.melee.length && state.melee && dep.melee.includes(state.melee)) ok = true;
    if (dep.ranged && dep.ranged.length && state.ranged && dep.ranged.includes(state.ranged)) ok = true;
    if (dep.support && dep.support.length && state.support && state.support.some(s => dep.support.includes(s))) ok = true;

	    // Ninja edge restrictions: same training shared by weapons, but still illegal for Ninja in some cases
    if (state.cls === 'Ninja') {
      if (t === 'Kayakujutsu' && state.ranged === 'Tanegashima') ok = false;
      if (t === 'Kyujutsu'    && state.ranged === 'Daikyu')      ok = false;
    }


    if (!ok) {
      input.checked = false;
      changed = true;
    }
  });

  return changed;
}



  // ==================================================================
  // CENTRAL RECOMPUTE ENGINE (ONE PASS)
  // ==================================================================
  function recomputeAll() {
  const state = readCurrentState();
  const cls = state.cls;

  // Auto-prune invalid training selections when the required weapon/support is removed
  if (!_shoshinPruningTraining) {
    _shoshinPruningTraining = true;
    const pruned = pruneInvalidTrainingSelections(state);
    _shoshinPruningTraining = false;
    if (pruned) return recomputeAll(); // re-run once with cleaned state
  }


    renderClassHeader();

    // Build UI model
    const model = buildUiModel(state);

    // Dropdowns
    renderDropdown(FIELD_ID_MELEE,  model.dropdowns.melee,  false);
    renderDropdown(FIELD_ID_RANGED, model.dropdowns.ranged, false);
    renderDropdown(FIELD_ID_ARMOR,  model.dropdowns.armor,  (cls === 'Daimyo'));

    // Checkbox lists
    renderCheckboxField(FIELD_ID_ABIL,     model.lists.abilities, model.locks.abilities);
    renderCheckboxField(FIELD_ID_SUPPORT,  model.lists.support,   new Set()); // no locked support in your rules
    renderCheckboxField(FIELD_ID_TRAINING, model.lists.training,  model.locks.training);

    // Cost/price UI tags
    updateDaimyoFreeTrainingUI();
    updateSamuraiHalfTrainingUI();
    updateAshigaruDoubleTrainingUI();
    updateSoheiHalfPolearmTrainingUI();

    // Reference tables
	updateProficiencyTable();
	updateAbilitiesTable(model);
	updateRangedTable(model);
	updateArmorTable(model);
	updateSupportTable(model);
	updateTrainingTable(model);



    updateNoAbilitiesMessage(cls);

    // Stats/summaries/cost
    updateCharacterStats();
    updateWeaponSummary();
    updateEquipmentSummary();
    updateTrainingSummary();
    updateCombatModifiersSummary();
    updateProficienciesSummary();
    updateTotalCostBox();
  }

  // ==================================================================
  // INIT
  // ==================================================================
  function initShoshinCharacterCreator() {
    const formEl = document.getElementById('wpforms-form-' + FORM_ID);
    if (!formEl) return;

    setCharacterHidden('gameSystem', 'Path of Ascension');

    buildWeaponStatsCache();
    buildCostCaches();

	clearSelect(FIELD_ID_MELEE);
    recomputeAll();

    const classFieldEl = document.querySelector(fieldSelector(FIELD_ID_CLASS));
    if (classFieldEl) {
      classFieldEl.addEventListener('change', function() {
        DAIMYO_FREE_TRAINING = null;
        resetClassDependentFields();
        recomputeAll();
      });
    }

    [FIELD_ID_MELEE, FIELD_ID_RANGED, FIELD_ID_ARMOR].forEach(fid => {
      const el = document.querySelector(fieldSelector(fid));
      if (!el) return;
      el.addEventListener('change', function() { recomputeAll(); });
    });

    [FIELD_ID_ABIL, FIELD_ID_SUPPORT, FIELD_ID_TRAINING].forEach(fid => {
      const container =
        document.querySelector('#wpforms-' + FORM_ID + '-field_' + fid + '-container') ||
        document.querySelector(fieldSelector(fid));
      if (!container) return;

      container.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => {
        input.addEventListener('change', function() {
          if (fid === FIELD_ID_TRAINING) handleDaimyoFreeTrainingChange(input);
          recomputeAll();
        });
      });
    });
  }

  initShoshinCharacterCreator();
});
