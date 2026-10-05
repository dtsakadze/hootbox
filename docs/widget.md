# The widget

Add one line before `</body>`:

```html
<script src="https://YOUR-HOOTBOX/widget.js" data-key="pk_…" defer></script>
```

A feedback button appears in the corner. Its label, position, which feedback
types to offer, whether to ask for an email, and the thank-you message are set
per project in **Settings → Widget**, no code changes needed.

The widget is dependency-free (~5 KB gzipped), renders inside a Shadow DOM so your site's
CSS can't break it (and it can't affect your site), is keyboard accessible, and
respects `prefers-reduced-motion`.

## Script attributes

| Attribute          | Description |
| ------------------ | ----------- |
| `data-key`         | **Required.** The project key (Settings → Security). It's public: it can only *create* feedback. |
| `data-hide-button` | Don't show the floating button; open the widget from your own UI instead. |

## Your own triggers

Any element with `data-hootbox` opens the widget. Give it a value to preselect a type:

```html
<button data-hootbox>Feedback</button>
<a href="#" data-hootbox="bug">Report a bug</a>
```

## JavaScript API

```js
Hootbox.open();                    // open the widget
Hootbox.open({ type: "idea" });    // …with a type preselected
Hootbox.close();

// Tell us who's talking: the email field is skipped and both values are stored.
Hootbox.identify({ email: "jane@acme.com", name: "Jane" });

// Attach context. Shown in the inbox, included in webhooks & CSV.
// Up to 20 keys; values: string (≤500 chars), number, boolean or null.
Hootbox.setMetadata({ plan: "pro", appVersion: "2.4.1", userId: 1234 });
```

## Restricting where the widget works

Under **Settings → Security → Allowed websites**, list the origins (e.g.
`https://myapp.com`) that may submit via the widget. Browsers always send the
`Origin` header, so other sites can't use your key. Server-side API calls (no
`Origin`) are still accepted.

## Content Security Policy

If your site uses a CSP, allow the Hootbox origin in `script-src` and `connect-src`.

## Alternatives to the widget

- **Shareable form:** `https://YOUR-HOOTBOX/f/<project-slug>`
- **Embedded form:** `<iframe src="https://YOUR-HOOTBOX/f/<project-slug>?embed=1" …>`
- **Public board:** `https://YOUR-HOOTBOX/b/<project-slug>`
- **REST API:** see [api.md](api.md)
