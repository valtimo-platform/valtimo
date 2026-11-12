<!--
  Copyright 2015-2026 Ritense BV, the Netherlands.
  Licensed under EUPL, Version 1.2 (the "License");
  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
-->

# Exchange integration

> **Audience:** operators who want administrators to browse and install from the GZAC Exchange
> inside Valtimo.

An administrator can open **Exchange** in the admin menu, browse the Exchange catalog, and install
a published case definition or building block through Valtimo's normal import flow. The integration
is **off by default**: with no URL configured the menu item is hidden and the Exchange endpoints
respond with 404.

## How it works

```
┌─────────────┐  iframe (catalog, ?embed=valtimo)  ┌──────────────┐
│   Browser   │───────────────────────────────────▶│   Exchange   │
│  (Valtimo)  │                                    │  (frontend)  │
└──────┬──────┘                                    └──────────────┘
       │ install request (ids only)                        ▲
       ▼                                                   │ HTTPS, server-side
┌─────────────┐  fetch publication + artifact       ┌──────┴───────┐
│   Valtimo   │────────────────────────────────────▶│   Exchange   │
│   backend   │                                     │  (API, /api) │
└─────────────┘                                     └──────────────┘
```

The embedded Exchange only reports "install publication X, artifact Y". Valtimo's backend builds
every Exchange URL from the one configured base URL, re-checks that the publication is
`PUBLISHED` and that the artifact belongs to it, and downloads the artifact itself. The
administrator confirms before anything is imported.

## Configuration

| Property | Environment variable | Default | Description |
|---|---|---|---|
| `valtimo.exchange.url` | `VALTIMO_EXCHANGE_URL` | *(empty, disabled)* | Base URL of the Exchange, for example `https://exchange.product-development.ritense.io`. Must be an `http` or `https` URL that serves both the web app and `/api`. A trailing slash is removed. An invalid value is logged and disables the integration. |
| `valtimo.exchange.connect-timeout` | | `5s` | Connection timeout for calls to the Exchange. |
| `valtimo.exchange.read-timeout` | | `30s` | Read timeout for calls to the Exchange, including the artifact download. |
| `valtimo.exchange.max-artifact-size` | | `50MB` | Largest artifact Valtimo downloads. A larger artifact is refused with HTTP 413. The artifact is held in memory while it is imported. |

The gzac application maps `VALTIMO_EXCHANGE_URL` to `valtimo.exchange.url` in its
`application.yml`. If you build your own application, set the property directly.

## Network requirements

- The **Valtimo backend** needs outbound HTTPS to the Exchange. A proxy or firewall that blocks the
  Exchange makes installs fail with HTTP 502 and a message in the page.
- The **browser** must be able to reach the Exchange: the catalog is shown in an iframe, and the
  Exchange's images are loaded by the browser.
- The Valtimo frontend adds the Exchange origin to its Content Security Policy `frame-src` at
  startup, based on the configured URL. No frontend configuration is needed.
- The **Exchange** must list the Valtimo frontend origin in `EMBED_FRAME_ANCESTORS` (Helm value
  `frontend.config.embedFrameAncestors`), for example `https://valtimo.example.org`. It defaults to
  `'none'`, which refuses embedding. Without it the page stays on the loading state and then shows
  an error.

## Security

- Only users with the admin role see the menu item, open the page, and call the management
  endpoints.
- The embedded Exchange has no authentication and no state-changing routes. The page is sandboxed
  and can only send identifiers to Valtimo; it never sends URLs.
- Plugin publications cannot be installed from Valtimo.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| No **Exchange** item in the menu | `valtimo.exchange.url` is empty or invalid, or the user is not an administrator. |
| The page says the Exchange could not be loaded | The Exchange is unreachable from the browser, or `EMBED_FRAME_ANCESTORS` does not include the Valtimo origin. |
| Installing fails with a bad gateway message | The Valtimo backend cannot reach the Exchange, or the Exchange returned an error. |
| Installing fails with a size message | The artifact is larger than `valtimo.exchange.max-artifact-size`. |
