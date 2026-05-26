<?php
/**
 * RMS Gate AJAX Endpoint (PMPro + WPForms) — HARDENED + PAID-UNTIL ENTITLEMENTS
 *
 * Free (level 4): block additional creations:
 *  - 2247 Characters:     1 per Character Class (field 6)
 *  - 2501 Support Assets: 1 per Support Asset Type (field 4)
 *  - 2799 Clan Rosters:   1 total
 *
 * Paid levels (2,3): unlimited while entitled.
 *
 * IMPORTANT: Entitlements are determined by:
 *  - Active paid level (2/3), OR
 *  - user_meta shoshin_paid_until in the future (Unix timestamp)
 *
 * This allows you to assign Free (4) immediately on cancel/downgrade
 * for site-visibility logic, while still honoring paid access until term end.
 *
 * Works with BOTH WPForms storage schemas:
 *  - wp_wpforms_entry_fields   (newer)
 *  - wp_wpforms_entry_meta     (older)
 */

/** ---------------------------------------------------------
 *  1) Frontend: provide ajaxurl + nonce to your JS
 *  --------------------------------------------------------- */
add_action('wp_enqueue_scripts', function () {
  if (is_admin()) return;

  wp_enqueue_script('jquery');

  wp_localize_script('jquery', 'SHOSHIN_RMS_GATE', array(
    'ajaxurl' => admin_url('admin-ajax.php'),
    'nonce'   => wp_create_nonce('shoshin_rms_gate_nonce'),
  ));
});

/** ---------------------------------------------------------
 *  1B) HARDEN WPForms CREATE SUBMISSIONS (login + rate limit)
 *  --------------------
 *  Prevent direct POST spam to WPForms endpoints.
 *  Applies ONLY to creation forms:
 *   - 2247 /create-character
 *   - 2501 /create-asset
 *   - 2799 /create-roster
 * -------------------------------------------------------- */

if (!function_exists('shoshin_wpforms_block_submit')) {
  function shoshin_wpforms_block_submit($form_id, $message) {
    // WPForms-native error (preferred)
    if (function_exists('wpforms') && isset(wpforms()->process) && isset(wpforms()->process->errors)) {
      if (!isset(wpforms()->process->errors[$form_id])) wpforms()->process->errors[$form_id] = [];
      wpforms()->process->errors[$form_id]['header'] = (string) $message;
      return;
    }
    // Fallback hard stop
    wp_die((string) $message, 'Forbidden', ['response' => 403]);
  }
}

add_action('wpforms_process', function ($fields, $entry, $form_data) {

  $form_id = isset($form_data['id']) ? (int) $form_data['id'] : 0;

  // Only protect your creation forms
  if (!in_array($form_id, [2247, 2501, 2799], true)) return;

  // Require login for create submissions
  if (!is_user_logged_in()) {
    shoshin_wpforms_block_submit($form_id, 'Login required.');
    return;
  }

  // Rate limit create submits per user+form
  $user_id = get_current_user_id();
  if (!$user_id) {
    shoshin_wpforms_block_submit($form_id, 'Login required.');
    return;
  }

  $key = 'rms_wpf_create_' . (int) $user_id . '_' . (int) $form_id;
  $bucket = get_transient($key);
  if (!is_array($bucket)) $bucket = ['count' => 0, 'start' => time()];

  $now = time();
  if (($now - (int) $bucket['start']) > 60) {
    $bucket = ['count' => 0, 'start' => $now];
  }

  $bucket['count'] = (int) $bucket['count'] + 1;

  // Allow up to 20 create submits per 5 minutes per form per user
  if ($bucket['count'] > 20) {
    shoshin_wpforms_block_submit($form_id, 'Too many submissions. Please wait a few minutes and try again.');
    return;
  }

  // 5 minute window (300 seconds)
  set_transient($key, $bucket, 300);

}, 10, 3);

/** ---------------------------------------------------------
 *  2) Entitlements (Paid Until)
 *  --------------------------------------------------------- */
/* BEGIN RMS LIMIT GATE FIX — GUARD ENTITLEMENTS HELPERS (AVOID REDECLARE) */
if (!function_exists('shoshin_now_ts')) {
  function shoshin_now_ts() {
    // Use WP time (respects WP timezone), but store as Unix
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

if (!function_exists('shoshin_set_paid_until_max')) {
  function shoshin_set_paid_until_max($user_id, $ts) {
    $user_id = (int) $user_id;
    $ts      = (int) $ts;

    if ($ts <= 0) return;

    $existing = shoshin_get_paid_until($user_id);
    if ($ts > $existing) {
      update_user_meta($user_id, 'shoshin_paid_until', $ts);
    }
  }
}

if (!function_exists('shoshin_pmpro_level_end_ts')) {
  /**
   * Extract a Unix timestamp enddate from a PMPro level object.
   * Handles common PMPro representations robustly.
   */
  function shoshin_pmpro_level_end_ts($level_obj) {
    if (empty($level_obj)) return 0;

    // PMPro commonly uses ->enddate (may be 0, null, int, or string)
    if (isset($level_obj->enddate)) {
      $end = $level_obj->enddate;

      if (is_numeric($end)) {
        return (int) $end;
      }

      if (is_string($end)) {
        $t = strtotime($end);
        return $t ? (int) $t : 0;
      }
    }

    // Some installs may have ->expiration_number/unit, but enddate is preferred.
    return 0;
  }
}

if (!function_exists('shoshin_is_paid_entitled')) {
  /**
   * Determine if user should be treated as "paid entitled" right now.
   * Paid if:
   *  - they currently have level 2 or 3 active, OR
   *  - paid_until meta exists and is in the future.
   */
  function shoshin_is_paid_entitled($user_id) {
    $user_id = (int) $user_id;

    $PAID_LEVEL_IDS = array(2, 3);

    if (function_exists('pmpro_getMembershipLevelForUser')) {
      $level = pmpro_getMembershipLevelForUser($user_id);
      $level_id = (!empty($level) && !empty($level->id)) ? (int) $level->id : 0;
      if (in_array($level_id, $PAID_LEVEL_IDS, true)) {
        return true;
      }
    }

    $paid_until = shoshin_get_paid_until($user_id);
    if ($paid_until > shoshin_now_ts()) {
      return true;
    }

    return false;
  }
}
/* END RMS LIMIT GATE FIX — GUARD ENTITLEMENTS HELPERS (AVOID REDECLARE) */

/**
 * Snapshot paid_until BEFORE a change that might remove/replace the paid level.
 * This protects end-of-term access in downgrade/change/cancel flows.
 */
add_action('pmpro_before_change_membership_level', function ($level_id, $user_id, $cancel_level) {
  $user_id = (int) $user_id;
  $level_id = (int) $level_id;

  // If user currently has a paid level, preserve its enddate in user_meta.
  if (!function_exists('pmpro_getMembershipLevelForUser')) return;

  $current = pmpro_getMembershipLevelForUser($user_id);
  $current_id = (!empty($current) && !empty($current->id)) ? (int) $current->id : 0;

  // Paid levels
  if (!in_array($current_id, array(2,3), true)) return;

  $end_ts = shoshin_pmpro_level_end_ts($current);

  // If enddate is missing/0 for some reason, we do nothing (better than guessing).
  if ($end_ts > 0) {
    shoshin_set_paid_until_max($user_id, $end_ts);
  }
}, 10, 3);

/**
 * After change:
 * - If user moved into paid (2/3), refresh paid_until from new level enddate.
 * - If user ends up with no level (0), you may assign Free (4) for visibility,
 *   but do NOT remove paid_until; entitlement remains until paid_until passes.
 */
add_action('pmpro_after_change_membership_level', function ($level_id, $user_id, $cancel_level) {
  $user_id = (int) $user_id;
  $level_id = (int) $level_id;

  if (!function_exists('pmpro_getMembershipLevelForUser')) return;

  // If now paid, refresh paid_until
  if (in_array($level_id, array(2,3), true)) {
    $lvl = pmpro_getMembershipLevelForUser($user_id);
    $end_ts = shoshin_pmpro_level_end_ts($lvl);
    if ($end_ts > 0) {
      update_user_meta($user_id, 'shoshin_paid_until', (int)$end_ts);
    }
    return;
  }

  // If they moved to Free (4) via downgrade/change, do nothing here.
  // paid_until meta (captured in before hook) continues to grant paid RMS until term end.
}, 20, 3);

/** ---------------------------------------------------------
 *  3) Helpers (WPForms counting)
 *  --------------------------------------------------------- */
/* BEGIN RMS LIMIT GATE FIX — GUARD shoshin_wpforms_table_exists (AVOID REDECLARE) */
if (!function_exists('shoshin_wpforms_table_exists')) {
  function shoshin_wpforms_table_exists($table_name) {
    global $wpdb;
    $like = $wpdb->esc_like($table_name);
    $sql  = $wpdb->prepare("SHOW TABLES LIKE %s", $like);
    $hit  = $wpdb->get_var($sql);
    return !empty($hit);
  }
}
/* END RMS LIMIT GATE FIX — GUARD shoshin_wpforms_table_exists (AVOID REDECLARE) */

/**
 * Count WPForms entries for a given form_id where:
 *  - owner_field_id matches user_id
 *  - optional subtype_field_id matches subtype
 *
 * Supports BOTH schemas:
 *  - entry_fields: (entry_id, field_id, value)
 *  - entry_meta:   (entry_id, field_id, value) (older installs)
 */
/* BEGIN RMS LIMIT GATE FIX — GUARD shoshin_wpforms_count_entries (AVOID REDECLARE) */
if (!function_exists('shoshin_wpforms_count_entries')) {
  function shoshin_wpforms_count_entries($form_id, $owner_field_id, $user_id, $sub_field_id = 0, $subtype = '') {
    global $wpdb;

    $entries_table = $wpdb->prefix . 'wpforms_entries';
    $fields_table  = $wpdb->prefix . 'wpforms_entry_fields';
    $meta_table    = $wpdb->prefix . 'wpforms_entry_meta';

    $has_fields = shoshin_wpforms_table_exists($fields_table);
    $has_meta   = shoshin_wpforms_table_exists($meta_table);

    $kv_table = $has_fields ? $fields_table : ($has_meta ? $meta_table : '');
    if (!$kv_table) return array('count' => 0);

    $uid_str = (string) $user_id;
    $uid_int = (int) $user_id;

    if ((int)$sub_field_id > 0 && $subtype !== '') {

      $sql = $wpdb->prepare("
        SELECT COUNT(DISTINCT e.entry_id)
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
          AND TRIM(fs.value) = %s
      ", (int)$form_id, (int)$owner_field_id, $uid_str, $uid_int, (int)$sub_field_id, (string)$subtype);

      return array('count' => (int) $wpdb->get_var($sql));

    } else {

      $sql = $wpdb->prepare("
        SELECT COUNT(DISTINCT e.entry_id)
        FROM {$entries_table} e
        INNER JOIN {$kv_table} fo ON fo.entry_id = e.entry_id
        WHERE e.form_id = %d
          AND fo.field_id = %d
          AND (
               TRIM(fo.value) = %s
               OR CAST(TRIM(fo.value) AS UNSIGNED) = %d
          )
      ", (int)$form_id, (int)$owner_field_id, $uid_str, $uid_int);

      return array('count' => (int) $wpdb->get_var($sql));
    }
  }
}
/* END RMS LIMIT GATE FIX — GUARD shoshin_wpforms_count_entries (AVOID REDECLARE) */

/** ---------------------------------------------------------
 *  4) AJAX handler (logged-in + logged-out)
 *  --------------------------------------------------------- */
function shoshin_rms_gate_check_handler() {

  if (!check_ajax_referer('shoshin_rms_gate_nonce', 'nonce', false)) {
    wp_send_json(array('ok' => false, 'msg' => 'Security check failed. Please refresh and try again.'));
  }

  if (!is_user_logged_in()) {
    wp_send_json(array('ok' => false, 'msg' => 'You must be logged in to use the Roster Management System.'));
  }

  $user_id = (int) get_current_user_id();

  if (!function_exists('pmpro_getMembershipLevelForUser')) {
    wp_send_json(array('ok' => false, 'msg' => 'Membership system is temporarily unavailable. Please try again later.'));
  }

  $form_id = isset($_POST['form_id']) ? (int) $_POST['form_id'] : 0;
  $subtype = isset($_POST['subtype']) ? sanitize_text_field((string) $_POST['subtype']) : '';
  $subtype = trim($subtype);

  $gated_forms = array(2247, 2501, 2799);
  if (!in_array($form_id, $gated_forms, true)) {
    wp_send_json(array('ok' => true));
  }

  // NEW: Paid entitlement check (covers cancel/downgrade until term end)
  if (shoshin_is_paid_entitled($user_id)) {
    wp_send_json(array('ok' => true));
  }

  // From here down: treat as Free enforcement

    /* BEGIN RMS LIMIT GATE FIX — DEFINE FREE LEVEL ID */
  // NOTE: Must be defined inside this handler scope.
  $FREE_LEVEL_ID = 4;
  /* END RMS LIMIT GATE FIX — DEFINE FREE LEVEL ID */
  $level = pmpro_getMembershipLevelForUser($user_id);
  $level_id = (!empty($level) && !empty($level->id)) ? (int) $level->id : 0;

  // Fail-safe: Only enforce Free limits for Free(4) or no-level(0).
  // (If some other level exists, allow.)
  if ($level_id !== $FREE_LEVEL_ID && $level_id !== 0) {
    wp_send_json(array('ok' => true));
  }

  // Field mappings (your canonical mappings)
  $owner_field_ids = array(
    2247 => 9,
    2501 => 1,
    2799 => 2,
  );

  $sub_field_ids = array(
    2247 => 6, // Character Class
    2501 => 4, // Support Asset Type
  );

  $owner_field_id = isset($owner_field_ids[$form_id]) ? (int) $owner_field_ids[$form_id] : 0;
  if ($owner_field_id < 1) {
    wp_send_json(array('ok' => false, 'msg' => 'Configuration error: missing owner field mapping.'));
  }

  // A) Clan Rosters (2799): 1 total per user
  if ($form_id === 2799) {

    $r = shoshin_wpforms_count_entries(2799, $owner_field_id, $user_id);
    $count = (int) $r['count'];

    if ($count >= 1) {
      wp_send_json(array(
        'ok'  => false,
        'msg' => 'Free membership allows only 1 Clan Roster. Upgrade to create additional rosters.',
      ));
    }

    wp_send_json(array('ok' => true));
  }

  // B) Characters / Support Assets: 1 per subtype per user
  $sub_field_id = isset($sub_field_ids[$form_id]) ? (int) $sub_field_ids[$form_id] : 0;

  if ($sub_field_id < 1 || $subtype === '') {
    wp_send_json(array('ok' => false, 'msg' => 'Please select a type before continuing.'));
  }

  $r = shoshin_wpforms_count_entries($form_id, $owner_field_id, $user_id, $sub_field_id, $subtype);
  $count = (int) $r['count'];

  if ($count >= 1) {
    $label = ($form_id === 2247) ? 'Character Class' : 'Support Asset Type';
    wp_send_json(array(
      'ok'  => false,
      'msg' => "Free membership allows only 1 per {$label} ({$subtype}). Upgrade to create more.",
    ));
  }

  wp_send_json(array('ok' => true));
}

add_action('wp_ajax_shoshin_rms_gate_check', 'shoshin_rms_gate_check_handler');
add_action('wp_ajax_nopriv_shoshin_rms_gate_check', 'shoshin_rms_gate_check_handler');