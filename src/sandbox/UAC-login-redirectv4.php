<?php
/**
 * UAC: Unified auth gating + login redirect + PMPro Free default checkout level (ID=4)
 *
 * Behaviors:
 * 1) Direct login at /login (no redirect_to) -> /my-account/
 * 2) If redirected to /login from a protected page -> back to original page after login
 * 3) Logged-in users can access any legal URL directly (no forced /my-account/),
 *    except /login which bounces them away (non-admins).
 *
 * Notes:
 * - Keep ONLY /docs (root) -> /wiki as server-side (.htaccess).
 * - /docs/* are real BetterDocs pages and ARE gated here via '/docs/' prefix.
 */

$UAC_LOGIN_PAGE_ID  = 297; // your /login page ID
$UAC_FREE_LEVEL_ID  = 4;   // PMPro Free tier
$UAC_ACCOUNT_URL    = '/my-account/';
$UAC_LOGIN_URL      = '/login/';
$UAC_PM_CHECKOUT_URL = '/membership-checkout/';

/** ---------------------------------------------------------
 *  A) EARLY: Redirect ghost signup URLs to PMPro checkout
 *     Must run BEFORE Woo/MyAccount routing to avoid /login detours.
 * --------------------------------------------------------- */
add_action('init', function () use ($UAC_PM_CHECKOUT_URL) {

    // Only for guests
    if (is_user_logged_in()) return;

    $raw_uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '/';
    $path = wp_parse_url($raw_uri, PHP_URL_PATH);
    $path = is_string($path) ? $path : '/';
    $path_norm = rtrim('/' . ltrim($path, '/'), '/'); // normalize: leading slash, no trailing slash

    // /register /signup /join -> /membership-checkout/
    if ($path_norm === '/register' || $path_norm === '/signup' || $path_norm === '/join') {
        wp_safe_redirect(home_url($UAC_PM_CHECKOUT_URL), 302);
        exit;
    }

}, 0);


/** ---------------------------------------------------------
 *  B) PMPro: SILENT default checkout level to Free (ID=4)
 *     when visiting /membership-checkout/ with no ?level=
 *
 *     This must NOT override explicit selections (?level=2/3/etc).
 *     We apply it in multiple places so PMPro can’t miss it.
 * --------------------------------------------------------- */

// 1) Inject into parsed WP request vars (very early in routing)
add_filter('request', function ($qv) use ($UAC_FREE_LEVEL_ID, $UAC_PM_CHECKOUT_URL) {

    if (is_user_logged_in()) return $qv;

    // If user explicitly selected a level, do nothing
    if (isset($_REQUEST['level']) && (string)$_REQUEST['level'] !== '') return $qv;
    if (isset($_GET['level']) && (string)$_GET['level'] !== '') return $qv;

    // Only when the request is for /membership-checkout/
    $raw_uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '/';
    $path = wp_parse_url($raw_uri, PHP_URL_PATH);
    $path = is_string($path) ? $path : '/';
    $path_norm = rtrim('/' . ltrim($path, '/'), '/');

    if ($path_norm !== rtrim($UAC_PM_CHECKOUT_URL, '/')) return $qv;

    // Silent injection
    $_REQUEST['level'] = $UAC_FREE_LEVEL_ID;
    $_GET['level']     = $UAC_FREE_LEVEL_ID;

    return $qv;

}, 1);

// 2) Reinforce after WP query is set (covers edge cases where PMPro reads later)
add_action('wp', function () use ($UAC_FREE_LEVEL_ID, $UAC_PM_CHECKOUT_URL) {

    if (is_user_logged_in()) return;

    // Only on membership checkout page by path (works without PMPro helpers)
    $raw_uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '/';
    $path = wp_parse_url($raw_uri, PHP_URL_PATH);
    $path = is_string($path) ? $path : '/';
    $path_norm = rtrim('/' . ltrim($path, '/'), '/');

    if ($path_norm !== rtrim($UAC_PM_CHECKOUT_URL, '/')) return;

    // If explicit selection exists, do nothing
    if (isset($_REQUEST['level']) && (string)$_REQUEST['level'] !== '') return;
    if (isset($_GET['level']) && (string)$_GET['level'] !== '') return;

    $_REQUEST['level'] = $UAC_FREE_LEVEL_ID;
    $_GET['level']     = $UAC_FREE_LEVEL_ID;

    // If PMPro has checkout globals, set them too (best-effort, safe if absent)
    if (function_exists('pmpro_getLevel')) {
        global $pmpro_level;
        try {
            $lvl = pmpro_getLevel($UAC_FREE_LEVEL_ID);
            if (!empty($lvl)) $pmpro_level = $lvl;
        } catch (\Throwable $e) {}
    }

}, 1);


/** -------------------------------
 *  C) Front-end routing rules
 *  ------------------------------- */
add_action('template_redirect', function () use ($UAC_LOGIN_PAGE_ID, $UAC_ACCOUNT_URL, $UAC_LOGIN_URL) {

    // Avoid interfering with Elementor preview/editor requests
    if (!empty($_GET['elementor-preview'])) return;

    if (defined('ELEMENTOR_VERSION') && class_exists('\Elementor\Plugin')) {
        try {
            if (\Elementor\Plugin::$instance->editor && \Elementor\Plugin::$instance->editor->is_edit_mode()) return;
        } catch (\Throwable $e) {}
    }

    $is_login_page = is_page($UAC_LOGIN_PAGE_ID);

    // Allow admins/editors to access /login (Elementor editing / QA)
    if ($is_login_page && current_user_can('edit_pages')) return;

    // Normalize request path for prefix checks
    $raw_uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '/';
    $req_path = wp_parse_url($raw_uri, PHP_URL_PATH);
    $req_path = is_string($req_path) ? $req_path : '/';
    $req_path = '/' . ltrim($req_path, '/'); // ensure leading slash

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

        // PMPro "Already have an account? Log in here" link fix:
    // Their link targets a dead page_id (currently 3348). Redirect it to WC /login/
    // while preserving redirect_to back to membership-checkout (or wherever).
    $pmpro_dead_login_page_id = 3348;
    $pid = isset($_GET['page_id']) ? (int) $_GET['page_id'] : 0;

    if ($pid === $pmpro_dead_login_page_id) {

        $rt = '';
        if (isset($_GET['redirect_to'])) {
            $rt = (string) $_GET['redirect_to'];
        } elseif (isset($_REQUEST['redirect_to'])) {
            $rt = (string) $_REQUEST['redirect_to'];
        }

        $rt = is_string($rt) ? trim(wp_unslash($rt)) : '';

        $dest = home_url('/login/');
        if ($rt !== '') {
            $dest = add_query_arg('redirect_to', rawurlencode($rt), $dest);
        }

        wp_safe_redirect($dest, 302);
        exit;
    }

    // LOGGED-IN:
    // - Allow all normal pages (no forced redirect).
    // - Bounce them away from /login (unless admin/editor).
    if (is_user_logged_in()) {
        if ($is_login_page && !current_user_can('edit_pages')) {

            $rt = '';
            if (isset($_GET['redirect_to'])) $rt = (string) $_GET['redirect_to'];
            elseif (isset($_REQUEST['redirect_to'])) $rt = (string) $_REQUEST['redirect_to'];

            $rt = is_string($rt) ? trim(wp_unslash($rt)) : '';
            if ($rt) {
                $safe = wp_validate_redirect($rt, home_url($UAC_ACCOUNT_URL));
                wp_safe_redirect($safe, 302);
                exit;
            }

            wp_safe_redirect(home_url($UAC_ACCOUNT_URL), 302);
            exit;
        }
        return;
    }

    // LOGGED-OUT: allow /login
    if ($is_login_page) return;

    // LOGGED-OUT: protect tool/content pages
    if ($is_protected) {
        // Preserve destination so user returns after login (path + query string)
        $dest = home_url($raw_uri);

        // Send to /login with redirect_to
        $login_url = add_query_arg('redirect_to', rawurlencode($dest), home_url($UAC_LOGIN_URL));

        wp_safe_redirect($login_url, 302);
        exit;
    }

    // LOGGED-OUT: block /my-account except lost-password
    if (function_exists('is_account_page') && is_account_page()) {

        if (function_exists('is_wc_endpoint_url') && is_wc_endpoint_url('lost-password')) {
            return; // allow recovery
        }

        wp_safe_redirect(home_url($UAC_LOGIN_URL), 302);
        exit;
    }

}, 1);


/** -------------------------------
 *  D) Post-login redirect (WooCommerce)
 *
 * Rules:
 * - If redirect_to exists (user came from protected page), go there (validated).
 * - Otherwise (manual login), go to /my-account/
 *  ------------------------------- */
add_filter('woocommerce_login_redirect', function ($redirect, $user) use ($UAC_ACCOUNT_URL) {

    $rt = '';
    if (isset($_REQUEST['redirect_to'])) $rt = (string) $_REQUEST['redirect_to'];
    elseif (isset($_GET['redirect_to'])) $rt = (string) $_GET['redirect_to'];

    $rt = is_string($rt) ? trim(wp_unslash($rt)) : '';

    if ($rt !== '') {
        return wp_validate_redirect($rt, home_url($UAC_ACCOUNT_URL));
    }

    return home_url($UAC_ACCOUNT_URL);

}, 10, 2);


/** ---------------------------------------------------------
 *  E) If Woo creates an account during checkout,
 *     auto-assign PMPro Free level (ID = 4)
 * --------------------------------------------------------- */
add_action('woocommerce_created_customer', function ($customer_id) use ($UAC_FREE_LEVEL_ID) {

    if (!function_exists('pmpro_changeMembershipLevel')) return;

    // If they already have a PMPro level, do nothing
    if (function_exists('pmpro_getMembershipLevelForUser')) {
        $level = pmpro_getMembershipLevelForUser((int)$customer_id);
        if (!empty($level) && !empty($level->id)) return;
    }

    pmpro_changeMembershipLevel($UAC_FREE_LEVEL_ID, (int)$customer_id);

}, 20, 1);


/**
 * PMPro: If a user ends up with NO membership level (0),
 * automatically assign them to the Free level (ID = 4).
 *
 * Prevents "no level" orphan states after cancellations/expirations.
 */
add_action('pmpro_after_change_membership_level', function ($level_id, $user_id, $cancel_level) use ($UAC_FREE_LEVEL_ID) {

    // Only act when user has no level
    if ((int)$level_id !== 0) return;

    // Avoid infinite loop when we assign Free
    static $in_progress = false;
    if ($in_progress) return;
    $in_progress = true;

    if (function_exists('pmpro_changeMembershipLevel')) {
        pmpro_changeMembershipLevel($UAC_FREE_LEVEL_ID, (int)$user_id);
    }

    $in_progress = false;

}, 20, 3);

/**
 * PMPro: Mark first successful checkout for this user.
 * Redirect destination is controlled via pmpro_confirmation_url filter below.
 */
add_action('pmpro_after_checkout', function ($user_id, $morder) {

    if (!$user_id) return;

    // Set once; used to detect "first-time registration/checkout".
    if (!get_user_meta((int)$user_id, 'uac_pmpro_first_checkout_done', true)) {
        update_user_meta((int)$user_id, 'uac_pmpro_first_checkout_done', 1);
    }

}, 20, 2);

/**
 * PMPro: Redirect after checkout.
 * - First-time checkout (new registrations) -> /my-account/
 * - Otherwise, keep PMPro default confirmation URL.
 */
add_filter('pmpro_confirmation_url', function ($rurl, $user_id, $pmpro_level) use ($UAC_ACCOUNT_URL) {

    $uid = (int)$user_id;
    if ($uid <= 0) return $rurl;

    // If this is the user's first successful checkout, send them to /my-account/
    // (Do NOT override explicit flows for returning users.)
    $done = get_user_meta($uid, 'uac_pmpro_first_checkout_done', true);

    // If meta was just set during this checkout, we still want the first-time redirect.
    // So treat any truthy meta as first-time completed and route to account.
    if (!empty($done)) {
        return home_url($UAC_ACCOUNT_URL);
    }

    return $rurl;

}, 10, 3);