<?php
if (!defined('ABSPATH')) {
    exit;
}

class SSB_Packing_Slip {

    public static function init() {
        add_action('admin_post_ssb_print_packing_slip', array(__CLASS__, 'render_print_view'));
    }

    public static function render_print_view() {
        if (!current_user_can('edit_shop_orders')) {
            wp_die('Permission denied.');
        }

        $order_id = isset($_GET['order_id']) ? absint($_GET['order_id']) : 0;
        $nonce    = isset($_GET['_wpnonce']) ? sanitize_text_field(wp_unslash($_GET['_wpnonce'])) : '';

        if (!$order_id || !wp_verify_nonce($nonce, 'ssb_print_packing_slip_' . $order_id)) {
            wp_die('Invalid request.');
        }

        $order = wc_get_order($order_id);
        if (!$order) {
            wp_die('Order not found.');
        }

        $origin = SSB_Settings::get_origin_address();
        $parcel = SSB_State::get_parcel_snapshot($order);

        $shipment_id     = (string) get_post_meta($order_id, '_shoshin_shippo_shipment_id', true);
        $tracking_number = (string) get_post_meta($order_id, '_shoshin_shippo_tracking_number', true);
        $carrier         = (string) get_post_meta($order_id, '_shoshin_shippo_carrier', true);
        $service         = (string) get_post_meta($order_id, '_shoshin_shippo_service', true);

        nocache_headers();
        ?>
        <!doctype html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Packing Slip — Order #<?php echo esc_html($order->get_order_number()); ?></title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    color: #111;
                    margin: 24px;
                    font-size: 14px;
                    line-height: 1.4;
                }
                .ssb-slip-wrap {
                    max-width: 900px;
                    margin: 0 auto;
                }
                .ssb-slip-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 24px;
                    margin-bottom: 24px;
                    padding-bottom: 16px;
                    border-bottom: 2px solid #111;
                }
                .ssb-slip-title {
                    font-size: 28px;
                    font-weight: 700;
                    margin: 0 0 6px;
                }
                .ssb-slip-meta p,
                .ssb-slip-address p {
                    margin: 0 0 6px;
                }
                .ssb-slip-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                    margin-bottom: 24px;
                }
                .ssb-slip-card {
                    border: 1px solid #d9d9d9;
                    padding: 14px 16px;
                }
                .ssb-slip-card h3 {
                    margin: 0 0 10px;
                    font-size: 16px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                th, td {
                    text-align: left;
                    padding: 10px 8px;
                    border-bottom: 1px solid #ddd;
                    vertical-align: top;
                }
                th {
                    background: #f6f6f6;
                    font-size: 13px;
                }
                .ssb-picked-box {
                    width: 18px;
                    height: 18px;
                    border: 1px solid #999;
                    display: inline-block;
                }
                .ssb-slip-footer {
                    margin-top: 24px;
                    font-size: 12px;
                    color: #555;
                }
                @media print {
                    body {
                        margin: 0;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="ssb-slip-wrap">
                <div class="ssb-slip-header">
                    <div>
                        <h1 class="ssb-slip-title">Packing Slip</h1>
                        <div class="ssb-slip-meta">
                            <p><strong>Order #:</strong> <?php echo esc_html($order->get_order_number()); ?></p>
                            <p><strong>Shipment #:</strong> <?php echo esc_html($shipment_id !== '' ? $shipment_id : '—'); ?></p>
                            <p><strong>Ship date:</strong> <?php echo esc_html(wp_date('F j, Y')); ?></p>
                            <p><strong>Carrier / Service:</strong> <?php echo esc_html(trim($carrier . ' — ' . $service, ' —')); ?></p>
                            <p><strong>Tracking:</strong> <?php echo esc_html($tracking_number !== '' ? $tracking_number : '—'); ?></p>
                        </div>
                    </div>

                    <div class="no-print">
                        <button onclick="window.print()">Print</button>
                    </div>
                </div>

                <div class="ssb-slip-grid">
                    <div class="ssb-slip-card ssb-slip-address">
                        <h3>Ship From</h3>
                        <p><?php echo esc_html($origin['name']); ?></p>
                        <p><?php echo esc_html($origin['street1']); ?></p>
                        <?php if (!empty($origin['street2'])) : ?><p><?php echo esc_html($origin['street2']); ?></p><?php endif; ?>
                        <p><?php echo esc_html(trim($origin['city'] . ', ' . $origin['state'] . ' ' . $origin['zip'])); ?></p>
                        <p><?php echo esc_html($origin['country']); ?></p>
                    </div>

                    <div class="ssb-slip-card ssb-slip-address">
                        <h3>Ship To</h3>
                        <p><?php echo esc_html(trim($order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name())); ?></p>
                        <p><?php echo esc_html($order->get_shipping_address_1()); ?></p>
                        <?php if ($order->get_shipping_address_2()) : ?><p><?php echo esc_html($order->get_shipping_address_2()); ?></p><?php endif; ?>
                        <p><?php echo esc_html(trim($order->get_shipping_city() . ', ' . $order->get_shipping_state() . ' ' . $order->get_shipping_postcode())); ?></p>
                        <p><?php echo esc_html($order->get_shipping_country()); ?></p>
                    </div>
                </div>

                <div class="ssb-slip-card">
                    <h3>Package Details</h3>
                    <p><strong>Dimensions:</strong> <?php echo esc_html(($parcel['length'] !== '' && $parcel['width'] !== '' && $parcel['height'] !== '') ? $parcel['length'] . ' × ' . $parcel['width'] . ' × ' . $parcel['height'] . ' in' : '—'); ?></p>
                    <p><strong>Weight:</strong> <?php echo esc_html($parcel['weight'] !== '' ? $parcel['weight'] . ' lb' : '—'); ?></p>
                </div>

                <?php $packing_note = (string) get_post_meta($order_id, '_shoshin_shippo_packing_note', true); ?>
                <?php if ($packing_note !== '') : ?>
                    <div class="ssb-slip-card" style="margin-top: 16px;">
                        <h3>Packing Note</h3>
                        <p><?php echo wp_kses_post(nl2br($packing_note)); ?></p>
                    </div>
                <?php endif; ?>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 36%;">Item</th>
                            <th style="width: 10%;">Qty</th>
                            <th style="width: 20%;">Dimensions</th>
                            <th style="width: 14%;">Weight</th>
                            <th style="width: 10%;">Price</th>
                            <th style="width: 10%;">Picked</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($order->get_items('line_item') as $item) : ?>
                            <?php
                            $product = $item->get_product();
                            $dimensions = '—';
                            $weight = '—';

                            if ($product) {
                                $length = $product->get_length();
                                $width  = $product->get_width();
                                $height = $product->get_height();
                                $pweight = $product->get_weight();

                                if ($length || $width || $height) {
                                    $dimensions = trim($length . ' × ' . $width . ' × ' . $height . ' in');
                                }

                                if ($pweight !== '') {
                                    $weight = $pweight . ' lb';
                                }
                            }
                            ?>
                            <tr>
                                <td><?php echo esc_html($item->get_name()); ?></td>
                                <td><?php echo esc_html((string) $item->get_quantity()); ?></td>
                                <td><?php echo esc_html($dimensions); ?></td>
                                <td><?php echo esc_html($weight); ?></td>
                                <td><?php echo wp_kses_post($order->get_formatted_line_subtotal($item)); ?></td>
                                <td><span class="ssb-picked-box"></span></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>

                <div class="ssb-slip-footer">
                    Internal packing slip generated by Shoshin Shippo Bridge.
                </div>
            </div>
        </body>
        </html>
        <?php
        exit;
    }
}