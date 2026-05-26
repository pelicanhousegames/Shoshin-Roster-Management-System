<?php
add_filter('woocommerce_post_class', function ($classes, $product) {
    if (!$product || !is_a($product, 'WC_Product')) {
        return $classes;
    }

    $taxonomy_map = array(
        'category'           => 'product_cat',
        'special_offers'     => 'product_tag',
        'item_format'        => 'product_item_format',
        'estimated_delivery' => 'product_estimated_delivery',
        'material'           => 'product_material',
        'color'              => 'product_color',
        'scale'              => 'product_scale',
        'fulfillment'        => 'product_fulfillment',
        'product_line'       => 'product_line',
        'product_type'       => 'product_type',
        'storyteller'        => 'product_storyteller',
        'brand'              => 'product_brand',
        'artist'             => 'product_artist',
        'hobby_use'          => 'product_hobby_use',
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