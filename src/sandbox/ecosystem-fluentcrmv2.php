<?php
add_action('wpforms_process_complete', function($fields, $entry, $form_data) {

    // Only target the newsletter form
    if ((int) $form_data['id'] !== 576) {
        return;
    }

    $email = '';
    $first_name = '';

    foreach ($fields as $field) {
        if (!empty($field['name']) && $field['name'] === 'Email') {
            $email = sanitize_email($field['value']);
        }

        if (!empty($field['name']) && $field['name'] === 'Name') {
            $first_name = sanitize_text_field($field['value']);
        }
    }

    if (!$email) {
        return;
    }

    if (function_exists('FluentCrmApi')) {
        FluentCrmApi('contacts')->createOrUpdate([
            'email'      => $email,
            'first_name' => $first_name,
            'status'     => 'subscribed',
            'tags'       => ['source-wpforms'],
            'lists'      => ['Newsletter']
        ]);
    }

}, 10, 3);

add_action('woocommerce_order_status_completed', function($order_id) {

    if (!$order_id || !function_exists('FluentCrmApi')) {
        return;
    }

    $order = wc_get_order($order_id);
    if (!$order) {
        return;
    }

    $email = sanitize_email($order->get_billing_email());
    if (!$email) {
        return;
    }

    $tags_to_add = ['customer-paid'];

    // Add repeat-customer tag if this is more than their first completed/processing order
    $customer_id = $order->get_customer_id();

    if ($customer_id) {
        $order_count = wc_get_customer_order_count($customer_id);

        if ((int) $order_count > 1) {
            $tags_to_add[] = 'customer-repeat';
        }
    } else {
        // Guest checkout fallback: count prior paid orders by billing email
        $guest_orders = wc_get_orders([
            'billing_email' => $email,
            'status'        => ['wc-processing', 'wc-completed'],
            'limit'         => -1,
            'return'        => 'ids',
        ]);

        if (count($guest_orders) > 1) {
            $tags_to_add[] = 'customer-repeat';
        }
    }

    foreach ($order->get_items() as $item) {
        $product = $item->get_product();
        if (!$product) {
            continue;
        }

        $product_id = $product->get_id();
        $check_id   = $product_id;

        // Variations should inherit categorization from the parent product
        if ($product->is_type('variation')) {
            $parent_id = $product->get_parent_id();
            if ($parent_id) {
                $check_id = $parent_id;
            }
        }

        // Product category tags
        if (has_term('books', 'product_cat', $check_id)) {
            $tags_to_add[] = 'purchased-books';
        }
        if (has_term('downloads', 'product_cat', $check_id)) {
            $tags_to_add[] = 'purchased-downloads';
        }
        if (has_term('games', 'product_cat', $check_id)) {
            $tags_to_add[] = 'purchased-games';
        }
        if (has_term('miniatures', 'product_cat', $check_id)) {
            $tags_to_add[] = 'purchased-miniatures';
        }
        if (has_term('terrain', 'product_cat', $check_id)) {
            $tags_to_add[] = 'purchased-terrain';
        }

        // Product format tags via global attribute taxonomy: pa_item-format
        $format_terms = wc_get_product_terms($check_id, 'pa_item-format', ['fields' => 'slugs']);

        if (!empty($format_terms) && is_array($format_terms)) {
            if (in_array('digital', $format_terms, true)) {
                $tags_to_add[] = 'purchased-digital';
            }
            if (in_array('physical', $format_terms, true)) {
                $tags_to_add[] = 'purchased-physical';
            }
        }
    }

    FluentCrmApi('contacts')->createOrUpdate([
        'email' => $email,
        'tags'  => array_values(array_unique($tags_to_add)),
    ]);

}, 10, 1);

add_action('pmpro_after_change_membership_level', function($level_id, $user_id, $cancel_level = null) {

    if (!$user_id || !function_exists('FluentCrmApi')) {
        return;
    }

    $user = get_userdata($user_id);
    if (!$user || empty($user->user_email)) {
        return;
    }

    $email = sanitize_email($user->user_email);

    // Current PMPro level ID to tag map
    $level_map = [
        4 => 'member-free',
        2 => 'member-subscriber',
        3 => 'member-contributor'
    ];

    // Current-state tags only; these get replaced cleanly
    $all_current_membership_tags = [
        'member-free',
        'member-subscriber',
        'member-contributor',
        'active-member',
        'expired-member'
    ];

    $contact_api = FluentCrmApi('contacts');

    /*
     * Determine prior level, if available.
     * PMPro often passes the cancelled/previous level in $cancel_level.
     */
    $previous_level_id = 0;

    if (is_object($cancel_level) && !empty($cancel_level->id)) {
        $previous_level_id = (int) $cancel_level->id;
    } elseif (is_numeric($cancel_level)) {
        $previous_level_id = (int) $cancel_level;
    }

    /*
     * Remove current-state membership tags first.
     * We intentionally preserve history tags:
     * - was-free
     * - was-subscriber
     * - was-contributor
     */
    $contact_api->removeTags($email, $all_current_membership_tags);

    $tags_to_add = [];

    // FREE LEVEL
    if ((int) $level_id === 4) {
        $tags_to_add[] = 'member-free';

        // Paid member expired / downgraded into Free
        if ($previous_level_id === 2) {
            $tags_to_add[] = 'expired-member';
            $tags_to_add[] = 'was-subscriber';
        } elseif ($previous_level_id === 3) {
            $tags_to_add[] = 'expired-member';
            $tags_to_add[] = 'was-contributor';
        } else {
            // Fresh free / normal free state
            $tags_to_add[] = 'active-member';
        }
    }

    // SUBSCRIBER LEVEL
    elseif ((int) $level_id === 2) {
        $tags_to_add[] = 'member-subscriber';
        $tags_to_add[] = 'active-member';

        // Upgrade from free
        if ($previous_level_id === 4) {
            $tags_to_add[] = 'was-free';
        }

        // Downgrade from contributor
        if ($previous_level_id === 3) {
            $tags_to_add[] = 'was-contributor';
        }
    }

    // CONTRIBUTOR LEVEL
    elseif ((int) $level_id === 3) {
        $tags_to_add[] = 'member-contributor';
        $tags_to_add[] = 'active-member';

        // Upgrade from free
        if ($previous_level_id === 4) {
            $tags_to_add[] = 'was-free';
        }

        // Upgrade from subscriber
        if ($previous_level_id === 2) {
            $tags_to_add[] = 'was-subscriber';
        }
    }

    // Fallback for any mapped level not explicitly handled above
    elseif (!empty($level_id) && isset($level_map[$level_id])) {
        $tags_to_add[] = $level_map[$level_id];
        $tags_to_add[] = 'active-member';
    }

    // If PMPro ever leaves them at 0 before your separate free-fallback runs
    else {
        $tags_to_add[] = 'expired-member';
    }

    $contact_api->createOrUpdate([
        'email' => $email,
        'tags'  => array_values(array_unique($tags_to_add))
    ]);

}, 10, 3);