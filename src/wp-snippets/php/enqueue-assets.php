<?php
/**
 * Shoshin - My Assets shortcode
 * Usage: [shoshin_my_assets]
 *
 * Builds a JSON payload of the current user's:
 *  - Character entries (form 2247)
 *  - Support Asset entries (form 2501)
 * for the JS renderer on /my-assets.
 */

/**
 * Normalize WPForms entry "fields" into an array keyed by field ID.
 */
if ( ! function_exists( 'shoshin_normalize_wpforms_fields' ) ) {

	function shoshin_normalize_wpforms_fields( $raw_fields ) {

		// 1) Decode if it's a string (WPForms usually stores JSON / encoded data).
		if ( is_string( $raw_fields ) ) {
			if ( function_exists( 'wpforms_decode' ) ) {
				$decoded = wpforms_decode( $raw_fields );
			} else {
				// Fallback – try unserialize / JSON decode.
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

		// 2) If numeric indexed with "id" inside each, remap by id.
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

		// Already keyed by field-id.
		return $decoded;
	}
}

/**
 * Safely extract a value from normalized WPForms fields by field ID.
 */
if ( ! function_exists( 'shoshin_get_wpforms_field_value' ) ) {

	function shoshin_get_wpforms_field_value( $fields, $field_id, $default = '' ) {

		if ( empty( $fields ) || ! isset( $fields[ $field_id ] ) ) {
			return $default;
		}

		$field = $fields[ $field_id ];

		// WPForms-style structure.
		if ( is_array( $field ) && isset( $field['value'] ) ) {

			$value = $field['value'];

			// Checkboxes / multi-select come in as arrays.
			if ( is_array( $value ) ) {
				$value = implode( "\n", array_map( 'trim', $value ) );
			}

			return (string) $value;
		}

		// Already scalar.
		if ( is_scalar( $field ) ) {
			return (string) $field;
		}

		return $default;
	}
}

/**
 * Build a single "character asset" array from a WPForms entry
 * (Character Creator form 2247) for use by the JS renderer.
 */
if ( ! function_exists( 'shoshin_build_character_asset' ) ) {

	function shoshin_build_character_asset( $entry ) {

		// 1) Normalize entry + fields.
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

		// 2) Core character info from your field mapping.
		$ref_id     = shoshin_get_wpforms_field_value( $fields, 4 );   // Reference ID
		$class_name = shoshin_get_wpforms_field_value( $fields, 6 );   // Character Class

		$atk = shoshin_get_wpforms_field_value( $fields, 60, '' );     // char_atk
		$def = shoshin_get_wpforms_field_value( $fields, 61, '' );     // char_def
		$mov = shoshin_get_wpforms_field_value( $fields, 62, '' );     // char_mov
		$bod = shoshin_get_wpforms_field_value( $fields, 63, '' );     // char_bod
		$ldr = shoshin_get_wpforms_field_value( $fields, 64, '' );     // char_ldr
		$ini = shoshin_get_wpforms_field_value( $fields, 65, '' );     // char_ini

		$total_cost = shoshin_get_wpforms_field_value( $fields, 66, '' ); // char_total_cost

		// Weapon stats (hidden fields).
		$melee_dmg   = shoshin_get_wpforms_field_value( $fields, 54, '' );
		$melee_crit  = shoshin_get_wpforms_field_value( $fields, 55, '' );
		$melee_dist  = shoshin_get_wpforms_field_value( $fields, 56, '' );
		$ranged_dmg  = shoshin_get_wpforms_field_value( $fields, 57, '' );
		$ranged_crit = shoshin_get_wpforms_field_value( $fields, 58, '' );
		$ranged_dist = shoshin_get_wpforms_field_value( $fields, 59, '' );

		// Hidden multi-line summary blocks (used by JS to build expansion tables).
		$prof_abil_block_raw = shoshin_get_wpforms_field_value( $fields, 68, '' ); // char_prof_abil
		$equip_block_raw     = shoshin_get_wpforms_field_value( $fields, 69, '' ); // char_equip_items
		$ryu_block_raw       = shoshin_get_wpforms_field_value( $fields, 70, '' ); // char_ryu
		$mods_block_raw      = shoshin_get_wpforms_field_value( $fields, 67, '' ); // char_mrbpa_modifiers

		// Optional stored size (field 71) – may be blank; JS falls back to class default.
		$size_raw = shoshin_get_wpforms_field_value( $fields, 71, '' );

		return [
			'kind'          => 'character',
			'entryId'       => $entry_id,
			'refId'         => $ref_id,
			'className'     => $class_name,
			'size'          => $size_raw,
			'atk'           => $atk,
			'def'           => $def,
			'mov'           => $mov,
			'bod'           => $bod,
			'ldr'           => $ldr,
			'ini'           => $ini,
			'totalCost'     => $total_cost,
			'meleeDamage'   => $melee_dmg,
			'meleeCrit'     => $melee_crit,
			'meleeDistance' => $melee_dist,
			'rangedDamage'  => $ranged_dmg,
			'rangedCrit'    => $ranged_crit,
			'rangedDistance'=> $ranged_dist,
			// Raw blocks for JS expansion tables.
			'profAbilBlock' => $prof_abil_block_raw,
			'equipBlock'    => $equip_block_raw,
			'ryuBlock'      => $ryu_block_raw,
			'modsBlock'     => $mods_block_raw,
		];
	}
}

/**
 * Build a single "support asset" array from a WPForms entry
 * (Support Asset Creator form 2501) for use by the JS renderer.
 *
 * IMPORTANT: This now assumes all asset_* values are computed
 * in JS on the form and simply reads them.
 */
if ( ! function_exists( 'shoshin_build_support_asset' ) ) {

	function shoshin_build_support_asset( $entry ) {

		// 1) Normalize entry + fields.
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

		// 2) Core support asset info from mapping.
		$ref_id       = shoshin_get_wpforms_field_value( $fields, 3 ); // Reference ID
		$support_type = shoshin_get_wpforms_field_value( $fields, 4 ); // Support Asset Type (Ozutsu / Mokuzo Hansen)

		// Map support type → class bucket used by renderer/filter.
		// These must match the JS filter logic:
		//   "Artillery" + "Sailing Ships" under the "Support Assets" tab.
		switch ( $support_type ) {
			case 'Ozutsu':
				$class_name = 'Artillery';
				break;
			case 'Mokuzo Hansen':
				$class_name = 'Sailing Ships';
				break;
			default:
				$class_name = 'Support Assets'; // Fallback
				break;
		}

		// Core stats (asset_* hidden fields).
		$atk = shoshin_get_wpforms_field_value( $fields, 27, '' ); // asset_atk
		$def = shoshin_get_wpforms_field_value( $fields, 28, '' ); // asset_def
		$mov = shoshin_get_wpforms_field_value( $fields, 29, '' ); // asset_mov
		$bod = shoshin_get_wpforms_field_value( $fields, 30, '' ); // asset_bod
		$ldr = shoshin_get_wpforms_field_value( $fields, 31, '' ); // asset_ldr
		$ini = shoshin_get_wpforms_field_value( $fields, 32, '' ); // asset_ini

		$total_cost = shoshin_get_wpforms_field_value( $fields, 33, '' ); // asset_total_cost

		// Weapon stats (hidden fields).
		$melee_dmg   = shoshin_get_wpforms_field_value( $fields, 21, '' );
		$melee_crit  = shoshin_get_wpforms_field_value( $fields, 22, '' );
		$melee_dist  = shoshin_get_wpforms_field_value( $fields, 23, '' );
		$ranged_dmg  = shoshin_get_wpforms_field_value( $fields, 24, '' );
		$ranged_crit = shoshin_get_wpforms_field_value( $fields, 25, '' );
		$ranged_dist = shoshin_get_wpforms_field_value( $fields, 26, '' );

		// Hidden blocks for rules & modifiers.
		$mods_block_raw  = shoshin_get_wpforms_field_value( $fields, 34, '' ); // asset_mrbpa_modifiers
		$rules_block_raw = shoshin_get_wpforms_field_value( $fields, 35, '' ); // asset_rules_mods (optional)
		
		// Support equipment/items block (field 39: asset_equip_items)
		$equip_block_raw = shoshin_get_wpforms_field_value( $fields, 39, '' );

		// Support training requirements block (field 38: asset_ryu)
		$ryu_block_raw   = shoshin_get_wpforms_field_value( $fields, 38, '' );


		// Optional stored size & dimensions.
		$size_raw       = shoshin_get_wpforms_field_value( $fields, 36, '' ); // asset_size
		$dimension_raw  = shoshin_get_wpforms_field_value( $fields, 37, '' ); // asset_dimension

		return [
			'kind'            => 'support',
			'entryId'         => $entry_id,
			'refId'           => $ref_id,
			'className'       => $class_name,
			'supportType'     => $support_type,
			'size'            => $size_raw,
			'dimension'       => $dimension_raw,
			'atk'             => $atk,
			'def'             => $def,
			'mov'             => $mov,
			'bod'             => $bod,
			'ldr'             => $ldr,
			'ini'             => $ini,
			'totalCost'       => $total_cost,
			'meleeDamage'     => $melee_dmg,
			'meleeCrit'       => $melee_crit,
			'meleeDistance'   => $melee_dist,
			'rangedDamage'    => $ranged_dmg,
			'rangedCrit'      => $ranged_crit,
			'rangedDistance'  => $ranged_dist,

			// For now, support assets do not populate prof/equip/ryu tables.
			// These keys exist so the JS renderer is happy.
			'profAbilBlock'   => '',                 // still none for support assets
			'equipBlock'      => $equip_block_raw,   // <-- NOW POPULATES EQUIPMENT & ITEMS
			'ryuBlock'        => $ryu_block_raw,     // <-- NOW POPULATES TRAINING REQUIREMENTS (if your JS uses it)
			'modsBlock'       => $mods_block_raw,


			// Extra info kept for potential dedicated "Rules" block.
			'assetRulesBlock' => $rules_block_raw,
		];
	}
}

/**
 * Shortcode callback: [shoshin_my_assets]
 * Outputs a container with data-shoshin-assets-json for JS to render.
 */
if ( ! function_exists( 'shoshin_my_assets_shortcode' ) ) {

	function shoshin_my_assets_shortcode( $atts ) {

		if ( ! function_exists( 'wpforms' ) ) {
			return '<p>WPForms is not available.</p>';
		}

		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return '<p>You must be logged in to view your characters.</p>';
		}

		// Base form IDs – character + support assets.
		$atts = shortcode_atts(
			[
				'form_id'         => 2247, // Character Creator form ID.
				'support_form_id' => 2501, // Support Asset Creator form ID.
			],
			$atts,
			'shoshin_my_assets'
		);

		$character_form_id = (int) $atts['form_id'];
		$support_form_id   = (int) $atts['support_form_id'];

		$assets = [];

		// ---------------------------------------------------------------
		// 1) Character entries (2247)
		// ---------------------------------------------------------------
		$char_args = [
			'form_id' => $character_form_id,
			'user_id' => $user_id,
			'number'  => 999,
			'order'   => 'ASC',
		];

		$char_entries = wpforms()->entry->get_entries( $char_args );
		if ( is_array( $char_entries ) ) {
			foreach ( $char_entries as $entry ) {
				$assets[] = shoshin_build_character_asset( $entry );
			}
		}

		// ---------------------------------------------------------------
		// 2) Support Asset entries (2501)
		// ---------------------------------------------------------------
		$support_args = [
			'form_id' => $support_form_id,
			'user_id' => $user_id,
			'number'  => 999,
			'order'   => 'ASC',
		];

		$support_entries = wpforms()->entry->get_entries( $support_args );
		if ( is_array( $support_entries ) ) {
			foreach ( $support_entries as $entry ) {
				$assets[] = shoshin_build_support_asset( $entry );
			}
		}

		// ---------------------------------------------------------------
		// 3) Custom sort: first by class/asset bucket, then by Ref ID ASC.
		// ---------------------------------------------------------------
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

		if ( ! empty( $assets ) ) {
			usort(
				$assets,
				function ( $a, $b ) use ( $class_order ) {

					$ca = isset( $a['className'] ) ? $a['className'] : '';
					$cb = isset( $b['className'] ) ? $b['className'] : '';

					$oa = isset( $class_order[ $ca ] ) ? $class_order[ $ca ] : 999;
					$ob = isset( $class_order[ $cb ] ) ? $class_order[ $cb ] : 999;

					if ( $oa !== $ob ) {
						return ( $oa < $ob ) ? -1 : 1;
					}

					$ra = isset( $a['refId'] ) ? $a['refId'] : '';
					$rb = isset( $b['refId'] ) ? $b['refId'] : '';

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
				}
			);
		}

		$json = wp_json_encode( $assets );

		ob_start();
		?>
		<div class="shoshin-asset-list-wrapper">
			<div
				class="shoshin-asset-list"
				data-shoshin-assets-json="<?php echo esc_attr( $json ); ?>">
			</div>
		</div>
		<?php
		return ob_get_clean();
	}

	add_shortcode( 'shoshin_my_assets', 'shoshin_my_assets_shortcode' );
}
