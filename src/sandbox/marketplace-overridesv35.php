<?php
/*
|--------------------------------------------------------------------------
| Shoshin Pricing Resolver Contract
|--------------------------------------------------------------------------
|
| Final price precedence:
|
| 1. Included override ($0)
| 2. Variation flat override
| 3. Public sale price
| 4. Public regular price
| 5. PMPro global % discount
|
| The lowest applicable price wins before global discounts are applied.
|
| The same resolver must be used for:
| - unresolved variable range
| - selected variation display
| - archive cards
| - cart
| - checkout
|
| Never bypass the resolver when rendering prices.
|
*/

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

add_action('woocommerce_after_shop_loop_item_title', 'shoshin_single_product_upsell_rating_meta', 6);

function shoshin_single_product_upsell_rating_meta() {
    global $product;

    if (!$product || !is_a($product, 'WC_Product')) {
        return;
    }

    /*
     * Only run in the single-product upsell / related rail.
     * Do not run on shop/category/tag archives.
     */
    if (!function_exists('is_product') || !is_product()) {
        return;
    }

    if (is_shop() || is_product_taxonomy() || is_product_category() || is_product_tag()) {
        return;
    }

    $affiliate = shoshin_get_affiliate_display_data($product);

    /*
     * Always normalize upsell rating markup to one row shape:
     * .woocommerce-product-rating.shoshin-upsell-rating
     *
     * This prevents CSS/layout divergence between native Woo products
     * and external/affiliate products.
     */

    /* External / affiliate products */
    if (!empty($affiliate['is_external'])) {
        if (!empty($affiliate['has_rating_summary'])) {
            echo '<div class="woocommerce-product-rating shoshin-upsell-rating">';
            echo wc_get_rating_html($affiliate['rating'], $affiliate['review_count']);
            echo '<span class="shoshin-rating-count">(' . esc_html(number_format_i18n($affiliate['review_count'])) . ')</span>';
            echo '</div>';
        } else {
            echo '<div class="woocommerce-product-rating shoshin-upsell-rating shoshin-rating-empty">';
            echo '<span class="shoshin-rating-none">Not yet rated</span>';
            echo '</div>';
        }
        return;
    }

    /* Native Woo products */
    $review_count = (int) $product->get_review_count();
    $average      = (float) $product->get_average_rating();

    if ($review_count > 0 && $average > 0) {
        echo '<div class="woocommerce-product-rating shoshin-upsell-rating">';
        echo wc_get_rating_html($average, $review_count);
        echo '<span class="shoshin-rating-count">(' . esc_html($review_count) . ')</span>';
        echo '</div>';
    } else {
        echo '<div class="woocommerce-product-rating shoshin-upsell-rating shoshin-rating-empty">';
        echo '<span class="shoshin-rating-none">Not yet rated</span>';
        echo '</div>';
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

add_action('admin_footer-post.php', 'shoshin_disable_parent_pmpro_variable_prices_admin_js');
add_action('admin_footer-post-new.php', 'shoshin_disable_parent_pmpro_variable_prices_admin_js');

function shoshin_disable_parent_pmpro_variable_prices_admin_js() {
    global $post;

    if (!$post || get_post_type($post) !== 'product') {
        return;
    }
    ?>
    <script>
    jQuery(function($) {
        function shoshinToggleVariablePmproLevelPrices() {
            var productType = $('#product-type').val();
            var isVariable = (productType === 'variable');

            var $inputs = $('input[name^="_level_"][name$="_price"]');

            if (!$inputs.length) {
                return;
            }

            $inputs.each(function() {
                var $input = $(this);
                var $row = $input.closest('.form-field, p, .options_group, tr');

                if (isVariable) {
                    $input.prop('disabled', true).attr('placeholder', 'Disabled for variable parent products');
                    $row.addClass('shoshin-pmpro-variable-disabled');
                } else {
                    $input.prop('disabled', false);
                    $row.removeClass('shoshin-pmpro-variable-disabled');
                }
            });

            if (isVariable && !$('#shoshin-pmpro-variable-disabled-message').length) {
                var $firstInput = $inputs.first();
                var $target = $firstInput.closest('.form-field, p, .options_group, tr');

                $('<div id="shoshin-pmpro-variable-disabled-message" style="margin:8px 0 12px;padding:10px 12px;border-left:4px solid #dba617;background:#fff8e5;color:#5c4b00;font-size:12px;line-height:1.45;">Parent-level PMPro flat member prices are disabled for variable products. Use the global membership discount only. Variation-level flat member pricing can be added later if needed.</div>')
                    .insertBefore($target);
            }

            if (!isVariable) {
                $('#shoshin-pmpro-variable-disabled-message').remove();
            }
        }

        shoshinToggleVariablePmproLevelPrices();
        $(document.body).on('woocommerce-product-type-change', shoshinToggleVariablePmproLevelPrices);
        $('#product-type').on('change', shoshinToggleVariablePmproLevelPrices);
    });
    </script>
    <?php
}

add_action('admin_footer-post.php', 'shoshin_validate_variation_pmpro_prices_admin_js');
add_action('admin_footer-post-new.php', 'shoshin_validate_variation_pmpro_prices_admin_js');

function shoshin_validate_variation_pmpro_prices_admin_js() {
    global $post;

    if (!$post || get_post_type($post) !== 'product') {
        return;
    }
    ?>
    <script>
    jQuery(function($) {
        function shoshinGetLowestPublicPrice($variationWrap) {
            var regular = parseFloat($variationWrap.find('input[name^="variable_regular_price"]').first().val());
            var sale    = parseFloat($variationWrap.find('input[name^="variable_sale_price"]').first().val());

            regular = isNaN(regular) ? 0 : regular;
            sale    = isNaN(sale) ? 0 : sale;

            if (sale > 0 && regular > 0 && sale < regular) {
                return sale;
            }

            return regular;
        }

        function shoshinClearVariationPmproErrors() {
            $('.shoshin-pmpro-variation-error').remove();
            $('.woocommerce_variation').removeClass('shoshin-pmpro-variation-invalid');
        }

        function shoshinValidateVariationPmproPrices() {
            shoshinClearVariationPmproErrors();

            var hasErrors = false;

            $('.woocommerce_variation').each(function() {
                var $variation = $(this);
                var lowestPublicPrice = shoshinGetLowestPublicPrice($variation);

                if (!(lowestPublicPrice > 0)) {
                    return;
                }

                $variation.find('input[name^="_level_"][name$="_price]"]').each(function() {
                    var $input = $(this);
                    var raw = $.trim($input.val());

                    if (!raw) {
                        return;
                    }

                    var overridePrice = parseFloat(raw);

                    if (isNaN(overridePrice)) {
                        return;
                    }

                    if (overridePrice >= lowestPublicPrice) {
                        hasErrors = true;

                        $variation.addClass('shoshin-pmpro-variation-invalid');

                        var message = 'PMPro variation price must be lower than the lowest public price for this variation (' + lowestPublicPrice.toFixed(2) + ').';

                        if (!$input.next('.shoshin-pmpro-variation-error').length) {
                            $('<div class="shoshin-pmpro-variation-error" style="margin-top:6px;color:#b32d2e;font-size:12px;line-height:1.4;font-weight:600;">' + message + '</div>')
                                .insertAfter($input);
                        }
                    }
                });
            });

            return !hasErrors;
        }

        $(document).on('click', '#publish, #save-post', function(e) {
            if (!shoshinValidateVariationPmproPrices()) {
                e.preventDefault();
                e.stopImmediatePropagation();

                window.alert('One or more PMPro variation prices are invalid. Flat member prices must be lower than the lowest public price for that variation.');

                return false;
            }
        });

        $(document).on('woocommerce_variations_loaded woocommerce_variations_added', function() {
            shoshinClearVariationPmproErrors();
        });

        $(document).on('input change', '.woocommerce_variation input[name^="_level_"][name$="_price]"], .woocommerce_variation input[name^="variable_regular_price"], .woocommerce_variation input[name^="variable_sale_price"]', function() {
            shoshinValidateVariationPmproPrices();
        });
    });
    </script>
    <?php
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

add_action('woocommerce_process_product_meta', 'shoshin_clear_parent_pmpro_level_prices_for_variable_products', 50);

function shoshin_clear_parent_pmpro_level_prices_for_variable_products($post_id) {
    $product = wc_get_product($post_id);

    if (!$product || !is_a($product, 'WC_Product')) {
        return;
    }

    if (!$product->is_type('variable')) {
        return;
    }

    if (!function_exists('pmpro_getAllLevels')) {
        return;
    }

    $levels = pmpro_getAllLevels(false, true);

    if (empty($levels) || !is_array($levels)) {
        return;
    }

    foreach ($levels as $level) {
        if (empty($level->id)) {
            continue;
        }

        $meta_key = '_level_' . absint($level->id) . '_price';
        delete_post_meta($post_id, $meta_key);
    }
}

add_action('woocommerce_variation_options_pricing', 'shoshin_pmpro_variation_level_price_fields', 90, 3);

function shoshin_pmpro_variation_level_price_fields($loop, $variation_data, $variation) {
    $levels = shoshin_get_pmpro_levels_cached();

    if (empty($levels)) {
        return;
    }

    echo '<div class="options_group shoshin-pmpro-variation-level-prices">';
    echo '<p><strong>Membership Variation Pricing</strong><br />Set optional PMPro flat prices for this specific variation. Global membership discounts still apply natively on top of the lowest applicable price.</p>';

    foreach ($levels as $level) {
        if (empty($level->id)) {
            continue;
        }

        $meta_key = '_level_' . absint($level->id) . '_price';

        woocommerce_wp_text_input(array(
            'id'            => $meta_key . '[' . $variation->ID . ']',
            'name'          => $meta_key . '[' . $variation->ID . ']',
            'label'         => sprintf('%s Price (%s)', $level->name, get_woocommerce_currency_symbol()),
            'value'         => get_post_meta($variation->ID, $meta_key, true),
            'placeholder'   => '',
            'type'          => 'text',
            'desc_tip'      => true,
            'description'   => 'Optional PMPro flat price for this variation only.',
            'data_type'     => 'price',
            'wrapper_class' => 'form-row form-row-full',
        ));
    }

    echo '</div>';
}

add_action('woocommerce_save_product_variation', 'shoshin_save_pmpro_variation_level_price_fields', 90, 2);

function shoshin_save_pmpro_variation_level_price_fields($variation_id, $i) {
    $levels = shoshin_get_pmpro_levels_cached();

    if (empty($levels)) {
        return;
    }

    $errors = get_transient('shoshin_pmpro_variation_price_errors');
    $errors = is_array($errors) ? $errors : array();

    foreach ($levels as $level) {
        if (empty($level->id)) {
            continue;
        }

        $meta_key = '_level_' . absint($level->id) . '_price';

        if (!isset($_POST[$meta_key][$variation_id])) {
            continue;
        }

        $raw = wc_format_decimal(wp_unslash($_POST[$meta_key][$variation_id]));

        if ($raw === '' || $raw === null) {
            delete_post_meta($variation_id, $meta_key);
            continue;
        }

        $validation = shoshin_validate_variation_pmpro_level_price($variation_id, $raw);

        if (!$validation['is_valid']) {
            /*
             * Do not save invalid value.
             */
            delete_post_meta($variation_id, $meta_key);

            $errors[] = sprintf(
                'Variation ID %1$d — %2$s (%3$s entered: %4$s)',
                absint($variation_id),
                isset($level->name) ? esc_html($level->name) : 'Membership level',
                esc_html__('override', 'shoshin'),
                wc_price((float) $raw)
            ) . ' ' . wp_strip_all_tags($validation['message']);

            continue;
        }

        update_post_meta($variation_id, $meta_key, $raw);
    }

    if (!empty($errors)) {
        set_transient('shoshin_pmpro_variation_price_errors', $errors, 60);
    }
}

add_action('admin_notices', 'shoshin_pmpro_variation_price_admin_notices');

function shoshin_pmpro_variation_price_admin_notices() {
    if (!is_admin()) {
        return;
    }

    $screen = function_exists('get_current_screen') ? get_current_screen() : null;

    if (!$screen || $screen->id !== 'product') {
        return;
    }

    $errors = get_transient('shoshin_pmpro_variation_price_errors');

    if (empty($errors) || !is_array($errors)) {
        return;
    }

    delete_transient('shoshin_pmpro_variation_price_errors');

    echo '<div class="notice notice-error is-dismissible">';
    echo '<p><strong>Some PMPro variation prices were not saved.</strong></p>';
    echo '<ul style="margin-left:18px;list-style:disc;">';

    foreach ($errors as $error) {
        echo '<li>' . wp_kses_post($error) . '</li>';
    }

    echo '</ul>';
    echo '</div>';
}

function shoshin_validate_variation_pmpro_level_price($variation_id, $override_raw) {
    $result = array(
        'is_valid'             => true,
        'message'              => '',
        'lowest_public_price'  => 0.0,
        'regular_price'        => 0.0,
        'sale_price'           => 0.0,
        'override_price'       => 0.0,
    );

    $variation = wc_get_product($variation_id);

    if (!$variation || !is_a($variation, 'WC_Product_Variation')) {
        return $result;
    }

    $regular_raw = get_post_meta($variation_id, '_regular_price', true);
    $sale_raw    = get_post_meta($variation_id, '_sale_price', true);

    $regular = ($regular_raw !== '' && $regular_raw !== null) ? (float) $regular_raw : 0.0;
    $sale    = ($sale_raw !== '' && $sale_raw !== null) ? (float) $sale_raw : 0.0;

    $lowest_public_price = 0.0;

    if ($sale > 0 && $regular > 0 && $sale < $regular) {
        $lowest_public_price = $sale;
    } elseif ($regular > 0) {
        $lowest_public_price = $regular;
    }

    $override = ($override_raw !== '' && $override_raw !== null) ? (float) wc_format_decimal($override_raw) : 0.0;

    $result['lowest_public_price'] = $lowest_public_price;
    $result['regular_price']       = $regular;
    $result['sale_price']          = $sale;
    $result['override_price']      = $override;

    /*
     * Guardrail:
     * A variation-level flat member price must be STRICTLY LOWER than the
     * lowest current public price, otherwise it is invalid and misleading.
     */
    if ($override > 0 && $lowest_public_price > 0 && $override >= $lowest_public_price) {
        $result['is_valid'] = false;
        $result['message']  = 'Membership variation pricing must be lower than the lowest public variation price.';

        if ($sale > 0 && $sale < $regular) {
            $result['message'] .= ' This variation has Base ' . wc_price($regular) . ', Sale ' . wc_price($sale) . ', so the override must be lower than ' . wc_price($sale) . '.';
        } else {
            $result['message'] .= ' This variation has Base ' . wc_price($regular) . ', so the override must be lower than ' . wc_price($regular) . '.';
        }
    }

    return $result;
}

add_filter('pmprowoo_get_membership_price', 'shoshin_pmprowoo_get_membership_price_for_variations', 20, 4);

function shoshin_pmprowoo_get_membership_price_for_variations($discount_price, $lowest_price_level, $price, $product) {
    if (!$product || !is_a($product, 'WC_Product') || !$product->is_type('variation')) {
        return $discount_price;
    }

    $resolved = shoshin_resolve_variation_pricing_for_current_user($product);

    if (!empty($resolved['is_included'])) {
        return 0.0;
    }

    if ((float) $resolved['final_current'] > 0) {
        return (float) wc_format_decimal($resolved['final_current']);
    }

    return $discount_price;
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

add_filter('woocommerce_available_variation', 'shoshin_override_available_variation_price_html', 20, 3);

function shoshin_override_available_variation_price_html($variation_data, $product, $variation) {
    if (is_admin()) {
        return $variation_data;
    }

    if (!$variation || !is_a($variation, 'WC_Product_Variation')) {
        return $variation_data;
    }

    /*
     * Force the selected variation payload to use the same custom
     * styled price block renderer used everywhere else.
     *
     * JS already swaps variation.price_html into the top price widget,
     * so the payload itself must contain the Shoshin-rendered markup.
     */
    $variation_data['price_html'] = shoshin_marketplace_price_html(
    $variation->get_price_html(),
    $variation,
    array(
        'force_single_product' => true,
    )
);

    return $variation_data;
}

function shoshin_get_pmpro_levels_cached() {
    static $levels = null;

    if ($levels !== null) {
        return $levels;
    }

    if (!function_exists('pmpro_getAllLevels')) {
        $levels = array();
        return $levels;
    }

    $levels = pmpro_getAllLevels(false, true);

    if (empty($levels) || !is_array($levels)) {
        $levels = array();
    }

    return $levels;
}

function shoshin_get_pmpro_member_discounts_map() {
    $discounts = get_option('_pmprowoo_member_discounts', array());

    return is_array($discounts) ? $discounts : array();
}

function shoshin_get_pmpro_member_discount_decimal_for_level($level_id) {
    $level_id = (int) $level_id;

    if ($level_id <= 0) {
        return 0.0;
    }

    $discounts = shoshin_get_pmpro_member_discounts_map();

    if (empty($discounts[$level_id])) {
        return 0.0;
    }

    return (float) $discounts[$level_id];
}

function shoshin_get_current_user_pmpro_context() {
    $context = array(
        'level_id'          => 0,
        'level_name'        => '',
        'is_member'         => false,
        'is_free_level'     => false,
        'discount_decimal'  => 0.0,
        'discount_percent'  => 0,
    );

    if (!is_user_logged_in() || !function_exists('pmpro_getMembershipLevelForUser')) {
        return $context;
    }

    $level = pmpro_getMembershipLevelForUser();

    if (!$level || empty($level->id)) {
        return $context;
    }

    $level_id   = (int) $level->id;
    $level_name = isset($level->name) ? strtolower(trim((string) $level->name)) : '';

    $discount_decimal = shoshin_get_pmpro_member_discount_decimal_for_level($level_id);

    $context['level_id']         = $level_id;
    $context['level_name']       = $level_name;
    $context['is_member']        = true;
    $context['is_free_level']    = ($level_name === 'free');
    $context['discount_decimal'] = $discount_decimal;
    $context['discount_percent'] = (int) round($discount_decimal * 100);

    return $context;
}

function shoshin_has_annual_membership_discount() {
    /*
     * Backward-compatible wrapper:
     * now means "current user has any PMPro global member discount".
     */
    $context = shoshin_get_current_user_pmpro_context();

    return (!empty($context['is_member']) && empty($context['is_free_level']) && $context['discount_decimal'] > 0);
}

function shoshin_get_pmpro_level_price_for_product($product, $level_id) {
    if (!$product || !is_a($product, 'WC_Product')) {
        return '';
    }

    $level_id = (int) $level_id;
    if ($level_id <= 0) {
        return '';
    }

    /*
     * Guardrail:
     * Parent-level PMPro flat member pricing is disabled for variable products.
     * We do not want one parent flat price to apply to all variations.
     */
    if ($product->is_type('variable')) {
        return '';
    }

    $meta_key = '_level_' . $level_id . '_price';

    /*
     * Variations may use their own explicit per-variation level price in the future,
     * but we do NOT fall back to the parent variable product.
     */
    return get_post_meta($product->get_id(), $meta_key, true);
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

function shoshin_get_current_user_nonfree_product_level_price($product) {
    if (!$product || !is_a($product, 'WC_Product')) {
        return '';
    }

    if (!is_user_logged_in() || !function_exists('pmpro_getMembershipLevelForUser')) {
        return '';
    }

    $user_level = pmpro_getMembershipLevelForUser();

    if (!$user_level || empty($user_level->id)) {
        return '';
    }

    $level_id   = (int) $user_level->id;
    $level_name = isset($user_level->name) ? strtolower(trim((string) $user_level->name)) : '';

    /* Ignore free membership for member-price display states */
    if ($level_name === 'free') {
        return '';
    }

    $level_price = shoshin_get_pmpro_level_price_for_product($product, $level_id);

    if ($level_price === '' || $level_price === null) {
        return '';
    }

    return wc_format_decimal($level_price);
}

function shoshin_get_pmpro_discount_level_ids_for_product($product) {
    $level_ids = array();

    if (!$product || !is_a($product, 'WC_Product')) {
        return $level_ids;
    }

    /*
     * Mirror PMPro/Woo logic:
     * current user levels + levels granted by membership products already in cart,
     * excluding the current product itself.
     */
    if (function_exists('pmpro_getMembershipLevelsForUser') && is_user_logged_in()) {
        $user_levels = pmpro_getMembershipLevelsForUser(get_current_user_id());
        if (!empty($user_levels) && is_array($user_levels)) {
            $level_ids = array_merge($level_ids, wp_list_pluck($user_levels, 'id'));
        }
    }

    global $pmprowoo_product_levels;

    $pmprowoo_product_levels = is_array($pmprowoo_product_levels) ? $pmprowoo_product_levels : array();

    if (!empty($pmprowoo_product_levels) && function_exists('WC') && WC()->cart && is_object(WC()->cart)) {
        $membership_product_ids = array_keys($pmprowoo_product_levels);
        $items = WC()->cart->get_cart_contents();

        foreach ($items as $item) {
            if (
                !empty($item['product_id'])
                && $item['product_id'] != $product->get_id()
                && in_array($item['product_id'], $membership_product_ids, true)
            ) {
                $level_ids[] = (int) $pmprowoo_product_levels[$item['product_id']];
            }
        }
    }

    $level_ids = array_unique(array_map('absint', $level_ids));
    $level_ids = array_filter($level_ids);

    return array_values($level_ids);
}

function shoshin_resolve_variation_pricing_for_current_user($variation) {
    if (!$variation || !is_a($variation, 'WC_Product_Variation')) {
        return array(
            'regular'               => 0.0,
            'public_current'        => 0.0,
            'final_current'         => 0.0,
            'has_sale'              => false,
            'has_flat_override'     => false,
            'has_member_adjustment' => false,
            'is_included'           => false,
        );
    }

    $variation_id = $variation->get_id();

    $regular_raw = get_post_meta($variation_id, '_regular_price', true);
    $sale_raw    = get_post_meta($variation_id, '_sale_price', true);

    $regular = ($regular_raw !== '' && $regular_raw !== null) ? (float) $regular_raw : 0.0;
    $sale    = ($sale_raw !== '' && $sale_raw !== null) ? (float) $sale_raw : 0.0;

    $public_current = 0.0;
    $has_sale = false;

    if ($sale > 0 && $regular > 0 && $sale < $regular) {
        $public_current = $sale;
        $has_sale = true;
    } elseif ($regular > 0) {
        $public_current = $regular;
    }

    $discount_level_ids = shoshin_get_pmpro_discount_level_ids_for_product($variation);

    $lowest_applicable = $public_current;
    $has_flat_override = false;
    $is_included       = false;

    foreach ($discount_level_ids as $level_id) {
        $level_price = get_post_meta($variation_id, '_level_' . absint($level_id) . '_price', true);

        if (!empty($level_price) || $level_price === '0' || $level_price === '0.00' || $level_price === '0,00') {
            $level_price = (float) $level_price;

            if ($lowest_applicable <= 0 || $level_price < $lowest_applicable) {
                $lowest_applicable = $level_price;
                $has_flat_override = true;
            }

            if ((float) $level_price === 0.0) {
                $is_included = true;
            }
        }
    }

    $highest_discount = 0.0;

    foreach ($discount_level_ids as $level_id) {
        $level_discount = shoshin_get_pmpro_member_discount_decimal_for_level($level_id);

        if ($level_discount > $highest_discount) {
            $highest_discount = $level_discount;
        }
    }

    $final_current = $lowest_applicable;

    /*
     * Do not further discount included/free items.
     */
    if ($final_current > 0 && $highest_discount > 0) {
        $final_current = $final_current - ($final_current * $highest_discount);
    }

    return array(
        'regular'               => (float) $regular,
        'public_current'        => (float) $public_current,
        'final_current'         => (float) $final_current,
        'has_sale'              => (bool) $has_sale,
        'has_flat_override'     => (bool) $has_flat_override,
        'has_member_adjustment' => ((float) $public_current > 0 && (float) $final_current < (float) $public_current),
        'is_included'           => (bool) $is_included,
    );
}

function shoshin_get_variable_price_bounds($product) {
    if (!$product || !is_a($product, 'WC_Product') || !$product->is_type('variable')) {
        return array(
            'min_regular'           => 0.0,
            'max_regular'           => 0.0,
            'min_public'            => 0.0,
            'max_public'            => 0.0,
            'min_final'             => 0.0,
            'max_final'             => 0.0,
            'has_prices'            => false,
            'has_public_sale'       => false,
            'has_member_adjustment' => false,
            'has_flat_override'     => false,
            'has_included'          => false,
        );
    }

    $child_ids = $product->get_children();

    if (empty($child_ids) || !is_array($child_ids)) {
        return array(
            'min_regular'           => 0.0,
            'max_regular'           => 0.0,
            'min_public'            => 0.0,
            'max_public'            => 0.0,
            'min_final'             => 0.0,
            'max_final'             => 0.0,
            'has_prices'            => false,
            'has_public_sale'       => false,
            'has_member_adjustment' => false,
            'has_flat_override'     => false,
            'has_included'          => false,
        );
    }

    $regulars = array();
    $publics  = array();
    $finals   = array();

    $has_public_sale       = false;
    $has_member_adjustment = false;
    $has_flat_override     = false;
    $has_included          = false;

    foreach ($child_ids as $child_id) {
        $variation = wc_get_product($child_id);

        if (!$variation || !is_a($variation, 'WC_Product_Variation')) {
            continue;
        }

        $resolved = shoshin_resolve_variation_pricing_for_current_user($variation);

        if ((float) $resolved['regular'] > 0) {
            $regulars[] = (float) $resolved['regular'];
        }

        if ((float) $resolved['public_current'] > 0) {
            $publics[] = (float) $resolved['public_current'];
        }

        /*
         * Include zero-dollar final prices when the variation is explicitly
         * included with membership.
         */
        if (!empty($resolved['is_included'])) {
            $finals[] = 0.0;
            $has_included = true;
        } elseif ((float) $resolved['final_current'] > 0) {
            $finals[] = (float) $resolved['final_current'];
        }

        if (!empty($resolved['has_sale'])) {
            $has_public_sale = true;
        }

        if (!empty($resolved['has_member_adjustment'])) {
            $has_member_adjustment = true;
        }

        if (!empty($resolved['has_flat_override'])) {
            $has_flat_override = true;
        }
    }

    if (empty($regulars) || empty($publics) || empty($finals)) {
        return array(
            'min_regular'           => 0.0,
            'max_regular'           => 0.0,
            'min_public'            => 0.0,
            'max_public'            => 0.0,
            'min_final'             => 0.0,
            'max_final'             => 0.0,
            'has_prices'            => false,
            'has_public_sale'       => false,
            'has_member_adjustment' => false,
            'has_flat_override'     => false,
            'has_included'          => false,
        );
    }

    return array(
        'min_regular'           => (float) min($regulars),
        'max_regular'           => (float) max($regulars),
        'min_public'            => (float) min($publics),
        'max_public'            => (float) max($publics),
        'min_final'             => (float) min($finals),
        'max_final'             => (float) max($finals),
        'has_prices'            => true,
        'has_public_sale'       => (bool) $has_public_sale,
        'has_member_adjustment' => (bool) $has_member_adjustment,
        'has_flat_override'     => (bool) $has_flat_override,
        'has_included'          => (bool) $has_included,
    );
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

function shoshin_marketplace_price_html($price_html, $product, $context = array()) {

if ((is_admin() && !wp_doing_ajax()) || !$product || !is_a($product, 'WC_Product')) {
    return $price_html;
}

$force_single_product_context = (
    is_array($context)
    && !empty($context['force_single_product'])
);

$queried_product_id     = is_product() ? absint(get_queried_object_id()) : 0;
$is_main_single_product = (
    $force_single_product_context
    || (is_product() && $queried_product_id > 0 && (int) $product->get_id() === $queried_product_id)
);
$is_loop_context = (
    !$force_single_product_context
    && !$is_main_single_product
    && in_the_loop()
);

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

/*
 * For selected variations, use the unified variation resolver so the
 * single-product price block matches the unresolved parent range logic
 * and checkout logic:
 * - lowest applicable price wins
 * - then PMPro global % discount applies
 * - included/free state is preserved
 */
if ($product->is_type('variation')) {
    $resolved_variation = shoshin_resolve_variation_pricing_for_current_user($product);

    if ((float) $resolved_variation['regular'] > 0) {
        $regular_raw = (string) $resolved_variation['regular'];
    }

    /*
     * Preserve the public sale/current comparison side for the right-hand
     * block in member+sale state.
     */
    if ((float) $resolved_variation['public_current'] > 0 && (float) $resolved_variation['public_current'] < (float) $resolved_variation['regular']) {
        $sale_raw = (string) $resolved_variation['public_current'];
    }

    /*
     * Final current must reflect:
     * - override only
     * - override + global %
     * - sale + global %
     * - included/free = 0.00
     */
    $current_raw = (string) $resolved_variation['final_current'];
} else {
    /*
     * Simple products may still use the existing product-level PMPro override behavior.
     */
    $product_level_override_raw = shoshin_get_current_user_nonfree_product_level_price($product);

    if ($product_level_override_raw !== '') {
        $current_raw = $product_level_override_raw;
    }
}

/*
 * Do not early-return on variable parent products.
 * Their scalar parent regular/current values are often blank even when
 * valid variation min/max pricing exists and should drive the custom
 * Shoshin range renderer.
 */
if (!$product->is_type('variable') && $regular_raw === '' && $current_raw === '') {
    return $price_html;
}

    $regular = ($regular_raw !== '') ? (float) $regular_raw : 0.0;
    $sale    = ($sale_raw !== '') ? (float) $sale_raw : 0.0;
    $current = ($current_raw !== '') ? (float) $current_raw : 0.0;

    if (!$product->is_type('variable') && $regular <= 0 && $current <= 0) {
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
    $bounds = shoshin_get_variable_price_bounds($product);

    $min_regular = (float) $bounds['min_regular'];
    $max_regular = (float) $bounds['max_regular'];
    $min_public  = (float) $bounds['min_public'];
    $max_public  = (float) $bounds['max_public'];
    $min_final   = (float) $bounds['min_final'];
    $max_final   = (float) $bounds['max_final'];

    $has_public_sale       = !empty($bounds['has_public_sale']);
    $has_member_adjustment = !empty($bounds['has_member_adjustment']);
    $has_flat_override     = !empty($bounds['has_flat_override']);
    $has_included          = !empty($bounds['has_included']);

    /*
     * Allow included-with-membership variable ranges such as $0.00 – $N.00.
     * The final range is valid when max_final is positive OR when both ends
     * are explicitly 0.00.
     */
    $has_valid_final_range = (
        $max_final > 0
        || ((float) $min_final === 0.0 && (float) $max_final === 0.0)
    );

    if ($min_regular > 0 && $max_regular > 0 && $min_public > 0 && $max_public > 0 && $has_valid_final_range) {
        $regular_range_html = ((float) $min_regular === (float) $max_regular)
            ? wc_price($min_regular)
            : wc_price($min_regular) . ' – ' . wc_price($max_regular);

        $public_range_html = ((float) $min_public === (float) $max_public)
            ? wc_price($min_public)
            : wc_price($min_public) . ' – ' . wc_price($max_public);

        $final_range_html = ((float) $min_final === (float) $max_final)
            ? wc_price($min_final)
            : wc_price($min_final) . ' – ' . wc_price($max_final);

        /*
         * Public unresolved variable-state teaser:
         * always use the current business-policy teaser copy/value,
         * even for guests or members whose current level has no PMPro global %.
         *
         * This is marketing/policy copy for the unresolved parent state,
         * not the resolved current-user discount calculation.
         */
        $policy_teaser_percent = 10;
        $policy_teaser_amount  = $max_regular * ($policy_teaser_percent / 100);
        $teaser_text           = shoshin_format_member_teaser_text($policy_teaser_amount, $policy_teaser_percent, false, true);

        if ($has_member_adjustment) {
            $member_label = ((float) $min_final === (float) $max_final)
                ? 'Membership Discount'
                : 'Membership Discount Range';

            $savings_html = '';

            /*
             * Unresolved variable member-range messaging states:
             *
             * A) Included
             * B) Flat override only
             * C) Flat override + global %
             * D) Pure global % only
             */
            $member_context = shoshin_get_current_user_pmpro_context();
            $current_member_percent = !empty($member_context['discount_percent']) ? (int) $member_context['discount_percent'] : 0;

            if ($has_included) {
                if ((float) $min_final === 0.0 && (float) $max_final > 0.0) {
                    $savings_html = '<div class="shoshin-price-savings">Some options are included with your membership</div>';
                } else {
                    $savings_html = '<div class="shoshin-price-savings">This item is included with your membership</div>';
                }

            } elseif ($has_flat_override && $current_member_percent > 0) {
                $savings_html = '<div class="shoshin-price-savings">You save an additional ' . $current_member_percent . '% with your membership</div>';

            } elseif ($has_flat_override) {
                $savings_html = '<div class="shoshin-price-savings">Member discounts available on select options</div>';

            } elseif ($current_member_percent > 0) {
                if ($has_public_sale) {
                    $savings_html = '<div class="shoshin-price-savings">You save an additional ' . $current_member_percent . '% on this item</div>';
                } else {
                    $savings_html = '<div class="shoshin-price-savings">You save ' . $current_member_percent . '% on this item</div>';
                }
            }

            return '
            <div class="shoshin-price-block shoshin-price-block--variable-range-member">
                <div class="shoshin-price-label">' . $member_label . '</div>
                <div class="shoshin-price-row">
                    <span class="shoshin-price-final shoshin-price-final--member">' . $final_range_html . '</span>
                </div>
                ' . $savings_html . '
            </div>';
        }

        if ($has_public_sale) {
            $sale_label = ((float) $min_public === (float) $max_public)
                ? 'Sale Price'
                : 'Sale Price Range';

            return '
            <div class="shoshin-price-block shoshin-price-block--variable-range-sale">
                <div class="shoshin-price-label">' . $sale_label . '</div>
                <div class="shoshin-price-final shoshin-price-final--standard">' . $public_range_html . '</div>
                                <div class="shoshin-price-savings shoshin-price-member-teaser">' . shoshin_format_member_teaser_text($policy_teaser_amount, $policy_teaser_percent, true, true) . '</div>
            </div>';
        }

        $regular_label = ((float) $min_regular === (float) $max_regular)
            ? 'Regular Price'
            : 'Regular Price Range';

        return '
        <div class="shoshin-price-block shoshin-price-block--variable-range">
            <div class="shoshin-price-label">' . $regular_label . '</div>
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

        /*
        * Variable products in loop / upsell / related contexts must use
        * resolved min/max variation values so cards show the proper price range.
        */
        if ($product->is_type('variable')) {

            $bounds = shoshin_get_variable_price_bounds($product);

            $min_regular = (float) $bounds['min_regular'];
            $max_regular = (float) $bounds['max_regular'];

            $min_public  = (float) $bounds['min_public'];
            $max_public  = (float) $bounds['max_public'];

            $min_final   = (float) $bounds['min_final'];
            $max_final   = (float) $bounds['max_final'];

            $has_member_adjustment = !empty($bounds['has_member_adjustment']);
            $has_included          = !empty($bounds['has_included']);

            $archive_final_price = '';
            $archive_original    = '';
            $archive_percent     = 0;

            /*
            * FINAL DISPLAY PRICE
            */
            if ($has_member_adjustment || $has_included) {

                $archive_final_price = ($min_final === $max_final)
                    ? wc_price($min_final)
                    : wc_price($min_final) . ' – ' . wc_price($max_final);

                if ($max_public > 0) {

                    $archive_original = ($min_public === $max_public)
                        ? wc_price($min_public)
                        : wc_price($min_public) . ' – ' . wc_price($max_public);

                    if ($max_final < $max_public) {
                        $archive_percent = round((($max_public - $max_final) / $max_public) * 100);
                    }
                }

            } else {

                $archive_final_price = ($min_public === $max_public)
                    ? wc_price($min_public)
                    : wc_price($min_public) . ' – ' . wc_price($max_public);

                if ($max_regular > 0) {

                    $archive_original = ($min_regular === $max_regular)
                        ? wc_price($min_regular)
                        : wc_price($min_regular) . ' – ' . wc_price($max_regular);

                    if ($max_public < $max_regular) {
                        $archive_percent = round((($max_regular - $max_public) / $max_regular) * 100);
                    }
                }
            }

            if ($archive_final_price !== '') {

                $is_range = (
                    ($has_member_adjustment && $min_final !== $max_final)
                    || (!$has_member_adjustment && $min_public !== $max_public)
                );

                $html = '<ins>' . $archive_final_price . '</ins>';

                /*
                * When a price range exists we suppress strike-through
                * and percent savings because the math is ambiguous.
                */
                if (!$is_range && $archive_percent > 0 && $archive_original !== '') {
                    $html .= ' <del>' . $archive_original . '</del>';
                    $html .= ' <span class="shoshin-sale-percent">(Save ' . $archive_percent . '%)</span>';
                }

                return '<span class="price">' . $html . '</span>';
            }
        }

        /*
        * SIMPLE PRODUCTS
        */
        $archive_final_price = wc_price($current);
        $archive_original    = wc_price($regular);

        $archive_percent = ($regular > 0 && $current < $regular)
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

        /*
        * Variation-aware free detection:
        * if this selected/active product itself has an applicable variation-level
        * PMPro price of 0.00, treat it as included for the current user.
        */
        if ($product->is_type('variation')) {
            $resolved_variation = shoshin_resolve_variation_pricing_for_current_user($product);

            if (!empty($resolved_variation['is_included'])) {
                $membership_free_for_user = true;
            }
        }

        if (function_exists('pmpro_getAllLevels')) {
            $membership_levels = pmpro_getAllLevels(false, true);

            if (!empty($membership_levels) && is_array($membership_levels)) {
                foreach ($membership_levels as $level) {
                    if (empty($level->id)) {
                        continue;
                    }

                    $level_id   = (int) $level->id;
                    $level_name = isset($level->name) ? strtolower(trim((string) $level->name)) : '';

                    /*
                    * For selected variations, inspect the variation-level PMPro price directly.
                    * For non-variation products, use the existing product-level helper.
                    */
                    if ($product->is_type('variation')) {
                        $level_price = get_post_meta($product->get_id(), '_level_' . $level_id . '_price', true);
                    } else {
                        $level_price = shoshin_get_pmpro_level_price_for_product($product, $level_id);
                    }

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


/* =========================================================
 * SHOSHIN — AJAX Add to Cart Endpoint
 * Handles single-product form submissions reliably
 * ========================================================= */
add_action('wp_ajax_shoshin_ajax_add_to_cart', 'shoshin_ajax_add_to_cart');
add_action('wp_ajax_nopriv_shoshin_ajax_add_to_cart', 'shoshin_ajax_add_to_cart');

function shoshin_ajax_add_to_cart() {
    if (!function_exists('WC') || !WC()->cart) {
        wp_send_json_error([
            'message' => 'WooCommerce cart is unavailable.',
        ]);
    }

    if (
        empty($_POST['nonce']) ||
        !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['nonce'])), 'shoshin_ajax_add_to_cart')
    ) {
        wp_send_json_error([
            'message' => 'Invalid nonce.',
        ]);
    }

    $product_id   = isset($_POST['product_id']) ? absint($_POST['product_id']) : 0;
    $quantity     = isset($_POST['quantity']) ? wc_stock_amount(wp_unslash($_POST['quantity'])) : 1;
    $variation_id = isset($_POST['variation_id']) ? absint($_POST['variation_id']) : 0;
    $variation    = [];

    if (!empty($_POST['variation']) && is_array($_POST['variation'])) {
        foreach ((array) $_POST['variation'] as $key => $value) {
            $variation[sanitize_text_field(wp_unslash($key))] = sanitize_text_field(wp_unslash($value));
        }
    }

    if (!$product_id) {
        wp_send_json_error([
            'message' => 'Missing product ID.',
        ]);
    }

    $product = wc_get_product($variation_id ?: $product_id);

    if (!$product) {
        wp_send_json_error([
            'message' => 'Invalid product.',
        ]);
    }

    $passed_validation = apply_filters(
        'woocommerce_add_to_cart_validation',
        true,
        $product_id,
        $quantity,
        $variation_id,
        $variation
    );

    if (!$passed_validation) {
        wp_send_json_error([
            'message'     => 'Validation failed.',
            'product_url' => get_permalink($product_id),
        ]);
    }

    $cart_item_key = WC()->cart->add_to_cart(
        $product_id,
        $quantity,
        $variation_id,
        $variation
    );

    if (!$cart_item_key) {
        wp_send_json_error([
            'message'     => 'Add to cart failed.',
            'product_url' => get_permalink($product_id),
        ]);
    }

    wp_send_json_success([
        'product_id'   => $product_id,
        'variation_id' => $variation_id,
        'cart_item_key'=> $cart_item_key,
    ]);
}

/* =========================================================
 * SHOSHIN — Shared Add-to-Cart UX Config
 * WPCode version: print config object for JS snippet consumption
 * ========================================================= */
add_action('wp_footer', function () {
    if (is_admin()) {
        return;
    }

    if (
        !function_exists('is_shop') ||
        !function_exists('is_product') ||
        !(is_shop() || is_product_taxonomy() || is_product_category() || is_product_tag() || is_product())
    ) {
        return;
    }

    $config = [
        'ajax_url'             => admin_url('admin-ajax.php'),
        'wc_ajax_url'          => function_exists('WC_AJAX') ? WC_AJAX::get_endpoint('%%endpoint%%') : '',
        'nonce'                => wp_create_nonce('shoshin_ajax_add_to_cart'),
        'loop_button_selector' => 'ul.products li.product a.ajax_add_to_cart',
        'menu_cart_selector'   => '.hdr-right .elementor-menu-cart__toggle a, .hdr-right .elementor-menu-cart__toggle .elementor-button, .elementor-widget-woocommerce-menu-cart a.elementor-menu-cart__toggle_button, .elementor-menu-cart__toggle a',
        'panel_selector'       => '.elementor-menu-cart__container',
        'restore_delay'        => 2400,
        'open_delay'           => 60,
        'confirm_text'         => 'Added to Cart',
    ];
    ?>
    <script>
      window.shoshinCart = <?php echo wp_json_encode($config); ?>;
    </script>
    <?php
}, 99);