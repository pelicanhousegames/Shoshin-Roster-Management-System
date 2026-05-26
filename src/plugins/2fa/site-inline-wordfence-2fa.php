<?php
/**
 * Plugin Name: Site Inline Wordfence 2FA for PMPro + Woo
 * Description: Reveal Wordfence 2FA inline on the PMPro login page and WooCommerce checkout login form.
 * Author: Your Team
 * Version: 0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Site_Inline_Wordfence_2FA {
	const AJAX_COMPLETE = 'site_inline_wf_complete_2fa';
	const NONCE_ACTION  = 'site-inline-wf-2fa';

	public static function init() {
		add_filter( 'login_form_middle', array( __CLASS__, 'inject_pmpro_fields' ), 20, 2 );
		add_action( 'woocommerce_login_form', array( __CLASS__, 'inject_woo_fields' ) );

		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );

		add_action( 'wp_ajax_nopriv_' . self::AJAX_COMPLETE, array( __CLASS__, 'ajax_complete_2fa' ) );
		add_action( 'wp_ajax_' . self::AJAX_COMPLETE, array( __CLASS__, 'ajax_complete_2fa' ) );

		// Optional but recommended if Wordfence CAPTCHA is enabled and you are
		// not wiring CAPTCHA into this custom PMPro front-end flow:
		// add_filter( 'wordfence_ls_require_captcha', array( __CLASS__, 'maybe_disable_wf_captcha' ) );

		// PMPro login-page helper nav link intentionally disabled.

	}

	public static function is_pmpro_login_context() {
		return function_exists( 'pmpro_is_login_page' ) && pmpro_is_login_page() && ! is_user_logged_in();
	}

	public static function is_wc_checkout_login_context() {
		return function_exists( 'is_checkout' ) && is_checkout() && ! is_user_logged_in();
	}

	public static function maybe_disable_wf_captcha( $required ) {
		if ( self::is_pmpro_login_context() || self::is_wc_checkout_login_context() ) {
			return false;
		}
		return $required;
	}

	public static function enqueue_assets() {
		if ( ! self::is_pmpro_login_context() && ! self::is_wc_checkout_login_context() ) {
			return;
		}

		wp_enqueue_style(
			'site-inline-wordfence-2fa',
			content_url( '/mu-plugins/site-inline-wordfence-2fa.css' ),
			array(),
			'0.1.0'
		);

		wp_enqueue_script(
			'site-inline-wordfence-2fa',
			content_url( '/mu-plugins/site-inline-wordfence-2fa.js' ),
			array(),
			'0.1.0',
			true
		);

		wp_localize_script(
			'site-inline-wordfence-2fa',
			'SiteInlineWF2FA',
			array(
				'ajaxUrl'          => admin_url( 'admin-ajax.php' ),
				'wordfenceAction'  => 'wordfence_ls_authenticate',
				'completeAction'   => self::AJAX_COMPLETE,
				'nonce'            => wp_create_nonce( self::NONCE_ACTION ),
				'isPMPro'          => self::is_pmpro_login_context(),
				'isWooCheckout'    => self::is_wc_checkout_login_context(),
				'defaultRedirect'  => self::default_redirect_url(),
				'securityPageUrl'  => function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'myaccount' ) : home_url( '/' ),
				'i18n'             => array(
					'step2'     => __( 'Password verified. Enter your 6-digit code or a recovery code.', 'site-inline-wf-2fa' ),
					'invalid'   => __( 'The 2FA code is invalid or expired. Please try again.', 'site-inline-wf-2fa' ),
					'challenge' => __( 'Your login challenge expired. Please enter your password again.', 'site-inline-wf-2fa' ),
					'network'   => __( 'Unable to contact the login security service. Please try again.', 'site-inline-wf-2fa' ),
				),
			)
		);
	}

	protected static function default_redirect_url() {
		if ( self::is_wc_checkout_login_context() && function_exists( 'wc_get_checkout_url' ) ) {
			return wc_get_checkout_url();
		}
		if ( function_exists( 'wc_get_page_permalink' ) ) {
			$my_account = wc_get_page_permalink( 'myaccount' );
			if ( ! empty( $my_account ) ) {
				return $my_account;
			}
		}
		if ( function_exists( 'pmpro_url' ) ) {
			$account = pmpro_url( 'account' );
			if ( ! empty( $account ) ) {
				return $account;
			}
		}
		return home_url( '/' );
	}

	protected static function shared_field_markup( $context = 'pmpro' ) {
		ob_start();
		?>
		<input type="hidden" name="site_inline_wf_context" value="<?php echo esc_attr( $context ); ?>" />
		<input type="hidden" name="site_inline_wf_nonce" value="<?php echo esc_attr( wp_create_nonce( self::NONCE_ACTION ) ); ?>" />
		<input type="hidden" name="wfls-token-jwt" value="" />
		<input type="hidden" name="wfls-captcha-jwt" value="" />

		<div class="wf-inline-2fa" hidden aria-hidden="true">
			<div class="wf-inline-2fa__panel">
				<label class="wf-inline-2fa__label" for="wfls-token-<?php echo esc_attr( $context ); ?>">
					<?php esc_html_e( 'Authentication code', 'site-inline-wf-2fa' ); ?>
				</label>

				<input
					type="text"
					name="wfls-token"
					id="wfls-token-<?php echo esc_attr( $context ); ?>"
					class="wf-inline-2fa__input"
					inputmode="numeric"
					autocomplete="one-time-code"
					placeholder="<?php esc_attr_e( '123456 or 5199 5c24 77dc 0ed7', 'site-inline-wf-2fa' ); ?>"
				/>

				<p class="wf-inline-2fa__hint">
					<?php esc_html_e( 'Use the 6-digit code from your authenticator app, or a 16-character recovery code.', 'site-inline-wf-2fa' ); ?>
				</p>

				<label class="wf-inline-2fa__remember">
					<input type="checkbox" name="wfls-remember-device" value="1" />
					<?php esc_html_e( 'Remember this device for 30 days', 'site-inline-wf-2fa' ); ?>
				</label>

				<div class="wf-inline-2fa__message" aria-live="polite"></div>
			</div>
		</div>
		<?php
		return ob_get_clean();
	}

	public static function inject_pmpro_fields( $content, $args ) {
		if ( ! self::is_pmpro_login_context() ) {
			return $content;
		}
		return $content . self::shared_field_markup( 'pmpro' );
	}

	public static function inject_woo_fields() {
		if ( ! self::is_wc_checkout_login_context() ) {
			return;
		}
		echo self::shared_field_markup( 'woo' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	public static function ajax_complete_2fa() {
		if ( ! check_ajax_referer( self::NONCE_ACTION, 'nonce', false ) ) {
			wp_send_json_error(
				array( 'message' => __( 'Security check failed. Reload the page and try again.', 'site-inline-wf-2fa' ) ),
				403
			);
		}

		if (
			empty( $_POST['jwt'] ) ||
			empty( $_POST['token'] ) ||
			! class_exists( '\WordfenceLS\Crypto\Model_JWT' ) ||
			! class_exists( '\WordfenceLS\Crypto\Model_Symmetric' ) ||
			! class_exists( '\WordfenceLS\Controller_Users' ) ||
			! class_exists( '\WordfenceLS\Controller_TOTP' )
		) {
			wp_send_json_error(
				array( 'message' => __( 'Wordfence 2FA is not available on this request.', 'site-inline-wf-2fa' ) ),
				500
			);
		}

		$jwt_raw = wp_unslash( $_POST['jwt'] );
		$token   = preg_replace( '/[^0-9a-f\s]/i', '', wp_unslash( $_POST['token'] ) );
		$context = isset( $_POST['context'] ) ? sanitize_key( wp_unslash( $_POST['context'] ) ) : 'pmpro';

		$jwt = \WordfenceLS\Crypto\Model_JWT::decode_jwt( $jwt_raw );
		if ( ! $jwt || empty( $jwt->payload['user'] ) ) {
			wp_send_json_error(
				array( 'message' => __( 'Your login challenge expired. Please enter your password again.', 'site-inline-wf-2fa' ) ),
				400
			);
		}

		$user_id = \WordfenceLS\Crypto\Model_Symmetric::decrypt( $jwt->payload['user'] );
		$user_id = absint( $user_id );
		$user    = $user_id ? get_user_by( 'id', $user_id ) : false;

		if ( ! $user || ! ( $user instanceof WP_User ) ) {
			wp_send_json_error(
				array( 'message' => __( 'The login challenge no longer matches a valid user.', 'site-inline-wf-2fa' ) ),
				400
			);
		}

		if ( ! \WordfenceLS\Controller_Users::shared()->has_2fa_active( $user ) ) {
			wp_send_json_error(
				array( 'message' => __( 'This account no longer has Wordfence 2FA enabled.', 'site-inline-wf-2fa' ) ),
				400
			);
		}

		$valid = \WordfenceLS\Controller_TOTP::shared()->validate_2fa( $user, $token );
		if ( true !== $valid ) {
			wp_send_json_error(
				array( 'message' => __( 'The 2FA code is invalid or expired. Please try again.', 'site-inline-wf-2fa' ) ),
				403
			);
		}

		$remember_user   = ! empty( $_POST['rememberme'] );
		$remember_device = ! empty( $_POST['remember_device'] );

		wp_clear_auth_cookie();
		wp_set_current_user( $user->ID );
		wp_set_auth_cookie( $user->ID, $remember_user, is_ssl() );

		if ( $remember_device ) {
			\WordfenceLS\Controller_Users::shared()->remember_2fa( $user );
		}

		do_action( 'wp_login', $user->user_login, $user );

		$redirect_fallback = self::default_redirect_url();
		$redirect_to       = ! empty( $_POST['redirect_to'] ) ? wp_unslash( $_POST['redirect_to'] ) : '';
		$redirect_to       = wp_validate_redirect( $redirect_to, $redirect_fallback );

		// For checkout logins, keep people on checkout.
		if ( 'woo' === $context && function_exists( 'wc_get_checkout_url' ) && empty( $_POST['redirect_to'] ) ) {
			$redirect_to = wc_get_checkout_url();
		}

		wp_send_json_success(
			array(
				'redirect' => $redirect_to,
			)
		);
	}
}

Site_Inline_Wordfence_2FA::init();
