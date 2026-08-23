# Averis Digital Preview and Hostinger Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the complete Averis Digital website as a public GitHub Pages client preview, provide a self-contained Coming Soon page for Hostinger, and standardize the contact email to `hello@averisdigital.net` without disabling the production HubSpot flow.

**Architecture:** The repository root remains the complete production website and GitHub Pages source. A pure browser environment helper distinguishes `lilacfey.github.io` from production so the preview form displays a notice without making a request. A self-contained `coming-soon` directory is uploaded separately to Hostinger until the full repository is imported.

**Tech Stack:** Static HTML5, CSS, browser JavaScript, Node.js built-in test runner, PHP 8.x/cURL, Git, GitHub CLI, GitHub Pages, Hostinger.

**Spec:** `docs/superpowers/specs/2026-08-23-preview-and-hostinger-deployment-design.md`

## Global Constraints

- The public repository is exactly `lilacfey/averis-digital-website`.
- The GitHub Pages preview URL is `https://lilacfey.github.io/averis-digital-website/`.
- The visitor-facing email is exactly `hello@averisdigital.net`.
- The preview notice is exactly `Preview only — the enquiry form activates when the website launches.`
- GitHub Pages must never attempt the PHP enquiry request.
- Hostinger and normal local HTTP environments keep posting to `/api/enquiry.php`.
- The Coming Soon page remains separate from the repository-root production homepage.
- Do not store GitHub credentials, HubSpot private tokens, or Hostinger credentials in the repository.
- Production requires PHP 8.x with the cURL extension.

---

### Task 1: Standardize the public contact email

**Files:**
- Modify: `contact.html:157`
- Modify: `js/enquiry.js:5`
- Create: `tests/deployment-content-test.js`

**Interfaces:**
- Consumes: the existing contact-panel markup and `FALLBACK_EMAIL` constant.
- Produces: one canonical visitor-facing address, `hello@averisdigital.net`, and a Node regression command used by later tasks.

- [ ] **Step 1: Write the failing email regression test**

Create `tests/deployment-content-test.js` with Node's built-in test runner:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test tests/deployment-content-test.js
```

Expected: FAIL because `contact.html` and `js/enquiry.js` still contain `hello@averisdigital.com`.

- [ ] **Step 3: Replace both visible and fallback addresses**

In `contact.html`, use:

```html
<p class="info-value"><a href="mailto:hello@averisdigital.net">hello@averisdigital.net</a></p>
```

In `js/enquiry.js`, use:

```js
var FALLBACK_EMAIL = 'hello@averisdigital.net';
```

- [ ] **Step 4: Run the test to verify it passes**

Run `node --test tests/deployment-content-test.js`.

Expected: 1 test passes, 0 fail.

- [ ] **Step 5: Commit the email standardization**

```bash
git add contact.html js/enquiry.js tests/deployment-content-test.js
git commit -m "fix: standardize Averis contact email"
```

### Task 2: Add deterministic GitHub preview form behavior

**Files:**
- Create: `js/enquiry-environment.js`
- Modify: `contact.html` before the existing `js/enquiry.js` script
- Modify: `js/enquiry.js:1-175`
- Modify: `tests/deployment-content-test.js`

**Interfaces:**
- Produces: `window.AverisEnquiryEnvironment.isPreviewHost(hostname: string): boolean` in browsers and `{ isPreviewHost }` through CommonJS in Node.
- Consumes: `AverisEnquiryEnvironment.isPreviewHost(window.location.hostname)` from `js/enquiry.js`.
- Preview submission result: the existing `.form-error-banner` becomes visible with the approved notice; `fetch` is not called.

- [ ] **Step 1: Add failing environment-helper tests**

Append to `tests/deployment-content-test.js`:

```js
test('only the approved GitHub Pages host is preview mode', () => {
  const environment = require('../js/enquiry-environment.js');
  assert.equal(environment.isPreviewHost('lilacfey.github.io'), true);
  assert.equal(environment.isPreviewHost('averisdigital.net'), false);
  assert.equal(environment.isPreviewHost('www.averisdigital.net'), false);
  assert.equal(environment.isPreviewHost('localhost'), false);
});

test('contact page loads environment detection before enquiry handling', () => {
  const contact = read('contact.html');
  assert.ok(
    contact.indexOf('js/enquiry-environment.js') < contact.indexOf('js/enquiry.js'),
    'environment helper must load before enquiry.js'
  );
});

test('preview branch stops before the enquiry network request', () => {
  const enquiry = read('js/enquiry.js');
  const previewBranch = enquiry.indexOf('if (isPreview)');
  const request = enquiry.indexOf('submitEnquiry(payload)');
  assert.ok(previewBranch >= 0 && request > previewBranch);
  assert.match(enquiry, /Preview only — the enquiry form activates when the website launches\./);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run `node --test tests/deployment-content-test.js`.

Expected: FAIL because `js/enquiry-environment.js` and preview handling do not exist.

- [ ] **Step 3: Create the pure environment helper**

Create `js/enquiry-environment.js`:

```js
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.AverisEnquiryEnvironment = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    isPreviewHost: function (hostname) {
      return String(hostname || '').toLowerCase() === 'lilacfey.github.io';
    }
  };
}));
```

- [ ] **Step 4: Load the helper before the enquiry script**

At the bottom of `contact.html`, immediately before the existing enquiry script, use:

```html
<script src="js/enquiry-environment.js"></script>
<script src="js/enquiry.js"></script>
```

- [ ] **Step 5: Stop preview submissions after normal validation**

Near the form setup in `js/enquiry.js`, add:

```js
var PREVIEW_MESSAGE = 'Preview only — the enquiry form activates when the website launches.';
var environment = window.AverisEnquiryEnvironment;
var isPreview = environment && environment.isPreviewHost(window.location.hostname);
```

Immediately after `if (!validate()) return;` in the submit listener, add:

```js
if (isPreview) {
  showError(PREVIEW_MESSAGE, false);
  return;
}
```

Change `showError` to accept whether the fallback address should be appended:

```js
function showError(message, includeFallback) {
  if (!errorBanner) return;
  errorBanner.textContent = message;
  if (includeFallback !== false) {
    errorBanner.appendChild(document.createTextNode(' You can also email us directly at '));
    var emailLink = document.createElement('a');
    emailLink.href = 'mailto:' + FALLBACK_EMAIL;
    emailLink.textContent = FALLBACK_EMAIL;
    errorBanner.appendChild(emailLink);
    errorBanner.appendChild(document.createTextNode('.'));
  }
  errorBanner.classList.add('visible');
}
```

This also removes `innerHTML` from error rendering. Existing calls omit the second argument and retain the email fallback.

- [ ] **Step 6: Run focused tests and syntax checks**

Run:

```bash
node --test tests/deployment-content-test.js
node --check js/enquiry-environment.js
node --check js/enquiry.js
```

Expected: all tests pass and both syntax commands exit 0.

- [ ] **Step 7: Commit the preview behavior**

```bash
git add contact.html js/enquiry.js js/enquiry-environment.js tests/deployment-content-test.js
git commit -m "feat: add GitHub Pages enquiry preview mode"
```

### Task 3: Build the self-contained Coming Soon page

**Files:**
- Create: `coming-soon/index.html`
- Create: `coming-soon/styles.css`
- Copy: `assets/logo/averis-horizontal-1200.png` to `coming-soon/averis-horizontal-1200.png`
- Copy: `assets/logo/favicon-32.png` to `coming-soon/favicon-32.png`
- Modify: `tests/deployment-content-test.js`
- Modify: `tests/responsive-layout.html`

**Interfaces:**
- Consumes: existing Averis logo assets and brand colors `#1A5FE0`, `#0A1628`, and white.
- Produces: a standalone directory whose contents can be uploaded directly to Hostinger `public_html` without relying on parent paths.

- [ ] **Step 1: Add failing Coming Soon content tests**

Append to `tests/deployment-content-test.js`:

```js
test('Coming Soon page is self-contained and uses approved copy', () => {
  const page = read('coming-soon/index.html');
  assert.match(page, /Something valuable is taking shape\./);
  assert.match(page, /Our new website is coming soon\./);
  assert.match(page, /mailto:hello@averisdigital\.net/);
  assert.match(page, /src="averis-horizontal-1200\.png"/);
  assert.match(page, /href="styles\.css"/);
  assert.doesNotMatch(page, /\.\.\//);
});
```

- [ ] **Step 2: Add failing responsive checks**

In `tests/responsive-layout.html`, add checks for `../coming-soon/index.html` at widths 320 and 1440. Each check must assert:

```js
return doc.documentElement.scrollWidth <= doc.documentElement.clientWidth &&
  doc.querySelector('.coming-card').getBoundingClientRect().width <= width;
```

Run `node --test tests/deployment-content-test.js` and `sh tests/run-responsive-tests.sh`.

Expected: FAIL because the Coming Soon files do not exist.

- [ ] **Step 3: Create accessible Coming Soon markup**

Create `coming-soon/index.html` with:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Averis Digital's new website is coming soon.">
  <title>Coming Soon — Averis Digital</title>
  <link rel="icon" type="image/png" href="favicon-32.png">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main class="coming-main">
    <section class="coming-card" aria-labelledby="coming-title">
      <img class="coming-logo" src="averis-horizontal-1200.png" alt="Averis Digital">
      <p class="coming-eyebrow">Estonia-based · Working internationally</p>
      <h1 id="coming-title">Something valuable is taking shape.</h1>
      <p class="coming-copy">Our new website is coming soon.</p>
      <a class="coming-email" href="mailto:hello@averisdigital.net">hello@averisdigital.net</a>
    </section>
  </main>
</body>
</html>
```

- [ ] **Step 4: Add compact responsive brand styling**

Create `coming-soon/styles.css` with a full-height blue/navy gradient background, a centered translucent card, `max-width: 760px`, `clamp()` typography, `padding-inline: clamp(20px, 6vw, 88px)`, visible `:focus-visible` styling, `overflow-wrap: anywhere` on the email link, and a `prefers-reduced-motion` rule that disables decorative animation. Use only local/system fonts so Hostinger needs no external font request.

- [ ] **Step 5: Copy the required binary assets**

Run:

```bash
cp assets/logo/averis-horizontal-1200.png coming-soon/averis-horizontal-1200.png
cp assets/logo/favicon-32.png coming-soon/favicon-32.png
```

- [ ] **Step 6: Run content, syntax, and responsive tests**

Run:

```bash
node --test tests/deployment-content-test.js
sh tests/run-responsive-tests.sh
git diff --check HEAD
```

Expected: all content tests and all responsive checks pass; diff check exits 0.

- [ ] **Step 7: Commit the Coming Soon page**

```bash
git add coming-soon tests/deployment-content-test.js tests/responsive-layout.html
git commit -m "feat: add branded Coming Soon page"
```

### Task 4: Verify and commit the complete local website state

**Files:**
- Include: `index.html`, `about.html`, `contact.html`, `css/styles.css`, `js/*.js`, `api/enquiry.php`, `assets/**`, `coming-soon/**`, `tests/**`, `docs/**`
- Exclude: `.DS_Store`, temporary runtime files, credentials, and ignored `serve.js` unless intentionally force-added as a documented local utility.

**Interfaces:**
- Consumes: the completed static preview, Coming Soon artifact, and Hostinger PHP endpoint.
- Produces: a clean, reproducible main branch ready to push.

- [ ] **Step 1: Audit the pending diff and ignored files**

Run:

```bash
git status --short
git diff --stat HEAD
git diff --check HEAD
git status --ignored --short
```

Confirm no credentials, generated browser profiles, npm cache, or `/tmp` paths are present. Confirm `api/enquiry.php` and all intended tests are included.

- [ ] **Step 2: Run the full local verification suite**

Run:

```bash
node --test tests/deployment-content-test.js
node --check js/main.js
node --check js/enquiry-environment.js
node --check js/enquiry.js
node --check serve.js
sh tests/run-responsive-tests.sh
git diff --check HEAD
```

If PHP 8.x is available, additionally run:

```bash
php tests/enquiry-endpoint-test.php
```

Expected: every available command exits 0. If PHP is unavailable, record that limitation explicitly for Hostinger staging rather than claiming the PHP suite passed.

- [ ] **Step 3: Review the website in a local browser**

Open `index.html`, `about.html`, `contact.html`, and `coming-soon/index.html` at desktop and phone widths. Verify navigation, images, focus states, compact margins, the lamp-safe eyebrow position, Coming Soon composition, and the `.net` email.

- [ ] **Step 4: Commit the complete implementation**

Stage only reviewed project artifacts, then inspect the staged summary before committing:

```bash
git add index.html about.html contact.html css js api assets coming-soon tests docs
git diff --cached --stat
git commit -m "feat: prepare Averis website for client preview"
```

### Task 5: Authenticate and publish the public GitHub repository

**Files:**
- External state: GitHub account `lilacfey`, repository `lilacfey/averis-digital-website`, local `origin` remote.

**Interfaces:**
- Consumes: verified, committed main branch from Task 4.
- Produces: public repository and reachable GitHub Pages preview.

- [ ] **Step 1: Renew GitHub authentication as lilacfey**

Run:

```bash
gh auth login --hostname github.com --git-protocol https --web
gh auth status
```

The user completes GitHub's browser/device authorization. Verify the active account is exactly `lilacfey` before creating anything.

- [ ] **Step 2: Confirm the target repository does not already exist**

Run:

```bash
gh repo view lilacfey/averis-digital-website
```

Expected for a new repository: not found. If it exists, stop and inspect its default branch and contents; do not overwrite it without explicit approval.

- [ ] **Step 3: Create and push the public repository**

Run:

```bash
gh repo create lilacfey/averis-digital-website --public --source=. --remote=origin --push
```

Verify:

```bash
git remote -v
git status --short --branch
gh repo view lilacfey/averis-digital-website --json nameWithOwner,visibility,url,defaultBranchRef
```

Expected: `visibility` is `PUBLIC`, default branch is `main`, and local `main` tracks `origin/main`.

- [ ] **Step 4: Enable GitHub Pages from main/root**

First inspect current Pages state:

```bash
gh api repos/lilacfey/averis-digital-website/pages
```

If Pages is not configured, run:

```bash
gh api --method POST repos/lilacfey/averis-digital-website/pages --input -
```

Provide this JSON on standard input:

```json
{"source":{"branch":"main","path":"/"},"build_type":"legacy"}
```

- [ ] **Step 5: Wait for the Pages build and verify deployment state**

Run:

```bash
gh run list --repo lilacfey/averis-digital-website --limit 10
gh api repos/lilacfey/averis-digital-website/pages
```

Wait until the Pages API reports the published URL and the relevant deployment/build succeeds. Do not infer success from repository creation alone.

- [ ] **Step 6: Verify the live GitHub Pages preview**

Open `https://lilacfey.github.io/averis-digital-website/` and verify:

- Home, About, and Contact navigation works under the repository subpath.
- CSS, JavaScript, logos, and hero images load without 404 responses.
- Desktop and phone layouts have no horizontal overflow.
- Contact submission with valid-looking test values shows the approved preview notice.
- The browser sends no request to `/api/enquiry.php`.
- The visible and fallback email is `hello@averisdigital.net`.

### Task 6: Prepare the Hostinger Coming Soon handoff

**Files:**
- Read: `coming-soon/index.html`
- Read: `coming-soon/styles.css`
- External state, only with the user's Hostinger/Namecheap access: Hostinger `public_html` and DNS for `averisdigital.net`.

**Interfaces:**
- Consumes: the verified self-contained `coming-soon` directory.
- Produces: an exact deployment handoff; if authenticated access is available and explicitly authorized, a live temporary page at `averisdigital.net`.

- [ ] **Step 1: Package only the temporary page files**

Confirm the upload set is exactly:

```text
index.html
styles.css
averis-horizontal-1200.png
favicon-32.png
```

Do not upload the repository root or PHP endpoint during the temporary-page stage.

- [ ] **Step 2: Obtain the site-specific Hostinger DNS values**

In Hostinger hPanel, open the website for `averisdigital.net` and record the exact nameservers or A/AAAA records Hostinger displays. Do not substitute generic Hostinger values.

- [ ] **Step 3: Connect the Namecheap domain**

In Namecheap Advanced DNS or Nameservers, apply only the exact Hostinger values from Step 2. Preserve any existing email-delivery MX, SPF, DKIM, and DMARC records unless Hostinger explicitly migrates them. DNS changes require the user's confirmation immediately before saving.

- [ ] **Step 4: Upload and verify the temporary page**

Upload the four Coming Soon files to Hostinger `public_html`. Then verify both `https://averisdigital.net/` and `https://www.averisdigital.net/`, HTTPS status, phone/desktop layout, logo loading, and the `mailto:hello@averisdigital.net` link.

- [ ] **Step 5: Record the final production migration checklist**

For launch, import `https://github.com/lilacfey/averis-digital-website` through Hostinger, place the repository-root website in `public_html`, enable PHP 8.x and cURL, exclude `coming-soon`, `tests`, and `docs` from the public document root where the importer permits, and submit one clearly labeled controlled enquiry. Confirm that enquiry appears in the client's HubSpot form submissions before announcing production launch.
