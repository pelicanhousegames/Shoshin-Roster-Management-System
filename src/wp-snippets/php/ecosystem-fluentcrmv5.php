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

add_action('woocommerce_order_status_processing', 'shoshin_fluentcrm_tag_paid_order', 10, 1);
add_action('woocommerce_order_status_completed', 'shoshin_fluentcrm_tag_paid_order', 10, 1);

function shoshin_fluentcrm_tag_paid_order($order_id) {

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

        // Product format tags via custom product taxonomy: product_item_format
        $format_terms = wc_get_product_terms($check_id, 'product_item_format', ['fields' => 'slugs']);

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
}

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

/**
 * Tag user as engaged when they create a character, support asset, or clan roster via WPForms.
 *
 * Target forms:
 * - 2247 = Character Creator Tool
 * - 2501 = Support Asset Creator
 * - 2799 = Clan Roster Creator
 */
add_action('wpforms_process_complete', function($fields, $entry, $form_data) {

    if (!function_exists('FluentCrmApi')) {
        return;
    }

    $target_forms = [2247, 2501, 2799];
    $form_id = isset($form_data['id']) ? (int) $form_data['id'] : 0;

    if (!in_array($form_id, $target_forms, true)) {
        return;
    }

    $user_id = 0;

    foreach ($fields as $field) {
        if (
            isset($field['name'], $field['value']) &&
            trim($field['name']) === 'Owner WP User ID'
        ) {
            $user_id = absint($field['value']);
            break;
        }
    }

    if (!$user_id) {
        error_log('[Shoshin FluentCRM] Engagement tag failed: Owner WP User ID missing. Form ID: ' . $form_id);
        return;
    }

    $user = get_userdata($user_id);

    if (!$user || empty($user->user_email)) {
        error_log('[Shoshin FluentCRM] Engagement tag failed: user not found. User ID: ' . $user_id);
        return;
    }

    FluentCrmApi('contacts')->createOrUpdate([
        'email'   => sanitize_email($user->user_email),
        'user_id' => $user_id,
        'status'  => 'subscribed',
        'tags'    => ['engaged-clan-created']
    ]);

}, 10, 3);

/**
 * Shoshin Legacy Entitlement Bridge
 *
 * Purpose:
 * When an existing FluentCRM contact creates/logs into a WP account,
 * auto-upgrade their PMPro level based on legacy/source tags.
 *
 * Rules:
 * - source-kickstarter = Contributor forever
 * - superfan-bonus-contributor without source-kickstarter = Contributor for 1 year
 * - legacy-user only = Subscriber for 1 year
 * - otherwise do nothing and let existing None → Free logic handle it
 *
 * This does NOT manually apply FluentCRM membership tags.
 * Existing PMPro sync handles that after PMPro level changes.
 */

add_action('user_register', function($user_id) {
	if (!$user_id) {
		return;
	}

	// Delay slightly so existing None → Free automation can run first.
	if (!wp_next_scheduled('shoshin_run_legacy_entitlement_bridge', [$user_id])) {
		wp_schedule_single_event(time() + 60, 'shoshin_run_legacy_entitlement_bridge', [$user_id]);
	}
}, 99, 1);

add_action('wp_login', function($user_login, $user) {
	if (empty($user->ID)) {
		return;
	}

	shoshin_run_legacy_entitlement_bridge((int) $user->ID);
}, 99, 2);

add_action('shoshin_run_legacy_entitlement_bridge', 'shoshin_run_legacy_entitlement_bridge', 10, 1);

function shoshin_run_legacy_entitlement_bridge($user_id) {

	if (
		!$user_id ||
		!function_exists('FluentCrmApi') ||
		!function_exists('pmpro_getMembershipLevelForUser') ||
		!function_exists('pmpro_changeMembershipLevel')
	) {
		return;
	}

	$user = get_userdata($user_id);
	if (!$user || empty($user->user_email)) {
		return;
	}

	$email = sanitize_email($user->user_email);
	if (!$email) {
		return;
	}

	$contact = FluentCrmApi('contacts')->getContact($email);
	if (!$contact) {
		return;
	}

	$contact_tags = shoshin_get_fluentcrm_contact_tag_slugs($contact);

	if (empty($contact_tags)) {
		return;
	}

	$has_legacy      = in_array('legacy-user', $contact_tags, true);
$has_kickstarter = in_array('source-kickstarter', $contact_tags, true);
$has_superfan    = in_array('superfan-bonus-contributor', $contact_tags, true);
$has_mailchimp   = in_array('source-mailchimp', $contact_tags, true);

	$target_level_id = 0;
$expires         = false;

// Highest entitlement wins.
if ($has_kickstarter) {
	$target_level_id = 3; // Contributor
	$expires         = false; // Lifetime
} elseif ($has_superfan) {
	$target_level_id = 3; // Contributor
	$expires         = '1year';
} elseif ($has_legacy) {
	$target_level_id = 2; // Subscriber
	$expires         = '1year';
} elseif ($has_mailchimp && !$has_kickstarter && !$has_superfan && !$has_legacy) {
	$target_level_id = 2; // Subscriber
	$expires         = '6months';
} else {
	return;
}

	$current_level = pmpro_getMembershipLevelForUser($user_id);
	$current_id    = (!empty($current_level) && !empty($current_level->id)) ? (int) $current_level->id : 0;

	// Never downgrade. Contributor > Subscriber > Free/None.
	$rank = [
		0 => 0,
		4 => 1, // Free
		2 => 2, // Subscriber
		3 => 3, // Contributor
	];

	$current_rank = isset($rank[$current_id]) ? $rank[$current_id] : 0;
	$target_rank  = isset($rank[$target_level_id]) ? $rank[$target_level_id] : 0;

	if ($target_rank <= $current_rank) {
		return;
	}

	$startdate = current_time('mysql');
	if ($expires === '1year') {
	$enddate = date('Y-m-d H:i:s', strtotime('+1 year', current_time('timestamp')));
} elseif ($expires === '6months') {
	$enddate = date('Y-m-d H:i:s', strtotime('+6 months', current_time('timestamp')));
} else {
	$enddate = '';
}

	$level_data = [
		'user_id'       => $user_id,
		'membership_id' => $target_level_id,
		'startdate'     => $startdate,
	];

	if ($expires) {
		$level_data['enddate'] = $enddate;
	}

	pmpro_changeMembershipLevel($level_data, $user_id);

	// Safety fallback: ensure expiration is set/cleared on the active PMPro row.
	shoshin_force_pmpro_membership_enddate($user_id, $target_level_id, $enddate);
}

function shoshin_get_fluentcrm_contact_tag_slugs($contact) {

	$slugs = [];

	if (empty($contact)) {
		return $slugs;
	}

	if (method_exists($contact, 'tags')) {
		$tags = $contact->tags;

		if (is_callable($tags)) {
			$tags = $contact->tags();
		}

		if (!empty($tags)) {
			foreach ($tags as $tag) {
				if (!empty($tag->slug)) {
					$slugs[] = sanitize_title($tag->slug);
				} elseif (!empty($tag->title)) {
					$slugs[] = sanitize_title($tag->title);
				}
			}
		}
	}

	return array_values(array_unique($slugs));
}

function shoshin_force_pmpro_membership_enddate($user_id, $level_id, $enddate = '') {
	global $wpdb;

	if (!$user_id || !$level_id) {
		return;
	}

	$table = $wpdb->prefix . 'pmpro_memberships_users';

	// PMPro commonly treats blank/zero enddate as no expiration.
	$stored_enddate = $enddate ? $enddate : '0000-00-00 00:00:00';

	$wpdb->update(
		$table,
		[
			'enddate' => $stored_enddate,
		],
		[
			'user_id'       => (int) $user_id,
			'membership_id' => (int) $level_id,
			'status'        => 'active',
		],
		[
			'%s',
		],
		[
			'%d',
			'%d',
			'%s',
		]
	);
}