<?php
/**
 * SHOSHIN — Multi-Package Shipping Isolation Layer
 *
 * Purpose:
 * - Keep current baseline intact
 * - Split cart into fulfillment packages
 * - warehouse      => delayed-batch, immediate, and fallback for unknown physical items
 * - pod_vendor_1   => pod-*
 * - excluded       => download (no shipping package)
 *
 * Rules:
 * - One Woo order, multiple shipping packages
 * - Shippo only on warehouse package
 * - Flat rate only on pod_vendor_1 package
 * - POD flat rate is per package/order, never cumulative per item
 * - Digital/download items are excluded from shipping packages entirely
 */

if (!defined('ABSPATH')) {
	exit;
}

/* ---------------------------------------------------------
   BOOTSTRAP
--------------------------------------------------------- */

add_action('init', 'shoshin_mp_bootstrap', 100);

function shoshin_mp_bootstrap() {
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
}

/* ---------------------------------------------------------
   CLASSIFICATION HELPERS
--------------------------------------------------------- */

if (!function_exists('shoshin_mp_normalize_shipping_class')) {
	function shoshin_mp_normalize_shipping_class($product) {
		if (!$product || !is_a($product, 'WC_Product')) {
			return '';
		}

		return sanitize_title((string) $product->get_shipping_class());
	}
}

if (!function_exists('shoshin_mp_get_fulfillment_group_for_product')) {
	function shoshin_mp_get_fulfillment_group_for_product($product) {
		if (!$product || !is_a($product, 'WC_Product')) {
			return 'warehouse';
		}

		/*
		 * Non-shippable products never belong in shipping packages.
		 */
		if (!$product->needs_shipping()) {
			return 'excluded';
		}

		$shipping_class = shoshin_mp_normalize_shipping_class($product);

		/*
		 * Locked authoritative mapping:
		 * delayed-batch -> warehouse
		 * immediate     -> warehouse
		 * pod-*         -> pod_vendor_1
		 * download      -> excluded
		 * no class      -> warehouse (fallback)
		 */

		if ($shipping_class === 'download') {
			return 'excluded';
		}

		if (strpos($shipping_class, 'pod-') === 0) {
			return 'pod_vendor_1';
		}

		if ($shipping_class === 'delayed-batch' || $shipping_class === 'immediate') {
			return 'warehouse';
		}

		/*
		 * Fallback rule: any unknown shippable physical item defaults to warehouse.
		 */
		return 'warehouse';
	}
}

/* ---------------------------------------------------------
   PACKAGE SPLITTING
--------------------------------------------------------- */

add_filter('woocommerce_cart_shipping_packages', 'shoshin_mp_split_cart_shipping_packages', 100);

function shoshin_mp_split_cart_shipping_packages($packages) {
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

	$customer = WC()->customer;

	$base_package = array(
		'contents'        => array(),
		'contents_cost'   => 0,
		'applied_coupons' => WC()->cart->get_applied_coupons(),
		'user'            => array(
			'ID' => get_current_user_id()
		),
		'destination'     => array(
			'country'   => $customer ? $customer->get_shipping_country() : '',
			'state'     => $customer ? $customer->get_shipping_state() : '',
			'postcode'  => $customer ? $customer->get_shipping_postcode() : '',
			'city'      => $customer ? $customer->get_shipping_city() : '',
			'address'   => $customer ? $customer->get_shipping_address() : '',
			'address_1' => $customer ? $customer->get_shipping_address() : '',
			'address_2' => $customer ? $customer->get_shipping_address_2() : ''
		)
	);

	$grouped = array(
		'warehouse'    => $base_package,
		'pod_vendor_1' => $base_package
	);

	foreach ($cart as $cart_item_key => $cart_item) {
		if (empty($cart_item['data']) || !is_a($cart_item['data'], 'WC_Product')) {
			continue;
		}

		$product = $cart_item['data'];
		$group   = shoshin_mp_get_fulfillment_group_for_product($product);

		/*
		 * Digital / excluded items do not create or enter shipping packages.
		 */
		if ($group === 'excluded') {
			continue;
		}

		if (empty($grouped[$group]) || !is_array($grouped[$group])) {
			$grouped[$group] = $base_package;
		}

		$grouped[$group]['contents'][$cart_item_key] = $cart_item;

		$line_total = 0;
		if (isset($cart_item['line_total'])) {
			$line_total = (float) $cart_item['line_total'];
		} elseif (isset($cart_item['data']) && isset($cart_item['quantity'])) {
			$line_total = (float) $cart_item['data']->get_price() * (float) $cart_item['quantity'];
		}

		$grouped[$group]['contents_cost'] += $line_total;
	}

	$final_packages = array();
	$package_index  = 0;

	foreach (array('warehouse', 'pod_vendor_1') as $group_key) {
		if (empty($grouped[$group_key]['contents'])) {
			continue;
		}

		$grouped[$group_key]['shoshin_fulfillment_group'] = $group_key;
		$grouped[$group_key]['package_id']                = $package_index;
		$grouped[$group_key]['name']                      = $group_key;

		$final_packages[] = $grouped[$group_key];
		$package_index++;
	}

	return $final_packages;
}

/* ---------------------------------------------------------
   RATE IDENTIFICATION HELPERS
--------------------------------------------------------- */

if (!function_exists('shoshin_mp_rate_is_shippo')) {
	function shoshin_mp_rate_is_shippo($rate) {
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
}

if (!function_exists('shoshin_mp_rate_is_flat_rate')) {
	function shoshin_mp_rate_is_flat_rate($rate) {
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
}

if (!function_exists('shoshin_mp_sync_chosen_shipping_methods')) {
	function shoshin_mp_sync_chosen_shipping_methods($rates, $package) {
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
}

/* ---------------------------------------------------------
   RATE ISOLATION
--------------------------------------------------------- */

add_filter('woocommerce_package_rates', 'shoshin_mp_filter_package_rates_by_fulfillment_group', 200, 2);

function shoshin_mp_filter_package_rates_by_fulfillment_group($rates, $package) {
	if (is_admin() && !defined('DOING_AJAX')) {
		return $rates;
	}

	$group = isset($package['shoshin_fulfillment_group'])
		? (string) $package['shoshin_fulfillment_group']
		: '';

	if ($group === '') {
		return $rates;
	}

	foreach ($rates as $rate_id => $rate) {
		$is_shippo    = shoshin_mp_rate_is_shippo($rate);
		$is_flat_rate = shoshin_mp_rate_is_flat_rate($rate);

		/*
		 * warehouse => Shippo only
		 */
		if ($group === 'warehouse') {
			if ($is_flat_rate) {
				unset($rates[$rate_id]);
				continue;
			}
		}

		/*
		 * pod_vendor_1 => flat rate only
		 */
		if ($group === 'pod_vendor_1') {
			if ($is_shippo) {
				unset($rates[$rate_id]);
				continue;
			}

			if (!$is_flat_rate) {
				unset($rates[$rate_id]);
				continue;
			}
		}
	}

	/*
	 * POD flat rate must remain per package/order, never cumulative per item.
	 * Preserve the flat-rate base cost as returned by Woo settings.
	 */
	if ($group === 'pod_vendor_1') {
		foreach ($rates as $rate_id => $rate) {
			if (!shoshin_mp_rate_is_flat_rate($rate)) {
				continue;
			}

			$base_cost = isset($rate->cost) ? (float) $rate->cost : 0.0;
			$rate->cost = $base_cost;
			$rates[$rate_id] = $rate;
		}
	}

	shoshin_mp_sync_chosen_shipping_methods($rates, $package);

	return $rates;
}


add_filter('woocommerce_package_rates', 'shoshin_mp_force_pod_cart_rate_visibility', 999, 2);

function shoshin_mp_force_pod_cart_rate_visibility($rates, $package) {
	if (is_admin() && !defined('DOING_AJAX')) {
		return $rates;
	}

	if (!function_exists('is_cart') || !is_cart()) {
		return $rates;
	}

	$group = isset($package['shoshin_fulfillment_group'])
		? (string) $package['shoshin_fulfillment_group']
		: '';

	if ($group !== 'pod_vendor_1') {
		return $rates;
	}

	/*
	 * If a flat rate already exists, keep only the flat rate.
	 */
	$flat_rates = array();

	foreach ($rates as $rate_id => $rate) {
		$method_id = method_exists($rate, 'get_method_id') ? (string) $rate->get_method_id() : '';
		$label     = method_exists($rate, 'get_label') ? (string) $rate->get_label() : '';

		$rate_id_lc   = strtolower((string) $rate_id);
		$method_id_lc = strtolower(trim($method_id));
		$label_lc     = strtolower(trim($label));

		if (
			$method_id_lc === 'flat_rate' ||
			strpos($rate_id_lc, 'flat_rate') !== false ||
			strpos($label_lc, 'flat rate') !== false
		) {
			$flat_rates[$rate_id] = $rate;
		}
	}

	if (!empty($flat_rates)) {
		return $flat_rates;
	}

	/*
	 * Synthesize the POD flat rate directly from the matched zone.
	 * This avoids Woo's generic "updated during checkout" placeholder
	 * for the POD package in cart.
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

		/*
		 * Skip historical / disabled-looking Express flat rate titles.
		 * We only want your standard POD flat rate.
		 */
		$title = !empty($method->title) ? (string) $method->title : 'Flat Rate Shipping';
		$title_lc = strtolower(trim($title));

		if (strpos($title_lc, 'express') !== false) {
			continue;
		}

		/*
		 * Read the configured base cost directly from instance settings.
		 * This preserves "per package/order" behavior and avoids qty multiplication.
		 */
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
			)
		);
	}

	return $rates;
}

add_filter('woocommerce_cart_shipping_packages', 'shoshin_mp_reorder_shipping_packages_for_display', 1000);

function shoshin_mp_reorder_shipping_packages_for_display($packages) {

	$pod = [];
	$warehouse = [];
	$other = [];

	foreach ($packages as $package) {
		$group = $package['shoshin_fulfillment_group'] ?? '';

		if ($group === 'pod_vendor_1') {
			$pod[] = $package;
		} elseif ($group === 'warehouse') {
			$warehouse[] = $package;
		} else {
			$other[] = $package;
		}
	}

	$ordered = array_merge($pod, $warehouse, $other);

	foreach ($ordered as $i => $p) {
		$ordered[$i]['package_id'] = $i;
	}

	return $ordered;
}

add_filter('woocommerce_shipping_show_shipping_calculator', 'shoshin_mp_hide_cart_shipping_calculator_for_pod_only', 100);

function shoshin_mp_hide_cart_shipping_calculator_for_pod_only($show) {
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

	$has_pod = false;
	$has_warehouse = false;

	foreach ($packages as $package) {
		$group = isset($package['shoshin_fulfillment_group'])
			? (string) $package['shoshin_fulfillment_group']
			: '';

		if ($group === 'pod_vendor_1') {
			$has_pod = true;
		}

		if ($group === 'warehouse') {
			$has_warehouse = true;
		}
	}

	/*
	 * POD-only cart:
	 * hide Woo's cart shipping calculator link because POD already uses
	 * a fixed flat rate and does not need address-based calculation.
	 *
	 * Mixed cart:
	 * keep the calculator visible for the warehouse package.
	 */
	if ($has_pod && !$has_warehouse) {
		return false;
	}

	return $show;
}