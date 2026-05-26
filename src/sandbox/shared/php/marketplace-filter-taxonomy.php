<?php
add_filter('woocommerce_post_class', function ($classes, $product) {
    if (!$product || !is_a($product, 'WC_Product')) {
        return $classes;
    }

    $taxonomy_map = array(
        'category'           => 'product_cat',
        'special_offers'     => 'product_tag',
        'item_format'        => 'pa_item-format',
        'estimated_delivery' => 'pa_estimated-delivery',
        'material'           => 'pa_material',
        'scale'              => 'pa_scale',
        'fulfillment'        => 'pa_fulfillment',
        'product_line'       => 'pa_product-line',
        'product_type'       => 'pa_product-type',
        'storyteller'        => 'pa_storyteller',
        'brand'              => 'product_brand',
        'artist'             => 'pa_artist',
        'hobby_use'          => 'pa_hobby-use',
    );

    foreach ($taxonomy_map as $var_name => $taxonomy) {
        $terms = get_the_terms($product->get_id(), $taxonomy);

        if (empty($terms) || is_wp_error($terms)) {
            continue;
        }

        foreach ($terms as $term) {
            if (!empty($term->slug)) {
                $classes[] = 'fev-' . sanitize_html_class($var_name) . '-' . sanitize_html_class($term->slug);
            }
        }
    }

    return array_values(array_unique($classes));
}, 20, 2);