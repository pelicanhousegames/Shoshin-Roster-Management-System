/* SHOSHIN — /game-system
   Static Game System Reference (MVP)
   DROP-IN JS for WPCode (no dynamic data; display only)
*/
(function() {
  'use strict';

  // Fallback image used when a class/avatar image is missing
  // 1x1 transparent GIF data URI to avoid broken-image icons
  var FALLBACK_IMAGE = '/wp-content/uploads/2025/12/Helmet-grey.jpg';


    // -----------------------------------------------------------------------------------
  // Canonical icon maps (1:1 from my-assets.js Data.* dictionaries)
  // NOTE: These are used ONLY for display icons in tables. Missing entries use FALLBACK_IMAGE.
  // -----------------------------------------------------------------------------------
    var ICONS = {
    // Matches my-assets.js Data.ABILITIES (keys + image paths)
    ability: {
      'Divine Inspiration': '/wp-content/uploads/2026/01/holy.jpg',
      'Honor Duel': '/wp-content/uploads/2026/01/duel.jpg',
      'Iron Fists': '/wp-content/uploads/2026/01/fist.jpg',
      'Missile Deflection': '/wp-content/uploads/2026/01/deflect2.jpg',
      'Ki Endurance': '/wp-content/uploads/2026/01/ki.jpg',
      'Heal': '/wp-content/uploads/2026/01/heal.jpg',
      'Wall Crawling': '/wp-content/uploads/2026/01/feet.jpg',
      'Light-footed': '/wp-content/uploads/2026/01/feet.jpg',
      'Assassinate': '/wp-content/uploads/2026/01/death2.jpg',
      'Night Stalker': '/wp-content/uploads/2026/01/duel.jpg',
      'Stealth': '/wp-content/uploads/2026/01/conceal.jpg',
      'Agile': '/wp-content/uploads/2026/01/feet.jpg',
      'Aura of Resolve': '/wp-content/uploads/2026/01/holy.jpg',
      'Omen of Wrath': '/wp-content/uploads/2026/01/holy.jpg',
      'Enduring Ward': '/wp-content/uploads/2026/01/holy.jpg',
      'Beyond the Veil': '/wp-content/uploads/2026/01/Veil.jpg',

      // Master Class Abilities — icons do not exist yet (fallback for now)
      'Fury of the Rising Sun': '/wp-content/uploads/2026/01/martialmastery.jpg',
      'Zen Restoration': '/wp-content/uploads/2026/01/heal.jpg',
      'Arms Master': '/wp-content/uploads/2026/01/swordmaster.jpg',
      'Transcendence': '/wp-content/uploads/2025/12/Unarmed1.jpeg',
      'Eagle Eye': '/wp-content/uploads/2026/02/eagle.jpg',
      'Critical Precision': '/wp-content/uploads/2026/01/duel.jpg',
      'Collective Cohort': '/wp-content/uploads/2026/02/collective.jpg',
      'Ki Fortitude': '/wp-content/uploads/2026/01/ki.jpg',
      'Way of the Fist': '/wp-content/uploads/2026/01/fist.jpg',
      'Uncanny Dodge': '/wp-content/uploads/2026/01/feet.jpg',
      'Spiritual Communion': '/wp-content/uploads/2026/01/Veil.jpg',
      'Thaumaturgy': '/wp-content/uploads/2025/12/Sorcery.jpeg',

      // Yokai abilities (icons TBD; fallback for now)
      'Aquatic Agility': '/wp-content/uploads/2025/12/Water.jpeg',
      'Aquatic Assembly': '/wp-content/uploads/2025/12/Water.jpeg',
      'Aura of Despair': '/wp-content/uploads/2026/01/holy.jpg',
      'Aura of Fear': '/wp-content/uploads/2026/01/holy.jpg',
      'Blizzard’s Embrace': '/wp-content/uploads/2026/02/snow.jpg',
      'Breath of Fire': '/wp-content/uploads/2026/02/flame.jpg',
      'Corrosive Breath': '/wp-content/uploads/2026/02/poison.jpg',
      'Cumbersome': '/wp-content/uploads/2026/01/feet.jpg',
      'Deep Focus': '/wp-content/uploads/2026/01/Veil.jpg',
      'Flight': '/wp-content/uploads/2026/02/wing.jpg',
      'Flood': '/wp-content/uploads/2025/12/Water.jpeg',
      'Haunting Influence': '/wp-content/uploads/2026/01/duel.jpg',
      'Immunity: Bleed': '/wp-content/uploads/2026/02/shield.jpg',
      'Immunity: Burn': '/wp-content/uploads/2026/02/shield.jpg',
      'Immunity: Fear': '/wp-content/uploads/2026/02/shield.jpg',
      'Immunity: Poison': '/wp-content/uploads/2026/02/shield.jpg',
      'Immunity: Stun': '/wp-content/uploads/2026/02/shield.jpg',
      'Lashing Tendrils': '/wp-content/uploads/2026/01/swordmaster.jpg',
      'Leeching Blow': '/wp-content/uploads/2026/01/heal.jpg',
      'Luminous Snare': '/wp-content/uploads/2026/01/holy.jpg',
      'Phase Shift': '/wp-content/uploads/2026/01/holy.jpg',
      'Resilience': '/wp-content/uploads/2026/02/shield.jpg',
      'Shapeshift': '/wp-content/uploads/2026/01/holy.jpg',
      'Spectral Immunity': '/wp-content/uploads/2026/02/shield.jpg',
      'Stormcaller’s Gift': '/wp-content/uploads/2025/12/Water.jpeg',
      'Tailwhip': '/wp-content/uploads/2026/01/duel.jpg',
      'Toxic Aura': '/wp-content/uploads/2026/01/holy.jpg',
      'Unwavering': '/wp-content/uploads/2026/01/duel.jpg',
      'Web of Entanglement': '/wp-content/uploads/2026/02/web.jpg'

    },

    // Matches my-assets.js Data.PROFICIENCIES (keys + image paths)
    proficiency: {
      'Inept: Melee Combat': '/wp-content/uploads/2026/01/Inept.jpg',
      'Inept: Ranged Combat': '/wp-content/uploads/2026/01/Inept.jpg',
      'Inept: Water Combat': '/wp-content/uploads/2026/01/Inept.jpg',
      'Inept: Horsemanship': '/wp-content/uploads/2026/01/Inept.jpg',
      'Ancestral Prestige': '/wp-content/uploads/2026/01/ancestral.jpg',
      'Martial Mastery': '/wp-content/uploads/2026/01/swords.jpg',
      'Sword Master': '/wp-content/uploads/2026/01/swordmaster.jpg',
      'General Ineptitude': '/wp-content/uploads/2026/01/Inept.jpg',
      'Martial Artist': '/wp-content/uploads/2025/12/Unarmed1.jpeg',
      'Polearms Adept': '/wp-content/uploads/2026/01/polearmmaster.jpg',
      'Espionage Expert': '/wp-content/uploads/2025/12/Ninjutsu.jpeg',
      'Mysticism and Ritualism': '/wp-content/uploads/2025/12/Sorcery.jpeg'
    },

    // Matches my-assets.js Data.MELEE_WEAPONS (keys + image paths)
    melee: {
      'Unarmed Combat': '/wp-content/uploads/2025/12/Unarmed1.jpeg',
      'Jutte': '/wp-content/uploads/2025/12/Club1.jpeg',
      'Bo': '/wp-content/uploads/2025/12/Staff1.jpeg',
      'Tanto': '/wp-content/uploads/2025/12/Dagger1.jpeg',
      'Kusarigama': '/wp-content/uploads/2026/01/kusarigama.jpg',
      'Kanabo': '/wp-content/uploads/2026/01/kanabo.jpg',
      'Yari': '/wp-content/uploads/2025/12/Spear1.jpeg',
      'Katana': '/wp-content/uploads/2026/01/katana.jpg',
      'Naginata': '/wp-content/uploads/2025/12/Naginata1.jpeg',
      'Nodachi': '/wp-content/uploads/2026/01/nodachi.jpg'
    },

    // Matches my-assets.js Data.RANGED_WEAPONS (keys + image paths)
    ranged: {
      'Kunai': '/wp-content/uploads/2026/01/kunai.jpg',
      'Shuriken': '/wp-content/uploads/2025/12/Shuriken1.jpeg',
      'Fukiya': '/wp-content/uploads/2026/01/dart.jpg',
      'Hankyu': '/wp-content/uploads/2026/01/hankyu.jpg',
      'Daikyu': '/wp-content/uploads/2026/01/daikyu.jpg',
      'Tanegashima': '/wp-content/uploads/2025/12/Arquebus1.jpeg',
      'Ozutsu': '/wp-content/uploads/2026/04/odzutsu.jpg',
      'Houroku-Hiya': '/wp-content/uploads/2025/12/bomb1.jpeg'
    },

    // Matches my-assets.js Data.ARMOR (keys + image paths)
    armor: {
      'Do-maru': '/wp-content/uploads/2026/04/do_maru.webp',
      'O-yoroi': '/wp-content/uploads/2026/04/o_yoroi.webp',
      'Tosei-gusoku': '/wp-content/uploads/2026/04/tosei_gusoku.webp'
    },

    // Matches my-assets.js Data.SUPPORT_ITEMS (keys + image paths)
    support: {
      'Torinawa': '/wp-content/uploads/2025/12/Rope.jpeg',
      'Shirube': '/wp-content/uploads/2025/12/Pitch.jpeg',
      'Kanpo': '/wp-content/uploads/2025/12/Medicine.jpeg',
      'Shakuhachi': '/wp-content/uploads/2025/12/Flute.jpeg',
      'Sashimono': '/wp-content/uploads/2025/12/Sashimono.png',
      'Emakimono': '/wp-content/uploads/2025/12/Handscrolls.jpeg',
      'Uma': '/wp-content/uploads/2025/12/Horse.jpeg'
    },

    // Matches my-assets.js Data.TRAINING (keys + image paths)
    training: {
      'Jujutsu': '/wp-content/uploads/2025/12/Unarmed1.jpeg',
      'Juttejutsu': '/wp-content/uploads/2025/12/Club1.jpeg',
      'Bojutsu': '/wp-content/uploads/2025/12/Staff1.jpeg',
      'Tantojutsu': '/wp-content/uploads/2025/12/Dagger1.jpeg',
      'Kusarigamajutsu': '/wp-content/uploads/2026/01/kusarigama.jpg',
      'Mojirijutsu': '/wp-content/uploads/2026/01/kanabo.jpg',
      'Sojutsu': '/wp-content/uploads/2025/12/Spear1.jpeg',
      'Kenjutsu': '/wp-content/uploads/2026/01/katana.jpg',
      'Naginatajutsu': '/wp-content/uploads/2025/12/Naginata1.jpeg',
      'Iaijutsu': '/wp-content/uploads/2026/01/nodachi.jpg',
      'Shurikenjutsu': '/wp-content/uploads/2025/12/Shuriken1.jpeg',
      'Fukumibarijutsu': '/wp-content/uploads/2026/01/dart.jpg',
      'Kyujutsu': '/wp-content/uploads/2026/01/kyujutsu.jpg',
      'Kayakujutsu': '/wp-content/uploads/2025/12/Arquebus1.jpeg',
      'Hojojutsu': '/wp-content/uploads/2025/12/Rope.jpeg',
      'Suieijutsu': '/wp-content/uploads/2025/12/Water.jpeg',
      'Bajutsu': '/wp-content/uploads/2025/12/Horse.jpeg',
      'Ninjutsu': '/wp-content/uploads/2025/12/Ninjutsu.jpeg',
      'Onmyodo': '/wp-content/uploads/2025/12/Sorcery.jpeg'
    },

    // Matches my-assets.js Data.MUNITIONS (keys + image paths)
    munitions: {
      'Tetsuho': '/wp-content/uploads/2025/12/Cannonball.jpeg',
      'Bo-Hiya': '/wp-content/uploads/2025/12/Flame-Arrow.jpeg',
      'Tama-ire': '/wp-content/uploads/2025/12/Grapeshot.jpeg'
    }
  };



  // Avoid double-init
  if (window.__SHOSHIN_GAME_SYSTEM_INITED__) return;
  window.__SHOSHIN_GAME_SYSTEM_INITED__ = true;

  // -----------------------------
  // Canonical helpers
  // -----------------------------
  function el(tag, attrs, children) {
    var node = document.createElement(tag);

    if (attrs) {
      Object.keys(attrs).forEach(function(k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'onclick' && typeof attrs[k] === 'function') node.addEventListener('click', attrs[k]);
        else node.setAttribute(k, attrs[k]);
      });
    }


    // Normalize children so callers can pass: string | Node | [string|Node]
    if (children != null && !Array.isArray(children)) {
      children = [children];
    }

    if (children && children.length) {
      children.forEach(function(c) {
        if (c == null) return;
        if (typeof c === 'string') node.appendChild(document.createTextNode(c));
        else node.appendChild(c);
      });
    }

    return node;
  }


  function injectStyleOnce() {
    if (document.getElementById('shoshin-gs-style')) return;
    var css = `
      .shoshin-gs-wrap { max-width: 1100px; margin: 0 auto; }

      /* Filters: use canonical site styles from shoshin-common.css (.shoshin-asset-filters/.shoshin-asset-filter-btn) */
      .shoshin-gs-filters { margin: 0 0 18px; }
      .shoshin-gs-filters .shoshin-asset-filters { justify-content: center; flex-wrap: wrap; gap: 10px; margin: 0 0 10px; }

            /* ------------------------------------------------------------
         Dojo Ryū Tables – Header Alignment
         ------------------------------------------------------------ */

      /* Center-align Ryū / Discipline / Equipment headers */
      #shoshin-training-table thead th:nth-child(1),
      #shoshin-training-table thead th:nth-child(2),
      #shoshin-training-table thead th:nth-child(3),
      #shoshin-training-table thead th:nth-child(4) {
        text-align: center !important;
      }

      /* ------------------------------------------------------------
         Dojo Ryū Tables – Unified Column Widths
         ------------------------------------------------------------ */

      #shoshin-training-table {
        table-layout: fixed !important;
      }

      /* Ryū */
      #shoshin-training-table thead th:nth-child(1),
      #shoshin-training-table tbody td:nth-child(1) {
        width: 120px !important;
        text-align: center;
      }

      /* Discipline */
      #shoshin-training-table thead th:nth-child(2),
      #shoshin-training-table tbody td:nth-child(2) {
        width: 150px !important;
        text-align: center;
      }

      /* Equipment */
      #shoshin-training-table thead th:nth-child(4),
      #shoshin-training-table tbody td:nth-child(4) {
        width: 180px !important;
      }

            /* Cost (tight) */
      #shoshin-training-table thead th:nth-child(5),
      #shoshin-training-table tbody td:nth-child(5) {
        width: 60px !important;
        text-align: center;
      }

            /* ------------------------------------------------------------
         Taiho — Munitions Table (Header + Column Alignment) 
         ------------------------------------------------------------ */

      /* Center-align Munition + Type headers */
      #shoshin-munitions-table thead th:nth-child(2),
      #shoshin-munitions-table thead th:nth-child(3) {
        text-align: center !important;
      }

      /* Match Munitions Cost column width to Training Requirements "Cost" (70px) */
      #shoshin-munitions-table thead th:nth-child(8),
      #shoshin-munitions-table tbody td:nth-child(8) {
        width: 70px !important;
        min-width: 70px !important;
        text-align: center !important;
      }

      /* Left-align ALL Attributes column cells */
      #shoshin-munitions-table tbody td:nth-child(7) {
        text-align: left !important;
      }

      /* ------------------------------------------------------------
         Support Assets — Rules Tables (prevent theme overlap / stacking) KEPT OLD CSS CLASS OZUTSU TO PREVENT BREAKING - REFACTOR IN FUTURE!!
         ------------------------------------------------------------ */

      #shoshin-support-ozutsu-rules-table,
      #shoshin-support-wasen-rules-table {
        width: 100% !important;
        border-collapse: collapse !important;
        table-layout: fixed !important;
      }

      #shoshin-support-ozutsu-rules-table th,
      #shoshin-support-ozutsu-rules-table td,
      #shoshin-support-wasen-rules-table th,
      #shoshin-support-wasen-rules-table td {
        display: table-cell !important;
        vertical-align: top !important;
        padding: 4px 6px !important;
        border-bottom: 1px solid #eee !important;
        color: #555 !important;
        line-height: 1.35 !important;
      }

            /* Left-align Description column (col 2) */
      #shoshin-support-ozutsu-rules-table tbody td:nth-child(2),
      #shoshin-support-wasen-rules-table tbody td:nth-child(2) {
        text-align: left !important;
      }

            /* Vertically center Game Mechanic column (col 1) */
      #shoshin-support-ozutsu-rules-table tbody td:nth-child(1),
      #shoshin-support-wasen-rules-table tbody td:nth-child(1) {
        vertical-align: middle !important;
      }



      #shoshin-support-ozutsu-rules-table thead th,
      #shoshin-support-wasen-rules-table thead th {
        border-bottom: 1px solid #ccc !important;
        font-weight: 700 !important;
      }

      /* Column sizing: widen Game Mechanic + allow wrapping to prevent overlap */
      #shoshin-support-ozutsu-rules-table thead th:first-child,
      #shoshin-support-ozutsu-rules-table tbody td:first-child,
      #shoshin-support-wasen-rules-table thead th:first-child,
      #shoshin-support-wasen-rules-table tbody td:first-child {
        width: 240px !important;
        min-width: 240px !important;
        white-space: normal !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
      }

      #shoshin-support-ozutsu-rules-table thead th:last-child,
      #shoshin-support-ozutsu-rules-table tbody td:last-child,
      #shoshin-support-wasen-rules-table thead th:last-child,
      #shoshin-support-wasen-rules-table tbody td:last-child {
        width: auto !important;
        white-space: normal !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
      }


      /* Character Class columns */
      #shoshin-training-table th[data-shoshin-class],
      #shoshin-training-table td[data-shoshin-class] {
        width: 64px !important;
        padding: 4px 4px !important;
        font-size: 12px !important;
        text-align: center;
      }


            /* Character Class columns (Armor / Support / Dojo Ryū) */
      #shoshin-armor-table th[data-shoshin-class],
      #shoshin-support-table th[data-shoshin-class],
      #shoshin-training-table th[data-shoshin-class] {
        text-align: center !important;
        font-size: 12px;
      }

      #shoshin-armor-table td[data-shoshin-class],
      #shoshin-support-table td[data-shoshin-class],
      #shoshin-training-table td[data-shoshin-class] {
        text-align: center !important;
        font-weight: 700;
      }


            /* ------------------------------------------------------------
         Armory Tables – Header & Attributes Alignment (column-based)
         ------------------------------------------------------------ */

      /* Center-align header col 2 (Weapon/Armor/Item) and col 3 (Type) */
      #shoshin-melee-table thead th:nth-child(2),
      #shoshin-melee-table thead th:nth-child(3),
      #shoshin-ranged-table thead th:nth-child(2),
      #shoshin-ranged-table thead th:nth-child(3),
      #shoshin-armor-table thead th:nth-child(2),
      #shoshin-armor-table thead th:nth-child(3),
      #shoshin-support-table thead th:nth-child(2),
      #shoshin-support-table thead th:nth-child(3) {
        text-align: center !important;
      }

      /* Melee/Ranged: Attributes column is col 7 */
      #shoshin-melee-table tbody td:nth-child(7),
      #shoshin-melee-table tbody td:nth-child(7) *,
      #shoshin-ranged-table tbody td:nth-child(7),
      #shoshin-ranged-table tbody td:nth-child(7) * {
        text-align: left !important;
      }

      /* Armor/Support: Attributes column is col 4 */
      #shoshin-armor-table tbody td:nth-child(4),
      #shoshin-armor-table tbody td:nth-child(4) *,
      #shoshin-support-table tbody td:nth-child(4),
      #shoshin-support-table tbody td:nth-child(4) * {
        text-align: left !important;
      }

            /* ------------------------------------------------------------
         Support Items – Column Width Tuning (MVP desktop)
         Goal: shrink Item/Type, expand Attributes, optionally shrink class cols
         ------------------------------------------------------------ */

      /* Make widths deterministic so Attributes can absorb space */
      #shoshin-support-table {
        table-layout: fixed !important;
      }

      /* Col 2 = Item (slightly tighter) */
      #shoshin-support-table thead th:nth-child(2),
      #shoshin-support-table tbody td:nth-child(2) {
        width: 105px !important;
      }

      /* Allow Item text to wrap (otherwise nowrap forces the column wide) */
      #shoshin-support-table tbody td:nth-child(2) {
        white-space: normal !important;
      }

      /* Col 3 = Type (slightly tighter) */
      #shoshin-support-table thead th:nth-child(3),
      #shoshin-support-table tbody td:nth-child(3) {
        width: 130px !important;
      }

      /* Col 4 = Attributes (slightly tighter, but still primary text column) */
      #shoshin-support-table thead th:nth-child(4),
      #shoshin-support-table tbody td:nth-child(4) {
        width: 360px !important;
      }

      /* Col 5 = Cost (keep tight) */
      #shoshin-support-table thead th:nth-child(5),
      #shoshin-support-table tbody td:nth-child(5) {
        width: 60px !important;
        white-space: nowrap !important;
      }

      /* Character Class columns (cols 6+) – redistribute recovered width */
      #shoshin-support-table th[data-shoshin-class],
      #shoshin-support-table td[data-shoshin-class] {
        width: 56px !important;
        padding: 4px 4px !important;
        font-size: 12px !important;
      }

            /* Tier 2 Tabs: allow wrapping onto multiple lines (Yokai has many entries) */
      .shoshin-asset-filters.shoshin-gs-tier2 {
        display: flex !important;
        flex-wrap: wrap !important;
        justify-content: center !important;
        align-items: center !important;
        gap: 8px 10px !important; /* row-gap / column-gap */
      }

      /* Ensure each button stays as an atomic pill and does not stretch */
      .shoshin-asset-filters.shoshin-gs-tier2 .shoshin-asset-filter-btn {
        flex: 0 0 auto !important;
        white-space: nowrap !important;
      }


            /* Tier2 Info block (between filters and panel) */
      .shoshin-gs-tier2-info {
        margin: 0;
        font-size: 1.1rem;
        color: #777;
        font-weight: 400;
        font-style: italic;
        text-align: center;
       }



      .shoshin-gs-panel { margin-top: 12px; }

      /* Table icons (first column) */
      .shoshin-gs-icon {
        width: 24px;
        height: 24px;
        object-fit: cover;
        display: block;
        margin: 0 auto;
        border-radius: 4px;
      }

            /* Prevent Image header text truncation */
      .shoshin-gs-profile table th:first-child {
        overflow: visible !important;
        text-overflow: clip !important;
      }


      /* Make the Image column narrow across all GS tables (slightly wider to avoid ellipsis) */
      .shoshin-gs-profile table th:first-child,
      .shoshin-gs-profile table td:first-child {
        width: 60px !important;
        max-width: 60px !important;
        min-width: 60px !important;
        white-space: nowrap;
        overflow: visible;
        text-overflow: clip;
        text-align: center !important;
      }





      /* Profile card layout */
      .shoshin-gs-profile { border: 2px solid #ddd; border-radius: 0px; padding: 32px; background: #fff; }
.shoshin-gs-row1 {
  display: flex;
  gap: 16px;
  align-items: flex-start;          /* logo stays top */
  justify-content: space-between;   /* left group vs logo */
}

/* Left group (Avatar + Info) should center vertically within Row 1 */
.shoshin-gs-row1-left {
  display: flex;
  align-items: center; /* vertically center info vs avatar */
  gap: 16px;
  flex: 1;            /* THIS is critical: left group claims available width */
  min-width: 0;       /* prevents flex overflow weirdness */
}



      .shoshin-gs-avatar { width:150px; height:150px; object-fit:cover; border-radius: 8px !important; flex: 0 0 auto; border: 1px solid #ddd; }
.shoshin-gs-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 0 0 auto;       /* do NOT expand (keeps info next to avatar) */
  min-width: 0;
  text-align: left;
}
  
.shoshin-gs-game-logo {
  width: 96px;
  height: auto;
  opacity: 0.95;
  align-self: flex-start; /* keep logo at top */
  display: block;
  flex: 0 0 auto;
}


/* --- GS ROW1: FORCE INFO BLOCK LEFT (override Elementor centering) --- */
.shoshin-gs-profile .shoshin-gs-row1-left {
  justify-content: flex-start !important;
  text-align: left !important;
}

.shoshin-gs-profile .shoshin-gs-meta {
  align-items: flex-start !important;   /* left edge for stacked meta items */
  justify-content: center !important;   /* vertical centering vs avatar */
  text-align: left !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}

/* Force ALL meta text blocks left, regardless of Elementor section alignment */
.shoshin-gs-profile .shoshin-gs-meta .shoshin-gs-type,
.shoshin-gs-profile .shoshin-gs-meta .shoshin-gs-short,
.shoshin-gs-profile .shoshin-gs-meta .shoshin-gs-kv,
.shoshin-gs-profile .shoshin-gs-meta .shoshin-gs-kv span {
  text-align: left !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}




      .shoshin-gs-meta .shoshin-gs-type { font-size: 1.6rem; font-weight: 700; }
      .shoshin-gs-meta .shoshin-gs-short { font-size: 0.95rem; color:#444; }
      .shoshin-gs-meta .shoshin-gs-kv { display:flex; flex-direction:column; gap:2px; font-size: 0.9rem; color:#333; }

      .shoshin-gs-meta .shoshin-gs-kv b { font-weight: 800; }

      .shoshin-gs-spacer-lg { height: 18px; }
      .shoshin-gs-section-title { margin: 0 0 8px; font-size: 1.05rem; font-weight: 700; text-align:left; }

.shoshin-gs-stats {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  border-spacing: 0;
  margin-block-end: 0px;
}


      .shoshin-gs-stats, .shoshin-gs-stats th, .shoshin-gs-stats td { border: 0 !important; }
      .shoshin-gs-stats th {
        font-size: 0.95rem;
        text-align: center;
        color: #555;
        font-weight: 700;
        white-space: nowrap;

        /* tighten theme padding/line-height */
        padding: 8px 6px !important;
        line-height: 1.15 !important;
      }

      .shoshin-gs-stats td {
        font-size: 1.0rem;
        font-weight: 700;
        text-align: center;

        /* tighten theme padding/line-height */
        padding: 8px 6px !important;
        line-height: 1.15 !important;
      }

      .shoshin-gs-weapons-hint {
  cursor: pointer;
  text-decoration: underline;
}


            /* Character Profile stat headers need to wrap so the 6 columns stay aligned with base stats */
      .shoshin-gs-profile-stats th {
        white-space: normal !important;
        font-size: 0.85rem !important;
        line-height: 1.1 !important;
      }

      /* Keep the two "See Weapons Table" halves centered within their 3-column spans */
      .shoshin-gs-profile-stats td[colspan="3"] {
        text-align: center !important;
      }


      /* specifically reduce the gap between header row and value row */
      .shoshin-gs-stats tr:first-child th { padding-bottom: 8px !important; }
      .shoshin-gs-stats tr:nth-child(2) td { padding-top: 8px !important; }


      /* Keep non-stats tables left-aligned in first column; do NOT affect stats tables */
      .shoshin-gs-profile table:not(.shoshin-gs-stats) td:first-child { text-align:left; }

      /* "See Weapons Table" styling */
      .shoshin-gs-see-weapons {
        margin: 0;
        font-size: 1.1rem;
        color: #777;
        font-weight: 400;
        font-style: italic;
        text-align: center;
        opacity: 0.9;
      }

      /* Ensure the same "See Weapons Table" styling wins inside stats table cells
         BUT do not override link styling (Characters uses an <a> here). */
      .shoshin-gs-stats td span.shoshin-gs-see-weapons,
      .shoshin-gs-stats td div.shoshin-gs-see-weapons,
      .shoshin-gs-stats td p.shoshin-gs-see-weapons {
        display: block;
        margin: 0;
        font-size: 1.1rem;
        color: #777;
        font-weight: 400;
        font-style: italic;
        text-align: center;
        opacity: 0.9;
      }




      /* ============================================================
   Character profile sub-tables: normalize col sizing cleanly
   Applies ONLY to:
   - Base Proficiencies (.shoshin-gs-included)
   - Character Abilities (.shoshin-gs-abilities)
   - Master Class Abilities (.shoshin-gs-mc-table)
   ============================================================ */

/* Make widths deterministic */
.shoshin-gs-included table.shoshin-table,
.shoshin-gs-abilities table.shoshin-table,
table.shoshin-gs-mc-table {
  table-layout: fixed !important;
}

/* Col 1 = Image (same across all three) */
.shoshin-gs-included table.shoshin-table th:first-child,
.shoshin-gs-included table.shoshin-table td:first-child,
.shoshin-gs-abilities table.shoshin-table th:first-child,
.shoshin-gs-abilities table.shoshin-table td:first-child,
table.shoshin-gs-mc-table th:first-child,
table.shoshin-gs-mc-table td:first-child {
  width: 48px !important;
  min-width: 48px !important;
  max-width: 48px !important;
  text-align: center !important;
  padding-left: 4px !important;
  padding-right: 4px !important;
}

/* Col 2 = Proficiency / Ability (same across all three) */
.shoshin-gs-included table.shoshin-table th:nth-child(2),
.shoshin-gs-included table.shoshin-table td:nth-child(2),
.shoshin-gs-abilities table.shoshin-table th:nth-child(2),
.shoshin-gs-abilities table.shoshin-table td:nth-child(2),
table.shoshin-gs-mc-table th:nth-child(2),
table.shoshin-gs-mc-table td:nth-child(2) {
  width: 220px !important;
  min-width: 220px !important;
  max-width: 220px !important;
  text-align: left !important;
  font-weight: 700;
  white-space: nowrap !important;
}

/* Description/Effect columns should wrap and be left aligned */
.shoshin-gs-included table.shoshin-table th:nth-child(n+3),
.shoshin-gs-included table.shoshin-table td:nth-child(n+3),
.shoshin-gs-abilities table.shoshin-table th:nth-child(n+3),
.shoshin-gs-abilities table.shoshin-table td:nth-child(n+3),
table.shoshin-gs-mc-table th:nth-child(n+3),
table.shoshin-gs-mc-table td:nth-child(n+3) {
  width: auto !important;
  text-align: left !important;
  white-space: normal !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
}

/* Character Abilities only: keep Cost column tight (col 4) */
.shoshin-gs-abilities table.shoshin-table th:nth-child(4),
.shoshin-gs-abilities table.shoshin-table td:nth-child(4) {
  width: 60px !important;
  min-width: 60px !important;
  max-width: 60px !important;
  text-align: center !important;
  white-space: nowrap !important;
}

/* Yokai only: Character Abilities Description column must be left-aligned */
.shoshin-gs-panel[data-tier1="Yokai"]
  .shoshin-gs-abilities
  table.shoshin-table
  thead th:nth-child(3),
.shoshin-gs-panel[data-tier1="Yokai"]
  .shoshin-gs-abilities
  table.shoshin-table
  tbody td:nth-child(3) {
  text-align: left !important;
  white-space: normal !important;
}



            /* ------------------------------------------------------------
         Armory Tables – Header & Attribute Alignment Tweaks
         ------------------------------------------------------------ */

      /* Center-align Weapon and Type headers */
      #shoshin-melee-table th:nth-child(2),
      #shoshin-melee-table th:nth-child(3),
      #shoshin-ranged-table th:nth-child(2),
      #shoshin-ranged-table th:nth-child(3),
      #shoshin-armor-table th:nth-child(2),
      #shoshin-armor-table th:nth-child(3),
      #shoshin-support-table th:nth-child(2),
      #shoshin-support-table th:nth-child(3) {
        text-align: center !important;
      }

      /* Left-align all Attributes column content (force override) */
      #shoshin-melee-table td.attributes,
      #shoshin-melee-table td.attributes *,
      #shoshin-ranged-table td.attributes,
      #shoshin-ranged-table td.attributes *,
      #shoshin-armor-table td.attributes,
      #shoshin-armor-table td.attributes *,
      #shoshin-support-table td.attributes,
      #shoshin-support-table td.attributes * {
        text-align: left !important;
      }

            /* ------------------------------------------------------------
         Class Availability Key Styling
         ------------------------------------------------------------ */

      .shoshin-gs-class-key {
        margin-top: 6px;
        font-size: 14px;
        line-height: 1.4;
        color: #000;
      }

      .shoshin-gs-class-key .k {
        font-weight: 600;
        padding: 0 2px;
      }

      /* default (black) */
      .shoshin-gs-class-key .k-avail,
      .shoshin-gs-class-key .k-na {
        color: #000;
      }

      /* ✓ one for free */
      .shoshin-gs-class-key .k-free {
        color: #1aa21a; /* bright green */
      }

      /* ½ half cost */
      .shoshin-gs-class-key .k-half {
        color: #2bbcff; /* bright light blue */
      }

      /* x2 double cost */
      .shoshin-gs-class-key .k-double {
        color: #d62828; /* strong red */
      }

            /* ------------------------------------------------------------
         Class Availability colors IN TABLE CELLS (not just the legend)
         ------------------------------------------------------------ */

      #shoshin-armor-table td[data-shoshin-class] .k,
      #shoshin-support-table td[data-shoshin-class] .k,
      #shoshin-training-table td[data-shoshin-class] .k {
        font-weight: 700;
        padding: 0 2px;
      }

      /* ✓ one for free (green) */
      #shoshin-armor-table td[data-shoshin-class] .k-free,
      #shoshin-support-table td[data-shoshin-class] .k-free,
      #shoshin-training-table td[data-shoshin-class] .k-free {
        color: #1aa21a !important;
      }

      /* ½ half cost (light blue) */
      #shoshin-armor-table td[data-shoshin-class] .k-half,
      #shoshin-support-table td[data-shoshin-class] .k-half,
      #shoshin-training-table td[data-shoshin-class] .k-half {
        color: #2bbcff !important;
      }

      /* x2 double cost (red) */
      #shoshin-armor-table td[data-shoshin-class] .k-double,
      #shoshin-support-table td[data-shoshin-class] .k-double,
      #shoshin-training-table td[data-shoshin-class] .k-double {
        color: #d62828 !important;
        font-weight: 600;
      }

      /* Hull Sizing (Wasen)
         - Force deterministic column widths (prevents middle cols from stealing width)
         - Restore zebra striping in a rowspan-safe way (stripe by group via row class)
      */
      #shoshin-support-wasen-hull-sizing-table {
        table-layout: fixed !important;
      }

      #shoshin-support-wasen-hull-sizing-table th,
      #shoshin-support-wasen-hull-sizing-table td {
        box-sizing: border-box;
      }

      /* Column width controls (hard force) */
      #shoshin-support-wasen-hull-sizing-table th:nth-child(1),
      #shoshin-support-wasen-hull-sizing-table td:nth-child(1) {
        width: 140px !important;
        min-width: 140px !important;
      }

      #shoshin-support-wasen-hull-sizing-table th:nth-child(2),
      #shoshin-support-wasen-hull-sizing-table td:nth-child(2) {
        width: 120px !important;
        min-width: 120px !important;
      }

      #shoshin-support-wasen-hull-sizing-table th:nth-child(3),
#shoshin-support-wasen-hull-sizing-table td:nth-child(3) {
  width: 170px !important;
  min-width: 170px !important;
}


      /* Tighten Movement + Toughness to free room for Type */
      #shoshin-support-wasen-hull-sizing-table th:nth-child(4),
      #shoshin-support-wasen-hull-sizing-table td:nth-child(4) {
        width: 100px !important;
        min-width: 100px !important;
      }

      #shoshin-support-wasen-hull-sizing-table th:nth-child(5),
      #shoshin-support-wasen-hull-sizing-table td:nth-child(5) {
        width: 100px !important;
        min-width: 100px !important;
      }

      /* Cost column must match Training Requirements cost width */
      #shoshin-support-wasen-hull-sizing-table th:nth-child(7),
      #shoshin-support-wasen-hull-sizing-table td:nth-child(7) {
        width: 70px !important;
        min-width: 70px !important;
      }

      /* Zebra striping (rowspan-safe: stripe by group using explicit classes on <tr>) */
      #shoshin-support-wasen-hull-sizing-table tbody tr.shs-z0 td { background: #fff !important; }
      #shoshin-support-wasen-hull-sizing-table tbody tr.shs-z1 td { background: #f7f7f7 !important; }



    `;
    var style = document.createElement('style');
    style.id = 'shoshin-gs-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

    // -----------------------------------------------------------------------------------
  // Table icon hydrator (static display only)
  // - Adds Image column if missing
  // - Populates icon src from ICONS maps, or FALLBACK_IMAGE
  // -----------------------------------------------------------------------------------
function iconSrc(kind, key) {
  if (!key) return FALLBACK_IMAGE;

  var k = String(key).trim();

  // 1) Exact match (current locked behavior)
  if (ICONS && ICONS[kind] && ICONS[kind][k]) return ICONS[kind][k];

  // 2) Tolerant match (only if exact miss) — fixes hyphen/space/case drift
  // Keep this scoped to iconSrc so we don't introduce new global helpers.
  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-') // normalize “fancy” hyphens to "-"
      .replace(/[^a-z0-9]+/g, ''); // drop spaces/punct
  }

  var map = (ICONS && ICONS[kind]) ? ICONS[kind] : null;
  if (map) {
    var nk = norm(k);
    for (var key2 in map) {
      if (!Object.prototype.hasOwnProperty.call(map, key2)) continue;
      if (norm(key2) === nk) return map[key2];
    }
  }

  return FALLBACK_IMAGE;
}


  function ensureImageColumn(table, kind, keyFromRowFn) {
    if (!table) return;

    var theadRow = table.querySelector('thead tr');
    var tbodyRows = table.querySelectorAll('tbody tr');

    // Detect existing image column by header text "Image" in first cell
    var firstTh = theadRow ? theadRow.querySelector('th') : null;
    var hasImage = firstTh && String(firstTh.textContent || '').trim().toLowerCase() === 'image';

    if (!hasImage && theadRow) {
      // Prepend header
      var th = document.createElement('th');
      th.style.borderBottom = '1px solid #ccc';
      th.style.padding = '4px 6px';
      th.style.textAlign = 'center';
      th.style.width = '48px';
      th.style.whiteSpace = 'nowrap';
      th.textContent = 'Image';
      theadRow.insertBefore(th, theadRow.firstChild);

      // Prepend body cells
      tbodyRows.forEach(function (tr) {
        var td = document.createElement('td');
        td.style.padding = '4px 6px';
        td.style.borderBottom = '1px solid #eee';
        td.style.textAlign = 'center';

        var img = document.createElement('img');
        img.className = 'shoshin-gs-icon';
        img.alt = '';
        img.src = FALLBACK_IMAGE;

        var key = keyFromRowFn ? keyFromRowFn(tr) : '';
        img.src = iconSrc(kind, key);

        td.appendChild(img);
        tr.insertBefore(td, tr.firstChild);
      });
    } else {
      // Column exists; populate any missing/broken src
      tbodyRows.forEach(function (tr) {
        var img = tr.querySelector('td img');
        if (!img) return;
        var src = img.getAttribute('src') || '';
                if (!src || src === '#' || src === FALLBACK_IMAGE) {

          var key = keyFromRowFn ? keyFromRowFn(tr) : '';
          img.src = iconSrc(kind, key);
        }
        img.classList.add('shoshin-gs-icon');
      });
    }
  }

    function shoshinAppendInchesToDistance(tableEl) {
    if (!tableEl) return;

    // Find the "Distance" column index by header text
    var ths = tableEl.querySelectorAll('thead th');
    if (!ths || !ths.length) return;

    var distIdx = -1;
    for (var i = 0; i < ths.length; i++) {
      var h = (ths[i].textContent || '').trim().toLowerCase();
      if (h === 'distance') { distIdx = i; break; }
    }
    if (distIdx === -1) return;

    // Append " only when the cell is purely numeric (int/float)
    var rows = tableEl.querySelectorAll('tbody tr');
    rows.forEach(function (tr) {
      var tds = tr.querySelectorAll('td');
      if (!tds || distIdx >= tds.length) return;

      var td = tds[distIdx];
      var raw = (td.textContent || '').trim();

      // Do nothing if already contains a quote
      if (raw.indexOf('"') !== -1) return;

      // Only pure numbers (e.g., 6, 6.5)
      if (/^\d+(\.\d+)?$/.test(raw)) {
        td.textContent = raw + '"';
      }
    });
  }

    function shoshinEnsureClassColumns(tableEl) {
    if (!tableEl) return;

    var CLASS_ORDER = ['Daimyo','Samurai','Ashigaru','Sohei','Ninja','Onmyoji'];

    // If already present, do nothing (prevents duplication on re-render)
    var existing = tableEl.querySelector('thead th[data-shoshin-class="Daimyo"]');
    if (existing) return;

    var theadRow = tableEl.querySelector('thead tr');
    if (!theadRow) return;

    // Determine which rules bucket this table maps to
    var tableId = tableEl.id || '';
    var bucket =
      (tableId === 'shoshin-armor-table') ? 'armor' :
      (tableId === 'shoshin-support-table') ? 'support' :
      (tableId === 'shoshin-training-table') ? 'training' :
      '';

    // Append headers
    CLASS_ORDER.forEach(function (cls) {
      var th = document.createElement('th');
      th.setAttribute('data-shoshin-class', cls);
      th.textContent = cls;
      th.style.borderBottom = '1px solid #ccc';
      th.style.padding = '4px 6px';
      th.style.textAlign = 'center';
      th.style.whiteSpace = 'nowrap';
      th.style.minWidth = '54px';
      theadRow.appendChild(th);
    });

    function cellHTML(kind) {
      if (kind === 'free')   return '<span class="k k-free">✓</span>';
      if (kind === 'half')   return '<span class="k k-half">½</span>';
      if (kind === 'double') return '<span class="k k-double">x2</span>';
      if (kind === 'zero')   return '0';
      if (kind === 'avail')  return '✓';
      return '--';
    }

    // Append cells for each row based on CLASS_RULES
    var rows = tableEl.querySelectorAll('tbody tr');
    rows.forEach(function (tr) {

      // Row key (prefer the explicit data-* attribute used by your tables)
      var rowKey = '';
      if (bucket === 'armor') rowKey = (tr.getAttribute('data-armor') || '').trim();
      else if (bucket === 'support') rowKey = (tr.getAttribute('data-item') || '').trim();
      else if (bucket === 'training') rowKey = (tr.getAttribute('data-training') || '').trim();

      CLASS_ORDER.forEach(function (cls) {
        var td = document.createElement('td');
        td.setAttribute('data-shoshin-class', cls);
        td.style.padding = '4px 6px';
        td.style.borderBottom = '1px solid #eee';
        td.style.textAlign = 'center';
        td.style.verticalAlign = 'middle';

        // Base availability from CLASS_RULES
        var list = (CLASS_RULES && CLASS_RULES[cls] && Array.isArray(CLASS_RULES[cls][bucket]))
          ? CLASS_RULES[cls][bucket]
          : [];

        var baseAllowed = !!(rowKey && list.indexOf(rowKey) !== -1);

        // Default display
        var kind = baseAllowed ? 'avail' : 'na';

        // -----------------------------
        // COST OVERRIDES (your rules)
        // -----------------------------

        // 1) Display 1/2 IF DAIMYO AND ARMOR would have a check.
        if (baseAllowed && bucket === 'armor' && cls === 'Daimyo') {
          kind = 'half';
        }

        // TRAINING overrides
        if (baseAllowed && bucket === 'training') {

          // 2) Display x2 IF ASHIGARU AND Training would have a check.
          if (cls === 'Ashigaru') {
            kind = 'double';
          }

          // 3) Display a green check IF DAIMYO AND TRAINING would have a check.
          if (cls === 'Daimyo') {
            kind = 'free';
          }

          // 4) Display 1/2 IF SAMURAI AND TRAINING = KENJUTSU or IAIJUTSU
          if (cls === 'Samurai' && (rowKey === 'Kenjutsu' || rowKey === 'Iaijutsu')) {
            kind = 'half';
          }

          // 5) Display 1/2 IF SOHEI AND TRAINING = SOJUTSU or NAGINATAJUTSU
          if (cls === 'Sohei' && (rowKey === 'Sojutsu' || rowKey === 'Naginatajutsu')) {
            kind = 'half';
          }

          // 6) Display 0 IF NINJA AND NINJUTSU
          if (cls === 'Ninja' && rowKey === 'Ninjutsu') {
            kind = 'zero';
          }

          // 7) Display 0 IF ONMYOJI AND ONMYODO
          if (cls === 'Onmyoji' && rowKey === 'Onmyodo') {
            kind = 'zero';
          }

          // 8) Display 0 IF SOHEI AND JUJUTSU
          if (cls === 'Sohei' && rowKey === 'Jujutsu') {
            kind = 'zero';
          }
        }

        td.innerHTML = cellHTML(kind);
        tr.appendChild(td);
      });
    });
  }

  function hydrateIcons(panel) {
    if (!panel) return;

    // Abilities table (Character Abilities)
    ensureImageColumn(
      panel.querySelector('#shoshin-abilities-table'),
      'ability',
      function (tr) { return tr.getAttribute('data-ability') || ''; }
    );

    // Master Class Abilities (your generated table uses .shoshin-gs-mc-table class in later versions;
    // if not present, we detect by header text)
    ensureImageColumn(
      panel.querySelector('.shoshin-gs-mc-table') || panel.querySelector('#shoshin-mc-abilities-table'),
      'ability',
      function (tr) {
        // Prefer data attribute if present
        var k = tr.getAttribute('data-ability');
        if (k) return k;
        // Fallback: first text cell after Image column insertion
        // After Image column insertion, Ability name is col 2
        // Robust: before image insert Ability is col1; after insert Ability is col2
        var td1 = tr.querySelector('td:nth-child(1)');
        var td2 = tr.querySelector('td:nth-child(2)');

        var a = td1 ? (td1.textContent || '').trim() : '';
        var b = td2 ? (td2.textContent || '').trim() : '';

        // Prefer a key that actually exists
        if (a && ICONS && ICONS.ability && ICONS.ability[a]) return a;
        if (b && ICONS && ICONS.ability && ICONS.ability[b]) return b;

        // Otherwise return best guess
        return b || a || '';


      }
    );

    // Included Proficiencies row table (if present)
ensureImageColumn(
  panel.querySelector('.shoshin-gs-included table'),
  'proficiency',
  function (tr) {
    // BEFORE image-col insert: col1 = Proficiency
    // AFTER  image-col insert: col2 = Proficiency
    var td2 = tr.querySelector('td:nth-child(2)');
    var td1 = tr.querySelector('td:nth-child(1)');

    var a = td2 ? (td2.textContent || '').trim() : '';
    var b = td1 ? (td1.textContent || '').trim() : '';

    // Prefer whichever value actually exists as a proficiency icon key
    if (a && ICONS && ICONS.proficiency && ICONS.proficiency[a]) return a;
    if (b && ICONS && ICONS.proficiency && ICONS.proficiency[b]) return b;

    // Fallback: return something stable
    return a || b || '';
  }
);


    // Armory / Dojo / Proficiencies / Munitions tables (these typically already include Image col)
    ensureImageColumn(panel.querySelector('#shoshin-melee-table'), 'melee', function (tr) { return tr.getAttribute('data-weapon') || ''; });
    ensureImageColumn(panel.querySelector('#shoshin-ranged-table'), 'ranged', function (tr) { return tr.getAttribute('data-weapon') || ''; });
    ensureImageColumn(panel.querySelector('#shoshin-armor-table'), 'armor', function (tr) { return tr.getAttribute('data-armor') || ''; });
    ensureImageColumn(panel.querySelector('#shoshin-support-table'), 'support', function (tr) { return tr.getAttribute('data-item') || ''; });
    shoshinAppendInchesToDistance(panel.querySelector('#shoshin-melee-table'));
    shoshinAppendInchesToDistance(panel.querySelector('#shoshin-ranged-table'));
    shoshinAppendInchesToDistance(panel.querySelector('#shoshin-armor-table'));
    shoshinAppendInchesToDistance(panel.querySelector('#shoshin-support-table'));

    shoshinEnsureClassColumns(panel.querySelector('#shoshin-armor-table'));
    shoshinEnsureClassColumns(panel.querySelector('#shoshin-support-table'));
    shoshinEnsureClassColumns(panel.querySelector('#shoshin-training-table'));


    ensureImageColumn(panel.querySelector('#shoshin-training-table'), 'training', function (tr) { return tr.getAttribute('data-training') || ''; });


    // Proficiency reference table
    ensureImageColumn(panel.querySelector('#shoshin-proficiency-table'), 'proficiency', function (tr) {
      var td = tr.querySelector('td:nth-child(2)'); // some versions store the name in col2; safe fallback
      if (!td) td = tr.querySelector('td:nth-child(1)');
      return td ? td.textContent : '';
    });

    // Munitions table (icons not provided → fallback used)
    ensureImageColumn(panel.querySelector('#shoshin-munitions-table'), 'munitions', function (tr) {

      // munitions names vary; fallback will apply
      var td = tr.querySelector('td:nth-child(1)');
      return td ? td.textContent : '';
    });

        // Support Assets — Training Requirements tables (use training icons)
    ensureImageColumn(panel.querySelector('#shoshin-support-ozutsu-training-table'), 'training', function (tr) {
      return tr.getAttribute('data-training') || '';
    });
    ensureImageColumn(panel.querySelector('#shoshin-support-wasen-training-table'), 'training', function (tr) {
      return tr.getAttribute('data-training') || '';
    });


        shoshinAppendInchesToDistance(panel.querySelector('#shoshin-munitions-table'));

  }


  // -----------------------------
  // Canonical static data
  // -----------------------------
var GS = {
  "tier1": [
    "Characters",
    "Armory",
    "Dojo",
    "Support Assets",
    "Yokai",
    "Tables"
  ],
  "tier2": {

    "Characters": [
      "Daimyo",
      "Samurai",
      "Ashigaru",
      "Sohei",
      "Ninja",
      "Onmyoji"
    ],
    "Armory": [
      "Melee Weapons",
      "Ranged Weapons",
      "Armor",
      "Support Items"
    ],
    "Dojo": [
      "Melee Ryu",
      "Ranged Ryu",
      "Specialized Ryu"
    ],
        "Support Assets": [
      "Taiho",
      "Wasen"
    ],

"Yokai": [
  "Oni",
  "Kitsune",
  "Tanuki",
  "Kappa",
  "Tengu",
  "Yurei",
  "Itsumade",
  "Ame-Onna",
  "Nure-onna",
  "Jubokko",
  "Tsuchigumo",
  "Gashadokuro",
  "Yuki-Onna",
  "Tokage no O",
  "Mizuchi"
],

"Tables": [
  "Movement",
  "Actions",
  "Combat Modifiers",
  "Saving Throws",
  "Object Classifications"
]
},

"tables": {
  "Movement": {
  "title": "Movement",
  "columns": ["Rule / Terrain", "Applies To", "Effect"],
  "rows": [
    ["Rough Terrain", "Small / Medium", "-1\" movement\nCavalry / Large+: unaffected"],
    ["Difficult Terrain", "Small / Medium", "-2\" movement\nCavalry: -4\"\nLarge+: unaffected"],
    ["Water (Swim)", "Small / Medium / Large", "Small/Medium unarmored: -3\"\nArmored: requires Suieijutsu\nCavalry: max 4\"\nLarge: halved\nHuge+: unaffected\nRestriction: Units without Suieijutsu cannot enter the terrain in the same turn; they must first stop at the terrain edge."],
    ["March", "All units", "Move up to base Movement"],
    ["Sprint", "All units", "Move up to 2× base Movement\nEnds turn"],
    ["Charge", "All units", "Move up to 1.5× base Movement to melee range\nImmediately make 1 melee attack\nEnds turn"],
    ["Climb", "All units", "Movement must end on a horizontal surface"],
    ["Overwatch", "Arquebus / Artillery", "Forgo movement to fire during enemy movement\nInterrupts movement on hit\nRestriction: No Extended Range"]
  ]
},
  "Actions": {
    "title": "Actions",
    "columns": ["Actions", "Target Roll", "Specification"],
    "rows": [
      ["Attack\n(Melee/Ranged)", "≥ Defense\n(target unit)", "Spend an action and roll against target unit's Defense (successive rolls)\nApply combat modifiers and follow To-Hit rules for Hit types"],
      ["Alert\n(Concealed)", "≥ Initiative\n(target unit)", "Spend an action and roll against target unit's Initiative (single roll)\nMust be within 2\" of hidden unit"],
      ["Douse Flames\n(Burning)", "n/a", "Spend an action to remove the Condition: Burning\nMay attempt a saving throw instead"],
      ["Arrest\n(Restrain)", "≥ Initiative", "Spend an action and roll against target unit's Initiative (single roll)\nHojojutsu training required and must be engaged"],
      ["Rescue\n(Restrained)", "≥ Initiative", "Spend an action and roll against restrained unit's Initiative (single roll)\nHojojutsu training required and must be engaged\nMay attempt to rescue self"],
      ["Decapitate\n(Restrained)", "> 1 'To-Hit'\n(unmodified)", "Spend an action as an Attack\nMust be engaged with Restrained unit\nKatana or Nodachi weapon required\nMust cause enough damage to kill Restrained unit\nAll enemy units within 3\" receive the Condition: Morale Check"],
      ["Move Object\n(up to 1\")", "≥ Resistance\n(Defense)", "Target object must be ≤ the unit’s base size\nMust be engaged with object\nNot a throwing mechanic"]
    ]
  },
  "Combat Modifiers": {
  "title": "Combat Modifiers",
  "columns": ["Modifier", "Applies To", "Effect"],
  "rows": [
    ["High Ground (≥1\")", "All attacks", "+1 To-Hit"],
    ["Mounted vs Unmounted", "All attacks", "+1 To-Hit"],
    ["Cavalry Piercer  (Yari/Naginata + Training)", "Melee attacks", "+1 To-Hit vs Cavalry"],
    ["Flank (first friendly striking; engaged)", "Melee attacks", "+1 To-Hit"],
    ["Nighttime", "Ranged attacks", "-1 To-Hit"],
    ["Partial Cover (≤50%)", "All attacks", "-1 To-Hit"],
    ["Charge Attack", "Melee attacks", "-1 To-Hit"],
    ["Extended Range", "Ranged attacks", "-1 To-Hit"]
  ]
},
  "Saving Throws": {
    "title": "Saving Throws",
    "columns": ["Condition", "Saving Throw", "Specification"],
    "rows": [
      ["Morale Check", "≤ Leadership", "Causes Condition: Routed"],
      ["Routed", "≤ Leadership", "Must sprint to nearest table edge\nRemove unit if it exits"],
      ["Stunned", "n/a", "Lose remaining movement/actions this round\nRemove condition at round end"],
      ["Concentration", "≤ Initiative", "Loss of ability effect\nSave only when damage is taken"],
      ["Frightened", "≤ Leadership", "Suffer -1 To-Hit penalty"],
      ["Poisoned", "≤ Body\n(current)", "Suffer 1 damage"],
      ["Bleeding", "≤ Body\n(current)", "Suffer 1 damage\nDo not remove condition if save is successful"],
      ["Burning", "≤ Defense", "Suffer 1 damage\nLasts up to two consecutive rounds\nWater automatically removes condition"],
      ["Resilience\n(Critical Hit)", "≤ Defense", "Make saving throw immediately upon Critical Hit\nNegate Critical Hit effect\nBase Defense '6' automatically grants Resilience"]
    ]
  },

  "Object Classifications": {
    "title": "Object Classifications",
    "columns": [
      "Type",
      "Resistance\n(Defense)",
      "Toughness\n(Body)",
      "Size",
      "Flammable",
      "Item",
      "Attributes"
    ],
    "rows": [
      ["Straw, Paper\nor Cloth", "1", "1", "1\"", "✓", "Bale of Hay / Fabric Curtain / Paper Lantern", "Provides light cover and may be easily burned."],
      ["Wood", "2", "2", "1\"", "✓", "Light Brush / Simple Door / Wooden Fence", "Provides light or heavy cover and may be easily burned."],
      ["Wood", "2", "4", "2\"", "✓", "Wooden Cart", "Provides cover but may be difficult to move."],
      ["Metal", "3", "3", "1\"", "--", "Metal Artifact", "Resistant to physical force."],
      ["Stone", "4", "4", "1\"", "--", "Small Boulder", "Difficult to move. Provides light cover."],
      ["Stone", "4", "8", "2\"", "--", "Medium Rock", "Very difficult to move. Provides light or heavy cover."],
      ["Stone", "4", "12", "3\"", "--", "Large Rock", "Extremely difficult to move. Provides heavy cover."],
      ["Mixed", "3", "4", "1\"", "✓", "Common Wall", "Made of mixed materials and easy to breach with brute force or fire."],
      ["Mixed", "3", "6", "2\"", "✓", "Castle Gate", "Heavy doors which are difficult to breach but are also susceptable to fire damage."],
      ["Stone", "4", "5", "1\"", "--", "Masonry Wall", "Resistant to physical force."],
      ["Stone", "4", "20", "4\"", "--", "Castle Wall", "Extremely difficult to breach."]
    ]
  }
},

  "characters": [
    {
      "class": "Daimyo",
      "display": "Daimyo",
      "cost": 25,
      "shortDesc": "Clan Lord",
      "longDesc": "Feudal landowner of any particular fief who is favored by the Shogun.",
      "attack": 3,
      "defense": 2,
      "movement": 4,
      "body": 4,
      "leadership": 4,
      "initiative": 4
    },
    {
      "class": "Samurai",
      "display": "Samurai",
      "cost": 12,
      "shortDesc": "Hereditary Military Noble",
      "longDesc": "Retainers with high prestige and special privileges that serve as clan warriors.",
      "attack": 2,
      "defense": 2,
      "movement": 4,
      "body": 3,
      "leadership": 4,
      "initiative": 3
    },
    {
      "class": "Ashigaru",
      "display": "Ashigaru",
      "cost": 3,
      "shortDesc": "Peasant Conscripts",
      "longDesc": "Local farmers who become foot soldiers when needed.",
      "attack": 1,
      "defense": 2,
      "movement": 4,
      "body": 2,
      "leadership": 2,
      "initiative": 2
    },
    {
      "class": "Sohei",
      "display": "Sohei",
      "cost": 9,
      "shortDesc": "Buddhist Warrior Monks",
      "longDesc": "Highly skilled martial artists that also possess knowledge of traditional medicines.",
      "attack": 1,
      "defense": 2,
      "movement": 4,
      "body": 2,
      "leadership": 3,
      "initiative": 3
    },
    {
      "class": "Ninja",
      "display": "Ninja",
      "cost": 11,
      "shortDesc": "Stealth Assassins",
      "longDesc": "Masters of espionage and unconventional tactics.",
      "attack": 1,
      "defense": 2,
      "movement": 4,
      "body": 3,
      "leadership": 3,
      "initiative": 3
    },
    {
      "class": "Onmyoji",
      "display": "Onmyoji",
      "cost": 10,
      "shortDesc": "Spiritual Diviners",
      "longDesc": "Ritualistic practitioners who commune with ethereal allies.",
      "attack": 1,
      "defense": 2,
      "movement": 4,
      "body": 2,
      "leadership": 4,
      "initiative": 3
    }
  ],
  "masterClasses": {
    "Daimyo": [
      {
        "ability": "Fury of the Rising Sun",
        "effect": "If a melee attack successfully dispatches an enemy unit, the daimyo may immediately make another melee attack against an enemy within melee weapon range. Repeat this process until an attack is unsuccessful at killing an enemy unit."
      },
      {
        "ability": "Zen Restoration",
        "effect": "Once per game, whenever the daimyo\u2019s Body is reduced to 0, it will return to 1 instead of removing the daimyo from the game."
      }
    ],
    "Samurai": [
      {
        "ability": "Arms Master",
        "effect": "Once per round, this unit may take one additional action in the same turn, resolved immediately after its current action."
      },
      {
        "ability": "Transcendence",
        "effect": "Critical Misses automatically become Lucky Hits."
      }
    ],
    "Ashigaru": [
      {
        "ability": "Eagle Eye",
        "effect": "Ranged attacks ignore cover / nighttime penalties and critical misses do not cause friendly fire."
      },
      {
        "ability": "Collective Cohort",
        "effect": "Up to three (3) other friendly ashigaru units within 2\u201d of the cohort unit may move and act immediately one after the other during the same turn."
      }
    ],
    "Sohei": [
      {
        "ability": "Way of the Fist",
        "effect": "When attempting a melee attack, roll 2 dice simultaneously and choose one of the values (Unarmed Combat only)."
      },
      {
        "ability": "Ki Fortitude",
        "effect": "Absorb (negate) 1 Damage once per game. This passive ability and does not count against the Sohei's actions."
      }
    ],
    "Ninja": [
      {
        "ability": "Critical Precision",
        "effect": "Critical Hits occur on natural rolls of 5 or 6."
      },
      {
        "ability": "Uncanny Dodge",
        "effect": "Spend an action to negate a successful hit."
      }
    ],
    "Onmyoji": [
      {
        "ability": "Thaumaturgy",
        "effect": "Using abilities will not break concentration and more than one ability may be used concurrently (abilities must be learned)."
      },
      {
        "ability": "Spiritual Communion",
        "effect": "May use Beyond the Veil twice per game but only one summoned yokai may be in play at a time (ability must be learned)."
      }
    ]
  },

  "yokai": [
    {
      "class": "Oni",
      "display": "Oni",
      "shortDesc": "Malevolent Demon",
      "longDesc": "Towering in stature with grotesque features and horns protruding from their heads, these malevolent beings strike fear into the hearts of mortals.",
      "size": "Large",
      "image": "/wp-content/uploads/2026/04/oni_colorized.jpg",
      "meleeDamage": "1d2",
      "meleeCritical": "Morale Check",
      "meleeDistance": "Engaged",
      "rangedDamage": "--",
      "rangedCritical": "--",
      "rangedDistance": "--",
      "attack": 2,
      "defense": 4,
      "movement": 4,
      "body": 4,
      "leadership": "--",
      "initiative": 2
    },
    {
      "class": "Kitsune",
      "display": "Kitsune",
      "shortDesc": "Nine-tailed Fox Spirit",
      "longDesc": "These wily fox spirits are renowned for their abilities for creating atmospheric ghost lights as well as their cunning nature for imitating mortals.",
      "size": "Medium",
      "image": "/wp-content/uploads/2026/04/kitsune_colorized.jpg",
      "meleeDamage": "Stun",
      "meleeCritical": "1",
      "meleeDistance": "Engaged",
      "rangedDamage": "--",
      "rangedCritical": "--",
      "rangedDistance": "--",
      "attack": 1,
      "defense": 5,
      "movement": 6,
      "body": 2,
      "leadership": "--",
      "initiative": 4
    },
    {
      "class": "Tanuki",
      "display": "Tanuki",
      "shortDesc": "Mischievous Raccoon-dog",
      "longDesc": "Often depicted as raccoon dogs, they possess a jovial and prankish nature, using illusion to bewitch and deceive.",
      "size": "Small",
      "image": "/wp-content/uploads/2026/04/tanuki3_colorized.jpg",
      "meleeDamage": "Stun",
      "meleeCritical": "1",
      "meleeDistance": "Engaged",
      "rangedDamage": "--",
      "rangedCritical": "--",
      "rangedDistance": "--",
      "attack": 1,
      "defense": 2,
      "movement": 4,
      "body": 1,
      "leadership": "--",
      "initiative": 3
    },
    {
      "class": "Kappa",
      "display": "Kappa (x4)",
      "shortDesc": "Turtle-like Water Demons",
      "longDesc": "Mischievous creatures that inhabit watery realms, they are known for their love of sumo wrestling and for their obsession with cucumbers.",
      "size": "Small",
      "image": "/wp-content/uploads/2026/02/kappa_colorized.jpg",
      "meleeDamage": "1",
      "meleeCritical": "1",
      "meleeDistance": "Engaged",
      "rangedDamage": "--",
      "rangedCritical": "--",
      "rangedDistance": "--",
      "attack": 1,
      "defense": 2,
      "movement": 3,
      "body": 1,
      "leadership": "--",
      "initiative": 1
    },
    {
      "class": "Tengu",
      "display": "Tengu",
      "shortDesc": "Avian Warrior",
      "longDesc": "With their enigmatic presence, they add an air of mystery, and are known to be masters of martial arts.",
      "size": "Medium",
      "image": "/wp-content/uploads/2026/04/tengu2_colorized.jpg",
      "meleeDamage": "1",
      "meleeCritical": "1",
      "meleeDistance": "Engaged",
      "rangedDamage": "1",
      "rangedCritical": "1",
      "rangedDistance": "9\"",
      "attack": 2,
      "defense": 4,
      "movement": 7,
      "body": 3,
      "leadership": "--",
      "initiative": 3
    },
    {
      "class": "Yurei",
      "display": "Yurei",
      "shortDesc": "Tormented Spirit",
      "longDesc": "Ghosts bound to the earthly realm by unresolved emotions, they are known to haunt the living and inflict their sorrow upon those who encounter them.",
      "size": "Medium",
      "image": "/wp-content/uploads/2026/04/yurei2_colorized.jpg",
      "meleeDamage": "--",
      "meleeCritical": "--",
      "meleeDistance": "--",
      "rangedDamage": "--",
      "rangedCritical": "--",
      "rangedDistance": "--",
      "attack": "--",
      "defense": 6,
      "movement": 5,
      "body": 3,
      "leadership": "--",
      "initiative": 5
    },
    {
      "class": "Itsumade",
      "display": "Itsumade",
      "shortDesc": "Fire-breathing Bird Demon",
      "longDesc": "A monstrous bird with a serpent-like tail and the ability to breathe fire, it is feared for its destructive power and ominous cries.",
      "size": "Huge",
      "image": "/wp-content/uploads/2026/04/itsumade3_colorized.jpg",
      "meleeDamage": "1",
      "meleeCritical": "Burn",
      "meleeDistance": "Engaged",
      "rangedDamage": "Burn",
      "rangedCritical": "1",
      "rangedDistance": "3\"",
      "attack": 1,
      "defense": 3,
      "movement": 18,
      "body": 5,
      "leadership": "--",
      "initiative": 3
    },
    {
      "class": "Ame-Onna",
      "display": "Ame-Onna",
      "shortDesc": "Rain Witch",
      "longDesc": "A ghostly figure drenched in rain, she wanders deserted streets on stormy nights, seeking shelter from the downpour.",
      "size": "Medium",
      "image": "/wp-content/uploads/2026/04/ame-onna_colorized.jpg",
      "meleeDamage": "1",
      "meleeCritical": "Fear",
      "meleeDistance": "Engaged",
      "rangedDamage": "--",
      "rangedCritical": "--",
      "rangedDistance": "--",
      "attack": 1,
      "defense": 4,
      "movement": 3,
      "body": 2,
      "leadership": "--",
      "initiative": 2
    },
    {
      "class": "Nure-onna",
      "display": "Nure-onna",
      "shortDesc": "Snake Witch",
      "longDesc": "A serpentine creature with the head of a woman, it is known to lure unsuspecting victims and drain them of their life force.",
      "size": "Medium",
      "image": "/wp-content/uploads/2026/02/nure-onna_colorized.jpg",
      "meleeDamage": "1",
      "meleeCritical": "Poison",
      "meleeDistance": "Engaged",
      "rangedDamage": "--",
      "rangedCritical": "--",
      "rangedDistance": "--",
      "attack": 2,
      "defense": 4,
      "movement": 5,
      "body": 2,
      "leadership": "--",
      "initiative": 2
    },
    {
      "class": "Jubokko",
      "display": "Jubokko",
      "shortDesc": "Vampiric Tree Spirit",
      "longDesc": "A monstrous tree that preys on humans by draining their blood, it is said to lurk in forests and ensnare victims with its branches.",
      "size": "Huge",
      "image": "/wp-content/uploads/2026/02/jubokko_colorized.jpg",
      "meleeDamage": "Stun",
      "meleeCritical": "1d2",
      "meleeDistance": "2\"",
      "rangedDamage": "--",
      "rangedCritical": "--",
      "rangedDistance": "--",
      "attack": 3,
      "defense": 3,
      "movement": 2,
      "body": 5,
      "leadership": "--",
      "initiative": 3
    },
    {
      "class": "Tsuchigumo",
      "display": "Tsuchigumo",
      "shortDesc": "Giant Spider Demon",
      "longDesc": "A massive spider-like demon that weaves webs to trap its prey, it is feared for its strength and the ability to ensnare even the strongest warriors.",
      "size": "Huge",
      "image": "/wp-content/uploads/2026/04/tsuchigumo_colorized.jpg",
      "meleeDamage": "Restrained",
      "meleeCritical": "1",
      "meleeDistance": "Engaged",
      "rangedDamage": "--",
      "rangedCritical": "--",
      "rangedDistance": "--",
      "attack": 2,
      "defense": 4,
      "movement": 4,
      "body": 4,
      "leadership": "--",
      "initiative": 2
    },
    {
      "class": "Gashadokuro",
      "display": "Gashadokuro",
      "shortDesc": "Gigantic Skeletal Titan",
      "longDesc": "A colossal skeleton formed from the amassed bones of the dead, it seeks to devour any unfortunate souls who cross its path.",
      "size": "Gargantuan",
      "image": "/wp-content/uploads/2026/04/gashadokuro_colorized.jpg",
      "meleeDamage": "1d3",
      "meleeCritical": "1",
      "meleeDistance": "1\"",
      "rangedDamage": "--",
      "rangedCritical": "--",
      "rangedDistance": "--",
      "attack": 3,
      "defense": 3,
      "movement": 3,
      "body": 5,
      "leadership": "--",
      "initiative": 2
    },
    {
      "class": "Yuki-Onna",
      "display": "Yuki-Onna",
      "shortDesc": "Snow Witch",
      "longDesc": "A spirit of snow and ice, she appears as a beautiful woman and is said to freeze her victims to death with her chilling presence.<br>(This yokai is part of the Chimamire No Yuki: Blood and Snow campaign by Patrick Durkin.)",
      "size": "Medium",
      "image": "/wp-content/uploads/2026/02/yuki-onna_colorized.jpg",
      "meleeDamage": "1",
      "meleeCritical": "Stun",
      "meleeDistance": "Engaged",
      "rangedDamage": "--",
      "rangedCritical": "--",
      "rangedDistance": "--",
      "attack": 1,
      "defense": 4,
      "movement": 3,
      "body": 2,
      "leadership": "--",
      "initiative": 2
    },
    {
      "class": "Tokage no O",
      "display": "Tokage no O",
      "shortDesc": "The Lizard King",
      "longDesc": "A legendary reptilian monarch, feared for its immense power and toxicity, it brings catastrophe wherever it roams.<br>(This yokai is part of the Tokage-ō no Kyōfu: Terror of the Lizard King campaign by Adam Saris.)",
      "size": "Colossal",
      "image": "/wp-content/uploads/2026/02/tokage_colorized.jpg",
      "meleeDamage": "1d3",
      "meleeCritical": "1",
      "meleeDistance": "Engaged",
      "rangedDamage": "1d6",
      "rangedCritical": "Poison",
      "rangedDistance": "12\"",
      "attack": 4,
      "defense": 4,
      "movement": 3,
      "body": 12,
      "leadership": "--",
      "initiative": 2
    },
    {
      "class": "Mizuchi",
      "display": "Mizuchi",
      "shortDesc": "Water Dragon",
      "longDesc": "A powerful serpent-like dragon associated with rivers and lakes, it is revered and feared for its ability to control water and bring floods.",
      "size": "Gargantuan",
      "image": "/wp-content/uploads/2026/02/mizuchi_colorized.jpg",
      "meleeDamage": "1d2",
      "meleeCritical": "Poison",
      "meleeDistance": "Engaged",
      "rangedDamage": "--",
      "rangedCritical": "--",
      "rangedDistance": "--",
      "attack": 3,
      "defense": 5,
      "movement": 9,
      "body": 8,
      "leadership": "--",
      "initiative": 4
    }
  ],

  "yokaiAbilities": {
    "Oni": [
      {
        "ability": "Aura of Fear",
        "effect": "Engaged enemy units receive Condition: Frightened and must make a Fear Check each round until they pass. If they disengage and re-engage, the sequence resets."
      },
      {
        "ability": "Immunity: Fear",
        "effect": "Cannot be affected by Fear or fear-based effects."
      }
    ],
    "Kitsune": [
      {
        "ability": "Resilience",
        "effect": "May attempt to immediately Save vs Critical Hits."
      },
      {
        "ability": "Uncanny Dodge",
        "effect": "Spend an action to negate a successful hit."
      },
      {
        "ability": "Light-Footed",
        "effect": "Disengaging does not provoke Opportunity Attacks."
      },
      {
        "ability": "Luminous Snare",
        "effect": "Enemy units engaged with Kitsune cannot disengage."
      }
    ],
    "Tanuki": [
      {
        "ability": "Shapeshift",
        "effect": "During the Initiative Phase, Tanuki may transform into a non-cavalry Samurai worth up to 20 points. Replace the model with a Samurai model. Size increases to Medium when in Samurai form. When the Samurai form is dispatched, Tanuki reappears in its original state. Tanuki must remain in its native form for one full round before shapeshifting again. Each transformation may be into a different loadout."
      }
    ],
    "Tengu": [
      {
        "ability": "Flight",
        "effect": "Ignores all ground-based terrain during movement."
      },
      {
        "ability": "Arms Master",
        "effect": "Once per round, this unit may take one additional action in the same turn, resolved immediately after its current action."
      }
    ],
    "Kappa": [
      {
        "ability": "Aquatic Assembly",
        "effect": "When summoned, all 4 Kappa appear together within 2 inches of each other."
      },
      {
        "ability": "Collective Cohort",
        "effect": "Up to three (3) other friendly kappa units within 2\u201d of the cohort unit may move and act immediately one after the other during the same turn."
      },
      {
        "ability": "Aquatic Agility",
        "effect": "Ignores water terrain penalties and gains +6 inches movement immediately upon entering water terrain. This bonus applies only while in water."
      }
    ],
    "Yurei": [
      {
        "ability": "Aura of Despair",
        "effect": "At the end of its movement, all enemy units within 2 inches of Yurei receive the Morale Check condition."
      },
      {
        "ability": "Phase Shift",
        "effect": "May move through objects as long as it has enough movement for its base to clear the obstacle."
      },
      {
        "ability": "Haunting Influence",
        "effect": "May perform general actions (opening doors, manipulating objects, capturing items) despite being ethereal."
      },
      {
        "ability": "Spectral Immunity",
        "effect": "Immune to all Critical Hits and Special Conditions."
      }
    ],
    "Itsumade": [
      {
        "ability": "Flight",
        "effect": "Ignores all ground obstacles during movement."
      },
      {
        "ability": "Breath of Fire",
        "effect": "Its ranged attacks affect all units within a 3-inch, 60° cone AOE. Units fully behind stone or metal barriers are exempt."
      },
      {
        "ability": "Immunity: Burn",
        "effect": "Cannot be ignited by fire arrows, burning objects, or flame attacks."
      }
    ],
    "Ame-Onna": [
      {
        "ability": "Stormcaller’s Gift",
        "effect": "All units (except Ame-Onna) within 4 inches follow difficult terrain rules, even when standing on dry land."
      },
      {
        "ability": "Immunity: Burn",
        "effect": "Cannot be ignited by fire arrows, burning objects, or flame attacks."
      }
    ],
    "Nure-onna": [
      {
        "ability": "Critical Precision",
        "effect": "Critical Hits occur on natural rolls of 5 or 6."
      },
      {
        "ability": "Immunity: Poison",
        "effect": "Cannot be affected by Poison or poison-based effects."
      }
    ],
    "Jubokko": [
      {
        "ability": "Lashing Tendrils",
        "effect": "Each attack attempt is treated as a separate action, independent of the previous result. These may be split between different targets"
      },
      {
        "ability": "Cumbersome",
        "effect": "May not Charge or Sprint."
      },
      {
        "ability": "Immunity: Stun",
        "effect": "Cannot be affected by Stun or stun-based effects."
      },
      {
        "ability": "Immunity: Bleed",
        "effect": "Cannot be affected by Bleed or bleed-based effects."
      }
    ],
    "Tsuchigumo": [
      {
        "ability": "Web of Entanglement",
        "effect": "Restrained conditions caused by Tsuchigumo immediately disappear if Tsuchigumo leaves play."
      },
      {
        "ability": "Cumbersome",
        "effect": "May not Charge or Sprint."
      },
      {
        "ability": "Immunity: Fear",
        "effect": "Cannot be affected by Fear or fear-based effects."
      },
      {
        "ability": "Immunity: Bleed",
        "effect": "Cannot be affected by Bleed or bleed-based effects."
      }
    ],
    "Gashadokuro": [
      {
        "ability": "Aura of Fear",
        "effect": "Engaged enemy units receive Condition: Frightened and must make a Fear Check each round until they pass. If they disengage and re-engage, the sequence resets."
      },
      {
        "ability": "Cumbersome",
        "effect": "May not Charge or Sprint."
      },
      {
        "ability": "Immunity: Fear",
        "effect": "Cannot be affected by Fear or fear-based effects."
      },
      {
        "ability": "Immunity: Poison",
        "effect": "Cannot be affected by Poison or poison-based effects."
      },
      {
        "ability": "Immunity: Bleed",
        "effect": "Cannot be affected by Bleed or bleed-based effects."
      }
    ],
    "Yuki-Onna": [
      {
        "ability": "Blizzard’s Embrace",
        "effect": "All units (except Yuki-Onna) within 4 inches are subjected to Condition: Mired. During each Resolution Phase, they must roll 1d6: on a 1, they remain immobilized; on any 6, they break free and remove the condition."
      },
      {
        "ability": "Immunity: Burn",
        "effect": "Cannot be ignited by fire arrows, burning objects, or flame attacks."
      }
    ],
    "Tokage no O": [
      {
        "ability": "Deep Focus",
        "effect": "Requires two full rounds of uninterrupted concentration to summon."
      },
      {
        "ability": "Tailwhip",
        "effect": "Once per game, spend an action to make individual melee attack rolls against all units within a 3-inch, 60° cone AOE.<br><b>Restriction:</b> Units fully covered by stone/metal are exempt (unless destroyed beforehand)."
      },
      {
        "ability": "Corrosive Breath",
        "effect": "As its ranged attack, may strike multiple units along a 1-inch line AOE (following Iron Cannonball rules).<br><b>Recharge:</b> Requires 3 full rounds of cooldown. Passive ability; does not require reload.<br><b>Extended Range:</b> −1 To-Hit from 12” up to 18”."
      },
      {
        "ability": "Toxic Aura",
        "effect": "Engaged enemy units receive Condition: Poision and must make a Poison Check each round until they pass. If they disengage and re-engage, the sequence resets."
      },
      {
        "ability": "Aquatic Agility",
        "effect": "Ignores water terrain penalties and gains +6 inches movement immediately upon entering water terrain. This bonus applies only while in water."
      },
      {
        "ability": "Cumbersome",
        "effect": "May not Charge or Sprint."
      },
      {
        "ability": "Immunity: Fear",
        "effect": "Cannot be affected by Fear or fear-based effects."
      },
      {
        "ability": "Immunity: Stun",
        "effect": "Cannot be affected by Stun or stun-based effects."
      },
      {
        "ability": "Immunity: Poison",
        "effect": "Cannot be affected by Poison or poison-based effects."
      },
      {
        "ability": "Immunity: Burn",
        "effect": "Cannot be ignited by fire arrows, burning objects, or flame attacks."
      }
    ],
    "Mizuchi": [
      {
        "ability": "Deep Focus",
        "effect": "Requires two full rounds of uninterrupted concentration to summon."
      },
      {
        "ability": "Leeching Blow",
        "effect": "Heals 1 Body each time Mizuchi dispatches a unit with its first attack roll."
      },
      {
        "ability": "Unwavering",
        "effect": "Critical Misses are treated as Normal Misses."
      },
      {
        "ability": "Flood",
        "effect": "All units within 4 inches of Mizuchi follow water terrain rules if Mizuchi is located within 4 inches of any water terrain."
      },
      {
        "ability": "Aquatic Agility",
        "effect": "Ignores water terrain penalties and gains +6 inches movement immediately upon entering water terrain. This bonus applies only while in water."
      },
      {
        "ability": "Immunity: Fear",
        "effect": "Cannot be affected by Fear or fear-based effects."
      },
      {
        "ability": "Immunity: Stun",
        "effect": "Cannot be affected by Stun or stun-based effects."
      },
      {
        "ability": "Immunity: Burn",
        "effect": "Cannot be ignited by fire arrows, burning objects, or flame attacks."
      }
    ]
  }
};

  // -----------------------------------------------------------------------------------
  // Tier 2 Info Copy (static)
  // Displays a text block between Filters and the main Panel, based on active Tier2.
  // Empty/missing entries render nothing.
  // -----------------------------------------------------------------------------------
  
    // Tier2 Key (static legend). Keep this OUTSIDE TIER2_INFO so it can be appended safely.
  var TIER2_INFO_KEY =
    '<div class="shoshin-gs-class-key">' +
      '<span class="k k-avail">✓</span> = available, ' +
      '<span class="k k-na">--</span> = n/a, ' +
      '<span class="k k-free">✓</span> = one for free, ' +
      '<span class="k k-zero">0</span> = free, ' +
      '<span class="k k-half">½</span> = one-half cost, ' +
      '<span class="k k-double">x2</span> = double-cost' +
    '</div>';

    var TIER2_INFO = {
    Characters: {
      'Daimyo': 'Clan leaders favored by the Shogun. Tactical anchors who command and shape the battlefield through presence and authority.',
      'Samurai': 'Elite retainers with high prestige that serve as clan warriors. Disciplined, durable, and decisive in direct engagements.',
      'Ashigaru': 'Local farmers who become foot soldiers when needed. Flexible, cost-effective, and mission-driven.',
      'Sohei': 'Highly skilled martial artists and spiritual warriors who possess knowledge of traditional medicines.',
      'Ninja': 'Masters of espionage and unconventional tactics such as infiltration, disruption, and assassination.',
      'Onmyoji': 'Mystics and ritualists who bend fate through wards, omens, and communion with ethereal allies.'
    },

Armory: {
      'Melee Weapons': 'Close-combat armaments, profiles, and keywords. Reference the Image column for quick identification.',
      'Ranged Weapons': 'Distance-based weapons and profiles. Use the Distance column as your quick range reference.',
      'Armor': 'Protective gear and defensive profiles. Built to support different playstyles and durability tiers.' + TIER2_INFO_KEY,
      'Support Items': 'Utility assets that reinforce tactics—mobility, survivability, control, and mission support.'+ TIER2_INFO_KEY
    },

    Dojo: {

      'Melee Ryu': 'Schools of close combat—stances, doctrines, and techniques for blade and body.'+ TIER2_INFO_KEY,
      'Ranged Ryu': 'Disciplines focused on bows, thrown weapons, and battlefield marksmanship.'+ TIER2_INFO_KEY,
      'Specialized Ryu': 'Unorthodox schools and niche disciplines—situational mastery and asymmetric tools.'+ TIER2_INFO_KEY
    },

// BEGIN SHOSHIN PATCH — TASK2 TIER2_INFO.Tables
Tables: {
  'Movement': 'Movement types and terrain modifiers used during play.',
  'Actions': 'Core action definitions and requirements used during play.',
  'Combat Modifiers': 'Common To-Hit modifiers and situational combat adjustments.',
  'Saving Throws': 'Standardized saving throw types, triggers, and outcomes.',
  'Object Classifications': 'Object categories and how they interact with rules and effects.'
},
// END SHOSHIN PATCH — TASK2 TIER2_INFO.Tables

    
    'Support Assets': {
      'Taiho': 'Artillery and munitions support. Heavy battlefield tools with unique handling and pairing rules.',
      'Wasen': 'Sailing ships and naval assets. Use these profiles for water combat and scenario play.'
    },

Yokai: {
  'Oni': 'Towering in stature with grotesque features and horns protruding from their heads, these malevolent beings strike fear into the hearts of mortals.',
  'Kitsune': 'These wily fox spirits are renowned for their abilities for creating atmospheric ghost lights as well as their cunning nature for imitating mortals.',
  'Tanuki': 'Often depicted as raccoon dogs, they possess a jovial and prankish nature, using illusion to bewitch and deceive.',
  'Kappa': 'Mischievous creatures that inhabit watery realms, they are known for their love of sumo wrestling and for their obsession with cucumbers.',
  'Tengu': 'With their enigmatic presence, they add an air of mystery, and are known to be masters of martial arts.',
  'Yurei': 'Ghosts bound to the earthly realm by unresolved emotions, they haunt the living and inflict their sorrow on those they encounter.',
  'Itsumade': 'A monstrous bird with a serpent-like tail and the ability to breathe fire, it is feared for its destructive power and ominous cries.',
  'Ame-Onna': 'A ghostly figure drenched in rain, she wanders deserted streets on stormy nights, seeking shelter from the downpour.',
  'Nure-onna': 'A serpentine creature with the head of a woman, it is known to lure unsuspecting victims and drain them of their life force.',
  'Jubokko': 'A monstrous tree that preys on humans by draining their blood, it is said to lurk in forests and ensnare victims with its branches.',
  'Tsuchigumo': 'A massive spider-like demon that weaves webs to trap its prey, it is feared for its strength and the ability to ensnare even the strongest warriors.',
  'Gashadokuro': 'A colossal skeleton formed from the amassed bones of the dead, it seeks to devour any unfortunate souls who cross its path.',
  'Yuki-Onna': 'A spirit of snow and ice, she appears as a beautiful woman and is said to freeze her victims to death with her chilling presence.<br>(This yokai is part of the Chimamire No Yuki: Blood and Snow campaign by Patrick Durkin.)',
  'Tokage no O': 'A legendary reptilian monarch, feared for its immense power and toxicity, it brings catastrophe wherever it roams.<br>(This yokai is part of the Tokage-ō no Kyōfu: Terror of the Lizard King campaign by Adam Saris.)',
  'Mizuchi': 'A powerful serpent-like dragon associated with rivers and lakes, it is revered and feared for its ability to control water and bring floods.<br>(This yokai was developed as a special addition for early supporters of the Kickstarter Campaign.)'
}



  };


  // Reuse canonical data from existing site JS (safe if present)
  var Shoshin = window.Shoshin || (window.Shoshin = {});
  var Data = Shoshin.Data || (Shoshin.Data = {});

  // Prefer canonical meta/images if present; otherwise fill missing keys with defaults (do NOT overwrite).
  Data.CLASS_META = Data.CLASS_META || {};
  Data.CLASS_IMAGES = Data.CLASS_IMAGES || {};

  var DEFAULT_CLASS_META = {
    Daimyo: { size: 'Medium', displayName: 'Daimyo', description: '<em>Clan Lord</em>' },
    Samurai: { size: 'Medium', displayName: 'Samurai', description: '<em>Military Noble</em>' },
    Ashigaru: { size: 'Medium', displayName: 'Ashigaru', description: '<em>Peasant Conscript</em>' },
    Sohei: { size: 'Medium', displayName: 'Sohei', description: '<em>Buddhist Warrior Monk</em>' },
    Ninja: { size: 'Medium', displayName: 'Ninja', description: '<em>Stealth Operative</em>' },
    Onmyoji: { size: 'Medium', displayName: 'Onmyoji', description: '<em>Spiritual Diviner</em>' },

    // Support Assets buckets
    Taiho: { size: 'Large', displayName: 'Taiho', description: '<em>Seige Cannon</em>' },
    Wasen: { size: 'Variable', displayName: 'Wasen', description: '<em>Wooden Sailing Ship</em>' }
  };

  var DEFAULT_CLASS_IMAGES = {
    default: FALLBACK_IMAGE,

    Daimyo: '/wp-content/uploads/2026/02/daimyo_colorized.jpg',
    Samurai: '/wp-content/uploads/2026/02/samurai_colorized.jpg',
    Ashigaru: '/wp-content/uploads/2026/02/ashigaru_colorized.jpg',
    Sohei: '/wp-content/uploads/2026/02/sohei_colorized.jpg',
    Ninja: '/wp-content/uploads/2026/02/ninja_colorized2.jpg',
    Onmyoji: '/wp-content/uploads/2026/02/onmyoji_colorized.jpg',

    Taiho: '/wp-content/uploads/2026/02/ozutsu_colorized.jpg',
    Wasen: '/wp-content/uploads/2026/02/kobaya_colorized.jpg'
  };

  // Merge defaults → existing (deep fill; do NOT overwrite intentional values)
  Object.keys(DEFAULT_CLASS_META).forEach(function (k) {
    var def = DEFAULT_CLASS_META[k];
    var cur = Data.CLASS_META[k];

    // If missing or wrong type, take the whole default
    if (!cur || typeof cur !== 'object') {
      Data.CLASS_META[k] = def;
      return;
    }

    // Fill missing fields (handles cur = {} case)
    if (!cur.size) cur.size = def.size;
    if (!cur.displayName) cur.displayName = def.displayName;
    if (!cur.description) cur.description = def.description;
  });

  Object.keys(DEFAULT_CLASS_IMAGES).forEach(function (k) {
    var curImg = Data.CLASS_IMAGES[k];

    // Fill if missing/empty OR wrong type (handles curImg = {} case)
    if (!curImg || typeof curImg !== 'string') {
      Data.CLASS_IMAGES[k] = DEFAULT_CLASS_IMAGES[k];
    }
  });

// v41 is authoritative for these class avatar images (override canonical site defaults)
[
  'Daimyo',
  'Samurai',
  'Ashigaru',
  'Sohei',
  'Ninja',
  'Onmyoji',
  'Taiho',
  'Wasen'
].forEach(function (k) {
  if (DEFAULT_CLASS_IMAGES[k]) Data.CLASS_IMAGES[k] = DEFAULT_CLASS_IMAGES[k];
});

  // Included proficiencies (display row above Character Abilities)
  // NOTE: These are "class proficiencies" (not Ryū training). Yokai will not use this row.
  var INCLUDED_PROFICIENCIES = {
    Daimyo: ['Ancestral Prestige', 'Martial Mastery'],
    Samurai: ['Sword Master'],
    Ashigaru: ['General Ineptitude'],
    Sohei: ['Martial Artist', 'Polearms Adept'],
    Ninja: ['Espionage Expert'],
    Onmyoji: ['Mysticism and Ritualism']
  };

  // Canonical short descriptions used in the "Included Proficiencies" row
  // (Matches the Proficiencies reference table content below.)
  var PROFICIENCY_DESC = {
    'Ancestral Prestige': 'May choose any armor at one-half points cost.',
    'Martial Mastery': 'May train any one proficiency for free.',
    'Sword Master': 'Pays one-half points cost to train either Kenjutsu or Iaijutsu.',
    'General Ineptitude': 'Pays double points cost to train any available proficiency.',
    'Martial Artist': 'Proficient in Jujutsu (free).',
    'Polearms Adept': 'Pays one-half points cost to train either Sojutsu or Naginatajutsu.',
    'Espionage Expert': 'Proficient in Ninjutsu (included).',
    'Mysticism and Ritualism': 'Proficient in Onmyodo (included).'
  };




  // Canonical class rules (abilities allowlists, etc.)
  var CLASS_RULES = {
    'Daimyo': {
      abilities: ['Divine Inspiration'],
      ranged: ['Shuriken', 'Fukiya', 'Hankyu', 'Daikyu', 'Tanegashima', 'Ozutsu', 'Houroku-Hiya'],
      armor: ['Do-maru', 'O-yoroi', 'Tosei-gusoku'],
      support: ['Shirube', 'Kanpo', 'Shakuhachi', 'Sashimono', 'Emakimono', 'Torinawa', 'Uma'],
      training: [
        'Jujutsu','Juttejutsu','Bojutsu','Tantojutsu','Kusarigamajutsu','Mojirijutsu','Sojutsu','Kenjutsu',
        'Naginatajutsu','Iaijutsu','Shurikenjutsu','Fukumibarijutsu','Kyujutsu','Kayakujutsu','Hojojutsu',
        'Suieijutsu','Bajutsu'
      ]
    },
    'Samurai': {
      abilities: ['Honor Duel'],
      ranged: ['Shuriken', 'Fukiya', 'Hankyu', 'Daikyu', 'Tanegashima', 'Ozutsu', 'Houroku-Hiya'],
      armor: ['Do-maru', 'O-yoroi', 'Tosei-gusoku'],
      support: ['Shirube', 'Kanpo', 'Shakuhachi', 'Sashimono', 'Emakimono', 'Torinawa', 'Uma'],
      training: [
        'Jujutsu','Juttejutsu','Bojutsu','Tantojutsu','Kusarigamajutsu','Mojirijutsu','Sojutsu','Kenjutsu',
        'Naginatajutsu','Iaijutsu','Shurikenjutsu','Fukumibarijutsu','Kyujutsu','Kayakujutsu','Hojojutsu',
        'Suieijutsu','Bajutsu'
      ]
    },
    'Ashigaru': {
      abilities: [],
      ranged: ['Shuriken', 'Fukiya', 'Hankyu', 'Daikyu', 'Tanegashima', 'Ozutsu', 'Houroku-Hiya'],
      armor: ['Do-maru'],
      support: ['Shirube', 'Kanpo', 'Shakuhachi', 'Sashimono', 'Emakimono'],
      training: [
        'Jujutsu','Juttejutsu','Bojutsu','Mojirijutsu','Sojutsu','Naginatajutsu','Shurikenjutsu',
        'Fukumibarijutsu','Kyujutsu','Kayakujutsu','Suieijutsu'
      ]
    },
    'Sohei': {
      abilities: ['Iron Fists', 'Missile Deflection', 'Ki Endurance', 'Heal'],
      ranged: ['Shuriken', 'Fukiya', 'Hankyu', 'Daikyu', 'Tanegashima', 'Ozutsu', 'Houroku-Hiya'],
      armor: ['Do-maru', 'O-yoroi'],
      support: ['Shirube', 'Kanpo', 'Shakuhachi', 'Sashimono', 'Emakimono', 'Torinawa', 'Uma'],
      training: [
        'Jujutsu','Juttejutsu','Bojutsu','Tantojutsu','Kusarigamajutsu','Mojirijutsu','Sojutsu','Naginatajutsu',
        'Shurikenjutsu','Fukumibarijutsu','Kyujutsu','Hojojutsu','Suieijutsu','Bajutsu'
      ]
    },
    'Ninja': {
      abilities: ['Wall Crawling','Light-footed','Assassinate','Night Stalker','Stealth','Agile'],
      ranged: ['Shuriken','Fukiya','Hankyu','Daikyu','Tanegashima','Kunai','Ozutsu', 'Houroku-Hiya'],
      armor: ['Do-maru'],
      support: ['Shirube','Kanpo','Shakuhachi','Emakimono','Torinawa'],
      training: [
        'Jujutsu','Juttejutsu','Bojutsu','Tantojutsu','Kusarigamajutsu','Kenjutsu','Shurikenjutsu','Fukumibarijutsu',
        'Kyujutsu','Kayakujutsu','Hojojutsu','Suieijutsu','Ninjutsu'
      ]
    },
    'Onmyoji': {
      abilities: ['Aura of Resolve','Omen of Wrath','Enduring Ward','Beyond the Veil'],
      ranged: ['Shuriken','Fukiya','Hankyu','Daikyu','Tanegashima','Ozutsu', 'Houroku-Hiya'],
      armor: [],
      support: ['Shirube','Kanpo','Shakuhachi','Emakimono'],
      training: ['Jujutsu','Juttejutsu','Bojutsu','Suieijutsu','Shurikenjutsu','Fukumibarijutsu','Onmyodo']
    }
  };

  // Embedded HTML tables (from WPForms HTML fields)
  var TABLES = {
    abilities: `<div class="shoshin-step2-panel">
  <table id="shoshin-abilities-table" class="shoshin-table"
         style="width:100%; border-collapse:collapse; font-size:0.8rem;">
    <thead>
      <tr>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
          Ability
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
          Effect
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">
          Cost
        </th>
      </tr>
    </thead>
    <tbody>
      <tr data-ability="Divine Inspiration" data-cost="0">
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">
          Divine Inspiration
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          All friendly clan units located (including daimyo) within 2&quot; receive +1 to all saving throws.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; white-space:nowrap;">
          0
        </td>
      </tr>

      <tr data-ability="Honor Duel" data-cost="0">
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">
          Honor Duel
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          May initiate an honor duel against an enemy samurai or daimyō.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; white-space:nowrap;">
          0
        </td>
      </tr>

      <tr data-ability="Iron Fists" data-cost="1">
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">
          Iron Fists
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Unarmed combat deals damage to armor and stone.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; white-space:nowrap;">
          1
        </td>
      </tr>

      <tr data-ability="Missile Deflection" data-cost="1">
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">
          Missile Deflection
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Spend an action to negate a ranged attack once per round.<br>
		  Must be declared before an attack roll is made.<br>
		  <b>Restrictions:</b> Does not apply to gunpowder (arquebus, bombs, artillery) weapons.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; white-space:nowrap;">
          1
        </td>
      </tr>

      <tr data-ability="Ki Endurance" data-cost="2">
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">
          Ki Endurance
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Permanently add +1 Body.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; white-space:nowrap;">
          2
        </td>
      </tr>

      <tr data-ability="Heal" data-cost="3">
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">
          Heal
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Spend an action to restore 1 Body and/or remove the Poison condition from any engaged unit,
          including yourself.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; white-space:nowrap;">
          3
        </td>
      </tr>

      <tr data-ability="Wall Crawling" data-cost="1">
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">
          Wall Crawling
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          May move upon any vertical surface as long as there is enough movement to end turn on a horizontal surface.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; white-space:nowrap;">
          1
        </td>
      </tr>

      <tr data-ability="Light-footed" data-cost="1">
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">
          Light-footed
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Disengaging does not provoke Opportunity Attacks.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; white-space:nowrap;">
          1
        </td>
      </tr>

      <tr data-ability="Assassinate" data-cost="2">
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">
          Assassinate
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Permanently add +1 Damage and Critical hits bypass Resilience.<br>
		  <b>Restrictions:</b> Tanto, Shuriken, and Fukiya only.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; white-space:nowrap;">
          2
        </td>
      </tr>

      <tr data-ability="Night Stalker" data-cost="3">
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">
          Night Stalker
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Permanently add +2 &lsquo;To-Hit&rsquo; during nighttime.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; white-space:nowrap;">
          3
        </td>
      </tr>

      <tr data-ability="Stealth" data-cost="3">
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">
          Stealth
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Permanently add +1 Defense.<br>
		  <b>Gain Concealment ability:</b> Spend an action to become hidden.<br>
		  Automatically concealed at start of nighttime rounds.<br>
		  <b>Restrictions:</b> May not be combined with Shirube.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; white-space:nowrap;">
          3
        </td>
      </tr>

      <tr data-ability="Agile" data-cost="4">
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">
          Agile
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Permanently add +2 to base movement.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; white-space:nowrap;">
          4
        </td>
      </tr>

      <tr data-ability="Aura of Resolve" data-cost="3">
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">
          Aura of Resolve
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          All friendly units (including onmyoji) within 3&quot; gain Resilience.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; white-space:nowrap;">
          3
        </td>
      </tr>

      <tr data-ability="Omen of Wrath" data-cost="4">
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">
          Omen of Wrath
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          All friendly units (including onmyoji) within 3&quot; gain +1 Attack.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; white-space:nowrap;">
          4
        </td>
      </tr>

      <tr data-ability="Enduring Ward" data-cost="4">
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">
          Enduring Ward
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          All friendly units (including onmyoji) within 3&quot; gain +1 Defense.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; white-space:nowrap;">
          4
        </td>
      </tr>

      <tr data-ability="Beyond the Veil" data-cost="5">
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">
          Beyond the Veil
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Spend an action to summon any Yokai up to 12&quot; away within unobstructed line of sight. The selected yokai enters play at the end of the round if concentration remains unbroken.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; white-space:nowrap;">
          5
        </td>
      </tr>
    </tbody>
  </table>

  <div id="shoshin-abilities-empty"
       style="display:none; margin-top:0.5rem; font-size:0.85rem; font-style:italic; color:#666;">
    No character abilities are available for this character.
  </div>
</div>`,
    meleeWeapons: `<div class="shoshin-step3-panel">
  <table id="shoshin-melee-table" style="width:100%; border-collapse:collapse; font-size:0.8rem;">
    <thead>
      <tr>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; width:48px; white-space:nowrap;">
          Image
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
          Weapon
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
          Type
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">
          Damage
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">
          Critical
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">
          Distance
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
          Attributes
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">
          Cost
        </th>
      </tr>
    </thead>

    <tbody>
      <!-- Unarmed Combat -->
      <tr
        data-weapon="Unarmed Combat"
        data-type="Fists, Kicks, etc"
        data-cost="0"
        data-damage="1"
        data-critical="Fear"
        data-distance="(e)"
        data-attributes="Does not damage armored units."
        data-classes="Daimyo,Samurai,Ashigaru,Sohei,Ninja,Onmyoji"
        data-training="Jujutsu"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Unarmed1.jpeg"
            alt="Unarmed Combat"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600;">
          Unarmed Combat
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Fists, Kicks, etc
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          Fear
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          (e)
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          <b>Restrictions:</b> Does not damage armored units.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          0
        </td>
      </tr>

      <!-- Jutte -->
      <tr
        data-weapon="Jutte"
        data-type="Truncheon or Club"
        data-cost="1"
        data-damage="1"
        data-critical="1"
        data-distance="(e)"
        data-attributes="May be combined with Shirube (Pitch or Tar)."
        data-classes="Daimyo,Samurai,Ashigaru,Sohei,Ninja,Onmyoji"
        data-training="Juttejutsu"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Club1.jpeg"
            alt="Jutte"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600;">
          Jutte
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Truncheon or Club
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          (e)
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          May be combined with Shirube (Pitch/Tar).
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Bo -->
      <tr
        data-weapon="Bo"
        data-type="Pole or Staff"
        data-cost="1"
        data-damage="1"
        data-critical="Stun"
        data-distance="1"
        data-attributes="--"
        data-classes="Daimyo,Samurai,Ashigaru,Sohei,Ninja,Onmyoji"
        data-training="Bojutsu"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Staff1.jpeg"
            alt="Bo"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600;">
          Bo
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Pole or Staff
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          Stun
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          --
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Tanto -->
      <tr
        data-weapon="Tanto"
        data-type="Dagger"
        data-cost="1"
        data-damage="1"
        data-critical="Bleed"
        data-distance="(e)"
        data-attributes="--"
        data-classes="Daimyo,Samurai,Ashigaru,Sohei,Ninja,Onmyoji"
        data-training="Tantojutsu"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Dagger1.jpeg"
            alt="Tanto"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600;">
          Tanto
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Dagger
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          Bleed
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          (e)
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          --
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Kusarigama -->
      <tr
        data-weapon="Kusarigama"
        data-type="Sickle and Chain"
        data-cost="2"
        data-damage="1d2"
        data-critical="Fear"
        data-distance="2"
        data-attributes="--"
        data-classes="Daimyo,Samurai,Ashigaru,Sohei,Ninja,Onmyoji"
        data-training="Kusarigamajutsu"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2026/01/kusarigama.jpg"
            alt="Kusarigama"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600;">
          Kusarigama
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Sickle and Chain
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1d2
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          Fear
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          2
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          --
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          2
        </td>
      </tr>

      <!-- Kanabo -->
      <tr
        data-weapon="Kanabo"
        data-type="Studded War Club"
        data-cost="2"
        data-damage="1d2"
        data-critical="Stun"
        data-distance="(e)"
        data-attributes="Can damage Stone objects."
        data-classes="Daimyo,Samurai,Ashigaru,Sohei,Ninja,Onmyoji"
        data-training="Mojirijutsu"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2026/01/kanabo.jpg"
            alt="Kanabo"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600;">
          Kanabo
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Studded War Club
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1d2
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          Stun
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          (e)
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Can damage Stone objects.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          2
        </td>
      </tr>

      <!-- Yari -->
      <tr
        data-weapon="Yari"
        data-type="Spear"
        data-cost="2"
        data-damage="1"
        data-critical="1"
        data-distance="1"
        data-attributes="Receives +1 To-Hit vs Cavalry units."
        data-classes="Daimyo,Samurai,Ashigaru,Sohei,Ninja,Onmyoji"
        data-training="Sojutsu"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Spear1.jpeg"
            alt="Yari"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600;">
          Yari
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Spear
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Receives +1 To-Hit vs Cavalry units.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          2
        </td>
      </tr>

      <!-- Katana -->
      <tr
        data-weapon="Katana"
        data-type="Sword"
        data-cost="2"
        data-damage="1d2"
        data-critical="Bleed"
        data-distance="(e)"
        data-attributes="May decapitate Restrained units."
        data-classes="Daimyo,Samurai,Ashigaru,Sohei,Ninja,Onmyoji"
        data-training="Kenjutsu"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2026/01/katana.jpg"
            alt="Katana"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600;">
          Katana
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Sword
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1d2
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          Bleed
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          (e)
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          May decapitate Restrained units.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          2
        </td>
      </tr>

      <!-- Naginata -->
      <tr
        data-weapon="Naginata"
        data-type="Bladed Polearm"
        data-cost="3"
        data-damage="1d2"
        data-critical="1"
        data-distance="1"
        data-attributes="Receives +1 To-Hit vs Cavalry units."
        data-classes="Daimyo,Samurai,Ashigaru,Sohei,Ninja,Onmyoji"
        data-training="Naginatajutsu"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Naginata1.jpeg"
            alt="Naginata"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600;">
          Naginata
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Bladed Polearm
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1d2
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Receives +1 To-Hit vs Cavalry units.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          3
        </td>
      </tr>

      <!-- Nodachi -->
      <tr
        data-weapon="Nodachi"
        data-type="Great Sword"
        data-cost="3"
        data-damage="1d3"
        data-critical="Bleed"
        data-distance="(e)"
        data-attributes="May decapitate Restrained units."
        data-classes="Daimyo,Samurai,Ashigaru,Sohei,Ninja,Onmyoji"
        data-training="Iaijutsu"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2026/01/nodachi.jpg"
            alt="Nodachi"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600;">
          Nodachi
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Great Sword
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1d3
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          Bleed
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          (e)
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          May decapitate Restrained units.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          3
        </td>
      </tr>
    </tbody>
  </table>
</div>`,
    rangedWeapons: `<div class="shoshin-step4-panel">
  <table id="shoshin-ranged-table" style="width:100%; border-collapse:collapse; font-size:0.8rem;">
    <thead>
      <tr>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; width:48px; white-space:nowrap;">
          Image
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
          Weapon
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
          Type
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">
          Damage
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">
          Critical
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">
          Distance
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
          Attributes
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">
          Cost
        </th>
      </tr>
    </thead>

    <tbody>
	<!-- Kunai -->
      <tr
        data-weapon="Kunai"
        data-type="Utility Tool"
        data-cost="1"
        data-damage="1"
        data-critical="Fear"
        data-distance="2"
        data-attributes="--"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
            <img src="/wp-content/uploads/2026/01/kunai.jpg"

               alt="Kunai"
               style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;" />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600; white-space:nowrap;">
          Kunai
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Utility Tool
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          Fear
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          2
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          <b>Restrictions:</b> Ninja only.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>
		
      <!-- Shuriken -->
      <tr
        data-weapon="Shuriken"
        data-type="Throwing Stars"
        data-cost="1"
        data-damage="1"
        data-critical="Bleed"
        data-distance="2"
        data-attributes="--"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Shuriken1.jpeg"
            alt="Shuriken"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600; white-space:nowrap;">
          Shuriken
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Throwing Stars
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          Bleed
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          2
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          --
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Fukiya -->
      <tr
        data-weapon="Fukiya"
        data-type="Blowgun and Darts"
        data-cost="1"
        data-damage="1"
        data-critical="Poison"
        data-distance="4"
        data-attributes="--"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img src="/wp-content/uploads/2026/01/dart.jpg"
               alt="Fukiya"
               style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;" />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600; white-space:nowrap;">
          Fukiya
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Blowgun and Darts
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          Poison
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          4
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          --
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Hankyu -->
      <tr
        data-weapon="Hankyu"
        data-type="Half Bow"
        data-cost="1"
        data-damage="1"
        data-critical="1"
        data-distance="9"
        data-attributes='May be combined with Shirube. Extended Range: -1 To-Hit from 9" to 15".'
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img src="/wp-content/uploads/2026/01/hankyu.jpg"
               alt="Hankyu"
               style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;" />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600; white-space:nowrap;">
          Hankyu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Half Bow
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          9
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          May be combined with Shirube.<br>
          <b>Extended Range:</b> -1 To-Hit from 9" to 15".<br>
          <b>Restrictions:</b> Lose Extended Range if combined with Uma without Bajutsu training.<br>
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Daikyu -->
      <tr
        data-weapon="Daikyu"
        data-type="Great Bow"
        data-cost="2"
        data-damage="1"
        data-critical="1"
        data-distance="18"
        data-attributes='Not a cavalry weapon. May be combined with Shirube. Extended Range: -1 To-Hit from 18" to 30".'
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img src="/wp-content/uploads/2026/01/daikyu.jpg"
               alt="Daikyu"
               style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;" />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600; white-space:nowrap;">
          Daikyu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Great Bow
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          18
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          May be combined with Shirube.<br>
		  <b>Extended Range:</b> -1 To-Hit from 18" to 30".<br>
		  <b>Restrictions:</b> Lose Extended Range if combined with Uma without Bajutsu training.<br>
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          2
        </td>
      </tr>

      <!-- Tanegashima -->
      <tr
        data-weapon="Tanegashima"
        data-type="Arquebus"
        data-cost="2"
        data-damage="1d2"
        data-critical="1"
        data-distance="12"
        data-attributes='Not a cavalry weapon. Requires an action to reload after use. Extended Range: -1 To-Hit from 12" to 18".'
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img src="/wp-content/uploads/2025/12/Arquebus1.jpeg"
               alt="Tanegashima"
               style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;" />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600; white-space:nowrap;">
          Tanegashima
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Arquebus
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1d2
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          12
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Requires reload after use.<br>
          <b>Extended Range:</b> -1 To-Hit from 12" to 18".<br>
		  <b>Restrictions:</b> Lose Extended Range if combined with Uma without Bajutsu training.<br>
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          2
        </td>
      </tr>

            <!-- Ozutsu -->
      <tr
        data-weapon="Ozutsu"
        data-type="Handheld Cannon"
        data-cost="3"
        data-damage="1d3"
        data-critical="Burn"
        data-distance="6"
        data-attributes="Requires an action to reload after use."
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img src="/wp-content/uploads/2026/04/odzutsu.jpg"
               alt="Ozutsu"
               style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;" />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600; white-space:nowrap;">
          Ozutsu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Handheld Cannon
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1d3
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          Burn
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          6
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Requires reload after use.<br>
          <b>Restrictions:</b> May not be combined with Uma.<br>
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          3
        </td>
      </tr>

      <!-- Houroku-Hiya -->
      <tr
        data-weapon="Houroku-Hiya"
        data-type="Gunpowder Bombs"
        data-cost="3"
        data-damage="1d6"
        data-critical="Burn"
        data-distance="6"
        data-attributes='Single To-Hit roll for all units within 2&quot; of target. Critical Miss: Roll damage for all units within 2&quot;.'
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img src="/wp-content/uploads/2025/12/bomb1.jpeg"
               alt="Houroku-Hiya"
               style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;" />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600; white-space:nowrap;">
          Houroku-hiya
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Gunpowder Bombs
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1d6
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          Burn
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          6
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Single To-Hit roll for all units within 2" of target.<br>
          <strong>Critical Miss:</strong> Roll damage for all units within 2".<br>
		  <b>Restrictions:</b> May not be combined with Uma.<br>
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          3
        </td>
      </tr>

    </tbody>
  </table>

  <div id="shoshin-ranged-empty"
       style="display:none; margin-top:0.5rem; font-size:0.85rem; font-style:italic; color:#666;">
    No ranged weapons are available for this character.
  </div>
</div>`,
    armor: `<div class="shoshin-step5-panel">
  <table id="shoshin-armor-table" style="width:100%; border-collapse:collapse; font-size:0.8rem;">
    <thead>
      <tr>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; width:48px; white-space:nowrap;">
          Image
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
          Armor
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
          Type
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
          Attributes
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">
          Cost
        </th>
      </tr>
    </thead>

    <tbody>
      <!-- Do-maru -->
      <tr
        data-armor="Do-maru"
        data-type="Basic Armor"
        data-attributes="Permanently gain +1 Defense."
        data-cost="2"
        data-classes="Daimyo,Samurai,Ashigaru,Sohei,Ninja"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2026/04/do_maru.webp"
            alt="Do-maru"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600; white-space:nowrap;">
          Do-maru
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Basic Armor
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Permanently gain +1 Defense.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          2
        </td>
      </tr>

      <!-- O-yoroi -->
      <tr
        data-armor="O-yoroi"
        data-type="Great Armor"
        data-attributes="Permanently gain +2 Defense."
        data-cost="4"
        data-classes="Daimyo,Samurai,Sohei"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2026/04/o_yoroi.webp"
            alt="O-yoroi"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600; white-space:nowrap;">
          O-yoroi
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Great Armor
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Permanently gain +2 Defense.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          4
        </td>
      </tr>

      <!-- Tosei-gusoku -->
      <tr
        data-armor="Tosei-gusoku"
        data-type="Modern Armor"
        data-attributes="Permanently gain +3 Defense."
        data-cost="6"
        data-classes="Daimyo,Samurai"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2026/04/tosei_gusoku.webp"
            alt="Tosei-gusoku"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; font-weight:600; white-space:nowrap;">
          Tosei-gusoku
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Modern Armor
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">
          Permanently gain +3 Defense.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          6
        </td>
      </tr>
    </tbody>
  </table>

  <div id="shoshin-armor-empty"
       style="display:none; margin-top:0.5rem; font-size:0.85rem; font-style:italic; color:#666;">
    No armor options are available for this character.
  </div>
</div>`,
    supportItems: `<div class="shoshin-step6-panel">
  <table id="shoshin-support-table"
         class="shoshin-table"
         style="width:100%; border-collapse:collapse; font-size:0.8rem;">
    <thead>
  <tr>
    <!-- Image: fixed narrow column -->
    <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; width:48px; white-space:nowrap;">
      Image
    </th>

    <!-- Item -->
    <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
      Item
    </th>

    <!-- Type -->
    <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
      Type
    </th>

    <!-- Attributes -->
    <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
      Attributes
    </th>

    <!-- Cost -->
    <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">
      Cost
    </th>
  </tr>
</thead>


    <tbody>
	 <!-- Torinawa -->
      <tr
        data-item="Torinawa"
        data-type="Capture Rope"
        data-attributes="Grants abilities to Arrest and Rescue but only if proficient in Hojojutsu."
        data-cost="0"
        data-classes="Daimyo,Samurai,Sohei,Ninja"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          <img
            src="/wp-content/uploads/2025/12/Rope.jpeg"
            alt="Torinawa"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Torinawa
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Capture Rope
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Grants abilities to Arrest and Rescue.<br>
		  <b>Restrictions:</b> Hojojutsu training required.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          0
        </td>
      </tr>
	
      <!-- Shirube -->
      <tr
        data-item="Shirube"
        data-type="Pitch or Tar"
        data-attributes="May be combined with Jutte, Hankyu or Daikyu weapons."
        data-cost="1"
        data-classes="Daimyo,Samurai,Ashigaru,Sohei,Ninja,Onmyoji"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          <img
            src="/wp-content/uploads/2025/12/Pitch.jpeg"
            alt="Shirube"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Shirube
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Pitch or Tar
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          May be combined with Jutte, Hankyu or Daikyu weapons.<br>
          Inflicts the Burn condition upon a successful hit.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Kanpo -->
      <tr
        data-item="Kanpo"
        data-type="Herbal Medicine"
        data-attributes="Grants Immunity to Poison."
        data-cost="1"
        data-classes="Daimyo,Samurai,Ashigaru,Sohei,Ninja,Onmyoji"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          <img
            src="/wp-content/uploads/2025/12/Medicine.jpeg"
            alt="Kanpo"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Kanpo
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Herbal Medicine
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Grants Immunity to Poison.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Shakuhachi -->
      <tr
        data-item="Shakuhachi"
        data-type="Bamboo Flute"
        data-attributes="Grants Immunity to Fear."
        data-cost="1"
        data-classes="Daimyo,Samurai,Ashigaru,Sohei,Ninja,Onmyoji"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          <img
            src="/wp-content/uploads/2025/12/Flute.jpeg"
            alt="Shakuhachi"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Shakuhachi
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Bamboo Flute
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Grants Immunity to Fear.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Sashimono -->
      <tr
        data-item="Sashimono"
        data-type="Clan Banner"
        data-attributes="Permanently gain +1 Leadership."
        data-cost="2"
        data-classes="Samurai,Ashigaru,Sohei"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          <img
            src="/wp-content/uploads/2025/12/Sashimono.png"
            alt="Sashimono"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Sashimono
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Clan Banner
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Permanently gain +1 Leadership.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          2
        </td>
      </tr>

      <!-- Emakimono -->
      <tr
        data-item="Emakimono"
        data-type="Illustrated Handscrolls"
        data-attributes="Permanently gain +1 Initiative."
        data-cost="2"
        data-classes="Daimyo,Samurai,Ashigaru,Sohei,Ninja,Onmyoji"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          <img
            src="/wp-content/uploads/2025/12/Handscrolls.jpeg"
            alt="Emakimono"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Emakimono
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Illustrated<br>Handscrolls
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Permanently gain +1 Initiative.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          2
        </td>
      </tr>

      <!-- Uma -->
      <tr
        data-item="Uma"
        data-type="Horse"
        data-attributes='Mounted Advantage (Movement): Permanently add +8&quot; to base movement. Mounted Advantage (Endurance): Permanently add +1 to Body if proficient in Bajutsu. Mounted Advantage (High Ground): +1 To-Hit vs non-mounted units if proficient in Bajutsu.'
        data-cost="3"
        data-classes="Daimyo,Samurai,Sohei"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          <img
            src="/wp-content/uploads/2025/12/Horse.jpeg"
            alt="Uma"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Uma
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          War Horse
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          <b>Mounted Advantage (Movement):</b> Permanently add +8&quot; to base movement.<br>
          <b>Mounted Advantage (Toughness):</b> Permanently add +1 to Body <em>(Bajutsu required)</em>.<br>
          <b>Mounted Advantage (High Ground):</b> +1 To-Hit vs non-mounted units <em>(Bajutsu required)</em>.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          3
        </td>
      </tr>
    </tbody>
  </table>

  <div id="shoshin-support-empty"
       style="display:none; margin-top:0.5rem; font-size:0.85rem; font-style:italic; color:#666;">
    No support items are available for this character.
  </div>
</div>`,
    ryuTraining: `<div class="shoshin-step7-panel">
  <table id="shoshin-training-table" style="width:100%; border-collapse:collapse; font-size:0.8rem;">
    <thead>
      <tr>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; width:48px; white-space:nowrap;">
          Image
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
          Ryū
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
          Discipline
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
          Equipment
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">
          Cost
        </th>
      </tr>
    </thead>

    <tbody>
      <!-- Jujutsu -->
      <tr
        data-training="Jujutsu"
        data-weapon="Unarmed Combat"
        data-cost="1"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Unarmed1.jpeg"
            alt="Jujutsu"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Jujutsu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Unarmed Combat
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Fists, Kicks, etc.
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Juttejutsu -->
      <tr
        data-training="Juttejutsu"
        data-weapon="Jutte"
        data-cost="1"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Club1.jpeg"
            alt="Juttejutsu"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Juttejutsu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Truncheon or Club
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Jutte
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Bojutsu -->
      <tr
        data-training="Bojutsu"
        data-weapon="Bo"
        data-cost="1"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Staff1.jpeg"
            alt="Bojutsu"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Bojutsu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Pole or Staff
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Bo
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Tantojutsu -->
      <tr
        data-training="Tantojutsu"
        data-weapon="Tanto"
        data-cost="1"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Dagger1.jpeg"
            alt="Tantojutsu"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Tantojutsu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Dagger
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Tanto
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Kusarigamajutsu -->
      <tr
        data-training="Kusarigamajutsu"
        data-weapon="Kusarigama"
        data-cost="1"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2026/01/kusarigama.jpg"
            alt="Kusarigamajutsu"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Kusarigamajutsu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Sickle and Chain
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Kusarigama
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Mojirijutsu -->
      <tr
        data-training="Mojirijutsu"
        data-weapon="Kanabo"
        data-cost="1"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2026/01/kanabo.jpg"
            alt="Mojirijutsu"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Mojirijutsu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Studded War Club
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Kanabo
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Sojutsu -->
      <tr
        data-training="Sojutsu"
        data-weapon="Yari"
        data-cost="2"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Spear1.jpeg"
            alt="Sojutsu"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Sojutsu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Spear
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Yari
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          2
        </td>
      </tr>

      <!-- Kenjutsu -->
      <tr
        data-training="Kenjutsu"
        data-weapon="Katana"
        data-cost="2"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2026/01/katana.jpg"
            alt="Kenjutsu"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Kenjutsu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Sword
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Katana
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          2
        </td>
      </tr>

      <!-- Naginatajutsu -->
      <tr
        data-training="Naginatajutsu"
        data-weapon="Naginata"
        data-cost="2"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Naginata1.jpeg"
            alt="Naginatajutsu"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Naginatajutsu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Bladed Polearm
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Naginata
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          2
        </td>
      </tr>

      <!-- Iaijutsu -->
      <tr
        data-training="Iaijutsu"
        data-weapon="Nodachi"
        data-cost="2"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2026/01/nodachi.jpg"
            alt="Iaijutsu"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Iaijutsu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Great Sword
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Nodachi
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          2
        </td>
      </tr>

      <!-- Shurikenjutsu -->
      <tr
        data-training="Shurikenjutsu"
        data-weapon="Shuriken"
        data-cost="1"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Shuriken1.jpeg"
            alt="Shurikenjutsu"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Shurikenjutsu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Throwing Stars
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Shuriken
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Fukumibarijutsu -->
      <tr
        data-training="Fukumibarijutsu"
        data-weapon="Fukiya"
        data-cost="1"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2026/01/dart.jpg"
            alt="Fukumibarijutsu"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Fukumibarijutsu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Blowgun &amp; Darts
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Fukiya
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Kyujutsu -->
      <tr
        data-training="Kyujutsu"
        data-weapon="Hankyu,Daikyu"
        data-cost="2"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Bow.jpeg"
            alt="Kyujutsu"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Kyujutsu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Bows
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Hankyu, Daikyu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          2
        </td>
      </tr>

      <!-- Kayakujutsu -->
		<tr
		  data-training="Kayakujutsu"
		  data-cost="2"
		>
		  <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
			<img
			  src="/wp-content/uploads/2025/12/Arquebus1.jpeg"
			  alt="Kayakujutsu"
			  style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
			/>
		  </td>
		  <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
			Kayakujutsu
		  </td>
		  <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
			Gunpowder Firearms<br>& Explosives
		  </td>
		  <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
			Tanegashima, Ozutsu,<br>Taiho & Houroku-Hiya
		  </td>
		  <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
			2
		  </td>
		</tr>


      <!-- Hojojutsu -->
      <tr
        data-training="Hojojutsu"
        data-weapon="Torinawa"
        data-cost="1"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Rope.jpeg"
            alt="Hojojutsu"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Hojojutsu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Arresting Rope
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Torinawa
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Suieijutsu -->
      <tr
        data-training="Suieijutsu"
        data-weapon=""
        data-cost="1"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Water.jpeg"
            alt="Suieijutsu"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Suieijutsu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Water Combat
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Wasen
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          1
        </td>
      </tr>

      <!-- Bajutsu -->
      <tr
        data-training="Bajutsu"
        data-weapon="Uma"
        data-cost="2"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Horse.jpeg"
            alt="Bajutsu"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Bajutsu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Horsemanship
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Uma
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          2
        </td>
      </tr>

      <!-- Ninjutsu -->
      <tr
        data-training="Ninjutsu"
        data-weapon="Kunai"
        data-cost="0"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Ninjutsu.jpeg"
            alt="Ninjutsu"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Ninjutsu
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Espionage
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Kunai
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          0
        </td>
      </tr>

      <!-- Onmyodo -->
      <tr
        data-training="Onmyodo"
        data-weapon=""
        data-cost="0"
      >
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center; vertical-align:middle;">
          <img
            src="/wp-content/uploads/2025/12/Sorcery.jpeg"
            alt="Onmyodo"
            style="width:32px; height:32px; object-fit:contain; display:block; margin:0 auto;"
          />
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600; white-space:nowrap;">
          Onmyodo
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          Sorcery
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">
          —
        </td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">
          0
        </td>
      </tr>
    </tbody>
  </table>
</div>`,
    proficiencies: `<h3 style="margin-bottom:6px;">Character Proficiencies</h3>

<div id="shoshin-proficiency-wrapper">
  <table id="shoshin-proficiency-table" class="shoshin-table"
         style="width:100%; border-collapse:collapse; font-size:0.8rem;">
    <thead>
      <tr>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
          Proficiency
        </th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">
          Description
        </th>
      </tr>
    </thead>
    <tbody>
      <tr data-classes="Daimyo,Samurai,Ashigaru,Sohei,Ninja,Onmyoji">
        <td style="font-weight:600; border-bottom:1px solid #eee; padding:4px 6px;">
          Inept: Melee Combat
        </td>
        <td style="color:#555; border-bottom:1px solid #eee; padding:4px 6px;">
          Melee attack rolls successful on natural 6 (Lucky Hit) only.<br>
          Melee weapons lose all additional benefits and their range is reduced to engagement only.
        </td>
      </tr>
      <tr data-classes="Daimyo,Samurai,Ashigaru,Sohei,Ninja,Onmyoji">
        <td style="font-weight:600; border-bottom:1px solid #eee; padding:4px 6px;">
          Inept: Ranged Combat
        </td>
        <td style="color:#555; border-bottom:1px solid #eee; padding:4px 6px;">
          Ranged attack rolls successful on natural 6 (Lucky Hit) only.<br>
          Ranged weapons lose all additional benefits and their effective range halved.
        </td>
      </tr>
      <tr data-classes="Daimyo,Samurai,Ashigaru,Sohei,Ninja,Onmyoji">
        <td style="font-weight:600; border-bottom:1px solid #eee; padding:4px 6px;">
          Inept: Water Combat
        </td>
        <td style="color:#555; border-bottom:1px solid #eee; padding:4px 6px;">
          May not attack while located within water terrain.<br>
		  Must start round at water terrain edge to move within water terrain.<br>
		  May not captain or crew a sailing ship.
        </td>
      </tr>
      <tr data-classes="Daimyo,Samurai,Sohei">
        <td style="font-weight:600; border-bottom:1px solid #eee; padding:4px 6px;">
          Inept: Horsemanship
        </td>
        <td style="color:#555; border-bottom:1px solid #eee; padding:4px 6px;">
          Does not benefit from Mounted Advantage (Toughness) +1 Body or from
          Mounted Advantage (High Ground) +1 To-Hit versus non-mounted targets.
        </td>
      </tr>
      <tr data-classes="Daimyo">
        <td style="font-weight:600; border-bottom:1px solid #eee; padding:4px 6px;">
          Ancestral Prestige
        </td>
        <td style="color:#555; border-bottom:1px solid #eee; padding:4px 6px;">
          May choose any armor at one-half points cost.
        </td>
      </tr>
      <tr data-classes="Daimyo">
        <td style="font-weight:600; border-bottom:1px solid #eee; padding:4px 6px;">
          Martial Mastery
        </td>
        <td style="color:#555; border-bottom:1px solid #eee; padding:4px 6px;">
          May train any one proficiency for free.
        </td>
      </tr>
      <tr data-classes="Samurai">
        <td style="font-weight:600; border-bottom:1px solid #eee; padding:4px 6px;">
          Sword Master
        </td>
        <td style="color:#555; border-bottom:1px solid #eee; padding:4px 6px;">
          Pays one-half points cost to train either Kenjutsu or Iaijutsu.
        </td>
      </tr>
      <tr data-classes="Ashigaru">
        <td style="font-weight:600; border-bottom:1px solid #eee; padding:4px 6px;">
          General Ineptitude
        </td>
        <td style="color:#555; border-bottom:1px solid #eee; padding:4px 6px;">
          Pays double points cost to train any available proficiency.
        </td>
      </tr>
      <tr data-classes="Sohei">
        <td style="font-weight:600; border-bottom:1px solid #eee; padding:4px 6px;">
          Martial Artist
        </td>
        <td style="color:#555; border-bottom:1px solid #eee; padding:4px 6px;">
          Proficient in Jujutsu <i>(free)</i>.
        </td>
      </tr>
      <tr data-classes="Sohei">
        <td style="font-weight:600; border-bottom:1px solid #eee; padding:4px 6px;">
          Polearms Adept
        </td>
        <td style="color:#555; border-bottom:1px solid #eee; padding:4px 6px;">
          Pays one-half points cost to train either Sojutsu or Naginatajutsu.
        </td>
      </tr>
      <tr data-classes="Ninja">
        <td style="font-weight:600; border-bottom:1px solid #eee; padding:4px 6px;">
          Espionage Expert
        </td>
        <td style="color:#555; border-bottom:1px solid #eee; padding:4px 6px;">
          Proficient in Ninjutsu <i>(included)</i>.
        </td>
      </tr>
      <tr data-classes="Onmyoji">
        <td style="font-weight:600; border-bottom:1px solid #eee; padding:4px 6px;">
          Mysticism and Ritualism
        </td>
        <td style="color:#555; border-bottom:1px solid #eee; padding:4px 6px;">
          Proficient in Onmyodo <i>(included)</i>.
        </td>
      </tr>
    </tbody>
  </table>

  <p id="shoshin-proficiency-empty"
     style="display:none; font-size:0.85rem; color:#777; margin-top:6px;">
    No special proficiencies are associated with this class.
  </p>
</div>`,
    munitions: `<!-- STEP 2 — Munitions Section (Hidden unless Taiho is selected) -->
<div id="shoshin-munitions-section" style="margin-bottom:12px;">


  <div id="shoshin-munitions-block" class="shoshin-step-munitions-panel">
  <table id="shoshin-munitions-table"
         style="width:100%; border-collapse:collapse; font-size:0.8rem;">
    <thead>
  <tr>
    <th style="border-bottom:1px solid #ccc; padding:4px 6px;
               text-align:center; width:48px; white-space:nowrap;">
      Image
    </th>

    <th style="border-bottom:1px solid #ccc; padding:4px 6px;
               text-align:left; white-space:nowrap;">
      Munition
    </th>

    <th style="border-bottom:1px solid #ccc; padding:4px 6px;
               text-align:left; white-space:nowrap;">
      Type
    </th>

    <th style="border-bottom:1px solid #ccc; padding:4px 6px;
               text-align:center; white-space:nowrap;">
      Damage
    </th>

    <th style="border-bottom:1px solid #ccc; padding:4px 6px;
               text-align:center; white-space:nowrap;">
      Critical
    </th>

    <th style="border-bottom:1px solid #ccc; padding:4px 6px;
               text-align:center; white-space:nowrap;">
      Distance
    </th>

    <th style="border-bottom:1px solid #ccc; padding:4px 6px;
               text-align:left; white-space:nowrap;">
      Attributes
    </th>

    <th style="border-bottom:1px solid #ccc; padding:4px 6px;
               text-align:center; width:48px; white-space:nowrap;">
      Cost
    </th>
  </tr>
</thead>


    <tbody>

      <!-- Tetsuho (Iron Cannonball) -->
      <tr data-munition="Tetsuho" data-cost="5">
        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   text-align:center; vertical-align:middle;">
          <img src="/wp-content/uploads/2025/12/Cannonball.jpeg"
               alt="Tetsuho"
               style="width:32px;height:32px;object-fit:contain;display:block;margin:0 auto;">
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; font-weight:600; white-space:nowrap;">
          Tetsuho
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; color:#555;">
          Iron Cannonball
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; text-align:center;">
          1d6
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; text-align:center;">
          1d3
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; text-align:center;">
          18"
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; color:#555;">
          Can damage multiple targets within 1" Line AOE (throughout Extended Range) as long as the previous hits continue to dispatch a unit.<br>
          <b>Extended Range:</b> -1 To-Hit from 18" to 24".
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; text-align:center;">
          5
        </td>
      </tr>

      <!-- Bo-Hiya (Flaming Bolt) -->
      <tr data-munition="Bo-Hiya" data-cost="5">
        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   text-align:center; vertical-align:middle;">
          <img src="/wp-content/uploads/2025/12/Flame-Arrow.jpeg"
               alt="Bo-Hiya"
               style="width:32px;height:32px;object-fit:contain;display:block;margin:0 auto;">
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; font-weight:600; white-space:nowrap;">
          Bo-Hiya
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; color:#555;">
          Flaming Bolt
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; text-align:center;">
          1d6
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; text-align:center;">
          1d2
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; text-align:center;">
          24"
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; color:#555;">
          Inflicts Condition: Burn upon any successful hit.<br>
          <b>Extended Range:</b> -1 To-Hit from 24" to 36".
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; text-align:center;">
          5
        </td>
      </tr>

      <!-- Tama-ire (Grapeshot) -->
      <tr data-munition="Tama-ire" data-cost="5">
        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   text-align:center; vertical-align:middle;">
          <img src="/wp-content/uploads/2025/12/Grapeshot.jpeg"
               alt="Tama-ire"
               style="width:32px;height:32px;object-fit:contain;display:block;margin:0 auto;">
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; font-weight:600; white-space:nowrap;">
          Tama-ire
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; color:#555;">
          Grapeshot
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; text-align:center;">
          1d3
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; text-align:center;">
          1
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; text-align:center;">
          12"
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; color:#555;">
          Can damage multiple targets within a 30° Cone AOE up to 12".
        </td>

        <td style="padding:4px 6px; border-bottom:1px solid #eee;
                   vertical-align:middle; text-align:center;">
          5
        </td>
      </tr>

    </tbody>
  </table>
  
  <div id="shoshin-munitions-empty"
       style="margin-top:4px; font-size:0.8rem; font-style:italic; color:#666; display:none;">
    Select one or more munitions to pair with this asset.
  </div>
</div>`,

    supportOzutsuTraining: `
<div style="margin-bottom:12px;">
  <table id="shoshin-support-ozutsu-training-table"
         style="width:100%; border-collapse:collapse; font-size:0.8rem;">
    <thead>
      <tr>
<th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">Ryū</th>
<th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">Discipline</th>
<th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">Equipment</th>

        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap; width:70px;">Cost</th>
      </tr>
    </thead>
    <tbody>
      <tr data-training="Kayakujutsu">
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">Kayakujutsu</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">Gunpowder Firearms &amp; Explosives</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">Tanegashima, Houroku-Hiya, Ozutsu, Taiho</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">2</td>
      </tr>
    </tbody>
  </table>
</div>`,

    supportWasenTraining: `
<div style="margin-bottom:12px;">
  <table id="shoshin-support-wasen-training-table"
         style="width:100%; border-collapse:collapse; font-size:0.8rem;">
    <thead>
      <tr>
<th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">Ryū</th>
<th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">Discipline</th>
<th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">Equipment</th>

        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap; width:70px;">Cost</th>
      </tr>
    </thead>
    <tbody>
      <tr data-training="Suieijutsu">
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">Suieijutsu</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">Water Combat</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">Wasen</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">1</td>
      </tr>
    </tbody>
  </table>
</div>`,

    supportWasenHullSizing: `
<div style="margin-bottom:12px;">
  <table id="shoshin-support-wasen-hull-sizing-table"
         style="width:100%; border-collapse:collapse; font-size:0.8rem; table-layout:fixed;">
    <thead>
           <tr>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">Type</th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">Size</th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">Dimensions</th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">Movement</th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">Toughness</th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">Required Operators</th>
        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:center; white-space:nowrap;">Cost</th>
      </tr>
    </thead>
    <tbody>
      <!-- Medium (Kobaya) -->
            <tr class="shs-z1">

<td rowspan="4" style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">Kobaya</td>

        <td rowspan="1" style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">Medium</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">1 × 3</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">6″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">4</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">1 (Captain Only)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">8</td>
      </tr>

      <!-- Large (Kobaya) -->
            <tr class="shs-z1">


        <td rowspan="3" style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">Large</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">2 × 4</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">6″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">6</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">2 (1 Captain + 1 Crew)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">12</td>
      </tr>
            <tr class="shs-z1">

        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">2 × 5</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">6″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">7</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">2 (1 Captain + 1 Crew)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">14</td>
      </tr>
            <tr class="shs-z1">

        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">2 × 6</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">6″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">8</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">2 (1 Captain + 1 Crew)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">16</td>
      </tr>

      <!-- Huge (Sekibune) -->
            <tr class="shs-z0">

<td rowspan="9" style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">Sekibune</td>

        <td rowspan="4" style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">Huge</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">3 × 6</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">7″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">12</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">3 (1 Captain + 2 Crew)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">24</td>
      </tr>
            <tr class="shs-z0">

        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">3 × 7</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">7″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">13</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">3 (1 Captain + 2 Crew)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">26</td>
      </tr>
           <tr class="shs-z0">

        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">3 × 8</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">7″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">14</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">3 (1 Captain + 2 Crew)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">28</td>
      </tr>
            <tr class="shs-z0">

        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">3 × 9</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">7″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">15</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">3 (1 Captain + 2 Crew)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">30</td>
      </tr>

      <!-- Gargantuan (Sekibune) -->
            <tr class="shs-z0">


        <td rowspan="5" style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">Gargantuan</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">4 × 8</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">7″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">20</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">4 (1 Captain + 3 Crew)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">40</td>
      </tr>
            <tr class="shs-z0">

        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">4 × 9</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">7″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">21</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">4 (1 Captain + 3 Crew)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">42</td>
      </tr>
            <tr class="shs-z0">

        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">4 × 10</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">7″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">22</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">4 (1 Captain + 3 Crew)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">44</td>
      </tr>
            <tr class="shs-z0">

        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">4 × 11</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">7″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">23</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">4 (1 Captain + 3 Crew)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">46</td>
      </tr>
            <tr class="shs-z0">

        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">4 × 12</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">7″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">24</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">4 (1 Captain + 3 Crew)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">48</td>
      </tr>

      <!-- Colossal (Atakebune) -->
            <tr class="shs-z1">

        <td rowspan="6" style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">Atakebune</td>
        <td rowspan="6" style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">Colossal</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">5 × 10</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">8″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">30</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">5 (1 Captain + 4 Crew)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">60</td>
      </tr>
            <tr class="shs-z1">

        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">5 × 11</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">8″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">31</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">5 (1 Captain + 4 Crew)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">62</td>
      </tr>
            <tr class="shs-z1">

        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">5 × 12</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">8″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">32</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">5 (1 Captain + 4 Crew)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">64</td>
      </tr>
            <tr class="shs-z1">

        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">5 × 13</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">8″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">33</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">5 (1 Captain + 4 Crew)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">66</td>
      </tr>
            <tr class="shs-z1">

        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">5 × 14</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">8″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">34</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">5 (1 Captain + 4 Crew)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">68</td>
      </tr>
            <tr class="shs-z1">

        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">5 × 15</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">8″</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">35</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555;">5 (1 Captain + 4 Crew)</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; text-align:center; color:#555; width:70px;">70</td>
      </tr>
    </tbody>
  </table>
</div>
`,

    supportOzutsuRules: `
<div style="margin-bottom:12px;">
  <table id="shoshin-support-ozutsu-rules-table" style="width:100%; border-collapse:collapse; font-size:0.8rem; table-layout:fixed;">

    <thead>
      <tr>
<th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left; width:320px; white-space:normal; overflow-wrap:anywhere; word-break:break-word;">Game Mechanic</th>

        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">Description</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;"><b>Detachment &amp; Operation</b></td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">At the start of the round, one or more engaged friendly units may form an Taiho detachment. Only units in this detachment may move, reload, or fire the cannon.</td>
      </tr>
      <tr>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;"><b>Collective Activation</b></td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">When the Taiho activates, the detachment moves and acts as a single unit, but each model in the detachment remains an individual target for attacks and effects.</td>
      </tr>
      <tr>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;"><b>Firing Arc &amp; Derived Stats</b></td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">The Taiho may only fire in the direction its muzzle faces at the end of the detachment’s movement. Attack and Movement are derived from the detachment’s engaged units, and Initiative checks use the highest Initiative among them.<br><b>One Operator:</b> Attack = 1 / Movement = 2".<br><b>Two Operators:</b> Attack = 2 / Movement = 4".</td>
      </tr>
    </tbody>
  </table>
</div>`,

    supportWasenRules: `
<div style="margin-bottom:12px;">
  <table id="shoshin-support-wasen-rules-table" style="width:100%; border-collapse:collapse; font-size:0.8rem; table-layout:fixed;">

    <thead>
      <tr>
<th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left; width:320px; white-space:normal; overflow-wrap:anywhere; word-break:break-word;">Game Mechanic</th>

        <th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">Description</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;"><b>Captain &amp; Crew</b></td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">A vessel may activate only if a Suieijutsu-trained Captain and the required Crew were aboard at the start of the round. Only Captain & Crew may operate the vessel during activation. Passengers do not require training and may act normally unless restricted by movement or Sprinting.</td>
      </tr>
      <tr>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;"><b>Collective Activation &amp; Sprinting</b></td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">Whenever the vessel Moves, Captain & Crew cannot move or act independently. Passengers may act normally unless the vessel Sprints. If the vessel does not move, all units aboard may act freely. If the vessel Sprints, its Movement is doubled and all passengers forfeit their actions for the round.</td>
      </tr>
      <tr>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;"><b>Contested &amp; Initiative</b></td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; vertical-align:top; color:#555;">If the Captain or any required Crew are engaged by an enemy unit before the vessel has moved, the vessel is contested and cannot activate. When Initiative is required, use the Captain’s Initiative; this does not affect Initiative Phase turn order.</td>
      </tr>
    </tbody>
  </table>
</div>`
  };


  // -----------------------------
  // Rendering
  // -----------------------------
  function getRoot() {
    return document.getElementById('shoshin-game-system-root');
  }

  function buildFilters(state) {
    var wrap = el('div', { class: 'shoshin-gs-filters' }, []);

    // --- Tier 1 Tabs ---
    var tier1Tabs = el('div', { class: 'shoshin-asset-filters shoshin-gs-tier1' }, []);

    GS.tier1.forEach(function(opt) {
      var btn = el('button', {
        type: 'button',
        class: 'shoshin-asset-filter-btn' + (state.tier1 === opt ? ' is-active' : ''),
        text: opt,
        'data-gs-tier1': opt
      });

      btn.addEventListener('click', function() {
        if (state.tier1 === opt) return;

        // Remember where we were within the current Tier 1
        if (!state.__tier2Memory) state.__tier2Memory = {};
        state.__tier2Memory[state.tier1] = state.tier2;

        // Switch Tier 1
        state.tier1 = opt;

        // Restore last visited Tier 2 for this Tier 1 (or default to first)
        var list = (GS.tier2[state.tier1] || []);
        var remembered = state.__tier2Memory[state.tier1] || '';
        state.tier2 = (remembered && list.indexOf(remembered) !== -1) ? remembered : (list[0] || '');

        render(state);
      });


      tier1Tabs.appendChild(btn);
    });

    // --- Tier 2 Tabs ---
    var tier2Tabs = el('div', { class: 'shoshin-asset-filters shoshin-gs-tier2' }, []);

    var list2 = (GS.tier2[state.tier1] || []);
    list2.forEach(function(opt) {
      var btn2 = el('button', {
        type: 'button',
        class: 'shoshin-asset-filter-btn' + (state.tier2 === opt ? ' is-active' : ''),
        text: opt,
        'data-gs-tier2': opt
      });


      btn2.addEventListener('click', function() {
        if (state.tier2 === opt) return;
        state.tier2 = opt;

        // Remember the last visited Tier 2 for this Tier 1
        if (!state.__tier2Memory) state.__tier2Memory = {};
        state.__tier2Memory[state.tier1] = state.tier2;

        render(state);
      });


      tier2Tabs.appendChild(btn2);
    });

    wrap.appendChild(tier1Tabs);
    wrap.appendChild(tier2Tabs);

    return wrap;
  }

    function buildTier2Info(state) {
    var tier1 = state && state.tier1 ? state.tier1 : '';
    var tier2 = state && state.tier2 ? state.tier2 : '';

    var map = (typeof TIER2_INFO !== 'undefined' && TIER2_INFO[tier1]) ? TIER2_INFO[tier1] : null;
    var html = (map && map[tier2]) ? String(map[tier2]) : '';

    if (!html) return null;

    return el('div', {
      class: 'shoshin-gs-tier2-info',
      html: html
    }, []);
  }

  // BEGIN SHOSHIN PATCH — TASK1 SAFE FINDCHARACTER (prevents GS.characters .find crash)
  function findCharacter(cls) {
    var list = (GS && Array.isArray(GS.characters)) ? GS.characters : [];
    return list.find(function(c) { return c && c.class === cls; }) || null;
  }
  // END SHOSHIN PATCH — TASK1 SAFE FINDCHARACTER


  function buildCharacterProfile(cls) {
    var c = findCharacter(cls);
    if (!c) {
      return el('div', { class: 'shoshin-gs-profile', html: '<em>No data found for this class.</em>' });
    }

    var meta = Data.CLASS_META && Data.CLASS_META[cls] ? Data.CLASS_META[cls] : {};
    var img = (Data.CLASS_IMAGES && (Data.CLASS_IMAGES[cls] || Data.CLASS_IMAGES.default)) || c.image || '';
    var size = meta.size || '—';

    var card = el('div', { class: 'shoshin-gs-profile' }, []);

    // Row 1
    var row1 = el('div', { class: 'shoshin-gs-row1' }, []);
    var avatar = el('img', { class: 'shoshin-gs-avatar', src: img, alt: cls });

    var metaWrap = el('div', { class: 'shoshin-gs-meta' }, [

      el('div', { class: 'shoshin-gs-type', text: c.display }),
      el('div', { class: 'shoshin-gs-short', html: c.shortDesc || (meta.description || '') }),
      el('div', { class: 'shoshin-gs-kv', html:
        '<span><b>Size:</b> ' + size + '</span>' +
        '<span><b>Cost:</b> ' + (c.cost != null ? c.cost : '—') + '</span>'
      })
    ]);

// Left group: Avatar + Info (kept together so meta can't "float" to center)
var row1Left = el('div', { class: 'shoshin-gs-row1-left' }, []);
row1Left.appendChild(avatar);
row1Left.appendChild(metaWrap);
row1.appendChild(row1Left);

// Right group: Game logo (upper-right)
row1.appendChild(el('img', {
  class: 'shoshin-gs-game-logo',
  src: '/wp-content/uploads/2025/11/SPOA.webp',
  alt: 'Shoshin: The Path of Ascension'
}));

card.appendChild(row1);



    card.appendChild(el('div', { class: 'shoshin-gs-spacer-lg' }));

    // Row 2 — Character Profile (melee/ranged are references for characters)
    card.appendChild(el('div', { class: 'shoshin-gs-section-title', text: 'Character Profile' }));
var profTable = el('table', { class: 'shoshin-gs-stats shoshin-gs-profile-stats' }, []);


    // Force a true 6-column grid so headers + values align 1:1 with Base Stats
    var profColgroup = el('colgroup', {}, [
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, [])
    ]);
    profTable.appendChild(profColgroup);


    var trH = el('tr', null, [
      el('th', { text: 'Melee Damage' }),
      el('th', { text: 'Melee Critical' }),
      el('th', { text: 'Melee Distance' }),
      el('th', { text: 'Ranged Damage' }),
      el('th', { text: 'Ranged Critical' }),
      el('th', { text: 'Ranged Distance' })
    ]);
var trV = el('tr', null, [
  el('td', { colspan: '3' }, [
    el('a', {
      href: '#',
      class: 'shoshin-gs-see-weapons',
onclick: function (e) {
  e.preventDefault();

  var st = window.__SHOSHIN_GS_STATE__;
  if (!st) return;

  if (!st.__tier2Memory) st.__tier2Memory = {};

  // remember where we were before switching
  st.__tier2Memory[st.tier1] = st.tier2;

  // switch to Armory → Melee Weapons
  st.tier1 = 'Armory';
  st.tier2 = 'Melee Weapons';
  st.__tier2Memory.Armory = 'Melee Weapons';

  render(st);
}

    }, '---- See Weapons Table in the Armory ----')
  ]),
  el('td', { colspan: '3' }, [
    el('a', {
      href: '#',
      class: 'shoshin-gs-see-weapons',
onclick: function (e) {
  e.preventDefault();

  var st = window.__SHOSHIN_GS_STATE__;
  if (!st) return;

  if (!st.__tier2Memory) st.__tier2Memory = {};

  // remember where we were before switching
  st.__tier2Memory[st.tier1] = st.tier2;

  // switch to Armory → Ranged Weapons
  st.tier1 = 'Armory';
  st.tier2 = 'Ranged Weapons';
  st.__tier2Memory.Armory = 'Ranged Weapons';

  render(st);
}

    }, '---- See Weapons Table in the Armory ----')
  ])
]);


    profTable.appendChild(trH);
    profTable.appendChild(trV);
    card.appendChild(profTable);

    card.appendChild(el('div', { class: 'shoshin-gs-spacer-lg' }));

    // Row 2b — Base stats (kept, no header per your latest direction)
    var baseTable = el('table', { class: 'shoshin-gs-stats' }, []);
    // Force a true 6-column grid so it matches the Character Profile row exactly
    var baseColgroup = el('colgroup', {}, [
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, [])
    ]);
baseTable.appendChild(baseColgroup);



    baseTable.appendChild(el('tr', null, [
      el('th', { text: 'Attack' }),
      el('th', { text: 'Defense' }),
      el('th', { text: 'Movement' }),
      el('th', { text: 'Body' }),
      el('th', { text: 'Leadership' }),
      el('th', { text: 'Initiative' })
    ]));
    baseTable.appendChild(el('tr', null, [
      el('td', { text: String(c.attack) }),
      el('td', { text: String(c.defense) }),
      el('td', { text: String(c.movement) + '"' }),
      el('td', { text: String(c.body) }),
      el('td', { text: String(c.leadership) }),
      el('td', { text: String(c.initiative) })
    ]));
    card.appendChild(baseTable);

    card.appendChild(el('div', { class: 'shoshin-gs-spacer-lg' }));

    // Row 3 — Included Proficiencies (NOT used for Yokai; Characters only)
    card.appendChild(el('div', { class: 'shoshin-gs-section-title', text: 'Base Proficiencies' }));


       var incWrap = el('div', { class: 'shoshin-gs-included' }, []);
    var inc = (INCLUDED_PROFICIENCIES && INCLUDED_PROFICIENCIES[cls]) ? INCLUDED_PROFICIENCIES[cls] : [];

    if (!inc.length) {
      incWrap.innerHTML = '<div style="font-size:0.9rem; font-style:italic; color:#666;">No included proficiencies for this class.</div>';
    } else {
      incWrap.innerHTML =
        '<table class="shoshin-table" style="width:100%; border-collapse:collapse; font-size:0.8rem;">' +
          '<thead>' +
            '<tr>' +
              '<th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">Proficiency</th>' +
              '<th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">Description</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            inc.map(function(name) {
              var desc = (PROFICIENCY_DESC && PROFICIENCY_DESC[name]) ? PROFICIENCY_DESC[name] : '';
              return '' +
                '<tr>' +
                  '<td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">' + name + '</td>' +
                  '<td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">' + (desc || '—') + '</td>' +
                '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>';

    }

    card.appendChild(incWrap);


    card.appendChild(el('div', { class: 'shoshin-gs-spacer-lg' }));


    // Row 3 — Character Abilities (filtered per class)
    card.appendChild(el('div', { class: 'shoshin-gs-section-title', text: 'Character Abilities' }));
    var abilWrap = el('div', { class: 'shoshin-gs-abilities' }, []);
    abilWrap.innerHTML = TABLES.abilities;

    // filter rows by CLASS_RULES[cls].abilities if present
    try {
      var allowed = (CLASS_RULES && CLASS_RULES[cls] && Array.isArray(CLASS_RULES[cls].abilities))
        ? CLASS_RULES[cls].abilities
        : null;

      // IMPORTANT:
      // - allowed === null  => do not filter (leave all visible)
      // - allowed is []     => show none (Ashigaru)
      // - allowed has items => show only allowed
      if (allowed !== null) {
        var tbody = abilWrap.querySelector('#shoshin-abilities-table tbody');
        if (tbody) {
          Array.prototype.slice.call(tbody.querySelectorAll('tr[data-ability]')).forEach(function(tr) {
            var a = tr.getAttribute('data-ability') || '';

            if (!allowed.length) {
              tr.style.setProperty('display', 'none', 'important');
              return;
            }

            if (allowed.indexOf(a) === -1) {
              tr.style.setProperty('display', 'none', 'important');
            } else {
              // in case a theme previously forced rows hidden
              tr.style.removeProperty('display');
            }
          });

        }

        var anyShown = !!abilWrap.querySelector('#shoshin-abilities-table tbody tr[data-ability]:not([style*="display: none"])');
        var emptyEl = abilWrap.querySelector('#shoshin-abilities-empty');
        if (emptyEl) emptyEl.style.display = anyShown ? 'none' : 'block';
      }
    } catch(e) {}


    card.appendChild(abilWrap);

    card.appendChild(el('div', { class: 'shoshin-gs-spacer-lg' }));

    // Row 4 — Master Class Abilities (from CSV; global per class)
    card.appendChild(el('div', { class: 'shoshin-gs-section-title', text: 'Master Class Abilities' }));
    var mcRows = (GS.masterClasses && GS.masterClasses[cls]) ? GS.masterClasses[cls] : [];
    if (!mcRows.length) {
      card.appendChild(el('div', { html: '<em>No master class abilities listed for this class yet.</em>' }));
    } else {
      var mcTable = el('table', { class: 'shoshin-table shoshin-gs-mc-table', style: 'width:100%; border-collapse:collapse; font-size:0.8rem;' }, []);

      mcTable.innerHTML =
        '<thead>' +
          '<tr>' +
            '<th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">Ability</th>' +
            '<th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">Effect</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' +
          mcRows.map(function(r) {
            return '<tr>' +
              '<td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">' + r.ability + '</td>' +
              '<td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555;">' + r.effect + '</td>' +
            '</tr>';
          }).join('') +
        '</tbody>';
      card.appendChild(mcTable);
    }

    return card;
  }

  function buildArmory(kind) {
    var wrap = el('div', { class: 'shoshin-gs-panel' }, []);
    if (kind === 'Melee Weapons') wrap.innerHTML = TABLES.meleeWeapons;
    else if (kind === 'Ranged Weapons') wrap.innerHTML = TABLES.rangedWeapons;
    else if (kind === 'Armor') wrap.innerHTML = TABLES.armor;
    else if (kind === 'Support Items') wrap.innerHTML = TABLES.supportItems;
    else if (kind === 'Artillery') {
      wrap.innerHTML = TABLES.munitions + '<div style="margin-top:10px;"><em>Taiho base profile: coming from asset data (next pass).</em></div>';
    } else if (kind === 'Sailing Ships') {
      wrap.innerHTML = '<div class="shoshin-gs-profile"><em>Wasen table/profile: coming from asset data (next pass).</em></div>';
    } else {
      wrap.innerHTML = '<em>Table not available yet.</em>';
    }
    return wrap;
  }

    function buildSupportAssetCard(assetKey) {
    var meta = Data.CLASS_META && Data.CLASS_META[assetKey] ? Data.CLASS_META[assetKey] : {};
    var img = (Data.CLASS_IMAGES && (Data.CLASS_IMAGES[assetKey] || Data.CLASS_IMAGES.default)) || '';
    var size = meta.size || '—';

    var shortDesc = '';
    var longDesc = '';
    var costText = '—';

    // Canonical per your spec
    if (assetKey === 'Taiho') {
      shortDesc = 'Seige Cannon';
      longDesc = 'TBD';
      costText = '8';
    } else if (assetKey === 'Wasen') {
      shortDesc = 'Wooden Sailing Ship';
      longDesc = 'TBD';
      costText = 'Variable';
      size = 'Variable';
    }

    var card = el('div', { class: 'shoshin-gs-profile' }, []);

    // Row 1 (same skeleton as Characters/Yokai)
    var row1 = el('div', { class: 'shoshin-gs-row1' }, []);
    var avatar = el('img', { class: 'shoshin-gs-avatar', src: img, alt: assetKey });

    var row1Left = el('div', { class: 'shoshin-gs-row1-left' }, []);
    var metaWrap = el('div', { class: 'shoshin-gs-meta' }, [
      el('div', { class: 'shoshin-gs-type', text: assetKey }),
      el('div', { class: 'shoshin-gs-short', html: shortDesc || (meta.description || '') }),
      el('div', { class: 'shoshin-gs-kv', html:
        '<span><b>Size:</b> ' + (size || '—') + '</span>' +
        '<span><b>Cost:</b> ' + (costText || '—') + '</span>'
      })
    ]);

row1Left.appendChild(avatar);
row1Left.appendChild(metaWrap);
row1.appendChild(row1Left);

// Right group: Game logo (upper-right) — match Characters
row1.appendChild(el('img', {
  class: 'shoshin-gs-game-logo',
  src: '/wp-content/uploads/2025/11/SPOA.webp',
  alt: 'Shoshin: The Path of Ascension'
}));

card.appendChild(row1);


    if (longDesc && longDesc !== 'TBD') {
      card.appendChild(el('div', { class: 'shoshin-gs-desc', text: longDesc }));
    }

    card.appendChild(el('div', { class: 'shoshin-gs-spacer-lg' }));

    // Section: Asset Profile
    card.appendChild(el('div', { class: 'shoshin-gs-section-title', text: 'Asset Profile' }));

    // 6-col table (melee/ranged)
    var profTable = el('table', { class: 'shoshin-gs-stats shoshin-gs-profile-stats' }, []);
    var profColgroup = el('colgroup', {}, [
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, [])
    ]);
    profTable.appendChild(profColgroup);

    profTable.appendChild(el('tr', null, [
      el('th', { text: 'Melee Damage' }),
      el('th', { text: 'Melee Critical' }),
      el('th', { text: 'Melee Distance' }),
      el('th', { text: 'Ranged Damage' }),
      el('th', { text: 'Ranged Critical' }),
      el('th', { text: 'Ranged Distance' })
    ]));

    if (assetKey === 'Taiho') {
      profTable.appendChild(el('tr', null, [
        el('td', { html: '<span class="shoshin-gs-see-weapons">--</span>' }),
        el('td', { html: '<span class="shoshin-gs-see-weapons">--</span>' }),
        el('td', { html: '<span class="shoshin-gs-see-weapons">--</span>' }),
        el('td', { colspan: '3', html: '<span class="shoshin-gs-see-weapons">---- See Munitions Table Below ----</span>' })
      ]));

    } else {
      // Wasen: all -- for now
      profTable.appendChild(el('tr', null, [
        el('td', { html: '<span class="shoshin-gs-see-weapons">--</span>' }),
        el('td', { html: '<span class="shoshin-gs-see-weapons">--</span>' }),
        el('td', { html: '<span class="shoshin-gs-see-weapons">--</span>' }),
        el('td', { html: '<span class="shoshin-gs-see-weapons">--</span>' }),
        el('td', { html: '<span class="shoshin-gs-see-weapons">--</span>' }),
        el('td', { html: '<span class="shoshin-gs-see-weapons">--</span>' })
      ]));
    }


    card.appendChild(profTable);
    card.appendChild(el('div', { class: 'shoshin-gs-spacer-lg' }));

    // Base stats table (labels adjusted for assets)
    var baseTable = el('table', { class: 'shoshin-gs-stats' }, []);
    var baseColgroup = el('colgroup', {}, [
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, [])
    ]);
    baseTable.appendChild(baseColgroup);

    baseTable.appendChild(el('tr', null, [
      el('th', { text: 'Attack' }),
      el('th', { text: 'Resistance' }),
      el('th', { text: 'Movement' }),
      el('th', { text: 'Toughness' }),
      el('th', { text: 'Leadership' }),
      el('th', { text: 'Initiative' })
    ]));

    if (assetKey === 'Taiho') {
      baseTable.appendChild(el('tr', null, [
        el('td', { html: '<span class="shoshin-gs-see-weapons">Variable</span>' }),
        el('td', { text: '4' }),
        el('td', { html: '<span class="shoshin-gs-see-weapons">Variable</span>' }),
        el('td', { text: '3' }),
        el('td', { html: '<span class="shoshin-gs-see-weapons">--</span>' }),
        el('td', { html: '<span class="shoshin-gs-see-weapons">Highest</span>' })
      ]));


} else {
  // Wasen: Movement+Toughness is a single colspan2 note
  baseTable.appendChild(el('tr', null, [
    el('td', { html: '<span class="shoshin-gs-see-weapons">--</span>' }),
    el('td', { text: '3' }),
    el('td', { colspan: '2', html: '<span class="shoshin-gs-see-weapons">---- See Hull Sizing ----</span>' }),
    el('td', { html: '<span class="shoshin-gs-see-weapons">--</span>' }),
    el('td', { html: '<span class="shoshin-gs-see-weapons">Captain</span>' })
  ]));
}


    card.appendChild(baseTable);
    card.appendChild(el('div', { class: 'shoshin-gs-spacer-lg' }));

    return card;
  }


function buildSupportAssets(kind) {
    var wrap = el('div', { class: 'shoshin-gs-panel' }, []);

      if (kind === 'Taiho') {
        var cardO = buildSupportAssetCard('Taiho');

        cardO.appendChild(el('div', { class: 'shoshin-gs-section-title', text: 'Training Requirements' }));
        cardO.appendChild(el('div', { html: TABLES.supportOzutsuTraining }));

        cardO.appendChild(el('div', { class: 'shoshin-gs-section-title', text: 'Munitions' }));
        cardO.appendChild(el('div', { html: TABLES.munitions }));

        cardO.appendChild(el('div', { class: 'shoshin-gs-section-title', text: 'Asset Rules & Mechanics' }));
        cardO.appendChild(el('div', { html: TABLES.supportOzutsuRules }));

        wrap.appendChild(cardO);

      } else if (kind === 'Wasen') {
      var cardW = buildSupportAssetCard('Wasen');

      cardW.appendChild(el('div', { class: 'shoshin-gs-section-title', text: 'Training Requirements' }));
      cardW.appendChild(el('div', { html: TABLES.supportWasenTraining }));

      cardW.appendChild(el('div', { class: 'shoshin-gs-section-title', text: 'Hull Sizing' }));
      cardW.appendChild(el('div', { html: TABLES.supportWasenHullSizing }));

      cardW.appendChild(el('div', { class: 'shoshin-gs-section-title', text: 'Asset Rules & Mechanics' }));
      cardW.appendChild(el('div', { html: TABLES.supportWasenRules }));

      wrap.appendChild(cardW);

    } else {
      wrap.innerHTML = '<em>Table not available yet.</em>';
    }

    return wrap;
  }



  function buildDojo(kind) {
    var wrap = el('div', { class: 'shoshin-gs-panel' }, []);
    wrap.innerHTML = TABLES.ryuTraining;

    // Filter the consolidated Ryū table by Tier2 category
    var allowed = [];

    if (kind === 'Melee Ryu') {
      allowed = [
        'Jujutsu',
        'Juttujutsu',
        'Bojutsu',
        'Tantojutsu',
        'Kusarigamajutsu',
        'Mojirijutsu',
        'Sojutsu',
        'Kenjutsu',
        'Naginatajutsu',
        'Iaijutsu'
      ];
    } else if (kind === 'Ranged Ryu') {
      allowed = [
        'Shurikenjutsu',
        'Fukumibarijutsu',
        'Kyujutsu',
        'Kayakujtusu',
        'Kayakujutsu' // safety alias (keeps things working if the row key is spelled this way)
      ];
    } else if (kind === 'Specialized Ryu') {
      allowed = [
        'Hojojutsu',
        'Suieijutsu',
        'Bajutsu',
        'Ninjutsu',
        'Onmyodo'
      ];
    }

    var table = wrap.querySelector('#shoshin-training-table');
    if (table && allowed.length) {
      var rows = table.querySelectorAll('tbody tr[data-training]');
      rows.forEach(function (tr) {
        var k = (tr.getAttribute('data-training') || '').trim();
        if (allowed.indexOf(k) === -1) {
          tr.style.setProperty('display', 'none', 'important');
        } else {
          tr.style.removeProperty('display');
        }
      });
    }

    return wrap;
  }

  function buildYokai(kind) {
    var list = (GS && GS.yokai) ? GS.yokai : [];
    var abilMap = (GS && GS.yokaiAbilities) ? GS.yokaiAbilities : {};

    function normKey(s) {
      return String(s || '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/-/g, '');
    }

    var rec = null;

    // 1) Exact match first
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it) continue;
      if (it.class === kind || it.display === kind) { rec = it; break; }
    }

    // 2) Normalized match (Yokai-only tolerance for hyphen/space/case drift)
    if (!rec) {
      var nk = normKey(kind);
      for (var j = 0; j < list.length; j++) {
        var it2 = list[j];
        if (!it2) continue;
        if (normKey(it2.class) === nk || normKey(it2.display) === nk) { rec = it2; break; }
      }
    }

    if (!rec) {
      return el('div', { class: 'shoshin-gs-profile', html: '<em>No data found for this Yokai.</em>' });
    }

    var card = el('div', { class: 'shoshin-gs-profile' }, []);

    // Row 1 (mirror Characters layout)
    var row1 = el('div', { class: 'shoshin-gs-row1' }, []);

    var row1Left = el('div', { class: 'shoshin-gs-row1-left' }, []);

    // Force fallback image for now (user will update paths later)
    var img = rec.image || FALLBACK_IMAGE;

    var avatar = el('img', { class: 'shoshin-gs-avatar', src: img, alt: rec.display || rec.class || kind });

    var metaWrap = el('div', { class: 'shoshin-gs-meta' }, [
      el('div', { class: 'shoshin-gs-type', text: rec.display || rec.class || kind }),
      el('div', { class: 'shoshin-gs-short', html: rec.shortDesc || '' }),
      el('div', { class: 'shoshin-gs-kv', html:
        '<span><b>Size:</b> ' + (rec.size || '—') + '</span>'
      })
    ]);

    row1Left.appendChild(avatar);
    row1Left.appendChild(metaWrap);
    row1.appendChild(row1Left);

    // Right group: Game logo (upper-right)
    row1.appendChild(el('img', {
      class: 'shoshin-gs-game-logo',
      src: '/wp-content/uploads/2025/11/SPOA.webp',
      alt: 'Shoshin: The Path of Ascension'
    }));

    card.appendChild(row1);
    card.appendChild(el('div', { class: 'shoshin-gs-spacer-lg' }));

    // Profile table — Yokai have actual Melee/Ranged values (NOT links)
    card.appendChild(el('div', { class: 'shoshin-gs-section-title', text: 'Character Profile' }));
    var profTable = el('table', { class: 'shoshin-gs-stats shoshin-gs-profile-stats' }, []);

    var profColgroup = el('colgroup', {}, [
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, [])
    ]);
    profTable.appendChild(profColgroup);

    profTable.appendChild(el('tr', null, [
      el('th', { text: 'Melee Damage' }),
      el('th', { text: 'Melee Critical' }),
      el('th', { text: 'Melee Distance' }),
      el('th', { text: 'Ranged Damage' }),
      el('th', { text: 'Ranged Critical' }),
      el('th', { text: 'Ranged Distance' })
    ]));

    profTable.appendChild(el('tr', null, [
      el('td', { text: String(rec.meleeDamage != null ? rec.meleeDamage : '—') }),
      el('td', { text: String(rec.meleeCritical != null ? rec.meleeCritical : '—') }),
      el('td', { text: String(rec.meleeDistance != null ? rec.meleeDistance : '—') }),
      el('td', { text: String(rec.rangedDamage != null ? rec.rangedDamage : '—') }),
      el('td', { text: String(rec.rangedCritical != null ? rec.rangedCritical : '—') }),
      el('td', { text: String(rec.rangedDistance != null ? rec.rangedDistance : '—') })
    ]));

    card.appendChild(profTable);
    card.appendChild(el('div', { class: 'shoshin-gs-spacer-lg' }));

    // Base stats (same schema as Characters)
    var baseTable = el('table', { class: 'shoshin-gs-stats' }, []);

    var baseColgroup = el('colgroup', {}, [
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, []),
      el('col', { style: 'width:16.6667%;' }, [])
    ]);
    baseTable.appendChild(baseColgroup);

    baseTable.appendChild(el('tr', null, [
      el('th', { text: 'Attack' }),
      el('th', { text: 'Defense' }),
      el('th', { text: 'Movement' }),
      el('th', { text: 'Body' }),
      el('th', { text: 'Leadership' }),
      el('th', { text: 'Initiative' })
    ]));

    var mv = (rec.movement === '--' || rec.movement == null) ? '—' : (String(rec.movement) + '"');

    baseTable.appendChild(el('tr', null, [
      el('td', { text: String(rec.attack != null ? rec.attack : '—') }),
      el('td', { text: String(rec.defense != null ? rec.defense : '—') }),
      el('td', { text: mv }),
      el('td', { text: String(rec.body != null ? rec.body : '—') }),
      el('td', { text: String(rec.leadership != null ? rec.leadership : '—') }),
      el('td', { text: String(rec.initiative != null ? rec.initiative : '—') })
    ]));

    card.appendChild(baseTable);
    card.appendChild(el('div', { class: 'shoshin-gs-spacer-lg' }));


    // Character Abilities (Yokai-specific; icon column added by hydrateIcons() via #shoshin-abilities-table)
    card.appendChild(el('div', { class: 'shoshin-gs-section-title', text: 'Character Abilities' }));

    var abilWrap = el('div', { class: 'shoshin-gs-abilities' }, []);
    var rows = abilMap[rec.class] || abilMap[kind] || [];

    if (!rows || !rows.length) {
      abilWrap.innerHTML = '<div style="font-size:0.9rem; font-style:italic; color:#666;">No abilities found for this Yokai.</div>';
    } else {
      abilWrap.innerHTML =
        '<div class="shoshin-step2-panel">' +
          '<table id="shoshin-abilities-table" class="shoshin-table" style="width:100%; border-collapse:collapse; font-size:0.8rem;">' +
            '<thead>' +
              '<tr>' +
                '<th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left;">Ability</th>' +
                '<th style="border-bottom:1px solid #ccc; padding:4px 6px; text-align:left !important; white-space:normal !important;">Description</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              rows.map(function (a) {
                var name = (a && a.ability) ? a.ability : '';
                var eff = (a && a.effect) ? a.effect : '';
                return '' +
                  '<tr data-ability="' + String(name).replace(/"/g, '&quot;') + '">' +
                    '<td style="padding:4px 6px; border-bottom:1px solid #eee; font-weight:600;">' + String(name) + '</td>' +
                    '<td style="padding:4px 6px; border-bottom:1px solid #eee; color:#555; text-align:left !important; white-space:normal !important; overflow-wrap:anywhere !important; word-break:break-word !important;">' + String(eff) + '</td>' +
                  '</tr>';
              }).join('') +
            '</tbody>' +
          '</table>' +
        '</div>';
    }

    card.appendChild(abilWrap);

    return card;
  }

  // BEGIN SHOSHIN PATCH — TASK2 buildTables(kind) renderer (no icons, no links)
  function buildTables(kind) {
    var rec = (GS && GS.tables && GS.tables[kind]) ? GS.tables[kind] : null;
    if (!rec) {
      return el('div', { class: 'shoshin-gs-profile', html: '<em>Table not available yet.</em>' });
    }

    var card = el('div', { class: 'shoshin-gs-profile' }, []);

// BEGIN SHOSHIN PATCH — remove redundant per-table title (v50)
// NOTE: Tier2 navigation already labels the view; avoid duplicate heading inside the table card.
// card.appendChild(el('div', { class: 'shoshin-gs-section-title', text: rec.title || kind }, []));
// END SHOSHIN PATCH — remove redundant per-table title (v50)


    // Build .shoshin-table
    function buildOneTable(rowsForThisTable, columnsOverride) {

      var table = el('table', {
        class: 'shoshin-table',
        style: 'width:100%; border-collapse:collapse; font-size:0.8rem; table-layout:fixed;'
      }, []);

      // Deterministic column widths for Actions + Saving Throws only
      if (kind === 'Actions' || kind === 'Saving Throws') {
        var colgroup = document.createElement('colgroup');

        var c1 = document.createElement('col'); c1.style.width = '20%';
        var c2 = document.createElement('col'); c2.style.width = '20%';
        var c3 = document.createElement('col'); c3.style.width = '60%';

        colgroup.appendChild(c1);
        colgroup.appendChild(c2);
        colgroup.appendChild(c3);

        table.appendChild(colgroup);
      }

      // Deterministic column widths for Movement + Combat Modifiers
      if (kind === 'Movement' || kind === 'Combat Modifiers') {
        var colgroupMC = document.createElement('colgroup');

        // Col1 wider, Col2 narrower, Col3 largest
        var m1 = document.createElement('col'); m1.style.width = '30%';
        var m2 = document.createElement('col'); m2.style.width = '20%';
        var m3 = document.createElement('col'); m3.style.width = '50%';

        colgroupMC.appendChild(m1);
        colgroupMC.appendChild(m2);
        colgroupMC.appendChild(m3);

        table.appendChild(colgroupMC);
      }


      // Deterministic column widths for Object Classifications only
      if (kind === 'Object Classifications') {
        var colgroupOC = document.createElement('colgroup');

        // Col1–Col5 equal width
        var oc1 = document.createElement('col'); oc1.style.width = '10%';
        var oc2 = document.createElement('col'); oc2.style.width = '10%';
        var oc3 = document.createElement('col'); oc3.style.width = '10%';
        var oc4 = document.createElement('col'); oc4.style.width = '10%';
        var oc5 = document.createElement('col'); oc5.style.width = '10%';

        // Col6–Col7 wide
        var oc6 = document.createElement('col'); oc6.style.width = '25%';
        var oc7 = document.createElement('col'); oc7.style.width = '25%';

        colgroupOC.appendChild(oc1);
        colgroupOC.appendChild(oc2);
        colgroupOC.appendChild(oc3);
        colgroupOC.appendChild(oc4);
        colgroupOC.appendChild(oc5);
        colgroupOC.appendChild(oc6);
        colgroupOC.appendChild(oc7);

        table.appendChild(colgroupOC);
      }

      var thead = document.createElement('thead');
      var trh = document.createElement('tr');

      var cols = Array.isArray(columnsOverride) ? columnsOverride : (Array.isArray(rec.columns) ? rec.columns : []);

      cols.forEach(function (c) {
        var th = document.createElement('th');
        th.style.borderBottom = '1px solid #ccc';
        th.style.padding = '4px 6px';
        th.style.whiteSpace = 'pre-line';
        th.style.verticalAlign = 'middle';

        // Actions + Saving Throws: Col1/Col2 centered; Col3 left
        if ((kind === 'Actions' || kind === 'Saving Throws') && (cols.indexOf(c) === 0 || cols.indexOf(c) === 1)) {
          th.style.textAlign = 'center';

        // Movement + Combat Modifiers: Col2 centered
        } else if ((kind === 'Movement' || kind === 'Combat Modifiers') && cols.indexOf(c) === 1) {
          th.style.textAlign = 'center';

        } else if (kind === 'Actions' || kind === 'Saving Throws') {
          th.style.textAlign = 'left';

        // Object Classifications: Col1–Col5 centered; Col6–Col7 left
        } else if (kind === 'Object Classifications' && cols.indexOf(c) <= 4) {
          th.style.textAlign = 'center';
        } else if (kind === 'Object Classifications') {
          th.style.textAlign = 'left';

        } else {
          th.style.textAlign = 'left';
        }


        th.textContent = String(c || '');
        trh.appendChild(th);
      });

      thead.appendChild(trh);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');
      var rows = Array.isArray(rowsForThisTable) ? rowsForThisTable : [];

      rows.forEach(function (r) {
        var tr = document.createElement('tr');
        (Array.isArray(r) ? r : []).forEach(function (cell) {
          var td = document.createElement('td');
          td.style.padding = '4px 6px';
          td.style.borderBottom = '1px solid #eee';
          td.style.whiteSpace = 'pre-line';
          td.style.verticalAlign = 'middle';

          // Actions + Saving Throws: Col1/Col2 centered; Col3 left
          if ((kind === 'Actions' || kind === 'Saving Throws') && (tr.children.length === 0 || tr.children.length === 1)) {
            td.style.textAlign = 'center';

          // Movement + Combat Modifiers: Col2 centered
          } else if ((kind === 'Movement' || kind === 'Combat Modifiers') && tr.children.length === 1) {
            td.style.textAlign = 'center';

          } else if (kind === 'Actions' || kind === 'Saving Throws') {
            td.style.textAlign = 'left';

          // Object Classifications: Col1–Col5 centered; Col6–Col7 left
          } else if (kind === 'Object Classifications' && tr.children.length <= 4) {
            td.style.textAlign = 'center';
          } else if (kind === 'Object Classifications') {
            td.style.textAlign = 'left';

          } else {
            td.style.textAlign = 'left';
          }


          td.textContent = String(cell == null ? '' : cell);
          tr.appendChild(td);
        });

        // If a row is short, pad deterministically to column count
        while (tr.children.length < cols.length) {
          var tdPad = document.createElement('td');
          tdPad.style.padding = '4px 6px';
          tdPad.style.borderBottom = '1px solid #eee';
          tdPad.style.verticalAlign = 'middle';
          tdPad.style.textAlign = 'left';
          tdPad.style.whiteSpace = 'pre-line';
          tdPad.textContent = '';
          tr.appendChild(tdPad);
        }

        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      return table;
    }

    // Special-case: Movement renders as TWO tables (Types first, Modifiers second)
    if (kind === 'Movement') {
      var allRows = Array.isArray(rec.rows) ? rec.rows : [];
      var typeSet = { 'March':1, 'Sprint':1, 'Charge':1, 'Climb':1, 'Overwatch':1 };

      var movementTypesRows = [];
      var movementModsRows = [];

      allRows.forEach(function (r) {
        var key = (Array.isArray(r) && r.length) ? String(r[0] || '') : '';
        if (typeSet[key]) movementTypesRows.push(r);
        else movementModsRows.push(r);
      });

      // Subtitle: Movement Types
      card.appendChild(el('div', {
        style: 'margin:0px 0 6px; text-align:center; font-weight:700; color:#333;',
        text: 'Movement Types'
      }));

      card.appendChild(buildOneTable(movementTypesRows, ['Type', 'Applies To', 'Effect']));


      // Subtitle: Movement Modifiers
      card.appendChild(el('div', {
        style: 'margin:14px 0 6px; text-align:center; font-weight:700; color:#333;',
        text: 'Movement Modifiers'
      }));

      // IMPORTANT: This table uses the SAME colgroupMC widths as Movement Types (25/25/50)
      card.appendChild(buildOneTable(movementModsRows, ['Terrain', 'Unit Size', 'Effect']));


      return card;
    }

    // Default: single-table render for all other kinds
    card.appendChild(buildOneTable(rec.rows));
    return card;

  }
  // END SHOSHIN PATCH — TASK2 buildTables(kind) renderer


  function render(state) {
    var root = getRoot();
    if (!root) return;

    root.innerHTML = '';
    injectStyleOnce();

    var wrap = el('div', { class: 'shoshin-gs-wrap' }, []);
wrap.appendChild(buildFilters(state));

var tier2Info = buildTier2Info(state);
if (tier2Info) wrap.appendChild(tier2Info);

var panel = el('div', { class: 'shoshin-gs-panel' }, []);


    if (state.tier1 === 'Characters') panel.appendChild(buildCharacterProfile(state.tier2));
    else if (state.tier1 === 'Armory') panel.appendChild(buildArmory(state.tier2));
    else if (state.tier1 === 'Dojo') panel.appendChild(buildDojo(state.tier2));
    else if (state.tier1 === 'Support Assets') panel.appendChild(buildSupportAssets(state.tier2));
    else if (state.tier1 === 'Yokai') panel.appendChild(buildYokai(state.tier2));
    else if (state.tier1 === 'Tables') panel.appendChild(buildTables(state.tier2));

    else panel.innerHTML = '<em>Section not available.</em>';

    wrap.appendChild(panel);
    root.appendChild(wrap);

    // After DOM is mounted, hydrate image columns + icon src (fallback-safe)
    hydrateIcons(panel);

  }

  function boot() {
    var root = getRoot();
    if (!root) return;

    
    // -------------------------------------------------------------------
    // FINALIZE CANONICAL DATA (must run at boot)
    // Some pages load other site scripts AFTER this file and overwrite Shoshin.Data.
    // Rebind Data to the current Shoshin.Data object and re-merge defaults so Ozutsu/Wasen exist.
    // -------------------------------------------------------------------
    var ShoshinRef = window.Shoshin || (window.Shoshin = {});
    Data = ShoshinRef.Data || (ShoshinRef.Data = {});

    Data.CLASS_META = Data.CLASS_META || {};
    Data.CLASS_IMAGES = Data.CLASS_IMAGES || {};

    // Deep-fill DEFAULT_CLASS_META into Data.CLASS_META (do NOT overwrite intentional values)
    Object.keys(DEFAULT_CLASS_META).forEach(function (k) {
      var def = DEFAULT_CLASS_META[k];
      var cur = Data.CLASS_META[k];

      if (!cur || typeof cur !== 'object') {
        Data.CLASS_META[k] = def;
        return;
      }
      if (!cur.size) cur.size = def.size;
      if (!cur.displayName) cur.displayName = def.displayName;
      if (!cur.description) cur.description = def.description;
    });

// Apply DEFAULT_CLASS_IMAGES (authoritative for /game-system)
// NOTE: prior logic only filled missing keys, so legacy class art (e.g. /2025/12/*) would never update.
Object.keys(DEFAULT_CLASS_IMAGES).forEach(function (k) {
  var defImg = DEFAULT_CLASS_IMAGES[k];
  if (!defImg || typeof defImg !== 'string') return;

  var curImg = Data.CLASS_IMAGES[k];

  // Overwrite blanks/invalid + legacy class art paths
  var isBlank = (!curImg || typeof curImg !== 'string');
  var isLegacy = (typeof curImg === 'string' && /\/wp-content\/uploads\/2025\/12\//.test(curImg));

  if (isBlank || isLegacy) {
    Data.CLASS_IMAGES[k] = defImg;
  }
});



    // In-memory (page-life) state: persists while navigating within the site/page,
    // resets on full page refresh (as desired).
    var state = window.__SHOSHIN_GS_STATE__;
    if (!state) {
      state = {
        tier1: 'Characters',
        tier2: (GS.tier2.Characters && GS.tier2.Characters[0]) ? GS.tier2.Characters[0] : '',
        __tier2Memory: {}
      };
      // Seed memory for the default landing state
      state.__tier2Memory[state.tier1] = state.tier2;
      window.__SHOSHIN_GS_STATE__ = state;
    }

    render(state);

  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();