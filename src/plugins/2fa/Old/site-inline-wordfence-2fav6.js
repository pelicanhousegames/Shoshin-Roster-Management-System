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

		// PMPro/custom login: retarget the original submitter so Wordfence
		// sees a token-step submit instead of the initial wp-submit.
		if (getFormContext(form) === 'pmpro') {
			const submitter = form.querySelector('input[type="submit"], button[type="submit"]');
			if (submitter && !submitter.dataset.inlineWfOriginalName) {
				submitter.dataset.inlineWfOriginalName = submitter.getAttribute('name') || '';
				submitter.dataset.inlineWfOriginalId = submitter.getAttribute('id') || '';
				submitter.dataset.inlineWfOriginalValue = ('value' in submitter) ? (submitter.value || '') : '';
				submitter.dataset.inlineWfOriginalText = submitter.textContent || '';

				submitter.setAttribute('name', 'wfls-token-submit');
				submitter.setAttribute('id', 'wfls-token-submit');

				if ('value' in submitter) {
					submitter.value = 'Log In';
				} else {
					submitter.textContent = 'Log In';
				}
			}
		}

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

		// Restore original PMPro submitter attributes.
		const submitter = form.querySelector('#wfls-token-submit, input[name="wfls-token-submit"], button[name="wfls-token-submit"]');
		if (submitter && submitter.dataset.inlineWfOriginalName !== undefined) {
			const originalName  = submitter.dataset.inlineWfOriginalName;
			const originalId    = submitter.dataset.inlineWfOriginalId;
			const originalValue = submitter.dataset.inlineWfOriginalValue;
			const originalText  = submitter.dataset.inlineWfOriginalText;

			if (originalName) submitter.setAttribute('name', originalName);
			else submitter.removeAttribute('name');

			if (originalId) submitter.setAttribute('id', originalId);
			else submitter.removeAttribute('id');

			if ('value' in submitter) {
				submitter.value = originalValue || 'Log In';
			} else {
				submitter.textContent = originalText || 'Log In';
			}

			delete submitter.dataset.inlineWfOriginalName;
			delete submitter.dataset.inlineWfOriginalId;
			delete submitter.dataset.inlineWfOriginalValue;
			delete submitter.dataset.inlineWfOriginalText;
		}

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

		// Native Wordfence submit control on wp-login/native challenge states.
		if (form.querySelector('#wfls-token-submit, input[name="wfls-token-submit"]')) {
			return true;
		}

		// Native Wordfence token input (exclude our custom injected fields).
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

	function isWooCheckoutLoginForm(form) {
		return !!(form && form.matches('form.woocommerce-form-login') && SiteInlineWF2FA.isWooCheckout);
	}

		function bindCheckoutRedirectOnly(form) {
		if (!isWooCheckoutLoginForm(form) || form.dataset.inlineWfCheckoutRedirectBound === '1') {
			return;
		}

		form.dataset.inlineWfCheckoutRedirectBound = '1';

		const applyRedirect = function () {
			normalizeRedirect(form);
		};

		const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
		if (submitBtn) {
			submitBtn.addEventListener('click', applyRedirect, true);
		}

		form.addEventListener('submit', function () {
			applyRedirect();
		}, true);
	}

	function eligibleForm(form) {
		if (!form || form.dataset.inlineWf2faBound === '1') {
			return false;
		}

		const isPmproForm = !!qs(form, ['input[name="pmpro_login_form_used"]']) && SiteInlineWF2FA.isPMPro;

		// For this pass, the custom bridge is PMPro-only.
		return isPmproForm;
	}

	function bindForm(form) {
		if (!eligibleForm(form)) return;
		form.dataset.inlineWf2faBound = '1';

		const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
		if (submitBtn) {
			submitBtn.addEventListener('click', function () {
				normalizeRedirect(form);
			}, true);
		}

		form.addEventListener('submit', async function (e) {
			if (form.dataset.inlineWf2faBypass === '1') {
				delete form.dataset.inlineWf2faBypass;
				return;
			}

			// If native Wordfence challenge is already active, do not layer our bridge on top.
			if (hasNativeWordfenceChallenge(form)) {
				normalizeRedirect(form);
				return;
			}

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

				normalizeRedirect(form);
				nativeSubmit(form);
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
		document.querySelectorAll('form').forEach(function (form) {
			bindCheckoutRedirectOnly(form);
			bindForm(form);
		});
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