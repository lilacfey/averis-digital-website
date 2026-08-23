# Averis Digital Preview and Hostinger Deployment Design

## Goal

Provide a public client preview of the completed Averis Digital website through GitHub Pages while `averisdigital.net` displays a temporary branded Coming Soon page on Hostinger. After client approval, Hostinger will import the full GitHub repository and run the existing PHP-based HubSpot integration.

## Repository and environments

The website will use one public GitHub repository named `lilacfey/averis-digital-website`. The repository's main branch will remain the source of truth for the complete website.

The environments are intentionally separate:

1. GitHub Pages publishes the complete static website at `https://lilacfey.github.io/averis-digital-website/` for client review.
2. Hostinger initially serves only the contents of a repository folder named `coming-soon` at `https://averisdigital.net/`.
3. After approval, Hostinger imports the repository's production website files into `public_html`. Hostinger's PHP runtime executes `api/enquiry.php`, enabling HubSpot submissions.

The Coming Soon page is a deployment artifact, not the repository root homepage. It cannot replace the finished homepage accidentally when GitHub Pages publishes the main branch.

## Coming Soon page

The temporary page will use the existing Averis Digital logo and visual language. It will be a compact, responsive, full-screen page with no navigation or enquiry form.

Approved content:

- Averis Digital
- Something valuable is taking shape.
- Our new website is coming soon.
- hello@averisdigital.net

The email address will be a working `mailto:` link. The page will include appropriate metadata, accessible contrast, keyboard focus styling, and mobile-safe spacing.

## GitHub Pages preview behavior

The full website remains navigable and visually equivalent to production. GitHub Pages cannot execute PHP, so the contact form must not attempt to call `api/enquiry.php` in that environment.

The client-side form script will detect the `lilacfey.github.io` preview host. On submission, it will keep the entered form data in place and show a clear preview notice: "Preview only — the enquiry form activates when the website launches." No success state will be shown and no network request will be made.

On Hostinger and normal local HTTP environments, the existing submission behavior remains unchanged. The form posts to `/api/enquiry.php`, which forwards valid enquiries to the approved HubSpot form.

## Email standardization

All visitor-facing email text, `mailto:` links, and JavaScript fallback addresses will use `hello@averisdigital.net`. The known `.com` references in `contact.html` and `js/enquiry.js` will be replaced. Tests will guard against reintroducing the old address.

## GitHub publication

The local repository currently has no remote. GitHub CLI authentication for `lilacfey` is expired and must be renewed before publication.

After implementation and verification:

1. Authenticate GitHub CLI as `lilacfey` through GitHub's browser/device flow.
2. Create the public repository `lilacfey/averis-digital-website`.
3. Commit the approved website, HubSpot endpoint, tests, Coming Soon page, and deployment documentation without including temporary or machine-specific files.
4. Push the main branch.
5. Enable GitHub Pages from the main branch repository root.
6. Verify the preview URL, navigation, assets, responsive layout, and preview-only form behavior.

## Hostinger rollout

The initial Hostinger action is intentionally limited to the Coming Soon page:

1. Connect `averisdigital.net` to the client's Hostinger website using the DNS records Hostinger supplies for that specific site.
2. Upload the contents of `coming-soon` to `public_html`.
3. Verify HTTPS, desktop/mobile presentation, and the email link.

After client approval, use Hostinger's GitHub migration/import workflow for the public repository. The production document root must contain `index.html`, `about.html`, `contact.html`, `css`, `js`, `assets`, and `api`. Development-only materials such as `tests`, `docs`, and `serve.js` do not need to be web-accessible. Select PHP 8.x and confirm the cURL extension is enabled before a controlled HubSpot test submission.

## Validation and failure handling

Automated checks will verify:

- No visitor-facing `.com` email remains.
- The GitHub Pages host triggers preview-only form behavior without a fetch request.
- The Coming Soon page has no horizontal overflow at phone and desktop widths.
- Existing responsive website checks continue to pass.
- JavaScript syntax and repository whitespace remain clean.
- The PHP endpoint regression suite passes in a PHP 8.x environment when one is available.

Publishing is not considered complete until the GitHub Pages URL is reachable and visually verified. The production HubSpot form is not considered live until a controlled Hostinger submission appears in the client's HubSpot account.

## Out of scope

- Moving the production PHP endpoint to a serverless platform for GitHub Pages.
- Adding analytics, marketing consent, or new HubSpot fields.
- Replacing Hostinger as the production host.
- Changing the approved website layout or visual composition beyond the Coming Soon page.
