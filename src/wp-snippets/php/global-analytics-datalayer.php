<?php
/**
 * Shoshin - Global Analytics DataLayer Context
 */

add_action('wp_head', function () {
	if (is_admin()) return;

	$user_id = get_current_user_id();
	$is_logged_in = is_user_logged_in();

	$context = [
		'event' => 'shoshin_context_ready',
		'user_logged_in' => $is_logged_in,
		'user_id' => $is_logged_in ? (string) $user_id : '',
		'membership_level' => 'none',
		'pmpro_level_id' => 0,
		'membership_discount' => false,
		'first_purchase' => false,
		'customer_cohort' => $is_logged_in ? 'registered_non_customer' : 'anonymous',
		'lifetime_value_bucket' => 'none',
		'kickstarter_backer' => false,
		'legacy_user' => false,
		'clan_creator_used' => false,
	];

	if ($is_logged_in) {

		// PMPro membership context.
		if (function_exists('pmpro_getMembershipLevelForUser')) {
			$level = pmpro_getMembershipLevelForUser($user_id);

			if (!empty($level) && !empty($level->id)) {
				$context['pmpro_level_id'] = (int) $level->id;

				switch ((int) $level->id) {
					case 4:
						$context['membership_level'] = 'free';
						break;
					case 2:
						$context['membership_level'] = 'subscriber';
						break;
					case 3:
						$context['membership_level'] = 'contributor';
						break;
					default:
						$context['membership_level'] = 'other';
						break;
				}
			}
		}

		// Membership discount eligibility.
		$context['membership_discount'] = in_array(
			$context['membership_level'],
			['free', 'subscriber', 'contributor'],
			true
		);

		// WooCommerce purchase / LTV context.
		if (function_exists('wc_get_orders')) {
			$order_count = wc_get_orders([
				'customer_id' => $user_id,
				'status' => ['processing', 'completed', 'on-hold'],
				'limit' => -1,
				'return' => 'ids',
			]);

			$order_count = is_array($order_count) ? count($order_count) : 0;
			$context['first_purchase'] = ($order_count === 0);

			if ($order_count === 0) {
				$context['customer_cohort'] = 'registered_non_customer';
			} elseif ($order_count === 1) {
				$context['customer_cohort'] = 'first_time_customer';
			} else {
				$context['customer_cohort'] = 'repeat_customer';
			}

			$total_spent = function_exists('wc_get_customer_total_spent')
				? (float) wc_get_customer_total_spent($user_id)
				: 0;

			if ($total_spent <= 0) {
				$context['lifetime_value_bucket'] = 'none';
			} elseif ($total_spent < 100) {
				$context['lifetime_value_bucket'] = 'low';
			} elseif ($total_spent < 300) {
				$context['lifetime_value_bucket'] = 'mid';
			} elseif ($total_spent < 750) {
				$context['lifetime_value_bucket'] = 'high';
			} else {
				$context['lifetime_value_bucket'] = 'vip';
			}
		}

		// FluentCRM cohort flags, if available.
		if (class_exists('\FluentCrm\App\Models\Subscriber')) {
			try {
				$user = get_userdata($user_id);

				if ($user && !empty($user->user_email)) {
					$subscriber = \FluentCrm\App\Models\Subscriber::where('email', $user->user_email)->first();

					if ($subscriber && method_exists($subscriber, 'tags')) {
						$tags = $subscriber->tags()->pluck('slug')->toArray();

						$context['kickstarter_backer'] = in_array('source-kickstarter', $tags, true);
						$context['legacy_user'] = in_array('legacy-user', $tags, true);

						if ($context['kickstarter_backer']) {
							$context['customer_cohort'] = 'kickstarter_backer';
						} elseif ($context['legacy_user']) {
							$context['customer_cohort'] = 'legacy_user';
						}
					}
				}
			} catch (Throwable $e) {
				// Fail silently. Analytics should never break the page.
			}
		}

		// RMS usage flag from WPForms entries.
		global $wpdb;

		$table = $wpdb->prefix . 'wpforms_entries';
		$form_ids = [2247, 2501, 2799];

		$table_exists = $wpdb->get_var(
			$wpdb->prepare("SHOW TABLES LIKE %s", $table)
		);

		if ($table_exists === $table) {
			$cache_key = 'shoshin_clan_creator_used_' . $user_id;
			$cached = get_transient($cache_key);

			if ($cached !== false) {
				$context['clan_creator_used'] = ($cached === '1');
			} else {
				$placeholders = implode(',', array_fill(0, count($form_ids), '%d'));

				$query = $wpdb->prepare(
					"SELECT entry_id FROM {$table}
					 WHERE user_id = %d
					 AND form_id IN ($placeholders)
					 LIMIT 1",
					array_merge([$user_id], $form_ids)
				);

				$has_rms_entry = (bool) $wpdb->get_var($query);

				$context['clan_creator_used'] = $has_rms_entry;
				set_transient($cache_key, $has_rms_entry ? '1' : '0', HOUR_IN_SECONDS);
			}
		}
	}

	?>
	<script>
		window.dataLayer = window.dataLayer || [];
		window.dataLayer.push(<?php echo wp_json_encode($context); ?>);
	</script>
	<?php
}, 1);