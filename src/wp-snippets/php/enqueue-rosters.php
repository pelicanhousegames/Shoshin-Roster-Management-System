<?php
/**
 * Shoshin - My Rosters Shortcode + AJAX (WPCode-safe)
 * Usage: [shoshin_my_rosters]
 *
 * Phase 4A/4B: Roster card render + assigned_units_json persistence
 *
 * Form: 2799
 * Field IDs:
 *  - #3  refId
 *  - #5  clan name
 *  - #8  roster icon upload (url)
 *  - #9  assigned_units_json (hidden)
 *  - #10 assigned_units_digest (hidden)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** -----------------------------
 *  Helpers: normalize WPForms fields
 *  ----------------------------- */
if ( ! function_exists( 'shoshin_normalize_wpforms_fields' ) ) {
	function shoshin_normalize_wpforms_fields( $raw_fields ) {

		if ( is_string( $raw_fields ) ) {
			if ( function_exists( 'wpforms_decode' ) ) {
				$decoded = wpforms_decode( $raw_fields );
			} else {
				$decoded = maybe_unserialize( $raw_fields );
				if ( is_string( $decoded ) ) {
					$tmp = json_decode( $decoded, true );
					if ( is_array( $tmp ) ) {
						$decoded = $tmp;
					}
				}
			}
		} else {
			$decoded = $raw_fields;
		}

		if ( ! is_array( $decoded ) ) {
			return [];
		}

		$first_key = array_key_first( $decoded );
		if ( is_int( $first_key ) && isset( $decoded[ $first_key ]['id'] ) ) {
			$mapped = [];
			foreach ( $decoded as $field ) {
				if ( isset( $field['id'] ) ) {
					$mapped[ $field['id'] ] = $field;
				}
			}
			return $mapped;
		}

		return $decoded;
	}
}

if ( ! function_exists( 'shoshin_get_wpforms_field_value' ) ) {
	function shoshin_get_wpforms_field_value( $fields, $field_id, $default = '' ) {
		if ( empty( $fields ) || ! isset( $fields[ $field_id ] ) ) {
			return $default;
		}

		$field = $fields[ $field_id ];

		if ( is_array( $field ) && isset( $field['value'] ) ) {
			$value = $field['value'];
			if ( is_array( $value ) ) {
				$value = implode( "\n", array_map( 'trim', $value ) );
			}
			return (string) $value;
		}

		if ( is_scalar( $field ) ) {
			return (string) $field;
		}

		return $default;
	}
}

/** -----------------------------
 *  Roster builder (PHP → JSON model)
 *  ----------------------------- */
if ( ! function_exists( 'shoshin_build_roster' ) ) {
	function shoshin_build_roster( $entry ) {

		$raw_fields = '';
		$entry_id   = 0;

		if ( is_array( $entry ) ) {
			$raw_fields = $entry['fields'] ?? '';
			$entry_id   = isset( $entry['entry_id'] ) ? (int) $entry['entry_id'] : 0;
		} elseif ( is_object( $entry ) ) {
			$raw_fields = $entry->fields ?? '';
			$entry_id   = isset( $entry->entry_id ) ? (int) $entry->entry_id : 0;
		}

		$fields = shoshin_normalize_wpforms_fields( $raw_fields );

		// Field mapping (2799)
		$ref_id   = shoshin_get_wpforms_field_value( $fields, 3, '' );
		$name     = shoshin_get_wpforms_field_value( $fields, 5, '' );
		$icon     = shoshin_get_wpforms_field_value( $fields, 8, '' );
		$assigned = shoshin_get_wpforms_field_value( $fields, 9, '' );
		$digest   = shoshin_get_wpforms_field_value( $fields, 10, '' );

		return [
			'kind'                  => 'roster',
			'entryId'               => $entry_id,
			'refId'                 => $ref_id,
			'name'                  => $name,
			'icon'                  => $icon,

			// Row 3 (Task 1+): stored snapshot
			'assigned_units_json'   => $assigned,
			'assigned_units_digest' => $digest,

			// Phase placeholders (keep your current JS expectations)
			'points'     => 0,
			'initiative' => 0,
			'honor'      => 0,
			'unitCount'  => 0,
			'counts'     => [
				'Daimyo'    => 0,
				'Samurai'   => 0,
				'Ashigaru'  => 0,
				'Sohei'     => 0,
				'Ninja'     => 0,
				'Onmyoji'   => 0,
				'Artillery' => 0,
				'Ships'     => 0,
			],
		];
	}
}

/** -----------------------------
 *  AJAX: unassign one grouped unit (decrement qty or remove row)
 *  Expects POST:
 *   - rosterEntryId (int)
 *   - unitKey (string)  (client-generated stable key for a grouped row)
 *   - nonce
 *  ----------------------------- */
if ( ! function_exists( 'shoshin_rosters_ajax_nonce_action' ) ) {
	function shoshin_rosters_ajax_nonce_action() {
		return 'shoshin_rosters_ajax_v1';
	}
}

if ( ! function_exists( 'shoshin_ajax_unassign_unit' ) ) {
	function shoshin_ajax_unassign_unit() {

		if ( ! function_exists( 'wpforms' ) ) {
			wp_send_json_error( [ 'message' => 'WPForms is not available.' ], 500 );
		}

		if ( ! is_user_logged_in() ) {
			wp_send_json_error( [ 'message' => 'You must be logged in.' ], 401 );
		}

		check_ajax_referer( shoshin_rosters_ajax_nonce_action(), 'nonce' );

		$entry_id = isset( $_POST['rosterEntryId'] ) ? absint( $_POST['rosterEntryId'] ) : 0;
		$unit_key = isset( $_POST['unitKey'] ) ? sanitize_text_field( wp_unslash( $_POST['unitKey'] ) ) : '';

		if ( ! $entry_id || $unit_key === '' ) {
			wp_send_json_error( [ 'message' => 'Missing rosterEntryId or unitKey.' ], 400 );
		}

		$entry = wpforms()->entry->get( $entry_id );
		if ( ! $entry || empty( $entry->entry_id ) ) {
			wp_send_json_error( [ 'message' => 'Roster entry not found.' ], 404 );
		}

		// Ensure correct form
		$form_id = isset( $entry->form_id ) ? (int) $entry->form_id : 0;
		if ( $form_id !== 2799 ) {
			wp_send_json_error( [ 'message' => 'Invalid roster form.' ], 403 );
		}

		// Ownership check (WPForms commonly uses user_id; some installs may use created_by)
		$current_user_id = get_current_user_id();
		$owner_id        = 0;
		if ( isset( $entry->user_id ) ) {
			$owner_id = (int) $entry->user_id;
		} elseif ( isset( $entry->created_by ) ) {
			$owner_id = (int) $entry->created_by;
		}

		if ( $owner_id !== $current_user_id ) {
			wp_send_json_error( [ 'message' => 'Not authorized for this roster.' ], 403 );
		}

		// Decode entry fields JSON
		$entry_fields = json_decode( (string) $entry->fields, true );
		if ( ! is_array( $entry_fields ) ) {
			$entry_fields = [];
		}

		// Normalize to [field_id] => field array
		$fields_by_id = shoshin_normalize_wpforms_fields( $entry_fields );

		$assigned_raw = shoshin_get_wpforms_field_value( $fields_by_id, 9, '' );
		$assigned_arr = [];

		if ( is_string( $assigned_raw ) && trim( $assigned_raw ) !== '' ) {
			$tmp = json_decode( $assigned_raw, true );
			if ( is_array( $tmp ) ) {
				$assigned_arr = $tmp;
			}
		}

		if ( ! is_array( $assigned_arr ) ) {
			$assigned_arr = [];
		}

		// Normalize numeric indexes before splicing
		$assigned_arr = array_values( $assigned_arr );

		// -----------------------------
		// TASK 5: Hardened matching
		// -----------------------------
		$found       = false;
		$found_index = -1;

		$canon = function( $v ) {
			$v = is_scalar( $v ) ? (string) $v : '';
			$v = trim( $v );
			$v = preg_replace( '/\s+/', ' ', $v );
			if ( function_exists( 'mb_strtolower' ) ) {
				return mb_strtolower( $v );
			}
			return strtolower( $v );
		};

		// Incoming unitKey, canonicalized
		$unit_key_exact = trim( (string) $unit_key );
		$unit_key_lc    = $canon( $unit_key_exact );

		// Best-effort signature from unitKey if formatted as kind|cls|refId|name|img
		$unit_sig = '';
		$parts    = explode( '|', $unit_key_exact );
		if ( count( $parts ) >= 5 ) {
			$unit_sig =
				$canon( $parts[0] ) . '|' .
				$canon( $parts[1] ) . '|' .
				$canon( $parts[2] ) . '|' .
				$canon( $parts[3] ) . '|' .
				$canon( $parts[4] );
		}

		$item_sig = function( $it ) use ( $canon ) {
			$kind = $canon( $it['kind'] ?? '' );
			$cls  = $canon( $it['cls'] ?? ( $it['class'] ?? ( $it['supportType'] ?? '' ) ) );
			$ref  = $canon( $it['refId'] ?? ( $it['ref_id'] ?? '' ) );
			$name = $canon( $it['name'] ?? ( $it['title'] ?? '' ) );
			$img  = $canon( $it['img'] ?? ( $it['image'] ?? ( $it['imgUrl'] ?? '' ) ) );
			return $kind . '|' . $cls . '|' . $ref . '|' . $name . '|' . $img;
		};

		for ( $i = 0; $i < count( $assigned_arr ); $i++ ) {
			$item = is_array( $assigned_arr[ $i ] ) ? $assigned_arr[ $i ] : [];

			$key_exact = isset( $item['unitKey'] ) ? trim( (string) $item['unitKey'] ) : '';
			$key_lc    = $canon( $key_exact );

			// 1) Exact unitKey
			if ( $key_exact !== '' && $key_exact === $unit_key_exact ) {
				$found       = true;
				$found_index = $i;
				break;
			}

			// 2) Case-insensitive unitKey
			if ( $key_exact !== '' && $key_lc === $unit_key_lc ) {
				$found       = true;
				$found_index = $i;
				break;
			}

			// 3) Fallback signature match (only if unitKey has 5+ parts)
			if ( $unit_sig !== '' && $item_sig( $item ) === $unit_sig ) {
				$found       = true;
				$found_index = $i;
				break;
			}
		}

		if ( ! $found || $found_index < 0 ) {
			wp_send_json_error( [ 'message' => 'Unit not found in roster assignment list.' ], 404 );
		}

		// Decrement qty or remove row
		$qty = 1;
		if ( isset( $assigned_arr[ $found_index ]['qty'] ) ) {
			$qty = max( 1, (int) $assigned_arr[ $found_index ]['qty'] );
		}

		if ( $qty > 1 ) {
			$assigned_arr[ $found_index ]['qty'] = $qty - 1;
		} else {
			array_splice( $assigned_arr, $found_index, 1 );
		}

		// Write back to field #9 and update digest #10
		$new_assigned_json = wp_json_encode( array_values( $assigned_arr ) );
		$new_digest        = sha1( $new_assigned_json );

		if ( ! isset( $fields_by_id[9] ) || ! is_array( $fields_by_id[9] ) ) {
			$fields_by_id[9] = [ 'id' => 9 ];
		}
		$fields_by_id[9]['value'] = $new_assigned_json;

		if ( ! isset( $fields_by_id[10] ) || ! is_array( $fields_by_id[10] ) ) {
			$fields_by_id[10] = [ 'id' => 10 ];
		}
		$fields_by_id[10]['value'] = $new_digest;

		// Convert back into a JSON structure WPForms accepts.
		$save_fields_json = wp_json_encode( $fields_by_id );

		// Persist update
		$updated = wpforms()->entry->update(
			$entry_id,
			[ 'fields' => $save_fields_json ],
			'',
			'',
			[ 'cap' => false ]
		);

		if ( empty( $updated ) ) {
			wp_send_json_error( [ 'message' => 'Failed to update roster entry.' ], 500 );
		}

		wp_send_json_success( [
			'entryId'               => $entry_id,
			'assigned_units_json'   => $new_assigned_json,
			'assigned_units_digest' => $new_digest,
		] );
	}
}

add_action( 'wp_ajax_shoshin_unassign_unit', 'shoshin_ajax_unassign_unit' );

/** -----------------------------
 *  Shortcode: output wrapper + JSON payload + ajax config
 *  ----------------------------- */
if ( ! function_exists( 'shoshin_my_rosters_shortcode' ) ) {

	function shoshin_my_rosters_shortcode() {

		if ( ! function_exists( 'wpforms' ) ) {
			return '<p>WPForms is not available.</p>';
		}

		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return '<p>You must be logged in to view your rosters.</p>';
		}

		$entries = wpforms()->entry->get_entries( [
			'form_id' => 2799,
			'user_id' => $user_id,
			'number'  => 999,
			'order'   => 'ASC',
		] );

		$rosters = [];
		if ( is_array( $entries ) ) {
			foreach ( $entries as $entry ) {
				$rosters[] = shoshin_build_roster( $entry );
			}
		}

		// Sort by Reference ID ASC, then entryId ASC (stable)
		if ( ! empty( $rosters ) ) {
			usort( $rosters, function( $a, $b ) {
				$ra  = isset( $a['refId'] ) ? (string) $a['refId'] : '';
				$rb  = isset( $b['refId'] ) ? (string) $b['refId'] : '';
				$cmp = strnatcasecmp( $ra, $rb );
				if ( $cmp !== 0 ) {
					return $cmp;
				}

				$ea = isset( $a['entryId'] ) ? (int) $a['entryId'] : 0;
				$eb = isset( $b['entryId'] ) ? (int) $b['entryId'] : 0;
				if ( $ea === $eb ) {
					return 0;
				}
				return ( $ea < $eb ) ? -1 : 1;
			} );
		}

		$json     = wp_json_encode( $rosters );
		$ajax_url = admin_url( 'admin-ajax.php' );
		$nonce    = wp_create_nonce( shoshin_rosters_ajax_nonce_action() );

		return sprintf(
			'<div class="shoshin-roster-list-wrapper"><div class="shoshin-roster-list" data-shoshin-rosters-json="%s" data-shoshin-ajax-url="%s" data-shoshin-ajax-nonce="%s"></div></div>',
			esc_attr( $json ),
			esc_attr( $ajax_url ),
			esc_attr( $nonce )
		);
	}

	add_shortcode( 'shoshin_my_rosters', 'shoshin_my_rosters_shortcode' );
}
