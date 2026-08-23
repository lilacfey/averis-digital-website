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
