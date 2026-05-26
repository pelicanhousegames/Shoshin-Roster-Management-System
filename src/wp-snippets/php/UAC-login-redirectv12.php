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
 *  UAC PASSWORD POLICY — Shared validator for PMPro + Woo
 *
 *  Goal:
 *  - Prevent weak passwords before HostGator/Newfold can hijack
 *    the flow with action=nfd_sp_insecure_password
 *  - Enforce the same rule across:
 *      1) PMPro checkout registration
 *      2) Woo account registration
 *      3) Woo account creation during checkout
 *  - Add light client-side feedback as UX sugar
 *  - Keep a fallback redirect interceptor for the host-layer action
 * --------------------------------------------------------- */

if (!function_exists('uac_password_policy_message')) {
    function uac_password_policy_message() {
        return 'Please create a stronger password. Use at least 12 characters, including 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.';
    }
}

if (!function_exists('uac_validate_password_strength')) {
    function uac_validate_password_strength($password) {
        $password = (string) $password;

        if ($password === '') {
            return array(
                'ok'      => false,
                'message' => 'Please enter a password.',
            );
        }

        $length_ok   = (strlen($password) >= 12);
        $upper_ok    = (bool) preg_match('/[A-Z]/', $password);
        $lower_ok    = (bool) preg_match('/[a-z]/', $password);
        $number_ok   = (bool) preg_match('/[0-9]/', $password);
        $special_ok  = (bool) preg_match('/[^A-Za-z0-9]/', $password);

        $ok = ($length_ok && $upper_ok && $lower_ok && $number_ok && $special_ok);

        return array(
            'ok'      => $ok,
            'message' => $ok ? '' : uac_password_policy_message(),
        );
    }
}

/**
 * Small helper to extract the first non-empty posted password candidate.
 */
if (!function_exists('uac_get_posted_password_candidate')) {
    function uac_get_posted_password_candidate($keys = array()) {
        foreach ($keys as $key) {
            if (!isset($_POST[$key])) {
                continue;
            }

            $raw = wp_unslash($_POST[$key]);

            // Password fields should remain unsanitized except for slash removal.
            if (is_string($raw) && $raw !== '') {
                return $raw;
            }
        }

        return '';
    }
}

/**
 * PMPro server-side registration validation.
 *
 * PMPro documents pmpro_registration_checks as the filter used to add
 * checkout validation before registration continues. :contentReference[oaicite:2]{index=2}
 */
add_filter('pmpro_registration_checks', function ($pmpro_continue_registration) {

    if (!$pmpro_continue_registration) {
        return $pmpro_continue_registration;
    }

    // Only relevant for logged-out registrations.
    if (is_user_logged_in()) {
        return $pmpro_continue_registration;
    }

    $password = uac_get_posted_password_candidate(array(
        'password',
        'pass1',
        'user_pass',
    ));

    // If PMPro account fields are skipped for some reason, do not block here.
    if ($password === '') {
        return $pmpro_continue_registration;
    }

    $validation = uac_validate_password_strength($password);

    if (!$validation['ok']) {
        global $pmpro_msg, $pmpro_msgt;

        $pmpro_msg  = $validation['message'];
        $pmpro_msgt = 'pmpro_error';

        return false;
    }

    return $pmpro_continue_registration;

}, 20);

/**
 * WooCommerce registration validation.
 *
 * WooCommerce core runs process_registration() on wp_loaded and applies
 * woocommerce_process_registration_errors before creating the customer. :contentReference[oaicite:3]{index=3}
 */
add_filter('woocommerce_process_registration_errors', function ($errors, $username, $password, $email) {

    // If Woo is generating passwords automatically, there may be no posted password.
    if ((string) $password === '') {
        return $errors;
    }

    $validation = uac_validate_password_strength($password);

    if (!$validation['ok']) {
        $errors->add('uac_weak_password', $validation['message']);
    }

    return $errors;

}, 20, 4);

/**
 * WooCommerce checkout account-creation validation.
 *
 * This only applies if checkout account creation is enabled again later.
 */
add_action('woocommerce_after_checkout_validation', function ($data, $errors) {

    if (is_user_logged_in()) {
        return;
    }

    $create_account = false;

    if (isset($_POST['createaccount'])) {
        $create_account = !empty($_POST['createaccount']);
    } elseif (isset($data['createaccount'])) {
        $create_account = !empty($data['createaccount']);
    }

    if (!$create_account) {
        return;
    }

    $password = '';

    if (isset($data['account_password']) && is_string($data['account_password']) && $data['account_password'] !== '') {
        $password = $data['account_password'];
    }

    if ($password === '') {
        $password = uac_get_posted_password_candidate(array('account_password'));
    }

    // If Woo is configured to auto-generate passwords, do not block here.
    if ($password === '') {
        return;
    }

    $validation = uac_validate_password_strength($password);

    if (!$validation['ok']) {
        $errors->add('uac_weak_password', $validation['message']);
    }

}, 20, 2);

/**
 * Host-layer fallback:
 * If Newfold/HostGator still injects its insecure-password action,
 * bounce users back to the PMPro login page instead of wp-admin.
 *
 * This should become a rare fallback once validation is in place.
 */
add_action('init', function () use ($UAC_LOGIN_URL) {
    if (
        isset($_GET['action']) &&
        (string) $_GET['action'] === 'nfd_sp_insecure_password'
    ) {
        $dest = home_url($UAC_LOGIN_URL);

        if (!empty($_GET['redirect_to'])) {
            $dest = add_query_arg(
                'redirect_to',
                rawurlencode((string) wp_unslash($_GET['redirect_to'])),
                $dest
            );
        }

        wp_safe_redirect($dest, 302);
        exit;
    }
}, 1);

/**
 * Lightweight front-end validation for PMPro + Woo forms.
 *
 * This improves UX but does not replace the server-side enforcement above.
 */
add_action('wp_footer', function () use ($UAC_LOGIN_PAGE_ID) {
    if (is_admin()) {
        return;
    }

    $is_relevant = false;

    if (function_exists('is_page')) {
       if (
            is_page('membership-checkout') ||
            is_page($UAC_LOGIN_PAGE_ID) ||
            (function_exists('is_account_page') && is_account_page())
        ) {
            $is_relevant = true;
        }
    }

    if (!$is_relevant) {
        return;
    }

    $message = esc_js(uac_password_policy_message());
    ?>
    <script>
    (function () {
      function validatePassword(value) {
        if (!value) {
          return { ok: false, message: 'Please enter a password.' };
        }

        var ok =
          value.length >= 12 &&
          /[A-Z]/.test(value) &&
          /[a-z]/.test(value) &&
          /[0-9]/.test(value) &&
          /[^A-Za-z0-9]/.test(value);

        return {
          ok: ok,
          message: ok ? '' : <?php echo wp_json_encode($message); ?>
        };
      }

      function getPasswordField(form) {
        if (!form) return null;

        return (
          form.querySelector('input[name="password"]') ||
          form.querySelector('input[name="account_password"]') ||
          form.querySelector('input[type="password"][autocomplete="new-password"]') ||
          form.querySelector('input[type="password"]')
        );
      }

      function getConfirmPasswordField(form, passwordField) {
        if (!form) return null;

        var candidates = [].slice.call(form.querySelectorAll('input[type="password"]'));
        if (!candidates.length) return null;

        for (var i = 0; i < candidates.length; i++) {
          var field = candidates[i];
          if (passwordField && field === passwordField) continue;

          var name = (field.name || '').toLowerCase();
          var id = (field.id || '').toLowerCase();

          if (
            name.indexOf('confirm') !== -1 ||
            name.indexOf('pass2') !== -1 ||
            id.indexOf('confirm') !== -1 ||
            id.indexOf('pass2') !== -1
          ) {
            return field;
          }
        }

        return (candidates.length > 1) ? candidates[candidates.length - 1] : null;
      }

      function getMessageNode(form) {
        var existing = form.querySelector('.uac-password-policy-error');
        if (existing) return existing;

        var node = document.createElement('div');
        node.className = 'uac-password-policy-error';
        node.style.color = '#b42318';
        node.style.marginTop = '8px';
        node.style.fontSize = '14px';
        node.style.lineHeight = '1.4';
        node.style.display = 'none';

        var pwd = getPasswordField(form);
        if (pwd && pwd.parentNode) {
          pwd.parentNode.appendChild(node);
        } else {
          form.appendChild(node);
        }

        return node;
      }

      function showMessage(form, text) {
        var msg = getMessageNode(form);
        msg.textContent = text || '';
        msg.style.display = text ? 'block' : 'none';
      }

      function clearMessage(form) {
        showMessage(form, '');
      }

      function resetSubmitUi(form) {
        if (!form) return;

        var submitters = form.querySelectorAll(
          'button[type="submit"], input[type="submit"], .pmpro_btn-submit, .woocommerce-button'
        );

        submitters.forEach(function (btn) {
          btn.disabled = false;
          btn.removeAttribute('aria-disabled');
          btn.classList.remove('disabled', 'is-disabled', 'processing', 'loading');
        });

        var processingNodes = form.querySelectorAll('.pmpro_processing, .processing, .woocommerce-NoticeGroup-checkout');
        processingNodes.forEach(function (node) {
          if (node.classList.contains('pmpro_processing')) {
            node.style.display = 'none';
          }
        });

        // PMPro commonly appends/changes inline text nodes to "Processing..."
        var walker = document.createTreeWalker(form, NodeFilter.SHOW_TEXT, null);
        var changed = [];
        while (walker.nextNode()) {
          var node = walker.currentNode;
          if ((node.nodeValue || '').trim() === 'Processing...') {
            changed.push(node);
          }
        }
        changed.forEach(function (node) {
          node.nodeValue = '';
        });
      }

      function bindLiveValidation(form) {
        if (!form || form.dataset.uacPasswordBound === '1') return;
        form.dataset.uacPasswordBound = '1';

        var pwd = getPasswordField(form);
        var confirmPwd = getConfirmPasswordField(form, pwd);

        function reevaluate() {
          if (!pwd) return;

          resetSubmitUi(form);

          var result = validatePassword(pwd.value);

          if (!pwd.value) {
            clearMessage(form);
            pwd.removeAttribute('aria-invalid');
            if (confirmPwd) confirmPwd.removeAttribute('aria-invalid');
            return;
          }

          if (!result.ok) {
            showMessage(form, result.message);
            pwd.setAttribute('aria-invalid', 'true');
            if (confirmPwd) confirmPwd.removeAttribute('aria-invalid');
            return;
          }

          clearMessage(form);
          pwd.removeAttribute('aria-invalid');

          if (confirmPwd && confirmPwd.value && confirmPwd.value !== pwd.value) {
            confirmPwd.setAttribute('aria-invalid', 'true');
          } else if (confirmPwd) {
            confirmPwd.removeAttribute('aria-invalid');
          }
        }

        if (pwd) {
          pwd.addEventListener('input', reevaluate);
          pwd.addEventListener('change', reevaluate);
        }

        if (confirmPwd) {
          confirmPwd.addEventListener('input', reevaluate);
          confirmPwd.addEventListener('change', reevaluate);
        }

        form.addEventListener('submit', function (e) {
          if (!pwd) return;

          var result = validatePassword(pwd.value);

          if (!result.ok) {
            e.preventDefault();
            e.stopPropagation();
            resetSubmitUi(form);
            showMessage(form, result.message);
            pwd.setAttribute('aria-invalid', 'true');
            pwd.focus();
            return false;
          }

          clearMessage(form);
          pwd.removeAttribute('aria-invalid');
          if (confirmPwd) confirmPwd.removeAttribute('aria-invalid');
        }, true);
      }

      function init() {
        var forms = [].slice.call(document.querySelectorAll('form'));

        forms.forEach(function (form) {
          if (
            form.matches('.pmpro_form') ||
            form.matches('.woocommerce-form-register') ||
            form.querySelector('input[name="account_password"]') ||
            form.querySelector('input[name="password"]')
            ) {
            bindLiveValidation(form);
            }
        });
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    })();
    </script>
    <?php
}, 100);

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

    // LOGGED-OUT: manual visits to /login with no redirect_to
    // should return the user to the internal page they came from.
    if ($is_login_page) {

        $rt = '';
        if (isset($_GET['redirect_to'])) {
            $rt = (string) $_GET['redirect_to'];
        } elseif (isset($_REQUEST['redirect_to'])) {
            $rt = (string) $_REQUEST['redirect_to'];
        }

        $rt = is_string($rt) ? trim(wp_unslash($rt)) : '';

        // Already has redirect_to: let it pass through untouched.
        if ($rt !== '') {
            return;
        }

        $referer = wp_get_referer();
        if (!$referer) {
            return;
        }

        $referer = (string) $referer;
        $referer_host = wp_parse_url($referer, PHP_URL_HOST);
        $home_host    = wp_parse_url(home_url('/'), PHP_URL_HOST);

        // Only trust same-site referers.
        if (!$referer_host || !$home_host || strtolower($referer_host) !== strtolower($home_host)) {
            return;
        }

        $referer_path  = wp_parse_url($referer, PHP_URL_PATH);
        $referer_query = wp_parse_url($referer, PHP_URL_QUERY);

        $referer_path = is_string($referer_path) ? '/' . ltrim($referer_path, '/') : '/';
        $referer_norm = rtrim($referer_path, '/');

        $blocked_paths = array(
            rtrim($UAC_LOGIN_URL, '/'),
            '/wp-login.php',
            '/wp-admin',
            '/membership-account',
        );

        foreach ($blocked_paths as $blocked) {
            $blocked = '/' . ltrim((string) $blocked, '/');
            $blocked = rtrim($blocked, '/');

            if ($referer_norm === $blocked || strpos($referer_norm . '/', $blocked . '/') === 0) {
                return;
            }
        }

        // Rebuild the original internal URL, including query string if present.
        $dest = home_url($referer_path);
        if (is_string($referer_query) && $referer_query !== '') {
            $dest .= '?' . $referer_query;
        }

        $login_url = add_query_arg('redirect_to', rawurlencode($dest), home_url($UAC_LOGIN_URL));

        wp_safe_redirect($login_url, 302);
        exit;
    }

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

/** -------------------------------
 *  D2) Post-login redirect (core WordPress / PMPro front-end login)
 *
 * Rules:
 * - If redirect_to exists (user came from protected page), go there (validated).
 * - Otherwise:
 *   - admins/editors/managers can keep WordPress/admin-oriented flows
 *   - low-level/front-end users go to /my-account/
 *  ------------------------------- */
add_filter('login_redirect', function ($redirect_to, $requested_redirect_to, $user) use ($UAC_ACCOUNT_URL) {

    // Failed login or no resolved user object: do not alter core behavior.
    if (!($user instanceof WP_User)) {
        return $redirect_to;
    }

    // Preserve an explicit redirect_to if present.
    $rt = is_string($requested_redirect_to) ? trim($requested_redirect_to) : '';
    if ($rt !== '') {
        return wp_validate_redirect($rt, home_url($UAC_ACCOUNT_URL));
    }

    // Keep elevated users out of forced front-end account routing.
    if (
        user_can($user, 'manage_options') ||
        user_can($user, 'edit_pages') ||
        user_can($user, 'edit_others_shop_orders')
    ) {
        return $redirect_to ? $redirect_to : admin_url();
    }

    // Front-end / low-level users should always land on Woo My Account.
    return home_url($UAC_ACCOUNT_URL);

}, 20, 3);


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
 * PMPro: Final checkout safety net.
 *
 * If PMPro creates/logs in a user but leaves them with no membership level,
 * immediately assign the Free level.
 */
add_action('pmpro_after_checkout', function ($user_id, $morder) use ($UAC_FREE_LEVEL_ID) {

    if (!$user_id) return;

    // Set once; used to detect "first-time registration/checkout".
    if (!get_user_meta((int)$user_id, 'uac_pmpro_first_checkout_done', true)) {
        update_user_meta((int)$user_id, 'uac_pmpro_first_checkout_done', 1);
    }

    if (!function_exists('pmpro_changeMembershipLevel')) return;

    $has_level = false;

    if (function_exists('pmpro_getMembershipLevelForUser')) {
        $level = pmpro_getMembershipLevelForUser((int)$user_id);
        $has_level = (!empty($level) && !empty($level->id));
    }

    if (!$has_level) {
        pmpro_changeMembershipLevel((int)$UAC_FREE_LEVEL_ID, (int)$user_id);
    }

}, 20, 2);

/**
 * WordPress registration safety net.
 *
 * Covers users created by PMPro or any other frontend registration path
 * where no PMPro level was assigned during the original request.
 */
add_action('user_register', function ($user_id) use ($UAC_FREE_LEVEL_ID) {

    if (!$user_id) return;
    if (!function_exists('pmpro_changeMembershipLevel')) return;

    $has_level = false;

    if (function_exists('pmpro_getMembershipLevelForUser')) {
        $level = pmpro_getMembershipLevelForUser((int)$user_id);
        $has_level = (!empty($level) && !empty($level->id));
    }

    if (!$has_level) {
        pmpro_changeMembershipLevel((int)$UAC_FREE_LEVEL_ID, (int)$user_id);
    }

}, 99, 1);



/**
 * PMPro / WordPress login URL normalization:
 * force front-end login links to use the custom /login/ page
 * while preserving redirect_to.
 */
add_filter('login_url', function ($login_url, $redirect, $force_reauth) use ($UAC_LOGIN_URL) {
    if (is_admin()) {
        return $login_url;
    }

    $dest = home_url($UAC_LOGIN_URL);

    if (!empty($redirect)) {
        $dest = add_query_arg('redirect_to', rawurlencode($redirect), $dest);
    }

    if (!empty($force_reauth)) {
        $dest = add_query_arg('reauth', '1', $dest);
    }

    return $dest;
}, 20, 3);

/**
 * Wordfence verification-required bridge:
 * when wp-login.php requires email verification, redirect back to /login/
 * and show the same message inline in the front-end PMPro login form.
 */
if (!function_exists('uac_is_wordfence_verification_required_message')) {
    function uac_is_wordfence_verification_required_message($message) {
        $message = wp_strip_all_tags((string) $message);
        $message = strtolower(trim($message));

        if ($message === '') {
            return false;
        }

        return (
            strpos($message, 'additional verification is required for login') !== false ||
            strpos($message, 'verification required') !== false
        );
    }
}

add_action('wp_login_failed', function ($username, $error) use ($UAC_LOGIN_URL, $UAC_ACCOUNT_URL) {

    if (is_admin()) {
        return;
    }

    if (!($error instanceof WP_Error)) {
        return;
    }

    $messages = $error->get_error_messages();
    if (empty($messages) || !is_array($messages)) {
        return;
    }

    $matched = false;
    foreach ($messages as $message) {
        if (uac_is_wordfence_verification_required_message($message)) {
            $matched = true;
            break;
        }
    }

    if (!$matched) {
        return;
    }

    $dest = add_query_arg('uac_login_notice', 'wf-verify', home_url($UAC_LOGIN_URL));

    $rt = '';
    if (isset($_REQUEST['redirect_to'])) {
        $rt = (string) $_REQUEST['redirect_to'];
    } elseif (isset($_GET['redirect_to'])) {
        $rt = (string) $_GET['redirect_to'];
    }

    $rt = is_string($rt) ? trim(wp_unslash($rt)) : '';

    if ($rt !== '') {
        $dest = add_query_arg('redirect_to', rawurlencode($rt), $dest);
    }

    wp_safe_redirect($dest, 302);
    exit;
}, 20, 2);

add_filter('login_form_top', function ($content, $args = array()) use ($UAC_LOGIN_PAGE_ID) {

    if (is_admin()) {
        return $content;
    }

    if (!function_exists('is_page') || !is_page($UAC_LOGIN_PAGE_ID)) {
        return $content;
    }

    $notice = isset($_GET['uac_login_notice']) ? sanitize_key((string) wp_unslash($_GET['uac_login_notice'])) : '';
    if ($notice !== 'wf-verify') {
        return $content;
    }

    $banner = '<div class="uac-login-status uac-login-status--warning" role="alert" style="margin:0 0 18px;padding:12px 14px;border-left:4px solid #b42318;background:#fff5f5;color:#5f2120;font-size:14px;line-height:1.45;"><strong>Verification required:</strong> Additional verification is required for login. Please check the email address associated with this account for a verification link, then return here to continue.</div>';

    return $banner . $content;
}, 20, 2);

add_action('send_headers', function () {

    $request_uri = isset($_SERVER['REQUEST_URI']) ? strtolower((string) $_SERVER['REQUEST_URI']) : '';
    $query_string = isset($_SERVER['QUERY_STRING']) ? strtolower((string) $_SERVER['QUERY_STRING']) : '';
    $script_name = isset($_SERVER['SCRIPT_NAME']) ? strtolower((string) $_SERVER['SCRIPT_NAME']) : '';

    $is_dynamic_request = false;

    /*
     * Logged-in users should never receive cached HTML.
     */
    if (is_user_logged_in()) {
        $is_dynamic_request = true;
    }

    /*
     * Core WooCommerce dynamic views.
     */
    if (
        function_exists('is_cart') && is_cart() ||
        function_exists('is_checkout') && is_checkout() ||
        function_exists('is_account_page') && is_account_page() ||
        function_exists('is_shop') && is_shop()
    ) {
        $is_dynamic_request = true;
    }

    /*
     * Core WordPress auth flows.
     */
    if (
        is_page(array(
            'login',
            'register',
            'lost-password',
            'reset-password',
            'account',
            'my-account'
        ))
    ) {
        $is_dynamic_request = true;
    }

    /*
     * PMPro / membership ecosystem pages.
     * Add or remove slugs here only if your site structure changes.
     */
    if (
        is_page(array(
            'membership',
            'membership-account',
            'membership-checkout',
            'membership-billing',
            'membership-cancel',
            'membership-levels',
            'membership-confirmation',
            'confirmation',
            'subscriptions',
            'view-order',
            'add-payment-method',
            'order-pay',
            'order-received'
        ))
    ) {
        $is_dynamic_request = true;
    }

    /*
     * WooCommerce AJAX and common dynamic endpoints.
     */
    if (
        defined('DOING_AJAX') && DOING_AJAX ||
        (function_exists('wp_doing_ajax') && wp_doing_ajax()) ||
        (isset($_GET['wc-ajax']) && $_GET['wc-ajax'] !== '') ||
        strpos($query_string, 'wc-ajax=') !== false ||
        strpos($query_string, 'add-to-cart=') !== false ||
        strpos($script_name, 'admin-ajax.php') !== false ||
        strpos($request_uri, '/wp-admin/admin-ajax.php') !== false
    ) {
        $is_dynamic_request = true;
    }

    /*
     * Optional: keep REST responses uncached too, since your site has
     * dynamic commerce/account behavior and this is safer for launch.
     */
    if (
        defined('REST_REQUEST') && REST_REQUEST ||
        strpos($request_uri, '/wp-json/') !== false
    ) {
        $is_dynamic_request = true;
    }

    if (!$is_dynamic_request) {
        return;
    }

    /*
     * Tell cache plugins / reverse proxies not to cache this response.
     */
    if (!defined('DONOTCACHEPAGE')) {
        define('DONOTCACHEPAGE', true);
    }

    if (!defined('DONOTCACHEDB')) {
        define('DONOTCACHEDB', true);
    }

    if (!defined('DONOTMINIFY')) {
        define('DONOTMINIFY', true);
    }

    if (!defined('DONOTCACHEOBJECT')) {
        define('DONOTCACHEOBJECT', true);
    }

    /*
     * Send strong browser/proxy no-cache headers.
     */
    nocache_headers();
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0', true);
    header('Pragma: no-cache', true);
    header('Expires: Wed, 11 Jan 1984 05:00:00 GMT', true);
    header('Surrogate-Control: no-store', true);
    header('Vary: Cookie', false);

}, 1000);

/**
 * Render Nextend Social Login buttons safely.
 */
if (!function_exists('uac_render_nextend_social_buttons')) {
    function uac_render_nextend_social_buttons($context = 'login') {
        if (is_user_logged_in()) {
            return '';
        }

        if (!class_exists('NextendSocialLogin', false)) {
            return '';
        }

        ob_start();
        ?>
        <div class="shoshin-social-auth shoshin-social-auth--<?php echo esc_attr($context); ?>">
            <div class="shoshin-social-auth__divider">
                <span><?php echo $context === 'register' ? 'Or sign up with' : 'Or sign in with'; ?></span>
            </div>
            <?php echo NextendSocialLogin::renderButtonsWithContainer(); ?>
        </div>
        <?php
        return ob_get_clean();
    }
}

/**
 * 1) Inject on PMPro checkout page using official PMPro hook.
 */
add_action('pmpro_checkout_after_form', function () {
    echo uac_render_nextend_social_buttons('register');
}, 20);

