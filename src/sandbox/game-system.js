/* =======================================================================================================================
BEGIN SHOSHIN GAME SYSTEM RENDERER (MVP)
- Renders /game-system compendium into #shoshin-game-system
- Tier 1 + Tier 2 filters (no search)
- Characters: profile card + weapon row placeholder (two halves) + base stats + abilities table + MC abilities table
- Yokai: profile card + attack stats row + base stats (+ abilities text block) and NO MC row; cost hidden
- Armory/Dojo: inject authoritative HTML tables
- Tables: stub (Table 1–5 last)
======================================================================================================================= */

(function () {
  "use strict";

  // Only run where the shortcode exists
  var root = document.getElementById("shoshin-game-system");
  if (!root) return;

  var contentEl = document.getElementById("shoshin-gs-content");
  var tier1Bar = root.querySelector(".shoshin-gs-tier1");
  var tier2Bar = root.querySelector(".shoshin-gs-tier2");
  // Mobile dropdowns removed (per design)


  // -------------------------------------------------------------------------------------------------------------------
  // DATA (Characters from create-character.js structures; Yokai + Master Class Abilities from CSV exports)
  // HTML tables take precedence for armory/dojos/abilities display.
  // -------------------------------------------------------------------------------------------------------------------

  // Characters — extracted from create-character.js (static, safe)
  var CLASS_IMAGES = {
    default: "/wp-content/uploads/2025/12/Helmet-grey.jpg",
    Daimyo: "/wp-content/uploads/2025/12/Daimyo.jpg",
    Samurai: "/wp-content/uploads/2025/12/Samurai.jpg",
    Ashigaru: "/wp-content/uploads/2025/12/Ashigaru.jpg",
    Sohei: "/wp-content/uploads/2025/12/Sohei.jpg",
    Ninja: "/wp-content/uploads/2025/12/Ninja.jpg",
    Onmyoji: "/wp-content/uploads/2025/12/Onmyoji.jpg"
  };

  var CLASS_META = {
    Daimyo:  { size: "Medium", description: "<em>Clan Lord</em>" },
    Samurai: { size: "Medium", description: "<em>Military Noble</em>" },
    Ashigaru:{ size: "Medium", description: "<em>Foot Soldier</em>" },
    Sohei:   { size: "Medium", description: "<em>Warrior Monk</em>" },
    Ninja:   { size: "Medium", description: "<em>Shadow Operative</em>" },
    Onmyoji: { size: "Medium", description: "<em>Mystic Diviner</em>" }
  };

  var CLASS_BASE_STATS = {
    Daimyo:  { attack: 3, defense: 2, movement: 4, body: 4, leadership: 4, initiative: 3, cost: 20 },
    Samurai: { attack: 3, defense: 2, movement: 4, body: 3, leadership: 2, initiative: 3, cost: 15 },
    Ashigaru:{ attack: 2, defense: 2, movement: 4, body: 2, leadership: 1, initiative: 2, cost: 10 },
    Sohei:   { attack: 3, defense: 2, movement: 4, body: 3, leadership: 1, initiative: 2, cost: 14 },
    Ninja:   { attack: 2, defense: 2, movement: 5, body: 2, leadership: 1, initiative: 4, cost: 14 },
    Onmyoji: { attack: 1, defense: 2, movement: 4, body: 2, leadership: 2, initiative: 3, cost: 16 }
  };

  // Class abilities list per class (ability names), used to FILTER the authoritative abilities HTML table.
  // Note: these must match the "data-ability" names in the abilities table template.
  var CLASS_RULES = {
    Daimyo:  { abilities: ["Divine Inspiration", "Rally"] },
    Samurai: { abilities: ["Rally"] },
    Ashigaru:{ abilities: ["Rally"] },
    Sohei:   { abilities: ["Rally"] },
    Ninja:   { abilities: ["Assassinate"] },
    Onmyoji: { abilities: ["Divine Inspiration"] }
  };

  // Support Assets (for Artillery + Sailing Ships info tables)
  var SUPPORT_ASSET_IMAGES = {
    default: "/wp-content/uploads/2025/12/Helmet-grey.jpg",
    Ozutsu: "/wp-content/uploads/2025/12/cannon.jpeg",
    "Mokuzo Hansen": "/wp-content/uploads/2025/12/makuzo.jpeg"
  };
  var SUPPORT_ASSET_META = {
    Ozutsu: { shortDescription: "Lightweight Cannon", size: "Medium", attributes: "Requires reload after use." },
    "Mokuzo Hansen": { shortDescription: "Wooden Sailing Ship", size: 'Medium – 1" × 6"', attributes: "Transport & board actions (see rules)." }
  };
  var SUPPORT_ASSET_STATS = {
    Ozutsu: { cost: 10 },
    "Mokuzo Hansen": { cost: 12 }
  };

  // Master Class Abilities (from Master Classes-Grid view.csv) — implemented now
  var MASTER_CLASS_ABILITIES = {
    Daimyo: [
      { ability: "Fury of the Rising Sun", effect: "If a melee attack successfully dispatches an enemy, immediately make another melee attack against a different enemy within Engaged range.", cost: "" },
      { ability: "Zen Restoration", effect: "Once per game, whenever the daimyo’s Body is reduced to 0, restore it to 1 instead.", cost: "" }
    ],
    Samurai: [
      { ability: "Arms Master", effect: "Once per round, this unit may take one additional attack action.", cost: "" },
      { ability: "Trancendence", effect: "Critical Misses automatically become Lucky Hits.", cost: "" }
    ],
    Ashigaru: [
      { ability: "Eagle Eye", effect: "Ranged attacks ignore cover / nighttime penalties.", cost: "" },
      { ability: "Volley Fire", effect: "If two or more allied Ashigaru target the same enemy with ranged attacks this round, gain +1 Damage.", cost: "" }
    ],
    Sohei: [
      { ability: "Sacred Vow", effect: "This unit may reroll one saving throw per round.", cost: "" },
      { ability: "Fervent Charge", effect: "When this unit charges, gain +1 Attack until end of activation.", cost: "" }
    ],
    Ninja: [
      { ability: "Shadow Step", effect: "Once per round, move through enemy engagement without triggering reactions.", cost: "" },
      { ability: "Silent Execution", effect: "If attacking from concealment, add +1 Critical for that attack.", cost: "" }
    ],
    Onmyoji: [
      { ability: "Ward of Binding", effect: "Choose an enemy within 6\"; it suffers -1 Movement until end of round.", cost: "" },
      { ability: "Astral Reversal", effect: "Once per game, cancel a single enemy ability effect that targets this unit.", cost: "" }
    ]
  };

  // Yokai (from Yokai-Grid view.csv) — images ignored, static stats used only where not otherwise provided
  var YOKAI_DATA = [
    {
      type: "Oni",
      short1: "Malevolent Demon",
      description: "Towering in stature with grotesque features and horns protruding from their heads, these malevolent beings strike fear into the hearts of mortals.",
      size: "Large",
      base_stats: { attack: "2", defense: 4, movement: '4"', body: 4, leadership: "--", initiative: 2 },
      attack_stats: { melee_damage: "1d2", melee_critical: "Morale Check", melee_distance: "Engaged", ranged_damage: "--", ranged_critical: "--", ranged_distance: "--" },
      abilities_text: "Aura of Fear\nImmunity (Fear)"
    },
    {
      type: "Kitsune",
      short1: "Nine-tailed Fox Spirit",
      description: "These wily fox spirits are renowned for their cunning and magical abilities, often taking on the form of beautiful humans to trick their prey.",
      size: "Medium",
      base_stats: { attack: "1", defense: 5, movement: '6"', body: 2, leadership: "--", initiative: 3 },
      attack_stats: { melee_damage: "Stun", melee_critical: "1", melee_distance: "Engaged", ranged_damage: "--", ranged_critical: "--", ranged_distance: "--" },
      abilities_text: "Uncanny Dodge\nLight-footed\nLuminous Snare"
    },
    {
      type: "Tanuki",
      short1: "Mischievous Raccoon-dog",
      description: "Often depicted as raccoon dogs, they possess a playful nature and are known for their shape-shifting abilities and love of pranks.",
      size: "Small",
      base_stats: { attack: "1", defense: 2, movement: '4"', body: 1, leadership: "--", initiative: 3 },
      attack_stats: { melee_damage: "Stun", melee_critical: "1", melee_distance: "Engaged", ranged_damage: "--", ranged_critical: "--", ranged_distance: "--" },
      abilities_text: "Shapeshift"
    },
    {
      type: "Kappa",
      short1: "Turtle-like Water Demons",
      description: "Mischievous creatures that inhabit watery realms, known for their love of wrestling and their bowl-shaped head that must remain filled with water.",
      size: "Small",
      base_stats: { attack: "1", defense: 2, movement: '3"', body: 1, leadership: "--", initiative: 1 },
      attack_stats: { melee_damage: "1", melee_critical: "1", melee_distance: "Engaged", ranged_damage: "--", ranged_critical: "--", ranged_distance: "--" },
      abilities_text: "Aquatic Assembly\nCollective Cohort\nAquatic Ambush"
    },
    {
      type: "Tengu",
      short1: "Avian Warrior",
      description: "With their enigmatic presence, they add an element of mystery and danger to the landscapes they inhabit.",
      size: "Large",
      base_stats: { attack: "2", defense: 4, movement: '7"', body: 3, leadership: "--", initiative: 4 },
      attack_stats: { melee_damage: "1", melee_critical: "1", melee_distance: "Engaged", ranged_damage: "1", ranged_critical: "1", ranged_distance: '9"' },
      abilities_text: "Flight\nSpread Shot"
    }
    // NOTE: For MVP, remaining Yokai types in your Tier 2 list can be appended here.
  ];

  // -------------------------------------------------------------------------------------------------------------------
  // FILTER DEFINITIONS (Tier 1 + Tier 2)
  // -------------------------------------------------------------------------------------------------------------------

  var TIER2 = {
    Characters: ["Daimyo", "Samurai", "Ashigaru", "Sohei", "Ninja", "Onmyoji"],
    Armory: ["Melee Weapons", "Ranged Weapons", "Armor", "Support Items", "Artillery", "Sailing Ships"],
    Dojo: ["Melee Ryu", "Ranged Ryu", "Specialized Ryu"],
    Yokai: ["Oni", "Kitsune", "Tanuki", "Kappa", "Tengu", "Yurei", "Itsumade", "Ame-Onna", "Nure-onna", "Jubokku", "Tshuchigumo", "Gashadokuro", "Yuki-Onna", "Tokage O No", "Mizuchi"],
    Tables: ["Table 1", "Table 2", "Table 3", "Table 4", "Table 5"]
  };

  var state = { tier1: "Characters", tier2: TIER2.Characters[0] };

  // -------------------------------------------------------------------------------------------------------------------
  // HELPERS
  // -------------------------------------------------------------------------------------------------------------------

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeInches(val) {
    var v = String(val == null ? "" : val).trim();
    if (!v) return "";
    if (v.indexOf('"') !== -1) return v;             // already has inches
    if (/^\d+(\.\d+)?$/.test(v)) return v + '"';     // numeric
    return v;                                        // e.g. "Engaged"
  }

  function clearEl(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function getTpl(id) {
    var tpl = document.getElementById(id);
    if (!tpl || !tpl.content) return null;
    return tpl.content.cloneNode(true);
  }

  function setActiveButtons(bar, key, val) {
    if (!bar) return;
    var btns = bar.querySelectorAll(".shoshin-asset-filter-btn");
    btns.forEach(function (b) {
      var v = b.getAttribute(key);
      if (v === val) b.classList.add("is-active");
      else b.classList.remove("is-active");
    });
  }

  // -------------------------------------------------------------------------------------------------------------------
  // RENDER FILTER BARS
  // -------------------------------------------------------------------------------------------------------------------

  function renderTier2Bar() {
    clearEl(tier2Bar);

    var list = TIER2[state.tier1] || [];
    list.forEach(function (label, idx) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shoshin-asset-filter-btn" + (idx === 0 ? " is-active" : "");
      btn.setAttribute("data-gs-tier2", label);
      btn.textContent = label;
      tier2Bar.appendChild(btn);
    });

    state.tier2 = list[0] || "";

  }

  // -------------------------------------------------------------------------------------------------------------------
  // RENDER: Characters Profile Card
  // -------------------------------------------------------------------------------------------------------------------

  function renderCharacterCard(cls) {
    var meta = CLASS_META[cls] || {};
    var stats = CLASS_BASE_STATS[cls] || {};
    var img = CLASS_IMAGES[cls] || CLASS_IMAGES.default;

    var movement = normalizeInches(stats.movement);

    var abilitiesAllowed = (CLASS_RULES[cls] && CLASS_RULES[cls].abilities) ? CLASS_RULES[cls].abilities : [];

    // Build card skeleton
    var card = document.createElement("div");
    card.className = "shoshin-gs-card";

    // Row 1
    card.innerHTML =
      '<div class="shoshin-gs-row shoshin-gs-row1">' +
        '<div class="shoshin-gs-avatar"><img alt="' + escapeHtml(cls) + '" src="' + escapeHtml(img) + '"></div>' +
        '<div class="shoshin-gs-head">' +
          '<div class="shoshin-gs-type">' + escapeHtml(cls) + '</div>' +
          '<div class="shoshin-gs-desc">' + (meta.description || "") + '</div>' +
          '<div class="shoshin-gs-meta"><span class="label">Size:</span> <span class="value">' + escapeHtml(meta.size || "") + '</span></div>' +
          '<div class="shoshin-gs-meta"><span class="label">Cost:</span> <span class="value">' + escapeHtml(stats.cost != null ? stats.cost : "") + '</span></div>' +
        "</div>" +
      "</div>" +

      // Row 2 Character Profile (6 fields aligned to the 6 base-stat columns)
      '<div class="shoshin-gs-subhead">Character Profile</div>' +
      '<div class="shoshin-gs-statgrid">' +
        statPair("Melee Damage", "See Weapons Table") +
        statPair("Melee Critical", "See Weapons Table") +
        statPair("Melee Distance", "See Weapons Table") +
        statPair("Ranged Damage", "See Weapons Table") +
        statPair("Ranged Critical", "See Weapons Table") +
        statPair("Ranged Distance", "See Weapons Table") +
      "</div>" +

      // Row 3 Base Stats (header removed per design)
      '<div class="shoshin-gs-statgrid">' +
        statPair("Attack", stats.attack) +
        statPair("Defense", stats.defense) +
        statPair("Movement", movement) +
        statPair("Body", stats.body) +
        statPair("Leadership", stats.leadership) +
        statPair("Initiative", stats.initiative) +
      "</div>";


    // Row 4 Character Abilities table (filter authoritative HTML by allowed list)
    var abilitiesWrap = document.createElement("div");
    abilitiesWrap.className = "shoshin-gs-block";
    abilitiesWrap.innerHTML = '<div class="shoshin-gs-subhead">Character Abilities</div>';
    var abilitiesTpl = getTpl("tpl-shoshin-gs-table-abilities");
    if (abilitiesTpl) {
      abilitiesWrap.appendChild(abilitiesTpl);
      var table = abilitiesWrap.querySelector("#shoshin-abilities-table");
      if (table) {
        var rows = table.querySelectorAll("tbody tr");
        var kept = 0;
        rows.forEach(function (tr) {
          var name = tr.getAttribute("data-ability");
          if (abilitiesAllowed.indexOf(name) !== -1) {
            tr.style.display = "";
            kept++;
          } else {
            tr.style.display = "none";
          }
        });
        var empty = abilitiesWrap.querySelector("#shoshin-abilities-empty");
        if (empty) empty.style.display = kept ? "none" : "";
      }
    } else {
      abilitiesWrap.innerHTML += '<div class="shoshin-gs-muted">Abilities table template missing.</div>';
    }

    // Row 5 Master Class Abilities (implemented now)
    var mcWrap = document.createElement("div");
    mcWrap.className = "shoshin-gs-block";
    mcWrap.innerHTML = '<div class="shoshin-gs-subhead">Master Class Abilities</div>';
    mcWrap.appendChild(renderMasterClassTable(cls));

    card.appendChild(abilitiesWrap);
    card.appendChild(mcWrap);

    clearEl(contentEl);
    contentEl.appendChild(card);
  }

  function statPair(label, value) {
    return (
      '<div class="shoshin-gs-stat">' +
        '<div class="k">' + escapeHtml(label) + "</div>" +
        '<div class="v">' + escapeHtml(value == null ? "" : value) + "</div>" +
      "</div>"
    );
  }

  function renderMasterClassTable(cls) {
    var data = MASTER_CLASS_ABILITIES[cls] || [];
    var table = document.createElement("table");
    table.className = "shoshin-table shoshin-gs-mc-table";

    table.setAttribute("style", "width:100%; border-collapse:collapse; font-size:0.8rem;");

    table.innerHTML =
      "<thead><tr>" +
        '<th style="text-align:left;">Ability</th>' +
        '<th style="text-align:left;">Effect</th>' +
        '<th style="width:60px; text-align:center;">Cost</th>' +

      "</tr></thead><tbody></tbody>";

    var tbody = table.querySelector("tbody");
    if (!data.length) {
      var tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="3" style="opacity:0.8;">No master class abilities found.</td>';
      tbody.appendChild(tr);
      return table;
    }

    data.forEach(function (row) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td style="text-align:left;">' + escapeHtml(row.ability) + "</td>" +
        '<td style="text-align:left;">' + escapeHtml(row.effect) + "</td>" +
        "<td>" + escapeHtml(row.cost || "") + "</td>";
      tbody.appendChild(tr);
    });

    return table;
  }

  // -------------------------------------------------------------------------------------------------------------------
  // RENDER: Yokai Profile Card
  // -------------------------------------------------------------------------------------------------------------------

  function findYokai(type) {
    for (var i = 0; i < YOKAI_DATA.length; i++) {
      if (YOKAI_DATA[i].type === type) return YOKAI_DATA[i];
    }
    return null;
  }

  function renderYokaiCard(type) {
    var y = findYokai(type);

    clearEl(contentEl);

    if (!y) {
      contentEl.innerHTML = '<div class="shoshin-gs-muted">Yokai data not found for <strong>' + escapeHtml(type) + "</strong>.</div>";
      return;
    }

    var card = document.createElement("div");
    card.className = "shoshin-gs-card";

    // Row 1
    // Note: images ignored; use default unless you later provide vetted yokai avatars.
    var img = CLASS_IMAGES.default;

    var movement = normalizeInches(y.base_stats.movement);

    card.innerHTML =
      '<div class="shoshin-gs-row shoshin-gs-row1">' +
        '<div class="shoshin-gs-avatar"><img alt="' + escapeHtml(y.type) + '" src="' + escapeHtml(img) + '"></div>' +
        '<div class="shoshin-gs-head">' +
          '<div class="shoshin-gs-type">' + escapeHtml(y.type) + "</div>" +
          '<div class="shoshin-gs-desc"><em>' + escapeHtml(y.short1 || "") + "</em><br>" + escapeHtml(y.description || "") + "</div>" +
          '<div class="shoshin-gs-meta"><span class="label">Size:</span> <span class="value">' + escapeHtml(y.size || "") + "</span></div>" +
          // Cost intentionally hidden (Yokai have none)
        "</div>" +
      "</div>" +

      // Row 2 Attack Stats
      '<div class="shoshin-gs-subhead">Attack Stats</div>' +
      '<div class="shoshin-gs-statgrid">' +
        statPair("Melee Damage", y.attack_stats.melee_damage) +
        statPair("Melee Critical", y.attack_stats.melee_critical) +
        statPair("Melee Distance", normalizeInches(y.attack_stats.melee_distance)) +
        statPair("Ranged Damage", y.attack_stats.ranged_damage) +
        statPair("Ranged Critical", y.attack_stats.ranged_critical) +
        statPair("Ranged Distance", normalizeInches(y.attack_stats.ranged_distance)) +
      "</div>" +

      // Row 3 Base Stats
      '<div class="shoshin-gs-subhead">Base Stats</div>' +
      '<div class="shoshin-gs-statgrid">' +
        statPair("Attack", y.base_stats.attack) +
        statPair("Defense", y.base_stats.defense) +
        statPair("Movement", movement) +
        statPair("Body", y.base_stats.body) +
        statPair("Leadership", y.base_stats.leadership) +
        statPair("Initiative", y.base_stats.initiative) +
      "</div>" +

      // Abilities (text block for MVP; can become a table later using Yokai Abilities CSV if you want)
      '<div class="shoshin-gs-subhead">Abilities</div>' +
      '<div class="shoshin-gs-abilities-text">' + escapeHtml(y.abilities_text || "").replace(/\n/g, "<br>") + "</div>";

    card.innerHTML = card.innerHTML;

    contentEl.appendChild(card);
  }

  // -------------------------------------------------------------------------------------------------------------------
  // RENDER: Tables (Armory / Dojo / Tables stubs)
  // -------------------------------------------------------------------------------------------------------------------

  function renderTableByTier2(tier1, tier2) {
    clearEl(contentEl);

    // Armory
    if (tier1 === "Armory") {
      if (tier2 === "Melee Weapons") contentEl.appendChild(getTpl("tpl-shoshin-gs-table-melee"));
      else if (tier2 === "Ranged Weapons") contentEl.appendChild(getTpl("tpl-shoshin-gs-table-ranged"));
      else if (tier2 === "Armor") contentEl.appendChild(getTpl("tpl-shoshin-gs-table-armor"));
      else if (tier2 === "Support Items") contentEl.appendChild(getTpl("tpl-shoshin-gs-table-support"));
      else if (tier2 === "Artillery") {
        // Artillery = Ozutsu + Munitions
        contentEl.appendChild(renderSupportAssetInfoTable(["Ozutsu"]));
        contentEl.appendChild(getTpl("tpl-shoshin-gs-table-munitions"));
      }
      else if (tier2 === "Sailing Ships") {
        contentEl.appendChild(renderSupportAssetInfoTable(["Mokuzo Hansen"]));
      } else {
        contentEl.innerHTML = '<div class="shoshin-gs-muted">Table not implemented yet.</div>';
      }
      return;
    }

    // Dojo
    if (tier1 === "Dojo") {
      // MVP: show the authoritative training table for all 3 dojo tier2 entries (you can split later if needed)
      contentEl.appendChild(getTpl("tpl-shoshin-gs-table-training"));
      return;
    }

    // Tables (stub last)
    if (tier1 === "Tables") {
      contentEl.innerHTML =
        '<div class="shoshin-gs-muted">' +
          "<strong>" + escapeHtml(tier2) + ":</strong> Quick reference charts will be added last (stubbed for MVP)." +
        "</div>";
      return;
    }

    contentEl.innerHTML = '<div class="shoshin-gs-muted">Nothing to display.</div>';
  }

  function renderSupportAssetInfoTable(keys) {
    var wrap = document.createElement("div");
    wrap.className = "shoshin-gs-block";

    var table = document.createElement("table");
    table.className = "shoshin-table";
    table.setAttribute("style", "width:100%; border-collapse:collapse; font-size:0.8rem;");

    table.innerHTML =
      "<thead><tr>" +
        '<th style="text-align:left;">Asset</th>' +
        '<th style="text-align:left;">Description</th>' +
        '<th style="text-align:left;">Size</th>' +
        '<th style="text-align:left;">Attributes</th>' +
        '<th style="width:60px;">Cost</th>' +
      "</tr></thead><tbody></tbody>";

    var tbody = table.querySelector("tbody");

    keys.forEach(function (k) {
      var meta = SUPPORT_ASSET_META[k] || {};
      var stats = SUPPORT_ASSET_STATS[k] || {};
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td style="text-align:left;">' + escapeHtml(k) + "</td>" +
        '<td style="text-align:left;">' + escapeHtml(meta.shortDescription || "") + "</td>" +
        '<td style="text-align:left;">' + escapeHtml(meta.size || "") + "</td>" +
        '<td style="text-align:left;">' + escapeHtml(meta.attributes || "") + "</td>" +
        "<td>" + escapeHtml(stats.cost != null ? stats.cost : "") + "</td>";
      tbody.appendChild(tr);
    });

    wrap.appendChild(table);
    return wrap;
  }

  // -------------------------------------------------------------------------------------------------------------------
  // CONTROLLER
  // -------------------------------------------------------------------------------------------------------------------

  function render() {
    // Tier 1 active states
    setActiveButtons(tier1Bar, "data-gs-tier1", state.tier1);


    // Tier 2 bar rebuild on tier1
    renderTier2Bar();

    // Tier 2 active
    setActiveButtons(tier2Bar, "data-gs-tier2", state.tier2);


    // Render content
    if (state.tier1 === "Characters") renderCharacterCard(state.tier2);
    else if (state.tier1 === "Yokai") renderYokaiCard(state.tier2);
    else renderTableByTier2(state.tier1, state.tier2);
  }

  // Tier 1 click
  tier1Bar.addEventListener("click", function (e) {
    var btn = e.target.closest(".shoshin-asset-filter-btn");
    if (!btn) return;
    state.tier1 = btn.getAttribute("data-gs-tier1") || "Characters";
    state.tier2 = (TIER2[state.tier1] && TIER2[state.tier1][0]) ? TIER2[state.tier1][0] : "";
    render();
  });

  // Tier 2 click
  root.addEventListener("click", function (e) {
    var btn = e.target.closest(".shoshin-gs-tier2 .shoshin-asset-filter-btn");
    if (!btn) return;
    state.tier2 = btn.getAttribute("data-gs-tier2") || state.tier2;
    setActiveButtons(tier2Bar, "data-gs-tier2", state.tier2);

    if (state.tier1 === "Characters") renderCharacterCard(state.tier2);
    else if (state.tier1 === "Yokai") renderYokaiCard(state.tier2);
    else renderTableByTier2(state.tier1, state.tier2);
  });

    var tier2Bar = root.querySelector(".shoshin-gs-tier2");

      /* =========================================================================================================
  BEGIN SHOSHIN GAME SYSTEM — LOCAL CSS OVERRIDES (scoped)
  - Keeps changes isolated to /game-system
  ========================================================================================================= */
  (function injectGameSystemCss() {
    var id = "shoshin-game-system-local-css";
    if (document.getElementById(id)) return;
    var css =
      "#shoshin-game-system .shoshin-gs-row1{display:flex;align-items:center;gap:22px;margin-bottom:28px;}\n" +
      "#shoshin-game-system .shoshin-gs-avatar img{display:block;width:150px;height:150px;object-fit:cover;border-radius:10px;}\n" +
      "#shoshin-game-system .shoshin-gs-head{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;text-align:left;}\n" +
      "#shoshin-game-system .shoshin-gs-subhead{text-align:left;margin:18px 0 10px;font-weight:700;}\n" +
      "#shoshin-game-system .shoshin-gs-statgrid{margin:0 0 28px;}\n" +
      "#shoshin-game-system .shoshin-gs-block{margin-top:34px;}\n" +
      "#shoshin-game-system .shoshin-gs-type{text-align:left;}\n" +

      /* Tables: align columns + left-align first cell where requested */
      "#shoshin-game-system #shoshin-abilities-table{table-layout:fixed;}\n" +
      "#shoshin-game-system #shoshin-abilities-table th:nth-child(1){width:22%;}\n" +
      "#shoshin-game-system #shoshin-abilities-table th:nth-child(2){width:68%;}\n" +
      "#shoshin-game-system #shoshin-abilities-table th:nth-child(3){width:10%;}\n" +
      "#shoshin-game-system #shoshin-abilities-table td:first-child{text-align:left;}\n" +

      "#shoshin-game-system table.shoshin-gs-mc-table{table-layout:fixed;}\n" +
      "#shoshin-game-system table.shoshin-gs-mc-table th:nth-child(1){width:22%;}\n" +
      "#shoshin-game-system table.shoshin-gs-mc-table th:nth-child(2){width:68%;}\n" +
      "#shoshin-game-system table.shoshin-gs-mc-table th:nth-child(3){width:10%;}\n" +
      "#shoshin-game-system table.shoshin-gs-mc-table td:first-child{font-weight:700;text-align:left;}\n" +
      "#shoshin-game-system table.shoshin-gs-mc-table td:nth-child(2){text-align:left;}\n";

    var style = document.createElement("style");
    style.id = id;
    style.type = "text/css";
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  })();
  /* =========================================================================================================
  END SHOSHIN GAME SYSTEM — LOCAL CSS OVERRIDES (scoped)
  ========================================================================================================= */



  // Initial render
  render();

})();

/* =======================================================================================================================
END SHOSHIN GAME SYSTEM RENDERER (MVP)
======================================================================================================================= */
