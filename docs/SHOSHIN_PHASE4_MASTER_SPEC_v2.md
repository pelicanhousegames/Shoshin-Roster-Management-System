# SHOSHIN PHASE 4 — MASTER SPECIFICATION v2

**Clan Roster System, Asset Management & Print Architecture (Phased Delivery Plan)**
**Status:** Approved direction / Phased implementation (4A now, 4B next, 4C later)

---

## 0. High-Level Summary

Phase 4 completes the MVP of the Shoshin digital ecosystem by delivering:

### User Asset Management (Already delivered)

* **/my-assets** page listing all **Character** and **Support Asset** entries owned by the logged-in user.
* Shared display patterns, expandable UI, and consistent table styling to be reused across roster pages.

### Clan Roster System (Phased)

* **4A (Roster Foundation — current scope):**

  * Create rosters (metadata only): **/create-roster**
  * List rosters (summary + empty assignment placeholders): **/my-rosters**
  * Forward-compatible data model with reserved fields for later assignment + totals
* **4B (Roster Composition — next scope):**

  * Assign units to rosters from /my-assets and/or roster composer UI
  * Daimyo replacement logic
  * Live computation + persistent roster JSON
  * Edit/delete rosters; deletion cascade handling when assets are removed
* **4C (Print & Entitlements — later scope):**

  * Consolidated + Complete print modes
  * Subscription/role-based roster limits and server-side guardrails

### Print & PDF System (Deferred to 4C)

* Two print modes:

  * Consolidated Print (by build)
  * Complete Print (per unit instance)

### Guiding Principles

* Phase 4 **does not modify gameplay rules or content**. It is system + UX infrastructure only.
* All phases must be **non-regressive** to completed systems (/create-character, /create-asset, /my-assets).

---

## 1. Data Model Specifications

### 1.1 Character Asset Model (WPForms Entry)

**Identity**

* `owner_user_id` (hidden)
* `ref_id` (visible, required; ex. “SAM-004”)
* `class` (Daimyo, Samurai, Ashigaru, Sohei, Ninja, Onmyoji)
* `game_system` (hidden, single-line text; MVP = “Path of Ascension”)

**Derived Stats (hidden; written by JS on recompute)**

* `char_melee_damage`
* `char_melee_crit`
* `char_melee_distance` (with ")
* `char_ranged_damage`
* `char_ranged_crit`
* `char_ranged_distance` (with ")
* `char_atk`
* `char_def`
* `char_mov` (with ")
* `char_bod`
* `char_ldr`
* `char_ini`
* `char_total_cost`

**Rules Metadata**

* `char_abilities[]`
* `char_training[]`
* `char_equipment_fields` (existing)
* `char_mrbpa_modifiers` (hidden text/JSON string; ≤ 8 printed)

---

### 1.2 Support Asset Model (WPForms Entry)

**Identity**

* `owner_user_id`
* `ref_id`
* `asset_type` (“Ozutsu”, “Mokuzo Hansen”, etc.)
* `game_system` (“Path of Ascension”)

**Derived Stats (hidden)**

* `asset_melee_damage`
* `asset_melee_crit`
* `asset_melee_distance` (with ")
* `asset_ranged_damage`
* `asset_ranged_crit`
* `asset_ranged_distance` (with ")
* `asset_atk`
* `asset_def` (mapped from Resistance)
* `asset_mov` (with ")
* `asset_bod` (Toughness)
* `asset_ldr`
* `asset_ini`
* `asset_total_cost`

**Rules Metadata**

* `asset_mrbpa_modifiers` (hidden; from munitions/hull category)

---

### 1.3 Roster Model (WPForms Entry)

#### 4A Fields (Implemented Now)

**Visible**

* `roster_name` (required)
* `roster_ref_id` (placeholder/user-entered; validation applies)

**Hidden**

* `owner_user_id`

#### 4A Reserved Fields (Must exist now, populated later)

**Hidden**

* `roster_items_json` (string; authoritative in 4B/4C)
* `roster_total_points` (cache for sorting; recomputed on view in 4B/4C)
* optional caches (if desired later): `roster_initiative`, `roster_total_honor`, `roster_masteries`

#### RosterItems JSON Schema (Activated in 4B)

```json
[
  {
    "assetEntryId": 123,
    "formId": 2247,
    "type": "character",
    "quantity": 3
  },
  {
    "assetEntryId": 456,
    "formId": 2501,
    "type": "support",
    "quantity": 1
  }
]
```

**Notes**

* MVP is PoA-only; roster does not store game system in 4A.
* JSON is authoritative for roster composition starting in 4B.

---

## 2. UX Specifications

### 2.1 /my-assets (Delivered)

* Assets grouped by category and type
* Consistent stat display + expandable UI
* Action buttons exist (Assign/Edit/Delete) — behavior may be expanded in 4B

---

### 2.2 /create-roster

#### 4A (Implemented Now)

**Purpose**

* Create a roster record (metadata only)

**UX**

* Standard WPForms inputs:

  * Roster Name
  * Roster Ref ID
* A summary card display matching existing ecosystem styling
* No composer UI
* No asset assignment

**Messaging**

* “Roster created. You will be able to assign units in a future update.”

#### 4B (Deferred)

Roster Composer UI (JS-rendered):

* If user has assets: add/remove items, quantities, recompute totals live
* If user has no assets: prompt to create assets, with links

---

### 2.3 /my-rosters

#### 4A (Implemented Now)

**Roster listing cards or summary table**:

* Clan Name
* Reference ID
* Assigned Units (placeholder: 0)
* Actions (placeholder for future): Print/Edit/Delete

**Empty State**

* If no rosters exist: show friendly message and CTA to /create-roster

#### 4B (Deferred)

* Expand row shows roster item table (Class—Ref ID, Type, Qty, Cost, Line total)
* Totals displayed (Clan Points, Initiative, Honor, Masteries)
* Edit/Delete enabled

---

### 2.4 Assign to Roster Modal (Deferred to 4B)

Triggered from /my-assets:

* Shows asset display card
* Select roster dropdown
* Quantity input
* Assign/Cancel buttons

**Daimyo replacement logic**

* If roster already has a Daimyo, prompt replacement confirmation
* Replace entry in rosterItems JSON if confirmed

---

## 3. Print System Specification (Deferred to 4C)

### 3.1 Print Modes

* Consolidated Print
* Complete Print

### 3.2 Consolidated Print

* Header: clan name/ref, points, initiative, honor, masteries
* Ordered sections: Daimyo → Samurai → Ashigaru → Sohei → Ninja → Onmyoji → Support Assets
* Per-build blocks: modifiers/abilities caps, stat table, cost panel

### 3.3 Complete Print

* Same layout as consolidated
* Expands quantity Q into Q individual blocks

### 3.4 Implementation Notes

* Build HTML into hidden `#shoshin-print-area`
* Trigger `window.print()`
* Print CSS ensures clean page breaks

---

## 4. Backend Logic (Deferred to 4B/4C)

### 4.1 Asset Deletion Cascade (4B)

* When an asset is deleted:

  * remove it from all rosters owned by that user
  * recompute totals
  * save updated roster JSON

### 4.2 Role Guarding / Subscription Limits (4C)

* Contributor: max 3 rosters
* Author: unlimited
* Enforced on create + server endpoints

---

## 5. WPForms Integration

### 5.1 Hidden Fields Placement

* No new page breaks
* Hidden fields at bottom of final step
* JS recompute functions populate hidden fields

### 5.2 Required Hidden Fields Summary

**Characters**

* `game_system`, `char_*` derived stats, `char_total_cost`, `char_mrbpa_modifiers`

**Support Assets**

* `game_system`, `asset_*` derived stats, `asset_total_cost`, `asset_mrbpa_modifiers`

**Rosters**

* `owner_user_id`
* 4A: `roster_name`, `roster_ref_id`
* Reserved for later: `roster_items_json`, `roster_total_points` (+ optional caches)

---

## 6. Success Criteria

### 4A Success Criteria

* /create-roster creates roster entry successfully (metadata-only)
* /my-rosters lists user rosters with correct empty state behavior
* No regressions to create-character/create-asset/my-assets

### 4B Success Criteria

* Assign modal works (with Daimyo replacement)
* Roster composer works (Option B)
* roster_items_json authoritative, totals computed correctly
* Deletion cascade keeps rosters clean

### 4C Success Criteria

* Print modes work and match styling requirements
* Roster caps enforced and endpoints guarded

---

## 7. Post-Phase Readiness

Prepared for:

* Multi-system support
* New classes/support types
* Additional print templates
* Export to Airtable
* Future expansions and roster sharing

**END OF SPEC v2**
