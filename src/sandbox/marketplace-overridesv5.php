<?php
add_action('wp', function () {
  if (is_admin() || wp_doing_ajax()) return;

  if (!function_exists('is_checkout') || !is_checkout()) return;
  if (is_user_logged_in()) return;
  if (!WC()->cart) return;

  // If cart total is zero, require login
  if ((float) WC()->cart->get_total('edit') <= 0) {
    wp_safe_redirect(home_url('/login/?redirect_to=' . rawurlencode(wc_get_checkout_url())));
    exit;
  }
});

add_action('woocommerce_no_products_found', function () {
  echo '<div class="shoshin-no-results-message">
    <h3>No products match your current filters.</h3>
    <p>Try widening your price range or clearing one or more filters.</p>
  </div>';
});

add_filter('woocommerce_sale_flash', 'shoshin_change_sale_text', 20, 3);

function shoshin_change_sale_text($html, $post, $product) {
    return '<span class="onsale">On Sale!</span>';
}

add_action('woocommerce_before_shop_loop_item_title', 'shoshin_featured_archive_badge', 6);

function shoshin_featured_archive_badge() {
    global $product;

    if (!$product || !is_a($product, 'WC_Product')) {
        return;
    }

    /* Only show on product archive / shop loops */
    if (!is_shop() && !is_product_taxonomy() && !is_product_category() && !is_product_tag()) {
        return;
    }

    /* Show FEATURED only when product is featured and not on sale */
    if ($product->is_featured() && !$product->is_on_sale()) {
        echo '<span class="shoshin-featured-badge">Featured</span>';
    }
}

add_action('woocommerce_after_shop_loop_item_title', 'shoshin_archive_unrated_placeholder', 4);

function shoshin_archive_unrated_placeholder() {
    global $product;

    if (!$product || !is_a($product, 'WC_Product')) {
        return;
    }

    /* Only affect archive / loop contexts */
    if (!is_shop() && !is_product_taxonomy() && !is_product_category() && !is_product_tag()) {
        return;
    }

    /* If no reviews / no average rating, show placeholder */
    if ((int) $product->get_review_count() === 0 || (float) $product->get_average_rating() <= 0) {
        echo '<div class="shoshin-unrated-placeholder">Not yet rated</div>';
    }
}

add_action('woocommerce_after_shop_loop_item_title', 'shoshin_archive_review_meta', 6);

function shoshin_archive_review_meta() {
    global $product;

    if (!$product || !is_a($product, 'WC_Product')) {
        return;
    }

    if (!is_shop() && !is_product_taxonomy() && !is_product_category() && !is_product_tag()) {
        return;
    }

    $review_count = (int) $product->get_review_count();
    $average      = (float) $product->get_average_rating();

    if ($review_count > 0 && $average > 0) {
        $meta_text = '(' . $review_count . ')';

        $reviews = get_comments(array(
            'post_id' => $product->get_id(),
            'status'  => 'approve',
            'number'  => 1,
            'type'    => 'review',
            'orderby' => 'comment_date_gmt',
            'order'   => 'DESC'
        ));

        if (!empty($reviews)) {
            $reviewer = esc_html($reviews[0]->comment_author);
            $meta_text .= ' By ' . $reviewer;
        }

        echo '<span class="shoshin-review-meta">' . $meta_text . '</span>';
    }
}


add_filter('woocommerce_get_price_html', 'shoshin_marketplace_price_html', 20, 2);

function shoshin_has_annual_membership_discount() {
    /*
     * Annual membership = level 3
     * Gracefully fails closed if PMPro is unavailable
     */
    return function_exists('pmpro_hasMembershipLevel')
        && is_user_logged_in()
        && pmpro_hasMembershipLevel(3);
}

function shoshin_format_savings_text($amount, $percent, $prefix = 'You Save') {
    if ($percent <= 0) {
        return '';
    }

    return $prefix . ' ' . $percent . '%';
}

function shoshin_format_member_teaser_text($amount, $percent = 10, $is_additional = false, $is_range = false) {
    if ($percent <= 0) {
        return '';
    }

    $membership_link = '<a href="/membership">Annual Members</a>';

    if ($is_range) {
        return $membership_link . ' save ' . $percent . '% on this item';
    }

    if ($is_additional) {
        return $membership_link . ' save an additional ' . $percent . '% off the sale price';
    }

    return $membership_link . ' save ' . $percent . '% on this item';
}

function shoshin_marketplace_price_html($price_html, $product) {

    if ((is_admin() && !wp_doing_ajax()) || !$product || !is_a($product, 'WC_Product')) {
        return $price_html;
    }

    $regular_raw = $product->get_regular_price();
    $sale_raw    = $product->get_sale_price();
    $current_raw = $product->get_price();

    if ($regular_raw === '' && $current_raw === '') {
        return $price_html;
    }

    $regular = ($regular_raw !== '') ? (float) $regular_raw : 0.0;
    $sale    = ($sale_raw !== '') ? (float) $sale_raw : 0.0;
    $current = ($current_raw !== '') ? (float) $current_raw : 0.0;

    if ($regular <= 0 && $current <= 0) {
        return $price_html;
    }

    /*
     * SINGLE PRODUCT VIEW — VARIABLE PRODUCT TOP PRICE WIDGET
     *
     * Default / unresolved state:
     * - Guest / Free = Regular Price + member teaser
     * - Annual Member = Membership Discount + current/member range + struck regular range
     *
     * Once a specific variation is selected, JS swaps this whole block
     * with that variation's resolved price_html.
     */
    if (is_product() && $product->is_type('variable')) {
        $min_regular = (float) $product->get_variation_regular_price('min', true);
        $max_regular = (float) $product->get_variation_regular_price('max', true);
        $min_current = (float) $product->get_variation_price('min', true);
        $max_current = (float) $product->get_variation_price('max', true);

        if ($min_regular > 0 && $max_regular > 0) {
            $regular_range_html = '';
            $current_range_html = '';

            if ((float) $min_regular === (float) $max_regular) {
                $regular_range_html = wc_price($min_regular);
            } else {
                $regular_range_html = wc_price($min_regular) . ' – ' . wc_price($max_regular);
            }

            if ($min_current > 0 && $max_current > 0) {
                if ((float) $min_current === (float) $max_current) {
                    $current_range_html = wc_price($min_current);
                } else {
                    $current_range_html = wc_price($min_current) . ' – ' . wc_price($max_current);
                }
            }

            if (
                shoshin_has_annual_membership_discount()
                && $current_range_html
                && ($min_current < $min_regular || $max_current < $max_regular)
            ) {
                return '
                <div class="shoshin-price-block shoshin-price-block--variable-range-member">
                    <div class="shoshin-price-label">Membership Discount</div>
                    <div class="shoshin-price-row">
                        <span class="shoshin-price-final shoshin-price-final--member">' . $current_range_html . '</span>
                        <del class="shoshin-price-regular">' . $regular_range_html . '</del>
                    </div>
                </div>';
            }

            $teaser_amount  = $max_regular * 0.10;
            $teaser_percent = 10;
            $teaser_text    = shoshin_format_member_teaser_text($teaser_amount, $teaser_percent, false, true);

            return '
            <div class="shoshin-price-block shoshin-price-block--variable-range">
                <div class="shoshin-price-label">Regular Price</div>
                <div class="shoshin-price-final shoshin-price-final--standard">' . $regular_range_html . '</div>
                <div class="shoshin-price-savings shoshin-price-member-teaser">' . $teaser_text . '</div>
            </div>';
        }

        return $price_html;
    }

    $sale_active            = ($regular > 0 && $sale > 0 && $sale < $regular);
    $annual_member_discount = shoshin_has_annual_membership_discount();

    /*
     * Membership discount is only considered "display active"
     * when the annual member's current price is lower than the
     * relevant public-facing comparison price.
     *
     * If sale exists -> compare current to sale
     * If no sale     -> compare current to regular
     */
    $member_compare_price = $sale_active ? $sale : $regular;
    $member_discount_active = (
        $annual_member_discount
        && $member_compare_price > 0
        && $current < $member_compare_price
    );

    /*
     * ARCHIVE / LOOP VIEW
     * Keep this simple and consistent with current archive styling.
     *
     * But do NOT use archive markup during Woo variation AJAX responses.
     */
    if (!is_product() && !wp_doing_ajax()) {
        $archive_final_price = wc_price($current);
        $archive_original    = wc_price($regular);
        $archive_percent     = ($regular > 0 && $current < $regular)
            ? round((($regular - $current) / $regular) * 100)
            : 0;

        $html = '<ins>' . $archive_final_price . '</ins>';

        if ($archive_percent > 0) {
            $html .= ' <del>' . $archive_original . '</del>';
            $html .= ' <span class="shoshin-sale-percent">(Save ' . $archive_percent . '%)</span>';
        }

        return '<span class="price">' . $html . '</span>';
    }

    /*
     * SINGLE PRODUCT VIEW
     * Render the richer 4-state price block.
     */
    $regular_html = wc_price($regular);
    $sale_html    = ($sale > 0) ? wc_price($sale) : '';
    $current_html = wc_price($current);

    $sale_amount = ($sale_active && $regular > 0)
        ? round(($regular - $current), wc_get_price_decimals())
        : 0;

    $sale_percent = ($sale_active && $regular > 0)
        ? round((($regular - $current) / $regular) * 100)
        : 0;

    $member_amount = (!$sale_active && $member_discount_active && $regular > 0)
        ? round(($regular - $current), wc_get_price_decimals())
        : 0;

    $member_percent = (!$sale_active && $member_discount_active && $regular > 0)
        ? round((($regular - $current) / $regular) * 100)
        : 0;

    $total_amount = ($member_discount_active && $regular > 0)
        ? round(($regular - $current), wc_get_price_decimals())
        : 0;

    $total_percent = ($member_discount_active && $regular > 0)
        ? round((($regular - $current) / $regular) * 100)
        : 0;

    $guest_member_amount  = $current * 0.10;
    $guest_member_percent = 10;

    /*
     * STATE 1: REGULAR
     * No sale + no membership discount
     */
    if (!$sale_active && !$member_discount_active) {
        $teaser_html = '';

        if (!shoshin_has_annual_membership_discount()) {
            $teaser_html = '<div class="shoshin-price-savings shoshin-price-member-teaser">' . shoshin_format_member_teaser_text($guest_member_amount, $guest_member_percent, false, false) . '</div>';
        }

        return '
        <div class="shoshin-price-block shoshin-price-block--regular">
            <div class="shoshin-price-label">Regular Price</div>
            <div class="shoshin-price-final shoshin-price-final--standard">' . $current_html . '</div>
            ' . $teaser_html . '
        </div>';
    }

    /*
     * STATE 2: SALE ONLY
     * Sale + no membership discount
     */
    if ($sale_active && !$member_discount_active) {
        $teaser_html = '';

        if (!shoshin_has_annual_membership_discount()) {
            $teaser_html = '<div class="shoshin-price-savings shoshin-price-member-teaser">' . shoshin_format_member_teaser_text($guest_member_amount, $guest_member_percent, true, false) . '</div>';
        }

        return '
        <div class="shoshin-price-block shoshin-price-block--sale-only">
            <div class="shoshin-price-label">Sale Price</div>
            <div class="shoshin-price-row">
                <span class="shoshin-price-final shoshin-price-final--standard">' . $current_html . '</span>
                <del class="shoshin-price-regular">' . $regular_html . '</del>
            </div>
            ' . $teaser_html . '
        </div>';
    }

    /*
     * STATE 3: MEMBER ONLY
     * No sale + membership discount
     */
    if (!$sale_active && $member_discount_active) {
        return '
        <div class="shoshin-price-block shoshin-price-block--member-only">
            <div class="shoshin-price-label">Membership Discount</div>
            <div class="shoshin-price-row">
                <span class="shoshin-price-final shoshin-price-final--member">' . $current_html . '</span>
                <del class="shoshin-price-regular">' . $regular_html . '</del>
            </div>
            <div class="shoshin-price-savings">' . shoshin_format_savings_text($member_amount, $member_percent, 'You Save') . '</div>
        </div>';
    }

    /*
     * STATE 4: MEMBER + SALE
     * Sale active + membership discount applied on top of sale
     */
    return '
    <div class="shoshin-price-block shoshin-price-block--member-sale">
        <div class="shoshin-price-top">
            <div class="shoshin-price-col shoshin-price-col--member">
                <div class="shoshin-price-label">Membership Discount</div>
                <div class="shoshin-price-final shoshin-price-final--member">' . $current_html . '</div>
            </div>

            <div class="shoshin-price-divider" aria-hidden="true"></div>

            <div class="shoshin-price-col shoshin-price-col--sale">
                <div class="shoshin-price-label">Sale Price</div>
                <div class="shoshin-price-row">
                    <span class="shoshin-price-secondary">' . $sale_html . '</span>
                    <del class="shoshin-price-regular">' . $regular_html . '</del>
                </div>
            </div>
        </div>

        <div class="shoshin-price-savings">' . shoshin_format_savings_text($total_amount, $total_percent, 'Total Savings') . '</div>
    </div>';
}

add_shortcode('shoshin_single_rating', 'shoshin_single_rating_shortcode');

function shoshin_single_rating_shortcode() {
    if (!function_exists('is_product') || !is_product()) {
        return '';
    }

    global $product;

    if (!$product || !is_a($product, 'WC_Product')) {
        return '';
    }

    $review_count = (int) $product->get_review_count();
    $average      = (float) $product->get_average_rating();

    if ($review_count > 0 && $average > 0) {
        $rating_html = wc_get_rating_html($average, $review_count);

        return '<div class="woocommerce-product-rating shoshin-single-rating-wrap">'
            . $rating_html .
            '<a href="#reviews" class="woocommerce-review-link" rel="nofollow">(<span class="count">' . $review_count . '</span> customer reviews)</a>'
            . '</div>';
    }

    return '<div class="woocommerce-product-rating shoshin-single-rating-wrap shoshin-single-rating-empty">☆☆☆☆☆ Not yet rated</div>';
}

/* =========================================================
 * SHOSHIN — ATTRIBUTE-DRIVEN SINGLE PRODUCT STOCK / STATUS
 *
 * Uses:
 * - pa_fulfillment
 * - pa_estimated-delivery
 *
 * Fulfillment mapping:
 * - Pre-Order     => Pre-Orders Open
 * - Made-to-Order => Available to Purchase
 * - Immediate     => In Stock
 *
 * Fallbacks:
 * - Status: In Stock
 * - Delivery: 1 Week
 * ========================================================= */

/**
 * Get a readable product attribute value by taxonomy slug.
 * Example taxonomy slugs:
 * - pa_fulfillment
 * - pa_estimated-delivery
 */
function shoshin_get_product_attribute_label($product, $taxonomy) {
    if (!$product || !is_a($product, 'WC_Product')) {
        return '';
    }

    $product_id = $product->get_id();

    // Taxonomy-based product attributes
    if (taxonomy_exists($taxonomy)) {
        $terms = wc_get_product_terms($product_id, $taxonomy, array('fields' => 'names'));
        if (!empty($terms) && !is_wp_error($terms)) {
            return trim((string) $terms[0]);
        }
    }

    // Fallback for custom/non-taxonomy attributes
    $raw = $product->get_attribute($taxonomy);
    if (!empty($raw)) {
        $parts = array_map('trim', explode(',', $raw));
        if (!empty($parts[0])) {
            return $parts[0];
        }
    }

    return '';
}

/**
 * Map fulfillment attribute -> front-end status label
 */
function shoshin_map_fulfillment_to_status($product, $fulfillment_label) {
    $value = strtolower(trim((string) $fulfillment_label));

    $is_unavailable = false;

    if ($product && is_a($product, 'WC_Product')) {
        /*
         * SHOSHIN rule:
         * If managed stock is 0 or less, treat as unavailable
         * regardless of Woo backorder setting.
         */
        if ($product->managing_stock()) {
            $qty = $product->get_stock_quantity();

            if ($qty !== null && (int) $qty <= 0) {
                $is_unavailable = true;
            }
        } elseif (!$product->is_in_stock()) {
            $is_unavailable = true;
        }
    }

    if ($is_unavailable) {
        if ($value === 'immediate') {
            return 'Out of Stock';
        }

        if (
            $value === 'made-to-order' ||
            $value === 'made to order' ||
            $value === 'pre-order' ||
            $value === 'preorder'
        ) {
            return 'Currently Unavailable';
        }

        return 'Out of Stock';
    }

    if ($value === 'pre-order' || $value === 'preorder') {
        return 'Pre-Orders Open';
    }

    if ($value === 'made-to-order' || $value === 'made to order') {
        return 'Available to Purchase';
    }

    if ($value === 'immediate') {
        return 'In Stock';
    }

    return 'In Stock';
}

/**
 * Convert status label -> CSS modifier
 */
function shoshin_status_modifier_from_label($label) {
    $label = strtolower(trim((string) $label));

    if ($label === 'pre-orders open') {
        return 'preorders-open';
    }

    if ($label === 'available to purchase') {
        return 'available-to-purchase';
    }

    if ($label === 'currently unavailable') {
        return 'currently-unavailable';
    }

    if ($label === 'out of stock') {
        return 'out-of-stock';
    }

    return 'in-stock';
}

/**
 * Replace native Woo stock HTML above Add to Cart on single product pages
 */
add_filter('woocommerce_get_stock_html', 'shoshin_attribute_driven_stock_html', 20, 2);

function shoshin_attribute_driven_stock_html($html, $product) {
    if (is_admin()) {
        return $html;
    }

    if (!function_exists('is_product') || !is_product()) {
        return $html;
    }

    if (!$product || !is_a($product, 'WC_Product')) {
        return $html;
    }

    $stock_product = $product;
    $attribute_product = $product;

    /*
     * For variations:
     * - stock status should come from the actual selected variation
     * - fulfillment / delivery can fall back to parent product attributes
     */
    if ($product->is_type('variation')) {
        $parent_id = $product->get_parent_id();
        if ($parent_id) {
            $parent_product = wc_get_product($parent_id);
            if ($parent_product && is_a($parent_product, 'WC_Product')) {
                $attribute_product = $parent_product;
            }
        }
    }

    $fulfillment = shoshin_get_product_attribute_label($attribute_product, 'pa_fulfillment');
    $delivery    = shoshin_get_product_attribute_label($attribute_product, 'pa_estimated-delivery');

    $status_label = shoshin_map_fulfillment_to_status($stock_product, $fulfillment);

    if (empty($delivery)) {
        $delivery = '1 Week';
    }

    $delivery_prefix = 'Estimated Delivery';

    if (strtolower(trim((string) $fulfillment)) === 'pre-order' || strtolower(trim((string) $fulfillment)) === 'preorder') {
        $delivery_prefix = 'Fulfillment';
    }

    $status_mod = shoshin_status_modifier_from_label($status_label);

    $output  = '<div class="stock shoshin-stock-status shoshin-stock-status--' . esc_attr($status_mod) . '">';
    $output .= '<div class="shoshin-stock-status__label">' . esc_html($status_label) . '</div>';
    $output .= '<div class="shoshin-stock-status__subtext"><span class="shoshin-stock-status__truck" aria-hidden="true">🚚</span><span class="shoshin-stock-status__subtext-label">' . esc_html($delivery_prefix) . '</span> <span class="shoshin-stock-status__subtext-value">' . esc_html($delivery) . '</span></div>';
    $output .= '</div>';

    return $output;
}