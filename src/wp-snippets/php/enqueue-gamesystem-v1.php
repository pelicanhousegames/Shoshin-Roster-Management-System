<?php
/* =======================================================================================================================
BEGIN SHOSHIN GAME SYSTEM (MVP) — /game-system
- Shortcode: [shoshin_game_system]
- Outputs ONLY the filter UI + content host (no embedded tables here — tables are hard-coded inside game-system.js)
- Enqueues:
  - game-system.js (expected at: /wp-content/uploads/shoshin/game-system.js)
  - (optional) shoshin-common.css is assumed to already be loaded site-wide; we do not force-enqueue it here.
- Scope: new /game-system page only. No dependencies on /my-assets, /my-rosters, QR, or assignment systems.
======================================================================================================================= */

/**
 * Location of the JS file on your site.
 * - Put the JS file at: wp-content/uploads/shoshin/game-system.js
 * - This snippet will auto-resolve the correct uploads base URL.
 */
if ( ! defined( 'SHOSHIN_GS_JS_RELATIVE' ) ) {
  define( 'SHOSHIN_GS_JS_RELATIVE', 'shoshin/game-system.js' );
}

if ( ! function_exists( 'shoshin_gs_asset_url' ) ) {
  function shoshin_gs_asset_url( $relative_path ) {
    $uploads = wp_upload_dir();
    $baseurl = isset( $uploads['baseurl'] ) ? $uploads['baseurl'] : '';
    if ( ! $baseurl ) return '';
    return rtrim( $baseurl, '/' ) . '/' . ltrim( $relative_path, '/' );
  }
}

if ( ! function_exists( 'shoshin_game_system_enqueue' ) ) {
  function shoshin_game_system_enqueue() {
    // Only enqueue on the /game-system page OR where shortcode is present (safe + lean).
    $should = false;

    if ( function_exists( 'is_page' ) && is_page( 'game-system' ) ) {
      $should = true;
    }

    // Fallback: check shortcode in the current post content
    if ( ! $should && function_exists( 'get_post' ) ) {
      $post = get_post();
      if ( $post && isset( $post->post_content ) && has_shortcode( $post->post_content, 'shoshin_game_system' ) ) {
        $should = true;
      }
    }

    if ( ! $should ) return;

    $src = shoshin_gs_asset_url( SHOSHIN_GS_JS_RELATIVE );
    if ( ! $src ) return;

    // Cache bust by filemtime if the file exists on disk.
    $ver = '2026-02-03-02';
    $uploads = wp_upload_dir();
    $basedir = isset( $uploads['basedir'] ) ? $uploads['basedir'] : '';
    if ( $basedir ) {
      $abs = rtrim( $basedir, '/' ) . '/' . ltrim( SHOSHIN_GS_JS_RELATIVE, '/' );
      if ( file_exists( $abs ) ) {
        $ver = (string) filemtime( $abs );
      }
    }

    wp_enqueue_script( 'shoshin-game-system', $src, array(), $ver, true );
  }
  add_action( 'wp_enqueue_scripts', 'shoshin_game_system_enqueue' );
}

if ( ! function_exists( 'shoshin_game_system_shortcode' ) ) {
  function shoshin_game_system_shortcode() {
    ob_start();
    ?>
    <!-- BEGIN SHOSHIN GAME SYSTEM SHORTCODE HOST -->
    <div id="shoshin-game-system" class="shoshin-game-system-wrap">

      <!-- Tier 1 Filters (Desktop) -->
      <div class="shoshin-asset-filters shoshin-gs-tier1" role="tablist" aria-label="Game System Sections">
        <button type="button" class="shoshin-asset-filter-btn is-active" data-gs-tier1="Characters">Characters</button>
        <button type="button" class="shoshin-asset-filter-btn" data-gs-tier1="Armory">Armory</button>
        <button type="button" class="shoshin-asset-filter-btn" data-gs-tier1="Dojo">Dojo</button>
        <button type="button" class="shoshin-asset-filter-btn" data-gs-tier1="Yokai">Yokai</button>
        <button type="button" class="shoshin-asset-filter-btn" data-gs-tier1="Tables">Tables</button>
      </div>

  <!-- Tier 1 Filters (Mobile Dropdown) REMOVED (per design) -->

      <!-- Tier 2 Filters (Desktop) -->
      <div class="shoshin-asset-filters shoshin-gs-tier2" role="tablist" aria-label="Section Filters"></div>

      <!-- Tier 2 Filters (Mobile Dropdown) REMOVED (per design) -->


      <!-- Content Host -->
      <div id="shoshin-gs-content" class="shoshin-gs-content"></div>

    </div>
    <!-- END SHOSHIN GAME SYSTEM SHORTCODE HOST -->
    <?php
    return ob_get_clean();
  }

  add_shortcode( 'shoshin_game_system', 'shoshin_game_system_shortcode' );
}

/* =======================================================================================================================
END SHOSHIN GAME SYSTEM (MVP)
======================================================================================================================= */
