<?php
if (!defined('ABSPATH')) {
    exit;
}

class SSB_Ajax {

    public static function init() {
    add_action('wp_ajax_ssb_get_rates', [__CLASS__, 'get_rates']);
    add_action('wp_ajax_ssb_get_rate_cache_setting', [__CLASS__, 'get_rate_cache_setting']);
    add_action('wp_ajax_ssb_get_rate_adjustment_settings', [__CLASS__, 'get_rate_adjustment_settings']);
    add_action('wp_ajax_ssb_buy_label', [__CLASS__, 'buy_label']);
    add_action('wp_ajax_ssb_save_packing_note', [__CLASS__, 'save_packing_note']);
    add_action('wp_ajax_ssb_save_label_file_type', [__CLASS__, 'save_label_file_type']);
    add_action('wp_ajax_ssb_save_shipment_options', [__CLASS__, 'save_shipment_options']);
    add_action('wp_ajax_ssb_request_refund', [__CLASS__, 'request_refund']);
    add_action('wp_ajax_ssb_request_return_refund', [__CLASS__, 'request_return_refund']);
    add_action('wp_ajax_ssb_schedule_pickup', [__CLASS__, 'schedule_pickup']);
    add_action('wp_ajax_ssb_preview_return_label', [__CLASS__, 'preview_return_label']);
    add_action('wp_ajax_ssb_create_return_label', [__CLASS__, 'create_return_label']);
    add_action('wp_ajax_ssb_clear_shipment_draft', [__CLASS__, 'clear_shipment_draft']);
    add_action('wp_ajax_ssb_remove_shipment_shell', [__CLASS__, 'remove_shipment_shell']);
    add_action('wp_ajax_ssb_get_split_candidates', [__CLASS__, 'get_split_candidates']);
    add_action('wp_ajax_ssb_save_split_shipment', [__CLASS__, 'save_split_shipment']);
    add_action('wp_ajax_ssb_allocate_unassigned_item', [__CLASS__, 'allocate_unassigned_item']);
    add_action('wp_ajax_ssb_remove_item_allocation', [__CLASS__, 'remove_item_allocation']);
}

    /**
     * Validate request security.
     */
    protected static function validate_request() {

        if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'ssb_admin_nonce')) {
            wp_send_json_error([
                'message' => 'Security check failed.',
                'code'    => 'invalid_nonce'
            ]);
        }

        if (!current_user_can('edit_shop_orders')) {
            wp_send_json_error([
                'message' => 'Permission denied.',
                'code'    => 'permission_denied'
            ]);
        }

        if (empty($_POST['order_id'])) {
            wp_send_json_error([
                'message' => 'Missing order ID.',
                'code'    => 'missing_order_id'
            ]);
        }

        $order = wc_get_order(absint($_POST['order_id']));

        if (!$order) {
            wp_send_json_error([
                'message' => 'Invalid order.',
                'code'    => 'invalid_order'
            ]);
        }

        return $order;
    }

        protected static function get_immediate_group_index(array $groups) {
        if (empty($groups['groups']) || !is_array($groups['groups'])) {
            return -1;
        }

        foreach ($groups['groups'] as $index => $group) {
            if (!empty($group['group_key']) && $group['group_key'] === 'immediate') {
                return (int) $index;
            }
        }

        return -1;
    }

    protected static function get_active_shipment_index(array $shipments) {
        $active_shipment_number = isset($_POST['active_shipment_number'])
            ? sanitize_text_field(wp_unslash($_POST['active_shipment_number']))
            : '';

        if ($active_shipment_number === '' || $active_shipment_number === 'unassigned') {
            return -1;
        }

        $active_shipment_number = absint($active_shipment_number);

        if ($active_shipment_number < 1) {
            return -1;
        }

        foreach ($shipments as $index => $shipment) {
            if (!empty($shipment['shipment_number']) && (int) $shipment['shipment_number'] === $active_shipment_number) {
                return (int) $index;
            }
        }

        return -1;
    }

    protected static function shipment_has_any_labels(array $shipment) {
        $fulfillment = isset($shipment['fulfillment']) && is_array($shipment['fulfillment']) ? $shipment['fulfillment'] : array();
        $labels = !empty($fulfillment['labels']) && is_array($fulfillment['labels']) ? $fulfillment['labels'] : array();
        $return_labels = !empty($fulfillment['return_labels']) && is_array($fulfillment['return_labels']) ? $fulfillment['return_labels'] : array();

        return !empty($labels) || !empty($return_labels);
    }

    protected static function build_empty_shipment_shell($group_key, $shipment_number) {
        return array(
            'shipment_key'    => $group_key . '_shp_' . $shipment_number,
            'shipment_number' => (int) $shipment_number,
            'shipment_status' => 'open',
            'allocations'     => array(),
            'parcel'          => array(
                'package_type'  => 'box',
                'length'        => '',
                'width'         => '',
                'height'        => '',
                'distance_unit' => 'in',
                'weight'        => '',
                'mass_unit'     => 'lb',
            ),
            'draft' => array(
                'shipment_id'      => '',
                'rates'            => array(),
                'selected_rate_id' => '',
                'updated_at'       => '',
            ),
            'fulfillment' => array(
                'labels'        => array(),
                'return_labels' => array(),
            ),
        );
    }

    protected static function get_item_row_index(array $items, $order_item_id) {
        $order_item_id = absint($order_item_id);

        foreach ($items as $index => $item_row) {
            if (!empty($item_row['order_item_id']) && absint($item_row['order_item_id']) === $order_item_id) {
                return (int) $index;
            }
        }

        return -1;
    }

    public static function create_shipment_shell() {
        $order = self::validate_request();

        $groups = SSB_State::get_fulfillment_groups($order);
        $group_index = self::get_immediate_group_index($groups);

        if ($group_index < 0) {
            wp_send_json_error(array(
                'message' => 'No immediate fulfillment group is available for shipment creation.',
                'code'    => 'missing_immediate_group',
            ));
        }

        $shipments = !empty($groups['groups'][$group_index]['shipments']) && is_array($groups['groups'][$group_index]['shipments'])
            ? $groups['groups'][$group_index]['shipments']
            : array();

        $next_number = count($shipments) + 1;
        $new_shipment = self::build_empty_shipment_shell('immediate', $next_number);

        $shipments[] = $new_shipment;
        $groups['groups'][$group_index]['shipments'] = array_values($shipments);

        SSB_State::update_fulfillment_groups($order->get_id(), $groups);

        wp_send_json_success(array(
            'groups' => $groups,
            'active_shipment_number' => $next_number,
        ));
    }

    public static function remove_shipment_shell() {
        $order = self::validate_request();

        $shipment_number = isset($_POST['shipment_number']) ? absint($_POST['shipment_number']) : 0;
        if ($shipment_number < 2) {
            wp_send_json_error(array(
                'message' => 'Shipment 1 cannot be deleted.',
                'code'    => 'immutable_shipment',
            ));
        }

        $groups = SSB_State::get_fulfillment_groups($order);
        $group_index = self::get_immediate_group_index($groups);

        if ($group_index < 0) {
            wp_send_json_error(array(
                'message' => 'No immediate fulfillment group is available.',
                'code'    => 'missing_immediate_group',
            ));
        }

        $items = !empty($groups['groups'][$group_index]['items']) && is_array($groups['groups'][$group_index]['items'])
            ? $groups['groups'][$group_index]['items']
            : array();

        $shipments = !empty($groups['groups'][$group_index]['shipments']) && is_array($groups['groups'][$group_index]['shipments'])
            ? array_values($groups['groups'][$group_index]['shipments'])
            : array();

        $target_index = -1;
        foreach ($shipments as $index => $shipment) {
            if (!empty($shipment['shipment_number']) && (int) $shipment['shipment_number'] === $shipment_number) {
                $target_index = (int) $index;
                break;
            }
        }

        if ($target_index < 0) {
            wp_send_json_error(array(
                'message' => 'Shipment not found.',
                'code'    => 'shipment_not_found',
            ));
        }

        if (self::shipment_has_any_labels($shipments[$target_index])) {
            wp_send_json_error(array(
                'message' => 'All labels for this shipment must be voided before it can be deleted.',
                'code'    => 'shipment_has_labels',
            ));
        }

        $removed_shipment = $shipments[$target_index];
        $removed_alloc_map = array();

        if (!empty($removed_shipment['allocations']) && is_array($removed_shipment['allocations'])) {
            foreach ($removed_shipment['allocations'] as $allocation) {
                $oid = !empty($allocation['order_item_id']) ? absint($allocation['order_item_id']) : 0;
                $qty = isset($allocation['qty']) ? absint($allocation['qty']) : 0;

                if ($oid > 0 && $qty > 0) {
                    if (!isset($removed_alloc_map[$oid])) {
                        $removed_alloc_map[$oid] = 0;
                    }

                    $removed_alloc_map[$oid] += $qty;
                }
            }
        }

        foreach ($items as &$item_row) {
            $oid = !empty($item_row['order_item_id']) ? absint($item_row['order_item_id']) : 0;
            $existing_unassigned = isset($item_row['unassigned_qty']) ? absint($item_row['unassigned_qty']) : 0;
            $returned_qty = !empty($removed_alloc_map[$oid]) ? absint($removed_alloc_map[$oid]) : 0;

            $item_row['unassigned_qty'] = $existing_unassigned + $returned_qty;
        }
        unset($item_row);

        unset($shipments[$target_index]);
        $shipments = array_values($shipments);

        $groups['groups'][$group_index]['items'] = $items;
        $groups['groups'][$group_index]['shipments'] = $shipments;

        $groups = SSB_State::normalize_fulfillment_groups($groups);
        $active_shipment_number = SSB_State::resolve_active_shipment_after_mutation($groups, 'unassigned');

        SSB_State::update_fulfillment_groups($order->get_id(), $groups);

        wp_send_json_success(array(
            'groups' => $groups,
            'active_shipment_number' => $active_shipment_number,
        ));
    }

    protected static function get_split_candidate_rows($order, array $groups) {
        $rows = array();
        $group_index = self::get_immediate_group_index($groups);

        if ($group_index < 0) {
            return $rows;
        }

        $items = !empty($groups['groups'][$group_index]['items']) && is_array($groups['groups'][$group_index]['items'])
            ? $groups['groups'][$group_index]['items']
            : array();

        $shipments = !empty($groups['groups'][$group_index]['shipments']) && is_array($groups['groups'][$group_index]['shipments'])
            ? array_values($groups['groups'][$group_index]['shipments'])
            : array();

        $active_shipment_number = isset($_POST['active_shipment_number'])
            ? sanitize_text_field(wp_unslash($_POST['active_shipment_number']))
            : '';

        $active_allocations = array();
        $source_is_unassigned = ($active_shipment_number === 'unassigned');

        if ($source_is_unassigned) {
            foreach ($items as $item_row) {
                $oid = !empty($item_row['order_item_id']) ? absint($item_row['order_item_id']) : 0;
                $qty = isset($item_row['unassigned_qty']) ? absint($item_row['unassigned_qty']) : 0;

                if ($oid > 0 && $qty > 0) {
                    $active_allocations[$oid] = $qty;
                }
            }
        } else {
            $active_shipment_index = self::get_active_shipment_index($shipments);

            if ($active_shipment_index < 0 || empty($shipments[$active_shipment_index])) {
                return $rows;
            }

            if (!empty($shipments[$active_shipment_index]['allocations']) && is_array($shipments[$active_shipment_index]['allocations'])) {
                foreach ($shipments[$active_shipment_index]['allocations'] as $allocation) {
                    $oid = !empty($allocation['order_item_id']) ? absint($allocation['order_item_id']) : 0;
                    $qty = isset($allocation['qty']) ? absint($allocation['qty']) : 0;

                    if ($oid > 0 && $qty > 0) {
                        $active_allocations[$oid] = $qty;
                    }
                }
            }
        }

        foreach ($items as $item_row) {
            $order_item_id = !empty($item_row['order_item_id']) ? absint($item_row['order_item_id']) : 0;
            $product_id    = !empty($item_row['product_id']) ? absint($item_row['product_id']) : 0;
            $qty_ordered   = isset($item_row['qty_ordered']) ? absint($item_row['qty_ordered']) : 0;
            $available_qty = !empty($active_allocations[$order_item_id]) ? absint($active_allocations[$order_item_id]) : 0;

            if ($order_item_id < 1 || $product_id < 1 || $qty_ordered < 1 || $available_qty < 1) {
                continue;
            }

            $item = $order->get_item($order_item_id);
            $product = wc_get_product($product_id);

            if (!$item || !$product) {
                continue;
            }

            $thumb = $product->get_image(array(36, 36));
            $weight = $product->get_weight() !== '' ? $product->get_weight() . ' lbs' : '—';
            $price = wc_price((float) $item->get_total() / max(1, $qty_ordered), array('currency' => $order->get_currency()));
            $variation_summary = wc_get_formatted_variation($product, true, false, true);
            $variation_summary = $variation_summary ? wp_strip_all_tags($variation_summary) : '—';

            if ($available_qty === 1) {
                $rows[] = array(
                    'row_type'       => 'unit',
                    'order_item_id'  => $order_item_id,
                    'product_id'     => $product_id,
                    'unit_index'     => 1,
                    'product_name'   => $product->get_name(),
                    'thumbnail_html' => $thumb,
                    'qty_label'      => '×1',
                    'variation'      => $variation_summary,
                    'weight'         => $weight,
                    'price_html'     => $price,
                );
                continue;
            }

            $rows[] = array(
                'row_type'       => 'parent',
                'order_item_id'  => $order_item_id,
                'product_id'     => $product_id,
                'unit_index'     => 0,
                'product_name'   => $product->get_name(),
                'thumbnail_html' => $thumb,
                'qty_label'      => '×' . $available_qty,
                'variation'      => $variation_summary,
                'weight'         => $weight,
                'price_html'     => $price,
            );

            for ($i = 1; $i <= $available_qty; $i++) {
                $rows[] = array(
                    'row_type'       => 'child',
                    'order_item_id'  => $order_item_id,
                    'product_id'     => $product_id,
                    'unit_index'     => $i,
                    'product_name'   => $product->get_name(),
                    'thumbnail_html' => $thumb,
                    'qty_label'      => '×1',
                    'variation'      => $variation_summary,
                    'weight'         => $weight,
                    'price_html'     => $price,
                );
            }
        }

        return $rows;
    }

    public static function get_split_candidates() {
        $order = self::validate_request();
        $groups = SSB_State::get_fulfillment_groups($order);

        $group_index = self::get_immediate_group_index($groups);
        $shipments = ($group_index >= 0 && !empty($groups['groups'][$group_index]['shipments']) && is_array($groups['groups'][$group_index]['shipments']))
            ? array_values($groups['groups'][$group_index]['shipments'])
            : array();

        $active_shipment_index = self::get_active_shipment_index($shipments);
        $rows = self::get_split_candidate_rows($order, $groups);

        wp_send_json_success(array(
            'rows' => $rows,
            'debug' => array(
                'group_index' => $group_index,
                'active_shipment_number_posted' => isset($_POST['active_shipment_number']) ? wp_unslash($_POST['active_shipment_number']) : '',
                'active_shipment_index' => $active_shipment_index,
                'shipment_count' => count($shipments),
                'active_shipment_allocations' => ($active_shipment_index >= 0 && !empty($shipments[$active_shipment_index]['allocations']) && is_array($shipments[$active_shipment_index]['allocations']))
                    ? $shipments[$active_shipment_index]['allocations']
                    : array(),
                'immediate_items' => ($group_index >= 0 && !empty($groups['groups'][$group_index]['items']) && is_array($groups['groups'][$group_index]['items']))
                    ? $groups['groups'][$group_index]['items']
                    : array(),
                'row_count' => count($rows),
            ),
        ));
    }

    public static function save_split_shipment() {
        $order = self::validate_request();
        $groups = SSB_State::get_fulfillment_groups($order);
        $group_index = self::get_immediate_group_index($groups);

        if ($group_index < 0) {
            wp_send_json_error(array(
                'message' => 'No immediate fulfillment group is available for split shipment.',
                'code'    => 'missing_immediate_group',
            ));
        }

        $selected_units = isset($_POST['selected_units']) && is_array($_POST['selected_units'])
            ? array_values($_POST['selected_units'])
            : array();

        if (empty($selected_units)) {
            wp_send_json_error(array(
                'message' => 'Select at least one unit to move into a new shipment.',
                'code'    => 'nothing_selected',
            ));
        }

        $normalized_units = array();
        foreach ($selected_units as $unit_key) {
            $unit_key = sanitize_text_field(wp_unslash($unit_key));
            if (preg_match('/^(\d+):(\d+)$/', $unit_key, $m)) {
                $normalized_units[] = array(
                    'order_item_id' => absint($m[1]),
                    'unit_index'    => absint($m[2]),
                );
            }
        }

        if (empty($normalized_units)) {
            wp_send_json_error(array(
                'message' => 'No valid split units were provided.',
                'code'    => 'invalid_selection',
            ));
        }

        $items = !empty($groups['groups'][$group_index]['items']) && is_array($groups['groups'][$group_index]['items'])
            ? array_values($groups['groups'][$group_index]['items'])
            : array();

        $shipments = !empty($groups['groups'][$group_index]['shipments']) && is_array($groups['groups'][$group_index]['shipments'])
            ? array_values($groups['groups'][$group_index]['shipments'])
            : array();

        if (empty($shipments)) {
            $shipments[] = self::build_empty_shipment_shell('immediate', 1);
        }

        $active_shipment_number = isset($_POST['active_shipment_number'])
            ? sanitize_text_field(wp_unslash($_POST['active_shipment_number']))
            : '';

        $source_is_unassigned = ($active_shipment_number === 'unassigned');

        $selected_counts = array();
        foreach ($normalized_units as $unit) {
            $oid = $unit['order_item_id'];
            if (!isset($selected_counts[$oid])) {
                $selected_counts[$oid] = 0;
            }
            $selected_counts[$oid]++;
        }

        $current_alloc_map = array();
        $active_shipment_index = -1;
        $active_shipment = array();

        if ($source_is_unassigned) {
            foreach ($items as $item_row) {
                $oid = !empty($item_row['order_item_id']) ? absint($item_row['order_item_id']) : 0;
                $qty = isset($item_row['unassigned_qty']) ? absint($item_row['unassigned_qty']) : 0;

                if ($oid > 0 && $qty > 0) {
                    $current_alloc_map[$oid] = $qty;
                }
            }
        } else {
            $active_shipment_index = self::get_active_shipment_index($shipments);

            if ($active_shipment_index < 0 || empty($shipments[$active_shipment_index])) {
                wp_send_json_error(array(
                    'message' => 'Select a valid active shipment before splitting.',
                    'code'    => 'invalid_active_shipment',
                ));
            }

            $active_shipment = $shipments[$active_shipment_index];

            if (self::shipment_has_any_labels($active_shipment)) {
                wp_send_json_error(array(
                    'message' => 'This shipment must be voided before allocations can be changed.',
                    'code'    => 'shipment_has_labels',
                ));
            }

            if (!empty($active_shipment['allocations']) && is_array($active_shipment['allocations'])) {
                foreach ($active_shipment['allocations'] as $allocation) {
                    $oid = !empty($allocation['order_item_id']) ? absint($allocation['order_item_id']) : 0;
                    $qty = isset($allocation['qty']) ? absint($allocation['qty']) : 0;

                    if ($oid > 0 && $qty > 0) {
                        $current_alloc_map[$oid] = $qty;
                    }
                }
            }
        }

        if (empty($current_alloc_map)) {
            wp_send_json_error(array(
                'message' => $source_is_unassigned
                    ? 'There are no unassigned items available to create a shipment.'
                    : 'The active shipment has no allocated items to split.',
                'code'    => 'empty_active_source',
            ));
        }

        foreach ($selected_counts as $oid => $move_count) {
            $available = !empty($current_alloc_map[$oid]) ? absint($current_alloc_map[$oid]) : 0;

            if ($move_count < 1 || $move_count > $available) {
                wp_send_json_error(array(
                    'message' => 'One or more selected units are no longer available in the active source.',
                    'code'    => 'invalid_split_quantity',
                ));
            }
        }

        if ($source_is_unassigned) {
            foreach ($items as &$item_row) {
                $oid = !empty($item_row['order_item_id']) ? absint($item_row['order_item_id']) : 0;
                $move_count = !empty($selected_counts[$oid]) ? absint($selected_counts[$oid]) : 0;

                if ($move_count > 0) {
                    $existing_unassigned = isset($item_row['unassigned_qty']) ? absint($item_row['unassigned_qty']) : 0;
                    $item_row['unassigned_qty'] = max(0, $existing_unassigned - $move_count);
                }
            }
            unset($item_row);
        } else {
            $rebuilt_active_allocations = array();
            foreach ($current_alloc_map as $oid => $allocated_qty) {
                $move_count = !empty($selected_counts[$oid]) ? absint($selected_counts[$oid]) : 0;
                $remaining_qty = max(0, $allocated_qty - $move_count);

                if ($remaining_qty > 0) {
                    $rebuilt_active_allocations[] = array(
                        'order_item_id' => (int) $oid,
                        'qty'           => $remaining_qty,
                    );
                }
            }

            $active_shipment['allocations'] = $rebuilt_active_allocations;
            $shipments[$active_shipment_index] = $active_shipment;
        }

        $new_number = count($shipments) + 1;
        $new_shipment = self::build_empty_shipment_shell('immediate', $new_number);

        foreach ($selected_counts as $oid => $move_count) {
            if ($move_count > 0) {
                $new_shipment['allocations'][] = array(
                    'order_item_id' => (int) $oid,
                    'qty'           => (int) $move_count,
                );
            }
        }

        $shipments[] = $new_shipment;
        $groups['groups'][$group_index]['items'] = array_values($items);
        $groups['groups'][$group_index]['shipments'] = array_values($shipments);

        $groups = SSB_State::normalize_fulfillment_groups($groups);

        SSB_State::update_fulfillment_groups($order->get_id(), $groups);

        wp_send_json_success(array(
            'groups' => $groups,
            'active_shipment_number' => $source_is_unassigned ? 'unassigned' : $active_shipment_number,
            'debug' => array(
                'posted_active_shipment_number' => isset($_POST['active_shipment_number']) ? wp_unslash($_POST['active_shipment_number']) : '',
                'resolved_active_shipment_index' => $active_shipment_index,
                'resolved_active_shipment_number' => !empty($active_shipment['shipment_number']) ? (int) $active_shipment['shipment_number'] : 0,
                'selected_counts' => $selected_counts,
                'source_is_unassigned' => $source_is_unassigned,
                'new_shipment_allocations' => $new_shipment['allocations'],
            ),
        ));
    }

    protected static function get_money_setting($option_name, $default = '0.00') {
        $raw = get_option($option_name, $default);
        $raw = is_scalar($raw) ? (string) $raw : '';
        $raw = trim($raw);

        if ($raw === '') {
            $raw = (string) $default;
        }

        $raw = str_replace(',', '', $raw);

        if (!is_numeric($raw)) {
            $raw = (string) $default;
        }

        $value = (float) $raw;

        if ($value < 0) {
            $value = 0;
        }

        return number_format($value, 2, '.', '');
    }

        protected static function get_checkbox_post_value($key) {
        return !empty($_POST[$key]) && wp_unslash($_POST[$key]) === '1';
    }

    protected static function get_return_label_options_from_post() {
        $dry_ice_weight_kg = isset($_POST['dry_ice_weight_kg']) ? trim((string) wp_unslash($_POST['dry_ice_weight_kg'])) : '';

        return array(
            'contains_alcohol'     => self::get_checkbox_post_value('contains_alcohol'),
            'contains_dry_ice'     => self::get_checkbox_post_value('contains_dry_ice'),
            'contains_hazmat'      => self::get_checkbox_post_value('contains_hazmat'),
            'additional_insurance' => self::get_checkbox_post_value('additional_insurance'),
            'dry_ice_weight_kg'    => $dry_ice_weight_kg,
        );
    }

    protected static function get_declared_merchandise_value($order) {
        $total = 0.0;

        foreach ($order->get_items('line_item') as $item) {
            $product = $item->get_product();
            if (!$product || !$product->needs_shipping()) {
                continue;
            }

            $line_total = (float) $item->get_total();
            if ($line_total > 0) {
                $total += $line_total;
            }
        }

        return max(0, $total);
    }

    protected static function get_service_key($provider, $service) {
        $provider = strtoupper(trim((string) $provider));
        $service  = strtolower(trim((string) $service));
        $service  = preg_replace('/[®™]/u', '', $service);
        $service  = preg_replace('/\s+/', ' ', $service);

        if ($provider === 'USPS') {
            if (strpos($service, 'ground advantage') !== false) return 'usps_ground_advantage';
            if (strpos($service, 'priority mail express') !== false || strpos($service, 'express mail') !== false) return 'usps_express_mail';
            if (strpos($service, 'priority mail') !== false) return 'usps_priority_mail';
            if (strpos($service, 'media mail') !== false) return 'usps_media_mail';
        }

        if ($provider === 'UPS') {
            if (strpos($service, 'ground saver') !== false) return 'ups_ground_saver';
            if (strpos($service, '3 day select') !== false) return 'ups_3_day_select';
            if (strpos($service, '2nd day air') !== false || strpos($service, 'second day air') !== false) return 'ups_2nd_day_air';
            if (strpos($service, 'next day air early') !== false) return 'ups_next_day_air_early';
            if (strpos($service, 'next day air saver') !== false) return 'ups_next_day_air_saver';
            if (strpos($service, 'next day air') !== false) return 'ups_next_day_air';
            if ($service === 'ground' || strpos($service, 'ups ground') !== false) return 'ups_ground';
        }

        return '';
    }

    protected static function get_included_coverage_amount($provider, $service) {
        $key = self::get_service_key($provider, $service);

        if ($key === 'ups_ground_saver') {
            return 20.0;
        }

        if (in_array($key, array(
            'usps_ground_advantage',
            'usps_priority_mail',
            'usps_express_mail',
            'ups_ground',
            'ups_3_day_select',
            'ups_2nd_day_air',
            'ups_next_day_air_saver',
            'ups_next_day_air',
            'ups_next_day_air_early',
        ), true)) {
            return 100.0;
        }

        return 0.0;
    }

    protected static function get_preview_capabilities($provider, $declared_value, $included_coverage) {
        $provider = strtoupper(trim((string) $provider));

        return array(
            'supports_alcohol'   => in_array($provider, array('UPS', 'FEDEX'), true),
            'supports_dry_ice'   => in_array($provider, array('UPS', 'FEDEX'), true),
            'supports_hazmat'    => ($provider === 'USPS'),
            'supports_insurance' => in_array($provider, array('UPS', 'FEDEX', 'USPS'), true),
            'insurance_eligible' => ($declared_value > $included_coverage),
        );
    }

    protected static function get_insurance_charge_for_preview($provider, $service, $declared_value, $selected) {
        if (!$selected) {
            return 0.0;
        }

        $included = self::get_included_coverage_amount($provider, $service);
        $additional = max(0, $declared_value - $included);

        if ($additional <= 0) {
            return 0.0;
        }

        $per_100 = 0.0;
        $provider = strtoupper(trim((string) $provider));

        if ($provider === 'USPS') {
            $per_100 = (float) self::get_money_setting('ssb_usps_insurance', '0.00');
        } elseif ($provider === 'UPS') {
            $per_100 = (float) self::get_money_setting('ssb_ups_insurance', '0.00');
        }

        if ($per_100 <= 0) {
            return 0.0;
        }

        return ceil($additional / 100) * $per_100;
    }

        public static function allocate_unassigned_item() {
        $order = self::validate_request();
        $groups = SSB_State::get_fulfillment_groups($order);
        $group_index = self::get_immediate_group_index($groups);

        if ($group_index < 0) {
            wp_send_json_error(array(
                'message' => 'No immediate fulfillment group is available.',
                'code'    => 'missing_immediate_group',
            ));
        }

        $order_item_id = isset($_POST['order_item_id']) ? absint($_POST['order_item_id']) : 0;
        $qty = isset($_POST['qty']) ? absint($_POST['qty']) : 0;
        $target = isset($_POST['target_shipment_number']) ? sanitize_text_field(wp_unslash($_POST['target_shipment_number'])) : '';

        if ($order_item_id < 1 || $qty < 1) {
            wp_send_json_error(array(
                'message' => 'A valid item and quantity are required.',
                'code'    => 'invalid_allocate_request',
            ));
        }

        $items = !empty($groups['groups'][$group_index]['items']) && is_array($groups['groups'][$group_index]['items'])
            ? array_values($groups['groups'][$group_index]['items'])
            : array();

        $shipments = !empty($groups['groups'][$group_index]['shipments']) && is_array($groups['groups'][$group_index]['shipments'])
            ? array_values($groups['groups'][$group_index]['shipments'])
            : array();

        if (empty($shipments)) {
            $shipments[] = self::build_empty_shipment_shell('immediate', 1);
        }

        $item_index = self::get_item_row_index($items, $order_item_id);
        if ($item_index < 0) {
            wp_send_json_error(array(
                'message' => 'Item not found in the immediate fulfillment group.',
                'code'    => 'item_not_found',
            ));
        }

        $available_unassigned = isset($items[$item_index]['unassigned_qty']) ? absint($items[$item_index]['unassigned_qty']) : 0;
        if ($qty > $available_unassigned) {
            wp_send_json_error(array(
                'message' => 'The requested quantity exceeds the current unassigned pool.',
                'code'    => 'insufficient_unassigned_qty',
            ));
        }

        if ($target === 'new') {
            $target_shipment_number = count($shipments) + 1;
            $shipments[] = self::build_empty_shipment_shell('immediate', $target_shipment_number);
            $target_index = count($shipments) - 1;
        } else {
            $target_shipment_number = absint($target);
            $target_index = -1;

            foreach ($shipments as $index => $shipment) {
                if (!empty($shipment['shipment_number']) && (int) $shipment['shipment_number'] === $target_shipment_number) {
                    $target_index = (int) $index;
                    break;
                }
            }

            if ($target_index < 0) {
                wp_send_json_error(array(
                    'message' => 'Select a valid target shipment.',
                    'code'    => 'invalid_target_shipment',
                ));
            }

            if (self::shipment_has_any_labels($shipments[$target_index])) {
                wp_send_json_error(array(
                    'message' => 'This shipment must be voided before allocations can be changed.',
                    'code'    => 'shipment_has_labels',
                ));
            }
        }

        $items[$item_index]['unassigned_qty'] = max(0, $available_unassigned - $qty);

        $found_allocation = false;
        $allocations = !empty($shipments[$target_index]['allocations']) && is_array($shipments[$target_index]['allocations'])
            ? $shipments[$target_index]['allocations']
            : array();

        foreach ($allocations as &$allocation) {
            if (!empty($allocation['order_item_id']) && absint($allocation['order_item_id']) === $order_item_id) {
                $allocation['qty'] = absint($allocation['qty']) + $qty;
                $found_allocation = true;
                break;
            }
        }
        unset($allocation);

        if (!$found_allocation) {
            $allocations[] = array(
                'order_item_id' => $order_item_id,
                'qty'           => $qty,
            );
        }

        $shipments[$target_index]['allocations'] = array_values($allocations);

        $groups['groups'][$group_index]['items'] = array_values($items);
        $groups['groups'][$group_index]['shipments'] = array_values($shipments);

        $groups = SSB_State::normalize_fulfillment_groups($groups);
        SSB_State::update_fulfillment_groups($order->get_id(), $groups);

        wp_send_json_success(array(
            'groups' => $groups,
            'active_shipment_number' => 'unassigned',
        ));
    }

    public static function remove_item_allocation() {
        $order = self::validate_request();
        $groups = SSB_State::get_fulfillment_groups($order);
        $group_index = self::get_immediate_group_index($groups);

        if ($group_index < 0) {
            wp_send_json_error(array(
                'message' => 'No immediate fulfillment group is available.',
                'code'    => 'missing_immediate_group',
            ));
        }

        $order_item_id = isset($_POST['order_item_id']) ? absint($_POST['order_item_id']) : 0;
        $qty = isset($_POST['qty']) ? absint($_POST['qty']) : 0;
        $shipment_number = isset($_POST['shipment_number']) ? absint($_POST['shipment_number']) : 0;

        if ($order_item_id < 1 || $qty < 1 || $shipment_number < 1) {
            wp_send_json_error(array(
                'message' => 'A valid shipment, item, and quantity are required.',
                'code'    => 'invalid_remove_request',
            ));
        }

        $items = !empty($groups['groups'][$group_index]['items']) && is_array($groups['groups'][$group_index]['items'])
            ? array_values($groups['groups'][$group_index]['items'])
            : array();

        $shipments = !empty($groups['groups'][$group_index]['shipments']) && is_array($groups['groups'][$group_index]['shipments'])
            ? array_values($groups['groups'][$group_index]['shipments'])
            : array();

        $shipment_index = -1;
        foreach ($shipments as $index => $shipment) {
            if (!empty($shipment['shipment_number']) && (int) $shipment['shipment_number'] === $shipment_number) {
                $shipment_index = (int) $index;
                break;
            }
        }

        if ($shipment_index < 0) {
            wp_send_json_error(array(
                'message' => 'Shipment not found.',
                'code'    => 'shipment_not_found',
            ));
        }

        if (self::shipment_has_any_labels($shipments[$shipment_index])) {
            wp_send_json_error(array(
                'message' => 'This shipment must be voided before allocations can be changed.',
                'code'    => 'shipment_has_labels',
            ));
        }

        if (count($shipments) === 1 && empty(array_filter($items, function ($item) {
            return !empty($item['unassigned_qty']);
        }))) {
            wp_send_json_error(array(
                'message' => 'Allocation removal is disabled in the default single-shipment state.',
                'code'    => 'remove_allocation_disabled',
            ));
        }

        $allocations = !empty($shipments[$shipment_index]['allocations']) && is_array($shipments[$shipment_index]['allocations'])
            ? array_values($shipments[$shipment_index]['allocations'])
            : array();

        $found = false;
        foreach ($allocations as $index => $allocation) {
            if (!empty($allocation['order_item_id']) && absint($allocation['order_item_id']) === $order_item_id) {
                $existing_qty = isset($allocation['qty']) ? absint($allocation['qty']) : 0;

                if ($qty > $existing_qty) {
                    wp_send_json_error(array(
                        'message' => 'The requested quantity exceeds the current allocation.',
                        'code'    => 'insufficient_allocated_qty',
                    ));
                }

                $remaining_qty = max(0, $existing_qty - $qty);

                if ($remaining_qty > 0) {
                    $allocations[$index]['qty'] = $remaining_qty;
                } else {
                    unset($allocations[$index]);
                }

                $found = true;
                break;
            }
        }

        if (!$found) {
            wp_send_json_error(array(
                'message' => 'Allocation not found for this shipment item.',
                'code'    => 'allocation_not_found',
            ));
        }

        $item_index = self::get_item_row_index($items, $order_item_id);
        if ($item_index >= 0) {
            $existing_unassigned = isset($items[$item_index]['unassigned_qty']) ? absint($items[$item_index]['unassigned_qty']) : 0;
            $items[$item_index]['unassigned_qty'] = $existing_unassigned + $qty;
        }

        $shipments[$shipment_index]['allocations'] = array_values($allocations);

        $groups['groups'][$group_index]['items'] = array_values($items);
        $groups['groups'][$group_index]['shipments'] = array_values($shipments);

        $groups = SSB_State::normalize_fulfillment_groups($groups);
        $active_after = SSB_State::resolve_active_shipment_after_mutation($groups, 'unassigned');

        SSB_State::update_fulfillment_groups($order->get_id(), $groups);

        wp_send_json_success(array(
            'groups' => $groups,
            'active_shipment_number' => $active_after,
        ));
    }

    public static function get_rate_cache_setting() {
    self::validate_request();

    wp_send_json_success(array(
        'enabled' => get_option('ssb_enable_rate_cache', 'yes') === 'yes',
    ));
}

public static function get_rate_adjustment_settings() {
    self::validate_request();

    wp_send_json_success(array(
        'adjustments' => array(
            'usps_signature_required'       => self::get_money_setting('ssb_usps_signature_required', '3.95'),
            'usps_adult_signature_required' => self::get_money_setting('ssb_usps_adult_signature_required', '9.70'),
            'usps_insurance'                => self::get_money_setting('ssb_usps_insurance', '0.00'),
            'ups_signature_required'        => self::get_money_setting('ssb_ups_signature_required', '6.25'),
            'ups_adult_signature_required'  => self::get_money_setting('ssb_ups_adult_signature_required', '7.50'),
            'ups_carbon_neutral'            => self::get_money_setting('ssb_ups_carbon_neutral', '0.05'),
            'ups_saturday_delivery'         => self::get_money_setting('ssb_ups_saturday_delivery', '16.00'),
            'ups_additional_handling'       => self::get_money_setting('ssb_ups_additional_handling', '14.25'),
            'ups_insurance'                 => self::get_money_setting('ssb_ups_insurance', '0.00'),
        ),
    ));
}



    /**
     * GET RATES
     */
    public static function get_rates() {

        $order = self::validate_request();

        $parcel = [
            'weight' => isset($_POST['weight']) ? wc_format_decimal($_POST['weight']) : '',
            'length' => isset($_POST['length']) ? wc_format_decimal($_POST['length']) : '',
            'width'  => isset($_POST['width'])  ? wc_format_decimal($_POST['width'])  : '',
            'height' => isset($_POST['height']) ? wc_format_decimal($_POST['height']) : '',
        ];

        $cache_enabled = get_option('ssb_enable_rate_cache', 'yes') === 'yes';
$force_refresh = !empty($_POST['force_refresh']);

$cache_key = 'ssb_rates_' . md5(
    $order->get_id() . '|' .
    $parcel['weight'] . '|' .
    $parcel['length'] . '|' .
    $parcel['width'] . '|' .
    $parcel['height']
);

        if (!$parcel['weight'] || !$parcel['length'] || !$parcel['width'] || !$parcel['height']) {
            wp_send_json_error([
                'message' => 'Parcel dimensions and weight are required.',
                'code'    => 'missing_parcel'
            ]);
        }

        if ($cache_enabled && !$force_refresh) {
            $cached = get_transient($cache_key);

            if ($cached && is_array($cached) && !empty($cached['shipment_id'])) {
                update_post_meta($order->get_id(), '_shoshin_shippo_shipment_id', $cached['shipment_id']);
                update_post_meta($order->get_id(), '_shoshin_shippo_parcel_snapshot', array(
                    'weight' => $parcel['weight'],
                    'length' => $parcel['length'],
                    'width'  => $parcel['width'],
                    'height' => $parcel['height'],
                ));

                wp_send_json_success($cached);
            }
        }

        $result = SSB_Shippo_Client::create_shipment_and_get_rates($order, $parcel);

        if (empty($result['success'])) {
            wp_send_json_error($result);
        }

        if ($cache_enabled) {
    set_transient($cache_key, array(
        'shipment_id' => $result['shipment_id'],
        'rates'       => $result['rates'],
        'rate_notice' => !empty($result['rate_notice']) && is_array($result['rate_notice']) ? $result['rate_notice'] : array(),
    ), 60);
}

        // Persist shipment + parcel snapshot
        update_post_meta($order->get_id(), '_shoshin_shippo_shipment_id', $result['shipment_id']);
        update_post_meta($order->get_id(), '_shoshin_shippo_parcel_snapshot', $result['parcel']);

        wp_send_json_success([
            'shipment_id' => $result['shipment_id'],
            'rates'       => $result['rates'],
            'rate_notice' => !empty($result['rate_notice']) && is_array($result['rate_notice']) ? $result['rate_notice'] : array(),
        ]);
    }

    /**
     * BUY LABEL
     */
    public static function buy_label() {

        $order = self::validate_request();
        $addons = isset($_POST['addons']) ? (array) $_POST['addons'] : [];
        $base_amount = isset($_POST['base_amount']) ? floatval($_POST['base_amount']) : 0;
        $adjusted_total = isset($_POST['adjusted_total']) ? floatval($_POST['adjusted_total']) : 0;

        // Prevent duplicate label purchase
        $existing_transaction = get_post_meta($order->get_id(), '_shoshin_shippo_transaction_id', true);

        if (!empty($existing_transaction)) {
            wp_send_json_error([
                'message' => 'A shipping label has already been purchased for this order.',
                'code'    => 'label_exists'
            ]);
        }

        if (empty($_POST['rate_id'])) {
            wp_send_json_error([
                'message' => 'Missing rate ID.',
                'code'    => 'missing_rate_id'
            ]);
        }

        $rate_id = sanitize_text_field($_POST['rate_id']);

        $label_file_type = isset($_POST['label_file_type']) ? sanitize_text_field(wp_unslash($_POST['label_file_type'])) : '';
        if (!in_array($label_file_type, array('PDF_4x6', 'PDF'), true)) {
            $label_file_type = 'PDF_4x6';
        }

        update_post_meta($order->get_id(), '_shoshin_shippo_rate_id', $rate_id);
        update_post_meta($order->get_id(), '_shoshin_shippo_label_file_type', $label_file_type);

                // Build Shippo options from selected addons
        $options = array();

        if (!empty($addons['adult_signature_required'])) {
            $options['signature_confirmation'] = 'ADULT';
        } elseif (!empty($addons['signature_required'])) {
            $options['signature_confirmation'] = 'STANDARD';
        }

        if (!empty($addons['saturday_delivery'])) {
            $options['saturday_delivery'] = true;
        }

        error_log('SSB ADDONS (RAW): ' . print_r($addons, true));
error_log('SSB OPTIONS (MAPPED): ' . print_r($options, true));

        // Execute label purchase with options
        $result = SSB_Shippo_Client::buy_label($rate_id, $order, $label_file_type, $options);

        $order_id = $order->get_id();

        // ✅ Save pricing + addon snapshot (authoritative)
        update_post_meta($order_id, '_ssb_selected_addons', $addons);
        update_post_meta($order_id, '_ssb_base_rate', $base_amount);
        update_post_meta($order_id, '_ssb_adjusted_total', $adjusted_total);

        $posted_provider = isset($_POST['selected_provider']) ? sanitize_text_field(wp_unslash($_POST['selected_provider'])) : '';
        $posted_service  = isset($_POST['selected_service']) ? sanitize_text_field(wp_unslash($_POST['selected_service'])) : '';
        $posted_amount   = isset($_POST['selected_amount']) ? sanitize_text_field(wp_unslash($_POST['selected_amount'])) : '';
        $posted_currency = isset($_POST['selected_currency']) ? sanitize_text_field(wp_unslash($_POST['selected_currency'])) : '';
        $create_return_label = isset($_POST['create_return_label']) && wp_unslash($_POST['create_return_label']) === '1';

        $resolved_provider = !empty($result['provider']) ? (string) $result['provider'] : $posted_provider;
        $resolved_service  = !empty($result['service']) ? (string) $result['service'] : $posted_service;
        $resolved_amount   = !empty($result['amount']) ? (string) $result['amount'] : $posted_amount;
        $resolved_currency = !empty($result['currency']) ? (string) $result['currency'] : ($posted_currency !== '' ? $posted_currency : $order->get_currency());

        // Persist everything
        update_post_meta($order_id, '_shoshin_shippo_transaction_id', $result['transaction_id']);
        update_post_meta($order_id, '_shoshin_shippo_transaction_status', isset($result['transaction_status']) ? (string) $result['transaction_status'] : '');
        update_post_meta($order_id, '_shoshin_shippo_tracking_number', $result['tracking_number']);
        update_post_meta($order_id, '_shoshin_shippo_label_url', $result['label_url']);
        update_post_meta($order_id, '_shoshin_shippo_tracking_url', isset($result['tracking_url']) ? $result['tracking_url'] : '');
        update_post_meta($order_id, '_shoshin_shippo_tracking_status', $result['tracking_status']);
        update_post_meta($order_id, '_shoshin_shippo_carrier', $resolved_provider);
        update_post_meta($order_id, '_shoshin_shippo_service', $resolved_service);

        update_post_meta($order_id, '_shoshin_shippo_raw_response', $result);

        update_post_meta($order_id, '_shoshin_shippo_selected_rate_snapshot', array(
            'rate_id'         => $rate_id,
            'provider'        => $resolved_provider,
            'provider_image'  => isset($_POST['selected_provider_image']) ? esc_url_raw(wp_unslash($_POST['selected_provider_image'])) : '',
            'carrier_account' => !empty($result['carrier_account']) ? (string) $result['carrier_account'] : '',
            'service'         => $resolved_service,
            'service_token'   => !empty($result['service_token']) ? (string) $result['service_token'] : '',
            'amount'          => $resolved_amount,
            'currency'        => $resolved_currency,
            'base_amount'     => $base_amount,
            'adjusted_total'  => $adjusted_total,
            'addons'          => $addons,
            'tracking_number' => isset($result['tracking_number']) ? (string) $result['tracking_number'] : '',
            'tracking_url'    => isset($result['tracking_url']) ? (string) $result['tracking_url'] : '',
            'label_url'       => isset($result['label_url']) ? (string) $result['label_url'] : '',
            'label_file_type' => $label_file_type,
        ));

                $purchase_options = array(
            'use_item_weight'      => (string) get_post_meta($order_id, '_shoshin_shippo_use_item_weight', true) === '1',
            'contains_alcohol'     => (string) get_post_meta($order_id, '_shoshin_shippo_contains_alcohol', true) === '1',
            'contains_dry_ice'     => (string) get_post_meta($order_id, '_shoshin_shippo_contains_dry_ice', true) === '1',
            'create_return_label'  => (string) get_post_meta($order_id, '_shoshin_shippo_create_return_label', true) === '1',
            'contains_hazmat'      => (string) get_post_meta($order_id, '_shoshin_shippo_contains_hazmat', true) === '1',
            'additional_insurance' => (string) get_post_meta($order_id, '_shoshin_shippo_additional_insurance', true) === '1',
        );

        update_post_meta($order_id, '_shoshin_shippo_purchase_snapshot', array(
            'purchased_at'     => current_time('mysql'),
            'label_file_type'  => $label_file_type,
            'parcel'           => get_post_meta($order_id, '_shoshin_shippo_parcel_snapshot', true),
            'options'          => $purchase_options,
            'selected_rate'    => get_post_meta($order_id, '_shoshin_shippo_selected_rate_snapshot', true),
            'addons'           => $addons,
            'base_amount'      => $base_amount,
            'adjusted_total'   => $adjusted_total,
        ));

        // Add order note (important for audit trail)
        $order->add_order_note(sprintf(
            'Shippo label purchased: %s - %s | Tracking: %s | Base: %s | Adjusted: %s',
            $result['provider'],
            $result['service'],
            $result['tracking_number'],
            number_format((float) $base_amount, 2, '.', ''),
            number_format((float) $adjusted_total, 2, '.', '')
        ));

        $order_completed = false;
        $complete_order  = !empty($_POST['complete_order']) && $_POST['complete_order'] === '1';

        if ($complete_order && $order->has_status('processing')) {
            $order->update_status('completed', 'Order automatically marked completed after Shippo label purchase.');
            $order_completed = true;
        }

        $selected_snapshot_for_response = get_post_meta($order_id, '_shoshin_shippo_selected_rate_snapshot', true);
        $selected_snapshot_for_response = is_array($selected_snapshot_for_response) ? $selected_snapshot_for_response : array();

                $auto_return_label = array();

        if ($create_return_label) {
            $parcel_snapshot = get_post_meta($order_id, '_shoshin_shippo_parcel_snapshot', true);
            $parcel_snapshot = is_array($parcel_snapshot) ? $parcel_snapshot : array();

            if (!empty($parcel_snapshot)) {
                $auto_return_result = SSB_Shippo_Client::create_return_label(
                    $order,
                    $parcel_snapshot,
                    $resolved_provider,
                    !empty($result['service_token']) ? (string) $result['service_token'] : '',
                    $label_file_type
                );

                if (!empty($auto_return_result['success'])) {
                    update_post_meta($order_id, '_shoshin_shippo_return_shipment_id', isset($auto_return_result['return_shipment_id']) ? (string) $auto_return_result['return_shipment_id'] : '');
                    update_post_meta($order_id, '_shoshin_shippo_return_rate_id', isset($auto_return_result['return_rate_id']) ? (string) $auto_return_result['return_rate_id'] : '');
                    update_post_meta($order_id, '_shoshin_shippo_return_transaction_id', isset($auto_return_result['transaction_id']) ? (string) $auto_return_result['transaction_id'] : '');
                    update_post_meta($order_id, '_shoshin_shippo_return_tracking_number', isset($auto_return_result['tracking_number']) ? (string) $auto_return_result['tracking_number'] : '');
                    update_post_meta($order_id, '_shoshin_shippo_return_tracking_status', isset($auto_return_result['tracking_status']) ? (string) $auto_return_result['tracking_status'] : '');
                    update_post_meta($order_id, '_shoshin_shippo_return_tracking_url', isset($auto_return_result['tracking_url']) ? (string) $auto_return_result['tracking_url'] : '');
                    update_post_meta($order_id, '_shoshin_shippo_return_label_url', isset($auto_return_result['label_url']) ? (string) $auto_return_result['label_url'] : '');
                    update_post_meta($order_id, '_shoshin_shippo_return_carrier', isset($auto_return_result['provider']) ? (string) $auto_return_result['provider'] : '');
                    update_post_meta($order_id, '_shoshin_shippo_return_service', isset($auto_return_result['service']) ? (string) $auto_return_result['service'] : '');
                    update_post_meta($order_id, '_shoshin_shippo_return_service_token', isset($auto_return_result['service_token']) ? (string) $auto_return_result['service_token'] : '');
                    update_post_meta($order_id, '_shoshin_shippo_return_carrier_account', isset($auto_return_result['carrier_account']) ? (string) $auto_return_result['carrier_account'] : '');
                    update_post_meta($order_id, '_shoshin_shippo_return_label_file_type', $label_file_type);
                    update_post_meta($order_id, '_shoshin_shippo_return_raw_response', $auto_return_result);
                                        update_post_meta($order_id, '_shoshin_shippo_return_amount', isset($auto_return_result['amount']) ? (string) $auto_return_result['amount'] : '');
                    update_post_meta($order_id, '_shoshin_shippo_return_currency', isset($auto_return_result['currency']) ? (string) $auto_return_result['currency'] : '');
                    

                    $auto_return_label = array(
    'transaction_id'  => isset($auto_return_result['transaction_id']) ? (string) $auto_return_result['transaction_id'] : '',
    'label_url'       => isset($auto_return_result['label_url']) ? (string) $auto_return_result['label_url'] : '',
    'tracking_number' => isset($auto_return_result['tracking_number']) ? (string) $auto_return_result['tracking_number'] : '',
    'tracking_url'    => isset($auto_return_result['tracking_url']) ? (string) $auto_return_result['tracking_url'] : '',
    'carrier'         => isset($auto_return_result['provider']) ? (string) $auto_return_result['provider'] : '',
    'service'         => isset($auto_return_result['service']) ? (string) $auto_return_result['service'] : '',
    'label_file_type' => $label_file_type,
    'amount'          => isset($auto_return_result['amount']) ? (string) $auto_return_result['amount'] : '',
    'currency'        => isset($auto_return_result['currency']) ? (string) $auto_return_result['currency'] : '',
);
                } else {
                    $auto_return_label = array(
                        'error'   => !empty($auto_return_result['message']) ? (string) $auto_return_result['message'] : 'Unable to auto-create the return label.',
                        'code'    => !empty($auto_return_result['code']) ? (string) $auto_return_result['code'] : 'auto_return_label_failed',
                    );
                }
            } else {
                $auto_return_label = array(
                    'error' => 'Parcel snapshot is missing, so the return label could not be auto-created.',
                    'code'  => 'missing_parcel_snapshot',
                );
            }
        }

        wp_send_json_success([
            'transaction_id'   => $result['transaction_id'],
            'tracking_number'  => $result['tracking_number'],
            'tracking_url'     => isset($result['tracking_url']) ? $result['tracking_url'] : '',
            'label_url'        => $result['label_url'],
            'carrier'          => $resolved_provider,
            'service'          => $resolved_service,
            'status'           => $result['tracking_status'],
            'amount'           => $resolved_amount,
            'currency'         => $resolved_currency,
            'provider'         => $resolved_provider,
            'label_file_type'  => $label_file_type,
            'order_completed'  => $order_completed,
            'auto_return_label' => $auto_return_label,
        ]);
    }

        /**
     * SAVE PACKING NOTE
     */
    public static function save_packing_note() {

        $order = self::validate_request();

        $note = isset($_POST['packing_note']) ? wp_kses_post(wp_unslash($_POST['packing_note'])) : '';
        update_post_meta($order->get_id(), '_shoshin_shippo_packing_note', $note);

        wp_send_json_success([
            'message' => 'Packing slip note saved.',
            'packing_note' => $note,
        ]);
    }

    /**
     * SAVE LABEL FILE TYPE
     */
    public static function save_label_file_type() {

        $order = self::validate_request();

        $label_file_type = isset($_POST['label_file_type']) ? sanitize_text_field(wp_unslash($_POST['label_file_type'])) : '';

        if (!in_array($label_file_type, array('PDF_4x6', 'PDF'), true)) {
            $label_file_type = 'PDF_4x6';
        }

        update_post_meta($order->get_id(), '_shoshin_shippo_label_file_type', $label_file_type);

        wp_send_json_success([
            'message' => 'Label format saved.',
            'label_file_type' => $label_file_type,
        ]);
    }

        /**
     * SAVE SHIPMENT OPTIONS
     */
    public static function save_shipment_options() {

        $order = self::validate_request();
        $order_id = $order->get_id();

        if (SSB_State::has_purchased_label($order)) {
            wp_send_json_error([
                'message' => 'Shipment options are locked after label purchase.',
                'code'    => 'options_locked',
            ]);
        }

        $fields = array(
            'use_item_weight'       => '_shoshin_shippo_use_item_weight',
            'contains_alcohol'      => '_shoshin_shippo_contains_alcohol',
            'contains_dry_ice'      => '_shoshin_shippo_contains_dry_ice',
            'create_return_label'   => '_shoshin_shippo_create_return_label',
            'contains_hazmat'       => '_shoshin_shippo_contains_hazmat',
            'additional_insurance'  => '_shoshin_shippo_additional_insurance',
        );

        $saved = array();

        foreach ($fields as $request_key => $meta_key) {
            $value = !empty($_POST[$request_key]) && $_POST[$request_key] === '1' ? '1' : '0';
            update_post_meta($order_id, $meta_key, $value);
            $saved[$request_key] = ($value === '1');
        }

        wp_send_json_success([
            'message' => 'Shipment options saved.',
            'options' => $saved,
        ]);
    }

    /**
     * CLEAR SHIPMENT DRAFT
     */
    public static function clear_shipment_draft() {

        $order = self::validate_request();
        $order_id = $order->get_id();

        if (SSB_State::has_purchased_label($order) || SSB_State::has_return_label($order)) {
            wp_send_json_error([
                'message' => 'Shipment draft can only be cleared when no valid shipping or return labels exist.',
                'code'    => 'active_labels_present',
            ]);
        }

        delete_post_meta($order_id, '_shoshin_shippo_shipment_id');
        delete_post_meta($order_id, '_shoshin_shippo_parcel_snapshot');
        delete_post_meta($order_id, '_shoshin_shippo_selected_rate_snapshot');
        delete_post_meta($order_id, '_shoshin_shippo_use_item_weight');
        delete_post_meta($order_id, '_shoshin_shippo_contains_alcohol');
        delete_post_meta($order_id, '_shoshin_shippo_contains_dry_ice');
        delete_post_meta($order_id, '_shoshin_shippo_create_return_label');
        delete_post_meta($order_id, '_shoshin_shippo_contains_hazmat');
        delete_post_meta($order_id, '_shoshin_shippo_additional_insurance');

        wp_send_json_success([
            'message' => 'Shipment draft cleared.',
        ]);
    }

        public static function preview_return_label() {
        $order = self::validate_request();
        $order_id = $order->get_id();

        $snapshot = get_post_meta($order_id, '_shoshin_shippo_selected_rate_snapshot', true);
        $snapshot = is_array($snapshot) ? $snapshot : array();

        $outbound_provider = !empty($snapshot['provider']) ? (string) $snapshot['provider'] : (string) get_post_meta($order_id, '_shoshin_shippo_carrier', true);
        $service_token     = !empty($snapshot['service_token']) ? (string) $snapshot['service_token'] : '';
        $label_file_type   = (string) get_post_meta($order_id, '_shoshin_shippo_label_file_type', true);
        $parcel            = get_post_meta($order_id, '_shoshin_shippo_parcel_snapshot', true);
        $parcel            = is_array($parcel) ? $parcel : array();
        $return_options    = self::get_return_label_options_from_post();

        if ($label_file_type === '') {
            $label_file_type = 'PDF_4x6';
        }

        if (empty($parcel)) {
            wp_send_json_error(array(
                'message' => 'Parcel snapshot is required before creating a return label.',
                'code'    => 'missing_parcel_snapshot',
            ));
        }

        $result = SSB_Shippo_Client::preview_return_label(
            $order,
            $parcel,
            $outbound_provider,
            $service_token,
            $label_file_type,
            $return_options
        );

        if (empty($result['success'])) {
            wp_send_json_error(array(
                'message' => !empty($result['message']) ? $result['message'] : 'Unable to preview the return label.',
                'code'    => !empty($result['code']) ? $result['code'] : 'return_label_preview_failed',
                'data'    => $result,
            ));
        }

        $declared_value    = self::get_declared_merchandise_value($order);
        $included_coverage = self::get_included_coverage_amount(
            isset($result['provider']) ? (string) $result['provider'] : '',
            isset($result['service']) ? (string) $result['service'] : ''
        );
        $insurance_charge  = self::get_insurance_charge_for_preview(
            isset($result['provider']) ? (string) $result['provider'] : '',
            isset($result['service']) ? (string) $result['service'] : '',
            $declared_value,
            !empty($return_options['additional_insurance'])
        );
        $base_amount       = isset($result['amount']) ? (float) $result['amount'] : 0.0;
        $option_adjustments = 0.0;
        $total_amount      = $base_amount + $option_adjustments + $insurance_charge;
        $currency          = isset($result['currency']) && $result['currency'] !== '' ? (string) $result['currency'] : $order->get_currency();

        wp_send_json_success(array(
            'provider'                    => isset($result['provider']) ? (string) $result['provider'] : '',
            'service'                     => isset($result['service']) ? (string) $result['service'] : '',
            'base_amount'                 => number_format($base_amount, 2, '.', ''),
            'base_amount_formatted'       => '$' . number_format($base_amount, 2, '.', '') . ' ' . $currency,
            'option_adjustments'          => number_format($option_adjustments, 2, '.', ''),
            'option_adjustments_formatted'=> '$' . number_format($option_adjustments, 2, '.', '') . ' ' . $currency,
            'insurance'                   => number_format($insurance_charge, 2, '.', ''),
            'insurance_formatted'         => '$' . number_format($insurance_charge, 2, '.', '') . ' ' . $currency,
            'total'                       => number_format($total_amount, 2, '.', ''),
            'total_formatted'             => '$' . number_format($total_amount, 2, '.', '') . ' ' . $currency,
            'capabilities'                => self::get_preview_capabilities(
                isset($result['provider']) ? (string) $result['provider'] : '',
                $declared_value,
                $included_coverage
            ),
        ));
    }

        /**
     * CREATE RETURN LABEL
     */
    public static function create_return_label() {
        $order = self::validate_request();
        $order_id = $order->get_id();

        $existing_label_url = (string) get_post_meta($order_id, '_shoshin_shippo_return_label_url', true);
        if ($existing_label_url !== '') {
            wp_send_json_success(array(
    'message'         => 'Return label already exists.',
    'transaction_id'  => (string) get_post_meta($order_id, '_shoshin_shippo_return_transaction_id', true),
    'label_url'       => $existing_label_url,
    'tracking_number' => (string) get_post_meta($order_id, '_shoshin_shippo_return_tracking_number', true),
    'tracking_url'    => (string) get_post_meta($order_id, '_shoshin_shippo_return_tracking_url', true),
    'carrier'         => (string) get_post_meta($order_id, '_shoshin_shippo_return_carrier', true),
    'service'         => (string) get_post_meta($order_id, '_shoshin_shippo_return_service', true),
));
        }

        $snapshot = get_post_meta($order_id, '_shoshin_shippo_selected_rate_snapshot', true);
        $snapshot = is_array($snapshot) ? $snapshot : array();

        $outbound_provider = !empty($snapshot['provider']) ? (string) $snapshot['provider'] : (string) get_post_meta($order_id, '_shoshin_shippo_carrier', true);
        $service_token     = !empty($snapshot['service_token']) ? (string) $snapshot['service_token'] : '';
        $label_file_type   = (string) get_post_meta($order_id, '_shoshin_shippo_label_file_type', true);

        if ($label_file_type === '') {
            $label_file_type = 'PDF_4x6';
        }

        $parcel = get_post_meta($order_id, '_shoshin_shippo_parcel_snapshot', true);
        $parcel = is_array($parcel) ? $parcel : array();

        if (empty($parcel)) {
            wp_send_json_error(array(
                'message' => 'Parcel snapshot is required before creating a return label.',
                'code'    => 'missing_parcel_snapshot',
            ));
        }

        $return_options = self::get_return_label_options_from_post();

        $result = SSB_Shippo_Client::create_return_label(
            $order,
            $parcel,
            $outbound_provider,
            $service_token,
            $label_file_type,
            $return_options
        );

        if (empty($result['success'])) {
            wp_send_json_error(array(
                'message' => !empty($result['message']) ? $result['message'] : 'Unable to create return label.',
                'code'    => !empty($result['code']) ? $result['code'] : 'return_label_failed',
                'data'    => $result,
            ));
        }

        update_post_meta($order_id, '_shoshin_shippo_return_shipment_id', isset($result['return_shipment_id']) ? (string) $result['return_shipment_id'] : '');
        update_post_meta($order_id, '_shoshin_shippo_return_rate_id', isset($result['return_rate_id']) ? (string) $result['return_rate_id'] : '');
        update_post_meta($order_id, '_shoshin_shippo_return_transaction_id', isset($result['transaction_id']) ? (string) $result['transaction_id'] : '');
        update_post_meta($order_id, '_shoshin_shippo_return_tracking_number', isset($result['tracking_number']) ? (string) $result['tracking_number'] : '');
        update_post_meta($order_id, '_shoshin_shippo_return_tracking_status', isset($result['tracking_status']) ? (string) $result['tracking_status'] : '');
        update_post_meta($order_id, '_shoshin_shippo_return_tracking_url', isset($result['tracking_url']) ? (string) $result['tracking_url'] : '');
        update_post_meta($order_id, '_shoshin_shippo_return_label_url', isset($result['label_url']) ? (string) $result['label_url'] : '');
        update_post_meta($order_id, '_shoshin_shippo_return_carrier', isset($result['provider']) ? (string) $result['provider'] : '');
        update_post_meta($order_id, '_shoshin_shippo_return_service', isset($result['service']) ? (string) $result['service'] : '');
        update_post_meta($order_id, '_shoshin_shippo_return_service_token', isset($result['service_token']) ? (string) $result['service_token'] : '');
        update_post_meta($order_id, '_shoshin_shippo_return_carrier_account', isset($result['carrier_account']) ? (string) $result['carrier_account'] : '');
        update_post_meta($order_id, '_shoshin_shippo_return_label_file_type', $label_file_type);
        update_post_meta($order_id, '_shoshin_shippo_return_raw_response', $result);
        update_post_meta($order_id, '_shoshin_shippo_return_amount', isset($result['amount']) ? (string) $result['amount'] : '');
        update_post_meta($order_id, '_shoshin_shippo_return_currency', isset($result['currency']) ? (string) $result['currency'] : '');
        update_post_meta($order_id, '_shoshin_shippo_return_option_snapshot', $return_options);
        

        wp_send_json_success(array(
    'message'         => 'Return label created successfully.',
    'transaction_id'  => isset($result['transaction_id']) ? (string) $result['transaction_id'] : '',
    'label_url'       => isset($result['label_url']) ? (string) $result['label_url'] : '',
    'tracking_number' => isset($result['tracking_number']) ? (string) $result['tracking_number'] : '',
    'tracking_url'    => isset($result['tracking_url']) ? (string) $result['tracking_url'] : '',
    'carrier'         => isset($result['provider']) ? (string) $result['provider'] : '',
    'service'         => isset($result['service']) ? (string) $result['service'] : '',
    'amount'          => isset($result['amount']) ? (string) $result['amount'] : '',
    'currency'        => isset($result['currency']) ? (string) $result['currency'] : '',
        ));
    }

        /**
     * SCHEDULE PICKUP
     */
    public static function schedule_pickup() {
        $order = self::validate_request();
        $order_id = $order->get_id();

        $transaction_id = isset($_POST['transaction_id']) ? sanitize_text_field(wp_unslash($_POST['transaction_id'])) : '';
        if ($transaction_id === '') {
            $transaction_id = (string) get_post_meta($order_id, '_shoshin_shippo_transaction_id', true);
        }

        if ($transaction_id === '') {
            wp_send_json_error(array(
                'message' => 'Transaction ID is required before scheduling a pickup.',
                'code'    => 'missing_transaction_id',
            ));
        }

        $snapshot = get_post_meta($order_id, '_shoshin_shippo_selected_rate_snapshot', true);
        $snapshot = is_array($snapshot) ? $snapshot : array();

        $carrier = !empty($snapshot['provider']) ? (string) $snapshot['provider'] : (string) get_post_meta($order_id, '_shoshin_shippo_carrier', true);
        $carrier_upper = strtoupper(trim($carrier));

        if ($carrier_upper !== 'USPS' && strpos($carrier_upper, 'DHL') === false) {
            wp_send_json_error(array(
                'message' => 'Schedule pickup is only available in this integration for USPS or DHL Express labels.',
                'code'    => 'pickup_not_supported_for_carrier',
            ));
        }

        $carrier_account = !empty($snapshot['carrier_account']) ? (string) $snapshot['carrier_account'] : '';

        if ($carrier_account === '') {
            $rate_id = !empty($snapshot['rate_id']) ? (string) $snapshot['rate_id'] : (string) get_post_meta($order_id, '_shoshin_shippo_rate_id', true);

            if ($rate_id !== '') {
                $rate_lookup = SSB_Shippo_Client::get_rate($rate_id);

                if (!empty($rate_lookup['success']) && !empty($rate_lookup['raw']['carrier_account'])) {
                    $carrier_account = (string) $rate_lookup['raw']['carrier_account'];
                }
            }
        }

        if ($carrier_account === '') {
            wp_send_json_error(array(
                'message' => 'Carrier account could not be resolved for this label.',
                'code'    => 'missing_carrier_account',
            ));
        }

        $pickup_date         = isset($_POST['pickup_date']) ? sanitize_text_field(wp_unslash($_POST['pickup_date'])) : '';
        $pickup_start_time   = isset($_POST['pickup_start_time']) ? sanitize_text_field(wp_unslash($_POST['pickup_start_time'])) : '';
        $pickup_end_time     = isset($_POST['pickup_end_time']) ? sanitize_text_field(wp_unslash($_POST['pickup_end_time'])) : '';
        $pickup_instructions = isset($_POST['pickup_instructions']) ? sanitize_textarea_field(wp_unslash($_POST['pickup_instructions'])) : '';

        if ($pickup_date === '' || $pickup_start_time === '' || $pickup_end_time === '') {
            wp_send_json_error(array(
                'message' => 'Pickup date, start time, and end time are required.',
                'code'    => 'missing_pickup_window',
            ));
        }

        $timezone = function_exists('wp_timezone') ? wp_timezone() : new DateTimeZone('UTC');
        $start_dt = date_create_immutable_from_format('Y-m-d H:i', $pickup_date . ' ' . $pickup_start_time, $timezone);
        $end_dt   = date_create_immutable_from_format('Y-m-d H:i', $pickup_date . ' ' . $pickup_end_time, $timezone);

        if (!$start_dt || !$end_dt) {
            wp_send_json_error(array(
                'message' => 'Invalid pickup date or time.',
                'code'    => 'invalid_pickup_window',
            ));
        }

        if ($end_dt <= $start_dt) {
            wp_send_json_error(array(
                'message' => 'Pickup end time must be later than the start time.',
                'code'    => 'invalid_pickup_window_order',
            ));
        }

        $origin = SSB_Settings::get_origin_address();

        $result = SSB_Shippo_Client::create_pickup(
            $carrier_account,
            $transaction_id,
            $origin,
            $start_dt->format('c'),
            $end_dt->format('c'),
            $pickup_instructions,
            'office',
            'Front Door',
            'Woo Order #' . $order_id . ' pickup'
        );

        if (empty($result['success'])) {
            wp_send_json_error(array(
                'message' => !empty($result['message']) ? $result['message'] : 'Unable to schedule pickup.',
                'code'    => !empty($result['code']) ? $result['code'] : 'pickup_failed',
                'data'    => $result,
            ));
        }

        update_post_meta($order_id, '_shoshin_shippo_pickup_id', isset($result['pickup_id']) ? (string) $result['pickup_id'] : '');
        update_post_meta($order_id, '_shoshin_shippo_pickup_status', isset($result['pickup_status']) ? (string) $result['pickup_status'] : '');
        update_post_meta($order_id, '_shoshin_shippo_pickup_confirmation_code', isset($result['confirmation_code']) ? (string) $result['confirmation_code'] : '');
        update_post_meta($order_id, '_shoshin_shippo_pickup_requested_start_time', isset($result['requested_start_time']) ? (string) $result['requested_start_time'] : '');
        update_post_meta($order_id, '_shoshin_shippo_pickup_requested_end_time', isset($result['requested_end_time']) ? (string) $result['requested_end_time'] : '');
        update_post_meta($order_id, '_shoshin_shippo_pickup_confirmed_start_time', isset($result['confirmed_start_time']) ? (string) $result['confirmed_start_time'] : '');
        update_post_meta($order_id, '_shoshin_shippo_pickup_confirmed_end_time', isset($result['confirmed_end_time']) ? (string) $result['confirmed_end_time'] : '');
        update_post_meta($order_id, '_shoshin_shippo_pickup_cancel_by_time', isset($result['cancel_by_time']) ? (string) $result['cancel_by_time'] : '');
        update_post_meta($order_id, '_shoshin_shippo_pickup_timezone', isset($result['timezone']) ? (string) $result['timezone'] : '');
        update_post_meta($order_id, '_shoshin_shippo_pickup_raw_response', $result);

        wp_send_json_success(array(
            'message'              => 'Pickup scheduled successfully.',
            'pickup_id'            => isset($result['pickup_id']) ? (string) $result['pickup_id'] : '',
            'pickup_status'        => isset($result['pickup_status']) ? (string) $result['pickup_status'] : '',
            'confirmation_code'    => isset($result['confirmation_code']) ? (string) $result['confirmation_code'] : '',
            'requested_start_time' => isset($result['requested_start_time']) ? (string) $result['requested_start_time'] : '',
            'requested_end_time'   => isset($result['requested_end_time']) ? (string) $result['requested_end_time'] : '',
            'confirmed_start_time' => isset($result['confirmed_start_time']) ? (string) $result['confirmed_start_time'] : '',
            'confirmed_end_time'   => isset($result['confirmed_end_time']) ? (string) $result['confirmed_end_time'] : '',
            'cancel_by_time'       => isset($result['cancel_by_time']) ? (string) $result['cancel_by_time'] : '',
            'timezone'             => isset($result['timezone']) ? (string) $result['timezone'] : '',
        ));
    }

        /**
     * REQUEST RETURN LABEL REFUND
     */
    public static function request_return_refund() {
        $order = self::validate_request();
        $order_id = $order->get_id();

        $transaction_id = (string) get_post_meta($order_id, '_shoshin_shippo_return_transaction_id', true);

        if ($transaction_id === '') {
            wp_send_json_error(array(
                'message' => 'No return label transaction exists for this order.',
                'code'    => 'missing_return_transaction_id',
            ));
        }

        $result = SSB_Shippo_Client::create_refund($transaction_id);

        if (empty($result['success'])) {
            wp_send_json_error(array(
                'message' => !empty($result['message']) ? $result['message'] : 'Unable to void the return label.',
                'code'    => !empty($result['code']) ? $result['code'] : 'return_refund_failed',
                'data'    => $result,
            ));
        }

        update_post_meta($order_id, '_shoshin_shippo_return_refund_status', isset($result['status']) ? (string) $result['status'] : '');
        update_post_meta($order_id, '_shoshin_shippo_return_refund_id', isset($result['refund_id']) ? (string) $result['refund_id'] : '');
        update_post_meta($order_id, '_shoshin_shippo_return_refund_raw_response', $result);

        delete_post_meta($order_id, '_shoshin_shippo_return_shipment_id');
        delete_post_meta($order_id, '_shoshin_shippo_return_rate_id');
        delete_post_meta($order_id, '_shoshin_shippo_return_transaction_id');
        delete_post_meta($order_id, '_shoshin_shippo_return_tracking_number');
        delete_post_meta($order_id, '_shoshin_shippo_return_tracking_status');
        delete_post_meta($order_id, '_shoshin_shippo_return_tracking_url');
        delete_post_meta($order_id, '_shoshin_shippo_return_label_url');
        delete_post_meta($order_id, '_shoshin_shippo_return_carrier');
        delete_post_meta($order_id, '_shoshin_shippo_return_service');
        delete_post_meta($order_id, '_shoshin_shippo_return_service_token');
        delete_post_meta($order_id, '_shoshin_shippo_return_carrier_account');
        delete_post_meta($order_id, '_shoshin_shippo_return_label_file_type');
        delete_post_meta($order_id, '_shoshin_shippo_return_raw_response');

        wp_send_json_success(array(
            'message' => 'Return label refund requested successfully.',
        ));
    }

    /**
     * REQUEST REFUND
     */
    public static function request_refund() {

        $order = self::validate_request();
        $order_id = $order->get_id();

        $transaction_id = isset($_POST['transaction_id']) ? sanitize_text_field(wp_unslash($_POST['transaction_id'])) : '';
        if ($transaction_id === '') {
            $transaction_id = (string) get_post_meta($order_id, '_shoshin_shippo_transaction_id', true);
        }

        if ($transaction_id === '') {
            wp_send_json_error([
                'message' => 'No Shippo transaction ID was found for this order.',
                'code'    => 'missing_transaction_id',
            ]);
        }

        $existing_status = strtoupper((string) get_post_meta($order_id, '_shoshin_shippo_refund_status', true));
        if (in_array($existing_status, array('QUEUED', 'PENDING', 'SUCCESS'), true)) {
            wp_send_json_error([
                'message' => 'A refund has already been requested for this label.',
                'code'    => 'refund_already_requested',
                'status'  => $existing_status,
            ]);
        }

        $transaction_status = strtoupper((string) get_post_meta($order_id, '_shoshin_shippo_transaction_status', true));
        if ($transaction_status !== '' && $transaction_status !== 'SUCCESS') {
            wp_send_json_error([
                'message' => 'This label cannot be voided because the Shippo transaction status is ' . $transaction_status . ', not SUCCESS.',
                'code'    => 'refund_not_allowed_for_transaction_status',
                'status'  => $transaction_status,
            ]);
        }

        $result = SSB_Shippo_Client::create_refund($transaction_id);

        if (empty($result['success'])) {
            wp_send_json_error($result);
        }

        $void_history = get_post_meta($order_id, '_shoshin_shippo_void_history', true);
        $void_history = is_array($void_history) ? $void_history : array();

        $void_history[] = array(
            'voided_at'        => current_time('mysql'),
            'transaction_id'   => (string) get_post_meta($order_id, '_shoshin_shippo_transaction_id', true),
            'shipment_id'      => (string) get_post_meta($order_id, '_shoshin_shippo_shipment_id', true),
            'tracking_number'  => (string) get_post_meta($order_id, '_shoshin_shippo_tracking_number', true),
            'tracking_url'     => (string) get_post_meta($order_id, '_shoshin_shippo_tracking_url', true),
            'tracking_status'  => (string) get_post_meta($order_id, '_shoshin_shippo_tracking_status', true),
            'carrier'          => (string) get_post_meta($order_id, '_shoshin_shippo_carrier', true),
            'service'          => (string) get_post_meta($order_id, '_shoshin_shippo_service', true),
            'label_url'        => (string) get_post_meta($order_id, '_shoshin_shippo_label_url', true),
            'selected_snapshot'=> get_post_meta($order_id, '_shoshin_shippo_selected_rate_snapshot', true),
            'raw_response'     => get_post_meta($order_id, '_shoshin_shippo_raw_response', true),
            'refund_id'        => isset($result['refund_id']) ? (string) $result['refund_id'] : '',
            'refund_status'    => isset($result['refund_status']) ? (string) $result['refund_status'] : '',
            'refund_raw'       => $result,
        );

        update_post_meta($order_id, '_shoshin_shippo_void_history', $void_history);
        update_post_meta($order_id, '_shoshin_shippo_last_void_status', isset($result['refund_status']) ? (string) $result['refund_status'] : '');

        delete_post_meta($order_id, '_shoshin_shippo_shipment_id');
        delete_post_meta($order_id, '_shoshin_shippo_transaction_id');
        delete_post_meta($order_id, '_shoshin_shippo_tracking_number');
        delete_post_meta($order_id, '_shoshin_shippo_label_url');
        delete_post_meta($order_id, '_shoshin_shippo_tracking_url');
        delete_post_meta($order_id, '_shoshin_shippo_tracking_status');
        delete_post_meta($order_id, '_shoshin_shippo_carrier');
        delete_post_meta($order_id, '_shoshin_shippo_service');
        delete_post_meta($order_id, '_shoshin_shippo_raw_response');
        delete_post_meta($order_id, '_shoshin_shippo_selected_rate_snapshot');
        delete_post_meta($order_id, '_shoshin_shippo_purchase_snapshot');
        delete_post_meta($order_id, '_shoshin_shippo_rate_id');
        delete_post_meta($order_id, '_shoshin_shippo_refund_id');
        delete_post_meta($order_id, '_shoshin_shippo_refund_status');
        delete_post_meta($order_id, '_shoshin_shippo_refund_raw_response');
        

                $refund_status = isset($result['refund_status']) ? (string) $result['refund_status'] : '';

        $order->add_order_note(sprintf(
            'Shippo label voided. Refund requested for transaction %s. Status: %s',
            $transaction_id,
            $refund_status !== '' ? $refund_status : 'UNKNOWN'
        ));

        // 🔄 PHASE 1: FULL SHIPMENT RESET (AUTHORITATIVE)

        // Core shipment identifiers
        delete_post_meta($order_id, '_shoshin_shippo_shipment_id');
        delete_post_meta($order_id, '_shoshin_shippo_transaction_id');
        delete_post_meta($order_id, '_shoshin_shippo_label_url');

        // Tracking data
        delete_post_meta($order_id, '_shoshin_shippo_tracking_number');
        delete_post_meta($order_id, '_shoshin_shippo_tracking_status');
        delete_post_meta($order_id, '_shoshin_shippo_tracking_url');
        delete_post_meta($order_id, '_shoshin_shippo_carrier');
        delete_post_meta($order_id, '_shoshin_shippo_service');

        // Snapshot (CRITICAL)
        delete_post_meta($order_id, '_shoshin_shippo_selected_rate_snapshot');

        // Return label data is intentionally preserved here.
        // Voiding the outbound shipping label must not void or clear an existing return label.

        // Parcel + UI state
        delete_post_meta($order_id, '_shoshin_shippo_parcel_snapshot');

        // Shipment options (UI → backend sync)
        delete_post_meta($order_id, '_shoshin_shippo_use_item_weight');
        delete_post_meta($order_id, '_shoshin_shippo_contains_alcohol');
        delete_post_meta($order_id, '_shoshin_shippo_contains_dry_ice');
        delete_post_meta($order_id, '_shoshin_shippo_create_return_label');
        delete_post_meta($order_id, '_shoshin_shippo_contains_hazmat');
        delete_post_meta($order_id, '_shoshin_shippo_additional_insurance');

        if ($order->has_status('completed')) {
            $order->update_status(
                'processing',
                'Order reopened after Shippo label was voided. A replacement shipping label is required.'
            );
        }

        wp_send_json_success([
            'message'       => 'A request to refund the last label has been requested and it has been voided in the system. You may create another label.',
            'refund_id'     => isset($result['refund_id']) ? $result['refund_id'] : '',
            'refund_status' => $refund_status,
            'voided'        => true,
            'order_reopened'=> $order->has_status('processing'),
        ]);
    }
}