<?php
/**
 * UAC: Unified auth gating + login redirect + PMPro Free auto-assign on WC checkout account creation
 */

/** -------------------------------
 *  1) Front-end routing rules
 *  ------------------------------- */
add_action('template_redirect', function () {

    // Avoid interfering with Elementor preview/editor requests
    if (!empty($_GET['elementor-preview'])) {
        return;
    }
    if (defined('ELEMENTOR_VERSION') && class_exists('\Elementor\Plugin')) {
        try {
            if (\Elementor\Plugin::$instance->editor && \Elementor\Plugin::$instance->editor->is_edit_mode()) {
                return;
            }
        } catch (\Throwable $e) {
            // Ignore safely.
        }
    }

    $is_login_page = is_page(297); // Swapped from slug to is_page(LOGIN_PAGE_ID)

    // Allow admins/editors to access /login (needed for Elementor editing / QA)
    if ($is_login_page && current_user_can('edit_pages')) {
        return;
    }

    // LOGGED-IN: keep normal users out of /login
    if (is_user_logged_in()) {
        if ($is_login_page) {
            wp_safe_redirect(home_url('/my-account/'), 302);
            exit;
        }
        return;
    }

    // LOGGED-OUT: allow /login
    if ($is_login_page) {
        return;
    }

    // LOGGED-OUT: block /my-account except lost-password
    if (function_exists('is_account_page') && is_account_page()) {

        if (function_exists('is_wc_endpoint_url') && is_wc_endpoint_url('lost-password')) {
            return; // allow recovery
        }

        wp_safe_redirect(home_url('/login/'), 302);
        exit;
    }

}, 1);


/** -------------------------------
 *  2) Post-login redirect
 *  ------------------------------- */
add_filter('woocommerce_login_redirect', function ($redirect, $user) {
    return home_url('/my-account/');
}, 10, 2);


/** ---------------------------------------------------------
 *  3) If Woo creates an account during checkout,
 *     auto-assign PMPro Free level (ID = 4)
 *  --------------------------------------------------------- */
add_action('woocommerce_created_customer', function ($customer_id) {

    if (!function_exists('pmpro_changeMembershipLevel')) {
        return;
    }

    $FREE_LEVEL_ID = 4;

    // If they already have a PMPro level, do nothing
    if (function_exists('pmpro_getMembershipLevelForUser')) {
        $level = pmpro_getMembershipLevelForUser((int)$customer_id);
        if (!empty($level) && !empty($level->id)) {
            return;
        }
    }

    pmpro_changeMembershipLevel($FREE_LEVEL_ID, (int)$customer_id);

}, 20, 1);


/**
 * PMPro: If a user ends up with NO membership level (0),
 * automatically assign them to the Free level (ID = 4).
 *
 * Prevents "no level" orphan states after cancellations/expirations.
 */
add_action('pmpro_after_change_membership_level', function ($level_id, $user_id, $cancel_level) {

    // Only act when user has no level
    if ((int)$level_id !== 0) {
        return;
    }

    $FREE_LEVEL_ID = 4;

    // Avoid infinite loop when we assign Free
    static $in_progress = false;
    if ($in_progress) {
        return;
    }
    $in_progress = true;

    // Assign Free level
    if (function_exists('pmpro_changeMembershipLevel')) {
        pmpro_changeMembershipLevel($FREE_LEVEL_ID, (int)$user_id);
    }

    $in_progress = false;

}, 20, 3);