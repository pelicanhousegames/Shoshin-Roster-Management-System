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

/** -----------------------------
 *  Centralized roster totals (authoritative)
 *  Computes the roster card stat strip from assigned_units_json
 *  ----------------------------- */

if ( ! function_exists( 'shoshin_parse_assigned_units_json' ) ) {
	function shoshin_parse_assigned_units_json( $json ) {
		if ( ! is_string( $json ) || trim( $json ) === '' ) return [];
		$decoded = json_decode( $json, true );
		return is_array( $decoded ) ? $decoded : [];
	}
}

if ( ! function_exists( 'shoshin_support_bucket' ) ) {
	function shoshin_support_bucket( $u ) {
		// Support Assets -> Artillery/Ships -> Ozutsu/Mokuzo Hansen (future-proof via fallbacks)
		$cls  = strtolower( trim( (string) ( $u['cls'] ?? $u['class'] ?? $u['className'] ?? '' ) ) );
		$name = strtolower( trim( (string) ( $u['name'] ?? $u['title'] ?? '' ) ) );
		$ref  = strtolower( trim( (string) ( $u['refId'] ?? $u['ref_id'] ?? '' ) ) );
		$stype = strtolower( trim( (string) ( $u['supportType'] ?? '' ) ) );

		// Ships: Mokuzo Hansen (and future ship types likely under cls "Sailing Ships")
		if ( $name === 'mokuzo hansen' || $cls === 'sailing ships' || $stype === 'ships' ) {
			return 'Ships';
		}

		// Artillery: Ozutsu (and future artillery types likely under cls "Artillery")
		if ( $stype === 'ozutsu' || $name === 'ozutsu' || $cls === 'artillery' ) {
			return 'Artillery';
		}

		// Unknown support type: not counted into Artillery/Ships yet
		return '';
	}
}

if ( ! function_exists( 'shoshin_compute_roster_totals_from_assigned' ) ) {
	function shoshin_compute_roster_totals_from_assigned( $assigned_arr ) {

		$tot_points = 0;
		$tot_units  = 0;
		$tot_ini    = 0;
		$tot_honor  = 0; // semantic: Honor = Leadership (LDR)

		$counts = [
			'Daimyo'    => 0,
			'Samurai'   => 0,
			'Ashigaru'  => 0,
			'Sohei'     => 0,
			'Ninja'     => 0,
			'Onmyoji'   => 0,
			'Artillery' => 0,
			'Ships'     => 0,
		];

		if ( ! is_array( $assigned_arr ) ) {
			$assigned_arr = [];
		}

		foreach ( $assigned_arr as $u ) {
			if ( ! is_array( $u ) ) continue;

			$kind = strtolower( trim( (string) ( $u['kind'] ?? '' ) ) );

			$qty = isset( $u['qty'] ) ? (int) $u['qty'] : 0;

			// Corruption guard: qty <= 0 should be treated as removed (do not count)
			if ( $qty <= 0 ) continue;

			// Points cost (a.k.a. asset card cost)
			$points = isset( $u['points'] ) ? (int) $u['points'] : 0;

			// Initiative
			$ini = 0;
			if ( isset( $u['ini'] ) ) $ini = (int) $u['ini'];
			elseif ( isset( $u['stats'] ) && is_array( $u['stats'] ) && isset( $u['stats']['ini'] ) ) $ini = (int) $u['stats']['ini'];

			// Honor semantic: Honor = Leadership (LDR)
			$ldr = 0;
			if ( isset( $u['ldr'] ) ) $ldr = (int) $u['ldr'];
			elseif ( isset( $u['stats'] ) && is_array( $u['stats'] ) && isset( $u['stats']['ldr'] ) ) $ldr = (int) $u['stats']['ldr'];

			// Character class counts (by cls)
			$cls = trim( (string) ( $u['cls'] ?? $u['class'] ?? '' ) );

			// Special rule: Daimyo is hard-capped at 1 even if corrupted qty > 1
			$eff_qty = $qty;
			if ( strcasecmp( $cls, 'Daimyo' ) === 0 ) {
				$eff_qty = 1;
			}

			// Aggregate totals using effective qty
			$tot_points += $points * $eff_qty;
			$tot_units  += $eff_qty;
			$tot_ini    += $ini * $eff_qty;
			$tot_honor  += $ldr * $eff_qty;

			// Class bucket counts
			if ( $kind === 'character' ) {
				if ( isset( $counts[ $cls ] ) ) {
					// Daimyo already capped via eff_qty
					$counts[ $cls ] += $eff_qty;
					if ( $cls === 'Daimyo' && $counts['Daimyo'] > 1 ) $counts['Daimyo'] = 1;
				}
			}

			// Support buckets
			if ( $kind === 'support' ) {
				$bucket = shoshin_support_bucket( $u );
				if ( $bucket && isset( $counts[ $bucket ] ) ) {
					$counts[ $bucket ] += $eff_qty;
				}
			}
		}

		return [
			'points'     => (int) $tot_points,
			'unitCount'  => (int) $tot_units,
			'initiative' => (int) $tot_ini,
			'honor'      => (int) $tot_honor,
			'counts'     => $counts,
		];
	}
}




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

		$assigned_arr = shoshin_parse_assigned_units_json( $assigned );
		$totals = shoshin_compute_roster_totals_from_assigned( $assigned_arr );

		return [
			'kind'                  => 'roster',
			'entryId'               => $entry_id,
			'refId'                 => $ref_id,
			'name'                  => $name,
			'icon'                  => $icon,

			// Row 3 (Task 1+): stored snapshot
			'assigned_units_json'   => $assigned,
			'assigned_units_digest' => $digest,

			// Centralized totals computed from assigned_units_json snapshot
			
			'points'     => $totals['points'],
			'initiative' => $totals['initiative'],
			'honor'      => $totals['honor'],
			'unitCount'  => $totals['unitCount'],
			'counts'     => $totals['counts'],

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
		// Prefer the shared nonce action if the shared AJAX file is active.
		if ( function_exists( 'shoshin_ajax_nonce_action' ) ) {
			return shoshin_ajax_nonce_action();
		}
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
 *  AJAX: set qty for a grouped unit (qty=0 removes row)
 *  Expects POST:
 *   - rosterEntryId (int)
 *   - unitKey (string)
 *   - qty (int >= 0)
 *   - nonce
 *  ----------------------------- */
if ( ! function_exists( 'shoshin_ajax_set_unit_qty' ) ) {
	function shoshin_ajax_set_unit_qty() {

		if ( ! function_exists( 'wpforms' ) ) {
			wp_send_json_error( [ 'message' => 'WPForms is not available.' ], 500 );
		}

		if ( ! is_user_logged_in() ) {
			wp_send_json_error( [ 'message' => 'You must be logged in.' ], 401 );
		}

		check_ajax_referer( shoshin_rosters_ajax_nonce_action(), 'nonce' );

		$entry_id = isset( $_POST['rosterEntryId'] ) ? absint( $_POST['rosterEntryId'] ) : 0;
		$unit_key = isset( $_POST['unitKey'] ) ? sanitize_text_field( wp_unslash( $_POST['unitKey'] ) ) : '';
		$qty      = isset( $_POST['qty'] ) ? intval( $_POST['qty'] ) : -1;

		if ( ! $entry_id || $unit_key === '' || $qty < 0 ) {
			wp_send_json_error( [ 'message' => 'Missing rosterEntryId, unitKey, or qty.' ], 400 );
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

		// Ownership check
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

		$assigned_arr = array_values( $assigned_arr );

		// -----------------------------
		// Reuse TASK 5 hardened matching
		// -----------------------------
		$canon = function( $v ) {
			$v = is_scalar( $v ) ? (string) $v : '';
			$v = trim( $v );
			$v = preg_replace( '/\s+/', ' ', $v );
			if ( function_exists( 'mb_strtolower' ) ) {
				return mb_strtolower( $v );
			}
			return strtolower( $v );
		};

		$unit_key_exact = trim( (string) $unit_key );
		$unit_key_lc    = $canon( $unit_key_exact );

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

		$found_index = -1;

		for ( $i = 0; $i < count( $assigned_arr ); $i++ ) {
			$item = is_array( $assigned_arr[ $i ] ) ? $assigned_arr[ $i ] : [];

			$key_exact = isset( $item['unitKey'] ) ? trim( (string) $item['unitKey'] ) : '';
			$key_lc    = $canon( $key_exact );

			if ( $key_exact !== '' && $key_exact === $unit_key_exact ) {
				$found_index = $i;
				break;
			}
			if ( $key_exact !== '' && $key_lc === $unit_key_lc ) {
				$found_index = $i;
				break;
			}
			if ( $unit_sig !== '' && $item_sig( $item ) === $unit_sig ) {
				$found_index = $i;
				break;
			}
		}

		if ( $found_index < 0 ) {
			wp_send_json_error( [ 'message' => 'Unit not found in roster assignment list.' ], 404 );
		}

		// qty=0 removes; otherwise set exact qty
		if ( $qty === 0 ) {
			array_splice( $assigned_arr, $found_index, 1 );
		} else {
			$assigned_arr[ $found_index ]['qty'] = $qty;
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

		$save_fields_json = wp_json_encode( $fields_by_id );

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

add_action( 'wp_ajax_shoshin_set_unit_qty', 'shoshin_ajax_set_unit_qty' );


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

				// ---------------------------------------------------------------
		// Owned assets payload (2247 + 2501) for Row1 Assign Units modal
		// - Mirrors /my-assets approach: data-shoshin-assets-json
		// - If builder functions are unavailable, safely fall back to []
		// ---------------------------------------------------------------
		$assets = [];

		$character_form_id = 2247;
		$support_form_id   = 2501;

		if ( function_exists( 'wpforms' ) && $user_id ) {

			$char_entries = wpforms()->entry->get_entries( [
				'form_id' => $character_form_id,
				'user_id' => $user_id,
				'number'  => 999,
				'order'   => 'ASC',
			] );

			if ( is_array( $char_entries ) && function_exists( 'shoshin_build_character_asset' ) ) {
				foreach ( $char_entries as $entry ) {
					$assets[] = shoshin_build_character_asset( $entry );
				}
			}

			$support_entries = wpforms()->entry->get_entries( [
				'form_id' => $support_form_id,
				'user_id' => $user_id,
				'number'  => 999,
				'order'   => 'ASC',
			] );

			if ( is_array( $support_entries ) && function_exists( 'shoshin_build_support_asset' ) ) {
				foreach ( $support_entries as $entry ) {
					$assets[] = shoshin_build_support_asset( $entry );
				}
			}

			// Optional: match /my-assets sorting if present
			if ( ! empty( $assets ) ) {
				$class_order = [
					'Daimyo'        => 1,
					'Samurai'       => 2,
					'Ashigaru'      => 3,
					'Sohei'         => 4,
					'Ninja'         => 5,
					'Onmyoji'       => 6,
					'Artillery'     => 7,
					'Sailing Ships' => 8,
				];

				usort( $assets, function ( $a, $b ) use ( $class_order ) {
					$ca = isset( $a['className'] ) ? $a['className'] : '';
					$cb = isset( $b['className'] ) ? $b['className'] : '';

					$oa = isset( $class_order[ $ca ] ) ? $class_order[ $ca ] : 999;
					$ob = isset( $class_order[ $cb ] ) ? $class_order[ $cb ] : 999;

					if ( $oa !== $ob ) return ( $oa < $ob ) ? -1 : 1;

					$ra = isset( $a['refId'] ) ? $a['refId'] : '';
					$rb = isset( $b['refId'] ) ? $b['refId'] : '';

					$cmp = strnatcasecmp( $ra, $rb );
					if ( $cmp !== 0 ) return $cmp;

					$ea = isset( $a['entryId'] ) ? (int) $a['entryId'] : 0;
					$eb = isset( $b['entryId'] ) ? (int) $b['entryId'] : 0;
					if ( $ea === $eb ) return 0;
					return ( $ea < $eb ) ? -1 : 1;
				} );
			}
		}

		$assets_json = wp_json_encode( $assets );


				return sprintf(
			'<div class="shoshin-roster-list-wrapper"><div class="shoshin-roster-list" data-shoshin-rosters-json="%s" data-shoshin-assets-json="%s" data-shoshin-ajax-url="%s" data-shoshin-ajax-nonce="%s"></div></div>',
			esc_attr( $json ),
			esc_attr( $assets_json ),
			esc_attr( $ajax_url ),
			esc_attr( $nonce )
		);

	}

	add_shortcode( 'shoshin_my_rosters', 'shoshin_my_rosters_shortcode' );
}



/** -----------------------------
 *  AJAX: get rosters for current user (for /my-assets assign modal)
 *  Returns: { rosters: [...] }
 *  ----------------------------- */
if ( ! function_exists( 'shoshin_ajax_get_my_rosters' ) ) {
	function shoshin_ajax_get_my_rosters() {

		if ( ! function_exists( 'wpforms' ) ) {
			wp_send_json_error( [ 'message' => 'WPForms is not available.' ], 500 );
		}

		if ( ! is_user_logged_in() ) {
			wp_send_json_error( [ 'message' => 'You must be logged in.' ], 401 );
		}

		if ( ! check_ajax_referer( shoshin_rosters_ajax_nonce_action(), 'nonce', false ) ) {
	wp_send_json_error( [ 'message' => 'Invalid nonce.' ], 403 );
}


		$user_id = get_current_user_id();

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
				if ( $ea === $eb ) return 0;
				return ( $ea < $eb ) ? -1 : 1;
			} );
		}

		wp_send_json_success( [ 'rosters' => $rosters ] );
	}
}
// add_action( 'wp_ajax_shoshin_get_my_rosters', 'shoshin_ajax_get_my_rosters' );

/** -----------------------------
 *  AJAX: assign unit to roster (additive only)
 *  Expects POST:
 *   - rosterEntryId (int)
 *   - qty (int >= 1)
 *   - unitJson (json object)
 *   - nonce
 *
 *  Behavior:
 *   - If unitKey already exists in assigned_units_json: increment qty by qty
 *   - Else: append new row with qty
 *   - Also stores entryId for later authoritative refresh on /my-rosters render
 *  ----------------------------- */
if ( ! function_exists( 'shoshin_ajax_assign_unit' ) ) {
	function shoshin_ajax_assign_unit() {

		if ( ! function_exists( 'wpforms' ) ) {
			wp_send_json_error( [ 'message' => 'WPForms is not available.' ], 500 );
		}

		if ( ! is_user_logged_in() ) {
			wp_send_json_error( [ 'message' => 'You must be logged in.' ], 401 );
		}

		if ( ! check_ajax_referer( shoshin_rosters_ajax_nonce_action(), 'nonce', false ) ) {
	wp_send_json_error( [ 'message' => 'Invalid nonce.' ], 403 );
}


		$entry_id = isset( $_POST['rosterEntryId'] ) ? absint( $_POST['rosterEntryId'] ) : 0;
		$qty      = isset( $_POST['qty'] ) ? intval( $_POST['qty'] ) : 0;
		$unit_raw = isset( $_POST['unitJson'] ) ? wp_unslash( $_POST['unitJson'] ) : '';

		if ( ! $entry_id || $qty < 1 || $unit_raw === '' ) {
			wp_send_json_error( [ 'message' => 'Missing rosterEntryId, qty, or unitJson.' ], 400 );
		}

		$unit = json_decode( (string) $unit_raw, true );
		if ( ! is_array( $unit ) ) {
			wp_send_json_error( [ 'message' => 'Invalid unitJson.' ], 400 );
		}

		$unit_key = isset( $unit['unitKey'] ) ? trim( (string) $unit['unitKey'] ) : '';
		if ( $unit_key === '' ) {
			wp_send_json_error( [ 'message' => 'Missing unitKey in unitJson.' ], 400 );
		}

		$entry = wpforms()->entry->get( $entry_id );
		if ( ! $entry || empty( $entry->entry_id ) ) {
			wp_send_json_error( [ 'message' => 'Roster entry not found.' ], 404 );
		}

		$form_id = isset( $entry->form_id ) ? (int) $entry->form_id : 0;
		if ( $form_id !== 2799 ) {
			wp_send_json_error( [ 'message' => 'Invalid roster form.' ], 403 );
		}

		// Ownership check
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
		$assigned_arr = array_values( $assigned_arr );

		// Hardened match (same style as Task 5)
		$canon = function( $v ) {
			$v = is_scalar( $v ) ? (string) $v : '';
			$v = trim( $v );
			$v = preg_replace( '/\s+/', ' ', $v );
			if ( function_exists( 'mb_strtolower' ) ) {
				return mb_strtolower( $v );
			}
			return strtolower( $v );
		};

		$unit_key_exact = trim( (string) $unit_key );
		$unit_key_lc    = $canon( $unit_key_exact );

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

		$found_index = -1;
		for ( $i = 0; $i < count( $assigned_arr ); $i++ ) {
			$item = is_array( $assigned_arr[ $i ] ) ? $assigned_arr[ $i ] : [];
			$key_exact = isset( $item['unitKey'] ) ? trim( (string) $item['unitKey'] ) : '';
			$key_lc    = $canon( $key_exact );

			if ( $key_exact !== '' && $key_exact === $unit_key_exact ) {
				$found_index = $i; break;
			}
			if ( $key_exact !== '' && $key_lc === $unit_key_lc ) {
				$found_index = $i; break;
			}
			if ( $unit_sig !== '' && $item_sig( $item ) === $unit_sig ) {
				$found_index = $i; break;
			}
		}

		if ( $found_index >= 0 ) {
			$existing_qty = isset( $assigned_arr[ $found_index ]['qty'] ) ? (int) $assigned_arr[ $found_index ]['qty'] : 1;
			$existing_qty = max( 1, $existing_qty );
			$assigned_arr[ $found_index ]['qty'] = $existing_qty + $qty;

			// Ensure entryId is present if we now have it
			if ( ! isset( $assigned_arr[ $found_index ]['entryId'] ) && isset( $unit['entryId'] ) ) {
				$assigned_arr[ $found_index ]['entryId'] = (int) $unit['entryId'];
			}
		} else {
			$unit['qty'] = $qty;
			$assigned_arr[] = $unit;
		}

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

		$save_fields_json = wp_json_encode( $fields_by_id );

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
add_action( 'wp_ajax_shoshin_assign_unit', 'shoshin_ajax_assign_unit' );

/** -----------------------------
 *  Footer config for /my-assets (so my-assets.js can call roster AJAX)
 *  ----------------------------- */
add_action( 'wp_footer', function() {
	if ( ! is_user_logged_in() ) return;

	if ( function_exists( 'is_page' ) && is_page( 'my-assets' ) ) {
		$ajax_url = admin_url( 'admin-ajax.php' );
		$nonce    = wp_create_nonce( shoshin_rosters_ajax_nonce_action() );

		echo '<script>(function(){window.ShoshinRosterAjax=window.ShoshinRosterAjax||{};window.ShoshinRosterAjax.ajaxUrl=' . wp_json_encode( $ajax_url ) . ';window.ShoshinRosterAjax.nonce=' . wp_json_encode( $nonce ) . ';})();</script>';
	}
}, 30 );

