<?php
if (!defined('ABSPATH')) {
    exit;
}

class SSB_Webhooks {

    public static function init() {
        add_action('rest_api_init', array(__CLASS__, 'register_routes'));
    }

    /**
     * Register Shippo webhook route.
     */
    public static function register_routes() {
        register_rest_route('shippo/v1', '/webhook', array(
            'methods'             => 'POST',
            'callback'            => array(__CLASS__, 'handle_webhook'),
            'permission_callback' => [__CLASS__, 'verify_webhook'],
        ));
    }

    public static function verify_webhook($request) {

        $headers = $request->get_headers();
        $signature = '';

        if (!empty($headers['shippo-signature'][0])) {
            $signature = trim((string) $headers['shippo-signature'][0]);
        }

        $expected = trim((string) get_option('ssb_shippo_webhook_secret', ''));

        if ($expected === '') {
            return new WP_Error(
                'forbidden',
                'Shippo webhook secret is not configured.',
                array('status' => 403)
            );
        }

        if ($signature === '' || !hash_equals($expected, $signature)) {
            return new WP_Error(
                'forbidden',
                'Invalid webhook signature.',
                array('status' => 403)
            );
        }

        return true;
    }

    /**
     * Main webhook handler.
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public static function handle_webhook($request) {
        $payload = $request->get_json_params();

        if (!is_array($payload)) {
            return new WP_REST_Response(array(
                'ok'      => false,
                'message' => 'Invalid JSON payload.',
            ), 400);
        }

        $event = isset($payload['event']) ? (string) $payload['event'] : '';

        if ($event === '') {
            return new WP_REST_Response(array(
                'ok'      => false,
                'message' => 'Missing event type.',
            ), 400);
        }

        $order = self::match_order_from_payload($payload);

        if (!$order) {
            return new WP_REST_Response(array(
                'ok'      => false,
                'message' => 'No matching Woo order found.',
                'event'   => $event,
            ), 202);
        }

        $order_id = $order->get_id();

        update_post_meta($order_id, '_shoshin_shippo_last_webhook_at', current_time('mysql'));
        update_post_meta($order_id, '_shoshin_shippo_last_webhook_payload', $payload);

        switch ($event) {
            case 'transaction_created':
            case 'transaction_updated':
                self::handle_transaction_event($order, $payload);
                break;

            case 'track_updated':
                self::handle_track_event($order, $payload);
                break;

            default:
                $order->add_order_note(sprintf(
                    'Shippo webhook received (ignored event): %s',
                    sanitize_text_field($event)
                ));
                break;
        }

        return new WP_REST_Response(array(
            'ok'      => true,
            'order_id'=> $order_id,
            'event'   => $event,
        ), 200);
    }

    /**
     * Handle Shippo transaction events.
     *
     * @param WC_Order $order
     * @param array    $payload
     * @return void
     */
    protected static function handle_transaction_event($order, array $payload) {
        $data = self::extract_payload_data($payload);

        $transaction_id  = !empty($data['object_id']) ? (string) $data['object_id'] : '';
        $tracking_number = !empty($data['tracking_number']) ? (string) $data['tracking_number'] : '';
        $label_url       = !empty($data['label_url']) ? (string) $data['label_url'] : '';
        $status          = !empty($data['status']) ? (string) $data['status'] : '';
        $carrier         = !empty($data['rate']['provider']) ? (string) $data['rate']['provider'] : '';
        $service         = !empty($data['rate']['servicelevel']['name']) ? (string) $data['rate']['servicelevel']['name'] : '';

        if ($transaction_id !== '') {
            update_post_meta($order->get_id(), '_shoshin_shippo_transaction_id', $transaction_id);
        }

        if ($tracking_number !== '') {
            update_post_meta($order->get_id(), '_shoshin_shippo_tracking_number', $tracking_number);
        }

        if ($label_url !== '') {
            update_post_meta($order->get_id(), '_shoshin_shippo_label_url', esc_url_raw($label_url));
        }

        if ($status !== '') {
            update_post_meta($order->get_id(), '_shoshin_shippo_tracking_status', $status);
        }

        if ($carrier !== '') {
            update_post_meta($order->get_id(), '_shoshin_shippo_carrier', $carrier);
        }

        if ($service !== '') {
            update_post_meta($order->get_id(), '_shoshin_shippo_service', $service);
        }

        $last_status = get_post_meta($order->get_id(), '_shoshin_shippo_last_noted_status', true);

if ($status !== '' && $status === $last_status) {
    return;
}

update_post_meta($order->get_id(), '_shoshin_shippo_last_noted_status', $status);

        $order->add_order_note(sprintf(
            'Shippo transaction webhook received: %s%s%s',
            $status !== '' ? 'Status: ' . sanitize_text_field($status) : 'Transaction updated',
            $carrier !== '' ? ' | Carrier: ' . sanitize_text_field($carrier) : '',
            $tracking_number !== '' ? ' | Tracking: ' . sanitize_text_field($tracking_number) : ''
        ));
    }

    /**
     * Handle Shippo track_updated events.
     *
     * @param WC_Order $order
     * @param array    $payload
     * @return void
     */
    protected static function handle_track_event($order, array $payload) {
        $data = self::extract_payload_data($payload);

        $tracking_number = !empty($data['tracking_number']) ? (string) $data['tracking_number'] : '';
        $carrier         = !empty($data['carrier']) ? (string) $data['carrier'] : '';
        $status          = !empty($data['tracking_status']['status']) ? (string) $data['tracking_status']['status'] : '';
        $status_details  = !empty($data['tracking_status']['status_details']) ? (string) $data['tracking_status']['status_details'] : '';
        $eta             = !empty($data['eta']) ? maybe_serialize($data['eta']) : '';

        if ($tracking_number !== '') {
            update_post_meta($order->get_id(), '_shoshin_shippo_tracking_number', $tracking_number);
        }

        if ($carrier !== '') {
            update_post_meta($order->get_id(), '_shoshin_shippo_carrier', $carrier);
        }

        if ($status !== '') {
            update_post_meta($order->get_id(), '_shoshin_shippo_tracking_status', $status);
        }

        if ($eta !== '') {
            update_post_meta($order->get_id(), '_shoshin_shippo_eta', $eta);
        }

        $note = 'Shippo tracking updated';
        if ($status !== '') {
            $note .= ': ' . sanitize_text_field($status);
        }
        if ($status_details !== '') {
            $note .= ' — ' . sanitize_text_field($status_details);
        }
        if ($tracking_number !== '') {
            $note .= ' | Tracking: ' . sanitize_text_field($tracking_number);
        }

        $last_status = get_post_meta($order->get_id(), '_shoshin_shippo_last_noted_status', true);

if ($status !== '' && $status === $last_status) {
    return;
}

update_post_meta($order->get_id(), '_shoshin_shippo_last_noted_status', $status);

        $order->add_order_note($note);
    }

    /**
     * Try to match a Woo order from Shippo webhook payload.
     *
     * Strategy:
     * 1. Metadata contains "Woo Order #123"
     * 2. Transaction/shipment metadata contains an order ID
     * 3. Stored tracking number match
     *
     * @param array $payload
     * @return WC_Order|false
     */
    protected static function match_order_from_payload(array $payload) {
        $data = self::extract_payload_data($payload);

        $metadata_candidates = array();

        if (!empty($payload['metadata'])) {
            $metadata_candidates[] = (string) $payload['metadata'];
        }

        if (!empty($data['metadata'])) {
            $metadata_candidates[] = (string) $data['metadata'];
        }

        if (!empty($data['transaction']['metadata'])) {
            $metadata_candidates[] = (string) $data['transaction']['metadata'];
        }

        foreach ($metadata_candidates as $metadata) {
            $order_id = self::extract_order_id_from_metadata($metadata);
            if ($order_id > 0) {
                $order = wc_get_order($order_id);
                if ($order) {
                    return $order;
                }
            }
        }

        $tracking_number = '';

        if (!empty($data['tracking_number'])) {
            $tracking_number = (string) $data['tracking_number'];
        } elseif (!empty($payload['tracking_number'])) {
            $tracking_number = (string) $payload['tracking_number'];
        }

        if ($tracking_number !== '') {
            $orders = wc_get_orders(array(
                'limit'      => 1,
                'meta_key'   => '_shoshin_shippo_tracking_number',
                'meta_value' => $tracking_number,
                'return'     => 'objects',
            ));

            if (!empty($orders) && is_array($orders)) {
                return $orders[0];
            }
        }

        return false;
    }

    /**
     * Extract nested "data" object when present; otherwise use payload root.
     *
     * @param array $payload
     * @return array
     */
    protected static function extract_payload_data(array $payload) {
        if (!empty($payload['data']) && is_array($payload['data'])) {
            return $payload['data'];
        }

        return $payload;
    }

    /**
     * Extract a Woo order ID from metadata strings like:
     * - "Woo Order #4994"
     * - "order_id:4994"
     * - "Order 4994"
     *
     * @param string $metadata
     * @return int
     */
    protected static function extract_order_id_from_metadata($metadata) {
        $metadata = trim((string) $metadata);

        if ($metadata === '') {
            return 0;
        }

        $patterns = array(
            '/Woo\s+Order\s+#(\d+)/i',
            '/order_id[:=\s]+(\d+)/i',
            '/Order\s+#?(\d+)/i',
        );

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $metadata, $matches)) {
                return absint($matches[1]);
            }
        }

        return 0;
    }
}