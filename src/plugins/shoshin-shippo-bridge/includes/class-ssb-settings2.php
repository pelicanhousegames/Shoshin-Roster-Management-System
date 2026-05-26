<?php
if (!defined('ABSPATH')) {
    exit;
}

class SSB_Settings {

    const OPTION_WAREHOUSES                    = 'ssb_warehouses';
    const OPTION_VENDORS                       = 'ssb_vendors';
    const OPTION_MAIN_WAREHOUSE_LOGO_1         = 'ssb_main_warehouse_logo_1';
    const OPTION_MAIN_WAREHOUSE_LOGO_2         = 'ssb_main_warehouse_logo_2';
    const OPTION_FULFILLMENT_LANES             = 'ssb_fulfillment_lanes';
    const OPTION_STOREFRONT_MULTIPACKAGE_MODE  = 'ssb_enable_storefront_multipackage_mode';
    const OPTION_ADMIN_MULTISHIPMENT_MODE      = 'ssb_enable_admin_multishipment_mode';
    const OPTION_LEGACY_MULTIPACKAGE_MODE      = 'ssb_enable_multipackage_mode';
    const OPTION_SINGLE_VARIATION_DIRECT_ADD   = 'ssb_enable_single_variation_direct_add';
    const OPTION_SUPPRESS_FRONTEND_MARKETPLACE_NOTICES = 'ssb_enable_tax_debug_logging';
    const OPTION_MEMO_SHIPPING_RETURNS          = 'ssb_memo_shipping_returns';
    const OPTION_MEMO_TERMS_PRIVACY             = 'ssb_memo_terms_privacy';
    const OPTION_MEMO_ADDITIONAL_INFORMATION    = 'ssb_memo_additional_information';
    const OPTION_MEMO_PREFER_VENDOR_SHIPPING    = 'ssb_memo_prefer_vendor_shipping';
    const OPTION_MEMO_PREFER_VENDOR_TERMS       = 'ssb_memo_prefer_vendor_terms';
    const OPTION_PRODUCT_MEMO_1                 = 'ssb_product_memo_1';
    const OPTION_PRODUCT_MEMO_2                 = 'ssb_product_memo_2';
    const OPTION_PRODUCT_MEMO_3                 = 'ssb_product_memo_3';
    const OPTION_PRODUCT_MEMO_4                 = 'ssb_product_memo_4';
    const OPTION_PRODUCT_MEMO_5                 = 'ssb_product_memo_5';

        /**
         * Initialize settings hooks.
         */
    public static function init() {
        add_action('admin_menu', array(__CLASS__, 'register_records_pages'), 20);
        add_action('admin_init', array(__CLASS__, 'register_settings'));
        add_action('admin_enqueue_scripts', array(__CLASS__, 'enqueue_records_admin_assets'));
        add_action('admin_post_ssb_save_warehouse', array(__CLASS__, 'handle_save_warehouse'));
        add_action('admin_post_ssb_save_vendor', array(__CLASS__, 'handle_save_vendor'));
        add_action('admin_post_ssb_toggle_warehouse_active', array(__CLASS__, 'handle_toggle_warehouse_active'));
        add_action('admin_post_ssb_toggle_vendor_active', array(__CLASS__, 'handle_toggle_vendor_active'));
        add_action('admin_post_ssb_delete_warehouse', array(__CLASS__, 'handle_delete_warehouse'));
        add_action('admin_post_ssb_delete_vendor', array(__CLASS__, 'handle_delete_vendor'));
        add_action('admin_post_ssb_assign_fulfillment_lane_class', array(__CLASS__, 'handle_assign_fulfillment_lane_class'));
        add_action('admin_post_ssb_remove_fulfillment_lane_class', array(__CLASS__, 'handle_remove_fulfillment_lane_class'));
        add_action('admin_post_ssb_assign_fulfillment_lane_warehouse', array(__CLASS__, 'handle_assign_fulfillment_lane_warehouse'));
        add_action('admin_post_ssb_remove_fulfillment_lane_warehouse', array(__CLASS__, 'handle_remove_fulfillment_lane_warehouse'));
        add_action('admin_post_ssb_assign_fulfillment_lane_vendor', array(__CLASS__, 'handle_assign_fulfillment_lane_vendor'));
        add_action('admin_post_ssb_remove_fulfillment_lane_vendor', array(__CLASS__, 'handle_remove_fulfillment_lane_vendor'));
        add_action('admin_post_ssb_save_fulfillment_lane_settings', array(__CLASS__, 'handle_save_fulfillment_lane_settings'));
        add_action('admin_post_ssb_save_memos', array(__CLASS__, 'handle_save_memos'));
        add_action('woocommerce_product_options_shipping', array(__CLASS__, 'render_product_vendor_admin_field'));
        add_action('woocommerce_product_options_advanced', array(__CLASS__, 'render_product_memo_admin_fields'));
        add_action('woocommerce_process_product_meta', array(__CLASS__, 'save_product_memo_admin_fields'));
        add_shortcode('shoshin_memo', array(__CLASS__, 'render_memo_shortcode'));
        add_shortcode('shoshin_vendor_name', array(__CLASS__, 'render_vendor_name_shortcode'));
        add_shortcode('shoshin_vendor_image', array(__CLASS__, 'render_vendor_image_shortcode'));
        add_shortcode('shoshin_vendor_note', array(__CLASS__, 'render_vendor_note_shortcode'));
        add_shortcode('shoshin_product_weight_row', array(__CLASS__, 'render_product_weight_row_shortcode'));
        add_shortcode('shoshin_product_dimensions_row', array(__CLASS__, 'render_product_dimensions_row_shortcode'));
        add_shortcode('shoshin_product_attribute_row', array(__CLASS__, 'render_product_attribute_row_shortcode'));
        add_action('template_redirect', array(__CLASS__, 'maybe_suppress_frontend_marketplace_notices'), 0);
        add_filter('wc_add_to_cart_message_html', array(__CLASS__, 'filter_add_to_cart_message_html'), 99, 2);

        add_filter('woocommerce_add_notice', array(__CLASS__, 'filter_frontend_marketplace_notice_message'), 99);
        add_filter('woocommerce_add_error', array(__CLASS__, 'filter_frontend_marketplace_notice_message'), 99);
        add_filter('woocommerce_add_success', array(__CLASS__, 'filter_frontend_marketplace_notice_message'), 99);
    }

        /**
         * Returns whether the bridge should use Shippo test mode.
         *
         * Resolution order:
         * 1. Manual override option (future-proofed)
         * 2. Detected Shippo plugin settings
         * 3. Default false (live)
         *
         * @return bool
         */
        public static function is_test_mode() {
            $manual = get_option('ssb_shippo_mode', '');
            if ($manual === 'test') {
                return true;
            }
            if ($manual === 'live') {
                return false;
            }

            $detected = self::detect_shippo_mode_from_existing_plugin();
            if ($detected !== null) {
                return (bool) $detected;
            }

            return false;
        }

        /**
         * Return the active Shippo API token.
         *
         * Resolution order:
         * 1. Manual override options (future-proofed)
         * 2. Existing Shippo plugin settings
         *
         * @return string
         */
        public static function get_shippo_token() {
            $is_test = self::is_test_mode();

            $manual_live = trim((string) get_option('ssb_shippo_live_token', ''));
            $manual_test = trim((string) get_option('ssb_shippo_test_token', ''));

            if ($is_test && $manual_test !== '') {
                return $manual_test;
            }

            if (!$is_test && $manual_live !== '') {
                return $manual_live;
            }

            $detected = self::detect_shippo_tokens_from_existing_plugin();

            if ($is_test && !empty($detected['test'])) {
                return (string) $detected['test'];
            }

            if (!$is_test && !empty($detected['live'])) {
                return (string) $detected['live'];
            }

            return '';
        }

        /**
         * Return the store origin from Woo settings.
         *
         * @return array
         */
        public static function get_origin_address() {
            $settings = self::get_shipper_settings();
            /*$adjustments = self::get_rate_adjustment_settings();*/
            $country = strtoupper(trim((string) $settings['country']));
            $phone   = self::normalize_phone($settings['phone'], $country);

            return array(
                'name'     => (string) $settings['name'],
                'company'  => (string) $settings['company'],
                'street1'  => (string) $settings['street1'],
                'street2'  => (string) $settings['street2'],
                'city'     => (string) $settings['city'],
                'state'    => (string) $settings['state'],
                'zip'      => (string) $settings['zip'],
                'country'  => $country,
                'phone'    => $phone,
                'email'    => (string) $settings['email'],
            );
        }

            /**
         * Normalize phone values for carrier-facing payloads.
         *
         * @param string $phone
         * @param string $country
         * @return string
         */
        protected static function normalize_phone($phone, $country = '') {
            $phone   = trim((string) $phone);
            $country = strtoupper(trim((string) $country));

            if ($phone === '') {
                return '';
            }

            $digits = preg_replace('/\D+/', '', $phone);

            if ($country === 'US' && strlen($digits) === 11 && strpos($digits, '1') === 0) {
                $digits = substr($digits, 1);
            }

            return $digits;
        }

        protected static function normalize_money_setting($value) {
        $value = is_scalar($value) ? (string) $value : '';
        $value = trim($value);

        if ($value === '') {
            return '0.00';
        }

        $value = str_replace(',', '', $value);

        if (!is_numeric($value)) {
            return '0.00';
        }

        $value = (float) $value;

        if ($value < 0) {
            $value = 0;
        }

        return number_format($value, 2, '.', '');
    }

            /**
         * Register plugin settings page under Settings.
         *
         * @return void
         */

            public static function register_records_pages() {
        add_menu_page(
            'Fulfillment Bridge',
            'Fulfillment Bridge',
            'manage_woocommerce',
            'ssb-warehouses',
            array(__CLASS__, 'render_warehouses_page'),
            'dashicons-archive',
            56
        );

        add_submenu_page(
            'ssb-warehouses',
            'Warehouses',
            'Warehouses',
            'manage_woocommerce',
            'ssb-warehouses',
            array(__CLASS__, 'render_warehouses_page')
        );

        add_submenu_page(
            'ssb-warehouses',
            'Vendors',
            'Vendors',
            'manage_woocommerce',
            'ssb-vendors',
            array(__CLASS__, 'render_vendors_page')
        );

        add_submenu_page(
            'ssb-warehouses',
            'Fulfillment Lanes',
            'Fulfillment Lanes',
            'manage_woocommerce',
            'ssb-fulfillment-lanes',
            array(__CLASS__, 'render_fulfillment_lanes_page')
        );

        add_submenu_page(
            'ssb-warehouses',
            'Memos',
            'Memos',
            'manage_woocommerce',
            'ssb-memos',
            array(__CLASS__, 'render_memos_page')
        );

        add_submenu_page(
            'ssb-warehouses',
            'Settings',
            'Settings',
            'manage_woocommerce',
            'ssb-settings',
            array(__CLASS__, 'render_settings_page')
        );
    }

    protected static function get_warehouses() {
        $rows = get_option(self::OPTION_WAREHOUSES, array());
        return is_array($rows) ? array_values($rows) : array();
    }

    protected static function get_vendors() {
        $rows = get_option(self::OPTION_VENDORS, array());
        return is_array($rows) ? array_values($rows) : array();
    }

    protected static function get_active_warehouses() {
        $rows = array_values(array_filter(self::get_warehouses(), function($row) {
            return !empty($row['active']) && (string) $row['active'] === '1' && !empty($row['code']);
        }));

        $settings = self::get_shipper_settings();

        $headquarters = array(
            'code'        => 'headquarters',
            'active'      => '1',
            'name'        => 'Headquarters',
            'address1'    => isset($settings['street1']) ? (string) $settings['street1'] : '',
            'address2'    => isset($settings['street2']) ? (string) $settings['street2'] : '',
            'city'        => isset($settings['city']) ? (string) $settings['city'] : '',
            'state'       => isset($settings['state']) ? (string) $settings['state'] : '',
            'postal_code' => isset($settings['zip']) ? (string) $settings['zip'] : '',
            'country'     => isset($settings['country']) ? (string) $settings['country'] : '',
            'phone'       => isset($settings['phone']) ? (string) $settings['phone'] : '',
            'email'       => isset($settings['email']) ? (string) $settings['email'] : '',
        );

        array_unshift($rows, $headquarters);

        return $rows;
    }

    protected static function get_active_vendors() {
        return array_values(array_filter(self::get_vendors(), function($row) {
            return !empty($row['active']) && (string) $row['active'] === '1' && !empty($row['code']);
        }));
    }

    protected static function get_inactive_vendors() {
    return array_values(array_filter(self::get_vendors(), function($row) {
        return (empty($row['active']) || (string) $row['active'] !== '1') && !empty($row['code']);
    }));
}

    protected static function get_active_warehouse_codes() {
        return array_values(array_map(function($row) {
            return (string) $row['code'];
        }, self::get_active_warehouses()));
    }

    protected static function get_active_vendor_codes() {
        return array_values(array_map(function($row) {
            return (string) $row['code'];
        }, self::get_active_vendors()));
    }

    public static function is_storefront_multipackage_mode_enabled() {
        $value = get_option(self::OPTION_STOREFRONT_MULTIPACKAGE_MODE, '');

        if ($value === '') {
            $legacy = get_option(self::OPTION_LEGACY_MULTIPACKAGE_MODE, 'no');
            return $legacy === 'yes';
        }

        return $value === 'yes';
    }

    public static function is_admin_multishipment_mode_enabled() {
        $value = get_option(self::OPTION_ADMIN_MULTISHIPMENT_MODE, '');

        if ($value === '') {
            $legacy = get_option(self::OPTION_LEGACY_MULTIPACKAGE_MODE, 'no');
            return $legacy === 'yes';
        }

        return $value === 'yes';
    }

    public static function is_single_variation_direct_add_enabled() {
        return get_option(self::OPTION_SINGLE_VARIATION_DIRECT_ADD, 'no') === 'yes';
    }

    public static function is_frontend_notice_suppression_enabled() {
        return get_option(self::OPTION_SUPPRESS_FRONTEND_MARKETPLACE_NOTICES, 'no') === 'yes';
    }

    protected static function is_marketplace_notice_message($message) {
        if (!is_string($message) || $message === '') {
            return false;
        }

        $needles = array(
            'Shippo Shipping:',
            'RatedShipmentAlert:',
            'Your invoice may vary from the displayed reference rates',
            'A Delivery Area surcharge has been added to the service cost.',
            'Coupon code applied successfully.',
            'coupon code applied successfully.',
            'Coupon applied successfully.',
            'coupon applied successfully.',
        );

        foreach ($needles as $needle) {
            if (strpos($message, $needle) !== false) {
                return true;
            }
        }

        return false;
    }

    protected static function purge_marketplace_notices_from_session() {
        if (!function_exists('wc_clear_notices') || !function_exists('wc_get_notices') || !function_exists('wc_set_notices')) {
            return;
        }

        $all_notices = wc_get_notices();

        if (empty($all_notices) || !is_array($all_notices)) {
            return;
        }

        foreach ($all_notices as $notice_type => $notices) {
            if (!is_array($notices)) {
                continue;
            }

            $filtered = array();

            foreach ($notices as $notice) {
                $notice_text = '';

                if (is_array($notice) && isset($notice['notice'])) {
                    $notice_text = (string) $notice['notice'];
                } elseif (is_string($notice)) {
                    $notice_text = $notice;
                }

                if (self::is_marketplace_notice_message($notice_text)) {
                    continue;
                }

                $filtered[] = $notice;
            }

            $all_notices[$notice_type] = $filtered;
        }

        wc_clear_notices();

        foreach ($all_notices as $notice_type => $notices) {
            if (empty($notices) || !is_array($notices)) {
                continue;
            }

            foreach ($notices as $notice) {
                if (is_array($notice) && isset($notice['notice'])) {
                    wc_add_notice($notice['notice'], $notice_type, isset($notice['data']) && is_array($notice['data']) ? $notice['data'] : array());
                } elseif (is_string($notice) && $notice !== '') {
                    wc_add_notice($notice, $notice_type);
                }
            }
        }
    }

    public static function maybe_suppress_frontend_marketplace_notices() {
        if (is_admin()) {
            return;
        }

        if (!self::is_frontend_notice_suppression_enabled()) {
            return;
        }

        remove_action('woocommerce_before_shop_loop', 'woocommerce_output_all_notices', 10);
        remove_action('woocommerce_before_single_product', 'woocommerce_output_all_notices', 10);
        remove_action('woocommerce_before_cart', 'woocommerce_output_all_notices', 10);
        remove_action('woocommerce_before_checkout_form_cart_notices', 'woocommerce_output_all_notices', 10);
        remove_action('woocommerce_before_checkout_form', 'woocommerce_output_all_notices', 10);
        remove_action('woocommerce_before_customer_login_form', 'woocommerce_output_all_notices', 10);

        self::purge_marketplace_notices_from_session();
    }

    public static function filter_frontend_marketplace_notice_message($message) {
        if (is_admin()) {
            return $message;
        }

        if (!self::is_frontend_notice_suppression_enabled()) {
            return $message;
        }

        if (!is_string($message) || $message === '') {
            return $message;
        }

        $generic_notice_needles = array(
            'Coupon code applied successfully.',
            'coupon code applied successfully.',
            'Coupon applied successfully.',
            'coupon applied successfully.',
        );

        foreach ($generic_notice_needles as $needle) {
            if (strpos($message, $needle) !== false) {
                return false;
            }
        }

        if (self::is_marketplace_notice_message($message)) {
            return false;
        }

        return $message;
    }

    public static function filter_add_to_cart_message_html($message, $products) {
        if (is_admin()) {
            return $message;
        }

        if (!self::is_frontend_notice_suppression_enabled()) {
            return $message;
        }

        return '';
    }

    public static function is_multipackage_mode_enabled() {
        return self::is_storefront_multipackage_mode_enabled();
    }

    protected static function get_next_sequential_code($prefix, array $rows) {
        $max = 0;

        foreach ($rows as $row) {
            $code = isset($row['code']) ? (string) $row['code'] : '';
            if (preg_match('/^' . preg_quote($prefix, '/') . '(\d+)$/', $code, $matches)) {
                $num = (int) $matches[1];
                if ($num > $max) {
                    $max = $num;
                }
            }
        }

        if ($max < 1) {
            return $prefix . '1';
        }

        return $prefix . ($max + 1);
    }

    protected static function sanitize_record_flag($value) {
        return !empty($value) && (string) $value === '1' ? '1' : '0';
    }

        protected static function find_record_by_code(array $rows, $code) {
        foreach ($rows as $index => $row) {
            if (!empty($row['code']) && (string) $row['code'] === (string) $code) {
                return array(
                    'index'  => $index,
                    'record' => $row,
                );
            }
        }

        return null;
    }

    protected static function get_warehouse_record_by_code($code) {
        $code = sanitize_text_field((string) $code);

        foreach (self::get_active_warehouses() as $row) {
            if (!empty($row['code']) && (string) $row['code'] === $code) {
                return $row;
            }
        }

        return null;
    }

    protected static function get_vendor_record_by_code($code) {
        $code = sanitize_text_field((string) $code);

        foreach (self::get_vendors() as $row) {
            if (!empty($row['code']) && (string) $row['code'] === $code) {
                return $row;
            }
        }

        return null;
    }

    protected static function warehouse_is_assigned_to_lane($warehouse_code, array $lanes) {
        $warehouse_code = sanitize_text_field((string) $warehouse_code);

        foreach (array('batch', 'immediate') as $lane_key) {
            $assigned = isset($lanes[$lane_key]['warehouse_codes']) && is_array($lanes[$lane_key]['warehouse_codes'])
                ? $lanes[$lane_key]['warehouse_codes']
                : array();

            if (in_array($warehouse_code, $assigned, true)) {
                return true;
            }
        }

        return false;
    }

    protected static function vendor_is_assigned_to_external_lane($vendor_code, array $lanes) {
        $vendor_code = sanitize_text_field((string) $vendor_code);

        $assigned = isset($lanes['external']['vendor_codes']) && is_array($lanes['external']['vendor_codes'])
            ? $lanes['external']['vendor_codes']
            : array();

        return in_array($vendor_code, $assigned, true);
    }

    protected static function get_main_warehouse_row() {
        $settings = self::get_shipper_settings();

        return array(
            'code'        => 'headquarters',
            'name'        => 'Main Warehouse',
            'address1'    => isset($settings['street1']) ? (string) $settings['street1'] : '',
            'address2'    => isset($settings['street2']) ? (string) $settings['street2'] : '',
            'city'        => isset($settings['city']) ? (string) $settings['city'] : '',
            'state'       => isset($settings['state']) ? (string) $settings['state'] : '',
            'postal_code' => isset($settings['zip']) ? (string) $settings['zip'] : '',
            'country'     => isset($settings['country']) ? (string) $settings['country'] : '',
            'phone'       => isset($settings['phone']) ? (string) $settings['phone'] : '',
            'email'       => isset($settings['email']) ? (string) $settings['email'] : '',
            'active'      => '1',
            'is_main'     => true,
        );
    }

    protected static function get_admin_page_url($slug, array $args = array()) {
        $args = array_merge(array('page' => $slug), $args);
        return add_query_arg($args, admin_url('admin.php'));
    }

    protected static function render_row_action_link($action, $label, $args = array(), $class = '') {
        $url = wp_nonce_url(
            add_query_arg($args, admin_url('admin-post.php?action=' . $action)),
            $action
        );

        return '<a class="' . esc_attr($class) . '" href="' . esc_url($url) . '">' . esc_html($label) . '</a>';
    }

    protected static function sanitize_warehouse_record($input, $code) {
        $input = is_array($input) ? $input : array();

        return array(
            'code'         => sanitize_text_field($code),
            'active'       => self::sanitize_record_flag($input['active'] ?? '0'),
            'name'         => sanitize_text_field($input['name'] ?? ''),
            'address1'     => sanitize_text_field($input['address1'] ?? ''),
            'address2'     => sanitize_text_field($input['address2'] ?? ''),
            'city'         => sanitize_text_field($input['city'] ?? ''),
            'state'        => sanitize_text_field($input['state'] ?? ''),
            'postal_code'  => sanitize_text_field($input['postal_code'] ?? ''),
            'country'      => strtoupper(preg_replace('/[^A-Z]/', '', (string) ($input['country'] ?? ''))),
            'phone'        => sanitize_text_field($input['phone'] ?? ''),
            'email'        => sanitize_email($input['email'] ?? ''),
        );
    }

    protected static function sanitize_vendor_record($input, $code) {
        $input = is_array($input) ? $input : array();

        return array(
            'code'              => sanitize_text_field($code),
            'active'            => self::sanitize_record_flag($input['active'] ?? '0'),
            'company_name'      => sanitize_text_field($input['company_name'] ?? ''),
            'contact'           => sanitize_text_field($input['contact'] ?? ''),
            'address1'          => sanitize_text_field($input['address1'] ?? ''),
            'address2'          => sanitize_text_field($input['address2'] ?? ''),
            'city'              => sanitize_text_field($input['city'] ?? ''),
            'state'             => sanitize_text_field($input['state'] ?? ''),
            'postal_code'       => sanitize_text_field($input['postal_code'] ?? ''),
            'country'           => strtoupper(preg_replace('/[^A-Z]/', '', (string) ($input['country'] ?? ''))),
            'phone'             => sanitize_text_field($input['phone'] ?? ''),
            'email'             => sanitize_email($input['email'] ?? ''),
            'shipping_class_id' => absint($input['shipping_class_id'] ?? 0),
            'image_id'          => absint($input['image_id'] ?? 0),
            'shipping_memo'     => isset($input['shipping_memo']) ? wp_kses_post($input['shipping_memo']) : '',
            'terms_memo'        => isset($input['terms_memo']) ? wp_kses_post($input['terms_memo']) : '',
        );
    }

public static function sanitize_warehouses_settings($input) {
    $request_action = isset($_POST['action']) ? sanitize_text_field(wp_unslash($_POST['action'])) : '';

    if (in_array($request_action, array('ssb_save_warehouse', 'ssb_delete_warehouse'), true)) {
        return is_array($input) ? array_values($input) : array();
    }

    if (!is_array($input)) {
        return self::get_warehouses();
    }

    $existing = self::get_warehouses();
    $sanitized = array();

    foreach ($existing as $row) {
        if (empty($row['code'])) {
            continue;
        }

        $code = (string) $row['code'];

        if (isset($input[$code]) && is_array($input[$code])) {
            $updated = self::sanitize_warehouse_record($input[$code], $code);
            $updated['active'] = isset($row['active']) ? $row['active'] : '0';
            $sanitized[] = $updated;
        } else {
            $sanitized[] = $row;
        }
    }

    return array_values($sanitized);
}

public static function sanitize_vendors_settings($input) {
    $request_action = isset($_POST['action']) ? sanitize_text_field(wp_unslash($_POST['action'])) : '';

    if (in_array($request_action, array('ssb_save_vendor', 'ssb_delete_vendor'), true)) {
        return is_array($input) ? array_values($input) : array();
    }

    if (!is_array($input)) {
        return self::get_vendors();
    }

    $existing = self::get_vendors();
    $sanitized = array();

    foreach ($existing as $row) {
        if (empty($row['code'])) {
            continue;
        }

        $code = (string) $row['code'];

        if (isset($input[$code]) && is_array($input[$code])) {
            $updated = self::sanitize_vendor_record($input[$code], $code);
            $updated['active'] = isset($row['active']) ? $row['active'] : '0';
            $sanitized[] = $updated;
        } else {
            $sanitized[] = $row;
        }
    }

    return array_values($sanitized);
}

public static function sanitize_fulfillment_lanes_settings($input) {
    $existing = get_option(self::OPTION_FULFILLMENT_LANES, array());
    $existing = is_array($existing) ? $existing : array();

    if (!is_array($input)) {
        return $existing;
    }

    $merged = array_replace_recursive($existing, $input);

    $valid_warehouse_codes = self::get_active_warehouse_codes();
    $valid_vendor_codes    = array_values(array_map(function($row) {
    return isset($row['code']) ? (string) $row['code'] : '';
}, self::get_vendors()));

$valid_vendor_codes = array_values(array_filter($valid_vendor_codes));

    $normalize_lane = function($lane_key) use ($merged, $valid_warehouse_codes, $valid_vendor_codes) {
        $raw = isset($merged[$lane_key]) && is_array($merged[$lane_key]) ? $merged[$lane_key] : array();

        $shipping_classes = isset($raw['shipping_classes']) && is_array($raw['shipping_classes'])
            ? array_values(array_unique(array_map('absint', $raw['shipping_classes'])))
            : array();

        $customer_shipping_message = isset($raw['customer_shipping_message'])
            ? sanitize_textarea_field($raw['customer_shipping_message'])
            : '';

        $warehouse_codes = isset($raw['warehouse_codes']) && is_array($raw['warehouse_codes'])
            ? array_values(array_unique(array_map('sanitize_text_field', $raw['warehouse_codes'])))
            : array();

        $warehouse_codes = array_values(array_filter($warehouse_codes, function($code) use ($valid_warehouse_codes) {
            return in_array((string) $code, $valid_warehouse_codes, true);
        }));

        $vendor_codes = isset($raw['vendor_codes']) && is_array($raw['vendor_codes'])
            ? array_values(array_unique(array_map('sanitize_text_field', $raw['vendor_codes'])))
            : array();

        $vendor_codes = array_values(array_filter($vendor_codes, function($code) use ($valid_vendor_codes) {
            return in_array((string) $code, $valid_vendor_codes, true);
        }));

        return array(
            'shipping_classes'          => $shipping_classes,
            'customer_shipping_message' => $customer_shipping_message,
            'warehouse_codes'           => in_array($lane_key, array('batch', 'immediate'), true) ? $warehouse_codes : array(),
            'vendor_codes'              => $lane_key === 'external' ? $vendor_codes : array(),
        );
    };

    return array(
        'batch'     => $normalize_lane('batch'),
        'immediate' => $normalize_lane('immediate'),
        'external'  => $normalize_lane('external'),
    );
}

    public static function handle_save_warehouse() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized.');
        }

        check_admin_referer('ssb_save_warehouse');

        $rows = self::get_warehouses();
        $edit_code = isset($_POST['edit_code']) ? sanitize_text_field($_POST['edit_code']) : '';

        if ($edit_code !== '') {
            $found = self::find_record_by_code($rows, $edit_code);

            if (!$found) {
                wp_safe_redirect(admin_url('admin.php?page=ssb-warehouses'));
                exit;
            }

            $existing = $found['record'];
            $record = self::sanitize_warehouse_record($_POST['warehouse'] ?? array(), $existing['code']);
            $record['active'] = isset($existing['active']) ? $existing['active'] : '0';
            $rows[$found['index']] = $record;
        } else {
            $code = self::get_next_sequential_code('warehouse_', $rows);
            $record = self::sanitize_warehouse_record($_POST['warehouse'] ?? array(), $code);
            $record['active'] = '0';
            $rows[] = $record;
        }

        update_option(self::OPTION_WAREHOUSES, array_values($rows), false);

        wp_safe_redirect(admin_url('admin.php?page=ssb-warehouses'));
        exit;
    }

    public static function handle_save_vendor() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized.');
        }

        check_admin_referer('ssb_save_vendor');

        $rows = self::get_vendors();
        $edit_code = isset($_POST['edit_code']) ? sanitize_text_field($_POST['edit_code']) : '';

        if ($edit_code !== '') {
            $found = self::find_record_by_code($rows, $edit_code);

            if (!$found) {
                wp_safe_redirect(admin_url('admin.php?page=ssb-vendors'));
                exit;
            }

            $existing = $found['record'];
            $record = self::sanitize_vendor_record($_POST['vendor'] ?? array(), $existing['code']);
            $record['active'] = isset($existing['active']) ? $existing['active'] : '0';
            $rows[$found['index']] = $record;
        } else {
            $code = self::get_next_sequential_code('vendor_', $rows);
            $record = self::sanitize_vendor_record($_POST['vendor'] ?? array(), $code);
            $record['active'] = '0';
            $rows[] = $record;
        }

        update_option(self::OPTION_VENDORS, array_values($rows), false);

        wp_safe_redirect(admin_url('admin.php?page=ssb-vendors'));
        exit;
    }

        public static function handle_toggle_warehouse_active() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized.');
        }

        check_admin_referer('ssb_toggle_warehouse_active');

        wp_safe_redirect(admin_url('admin.php?page=ssb-warehouses'));
        exit;
    }

    public static function handle_toggle_vendor_active() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized.');
        }

        check_admin_referer('ssb_toggle_vendor_active');

        wp_safe_redirect(admin_url('admin.php?page=ssb-vendors'));
        exit;
    }

    public static function handle_delete_warehouse() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized.');
        }

        check_admin_referer('ssb_delete_warehouse');

        $code = isset($_GET['code']) ? sanitize_text_field($_GET['code']) : '';
        $rows = self::get_warehouses();
        array_unshift($rows, self::get_main_warehouse_row());

        $rows = array_values(array_filter($rows, function($row) use ($code) {
            return empty($row['code']) || (string) $row['code'] !== (string) $code;
        }));

        update_option(self::OPTION_WAREHOUSES, $rows, false);

        wp_safe_redirect(admin_url('admin.php?page=ssb-warehouses'));
        exit;
    }

    public static function get_fulfillment_lanes_runtime() {
    return (array) self::get_fulfillment_lanes();
    }

    public static function get_vendors_runtime() {
        return (array) self::get_vendors();
    }

    public static function handle_delete_vendor() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized.');
        }

        check_admin_referer('ssb_delete_vendor');

        $code = isset($_GET['code']) ? sanitize_text_field($_GET['code']) : '';
        $rows = self::get_vendors();

        $rows = array_values(array_filter($rows, function($row) use ($code) {
            return empty($row['code']) || (string) $row['code'] !== (string) $code;
        }));

        update_option(self::OPTION_VENDORS, $rows, false);

        wp_safe_redirect(admin_url('admin.php?page=ssb-vendors'));
        exit;
    }

    public static function handle_save_memos() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized.');
        }

        check_admin_referer('ssb_save_memos');

        update_option(self::OPTION_MEMO_SHIPPING_RETURNS, isset($_POST['ssb_memo_shipping_returns']) ? wp_kses_post(wp_unslash($_POST['ssb_memo_shipping_returns'])) : '', false);
        update_option(self::OPTION_MEMO_TERMS_PRIVACY, isset($_POST['ssb_memo_terms_privacy']) ? wp_kses_post(wp_unslash($_POST['ssb_memo_terms_privacy'])) : '', false);
        update_option(self::OPTION_MEMO_ADDITIONAL_INFORMATION, isset($_POST['ssb_memo_additional_information']) ? wp_kses_post(wp_unslash($_POST['ssb_memo_additional_information'])) : '', false);
        update_option(self::OPTION_PRODUCT_MEMO_1, isset($_POST['ssb_product_memo_1']) ? wp_kses_post(wp_unslash($_POST['ssb_product_memo_1'])) : '', false);
        update_option(self::OPTION_PRODUCT_MEMO_2, isset($_POST['ssb_product_memo_2']) ? wp_kses_post(wp_unslash($_POST['ssb_product_memo_2'])) : '', false);
        update_option(self::OPTION_PRODUCT_MEMO_3, isset($_POST['ssb_product_memo_3']) ? wp_kses_post(wp_unslash($_POST['ssb_product_memo_3'])) : '', false);
        update_option(self::OPTION_PRODUCT_MEMO_4, isset($_POST['ssb_product_memo_4']) ? wp_kses_post(wp_unslash($_POST['ssb_product_memo_4'])) : '', false);
        update_option(self::OPTION_PRODUCT_MEMO_5, isset($_POST['ssb_product_memo_5']) ? wp_kses_post(wp_unslash($_POST['ssb_product_memo_5'])) : '', false);

        update_option(self::OPTION_MEMO_PREFER_VENDOR_SHIPPING, !empty($_POST['ssb_memo_prefer_vendor_shipping']) ? 'yes' : 'no', false);
        update_option(self::OPTION_MEMO_PREFER_VENDOR_TERMS, !empty($_POST['ssb_memo_prefer_vendor_terms']) ? 'yes' : 'no', false);

        wp_safe_redirect(add_query_arg(
            array(
                'page' => 'ssb-memos',
                'ssb_memo_notice' => 'saved',
            ),
            admin_url('admin.php')
        ));
        exit;
    }

        public static function enqueue_records_admin_assets($hook_suffix) {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }

        $page = isset($_GET['page']) ? sanitize_text_field($_GET['page']) : '';

        if (!in_array($page, array('ssb-settings', 'ssb-vendors', 'ssb-fulfillment-lanes'), true)) {
            return;
        }

        wp_enqueue_media();

        wp_add_inline_script(
            'jquery-core',
            "
            jQuery(function($){
                function bindMediaPicker(buttonSelector, inputSelector, previewSelector) {
                    $(document).on('click', buttonSelector, function(e){
                        e.preventDefault();

                        var frame = wp.media({
                            title: 'Select Image',
                            button: { text: 'Use this image' },
                            multiple: false,
                            library: { type: 'image' }
                        });

                        frame.on('select', function(){
                            var attachment = frame.state().get('selection').first().toJSON();
                            $(inputSelector).val(attachment.id);
                            $(previewSelector).html('<img src=\"' + attachment.url + '\" style=\"max-width:100%; height:auto; border:1px solid #dcdcde;\" />');
                        });

                        frame.open();
                    });
                }

                bindMediaPicker('#ssb-main-warehouse-logo-1-select', '#ssb_main_warehouse_logo_1', '#ssb-main-warehouse-logo-1-preview');
                bindMediaPicker('#ssb-main-warehouse-logo-2-select', '#ssb_main_warehouse_logo_2', '#ssb-main-warehouse-logo-2-preview');
                bindMediaPicker('#ssb-vendor-image-select', '#vendor_image_id', '#ssb-vendor-image-preview');
            });
            "
        );
    }

        protected static function get_fulfillment_lanes() {
        $stored = get_option(self::OPTION_FULFILLMENT_LANES, array());
        $stored = is_array($stored) ? $stored : array();

        $valid_warehouse_codes = self::get_active_warehouse_codes();
        $valid_vendor_codes    = array_values(array_map(function($row) {
    return isset($row['code']) ? (string) $row['code'] : '';
}, self::get_vendors()));

$valid_vendor_codes = array_values(array_filter($valid_vendor_codes));

        $normalize_lane = function($lane_key) use ($stored, $valid_warehouse_codes, $valid_vendor_codes) {
            $raw = isset($stored[$lane_key]) ? $stored[$lane_key] : array();

            // Backward compatibility: old format stored just an array of term IDs.
            if (is_array($raw) && array_keys($raw) === range(0, count($raw) - 1)) {
                $raw = array(
                    'shipping_classes'          => array_values(array_unique(array_map('absint', $raw))),
                    'customer_shipping_message' => '',
                    'warehouse_codes'           => array(),
                    'vendor_codes'              => array(),
                );
            }

            $raw = is_array($raw) ? $raw : array();

            $shipping_classes = isset($raw['shipping_classes']) && is_array($raw['shipping_classes'])
                ? array_values(array_unique(array_map('absint', $raw['shipping_classes'])))
                : array();

            $customer_shipping_message = isset($raw['customer_shipping_message'])
                ? sanitize_textarea_field($raw['customer_shipping_message'])
                : '';

            $warehouse_codes = isset($raw['warehouse_codes']) && is_array($raw['warehouse_codes'])
                ? array_values(array_unique(array_map('sanitize_text_field', $raw['warehouse_codes'])))
                : array();

            $warehouse_codes = array_values(array_filter($warehouse_codes, function($code) use ($valid_warehouse_codes) {
                return in_array((string) $code, $valid_warehouse_codes, true);
            }));

            $vendor_codes = isset($raw['vendor_codes']) && is_array($raw['vendor_codes'])
                ? array_values(array_unique(array_map('sanitize_text_field', $raw['vendor_codes'])))
                : array();

            $vendor_codes = array_values(array_filter($vendor_codes, function($code) use ($valid_vendor_codes) {
                return in_array((string) $code, $valid_vendor_codes, true);
            }));

            return array(
                'shipping_classes'          => $shipping_classes,
                'customer_shipping_message' => $customer_shipping_message,
                'warehouse_codes'           => in_array($lane_key, array('batch', 'immediate'), true) ? $warehouse_codes : array(),
                'vendor_codes'              => $lane_key === 'external' ? $vendor_codes : array(),
            );
        };

        return array(
            'batch'     => $normalize_lane('batch'),
            'immediate' => $normalize_lane('immediate'),
            'external'  => $normalize_lane('external'),
        );
    }

protected static function save_fulfillment_lanes($lanes) {
    update_option(self::OPTION_FULFILLMENT_LANES, $lanes, false);

    $vendors = self::get_vendors();
    $vendors = is_array($vendors) ? array_values($vendors) : array();

    foreach ($vendors as &$vendor) {
        if (!is_array($vendor) || empty($vendor['code'])) {
            continue;
        }

        $vendor['active'] = self::vendor_is_assigned_to_external_lane((string) $vendor['code'], (array) $lanes) ? '1' : '0';
    }
    unset($vendor);

    update_option(self::OPTION_VENDORS, array_values($vendors), false);
}

    protected static function get_all_shipping_classes_for_mapping() {
        $terms = get_terms(array(
            'taxonomy'   => 'product_shipping_class',
            'hide_empty' => false,
        ));

        if (is_wp_error($terms) || !is_array($terms)) {
            return array();
        }

        return $terms;
    }

    protected static function get_lane_label($lane_key) {
        $labels = array(
            'batch'     => 'Batch Production',
            'immediate' => 'Immediate',
            'external'  => 'External',
        );

        return isset($labels[$lane_key]) ? $labels[$lane_key] : $lane_key;
    }

    protected static function get_lane_note($lane_key) {
        $notes = array(
            'batch'     => 'Intended for production runs with MOQ requirements. Shippo is intentionally blocked from servicing this lane at checkout. Shipping may be collected later and fulfilled after production is complete.',
            'immediate' => 'Intended for normal in-stock warehousing operations. Shippo is active for this lane at checkout and during fulfillment.',
            'external'  => 'Intended for external drop-shipping vendors who handle fulfillment directly. Standard in-house shipping and Shippo behavior are bypassed for this lane.',
        );

        return isset($notes[$lane_key]) ? $notes[$lane_key] : '';
    }

    protected static function find_lane_for_shipping_class($term_id, array $lanes) {
        foreach ($lanes as $lane_key => $lane_config) {
            $term_ids = isset($lane_config['shipping_classes']) && is_array($lane_config['shipping_classes'])
                ? $lane_config['shipping_classes']
                : array();

            if (in_array((int) $term_id, array_map('intval', $term_ids), true)) {
                return $lane_key;
            }
        }

        return '';
    }

    public static function handle_assign_fulfillment_lane_class() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized.');
        }

        check_admin_referer('ssb_assign_fulfillment_lane_class');

        $lane = isset($_POST['lane']) ? sanitize_text_field($_POST['lane']) : '';
        $term_ids = isset($_POST['shipping_class_ids']) && is_array($_POST['shipping_class_ids'])
            ? array_values(array_unique(array_map('absint', $_POST['shipping_class_ids'])))
            : array();

        $valid_lanes = array('batch', 'immediate', 'external');
        if (!in_array($lane, $valid_lanes, true)) {
            wp_safe_redirect(admin_url('admin.php?page=ssb-fulfillment-lanes'));
            exit;
        }

        if (empty($term_ids)) {
            wp_safe_redirect(add_query_arg('ssb_lane_notice', 'none_selected', admin_url('admin.php?page=ssb-fulfillment-lanes')));
            exit;
        }

        $lanes = self::get_fulfillment_lanes();

        foreach ($term_ids as $term_id) {
            $existing_lane = self::find_lane_for_shipping_class($term_id, $lanes);

            if ($existing_lane !== '' && $existing_lane !== $lane) {
                wp_safe_redirect(add_query_arg(
                    array(
                        'page'             => 'ssb-fulfillment-lanes',
                        'ssb_lane_notice'  => 'already_assigned',
                    ),
                    admin_url('admin.php')
                ));
                exit;
            }
        }

        $existing_ids = isset($lanes[$lane]['shipping_classes']) && is_array($lanes[$lane]['shipping_classes'])
            ? $lanes[$lane]['shipping_classes']
            : array();

        $lanes[$lane]['shipping_classes'] = array_values(array_unique(array_merge($existing_ids, $term_ids)));
        self::save_fulfillment_lanes($lanes);

        wp_safe_redirect(admin_url('admin.php?page=ssb-fulfillment-lanes'));
        exit;
    }

    public static function handle_remove_fulfillment_lane_class() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized.');
        }

        check_admin_referer('ssb_remove_fulfillment_lane_class');

        $lane = isset($_GET['lane']) ? sanitize_text_field($_GET['lane']) : '';
        $term_id = isset($_GET['term_id']) ? absint($_GET['term_id']) : 0;

        $valid_lanes = array('batch', 'immediate', 'external');
        if (!in_array($lane, $valid_lanes, true) || $term_id < 1) {
            wp_safe_redirect(admin_url('admin.php?page=ssb-fulfillment-lanes'));
            exit;
        }

        $lanes = self::get_fulfillment_lanes();
        $existing_ids = isset($lanes[$lane]['shipping_classes']) && is_array($lanes[$lane]['shipping_classes'])
            ? $lanes[$lane]['shipping_classes']
            : array();

        $lanes[$lane]['shipping_classes'] = array_values(array_filter($existing_ids, function($id) use ($term_id) {
            return (int) $id !== (int) $term_id;
        }));

        if (in_array($lane, array('batch', 'immediate'), true) && !isset($lanes[$lane]['warehouse_codes'])) {
            $lanes[$lane]['warehouse_codes'] = array();
        }

        self::save_fulfillment_lanes($lanes);

        wp_safe_redirect(admin_url('admin.php?page=ssb-fulfillment-lanes'));
        exit;
    }

    public static function handle_assign_fulfillment_lane_warehouse() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized.');
        }

        check_admin_referer('ssb_assign_fulfillment_lane_warehouse');

        $lane = isset($_POST['lane']) ? sanitize_text_field(wp_unslash($_POST['lane'])) : '';
        $warehouse_code = isset($_POST['warehouse_code']) ? sanitize_text_field(wp_unslash($_POST['warehouse_code'])) : '';

        if (!in_array($lane, array('batch', 'immediate'), true)) {
            wp_safe_redirect(admin_url('admin.php?page=ssb-fulfillment-lanes'));
            exit;
        }

        if ($warehouse_code === '' || !self::get_warehouse_record_by_code($warehouse_code)) {
            wp_safe_redirect(add_query_arg(
                array(
                    'page' => 'ssb-fulfillment-lanes',
                    'ssb_lane_notice' => 'warehouse_invalid',
                ),
                admin_url('admin.php')
            ));
            exit;
        }

        $lanes = self::get_fulfillment_lanes();
        $existing_codes = isset($lanes[$lane]['warehouse_codes']) && is_array($lanes[$lane]['warehouse_codes'])
            ? $lanes[$lane]['warehouse_codes']
            : array();

        $existing_codes[] = $warehouse_code;
        $lanes[$lane]['warehouse_codes'] = array_values(array_unique(array_map('sanitize_text_field', $existing_codes)));

        self::save_fulfillment_lanes($lanes);

        wp_safe_redirect(add_query_arg(
            array(
                'page' => 'ssb-fulfillment-lanes',
                'ssb_lane_notice' => 'lane_saved',
            ),
            admin_url('admin.php')
        ));
        exit;
    }

    public static function handle_remove_fulfillment_lane_warehouse() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized.');
        }

        check_admin_referer('ssb_remove_fulfillment_lane_warehouse');

        $lane = isset($_GET['lane']) ? sanitize_text_field($_GET['lane']) : '';
        $warehouse_code = isset($_GET['warehouse_code']) ? sanitize_text_field($_GET['warehouse_code']) : '';

        if (!in_array($lane, array('batch', 'immediate'), true) || $warehouse_code === '') {
            wp_safe_redirect(admin_url('admin.php?page=ssb-fulfillment-lanes'));
            exit;
        }

        $lanes = self::get_fulfillment_lanes();
        $existing_codes = isset($lanes[$lane]['warehouse_codes']) && is_array($lanes[$lane]['warehouse_codes'])
            ? $lanes[$lane]['warehouse_codes']
            : array();

        $lanes[$lane]['warehouse_codes'] = array_values(array_filter($existing_codes, function($code) use ($warehouse_code) {
            return (string) $code !== (string) $warehouse_code;
        }));

        self::save_fulfillment_lanes($lanes);

        wp_safe_redirect(add_query_arg(
            array(
                'page' => 'ssb-fulfillment-lanes',
                'ssb_lane_notice' => 'lane_saved',
            ),
            admin_url('admin.php')
        ));
        exit;
    }

        public static function handle_assign_fulfillment_lane_vendor() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized.');
        }

        check_admin_referer('ssb_assign_fulfillment_lane_vendor');

        $lane = isset($_POST['lane']) ? sanitize_text_field(wp_unslash($_POST['lane'])) : '';
        $vendor_code = isset($_POST['vendor_code']) ? sanitize_text_field(wp_unslash($_POST['vendor_code'])) : '';

        if ($lane !== 'external') {
            wp_safe_redirect(admin_url('admin.php?page=ssb-fulfillment-lanes'));
            exit;
        }

        if ($vendor_code === '' || !self::get_vendor_record_by_code($vendor_code)) {
            wp_safe_redirect(add_query_arg(
                array(
                    'page' => 'ssb-fulfillment-lanes',
                    'ssb_lane_notice' => 'vendor_invalid',
                ),
                admin_url('admin.php')
            ));
            exit;
        }

        $lanes = self::get_fulfillment_lanes();
        $existing_codes = isset($lanes[$lane]['vendor_codes']) && is_array($lanes[$lane]['vendor_codes'])
            ? $lanes[$lane]['vendor_codes']
            : array();

        $existing_codes[] = $vendor_code;
        $lanes[$lane]['vendor_codes'] = array_values(array_unique(array_map('sanitize_text_field', $existing_codes)));

        self::save_fulfillment_lanes($lanes);

        wp_safe_redirect(add_query_arg(
            array(
                'page' => 'ssb-fulfillment-lanes',
                'ssb_lane_notice' => 'lane_saved',
            ),
            admin_url('admin.php')
        ));
        exit;
    }

    public static function handle_remove_fulfillment_lane_vendor() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized.');
        }

        check_admin_referer('ssb_remove_fulfillment_lane_vendor');

        $lane = isset($_GET['lane']) ? sanitize_text_field($_GET['lane']) : '';
        $vendor_code = isset($_GET['vendor_code']) ? sanitize_text_field($_GET['vendor_code']) : '';

        if ($lane !== 'external' || $vendor_code === '') {
            wp_safe_redirect(admin_url('admin.php?page=ssb-fulfillment-lanes'));
            exit;
        }

        $lanes = self::get_fulfillment_lanes();
        $existing_codes = isset($lanes[$lane]['vendor_codes']) && is_array($lanes[$lane]['vendor_codes'])
            ? $lanes[$lane]['vendor_codes']
            : array();

        $lanes[$lane]['vendor_codes'] = array_values(array_filter($existing_codes, function($code) use ($vendor_code) {
            return (string) $code !== (string) $vendor_code;
        }));

        self::save_fulfillment_lanes($lanes);

        wp_safe_redirect(add_query_arg(
            array(
                'page' => 'ssb-fulfillment-lanes',
                'ssb_lane_notice' => 'lane_saved',
            ),
            admin_url('admin.php')
        ));
        exit;
    }

        public static function render_memos_page() {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }

        $notice = isset($_GET['ssb_memo_notice']) ? sanitize_text_field($_GET['ssb_memo_notice']) : '';

        $shipping_returns = (string) get_option(self::OPTION_MEMO_SHIPPING_RETURNS, '');
        $terms_privacy = (string) get_option(self::OPTION_MEMO_TERMS_PRIVACY, '');
        $additional_information = (string) get_option(self::OPTION_MEMO_ADDITIONAL_INFORMATION, '');
        $product_memo_1 = (string) get_option(self::OPTION_PRODUCT_MEMO_1, '');
        $product_memo_2 = (string) get_option(self::OPTION_PRODUCT_MEMO_2, '');
        $product_memo_3 = (string) get_option(self::OPTION_PRODUCT_MEMO_3, '');
        $product_memo_4 = (string) get_option(self::OPTION_PRODUCT_MEMO_4, '');
        $product_memo_5 = (string) get_option(self::OPTION_PRODUCT_MEMO_5, '');

        $prefer_vendor_shipping = get_option(self::OPTION_MEMO_PREFER_VENDOR_SHIPPING, 'no') === 'yes';
        $prefer_vendor_terms = get_option(self::OPTION_MEMO_PREFER_VENDOR_TERMS, 'no') === 'yes';
        ?>
        <div class="wrap">
            <h1 class="wp-heading-inline">Product Memos</h1>
            <hr class="wp-header-end">

            <?php if ($notice === 'saved') : ?>
                <div class="notice notice-success inline">
                    <p>Memos saved.</p>
                </div>
            <?php endif; ?>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="ssb_save_memos">
                <?php wp_nonce_field('ssb_save_memos'); ?>

                <div style="background:#fff; border:1px solid #dcdcde; padding:20px; margin:0 0 20px;">
                    <h2 style="margin-top:0;">Shipping &amp; Returns</h2>
                    <p class="description" style="margin-bottom:8px;">
    Use <code>[shoshin_memo type="shipping_returns"]</code> in your product page layout. Optional vendor tags: <code>[shoshin_vendor_name]</code> <code>[shoshin_vendor_image]</code> <code>[shoshin_vendor_note type="shipping_returns"]</code>
</p>
                    <textarea name="ssb_memo_shipping_returns" rows="8" class="large-text"><?php echo esc_textarea($shipping_returns); ?></textarea>
                    <p style="margin-top:12px;">
                        <label>
                            <input type="checkbox" name="ssb_memo_prefer_vendor_shipping" value="1" <?php checked($prefer_vendor_shipping); ?>>
                            Prefer vendor-specific Shipping &amp; Returns memo when available
                        </label>
                    </p>
                </div>

                <div style="background:#fff; border:1px solid #dcdcde; padding:20px; margin:0 0 20px;">
                    <h2 style="margin-top:0;">Terms &amp; Privacy</h2>
                    <p class="description" style="margin-bottom:8px;">
                        Use <code>[shoshin_memo type="terms_privacy"]</code> in your product page layout. Optional vendor tags: <code>[shoshin_vendor_name]</code> <code>[shoshin_vendor_image]</code> <code>[shoshin_vendor_note type="terms_privacy"]</code>
                    </p>
                    <textarea name="ssb_memo_terms_privacy" rows="8" class="large-text"><?php echo esc_textarea($terms_privacy); ?></textarea>
                    <p style="margin-top:12px;">
                        <label>
                            <input type="checkbox" name="ssb_memo_prefer_vendor_terms" value="1" <?php checked($prefer_vendor_terms); ?>>
                            Prefer vendor-specific Terms &amp; Privacy memo when available
                        </label>
                    </p>
                </div>

                                <div style="background:#fff; border:1px solid #dcdcde; padding:20px; margin:0 0 20px;">
                    <h2 style="margin-top:0;">Additional Information</h2>
                    <p class="description" style="margin-bottom:8px;">
                        Use <code>[shoshin_memo type="additional_information"]</code> in your product page layout. Optional vendor tags: <code>[shoshin_vendor_name]</code> <code>[shoshin_vendor_image]</code>
                    </p>
                    <textarea name="ssb_memo_additional_information" rows="8" class="large-text"><?php echo esc_textarea($additional_information); ?></textarea>
                </div>

                <div style="background:#fff; border:1px solid #dcdcde; padding:20px; margin:0 0 20px;">
                    <h2 style="margin-top:0;">Product Memos</h2>
                    <p class="description" style="margin-bottom:12px;">
                        Use these reusable memo templates for product-specific Additional Information. When selected in the Advanced tab of a product, they will override the Global Additional Information memo on the product page. Optional vendor tags: <code>[shoshin_vendor_name]</code> <code>[shoshin_vendor_image]</code> <code>[shoshin_vendor_note type="shipping_returns"]</code> <code>[shoshin_vendor_note type="terms_privacy"]</code>
                    </p>

                    <p style="margin:16px 0 6px;"><strong style="font-size:13px;">Product Memo 1</strong></p>
                    <textarea name="ssb_product_memo_1" rows="8" class="large-text"><?php echo esc_textarea($product_memo_1); ?></textarea>

                    <p style="margin:16px 0 6px;"><strong style="font-size:13px;">Product Memo 2</strong></p>
                    <textarea name="ssb_product_memo_2" rows="8" class="large-text"><?php echo esc_textarea($product_memo_2); ?></textarea>

                    <p style="margin:16px 0 6px;"><strong style="font-size:13px;">Product Memo 3</strong></p>
                    <textarea name="ssb_product_memo_3" rows="8" class="large-text"><?php echo esc_textarea($product_memo_3); ?></textarea>

                    <p style="margin:16px 0 6px;"><strong style="font-size:13px;">Product Memo 4</strong></p>
                    <textarea name="ssb_product_memo_4" rows="8" class="large-text"><?php echo esc_textarea($product_memo_4); ?></textarea>

                    <p style="margin:16px 0 6px;"><strong style="font-size:13px;">Product Memo 5</strong></p>
                    <textarea name="ssb_product_memo_5" rows="8" class="large-text"><?php echo esc_textarea($product_memo_5); ?></textarea>
                </div>

                <?php submit_button('Save Memos'); ?>
            </form>
        </div>
        <?php
    }

    protected static function get_product_vendor_code($product_id) {
        return (string) get_post_meta($product_id, '_shoshin_vendor_code', true);
    }

    protected static function get_product_vendor_record($product_id) {
        $vendor_code = self::get_product_vendor_code($product_id);

        if ($vendor_code === '') {
            return null;
        }

        return self::get_vendor_record_by_code($vendor_code);
    }

    protected static function get_memo_option_value($type) {
        $map = array(
            'shipping_returns'       => self::OPTION_MEMO_SHIPPING_RETURNS,
            'terms_privacy'          => self::OPTION_MEMO_TERMS_PRIVACY,
            'additional_information' => self::OPTION_MEMO_ADDITIONAL_INFORMATION,
        );

        if (!isset($map[$type])) {
            return '';
        }

        return (string) get_option($map[$type], '');
    }

    protected static function get_memo_preference_value($type) {
        $map = array(
            'shipping_returns' => self::OPTION_MEMO_PREFER_VENDOR_SHIPPING,
            'terms_privacy'    => self::OPTION_MEMO_PREFER_VENDOR_TERMS,
        );

        if (!isset($map[$type])) {
            return false;
        }

        return get_option($map[$type], 'no') === 'yes';
    }

    protected static function resolve_product_memo_content($type, $product_id) {
        $type = (string) $type;
        $product_id = absint($product_id);

        if ($product_id < 1 || $type === '') {
            return '';
        }

        $vendor = self::get_product_vendor_record($product_id);

        if ($type === 'shipping_returns') {
            if (self::get_memo_preference_value('shipping_returns') && !empty($vendor['shipping_memo'])) {
                return (string) $vendor['shipping_memo'];
            }

            return self::get_memo_option_value('shipping_returns');
        }

        if ($type === 'terms_privacy') {
            if (self::get_memo_preference_value('terms_privacy') && !empty($vendor['terms_memo'])) {
                return (string) $vendor['terms_memo'];
            }

            return self::get_memo_option_value('terms_privacy');
        }

        if ($type === 'additional_information') {
            $selected_product_memo = (string) get_post_meta($product_id, '_shoshin_product_memo_key', true);

            $product_memo_map = array(
                'memo_1' => self::OPTION_PRODUCT_MEMO_1,
                'memo_2' => self::OPTION_PRODUCT_MEMO_2,
                'memo_3' => self::OPTION_PRODUCT_MEMO_3,
                'memo_4' => self::OPTION_PRODUCT_MEMO_4,
                'memo_5' => self::OPTION_PRODUCT_MEMO_5,
            );

            if (isset($product_memo_map[$selected_product_memo])) {
                $selected_content = (string) get_option($product_memo_map[$selected_product_memo], '');

                if ($selected_content !== '') {
                    return $selected_content;
                }
            }

            return self::get_memo_option_value('additional_information');
        }

        return '';
    }

    public static function render_product_vendor_admin_field() {
        global $post;

        if (!$post || get_post_type($post) !== 'product') {
            return;
        }

        $product_id = $post->ID;
        $vendor_code = get_post_meta($product_id, '_shoshin_vendor_code', true);
        $vendors = self::get_vendors();

        echo '<div class="options_group">';

        woocommerce_wp_select(array(
            'id'          => '_shoshin_vendor_code',
            'label'       => 'Assigned Vendor',
            'description' => 'Assign a vendor to this product for memo resolution and product-page vendor content.',
            'desc_tip'    => true,
            'value'       => $vendor_code,
            'options'     => array_merge(
                array('' => '— No vendor assigned —'),
                array_reduce($vendors, function($carry, $vendor) {
                    $code = (string) ($vendor['code'] ?? '');
                    $name = (string) ($vendor['company_name'] ?? $code);

                    if ($code !== '') {
                        $carry[$code] = $name;
                    }

                    return $carry;
                }, array())
            ),
        ));

        echo '</div>';
    }

    public static function render_product_memo_admin_fields() {
        global $post;

        if (!$post || get_post_type($post) !== 'product') {
            return;
        }

        $selected_product_memo = (string) get_post_meta($post->ID, '_shoshin_product_memo_key', true);

        echo '<div class="options_group">';

        echo '<p class="form-field"><label>Product Additional Information Source</label></p>';
        echo '<div style="padding:0 9px 12px 162px;">';
        echo '<div style="display:flex; flex-wrap:wrap; gap:10px 24px; align-items:flex-start;">';

        $memo_choices = array(
            ''       => 'None (use global memo)',
            'memo_1' => 'Product Memo 1',
            'memo_2' => 'Product Memo 2',
            'memo_3' => 'Product Memo 3',
            'memo_4' => 'Product Memo 4',
            'memo_5' => 'Product Memo 5',
        );

        foreach ($memo_choices as $memo_key => $memo_label) {
            echo '<label style="display:flex; align-items:flex-start; gap:6px; min-width:180px; margin:0;">';
            echo '<input type="radio" name="_shoshin_product_memo_key" value="' . esc_attr($memo_key) . '" ' . checked($selected_product_memo, $memo_key, false) . ' style="margin:2px 0 0;">';
            echo '<span>' . esc_html($memo_label) . '</span>';
            echo '</label>';
        }

        echo '</div>';
        echo '<p class="description" style="margin:10px 0 0;">Selected Product Memos will override the Global Additional Information memo on the product page.</p>';
        echo '</div>';

        echo '</div>';
    }

    public static function save_product_memo_admin_fields($post_id) {
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }

        if (!current_user_can('edit_product', $post_id)) {
            return;
        }

        if (isset($_POST['_shoshin_vendor_code'])) {
            $vendor_code = sanitize_text_field(wp_unslash($_POST['_shoshin_vendor_code']));

            if ($vendor_code === '') {
                delete_post_meta($post_id, '_shoshin_vendor_code');
            } else {
                update_post_meta($post_id, '_shoshin_vendor_code', $vendor_code);
            }
        }

        if (isset($_POST['_shoshin_product_memo_key'])) {
            $product_memo_key = sanitize_text_field(wp_unslash($_POST['_shoshin_product_memo_key']));
            $allowed_keys = array('', 'memo_1', 'memo_2', 'memo_3', 'memo_4', 'memo_5');

            if (!in_array($product_memo_key, $allowed_keys, true) || $product_memo_key === '') {
                delete_post_meta($post_id, '_shoshin_product_memo_key');
            } else {
                update_post_meta($post_id, '_shoshin_product_memo_key', $product_memo_key);
            }
        }
    }

    public static function render_memo_shortcode($atts) {
        global $product;

        $atts = shortcode_atts(array(
            'type'       => '',
            'product_id' => 0,
        ), $atts, 'shoshin_memo');

        $type = (string) $atts['type'];
        $product_id = absint($atts['product_id']);

        if ($product_id < 1 && $product instanceof WC_Product) {
            $product_id = $product->get_id();
        }

        if ($product_id < 1 || $type === '') {
            return '';
        }

        $content = self::resolve_product_memo_content($type, $product_id);

        if ($content === '') {
            return '';
        }

        return do_shortcode(wp_kses_post($content));
    }

    public static function render_vendor_name_shortcode($atts) {
        global $product;

        $atts = shortcode_atts(array(
            'product_id' => 0,
        ), $atts, 'shoshin_vendor_name');

        $product_id = absint($atts['product_id']);

        if ($product_id < 1 && $product instanceof WC_Product) {
            $product_id = $product->get_id();
        }

        if ($product_id < 1) {
            return '';
        }

        $vendor = self::get_product_vendor_record($product_id);

        if (!$vendor || empty($vendor['company_name'])) {
            return '';
        }

        return esc_html($vendor['company_name']);
    }

    public static function render_vendor_image_shortcode($atts) {
        global $product;

        $atts = shortcode_atts(array(
            'product_id' => 0,
            'size'       => 'medium',
        ), $atts, 'shoshin_vendor_image');

        $product_id = absint($atts['product_id']);

        if ($product_id < 1 && $product instanceof WC_Product) {
            $product_id = $product->get_id();
        }

        if ($product_id < 1) {
            return '';
        }

        $vendor = self::get_product_vendor_record($product_id);

        if (!$vendor || empty($vendor['image_id'])) {
            return '';
        }

        return wp_get_attachment_image(absint($vendor['image_id']), sanitize_key($atts['size']));
    }

    public static function render_vendor_note_shortcode($atts) {
        global $product;

        $atts = shortcode_atts(array(
            'type'       => 'shipping_returns',
            'product_id' => 0,
        ), $atts, 'shoshin_vendor_note');

        $product_id = absint($atts['product_id']);

        if ($product_id < 1 && $product instanceof WC_Product) {
            $product_id = $product->get_id();
        }

        if ($product_id < 1) {
            return '';
        }

        $vendor = self::get_product_vendor_record($product_id);

        if (!$vendor) {
            return '';
        }

        if ($atts['type'] === 'terms_privacy') {
            return !empty($vendor['terms_memo']) ? do_shortcode(wp_kses_post($vendor['terms_memo'])) : '';
        }

        return !empty($vendor['shipping_memo']) ? do_shortcode(wp_kses_post($vendor['shipping_memo'])) : '';
    }

        protected static function get_shortcode_product_context($atts, $tag = '') {
        global $product;

        $atts = is_array($atts) ? $atts : array();
        $product_id = isset($atts['product_id']) ? absint($atts['product_id']) : 0;

        if ($product_id < 1 && $product instanceof WC_Product) {
            return $product;
        }

        if ($product_id > 0) {
            $loaded = wc_get_product($product_id);
            if ($loaded instanceof WC_Product) {
                return $loaded;
            }
        }

        return null;
    }

    protected static function get_product_weight_display($product) {
        if (!$product instanceof WC_Product) {
            return '';
        }

        $raw_weight = $product->get_weight();
        if ($raw_weight === '' || $raw_weight === null) {
            return '';
        }

        $weight_in_grams = (float) wc_get_weight((float) $raw_weight, 'g');
        $weight_in_lbs   = (float) wc_get_weight((float) $raw_weight, 'lbs');

        if ($weight_in_grams <= 0) {
            return '';
        }

        return sprintf(
            '%s g (%s lbs)',
            number_format_i18n($weight_in_grams, 2),
            number_format_i18n($weight_in_lbs, 2)
        );
    }

    protected static function get_product_dimensions_display($product) {
        if (!$product instanceof WC_Product) {
            return '';
        }

        $length = $product->get_length();
        $width  = $product->get_width();
        $height = $product->get_height();

        $has_any_dimension = ($length !== '' && $length !== null) || ($width !== '' && $width !== null) || ($height !== '' && $height !== null);

        if (!$has_any_dimension) {
            return '';
        }

        $parts_mm = array();
        $parts_in = array();

        foreach (array($length, $width, $height) as $dimension_value) {
            if ($dimension_value === '' || $dimension_value === null) {
                continue;
            }

            $mm_value = (float) wc_get_dimension((float) $dimension_value, 'mm');
            $in_value = (float) wc_get_dimension((float) $dimension_value, 'in');

            $parts_mm[] = number_format_i18n($mm_value, 2);
            $parts_in[] = number_format_i18n($in_value, 2);
        }

        if (empty($parts_mm)) {
            return '';
        }

        return sprintf(
            '%s mm (%s in)',
            implode(' × ', $parts_mm),
            implode(' × ', $parts_in)
        );
    }

    protected static function get_product_attribute_display($product, $attribute_key) {
        if (!$product instanceof WC_Product) {
            return '';
        }

        $attribute_key = sanitize_title((string) $attribute_key);
        if ($attribute_key === '') {
            return '';
        }

        $try_keys = array_unique(array(
            $attribute_key,
            'pa_' . $attribute_key,
        ));

        foreach ($try_keys as $try_key) {
            $value = $product->get_attribute($try_key);

            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        return '';
    }

    public static function render_product_weight_row_shortcode($atts) {
        $atts = shortcode_atts(array(
            'label'      => 'Weight',
            'product_id' => 0,
        ), $atts, 'shoshin_product_weight_row');

        $product = self::get_shortcode_product_context($atts, 'shoshin_product_weight_row');
        if (!$product) {
            return '';
        }

        $display = self::get_product_weight_display($product);
        if ($display === '') {
            return '';
        }

        return sprintf(
            '<tr class="woocommerce-product-attributes-item"><th class="woocommerce-product-attributes-item__label">%s</th><td class="woocommerce-product-attributes-item__value">%s</td></tr>',
            esc_html($atts['label']),
            esc_html($display)
        );
    }

    public static function render_product_dimensions_row_shortcode($atts) {
        $atts = shortcode_atts(array(
            'label'      => 'Dimensions',
            'product_id' => 0,
        ), $atts, 'shoshin_product_dimensions_row');

        $product = self::get_shortcode_product_context($atts, 'shoshin_product_dimensions_row');
        if (!$product) {
            return '';
        }

        $display = self::get_product_dimensions_display($product);
        if ($display === '') {
            return '';
        }

        return sprintf(
            '<tr class="woocommerce-product-attributes-item"><th class="woocommerce-product-attributes-item__label">%s</th><td class="woocommerce-product-attributes-item__value">%s</td></tr>',
            esc_html($atts['label']),
            esc_html($display)
        );
    }

    public static function render_product_attribute_row_shortcode($atts) {
        $atts = shortcode_atts(array(
            'key'        => '',
            'label'      => '',
            'product_id' => 0,
        ), $atts, 'shoshin_product_attribute_row');

        $product = self::get_shortcode_product_context($atts, 'shoshin_product_attribute_row');
        if (!$product) {
            return '';
        }

        $attribute_key = sanitize_title((string) $atts['key']);
        if ($attribute_key === '') {
            return '';
        }

        $display = self::get_product_attribute_display($product, $attribute_key);
        if ($display === '') {
            return '';
        }

        $label = trim((string) $atts['label']);
        if ($label === '') {
            $label = ucwords(str_replace(array('pa_', '-', '_'), array('', ' ', ' '), $attribute_key));
        }

        return sprintf(
            '<tr class="woocommerce-product-attributes-item"><th class="woocommerce-product-attributes-item__label">%s</th><td class="woocommerce-product-attributes-item__value">%s</td></tr>',
            esc_html($label),
            esc_html($display)
        );
    }


    public static function render_fulfillment_lanes_page() {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }

        $lanes = self::get_fulfillment_lanes();
        $all_terms = self::get_all_shipping_classes_for_mapping();

        $notice = isset($_GET['ssb_lane_notice']) ? sanitize_text_field($_GET['ssb_lane_notice']) : '';
        ?>
        <div class="wrap">
            <h1 class="wp-heading-inline">Fulfillment Lanes</h1>
            <hr class="wp-header-end">

                        <div class="notice notice-info inline">
                <p>Remember to assign the appropriate WooCommerce Shipping Class to each product on its individual product page.</p>
                <p>Fulfillment lanes become active when at least one valid warehouse or vendor assignment is saved for them. To deactivate a fulfillment lane, remove all assignments.</p>
            </div>

            <?php if ($notice === 'already_assigned') : ?>
                <div class="notice notice-error inline">
                    <p>A selected shipping class is already assigned to another fulfillment lane. Unassign it first before reassigning.</p>
                </div>
            <?php elseif ($notice === 'none_selected') : ?>
                <div class="notice notice-warning inline">
                    <p>Select one or more shipping classes before clicking Assign.</p>
                </div>
            <?php elseif ($notice === 'warehouse_invalid') : ?>
                <div class="notice notice-error inline">
                    <p>Select a valid active warehouse before assigning it to a fulfillment lane.</p>
                </div>
            <?php elseif ($notice === 'vendor_invalid') : ?>
                <div class="notice notice-error inline">
                    <p>Select a valid inactive vendor before assigning it to the External lane.</p>
                </div>
            <?php elseif ($notice === 'lane_saved') : ?>
                <div class="notice notice-success inline">
                    <p>Fulfillment lane settings saved.</p>
                </div>
            <?php endif; ?>

            <?php foreach (array('batch', 'immediate', 'external') as $lane_key) : ?>
                <?php
                $assigned_ids = isset($lanes[$lane_key]['shipping_classes']) && is_array($lanes[$lane_key]['shipping_classes'])
                    ? $lanes[$lane_key]['shipping_classes']
                    : array();

                $customer_shipping_message = isset($lanes[$lane_key]['customer_shipping_message'])
                    ? $lanes[$lane_key]['customer_shipping_message']
                    : '';

                $warehouse_codes = isset($lanes[$lane_key]['warehouse_codes']) && is_array($lanes[$lane_key]['warehouse_codes'])
                    ? $lanes[$lane_key]['warehouse_codes']
                    : array();

                $vendor_codes = isset($lanes[$lane_key]['vendor_codes']) && is_array($lanes[$lane_key]['vendor_codes'])
                    ? $lanes[$lane_key]['vendor_codes']
                    : array();

                $active_warehouses = self::get_active_warehouses();
                $inactive_vendors = self::get_inactive_vendors();

                $available_terms = array_filter($all_terms, function($term) use ($lanes) {
                    $existing_lane = self::find_lane_for_shipping_class($term->term_id, $lanes);
                    return $existing_lane === '';
                });
                ?>
                <div style="background:#fff; border:1px solid #dcdcde; padding:20px; margin:0 0 20px;">
                    <h2 style="margin-top:0;"><?php echo esc_html(self::get_lane_label($lane_key)); ?></h2>
                    <p class="description" style="max-width:900px; margin-bottom:16px;">
                        <?php echo esc_html(self::get_lane_note($lane_key)); ?>
                    </p>

                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin-bottom:18px;">
                        <input type="hidden" name="action" value="ssb_assign_fulfillment_lane_class">
                        <input type="hidden" name="lane" value="<?php echo esc_attr($lane_key); ?>">
                        <?php wp_nonce_field('ssb_assign_fulfillment_lane_class'); ?>

                        <div style="display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap;">
                            <select name="shipping_class_ids[]" multiple size="6" style="min-width:320px; max-width:420px;">
                                <?php foreach ($available_terms as $term) : ?>
                                    <option value="<?php echo esc_attr($term->term_id); ?>">
                                        <?php echo esc_html($term->name); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>

                            <div>
                                <?php submit_button('Assign', 'secondary', 'submit', false); ?>
                                <p class="description" style="margin-top:8px;">Select one or more shipping classes and click Assign.</p>
                            </div>
                        </div>
                    </form>

                    <table class="widefat striped" style="max-width:900px; margin-bottom:18px;">
                        <thead>
                                <tr>
                                    <th>Assigned Shipping Class</th>
                                    <th style="width:120px;">Actions</th>
                                </tr>
                        </thead>
                        <tbody>
                            <?php if (empty($assigned_ids)) : ?>
                                <tr>
                                    <td colspan="2">No shipping classes assigned.</td>
                                </tr>
                            <?php else : ?>
                                <?php foreach ($assigned_ids as $term_id) : ?>
                                    <?php $term = get_term($term_id, 'product_shipping_class'); ?>
                                    <?php if (!$term || is_wp_error($term)) { continue; } ?>
                                    <tr>
                                        <td><?php echo esc_html($term->name); ?></td>
                                        <td>
                                            <?php
                                            echo self::render_row_action_link(
                                                'ssb_remove_fulfillment_lane_class',
                                                'Unassign',
                                                array(
                                                    'lane'    => $lane_key,
                                                    'term_id' => $term->term_id,
                                                ),
                                                'submitdelete'
                                            );
                                            ?>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </tbody>
                    </table>

                    <?php if ($lane_key === 'external') : ?>
                        <h3 style="margin:18px 0 8px;">Vendor Assignments</h3>

                        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin-bottom:18px;">
                            <input type="hidden" name="action" value="ssb_assign_fulfillment_lane_vendor">
                            <input type="hidden" name="lane" value="external">
                            <?php wp_nonce_field('ssb_assign_fulfillment_lane_vendor'); ?>

                            <div style="display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap;">
                                <select name="vendor_code" class="regular-text" style="min-width:320px; max-width:420px;">
                                    <option value="">Select a vendor…</option>
                                    <?php foreach ($inactive_vendors as $vendor) : ?>
                                        <?php $vendor_code = (string) ($vendor['code'] ?? ''); ?>
                                        <?php if ($vendor_code === '') { continue; } ?>
                                        <option value="<?php echo esc_attr($vendor_code); ?>">
                                            <?php echo esc_html($vendor['company_name'] ?? $vendor_code); ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>

                                <div>
                                    <?php submit_button('Assign', 'secondary', 'submit', false); ?>
                                    <p class="description" style="margin-top:8px;">Select a vendor and click Assign.</p>
                                </div>
                            </div>
                        </form>

                        <table class="widefat striped" style="max-width:900px; margin-bottom:18px;">
                            <thead>
                                <tr>
                                    <th>Assigned Vendors</th>
                                    <th style="width:120px;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if (empty($vendor_codes)) : ?>
                                    <tr>
                                        <td colspan="2">No vendors assigned.</td>
                                    </tr>
                                <?php else : ?>
                                    <?php foreach ($vendor_codes as $vendor_code) : ?>
                                        <?php $vendor = self::get_vendor_record_by_code($vendor_code); ?>
                                        <tr>
                                            <td><?php echo esc_html($vendor && !empty($vendor['company_name']) ? $vendor['company_name'] : $vendor_code); ?></td>
                                            <td>
                                                <?php
                                                echo self::render_row_action_link(
                                                    'ssb_remove_fulfillment_lane_vendor',
                                                    'Unassign',
                                                    array(
                                                        'lane'        => 'external',
                                                        'vendor_code' => $vendor_code,
                                                    ),
                                                    'submitdelete'
                                                );
                                                ?>
                                            </td>
                                        </tr>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    <?php endif; ?>

                    <?php if (in_array($lane_key, array('batch', 'immediate'), true)) : ?>
                        <h3 style="margin:18px 0 8px;">Warehouse Assignments</h3>

                        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin-bottom:18px;">
                            <input type="hidden" name="action" value="ssb_assign_fulfillment_lane_warehouse">
                            <input type="hidden" name="lane" value="<?php echo esc_attr($lane_key); ?>">
                            <?php wp_nonce_field('ssb_assign_fulfillment_lane_warehouse'); ?>

                            <div style="display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap;">
                                <select name="warehouse_code" class="regular-text" style="min-width:320px; max-width:420px;">
                                    <option value="">Select a warehouse…</option>
                                    <?php foreach ($active_warehouses as $warehouse) : ?>
                                        <?php $warehouse_code = (string) ($warehouse['code'] ?? ''); ?>
                                        <?php if ($warehouse_code === '') { continue; } ?>
                                        <option value="<?php echo esc_attr($warehouse_code); ?>">
                                            <?php
$warehouse_label = ($warehouse_code === 'headquarters')
    ? 'Main Warehouse (Headquarters)'
    : (($warehouse['name'] ?? $warehouse_code) . ' (' . $warehouse_code . ')');

echo esc_html($warehouse_label);
?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>

                                <div>
                                    <?php submit_button('Assign', 'secondary', 'submit', false); ?>
                                    <p class="description" style="margin-top:8px;">Select a warehouse and click Assign.</p>
                                </div>
                            </div>
                        </form>

                        <table class="widefat striped" style="max-width:900px; margin-bottom:18px;">
                            <thead>
                                <tr>
                                    <th>Assigned Warehouse</th>
                                    <th style="width:120px;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if (empty($warehouse_codes)) : ?>
                                    <tr>
                                        <td colspan="2">No warehouses assigned.</td>
                                    </tr>
                                <?php else : ?>
                                    <?php foreach ($warehouse_codes as $warehouse_code) : ?>
                                        <?php $warehouse = self::get_warehouse_record_by_code($warehouse_code); ?>
                                        <tr>
                                            <td>
    <?php
    echo esc_html(
        $warehouse_code === 'headquarters'
            ? 'Main Warehouse (Headquarters)'
            : ($warehouse && !empty($warehouse['name']) ? $warehouse['name'] : $warehouse_code)
    );
    ?>
</td>
                                            <td>
                                                <?php
                                                echo self::render_row_action_link(
                                                    'ssb_remove_fulfillment_lane_warehouse',
                                                    'Unassign',
                                                    array(
                                                        'lane'           => $lane_key,
                                                        'warehouse_code' => $warehouse_code,
                                                    ),
                                                    'submitdelete'
                                                );
                                                ?>
                                            </td>
                                        </tr>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    <?php endif; ?>

                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="max-width:900px;">
                        <input type="hidden" name="action" value="ssb_save_fulfillment_lane_settings">
                        <input type="hidden" name="lane" value="<?php echo esc_attr($lane_key); ?>">
                        <?php wp_nonce_field('ssb_save_fulfillment_lane_settings'); ?>

                        <table class="form-table" role="presentation" style="margin-top:0;">
                            <tbody>
                                <tr>
                                    <th scope="row" style="width:220px;">
                                        <label for="customer_shipping_message_<?php echo esc_attr($lane_key); ?>">Customer Shipping Message</label>
                                    </th>
                                    <td>
                                        <textarea
                                            id="customer_shipping_message_<?php echo esc_attr($lane_key); ?>"
                                            name="customer_shipping_message"
                                            rows="3"
                                            class="large-text"
                                        ><?php echo esc_textarea($customer_shipping_message); ?></textarea>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <?php submit_button('Save Lane Settings', 'secondary', 'submit', false); ?>
                    </form>
                </div>
            <?php endforeach; ?>
        </div>
        <?php
    }

    public static function handle_save_fulfillment_lane_settings() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized.');
        }

        check_admin_referer('ssb_save_fulfillment_lane_settings');

        $lane = isset($_POST['lane']) ? sanitize_text_field(wp_unslash($_POST['lane'])) : '';
        $valid_lanes = array('batch', 'immediate', 'external');

        if (!in_array($lane, $valid_lanes, true)) {
            wp_safe_redirect(admin_url('admin.php?page=ssb-fulfillment-lanes'));
            exit;
        }

        $lanes = self::get_fulfillment_lanes();

        if (!isset($lanes[$lane]) || !is_array($lanes[$lane])) {
            $lanes[$lane] = array(
                'shipping_classes'          => array(),
                'customer_shipping_message' => '',
                'warehouse_codes'           => array(),
                'vendor_codes'              => array(),
            );
        }

        if (!isset($lanes[$lane]['warehouse_codes']) || !is_array($lanes[$lane]['warehouse_codes'])) {
            $lanes[$lane]['warehouse_codes'] = array();
        }

        if (!isset($lanes[$lane]['vendor_codes']) || !is_array($lanes[$lane]['vendor_codes'])) {
            $lanes[$lane]['vendor_codes'] = array();
        }

        $lanes[$lane]['customer_shipping_message'] = isset($_POST['customer_shipping_message'])
            ? sanitize_textarea_field(wp_unslash($_POST['customer_shipping_message']))
            : '';

        self::save_fulfillment_lanes($lanes);

        wp_safe_redirect(add_query_arg(
            array(
                'page'            => 'ssb-fulfillment-lanes',
                'ssb_lane_notice' => 'lane_saved',
            ),
            admin_url('admin.php')
        ));
        exit;
    }

    public static function render_warehouses_page() {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }

        $rows = self::get_warehouses();
        array_unshift($rows, self::get_main_warehouse_row());

        $edit_code = isset($_GET['edit']) ? sanitize_text_field($_GET['edit']) : '';
        $editing = ($edit_code !== '' && $edit_code !== 'headquarters')
            ? self::find_record_by_code($rows, $edit_code)
            : null;
        $record = $editing ? $editing['record'] : array(
            'name'        => '',
            'address1'    => '',
            'address2'    => '',
            'city'        => '',
            'state'       => '',
            'postal_code' => '',
            'country'     => 'US',
            'phone'       => '',
            'email'       => '',
        );
        ?>
        <div class="wrap">
            <h1 class="wp-heading-inline">Warehouses</h1>
            <hr class="wp-header-end">

            <div class="notice notice-info inline">
                <p><strong>Main Warehouse</strong> is sourced from WooCommerce store settings.</p>
            </div>

            <div style="display:grid; grid-template-columns: 34% 1fr; gap: 24px; align-items:start;">
                <div>
                    <h2><?php echo $editing ? 'Edit Warehouse' : 'Add New Warehouse'; ?></h2>

                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                        <input type="hidden" name="action" value="ssb_save_warehouse">
                        <?php wp_nonce_field('ssb_save_warehouse'); ?>

                        <?php if ($editing) : ?>
                            <input type="hidden" name="edit_code" value="<?php echo esc_attr($record['code']); ?>">
                        <?php endif; ?>

                        <table class="form-table" role="presentation">
                            <tbody>
                                <tr>
                                    <th scope="row"><label for="warehouse_name">Location Name</label></th>
                                    <td><input type="text" id="warehouse_name" name="warehouse[name]" class="regular-text" value="<?php echo esc_attr($record['name'] ?? ''); ?>"></td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="warehouse_address1">Address1</label></th>
                                    <td><input type="text" id="warehouse_address1" name="warehouse[address1]" class="regular-text" value="<?php echo esc_attr($record['address1'] ?? ''); ?>"></td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="warehouse_address2">Address2</label></th>
                                    <td><input type="text" id="warehouse_address2" name="warehouse[address2]" class="regular-text" value="<?php echo esc_attr($record['address2'] ?? ''); ?>"></td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="warehouse_city">City</label></th>
                                    <td><input type="text" id="warehouse_city" name="warehouse[city]" class="regular-text" value="<?php echo esc_attr($record['city'] ?? ''); ?>"></td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="warehouse_state">State</label></th>
                                    <td><input type="text" id="warehouse_state" name="warehouse[state]" class="regular-text" value="<?php echo esc_attr($record['state'] ?? ''); ?>"></td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="warehouse_postal_code">Postal Code</label></th>
                                    <td><input type="text" id="warehouse_postal_code" name="warehouse[postal_code]" class="regular-text" value="<?php echo esc_attr($record['postal_code'] ?? ''); ?>"></td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="warehouse_country">Country</label></th>
                                    <td><input type="text" id="warehouse_country" name="warehouse[country]" class="regular-text" maxlength="2" value="<?php echo esc_attr($record['country'] ?? 'US'); ?>"></td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="warehouse_phone">Phone</label></th>
                                    <td><input type="text" id="warehouse_phone" name="warehouse[phone]" class="regular-text" value="<?php echo esc_attr($record['phone'] ?? ''); ?>"></td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="warehouse_email">Email</label></th>
                                    <td><input type="email" id="warehouse_email" name="warehouse[email]" class="regular-text" value="<?php echo esc_attr($record['email'] ?? ''); ?>"></td>
                                </tr>
                            </tbody>
                        </table>

                        <?php submit_button($editing ? 'Save Warehouse' : 'Add New Warehouse'); ?>
                    </form>
                </div>

                <div>
                    <table class="widefat fixed striped">
                        <thead>
                            <tr>
                                <th>Location Name</th>
                                <th>Phone</th>
                                <th>Email</th>
                                <th style="width:90px;">Active</th>
                                <th style="width:160px;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php if (empty($rows)) : ?>
                                <tr>
                                    <td colspan="5">No warehouses found.</td>
                                </tr>
                            <?php else : ?>
                                <?php foreach ($rows as $row) : ?>
                                    <?php
                                    $lanes = self::get_fulfillment_lanes();
                                    $warehouse_code = (string) ($row['code'] ?? '');
                                    $is_main = !empty($row['is_main']);
                                    $is_assigned = self::warehouse_is_assigned_to_lane($warehouse_code, $lanes);
                                    ?>
                                    <tr>
                                        <td><?php echo esc_html($row['name'] ?? ''); ?></td>
                                        <td><?php echo esc_html($row['phone'] ?? ''); ?></td>
                                        <td><?php echo esc_html($row['email'] ?? ''); ?></td>
                                        <td><?php echo $is_assigned ? 'Active' : 'Inactive'; ?></td>
                                        <td>
                                            <?php if ($is_main) : ?>
                                                <a href="<?php echo esc_url(admin_url('admin.php?page=wc-settings&tab=general')); ?>">Edit</a>
                                            <?php else : ?>
                                                <a href="<?php echo esc_url(self::get_admin_page_url('ssb-warehouses', array('edit' => $row['code']))); ?>">Edit</a>
                                                |
                                                <?php
                                                echo self::render_row_action_link(
                                                    'ssb_delete_warehouse',
                                                    'Delete',
                                                    array('code' => $row['code']),
                                                    'submitdelete'
                                                );
                                                ?>
                                            <?php endif; ?>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <?php
    }

    public static function render_vendors_page() {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }

        $rows = self::get_vendors();
        $edit_code = isset($_GET['edit']) ? sanitize_text_field($_GET['edit']) : '';
        $view_code = isset($_GET['view']) ? sanitize_text_field($_GET['view']) : '';
        $editing = $edit_code !== '' ? self::find_record_by_code($rows, $edit_code) : null;
        $record = $editing ? $editing['record'] : array(
            'company_name'      => '',
            'contact'           => '',
            'address1'          => '',
            'address2'          => '',
            'city'              => '',
            'state'             => '',
            'postal_code'       => '',
            'country'           => 'US',
            'phone'             => '',
            'email'             => '',
            'shipping_class_id' => 0,
            'image_id'          => 0,
            'shipping_memo'     => '',
            'terms_memo'        => '',
        );

        $vendor_shipping_class_id = isset($record['shipping_class_id']) ? absint($record['shipping_class_id']) : 0;

        $all_vendor_shipping_classes = self::get_all_shipping_classes_for_mapping();

        $format_vendor_value = function($value) {
            $value = is_scalar($value) ? trim((string) $value) : '';
            return $value !== '' ? $value : '—';
        };

        $get_shipping_class_label = function($shipping_class_id) use ($all_vendor_shipping_classes) {
            $shipping_class_id = absint($shipping_class_id);

            if ($shipping_class_id < 1) {
                return '—';
            }

            foreach ($all_vendor_shipping_classes as $term) {
                if ((int) $term->term_id === $shipping_class_id) {
                    return $term->name . ' (#' . $term->term_id . ')';
                }
            }

            return 'Unknown (#' . $shipping_class_id . ')';
        };
        ?>
        <div class="wrap">
            <h1 class="wp-heading-inline">Vendors</h1>
            <hr class="wp-header-end">

            <div style="display:grid; grid-template-columns: 34% 1fr; gap: 24px; align-items:start;">
                <div>
                    <h2><?php echo $editing ? 'Edit Vendor' : 'Add New Vendor'; ?></h2>

                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                        <input type="hidden" name="action" value="ssb_save_vendor">
                        <?php wp_nonce_field('ssb_save_vendor'); ?>

                        <?php if ($editing) : ?>
                            <input type="hidden" name="edit_code" value="<?php echo esc_attr($record['code']); ?>">
                        <?php endif; ?>

                        <table class="form-table" role="presentation">
                            <tbody>
                                <tr>
                                    <th scope="row"><label for="vendor_company_name">Company Name</label></th>
                                    <td><input type="text" id="vendor_company_name" name="vendor[company_name]" class="regular-text" value="<?php echo esc_attr($record['company_name'] ?? ''); ?>"></td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="vendor_contact">Contact</label></th>
                                    <td><input type="text" id="vendor_contact" name="vendor[contact]" class="regular-text" value="<?php echo esc_attr($record['contact'] ?? ''); ?>"></td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="vendor_address1">Address1</label></th>
                                    <td><input type="text" id="vendor_address1" name="vendor[address1]" class="regular-text" value="<?php echo esc_attr($record['address1'] ?? ''); ?>"></td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="vendor_address2">Address2</label></th>
                                    <td><input type="text" id="vendor_address2" name="vendor[address2]" class="regular-text" value="<?php echo esc_attr($record['address2'] ?? ''); ?>"></td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="vendor_city">City</label></th>
                                    <td><input type="text" id="vendor_city" name="vendor[city]" class="regular-text" value="<?php echo esc_attr($record['city'] ?? ''); ?>"></td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="vendor_state">State</label></th>
                                    <td><input type="text" id="vendor_state" name="vendor[state]" class="regular-text" value="<?php echo esc_attr($record['state'] ?? ''); ?>"></td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="vendor_postal_code">Postal Code</label></th>
                                    <td><input type="text" id="vendor_postal_code" name="vendor[postal_code]" class="regular-text" value="<?php echo esc_attr($record['postal_code'] ?? ''); ?>"></td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="vendor_country">Country</label></th>
                                    <td><input type="text" id="vendor_country" name="vendor[country]" class="regular-text" maxlength="2" value="<?php echo esc_attr($record['country'] ?? 'US'); ?>"></td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="vendor_phone">Phone</label></th>
                                    <td><input type="text" id="vendor_phone" name="vendor[phone]" class="regular-text" value="<?php echo esc_attr($record['phone'] ?? ''); ?>"></td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="vendor_email">Email</label></th>
                                    <td><input type="email" id="vendor_email" name="vendor[email]" class="regular-text" value="<?php echo esc_attr($record['email'] ?? ''); ?>"></td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="vendor_shipping_class_id">Assigned Shipping Class</label></th>
                                    <td>
                                        <select
                                            id="vendor_shipping_class_id"
                                            name="vendor[shipping_class_id]"
                                            class="regular-text"
                                            style="min-width:320px;"
                                        >
                                            <option value="">— No shipping class assigned —</option>
                                            <?php foreach ($all_vendor_shipping_classes as $term) : ?>
                                                <option value="<?php echo esc_attr($term->term_id); ?>" <?php selected((int) $vendor_shipping_class_id === (int) $term->term_id); ?>>
                                                    <?php echo esc_html($term->name); ?>
                                                </option>
                                            <?php endforeach; ?>
                                        </select>
                                        <p class="description">Assign a single shipping class to this vendor. This relationship will be used by the External fulfillment lane.</p>
                                    </td>
                                </tr>

                                <tr>
                                    <th scope="row"><label for="vendor_image_id">Select Image</label></th>
                                    <td>
                                        <input type="hidden" id="vendor_image_id" name="vendor[image_id]" value="<?php echo esc_attr($record['image_id'] ?? 0); ?>">

                                        <div id="ssb-vendor-image-preview" style="min-height: 120px; margin-bottom: 12px;">
                                            <?php
                                            $vendor_image_id = absint($record['image_id'] ?? 0);
                                            $vendor_image_url = $vendor_image_id ? wp_get_attachment_image_url($vendor_image_id, 'medium') : '';
                                            if ($vendor_image_url) :
                                            ?>
                                                <img src="<?php echo esc_url($vendor_image_url); ?>" style="max-width:100%; height:auto; border:1px solid #dcdcde;" />
                                            <?php endif; ?>
                                        </div>

                                        <button type="button" class="button" id="ssb-vendor-image-select">Select Image</button>
                                    </td>
                                </tr>

                                <tr>
                                    <th scope="row"><label for="vendor_shipping_memo">Shipping &amp; Returns Memo</label></th>
                                    <td>
                                        <p class="description" style="margin-bottom:8px;">
                                            Shortcodes allowed: <code>[shoshin_vendor_name]</code> <code>[shoshin_vendor_image]</code> <code>[shoshin_vendor_note type="shipping_returns"]</code>
                                        </p>
                                        <textarea id="vendor_shipping_memo" name="vendor[shipping_memo]" rows="6" class="large-text"><?php echo esc_textarea($record['shipping_memo'] ?? ''); ?></textarea>
                                    </td>
                                </tr>

                                <tr>
                                    <th scope="row"><label for="vendor_terms_memo">Terms &amp; Privacy Memo</label></th>
                                    <td>
                                        <p class="description" style="margin-bottom:8px;">
                                            Shortcodes allowed: <code>[shoshin_vendor_name]</code> <code>[shoshin_vendor_image]</code> <code>[shoshin_vendor_note type="terms_privacy"]</code>
                                        </p>
                                        <textarea id="vendor_terms_memo" name="vendor[terms_memo]" rows="6" class="large-text"><?php echo esc_textarea($record['terms_memo'] ?? ''); ?></textarea>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <?php submit_button($editing ? 'Save Vendor' : 'Add New Vendor'); ?>
                    </form>
                </div>

                <div>
                    <table class="widefat fixed striped">
                        <thead>
                            <tr>
                                <th>Company Name</th>
                                <th>Contact</th>
                                <th>Phone</th>
                                <th>Email</th>
                                <th>Class</th>
                                <th style="width:90px;">Active</th>
                                <th style="width:180px;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php if (empty($rows)) : ?>
                                <tr>
                                    <td colspan="7">No vendors found.</td>
                                </tr>
                            <?php else : ?>
                                <?php foreach ($rows as $row) : ?>
                                    <?php
                                    $lanes = self::get_fulfillment_lanes();
                                    $vendor_code = (string) ($row['code'] ?? '');
                                    $is_assigned = self::vendor_is_assigned_to_external_lane($vendor_code, $lanes);
                                    $row_shipping_class_id = isset($row['shipping_class_id']) ? absint($row['shipping_class_id']) : 0;
                                    $is_viewing = ($view_code !== '' && $view_code === $vendor_code);
                                    $vendor_image_id = absint($row['image_id'] ?? 0);
                                    $vendor_image_url = $vendor_image_id ? wp_get_attachment_image_url($vendor_image_id, 'medium') : '';
                                    ?>
                                    <tr>
                                        <td><?php echo esc_html($row['company_name'] ?? ''); ?></td>
                                        <td><?php echo esc_html($row['contact'] ?? ''); ?></td>
                                        <td><?php echo esc_html($row['phone'] ?? ''); ?></td>
                                        <td><?php echo esc_html($row['email'] ?? ''); ?></td>
                                        <td><?php echo esc_html($get_shipping_class_label($row_shipping_class_id)); ?></td>
                                        <td><?php echo $is_assigned ? 'Active' : 'Inactive'; ?></td>
                                        <td>
                                            <a href="<?php echo esc_url($is_viewing ? self::get_admin_page_url('ssb-vendors') : self::get_admin_page_url('ssb-vendors', array('view' => $row['code']))); ?>">
    <?php echo $is_viewing ? 'Close' : 'View'; ?>
</a>
                                            |
                                            <a href="<?php echo esc_url(self::get_admin_page_url('ssb-vendors', array('edit' => $row['code']))); ?>">Edit</a>
                                            |
                                            <?php
                                            echo self::render_row_action_link(
                                                'ssb_delete_vendor',
                                                'Delete',
                                                array('code' => $row['code']),
                                                'submitdelete'
                                            );
                                            ?>
                                        </td>
                                    </tr>
                                    <?php if ($is_viewing) : ?>
                                        <tr>
                                            <td colspan="7" style="background:#fcfcfc;">
                                                <div style="display:grid; grid-template-columns: minmax(0, 1fr) 180px; gap:24px; align-items:start; padding:8px 0;">
                                                    <div>
                                                        <table class="widefat striped" style="margin:0; border:none; box-shadow:none;">
                                                            <tbody>
                                                                <tr>
                                                                    <th style="width:180px;">Company Name</th>
                                                                    <td><?php echo esc_html($format_vendor_value($row['company_name'] ?? '')); ?></td>
                                                                </tr>
                                                                <tr>
                                                                    <th>Contact</th>
                                                                    <td><?php echo esc_html($format_vendor_value($row['contact'] ?? '')); ?></td>
                                                                </tr>
                                                                <tr>
                                                                    <th>Address1</th>
                                                                    <td><?php echo esc_html($format_vendor_value($row['address1'] ?? '')); ?></td>
                                                                </tr>
                                                                <tr>
                                                                    <th>Address2</th>
                                                                    <td><?php echo esc_html($format_vendor_value($row['address2'] ?? '')); ?></td>
                                                                </tr>
                                                                <tr>
                                                                    <th>City</th>
                                                                    <td><?php echo esc_html($format_vendor_value($row['city'] ?? '')); ?></td>
                                                                </tr>
                                                                <tr>
                                                                    <th>State</th>
                                                                    <td><?php echo esc_html($format_vendor_value($row['state'] ?? '')); ?></td>
                                                                </tr>
                                                                <tr>
                                                                    <th>Postal Code</th>
                                                                    <td><?php echo esc_html($format_vendor_value($row['postal_code'] ?? '')); ?></td>
                                                                </tr>
                                                                <tr>
                                                                    <th>Country</th>
                                                                    <td><?php echo esc_html($format_vendor_value($row['country'] ?? '')); ?></td>
                                                                </tr>
                                                                <tr>
                                                                    <th>Phone</th>
                                                                    <td><?php echo esc_html($format_vendor_value($row['phone'] ?? '')); ?></td>
                                                                </tr>
                                                                <tr>
                                                                    <th>Email</th>
                                                                    <td><?php echo esc_html($format_vendor_value($row['email'] ?? '')); ?></td>
                                                                </tr>
                                                                <tr>
                                                                    <th>Assigned Shipping Class</th>
                                                                    <td><?php echo esc_html($get_shipping_class_label($row_shipping_class_id)); ?></td>
                                                                </tr>
                                                                <tr>
                                                                    <th>Shipping &amp; Returns Memo</th>
                                                                    <td><?php echo wp_kses_post($format_vendor_value($row['shipping_memo'] ?? '')); ?></td>
                                                                </tr>
                                                                <tr>
                                                                    <th>Terms &amp; Privacy Memo</th>
                                                                    <td><?php echo wp_kses_post($format_vendor_value($row['terms_memo'] ?? '')); ?></td>
                                                                </tr>
                                                                <tr>
                                                                    <th>Status</th>
                                                                    <td><?php echo $is_assigned ? 'Active' : 'Inactive'; ?></td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    <div>
                                                        <strong style="display:block; margin-bottom:8px;">Image</strong>
                                                        <div style="min-height:120px; border:1px solid #dcdcde; background:#fff; padding:8px;">
                                                            <?php if ($vendor_image_url) : ?>
                                                                <img src="<?php echo esc_url($vendor_image_url); ?>" style="max-width:100%; height:auto; display:block;" />
                                                            <?php else : ?>
                                                                <span style="color:#646970;">—</span>
                                                            <?php endif; ?>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    <?php endif; ?>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <?php
    }

        /**
         * Register plugin settings.
         *
         * @return void
         */
    public static function register_settings() {
        register_setting(
            'ssb_settings_group',
            'ssb_shipper_origin',
            array(
                'type'              => 'array',
                'sanitize_callback' => array(__CLASS__, 'sanitize_shipper_origin_settings'),
                'default'           => array(),
            )
        );

        register_setting(
            'ssb_settings_group',
            'ssb_enable_rate_cache',
            array(
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'default'           => 'yes',
            )
        );

        register_setting('ssb_settings_group', 'ssb_usps_signature_required', array(
            'type'              => 'string',
            'sanitize_callback' => array(__CLASS__, 'sanitize_money_setting'),
            'default'           => '3.95',
        ));

        register_setting('ssb_settings_group', 'ssb_usps_adult_signature_required', array(
            'type'              => 'string',
            'sanitize_callback' => array(__CLASS__, 'sanitize_money_setting'),
            'default'           => '9.70',
        ));

        register_setting('ssb_settings_group', 'ssb_usps_insurance', array(
            'type'              => 'string',
            'sanitize_callback' => array(__CLASS__, 'sanitize_money_setting'),
            'default'           => '0.00',
        ));

        register_setting('ssb_settings_group', 'ssb_ups_signature_required', array(
            'type'              => 'string',
            'sanitize_callback' => array(__CLASS__, 'sanitize_money_setting'),
            'default'           => '6.25',
        ));

        register_setting('ssb_settings_group', 'ssb_ups_adult_signature_required', array(
            'type'              => 'string',
            'sanitize_callback' => array(__CLASS__, 'sanitize_money_setting'),
            'default'           => '7.50',
        ));

        register_setting('ssb_settings_group', 'ssb_ups_carbon_neutral', array(
            'type'              => 'string',
            'sanitize_callback' => array(__CLASS__, 'sanitize_money_setting'),
            'default'           => '0.05',
        ));

        register_setting('ssb_settings_group', 'ssb_ups_saturday_delivery', array(
            'type'              => 'string',
            'sanitize_callback' => array(__CLASS__, 'sanitize_money_setting'),
            'default'           => '16.00',
        ));

        register_setting('ssb_settings_group', 'ssb_ups_additional_handling', array(
            'type'              => 'string',
            'sanitize_callback' => array(__CLASS__, 'sanitize_money_setting'),
            'default'           => '14.25',
        ));

        register_setting('ssb_settings_group', 'ssb_ups_insurance', array(
            'type'              => 'string',
            'sanitize_callback' => array(__CLASS__, 'sanitize_money_setting'),
            'default'           => '0.00',
        ));

        register_setting(
            'ssb_settings_group',
            self::OPTION_STOREFRONT_MULTIPACKAGE_MODE,
            array(
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'default'           => 'no',
            )
        );

        register_setting(
            'ssb_settings_group',
            self::OPTION_ADMIN_MULTISHIPMENT_MODE,
            array(
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'default'           => 'no',
            )
        );

        register_setting(
    'ssb_settings_group',
    self::OPTION_LEGACY_MULTIPACKAGE_MODE,
    array(
        'type'              => 'string',
        'sanitize_callback' => 'sanitize_text_field',
        'default'           => 'no',
    )
);

        register_setting(
            'ssb_settings_group',
            self::OPTION_SINGLE_VARIATION_DIRECT_ADD,
            array(
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'default'           => 'no',
            )
        );

        register_setting(
            'ssb_settings_group',
            self::OPTION_SUPPRESS_FRONTEND_MARKETPLACE_NOTICES,
            array(
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'default'           => 'no',
            )
        );

        register_setting('ssb_settings_group', 'ssb_disable_alcohol');
        register_setting('ssb_settings_group', 'ssb_disable_dry_ice');
        register_setting('ssb_settings_group', 'ssb_disable_hazmat');
register_setting(
    'ssb_settings_group',
    self::OPTION_WAREHOUSES,
    array(
        'type'              => 'array',
        'sanitize_callback' => array(__CLASS__, 'sanitize_warehouses_settings'),
        'default'           => array(),
    )
);

register_setting(
    'ssb_settings_group',
    self::OPTION_VENDORS,
    array(
        'type'              => 'array',
        'sanitize_callback' => array(__CLASS__, 'sanitize_vendors_settings'),
        'default'           => array(),
    )
);

register_setting('ssb_settings_group', self::OPTION_MAIN_WAREHOUSE_LOGO_1);
register_setting('ssb_settings_group', self::OPTION_MAIN_WAREHOUSE_LOGO_2);

register_setting(
    'ssb_settings_group',
    self::OPTION_FULFILLMENT_LANES,
    array(
        'type'              => 'array',
        'sanitize_callback' => array(__CLASS__, 'sanitize_fulfillment_lanes_settings'),
        'default'           => array(),
    )
);
    }

    /**
     * Add Settings link on Plugins screen.
     *
     * @param array $links
     * @return array
     */
    public static function add_plugin_action_links($links) {
        $settings_link = '<a href="' . esc_url(admin_url('admin.php?page=ssb-settings')) . '">Settings</a>';
        array_unshift($links, $settings_link);
        return $links;
    }

    /**
     * Render settings page.
     *
     * @return void
     */
    public static function render_settings_page() {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }

        $settings = self::get_shipper_settings();
        $adjustments = self::get_rate_adjustment_settings();
        $main_logo_1_id = absint(get_option(self::OPTION_MAIN_WAREHOUSE_LOGO_1, 0));
        $main_logo_2_id = absint(get_option(self::OPTION_MAIN_WAREHOUSE_LOGO_2, 0));
        $main_logo_1_url = $main_logo_1_id ? wp_get_attachment_image_url($main_logo_1_id, 'medium') : '';
        $main_logo_2_url = $main_logo_2_id ? wp_get_attachment_image_url($main_logo_2_id, 'medium') : '';

?>
        <div class="wrap">
            <h1>Shoshin Fulfillment Bridge</h1>
            <p>Configure the shipper / origin address and fulfillment settings used for label creation and warehouse operations.</p>

            <form method="post" action="options.php">
                <?php settings_fields('ssb_settings_group'); ?>

                                <h2>Main Warehouse Branding</h2>
                <p class="description">For best results use images 400x200px.</p>

                <div style="display:grid; grid-template-columns: repeat(2, minmax(320px, 400px)); gap: 24px; margin: 16px 0 28px; align-items:start;">
                    <div>
                        <h3 style="margin-top:0;">Image 1</h3>
                        <input type="hidden" id="ssb_main_warehouse_logo_1" name="ssb_main_warehouse_logo_1" value="<?php echo esc_attr($main_logo_1_id); ?>">
                        <div id="ssb-main-warehouse-logo-1-preview" style="min-height: 120px; margin-bottom: 12px;">
                            <?php if ($main_logo_1_url) : ?>
                                <img src="<?php echo esc_url($main_logo_1_url); ?>" style="max-width:100%; height:auto; border:1px solid #dcdcde;" />
                            <?php endif; ?>
                        </div>
                        <button type="button" class="button" id="ssb-main-warehouse-logo-1-select">Select Image</button>
                    </div>

                    <div>
                        <h3 style="margin-top:0;">Image 2</h3>
                        <input type="hidden" id="ssb_main_warehouse_logo_2" name="ssb_main_warehouse_logo_2" value="<?php echo esc_attr($main_logo_2_id); ?>">
                        <div id="ssb-main-warehouse-logo-2-preview" style="min-height: 120px; margin-bottom: 12px;">
                            <?php if ($main_logo_2_url) : ?>
                                <img src="<?php echo esc_url($main_logo_2_url); ?>" style="max-width:100%; height:auto; border:1px solid #dcdcde;" />
                            <?php endif; ?>
                        </div>
                        <button type="button" class="button" id="ssb-main-warehouse-logo-2-select">Select Image</button>
                    </div>
                </div>

                <table class="form-table" role="presentation">
                    <tbody>
                        <tr>
                            <th scope="row"><label for="ssb_shipper_origin_name">Sender name</label></th>
                            <td><input name="ssb_shipper_origin[name]" type="text" id="ssb_shipper_origin_name" class="regular-text" value="<?php echo esc_attr($settings['name']); ?>"></td>
                        </tr>

                        <tr>
                            <th scope="row"><label for="ssb_shipper_origin_company">Company</label></th>
                            <td><input name="ssb_shipper_origin[company]" type="text" id="ssb_shipper_origin_company" class="regular-text" value="<?php echo esc_attr($settings['company']); ?>"></td>
                        </tr>

                        <tr>
                            <th scope="row"><label for="ssb_shipper_origin_street1">Street address 1</label></th>
                            <td><input name="ssb_shipper_origin[street1]" type="text" id="ssb_shipper_origin_street1" class="regular-text" value="<?php echo esc_attr($settings['street1']); ?>"></td>
                        </tr>

                        <tr>
                            <th scope="row"><label for="ssb_shipper_origin_street2">Street address 2</label></th>
                            <td><input name="ssb_shipper_origin[street2]" type="text" id="ssb_shipper_origin_street2" class="regular-text" value="<?php echo esc_attr($settings['street2']); ?>"></td>
                        </tr>

                        <tr>
                            <th scope="row"><label for="ssb_shipper_origin_city">City</label></th>
                            <td><input name="ssb_shipper_origin[city]" type="text" id="ssb_shipper_origin_city" class="regular-text" value="<?php echo esc_attr($settings['city']); ?>"></td>
                        </tr>

                        <tr>
                            <th scope="row"><label for="ssb_shipper_origin_state">State / Province</label></th>
                            <td><input name="ssb_shipper_origin[state]" type="text" id="ssb_shipper_origin_state" class="regular-text" value="<?php echo esc_attr($settings['state']); ?>"></td>
                        </tr>

                        <tr>
                            <th scope="row"><label for="ssb_shipper_origin_zip">ZIP / Postal code</label></th>
                            <td><input name="ssb_shipper_origin[zip]" type="text" id="ssb_shipper_origin_zip" class="regular-text" value="<?php echo esc_attr($settings['zip']); ?>"></td>
                        </tr>

                        <tr>
                            <th scope="row"><label for="ssb_shipper_origin_country">Country code</label></th>
                            <td>
                                <input name="ssb_shipper_origin[country]" type="text" id="ssb_shipper_origin_country" class="regular-text" maxlength="2" value="<?php echo esc_attr($settings['country']); ?>">
                                <p class="description">Use a 2-letter ISO country code, such as US.</p>
                            </td>
                        </tr>

                        <tr>
                            <th scope="row"><label for="ssb_shipper_origin_phone">Phone</label></th>
                            <td>
                                <input name="ssb_shipper_origin[phone]" type="text" id="ssb_shipper_origin_phone" class="regular-text" value="<?php echo esc_attr($settings['phone']); ?>">
                                <p class="description">For USPS/UPS, enter a real origin phone. Digits-only is preferred.</p>
                            </td>
                        </tr>

                        <tr>
                            <th scope="row"><label for="ssb_shipper_origin_email">Email</label></th>
                            <td><input name="ssb_shipper_origin[email]" type="email" id="ssb_shipper_origin_email" class="regular-text" value="<?php echo esc_attr($settings['email']); ?>"></td>
                        </tr>

                        <tr>
                            <th scope="row">Admin Rate Cache</th>
                            <td>
                                <label for="ssb_enable_rate_cache">
                                    <input type="checkbox"
                                        id="ssb_enable_rate_cache"
                                        name="ssb_enable_rate_cache"
                                        value="yes"
                                        <?php checked(get_option('ssb_enable_rate_cache', 'yes'), 'yes'); ?>>
                                    Enable 60-second caching for admin "Fetch Rates" requests
                                </label>
                                <p class="description">
                                    Reduces UPS throttling during admin use. Disable for debugging live rate behavior.
                                </p>
                            </td>
                        </tr>

                            <tr>
                                <th scope="row">Storefront Multi-Package Mode</th>
                                <td>
                                    <label>
                                        <input
                                            type="checkbox"
                                            name="<?php echo esc_attr(self::OPTION_STOREFRONT_MULTIPACKAGE_MODE); ?>"
                                            value="yes"
                                            <?php checked(self::is_storefront_multipackage_mode_enabled()); ?>
                                        >
                                        Enable storefront package splitting and lane-aware cart/checkout shipping behavior.
                                    </label>
                                    <p class="description">
                                        Controls WooCommerce cart and checkout package splitting, shipping block rendering, and rate behavior by fulfillment lane.
                                    </p>
                                </td>
                            </tr>

                            <tr>
                                <th scope="row">Admin Multi-Shipment Mode</th>
                                <td>
                                    <label>
                                        <input
                                            type="checkbox"
                                            name="<?php echo esc_attr(self::OPTION_ADMIN_MULTISHIPMENT_MODE); ?>"
                                            value="yes"
                                            <?php checked(self::is_admin_multishipment_mode_enabled()); ?>
                                        >
                                        Enable shipment shell, allocation, and multi-shipment fulfillment workflows in the WooCommerce order admin.
                                    </label>
                                    <p class="description">
                                        Controls the Shipment and Allocation areas in the admin fulfillment station. This can be enabled independently of storefront multi-package mode.
                                    </p>
                                </td>
                            </tr>

                                                        <tr>
                                <th scope="row">Single-Variation Direct Add to Cart</th>
                                <td>
                                    <label>
                                        <input
                                            type="checkbox"
                                            name="<?php echo esc_attr(self::OPTION_SINGLE_VARIATION_DIRECT_ADD); ?>"
                                            value="yes"
                                            <?php checked(get_option(self::OPTION_SINGLE_VARIATION_DIRECT_ADD, 'no'), 'yes'); ?>
                                        >
                                        Replace “Select Options” with “Add to Cart” for variable products that only have one purchasable variation.
                                    </label>
                                    <p class="description">
                                        When enabled, storefront product cards will send single-variation products directly to cart instead of the product page.
                                    </p>
                                </td>
                            </tr>

                            <tr>
                                <th scope="row">Suppress Frontend Marketplace Notices</th>
                                <td>
                                    <label>
                                        <input
                                            type="checkbox"
                                            name="<?php echo esc_attr(self::OPTION_SUPPRESS_FRONTEND_MARKETPLACE_NOTICES); ?>"
                                            value="yes"
                                            <?php checked(self::is_frontend_notice_suppression_enabled()); ?>
                                        >
                                        Disable customer-facing WooCommerce / marketplace notices on shop, product, cart, and checkout pages.
                                    </label>
                                    <p class="description">
                                        Frontend only. Admin notices are unaffected. Use this with inline field validation if checkout-level notices are being replaced.
                                    </p>
                                </td>
                            </tr>

                        <tr>
                            <th scope="row">Shipment Option Controls</th>
                            <td>
                                <label>
                                    <input type="checkbox"
                                        name="ssb_disable_alcohol"
                                        value="1"
                                        <?php checked(get_option('ssb_disable_alcohol', '0'), '1'); ?>>
                                    Disable Alcohol
                                </label>
                                <br>

                                <label>
                                    <input type="checkbox"
                                        name="ssb_disable_dry_ice"
                                        value="1"
                                        <?php checked(get_option('ssb_disable_dry_ice', '0'), '1'); ?>>
                                    Disable Dry Ice
                                </label>
                                <br>

                                <label>
                                    <input type="checkbox"
                                        name="ssb_disable_hazmat"
                                        value="1"
                                        <?php checked(get_option('ssb_disable_hazmat', '0'), '1'); ?>>
                                    Disable Hazmat
                                </label>

                                <p class="description">
                                    These options are globally disabled and cannot be selected during label creation.
                                </p>
                            </td>
                        </tr>

                    </tbody>
                </table>

<hr style="margin:24px 0;">

<h2>Admin Rate Adjustment Settings</h2>
<p>These values control the optional add-on amounts shown on admin carrier cards and will be used for internal adjusted-rate calculations.</p>

<table class="form-table" role="presentation">
    <tbody>
        <tr>
            <th scope="row" colspan="2"><h3 style="margin:0;">USPS</h3></th>
        </tr>

        <tr>
            <th scope="row"><label for="ssb_usps_signature_required">Signature Required</label></th>
            <td>
                <input name="ssb_usps_signature_required" type="number" step="0.01" min="0" inputmode="decimal" id="ssb_usps_signature_required" class="regular-text" value="<?php echo esc_attr($adjustments['usps_signature_required']); ?>">
            </td>
        </tr>

        <tr>
            <th scope="row"><label for="ssb_usps_adult_signature_required">Adult Signature Required</label></th>
            <td>
                <input name="ssb_usps_adult_signature_required" type="number" step="0.01" min="0" inputmode="decimal" id="ssb_usps_adult_signature_required" class="regular-text" value="<?php echo esc_attr($adjustments['usps_adult_signature_required']); ?>">
            </td>
        </tr>

        <tr>
            <th scope="row"><label for="ssb_usps_insurance">Insurance</label></th>
            <td>
                <input name="ssb_usps_insurance" type="number" step="0.01" min="0" inputmode="decimal" id="ssb_usps_insurance" class="regular-text" value="<?php echo esc_attr($adjustments['usps_insurance']); ?>">
                <p class="description">Charged per additional $100 of declared value above the service’s included insurance. Rounded up to the next $100.</p>
            </td>
        </tr>

        <tr>
            <th scope="row" colspan="2"><h3 style="margin:16px 0 0;">UPS</h3></th>
        </tr>

        <tr>
            <th scope="row"><label for="ssb_ups_signature_required">Signature Required</label></th>
            <td>
                <input name="ssb_ups_signature_required" type="number" step="0.01" min="0" inputmode="decimal" id="ssb_ups_signature_required" class="regular-text" value="<?php echo esc_attr($adjustments['ups_signature_required']); ?>">
            </td>
        </tr>

        <tr>
            <th scope="row"><label for="ssb_ups_adult_signature_required">Adult Signature Required</label></th>
            <td>
                <input name="ssb_ups_adult_signature_required" type="number" step="0.01" min="0" inputmode="decimal" id="ssb_ups_adult_signature_required" class="regular-text" value="<?php echo esc_attr($adjustments['ups_adult_signature_required']); ?>">
            </td>
        </tr>

        <tr>
            <th scope="row"><label for="ssb_ups_carbon_neutral">Carbon Neutral</label></th>
            <td>
                <input name="ssb_ups_carbon_neutral" type="number" step="0.01" min="0" inputmode="decimal" id="ssb_ups_carbon_neutral" class="regular-text" value="<?php echo esc_attr($adjustments['ups_carbon_neutral']); ?>">
            </td>
        </tr>

        <tr>
            <th scope="row"><label for="ssb_ups_saturday_delivery">Saturday Delivery</label></th>
            <td>
                <input name="ssb_ups_saturday_delivery" type="number" step="0.01" min="0" inputmode="decimal" id="ssb_ups_saturday_delivery" class="regular-text" value="<?php echo esc_attr($adjustments['ups_saturday_delivery']); ?>">
            </td>
        </tr>

        <tr>
            <th scope="row"><label for="ssb_ups_additional_handling">Additional Handling</label></th>
            <td>
                <input name="ssb_ups_additional_handling" type="number" step="0.01" min="0" inputmode="decimal" id="ssb_ups_additional_handling" class="regular-text" value="<?php echo esc_attr($adjustments['ups_additional_handling']); ?>">
            </td>
        </tr>

        <tr>
            <th scope="row"><label for="ssb_ups_insurance">Insurance</label></th>
            <td>
                <input name="ssb_ups_insurance" type="number" step="0.01" min="0" inputmode="decimal" id="ssb_ups_insurance" class="regular-text" value="<?php echo esc_attr($adjustments['ups_insurance']); ?>">
                <p class="description">Charged per additional $100 of declared value above the service’s included insurance. Rounded up to the next $100.</p>
            </td>
        </tr>
    </tbody>
</table>

<?php submit_button('Save Settings'); ?>
            </form>
        </div>
        <?php
    }

        protected static function get_rate_adjustment_settings() {
            return array(
                'usps_signature_required'       => self::normalize_money_setting(get_option('ssb_usps_signature_required', '3.95')),
                'usps_adult_signature_required' => self::normalize_money_setting(get_option('ssb_usps_adult_signature_required', '9.70')),
                'usps_insurance'                => self::normalize_money_setting(get_option('ssb_usps_insurance', '0.00')),
                'ups_signature_required'        => self::normalize_money_setting(get_option('ssb_ups_signature_required', '6.25')),
                'ups_adult_signature_required'  => self::normalize_money_setting(get_option('ssb_ups_adult_signature_required', '7.50')),
                'ups_carbon_neutral'            => self::normalize_money_setting(get_option('ssb_ups_carbon_neutral', '0.05')),
                'ups_saturday_delivery'         => self::normalize_money_setting(get_option('ssb_ups_saturday_delivery', '16.00')),
                'ups_additional_handling'       => self::normalize_money_setting(get_option('ssb_ups_additional_handling', '14.25')),
                'ups_insurance'                 => self::normalize_money_setting(get_option('ssb_ups_insurance', '0.00')),
            );
        }

    /**
     * Return shipper settings, falling back to Woo/store values.
     *
     * @return array
     */
    protected static function get_shipper_settings() {
        $saved = get_option('ssb_shipper_origin', array());
        $saved = is_array($saved) ? $saved : array();

        $country_state = (string) get_option('woocommerce_default_country', '');
        $country = '';
        $state   = '';

        if ($country_state !== '') {
            $parts   = explode(':', $country_state);
            $country = isset($parts[0]) ? strtoupper(trim((string) $parts[0])) : '';
            $state   = isset($parts[1]) ? strtoupper(trim((string) $parts[1])) : '';
        }

        $store_company = (string) get_option('woocommerce_store_company', '');
        if ($store_company === '') {
            $store_company = (string) get_option('woocommerce_store_name', '');
        }
        if ($store_company === '') {
            $store_company = wp_specialchars_decode(get_bloginfo('name'), ENT_QUOTES);
        }

        $defaults = array(
            'name'    => 'Shipping Department',
            'company' => $store_company,
            'street1' => (string) get_option('woocommerce_store_address', ''),
            'street2' => (string) get_option('woocommerce_store_address_2', ''),
            'city'    => (string) get_option('woocommerce_store_city', ''),
            'state'   => $state,
            'zip'     => (string) get_option('woocommerce_store_postcode', ''),
            'country' => $country,
            'phone'   => (string) get_option('woocommerce_store_phone', ''),
            'email'   => (string) get_option('admin_email', ''),
        );

        if ($defaults['email'] === '') {
            $defaults['email'] = (string) get_option('woocommerce_email_from_address', '');
        }

        return wp_parse_args($saved, $defaults);
    }

        public static function sanitize_money_setting($value) {
            return self::normalize_money_setting($value);
        }

    /**
     * Sanitize shipper origin settings.
     *
     * @param mixed $input
     * @return array
     */
    public static function sanitize_shipper_origin_settings($input) {
        $input = is_array($input) ? $input : array();

        $country = isset($input['country']) ? strtoupper(trim((string) $input['country'])) : '';

        return array(
            'name'    => isset($input['name']) ? sanitize_text_field($input['name']) : '',
            'company' => isset($input['company']) ? sanitize_text_field($input['company']) : '',
            'street1' => isset($input['street1']) ? sanitize_text_field($input['street1']) : '',
            'street2' => isset($input['street2']) ? sanitize_text_field($input['street2']) : '',
            'city'    => isset($input['city']) ? sanitize_text_field($input['city']) : '',
            'state'   => isset($input['state']) ? sanitize_text_field($input['state']) : '',
            'zip'     => isset($input['zip']) ? sanitize_text_field($input['zip']) : '',
            'country' => preg_replace('/[^A-Z]/', '', $country),
            'phone'   => isset($input['phone']) ? sanitize_text_field($input['phone']) : '',
            'email'   => isset($input['email']) ? sanitize_email($input['email']) : '',
        );
    }

    /**
     * Lightweight diagnostic payload for admin/debugging.
     *
     * @return array
     */
    public static function get_debug_context() {
        return array(
            'mode'        => self::is_test_mode() ? 'test' : 'live',
            'has_token'   => self::get_shippo_token() !== '',
            'origin'      => self::get_origin_address(),
        );
    }

    /**
     * Attempt to detect current Shippo mode from installed Shippo plugin options.
     *
     * This is intentionally defensive because third-party plugin option keys can vary.
     *
     * @return bool|null
     */
    protected static function detect_shippo_mode_from_existing_plugin() {
        $candidates = self::get_existing_shippo_option_candidates();

        foreach ($candidates as $option_name => $value) {
            if (!is_array($value)) {
                continue;
            }

            $flat = self::flatten_array_keys($value);

            $truthy_keys = array(
                'sandbox',
                'test_mode',
                'sandbox_mode',
                'is_test_mode',
                'enable_test_mode',
                'shippo_test_mode',
                'shippo_mode',
                'shippo_environment',
            );

            foreach ($truthy_keys as $key) {
                if (!array_key_exists($key, $flat)) {
                    continue;
                }

                $raw = $flat[$key];

                if (is_bool($raw)) {
                    return $raw;
                }

                $raw = strtolower(trim((string) $raw));

                if (in_array($raw, array('test', 'sandbox', 'yes', '1', 'true'), true)) {
                    return true;
                }

                if (in_array($raw, array('live', 'production', 'no', '0', 'false'), true)) {
                    return false;
                }
            }
        }

        return null;
    }

    /**
     * Attempt to detect live/test API tokens from installed Shippo plugin options.
     *
     * @return array{live:string,test:string}
     */
    protected static function detect_shippo_tokens_from_existing_plugin() {
        $result = array(
            'live' => '',
            'test' => '',
        );

        $candidates = self::get_existing_shippo_option_candidates();

        foreach ($candidates as $option_name => $value) {
            if (!is_array($value)) {
                continue;
            }

            $flat = self::flatten_array_keys($value);

            foreach ($flat as $key => $raw) {
                if (!is_scalar($raw)) {
                    continue;
                }

                $key_lc = strtolower((string) $key);
                $val    = trim((string) $raw);

                if ($val === '') {
                    continue;
                }

                if (
                    $result['test'] === '' &&
                    (
                        strpos($key_lc, 'testapitoken') !== false ||
                        strpos($key_lc, 'test_api_key') !== false ||
                        strpos($key_lc, 'test_token') !== false ||
                        strpos($key_lc, 'sandbox_api_key') !== false ||
                        strpos($key_lc, 'sandbox_token') !== false
                    )
                ) {
                    $result['test'] = $val;
                    continue;
                }

                if (
                    $result['live'] === '' &&
                    (
                        strpos($key_lc, 'liveapitoken') !== false ||
                        strpos($key_lc, 'live_api_key') !== false ||
                        strpos($key_lc, 'live_token') !== false ||
                        (
                            strpos($key_lc, 'shippo') !== false &&
                            (
                                strpos($key_lc, 'api_key') !== false ||
                                strpos($key_lc, 'api_token') !== false ||
                                strpos($key_lc, 'token') !== false
                            )
                        )
                    )
                ) {
                    $result['live'] = $val;
                    continue;
                }
            }
        }

        return $result;
    }

    /**
     * Gather likely Shippo plugin option records from wp_options.
     *
     * @return array
     */
    protected static function get_existing_shippo_option_candidates() {
        global $wpdb;

        $results = array();

        $like_patterns = array(
            'shippo',
            'wc_shippo',
            'one_team_shippo',
            'oneteamsoft',
        );

        foreach ($like_patterns as $pattern) {
            $rows = $wpdb->get_results(
                $wpdb->prepare(
                    "
                    SELECT option_name, option_value
                    FROM {$wpdb->options}
                    WHERE option_name LIKE %s
                    ",
                    '%' . $wpdb->esc_like($pattern) . '%'
                ),
                ARRAY_A
            );

            if (empty($rows)) {
                continue;
            }

            foreach ($rows as $row) {
                $name  = isset($row['option_name']) ? (string) $row['option_name'] : '';
                $value = isset($row['option_value']) ? maybe_unserialize($row['option_value']) : null;

                if ($name === '' || isset($results[$name])) {
                    continue;
                }

                $results[$name] = $value;
            }
        }

        return $results;
    }

    /**
     * Flatten nested option arrays into key => scalar value map.
     *
     * @param array  $array
     * @param string $prefix
     * @return array
     */
    protected static function flatten_array_keys(array $array, $prefix = '') {
        $flat = array();

        foreach ($array as $key => $value) {
            $key = (string) $key;
            $composed = $prefix === '' ? $key : $prefix . '.' . $key;

            if (is_array($value)) {
                $flat = array_merge($flat, self::flatten_array_keys($value, $composed));
                continue;
            }

            $flat[$key] = $value;
            $flat[$composed] = $value;
        }

        return $flat;
    }

    
}