<?php
/**
 * UAC: Unified auth gating + login redirect + PMPro Free auto-assign on WC checkout account creation
 *
 * Behaviors:
 * 1) Direct login at /login (no redirect_to) -> /my-account/
 * 2) If redirected to /login from a protected page -> back to original page after login
 * 3) Logged-in users can access any allowed URL directly (no forced /my-account/), except /login which bounces them away
 *
 * Notes:
 * - Keep ONLY /docs (root) -> /wiki as server-side (.htaccess). Do not gate /docs root here.
 * - /docs/* are real BetterDocs pages and ARE gated here (require login) if included in protected list.
 */

/** ---------------------------------------------------------
 *  0) PMPro: Silent default checkout level to Free (ID = 4)
 *     when visiting /membership-checkout/ without ?level=
 *
 *     Must not override explicit selections (?level=2/3/etc).
 *  --------------------------------------------------------- */
add_action('init', function () {

    if (is_user_logged_in()) {
        return;
    }

    // Only apply when no level is explicitly selected
    if (isset($_REQUEST['level']) && (string) $_REQUEST['level'] !== '') {
        return;
    }

    // Detect membership checkout by path (works even before PMPro helpers)
    $req_path = '/';
    try {
        $raw_uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '/';
        $parsed_path = wp_parse_url($raw_uri, PHP_URL_PATH);
        $req_path = is_string($parsed_path) ? $parsed_path : '/';
    } catch (\Throwable $e) {
        $req_path = '/';
    }
    $req_path = '/' . ltrim($req_path, '/');
    $path_norm = rtrim($req_path, '/');

    if ($path_norm !== '/membership-checkout') {
        return;
    }

    // Extra guard: if PMPro helper exists and says not checkout, do nothing
    if (function_exists('pmpro_is_checkout') && !pmpro_is_checkout()) {
        return;
    }

    // Silent injection (no redirect)
    $_REQUEST['level'] = 4;
    $_GET['level'] = 4;

}, 1);


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

    // Login page (ID-based)
    $LOGIN_PAGE_ID = 297;
    $is_login_page = is_page($LOGIN_PAGE_ID);

    // Allow admins/editors to access /login (needed for Elementor editing / QA)
    if ($is_login_page && current_user_can('edit_pages')) {
        return;
    }

    // Normalize request path for prefix checks
    $req_path = '/';
    $raw_uri  = '/';
    try {
        $raw_uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '/';
        $parsed_path = wp_parse_url($raw_uri, PHP_URL_PATH);
        $req_path = is_string($parsed_path) ? $parsed_path : '/';
    } catch (\Throwable $e) {
        $raw_uri = '/';
        $req_path = '/';
    }
    $req_path = '/' . ltrim($req_path, '/'); // ensure leading slash

    // Guest: redirect legacy/ghost signup URLs to membership checkout
    // (/register, /signup, /join) -> /membership-checkout/
    if (!is_user_logged_in()) {
        $path_norm = rtrim($req_path, '/');
        if ($path_norm === '/register' || $path_norm === '/signup' || $path_norm === '/join') {
            wp_safe_redirect(home_url('/membership-checkout/'), 302);
            exit;
        }
    }

    // PMPro: Silent default checkout level to Free (ID = 4) when visiting
    // /membership-checkout/ without an explicit level selection.
    // This must NOT override a user-selected tier (?level=2/3/etc).
    if (!is_user_logged_in()) {
        $path_norm = rtrim($req_path, '/');
        $has_level = false;
        try {
            $has_level = isset($_REQUEST['level']) && (string) $_REQUEST['level'] !== '';
        } catch (\Throwable $e) {
            $has_level = false;
        }

        if (!$has_level && $path_norm === '/membership-checkout') {
            // Optional extra guard: only do this on the PMPro checkout page when function is available.
            if (!function_exists('pmpro_is_checkout') || pmpro_is_checkout()) {
                $_REQUEST['level'] = 4;
                $_GET['level'] = 4;
            }
        }
    }

    // Paths that require login (prefix match).
    // IMPORTANT:
    // - Do NOT include '/docs' root-only behavior here; keep .htaccess as the only redirect for /docs -> /wiki.
    // - We DO include '/docs/' to protect /docs/* (BetterDocs pages).
    $protected_prefixes = array(
        '/clan-creator/',
        '/create-character/',
        '/create-asset/',
        '/create-roster/',
        '/game-system/',
        '/wiki/',
        '/my-assets/',
        '/my-rosters/',
        '/news/',
        '/resource-center/',
        '/docs/', // protects /docs/* pages; /docs root redirect stays server-side
    );

    // Helper: does current path start with any protected prefix?
    $is_protected = false;
    foreach ($protected_prefixes as $prefix) {
        $prefix = '/' . ltrim((string) $prefix, '/');
        if ($prefix !== '/' && strpos($req_path, $prefix) === 0) {
            $is_protected = true;
            break;
        }
    }

    // If user is logged in:
    // - Allow all normal pages (no forced redirect).
    // - Only bounce them away from /login (unless admin/editor).
    if (is_user_logged_in()) {
        if ($is_login_page && !current_user_can('edit_pages')) {
            // If someone hits /login while already logged in, prefer redirect_to if present and safe.
            $rt = '';
            if (isset($_GET['redirect_to'])) {
                $rt = (string) $_GET['redirect_to'];
            } elseif (isset($_REQUEST['redirect_to'])) {
                $rt = (string) $_REQUEST['redirect_to'];
            }
            $rt = is_string($rt) ? trim(wp_unslash($rt)) : '';
            if ($rt) {
                $safe = wp_validate_redirect($rt, home_url('/my-account/'));
                wp_safe_redirect($safe, 302);
                exit;
            }

            wp_safe_redirect(home_url('/my-account/'), 302);
            exit;
        }
        return;
    }

    // LOGGED-OUT: allow /login
    if ($is_login_page) {
        return;
    }

    // LOGGED-OUT: protect tool/content pages
    if ($is_protected) {
        // Preserve destination so user returns after login.
        // Include full URI (path + query string).
        $dest = home_url($raw_uri);

        // Send to your custom /login page with redirect_to
        $login_url = add_query_arg('redirect_to', rawurlencode($dest), home_url('/login/'));

        wp_safe_redirect($login_url, 302);
        exit;
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
 *  2) Post-login redirect (WooCommerce)
 *
 * Rules:
 * - If redirect_to exists (meaning user was sent to login from another page), go there (validated).
 * - Otherwise (manual login), go to /my-account/
 *  ------------------------------- */
add_filter('woocommerce_login_redirect', function ($redirect, $user) {

    $rt = '';
    if (isset($_REQUEST['redirect_to'])) {
        $rt = (string) $_REQUEST['redirect_to'];
    } elseif (isset($_GET['redirect_to'])) {
        $rt = (string) $_GET['redirect_to'];
    }

    $rt = is_string($rt) ? trim(wp_unslash($rt)) : '';

    if ($rt !== '') {
        return wp_validate_redirect($rt, home_url('/my-account/'));
    }

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