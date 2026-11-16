<!--
  Copyright 2015-2026 Ritense BV, the Netherlands.
  Licensed under EUPL, Version 1.2 (the "License");
  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
-->

# Exchange integration

> **Audience:** operators who want administrators to browse and install from the GZAC Exchange
> inside Valtimo.

An administrator can open **Exchange** in the admin menu, browse the published case definitions and
building blocks of a GZAC Exchange, and install one through Valtimo's normal import flow. The
integration is **on by default** and points to the public GZAC Exchange (`https://exchange.gzac.nl`).
Set the URL to an empty value to turn it off: the menu item is then hidden and the Exchange
endpoints respond with 404.

## How it works

```
┌─────────────┐  catalog: search, tags, detail, images  ┌──────────────┐
│   Browser   │────────────────────────────────────────▶│   Exchange   │
│  (Valtimo)  │         (no Valtimo token sent)         │  (API, /api) │
└──────┬──────┘                                         └──────────────┘
       │ install request (ids only)                             ▲
       ▼                                                        │ HTTPS, server-side
┌─────────────┐  fetch publication + download artifact          │
│   Valtimo   │─────────────────────────────────────────────────┘
│   backend   │
└─────────────┘
```

- The **browser** reads the catalog directly from the Exchange's public `/api/v1` and loads the
  images. Valtimo screens render it; nothing is embedded. The browser sends no Valtimo credentials
  to the Exchange.
- On install, the browser only sends a publication id and an artifact id to the Valtimo backend.
  The **backend** builds every Exchange URL from the one configured base URL, re-checks that the
  publication is `PUBLISHED`, that the artifact belongs to it and that its type can be installed,
  enforces the size cap and downloads the zip. It logs each download with the user name.
- The existing import UI then opens with the downloaded file loaded. The administrator confirms
  before anything is imported.

## Configuration

| Property | Environment variable | Default | Description |
|---|---|---|---|
| `valtimo.exchange.url` | `VALTIMO_EXCHANGE_URL` | `https://exchange.gzac.nl` | Base URL of the Exchange API. Must be an `http` or `https` URL that serves `/api`. A trailing slash is removed. Set it to an empty value to disable the integration. An invalid value is logged and also disables it. |
| `valtimo.exchange.asset-origins` | `VALTIMO_EXCHANGE_ASSET_ORIGINS` | `https://s3.de.io.cloud.ovh.net/ritense-external-extra-prod-exchange` | Comma-separated locations that serve Exchange images: an origin, optionally with a path such as a bucket. The default is the image storage of the public GZAC Exchange. See below. Invalid entries are logged and ignored. Query strings are dropped and each entry gets a trailing slash, so it allows everything under that path. |
| `valtimo.exchange.connect-timeout` | | `5s` | Connection timeout for calls to the Exchange. |
| `valtimo.exchange.read-timeout` | | `30s` | Read timeout for calls to the Exchange, including the artifact download. |
| `valtimo.exchange.max-artifact-size` | | `50MB` | Largest artifact Valtimo downloads. A larger artifact is refused with HTTP 413. The artifact is held in memory while it is imported. |

The gzac application maps the two environment variables in its `application.yml`. If you build your
own application, set the properties directly.

### Image locations

The Exchange returns logos and screenshots as presigned URLs on its object storage (S3). The host
is the Exchange's `S3_PUBLIC_ENDPOINT`. The default matches the public GZAC Exchange. If you point
`VALTIMO_EXCHANGE_URL` to another Exchange, set `VALTIMO_EXCHANGE_ASSET_ORIGINS` to its image
location so the browser may load the images. Include the bucket path when the storage host is
shared, so only that bucket is allowed. This needs path-style URLs (the bucket in the path, not in
the host name). Without a matching location the catalog still works: logos fall back to a generated
monogram and screenshots are hidden.

## Network requirements

- The **browser** must reach the Exchange API (catalog) and the asset origin (images).
- The **Valtimo backend** needs outbound HTTPS to the Exchange. A proxy or firewall that blocks the
  Exchange makes installs fail with HTTP 502 and a message on the page.
- The **Exchange** must allow cross-origin `GET` requests on its catalog read endpoints. Exchange
  versions that include the consumer contract (`docs/api-consumers.md` in the Exchange repository)
  do this for any origin.
- The Valtimo frontend extends its Content Security Policy at startup: the Exchange origin is added
  to `connect-src` and `img-src`, the asset locations (including their path) to `img-src`. `frame-src` is not changed, and no
  `frame-ancestors` setup is needed on the Exchange. No frontend configuration is needed.

## Security

- Only users with the admin role see the menu item, open the pages and call the management
  endpoint.
- Exchange text is rendered as plain text. Links to a repository, publisher website or screenshot
  are only shown for `http` and `https` URLs.
- The Exchange can return publications that are not published when asked by id. Valtimo hides them
  in the browser and refuses to download them on the backend.
- Plugin publications are listed and viewable, but cannot be installed from Valtimo.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| No **Exchange** item in the menu | `valtimo.exchange.url` is set to an empty or invalid value, or the user is not an administrator. |
| The page says the Exchange could not be reached | The Exchange is unreachable from the browser, or it does not allow cross-origin requests (check the browser console for CORS errors). |
| Logos show initials instead of images | `VALTIMO_EXCHANGE_ASSET_ORIGINS` does not match the image location of the configured Exchange. |
| Installing fails with a bad gateway message | The Valtimo backend cannot reach the Exchange, or the Exchange returned an error. |
| Installing fails with a size message | The artifact is larger than `valtimo.exchange.max-artifact-size`. |
