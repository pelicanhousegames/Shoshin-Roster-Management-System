<?php
/**
 * ajax-wpforms-entries.php
 * Shared WPForms AJAX endpoints (Delete entry, Get rosters, Assign unit to rosters)
 *
 * PHASE 3 BASELINE FIXES:
 * - Unified nonce action via shoshin_ajax_nonce_action() (shared across ecosystem)
 * - Verify nonce from POST[nonce] OR POST[security]
 * - Guard helper function declarations
 * - When writing roster assigned_units_json (#9), also write digest (#10) using sha1()
 * - NEW: When deleting an asset entry, cascade-remove it from all rosters' assigned_units_json
 * - NEW: When returning rosters, compute totals from assigned_units_json so modals can reflect persistence
 */

if (!defined('ABSPATH')) exit;

/* ------------------------------------------------------------------------- */
/* UNIFIED NONCE ACTION (shared across ecosystem)                              */
/* ------------------------------------------------------------------------- */
if (!function_exists('shoshin_ajax_nonce_action')) {
  function shoshin_ajax_nonce_action() {
    return 'shoshin_ajax';
  }
}

/* ------------------------------------------------------------------------- */
/* SAFE ACCESS HELPERS (arrays OR stdClass)                                    */
/* ------------------------------------------------------------------------- */
if (!function_exists('shoshin_get')) {
  function shoshin_get($thing, $key, $default = null) {
    if (is_array($thing)) return array_key_exists($key, $thing) ? $thing[$key] : $default;
    if (is_object($thing)) return property_exists($thing, $key) ? $thing->$key : $default;
    return $default;
  }
}

if (!function_exists('shoshin_set')) {
  function shoshin_set(&$thing, $key, $value) {
    if (is_array($thing)) { $thing[$key] = $value; return; }
    if (is_object($thing)) { $thing->$key = $value; return; }
  }
}

/* ------------------------------------------------------------------------- */
/* BOOTSTRAP: DEFINE window.ShoshinAjax WHERE NEEDED (WPCode-safe)             */
/* ------------------------------------------------------------------------- */
add_action('wp_footer', function () {
  if (!is_user_logged_in()) return;

  $uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
  $looks_like_assets  = ($uri && stripos($uri, 'my-assets') !== false);
  $looks_like_rosters = ($uri && stripos($uri, 'my-rosters') !== false);

  // Soft gate (kept)
  if (!$looks_like_assets && !$looks_like_rosters && !is_page()) return;

  $cfg = [
    'ajaxUrl' => admin_url('admin-ajax.php'),
    'nonce'   => wp_create_nonce(shoshin_ajax_nonce_action()),
  ];

  echo '<script>window.ShoshinAjax=' . wp_json_encode($cfg) . ';</script>' . "\n";
}, 100);

/* ------------------------------------------------------------------------- */
/* HELPERS                                                                     */
/* ------------------------------------------------------------------------- */
if (!function_exists('shoshin_ajax_require_logged_in')) {
  function shoshin_ajax_require_logged_in() {
    if (!is_user_logged_in()) wp_send_json_error(['message' => 'Not logged in.'], 401);
  }
}

if (!function_exists('shoshin_ajax_verify_nonce')) {
  function shoshin_ajax_verify_nonce() {
    $nonce = '';
    if (isset($_POST['nonce'])) $nonce = sanitize_text_field(wp_unslash($_POST['nonce']));
    elseif (isset($_POST['security'])) $nonce = sanitize_text_field(wp_unslash($_POST['security']));

    if (!$nonce || !wp_verify_nonce($nonce, shoshin_ajax_nonce_action())) {
      wp_send_json_error(['message' => 'Invalid nonce.'], 403);
    }
  }
}

if (!function_exists('shoshin_wpforms_available_or_fail')) {
  function shoshin_wpforms_available_or_fail() {
    if (!function_exists('wpforms') || !is_object(wpforms()) || !isset(wpforms()->entry)) {
      wp_send_json_error(['message' => 'WPForms not available.'], 500);
    }
  }
}

if (!function_exists('shoshin_wpforms_decode_fields')) {
  function shoshin_wpforms_decode_fields($entry) {
    $raw = shoshin_get($entry, 'fields', '');
    if (is_array($raw)) return $raw;
    $fields = json_decode((string) $raw, true);
    return is_array($fields) ? $fields : [];
  }
}

if (!function_exists('shoshin_wpforms_get_field_value')) {
  function shoshin_wpforms_get_field_value($fields, $field_id) {
    if (!is_array($fields) || !isset($fields[$field_id])) return '';
    if (is_array($fields[$field_id]) && isset($fields[$field_id]['value'])) return $fields[$field_id]['value'];
    return '';
  }
}

if (!function_exists('shoshin_wpforms_set_field_value')) {
  function shoshin_wpforms_set_field_value(&$fields, $field_id, $value) {
    if (!isset($fields[$field_id]) || !is_array($fields[$field_id])) {
      $fields[$field_id] = ['id' => (int) $field_id, 'value' => ''];
    }
    $fields[$field_id]['value'] = $value;
  }
}

/**
 * Parse assigned_units_json into array.
 */
if (!function_exists('shoshin_parse_assigned_units')) {
  function shoshin_parse_assigned_units($raw) {
    if (is_array($raw)) return $raw;
    $raw = (string) $raw;
    if (!$raw) return [];
    $arr = json_decode($raw, true);
    return is_array($arr) ? $arr : [];
  }
}

/**
 * Compute simple roster totals from assigned units.
 * - points: sum(points * qty)
 * - units: sum(qty)
 * - ini: sum(ini * qty)
 * - honor: sum(honor * qty)
 */
if (!function_exists('shoshin_compute_roster_totals')) {
  function shoshin_compute_roster_totals($assigned_units) {
    $tot = ['points' => 0, 'units' => 0, 'ini' => 0, 'honor' => 0];
    if (!is_array($assigned_units)) return $tot;

    foreach ($assigned_units as $u) {
      if (!is_array($u)) continue;
      $qty = isset($u['qty']) ? (int) $u['qty'] : 1;
      if ($qty < 1) $qty = 1;

      $pts   = isset($u['points']) ? (int) $u['points'] : 0;
      $ini   = isset($u['ini']) ? (int) $u['ini'] : (isset($u['initiative']) ? (int)$u['initiative'] : 0);
      $honor = isset($u['honor']) ? (int) $u['honor'] : 0;

      $tot['points'] += ($pts * $qty);
      $tot['units']  += $qty;
      $tot['ini']    += ($ini * $qty);
      $tot['honor']  += ($honor * $qty);
    }

    return $tot;
  }
}

/**
 * Remove a specific asset assignment from all rosters owned by user.
 * Matches on entryId + kind when available.
 */
if (!function_exists('shoshin_cascade_unassign_deleted_asset_from_rosters')) {
  function shoshin_cascade_unassign_deleted_asset_from_rosters($user_id, $deleted_entry_id, $deleted_kind = '') {
    $ROSTER_FORM_ID    = 2799;
    $ASSIGNED_FIELD_ID = 9;
    $DIGEST_FIELD_ID   = 10;

    $deleted_entry_id = (string) ((int) $deleted_entry_id);
    $deleted_kind = trim((string) $deleted_kind);

    $entries = wpforms()->entry->get_entries([
      'form_id' => $ROSTER_FORM_ID,
      'user_id' => (int) $user_id,
      'number'  => 500,
      'orderby' => 'entry_id',
      'order'   => 'DESC',
    ]);
    if (!is_array($entries) || !$entries) return ['touched' => 0, 'updated' => 0];

    $touched = 0;
    $updated = 0;

    foreach ($entries as $e) {
      $rid = (int) shoshin_get($e, 'entry_id', 0);
      if (!$rid) continue;

      // Load full entry for update
      $entry = wpforms()->entry->get($rid);
      if (!$entry) continue;

      $fields = shoshin_wpforms_decode_fields($entry);
      $assigned_json = (string) shoshin_wpforms_get_field_value($fields, $ASSIGNED_FIELD_ID);
      if (!$assigned_json) continue;

      $assigned = shoshin_parse_assigned_units($assigned_json);
      if (!$assigned) continue;

      $before = count($assigned);

      $assigned = array_values(array_filter($assigned, function ($u) use ($deleted_entry_id, $deleted_kind) {
        if (!is_array($u)) return false; // drop junk
        $eid = isset($u['entryId']) ? (string) ((int) $u['entryId']) : '';
        if ($eid !== $deleted_entry_id) return true; // keep

        // If kind is provided, require match; otherwise remove by entryId alone.
        if ($deleted_kind !== '') {
          $k = isset($u['kind']) ? (string) $u['kind'] : '';
          return $k !== $deleted_kind;
        }

        return false; // remove
      }));

      $after = count($assigned);
      if ($after === $before) continue;

      $touched++;

      $new_json = wp_json_encode($assigned, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
      $new_digest = sha1($new_json);

      shoshin_wpforms_set_field_value($fields, $ASSIGNED_FIELD_ID, $new_json);
      shoshin_wpforms_set_field_value($fields, $DIGEST_FIELD_ID, $new_digest);

      $fields_json = wp_json_encode($fields, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

      $ok = wpforms()->entry->update($rid, [
        'fields'  => $fields_json,
        'form_id' => $ROSTER_FORM_ID,
      ]);

      if ($ok) $updated++;
    }

    return ['touched' => $touched, 'updated' => $updated];
  }
}

/* ------------------------------------------------------------------------- */
/* 1) DELETE WPForms ENTRY                                                     */
/* action: shoshin_delete_wpforms_entry                                        */
/* ------------------------------------------------------------------------- */
add_action('wp_ajax_shoshin_delete_wpforms_entry', function () {
  shoshin_ajax_require_logged_in();
  shoshin_ajax_verify_nonce();
  shoshin_wpforms_available_or_fail();

  $entry_id = isset($_POST['entryId']) ? absint($_POST['entryId']) : 0;
  if (!$entry_id) wp_send_json_error(['message' => 'Missing entryId.'], 400);

  $entry = wpforms()->entry->get($entry_id);
  $entry_id_found = (int) shoshin_get($entry, 'entry_id', 0);
  if (!$entry || !$entry_id_found) wp_send_json_error(['message' => 'Entry not found.'], 404);

  $user_id = get_current_user_id();
  $entry_user_id = (int) shoshin_get($entry, 'user_id', 0);
  if ($entry_user_id !== (int) $user_id) wp_send_json_error(['message' => 'Forbidden.'], 403);

  // Capture delete context (JS sends this)
  $kind   = isset($_POST['kind']) ? sanitize_text_field(wp_unslash($_POST['kind'])) : '';
  $formId = isset($_POST['formId']) ? absint($_POST['formId']) : 0;

  // ------------------------------------------------------------
  // NEW: if this is a roster deletion, capture banner file now
  // ------------------------------------------------------------
  $banner_deleted = false;
  $banner_relpath = '';

  $is_roster_delete = ($kind === 'roster' || $formId === 2799 || (int) shoshin_get($entry, 'form_id', 0) === 2799);

  if ($is_roster_delete) {
    // We must read fields BEFORE deleting the entry
    $fields = shoshin_wpforms_decode_fields($entry);
    $field8 = isset($fields[8]) ? $fields[8] : null;

    $banner_relpath = shoshin_roster_banner_extract_file_relpath($field8);
  }

  // Perform the delete
  $ok = wpforms()->entry->delete($entry_id);
  if (!$ok) wp_send_json_error(['message' => 'Delete failed.'], 500);

  // NEW: if roster delete, purge banner file after entry delete succeeds
  if ($is_roster_delete && $banner_relpath) {
    $banner_deleted = shoshin_roster_banner_delete_by_relpath($banner_relpath);
  }

  // Existing: cascade cleanup for asset deletions (characters/support assets)
  $deleted_kind = $kind;
  if ($deleted_kind === '' && $formId) {
    if ($formId === 2247) $deleted_kind = 'character';
    if ($formId === 2501) $deleted_kind = 'support';
  }

  $cascade = ['touched' => 0, 'updated' => 0];
  if ($deleted_kind === 'character' || $deleted_kind === 'support') {
    $cascade = shoshin_cascade_unassign_deleted_asset_from_rosters($user_id, $entry_id, $deleted_kind);
  }

  wp_send_json_success([
    'deleted' => $entry_id,
    'cascade' => $cascade,
    // helpful debug/telemetry (safe)
    'banner'  => [
      'attempted' => (bool) $is_roster_delete,
      'relpath'   => (string) $banner_relpath,
      'deleted'   => (bool) $banner_deleted,
    ],
  ]);
});


/* ------------------------------------------------------------------------- */
/* 2) GET MY ROSTERS (used by /my-assets Assign modal)                          */
/* action: shoshin_get_my_rosters                                               */
/* ------------------------------------------------------------------------- */
add_action('wp_ajax_shoshin_get_my_rosters', function () {
  shoshin_ajax_require_logged_in();
  shoshin_ajax_verify_nonce();
  shoshin_wpforms_available_or_fail();

  $ROSTER_FORM_ID = 2799;
  $user_id = get_current_user_id();

  $entries = wpforms()->entry->get_entries([
    'form_id' => $ROSTER_FORM_ID,
    'user_id' => $user_id,
    'number'  => 500,
    'orderby' => 'entry_id',
    'order'   => 'DESC',
  ]);
  if (!is_array($entries)) $entries = [];

  $out = [];

  foreach ($entries as $e) {
    $entry_id = (int) shoshin_get($e, 'entry_id', 0);
    if (!$entry_id) continue;

    // Prefer canonical roster builder if available (Option 1)
    if (function_exists('shoshin_build_roster')) {
      $r = shoshin_build_roster($e);

      // Ensure assigned is parsed for totals
      $assigned_raw = is_array($r) ? ($r['assigned_units_json'] ?? '') : '';
      $assigned_arr = shoshin_parse_assigned_units($assigned_raw);
      $totals = shoshin_compute_roster_totals($assigned_arr);

      if (is_array($r)) {
        // Fill computed totals if placeholders
        $r['points'] = (int) ($r['points'] ?? 0) ?: (int) $totals['points'];
        $r['unitCount'] = (int) ($r['unitCount'] ?? 0) ?: (int) $totals['units'];
        $r['initiative'] = (int) ($r['initiative'] ?? 0) ?: (int) $totals['ini'];
        $r['honor'] = (int) ($r['honor'] ?? 0) ?: (int) $totals['honor'];

        // Compatibility aliases for /my-assets normalizeRoster()
        if (!isset($r['img']) && isset($r['icon'])) $r['img'] = $r['icon'];
        if (!isset($r['ini']) && isset($r['initiative'])) $r['ini'] = $r['initiative'];
        if (!isset($r['units']) && isset($r['unitCount'])) $r['units'] = $r['unitCount'];
      }

      $out[] = $r;
      continue;
    }

    // Fallback legacy mapping
    $fields = shoshin_wpforms_decode_fields($e);

    $refId = '';
    $name  = '';
    $img   = '';

    foreach ($fields as $fid => $f) {
      $label = isset($f['name']) ? (string) $f['name'] : '';
      $val   = isset($f['value']) ? (string) $f['value'] : '';
      if (!$refId && (stripos($label, 'ref') !== false || stripos($label, 'reference') !== false)) $refId = $val;

      if (
        !$name &&
        (stripos($label, 'name') !== false || stripos($label, 'clan') !== false) &&
        stripos($label, 'ref') === false &&
        stripos($label, 'reference') === false
      ) {
        $name = $val;
      }

      if (!$img && (stripos($label, 'icon') !== false || stripos($label, 'image') !== false)) $img = $val;
    }

    $assigned_json = (string) shoshin_wpforms_get_field_value($fields, 9);
    $assigned_arr = shoshin_parse_assigned_units($assigned_json);
    $totals = shoshin_compute_roster_totals($assigned_arr);

    $out[] = [
      'kind'    => 'roster',
      'entryId' => $entry_id,
      'refId'   => $refId,
      'name'    => $name,
      'icon'    => $img,
      'img'     => $img,

      'assigned_units_json'    => $assigned_json,
      'assigned_units_digest'  => (string) shoshin_wpforms_get_field_value($fields, 10),

      'points'     => (int) $totals['points'],
      'units'      => (int) $totals['units'],
      'initiative' => (int) $totals['ini'],
      'ini'        => (int) $totals['ini'],
      'honor'      => (int) $totals['honor'],
    ];
  }

  wp_send_json_success(['rosters' => $out]);
});

/* ------------------------------------------------------------------------- */
/* 3) ASSIGN ASSET TO SELECTED ROSTERS                                          */
/* action: shoshin_assign_asset_to_rosters                                      */
/* ------------------------------------------------------------------------- */
add_action('wp_ajax_shoshin_assign_asset_to_rosters', function () {
  shoshin_ajax_require_logged_in();
  shoshin_ajax_verify_nonce();
  shoshin_wpforms_available_or_fail();

  $ROSTER_FORM_ID     = 2799;
  $ASSIGNED_FIELD_ID  = 9;
  $DIGEST_FIELD_ID    = 10;

  $user_id = get_current_user_id();

  $roster_ids_raw  = isset($_POST['rosterIds'])    ? wp_unslash($_POST['rosterIds'])    : '[]';
  $unit_raw        = isset($_POST['unit'])        ? wp_unslash($_POST['unit'])        : '';
  $assign_raw      = isset($_POST['assignments']) ? wp_unslash($_POST['assignments']) : '[]';

  $roster_ids = is_array($roster_ids_raw)
    ? array_map('absint', $roster_ids_raw)
    : json_decode((string) $roster_ids_raw, true);
  if (!is_array($roster_ids)) $roster_ids = [];
  $roster_ids = array_values(array_filter(array_map('absint', $roster_ids)));

  $unit = is_array($unit_raw) ? $unit_raw : json_decode((string) $unit_raw, true);
  if (!is_array($unit) || empty($unit['unitKey'])) {
    wp_send_json_error(['message' => 'Invalid unit payload.'], 400);
  }

  $assignments = is_array($assign_raw) ? $assign_raw : json_decode((string) $assign_raw, true);
  if (!is_array($assignments)) $assignments = [];

  // rosterId => qty (assignments wins)
  $targets = [];
  foreach ($assignments as $a) {
    if (!is_array($a)) continue;
    $rid = isset($a['rosterEntryId']) ? absint($a['rosterEntryId']) : 0;
    $qty = isset($a['qty']) ? (int) $a['qty'] : 1;
    if ($rid > 0) $targets[$rid] = max(1, $qty);
  }
  if (!$targets && $roster_ids) {
    foreach ($roster_ids as $rid) $targets[$rid] = 1;
  }
  if (!$targets) wp_send_json_error(['message' => 'No rosters selected.'], 400);

  $updated = [];
  $failed  = [];

  foreach ($targets as $rid => $qty) {
    $entry = wpforms()->entry->get($rid);
    $entry_id_found = (int) shoshin_get($entry, 'entry_id', 0);

    if (!$entry || !$entry_id_found) { $failed[] = ['rid' => $rid, 'reason' => 'entry_not_found']; continue; }

    $entry_user_id = (int) shoshin_get($entry, 'user_id', 0);
    if ($entry_user_id !== (int) $user_id) { $failed[] = ['rid' => $rid, 'reason' => 'forbidden_user']; continue; }

    $entry_form_id = (int) shoshin_get($entry, 'form_id', 0);
    if ($entry_form_id && $entry_form_id !== (int) $ROSTER_FORM_ID) { $failed[] = ['rid' => $rid, 'reason' => 'wrong_form', 'form_id' => $entry_form_id]; continue; }

    $fields = shoshin_wpforms_decode_fields($entry);
    $assigned_json = (string) shoshin_wpforms_get_field_value($fields, $ASSIGNED_FIELD_ID);
    $assigned = shoshin_parse_assigned_units($assigned_json);

    // set qty for this roster
    $found = false;
    foreach ($assigned as &$u) {
      if (is_array($u) && isset($u['unitKey']) && (string) $u['unitKey'] === (string) $unit['unitKey']) {
        $u['qty'] = max(1, (int) $qty);
        $found = true;
        break;
      }
    }
    unset($u);

    if (!$found) {
      $unit_copy = $unit;
      $unit_copy['qty'] = max(1, (int) $qty);
      $assigned[] = $unit_copy;
    }

    $new_json = wp_json_encode($assigned, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $new_digest = sha1($new_json);

    shoshin_wpforms_set_field_value($fields, $ASSIGNED_FIELD_ID, $new_json);
    shoshin_wpforms_set_field_value($fields, $DIGEST_FIELD_ID, $new_digest);

    $fields_json = wp_json_encode($fields, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    $ok = wpforms()->entry->update($rid, [
      'fields'  => $fields_json,
      'form_id' => (int) $ROSTER_FORM_ID,
    ]);

    if ($ok) $updated[] = $rid;
    else $failed[] = ['rid' => $rid, 'reason' => 'update_failed'];
  }

  if (!$updated) {
    wp_send_json_error([
      'message' => 'No rosters updated (WPForms update returned false).',
      'updatedRosterIds' => [],
      'failed' => $failed,
    ], 500);
  }

  wp_send_json_success([
    'updatedRosterIds' => $updated,
    'failed' => $failed,
  ]);
});


// ============================================================================
// ADD: Bulk assign/update multiple units to ONE roster (Row1 Assign Units modal)
// action: shoshin_bulk_assign_units_to_roster
// - Adds OR updates units in assigned_units_json (NO remove, NO replace)
// - Updates field 9 (assigned_units_json) + field 10 (digest)
// - qty clamped to 1..99
// ============================================================================
add_action('wp_ajax_shoshin_bulk_assign_units_to_roster', function () {
  shoshin_ajax_require_logged_in();
  shoshin_ajax_verify_nonce();
  shoshin_wpforms_available_or_fail();

  $ROSTER_FORM_ID     = 2799;
  $ASSIGNED_FIELD_ID  = 9;
  $DIGEST_FIELD_ID    = 10;

  $user_id = get_current_user_id();

  $rid = isset($_POST['rosterEntryId']) ? absint($_POST['rosterEntryId']) : 0;
  if (!$rid) wp_send_json_error(['message' => 'Missing rosterEntryId.'], 400);

  $units_raw = isset($_POST['units']) ? wp_unslash($_POST['units']) : '[]';
  $units = is_array($units_raw) ? $units_raw : json_decode((string) $units_raw, true);
  if (!is_array($units)) $units = [];

  // Load roster entry (must belong to current user, must be roster form)
  $entry = wpforms()->entry->get($rid);
  if (!$entry) wp_send_json_error(['message' => 'Roster entry not found.'], 404);

  $entry_form_id = (int) shoshin_get($entry, 'form_id', 0);
  if ($entry_form_id !== (int) $ROSTER_FORM_ID) wp_send_json_error(['message' => 'Invalid roster form.'], 400);

  $entry_user_id = (int) shoshin_get($entry, 'user_id', 0);
  if ($entry_user_id !== (int) $user_id) wp_send_json_error(['message' => 'Unauthorized.'], 403);

  $fields = shoshin_wpforms_decode_fields($entry);

  $existing_json = (string) shoshin_wpforms_get_field_value($fields, $ASSIGNED_FIELD_ID);
  $assigned = json_decode($existing_json, true);
  if (!is_array($assigned)) $assigned = [];

  // Index existing by unitKey for fast merge
  $by_key = [];
  foreach ($assigned as $i => $row) {
    $uk = shoshin_get($row, 'unitKey', '');
    if ($uk !== '') $by_key[(string) $uk] = $i;
  }

  $touched = 0;

  foreach ($units as $item) {
    if (!is_array($item)) continue;

    $unit = shoshin_get($item, 'unit', null);
    $qty  = shoshin_get($item, 'qty', null);

    if (!is_array($unit)) continue;

    $unitKey = (string) shoshin_get($unit, 'unitKey', '');
    if ($unitKey === '') continue;

    $qty = (int) $qty;
    if ($qty < 1) $qty = 1;
    if ($qty > 99) $qty = 99;

    if (array_key_exists($unitKey, $by_key)) {
      // Update existing qty only (keep existing fields intact)
      $idx = $by_key[$unitKey];
      if (!is_array($assigned[$idx])) $assigned[$idx] = [];
      $assigned[$idx]['qty'] = $qty;
    } else {
      // Add new unit row
      $new_row = $unit;
      $new_row['qty'] = $qty;
      $assigned[] = $new_row;
      $by_key[$unitKey] = count($assigned) - 1;
    }

    $touched++;
  }

  // If nothing valid was provided, still return current state (no changes)
  if ($touched > 0) {
    $new_json = wp_json_encode($assigned, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $new_digest = sha1($new_json);

    shoshin_wpforms_set_field_value($fields, $ASSIGNED_FIELD_ID, $new_json);
    shoshin_wpforms_set_field_value($fields, $DIGEST_FIELD_ID, $new_digest);

    $fields_json = wp_json_encode($fields, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    $ok = wpforms()->entry->update($rid, [
      'fields' => $fields_json,
    ]);

    if (!$ok) wp_send_json_error(['message' => 'Failed to update roster entry.'], 500);
  }

  // Return updated entry values
  $final_json = (string) shoshin_wpforms_get_field_value($fields, $ASSIGNED_FIELD_ID);
  $final_digest = (string) shoshin_wpforms_get_field_value($fields, $DIGEST_FIELD_ID);

  wp_send_json_success([
    'rosterEntryId'       => $rid,
    'assigned_units_json' => $final_json,
    'digest'              => $final_digest,
    'touched'             => $touched,
  ]);
});



// ============================================================================
// ADD: Set unit quantity (Row3 Unassign + Row3 Remove All)
// action: shoshin_set_unit_qty
// - Updates existing roster entry only (NO new entry creation)
// - Updates field 9 (assigned_units_json) + field 10 (digest)
// - qty=0 removes the unit from assigned list
// ============================================================================
add_action('wp_ajax_shoshin_set_unit_qty', function () {
  shoshin_ajax_require_logged_in();
  shoshin_ajax_verify_nonce();
  shoshin_wpforms_available_or_fail();

  $ROSTER_FORM_ID     = 2799;
  $ASSIGNED_FIELD_ID  = 9;
  $DIGEST_FIELD_ID    = 10;

  $user_id = get_current_user_id();

  $roster_entry_id = isset($_POST['rosterEntryId']) ? (int) $_POST['rosterEntryId'] : 0;
  $unit_key        = isset($_POST['unitKey']) ? trim((string) wp_unslash($_POST['unitKey'])) : '';
  $qty_raw         = isset($_POST['qty']) ? (int) $_POST['qty'] : 0;

  if ($roster_entry_id <= 0) wp_send_json_error(['message' => 'Missing rosterEntryId.'], 400);
  if ($unit_key === '') wp_send_json_error(['message' => 'Missing unitKey.'], 400);

  // Load entry + verify ownership + form
  $entry = wpforms()->entry->get($roster_entry_id);
  $entry_id_found = (int) shoshin_get($entry, 'entry_id', 0);
  if (!$entry || !$entry_id_found) wp_send_json_error(['message' => 'Roster entry not found.'], 404);

  $entry_form_id = (int) shoshin_get($entry, 'form_id', 0);
  if ($entry_form_id !== (int) $ROSTER_FORM_ID) wp_send_json_error(['message' => 'Invalid roster form.'], 400);

  $entry_user_id = (int) shoshin_get($entry, 'user_id', 0);
  if ($entry_user_id !== (int) $user_id) wp_send_json_error(['message' => 'Unauthorized.'], 403);

  $fields = shoshin_wpforms_decode_fields($entry);

  $assigned_json = (string) shoshin_wpforms_get_field_value($fields, $ASSIGNED_FIELD_ID);
  $assigned = shoshin_parse_assigned_units($assigned_json);

  $new_assigned = [];
  $found = false;

  foreach ($assigned as $u) {
    if (!is_array($u)) continue;

    $uk = isset($u['unitKey']) ? (string) $u['unitKey'] : '';
    if ($uk !== $unit_key) {
      $new_assigned[] = $u;
      continue;
    }

    $found = true;

    if ($qty_raw >= 1) {
      $u['qty'] = (int) $qty_raw;
      $new_assigned[] = $u;
    }
    // qty <= 0 => drop row (remove)
  }

  if (!$found) {
    wp_send_json_error(['message' => 'Unit not found in roster assignments.'], 404);
  }

  $new_json = wp_json_encode($new_assigned, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  $new_digest = sha1($new_json);

  shoshin_wpforms_set_field_value($fields, $ASSIGNED_FIELD_ID, $new_json);
  shoshin_wpforms_set_field_value($fields, $DIGEST_FIELD_ID, $new_digest);

  $fields_json = wp_json_encode($fields, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

  $ok = wpforms()->entry->update($roster_entry_id, [
    'fields'  => $fields_json,
    'form_id' => (int) $ROSTER_FORM_ID,
  ]);

  if (!$ok) wp_send_json_error(['message' => 'Update failed.'], 500);

  wp_send_json_success([
    'entryId'               => (int) $roster_entry_id,
    'assigned_units_json'   => (string) $new_json,
    'assigned_units_digest' => (string) $new_digest,
  ]);
});



/* ------------------------------------------------------------------------- */
/* BANNER FILE DELETE HELPERS (SAFE: only deletes inside wpforms/shoshin-rosters) */
/* ------------------------------------------------------------------------- */
if (!function_exists('shoshin_roster_banner_upload_dir_rel')) {
  function shoshin_roster_banner_upload_dir_rel() {
    return 'wpforms/shoshin-rosters';
  }
}

if (!function_exists('shoshin_roster_banner_extract_file_relpath')) {
  /**
   * Extract a relative path (from uploads base) for the banner file if possible.
   * Returns '' if not recognized / not deletable.
   *
   * Accepts:
   * - full URL: https://site/wp-content/uploads/wpforms/shoshin-rosters/foo.jpg
   * - relative path: wpforms/shoshin-rosters/foo.jpg
   * - raw WPForms field array: ['value_raw'=>[ ['file'=>..., ...] ], 'value'=>...]
   */
  function shoshin_roster_banner_extract_file_relpath($field8) {
    $dirRel = shoshin_roster_banner_upload_dir_rel();

    // 1) If we have WPForms file meta, prefer file name + known dir.
    if (is_array($field8)) {
      if (isset($field8['value_raw']) && is_array($field8['value_raw']) && !empty($field8['value_raw'][0]) && is_array($field8['value_raw'][0])) {
        $meta = $field8['value_raw'][0];

        // "file" should be the stored filename inside the folder
        if (!empty($meta['file']) && is_string($meta['file'])) {
          $file = basename($meta['file']); // strip any path
          if ($file) return $dirRel . '/' . $file;
        }
      }

      // fallback to the human 'value' which may be URL
      if (!empty($field8['value']) && is_string($field8['value'])) {
        $field8 = $field8['value'];
      } else {
        $field8 = '';
      }
    }

    // 2) String fallback: URL or relpath
    $v = trim((string) $field8);
    if ($v === '') return '';

    // If it's already a relpath inside our directory
    if (stripos($v, $dirRel . '/') === 0) {
      return $v;
    }

    // If it's a URL, convert to relpath under uploads
    $uploads = wp_upload_dir();
    $baseurl = isset($uploads['baseurl']) ? (string) $uploads['baseurl'] : '';
    if ($baseurl && stripos($v, $baseurl) === 0) {
      $rel = ltrim(substr($v, strlen($baseurl)), '/');
      // Only allow deletes in our folder
      if (stripos($rel, $dirRel . '/') === 0) return $rel;
    }

    return '';
  }
}

if (!function_exists('shoshin_roster_banner_delete_by_relpath')) {
  /**
   * Deletes a file by relative path under uploads base dir, only if it is in wpforms/shoshin-rosters/.
   * Returns true if deleted, false otherwise.
   */
  function shoshin_roster_banner_delete_by_relpath($relpath) {
    $relpath = ltrim((string) $relpath, '/');
    if ($relpath === '') return false;

    $dirRel = shoshin_roster_banner_upload_dir_rel();

    // HARD SAFETY: only delete within this folder
    if (stripos($relpath, $dirRel . '/') !== 0) return false;

    $uploads = wp_upload_dir();
    $basedir = isset($uploads['basedir']) ? (string) $uploads['basedir'] : '';
    if (!$basedir) return false;

    $full = wp_normalize_path(trailingslashit($basedir) . $relpath);

    // HARD SAFETY: ensure normalized path still contains our directory segment
    if (strpos($full, wp_normalize_path(trailingslashit($basedir) . $dirRel . '/')) !== 0) return false;

    if (file_exists($full) && is_file($full)) {
      return @unlink($full);
    }

    return false;
  }
}



/* ------------------------------------------------------------------------- */
/* BANNER VALUE → URL (DISPLAY ONLY; NOT FOR STORAGE)                         */
/* ------------------------------------------------------------------------- */
if (!function_exists('shoshin_banner_value_to_url_for_display')) {
  function shoshin_banner_value_to_url_for_display($value) {
    $v = trim((string) $value);
    if ($v === '') return '';

    // If it's JSON, extract url.
    $first = substr($v, 0, 1);
    if ($first === '{' || $first === '[') {
      $decoded = json_decode($v, true);
      if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
        if (isset($decoded['url']) && is_string($decoded['url'])) return trim((string) $decoded['url']);
        if (isset($decoded[0]['url']) && is_string($decoded[0]['url'])) return trim((string) $decoded[0]['url']);
        // Some WPForms payloads store only "file" and not "url"
        if (isset($decoded['file']) && is_string($decoded['file'])) {
          $file = trim((string) $decoded['file']);
          if ($file !== '') return shoshin_resolve_wpforms_upload_filename_to_url($file);
        }
        if (isset($decoded[0]['file']) && is_string($decoded[0]['file'])) {
          $file = trim((string) $decoded[0]['file']);
          if ($file !== '') return shoshin_resolve_wpforms_upload_filename_to_url($file);
        }
      }
      return '';
    }

    // Already a URL or a site-relative upload path
    if (preg_match('#^https?://#i', $v)) return $v;
    if (strpos($v, '/wp-content/uploads/') === 0) return $v;

    // Bare filename — try to resolve to a real URL in uploads/wpforms
    if (preg_match('#^[^/\\\\]+\.(png|jpe?g|webp|gif|bmp)$#i', $v)) {
      return shoshin_resolve_wpforms_upload_filename_to_url($v);
    }

    // Fallback: unknown format, return empty so UI can fallback safely
    return '';
  }
}

if (!function_exists('shoshin_resolve_wpforms_upload_filename_to_url')) {
  function shoshin_resolve_wpforms_upload_filename_to_url($filename) {
    $filename = trim((string) $filename);
    if ($filename === '') return '';

    $uploads = wp_upload_dir();
    $base_dir = isset($uploads['basedir']) ? $uploads['basedir'] : '';
    $base_url = isset($uploads['baseurl']) ? $uploads['baseurl'] : '';
    if (!$base_dir || !$base_url) return '';

    // Likely WPForms locations
    $candidates = [
      $base_dir . '/wpforms/tmp/' . $filename,
      $base_dir . '/wpforms/uploads/' . $filename,
      $base_dir . '/wpforms/' . $filename,
    ];

    foreach ($candidates as $path) {
      if (is_file($path)) {
        $rel = str_replace($base_dir, '', $path);
        $rel = ltrim(str_replace('\\', '/', $rel), '/');
        return rtrim($base_url, '/') . '/' . $rel;
      }
    }

    // Last resort: scan uploads/wpforms recursively for matching basename
    $root = $base_dir . '/wpforms';
    if (!is_dir($root)) return '';

    $best_path = '';
    $best_mtime = 0;

    try {
      $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
      );

      foreach ($it as $fileinfo) {
        if (!$fileinfo->isFile()) continue;
        if (strcasecmp($fileinfo->getBasename(), $filename) !== 0) continue;

        $mtime = (int) $fileinfo->getMTime();
        if ($mtime >= $best_mtime) {
          $best_mtime = $mtime;
          $best_path = $fileinfo->getPathname();
        }
      }
    } catch (\Throwable $e) {
      // If iterator fails for any reason, fail closed.
      return '';
    }

    if ($best_path && is_file($best_path)) {
      $rel = str_replace($base_dir, '', $best_path);
      $rel = ltrim(str_replace('\\', '/', $rel), '/');
      return rtrim($base_url, '/') . '/' . $rel;
    }

    return '';
  }
}





/* ------------------------------------------------------------------------- */
/* 4) UPDATE / REMOVE ROSTER BANNER (field_8)                                  */
/* action: shoshin_update_roster_banner                                        */
/* ------------------------------------------------------------------------- */
add_action('wp_ajax_shoshin_update_roster_banner', function () {
  shoshin_ajax_require_logged_in();
  shoshin_ajax_verify_nonce();
  shoshin_wpforms_available_or_fail();

  $ROSTER_FORM_ID  = 2799;
  $BANNER_FIELD_ID = 8;

  $entry_id = isset($_POST['entryId']) ? absint($_POST['entryId']) : 0;
  if (!$entry_id) {
    wp_send_json_error(['message' => 'Missing entryId.'], 400);
  }

  if (!isset($_POST['value'])) {
    wp_send_json_error(['message' => 'Missing value.'], 400);
  }

  if (is_array($_POST['value']) || is_object($_POST['value'])) {
    wp_send_json_error(['message' => 'Invalid banner value type. Expected raw string.'], 400);
  }

  $value = trim((string) wp_unslash($_POST['value']));
  $is_remove = ($value === '');

  // Load entry + enforce ownership
  $entry = wpforms()->entry->get($entry_id);
  if (empty($entry) || empty($entry->entry_id)) {
    wp_send_json_error(['message' => 'Entry not found.'], 404);
  }
  if ((int) $entry->form_id !== (int) $ROSTER_FORM_ID) {
    wp_send_json_error(['message' => 'Entry form mismatch.'], 400);
  }

  $user_id = get_current_user_id();
  $entry_user_id = (int) shoshin_get($entry, 'user_id', 0);
  if ($entry_user_id !== (int) $user_id) {
    wp_send_json_error(['message' => 'Forbidden.'], 403);
  }

  // Decode full fields blob
  $fields = shoshin_wpforms_decode_fields($entry);

  // Ensure base field structure exists (so admin renderer never hits nulls)
  if (!isset($fields[$BANNER_FIELD_ID]) || !is_array($fields[$BANNER_FIELD_ID])) {
    $fields[$BANNER_FIELD_ID] = [
      'name'  => 'Upload Clan Banner',
      'value' => '',
      'value_raw' => [],
      'id'    => (int) $BANNER_FIELD_ID,
      'type'  => 'file-upload',
      'style' => 'modern',
    ];
  } else {
    // Make sure required keys exist even if entry was weirdly shaped
    if (!isset($fields[$BANNER_FIELD_ID]['id']))    $fields[$BANNER_FIELD_ID]['id'] = (int) $BANNER_FIELD_ID;
    if (!isset($fields[$BANNER_FIELD_ID]['type']))  $fields[$BANNER_FIELD_ID]['type'] = 'file-upload';
    if (!isset($fields[$BANNER_FIELD_ID]['style'])) $fields[$BANNER_FIELD_ID]['style'] = 'modern';
    if (!isset($fields[$BANNER_FIELD_ID]['name']))  $fields[$BANNER_FIELD_ID]['name'] = 'Upload Clan Banner';
    if (!isset($fields[$BANNER_FIELD_ID]['value_raw']) || !is_array($fields[$BANNER_FIELD_ID]['value_raw'])) {
      $fields[$BANNER_FIELD_ID]['value_raw'] = [];
    }
  }

    // -----------------------------------------------------------------------
  // STEP 3A: Capture previous banner relpath BEFORE we modify field 8
  // (Used to purge old file on remove/replace, after WPForms update succeeds)
  // -----------------------------------------------------------------------
  $prev_relpath = '';
  if (isset($fields[$BANNER_FIELD_ID])) {
    $prev_relpath = shoshin_roster_banner_extract_file_relpath($fields[$BANNER_FIELD_ID]);
  }


  // -----------------------------------------------------------------------
  // REMOVE: set value='' and value_raw=[] (WPForms-safe)
  // -----------------------------------------------------------------------
  if ($is_remove) {
    $fields[$BANNER_FIELD_ID]['value'] = '';
    $fields[$BANNER_FIELD_ID]['value_raw'] = [];

    $fields_json = wp_json_encode($fields, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $ok = wpforms()->entry->update($entry_id, [
      'fields'  => $fields_json,
      'form_id' => (int) $ROSTER_FORM_ID,
    ]);

    if (!$ok) wp_send_json_error(['message' => 'WPForms update returned false.'], 500);

    // ✅ PURGE old file only after successful update
    if ($prev_relpath) {
      shoshin_roster_banner_delete_by_relpath($prev_relpath);
    }

    wp_send_json_success([
      'entryId'   => $entry_id,
      'bannerRaw' => '',
      'bannerUrl' => '',
      'removed'   => true,
    ]);
  }


  // -----------------------------------------------------------------------
  // If value is WPForms uploader JSON, persist it permanently (no /tmp/)
  // -----------------------------------------------------------------------
  $first = substr($value, 0, 1);
  $is_json = ($first === '{' || $first === '[');

  // Helper: infer ext from mime
  $mime_to_ext = function ($mime) {
    $mime = strtolower((string) $mime);
    $map = [
      'image/jpeg' => 'jpeg',
      'image/jpg'  => 'jpg',
      'image/png'  => 'png',
      'image/webp' => 'webp',
      'image/gif'  => 'gif',
    ];
    return $map[$mime] ?? '';
  };

  if ($is_json) {
    $decoded = json_decode($value, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
      wp_send_json_error(['message' => 'Invalid banner value. Malformed JSON.'], 400);
    }

    // Accept either array-of-one or single object
    $file_obj = null;
    if (isset($decoded[0]) && is_array($decoded[0])) $file_obj = $decoded[0];
    elseif (isset($decoded['file']) || isset($decoded['url'])) $file_obj = $decoded;

    if (!$file_obj || !is_array($file_obj)) {
      wp_send_json_error(['message' => 'Invalid banner upload payload.'], 400);
    }

    $tmp_file = isset($file_obj['file']) ? (string) $file_obj['file'] : '';
    $tmp_url  = isset($file_obj['url']) ? (string) $file_obj['url'] : '';
    $mime     = isset($file_obj['type']) ? (string) $file_obj['type'] : '';
    $orig     = (string) (
      ($file_obj['file_original'] ?? '') ? $file_obj['file_original'] :
      (($file_obj['file_user_name'] ?? '') ? $file_obj['file_user_name'] :
      (($file_obj['name'] ?? '') ? $file_obj['name'] : 'banner'))
    );

    $orig = trim($orig);
    if ($orig === '') $orig = 'banner';

    // Determine extension (prefer explicit)
    $ext = '';
    if (!empty($file_obj['ext'])) $ext = (string) $file_obj['ext'];
    if ($ext === '' && $tmp_file) $ext = pathinfo($tmp_file, PATHINFO_EXTENSION);
    if ($ext === '' && $orig) $ext = pathinfo($orig, PATHINFO_EXTENSION);
    if ($ext === '' && $mime) $ext = $mime_to_ext($mime);

    $ext = strtolower(trim($ext));
    if ($ext === 'jpeg') { /* ok */ }
    if ($ext === '') {
      wp_send_json_error(['message' => 'Could not determine file extension.'], 400);
    }

    // Find tmp path on disk (WPForms tmp store)
    $uploads = wp_upload_dir();
    $tmp_path = trailingslashit($uploads['basedir']) . 'wpforms/tmp/' . basename($tmp_file);

    if (!file_exists($tmp_path)) {
      // If tmp is missing, we cannot persist it safely
      wp_send_json_error(['message' => 'Uploaded file not found in tmp. Please re-upload and try again.'], 400);
    }

    // Move into stable folder we control (so refresh never breaks)
    $dest_dir = trailingslashit($uploads['basedir']) . 'wpforms/shoshin-rosters/';
    if (!wp_mkdir_p($dest_dir)) {
      wp_send_json_error(['message' => 'Failed to create destination folder for banners.'], 500);
    }

    // Build stable filename similar to WPForms pattern: BaseName-hash.ext
    $base = pathinfo($orig, PATHINFO_FILENAME);
    $base = sanitize_file_name($base);
    if ($base === '') $base = 'banner';

    $hash = md5($tmp_file . '|' . microtime(true) . '|' . wp_rand(1, 9999999));
    $dest_file = $base . '-' . $hash . '.' . $ext;

    $dest_path = $dest_dir . $dest_file;
    $dest_url  = trailingslashit($uploads['baseurl']) . 'wpforms/shoshin-rosters/' . $dest_file;

    // Move file (rename preferred; fallback to copy+unlink)
    $moved = @rename($tmp_path, $dest_path);
    if (!$moved) {
      $copied = @copy($tmp_path, $dest_path);
      if ($copied) { @unlink($tmp_path); $moved = true; }
    }

    if (!$moved || !file_exists($dest_path)) {
      wp_send_json_error(['message' => 'Failed to persist uploaded banner file.'], 500);
    }

    // Build EXACT WPForms-compatible structure for admin UI
    $fields[$BANNER_FIELD_ID]['value'] = $dest_url;
    $fields[$BANNER_FIELD_ID]['value_raw'] = [
      [
        'name'           => $orig,
        'value'          => $dest_url,
        'file'           => $dest_file,
        'file_original'  => $orig,
        'file_user_name' => $orig,
        'ext'            => $ext,
        'attachment_id'  => 0,
        'id'             => (int) $BANNER_FIELD_ID,
        'type'           => ($mime ? $mime : 'image/' . $ext),
      ],
    ];

    $fields_json = wp_json_encode($fields, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $ok = wpforms()->entry->update($entry_id, [
      'fields'  => $fields_json,
      'form_id' => (int) $ROSTER_FORM_ID,
    ]);

    if (!$ok) wp_send_json_error(['message' => 'WPForms update returned false.'], 500);

        // ✅ If this upload replaced an older banner, purge the old file
    $new_relpath = 'wpforms/shoshin-rosters/' . $dest_file;
    if ($prev_relpath && $prev_relpath !== $new_relpath) {
      shoshin_roster_banner_delete_by_relpath($prev_relpath);
    }


    wp_send_json_success([
      'entryId'   => $entry_id,
      'bannerRaw' => $dest_url,
      'bannerUrl' => $dest_url,
      'removed'   => false,
    ]);
  }

  // -----------------------------------------------------------------------
  // URL string path: set value, preserve existing value_raw (admin-safe)
  // -----------------------------------------------------------------------
  // Upload-only mode: anything that isn't JSON (upload payload) or '' (remove) is invalid.
wp_send_json_error([
  'message' => 'Invalid banner value. Upload-only mode expects WPForms uploader JSON or empty string for remove.',
], 400);

});

/* ------------------------------------------------------------------------- */
/* DEBUG: READ RAW STORED BANNER VALUE (ADMIN ONLY; TEMPORARY)                */
/* ------------------------------------------------------------------------- */
if (!defined('SHOSHIN_BANNER_DEBUG_ENABLED')) {
  define('SHOSHIN_BANNER_DEBUG_ENABLED', false);
}

if (SHOSHIN_BANNER_DEBUG_ENABLED) {

  // Expose a debug nonce in wp-admin footer for console testing.
  add_action('admin_footer', function () {
    if (!current_user_can('manage_options')) return;
    $nonce = wp_create_nonce('shoshin_debug_nonce');
    echo "<script>window.SHOSHIN_DEBUG_NONCE = '".esc_js($nonce)."';</script>";
  });

  add_action('wp_ajax_shoshin_debug_roster_banner_value', function () {
    shoshin_ajax_require_logged_in();
    shoshin_wpforms_available_or_fail();

    if (!current_user_can('manage_options')) {
      wp_send_json_error(['message' => 'Forbidden.'], 403);
    }

    $nonce = isset($_POST['nonce']) ? sanitize_text_field(wp_unslash($_POST['nonce'])) : '';
    if (!$nonce || !wp_verify_nonce($nonce, 'shoshin_debug_nonce')) {
      wp_send_json_error(['message' => 'Bad debug nonce.'], 403);
    }

    $entry_id = isset($_POST['entryId']) ? absint($_POST['entryId']) : 0;
    if (!$entry_id) wp_send_json_error(['message' => 'Missing entryId.'], 400);

    $entry = wpforms()->entry->get($entry_id);
    if (empty($entry) || empty($entry->entry_id)) {
      wp_send_json_error(['message' => 'Entry not found.'], 404);
    }

    $fields = shoshin_wpforms_decode_fields($entry);
    $raw = (string) shoshin_wpforms_get_field_value($fields, 8);

    $trim = trim($raw);
    $looks_json = ($trim !== '' && (substr($trim, 0, 1) === '{' || substr($trim, 0, 1) === '['));


    $json_ok = false;
    $decoded = null;
    if ($looks_json) {
      $decoded = json_decode($trim, true);
      $json_ok = (json_last_error() === JSON_ERROR_NONE);
    }

     $is_url = (bool) preg_match('#^https?://#i', $trim);
    $is_uploads = ($trim !== '' && stripos($trim, '/wp-content/uploads/') !== false);

wp_send_json_success([
  'entryId'      => (int) $entry_id,
  'formId'       => (int) $entry->form_id,
  'fieldId'      => 8,
  'rawValue'     => $raw,
  'trimmedValue' => $trim,

  // Quality-of-life flags
  'isUrl'        => $is_url,
  'isUploads'    => $is_uploads,

  // Keep existing info (still useful while we’re validating)
  'looksJson'    => $looks_json,
  'jsonOk'       => $json_ok,
  'detectedUrl'  => shoshin_banner_value_to_url_for_display($raw),
  'decodedType'  => is_array($decoded) ? 'array' : (is_null($decoded) ? 'null' : gettype($decoded)),
]);

  });
}
