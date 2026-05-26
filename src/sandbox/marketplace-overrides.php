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

add_filter('woocommerce_get_price_html', 'shoshin_archive_append_sale_percent_to_price', 20, 2);

function shoshin_archive_append_sale_percent_to_price($price_html, $product) {
    if (!$product || !is_a($product, 'WC_Product')) {
        return $price_html;
    }

    /* Only affect archive / loop contexts */
    if (!is_shop() && !is_product_taxonomy() && !is_product_category() && !is_product_tag()) {
        return $price_html;
    }

    if (!$product->is_on_sale()) {
        return $price_html;
    }

    $regular_price = (float) $product->get_regular_price();
    $sale_price    = (float) $product->get_sale_price();

    if ($regular_price <= 0 || $sale_price <= 0 || $sale_price >= $regular_price) {
        return $price_html;
    }

    $percent_off = round((($regular_price - $sale_price) / $regular_price) * 100);

    return $price_html . ' <span class="shoshin-sale-percent">(' . $percent_off . '% off)</span>';
}

add_action('woocommerce_after_shop_loop_item_title', 'shoshin_archive_member_discount_pricing_row', 12);

function shoshin_archive_member_discount_pricing_row() {
    if (!function_exists('pmpro_hasMembershipLevel')) {
        return;
    }

    global $product;

    if (!$product || !is_a($product, 'WC_Product')) {
        return;
    }

    /* Archive/shop contexts only */
    if (!is_shop() && !is_product_taxonomy() && !is_product_category() && !is_product_tag()) {
        return;
    }

    /*
     * Annual / Contributor PMPro level.
     * Change this only if your Annual level ID is not 3.
     */
    $annual_level_id = 3;

    if (!is_user_logged_in() || !pmpro_hasMembershipLevel($annual_level_id)) {
        return;
    }

    $regular_price = (float) $product->get_regular_price();
    $sale_price    = (float) $product->get_sale_price();
    $current_price = (float) $product->get_price(); /* already member-adjusted in your current setup */

    if ($regular_price <= 0 || $current_price <= 0) {
        return;
    }

    $is_sale = $product->is_on_sale() && $sale_price > 0 && $regular_price > $sale_price;

    echo '<div class="shoshin-member-pricing-row ' . ($is_sale ? 'is-sale' : 'is-regular') . '">';
    echo '<div class="shoshin-member-pricing-label">Member Discount Pricing:</div>';

    if ($is_sale) {
        /*
         * SALE ACTIVE:
         * Main/public row already shows sale vs regular
         * Member row should show member-final vs public sale price
         */
        $member_price = round($sale_price * 0.90, wc_get_price_decimals());

        echo '<div class="shoshin-member-pricing-values">';
        echo '<ins class="shoshin-member-price-final">' . wc_price($member_price) . '</ins> ';
        echo '<del class="shoshin-member-price-original">' . wc_price($sale_price) . '</del> ';
        echo '<span class="shoshin-member-price-percent">(10% off)</span>';
        echo '</div>';
    } else {
        /*
         * NO SALE ACTIVE:
         * Current displayed price is already the member price
         * Show member price vs regular price only
         */
        echo '<div class="shoshin-member-pricing-values">';
        echo '<ins class="shoshin-member-price-final">' . wc_price($current_price) . '</ins> ';
        echo '<del class="shoshin-member-price-original">' . wc_price($regular_price) . '</del> ';
        echo '<span class="shoshin-member-price-percent">(10% off)</span>';
        echo '</div>';
    }

    echo '</div>';
}

add_filter('woocommerce_get_price_html', 'shoshin_archive_hide_public_price_for_annual_members_on_non_sale', 30, 2);

function shoshin_archive_hide_public_price_for_annual_members_on_non_sale($price_html, $product) {
    if (!function_exists('pmpro_hasMembershipLevel')) {
        return $price_html;
    }

    if (!$product || !is_a($product, 'WC_Product')) {
        return $price_html;
    }

    /* Archive/shop contexts only */
    if (!is_shop() && !is_product_taxonomy() && !is_product_category() && !is_product_tag()) {
        return $price_html;
    }

    /*
     * Annual / Contributor PMPro level.
     * Change only if your Annual level ID is not 3.
     */
    $annual_level_id = 3;

    if (!is_user_logged_in() || !pmpro_hasMembershipLevel($annual_level_id)) {
        return $price_html;
    }

    $regular_price = (float) $product->get_regular_price();
    $sale_price    = (float) $product->get_sale_price();
    $is_sale       = $product->is_on_sale() && $sale_price > 0 && $regular_price > $sale_price;

    /* Hide normal/public price row only when NO sale is active */
    if (!$is_sale) {
        return '';
    }

    return $price_html;
}