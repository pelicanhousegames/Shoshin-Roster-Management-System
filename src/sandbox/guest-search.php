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