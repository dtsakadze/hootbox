# Changelog

## [0.1.1](https://github.com/dtsakadze/hootbox/compare/v0.1.0...v0.1.1) (2026-10-05)


### Bug Fixes

* plain vX.Y.Z release tags, robust version parsing for images and update checks ([d7d16d8](https://github.com/dtsakadze/hootbox/commit/d7d16d899d9eefa5a9ceec50ce64720edeafd84e))

## 0.1.0 (2026-10-05)

Initial release of Hootbox, a friendly, self-hostable feedback collection platform.

### Features

* **Widget:** embeddable feedback button (one script tag) with feedback types, mood rating, optional email, page and browser capture, custom triggers and a small JS API
* **Public board & roadmap:** idea posting, upvotes, public replies, planned / in progress / done view
* **Shareable form:** standalone feedback page, embeddable via iframe
* **Inbox:** filters, full-text search, bulk triage, tags, internal notes, reply by email
* **Insights:** volume over time, breakdowns by type and status, average mood, top tags, most-voted ideas
* **Notifications:** Slack and Discord webhooks, or signed JSON webhooks
* **REST API** for submitting feedback, plus CSV export
* **Teams:** single-use invite links with owner, admin and member roles
* **Security:** hashed passwords and sessions, CSRF protection, rate limiting, spam honeypot, origin allowlist, security headers
* **Deployment:** Docker image on GHCR, Docker Compose, Node/VPS, Vercel, Netlify, Cloudflare Workers
* Shows the running version and tells admins when a new release is available
