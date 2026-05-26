hoshin Shippo Bridge

Contributors: Pelican House Games
Tags: woocommerce, shipping, shippo, fulfillment, logistics
Requires at least: 6.0
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 2.6.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Description

Shoshin Shippo Bridge is a custom WooCommerce integration that provides a fully controlled shipping workflow powered by Shippo.

It replaces fragmented shipping tools with a unified admin experience, allowing store operators to:

Configure shipments directly inside WooCommerce orders
Retrieve real-time carrier rates via Shippo
Purchase and print shipping labels
Generate packing slips
Track shipments and manage fulfillment status
Maintain a persistent snapshot of shipment data at the time of purchase

The plugin is designed to mirror the usability of WooCommerce Shipping while preserving complete control over logic, UI, and data handling.

Features
Admin Shipping Workflow
Create and manage shipments directly from the WooCommerce order screen
Custom package configuration (dimensions, weight, carrier presets)
Real-time rate retrieval via Shippo API
Carrier/service selection with visual rate cards
Purchased shipment state with locked UI
Label & Document Handling
Print shipping labels directly from the order
Generate packing slips (8.5 × 11 format)
Persist label URL and transaction data for later access
Shipment Tracking
Display tracking number, carrier, service, and status
Store and use provider tracking URLs when available
Fallback handling for delayed or missing tracking data
Snapshot System (Core Architecture)

At the moment of label purchase, a snapshot is stored containing:

Carrier (provider)
Service level
Rate (amount and currency)
Tracking number
Tracking URL
Label URL
Carrier logo

This ensures that shipment data remains consistent even if external APIs change.

Order Integration
Optional automatic order completion after label purchase
Synchronization with Shippo fulfillment status
Persistent shipment metadata stored in WooCommerce order meta
Installation
Upload the plugin folder to /wp-content/plugins/
Activate the plugin through the WordPress admin panel
Configure your Shippo API key in plugin settings (if applicable)
Open a WooCommerce order to begin using the shipping interface
Usage
Creating a Shipment
Open a WooCommerce order
Expand the Shipping Label panel
Enter package details (dimensions, weight, etc.)
Click Get Rates
Selecting a Rate
Review available carrier rates
Select a service
Click Purchase Shipping Label
After Purchase
A success banner will confirm label creation
Print options become available:
Print packing slip
Print shipping label
Shipment details are locked and stored
Tracking
Tracking information appears in the Shipment Tracking side panel
If available, tracking links can be accessed directly
Known Limitations
USPS Tracking / Label Hydration

In some cases (especially test mode), USPS transactions may return:

Transaction ID without tracking number
Missing or delayed label URL

The plugin includes fallback logic, but full resolution may require:

Secondary transaction fetch (GET /transactions/{id})
Carrier-specific handling
Multi-Package Shipments
Not yet implemented
Shippo supports multi-piece shipments for some carriers (e.g., UPS)
USPS does not support multi-piece shipments in a single request
Shipment Options (Advanced)

The following options are currently UI-level and not fully mapped:

Hazardous materials
Return label
Dry ice (requires additional weight input)

Carrier-specific implementation is required for full support.

Roadmap
In Progress
Label print size options (4x6 default, 8.5×11 alternate)
Post-purchase action links:
Track shipment
Schedule pickup
Request refund
Return label
Planned
Shipment option persistence and purchase-time locking
Multi-package shipment support (UPS-first implementation)
Mixed-cart fulfillment handling (POD + warehouse + digital)
Full carrier-specific option mapping (hazmat, returns, dry ice)
Technical Overview
Core Components
class-ssb-shippo-client.php
Handles API communication with Shippo
class-ssb-ajax.php
Manages AJAX endpoints for rates and label purchase
class-ssb-admin-order-ui.php
Renders admin interface components
admin.js
Controls UI state, rate selection, and purchase flow
admin.css
Styles the admin interface
Data Storage

Key order meta fields:

_shoshin_shippo_transaction_id
_shoshin_shippo_tracking_number
_shoshin_shippo_tracking_url
_shoshin_shippo_label_url
_shoshin_shippo_selected_rate_snapshot
Changelog
2.6.4
Rebuilt admin shipping interface to align with WooCommerce Shipping UX
Implemented persistent shipment snapshot system
Added carrier logos and static purchased-rate cards
Introduced tracking URL storage and fallback handling
Improved success messaging and removed redundant notices
Added User Paid vs Selected Rate comparison with color indicators
Fixed sidebar collapse/expand behavior
Improved transaction hydration logic for delayed carrier responses
License

This plugin is licensed under the GPLv2 or later.

Author

Pelican House Games
Shoshin: The Path of Ascension