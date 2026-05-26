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

	function getSubmitter(form) {
	return form.querySelector('button[type="submit"], input[type="submit"]');
}

function setSubmitterState(form, options) {
	const submitter = getSubmitter(form);
	if (!submitter) return;

	const settings = options || {};

	if (typeof settings.disabled !== 'undefined') {
		submitter.disabled = !!settings.disabled;
	}

	if (typeof settings.text !== 'undefined') {
		if (submitter.tagName === 'INPUT') {
			submitter.value = settings.text;
		} else {
			submitter.textContent = settings.text;
		}
	}
}

function storeSubmitterLabel(form) {
	const submitter = getSubmitter(form);
	if (!submitter) return;

	if (!form.dataset.inlineWfOriginalLabel) {
		form.dataset.inlineWfOriginalLabel =
			submitter.tagName === 'INPUT' ? submitter.value : submitter.textContent;
	}
}

function restoreSubmitterLabel(form) {
	const original = form.dataset.inlineWfOriginalLabel;
	if (!original) return;

	setSubmitterState(form, {
		disabled: false,
		text: original
	});
}

	function revealTwoFactor(form, data) {
		const wrapper = form.querySelector('.wf-inline-2fa');
		const jwt     = form.querySelector('input[name="wfls-token-jwt"]');
		const token   = form.querySelector('input[name="wfls-token"]');

		if (!wrapper || !token) return;

		if (jwt) {
			jwt.value = (data && data.jwt) ? data.jwt : '';
		}

		wrapper.hidden = false;
		wrapper.setAttribute('aria-hidden', 'false');
		form.classList.add('wf-inline-2fa--active');

		const userField = qs(form, ['input[name="log"]', 'input[name="username"]']);
		const passField = qs(form, ['input[name="pwd"]', 'input[name="password"]']);

		if (userField) userField.readOnly = true;
		if (passField) passField.readOnly = true;

		setMessage(form, SiteInlineWF2FA.i18n.step2, false);
setSubmitterState(form, {
	disabled: false,
	text: 'Verify Code'
});
token.focus();
	}

	function resetTwoFactor(form, keepMessage) {
		const wrapper = form.querySelector('.wf-inline-2fa');
		const jwt     = form.querySelector('input[name="wfls-token-jwt"]');
		const token   = form.querySelector('input[name="wfls-token"]');

		if (jwt) jwt.value = '';
		if (token) token.value = '';

		if (wrapper) {
			wrapper.hidden = true;
			wrapper.setAttribute('aria-hidden', 'true');
		}

		form.classList.remove('wf-inline-2fa--active');
		delete form.dataset.inlineWf2faBypass;

		const userField = qs(form, ['input[name="log"]', 'input[name="username"]']);
		const passField = qs(form, ['input[name="pwd"]', 'input[name="password"]']);

		if (userField) userField.readOnly = false;
		if (passField) passField.readOnly = false;

		restoreSubmitterLabel(form);

if (!keepMessage) {
	setMessage(form, '', false);
}
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

		if (form.querySelector('#wfls-token-submit, input[name="wfls-token-submit"]')) {
			return true;
		}

		const nativeToken = form.querySelector('input[name="wfls-token"]');
		if (
			nativeToken &&
			nativeToken.id !== 'wfls-token-pmpro' &&
			!nativeToken.closest('.wf-inline-2fa')
		) {
			return true;
		}

		return false;
	}

	function normalizeRedirect(form) {
		let redirectToField = qs(form, ['input[name="redirect_to"]']);
		let redirectField   = qs(form, ['input[name="redirect"]']);

		if (redirectToField && redirectToField.value) {
			return;
		}

		if (redirectField && redirectField.value) {
			if (!redirectToField) {
				redirectToField = document.createElement('input');
				redirectToField.type = 'hidden';
				redirectToField.name = 'redirect_to';
				form.appendChild(redirectToField);
			}
			redirectToField.value = redirectField.value;
			return;
		}

		if (!redirectToField) {
			redirectToField = document.createElement('input');
			redirectToField.type = 'hidden';
			redirectToField.name = 'redirect_to';
			form.appendChild(redirectToField);
		}

		if (!redirectToField.value && SiteInlineWF2FA.defaultRedirect) {
			redirectToField.value = SiteInlineWF2FA.defaultRedirect;
		}
	}

	function nativeSubmit(form) {
	form.dataset.inlineWf2faBypass = '1';
	normalizeRedirect(form);

	const submitter = form.querySelector('button[type="submit"], input[type="submit"]');

	if (submitter && submitter.disabled) {
		submitter.disabled = false;
	}

	if (typeof form.requestSubmit === 'function') {
		form.requestSubmit();
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

	async function runInlineCompletion(form) {
		const jwtField            = qs(form, ['input[name="wfls-token-jwt"]']);
		const tokenField          = qs(form, ['input[name="wfls-token"]']);
		const rememberDeviceField = qs(form, ['input[name="wfls-remember-device"]']);
		const nonceField          = qs(form, ['input[name="site_inline_wf_nonce"]']);

		return post(SiteInlineWF2FA.ajaxUrl, {
			action: SiteInlineWF2FA.completeAction,
			nonce: nonceField ? nonceField.value : SiteInlineWF2FA.nonce,
			jwt: jwtField ? jwtField.value : '',
			token: tokenField ? tokenField.value.trim() : '',
			rememberme: getRememberMe(form) ? '1' : '',
			remember_device: rememberDeviceField && rememberDeviceField.checked ? '1' : '',
			redirect_to: getRedirect(form),
			context: 'pmpro'
		});
	}

	function eligibleForm(form) {
		if (!form || form.dataset.inlineWf2faBound === '1') {
			return false;
		}

		return !!qs(form, ['input[name="pmpro_login_form_used"]']) && SiteInlineWF2FA.isPMPro;
	}

	function bindForm(form) {
	if (!eligibleForm(form)) return;
	form.dataset.inlineWf2faBound = '1';
	storeSubmitterLabel(form);

	form.addEventListener('submit', async function (e) {
			if (form.dataset.inlineWf2faBypass === '1') {
				delete form.dataset.inlineWf2faBypass;
				return;
			}

			if (hasNativeWordfenceChallenge(form)) {
				normalizeRedirect(form);
				return;
			}

			const tokenField      = qs(form, ['input[name="wfls-token"]']);
			const isTwoFactorStep = form.classList.contains('wf-inline-2fa--active');

			e.preventDefault();

if (isTwoFactorStep) {
	if (!tokenField || !tokenField.value.trim()) {
		setMessage(form, SiteInlineWF2FA.i18n.invalid, true);
		return;
	}

	setMessage(form, 'Submitting verification code…', false);
	setSubmitterState(form, {
		disabled: true,
		text: 'Signing in…'
	});

	setTimeout(function () {
		nativeSubmit(form);
	}, 0);

	return;
}

setMessage(form, 'Verifying password…', false);
setSubmitterState(form, {
	disabled: true,
	text: 'Verifying…'
});

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

				const message = (result && (result.error || result.message))
	? (result.error || result.message)
	: SiteInlineWF2FA.i18n.network;

resetTwoFactor(form, true);
restoreSubmitterLabel(form);
setMessage(form, message, true);
			} catch (err) {
	resetTwoFactor(form, true);
	restoreSubmitterLabel(form);
	setMessage(form, SiteInlineWF2FA.i18n.network, true);
}
		}, true);
	}

	function bindAllForms() {
		document.querySelectorAll('form').forEach(bindForm);
	}

	document.addEventListener('DOMContentLoaded', bindAllForms);

	const observer = new MutationObserver(function () {
		bindAllForms();
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true
	});
})();