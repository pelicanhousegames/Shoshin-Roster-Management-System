document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // ==================================================================
  // CONFIG: SUPPORT ASSET FORM & FIELD IDS
  // ==================================================================
  const FORM_ID_SUPPORT             = 2501;
  const FIELD_ID_GAME_SYSTEM        = 2;
  const FIELD_ID_REF_SUPPORT        = 3;
  const FIELD_ID_ASSET_TYPE         = 4;
  const FIELD_ID_MUNITIONS          = 8;
  const FIELD_ID_VESSEL_SIZE        = 13;
  const FIELD_ID_VESSEL_DIM         = 18;
  const FIELD_ID_DETACHMENT         = 19;
  const FIELD_ID_ASSET_EQUIP_ITEMS  = 39;

  // Crew Selection HTML block (WPForms HTML field ID)
  // IMPORTANT: Replace 999 with the actual Field ID for your Crew Selection HTML field.
  const FIELD_ID_CREW_HTML          = 999;

  // ==================================================================
  // SUPPORT ASSET IMAGES & META
  // ==================================================================
  const SUPPORT_ASSET_IMAGES = {
    default:         '/wp-content/uploads/2025/12/Helmet-grey.jpg',
    Ozutsu:          '/wp-content/uploads/2025/12/cannon.jpeg',
    'Mokuzo Hansen': '/wp-content/uploads/2025/12/makuzo.jpeg'
  };

  const SUPPORT_ASSET_META = {
    Ozutsu: {
      shortDescription: 'Lightweight Cannon',
      size: 'Medium',
      attributes: 'Requires reload after use.'
    },
    'Mokuzo Hansen': {
      shortDescription: 'Wooden Sailing Ship',
      // NOTE: size fallback is not used for Mokuzo summary size anymore
      size: 'Medium – 1" × 3"',
      attributes: 'Flammable. Length cannot exceed 3× width.'
    }
  };

  // ==================================================================
  // BASE STATS + DEFAULT COST
  // ==================================================================
  const SUPPORT_ASSET_STATS = {
    Ozutsu: {
      attack:     'Variable',
      resistance: '4',
      movement:   'Variable',
      toughness:  '3',
      leadership: '--',
      initiative: 'Highest',
      cost:       8
    },
    'Mokuzo Hansen': {
      attack:     '--',
      resistance: '3',
      movement:   '--',
      toughness:  '--',
      leadership: '--',
      initiative: 'Captain',
      cost:       '--'
    }
  };

  // ==================================================================
  // MUNITIONS
  // ==================================================================
  const MUNITIONS_DATA = {
    'Tetsuho': {
      cost:      5,
      damage:    '1d6',
      critical:  '1d3',
      distance:  '18"',
      modifiers: [
        '[R] 18–24": -1 To-Hit',
        '[R] 1" wide AOE Line',
        '[P] May damage stone & metal'
      ]
    },
    'Bo-Hiya': {
      cost:      5,
      damage:    '1d6',
      critical:  '1d2',
      distance:  '24"',
      modifiers: [
        '[R] 24–36": -1 To-Hit'
      ]
    },
    'Tama-ire': {
      cost:      5,
      damage:    '1d3',
      critical:  '1',
      distance:  '12"',
      modifiers: [
        '[R] 12" 30° AOE cone',
        '[P] May damage stone & metal'
      ]
    }
  };

  // ==================================================================
  // HULL STATS BY DIMENSION (Mokuzo Hansen)
  // ==================================================================
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

  // ==================================================================
  // REASON TAGGING SCAFFOLDING
  // ==================================================================
  const REASON_SUFFIX = {
    asset_mismatch:          ' (mismatch)',
    requires_asset:          ' (requires asset)',
    requires_hull_size:      ' (requires hull size)',
    requires_hull_dimension: ' (requires dimensions)',
    locked:                  ' (locked)'
  };

  function suffixForReasons(reasons) {
    if (!reasons || !reasons.length) return '';
    for (const r of reasons) {
      if (REASON_SUFFIX[r]) return REASON_SUFFIX[r];
    }
    return ' (unavailable)';
  }

  // ==================================================================
  // RUNTIME STORE
  // ==================================================================
  const runtime = {
    originalDimOptions: null,
    originalSizeOptions: null,
    originalDetachmentOptions: null,
    prevAssetName: '',
    detachmentUserSet: false
  };

  // ==================================================================
  // DOM HELPERS
  // ==================================================================
  function supportFieldSelector(fieldId) {
    return '#wpforms-' + FORM_ID_SUPPORT + '-field_' + fieldId;
  }
  function supportFieldContainerSelector(fieldId) {
    return '#wpforms-' + FORM_ID_SUPPORT + '-field_' + fieldId + '-container';
  }
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

  function canonicalLabel(text) {
    if (!text) return '';
    // remove trailing "(...)" suffixes that we append for disabled reasons
    let cleaned = String(text).replace(/\s*\(.*?\)\s*$/, '').trim();
    // normalize accents
    cleaned = cleaned.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return cleaned;
  }

  function getSingleSelectText(fieldId) {
    const select = $(supportFieldSelector(fieldId));
    if (!select) return '';
    const opt = select.options[select.selectedIndex];
    return opt ? String(opt.text || '').trim() : '';
  }

  function getSingleSelectValue(fieldId) {
    const select = $(supportFieldSelector(fieldId));
    if (!select) return '';
    const opt = select.options[select.selectedIndex];
    return opt ? String(opt.value || '').trim() : '';
  }

  function setSelectPlaceholder(fieldId) {
    const select = $(supportFieldSelector(fieldId));
    if (!select) return;
    select.selectedIndex = 0;
  }

  function setSelectByText(fieldId, re) {
    const select = $(supportFieldSelector(fieldId));
    if (!select) return false;
    for (let i = 0; i < select.options.length; i++) {
      const t = String(select.options[i].text || '').trim();
      if (re.test(t)) {
        select.selectedIndex = i;
        return true;
      }
    }
    return false;
  }

  function captureSelectOptionsOnce(fieldId, slotName) {
    const sel = $(supportFieldSelector(fieldId));
    if (!sel) return;
    if (runtime[slotName]) return;
    runtime[slotName] = Array.from(sel.options).map(o => ({
      value: String(o.value || ''),
      text: String(o.text || '')
    }));
  }

  function formatInches(raw) {
    if (!raw) return raw;
    const trimmed = String(raw).trim();
    if (/^\d+$/.test(trimmed)) return trimmed + '"';
    return trimmed;
  }

  // ==================================================================
  // REF ID BEHAVIOR (NO CUSTOM ERRORS, NO BLOCKING)
  // - WPForms owns required/unique/etc.
  // - We only normalize to uppercase (convenience)
  // ==================================================================
  function getRefIdInput() {
    return $(supportFieldSelector(FIELD_ID_REF_SUPPORT));
  }

  function normalizeRefIdUppercase() {
    const input = getRefIdInput();
    if (!input) return true;
    const raw = String(input.value || '').trim();
    const up  = raw.toUpperCase();
    if (raw && raw !== up) input.value = up;
    return true;
  }

  // ==================================================================
  // HULL / DIMENSION PARSING + COMPUTE
  // ==================================================================
  function parseHullLabel(label) {
    if (!label) return null;
    const m = String(label).match(/(\d+)\s*[×x]\s*(\d+)/i);
    if (!m) return null;
    return { width: parseInt(m[1], 10), length: parseInt(m[2], 10) };
  }

  function normalizeHullKey(label) {
    return String(label || '')
      .replace(/\s+/g, '')
      .replace(/[×x]/, 'x')
      .toLowerCase();
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
    const key  = normalizeHullKey(width + 'x' + length);
    const base = HULL_STATS_BY_DIMENSION[key];
    if (!base) return null;

    const category = getCategoryFromWidth(width);

    const movementByCategory = {
      Medium: 6, Large: 6, Huge: 5, Gargantuan: 5, Colossal: 4
    };
    const operatorsByCategory = {
      Medium: 1, Large: 2, Huge: 3, Gargantuan: 4, Colossal: 5
    };

    return {
      width,
      length,
      bases: width * length,
      category,
      toughness: base.body,
      movement: movementByCategory[category] || 4,
      operators: operatorsByCategory[category] || 1,
      cost: base.cost
    };
  }

  // ==================================================================
  // READ CURRENT STATE
  // ==================================================================
  function readCurrentState() {
    const assetName = canonicalLabel(getSingleSelectText(FIELD_ID_ASSET_TYPE));

    const hullSizeLabelRaw = getSingleSelectText(FIELD_ID_VESSEL_SIZE);
    const hullSizeLabel = canonicalLabel(hullSizeLabelRaw);
    const hullSizeCategory = (hullSizeLabel.split(/\s+/)[0] || '').trim();

    const dimLabelRaw = getSingleSelectText(FIELD_ID_VESSEL_DIM);
    const dimValue = getSingleSelectValue(FIELD_ID_VESSEL_DIM);
    const dimLabel = (dimValue && !/^select\b/i.test(dimLabelRaw || '')) ? String(dimLabelRaw || '').trim() : '';

    const detachmentValue = getSingleSelectValue(FIELD_ID_DETACHMENT);
    const detachmentLabelRaw = getSingleSelectText(FIELD_ID_DETACHMENT);
    const detachmentMode = detachmentValue ? canonicalLabel(detachmentLabelRaw) : '';

    const muniWrap = $(supportFieldSelector(FIELD_ID_MUNITIONS));
    const selectedMunitions = muniWrap
      ? $all(supportFieldSelector(FIELD_ID_MUNITIONS) + ' input[type="checkbox"]:checked')
          .map(cb => String(cb.value || '').trim())
          .filter(Boolean)
      : [];

    return {
      assetName,
      hullSizeCategory,
      dimLabel,
      dimValue,
      detachmentMode,
      detachmentUserSet: runtime.detachmentUserSet,
      selectedMunitions
    };
  }

  // ==================================================================
  // BUILD UI MODEL
  // ==================================================================
  function buildUiModel(state, ctx) {
    const assetName = state.assetName;
    const isOzutsu = assetName === 'Ozutsu';
    const isMokuzo = assetName === 'Mokuzo Hansen';

    // Field visibility
    const fields = {
      vesselSize: { visible: isMokuzo, disabled: !isMokuzo, locked: false, reasons: !isMokuzo ? ['asset_mismatch'] : [] },
      vesselDim:  { visible: isMokuzo, disabled: !isMokuzo, locked: false, reasons: !isMokuzo ? ['asset_mismatch'] : [] },
      detachment: { visible: isOzutsu, disabled: !isOzutsu, locked: false, reasons: !isOzutsu ? ['asset_mismatch'] : [] },
      munitions:  { visible: isOzutsu, disabled: !isOzutsu, locked: false, reasons: !isOzutsu ? ['asset_mismatch'] : [] },
      crewHtml:   { visible: isOzutsu } // NEW: crew block visible only for Ozutsu
    };

    // Dropdowns option models
    const dropdowns = { vesselSize: {}, vesselDim: {}, detachment: {} };
    const sizeBase = runtime.originalSizeOptions || [];
    const dimBase  = runtime.originalDimOptions || [];
    const detBase  = runtime.originalDetachmentOptions || [];

    // Vessel Size options (mostly pass-through)
    sizeBase.forEach(o => {
      const isPlaceholder = !o.value || /^select\b/i.test(String(o.text || '').trim());
      dropdowns.vesselSize[o.value] = {
        value: o.value,
        baseText: o.text,
        visible: fields.vesselSize.visible,
        disabled: fields.vesselSize.disabled,
        reasons: fields.vesselSize.disabled ? fields.vesselSize.reasons.slice() : (isPlaceholder ? [] : [])
      };
    });

    // Vessel Dim options:
    const hullSizeChosen = isMokuzo && !!state.hullSizeCategory;

    dimBase.forEach(o => {
      const txt = String(o.text || '');
      const val = String(o.value || '');
      const isPlaceholder = !val || /^select\b/i.test(txt.trim());

      if (isPlaceholder) {
        dropdowns.vesselDim[val] = {
          value: val,
          baseText: txt,
          visible: fields.vesselDim.visible || isOzutsu,
          disabled: fields.vesselDim.disabled,
          reasons: fields.vesselDim.disabled ? fields.vesselDim.reasons.slice() : []
        };
        return;
      }

      // Ozutsu special allowed dimension: 1×2
      const isOzutsuDim = isOzutsu && /1\s*[×x]\s*2/i.test(txt);

      let visible = false;
      let disabled = false;
      let reasons = [];

      if (isOzutsuDim) {
        visible = true;
        disabled = false;
        reasons = [];
      } else if (!isMokuzo) {
        visible = false;
        disabled = true;
        reasons = ['asset_mismatch'];
      } else if (!hullSizeChosen) {
        visible = false;
        disabled = true;
        reasons = ['requires_hull_size'];
      } else {
        const dims = parseHullLabel(txt);
        if (dims) {
          const category = getCategoryFromWidth(dims.width);
          visible = (category === state.hullSizeCategory);
          disabled = false;
          reasons = visible ? [] : ['requires_hull_size'];
        }
      }

      dropdowns.vesselDim[val] = {
        value: val,
        baseText: txt,
        visible: fields.vesselDim.visible ? visible : isOzutsuDim,
        disabled: fields.vesselDim.disabled ? true : disabled,
        reasons: fields.vesselDim.disabled ? fields.vesselDim.reasons.slice() : reasons
      };
    });

    // Detachment options
    detBase.forEach(o => {
      const isPlaceholder = !o.value || /^select\b/i.test(String(o.text || '').trim());
      dropdowns.detachment[o.value] = {
        value: o.value,
        baseText: o.text,
        visible: fields.detachment.visible,
        disabled: fields.detachment.disabled,
        reasons: fields.detachment.disabled ? fields.detachment.reasons.slice() : (isPlaceholder ? [] : [])
      };
    });

    // Hull stats (Mokuzo only when a valid dim is chosen)
    let hullStats = null;
    if (isMokuzo && state.dimLabel) {
      const dims = parseHullLabel(state.dimLabel);
      if (dims) hullStats = computeHullStats(dims.width, dims.length);
    }

    // Munitions option models
    const munitionsOptions = {};
    Object.keys(MUNITIONS_DATA).forEach(name => {
      const allowed = isOzutsu;
      munitionsOptions[name] = {
        value: name,
        baseText: name,
        visible: fields.munitions.visible && allowed,
        disabled: fields.munitions.disabled || !allowed,
        reasons: !allowed ? ['asset_mismatch'] : (fields.munitions.disabled ? fields.munitions.reasons.slice() : [])
      };
    });

    const selectedMunitions = isOzutsu ? state.selectedMunitions : [];

    // Detachment display-only
    const detachmentApplied = isOzutsu && state.detachmentUserSet && !!state.detachmentMode;

    // Weapon stats
    let weaponStats = { damage: '--', critical: '--', distance: '--' };
    if (isOzutsu) {
      if (!selectedMunitions.length) {
        weaponStats = { damage: '--', critical: '--', distance: '--' };
      } else if (selectedMunitions.length > 1) {
        weaponStats = { damage: 'Variable', critical: 'Variable', distance: 'Variable' };
      } else {
        const def = MUNITIONS_DATA[selectedMunitions[0]];
        weaponStats = def
          ? { damage: def.damage || '--', critical: def.critical || '--', distance: def.distance || '--' }
          : { damage: '--', critical: '--', distance: '--' };
      }
    }

    // Cost
    const munitionsCost = isOzutsu
      ? selectedMunitions.reduce((sum, name) => sum + ((MUNITIONS_DATA[name] && MUNITIONS_DATA[name].cost) || 0), 0)
      : 0;

    let baseCost = 0;
    if (assetName) {
      const stats = SUPPORT_ASSET_STATS[assetName] || {};
      if (isMokuzo) {
        baseCost = (hullStats && typeof hullStats.cost === 'number') ? hullStats.cost : 0;
      } else {
        baseCost = (typeof stats.cost === 'number') ? stats.cost : 0;
      }
    }

    const totalCost = baseCost + munitionsCost;

    // Core stat panel
    const baseStats = SUPPORT_ASSET_STATS[assetName] || null;
    let panelStats = { attack: '--', resistance: '--', movement: '--', toughness: '--', leadership: '--', initiative: '--' };

    if (baseStats) {
      panelStats.attack     = baseStats.attack     || '--';
      panelStats.resistance = baseStats.resistance || '--';
      panelStats.leadership = baseStats.leadership || '--';
      panelStats.initiative = baseStats.initiative || '--';

      if (isMokuzo) {
        panelStats.movement  = hullStats ? formatInches(hullStats.movement) : '--';
        panelStats.toughness = hullStats ? String(hullStats.toughness) : '--';
      } else {
        panelStats.movement  = baseStats.movement ? formatInches(baseStats.movement) : '--';
        panelStats.toughness = baseStats.toughness || '--';
      }

      if (detachmentApplied) {
        if (state.detachmentMode === 'Single Unit') {
          panelStats.attack = '1';
          panelStats.movement = '2"';
        } else if (state.detachmentMode === 'Two Units') {
          panelStats.attack = '2';
          panelStats.movement = '4"';
        }
      }
    }

    // Summary
    const meta = SUPPORT_ASSET_META[assetName] || null;

    let summary = {
      name: assetName ? assetName : 'Select a Support Asset',
      description: assetName
        ? (meta && meta.shortDescription ? meta.shortDescription : 'Support asset ready to be deployed in your scenarios.')
        : 'Choose the asset to see its stats, cost, and special rules.',
      sizeText: '--',
      imageSrc: SUPPORT_ASSET_IMAGES[assetName] || SUPPORT_ASSET_IMAGES.default || ''
    };

    if (!assetName) {
      summary.sizeText = '--';
      summary.imageSrc = SUPPORT_ASSET_IMAGES.default || '';
    } else if (isMokuzo) {
      summary.sizeText = hullStats ? hullStats.category : '--';
    } else {
      summary.sizeText = (meta && meta.size) ? meta.size : '--';
    }

    // Modifiers
    let modifiers = [];
    if (assetName) {
      if (isOzutsu) {
        modifiers.push('[P] Neutral Asset');
        selectedMunitions.forEach(name => {
          const def = MUNITIONS_DATA[name];
          if (def && Array.isArray(def.modifiers)) modifiers.push(...def.modifiers);
        });
      } else if (isMokuzo) {
        modifiers = ['[P] Neutral Asset', '[P] Flammable'];
        if (hullStats && hullStats.operators) {
          const opLabel = hullStats.operators === 1 ? 'operator' : 'operators';
          modifiers.push('[P] Requires ' + hullStats.operators + ' ' + opLabel);
        }
      }
    }

    // Training requirements / equipment items
    const trainingReq = !assetName ? ['None'] : (isOzutsu ? ['Kayakujutsu'] : (isMokuzo ? ['Suieijutsu'] : ['None']));
    const equipItems  = !assetName ? ['None'] : (isOzutsu ? (selectedMunitions.length ? selectedMunitions : ['None']) : ['None']);

    // Table filters
    const tables = {
      training: { enabled: !!assetName, assetName },
      rules: { assetName },
      munitions: { showSection: isOzutsu, selected: selectedMunitions }
    };

    // Hidden fields
    const hidden = {
      assetEquipItems: isOzutsu && selectedMunitions.length ? selectedMunitions.join(', ') : ''
    };

    // Patches
    const patch = {
      resetAdvanced: false,
      ensureDetachmentPlaceholder: false,
      setHullSizeToMedium: false,
      autoPickDim1x3: false,
      setOzutsuDefaults: false
    };

    const assetChanged = runtime.prevAssetName !== assetName;

    if (assetChanged) {
      patch.resetAdvanced = true;
      patch.ensureDetachmentPlaceholder = true;
    }

    // Mokuzo defaults
    if ((ctx.isInit || assetChanged) && isMokuzo) {
      if (!state.hullSizeCategory) patch.setHullSizeToMedium = true;
      if (state.hullSizeCategory === 'Medium' && !state.dimLabel) patch.autoPickDim1x3 = true;
    }

    // Ozutsu defaults (Medium + 1×2) for saved entries
    if ((ctx.isInit || assetChanged) && isOzutsu) {
      patch.setOzutsuDefaults = true;
    }

    return {
      ctx,
      state,

      assetName,
      isOzutsu,
      isMokuzo,

      fields,
      dropdowns,
      munitionsOptions,

      summary,
      panelStats,
      weaponStats,
      totalCost,

      modifiers,
      trainingReq,
      equipItems,

      tables,
      hidden,

      patch
    };
  }

  // ==================================================================
  // RENDER HELPERS
  // ==================================================================
  function renderSelectFromOptionModel(fieldId, optionModels, preserveValue) {
    const sel = $(supportFieldSelector(fieldId));
    if (!sel) return;

    const prev = preserveValue ? String(sel.value || '') : '';

    sel.innerHTML = '';
    optionModels.forEach(o => {
      if (!o.visible) return;
      const label = (o.baseText || '') + (o.disabled ? suffixForReasons(o.reasons) : '');
      const optEl = new Option(label, o.value);
      optEl.disabled = !!o.disabled;
      sel.add(optEl);
    });

    if (prev && optionModels.some(o => o.visible && String(o.value) === prev)) {
      sel.value = prev;
    } else {
      sel.selectedIndex = 0;
    }
  }

  function renderCheckboxGroupFromModel(fieldId, optionModels) {
    const wrap = $(supportFieldSelector(fieldId));
    if (!wrap) return;

    const inputs = $all(supportFieldSelector(fieldId) + ' input[type="checkbox"]');

    inputs.forEach(input => {
      const val = String(input.value || '').trim();
      const model = optionModels[val];
      if (!model) return;

      const li = input.closest('li');
      const label = li ? li.querySelector('label') : null;

      if (li) li.style.display = model.visible ? '' : 'none';

      input.disabled = !!model.disabled;
      if (model.disabled && input.checked) input.checked = false;

      if (label) {
        const base = model.baseText || label.textContent || '';
        label.textContent = base + (model.disabled ? suffixForReasons(model.reasons) : '');
      }
    });
  }

  function renderFieldVisibility(model) {
    const sizeContainer = $(supportFieldContainerSelector(FIELD_ID_VESSEL_SIZE));
    const dimContainer  = $(supportFieldContainerSelector(FIELD_ID_VESSEL_DIM));
    const detContainer  = $(supportFieldContainerSelector(FIELD_ID_DETACHMENT));
    const muniContainer =
      $(supportFieldContainerSelector(FIELD_ID_MUNITIONS)) ||
      $(supportFieldSelector(FIELD_ID_MUNITIONS));

    if (sizeContainer) sizeContainer.style.display = model.fields.vesselSize.visible ? '' : 'none';
    if (dimContainer)  dimContainer.style.display  = model.fields.vesselDim.visible  ? '' : 'none';
    if (detContainer)  detContainer.style.display  = model.fields.detachment.visible ? '' : 'none';
    if (muniContainer) muniContainer.style.display = model.fields.munitions.visible  ? '' : 'none';

    const sizeSelect = $(supportFieldSelector(FIELD_ID_VESSEL_SIZE));
    const dimSelect  = $(supportFieldSelector(FIELD_ID_VESSEL_DIM));
    const detSelect  = $(supportFieldSelector(FIELD_ID_DETACHMENT));

    if (sizeSelect) sizeSelect.disabled = !!model.fields.vesselSize.disabled || !!model.fields.vesselSize.locked;
    if (dimSelect)  dimSelect.disabled  = !!model.fields.vesselDim.disabled  || !!model.fields.vesselDim.locked;
    if (detSelect)  detSelect.disabled  = !!model.fields.detachment.disabled || !!model.fields.detachment.locked;

    }

  function renderDropdowns(model) {
    // Vessel Size
    const sizeOptionList = Object.values(model.dropdowns.vesselSize)
      .sort((a, b) => {
        const ap = (!a.value || /^select\b/i.test((a.baseText || '').trim())) ? 0 : 1;
        const bp = (!b.value || /^select\b/i.test((b.baseText || '').trim())) ? 0 : 1;
        return ap - bp;
      })
      .map(o => ({ value: o.value, baseText: o.baseText, visible: o.visible, disabled: o.disabled, reasons: o.reasons || [] }));

    renderSelectFromOptionModel(FIELD_ID_VESSEL_SIZE, sizeOptionList, true);

    // Vessel Dim
    const dimOptionList = Object.values(model.dropdowns.vesselDim)
      .sort((a, b) => {
        const ap = (!a.value || /^select\b/i.test((a.baseText || '').trim())) ? 0 : 1;
        const bp = (!b.value || /^select\b/i.test((b.baseText || '').trim())) ? 0 : 1;
        return ap - bp;
      })
      .map(o => ({ value: o.value, baseText: o.baseText, visible: o.visible, disabled: o.disabled, reasons: o.reasons || [] }));

    renderSelectFromOptionModel(FIELD_ID_VESSEL_DIM, dimOptionList, true);

    // Detachment
    const detOptionList = Object.values(model.dropdowns.detachment)
      .sort((a, b) => {
        const ap = (!a.value || /^select\b/i.test((a.baseText || '').trim())) ? 0 : 1;
        const bp = (!b.value || /^select\b/i.test((b.baseText || '').trim())) ? 0 : 1;
        return ap - bp;
      })
      .map(o => ({ value: o.value, baseText: o.baseText, visible: o.visible, disabled: o.disabled, reasons: o.reasons || [] }));

    renderSelectFromOptionModel(FIELD_ID_DETACHMENT, detOptionList, true);
  }

  function renderMunitionsOptions(model) {
    renderCheckboxGroupFromModel(FIELD_ID_MUNITIONS, model.munitionsOptions);
  }

  function renderSummary(model) {
    const nameEl = document.getElementById('shoshin-support-name');
    const imgEl  = document.getElementById('shoshin-support-image');
    const descEl = document.getElementById('shoshin-support-description');
    const sizeEl = document.getElementById('shoshin-support-type');

    if (nameEl) nameEl.textContent = model.summary.name;
    if (descEl) descEl.textContent = model.summary.description;
    if (sizeEl) sizeEl.textContent = model.summary.sizeText;
    if (imgEl)  imgEl.src = model.summary.imageSrc || '';
  }

  function renderCoreStats(model) {
    const atkEl   = document.getElementById('shoshin-stat-attack');
    const resEl   = document.getElementById('shoshin-stat-resistance');
    const movEl   = document.getElementById('shoshin-stat-movement');
    const toughEl = document.getElementById('shoshin-stat-toughness');
    const ldrEl   = document.getElementById('shoshin-stat-leadership');
    const iniEl   = document.getElementById('shoshin-stat-initiative');
    if (!atkEl || !resEl || !movEl || !toughEl || !ldrEl || !iniEl) return;

    atkEl.textContent   = model.panelStats.attack;
    resEl.textContent   = model.panelStats.resistance;
    movEl.textContent   = model.panelStats.movement;
    toughEl.textContent = model.panelStats.toughness;
    ldrEl.textContent   = model.panelStats.leadership;
    iniEl.textContent   = model.panelStats.initiative;
  }

  function renderWeaponStats(model) {
    const rdEl = document.getElementById('shoshin-support-ranged-dmg');
    const rcEl = document.getElementById('shoshin-support-ranged-crit');
    const rrEl = document.getElementById('shoshin-support-ranged-dist');
    if (!rdEl || !rcEl || !rrEl) return;

    rdEl.textContent = model.weaponStats.damage;
    rcEl.textContent = model.weaponStats.critical;
    rrEl.textContent = model.weaponStats.distance;
  }

  function renderCost(model) {
    const costEl = document.getElementById('shoshin-support-cost');
    if (!costEl) return;
    costEl.textContent = model.totalCost > 0 ? String(model.totalCost) : '--';
  }

  function renderTwoColumnList(col1Id, col2Id, items) {
    const col1 = document.getElementById(col1Id);
    const col2 = document.getElementById(col2Id);
    if (!col1 || !col2) return;

    col1.innerHTML = '';
    col2.innerHTML = '';

    const list = (items && items.length) ? items : ['None'];
    const mid = Math.ceil(list.length / 2);

    list.slice(0, mid).forEach(t => {
      const li = document.createElement('li');
      li.textContent = t;
      col1.appendChild(li);
    });

    list.slice(mid).forEach(t => {
      const li = document.createElement('li');
      li.textContent = t;
      col2.appendChild(li);
    });
  }

  function renderModifiers(model) {
    const col1 = document.getElementById('shoshin-support-modifiers-col1');
    const col2 = document.getElementById('shoshin-support-modifiers-col2');
    if (!col1 || !col2) return;

    col1.innerHTML = '';
    col2.innerHTML = '';

    if (!model.assetName) {
      const li = document.createElement('li');
      li.textContent = 'None';
      col1.appendChild(li);
      return;
    }

    const mods = (model.modifiers && model.modifiers.length) ? model.modifiers : ['None'];
    const mid = Math.ceil(mods.length / 2);

    mods.slice(0, mid).forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      col1.appendChild(li);
    });

    mods.slice(mid).forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      col2.appendChild(li);
    });
  }

  function renderTrainingRequirements(model) {
    renderTwoColumnList('shoshin-support-training-req-col1', 'shoshin-support-training-req-col2', model.trainingReq);
  }

  function renderEquipmentItems(model) {
    renderTwoColumnList('shoshin-support-equipment-items-col1', 'shoshin-support-equipment-items-col2', model.equipItems);
  }

  function renderRulesTable(model) {
    const table = document.getElementById('shoshin-support-rules-table');
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const asset = String(row.dataset.asset || '');
      if (!model.tables.rules.assetName) row.style.display = '';
      else row.style.display = (asset === model.tables.rules.assetName) ? '' : 'none';
    });
  }

  function renderTrainingTable(model) {
    const table    = document.getElementById('shoshin-support-training-table');
    const emptyMsg = document.getElementById('shoshin-support-training-empty');
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');

    if (!model.tables.training.enabled) {
      rows.forEach(r => { r.style.display = 'none'; });
      if (emptyMsg) emptyMsg.style.display = 'none';
      return;
    }

    let visibleCount = 0;

    rows.forEach(row => {
      const assetsAttr = String(row.dataset.supportAssets || '');
      const allowedAssets = assetsAttr.split(',').map(s => s.trim()).filter(Boolean);
      const show = !allowedAssets.length || allowedAssets.includes(model.tables.training.assetName);
      row.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });

    if (emptyMsg) emptyMsg.style.display = (visibleCount === 0) ? '' : 'none';
  }

  function renderMunitionsSectionAndTable(model) {
    const section  = document.getElementById('shoshin-munitions-section');
    const table    = document.getElementById('shoshin-munitions-table');
    const emptyMsg = document.getElementById('shoshin-munitions-empty');

    if (section) section.style.display = model.tables.munitions.showSection ? '' : 'none';
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');

    if (!model.tables.munitions.showSection) {
      rows.forEach(r => { r.style.display = 'none'; });
      if (emptyMsg) emptyMsg.style.display = 'none';
      return;
    }

    const selected = model.tables.munitions.selected || [];
    if (!selected.length) {
      rows.forEach(r => { r.style.display = 'none'; });
      if (emptyMsg) emptyMsg.style.display = 'inline';
      return;
    }

    rows.forEach(row => {
      const name = String(row.dataset.munition || '').trim();
      row.style.display = selected.includes(name) ? '' : 'none';
    });

    if (emptyMsg) emptyMsg.style.display = 'none';
  }

  function renderHiddenFields(model) {
    const equipHidden = $(supportFieldSelector(FIELD_ID_ASSET_EQUIP_ITEMS));
    if (equipHidden) equipHidden.value = model.hidden.assetEquipItems || '';
  }

  // ==================================================================
  // APPLY PATCHES (controlled DOM mutations)
  // ==================================================================
  function applyStatePatch(model) {
    const patch = model.patch || {};
    let mutated = false;

    if (patch.resetAdvanced) {
      setSelectPlaceholder(FIELD_ID_VESSEL_SIZE);
      setSelectPlaceholder(FIELD_ID_VESSEL_DIM);

      const muniWrap = $(supportFieldSelector(FIELD_ID_MUNITIONS));
      if (muniWrap) {
        $all(supportFieldSelector(FIELD_ID_MUNITIONS) + ' input[type="checkbox"]').forEach(cb => {
          if (cb.checked) cb.checked = false;
        });
      }

      setSelectPlaceholder(FIELD_ID_DETACHMENT);
      runtime.detachmentUserSet = false;
      mutated = true;
    }

    if (patch.ensureDetachmentPlaceholder && model.isOzutsu) {
      setSelectPlaceholder(FIELD_ID_DETACHMENT);
      runtime.detachmentUserSet = false;
      mutated = true;
    }

    // Mokuzo default hull size: Medium
    if (patch.setHullSizeToMedium && model.isMokuzo) {
      const ok = setSelectByText(FIELD_ID_VESSEL_SIZE, /^medium\b/i);
      if (ok) mutated = true;
    }

    // Mokuzo default dim: 1×3 (only if empty)
    if (patch.autoPickDim1x3 && model.isMokuzo) {
      const dimVal = getSingleSelectValue(FIELD_ID_VESSEL_DIM);
      if (!dimVal) {
        const ok = setSelectByText(FIELD_ID_VESSEL_DIM, /1\s*[×x]\s*3/i);
        if (ok) mutated = true;
      }
    }

    // Ozutsu defaults for saving: Hull Size Medium + Dim 1×2 (if exists)
    if (patch.setOzutsuDefaults && model.isOzutsu) {
      const okSize = setSelectByText(FIELD_ID_VESSEL_SIZE, /^medium\b/i);

      const dimVal = getSingleSelectValue(FIELD_ID_VESSEL_DIM);
      let okDim = false;
      if (!dimVal) {
        okDim = setSelectByText(FIELD_ID_VESSEL_DIM, /1\s*[×x]\s*2/i);
      }

      if (okSize || okDim) mutated = true;
    }

    return mutated;
  }

  // ==================================================================
  // RECOMPUTE (single orchestrator)
  // ==================================================================
  function recomputeAll(ctx) {
    ctx = ctx || {};
    for (let pass = 0; pass < 3; pass++) {
      const state = readCurrentState();
      const model = buildUiModel(state, ctx);

      const mutated = applyStatePatch(model);

      renderFieldVisibility(model);

      // Dropdowns
      const sizeOptionList = Object.values(model.dropdowns.vesselSize)
        .sort((a, b) => {
          const ap = (!a.value || /^select\b/i.test((a.baseText || '').trim())) ? 0 : 1;
          const bp = (!b.value || /^select\b/i.test((b.baseText || '').trim())) ? 0 : 1;
          return ap - bp;
        })
        .map(o => ({ value: o.value, baseText: o.baseText, visible: o.visible, disabled: o.disabled, reasons: o.reasons || [] }));
      renderSelectFromOptionModel(FIELD_ID_VESSEL_SIZE, sizeOptionList, true);

      const dimOptionList = Object.values(model.dropdowns.vesselDim)
        .sort((a, b) => {
          const ap = (!a.value || /^select\b/i.test((a.baseText || '').trim())) ? 0 : 1;
          const bp = (!b.value || /^select\b/i.test((b.baseText || '').trim())) ? 0 : 1;
          return ap - bp;
        })
        .map(o => ({ value: o.value, baseText: o.baseText, visible: o.visible, disabled: o.disabled, reasons: o.reasons || [] }));
      renderSelectFromOptionModel(FIELD_ID_VESSEL_DIM, dimOptionList, true);

      const detOptionList = Object.values(model.dropdowns.detachment)
        .sort((a, b) => {
          const ap = (!a.value || /^select\b/i.test((a.baseText || '').trim())) ? 0 : 1;
          const bp = (!b.value || /^select\b/i.test((b.baseText || '').trim())) ? 0 : 1;
          return ap - bp;
        })
        .map(o => ({ value: o.value, baseText: o.baseText, visible: o.visible, disabled: o.disabled, reasons: o.reasons || [] }));
      renderSelectFromOptionModel(FIELD_ID_DETACHMENT, detOptionList, true);

      // Munitions option labeling/hide/disable
      renderMunitionsOptions(model);

      // Summary + panels
      renderSummary(model);
      renderCoreStats(model);
      renderWeaponStats(model);
      renderCost(model);

      // Lists + tables
      renderTrainingRequirements(model);
      renderEquipmentItems(model);
      renderModifiers(model);
      renderRulesTable(model);
      renderTrainingTable(model);
      renderMunitionsSectionAndTable(model);

      // Hidden fields
      renderHiddenFields(model);

      // Commit prev asset
      runtime.prevAssetName = model.assetName;

      if (!mutated) break;
      ctx = Object.assign({}, ctx, { isInit: false });
    }
  }

  // ==================================================================
  // INIT + EVENTS
  // ==================================================================
  function initShoshinSupportAssetTool() {
    const formEl = document.getElementById('wpforms-form-' + FORM_ID_SUPPORT);
    if (!formEl) return;

    // Set Game System if blank
    const gameSystemInput = $(supportFieldSelector(FIELD_ID_GAME_SYSTEM));
    if (gameSystemInput && !gameSystemInput.value) {
      gameSystemInput.value = 'Shoshin: The Path of Ascension';
    }

    // Capture original options once
    captureSelectOptionsOnce(FIELD_ID_VESSEL_DIM, 'originalDimOptions');
    captureSelectOptionsOnce(FIELD_ID_VESSEL_SIZE, 'originalSizeOptions');
    captureSelectOptionsOnce(FIELD_ID_DETACHMENT, 'originalDetachmentOptions');

    // Init runtime
    runtime.detachmentUserSet = false;
    runtime.prevAssetName = canonicalLabel(getSingleSelectText(FIELD_ID_ASSET_TYPE));

    // Initial normalize + render
    normalizeRefIdUppercase();
    recomputeAll({ isInit: true });

    // REF ID normalize events (no custom validation)
    const refInput = getRefIdInput();
    if (refInput) {
      refInput.addEventListener('input', normalizeRefIdUppercase);
      refInput.addEventListener('blur', normalizeRefIdUppercase);
    }

    // Asset type change
    const typeSelect = $(supportFieldSelector(FIELD_ID_ASSET_TYPE));
    if (typeSelect) {
      typeSelect.addEventListener('change', function () {
        runtime.detachmentUserSet = false;
        recomputeAll({ isInit: false });
      });
    }

    // Hull size change
    const hullSizeSelect = $(supportFieldSelector(FIELD_ID_VESSEL_SIZE));
    if (hullSizeSelect) {
      hullSizeSelect.addEventListener('change', function () {
        recomputeAll({ isInit: false });
      });
    }

    // Dimensions change
    const dimSelect = $(supportFieldSelector(FIELD_ID_VESSEL_DIM));
    if (dimSelect) {
      dimSelect.addEventListener('change', function () {
        recomputeAll({ isInit: false });
      });
    }

    // Munitions change (delegate)
    const muniWrap = $(supportFieldSelector(FIELD_ID_MUNITIONS));
    if (muniWrap) {
      muniWrap.addEventListener('change', function (e) {
        const t = e && e.target;
        if (t && t.matches && t.matches('input[type="checkbox"]')) {
          recomputeAll({ isInit: false });
        }
      });
    }

    // Detachment change
    const detSelect = $(supportFieldSelector(FIELD_ID_DETACHMENT));
    if (detSelect) {
      detSelect.addEventListener('change', function () {
        runtime.detachmentUserSet = true;
        recomputeAll({ isInit: false });
      });
    }
  }

  initShoshinSupportAssetTool();
});
