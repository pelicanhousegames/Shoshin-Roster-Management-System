<?php
/**
 * Shoshin: AJAX delete WPForms entry (My Assets)
 * - Deletes only entries owned by current user
 * - Restricts to forms 2247 (Character) and 2501 (Support Asset)
 * - Exposes window.ShoshinAjax { ajaxUrl, nonce } on /my-assets
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Emit AJAX config on /my-assets (front-end).
 * This does NOT hard-reference any script filename/handle from the repo.
 */
add_action( 'wp_footer', function () {
	// Scope strictly to /my-assets page.
	if ( ! is_page( 'my-assets' ) ) {
		return;
	}

	if ( ! is_user_logged_in() ) {
		return;
	}

	$payload = array(
		'ajaxUrl' => admin_url( 'admin-ajax.php' ),
		'nonce'   => wp_create_nonce( 'shoshin_delete_entry' ),
	);

	echo '<script>';
	echo 'window.ShoshinAjax = window.ShoshinAjax || ' . wp_json_encode( $payload ) . ';';
	echo '</script>';
}, 20 );

/**
 * AJAX: delete entry.
 */
add_action( 'wp_ajax_shoshin_delete_wpforms_entry', function () {

	if ( ! is_user_logged_in() ) {
		wp_send_json_error( array( 'message' => 'Not authenticated.' ), 401 );
	}

	$nonce = isset( $_POST['nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['nonce'] ) ) : '';
	if ( ! wp_verify_nonce( $nonce, 'shoshin_delete_entry' ) ) {
		wp_send_json_error( array( 'message' => 'Invalid security token.' ), 403 );
	}

	if ( ! function_exists( 'wpforms' ) || ! isset( wpforms()->entry ) ) {
		wp_send_json_error( array( 'message' => 'WPForms entry handler unavailable.' ), 500 );
	}

	$entry_id = isset( $_POST['entryId'] ) ? absint( $_POST['entryId'] ) : 0;
	if ( ! $entry_id ) {
		wp_send_json_error( array( 'message' => 'Missing entryId.' ), 400 );
	}

	// Fetch entry (robust across WPForms versions).
	$entry = null;

	// Preferred: get( $entry_id )
	if ( method_exists( wpforms()->entry, 'get' ) ) {
		$entry = wpforms()->entry->get( $entry_id );
	}

	// Fallback: get_entries with entry_id filter
	if ( empty( $entry ) && method_exists( wpforms()->entry, 'get_entries' ) ) {
		$rows = wpforms()->entry->get_entries( array(
			'entry_id' => $entry_id,
			'number'   => 1,
		) );
		if ( is_array( $rows ) && ! empty( $rows[0] ) ) {
			$entry = $rows[0];
		}
	}

	if ( empty( $entry ) ) {
		wp_send_json_error( array( 'message' => 'Entry not found.' ), 404 );
	}

	// Normalize object/array access.
	$entry_user_id = is_object( $entry ) ? (int) ( $entry->user_id ?? 0 ) : (int) ( $entry['user_id'] ?? 0 );
	$form_id       = is_object( $entry ) ? (int) ( $entry->form_id ?? 0 ) : (int) ( $entry['form_id'] ?? 0 );

	$current_user_id = get_current_user_id();

	// Ownership check.
	if ( $entry_user_id !== $current_user_id ) {
		wp_send_json_error( array( 'message' => 'You do not have permission to delete this entry.' ), 403 );
	}

	// Form scope check.
	$allowed_forms = array( 2247, 2501 );
	if ( ! in_array( $form_id, $allowed_forms, true ) ) {
		wp_send_json_error( array( 'message' => 'Entry form is not eligible for deletion.' ), 403 );
	}

	// Delete entry.
	$deleted = false;
	if ( method_exists( wpforms()->entry, 'delete' ) ) {
		$deleted = (bool) wpforms()->entry->delete( $entry_id );
	}

	if ( ! $deleted ) {
		wp_send_json_error( array( 'message' => 'Delete failed.' ), 500 );
	}

	wp_send_json_success( array(
		'entryId' => $entry_id,
		'formId'  => $form_id,
	) );
} );
