const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const enquiryScript = fs.readFileSync(
  path.resolve(__dirname, '../js/enquiry.js'),
  'utf8'
);

function classList() {
  return {
    add() {},
    remove() {},
    contains() { return false; }
  };
}

function field(value) {
  return {
    value,
    addEventListener() {},
    closest() {
      return {
        classList: classList(),
        querySelector() { return { textContent: '' }; }
      };
    },
    setAttribute() {},
    removeAttribute() {},
    focus() {}
  };
}

function runSubmission(hostname, environment) {
  const listeners = {};
  const fetchCalls = [];
  const fields = {
    name: field('Preview Client'),
    email: field('preview@example.com'),
    company: field('Averis Test'),
    topic: field('general'),
    message: field('Testing the protected client preview.')
  };
  const honeypot = field('');
  const submitButton = { disabled: false, textContent: 'Send Enquiry' };
  const success = {
    classList: classList(),
    querySelector() { return null; }
  };
  const errorBanner = { classList: classList(), innerHTML: '', textContent: '' };
  const panel = {
    querySelector(selector) {
      if (selector === '.form-success') return success;
      if (selector === '.form-error-banner') return errorBanner;
      return null;
    }
  };
  const form = {
    hidden: false,
    closest() { return panel; },
    querySelector(selector) {
      const bySelector = {
        '#field-name': fields.name,
        '#field-email': fields.email,
        '#field-company': fields.company,
        '#field-topic': fields.topic,
        '#field-message': fields.message,
        '.btn-submit': submitButton,
        '[name="company_website"]': honeypot
      };
      return bySelector[selector] || null;
    },
    addEventListener(type, listener) { listeners[type] = listener; },
    reset() {}
  };
  let clockCalls = 0;
  class FakeDate extends Date {
    static now() {
      clockCalls += 1;
      return clockCalls === 1 ? 0 : 3000;
    }
  }
  const location = {
    hostname,
    href: `https://${hostname}/contact.html`
  };
  const context = {
    Date: FakeDate,
    URL,
    document: {
      referrer: '',
      getElementById() { return form; }
    },
    fetch(url) {
      fetchCalls.push(url);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    },
    navigator: { userAgent: 'test-browser' },
    window: { AverisEnquiryEnvironment: environment, location }
  };

  vm.runInNewContext(enquiryScript, context);
  listeners.submit({ preventDefault() {} });
  return fetchCalls;
}

test('GitHub Pages never sends an enquiry when the environment helper is unavailable', () => {
  assert.deepEqual(runSubmission('lilacfey.github.io', undefined), []);
});
