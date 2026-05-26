<?php
if (!defined('ABSPATH')) {
    exit;
}

class SSB_State {

    const META_FULFILLMENT_GROUPS = '_ssb_fulfillment_groups';

    public static function init() {
        add_action('woocommerce_checkout_order_processed', array(__CLASS__, 'capture_fulfillment_groups_on_checkout'), 20, 3);
    }

    public static function capture_fulfillment_groups_on_checkout($order_id, $posted_data, $order) {
        if (!$order || !is_a($order, 'WC_Order')) {
            $order = wc_get_order($order_id);
        }

        if (!$order || !is_a($order, 'WC_Order')) {
            return;
        }

        if (get_post_meta($order->get_id(), self::META_FULFILLMENT_GROUPS, true)) {
            return;
        }

        $groups = self::build_initial_fulfillment_groups($order, 'checkout');
        self::update_fulfillment_groups($order->get_id(), $groups);
    }

    public static function ensure_fulfillment_groups($order, $created_from = 'admin_fallback') {
        if (!$order || !is_a($order, 'WC_Order')) {
            return array();
        }

        $existing = get_post_meta($order->get_id(), self::META_FULFILLMENT_GROUPS, true);

        if (is_array($existing) && !empty($existing['groups'])) {
            return $existing;
        }

        $groups = self::build_initial_fulfillment_groups($order, $created_from);
        self::update_fulfillment_groups($order->get_id(), $groups);

        return $groups;
    }

    public static function get_fulfillment_groups($order) {
        if (!$order || !is_a($order, 'WC_Order')) {
            return array();
        }

        return self::ensure_fulfillment_groups($order);
    }

    public static function update_fulfillment_groups($order_id, $groups) {
        if (!$order_id || !is_array($groups)) {
            return;
        }

        update_post_meta($order_id, self::META_FULFILLMENT_GROUPS, $groups);
    }

    protected static function build_initial_fulfillment_groups($order, $created_from = 'checkout') {
        $normalized = array(
            'version'      => 1,
            'status'       => 'current',
            'created_from' => $created_from,
            'groups'       => array(),
        );

        if (!$order || !is_a($order, 'WC_Order')) {
            return $normalized;
        }

        $group_rows = array();

        foreach ($order->get_items('line_item') as $item_id => $item) {
            $product = $item->get_product();

            if (!$product || !is_a($product, 'WC_Product')) {
                continue;
            }

            // Downloads / non-shippable products do not enter the fulfillment ledger.
            if (!$product->needs_shipping()) {
                continue;
            }

            $group_key = self::resolve_group_key_for_order_item($item);

            if ($group_key === '') {
                continue;
            }

            if (!isset($group_rows[$group_key])) {
                $group_rows[$group_key] = self::build_empty_group($group_key);
            }

            $qty_ordered = max(0, (int) $item->get_quantity());
            $shipping_class = sanitize_title((string) $product->get_shipping_class());

            $item_row = array(
                'order_item_id'  => (int) $item_id,
                'product_id'     => (int) $product->get_id(),
                'qty_ordered'    => $qty_ordered,
                'shipping_class' => $shipping_class,
                'resolved_group' => $group_key,
                'unassigned_qty' => ($group_key === 'immediate') ? 0 : $qty_ordered,
            );

            $group_rows[$group_key]['items'][] = $item_row;
        }

        // Immediate gets one default shipment seeded with all qty.
        if (!empty($group_rows['immediate'])) {
            $shipment = self::build_default_shipment('immediate', 1);

            foreach ($group_rows['immediate']['items'] as $item_row) {
                $shipment['allocations'][] = array(
                    'order_item_id' => $item_row['order_item_id'],
                    'qty'           => $item_row['qty_ordered'],
                );
            }

            $group_rows['immediate']['shipments'][] = $shipment;
        }

        // Batch remains deferred and shipment-less until later.
        // External remains shipment-less and operationally closed.

        $normalized['groups'] = array_values($group_rows);

        return $normalized;
    }

    protected static function build_empty_group($group_key) {
        $group_type = ($group_key === 'external') ? 'external' : 'warehouse';
        $lane_status = ($group_key === 'external') ? 'closed' : 'open';
        $execution_mode = 'immediate';

        if ($group_key === 'batch') {
            $execution_mode = 'deferred';
        } elseif ($group_key === 'external') {
            $execution_mode = 'external';
        }

        return array(
            'group_key'      => $group_key,
            'group_type'     => $group_type,
            'lane_status'    => $lane_status,
            'execution_mode' => $execution_mode,
            'items'          => array(),
            'shipments'      => array(),
        );
    }

    protected static function build_default_shipment($group_key, $shipment_number) {
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

    public static function normalize_fulfillment_groups(array $groups) {
        if (empty($groups['groups']) || !is_array($groups['groups'])) {
            return $groups;
        }

        foreach ($groups['groups'] as $index => $group) {
            if (empty($group['group_key']) || !is_array($group)) {
                continue;
            }

            if ($group['group_key'] === 'immediate') {
                $groups['groups'][$index] = self::normalize_immediate_group($group);
            }
        }

        return $groups;
    }

    protected static function normalize_immediate_group(array $group) {
        $items = !empty($group['items']) && is_array($group['items']) ? array_values($group['items']) : array();
        $shipments = !empty($group['shipments']) && is_array($group['shipments']) ? array_values($group['shipments']) : array();

        if (empty($shipments)) {
            $shipments[] = self::build_default_shipment('immediate', 1);
        }

        $shipments = self::normalize_immediate_shipments($shipments, $items);
        $items = self::normalize_immediate_items_against_allocations($items, $shipments);
        $shipments = self::prune_empty_shipments($shipments);
        $shipments = self::renumber_shipments($shipments);
        $items = self::normalize_immediate_items_against_allocations($items, $shipments);

        $group['items'] = array_values($items);
        $group['shipments'] = array_values($shipments);

        return $group;
    }

    protected static function normalize_immediate_items_against_allocations(array $items, array $shipments) {
        $allocation_totals = self::get_allocation_totals_by_item($shipments);

        foreach ($items as &$item) {
            $qty_ordered = isset($item['qty_ordered']) ? max(0, (int) $item['qty_ordered']) : 0;
            $order_item_id = !empty($item['order_item_id']) ? (int) $item['order_item_id'] : 0;
            $allocated = !empty($allocation_totals[$order_item_id]) ? (int) $allocation_totals[$order_item_id] : 0;

            $item['qty_ordered'] = $qty_ordered;
            $item['unassigned_qty'] = max(0, $qty_ordered - $allocated);
        }
        unset($item);

        return $items;
    }

    protected static function normalize_immediate_shipments(array $shipments, array $items) {
        $item_qty_map = self::get_item_qty_map($items);

        foreach ($shipments as &$shipment) {
            $allocations = !empty($shipment['allocations']) && is_array($shipment['allocations']) ? $shipment['allocations'] : array();
            $shipment['allocations'] = self::normalize_shipment_allocations($allocations, $item_qty_map);
        }
        unset($shipment);

        return $shipments;
    }

    protected static function get_item_qty_map(array $items) {
        $map = array();

        foreach ($items as $item) {
            $order_item_id = !empty($item['order_item_id']) ? (int) $item['order_item_id'] : 0;
            if ($order_item_id < 1) {
                continue;
            }

            $map[$order_item_id] = isset($item['qty_ordered']) ? max(0, (int) $item['qty_ordered']) : 0;
        }

        return $map;
    }

    protected static function get_allocation_totals_by_item(array $shipments) {
        $totals = array();

        foreach ($shipments as $shipment) {
            $allocations = !empty($shipment['allocations']) && is_array($shipment['allocations']) ? $shipment['allocations'] : array();

            foreach ($allocations as $allocation) {
                $order_item_id = !empty($allocation['order_item_id']) ? (int) $allocation['order_item_id'] : 0;
                $qty = isset($allocation['qty']) ? max(0, (int) $allocation['qty']) : 0;

                if ($order_item_id < 1 || $qty < 1) {
                    continue;
                }

                if (!isset($totals[$order_item_id])) {
                    $totals[$order_item_id] = 0;
                }

                $totals[$order_item_id] += $qty;
            }
        }

        return $totals;
    }

    protected static function normalize_shipment_allocations(array $allocations, array $item_qty_map) {
        $normalized = array();

        foreach ($allocations as $allocation) {
            $order_item_id = !empty($allocation['order_item_id']) ? (int) $allocation['order_item_id'] : 0;
            $qty = isset($allocation['qty']) ? max(0, (int) $allocation['qty']) : 0;

            if ($order_item_id < 1 || $qty < 1) {
                continue;
            }

            if (!array_key_exists($order_item_id, $item_qty_map)) {
                continue;
            }

            if (!isset($normalized[$order_item_id])) {
                $normalized[$order_item_id] = 0;
            }

            $normalized[$order_item_id] += $qty;
        }

        $result = array();

        foreach ($normalized as $order_item_id => $qty) {
            $max_qty = isset($item_qty_map[$order_item_id]) ? max(0, (int) $item_qty_map[$order_item_id]) : 0;
            $qty = min($qty, $max_qty);

            if ($qty < 1) {
                continue;
            }

            $result[] = array(
                'order_item_id' => (int) $order_item_id,
                'qty'           => (int) $qty,
            );
        }

        return array_values($result);
    }

    protected static function prune_empty_shipments(array $shipments) {
        $pruned = array();

        foreach ($shipments as $index => $shipment) {
            $shipment_number = !empty($shipment['shipment_number']) ? (int) $shipment['shipment_number'] : ($index + 1);
            $allocations = !empty($shipment['allocations']) && is_array($shipment['allocations']) ? $shipment['allocations'] : array();
            $has_labels = !empty($shipment['fulfillment']['labels']) && is_array($shipment['fulfillment']['labels']) && !empty($shipment['fulfillment']['labels']);
            $has_return_labels = !empty($shipment['fulfillment']['return_labels']) && is_array($shipment['fulfillment']['return_labels']) && !empty($shipment['fulfillment']['return_labels']);
            $is_empty = empty($allocations);

            if ($shipment_number > 1 && $is_empty && !$has_labels && !$has_return_labels) {
                continue;
            }

            $pruned[] = $shipment;
        }

        if (empty($pruned)) {
            $pruned[] = self::build_default_shipment('immediate', 1);
        }

        return array_values($pruned);
    }

    protected static function renumber_shipments(array $shipments) {
        foreach ($shipments as $index => &$shipment) {
            $shipment_number = $index + 1;
            $shipment['shipment_number'] = $shipment_number;
            $shipment['shipment_key'] = 'immediate_shp_' . $shipment_number;
        }
        unset($shipment);

        return array_values($shipments);
    }

    public static function resolve_active_shipment_after_mutation(array $groups, $preferred = null) {
        $immediate_group = null;

        if (!empty($groups['groups']) && is_array($groups['groups'])) {
            foreach ($groups['groups'] as $group) {
                if (!empty($group['group_key']) && $group['group_key'] === 'immediate') {
                    $immediate_group = $group;
                    break;
                }
            }
        }

        if (!$immediate_group || !is_array($immediate_group)) {
            return 1;
        }

        if (self::immediate_group_has_unassigned($immediate_group)) {
            return 'unassigned';
        }

        $shipments = !empty($immediate_group['shipments']) && is_array($immediate_group['shipments'])
            ? array_values($immediate_group['shipments'])
            : array();

        if (empty($shipments)) {
            return 1;
        }

        $preferred = ($preferred === 'unassigned') ? 'unassigned' : (int) $preferred;

        if (is_int($preferred) && $preferred > 0) {
            foreach ($shipments as $shipment) {
                if (!empty($shipment['shipment_number']) && (int) $shipment['shipment_number'] === $preferred) {
                    return $preferred;
                }
            }
        }

        return !empty($shipments[0]['shipment_number']) ? (int) $shipments[0]['shipment_number'] : 1;
    }

    protected static function immediate_group_has_unassigned(array $group) {
        $items = !empty($group['items']) && is_array($group['items']) ? $group['items'] : array();

        foreach ($items as $item) {
            if (!empty($item['unassigned_qty'])) {
                return true;
            }
        }

        return false;
    }

    protected static function resolve_group_key_for_order_item($item) {
        $product = $item->get_product();

        if (!$product || !is_a($product, 'WC_Product')) {
            return '';
        }

        if (!$product->needs_shipping()) {
            return '';
        }

        $shipping_class_id = (int) $product->get_shipping_class_id();

        if ($shipping_class_id < 1) {
            return 'immediate';
        }

        $stored = get_option('ssb_fulfillment_lanes', array());
        $stored = is_array($stored) ? $stored : array();

        foreach (array('batch', 'immediate', 'external') as $lane_key) {
            $lane = isset($stored[$lane_key]) ? $stored[$lane_key] : array();

            // Backward compatibility: old format was just an array of term IDs.
            if (is_array($lane) && array_keys($lane) === range(0, count($lane) - 1)) {
                $ids = array_values(array_unique(array_map('absint', $lane)));
            } else {
                $ids = !empty($lane['shipping_classes']) && is_array($lane['shipping_classes'])
                    ? array_values(array_unique(array_map('absint', $lane['shipping_classes'])))
                    : array();
            }

            if (in_array($shipping_class_id, $ids, true)) {
                return $lane_key;
            }
        }

        return 'immediate';
    }

    /**
     * Return a normalized shipment state for the order.
     *
     * States:
     * - none
     * - ready
     * - purchased_partial
     * - purchased_hydrated
     *
     * @param WC_Order $order
     * @return string
     */
public static function get_order_state($order) {
    if (!$order || !is_a($order, 'WC_Order')) {
        return 'none';
    }

    $has_outbound_label = self::has_purchased_label($order);
    $has_return_label   = self::has_return_label($order);

    if ($has_outbound_label && $has_return_label) {
        return 'both';
    }

    if ($has_outbound_label) {
        return 'outbound_only';
    }

    if ($has_return_label) {
    return 'return_only';
}

// 🔄 NEW: detect existing shipment without label
$order_id = $order->get_id();
$shipment_id = (string) get_post_meta($order_id, '_shoshin_shippo_shipment_id', true);

// If shipment exists but no purchased label → treat as ready
if ($shipment_id !== '' && !$has_outbound_label) {
    return 'ready';
}

return self::get_physical_item_count($order) > 0 ? 'ready' : 'none';
}

    /**
     * Whether the order has a purchased label.
     *
     * @param WC_Order $order
     * @return bool
     */
    public static function has_purchased_label($order) {
    if (!$order || !is_a($order, 'WC_Order')) {
        return false;
    }

    $order_id = $order->get_id();

    $transaction_id    = (string) get_post_meta($order_id, '_shoshin_shippo_transaction_id', true);
    $transaction_status = strtoupper((string) get_post_meta($order_id, '_shoshin_shippo_transaction_status', true));
    $label_url         = (string) get_post_meta($order_id, '_shoshin_shippo_label_url', true);

    /*
     * Authoritative rule:
     * - A successful outbound purchase is primarily represented by a persisted
     *   Shippo transaction ID created only after a successful buy flow.
     * - Label URL is allowed as a fallback for already-hydrated historical data.
     * - Snapshot tracking/label fields must NOT promote a draft shipment into
     *   a purchased state on their own.
     */
    if ($transaction_id !== '') {
        return ($transaction_status === '' || $transaction_status === 'SUCCESS');
    }

    return ($label_url !== '');
}

    /**
 * Whether the order has a purchased return label.
 *
 * @param WC_Order $order
 * @return bool
 */
public static function has_return_label($order) {
    if (!$order || !is_a($order, 'WC_Order')) {
        return false;
    }

    $order_id = $order->get_id();

    $transaction_id = (string) get_post_meta($order_id, '_shoshin_shippo_return_transaction_id', true);
    $label_url      = (string) get_post_meta($order_id, '_shoshin_shippo_return_label_url', true);

    return ($transaction_id !== '' || $label_url !== '');
}

    /**
     * Return the collapsed summary text for the Shipping Label card.
     *
     * @param WC_Order $order
     * @return string
     */
    public static function get_summary_text($order) {
    $state = self::get_order_state($order);

    switch ($state) {
        case 'both':
            return 'Outbound and return labels are active and ready to print';

        case 'outbound_only':
            return 'Shipping label purchased — ready to print';

        case 'return_only':
            return 'Return label is active and ready to print';

    case 'ready':
        $groups = self::get_fulfillment_groups($order);

        $immediate_count = 0;
        $batch_count = 0;
        $has_unassigned_items = false;

        if (!empty($groups['groups']) && is_array($groups['groups'])) {
            foreach ($groups['groups'] as $group) {

                if (empty($group['group_key']) || empty($group['items']) || !is_array($group['items'])) {
                    continue;
                }

                foreach ($group['items'] as $item_row) {
                    $qty = isset($item_row['qty_ordered']) ? max(0, (int) $item_row['qty_ordered']) : 0;

                    // Immediate = ready
                    if ($group['group_key'] === 'immediate') {
                        $immediate_count += $qty;

                        if (!empty($item_row['unassigned_qty'])) {
                            $has_unassigned_items = true;
                        }
                    }

                    // Batch = deferred
                    elseif ($group['group_key'] === 'batch') {
                        $batch_count += $qty;
                    }

                    // External + Download intentionally ignored
                }
            }
        }

        // 🚨 Priority: blocking state
        if ($has_unassigned_items) {
            return 'There are unassigned items. This order cannot be closed until all items have been shipped.';
        }

        // Mixed
        if ($immediate_count > 0 && $batch_count > 0) {
            return sprintf(
                '%d %s currently ready to be fulfilled and %d %s deferred',
                $immediate_count,
                $immediate_count === 1 ? 'item is' : 'items are',
                $batch_count,
                $batch_count === 1 ? 'item is' : 'items are'
            );
        }

        // Immediate only
        if ($immediate_count > 0) {
            return sprintf(
                '%d %s currently ready to be fulfilled',
                $immediate_count,
                $immediate_count === 1 ? 'item is' : 'items are'
            );
        }

        // Batch only
        if ($batch_count > 0) {
            return sprintf(
                '%d %s deferred',
                $batch_count,
                $batch_count === 1 ? 'item is' : 'items are'
            );
        }

        return 'No shippable items found for this order.';

            case 'none':
            default:
                return 'No shippable items found for this order.';
        }
    }

    /**
     * Return the primary action label for the Shipping Label card.
     *
     * @param WC_Order $order
     * @return string
     */
    public static function get_primary_action_label($order) {
    $state = self::get_order_state($order);

    if (in_array($state, array('both', 'outbound_only', 'return_only'), true)) {
        return 'Open shipping label';
    }

    return 'Create shipping label';
}

    /**
     * Return a tracking payload for the sidebar card and JS hydration.
     *
     * @param WC_Order $order
     * @return array
     */
        public static function get_tracking_payload($order) {
        if (!$order || !is_a($order, 'WC_Order')) {
            return array();
        }

        $order_id = $order->get_id();

        $shipment_id     = (string) get_post_meta($order_id, '_shoshin_shippo_shipment_id', true);
        $transaction_id  = (string) get_post_meta($order_id, '_shoshin_shippo_transaction_id', true);
        $tracking_number = (string) get_post_meta($order_id, '_shoshin_shippo_tracking_number', true);
        $tracking_status = (string) get_post_meta($order_id, '_shoshin_shippo_tracking_status', true);
        $carrier         = (string) get_post_meta($order_id, '_shoshin_shippo_carrier', true);
        $service         = (string) get_post_meta($order_id, '_shoshin_shippo_service', true);
        $label_url       = (string) get_post_meta($order_id, '_shoshin_shippo_label_url', true);
        $tracking_url    = (string) get_post_meta($order_id, '_shoshin_shippo_tracking_url', true);

        $snapshot = get_post_meta($order_id, '_shoshin_shippo_selected_rate_snapshot', true);
        $snapshot = is_array($snapshot) ? $snapshot : array();

        if ($tracking_number === '' && !empty($snapshot['tracking_number'])) {
            $tracking_number = (string) $snapshot['tracking_number'];
        }

        if ($carrier === '' && !empty($snapshot['provider'])) {
            $carrier = (string) $snapshot['provider'];
        }

        if ($service === '' && !empty($snapshot['service'])) {
            $service = (string) $snapshot['service'];
        }

        if ($label_url === '' && !empty($snapshot['label_url'])) {
            $label_url = (string) $snapshot['label_url'];
        }

        if ($tracking_url === '' && !empty($snapshot['tracking_url'])) {
            $tracking_url = (string) $snapshot['tracking_url'];
        }

        $needs_transaction_hydration = (
            $transaction_id !== '' &&
            (
                $tracking_number === '' ||
                $carrier === '' ||
                $service === '' ||
                $label_url === '' ||
                $tracking_url === ''
            )
        );

        if ($needs_transaction_hydration && class_exists('SSB_Shippo_Client')) {
            $tx_lookup = SSB_Shippo_Client::get_transaction($transaction_id);

            if (!empty($tx_lookup['success']) && !empty($tx_lookup['raw']) && is_array($tx_lookup['raw'])) {
                $tx = $tx_lookup['raw'];

                if ($tracking_number === '' && !empty($tx['tracking_number'])) {
                    $tracking_number = (string) $tx['tracking_number'];
                    update_post_meta($order_id, '_shoshin_shippo_tracking_number', $tracking_number);
                }

                if ($tracking_status === '' && !empty($tx['tracking_status'])) {
                    $tracking_status = (string) $tx['tracking_status'];
                    update_post_meta($order_id, '_shoshin_shippo_tracking_status', $tracking_status);
                }

                if ($tracking_url === '' && !empty($tx['tracking_url_provider'])) {
                    $tracking_url = (string) $tx['tracking_url_provider'];
                    update_post_meta($order_id, '_shoshin_shippo_tracking_url', $tracking_url);
                }

                if ($label_url === '') {
                    if (!empty($tx['label_url'])) {
                        $label_url = (string) $tx['label_url'];
                    } elseif (!empty($tx['label_file'])) {
                        $label_url = (string) $tx['label_file'];
                    }

                    if ($label_url !== '') {
                        update_post_meta($order_id, '_shoshin_shippo_label_url', $label_url);
                    }
                }

                $rate = !empty($tx['rate']) && is_array($tx['rate']) ? $tx['rate'] : array();

                if ($carrier === '' && !empty($rate['provider'])) {
                    $carrier = (string) $rate['provider'];
                    update_post_meta($order_id, '_shoshin_shippo_carrier', $carrier);
                }

                if ($service === '') {
                    if (!empty($rate['servicelevel_name'])) {
                        $service = (string) $rate['servicelevel_name'];
                    } elseif (!empty($rate['servicelevel']['name'])) {
                        $service = (string) $rate['servicelevel']['name'];
                    }

                    if ($service !== '') {
                        update_post_meta($order_id, '_shoshin_shippo_service', $service);
                    }
                }

                $snapshot_changed = false;

                if (empty($snapshot['provider']) && $carrier !== '') {
                    $snapshot['provider'] = $carrier;
                    $snapshot_changed = true;
                }

                if (empty($snapshot['service']) && $service !== '') {
                    $snapshot['service'] = $service;
                    $snapshot_changed = true;
                }

                if (empty($snapshot['tracking_number']) && $tracking_number !== '') {
                    $snapshot['tracking_number'] = $tracking_number;
                    $snapshot_changed = true;
                }

                if (empty($snapshot['tracking_url']) && $tracking_url !== '') {
                    $snapshot['tracking_url'] = $tracking_url;
                    $snapshot_changed = true;
                }

                if (empty($snapshot['label_url']) && $label_url !== '') {
                    $snapshot['label_url'] = $label_url;
                    $snapshot_changed = true;
                }

                if (empty($snapshot['amount']) && !empty($rate['amount'])) {
                    $snapshot['amount'] = (string) $rate['amount'];
                    $snapshot_changed = true;
                }

                if (empty($snapshot['currency']) && !empty($rate['currency'])) {
                    $snapshot['currency'] = (string) $rate['currency'];
                    $snapshot_changed = true;
                }

                if ($snapshot_changed) {
                    update_post_meta($order_id, '_shoshin_shippo_selected_rate_snapshot', $snapshot);
                }
            }
        }

        return array(
            'state'           => self::get_order_state($order),
            'shipment_id'     => $shipment_id,
            'transaction_id'  => $transaction_id,
            'tracking_number' => $tracking_number,
            'tracking_status' => $tracking_status,
            'carrier'         => $carrier,
            'service'         => $service,
            'label_url'       => $label_url,
            'tracking_url'    => $tracking_url,
        );
    }

    /**
     * Return the current parcel snapshot or a blank structure.
     *
     * @param WC_Order $order
     * @return array
     */
    public static function get_parcel_snapshot($order) {
        $blank = array(
            'weight' => '',
            'length' => '',
            'width'  => '',
            'height' => '',
        );

        if (!$order || !is_a($order, 'WC_Order')) {
            return $blank;
        }

        $snapshot = get_post_meta($order->get_id(), '_shoshin_shippo_parcel_snapshot', true);

        if (!is_array($snapshot)) {
            return $blank;
        }

        return array(
            'weight' => isset($snapshot['weight']) ? (string) $snapshot['weight'] : '',
            'length' => isset($snapshot['length']) ? (string) $snapshot['length'] : '',
            'width'  => isset($snapshot['width']) ? (string) $snapshot['width'] : '',
            'height' => isset($snapshot['height']) ? (string) $snapshot['height'] : '',
        );
    }

    /**
     * Count physical/shippable line item quantity.
     *
     * @param WC_Order $order
     * @return int
     */
    protected static function get_physical_item_count($order) {
        if (!$order || !is_a($order, 'WC_Order')) {
            return 0;
        }

        $count = 0;

        foreach ($order->get_items('line_item') as $item) {
            $product = $item->get_product();

            if (!$product || !$product->needs_shipping()) {
                continue;
            }

            $count += max(1, (int) $item->get_quantity());
        }

        return $count;
    }
}