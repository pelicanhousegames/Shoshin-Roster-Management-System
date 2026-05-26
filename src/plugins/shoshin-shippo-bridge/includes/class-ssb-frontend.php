<?php
if (!defined('ABSPATH')) {
    exit;
}

class SSB_Frontend {

public static function init() {
    add_action('woocommerce_order_details_after_order_table', array(__CLASS__, 'render_tracking_block'), 20);

    add_filter(
        'woocommerce_loop_add_to_cart_link',
        array(__CLASS__, 'filter_single_variation_loop_add_to_cart_link'),
        20,
        3
    );

    add_action(
        'wp_enqueue_scripts',
        array(__CLASS__, 'enqueue_single_variation_direct_add_dependencies'),
        20
    );
}

protected static function get_single_variation_direct_add_variation($product) {
    if (!class_exists('SSB_Settings') || !SSB_Settings::is_single_variation_direct_add_enabled()) {
        return null;
    }

    if (!$product || !is_a($product, 'WC_Product') || !$product->is_type('variable')) {
        return null;
    }

    $available_variations = $product->get_available_variations();

    if (!is_array($available_variations) || count($available_variations) !== 1) {
        return null;
    }

    $variation_data = $available_variations[0];

    if (empty($variation_data['variation_id']) || empty($variation_data['is_purchasable'])) {
        return null;
    }

    $variation_id = absint($variation_data['variation_id']);

    if ($variation_id < 1) {
        return null;
    }

    $variation_product = wc_get_product($variation_id);

    if (
        !$variation_product
        || !$variation_product->is_type('variation')
        || (int) $variation_product->get_parent_id() !== (int) $product->get_id()
        || !$variation_product->is_purchasable()
        || !$variation_product->is_in_stock()
    ) {
        return null;
    }

    return $variation_product;
}

public static function filter_single_variation_loop_add_to_cart_link($html, $product, $args) {
    $variation_product = self::get_single_variation_direct_add_variation($product);

    if (!$variation_product) {
        return $html;
    }

    $classes = isset($args['class']) ? (string) $args['class'] : 'button';
    $classes = preg_replace('/\bproduct_type_variable\b/', '', $classes);
    $classes = trim($classes . ' product_type_variation product_type_simple add_to_cart_button ajax_add_to_cart ssb-single-variation-direct-add');

    $quantity = isset($args['quantity']) ? wc_stock_amount($args['quantity']) : 1;
    if ($quantity < 1) {
        $quantity = 1;
    }

    $attributes = isset($args['attributes']) && is_array($args['attributes']) ? $args['attributes'] : array();

    $attributes['data-quantity']          = (string) $quantity;
    $attributes['data-product_id']        = (string) $variation_product->get_id();
    $attributes['data-product_sku']       = (string) $variation_product->get_sku();
    $attributes['data-parent_product_id'] = (string) $product->get_id();
    $attributes['aria-label']             = $variation_product->add_to_cart_description();
    $attributes['rel']                    = 'nofollow';

    if ('yes' !== get_option('woocommerce_cart_redirect_after_add', 'no')) {
        $attributes['role'] = 'button';
    }

    $aria_describedby = isset($args['aria-describedby_text'])
        ? sprintf(
            'aria-describedby="woocommerce_loop_add_to_cart_link_describedby_%s"',
            esc_attr($product->get_id())
        )
        : '';

    return sprintf(
        '<a href="%1$s" %2$s class="%3$s" %4$s>%5$s</a>',
        esc_url($variation_product->add_to_cart_url()),
        $aria_describedby,
        esc_attr($classes),
        wc_implode_html_attributes($attributes),
        esc_html__('Add to cart', 'woocommerce')
    );
}

public static function enqueue_single_variation_direct_add_dependencies() {
    if (is_admin()) {
        return;
    }

    if (!class_exists('SSB_Settings') || !SSB_Settings::is_single_variation_direct_add_enabled()) {
        return;
    }

    wp_enqueue_script('woocommerce');
    wp_enqueue_script('wc-add-to-cart');
    wp_enqueue_script('wc-cart-fragments');
}

    /**
     * Render customer-facing tracking block on the order page.
     *
     * @param WC_Order $order
     * @return void
     */
    public static function render_tracking_block($order) {
        if (!$order || !is_a($order, 'WC_Order')) {
            return;
        }

        $order_id = $order->get_id();

        $tracking_number        = (string) get_post_meta($order_id, '_shoshin_shippo_tracking_number', true);
        $tracking_status        = (string) get_post_meta($order_id, '_shoshin_shippo_tracking_status', true);
        $carrier                = (string) get_post_meta($order_id, '_shoshin_shippo_carrier', true);
        $service                = (string) get_post_meta($order_id, '_shoshin_shippo_service', true);
        $label_url              = (string) get_post_meta($order_id, '_shoshin_shippo_label_url', true);
        $tracking_url           = (string) get_post_meta($order_id, '_shoshin_shippo_tracking_url', true);

        $return_tracking_number = (string) get_post_meta($order_id, '_shoshin_shippo_return_tracking_number', true);
        $return_tracking_status = (string) get_post_meta($order_id, '_shoshin_shippo_return_tracking_status', true);
        $return_carrier         = (string) get_post_meta($order_id, '_shoshin_shippo_return_carrier', true);
        $return_service         = (string) get_post_meta($order_id, '_shoshin_shippo_return_service', true);
        $return_label_url       = (string) get_post_meta($order_id, '_shoshin_shippo_return_label_url', true);
        $return_tracking_url    = (string) get_post_meta($order_id, '_shoshin_shippo_return_tracking_url', true);

        $has_outbound = ($tracking_number !== '' || $label_url !== '');
        $has_return   = ($return_tracking_number !== '' || $return_label_url !== '');

        if (!$has_outbound && !$has_return) {
            return;
        }

        echo '<section class="woocommerce-order-details ssb-order-tracking">';
        echo '<h2 class="woocommerce-order-details__title">Shipment Tracking</h2>';
        echo '<div class="ssb-order-tracking__content">';

        if ($has_outbound) {
            echo '<div class="ssb-order-tracking__group ssb-order-tracking__group--outbound">';

            if ($carrier) {
                echo '<p><strong>Carrier:</strong> ' . esc_html($carrier) . '</p>';
            }

            if ($service) {
                echo '<p><strong>Service:</strong> ' . esc_html($service) . '</p>';
            }

            if ($tracking_number) {
                if (!$tracking_url) {
                    if ($carrier && strtolower($carrier) === 'usps') {
                        $tracking_url = 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' . urlencode($tracking_number);
                    } else {
                        $tracking_url = 'https://track.goshippo.com/track/' . urlencode($tracking_number);
                    }
                }

                echo '<p><strong>Tracking Number:</strong> ';

                if ($tracking_url) {
                    echo '<a href="' . esc_url($tracking_url) . '" target="_blank" rel="noopener noreferrer">'
                        . esc_html($tracking_number)
                        . '</a>';
                } else {
                    echo esc_html($tracking_number);
                }

                echo '</p>';
            }

            if ($tracking_status) {
                echo '<p><strong>Status:</strong> ' . esc_html($tracking_status) . '</p>';
            }

            if ($label_url) {
                echo '<p><a class="button" href="' . esc_url($label_url) . '" target="_blank" rel="noopener noreferrer">View Shipping Label</a></p>';
            }

            echo '</div>';
        }

        if ($has_return) {
            if ($has_outbound) {
                echo '<hr>';
            }

            echo '<div class="ssb-order-tracking__group ssb-order-tracking__group--return">';
            echo '<p><strong>Return Label:</strong> Active</p>';

            if ($return_carrier) {
                echo '<p><strong>Return Carrier:</strong> ' . esc_html($return_carrier) . '</p>';
            }

            if ($return_service) {
                echo '<p><strong>Return Service:</strong> ' . esc_html($return_service) . '</p>';
            }

            if ($return_tracking_number) {
                echo '<p><strong>Return Tracking Number:</strong> ';

                if ($return_tracking_url) {
                    echo '<a href="' . esc_url($return_tracking_url) . '" target="_blank" rel="noopener noreferrer">'
                        . esc_html($return_tracking_number)
                        . '</a>';
                } else {
                    echo esc_html($return_tracking_number);
                }

                echo '</p>';
            }

            if ($return_tracking_status) {
                echo '<p><strong>Return Status:</strong> ' . esc_html($return_tracking_status) . '</p>';
            }

            if ($return_label_url) {
                echo '<p><a class="button" href="' . esc_url($return_label_url) . '" target="_blank" rel="noopener noreferrer">View Return Label</a></p>';
            }

            echo '</div>';
        }

        echo '</div>';
        echo '</section>';
    }
}