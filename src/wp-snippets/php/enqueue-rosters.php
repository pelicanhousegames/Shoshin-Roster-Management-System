<?php
/**
 * Shoshin - My Rosters shortcode
 * Usage: [shoshin_my_rosters]
 *
 * Outputs a container with:
 *   <div class="shoshin-roster-list" data-shoshin-rosters-json="..."></div>
 *
 * NOTE: No script enqueue here. JS is handled via WPCode JS snippet.
 */

if ( ! function_exists( 'shoshin_normalize_wpforms_fields' ) ) {
	function shoshin_normalize_wpforms_fields( $raw_fields ) {

		// Decode if it's a string
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
			return array();
		}

		// If numeric-indexed and contains id, remap by id
		$first_key = array_key_first( $decoded );
		if ( is_int( $first_key ) && isset( $decoded[ $first_key ]['id'] ) ) {
			$mapped = array();
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

if ( ! function_exists( 'shoshin_build_roster_entry' ) ) {
	function shoshin_build_roster_entry( $entry ) {

		$raw_fields = '';
		$entry_id   = 0;

		if ( is_array( $entry ) ) {
			$raw_fields = isset( $entry['fields'] ) ? $entry['fields'] : '';
			$entry_id   = isset( $entry['entry_id'] ) ? (int) $entry['entry_id'] : 0;
		} elseif ( is_object( $entry ) ) {
			$raw_fields = isset( $entry->fields ) ? $entry->fields : '';
			$entry_id   = isset( $entry->entry_id ) ? (int) $entry->entry_id : 0;
		}

		$fields = shoshin_normalize_wpforms_fields( $raw_fields );

		// Form 2799 mapping
		$ref_id   = shoshin_get_wpforms_field_value( $fields, 3, '' ); // Reference ID
		$clanName = shoshin_get_wpforms_field_value( $fields, 5, '' ); // Clan Name

		return array(
			'kind'    => 'roster',
			'entryId' => $entry_id,
			'refId'   => $ref_id,
			'name'    => $clanName,
		);
	}
}

if ( ! function_exists( 'shoshin_my_rosters_shortcode' ) ) {

	function shoshin_my_rosters_shortcode( $atts ) {

		if ( ! function_exists( 'wpforms' ) ) {
			return '<p>WPForms is not available.</p>';
		}

		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return '<p>You must be logged in to view your rosters.</p>';
		}

		$atts = shortcode_atts(
			array(
				'form_id' => 2799,
			),
			$atts,
			'shoshin_my_rosters'
		);

		$form_id = (int) $atts['form_id'];

		$args = array(
			'form_id' => $form_id,
			'user_id' => $user_id,
			'number'  => 999,
			'order'   => 'ASC',
		);

		$entries = wpforms()->entry->get_entries( $args );

		$rosters = array();
		if ( is_array( $entries ) ) {
			foreach ( $entries as $entry ) {
				$rosters[] = shoshin_build_roster_entry( $entry );
			}
		}

		// Sort by Reference ID ASC, then entryId ASC
		if ( ! empty( $rosters ) ) {
			usort( $rosters, function( $a, $b ) {
				$ra = isset( $a['refId'] ) ? (string) $a['refId'] : '';
				$rb = isset( $b['refId'] ) ? (string) $b['refId'] : '';
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

		$json = wp_json_encode( $rosters );

		ob_start();
		?>
		<div class="shoshin-roster-list-wrapper">
			<div class="shoshin-roster-list" data-shoshin-rosters-json="<?php echo esc_attr( $json ); ?>"></div>
		</div>
		<?php
		return ob_get_clean();
	}

	add_shortcode( 'shoshin_my_rosters', 'shoshin_my_rosters_shortcode' );
}
