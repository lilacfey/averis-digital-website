(function () {
  'use strict';

  var ENQUIRY_ENDPOINT = '/api/enquiry.php';
  var FALLBACK_EMAIL = 'hello@averisdigital.com';

  var HONEYPOT_FIELD = 'company_website';
  var MIN_SUBMIT_MS = 2000;

  function submitEnquiry(payload) {
    return fetch(ENQUIRY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (res.ok) {
        return res.json().catch(function () { return { ok: true }; });
      }
      return res.json().catch(function () { return {}; }).then(function (data) {
        var err = new Error('Request failed');
        err.status = res.status;
        err.data = data;
        throw err;
      });
    });
  }

  var form = document.getElementById('enquiry-form');
  if (!form) return;

  var panel = form.closest('.form-panel');
  var successEl = panel ? panel.querySelector('.form-success') : null;
  var errorBanner = panel ? panel.querySelector('.form-error-banner') : null;
  var submitBtn = form.querySelector('.btn-submit');
  var submitBtnLabel = submitBtn ? submitBtn.textContent : 'Send Enquiry';
  var formLoadedAt = Date.now();

  var fields = {
    name: form.querySelector('#field-name'),
    email: form.querySelector('#field-email'),
    company: form.querySelector('#field-company'),
    topic: form.querySelector('#field-topic'),
    message: form.querySelector('#field-message')
  };

  function setFieldError(key, message) {
    var input = fields[key];
    if (!input) return;
    var wrap = input.closest('.field');
    var errEl = wrap ? wrap.querySelector('.field-error') : null;
    if (message) {
      wrap.classList.add('has-error');
      input.setAttribute('aria-invalid', 'true');
      if (errEl) errEl.textContent = message;
    } else {
      wrap.classList.remove('has-error');
      input.removeAttribute('aria-invalid');
      if (errEl) errEl.textContent = '';
    }
  }

  function clearAllErrors() {
    Object.keys(fields).forEach(function (key) { setFieldError(key, ''); });
    if (errorBanner) errorBanner.classList.remove('visible');
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validate() {
    var valid = true;
    var name = fields.name.value.trim();
    var email = fields.email.value.trim();
    var message = fields.message.value.trim();

    if (!name) {
      setFieldError('name', 'Please enter your name.');
      valid = false;
    }
    if (!email) {
      setFieldError('email', 'Please enter your email address.');
      valid = false;
    } else if (!isValidEmail(email)) {
      setFieldError('email', 'Please enter a valid email address.');
      valid = false;
    }
    if (!message) {
      setFieldError('message', 'Please tell us a little about your project.');
      valid = false;
    }
    return valid;
  }

  function showError(message) {
    if (!errorBanner) return;
    errorBanner.innerHTML = message + ' You can also email us directly at ' +
      '<a href="mailto:' + FALLBACK_EMAIL + '">' + FALLBACK_EMAIL + '</a>.';
    errorBanner.classList.add('visible');
  }

  function showSuccess() {
    form.hidden = true;
    if (successEl) {
      successEl.classList.add('visible');
      var heading = successEl.querySelector('h2');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus();
      }
    }
  }

  var resendLink = panel ? panel.querySelector('.form-success .link-more') : null;
  if (resendLink) {
    resendLink.addEventListener('click', function (e) {
      e.preventDefault();
      successEl.classList.remove('visible');
      form.hidden = false;
      form.reset();
      formLoadedAt = Date.now();
      clearAllErrors();
      fields.name.focus();
    });
  }

  ['name', 'email', 'message'].forEach(function (key) {
    fields[key].addEventListener('input', function () {
      if (fields[key].closest('.field').classList.contains('has-error')) {
        setFieldError(key, '');
      }
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearAllErrors();

    var honeypot = form.querySelector('[name="' + HONEYPOT_FIELD + '"]');
    if (honeypot && honeypot.value) {
      // silently drop likely-bot submissions
      return;
    }
    if (Date.now() - formLoadedAt < MIN_SUBMIT_MS) {
      showError('That submitted a little too quickly — please try again.');
      return;
    }
    if (!validate()) return;

    var payload = {
      name: fields.name.value.trim(),
      email: fields.email.value.trim(),
      company: fields.company.value.trim() || null,
      topic: fields.topic.value || null,
      message: fields.message.value.trim(),
      company_website: honeypot ? honeypot.value : '',
      meta: {
        page: 'contact',
        pageUrl: window.location.href,
        submittedAt: new Date().toISOString(),
        source: 'website',
        userAgent: navigator.userAgent,
        referrer: document.referrer || null
      }
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    submitEnquiry(payload).then(function () {
      showSuccess();
    }).catch(function (err) {
      if (err && err.data && err.data.errors) {
        Object.keys(err.data.errors).forEach(function (key) {
          setFieldError(key, err.data.errors[key]);
        });
        showError('Please check the highlighted fields and try again.');
      } else {
        showError('Something went wrong sending your enquiry — please try again in a moment.');
      }
    }).finally(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtnLabel;
    });
  });
})();
