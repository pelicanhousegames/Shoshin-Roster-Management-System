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

/* =========================================================
 * SHOSHIN — AFFILIATE PRODUCT ADMIN FIELDS
 * Adds stable product-level fields for external / affiliate products.
 * Shown in Product Data > General and only visible for External products.
 * ========================================================= */

add_action('woocommerce_product_options_general_product_data', 'shoshin_affiliate_product_admin_fields');

function shoshin_affiliate_product_admin_fields() {
    echo '<div class="options_group show_if_external">';

    woocommerce_wp_text_input(array(
        'id'                => '_shoshin_affiliate_price_min',
        'label'             => 'Affiliate Price Min',
        'desc_tip'          => true,
        'description'       => 'Lowest acceptable affiliate price shown on the single product page.',
        'type'              => 'text',
        'data_type'         => 'price',
        'placeholder'       => '29.99',
    ));

    woocommerce_wp_text_input(array(
        'id'                => '_shoshin_affiliate_price_max',
        'label'             => 'Affiliate Price Max',
        'desc_tip'          => true,
        'description'       => 'Highest acceptable affiliate price shown on the single product page.',
        'type'              => 'text',
        'data_type'         => 'price',
        'placeholder'       => '34.99',
    ));

    woocommerce_wp_text_input(array(
        'id'                => '_shoshin_affiliate_rating',
        'label'             => 'Affiliate Rating',
        'desc_tip'          => true,
        'description'       => 'Manual affiliate rating. Use whole or half-star values such as 4, 4.5, or 5.',
        'type'              => 'text',
        'placeholder'       => '4.5',
    ));

    woocommerce_wp_text_input(array(
        'id'                => '_shoshin_affiliate_review_count',
        'label'             => 'Affiliate Review Count',
        'desc_tip'          => true,
        'description'       => 'Manual review count used for the affiliate rating display. Enter numbers only.',
        'type'              => 'number',
        'custom_attributes' => array(
            'min'  => '0',
            'step' => '1',
        ),
        'placeholder'       => '300',
    ));

    echo '</div>';
}

add_action('woocommerce_process_product_meta', 'shoshin_save_affiliate_product_admin_fields');

function shoshin_save_affiliate_product_admin_fields($post_id) {
    $product = wc_get_product($post_id);

    if (!$product || !is_a($product, 'WC_Product')) {
        return;
    }

    /*
     * Save fields for any product type, but they are only displayed
     * in admin for External products via show_if_external.
     */

    if (isset($_POST['_shoshin_affiliate_price_min'])) {
        $value = wc_format_decimal(wp_unslash($_POST['_shoshin_affiliate_price_min']));
        if ($value === '') {
            delete_post_meta($post_id, '_shoshin_affiliate_price_min');
        } else {
            update_post_meta($post_id, '_shoshin_affiliate_price_min', $value);
        }
    }

    if (isset($_POST['_shoshin_affiliate_price_max'])) {
        $value = wc_format_decimal(wp_unslash($_POST['_shoshin_affiliate_price_max']));
        if ($value === '') {
            delete_post_meta($post_id, '_shoshin_affiliate_price_max');
        } else {
            update_post_meta($post_id, '_shoshin_affiliate_price_max', $value);
        }
    }

    if (isset($_POST['_shoshin_affiliate_rating'])) {
        $raw   = trim(wp_unslash($_POST['_shoshin_affiliate_rating']));
        $value = ($raw === '') ? '' : (string) wc_format_decimal($raw);

        if ($value === '') {
            delete_post_meta($post_id, '_shoshin_affiliate_rating');
        } else {
            update_post_meta($post_id, '_shoshin_affiliate_rating', $value);
        }
    }

    if (isset($_POST['_shoshin_affiliate_review_count'])) {
        $raw   = wp_unslash($_POST['_shoshin_affiliate_review_count']);
        $value = ($raw === '' || $raw === null) ? '' : absint($raw);

        if ($value === '') {
            delete_post_meta($post_id, '_shoshin_affiliate_review_count');
        } else {
            update_post_meta($post_id, '_shoshin_affiliate_review_count', $value);
        }
    }
}

/* =========================================================
 * SHOSHIN — AFFILIATE PRODUCT DISPLAY HELPERS
 * ========================================================= */

function shoshin_get_affiliate_display_data($product) {
    if (!$product || !is_a($product, 'WC_Product')) {
        return array(
            'is_external'       => false,
            'price_min'         => '',
            'price_max'         => '',
            'rating'            => '',
            'review_count'      => '',
            'has_price_range'   => false,
            'has_rating_summary'=> false,
        );
    }

    $price_min    = get_post_meta($product->get_id(), '_shoshin_affiliate_price_min', true);
    $price_max    = get_post_meta($product->get_id(), '_shoshin_affiliate_price_max', true);
    $rating       = get_post_meta($product->get_id(), '_shoshin_affiliate_rating', true);
    $review_count = get_post_meta($product->get_id(), '_shoshin_affiliate_review_count', true);

    $price_min_f = ($price_min !== '' && $price_min !== null) ? (float) $price_min : 0.0;
    $price_max_f = ($price_max !== '' && $price_max !== null) ? (float) $price_max : 0.0;
    $rating_f    = ($rating !== '' && $rating !== null) ? (float) $rating : 0.0;
    $count_i     = ($review_count !== '' && $review_count !== null) ? absint($review_count) : 0;

    /*
     * Snap rating to half-star increments and clamp to 0–5.
     */
    if ($rating_f > 0) {
        $rating_f = max(0, min(5, round($rating_f * 2) / 2));
    }

    return array(
        'is_external'        => $product->is_type('external'),
        'price_min'          => $price_min_f,
        'price_max'          => $price_max_f,
        'rating'             => $rating_f,
        'review_count'       => $count_i,
        'has_price_range'    => ($price_min_f > 0 && $price_max_f > 0),
        'has_rating_summary' => ($rating_f > 0 && $count_i > 0),
    );
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

function shoshin_get_pmpro_level_price_for_product($product, $level_id) {
    if (!$product || !is_a($product, 'WC_Product')) {
        return '';
    }

    $level_id = (int) $level_id;
    if ($level_id <= 0) {
        return '';
    }

    $meta_key = '_level_' . $level_id . '_price';

    $value = get_post_meta($product->get_id(), $meta_key, true);

    /*
     * If this is a selected variation and the level-specific price is not
     * stored on the variation itself, fall back to the parent variable product.
     */
    if (($value === '' || $value === null) && $product->is_type('variation')) {
        $parent_id = (int) $product->get_parent_id();

        if ($parent_id > 0) {
            $value = get_post_meta($parent_id, $meta_key, true);
        }
    }

    return $value;
}

function shoshin_current_user_has_nonfree_product_level_override($product) {
    if (!$product || !is_a($product, 'WC_Product')) {
        return false;
    }

    if (!is_user_logged_in() || !function_exists('pmpro_getMembershipLevelForUser')) {
        return false;
    }

    $user_level = pmpro_getMembershipLevelForUser();

    if (!$user_level || empty($user_level->id)) {
        return false;
    }

    $level_id   = (int) $user_level->id;
    $level_name = isset($user_level->name) ? strtolower(trim((string) $user_level->name)) : '';

    if ($level_name === 'free') {
        return false;
    }

    $level_price = shoshin_get_pmpro_level_price_for_product($product, $level_id);

    return !($level_price === '' || $level_price === null);
}

function shoshin_current_user_has_nonfree_product_level_override($product) {
    if (!$product || !is_a($product, 'WC_Product')) {
        return false;
    }

    if (!is_user_logged_in() || !function_exists('pmpro_getMembershipLevelForUser')) {
        return false;
    }

    $user_level = pmpro_getMembershipLevelForUser();

    if (!$user_level || empty($user_level->id)) {
        return false;
    }

    $level_id   = (int) $user_level->id;
    $level_name = isset($user_level->name) ? strtolower(trim((string) $user_level->name)) : '';

    /* Ignore free membership for "membership discount" display states */
    if ($level_name === 'free') {
        return false;
    }

    $level_price = get_post_meta($product->get_id(), '_level_' . $level_id . '_price', true);

    return !($level_price === '' || $level_price === null);
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

    if ($is_additional) {
        return $membership_link . ' save an additional ' . $percent . '% off the sale price';
    }

    if ($is_range) {
        return $membership_link . ' save ' . $percent . '% on this item';
    }

    return $membership_link . ' save ' . $percent . '% on this item';
}

function shoshin_product_is_effectively_zero_for_current_user($product) {
    if (!$product || !is_a($product, 'WC_Product')) {
        return false;
    }

    /*
     * Only suppress product-page express checkout when Woo has already
     * resolved the actual current product price for this request to 0.00.
     *
     * Do NOT infer zero-price state from PMPro per-level metadata here,
     * because that can create false positives and disable express methods
     * on products that are still payable on the current product page.
     */
    $current_raw = $product->get_price();

    if ($current_raw === '' || $current_raw === null) {
        return false;
    }

    return ((float) $current_raw <= 0);
}

function shoshin_marketplace_price_html($price_html, $product) {

if ((is_admin() && !wp_doing_ajax()) || !$product || !is_a($product, 'WC_Product')) {
    return $price_html;
}

$queried_product_id    = is_product() ? absint(get_queried_object_id()) : 0;
$is_main_single_product = (is_product() && $queried_product_id > 0 && (int) $product->get_id() === $queried_product_id);
$is_loop_context       = (!$is_main_single_product && in_the_loop());

$affiliate = shoshin_get_affiliate_display_data($product);

/*
 * External / affiliate products:
 * On the single product page only, use manual affiliate price range
 * when both min/max fields are present.
 */
if (is_product() && $affiliate['is_external'] && $affiliate['has_price_range']) {
    $min_html = wc_price($affiliate['price_min']);
    $max_html = wc_price($affiliate['price_max']);

    $range_html = ((float) $affiliate['price_min'] === (float) $affiliate['price_max'])
        ? $min_html
        : $min_html . ' – ' . $max_html;

    return '
    <div class="shoshin-price-block shoshin-price-block--affiliate">
        <div class="shoshin-price-label">Affiliate Price Range</div>
        <div class="shoshin-price-final shoshin-price-final--standard">' . $range_html . '</div>
        <div class="shoshin-price-savings shoshin-price-savings--affiliate">Membership discounts are not available for this item</div>
    </div>';
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
    if (is_product() && !$is_loop_context && $product->is_type('variable')) {
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

if (shoshin_has_annual_membership_discount()) {

    $has_sale = ($min_current < $min_regular || $max_current < $max_regular);

    $min_member = $min_current * 0.9;
    $max_member = $max_current * 0.9;

    if ((float) $min_member === (float) $max_member) {
        $member_range_html = wc_price($min_member);
    } else {
        $member_range_html = wc_price($min_member) . ' – ' . wc_price($max_member);
    }

    if ($has_sale) {
        return '
        <div class="shoshin-price-block shoshin-price-block--variable-range-member-sale">
            <div class="shoshin-price-label">Membership Discount Range</div>
            <div class="shoshin-price-row">
                <span class="shoshin-price-final shoshin-price-final--member">' . $member_range_html . '</span>
            </div>
            <div class="shoshin-price-savings">You save an additional 10% on this item</div>
        </div>';
    }

    return '
    <div class="shoshin-price-block shoshin-price-block--variable-range-member">
        <div class="shoshin-price-label">Membership Discount Range</div>
        <div class="shoshin-price-row">
            <span class="shoshin-price-final shoshin-price-final--member">' . $member_range_html . '</span>
        </div>
        <div class="shoshin-price-savings">You save 10% on this item</div>
    </div>';
}

            $teaser_amount  = $max_regular * 0.10;
            $teaser_percent = 10;
            $teaser_text    = shoshin_format_member_teaser_text($teaser_amount, $teaser_percent, false, true);

            $has_sale = ($min_current < $min_regular || $max_current < $max_regular);

          if ($has_sale) {

              return '
              <div class="shoshin-price-block shoshin-price-block--variable-range-sale">
                  <div class="shoshin-price-label">Sale Price Range</div>
                  <div class="shoshin-price-final shoshin-price-final--standard">' . $current_range_html . '</div>
                  <div class="shoshin-price-savings shoshin-price-member-teaser">' . shoshin_format_member_teaser_text($teaser_amount, $teaser_percent, true, true) . '</div>
              </div>';
          }

          return '
          <div class="shoshin-price-block shoshin-price-block--variable-range">
              <div class="shoshin-price-label">Regular Price</div>
              <div class="shoshin-price-final shoshin-price-final--standard">' . $regular_range_html . '</div>
              <div class="shoshin-price-savings shoshin-price-member-teaser">' . $teaser_text . '</div>
          </div>';
        }

        return $price_html;
    }

$sale_active                  = ($regular > 0 && $sale > 0 && $sale < $regular);
    $annual_member_discount       = shoshin_has_annual_membership_discount();
    $product_level_member_override = shoshin_current_user_has_nonfree_product_level_override($product);

    /*
     * Membership discount is considered "display active" when the current
     * logged-in shopper has either:
     * - the annual level-wide membership discount, OR
     * - a non-free PMPro product-level override on this product
     *
     * AND the resolved current shopper price is lower than the relevant
     * public-facing comparison price.
     *
     * If sale exists -> compare current to sale
     * If no sale     -> compare current to regular
     */
    $member_compare_price = $sale_active ? $sale : $regular;
    $member_discount_active = (
        ($annual_member_discount || $product_level_member_override)
        && $member_compare_price > 0
        && $current < $member_compare_price
    );

    /*
     * ARCHIVE / LOOP VIEW
     * Keep this simple and consistent with current archive styling.
     *
     * But do NOT use archive markup during Woo variation AJAX responses.
     */
    if (($is_loop_context || !is_product()) && !wp_doing_ajax()) {
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

/* --------------------------------------------------
 * MEMBERSHIP FREE ITEM DETECTION
 * PMPro WooCommerce stores per-level product pricing as:
 * _level_{LEVEL_ID}_price
 * -------------------------------------------------- */

$membership_free_for_user   = false;
$membership_free_for_others = false;

$user_level_id = 0;

if (is_user_logged_in() && function_exists('pmpro_getMembershipLevelForUser')) {
    $user_level = pmpro_getMembershipLevelForUser();

    if ($user_level && !empty($user_level->id)) {
        $user_level_id = (int) $user_level->id;
    }
}

if (function_exists('pmpro_getAllLevels')) {
    $membership_levels = pmpro_getAllLevels(false, true);

    if (!empty($membership_levels) && is_array($membership_levels)) {
        foreach ($membership_levels as $level) {
            if (empty($level->id)) {
                continue;
            }

            $level_id    = (int) $level->id;
            $level_name  = isset($level->name) ? strtolower(trim((string) $level->name)) : '';
            $level_price = shoshin_get_pmpro_level_price_for_product($product, $level_id);

            if ($level_price === '' || $level_price === null) {
                continue;
            }

            if ((float) $level_price === 0.0) {

                if ($level_name !== 'free') {
                    $membership_free_for_others = true;
                }

                if ($user_level_id > 0 && $user_level_id === $level_id) {
                    $membership_free_for_user = true;
                }
            }
        }
    }
}

/*
 * Fallback:
 * if the active discounted member is already seeing $0.00,
 * treat that as free for the current user.
 */
if (!$membership_free_for_user && $member_discount_active && (float) $current === 0.0) {
    $membership_free_for_user = true;
}


    /*
     * STATE 1: REGULAR
     * No sale + no membership discount
     */
    if (!$sale_active && !$member_discount_active) {
        $teaser_html = '';

        if (!shoshin_has_annual_membership_discount()) {
            $teaser_html = '<div class="shoshin-price-savings shoshin-price-member-teaser">' . ($membership_free_for_others ? 'This item is included with a <a href="/membership">Supporting Membership</a>' : shoshin_format_member_teaser_text($guest_member_amount, $guest_member_percent, false, false)) . '</div>';
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
            $teaser_html = '<div class="shoshin-price-savings shoshin-price-member-teaser">' . ($membership_free_for_others ? 'This item is included with a <a href="/membership">Supporting Membership</a>' : shoshin_format_member_teaser_text($guest_member_amount, $guest_member_percent, true, false)) . '</div>';
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
            <div class="shoshin-price-savings">' . ($membership_free_for_user ? 'This item is included with your membership' : shoshin_format_savings_text($member_amount, $member_percent, 'You Save')) . '</div>
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

        <div class="shoshin-price-savings">' . ($membership_free_for_user ? 'This item is included with your membership' : shoshin_format_savings_text($total_amount, $total_percent, 'Total Savings')) . '</div>
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

    $affiliate = shoshin_get_affiliate_display_data($product);

    /*
     * External products use manual affiliate rating summary when present.
     */
    if ($affiliate['is_external'] && $affiliate['has_rating_summary']) {
        $rating_html = wc_get_rating_html($affiliate['rating'], $affiliate['review_count']);

        return '<div class="woocommerce-product-rating shoshin-single-rating-wrap">'
            . $rating_html
            . '<span class="woocommerce-review-link">(' . esc_html(number_format_i18n($affiliate['review_count'])) . '+ customer reviews)</span>'
            . '</div>';
    }

    $review_count = (int) $product->get_review_count();
    $average      = (float) $product->get_average_rating();

    if ($review_count > 0 && $average > 0) {
        $rating_html = wc_get_rating_html($average, $review_count);

        return '<div class="woocommerce-product-rating shoshin-single-rating-wrap">'
            . $rating_html
            . '<a href="#reviews" class="woocommerce-review-link" rel="nofollow">(<span class="count">' . $review_count . '</span> customer reviews)</a>'
            . '</div>';
    }

    return '<div class="woocommerce-product-rating shoshin-single-rating-wrap shoshin-single-rating-empty">☆☆☆☆☆ Not yet rated</div>';
}

add_shortcode('shoshin_product_reviews', 'shoshin_product_reviews_shortcode');

function shoshin_product_reviews_shortcode() {
    if (is_admin()) {
        return '';
    }

    if (!function_exists('is_product') || !is_product()) {
        return '';
    }

    global $product;

    if (!$product || !is_a($product, 'WC_Product')) {
        return '';
    }

    if ('yes' !== get_option('woocommerce_enable_reviews', 'yes')) {
        return '';
    }

    ob_start();

    echo '<div class="shoshin-product-reviews">';
    echo '<div class="shoshin-product-reviews__heading">';
    echo '<h2 id="reviews">Customer Reviews</h2>';

    if (!$product->is_type('external')) {
        $review_count = (int) $product->get_review_count();
        echo '<span class="shoshin-product-reviews__count">(' . esc_html($review_count) . ')</span>';
    }

    echo '</div>';

    if ($product->is_type('external')) {
        echo '<div class="shoshin-product-reviews__affiliate-message">';
        echo '<p>Product reviews are disabled for affiliate items because purchases are completed on the retailer&rsquo;s website.</p>';
        echo '</div>';
    } else {
        comments_template();
    }

    echo '</div>';

    return ob_get_clean();
}

/* =========================================================
 * SHOSHIN — SINGLE PRODUCT TRUST BLOCK
 * Category-driven reassurance block rendered under excerpt
 * ========================================================= */

function shoshin_get_product_trust_rows($product) {
    if (!$product || !is_a($product, 'WC_Product')) {
        return array();
    }

    /*
     * External / affiliate products get their own fixed 2x2 trust set.
     * CSS already handles the 2-column grid; we only need to supply rows.
     */
    if ($product->is_type('external')) {
        return array(
            'category' => 'external',
            'rows'     => array(
                array(
                    'icon' => 'check',
                    'text' => 'Trusted Brand',
                ),
                array(
                    'icon' => 'check',
                    'text' => 'Curated Selection',
                ),
                array(
                    'icon' => 'prime',
                    'text' => 'Shipping',
                ),
                array(
                    'icon' => 'check',
                    'text' => 'Secure Checkout',
                ),
            ),
        );
    }

    $product_id = $product->get_id();
    if (!$product_id) {
        return array();
    }

    $terms = get_the_terms($product_id, 'product_cat');
    if (empty($terms) || is_wp_error($terms)) {
        return array();
    }

    $keys = array();

    foreach ($terms as $term) {
        if (!empty($term->slug)) {
            $keys[] = sanitize_title($term->slug);
        }

        if (!empty($term->name)) {
            $keys[] = sanitize_title($term->name);
        }
    }

    $keys = array_unique(array_filter($keys));

    $map = array(
        'books' => array(
            'Official Shoshin Release',
            'Built for Reference & Play',
            'Order Support Available',
            'Secure Checkout',
        ),
        'games' => array(
            'Official Shoshin Release',
            'Designed for Tabletop Play',
            'Order Support Available',
            'Secure Checkout',
        ),
        'downloads' => array(
            'Official Shoshin Release',
            'Permanent Access in Account Hub',
            'Order Support Available',
            'Secure Checkout',
        ),
        'miniatures' => array(
            'Authorized Retailer',
            'Created for Tabletop & Collection',
            'Order Support Available',
            'Secure Checkout',
        ),
        'terrain' => array(
            'Authorized Retailer',
            'Designed for Tabletop & Display',
            'Order Support Available',
            'Secure Checkout',
        ),
    );

    foreach ($map as $category_key => $rows) {
        if (in_array($category_key, $keys, true)) {
            return array(
                'category' => $category_key,
                'rows'     => array_map(function ($row_text) {
                    return array(
                        'icon' => 'check',
                        'text' => $row_text,
                    );
                }, $rows),
            );
        }
    }

    return array();
}

function shoshin_render_product_trust_block() {
    if (is_admin()) {
        return;
    }

    if (!function_exists('is_product') || !is_product()) {
        return;
    }

    global $product;

    if (!$product || !is_a($product, 'WC_Product')) {
        return;
    }

    $trust = shoshin_get_product_trust_rows($product);

    if (empty($trust['rows']) || !is_array($trust['rows'])) {
        return;
    }

    $category_class = !empty($trust['category']) ? ' shoshin-trust-block--' . sanitize_html_class($trust['category']) : '';

    echo '<div class="shoshin-trust-block' . esc_attr($category_class) . '" aria-label="Product trust highlights">';

    foreach ($trust['rows'] as $row) {
        $icon_type = 'check';
        $row_text  = '';

        if (is_array($row)) {
            $icon_type = !empty($row['icon']) ? (string) $row['icon'] : 'check';
            $row_text  = !empty($row['text']) ? (string) $row['text'] : '';
        } else {
            $row_text = (string) $row;
        }

        if ($row_text === '') {
            continue;
        }

        echo '<div class="shoshin-trust-item">';

        if ($icon_type === 'prime') {
          echo '<span class="shoshin-trust-icon" aria-hidden="true">&#10003;</span>';
          echo '<span class="shoshin-trust-icon shoshin-trust-icon--prime" aria-hidden="true">';
          echo '<img class="shoshin-trust-prime-icon" src="' . esc_url(home_url('/wp-content/uploads/2026/03/prime.webp')) . '" alt="" />';
          echo '</span>';
      } else {
          echo '<span class="shoshin-trust-icon" aria-hidden="true">&#10003;</span>';
      }

        echo '<span class="shoshin-trust-text">' . esc_html($row_text) . '</span>';
        echo '</div>';
    }

    echo '</div>';
}

function shoshin_product_trust_block_shortcode() {
    if (is_admin()) {
        return '';
    }

    if (!function_exists('is_product') || !is_product()) {
        return '';
    }

    ob_start();
    shoshin_render_product_trust_block();
    return ob_get_clean();
}
add_shortcode('shoshin_product_trust_block', 'shoshin_product_trust_block_shortcode');

/* =========================================================
 * SHOSHIN — SINGLE PRODUCT TRUST BLOCK 2
 * ========================================================= */

function shoshin_product_trust_block_2_shortcode() {
    if (is_admin()) {
        return '';
    }

    if (!function_exists('is_product') || !is_product()) {
        return '';
    }

    global $product;

    if (!$product || !is_a($product, 'WC_Product')) {
        return '';
    }

    $is_external = $product->is_type('external');
    $current_raw = $product->get_price();
    $current     = ($current_raw === '' || $current_raw === null) ? null : (float) $current_raw;

    $amazon_url   = esc_url(home_url('/wp-content/uploads/2026/03/Amazon.webp')); 
    $badge_url    = esc_url(home_url('/wp-content/uploads/2026/03/badge.webp'));
    $bookmark_url = esc_url(home_url('/wp-content/uploads/2026/03/bookmark.webp'));

    $html = '<div class="shoshin-trust-block-2" style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;font-size:12px;font-weight:600;line-height:1.35;color:#444;">';

    if ($is_external) {
        $html .= '
        <div style="display:flex;align-items:center;gap:8px;">
            <img style="width:16px;height:16px;flex-shrink:0;" src="' . $amazon_url . '" alt="Amazon Associate" width="16" height="16" />
            <span>Verified Amazon Associate</span>
        </div>';

        $html .= '
        <div style="display:flex;align-items:center;gap:8px;">
            <img style="width:16px;height:16px;flex-shrink:0;" src="' . $badge_url . '" alt="Affiliate disclosure" width="16" height="16" />
            <span>Pelican House Games earns from qualifying purchases at no additional cost to you</span>
        </div>';
    }

    $affiliate = shoshin_get_affiliate_display_data($product);

/*
 * Show the bookmark/support line:
 * - for external products when an affiliate price range exists
 * - for non-external products when the resolved current price is > 0
 */
if (
    ($affiliate['is_external'] && $affiliate['has_price_range'])
    || (!$affiliate['is_external'] && ($current === null || $current > 0))
) {
    $html .= '
    <div style="display:flex;align-items:center;gap:8px;">
        <img style="width:16px;height:16px;flex-shrink:0;" src="' . $bookmark_url . '" alt="Supports development" width="16" height="16" />
        <span>This purchase supports ongoing development of the Shoshin game system</span>
    </div>';
}

    $html .= '</div>';

    return $html;
}

add_shortcode('shoshin_product_trust_block_2', 'shoshin_product_trust_block_2_shortcode');

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
         * Treat <= 0 stock as unavailable ONLY when backorders are OFF.
         * If backorders are ON, keep the normal fulfillment label so the
         * status text stays aligned with WooCommerce purchasability.
         */
        $backorders_allowed = $product->backorders_allowed();

        if ($product->managing_stock()) {
            $qty = $product->get_stock_quantity();

            if ($qty !== null && (int) $qty <= 0 && !$backorders_allowed) {
                $is_unavailable = true;
            }
        } elseif (!$product->is_in_stock() && !$backorders_allowed) {
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

/*
 * Prevent Stripe Payment Request / Express Checkout from initializing
 * on single product pages when the product is effectively free for the
 * current shopper.
 *
 * This must happen server-side so Stripe never mounts the element with
 * amount = 0 on product pages.
 */
add_filter('wc_stripe_hide_payment_request_on_product_page', function ($hide) {
    if (is_admin()) {
        return $hide;
    }

    if (!function_exists('is_product') || !is_product()) {
        return $hide;
    }

    global $product;

    if (!$product || !is_a($product, 'WC_Product')) {
        return $hide;
    }

    if (shoshin_product_is_effectively_zero_for_current_user($product)) {
        return true;
    }

    return $hide;
}, 20);