<?php
if (!defined('ABSPATH')) {
    exit;
}

class SSB_Shippo_Client {

    /**
     * Initialize client hooks.
     */
    public static function init() {
        // No hooks needed in v1.
    }

    /**
     * Base Shippo API URL for the documented public API version in use.
     *
     * @return string
     */
    protected static function base_url() {
        return 'https://api.goshippo.com/';
    }

    /**
     * Shared default headers.
     *
     * @return array
     */
    protected static function get_headers() {
        $token = SSB_Settings::get_shippo_token();

        return array(
            'Authorization' => 'ShippoToken ' . $token,
            'Content-Type'  => 'application/json',
            'Accept'        => 'application/json',
        );
    }

    /**
     * Guard: ensure Shippo credentials exist.
     *
     * @return array
     */
    protected static function ensure_ready() {
        $token = SSB_Settings::get_shippo_token();

        if ($token === '') {
            return array(
                'success' => false,
                'message' => 'Shippo API token could not be resolved from the current configuration.',
                'code'    => 'missing_token',
            );
        }

        return array(
            'success' => true,
        );
    }

    /**
     * Low-level request wrapper.
     *
     * @param string $method
     * @param string $endpoint
     * @param array  $payload
     * @return array
     */
    protected static function request($method, $endpoint, array $payload = array()) {
        $ready = self::ensure_ready();
        if (empty($ready['success'])) {
            return $ready;
        }

        $url = trailingslashit(self::base_url()) . ltrim($endpoint, '/');

        $args = array(
            'method'  => strtoupper($method),
            'headers' => self::get_headers(),
            'timeout' => 30,
        );

        if (!empty($payload) && strtoupper($method) !== 'GET') {
            $args['body'] = wp_json_encode($payload);
        }

        $response = wp_remote_request($url, $args);

        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'message' => $response->get_error_message(),
                'code'    => 'wp_http_error',
                'debug'   => array(
                    'endpoint' => $endpoint,
                    'payload'  => $payload,
                ),
            );
        }

        $status_code = (int) wp_remote_retrieve_response_code($response);
        $body_raw    = (string) wp_remote_retrieve_body($response);
        $body        = json_decode($body_raw, true);

        if ($status_code < 200 || $status_code >= 300) {
            return array(
                'success' => false,
                'message' => self::extract_error_message($body, $body_raw, $status_code),
                'code'    => 'shippo_http_error',
                'status'  => $status_code,
                'body'    => is_array($body) ? $body : $body_raw,
                'debug'   => array(
                    'endpoint' => $endpoint,
                    'payload'  => $payload,
                ),
            );
        }

        if (!is_array($body)) {
            return array(
                'success' => false,
                'message' => 'Shippo returned an unexpected response format.',
                'code'    => 'invalid_json',
                'status'  => $status_code,
                'body'    => $body_raw,
                'debug'   => array(
                    'endpoint' => $endpoint,
                    'payload'  => $payload,
                ),
            );
        }

        return array(
            'success' => true,
            'status'  => $status_code,
            'body'    => $body,
        );
    }

    /**
     * Build a normalized recipient address array from a Woo order.
     *
     * @param WC_Order $order
     * @return array
     */
    public static function build_to_address($order) {
        $full_name = trim($order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name());
        if ($full_name === '') {
            $full_name = trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name());
        }

        $recipient_phone = trim((string) $order->get_shipping_phone());

        if ($recipient_phone === '') {
            $recipient_phone = trim((string) $order->get_billing_phone());
        }

        if ($recipient_phone === '') {
            $origin = SSB_Settings::get_origin_address();
            $recipient_phone = !empty($origin['phone']) ? trim((string) $origin['phone']) : '';
        }

        $recipient_phone = preg_replace('/\D+/', '', $recipient_phone);

        $address = array(
            'name'           => $full_name,
            'company'        => $order->get_shipping_company() !== '' ? $order->get_shipping_company() : $order->get_billing_company(),
            'street1'        => $order->get_shipping_address_1(),
            'street2'        => $order->get_shipping_address_2(),
            'city'           => $order->get_shipping_city(),
            'state'          => $order->get_shipping_state(),
            'zip'            => $order->get_shipping_postcode(),
            'country'        => $order->get_shipping_country(),
            'phone'          => $recipient_phone,
            'email'          => $order->get_billing_email(),
            'is_residential' => true,
        );

        return $address;
    }

    /**
     * Normalize parcel input for Shippo.
     *
     * @param array $parcel_input
     * @return array
     */
    public static function normalize_parcel(array $parcel_input) {
        return array(
            'length'        => self::sanitize_decimal($parcel_input, 'length'),
            'width'         => self::sanitize_decimal($parcel_input, 'width'),
            'height'        => self::sanitize_decimal($parcel_input, 'height'),
            'distance_unit' => 'in',
            'weight'        => self::sanitize_decimal($parcel_input, 'weight'),
            'mass_unit'     => 'lb',
        );
    }

        protected static function has_provider_rate(array $rates, $provider) {
        $provider = strtoupper(trim((string) $provider));

        foreach ($rates as $rate) {
            if (!is_array($rate)) {
                continue;
            }

            if (strtoupper(trim((string) ($rate['provider'] ?? ''))) === $provider) {
                return true;
            }
        }

        return false;
    }

    protected static function request_shipment_with_provider_retry(array $payload, $required_provider = 'UPS', $max_attempts = 10, $debug_label = '') {
        $required_provider = strtoupper(trim((string) $required_provider));
        $max_attempts = max(1, (int) $max_attempts);

        $last_response = array();
        $last_body     = array();
        $last_rates    = array();
        $last_messages = array();

        for ($attempt = 1; $attempt <= $max_attempts; $attempt++) {
            if ($attempt > 1) {
                sleep(min(3, $attempt - 1));
            }

            error_log('=== SSB SHIPMENT RETRY ATTEMPT ' . $attempt . ' [' . $debug_label . '] ===');

            $response = self::request('POST', 'shipments/', $payload);
            $last_response = $response;

            error_log(print_r($response, true));

            if (empty($response['success']) || empty($response['body']) || !is_array($response['body'])) {
                continue;
            }

            $body     = $response['body'];
            $rates    = !empty($body['rates']) && is_array($body['rates']) ? $body['rates'] : array();
            $messages = !empty($body['messages']) && is_array($body['messages']) ? $body['messages'] : array();

            $last_body     = $body;
            $last_rates    = $rates;
            $last_messages = $messages;

            if (self::has_provider_rate($rates, $required_provider)) {
                return array(
                    'success'  => true,
                    'response' => $response,
                    'body'     => $body,
                    'rates'    => $rates,
                    'messages' => $messages,
                    'attempts' => $attempt,
                );
            }
        }

        return array(
            'success'  => false,
            'message'  => 'Rate generation timed out. Please try again.',
            'code'     => 'rate_generation_timeout',
            'response' => $last_response,
            'body'     => $last_body,
            'rates'    => $last_rates,
            'messages' => $last_messages,
            'attempts' => $max_attempts,
        );
    }

    /**
     * Create a shipment and return normalized rates.
     *
     * @param WC_Order $order
     * @param array    $parcel_input
     * @return array
     */
    public static function create_shipment_and_get_rates($order, array $parcel_input) {
        if (!$order || !is_a($order, 'WC_Order')) {
            return array(
                'success' => false,
                'message' => 'Invalid WooCommerce order supplied.',
                'code'    => 'invalid_order',
            );
        }

                $from   = SSB_Settings::get_origin_address();
        $to     = self::build_to_address($order);
        $parcel = self::normalize_parcel($parcel_input);

        if (empty($from['phone'])) {
            return array(
                'success' => false,
                'message' => 'Store origin phone is required before requesting rates or purchasing USPS labels.',
                'code'    => 'missing_origin_phone',
            );
        }

        if (empty($from['email'])) {
            return array(
                'success' => false,
                'message' => 'Store origin email is required before requesting rates or purchasing labels.',
                'code'    => 'missing_origin_email',
            );
        }

        if (
            $parcel['length'] === '' ||
            $parcel['width'] === '' ||
            $parcel['height'] === '' ||
            $parcel['weight'] === ''
        ) {
            return array(
                'success' => false,
                'message' => 'Parcel dimensions and weight are required before requesting rates.',
                'code'    => 'missing_parcel_input',
            );
        }

        $payload = array(
            'address_from'  => $from,
            'address_to'    => $to,
            'parcels'       => array($parcel),
            'async'         => false,
            'metadata'      => 'Woo Order #' . $order->get_id(),
            'shipment_date' => gmdate('Y-m-d\TH:i:s\Z'),
        );

        error_log('=== SSB ADMIN FETCH REQUEST ORDER #' . $order->get_id() . ' ===');
        error_log(print_r(array(
            'payload' => $payload,
        ), true));

        $shipment_retry = self::request_shipment_with_provider_retry(
            $payload,
            'UPS',
            10,
            'admin_fetch_rates_order_' . $order->get_id()
        );

        error_log('=== SSB ADMIN FETCH RETRY RESULT ORDER #' . $order->get_id() . ' ===');
        error_log(print_r($shipment_retry, true));

        if (empty($shipment_retry['success'])) {
            return array(
                'success' => false,
                'message' => 'Rate generation timed out. Please try again.',
                'code'    => 'rate_generation_timeout',
                'body'    => !empty($shipment_retry['body']) ? $shipment_retry['body'] : array(),
            );
        }

        $response = $shipment_retry['response'];
        $body     = $shipment_retry['body'];
        $shipment_id = !empty($body['object_id']) ? (string) $body['object_id'] : '';
        $rates       = !empty($body['rates']) && is_array($body['rates']) ? $body['rates'] : array();
        $messages    = !empty($body['messages']) && is_array($body['messages']) ? $body['messages'] : array();

        $rate_notice = array(
            'type'    => '',
            'message' => '',
        );

        if ($shipment_id === '') {
            return array(
                'success' => false,
                'message' => 'Shippo did not return a shipment ID.',
                'code'    => 'missing_shipment_id',
                'body'    => $body,
            );
        }

        $normalized_rates = array();

        foreach ($rates as $rate) {
            if (!is_array($rate)) {
                continue;
            }

            $normalized_rates[] = array(
                'rate_id'        => !empty($rate['object_id']) ? (string) $rate['object_id'] : '',
                'provider'       => !empty($rate['provider']) ? (string) $rate['provider'] : '',
                'provider_image' => !empty($rate['provider_image_75']) ? (string) $rate['provider_image_75'] : '',
                'carrier_account'=> !empty($rate['carrier_account']) ? (string) $rate['carrier_account'] : '',
                'service'        => !empty($rate['servicelevel']['name']) ? (string) $rate['servicelevel']['name'] : '',
                'service_token'  => !empty($rate['servicelevel']['token']) ? (string) $rate['servicelevel']['token'] : '',
                'amount'         => !empty($rate['amount']) ? (string) $rate['amount'] : '',
                'currency'       => !empty($rate['currency']) ? (string) $rate['currency'] : '',
                'estimated_days' => isset($rate['estimated_days']) ? (string) $rate['estimated_days'] : '',
                'duration_terms' => !empty($rate['duration_terms']) ? (string) $rate['duration_terms'] : '',
                'attributes'     => !empty($rate['attributes']) && is_array($rate['attributes']) ? $rate['attributes'] : array(),
                'raw'            => $rate,
            );
        }

                usort($normalized_rates, function($a, $b) {
            return (float) $a['amount'] <=> (float) $b['amount'];
        });

        return array(
            'success'      => true,
            'shipment_id'  => $shipment_id,
            'parcel'       => $parcel,
            'rates'        => $normalized_rates,
            'rate_notice'  => $rate_notice,
            'raw'          => $body,
        );

    }

    /**
     * Purchase a label from a Shippo rate.
     *
     * @param string   $rate_id
     * @param WC_Order $order
     * @return array
     */
    public static function buy_label($rate_id, $order = null, $label_file_type = 'PDF_4x6', $options = array()) {
    $rate_id = trim((string) $rate_id);

    if ($rate_id === '') {
        return array(
            'success' => false,
            'message' => 'A Shippo rate ID is required to purchase a label.',
            'code'    => 'missing_rate_id',
        );
    }

    $metadata = '';
    if ($order && is_a($order, 'WC_Order')) {
        $metadata = 'Woo Order #' . $order->get_id();
    }

    if (!in_array($label_file_type, array('PDF_4x6', 'PDF'), true)) {
        $label_file_type = 'PDF_4x6';
    }

    $options = is_array($options) ? $options : array();

    $payload = array(
        'rate'            => $rate_id,
        'label_file_type' => $label_file_type,
        'async'           => false,
    );

    if ($metadata !== '') {
        $payload['metadata'] = $metadata;
    }

    if (!empty($options)) {
        $payload['options'] = $options;
    }

    error_log('SSB SHIPPO PAYLOAD: ' . print_r($payload, true));

    $response = self::request('POST', 'transactions/', $payload);

    error_log('SSB SHIPPO RESPONSE: ' . print_r($response, true));

    if (empty($response['success'])) {
        return $response;
    }

    $body = $response['body'];

    $transaction_id   = !empty($body['object_id']) ? (string) $body['object_id'] : '';
    $tracking_number  = !empty($body['tracking_number']) ? (string) $body['tracking_number'] : '';
    $tracking_status  = !empty($body['tracking_status']) ? (string) $body['tracking_status'] : '';
    $status           = !empty($body['status']) ? (string) $body['status'] : '';
    $tracking_url     = !empty($body['tracking_url_provider']) ? (string) $body['tracking_url_provider'] : '';
    $messages         = !empty($body['messages']) && is_array($body['messages']) ? $body['messages'] : array();

    $label_url = '';

    if (!empty($body['label_url'])) {
        $label_url = (string) $body['label_url'];
    } elseif (!empty($body['label_file'])) {
        $label_url = (string) $body['label_file'];
    }

    // Some carriers, especially in test mode or slower transaction flows, may not
    // return the final label/tracking fields in the initial POST response.
    // Re-fetch the transaction once if key fields are still missing.
    if ($transaction_id !== '' && ($tracking_number === '' || $label_url === '' || $tracking_url === '')) {
        $tx_lookup = self::get_transaction($transaction_id);

        if (!empty($tx_lookup['success']) && !empty($tx_lookup['raw']) && is_array($tx_lookup['raw'])) {
            $tx = $tx_lookup['raw'];

            if ($tracking_number === '' && !empty($tx['tracking_number'])) {
                $tracking_number = (string) $tx['tracking_number'];
            }

            if ($tracking_status === '' && !empty($tx['tracking_status'])) {
                $tracking_status = (string) $tx['tracking_status'];
            }

            if ($tracking_url === '' && !empty($tx['tracking_url_provider'])) {
                $tracking_url = (string) $tx['tracking_url_provider'];
            }

            if ($label_url === '') {
                if (!empty($tx['label_url'])) {
                    $label_url = (string) $tx['label_url'];
                } elseif (!empty($tx['label_file'])) {
                    $label_url = (string) $tx['label_file'];
                }
            }

            if ($status === '' && !empty($tx['status'])) {
                $status = (string) $tx['status'];
            }

            if (empty($messages) && !empty($tx['messages']) && is_array($tx['messages'])) {
                $messages = $tx['messages'];
            }

            // Use the hydrated transaction body as the canonical raw payload.
            $body = $tx;
        }
    }

    if ($transaction_id === '') {
        return array(
            'success' => false,
            'message' => 'Shippo did not return a transaction ID.',
            'code'    => 'missing_transaction_id',
            'body'    => $body,
        );
    }

    if (strtoupper($status) !== 'SUCCESS') {
        return array(
            'success'            => false,
            'message'            => self::extract_error_message(array('messages' => $messages), '', 400),
            'code'               => 'transaction_not_success',
            'transaction_id'     => $transaction_id,
            'tracking_number'    => $tracking_number,
            'tracking_status'    => $tracking_status,
            'transaction_status' => $status,
            'messages'           => $messages,
            'label_file_type'    => $label_file_type,
            'raw'                => $body,
        );
    }

    $rate_data = !empty($body['rate']) && is_array($body['rate']) ? $body['rate'] : array();

    if (empty($rate_data) && $rate_id !== '') {
        $rate_lookup = self::get_rate($rate_id);

        if (!empty($rate_lookup['success']) && !empty($rate_lookup['raw']) && is_array($rate_lookup['raw'])) {
            $rate_data = $rate_lookup['raw'];
        }
    }

    $provider = !empty($rate_data['provider']) ? (string) $rate_data['provider'] : '';
    $service = '';

    if (!empty($rate_data['servicelevel_name'])) {
        $service = (string) $rate_data['servicelevel_name'];
    } elseif (!empty($rate_data['servicelevel']['name'])) {
        $service = (string) $rate_data['servicelevel']['name'];
    }

    $service_token = '';

    if (!empty($rate_data['servicelevel_token'])) {
        $service_token = (string) $rate_data['servicelevel_token'];
    } elseif (!empty($rate_data['servicelevel']['token'])) {
        $service_token = (string) $rate_data['servicelevel']['token'];
    }

    $carrier_account = !empty($rate_data['carrier_account']) ? (string) $rate_data['carrier_account'] : '';
    $amount          = !empty($rate_data['amount']) ? (string) $rate_data['amount'] : '';
    $currency        = !empty($rate_data['currency']) ? (string) $rate_data['currency'] : '';

    return array(
        'success'            => true,
        'transaction_id'     => $transaction_id,
        'tracking_number'    => $tracking_number,
        'label_url'          => $label_url,
        'tracking_url'       => $tracking_url,
        'tracking_status'    => $tracking_status,
        'transaction_status' => $status,
        'provider'           => $provider,
        'service'            => $service,
        'service_token'      => $service_token,
        'carrier_account'    => $carrier_account,
        'amount'             => $amount,
        'currency'           => $currency,
        'eta'                => !empty($body['eta']) ? $body['eta'] : '',
        'messages'           => $messages,
        'label_file_type'    => $label_file_type,
        'raw'                => $body,
    );
}

        /**
     * Retrieve a Shippo rate by ID.
     *
     * @param string $rate_id
     * @return array
     */
    public static function get_rate($rate_id) {
        $rate_id = trim((string) $rate_id);

        if ($rate_id === '') {
            return array(
                'success' => false,
                'message' => 'Rate ID is required.',
                'code'    => 'missing_rate_id',
            );
        }

        $response = self::request('GET', 'rates/' . rawurlencode($rate_id) . '/', array());

        if (empty($response['success'])) {
            return $response;
        }

        return array(
            'success' => true,
            'raw'     => $response['body'],
        );
    }

        /**
     * Retrieve a Shippo transaction by ID.
     *
     * @param string $transaction_id
     * @return array
     */
    public static function get_transaction($transaction_id) {
        $transaction_id = trim((string) $transaction_id);

        if ($transaction_id === '') {
            return array(
                'success' => false,
                'message' => 'Transaction ID is required.',
                'code'    => 'missing_transaction_id',
            );
        }

        $response = self::request('GET', 'transactions/' . rawurlencode($transaction_id) . '/', array());

        if (empty($response['success'])) {
            return $response;
        }

        $body = $response['body'];

        return array(
            'success' => true,
            'raw'     => $body,
        );
    }

    /**
     * Retrieve tracking details from Shippo.
     *
     * @param string $carrier
     * @param string $tracking_number
     * @return array
     */
    public static function get_tracking($carrier, $tracking_number) {
        $carrier         = self::normalize_carrier($carrier);
        $tracking_number = trim((string) $tracking_number);

        if ($carrier === '' || $tracking_number === '') {
            return array(
                'success' => false,
                'message' => 'Carrier and tracking number are required.',
                'code'    => 'missing_tracking_data',
            );
        }

        $payload = array();

        $endpoint = 'tracks/' . rawurlencode($carrier) . '/' . rawurlencode($tracking_number) . '/';

        $response = self::request('GET', $endpoint, $payload);

        if (empty($response['success'])) {
            return $response;
        }

        return array(
            'success' => true,
            'raw'     => $response['body'],
        );
    }

        protected static function build_return_shipment_extra($order, array $parcel_input, $outbound_provider, array $return_options = array()) {
        $provider = strtoupper(trim((string) $outbound_provider));
        $extra = array(
            'is_return'                 => true,
            'bypass_address_validation' => true,
        );

        if (!empty($return_options['contains_alcohol']) && in_array($provider, array('UPS', 'FEDEX'), true)) {
            $extra['alcohol'] = array(
                'contains_alcohol' => true,
            );
        }

        if (!empty($return_options['contains_dry_ice']) && in_array($provider, array('UPS', 'FEDEX'), true)) {
            $dry_ice_weight_kg = isset($return_options['dry_ice_weight_kg']) ? trim((string) $return_options['dry_ice_weight_kg']) : '';
            if ($dry_ice_weight_kg !== '') {
                $extra['dry_ice'] = array(
                    'contains_dry_ice' => true,
                    'weight'           => $dry_ice_weight_kg,
                );
            }
        }

        if (!empty($return_options['contains_hazmat']) && $provider === 'USPS') {
            $extra['dangerous_goods'] = array(
                'contains' => true,
            );
        }

        if (!empty($return_options['additional_insurance']) && $order && is_a($order, 'WC_Order')) {
            $declared_value = 0.0;

            foreach ($order->get_items('line_item') as $item) {
                $product = $item->get_product();
                if (!$product || !$product->needs_shipping()) {
                    continue;
                }

                $line_total = (float) $item->get_total();
                if ($line_total > 0) {
                    $declared_value += $line_total;
                }
            }

            if ($declared_value > 0) {
                $insurance = array(
                    'amount'   => number_format($declared_value, 2, '.', ''),
                    'currency' => $order->get_currency(),
                    'content'  => 'Returned merchandise',
                );

                if (in_array($provider, array('UPS', 'FEDEX', 'ONTRAC'), true)) {
                    $insurance['provider'] = $provider;
                }

                $extra['insurance'] = $insurance;
            }
        }

        return $extra;
    }

        protected static function select_preferred_return_rate(array $normalized_rates, $outbound_provider, $outbound_service_token) {
        $outbound_provider      = strtoupper(trim((string) $outbound_provider));
        $outbound_service_token = trim((string) $outbound_service_token);
        $selected_rate = array();
        $selection_reason = 'none';

        // USPS return purchases are currently unreliable.
        // For USPS outbound returns, always prefer the cheapest UPS rate.
        if ($outbound_provider === 'USPS') {
            $ups_rates = array_values(array_filter($normalized_rates, function($rate) {
                return strtoupper(trim((string) ($rate['provider'] ?? ''))) === 'UPS';
            }));

            if (!empty($ups_rates)) {
                usort($ups_rates, function($a, $b) {
                    return (float) $a['amount'] <=> (float) $b['amount'];
                });
                $selected_rate = $ups_rates[0];
                $selection_reason = 'usps_outbound_force_ups';
            }

            error_log('=== SSB RETURN SELECTED RATE ===');
            error_log(print_r(array(
                'outbound_provider'      => $outbound_provider,
                'outbound_service_token' => $outbound_service_token,
                'selection_reason'       => $selection_reason,
                'selected_rate'          => $selected_rate,
            ), true));

            return $selected_rate;
        }

        if (!empty($normalized_rates) && $outbound_provider !== '' && $outbound_service_token !== '') {
            foreach ($normalized_rates as $rate) {
                if (
                    strtoupper((string) $rate['provider']) === $outbound_provider &&
                    (string) $rate['service_token'] === $outbound_service_token
                ) {
                    $selected_rate = $rate;
                    $selection_reason = 'exact_outbound_match';
                    break;
                }
            }
        }

        if (empty($selected_rate) && !empty($normalized_rates) && $outbound_provider !== '') {
            $provider_rates = array_values(array_filter($normalized_rates, function($rate) use ($outbound_provider) {
                return strtoupper(trim((string) ($rate['provider'] ?? ''))) === strtoupper(trim((string) $outbound_provider));
            }));

            if (!empty($provider_rates)) {
                usort($provider_rates, function($a, $b) {
                    return (float) $a['amount'] <=> (float) $b['amount'];
                });
                $selected_rate = $provider_rates[0];
                $selection_reason = 'same_provider_cheapest';
            }
        }

        if (empty($selected_rate) && !empty($normalized_rates)) {
            usort($normalized_rates, function($a, $b) {
                return (float) $a['amount'] <=> (float) $b['amount'];
            });
            $selected_rate = $normalized_rates[0];
            $selection_reason = 'overall_cheapest';
        }

        error_log('=== SSB RETURN SELECTED RATE ===');
        error_log(print_r(array(
            'outbound_provider'      => $outbound_provider,
            'outbound_service_token' => $outbound_service_token,
            'selection_reason'       => $selection_reason,
            'selected_rate'          => $selected_rate,
        ), true));

        return $selected_rate;
    }

    public static function preview_return_label($order, array $parcel_input, $outbound_provider, $outbound_service_token, $label_file_type = 'PDF_4x6', array $return_options = array()) {
        if (!$order || !is_a($order, 'WC_Order')) {
            return array(
                'success' => false,
                'message' => 'Invalid WooCommerce order supplied.',
                'code'    => 'invalid_order',
            );
        }

        $outbound_provider      = strtoupper(trim((string) $outbound_provider));
        $outbound_service_token = trim((string) $outbound_service_token);

        if ($outbound_provider === '') {
            return array(
                'success' => false,
                'message' => 'Outbound carrier is required before creating a return label.',
                'code'    => 'missing_outbound_provider',
            );
        }

        $from   = SSB_Settings::get_origin_address();
        $to     = self::build_to_address($order);

        if (!isset($to['street2'])) {
            $to['street2'] = '';
        }

        $parcel = self::normalize_parcel($parcel_input);

        if (
            $parcel['length'] === '' ||
            $parcel['width'] === '' ||
            $parcel['height'] === '' ||
            $parcel['weight'] === ''
        ) {
            return array(
                'success' => false,
                'message' => 'Parcel dimensions and weight are required before creating a return label.',
                'code'    => 'missing_parcel_input',
            );
        }

        $payload = array(
            'address_from'  => $from,
            'address_to'    => $to,
            'parcels'       => array($parcel),
            'async'         => false,
            'metadata'      => 'Woo Return Label #' . $order->get_id(),
            'shipment_date' => gmdate('Y-m-d\TH:i:s\Z'),
            'extra'         => self::build_return_shipment_extra($order, $parcel_input, $outbound_provider, $return_options),
        );

        error_log('=== SSB RETURN PREVIEW REQUEST ORDER #' . $order->get_id() . ' ===');
        error_log(print_r(array(
            'outbound_provider'      => $outbound_provider,
            'outbound_service_token' => $outbound_service_token,
            'label_file_type'        => $label_file_type,
            'return_options'         => $return_options,
            'from'                   => $from,
            'to'                     => $to,
            'parcel'                 => $parcel,
            'payload'                => $payload,
        ), true));

        $shipment_retry = self::request_shipment_with_provider_retry(
            $payload,
            'UPS',
            10,
            'return_preview_order_' . $order->get_id()
        );

        error_log('=== SSB RETURN PREVIEW RETRY RESULT ORDER #' . $order->get_id() . ' ===');
        error_log(print_r($shipment_retry, true));

        if (empty($shipment_retry['success'])) {
            return array(
                'success' => false,
                'message' => 'Rate generation timed out. Please try again.',
                'code'    => 'rate_generation_timeout',
                'body'    => !empty($shipment_retry['body']) ? $shipment_retry['body'] : array(),
            );
        }

        $response = $shipment_retry['response'];
        $body     = $shipment_retry['body'];

        error_log('=== SSB RETURN PREVIEW RESPONSE ORDER #' . $order->get_id() . ' ===');
        error_log(print_r($response, true));

        $shipment_id = !empty($body['object_id']) ? (string) $body['object_id'] : '';
        $rates       = !empty($body['rates']) && is_array($body['rates']) ? $body['rates'] : array();

        error_log('=== SSB RETURN PREVIEW SHIPMENT BODY ORDER #' . $order->get_id() . ' ===');
        error_log(print_r(array(
            'shipment_id' => $shipment_id,
            'messages'    => !empty($body['messages']) ? $body['messages'] : array(),
            'rates'       => $rates,
        ), true));

        if ($shipment_id === '') {
            return array(
                'success' => false,
                'message' => 'Shippo did not return a return-shipment ID.',
                'code'    => 'missing_return_shipment_id',
                'body'    => $body,
            );
        }

        $normalized_rates = array();

        foreach ($rates as $rate) {
            if (!is_array($rate)) {
                continue;
            }

            $normalized_rates[] = array(
                'rate_id'         => !empty($rate['object_id']) ? (string) $rate['object_id'] : '',
                'provider'        => !empty($rate['provider']) ? (string) $rate['provider'] : '',
                'provider_image'  => !empty($rate['provider_image_75']) ? (string) $rate['provider_image_75'] : '',
                'carrier_account' => !empty($rate['carrier_account']) ? (string) $rate['carrier_account'] : '',
                'service'         => !empty($rate['servicelevel']['name']) ? (string) $rate['servicelevel']['name'] : '',
                'service_token'   => !empty($rate['servicelevel']['token']) ? (string) $rate['servicelevel']['token'] : '',
                'amount'          => !empty($rate['amount']) ? (string) $rate['amount'] : '',
                'currency'        => !empty($rate['currency']) ? (string) $rate['currency'] : '',
                'estimated_days'  => isset($rate['estimated_days']) ? (string) $rate['estimated_days'] : '',
                'duration_terms'  => !empty($rate['duration_terms']) ? (string) $rate['duration_terms'] : '',
                'attributes'      => !empty($rate['attributes']) && is_array($rate['attributes']) ? $rate['attributes'] : array(),
                'raw'             => $rate,
            );
        }

        usort($normalized_rates, function($a, $b) {
            return (float) $a['amount'] <=> (float) $b['amount'];
        });

        $selected_rate = self::select_preferred_return_rate($normalized_rates, $outbound_provider, $outbound_service_token);

        if (empty($selected_rate)) {
            return array(
                'success' => false,
                'message' => 'Shippo did not return any purchasable return rate.',
                'code'    => 'missing_matching_return_rate',
                'rates'   => $normalized_rates,
                'body'    => $body,
            );
        }

        return array(
            'success'           => true,
            'return_shipment_id'=> $shipment_id,
            'return_rate_id'    => $selected_rate['rate_id'],
            'provider'          => (string) $selected_rate['provider'],
            'service'           => (string) $selected_rate['service'],
            'service_token'     => (string) $selected_rate['service_token'],
            'carrier_account'   => (string) $selected_rate['carrier_account'],
            'amount'            => (string) $selected_rate['amount'],
            'currency'          => (string) $selected_rate['currency'],
            'raw'               => $body,
        );
    }

        /**
     * Create and purchase a return label using the outbound carrier.
     *
     * @param WC_Order $order
     * @param array    $parcel_input
     * @param string   $outbound_provider
     * @param string   $outbound_service_token
     * @param string   $label_file_type
     * @return array
     */
        public static function create_return_label($order, array $parcel_input, $outbound_provider, $outbound_service_token, $label_file_type = 'PDF_4x6', array $return_options = array()) {
        if (!$order || !is_a($order, 'WC_Order')) {
            return array(
                'success' => false,
                'message' => 'Invalid WooCommerce order supplied.',
                'code'    => 'invalid_order',
            );
        }

        $outbound_provider      = strtoupper(trim((string) $outbound_provider));
        $outbound_service_token = trim((string) $outbound_service_token);

        if ($outbound_provider === '') {
            return array(
                'success' => false,
                'message' => 'Outbound carrier is required before creating a return label.',
                'code'    => 'missing_outbound_provider',
            );
        }

        $from   = SSB_Settings::get_origin_address();
        $to     = self::build_to_address($order);

        // Preserve the actual customer-entered secondary address line.
        // Do not overwrite mailbox/unit data during return-label creation.
        if (!isset($to['street2'])) {
            $to['street2'] = '';
        }

        $parcel = self::normalize_parcel($parcel_input);

        if (empty($from['phone'])) {
            return array(
                'success' => false,
                'message' => 'Store origin phone is required before creating a return label.',
                'code'    => 'missing_origin_phone',
            );
        }

        if (empty($from['email'])) {
            return array(
                'success' => false,
                'message' => 'Store origin email is required before creating a return label.',
                'code'    => 'missing_origin_email',
            );
        }

        if (
            $parcel['length'] === '' ||
            $parcel['width'] === '' ||
            $parcel['height'] === '' ||
            $parcel['weight'] === ''
        ) {
            return array(
                'success' => false,
                'message' => 'Parcel dimensions and weight are required before creating a return label.',
                'code'    => 'missing_parcel_input',
            );
        }

        if (!in_array($label_file_type, array('PDF_4x6', 'PDF'), true)) {
            $label_file_type = 'PDF_4x6';
        }

        $payload = array(
            'address_from'  => $from,
            'address_to'    => $to,
            'parcels'       => array($parcel),
            'async'         => false,
            'metadata'      => 'Woo Return Label #' . $order->get_id(),
            'shipment_date' => gmdate('Y-m-d\TH:i:s\Z'),
            'extra'         => self::build_return_shipment_extra($order, $parcel_input, $outbound_provider, $return_options),
        );

        error_log('=== SSB RETURN CREATE REQUEST ORDER #' . $order->get_id() . ' ===');
        error_log(print_r(array(
            'outbound_provider'      => $outbound_provider,
            'outbound_service_token' => $outbound_service_token,
            'label_file_type'        => $label_file_type,
            'return_options'         => $return_options,
            'from'                   => $from,
            'to'                     => $to,
            'parcel'                 => $parcel,
            'payload'                => $payload,
        ), true));

        $shipment_retry = self::request_shipment_with_provider_retry(
            $payload,
            'UPS',
            10,
            'return_create_order_' . $order->get_id()
        );

        error_log('=== SSB RETURN CREATE RETRY RESULT ORDER #' . $order->get_id() . ' ===');
        error_log(print_r($shipment_retry, true));

        if (empty($shipment_retry['success'])) {
            return array(
                'success' => false,
                'message' => 'Rate generation timed out. Please try again.',
                'code'    => 'rate_generation_timeout',
                'body'    => !empty($shipment_retry['body']) ? $shipment_retry['body'] : array(),
            );
        }

        $response = $shipment_retry['response'];
        $body     = $shipment_retry['body'];

        error_log('=== SSB RETURN CREATE RESPONSE ORDER #' . $order->get_id() . ' ===');
        error_log(print_r($response, true));

        $shipment_id = !empty($body['object_id']) ? (string) $body['object_id'] : '';
        $rates       = !empty($body['rates']) && is_array($body['rates']) ? $body['rates'] : array();

        error_log('=== SSB RETURN CREATE SHIPMENT BODY ORDER #' . $order->get_id() . ' ===');
        error_log(print_r(array(
            'shipment_id' => $shipment_id,
            'messages'    => !empty($body['messages']) ? $body['messages'] : array(),
            'rates'       => $rates,
        ), true));

        if ($shipment_id === '') {
            return array(
                'success' => false,
                'message' => 'Shippo did not return a return-shipment ID.',
                'code'    => 'missing_return_shipment_id',
                'body'    => $body,
            );
        }

        $normalized_rates = array();

        foreach ($rates as $rate) {
            if (!is_array($rate)) {
                continue;
            }

            $normalized_rates[] = array(
                'rate_id'         => !empty($rate['object_id']) ? (string) $rate['object_id'] : '',
                'provider'        => !empty($rate['provider']) ? (string) $rate['provider'] : '',
                'provider_image'  => !empty($rate['provider_image_75']) ? (string) $rate['provider_image_75'] : '',
                'carrier_account' => !empty($rate['carrier_account']) ? (string) $rate['carrier_account'] : '',
                'service'         => !empty($rate['servicelevel']['name']) ? (string) $rate['servicelevel']['name'] : '',
                'service_token'   => !empty($rate['servicelevel']['token']) ? (string) $rate['servicelevel']['token'] : '',
                'amount'          => !empty($rate['amount']) ? (string) $rate['amount'] : '',
                'currency'        => !empty($rate['currency']) ? (string) $rate['currency'] : '',
                'estimated_days'  => isset($rate['estimated_days']) ? (string) $rate['estimated_days'] : '',
                'duration_terms'  => !empty($rate['duration_terms']) ? (string) $rate['duration_terms'] : '',
                'attributes'      => !empty($rate['attributes']) && is_array($rate['attributes']) ? $rate['attributes'] : array(),
                'raw'             => $rate,
            );
        }

        usort($normalized_rates, function($a, $b) {
            return (float) $a['amount'] <=> (float) $b['amount'];
        });

        error_log('=== SSB RETURN CREATE NORMALIZED RATES ORDER #' . $order->get_id() . ' ===');
        error_log(print_r($normalized_rates, true));

        $selected_rate = self::select_preferred_return_rate($normalized_rates, $outbound_provider, $outbound_service_token);

        if (empty($selected_rate)) {
            error_log('=== SSB RETURN CREATE NO MATCHING RATE ORDER #' . $order->get_id() . ' ===');
            error_log(print_r(array(
                'outbound_provider'      => $outbound_provider,
                'outbound_service_token' => $outbound_service_token,
                'normalized_rates'       => $normalized_rates,
                'raw_body'               => $body,
            ), true));

            return array(
                'success' => false,
                'message' => 'Shippo did not return any purchasable return rate.',
                'code'    => 'missing_matching_return_rate',
                'rates'   => $normalized_rates,
                'body'    => $body,
            );
        }

        error_log('=== SSB RETURN CREATE PURCHASE ATTEMPT ORDER #' . $order->get_id() . ' ===');
        error_log(print_r(array(
            'selected_rate'   => $selected_rate,
            'label_file_type' => $label_file_type,
        ), true));

        if (empty($selected_rate['rate_id'])) {
    return array(
        'success' => false,
        'message' => 'Selected return rate is missing a Shippo rate ID.',
        'code'    => 'missing_selected_return_rate_id',
        'selected_rate' => $selected_rate,
        'rates'   => $normalized_rates,
        'body'    => $body,
    );
}

$purchase = self::buy_label($selected_rate['rate_id'], $order, $label_file_type);

        error_log('=== SSB RETURN CREATE PURCHASE RESPONSE ORDER #' . $order->get_id() . ' ===');
        error_log(print_r($purchase, true));

        if (empty($purchase['success'])) {
            $selected_provider = strtoupper((string) $selected_rate['provider']);
            $fallback_rate = array();

            foreach ($normalized_rates as $candidate_rate) {
                if (
                    !empty($candidate_rate['rate_id']) &&
                    strtoupper((string) $candidate_rate['provider']) !== $selected_provider
                ) {
                    $fallback_rate = $candidate_rate;
                    break;
                }
            }

            error_log('=== SSB RETURN CREATE FALLBACK SEARCH ORDER #' . $order->get_id() . ' ===');
            error_log(print_r(array(
                'failed_selected_rate' => $selected_rate,
                'fallback_rate'        => $fallback_rate,
            ), true));

            if (!empty($fallback_rate)) {

                error_log('=== SSB RETURN CREATE FALLBACK PURCHASE ATTEMPT ORDER #' . $order->get_id() . ' ===');
                error_log(print_r(array(
                    'fallback_rate'    => $fallback_rate,
                    'label_file_type'  => $label_file_type,
                ), true));

                $fallback_purchase = self::buy_label($fallback_rate['rate_id'], $order, $label_file_type);

                error_log('=== SSB RETURN CREATE FALLBACK PURCHASE RESPONSE ORDER #' . $order->get_id() . ' ===');
                error_log(print_r($fallback_purchase, true));

                if (!empty($fallback_purchase['success'])) {
                    $purchase = $fallback_purchase;
                    $selected_rate = $fallback_rate;
                } else {
                    return $fallback_purchase;
                }
            } else {
                return $purchase;
            }
        }

        return array_merge($purchase, array(
            'return_shipment_id' => $shipment_id,
            'return_rate_id'     => $selected_rate['rate_id'],
            'provider'           => !empty($purchase['provider']) ? (string) $purchase['provider'] : (string) $selected_rate['provider'],
            'service'            => !empty($purchase['service']) ? (string) $purchase['service'] : (string) $selected_rate['service'],
            'service_token'      => !empty($purchase['service_token']) ? (string) $purchase['service_token'] : (string) $selected_rate['service_token'],
            'carrier_account'    => !empty($purchase['carrier_account']) ? (string) $purchase['carrier_account'] : (string) $selected_rate['carrier_account'],
            'amount'             => !empty($purchase['amount']) ? (string) $purchase['amount'] : (string) $selected_rate['amount'],
            'currency'           => !empty($purchase['currency']) ? (string) $purchase['currency'] : (string) $selected_rate['currency'],
            'selected_rate'      => $selected_rate,
            'raw_shipment'       => $body,
        ));
    }

        /**
     * Schedule a pickup for an already-purchased transaction.
     *
     * @param string $carrier_account
     * @param string $transaction_id
     * @param array  $location_address
     * @param string $requested_start_time
     * @param string $requested_end_time
     * @param string $instructions
     * @param string $building_type
     * @param string $building_location_type
     * @param string $metadata
     * @return array
     */
    public static function create_pickup($carrier_account, $transaction_id, array $location_address, $requested_start_time, $requested_end_time, $instructions = '', $building_type = 'office', $building_location_type = 'Front Door', $metadata = '') {
        $carrier_account = trim((string) $carrier_account);
        $transaction_id  = trim((string) $transaction_id);

        if ($carrier_account === '') {
            return array(
                'success' => false,
                'message' => 'Carrier account is required before scheduling a pickup.',
                'code'    => 'missing_carrier_account',
            );
        }

        if ($transaction_id === '') {
            return array(
                'success' => false,
                'message' => 'Transaction ID is required before scheduling a pickup.',
                'code'    => 'missing_transaction_id',
            );
        }

        $payload = array(
            'carrier_account'      => $carrier_account,
            'location'             => array(
                'building_location_type' => $building_location_type !== '' ? $building_location_type : 'Front Door',
                'building_type'          => $building_type !== '' ? $building_type : 'office',
                'instructions'           => (string) $instructions,
                'address'                => $location_address,
            ),
            'transactions'         => array($transaction_id),
            'requested_start_time' => (string) $requested_start_time,
            'requested_end_time'   => (string) $requested_end_time,
            'metadata'             => (string) $metadata,
        );

        $response = self::request('POST', 'pickups/', $payload);

        if (empty($response['success'])) {
            return $response;
        }

        $body = $response['body'];

        return array(
            'success'              => true,
            'pickup_id'            => !empty($body['object_id']) ? (string) $body['object_id'] : '',
            'pickup_status'        => !empty($body['status']) ? (string) $body['status'] : '',
            'confirmation_code'    => !empty($body['confirmation_code']) ? (string) $body['confirmation_code'] : '',
            'requested_start_time' => !empty($body['requested_start_time']) ? (string) $body['requested_start_time'] : '',
            'requested_end_time'   => !empty($body['requested_end_time']) ? (string) $body['requested_end_time'] : '',
            'confirmed_start_time' => !empty($body['confirmed_start_time']) ? (string) $body['confirmed_start_time'] : '',
            'confirmed_end_time'   => !empty($body['confirmed_end_time']) ? (string) $body['confirmed_end_time'] : '',
            'cancel_by_time'       => !empty($body['cancel_by_time']) ? (string) $body['cancel_by_time'] : '',
            'timezone'             => !empty($body['timezone']) ? (string) $body['timezone'] : '',
            'messages'             => !empty($body['messages']) && is_array($body['messages']) ? $body['messages'] : array(),
            'raw'                  => $body,
        );
    }

    /**
     * Request a refund for an unused purchased label.
     *
     * @param string $transaction_id
     * @return array
     */
    public static function create_refund($transaction_id) {
        $transaction_id = trim((string) $transaction_id);

        if ($transaction_id === '') {
            return array(
                'success' => false,
                'message' => 'Transaction ID is required before requesting a refund.',
                'code'    => 'missing_transaction_id',
            );
        }

        $payload = array(
            'transaction' => $transaction_id,
            'async'       => false,
        );

        $response = self::request('POST', 'refunds/', $payload);

        if (empty($response['success'])) {
            return $response;
        }

        $body = $response['body'];

        return array(
            'success'       => true,
            'refund_id'     => !empty($body['object_id']) ? (string) $body['object_id'] : '',
            'refund_status' => !empty($body['status']) ? (string) $body['status'] : '',
            'raw'           => $body,
        );
    }


        /**
     * Normalize carrier names for Shippo tracking endpoint usage.
     *
     * @param string $carrier
     * @return string
     */
    protected static function normalize_carrier($carrier) {
        $carrier = strtolower(trim((string) $carrier));

        $map = array(
            'usps'  => 'usps',
            'ups'   => 'ups',
            'fedex' => 'fedex',
            'dhl'   => 'dhl',
        );

        return isset($map[$carrier]) ? $map[$carrier] : $carrier;
    }

    /**
     * Safely extract decimal string from parcel/admin input.
     *
     * @param array  $source
     * @param string $key
     * @return string
     */
    protected static function sanitize_decimal(array $source, $key) {
        if (!isset($source[$key])) {
            return '';
        }

        $value = wc_format_decimal(wp_unslash($source[$key]));

        if ($value === '' || $value === null) {
            return '';
        }

        return (string) $value;
    }

    /**
     * Normalize error message from Shippo response.
     *
     * @param mixed  $body
     * @param string $body_raw
     * @param int    $status_code
     * @return string
     */
    protected static function extract_error_message($body, $body_raw, $status_code) {
        if (is_array($body)) {
            if (!empty($body['detail']) && is_string($body['detail'])) {
                return $body['detail'];
            }

            if (!empty($body['error']) && is_string($body['error'])) {
                return $body['error'];
            }

            if (!empty($body['message']) && is_string($body['message'])) {
                return $body['message'];
            }

            if (!empty($body['messages']) && is_array($body['messages'])) {
                $messages = array();

                foreach ($body['messages'] as $message) {
                    if (is_array($message) && !empty($message['text'])) {
                        $messages[] = (string) $message['text'];
                    } elseif (is_string($message)) {
                        $messages[] = $message;
                    }
                }

                if (!empty($messages)) {
                    return implode(' | ', $messages);
                }
            }
        }

        if ($body_raw !== '') {
            return 'Shippo request failed with HTTP ' . $status_code . '.';
        }

        return 'Shippo request failed.';
    }
}