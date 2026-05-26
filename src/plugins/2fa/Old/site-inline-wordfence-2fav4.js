(function () {
	'use strict';

	function qs(form, selectors) {
		for (const selector of selectors) {
			const el = form.querySelector(selector);
			if (el) return el;
		}
		return null;
	}

	function messageTarget(form) {
		const box = form.querySelector('.wf-inline-2fa__message');
		return box || form;
	}

	function setMessage(form, text, isError) {
		const box = messageTarget(form);
		box.innerHTML = text || '';
		box.classList.toggle('is-error', !!isError);
	}

	function revealTwoFactor(form, data) {
		const wrapper = form.querySelector('.wf-inline-2fa');
		const jwt     = form.querySelector('input[name="wfls-token-jwt"]');
		const capJwt  = form.querySelector('input[name="wfls-captcha-jwt"]');
		const token   = form.querySelector('input[name="wfls-token"]');

		if (!wrapper || !token) return;

		if (jwt) {
			jwt.value = (data && data.jwt) ? data.jwt : '';
		}

		if (capJwt) {
			capJwt.value = (data && data.captcha) ? data.captcha : '';
		}

		wrapper.hidden = false;
		wrapper.setAttribute('aria-hidden', 'false');
		form.classList.add('wf-inline-2fa--active');
		form.dataset.inlineWf2faStep = 'token';

		const userField = qs(form, ['input[name="log"]', 'input[name="username"]']);
		const passField = qs(form, ['input[name="pwd"]', 'input[name="password"]']);

		if (userField) userField.readOnly = true;
		if (passField) passField.readOnly = true;

		setMessage(form, SiteInlineWF2FA.i18n.step2, false);
		token.focus();
	}

	function resetTwoFactor(form, keepMessage) {
		const wrapper = form.querySelector('.wf-inline-2fa');
		const jwt     = form.querySelector('input[name="wfls-token-jwt"]');
		const capJwt  = form.querySelector('input[name="wfls-captcha-jwt"]');
		const token   = form.querySelector('input[name="wfls-token"]');

		if (jwt) jwt.value = '';
		if (capJwt) capJwt.value = '';
		if (token) token.value = '';

		if (wrapper) {
			wrapper.hidden = true;
			wrapper.setAttribute('aria-hidden', 'true');
		}

		form.classList.remove('wf-inline-2fa--active');
		delete form.dataset.inlineWf2faStep;
		delete form.dataset.inlineWf2faBypass;

		const userField = qs(form, ['input[name="log"]', 'input[name="username"]']);
		const passField = qs(form, ['input[name="pwd"]', 'input[name="password"]']);

		if (userField) userField.readOnly = false;
		if (passField) passField.readOnly = false;

		if (!keepMessage) {
			setMessage(form, '', false);
		}
	}

	function getFormContext(form) {
		const ctx = form.querySelector('input[name="site_inline_wf_context"]');
		return ctx ? ctx.value : 'pmpro';
	}

	function getRedirect(form) {
		const redirect = qs(form, ['input[name="redirect_to"]', 'input[name="redirect"]']);
		return redirect && redirect.value ? redirect.value : SiteInlineWF2FA.defaultRedirect;
	}

	function getRememberMe(form) {
		const remember = qs(form, ['input[name="rememberme"]']);
		return !!(remember && remember.checked);
	}

		function hasNativeWordfenceChallenge(form) {
		if (!form) return false;

		// For this pass, checkout is custom-only. Do not yield to native Woo/Wordfence.
		if (isWooCheckoutLoginForm(form)) {
			return false;
		}

		// Keep PMPro/native detection intact for later work.
		if (form.querySelector('#wfls-token-submit, input[name="wfls-token-submit"]')) {
			return true;
		}

		const nativeToken = form.querySelector('input[name="wfls-token"]');
		if (
			nativeToken &&
			nativeToken.id !== 'wfls-token-woo' &&
			nativeToken.id !== 'wfls-token-pmpro' &&
			!nativeToken.closest('.wf-inline-2fa')
		) {
			return true;
		}

		return false;
	}

	function normalizeRedirect(form) {
		const context = getFormContext(form);
		const explicitTarget = SiteInlineWF2FA.defaultRedirect;
		const myAccountTarget = SiteInlineWF2FA.securityPageUrl || SiteInlineWF2FA.defaultRedirect;

		let redirectToField = qs(form, ['input[name="redirect_to"]']);
		let redirectField   = qs(form, ['input[name="redirect"]']);

		if (!redirectToField) {
			redirectToField = document.createElement('input');
			redirectToField.type = 'hidden';
			redirectToField.name = 'redirect_to';
			form.appendChild(redirectToField);
		}

		if (context === 'woo') {
			if (explicitTarget) {
				redirectToField.value = explicitTarget;
				if (redirectField) {
					redirectField.value = explicitTarget;
				}
			}
			return;
		}

		// PMPro/manual login should land on Woo My Account unless a protected-page redirect exists.
		if (!redirectToField.value && myAccountTarget) {
			redirectToField.value = myAccountTarget;
		}
	}

	function nativeSubmit(form) {
		form.dataset.inlineWf2faBypass = '1';
		normalizeRedirect(form);

		let submitter = null;

		if (
			document.activeElement &&
			form.contains(document.activeElement) &&
			document.activeElement.matches('button[type="submit"], input[type="submit"]')
		) {
			submitter = document.activeElement;
		}

		if (!submitter) {
			submitter = form.querySelector('button[type="submit"], input[type="submit"]');
		}

		if (typeof form.requestSubmit === 'function' && submitter) {
			form.requestSubmit(submitter);
			return;
		}

		form.submit();
	}

	async function post(url, body) {
		const response = await fetch(url, {
			method: 'POST',
			credentials: 'same-origin',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
			},
			body: new URLSearchParams(body).toString()
		});

		return response.json();
	}

	async function runWordfencePreflight(form) {
		const username = qs(form, ['input[name="log"]', 'input[name="username"]']);
		const password = qs(form, ['input[name="pwd"]', 'input[name="password"]']);

		return post(SiteInlineWF2FA.ajaxUrl, {
			action: SiteInlineWF2FA.wordfenceAction,
			log: username ? username.value : '',
			pwd: password ? password.value : ''
		});
	}

		async function completeTwoFactor(form) {
		const jwt            = qs(form, ['input[name="wfls-token-jwt"]']);
		const token          = qs(form, ['input[name="wfls-token"]']);
		const rememberDevice = qs(form, ['input[name="wfls-remember-device"]']);

		return post(SiteInlineWF2FA.ajaxUrl, {
			action: SiteInlineWF2FA.completeAction,
			nonce: SiteInlineWF2FA.nonce,
			jwt: jwt ? jwt.value : '',
			token: token ? token.value : '',
			context: getFormContext(form),
			redirect_to: getRedirect(form),
			rememberme: getRememberMe(form) ? '1' : '',
			remember_device: rememberDevice && rememberDevice.checked ? '1' : ''
		});
	}

	function isWooCheckoutLoginForm(form) {
		return !!(form && form.matches('form.woocommerce-form-login') && SiteInlineWF2FA.isWooCheckout);
	}

	function eligibleForm(form) {
		if (!form || form.dataset.inlineWf2faBound === '1') {
			return false;
		}

		const isWooCheckoutForm = isWooCheckoutLoginForm(form);

		// Checkout only for this pass.
		return isWooCheckoutForm;
	}

	function bindForm(form) {
		if (!eligibleForm(form)) return;
		form.dataset.inlineWf2faBound = '1';

		const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
		if (submitBtn) {
			submitBtn.addEventListener('click', function (e) {
				if (isWooCheckoutLoginForm(form)) {
					e.preventDefault();
					e.stopPropagation();
					e.stopImmediatePropagation();

					form.dispatchEvent(new Event('submit', { cancelable: true }));
				}
			}, true);
		}

				form.addEventListener('submit', async function (e) {
			if (form.dataset.inlineWf2faBypass === '1') {
				delete form.dataset.inlineWf2faBypass;
				return;
			}

			// Always make sure checkout carries the intended redirect target.
			normalizeRedirect(form);

			if (document.activeElement && (
				document.activeElement.closest('.nsl-container') ||
				document.activeElement.closest('.nsl-button') ||
				document.activeElement.closest('.woocommerce-social-login') ||
				document.activeElement.closest('[data-provider]') ||
				document.activeElement.matches('[data-provider], .social-login, .nsl-button, .nsl-button-default, .nsl-button-google, .nsl-button-facebook')
			)) {
				return;
			}

			const tokenField      = qs(form, ['input[name="wfls-token"]']);
			const isWooForm       = isWooCheckoutLoginForm(form);
			const isTwoFactorStep = form.classList.contains('wf-inline-2fa--active') || form.dataset.inlineWf2faStep === 'token';

			e.preventDefault();

			if (isWooForm) {
				e.stopPropagation();
				e.stopImmediatePropagation();
			}

			if (isTwoFactorStep) {
				if (!tokenField || !tokenField.value.trim()) {
					setMessage(form, SiteInlineWF2FA.i18n.invalid, true);
					return;
				}

				try {
					const result = await completeTwoFactor(form);

					if (result && result.success && result.data && result.data.redirect) {
						window.location.assign(result.data.redirect);
						return;
					}

					resetTwoFactor(form, true);
					setMessage(
						form,
						(result && result.data && result.data.message) ? result.data.message : SiteInlineWF2FA.i18n.challenge,
						true
					);
				} catch (err) {
					setMessage(form, SiteInlineWF2FA.i18n.network, true);
				}

				return;
			}

			try {
				const result = await runWordfencePreflight(form);

				if (result && result.login && result.two_factor_required) {
					revealTwoFactor(form, result);
					return;
				}

				if (result && result.login) {
					nativeSubmit(form);
					return;
				}

				const message = (result && (result.error || result.message)) ? (result.error || result.message) : SiteInlineWF2FA.i18n.network;
				setMessage(form, message, true);
			} catch (err) {
				setMessage(form, SiteInlineWF2FA.i18n.network, true);
			}
		}, true);
	}

	function bindAllForms() {
		document.querySelectorAll('form').forEach(bindForm);
	}

	document.addEventListener('DOMContentLoaded', bindAllForms);

	if (window.jQuery) {
		jQuery(document.body).on('updated_checkout updated_wc_div wc_fragments_loaded', function () {
			bindAllForms();
		});
	}

	const observer = new MutationObserver(function () {
		bindAllForms();
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true
	});
})();