const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('all visitor-facing contact addresses use averisdigital.net', () => {
  const files = ['contact.html', 'js/enquiry.js'];
  const content = files.map(read).join('\n');
  assert.doesNotMatch(content, /hello@averisdigital\.com/i);
  assert.match(read('contact.html'), /mailto:hello@averisdigital\.net/);
  assert.match(read('js/enquiry.js'), /FALLBACK_EMAIL = 'hello@averisdigital\.net'/);
});

test('only the approved GitHub Pages host is preview mode', () => {
  const environment = require('../js/enquiry-environment.js');
  assert.equal(environment.isPreviewHost('lilacfey.github.io'), true);
  assert.equal(environment.isPreviewHost('averisdigital.net'), false);
  assert.equal(environment.isPreviewHost('www.averisdigital.net'), false);
  assert.equal(environment.isPreviewHost('localhost'), false);
});

test('enquiry endpoint stays inside the page directory', () => {
  const environment = require('../js/enquiry-environment.js');
  assert.equal(
    environment.enquiryEndpoint('https://averisdigital.net/contact.html'),
    'https://averisdigital.net/api/enquiry.php'
  );
  assert.equal(
    environment.enquiryEndpoint('https://averisdigital.net/client-preview/contact.html'),
    'https://averisdigital.net/client-preview/api/enquiry.php'
  );
});

test('contact page loads environment detection before enquiry handling', () => {
  const contact = read('contact.html');
  assert.ok(
    contact.indexOf('js/enquiry-environment.js') < contact.indexOf('js/enquiry.js'),
    'environment helper must load before enquiry.js'
  );
});

test('Coming Soon page is self-contained and uses approved copy', () => {
  const page = read('coming-soon/index.html');
  assert.match(page, /Something valuable is taking shape\./);
  assert.match(page, /Our new website is coming soon\./);
  assert.match(page, /mailto:hello@averisdigital\.net/);
  assert.match(page, /src="averis-horizontal-1200\.png"/);
  assert.match(page, /href="styles\.css"/);
  assert.doesNotMatch(page, /\.\.\//);
});

test('public crawler rules exclude the protected client preview', () => {
  assert.equal(
    read('coming-soon/robots.txt'),
    'User-agent: *\nDisallow: /client-preview/\n'
  );
});
