<?php
/**
 * SHOSHIN — RMS Soft Lock Engine (Backend)
 *
 * Locks "over-limit" entries for Free (non-entitled) users WITHOUT deleting data.
 * Newest wins.
 *
 * Forms + fields:
 *  - Characters (2247): subtype = Character Class (field 6), owner field 9
 *  - Support Assets (2501): subtype = Support Asset Type (field 4), owner field 1
 *  - Rosters (2799): no subtype, owner field 2
 *
 * Entitled if:
 *  - PMPro level is 2 or 3, OR
 *  - user_meta shoshin_paid_until is in the future
 *
 * Storage schema support:
 *  - wp_wpforms_entry_fields (preferred)
 *  - wp_wpforms_entry_meta (fallback)
 */

/** -------------------------------
 *  Helpers: avoid redeclare collisions
 *  ------------------------------- */
if (!function_exists('shoshin_wpforms_table_exists')) {
  function shoshin_wpforms_table_exists($table_name) {
    global $wpdb;
    $like = $wpdb->esc_like($table_name);
    $sql  = $wpdb->prepare("SHOW TABLES LIKE %s", $like);
    $hit  = $wpdb->get_var($sql);
    return !empty($hit);
  }
}

if (!function_exists('shoshin_now_ts')) {
  function shoshin_now_ts() {
    return (int) current_time('timestamp');
  }
}

if (!function_exists('shoshin_get_paid_until')) {
  function shoshin_get_paid_until($user_id) {
    $v = get_user_meta((int)$user_id, 'shoshin_paid_until', true);
    if ($v === '' || $v === null) return 0;
    return (int) $v;
  }
}

if (!function_exists('shoshin_is_paid_entitled')) {
  function shoshin_is_paid_entitled($user_id) {
    $user_id = (int) $user_id;
    $PAID_LEVEL_IDS = array(2, 3);

    if (function_exists('pmpro_getMembershipLevelForUser')) {
      $level = pmpro_getMembershipLevelForUser($user_id);
      $level_id = (!empty($level) && !empty($level->id)) ? (int)$level->id : 0;
      if (in_array($level_id, $PAID_LEVEL_IDS, true)) return true;
    }

    $paid_until = shoshin_get_paid_until($user_id);
    return ($paid_until > shoshin_now_ts());
  }
}

/**
 * Return the WPForms KV table to use:
 *  - wp_wpforms_entry_fields if exists
 *  - else wp_wpforms_entry_meta if exists
 */
if (!function_exists('shoshin_wpforms_kv_table')) {
  function shoshin_wpforms_kv_table() {
    global $wpdb;
    $fields_table = $wpdb->prefix . 'wpforms_entry_fields';
    $meta_table   = $wpdb->prefix . 'wpforms_entry_meta';

    if (shoshin_wpforms_table_exists($fields_table)) return $fields_table;
    if (shoshin_wpforms_table_exists($meta_table)) return $meta_table;
    return '';
  }
}

/**
 * Build a "lock map" for a user:
 * Returns: array(
 *   2247 => array( entry_id => true/false locked ),
 *   2501 => array( entry_id => true/false locked ),
 *   2799 => array( entry_id => true/false locked ),
 * )
 *
 * Newest wins (highest entry_id).
 */
if (!function_exists('shoshin_rms_build_lock_map')) {
  function shoshin_rms_build_lock_map($user_id) {
    $user_id = (int) $user_id;

    // Paid => nothing locked
    if (shoshin_is_paid_entitled($user_id)) {
      return array(2247 => array(), 2501 => array(), 2799 => array());
    }

    global $wpdb;

    $entries_table = $wpdb->prefix . 'wpforms_entries';
    $kv_table      = shoshin_wpforms_kv_table();
    if (!$kv_table) {
      return array(2247 => array(), 2501 => array(), 2799 => array());
    }

    // Canon mappings
    $owner_fid = array(2247 => 9, 2501 => 1, 2799 => 2);
    $sub_fid   = array(2247 => 6, 2501 => 4); // roster none

    $uid_str = (string) $user_id;
    $uid_int = (int) $user_id;

    $out = array(2247 => array(), 2501 => array(), 2799 => array());

    /**
     * A) 2247 and 2501: lock all but newest per subtype
     */
    foreach (array(2247, 2501) as $form_id) {
      $of = (int) $owner_fid[$form_id];
      $sf = (int) $sub_fid[$form_id];

      // Get all entries for this user including subtype value
      $rows = $wpdb->get_results($wpdb->prepare("
        SELECT e.entry_id,
               TRIM(fs.value) AS subtype
        FROM {$entries_table} e
        INNER JOIN {$kv_table} fo ON fo.entry_id = e.entry_id
        INNER JOIN {$kv_table} fs ON fs.entry_id = e.entry_id
        WHERE e.form_id = %d
          AND fo.field_id = %d
          AND (
               TRIM(fo.value) = %s
               OR CAST(TRIM(fo.value) AS UNSIGNED) = %d
          )
          AND fs.field_id = %d
      ", $form_id, $of, $uid_str, $uid_int, $sf));

      if (empty($rows)) continue;

      // Determine newest entry_id per subtype
      $newest_by_sub = array();
      foreach ($rows as $r) {
        $eid = (int) $r->entry_id;
        $sub = (string) $r->subtype;

        if ($sub === '') $sub = '__EMPTY__'; // safety
        if (!isset($newest_by_sub[$sub]) || $eid > $newest_by_sub[$sub]) {
          $newest_by_sub[$sub] = $eid;
        }
      }

      // Mark locked for older entries
      foreach ($rows as $r) {
        $eid = (int) $r->entry_id;
        $sub = (string) $r->subtype;
        if ($sub === '') $sub = '__EMPTY__';

        $keep = (int) $newest_by_sub[$sub];
        $out[$form_id][$eid] = ($eid !== $keep); // true if locked
      }
    }

    /**
     * B) 2799: lock all but newest total roster
     */
    $form_id = 2799;
    $of = (int) $owner_fid[$form_id];

    $roster_ids = $wpdb->get_col($wpdb->prepare("
      SELECT DISTINCT e.entry_id
      FROM {$entries_table} e
      INNER JOIN {$kv_table} fo ON fo.entry_id = e.entry_id
      WHERE e.form_id = %d
        AND fo.field_id = %d
        AND (
             TRIM(fo.value) = %s
             OR CAST(TRIM(fo.value) AS UNSIGNED) = %d
        )
    ", $form_id, $of, $uid_str, $uid_int));

    if (!empty($roster_ids)) {
      $roster_ids = array_map('intval', $roster_ids);
      $newest = max($roster_ids);

      foreach ($roster_ids as $eid) {
        $out[2799][$eid] = ((int)$eid !== (int)$newest);
      }
    }

    return $out;
  }
}

/**
 * Lightweight checker you can call anywhere.
 */
if (!function_exists('shoshin_rms_is_locked_entry')) {
  function shoshin_rms_is_locked_entry($form_id, $entry_id, $user_id = 0) {
    $form_id  = (int) $form_id;
    $entry_id = (int) $entry_id;

    if ($user_id <= 0) $user_id = (int) get_current_user_id();
    if ($user_id <= 0) return true; // fail-closed for unknown user

    $map = shoshin_rms_build_lock_map($user_id);
    if (!isset($map[$form_id])) return false;

    return !empty($map[$form_id][$entry_id]);
  }
}

/**
 * Optional: expose lock map to your JS via AJAX (so My Assets / My Rosters can render locks)
 * You can call this from your existing list builders OR from JS directly.
 */
add_action('wp_ajax_shoshin_rms_lock_map', function () {
  if (!is_user_logged_in()) {
    wp_send_json(array('ok' => false, 'msg' => 'Not logged in.'));
  }
  $user_id = (int) get_current_user_id();
  wp_send_json(array(
    'ok'    => true,
    'map'   => shoshin_rms_build_lock_map($user_id),
    'paid'  => shoshin_is_paid_entitled($user_id),
    'now'   => shoshin_now_ts(),
    'until' => shoshin_get_paid_until($user_id),
  ));
});