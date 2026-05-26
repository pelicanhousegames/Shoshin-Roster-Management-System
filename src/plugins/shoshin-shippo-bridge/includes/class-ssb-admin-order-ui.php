<?php
if (!defined('ABSPATH')) {
    exit;
}

class SSB_Admin_Order_UI {

    /**
     * Initialize admin UI hooks.
     */
    public static function init() {
    add_action('add_meta_boxes', array(__CLASS__, 'register_metaboxes'));
    add_action('admin_enqueue_scripts', array(__CLASS__, 'enqueue_assets'));
}

    /**
     * Register the v2 metaboxes on Woo order screens.
     */
    public static function register_metaboxes() {
        $screens = array('shop_order');

        if (class_exists('\Automattic\WooCommerce\Internal\DataStores\Orders\CustomOrdersTableController')) {
            $screens[] = wc_get_page_screen_id('shop-order');
        }

        foreach (array_unique($screens) as $screen) {
            add_meta_box(
                'ssb_shipping_label_card',
                'Shipping Label',
                array(__CLASS__, 'render_shipping_label_card'),
                $screen,
                'normal',
                'high'
            );

            add_meta_box(
                'ssb_shipment_tracking_card',
                'Shipment Tracking',
                array(__CLASS__, 'render_tracking_card'),
                $screen,
                'side',
                'high'
            );
        }
    }

    /**
     * Enqueue admin assets only on order edit screens.
     *
     * @param string $hook_suffix
     * @return void
     */
    public static function enqueue_assets($hook_suffix) {
        $order_id = self::get_current_order_id();

        if (!self::is_order_edit_screen() || !$order_id) {
            return;
        }

        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }

        wp_enqueue_script(
            'ssb-admin',
            SSB_URL . 'assets/admin.js',
            array('jquery'),
            SSB_VERSION,
            true
        );

        wp_enqueue_style(
            'ssb-admin',
            SSB_URL . 'assets/admin.css',
            array(),
            SSB_VERSION
        );

        wp_localize_script('ssb-admin', 'SSB_Admin', array(
            'ajax_url'            => admin_url('admin-ajax.php'),
            'nonce'               => wp_create_nonce('ssb_admin_nonce'),
            'order_id'            => $order_id,
            'currency'            => $order->get_currency(),
            'debug'               => SSB_Settings::get_debug_context(),
            'shipment_state'      => SSB_State::get_order_state($order),
            'has_purchased_label' => SSB_State::has_purchased_label($order),
            'summary_text'        => SSB_State::get_summary_text($order),
            'fulfillment_groups'  => SSB_State::get_fulfillment_groups($order),
            'strings'             => array(
                'loading_rates'        => 'Loading rates...',
                'buying_label'         => 'Buying label...',
                'get_rates'            => 'Fetch Rates',
                'buy_label'            => 'Buy Label',
                'no_rates'             => 'No Shippo rates were returned for this parcel.',
                'choose_rate'          => 'Please select a rate first.',
                'generic_error'        => 'Something went wrong. Please try again.',
                'open_label'           => 'Open shipping label',
                'create_label'         => 'Create shipping label',
                'processing_purchase'  => 'Please wait while we process your shipping label purchase.',
                'label_ready'          => 'Your shipping label is ready to print.',
                'ups_terms_required'   => 'UPS requires terms acceptance before label purchase.',
            ),
        ));
    }

    /**
 * Invalidate shipment draft artifacts after saved order-item edits,
 * but only when no valid outbound or return labels exist.
 *
 * @param int   $order_id
 * @param array $items
 * @return void
 */
public static function invalidate_shipment_draft_after_order_edit($order_id, $items) {
    $order = wc_get_order($order_id);

    if (!$order || !is_a($order, 'WC_Order')) {
        return;
    }

    $has_outbound = SSB_State::has_purchased_label($order);
    $has_return   = SSB_State::has_return_label($order);

    if ($has_outbound || $has_return) {
        return;
    }

    delete_post_meta($order_id, '_shoshin_shippo_shipment_id');
    delete_post_meta($order_id, '_shoshin_shippo_parcel_snapshot');
    delete_post_meta($order_id, '_shoshin_shippo_selected_rate_snapshot');

    $groups = get_post_meta($order_id, SSB_State::META_FULFILLMENT_GROUPS, true);
    if (is_array($groups) && !empty($groups)) {
        $groups['status'] = 'stale';
        update_post_meta($order_id, SSB_State::META_FULFILLMENT_GROUPS, $groups);
    }
}

    /**
     * Render main Shipping Label card.
     *
     * @param WP_Post|WC_Order $post_or_order_object
     * @return void
     */
    public static function render_shipping_label_card($post_or_order_object) {
        $order = self::resolve_order_object($post_or_order_object);

        if (!$order) {
            echo '<p>Unable to load this WooCommerce order.</p>';
            return;
        }

        SSB_State::ensure_fulfillment_groups($order, 'admin_fallback');

        $state               = SSB_State::get_order_state($order);
        $summary_text        = SSB_State::get_summary_text($order);
        $open_action_label   = 'Open Fulfillment Station';
        $close_action_label  = 'Close Fulfillment Station';
        $has_purchased       = SSB_State::has_purchased_label($order);
        $expanded_by_default = false;
        $tracking            = SSB_State::get_tracking_payload($order);
        $snapshot            = get_post_meta($order->get_id(), '_shoshin_shippo_selected_rate_snapshot', true);
        $snapshot            = is_array($snapshot) ? $snapshot : array();

        $tracking_number     = !empty($tracking['tracking_number']) ? (string) $tracking['tracking_number'] : (!empty($snapshot['tracking_number']) ? (string) $snapshot['tracking_number'] : '');
        $tracking_carrier    = !empty($tracking['carrier']) ? (string) $tracking['carrier'] : (!empty($snapshot['provider']) ? (string) $snapshot['provider'] : '');
        $label_url           = !empty($tracking['label_url']) ? (string) $tracking['label_url'] : (!empty($snapshot['label_url']) ? (string) $snapshot['label_url'] : '');
        $stored_tracking_url = !empty($tracking['tracking_url']) ? (string) $tracking['tracking_url'] : (!empty($snapshot['tracking_url']) ? (string) $snapshot['tracking_url'] : '');
        $tracking_url        = $stored_tracking_url !== '' ? $stored_tracking_url : self::build_tracking_url($tracking_carrier, $tracking_number);

        $transaction_id       = !empty($tracking['transaction_id']) ? (string) $tracking['transaction_id'] : '';
        $refund_status        = (string) get_post_meta($order->get_id(), '_shoshin_shippo_refund_status', true);
        $transaction_status   = strtoupper((string) get_post_meta($order->get_id(), '_shoshin_shippo_transaction_status', true));
        $can_request_refund   = (
            $transaction_id !== '' &&
            $transaction_status === 'SUCCESS' &&
            !in_array(strtoupper($refund_status), array('QUEUED', 'PENDING', 'SUCCESS'), true)
        );

        $pickup_status        = (string) get_post_meta($order->get_id(), '_shoshin_shippo_pickup_status', true);
        $pickup_scheduled     = in_array(strtoupper($pickup_status), array('PENDING', 'CONFIRMED'), true);
        $pickup_supported     = ($transaction_id !== '' && (strtoupper($tracking_carrier) === 'USPS' || strpos(strtoupper($tracking_carrier), 'DHL') !== false));

        $return_label_url     = (string) get_post_meta($order->get_id(), '_shoshin_shippo_return_label_url', true);
        $return_label_exists  = ($return_label_url !== '');
        $return_supported     = ($transaction_id !== '' && in_array(strtoupper($tracking_carrier), array('USPS', 'UPS', 'FEDEX'), true));

        ?>
        <div
            id="ssb-shipping-label-card"
            class="ssb-card ssb-card--shipping-label<?php echo $has_purchased ? ' ssb-card--purchased' : ''; ?>"
            data-expanded="<?php echo $expanded_by_default ? '1' : '0'; ?>"
            data-state="<?php echo esc_attr($state); ?>"
        >
            <div class="ssb-card__header">
                <div class="ssb-card__summary">
                    <span class="ssb-card__icon" aria-hidden="true">🚚</span>
                    <div class="ssb-card__summary-text">
                        <div class="ssb-card__summary-line" id="ssb-card-summary-line"><?php echo esc_html($summary_text); ?></div>
                    </div>
                </div>

                <div class="ssb-card__actions">
                    <button
                        type="button"
                        class="button button-primary"
                        id="ssb-card-toggle"
                        data-open-label="<?php echo esc_attr($open_action_label); ?>"
                        data-close-label="<?php echo esc_attr($close_action_label); ?>"
                    >
                        <?php echo esc_html($open_action_label); ?>
                    </button>
                </div>
            </div>

            <div class="ssb-card__body" id="ssb-shipping-label-body" style="display:none;">

                <?php
                $packing_slip_url = wp_nonce_url(
                    admin_url('admin-post.php?action=ssb_print_packing_slip&order_id=' . $order->get_id()),
                    'ssb_print_packing_slip_' . $order->get_id()
                );
                ?>

                <div id="ssb-workspace" class="ssb-workspace">

                    <div id="ssb-processing-banner" class="ssb-workspace-banner ssb-workspace-banner--processing" style="display:none;"></div>

                    <div id="ssb-success-banner" class="ssb-workspace-banner ssb-workspace-banner--success" style="display:none;"></div>

                    <div id="ssb-post-purchase-actions" class="ssb-post-purchase-actions" style="display:none;">
                        <div class="ssb-post-purchase-actions__inner">
                            <div class="ssb-post-purchase-actions__buttons">
                                <a id="ssb-workspace-print-packing-slip" class="button" href="<?php echo esc_url($packing_slip_url); ?>" target="_blank" rel="noopener noreferrer">
                                    Print packing slip
                                </a>

                                <a id="ssb-workspace-print-label" class="button button-primary" href="<?php echo esc_url($label_url !== '' ? $label_url : '#'); ?>" target="_blank" rel="noopener noreferrer" <?php echo $label_url !== '' ? '' : 'style="display:none;"'; ?>>
                                    Print Shipping Label
                                </a>
                            </div>

                            <div class="ssb-post-purchase-actions__links">
                                <a id="ssb-workspace-track-shipment" class="button-link" href="<?php echo esc_url($tracking_url !== '' ? $tracking_url : '#'); ?>" target="_blank" rel="noopener noreferrer" <?php echo $tracking_url !== '' ? '' : 'style="display:none;"'; ?>>
                                    Track Shipments
                                </a>

                                <button
                                    type="button"
                                    id="ssb-workspace-schedule-pickup"
                                    class="button-link<?php echo ($pickup_supported && !$pickup_scheduled) ? '' : ' ssb-button-link-disabled'; ?>"
                                    <?php echo ($pickup_supported && !$pickup_scheduled) ? '' : 'disabled aria-disabled="true"'; ?>
                                    data-pickup-status="<?php echo esc_attr($pickup_status); ?>"
                                    title="<?php echo esc_attr($pickup_supported ? ($pickup_scheduled ? 'Pickup already scheduled for this label.' : 'Schedule a carrier pickup for this shipment.') : 'Schedule pickup is only available here for USPS or DHL Express labels.'); ?>"
                                    <?php echo $pickup_supported ? '' : 'style="display:none;"'; ?>
                                >
                                    <?php echo esc_html($pickup_scheduled ? 'Pickup scheduled' : 'Schedule Pickup'); ?>
                                </button>

                                <button
                                    type="button"
                                    id="ssb-workspace-void-label"
                                    class="button-link<?php echo $can_request_refund ? '' : ' ssb-button-link-disabled'; ?>"
                                    <?php echo $can_request_refund ? '' : 'disabled aria-disabled="true"'; ?>
                                    <?php echo $can_request_refund ? '' : 'style="display:none;"'; ?>
                                >
                                    Void Shipping Label
                                </button>

                                <?php
                                $return_tracking_exists = ((string) get_post_meta($order->get_id(), '_shoshin_shippo_return_tracking_number', true) !== '');
                                $return_button_title = $return_label_exists
                                    ? 'Open the existing return label.'
                                    : ($return_tracking_exists
                                        ? 'A return transaction exists, but no printable return label URL is available.'
                                        : ($return_supported
                                            ? 'Create a return label using the outbound carrier.'
                                            : 'Return labels are only available for supported carriers.'));
                                $return_button_text = $return_label_exists
                                    ? 'Print Return Label'
                                    : ($return_tracking_exists ? 'Return Label Unavailable' : 'Return Label');
                                ?>
                                <button
                                    type="button"
                                    id="ssb-workspace-return-label"
                                    class="button-link<?php echo ($return_supported || $return_label_exists || $return_tracking_exists) ? '' : ' ssb-button-link-disabled'; ?>"
                                    <?php echo ($return_supported || $return_label_exists || $return_tracking_exists) ? '' : 'disabled aria-disabled="true"'; ?>
                                    data-label-url="<?php echo esc_url($return_label_url); ?>"
                                    title="<?php echo esc_attr($return_button_title); ?>"
                                >
                                    <?php echo esc_html($return_button_text); ?>
                                </button>

                                <button
                                    type="button"
                                    id="ssb-workspace-void-return-label"
                                    class="button-link<?php echo $return_label_exists ? '' : ' ssb-button-link-disabled'; ?>"
                                    <?php echo $return_label_exists ? '' : 'disabled aria-disabled="true"'; ?>
                                    <?php echo $return_label_exists ? '' : 'style="display:none;"'; ?>
                                >
                                    Void Return Label
                                </button>

                                <a
                                    id="ssb-workspace-track-return-label"
                                    class="button-link"
                                    href="<?php echo esc_url((string) get_post_meta($order->get_id(), '_shoshin_shippo_return_tracking_url', true) ?: '#'); ?>"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    <?php echo $return_label_exists && (string) get_post_meta($order->get_id(), '_shoshin_shippo_return_tracking_url', true) !== '' ? '' : 'style="display:none;"'; ?>
                                >
                                    Track Returns
                                </a>
                            </div>

                            <div id="ssb-post-purchase-action-status" class="ssb-post-purchase-action-status" style="display:none;"></div>
                        </div>
                    </div>

                    <div id="ssb-shipment-shell" class="ssb-shipment-shell" style="display:none;">
                        <div class="ssb-shipment-shell__nav">
                            <div class="ssb-shipment-shell__nav-left">
                                <div id="ssb-shipment-tabs" class="ssb-shipment-tabs" style="display:none;"></div>
                                <button type="button" class="ssb-shipment-tab--action" id="ssb-split-shipment-trigger" style="display:none;">Split Shipment</button>
                            </div>

                            <div class="ssb-shipment-shell__actions">
                                <button type="button" class="button-link-delete" id="ssb-remove-shipment" style="display:none;">Remove Shipment</button>
                            </div>
                        </div>

                        <div class="ssb-shipment-shell__divider" aria-hidden="true"></div>

                        <div id="ssb-shipment-delete-notice" class="notice notice-error inline" style="display:none; margin:12px 0 0;">
                            <p>All labels for this shipment must be voided before it can be deleted.</p>
                        </div>
                    </div>

                    <?php self::render_allocation_section_shell($order); ?>
                    <?php self::render_v1_workspace_inner($order); ?>

                </div>

                                <div id="ssb-split-shipment-modal" class="ssb-modal" style="display:none;">
                    <div class="ssb-modal__backdrop"></div>
                    <div class="ssb-modal__dialog ssb-modal__dialog--split" role="dialog" aria-modal="true" aria-labelledby="ssb-split-shipment-title">
                        <div class="ssb-modal__header">
                            <h3 id="ssb-split-shipment-title">Split Shipment</h3>
                            <button type="button" class="ssb-modal__close" id="ssb-split-shipment-close" aria-label="Close">×</button>
                        </div>

                        <div class="ssb-modal__body">
                            <div class="ssb-split-shipment-toolbar">
                                <div class="ssb-split-shipment-toolbar__left">
                                    <span id="ssb-split-shipment-selected-count">0 selected</span>
                                    <button type="button" class="button-link" id="ssb-split-shipment-select-all">Select all</button>
                                    <button type="button" class="button-link" id="ssb-split-shipment-clear">Clear selection</button>
                                </div>

                                <div class="ssb-split-shipment-toolbar__right">
                                    <button type="button" class="button" id="ssb-split-shipment-create" disabled>Create Shipment</button>
                                </div>
                            </div>

                            <div class="ssb-split-shipment-table-wrap">
                                <table class="widefat ssb-split-shipment-table">
                                    <thead>
                                        <tr>
                                            <th style="width:42px;">
                                                <input type="checkbox" id="ssb-split-shipment-master-toggle">
                                            </th>
                                            <th>Product</th>
                                            <th style="width:90px;">Qty</th>
                                            <th style="width:160px;">Variation</th>
                                            <th style="width:120px;">Weight</th>
                                            <th style="width:110px;">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody id="ssb-split-shipment-rows"></tbody>
                                </table>
                            </div>
                        </div>

                        <div class="ssb-modal__footer">
                            <button type="button" class="button-link" id="ssb-split-shipment-cancel">Cancel</button>
                        </div>
                    </div>
                </div>

                <div id="ssb-split-shipment-unsaved-modal" class="ssb-modal" style="display:none;">
                    <div class="ssb-modal__backdrop"></div>
                    <div class="ssb-modal__dialog ssb-modal__dialog--confirm" role="dialog" aria-modal="true" aria-labelledby="ssb-split-unsaved-title">
                        <div class="ssb-modal__body">
                            <h3 id="ssb-split-unsaved-title">There are unsaved changes</h3>
                            <p>Are you sure you want to close the split shipment modal?</p>
                        </div>

                        <div class="ssb-modal__footer">
                            <button type="button" class="button-link" id="ssb-split-unsaved-continue">Continue editing the shipments</button>
                            <button type="button" class="button button-primary" id="ssb-split-unsaved-discard">Close and revert the changes</button>
                        </div>
                    </div>
                </div>

                <div id="ssb-allocation-action-modal" class="ssb-modal" style="display:none;">
                    <div class="ssb-modal__backdrop"></div>
                    <div class="ssb-modal__dialog ssb-modal__dialog--confirm" role="dialog" aria-modal="true" aria-labelledby="ssb-allocation-action-title">
                        <div class="ssb-modal__header">
                            <h3 id="ssb-allocation-action-title">Allocate item</h3>
                            <button type="button" class="ssb-modal__close" id="ssb-allocation-action-close" aria-label="Close">×</button>
                        </div>

                        <div class="ssb-modal__body">
                            <input type="hidden" id="ssb-allocation-action-order-item-id" value="">
                            <input type="hidden" id="ssb-allocation-action-mode" value="">
                            <input type="hidden" id="ssb-allocation-action-max-qty" value="">
                            <input type="hidden" id="ssb-allocation-action-source-shipment" value="">

                            <p id="ssb-allocation-action-qty-help" class="description">Available: 0</p>

                            <p class="form-field">
                                <label for="ssb-allocation-action-qty"><strong>Quantity</strong></label><br>
                                <input type="number" id="ssb-allocation-action-qty" class="small-text" min="1" step="1" value="1">
                            </p>

                            <p class="form-field" id="ssb-allocation-action-target-row">
                                <label for="ssb-allocation-action-target"><strong>Target shipment</strong></label><br>
                                <select id="ssb-allocation-action-target" class="regular-text"></select>
                            </p>
                        </div>

                        <div class="ssb-modal__footer">
                            <button type="button" class="button-link" id="ssb-allocation-action-cancel">Cancel</button>
                            <button type="button" class="button button-primary" id="ssb-allocation-action-confirm">Allocate</button>
                        </div>
                    </div>
                </div>

                <div id="ssb-ups-terms-modal" class="ssb-modal" style="display:none;">
                    <div class="ssb-modal__backdrop"></div>
                    <div class="ssb-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ssb-ups-terms-title">
                        <button type="button" class="ssb-modal__close" id="ssb-ups-terms-close" aria-label="Close">×</button>
                        <h3 id="ssb-ups-terms-title">UPS Terms and Conditions</h3>
                        <p>You must accept the required UPS terms before purchasing this label.</p>

                        <label class="ssb-modal__check">
                            <input type="checkbox" class="ssb-ups-terms-check">
                            I agree to the UPS Terms of Service.
                        </label>

                        <label class="ssb-modal__check">
                            <input type="checkbox" class="ssb-ups-terms-check">
                            I confirm I will not ship prohibited or restricted items.
                        </label>

                        <label class="ssb-modal__check">
                            <input type="checkbox" class="ssb-ups-terms-check">
                            I agree to the UPS Technology Agreement.
                        </label>

                        <div class="ssb-modal__actions">
                            <button type="button" class="button" id="ssb-ups-terms-cancel">Cancel</button>
                            <button type="button" class="button button-primary" id="ssb-ups-terms-confirm" disabled>Confirm and continue</button>
                        </div>
                    </div>
                </div>

                        <div id="ssb-void-label-modal" class="ssb-modal" style="display:none;">
            <div class="ssb-modal__backdrop"></div>
            <div class="ssb-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ssb-void-label-title">
                <div class="ssb-modal__header">
                    <h3 id="ssb-void-label-title">Void this shipping label?</h3>
                    <button type="button" class="ssb-modal__close" id="ssb-void-label-close" aria-label="Close">×</button>
                </div>

                <div class="ssb-modal__body">
                    <p>
                        This will request a refund for the most recent unused shipping label and void it for shipping use.
                    </p>
                    <p>
                        The current label will be kept in the order audit trail, and you will be able to purchase a replacement label after the void succeeds.
                    </p>
                </div>

                <div class="ssb-modal__footer">
                    <button type="button" class="button" id="ssb-void-label-cancel">Cancel</button>
                    <button type="button" class="button button-primary" id="ssb-void-label-confirm">Void Shipping Label</button>
                </div>
            </div>
        </div>

                <div id="ssb-schedule-pickup-modal" class="ssb-modal" style="display:none;">
            <div class="ssb-modal__backdrop"></div>
            <div class="ssb-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ssb-schedule-pickup-title">
                <div class="ssb-modal__header">
                    <h3 id="ssb-schedule-pickup-title">Schedule pickup</h3>
                    <button type="button" class="ssb-modal__close" id="ssb-schedule-pickup-close" aria-label="Close">×</button>
                </div>

                <div class="ssb-modal__body">
                    <p>Schedule a pickup for this purchased shipping label.</p>

                    <p>
                        <label for="ssb-pickup-date"><strong>Pickup date</strong></label><br>
                        <input type="date" id="ssb-pickup-date" value="<?php echo esc_attr(wp_date('Y-m-d', time(), wp_timezone())); ?>">
                    </p>

                    <p>
                        <label for="ssb-pickup-start-time"><strong>Ready from</strong></label><br>
                        <input type="time" id="ssb-pickup-start-time" value="09:00">
                    </p>

                    <p>
                        <label for="ssb-pickup-end-time"><strong>Available until</strong></label><br>
                        <input type="time" id="ssb-pickup-end-time" value="16:00">
                    </p>

                    <p>
                        <label for="ssb-pickup-instructions"><strong>Instructions</strong></label><br>
                        <textarea id="ssb-pickup-instructions" rows="3" placeholder="Optional pickup notes for the carrier."></textarea>
                    </p>
                </div>

                <div class="ssb-modal__footer">
                    <button type="button" class="button" id="ssb-schedule-pickup-cancel">Cancel</button>
                    <button type="button" class="button button-primary" id="ssb-schedule-pickup-confirm">Schedule pickup</button>
                </div>
            </div>
        </div>

        <div id="ssb-return-label-modal" class="ssb-modal" style="display:none;">
            <div class="ssb-modal__backdrop"></div>
            <div class="ssb-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ssb-return-label-title">
                <div class="ssb-modal__header">
                    <h3 id="ssb-return-label-title">Create Return Label</h3>
                    <button type="button" class="ssb-modal__close" id="ssb-return-label-close" aria-label="Close">×</button>
                </div>

                <div class="ssb-modal__body">
                    <p>
                        Purchase label with the origianl carrier at the lowest rate using the saved parcel details for this order.
                    </p>

                    <div class="ssb-package-checkbox-grid" id="ssb-return-option-grid">
                        <label class="ssb-check-card" for="ssb_return_contains_alcohol">
                            <input type="checkbox" id="ssb_return_contains_alcohol">
                            <span>Return Contains Alcohol</span>
                        </label>

                        <label class="ssb-check-card" for="ssb_return_contains_dry_ice">
                            <input type="checkbox" id="ssb_return_contains_dry_ice">
                            <span>Return Contains Dry Ice</span>
                        </label>

                        <label class="ssb-check-card" for="ssb_return_contains_hazmat">
                            <input type="checkbox" id="ssb_return_contains_hazmat">
                            <span>Return Contains Hazardous Materials</span>
                        </label>

                        <label class="ssb-check-card" for="ssb_return_additional_insurance">
                            <input type="checkbox" id="ssb_return_additional_insurance">
                            <span>Additional Insurance</span>
                        </label>
                    </div>

                    <p class="description" style="margin-top:8px;">
                        These selections apply only to this manual return label. They do not reuse or alter the outbound shipment selections.
                    </p>

<div id="ssb-return-label-preview" class="ssb-return-label-preview">

    <div class="ssb-return-preview-header">
        <img id="ssb-return-preview-logo" src="" alt="" style="display:none;">
        <div id="ssb-return-preview-title">Return Label Preview</div>
    </div>

    <div class="ssb-return-preview-body">
        <div class="ssb-return-preview-data">
            <div><strong>Carrier:</strong> <span id="ssb-return-preview-carrier">—</span></div>
            <div><strong>Service:</strong> <span id="ssb-return-preview-service">—</span></div>
            <div><strong>Base Rate:</strong> <span id="ssb-return-preview-base">—</span></div>
            <div><strong>Insurance:</strong> <span id="ssb-return-preview-insurance">—</span></div>
            <div><strong>Total:</strong> <span id="ssb-return-preview-total">—</span></div>
        </div>
    </div>

</div>

                    <div id="ssb-return-preview-feedback" class="ssb-feedback" style="display:none; margin-top:10px;"></div>
                </div>

                <div class="ssb-modal__footer">
                <div class="ssb-modal__footer-left">
                    <button type="button" class="button" id="ssb-return-label-cancel">Cancel</button>
                    <button type="button" class="button button-primary" id="ssb-return-label-confirm">Create Return Label</button>
                </div>

                <div class="ssb-modal__footer-right">
                    <button type="button" class="button button-secondary" id="ssb-return-fetch-rate">
                    Fetch New Rate
                    </button>
                </div>
                </div>
            </div>
        </div>

            </div>
        </div>
        <?php
    }

        /**
     * Build a tracking URL from carrier + tracking number.
     *
     * @param string $carrier
     * @param string $tracking_number
     * @return string
     */
    protected static function build_tracking_url($carrier, $tracking_number) {
        $carrier = strtolower(trim((string) $carrier));
        $tracking_number = trim((string) $tracking_number);

        if ($tracking_number === '') {
            return '';
        }

        if ($carrier === 'usps') {
            return 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' . rawurlencode($tracking_number);
        }

        return 'https://track.goshippo.com/track/' . rawurlencode($tracking_number);
    }

        protected static function render_allocation_section_shell($order) {
        if (!$order || !is_a($order, 'WC_Order')) {
            return;
        }

        $groups = SSB_State::get_fulfillment_groups($order);
        $items  = array();
        $shipments = array();

        if (!empty($groups['groups']) && is_array($groups['groups'])) {
            foreach ($groups['groups'] as $group) {
                if (empty($group['group_key']) || $group['group_key'] !== 'immediate') {
                    continue;
                }

                if (!empty($group['items']) && is_array($group['items'])) {
                    $items = $group['items'];
                }

                if (!empty($group['shipments']) && is_array($group['shipments'])) {
                    $shipments = $group['shipments'];
                }

                break;
            }
        }

        if (empty($items)) {
            return;
        }

        $single_shipment = count($shipments) <= 1;

$can_split = false;
foreach ($items as $item_row) {
    $qty_ordered = isset($item_row['qty_ordered']) ? absint($item_row['qty_ordered']) : 0;
    if ($qty_ordered > 1) {
        $can_split = true;
        break;
    }
}
if (!$can_split && count($items) > 1) {
    $can_split = true;
}

$has_unassigned_items = false;
foreach ($items as $item_row) {
    if (!empty($item_row['unassigned_qty'])) {
        $has_unassigned_items = true;
        break;
    }
}

if ($has_unassigned_items) {
    $allocation_message = 'There are unassigned items on this order. The order cannot be closed until all items have been shipped.';
} else {
    $allocation_message = $can_split
        ? 'All warehouse items are currently assigned to shipments.'
        : 'This shipment contains one allocatable warehouse item.';
}

        $has_non_immediate = false;

            if (!empty($groups['groups']) && is_array($groups['groups'])) {
                foreach ($groups['groups'] as $group) {
                    if (empty($group['group_key'])) {
                        continue;
                    }

                    if ($group['group_key'] !== 'immediate') {
                        if (!empty($group['items'])) {
                            $has_non_immediate = true;
                            break;
                        }
                    }
                }
            }

        ?>
        <div id="ssb-allocation-panel" class="ssb-allocation-panel">
    <?php if ($has_non_immediate) : ?>
        <div class="ssb-feedback ssb-feedback--warning">
            This order contains items that will be excluded from this shipment. Only available warehouse items can be allocated.
        </div>
    <?php endif; ?>
            <div class="ssb-allocation-panel__header">
                <div class="ssb-allocation-panel__title-wrap">
                    <p class="ssb-section-title"><strong>Shipment Allocation</strong></p>
                </div>

                <div class="ssb-allocation-panel__actions">
                    <button type="button" class="button button-secondary" id="ssb-edit-allocation" <?php disabled($single_shipment); ?>>Edit Allocation</button>
                </div>
            </div>

            <div class="ssb-package-helper">
                <?php echo esc_html($allocation_message); ?>
            </div>

            <div class="ssb-allocation-panel__table-wrap">
                <table class="widefat striped ssb-allocation-table">
                    <thead>
                                <tr>
                                    <th scope="col">Item</th>
                                    <th scope="col">On Order</th>
                                    <th scope="col">Allocated</th>
                                    <th scope="col">Other Shipments</th>
                                    <th scope="col">Unassigned</th>
                                    <th scope="col">Variation</th>
                                    <th scope="col">Weight</th>
                                    <th scope="col">Price</th>
                                    <th scope="col">Options</th>
                                </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($items as $item_row) : ?>
                            <?php
                            $order_item_id = !empty($item_row['order_item_id']) ? absint($item_row['order_item_id']) : 0;
                            $product_id    = !empty($item_row['product_id']) ? absint($item_row['product_id']) : 0;
                            $qty_ordered   = isset($item_row['qty_ordered']) ? absint($item_row['qty_ordered']) : 0;
                            $unassigned    = isset($item_row['unassigned_qty']) ? absint($item_row['unassigned_qty']) : 0;

                            $product = $product_id ? wc_get_product($product_id) : false;
                            $item    = $order->get_item($order_item_id);

                            $product_name = $product ? $product->get_name() : ('Item #' . $order_item_id);
                            $thumb = $product ? $product->get_image(array(40, 40)) : '';

                            $variation_summary = $product ? wc_get_formatted_variation($product, true, false, true) : '';
                            $variation_summary = $variation_summary ? wp_strip_all_tags($variation_summary) : '—';

                            $weight_display = ($product && $product->get_weight() !== '') ? $product->get_weight() . ' lbs' : '—';

                            $price_display = ($item && $qty_ordered > 0)
                                ? wc_price((float) $item->get_total() / max(1, $qty_ordered), array('currency' => $order->get_currency()))
                                : '—';

                            $this_shipment_qty = max(0, $qty_ordered - $unassigned);
                            $assigned_elsewhere = 0;
                            ?>
                                <tr data-order-item-id="<?php echo esc_attr($order_item_id); ?>" data-qty-ordered="<?php echo esc_attr($qty_ordered); ?>">
                                    <td>
                                        <div class="ssb-allocation-item">
                                            <span class="ssb-allocation-item__thumb">
                                                <?php
                                                if ($product) {
                                                    echo wp_kses_post($thumb);
                                                } else {
                                                    echo '<span class="ssb-allocation-item__thumb-placeholder">—</span>';
                                                }
                                                ?>
                                            </span>
                                            <span class="ssb-allocation-item__name"><?php echo esc_html($product_name); ?></span>
                                        </div>
                                    </td>
                                    <td class="ssb-allocation-col-on-order"><?php echo esc_html($qty_ordered); ?></td>
                                    <td class="ssb-allocation-col-allocated">
                                        <input
                                            type="number"
                                            class="small-text ssb-allocation-input-allocated"
                                            value="<?php echo esc_attr($this_shipment_qty); ?>"
                                            min="0"
                                            step="1"
                                            readonly
                                        >
                                    </td>
                                    <td class="ssb-allocation-col-other-shipment"><?php echo esc_html($assigned_elsewhere); ?></td>
                                    <td class="ssb-allocation-col-unassigned"><?php echo esc_html($unassigned); ?></td>
                                    <td class="ssb-allocation-col-variation"><?php echo esc_html($variation_summary ?: '—'); ?></td>
                                    <td class="ssb-allocation-col-weight"><?php echo esc_html($weight_display ?: '—'); ?></td>
                                    <td class="ssb-allocation-col-price"><?php echo wp_kses_post($price_display ?: '—'); ?></td>
                                    <td class="ssb-allocation-col-options">
                                        <button type="button" class="button-link ssb-allocation-row-action" <?php disabled($single_shipment); ?>>
                                            <?php echo $single_shipment ? 'Remove' : 'Allocate'; ?>
                                        </button>
                                    </td>
                                </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
        <?php
    }

    /**
     * Render sidebar Shipment Tracking card.
     *
     * @param WP_Post|WC_Order $post_or_order_object
     * @return void
     */
    public static function render_tracking_card($post_or_order_object) {
        $order = self::resolve_order_object($post_or_order_object);

        if (!$order) {
            echo '<p>Unable to load this WooCommerce order.</p>';
            return;
        }

        $tracking   = SSB_State::get_tracking_payload($order);
        $snapshot   = get_post_meta($order->get_id(), '_shoshin_shippo_selected_rate_snapshot', true);
        $snapshot   = is_array($snapshot) ? $snapshot : array();
        $state      = isset($tracking['state']) ? $tracking['state'] : 'none';
        $parcel     = SSB_State::get_parcel_snapshot($order);
        $has_label  = SSB_State::has_purchased_label($order);
                $has_return_tracking = (
            (string) get_post_meta($order->get_id(), '_shoshin_shippo_return_tracking_number', true) !== '' ||
            (string) get_post_meta($order->get_id(), '_shoshin_shippo_return_carrier', true) !== '' ||
            (string) get_post_meta($order->get_id(), '_shoshin_shippo_return_service', true) !== '' ||
            (string) get_post_meta($order->get_id(), '_shoshin_shippo_return_transaction_id', true) !== ''
        );

        $has_tracking_info = ($has_label || $has_return_tracking);

        $label_file_type = (string) get_post_meta($order->get_id(), '_shoshin_shippo_label_file_type', true);

        if ($label_file_type === '' && !empty($snapshot['label_file_type'])) {
            $label_file_type = (string) $snapshot['label_file_type'];
        }

        if (!in_array($label_file_type, array('PDF_4x6', 'PDF'), true)) {
            $label_file_type = 'PDF_4x6';
        }

                $return_tracking_number = (string) get_post_meta($order->get_id(), '_shoshin_shippo_return_tracking_number', true);
        $return_tracking_status = (string) get_post_meta($order->get_id(), '_shoshin_shippo_return_tracking_status', true);
        $return_carrier         = (string) get_post_meta($order->get_id(), '_shoshin_shippo_return_carrier', true);
        $return_service         = (string) get_post_meta($order->get_id(), '_shoshin_shippo_return_service', true);

        $has_outbound_tracking_display = (
            !empty($tracking['tracking_number']) ||
            !empty($tracking['label_url']) ||
            !empty($tracking['transaction_id']) ||
            !empty($snapshot['tracking_number']) ||
            !empty($snapshot['label_url']) ||
            !empty($snapshot['provider']) ||
            !empty($snapshot['service'])
        );

        $display_carrier = !empty($tracking['carrier'])
            ? $tracking['carrier']
            : (!empty($snapshot['provider']) ? $snapshot['provider'] : '—');

        $display_service = !empty($tracking['service'])
            ? $tracking['service']
            : (!empty($snapshot['service']) ? $snapshot['service'] : '—');

        $display_status  = !empty($tracking['tracking_status']) && strtoupper((string) $tracking['tracking_status']) !== 'UNKNOWN'
            ? $tracking['tracking_status']
            : ($has_outbound_tracking_display ? 'Label purchased' : '—');

        $physical_item_count = 0;
        $order_value         = (float) $order->get_total();
        $shipping_paid       = (float) $order->get_shipping_total();
        $selected_amount     = !empty($snapshot['amount']) ? (float) $snapshot['amount'] : 0.0;
        $selected_currency   = !empty($snapshot['currency']) ? (string) $snapshot['currency'] : $order->get_currency();
        $paid_delta          = $shipping_paid - $selected_amount;
        $paid_class          = $paid_delta >= 0 ? 'ssb-money-positive' : 'ssb-money-negative';

        $declared_value = 0.0;

        foreach ($order->get_items('line_item') as $item) {
            $product = $item->get_product();
            if ($product && $product->needs_shipping()) {
                $physical_item_count += max(1, (int) $item->get_quantity());
                $declared_value += (float) $item->get_total();
            }
        }

        $coverage_provider = '';
        $coverage_service  = '';
        $coverage_amount   = 0.0;

        $return_cost_raw      = (string) get_post_meta($order->get_id(), '_shoshin_shippo_return_amount', true);
        $return_cost_currency = (string) get_post_meta($order->get_id(), '_shoshin_shippo_return_currency', true);

        if ($return_carrier !== '' && $return_service !== '') {
            $coverage_provider = $return_carrier;
            $coverage_service  = $return_service;
            $coverage_amount   = ($return_cost_raw !== '' && is_numeric($return_cost_raw)) ? (float) $return_cost_raw : 0.0;
        } elseif ($display_carrier !== '—' && $display_service !== '—') {
            $coverage_provider = $display_carrier;
            $coverage_service  = $display_service;
            $coverage_amount   = $selected_amount;
        }

        $coverage_config    = self::get_service_matrix_config($coverage_provider, $coverage_service);
        $included_coverage  = 0.0;

        foreach ($coverage_config['included'] as $included_label) {
            if (preg_match('/up to \\$([0-9]+(?:\\.[0-9]{1,2})?)/i', $included_label, $match)) {
                $included_coverage = (float) $match[1];
                break;
            }
        }

        $additional_coverage = max(0, $declared_value - $included_coverage);
        $coverage_currency   = $return_cost_currency !== '' ? $return_cost_currency : $selected_currency;

        $ship_to_lines = array_filter(array(
            trim($order->get_shipping_address_1()),
            trim($order->get_shipping_address_2()),
            trim($order->get_shipping_city() . ', ' . $order->get_shipping_state() . ' ' . $order->get_shipping_postcode()),
            trim($order->get_shipping_country()),
        ));

        ?>
        <div id="ssb-tracking-card" class="ssb-tracking-card" data-state="<?php echo esc_attr($state); ?>">

            <div id="ssb-tracking-section" class="ssb-sidebar-section" <?php echo $has_tracking_info ? '' : 'style="display:none;"'; ?>>
                <h4 class="ssb-sidebar-section__title">Tracking Info</h4>
                <ul class="ssb-tracking-list">
                    <li><strong>Tracking:</strong> <span id="ssb-sidebar-tracking"><?php echo esc_html(!empty($tracking['tracking_number']) ? $tracking['tracking_number'] : (!empty($snapshot['tracking_number']) ? $snapshot['tracking_number'] : '—')); ?></span></li>
                    <li><strong>Carrier:</strong> <span id="ssb-sidebar-carrier"><?php echo esc_html($display_carrier !== '—' ? strtoupper($display_carrier) : '—'); ?></span></li>
                    <li><strong>Service:</strong> <span id="ssb-sidebar-service"><?php echo esc_html($display_service); ?></span></li>
                    <li><strong>Status:</strong> <span id="ssb-sidebar-status"><?php echo esc_html($display_status); ?></span></li>
                    <li id="ssb-sidebar-return-tracking-row" <?php echo (string) get_post_meta($order->get_id(), '_shoshin_shippo_return_tracking_number', true) !== '' ? '' : 'style="display:none;"'; ?>><strong>Return tracking:</strong> <span id="ssb-sidebar-return-tracking"><?php echo esc_html((string) get_post_meta($order->get_id(), '_shoshin_shippo_return_tracking_number', true) ?: '—'); ?></span></li>
                    <li id="ssb-sidebar-return-carrier-row" <?php echo (string) get_post_meta($order->get_id(), '_shoshin_shippo_return_carrier', true) !== '' ? '' : 'style="display:none;"'; ?>><strong>Return carrier:</strong> <span id="ssb-sidebar-return-carrier"><?php echo esc_html((string) get_post_meta($order->get_id(), '_shoshin_shippo_return_carrier', true) ?: '—'); ?></span></li>
                    <li id="ssb-sidebar-return-service-row" <?php echo (string) get_post_meta($order->get_id(), '_shoshin_shippo_return_service', true) !== '' ? '' : 'style="display:none;"'; ?>><strong>Return service:</strong> <span id="ssb-sidebar-return-service"><?php echo esc_html((string) get_post_meta($order->get_id(), '_shoshin_shippo_return_service', true) ?: '—'); ?></span></li>
                </ul>
            </div>
            <div id="ssb-sidebar-collapsible-details">
                <div id="ssb-order-details-section" class="ssb-sidebar-section">
                <h4 class="ssb-sidebar-section__title">Order Details</h4>
                <ul class="ssb-sidebar-summary-list">
                    <li><strong>Number of items:</strong> <span id="ssb-sidebar-item-count"><?php echo esc_html($physical_item_count); ?></span></li>
                    <li><strong>Order value:</strong> <span id="ssb-sidebar-order-value"><?php echo wp_kses_post(wc_price($order_value, array('currency' => $order->get_currency()))); ?></span></li>
                    <li><strong>Ship to:</strong>
                        <div id="ssb-sidebar-ship-to">
                            <?php if (!empty($ship_to_lines)) : ?>
                                <?php foreach ($ship_to_lines as $line) : ?>
                                    <div><?php echo esc_html($line); ?></div>
                                <?php endforeach; ?>
                            <?php else : ?>
                                <div>—</div>
                            <?php endif; ?>
                        </div>
                    </li>
                </ul>
            </div>

            <div id="ssb-package-details-section" class="ssb-sidebar-section">
                <h4 class="ssb-sidebar-section__title">Package Details</h4>
                <ul class="ssb-sidebar-summary-list">
                    <li><strong>Dimensions:</strong> <span id="ssb-sidebar-package-dimensions"><?php echo esc_html(trim($parcel['length'] . ' × ' . $parcel['width'] . ' × ' . $parcel['height']) !== '× ×' ? $parcel['length'] . ' × ' . $parcel['width'] . ' × ' . $parcel['height'] . ' in' : '—'); ?></span></li>
                    <li><strong>Weight:</strong> <span id="ssb-sidebar-package-weight"><?php echo esc_html($parcel['weight'] !== '' ? $parcel['weight'] . ' lb' : '—'); ?></span></li>
                </ul>
            </div>           

            </div>

            <div id="ssb-shipment-details-section" class="ssb-sidebar-section">
                <h4 class="ssb-sidebar-section__title">Shipment Details</h4>
                <ul class="ssb-sidebar-summary-list">
                    <li>
                        <strong>Shipment ID:</strong>
                        <span id="ssb-sidebar-shipment-id"><?php echo esc_html($tracking['shipment_id'] !== '' ? $tracking['shipment_id'] : '—'); ?></span>
                    </li>

                    <li>
                        <strong>Transaction ID:</strong>
                        <span id="ssb-sidebar-transaction-id"><?php echo esc_html($tracking['transaction_id'] !== '' ? $tracking['transaction_id'] : '—'); ?></span>
                    </li>

                    <li id="ssb-sidebar-return-transaction-row">
                        <strong>Return Transaction ID:</strong>
                        <span id="ssb-sidebar-return-transaction-id"><?php echo esc_html((string) get_post_meta($order->get_id(), '_shoshin_shippo_return_transaction_id', true) ?: '—'); ?></span>
                    </li>

                    <li id="ssb-sidebar-return-cost-row">
                        <strong>Return Label Cost:</strong>
                        <span id="ssb-sidebar-return-cost">—</span>
                    </li>

                    <li>
                        <strong>Selected Service:</strong>
                        <span id="ssb-sidebar-selected-service"><?php echo esc_html(!empty($tracking['service']) ? $tracking['service'] : (!empty($snapshot['service']) ? $snapshot['service'] : '—')); ?></span>
                    </li>

                    <li>
                        <strong>Service Total:</strong>
                        <span id="ssb-sidebar-selected-rate"><?php echo esc_html(!empty($snapshot['amount']) ? $snapshot['amount'] . ' ' . $selected_currency : '—'); ?></span>
                    </li>

                    <li id="ssb-sidebar-declared-value-row">
                        <strong>Declared Value:</strong>
                        <span id="ssb-sidebar-declared-value"><?php echo esc_html('$' . number_format($declared_value, 2)); ?></span>
                    </li>

                    <li id="ssb-sidebar-included-coverage-row">
                        <strong>Included Coverage:</strong>
                        <span id="ssb-sidebar-included-coverage"><?php echo esc_html('$' . number_format($included_coverage, 2)); ?></span>
                    </li>

                    <li id="ssb-sidebar-additional-coverage-row">
                        <strong>Additional Coverage:</strong>
                        <span id="ssb-sidebar-additional-coverage"><?php echo esc_html('$' . number_format($additional_coverage, 2)); ?></span>
                    </li>

                    <li id="ssb-sidebar-insurance-charge-row">
                        <strong>Insurance Charge:</strong>
                        <span id="ssb-sidebar-insurance-charge">—</span>
                    </li>

                    <li>
                        <strong>User Paid:</strong>
                        <span id="ssb-sidebar-user-paid" class="<?php echo esc_attr($paid_class); ?>"><?php echo wp_kses_post(wc_price($shipping_paid, array('currency' => $order->get_currency()))); ?></span>
                    </li>
                </ul>
            </div>

            <div id="ssb-sidebar-action-rail" class="ssb-sidebar-action-rail">
                <div class="ssb-sidebar-label-format">
                    <label for="ssb_shippo_label_file_type">Label format</label>
                    <select id="ssb_shippo_label_file_type" <?php disabled($has_label); ?>>
                        <option value="PDF_4x6" <?php selected($label_file_type, 'PDF_4x6'); ?>>4x6</option>
                        <option value="PDF" <?php selected($label_file_type, 'PDF'); ?>>8.5 x 11</option>
                    </select>
                    <p class="description ssb-sidebar-label-format-help">
                        This sets the format of the shipping label that will be purchased.
                    </p>
                </div>

                <?php if (!$has_label) : ?>
                    <button type="button" class="button button-primary button-hero" id="ssb-sidebar-purchase-label" disabled>
                        Purchase Shipping Label
                    </button>

                    <label class="ssb-complete-order-check">
                        <input type="checkbox" id="ssb_complete_order_after_purchase" checked>
                        <span>After purchasing a label, mark this order as complete and notify the customer</span>
                    </label>
                <?php else : ?>
                    <button type="button" class="button button-primary" id="ssb-sidebar-toggle-shipment-info" data-expanded="1">
                        Collapse Shipment Info
                    </button>
                <?php endif; ?>
            </div>
        </div>
        <?php
    }

        protected static function get_service_matrix_config($provider, $service) {
        $provider = strtoupper(trim((string) $provider));
        $service  = strtolower(trim((string) $service));

        $service = preg_replace('/[®™]/u', '', $service);
        $service = preg_replace('/\s+/', ' ', $service);

        $map = array(
            'usps_ground_advantage' => array(
                'included' => array('Tracking', 'Insurance (up to $100.00)', 'Free pickup'),
                'optional' => array(
                    'signature_required'       => 'Signature required',
                    'adult_signature_required' => 'Adult signature required',
                ),
            ),
            'ups_ground_saver' => array(
                'included' => array('Tracking', 'Insurance (up to $20.00)'),
                'optional' => array(
                    'carbon_neutral'      => 'Carbon neutral',
                    'additional_handling' => 'Additional handling',
                ),
            ),
            'usps_priority_mail' => array(
                'included' => array('Tracking', 'Insurance (up to $100.00)', 'Free pickup'),
                'optional' => array(
                    'signature_required'       => 'Signature required',
                    'adult_signature_required' => 'Adult signature required',
                ),
            ),
            'ups_ground' => array(
                'included' => array('Tracking', 'Insurance (up to $100.00)'),
                'optional' => array(
                    'signature_required'       => 'Signature required',
                    'adult_signature_required' => 'Adult signature required',
                    'carbon_neutral'           => 'Carbon neutral',
                    'additional_handling'      => 'Additional handling',
                ),
            ),
            'ups_3_day_select' => array(
                'included' => array('Tracking', 'Insurance (up to $100.00)'),
                'optional' => array(
                    'signature_required'       => 'Signature required',
                    'adult_signature_required' => 'Adult signature required',
                    'carbon_neutral'           => 'Carbon neutral',
                    'additional_handling'      => 'Additional handling',
                ),
            ),
            'ups_2nd_day_air' => array(
                'included' => array('Tracking', 'Insurance (up to $100.00)'),
                'optional' => array(
                    'signature_required'       => 'Signature required',
                    'adult_signature_required' => 'Adult signature required',
                    'carbon_neutral'           => 'Carbon neutral',
                    'additional_handling'      => 'Additional handling',
                    'saturday_delivery'        => 'Saturday delivery',
                ),
            ),
            'ups_next_day_air_saver' => array(
                'included' => array('Tracking', 'Insurance (up to $100.00)'),
                'optional' => array(
                    'signature_required'       => 'Signature required',
                    'adult_signature_required' => 'Adult signature required',
                    'carbon_neutral'           => 'Carbon neutral',
                    'additional_handling'      => 'Additional handling',
                ),
            ),
            'ups_next_day_air' => array(
                'included' => array('Tracking', 'Insurance (up to $100.00)'),
                'optional' => array(
                    'signature_required'       => 'Signature required',
                    'adult_signature_required' => 'Adult signature required',
                    'carbon_neutral'           => 'Carbon neutral',
                    'additional_handling'      => 'Additional handling',
                    'saturday_delivery'        => 'Saturday delivery',
                ),
            ),
            'usps_express_mail' => array(
                'included' => array('Tracking', 'Insurance (up to $100.00)', 'Free pickup'),
                'optional' => array(
                    'signature_required'       => 'Signature required',
                    'adult_signature_required' => 'Adult signature required',
                ),
            ),
            'ups_next_day_air_early' => array(
                'included' => array('Tracking', 'Insurance (up to $100.00)'),
                'optional' => array(
                    'adult_signature_required' => 'Adult signature required',
                    'carbon_neutral'           => 'Carbon neutral',
                    'additional_handling'      => 'Additional handling',
                    'saturday_delivery'        => 'Saturday delivery',
                ),
            ),
            'usps_media_mail' => array(
                'included' => array('Tracking'),
                'optional' => array(
                    'signature_required' => 'Signature required',
                ),
            ),
        );

        $key = '';

        if ($provider === 'USPS') {
            if (strpos($service, 'ground advantage') !== false) $key = 'usps_ground_advantage';
            elseif (strpos($service, 'priority mail express') !== false || strpos($service, 'express mail') !== false) $key = 'usps_express_mail';
            elseif (strpos($service, 'priority mail') !== false) $key = 'usps_priority_mail';
            elseif (strpos($service, 'media mail') !== false) $key = 'usps_media_mail';
        } elseif ($provider === 'UPS') {
            if (strpos($service, 'ground saver') !== false) $key = 'ups_ground_saver';
            elseif (strpos($service, '3 day select') !== false) $key = 'ups_3_day_select';
            elseif (strpos($service, '2nd day air') !== false || strpos($service, 'second day air') !== false) $key = 'ups_2nd_day_air';
            elseif (strpos($service, 'next day air early') !== false) $key = 'ups_next_day_air_early';
            elseif (strpos($service, 'next day air saver') !== false) $key = 'ups_next_day_air_saver';
            elseif (strpos($service, 'next day air') !== false) $key = 'ups_next_day_air';
            elseif ($service === 'ground' || strpos($service, 'ups ground') !== false) $key = 'ups_ground';
        }

        return isset($map[$key]) ? $map[$key] : array(
            'included' => array(),
            'optional' => array(),
        );
    }

    protected static function render_purchased_option_rows($selected_snapshot, $purchase_snapshot) {
        $provider = !empty($selected_snapshot['provider']) ? (string) $selected_snapshot['provider'] : '';
        $service  = !empty($selected_snapshot['service']) ? (string) $selected_snapshot['service'] : '';

        $config  = self::get_service_matrix_config($provider, $service);
        $addons  = !empty($purchase_snapshot['addons']) && is_array($purchase_snapshot['addons']) ? $purchase_snapshot['addons'] : array();
        $options = !empty($purchase_snapshot['options']) && is_array($purchase_snapshot['options']) ? $purchase_snapshot['options'] : array();

        $rows = array();

        foreach ($config['included'] as $label) {
            $rows[] = $label;
        }

        foreach ($config['optional'] as $key => $label) {
            if (!empty($addons[$key])) {
                $rows[] = $label;
            }
        }

        if (!empty($options['additional_insurance'])) {
            $rows[] = 'Additional Insurance';
        }

        if (empty($rows)) {
            return '';
        }

        $html = '<span class="ssb-rate-row__middle">';

        foreach ($rows as $label) {
            $html .= '<div class="ssb-rate-feature-row">';
            $html .= '<span class="ssb-rate-feature-row__icon" aria-hidden="true">✓</span>';
            $html .= '<span class="ssb-rate-feature-row__text">' . esc_html($label) . '</span>';
            $html .= '</div>';
        }

        $html .= '</span>';

        return $html;
    }

    /**
     * Render the preserved v1 workspace internals inside the new shell.
     *
     * @param WC_Order $order
     * @return void
     */
    protected static function render_v1_workspace_inner($order) {
        $order_id = $order->get_id();

        $shipment_id         = get_post_meta($order_id, '_shoshin_shippo_shipment_id', true);
        $transaction_id      = get_post_meta($order_id, '_shoshin_shippo_transaction_id', true);
        $label_url           = get_post_meta($order_id, '_shoshin_shippo_label_url', true);
        $tracking_number     = get_post_meta($order_id, '_shoshin_shippo_tracking_number', true);
        $tracking_status     = get_post_meta($order_id, '_shoshin_shippo_tracking_status', true);
        $carrier             = get_post_meta($order_id, '_shoshin_shippo_carrier', true);
        $service             = get_post_meta($order_id, '_shoshin_shippo_service', true);
        $packing_note        = (string) get_post_meta($order_id, '_shoshin_shippo_packing_note', true);
        $selected_snapshot   = get_post_meta($order_id, '_shoshin_shippo_selected_rate_snapshot', true);
        $selected_snapshot   = is_array($selected_snapshot) ? $selected_snapshot : array();
        $purchase_snapshot   = get_post_meta($order_id, '_shoshin_shippo_purchase_snapshot', true);
        $purchase_snapshot   = is_array($purchase_snapshot) ? $purchase_snapshot : array();
        $parcel              = SSB_State::get_parcel_snapshot($order);
        $has_purchased_label = SSB_State::has_purchased_label($order);

        $working_options = array(
            'use_item_weight'      => (string) get_post_meta($order_id, '_shoshin_shippo_use_item_weight', true) === '1',
            'contains_alcohol'     => (string) get_post_meta($order_id, '_shoshin_shippo_contains_alcohol', true) === '1',
            'contains_dry_ice'     => (string) get_post_meta($order_id, '_shoshin_shippo_contains_dry_ice', true) === '1',
            'create_return_label'  => (string) get_post_meta($order_id, '_shoshin_shippo_create_return_label', true) === '1',
            'contains_hazmat'      => (string) get_post_meta($order_id, '_shoshin_shippo_contains_hazmat', true) === '1',
            'additional_insurance' => (string) get_post_meta($order_id, '_shoshin_shippo_additional_insurance', true) === '1',
        );

        $frozen_options = !empty($purchase_snapshot['options']) && is_array($purchase_snapshot['options'])
            ? $purchase_snapshot['options']
            : array();

        $display_options = $has_purchased_label ? wp_parse_args($frozen_options, $working_options) : $working_options;

        $disable_alcohol = get_option('ssb_disable_alcohol', '0') === '1';
        $disable_dry_ice = get_option('ssb_disable_dry_ice', '0') === '1';
        $disable_hazmat  = get_option('ssb_disable_hazmat', '0') === '1';

        if ($disable_alcohol) {
            $display_options['contains_alcohol'] = false;
        }

        if ($disable_dry_ice) {
            $display_options['contains_dry_ice'] = false;
        }

        if ($disable_hazmat) {
            $display_options['contains_hazmat'] = false;
        }

        $return_label_exists = (string) get_post_meta($order_id, '_shoshin_shippo_return_label_url', true) !== '';

        $total_item_weight = 0.0;

        foreach ($order->get_items('line_item') as $item) {
            $product = $item->get_product();

            if (!$product || !$product->needs_shipping()) {
                continue;
            }

            $product_weight = (float) $product->get_weight();
            $quantity       = max(1, (int) $item->get_quantity());

            if ($product_weight > 0) {
                $total_item_weight += ($product_weight * $quantity);
            }
        }

        $label_file_type = (string) get_post_meta($order_id, '_shoshin_shippo_label_file_type', true);

        if ($label_file_type === '' && !empty($selected_snapshot['label_file_type'])) {
            $label_file_type = (string) $selected_snapshot['label_file_type'];
        }

        if (!in_array($label_file_type, array('PDF_4x6', 'PDF'), true)) {
            $label_file_type = 'PDF_4x6';
        }

        ?>
        <div id="ssb-shippo-box" class="ssb-shippo-box<?php echo $has_purchased_label ? ' ssb-shippo-box--purchased' : ''; ?>" data-order-id="<?php echo esc_attr($order_id); ?>">
            <?php wp_nonce_field('ssb_admin_nonce', 'ssb_admin_nonce_field'); ?>

            <div class="ssb-section ssb-package-section">
                <p class="ssb-section-title"><strong>Create Shipping Label</strong></p>

                <div class="ssb-package-tabs" role="tablist" aria-label="Package modes">
                    <button type="button" class="ssb-package-tab is-active" data-ssb-package-tab="custom" aria-pressed="true">
                        Custom package
                    </button>
                    <button type="button" class="ssb-package-tab" data-ssb-package-tab="carrier" aria-pressed="false">
                        Carrier package
                    </button>
                    <button type="button" class="ssb-package-tab" data-ssb-package-tab="saved" aria-pressed="false">
                        Saved templates
                    </button>
                </div>

                <div class="ssb-package-panel" data-ssb-package-panel="custom">
                    <div class="ssb-package-helper">
                        Enter the package dimensions and weight below. Rates will load once the package is valid.
                    </div>

                    <div class="ssb-package-type-row">
                        <label for="ssb_shippo_package_type">PACKAGE TYPE</label>
                        <select id="ssb_shippo_package_type" <?php disabled($has_purchased_label); ?>>
                            <option value="box" selected>Box</option>
                            <option value="envelope">Envelope</option>
                        </select>
                    </div>

                    <div class="ssb-grid-3">
                        <p class="form-field">
                            <label for="ssb_shippo_length">LENGTH (in)</label>
                            <input type="number" step="0.01" min="0" id="ssb_shippo_length" value="<?php echo esc_attr($parcel['length']); ?>" <?php disabled($has_purchased_label); ?> />
                        </p>

                        <p class="form-field">
                            <label for="ssb_shippo_width">WIDTH (in)</label>
                            <input type="number" step="0.01" min="0" id="ssb_shippo_width" value="<?php echo esc_attr($parcel['width']); ?>" <?php disabled($has_purchased_label); ?> />
                        </p>

                        <p class="form-field">
                            <label for="ssb_shippo_height">HEIGTH (in)</label>
                            <input type="number" step="0.01" min="0" id="ssb_shippo_height" value="<?php echo esc_attr($parcel['height']); ?>" <?php disabled($has_purchased_label); ?> />
                        </p>
                    </div>

                    <div class="ssb-package-weight-controls">
                        <div class="ssb-package-weight-row">
                            <p class="form-field">
                                <label for="ssb_shippo_weight">TOTAL SHIPMENT WEIGHT (with Package)</label>
                                <div class="ssb-weight-input-row">
                                    <input type="number" step="0.01" min="0" id="ssb_shippo_weight" value="<?php echo esc_attr($parcel['weight']); ?>" <?php disabled($has_purchased_label); ?> />
                                    <select id="ssb_shippo_weight_unit" <?php disabled($has_purchased_label); ?>>
                                        <option value="lb" selected>lb</option>
                                    </select>
                                    <label class="ssb-inline-check">
                                        <input type="checkbox" id="ssb_use_item_weight" data-item-weight-total="<?php echo esc_attr(number_format($total_item_weight, 2, '.', '')); ?>" <?php checked(!empty($display_options['use_item_weight'])); ?> <?php disabled($has_purchased_label); ?>>
                                        <span>Use Weight of Items</span>
                                    </label>
                                </div>
                            </p>
                        </div>
                    </div>

                    <div class="ssb-package-checkbox-grid">
                        <label class="ssb-check-card">
                            <input type="checkbox" id="ssb_contains_alcohol" <?php checked(!empty($display_options['contains_alcohol'])); ?> <?php disabled($has_purchased_label || $disable_alcohol); ?>>
                            <span>Shipment Contains Alcohol</span>
                        </label>
                        <label class="ssb-check-card">
                            <input type="checkbox" id="ssb_contains_dry_ice" <?php checked(!empty($display_options['contains_dry_ice'])); ?> <?php disabled($has_purchased_label || $disable_dry_ice); ?>>
                            <span>Shipment Contains Dry Ice</span>
                        </label>

                        <label class="ssb-check-card">
                            <input type="checkbox" id="ssb_contains_hazmat" <?php checked(!empty($display_options['contains_hazmat'])); ?> <?php disabled($has_purchased_label || $disable_hazmat); ?>>
                            <span>Shipment Contains Hazardous Materials</span>
                        </label>

                        <label class="ssb-check-card">
                            <input type="checkbox" id="ssb_additional_insurance" <?php checked(!empty($display_options['additional_insurance'])); ?> <?php disabled($has_purchased_label); ?>>
                            <span>Additional Insurance (per $100)</span>
                        </label>
                        
                        <label class="ssb-check-card">
                            <input
                                type="checkbox"
                                id="ssb_create_return_label"
                                <?php checked(!empty($display_options['create_return_label']) || $return_label_exists); ?>
                                <?php disabled($has_purchased_label || $return_label_exists); ?>
                            >
                            <span><?php echo esc_html($return_label_exists ? 'Return label already exists' : 'Create a return label'); ?></span>
                        </label>

                    </div>
                    

                    <div class="ssb-packing-note-block">
                        <button type="button" class="button-link" id="ssb-toggle-packing-note">
                            Add Note on Packing Slip
                        </button>

                        <div id="ssb-packing-note-editor" class="ssb-packing-note-editor" style="display:none;">
                            <textarea id="ssb_packing_note" rows="4" placeholder="Add an optional note to print on the packing slip."><?php echo esc_textarea($packing_note); ?></textarea>

                            <div class="ssb-packing-note-actions">
                                <button type="button" class="button" id="ssb-save-packing-note">
                                    Save note
                                </button>
                                <span id="ssb-packing-note-status" class="ssb-packing-note-status"></span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="ssb-package-panel" data-ssb-package-panel="carrier" style="display:none;">
                    <div class="ssb-package-helper">
                        Carrier package support will be added in the next phase.
                    </div>
                </div>

                <div class="ssb-package-panel" data-ssb-package-panel="saved" style="display:none;">
                    <div class="ssb-package-helper">
                        Saved package templates will be added in a later phase.
                    </div>
                </div>
            </div>

            <div class="ssb-section">
                <p class="ssb-section-title"><strong>Calculate Rates</strong></p>

                <div class="ssb-rates-toolbar">
                    <button type="button" class="button button-primary" id="ssb-shippo-get-rates" <?php disabled($has_purchased_label); ?> disabled>
                        Fetch Rates
                    </button>

                    <div id="ssb-shippo-feedback" class="ssb-feedback" style="display:none;"></div>
                </div>

                <div id="ssb-shippo-rates" class="ssb-rates">
                    <?php if ($has_purchased_label && !empty($selected_snapshot['service'])) : ?>
                        <p class="description">Selected Shipping Service:</p>

                        <div class="ssb-rate-list ssb-rate-list--wc">
                            <div class="ssb-rate-row ssb-rate-row--wc is-selected is-purchased is-static">
                                <span class="ssb-rate-row__left ssb-rate-row__left--wc">
                                    <?php if (!empty($selected_snapshot['provider_image'])) : ?>
                                        <span class="ssb-rate-row__logo-wrap ssb-rate-row__logo-wrap--wc">
                                            <img class="ssb-rate-row__logo ssb-rate-row__logo--wc" src="<?php echo esc_url($selected_snapshot['provider_image']); ?>" alt="<?php echo esc_attr($selected_snapshot['provider']); ?>">
                                        </span>
                                    <?php else : ?>
                                        <span class="ssb-rate-row__logo-wrap ssb-rate-row__logo-wrap--fallback">
                                            <?php echo esc_html(strtoupper(substr((string) $selected_snapshot['provider'], 0, 1))); ?>
                                        </span>
                                    <?php endif; ?>

                                    <span class="ssb-rate-row__meta ssb-rate-row__meta--wc">
                                        <span class="ssb-rate-row__providerline">
                                            <span class="ssb-rate-row__provider"><?php echo esc_html($selected_snapshot['provider']); ?></span>
                                            <span class="ssb-rate-row__badge ssb-rate-row__badge--purchased">Purchased</span>
                                        </span>
                                        <span class="ssb-rate-row__service"><?php echo esc_html($selected_snapshot['service']); ?></span>
                                    </span>
                                </span>

                                <span class="ssb-rate-row__center ssb-rate-row__center--wc">
                                    <span class="ssb-rate-row__details is-open">
                                        <span class="ssb-rate-row__features">
                                            <?php echo self::render_purchased_option_rows($selected_snapshot, $purchase_snapshot); ?>
                                        </span>
                                    </span>
                                </span>

                                <span class="ssb-rate-row__right ssb-rate-row__right--wc">
                                    <span class="ssb-rate-row__amount ssb-rate-row__amount--wc">
                                        <?php
                                        $display_amount = !empty($selected_snapshot['adjusted_total'])
                                            ? '$' . number_format((float) $selected_snapshot['adjusted_total'], 2)
                                            : esc_html($selected_snapshot['amount'] . ' ' . $selected_snapshot['currency']);
                                        echo $display_amount;
                                        ?>
                                    </span>
                                </span>
                            </div>
                        </div>
                    <?php else : ?>
                        <p class="description">Enter the package details above. Rates will load automatically once the package is valid.</p>
                    <?php endif; ?>
                </div>

                <p <?php echo $has_purchased_label ? 'style="display:none;"' : ''; ?>>
                    <button type="button" class="button button-primary" id="ssb-shippo-buy-label" style="display:none;">
                        Buy Label
                    </button>
                </p>
            </div>

        </div>
        <?php
    }

    /**
     * Determine if we're on a Woo order edit screen.
     *
     * @return bool
     */
    protected static function is_order_edit_screen() {
    if (!is_admin()) {
        return false;
    }

    $screen = function_exists('get_current_screen') ? get_current_screen() : null;

    if (!$screen) {
        return false;
    }

    $screen_id = isset($screen->id) ? (string) $screen->id : '';
    $base      = isset($screen->base) ? (string) $screen->base : '';
    $page      = isset($_GET['page']) ? sanitize_key(wp_unslash($_GET['page'])) : '';
    $action    = isset($_GET['action']) ? sanitize_key(wp_unslash($_GET['action'])) : '';

    $valid_ids = array_filter(array(
        'shop_order',
        function_exists('wc_get_page_screen_id') ? wc_get_page_screen_id('shop-order') : '',
        'woocommerce_page_wc-orders',
    ));

    if (in_array($screen_id, $valid_ids, true)) {
        return true;
    }

    if ($page === 'wc-orders' && $action === 'edit') {
        return true;
    }

    if ($base === 'woocommerce_page_wc-orders') {
        return true;
    }

    return false;
}

    /**
     * Resolve current order ID from request.
     *
     * @return int
     */
    protected static function get_current_order_id() {
        if (isset($_GET['id'])) {
            return absint($_GET['id']);
        }

        if (isset($_GET['post'])) {
            return absint($_GET['post']);
        }

        if (function_exists('wc_get_page_screen_id')) {
            $screen = get_current_screen();
            if ($screen && $screen->id === wc_get_page_screen_id('shop-order')) {
                if (isset($_GET['id'])) {
                    return absint($_GET['id']);
                }
            }
        }

        return 0;
    }

    /**
     * Resolve an order object from metabox callback input.
     *
     * @param mixed $post_or_order_object
     * @return WC_Order|false
     */
    protected static function resolve_order_object($post_or_order_object) {
        if ($post_or_order_object instanceof WC_Order) {
            return $post_or_order_object;
        }

        if ($post_or_order_object instanceof WP_Post) {
            return wc_get_order($post_or_order_object->ID);
        }

        if (is_numeric($post_or_order_object)) {
            return wc_get_order(absint($post_or_order_object));
        }

        return false;
    }
}