<?php
/**
 * Plugin Name: Shoshin Fulfillment Bridge
 * Description: WooCommerce → Shippo fulfillment engine with multi-lane support for warehouse, vendor, and automated dropshipping operations, including rates, labels, tracking, and webhooks.
 * Version: 1.2.5
 * Author: Pelican House Games
 * Requires at least: 6.7
 * Tested up to: 6.8
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * DEFINE CONSTANTS
 */
define('SSB_VERSION', '1.2.5');
define('SSB_PATH', plugin_dir_path(__FILE__));
define('SSB_URL', plugin_dir_url(__FILE__));
define('SSB_BASENAME', plugin_basename(__FILE__));

/**
 * REQUIRE CORE FILES
 */
require_once SSB_PATH . 'includes/class-ssb-settings.php';
require_once SSB_PATH . 'includes/class-ssb-shippo-client.php';
require_once SSB_PATH . 'includes/class-ssb-state.php';
require_once SSB_PATH . 'includes/class-ssb-packing-slip.php';
require_once SSB_PATH . 'includes/class-ssb-admin-order-ui.php';
require_once SSB_PATH . 'includes/class-ssb-ajax.php';
require_once SSB_PATH . 'includes/class-ssb-webhooks.php';
require_once SSB_PATH . 'includes/class-ssb-frontend.php';
require_once SSB_PATH . 'includes/class-ssb-multipackage.php';

/**
 * INIT PLUGIN
 */
add_action('plugins_loaded', function() {

    // Ensure WooCommerce exists
    if (!class_exists('WooCommerce')) {
        return;
    }

    // Boot all modules
    SSB_Settings::init();
    SSB_Shippo_Client::init();
    SSB_State::init();
    SSB_Packing_Slip::init();
    SSB_Admin_Order_UI::init();
    SSB_Ajax::init();
    SSB_Webhooks::init();
    SSB_Frontend::init();
    SSB_Multipackage::init();

});