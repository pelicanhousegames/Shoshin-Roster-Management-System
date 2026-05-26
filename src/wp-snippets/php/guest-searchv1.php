<?php
/**
 * Guest Search → WooCommerce Products Only (Main Search + Elementor Live Results)
 * - Guests: product-only
 * - Logged-in: unchanged (no filtering)
 *
 * Covers:
 *   1) Standard search results page (main query)
 *   2) Elementor Search widget Live Results (REST: /elementor-pro/v1/refresh-search)
 */
add_action('pre_get_posts', function ($q) {
  if (is_admin() || !($q instanceof WP_Query)) return;

  // Detect Elementor Live Results REST endpoint
  $is_elementor_live_search = (
    defined('REST_REQUEST') && REST_REQUEST &&
    !empty($_SERVER['REQUEST_URI']) &&
    strpos($_SERVER['REQUEST_URI'], '/elementor-pro/v1/refresh-search') !== false
  );

  // Detect logged-in via WP auth cookie (more reliable for REST/cached edge cases)
  $has_wp_login_cookie = false;
  if (!empty($_COOKIE) && is_array($_COOKIE)) {
    foreach ($_COOKIE as $k => $v) {
      if (strpos($k, 'wordpress_logged_in_') === 0) {
        $has_wp_login_cookie = true;
        break;
      }
    }
  }

  // Standard "logged in" detection for non-REST contexts
  $is_logged_in = is_user_logged_in() || $has_wp_login_cookie;

  // 1) Standard search results page (main query)
  $is_main_search = ($q->is_search() && $q->is_main_query());

  // Only touch:
  // - main search page
  // - elementor live search queries
  if (!$is_main_search && !$is_elementor_live_search) return;

  // Logged-in users: do NOT filter (leave default behavior)
  if ($is_logged_in) return;

  // Guests: force WooCommerce products only
  $q->set('post_type', array('product'));
  $q->set('post_status', array('publish'));

}, 999);

/**
 * Logged-in Search Result Priority
 * Order search results by post type priority:
 * 1) WooCommerce products
 * 2) Docs
 * 3) Blog posts
 *
 * Notes:
 * - Guests are already product-only above, so this only matters for logged-in users.
 * - Applies to:
 *   1) Standard search results page
 *   2) Elementor live results REST endpoint
 */
add_filter('posts_orderby', function ($orderby, $q) {
  if (is_admin() || !($q instanceof WP_Query)) return $orderby;

  // Detect Elementor Live Results REST endpoint
  $is_elementor_live_search = (
    defined('REST_REQUEST') && REST_REQUEST &&
    !empty($_SERVER['REQUEST_URI']) &&
    strpos($_SERVER['REQUEST_URI'], '/elementor-pro/v1/refresh-search') !== false
  );

  // Detect logged-in via WP auth cookie (more reliable for REST/cached edge cases)
  $has_wp_login_cookie = false;
  if (!empty($_COOKIE) && is_array($_COOKIE)) {
    foreach ($_COOKIE as $k => $v) {
      if (strpos($k, 'wordpress_logged_in_') === 0) {
        $has_wp_login_cookie = true;
        break;
      }
    }
  }

  $is_logged_in = is_user_logged_in() || $has_wp_login_cookie;

  // Standard search page
  $is_main_search = ($q->is_search() && $q->is_main_query());

  // Only touch:
  // - main search page
  // - Elementor live search queries
  if (!$is_main_search && !$is_elementor_live_search) return $orderby;

  // Guests: leave ordering alone because they are already product-only
  if (!$is_logged_in) return $orderby;

  global $wpdb;

  /**
   * IMPORTANT:
   * Replace 'docs' below if your actual BetterDocs post type slug differs.
   * Common candidates are: docs, doc, betterdocs
   */
  $case = "CASE {$wpdb->posts}.post_type
    WHEN 'product' THEN 1
    WHEN 'docs' THEN 2
    WHEN 'post' THEN 3
    ELSE 99
  END";

  return "{$case} ASC, {$wpdb->posts}.post_date DESC";
}, 20, 2);

/**
 * SHOSHIN Search: Exclude internal utility pages
 */
add_filter('posts_where', function ($where, $query) {

  if (is_admin() || !($query instanceof WP_Query)) {
    return $where;
  }

  if (!$query->is_search()) {
    return $where;
  }

  global $wpdb;

  $excluded_slugs = [
    'login',
    'contact',
    'my-account',
    'cart',
    'checkout',
    'create-character',
    'create-asset',
    'create-roster',
    'clan-creator',
    'my-assets',
    'my-rosters'
  ];

  $escaped = array_map('esc_sql', $excluded_slugs);

  $where .= " AND {$wpdb->posts}.post_name NOT IN ('" . implode("','", $escaped) . "')";

  return $where;

}, 20, 2);