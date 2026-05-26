<?php
/**
 * SHOSHIN — Product Filter Taxonomies
 *
 * Purpose:
 * - Move storefront filter metadata out of Woo attributes
 * - Keep Shop3D-owned attributes isolated (Material, Color)
 * - Expose filter taxonomies on Woo product edit screens
 *
 * EDIT 1 REVISION:
 * - use category-style checkbox boxes on product edit screens
 * - do NOT add columns to the All Products admin table
 */

add_action('init', function () {
    $taxonomies = array(
        'product_estimated_delivery' => array(
            'label'        => 'Estimated Delivery',
            'plural_label' => 'Estimated Delivery',
            'slug'         => 'estimated-delivery',
            'hierarchical' => true,
        ),
        'product_fulfillment' => array(
            'label'        => 'Fulfillment',
            'plural_label' => 'Fulfillment',
            'slug'         => 'fulfillment',
            'hierarchical' => true,
        ),
        'product_color' => array(
            'label'        => 'Color',
            'plural_label' => 'Color',
            'slug'         => 'color',
            'hierarchical' => true,
        ),
        'product_material' => array(
            'label'        => 'Material',
            'plural_label' => 'Material',
            'slug'         => 'material',
            'hierarchical' => true,
        ),
        'product_artist' => array(
            'label'        => 'Artist',
            'plural_label' => 'Artists',
            'slug'         => 'artist',
            'hierarchical' => true,
        ),
        'product_scale' => array(
            'label'        => 'Scale',
            'plural_label' => 'Scale',
            'slug'         => 'scale',
            'hierarchical' => true,
        ),
        'product_storyteller' => array(
            'label'        => 'Storyteller',
            'plural_label' => 'Storytellers',
            'slug'         => 'storyteller',
            'hierarchical' => true,
        ),
        'product_line' => array(
            'label'        => 'Product Line',
            'plural_label' => 'Product Lines',
            'slug'         => 'product-line',
            'hierarchical' => true,
        ),
        'product_type' => array(
            'label'        => 'Product Type',
            'plural_label' => 'Product Types',
            'slug'         => 'product-type',
            'hierarchical' => true,
        ),
        'product_hobby_use' => array(
            'label'        => 'Hobby Use',
            'plural_label' => 'Hobby Use',
            'slug'         => 'hobby-use',
            'hierarchical' => true,
        ),
        'product_item_format' => array(
            'label'        => 'Item Format',
            'plural_label' => 'Item Formats',
            'slug'         => 'item-format',
            'hierarchical' => true,
        ),
    );

    foreach ($taxonomies as $taxonomy => $args) {
        register_taxonomy($taxonomy, array('product'), array(
            'labels' => array(
                'name'              => $args['plural_label'],
                'singular_name'     => $args['label'],
                'search_items'      => 'Search ' . $args['plural_label'],
                'all_items'         => 'All ' . $args['plural_label'],
                'edit_item'         => 'Edit ' . $args['label'],
                'update_item'       => 'Update ' . $args['label'],
                'add_new_item'      => 'Add New ' . $args['label'],
                'new_item_name'     => 'New ' . $args['label'] . ' Name',
                'menu_name'         => $args['plural_label'],
            ),
            'public'              => true,
            'show_ui'             => true,
            'show_in_menu'        => true,
            'show_admin_column'   => false,
            'show_in_quick_edit'  => false,
            'show_in_nav_menus'   => false,
            'show_tagcloud'       => false,
            'hierarchical'        => true,
            'rewrite'             => array(
                'slug'       => $args['slug'],
                'with_front' => false,
            ),
            'query_var'           => true,
            'show_in_rest'        => true,
            'meta_box_cb'         => null,
        ));
    }
}, 20);