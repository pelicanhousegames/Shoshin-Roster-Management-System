<?php
if (!defined('ABSPATH')) {
    exit;
}

class SSB_Multipackage {

    public static function init() {
        add_action('init', array(__CLASS__, 'bootstrap'), 100);
        add_action('wp_ajax_ssb_get_batch_estimate_state', array(__CLASS__, 'ajax_get_batch_estimate_state'));
        add_action('wp_ajax_nopriv_ssb_get_batch_estimate_state', array(__CLASS__, 'ajax_get_batch_estimate_state'));
        add_action('wp_ajax_ssb_get_batch_estimate', array(__CLASS__, 'ajax_get_batch_estimate'));
        add_action('wp_ajax_nopriv_ssb_get_batch_estimate', array(__CLASS__, 'ajax_get_batch_estimate'));
    }

    public static function bootstrap() {
        if (!class_exists('WooCommerce')) {
            return;
        }

        if (!SSB_Settings::is_multipackage_mode_enabled()) {
            return;
        }

        /*
         * Disable current single-package legacy rate filter if it exists.
         */
        if (function_exists('shoshin_filter_pod_and_shippo_shipping_rates')) {
            remove_filter('woocommerce_package_rates', 'shoshin_filter_pod_and_shippo_shipping_rates', 100);
        }

        /*
         * Disable old POD-only Shippo notice stripper if it exists.
         */
        if (function_exists('shoshin_strip_pod_only_shippo_notices')) {
            remove_action('wp', 'shoshin_strip_pod_only_shippo_notices', 30);
        }

        add_filter('woocommerce_cart_shipping_packages', array(__CLASS__, 'split_cart_shipping_packages'), 100);
        add_filter('woocommerce_package_rates', array(__CLASS__, 'filter_package_rates_by_fulfillment_group'), 200, 2);
        add_filter('woocommerce_package_rates', array(__CLASS__, 'ensure_external_rate_visibility'), 999, 2);
        add_filter('woocommerce_cart_shipping_packages', array(__CLASS__, 'reorder_shipping_packages_for_display'), 1000);
        add_filter('woocommerce_shipping_show_shipping_calculator', array(__CLASS__, 'hide_cart_shipping_calculator_for_non_shippo_only'), 100);
    }

    protected static function get_lane_settings() {
        if (!method_exists('SSB_Settings', 'get_fulfillment_lanes_runtime')) {
            // Backward-compatible fallback if you have not yet exposed a public runtime getter.
            $ref = new ReflectionClass('SSB_Settings');
            if ($ref->hasMethod('get_fulfillment_lanes')) {
                $method = $ref->getMethod('get_fulfillment_lanes');
                $method->setAccessible(true);
                return (array) $method->invoke(null);
            }

            return array(
                'batch'     => array(),
                'immediate' => array(),
                'external'  => array(),
            );
        }

        return (array) SSB_Settings::get_fulfillment_lanes_runtime();
    }

    protected static function get_vendor_shipping_class_map() {
        $map = array();

        if (!method_exists('SSB_Settings', 'get_vendors_runtime')) {
            return $map;
        }

        $vendors = SSB_Settings::get_vendors_runtime();
        if (!is_array($vendors)) {
            return $map;
        }

        foreach ($vendors as $vendor) {
            if (!is_array($vendor)) {
                continue;
            }

            $vendor_code = !empty($vendor['code']) ? sanitize_text_field((string) $vendor['code']) : '';
            $shipping_class_id = !empty($vendor['shipping_class_id']) ? absint($vendor['shipping_class_id']) : 0;

            if ($vendor_code === '' || $shipping_class_id < 1) {
                continue;
            }

            $map[$shipping_class_id] = $vendor_code;
        }

        return $map;
    }

    protected static function get_vendor_label_map() {
        $map = array();

        if (!method_exists('SSB_Settings', 'get_vendors_runtime')) {
            return $map;
        }

        $vendors = SSB_Settings::get_vendors_runtime();
        if (!is_array($vendors)) {
            return $map;
        }

        foreach ($vendors as $vendor) {
            if (!is_array($vendor)) {
                continue;
            }

            $vendor_code = !empty($vendor['code']) ? sanitize_text_field((string) $vendor['code']) : '';
            $company_name = !empty($vendor['company_name']) ? sanitize_text_field((string) $vendor['company_name']) : $vendor_code;

            if ($vendor_code === '') {
                continue;
            }

            $map[$vendor_code] = $company_name;
        }

        return $map;
    }

    protected static function get_product_shipping_class_id($product) {
        if (!$product || !is_a($product, 'WC_Product')) {
            return 0;
        }

        return absint($product->get_shipping_class_id());
    }

    protected static function resolve_lane_for_shipping_class_id($shipping_class_id, array $lane_settings) {
        $shipping_class_id = absint($shipping_class_id);

        if ($shipping_class_id < 1) {
            return 'excluded';
        }

        foreach (array('immediate', 'batch', 'external') as $lane_key) {
            $lane = isset($lane_settings[$lane_key]) && is_array($lane_settings[$lane_key])
                ? $lane_settings[$lane_key]
                : array();

            $assigned_ids = isset($lane['shipping_classes']) && is_array($lane['shipping_classes'])
                ? array_map('absint', $lane['shipping_classes'])
                : array();

            if (in_array($shipping_class_id, $assigned_ids, true)) {
                return $lane_key;
            }
        }

        return 'excluded';
    }

    protected static function external_vendor_is_active_for_lane($vendor_code, array $lane_settings) {
        $vendor_code = sanitize_text_field((string) $vendor_code);

        if ($vendor_code === '') {
            return false;
        }

        $external = isset($lane_settings['external']) && is_array($lane_settings['external'])
            ? $lane_settings['external']
            : array();

        $assigned_vendor_codes = isset($external['vendor_codes']) && is_array($external['vendor_codes'])
            ? array_map('sanitize_text_field', $external['vendor_codes'])
            : array();

        return in_array($vendor_code, $assigned_vendor_codes, true);
    }

    protected static function resolve_group_behavior($lane_key) {
        switch ($lane_key) {
            case 'immediate':
                return 'shippo';

            case 'external':
                return 'external';

            case 'batch':
                return 'deferred';

            default:
                return 'none';
        }
    }

    protected static function build_group_key($lane_key, $vendor_code = '', $shipping_class_id = 0) {
        $lane_key = sanitize_text_field((string) $lane_key);
        $vendor_code = sanitize_text_field((string) $vendor_code);
        $shipping_class_id = absint($shipping_class_id);

        if ($lane_key === 'external') {
            return 'external:' . $vendor_code . ':' . $shipping_class_id;
        }

        if ($lane_key === 'batch') {
            return 'batch:default';
        }

        if ($lane_key === 'immediate') {
            return 'immediate:default';
        }

        return 'excluded';
    }

    protected static function build_group_label($lane_key, $vendor_code = '', $shipping_class_id = 0, array $vendor_label_map = array()) {
        if ($lane_key === 'external') {
            $vendor_name = !empty($vendor_label_map[$vendor_code]) ? $vendor_label_map[$vendor_code] : $vendor_code;
            return $vendor_name !== '' ? 'External Shipment — ' . $vendor_name : 'External Shipment';
        }

        if ($lane_key === 'batch') {
            return 'Batch Production';
        }

        if ($lane_key === 'immediate') {
            return 'Immediate Shipment';
        }

        return 'Shipment';
    }

    protected static function build_base_package() {
        $customer = WC()->customer;

        return array(
            'contents'        => array(),
            'contents_cost'   => 0,
            'applied_coupons' => WC()->cart->get_applied_coupons(),
            'user'            => array(
                'ID' => get_current_user_id(),
            ),
            'destination'     => array(
                'country'   => $customer ? $customer->get_shipping_country() : '',
                'state'     => $customer ? $customer->get_shipping_state() : '',
                'postcode'  => $customer ? $customer->get_shipping_postcode() : '',
                'city'      => $customer ? $customer->get_shipping_city() : '',
                'address'   => $customer ? $customer->get_shipping_address() : '',
                'address_1' => $customer ? $customer->get_shipping_address() : '',
                'address_2' => $customer ? $customer->get_shipping_address_2() : '',
            ),
        );
    }

    protected static function build_deferred_rate($package) {
        $message = 'Shipping calculated at a later date.';

        if (method_exists('SSB_Settings', 'get_fulfillment_lanes_runtime')) {
            $lanes = SSB_Settings::get_fulfillment_lanes_runtime();
            if (!empty($lanes['batch']['customer_shipping_message'])) {
                $message = (string) $lanes['batch']['customer_shipping_message'];
            }
        }

        $rate_id = 'ssb_deferred:' . md5((string) ($package['ssb_group_key'] ?? 'batch:default'));

        return array(
            $rate_id => new WC_Shipping_Rate(
                $rate_id,
                $message,
                0,
                array(),
                'ssb_deferred'
            ),
        );
    }

    public static function split_cart_shipping_packages($packages) {
        if (is_admin() && !defined('DOING_AJAX')) {
            return $packages;
        }

        if (!function_exists('WC') || !WC()->cart) {
            return $packages;
        }

        $cart = WC()->cart->get_cart();

        if (empty($cart) || !is_array($cart)) {
            return $packages;
        }

        $lane_settings = self::get_lane_settings();
        $vendor_class_map = self::get_vendor_shipping_class_map();
        $vendor_label_map = self::get_vendor_label_map();

        $grouped = array();

        foreach ($cart as $cart_item_key => $cart_item) {
            if (empty($cart_item['data']) || !is_a($cart_item['data'], 'WC_Product')) {
                continue;
            }

            $product = $cart_item['data'];

            if (!$product->needs_shipping()) {
                continue;
            }

            $shipping_class_id = self::get_product_shipping_class_id($product);
            $lane_key = self::resolve_lane_for_shipping_class_id($shipping_class_id, $lane_settings);

            if ($lane_key === 'excluded') {
                continue;
            }

            $vendor_code = '';
            if ($lane_key === 'external') {
                $vendor_code = !empty($vendor_class_map[$shipping_class_id]) ? $vendor_class_map[$shipping_class_id] : '';

                /*
                 * External products with unresolved vendor ownership or vendors not enabled on the lane
                 * must never fall through to Shippo.
                 */
                if ($vendor_code === '' || !self::external_vendor_is_active_for_lane($vendor_code, $lane_settings)) {
                    $lane_key = 'batch';
                    $vendor_code = '';
                }
            }

            $group_behavior = self::resolve_group_behavior($lane_key);
            if ($group_behavior === 'none') {
                continue;
            }

            $group_key = self::build_group_key($lane_key, $vendor_code, $shipping_class_id);
            $group_label = self::build_group_label($lane_key, $vendor_code, $shipping_class_id, $vendor_label_map);

            if (empty($grouped[$group_key]) || !is_array($grouped[$group_key])) {
                $grouped[$group_key] = self::build_base_package();
                $grouped[$group_key]['ssb_lane_key']        = $lane_key;
                $grouped[$group_key]['ssb_group_key']       = $group_key;
                $grouped[$group_key]['ssb_group_behavior']  = $group_behavior;
                $grouped[$group_key]['ssb_vendor_code']     = $vendor_code;
                $grouped[$group_key]['ssb_shipping_class_id'] = $lane_key === 'external' ? $shipping_class_id : 0;
                $grouped[$group_key]['ssb_group_label']     = $group_label;
                $grouped[$group_key]['ssb_fulfillment_group'] = $group_key;
                $grouped[$group_key]['name']                = $group_label;
            }

            $grouped[$group_key]['contents'][$cart_item_key] = $cart_item;

            $line_total = 0;
            if (isset($cart_item['line_total'])) {
                $line_total = (float) $cart_item['line_total'];
            } elseif (isset($cart_item['data']) && isset($cart_item['quantity'])) {
                $line_total = (float) $cart_item['data']->get_price() * (float) $cart_item['quantity'];
            }

            $grouped[$group_key]['contents_cost'] += $line_total;
        }

        $final_packages = array_values(array_filter($grouped, function($package) {
            return !empty($package['contents']) && is_array($package['contents']);
        }));

        foreach ($final_packages as $package_index => &$package) {
            $package['package_id'] = $package_index;
        }
        unset($package);

        return $final_packages;
    }

    protected static function rate_is_shippo($rate) {
        if (!$rate || !is_a($rate, 'WC_Shipping_Rate')) {
            return false;
        }

        $method_id = method_exists($rate, 'get_method_id') ? (string) $rate->get_method_id() : '';
        $rate_id   = method_exists($rate, 'get_id') ? (string) $rate->get_id() : '';
        $label     = method_exists($rate, 'get_label') ? (string) $rate->get_label() : '';

        $method_id = strtolower(trim($method_id));
        $rate_id   = strtolower(trim($rate_id));
        $label     = strtolower(trim($label));

        return (
            strpos($method_id, 'shippo') !== false ||
            strpos($rate_id, 'shippo') !== false ||
            strpos($method_id, 'wc-shippo-shipping') !== false ||
            strpos($rate_id, 'wc-shippo-shipping') !== false ||
            strpos($label, 'shippo') !== false
        );
    }

    protected static function rate_is_flat_rate($rate) {
        if (!$rate || !is_a($rate, 'WC_Shipping_Rate')) {
            return false;
        }

        $method_id = method_exists($rate, 'get_method_id') ? (string) $rate->get_method_id() : '';
        $rate_id   = method_exists($rate, 'get_id') ? (string) $rate->get_id() : '';

        $method_id = strtolower(trim($method_id));
        $rate_id   = strtolower(trim($rate_id));

        return (
            $method_id === 'flat_rate' ||
            strpos($rate_id, 'flat_rate') !== false
        );
    }

    protected static function sync_chosen_shipping_methods($rates, $package) {
        if (!function_exists('WC') || !WC()->session) {
            return;
        }

        $package_index = isset($package['package_id']) ? absint($package['package_id']) : 0;

        $chosen = WC()->session->get('chosen_shipping_methods', array());
        $chosen = is_array($chosen) ? $chosen : array();

        $valid_rate_ids = array_keys($rates);

        if (empty($valid_rate_ids)) {
            if (isset($chosen[$package_index])) {
                unset($chosen[$package_index]);
                WC()->session->set('chosen_shipping_methods', $chosen);
            }
            return;
        }

        if (empty($chosen[$package_index]) || !in_array($chosen[$package_index], $valid_rate_ids, true)) {
            $chosen[$package_index] = reset($valid_rate_ids);
            WC()->session->set('chosen_shipping_methods', $chosen);
        }
    }

    public static function filter_package_rates_by_fulfillment_group($rates, $package) {
        if (is_admin() && !defined('DOING_AJAX')) {
            return $rates;
        }

        $behavior = isset($package['ssb_group_behavior'])
            ? (string) $package['ssb_group_behavior']
            : '';

        if ($behavior === '') {
            return $rates;
        }

        if ($behavior === 'deferred') {
            $rates = self::build_deferred_rate($package);
            self::sync_chosen_shipping_methods($rates, $package);
            return $rates;
        }

        foreach ($rates as $rate_id => $rate) {
            $is_shippo = self::rate_is_shippo($rate);

            if ($behavior === 'shippo') {
                if (!$is_shippo) {
                    unset($rates[$rate_id]);
                }
                continue;
            }

            if ($behavior === 'external') {
                if ($is_shippo) {
                    unset($rates[$rate_id]);
                }
                continue;
            }
        }

        self::sync_chosen_shipping_methods($rates, $package);

        return $rates;
    }

    public static function ensure_external_rate_visibility($rates, $package) {
        if (is_admin() && !defined('DOING_AJAX')) {
            return $rates;
        }

        if (!function_exists('is_cart') || !is_cart()) {
            return $rates;
        }

        $behavior = isset($package['ssb_group_behavior'])
            ? (string) $package['ssb_group_behavior']
            : '';

        if ($behavior !== 'external') {
            return $rates;
        }

        /*
         * Preserve whatever non-Shippo shipping methods already survived filtering.
         * Today this will typically be flat rate, but this must remain future-proof.
         */
        if (!empty($rates)) {
            return $rates;
        }

        /*
         * If no external-compatible rates exist, attempt to synthesize a zone flat rate as a safe
         * launch default. This preserves today's expected behavior without hard-locking external
         * to flat rate forever.
         */
        if (!class_exists('WC_Shipping_Zones')) {
            return $rates;
        }

        $zone = WC_Shipping_Zones::get_zone_matching_package($package);

        if (!$zone || !is_a($zone, 'WC_Shipping_Zone')) {
            return $rates;
        }

        $methods = $zone->get_shipping_methods(true);

        if (empty($methods) || !is_array($methods)) {
            return $rates;
        }

        foreach ($methods as $method) {
            if (!$method || !is_a($method, 'WC_Shipping_Flat_Rate')) {
                continue;
            }

            if (!isset($method->enabled) || $method->enabled !== 'yes') {
                continue;
            }

            $title = !empty($method->title) ? (string) $method->title : 'Flat Rate Shipping';
            $settings = method_exists($method, 'get_instance_form_fields') ? $method->instance_settings : array();
            $raw_cost = isset($settings['cost']) ? $settings['cost'] : (isset($method->cost) ? $method->cost : 0);
            $cost     = (float) wc_format_decimal($raw_cost);

            $instance_id = isset($method->instance_id) ? absint($method->instance_id) : 0;
            $rate_id     = 'flat_rate:' . $instance_id;

            return array(
                $rate_id => new WC_Shipping_Rate(
                    $rate_id,
                    $title,
                    $cost,
                    array(),
                    'flat_rate'
                ),
            );
        }

        return $rates;
    }

    public static function reorder_shipping_packages_for_display($packages) {
        $immediate = array();
        $external  = array();
        $batch     = array();
        $other     = array();

        foreach ($packages as $package) {
            $lane_key = isset($package['ssb_lane_key']) ? (string) $package['ssb_lane_key'] : '';

            if ($lane_key === 'immediate') {
                $immediate[] = $package;
            } elseif ($lane_key === 'external') {
                $external[] = $package;
            } elseif ($lane_key === 'batch') {
                $batch[] = $package;
            } else {
                $other[] = $package;
            }
        }

        usort($external, function($a, $b) {
            $a_label = isset($a['ssb_group_label']) ? (string) $a['ssb_group_label'] : '';
            $b_label = isset($b['ssb_group_label']) ? (string) $b['ssb_group_label'] : '';
            return strcasecmp($a_label, $b_label);
        });

        $ordered = array_merge($immediate, $external, $batch, $other);

        foreach ($ordered as $i => $p) {
            $ordered[$i]['package_id'] = $i;
        }

        return $ordered;
    }

        protected static function get_batch_package_from_cart() {
        if (!function_exists('WC') || !WC()->cart) {
            return null;
        }

        $packages = WC()->cart->get_shipping_packages();
        if (empty($packages) || !is_array($packages)) {
            return null;
        }

        foreach ($packages as $package) {
            $lane_key = isset($package['ssb_lane_key']) ? (string) $package['ssb_lane_key'] : '';
            if ($lane_key === 'batch') {
                return $package;
            }
        }

        return null;
    }

    protected static function get_package_destination_hash(array $package) {
        $destination = isset($package['destination']) && is_array($package['destination'])
            ? $package['destination']
            : array();

        return md5(wp_json_encode(array(
            'country'   => isset($destination['country']) ? (string) $destination['country'] : '',
            'state'     => isset($destination['state']) ? (string) $destination['state'] : '',
            'postcode'  => isset($destination['postcode']) ? (string) $destination['postcode'] : '',
            'city'      => isset($destination['city']) ? (string) $destination['city'] : '',
            'address_1' => isset($destination['address_1']) ? (string) $destination['address_1'] : '',
            'address_2' => isset($destination['address_2']) ? (string) $destination['address_2'] : '',
        )));
    }

    protected static function get_package_contents_signature(array $package) {
        $signature_rows = array();

        $contents = isset($package['contents']) && is_array($package['contents'])
            ? $package['contents']
            : array();

        foreach ($contents as $cart_item_key => $cart_item) {
            $product_id = !empty($cart_item['product_id']) ? absint($cart_item['product_id']) : 0;
            $variation_id = !empty($cart_item['variation_id']) ? absint($cart_item['variation_id']) : 0;
            $qty = isset($cart_item['quantity']) ? (int) $cart_item['quantity'] : 0;

            $signature_rows[] = array(
                'cart_item_key' => (string) $cart_item_key,
                'product_id'    => $product_id,
                'variation_id'  => $variation_id,
                'quantity'      => $qty,
            );
        }

        return md5(wp_json_encode($signature_rows));
    }

    protected static function get_batch_package_signature(array $package) {
        return md5(wp_json_encode(array(
            'group_key'         => isset($package['ssb_group_key']) ? (string) $package['ssb_group_key'] : 'batch:default',
            'contents_hash'     => self::get_package_contents_signature($package),
            'destination_hash'  => self::get_package_destination_hash($package),
        )));
    }

    protected static function batch_package_has_known_address(array $package) {
        $destination = isset($package['destination']) && is_array($package['destination'])
            ? $package['destination']
            : array();

        $country = !empty($destination['country']) ? trim((string) $destination['country']) : '';
        $postcode = !empty($destination['postcode']) ? trim((string) $destination['postcode']) : '';

        return ($country !== '' && $postcode !== '');
    }

    protected static function get_batch_estimate_session_key() {
        return 'ssb_batch_estimate_payload';
    }

    protected static function get_saved_batch_estimate_for_package(array $package) {
        if (!function_exists('WC') || !WC()->session) {
            return array();
        }

        $saved = WC()->session->get(self::get_batch_estimate_session_key(), array());
        if (!is_array($saved)) {
            return array();
        }

        $current_signature = self::get_batch_package_signature($package);

        if (empty($saved['signature']) || (string) $saved['signature'] !== $current_signature) {
            WC()->session->set(self::get_batch_estimate_session_key(), null);
            return array();
        }

        return $saved;
    }

    protected static function save_batch_estimate_for_package(array $package, array $estimate) {
        if (!function_exists('WC') || !WC()->session) {
            return;
        }

        $payload = array(
            'signature' => self::get_batch_package_signature($package),
            'estimate'  => $estimate,
        );

        WC()->session->set(self::get_batch_estimate_session_key(), $payload);
    }

    protected static function clear_batch_estimate_session() {
        if (!function_exists('WC') || !WC()->session) {
            return;
        }

        WC()->session->set(self::get_batch_estimate_session_key(), null);
    }

protected static function get_cheapest_shippo_rate_for_batch_package(array $package) {
    if (!function_exists('WC') || !WC()->shipping) {
        return array(
            'success' => false,
            'message' => 'WooCommerce shipping is unavailable.',
        );
    }

    $estimate_package = $package;
    $estimate_package['ssb_group_behavior'] = 'shippo';

    $contents = isset($estimate_package['contents']) && is_array($estimate_package['contents'])
        ? $estimate_package['contents']
        : array();

    $calculated_package = WC()->shipping()->calculate_shipping_for_package(
        $estimate_package,
        isset($package['package_id']) ? absint($package['package_id']) : 0
    );

    $rates = (is_array($calculated_package) && !empty($calculated_package['rates']) && is_array($calculated_package['rates']))
        ? $calculated_package['rates']
        : array();

    if (empty($rates)) {
        return array(
            'success' => false,
            'message' => 'No shipping estimate was returned for this address.',
        );
    }

    $cheapest = null;

    foreach ($rates as $rate) {
        if (!$rate || !is_a($rate, 'WC_Shipping_Rate')) {
            continue;
        }

        if (!self::rate_is_shippo($rate)) {
            continue;
        }

        $amount = method_exists($rate, 'get_cost') ? (float) $rate->get_cost() : 0.0;

        if ($cheapest === null || $amount < $cheapest['amount']) {
            $cheapest = array(
                'service'          => method_exists($rate, 'get_label') ? (string) $rate->get_label() : 'Shipping',
                'amount'           => $amount,
                'currency'         => get_woocommerce_currency(),
                'formatted_amount' => wp_strip_all_tags( wc_price( $amount, array( 'currency' => get_woocommerce_currency() ) ) ),
            );
        }
    }

    if ($cheapest === null) {
        return array(
            'success' => false,
            'message' => 'No shipping estimate was returned for this address.',
        );
    }

    return array(
        'success'  => true,
        'estimate' => $cheapest,
    );
}

    public static function ajax_get_batch_estimate_state() {
        if (!function_exists('WC') || !WC()->cart) {
            wp_send_json_error(array(
                'message' => 'Cart unavailable.',
            ));
        }

        $package = self::get_batch_package_from_cart();

        if (!$package || !is_array($package)) {
            self::clear_batch_estimate_session();

            wp_send_json_success(array(
                'has_batch_package' => false,
                'address_known'     => false,
                'has_estimate'      => false,
            ));
        }

        $saved = self::get_saved_batch_estimate_for_package($package);

        wp_send_json_success(array(
            'has_batch_package' => true,
            'address_known'     => self::batch_package_has_known_address($package),
            'has_estimate'      => !empty($saved['estimate']) && is_array($saved['estimate']),
            'estimate'          => !empty($saved['estimate']) && is_array($saved['estimate']) ? $saved['estimate'] : null,
        ));
    }

    public static function ajax_get_batch_estimate() {
        if (!function_exists('WC') || !WC()->cart) {
            wp_send_json_error(array(
                'message' => 'Cart unavailable.',
            ));
        }

        $package = self::get_batch_package_from_cart();

        if (!$package || !is_array($package)) {
            self::clear_batch_estimate_session();

            wp_send_json_error(array(
                'message' => 'No Batch package is currently available to estimate.',
            ));
        }

        if (!self::batch_package_has_known_address($package)) {
            wp_send_json_error(array(
                'message' => 'A shipping address is required before estimating Batch shipping.',
            ));
        }

        $saved = self::get_saved_batch_estimate_for_package($package);
        if (!empty($saved['estimate']) && is_array($saved['estimate'])) {
            wp_send_json_success(array(
                'estimate' => $saved['estimate'],
            ));
        }

        $estimate_result = self::get_cheapest_shippo_rate_for_batch_package($package);

        if (empty($estimate_result['success'])) {
            wp_send_json_error(array(
                'message' => !empty($estimate_result['message']) ? $estimate_result['message'] : 'No shipping estimate was returned for this address.',
            ));
        }

        self::save_batch_estimate_for_package($package, $estimate_result['estimate']);

        wp_send_json_success(array(
            'estimate' => $estimate_result['estimate'],
        ));
    }

    public static function hide_cart_shipping_calculator_for_non_shippo_only($show) {
        if (is_admin() && !defined('DOING_AJAX')) {
            return $show;
        }

        if (!function_exists('is_cart') || !is_cart()) {
            return $show;
        }

        if (!function_exists('WC') || !WC()->cart) {
            return $show;
        }

        $packages = WC()->cart->get_shipping_packages();

        if (empty($packages) || !is_array($packages)) {
            return $show;
        }

        $has_shippo_behavior = false;

        foreach ($packages as $package) {
            $behavior = isset($package['ssb_group_behavior'])
                ? (string) $package['ssb_group_behavior']
                : '';

            if ($behavior === 'shippo') {
                $has_shippo_behavior = true;
                break;
            }
        }

        if (!$has_shippo_behavior) {
            return false;
        }

        return $show;
    }
}