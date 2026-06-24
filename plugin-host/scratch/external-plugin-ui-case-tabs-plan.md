# External Plugin UI — Case Tabs Plan

A low-to-medium detail technical plan for the **first frontend surface** of the external plugin
system: rendering a plugin's UI bundle as a **case tab**. Companion to
`external-plugin-system-plan.md` (the backend/host plan); this document is about the frontend
integration and the data paths that feed a plugin tab.

Status legend: ✅ exists & usable as-is · 🟡 exists but needs extension · ⛔ not built yet.

---

## 1. Goal & scope

Show a plugin-provided HTML/JS bundle inside a case-detail tab, the same way the built-in
Summary / Documents / Notes tabs render. The bundle runs in an `<iframe>` served from the plugin
host and needs to display data. That data has two distinct origins, and the plan must support
**both**:

1. **Plugin-served data** — the bundle gets data from the plugin itself (the plugin host's own
   store, or data the plugin computed). The core app is not involved in producing it.
2. **Valtimo-served data, scoped to the logged-in user's permissions** — the bundle shows GZAC
   domain data (case fields, documents, tasks, audit, …) and must respect what *this user* is
   allowed to see/do (PBAC). This may flow either straight from the iframe to GZAC, or *through*
   the plugin.

The interesting design tension is entirely in **#2**: "scoped to the user's permissions" rules out
the existing service-token path (it bypasses PBAC). See §6.

Out of scope for the first iteration: case widgets, menu pages, task forms (same iframe
machinery, later surfaces), HTMX `render_page`/`handle_request`, and host-side data storage (KV).

---

## 2. What already exists (the building blocks)

The good news: most of the plumbing for an iframe case tab is already in place. The gaps are
specific and known.

| Building block | Where | Status |
|---|---|---|
| Iframe component (`ExternalPluginIframeComponent`) — `bundleUrl` in, postMessage protocol, auto-resize | `frontend/projects/valtimo/plugin/src/lib/components/external-plugin-iframe/` | ✅ reusable |
| `init` postMessage payload `{context, accessToken, theme, locale}` | same, `onIframeLoad()` | 🟡 `accessToken` is hard-coded `''`; `context` always `{}` |
| Frontend SDK (`ValtimoPluginSDK`) — `ready()`, `t()`, `getContext()`, `getAccessToken()`, `onContext()` | `plugin-host/plugin-sdk/src/frontend/plugin-frontend-sdk.ts` | ✅ `getAccessToken()` already wired to the `init`/`tokenRefresh` payload |
| `'case-tab'` frontend-bundle type | `frontend/.../plugin/src/lib/models/external-plugin.model.ts` (`ExternalPluginFrontendBundleType`) | ✅ already a declared value |
| Bundle serving (`GET /plugins/:id/:version/bundles/*`, public, CORS `*`) | `plugin-host/app/src/routes/plugin-bundles.ts` | ✅ |
| Bundle URL shape `${definition.baseUrl}/${version}${bundle.path}` | built inline in 3 places (config / edit / process-link-action) | 🟡 duplicated; no shared resolver |
| CSP — plugin host origins added to `frame-src`/`img-src` at bootstrap | `frontend/.../security/.../initialize-csp.ts`, fed by `frontend/.../bootstrap/.../init.ts` | ✅ covers any registered host |
| Service token (config-scoped, PBAC-bypassing, allowlist-only) for action/event callbacks | `backend/external-plugin/.../security/ExternalPluginServiceToken*` | ✅ but **not** user-scoped |
| User token (PBAC ∩ allowlist) for iframe → GZAC on behalf of the user | §13 of the backend plan | ⛔ described, not built |
| Case-tab dispatch: tab `type` → component, via `CaseTabService.mapTab()` | `frontend/.../case/src/lib/services/case-tab.service.ts` | ✅ extension point |
| Case-tab types (`STANDARD, FORMIO, CUSTOM, WIDGETS`) backend enum + `WIDGETS` side-table precedent | `backend/case/.../domain/CaseTabType.kt`, `case_widget_tab` table | ✅ pattern to mirror |
| Admin tab config UI (type picker, content-key form, per-type editor route) | `frontend/projects/valtimo/case-management/.../tabs/` | 🟡 needs a new type option |

**Key takeaway:** the iframe, the bundle serving, the CSP handling, the `'case-tab'` bundle type,
and the dispatch hook all exist. The two real gaps are (a) **how a tab declares which plugin
bundle it renders** (a small new tab-type + config), and (b) **the user-scoped data path**
(the §13 user token, plus a way for the iframe to reach GZAC).

---

## 3. The elements involved (the moving parts)

A working plugin case tab requires all of these to line up:

1. **Tab declaration** — an admin configures, on a case definition, "this tab is plugin X's
   case-tab bundle." (§4, §5)
2. **Tab dispatch** — the case-detail view recognises the tab type and instantiates an iframe
   component instead of a built-in component. (§4)
3. **Bundle resolution** — turning the stored plugin reference into a concrete `bundleUrl`
   (`${baseUrl}/${version}${bundle.path}` for the `case-tab` bundle). (§5)
4. **Context delivery** — the iframe must know *which case* it is rendering (documentId,
   caseDefinitionKey, version tag, maybe taskId). Carried in `init.context`. (§7)
5. **Data path** — how the bundle actually gets data to display. This is the crux. (§6)
6. **Auth** — for any user-scoped GZAC data, a token the iframe can present that is bounded by
   *both* the user's PBAC *and* the plugin's granted endpoints. (§6.3, §8)
7. **Cross-cutting** — CSP, iframe sandbox, sizing, loading/error states, i18n, theme,
   navigation. (§8)

---

## 4. Decision 1 — Tab integration mechanism (how the tab appears & renders)

How does a plugin tab slot into the existing case-tab machinery? Three viable options.

### Option A — New dedicated tab type `EXTERNAL_PLUGIN` (mirror the `WIDGETS` precedent)

Add `EXTERNAL_PLUGIN` to `CaseTabType` (backend) and `ApiTabType` (frontend). Add a `case` to
`CaseTabService.mapTab()` mapping it to a new `CaseDetailExternalPluginTabComponent` that wraps
`ExternalPluginIframeComponent`. Store the plugin reference either in `contentKey` or a side table
(§5). This is exactly how `WIDGETS` works today: a tab-type value + a dispatcher component +
(optionally) a side config table (`case_widget_tab`).

- **Pros:** clean, first-class, self-documenting; admin picks "External plugin" in the type picker;
  matches the strongest existing precedent (`WIDGETS`); no abuse of an unrelated mechanism;
  per-type config screen is a well-trodden path (`onRowClicked()` already branches on `WIDGETS`).
- **Cons:** touches both enums (keep them in sync — note the frontend already has an orphan
  `MAP='map'` with no backend counterpart, a cautionary tale), the admin type-picker, the
  content-key form, and the disabled-flag logic. ~6 small edit sites. A DB enum value needs no
  migration (`type` is `varchar(20)`), but a side table would.

### Option B — Reuse the existing `CUSTOM` tab type + `CASE_TAB_TOKEN`

`CUSTOM` tabs resolve `contentKey` against a `CaseTabConfig` map injected via `CASE_TAB_TOKEN`.
Register one generic `ExternalPluginTabComponent` under a well-known key, and have it read the
real plugin reference from somewhere (a convention in `contentKey`, or config).

- **Pros:** zero backend enum changes; uses the canonical extension hook; the dispatch already
  works.
- **Cons:** `CUSTOM` is built for **compile-time** Angular components keyed by `contentKey`; it has
  no notion of "pick a plugin configuration at admin time." You'd be overloading `contentKey` to
  smuggle a plugin reference, and the admin UI for `CUSTOM` lists *registered component keys*, not
  plugin configurations — so the admin experience is wrong without extra work anyway. Ends up being
  as much work as Option A but messier and less legible.

### Option C — Render the plugin iframe as a *widget* inside a `WIDGETS` tab

Instead of a whole-tab type, add a `WidgetType.IFRAME` (or register an iframe renderer via the
existing `CUSTOM_WIDGET_TOKEN` / `WidgetType.CUSTOM` hook) so a plugin bundle becomes one widget
among others on a widgets tab.

- **Pros:** composable — a plugin panel can sit alongside built-in widgets; reuses the rich widget
  layout/config system; the `CUSTOM_WIDGET_TOKEN` registry is a real, working extension point.
- **Cons:** doesn't match the stated goal ("display UI bundles **as case tabs**"); a full-bleed
  iframe is awkward inside a widget grid (sizing, scroll); more config surface (widget layout +
  widget config) than a tab. Better as a *later* surface once tabs work.

### Recommendation

**Option A.** It is the most direct read of the requirement, mirrors the closest existing pattern
(`WIDGETS`), and keeps the admin experience honest ("this tab is plugin X"). Option C is a natural
*follow-up* surface (case widgets are already on the roadmap), and Option B is a trap — same cost,
worse fit.

---

## 5. Decision 2 — How a tab references a plugin (config storage)

A plugin tab needs to persist: **which plugin configuration** (or definition+version) and **which
`case-tab` bundle** (a plugin may ship more than one, keyed). Two storage shapes.

### Option A — Pack it into `contentKey`

Store e.g. `contentKey = "<pluginConfigurationId>:<bundleKey>"` on the `case_tab` row.

- **Pros:** no schema change; the generic CRUD/import/export already carry `contentKey`; trivial.
- **Cons:** opaque, stringly-typed; no FK integrity (a deleted plugin config leaves a dangling
  reference); awkward to extend if a tab later needs more plugin-specific settings (default
  filters, height mode, etc.).

### Option B — A side config table `case_external_plugin_tab` (mirror `case_widget_tab`)

A table FK-linked to `case_tab` (composite PK, `ON DELETE CASCADE`) holding
`external_plugin_configuration_id`, `bundle_key`, and room for future per-tab settings. Served by a
dedicated endpoint (`GET /api/v1/document/{documentId}/external-plugin-tab/{tabKey}`) just like
`CaseWidgetTabResource`.

- **Pros:** clean, extensible, integrity-checked; matches the `WIDGETS` precedent exactly; the
  dedicated endpoint is the natural place to (a) resolve the bundle URL, (b) check the user may see
  this tab (PBAC on the case), and (c) mint/return the user token (§6.3) in one call.
- **Cons:** new Liquibase changeset + new resource/service; deletion guards to consider (a tab
  referencing a configuration is another thing blocking that configuration's deletion — see the
  existing strict delete guards in the backend plan §12).

### Recommendation

**Option B.** The dedicated content endpoint pays for itself: it becomes the single
"hydrate this tab" call that returns the bundle URL, the case context, and (if we go user-token) a
freshly minted short-lived token — one round trip, server-authoritative, PBAC-checked. Start with
just `configurationId` + `bundleKey`; the table gives us somewhere to grow.

---

## 6. Decision 3 — Data sourcing model (the core question)

This is what the user's question is really about. There are **four** distinct ways a bundle can get
data; a plugin tab can use any combination. The decisive axis is *who enforces the user's
permissions*.

```
                                   ┌─────────────┐
                          (1)      │ Plugin host │   plugin's own data / compute
        iframe  ───────────────────▶│  (routes)   │
          │                         └──────┬──────┘
          │ (3) user token                 │ (2) service token (PBAC-BYPASS, config-scoped)
          │  and if there               │ (4) forwarded user token (PBAC ∩ allowlist)
          ▼                                ▼
     ┌─────────┐                      ┌─────────┐
     │  GZAC   │◀─────────────────────│  GZAC   │
     └─────────┘                      └─────────┘
```

### 6.1 Path (1) — Plugin-served data (iframe → plugin host)

The bundle fetches from the plugin host's own routes; the host returns data it owns or computed.

- **Status:** ⛔ the host has **no data routes today** — only `bundles`, `logo`, `plugin-manifest`,
  HMAC-signed `actions`/`configurations`, and `health`. We'd add a host route (e.g.
  `GET/POST /plugins/:id/:version/data/...` handled by the plugin's Wasm, the not-yet-built
  `handle_request`/`render_page` from backend-plan §14).
- **Pros:** simplest mental model when the data genuinely is the plugin's; no GZAC involvement; no
  token needed if the data isn't sensitive.
- **Cons:** requires building host data routes + a Wasm request handler (sizeable, §14 of backend
  plan); **no user-permission story** unless the host also receives the user token (→ path 4);
  CORS/auth for these host routes needs design (bundles are currently public `*`).
- **Use when:** the plugin is the source of truth for the data (its own store, external API it
  integrates, derived/computed values).

### 6.2 Path (2) — GZAC data via the **service token** (iframe → host → GZAC)

Reuse the existing action/event callback path: the iframe asks the host, the host calls GZAC with
the per-configuration **service token**.

- **Status:** ✅ mechanism exists (this is how actions/events call back), but ⛔ as an
  iframe-triggered path (needs a host data route to trigger it, as in 6.1).
- **Pros:** reuses a built, tested mechanism; the token never reaches the browser.
- **Cons:** **the service token bypasses PBAC** — it is scoped to the *configuration's* granted
  endpoints, not the *user*. So this path can show data the logged-in user may not be allowed to
  see. **This violates requirement #2** ("based on the permissions of the user"). Acceptable only
  for data that is intentionally the same for everyone who can open the tab (and even then the
  tab-visibility PBAC check is the only user gate).
- **Use when:** non-user-specific reference data, where config-level scoping is sufficient.

### 6.3 Path (3) — GZAC data via the **user token** (iframe → GZAC directly) — the §13 design

The iframe calls GZAC endpoints directly, presenting a short-lived **downscoped user token**:
authenticated as the real user (PBAC runs normally) **and** intersected with the plugin
configuration's granted endpoints (the allowlist).

- **Status:** ⛔ not built. This is backend-plan §13 + roadmap #1. What it builds on already exists:
  `ExternalPluginServiceTokenFilter` (structural template), `ExternalPluginEndpointAllowlistFilter`
  (the allowlist half), `ExternalPluginServiceTokenKeyProvider` (same signing secret, new
  `type=external_plugin_user`), the granted-endpoint table, and the SDK's `getAccessToken()`
  (already populated from `init.accessToken`). The frontend `accessToken: ''` placeholder is the
  exact spot to plug in.
- **What to build:**
  - `POST /api/management/v1/external-plugin/user-token` — Bearer = user's Keycloak token; body
    identifies the plugin configuration; returns a JWT scoped to `(userSub, pluginConfigurationId)`,
    TTL ≤ 15 min, signed with the SHA-256-derived plugin secret, `type=external_plugin_user`.
  - `ExternalPluginUserTokenFilter` — recognises the token, attaches a principal carrying **both**
    the user identity **and** the bound configuration; **does NOT** wrap the request in
    `runWithoutAuthorization` (unlike the service-token filter), so PBAC runs against the user's
    roles.
  - Extend `ExternalPluginEndpointAllowlistFilter` (or a sibling) to also enforce the allowlist for
    this principal → net rule = PBAC ∩ allowlist.
  - Frontend: replace `accessToken: ''` with a token fetched per tab load (and a `tokenRefresh`
    before the ≤15-min expiry); the dedicated tab content endpoint (§5 Option B) is the natural
    place to mint and return it.
- **Pros:** **exactly satisfies requirement #2** — the plugin can do, on the user's behalf, only
  what the user could already do **and** what the admin granted; no new authz model, it composes
  PBAC with the existing allowlist; token is short-lived and configuration-bound; one place
  (`/user-token`) to audit.
- **Cons:** the token lives in the browser/iframe (mitigated by ≤15-min TTL + sandbox + the
  intersection bound); meaningful new backend work; the iframe calls GZAC's *real* API surface, so
  bundle authors code against Valtimo endpoints (acceptable — the allowlist gates exactly which).
- **Use when:** the tab shows GZAC domain data that must respect the user's permissions — the
  common case.

### 6.4 Path (4) — GZAC data through the plugin, with the **user token forwarded**

A hybrid: the iframe sends the user token to the *plugin host*, the host calls GZAC **with that
user token** (not the service token). "From Valtimo, through the plugin," but still user-scoped.

- **Status:** ⛔ depends on both path-1 host routes and path-3 user token.
- **Pros:** lets the plugin *combine* GZAC data (user-scoped) with its own data server-side before
  returning it to the iframe; keeps composition logic in the plugin, not the browser.
- **Cons:** the user's token transits the plugin host (trust + transport-confidentiality concern,
  cf. backend-plan §3.9 TLS); most complex; only worth it when server-side composition is genuinely
  needed.
- **Use when:** the plugin must merge user-scoped GZAC data with plugin data in one server-side
  step.

### Recommendation — all four are first-class (decision)

**All four paths are supported**, each for a distinct, legitimate need (decided — not "primary vs
edge"). Exfiltration risk is **accepted** as long as access is bounded by PBAC ∩ allowlist (for the
user-token paths) or by the granted-endpoint allowlist (for the service-token path): the granted
endpoints accepted at activation *are* the approval, so a vetted plugin transmitting data it was
explicitly allowed to read is an acceptable risk. That makes the **token the security boundary**
(§6.6).

| Scenario | Path | Token | Bound by | Use it for |
|---|---|---|---|---|
| 1 | iframe → host | none / host-internal | n/a | Data that lives only in the plugin (its own store / compute). |
| 2 | iframe → host → GZAC, **or** event handler | **service** (exists) | allowlist only (PBAC-bypass) | Plugin needs *more* than the user can see, **or** no user is involved (e.g. reacting to an event). |
| 3 | iframe → GZAC | **user** | PBAC ∩ allowlist | Show the user data they already have access to — most efficient, no host hop. *(optional but preferred for user-scoped reads).* |
| 4 | iframe → host → GZAC | **user, forwarded** | PBAC ∩ allowlist | Combine / enrich the user-accessible data server-side before display. |

Sequencing note: (2) already exists. (3) is the smallest *new* surface (no host data routes), so
it's the natural first build; (1) and (4) additionally need host data routes
(`handle_request`/`render_page`, backend-plan §14) and so come after. This is a *build order*, not
a statement that any path is second-class.

---

## 6.6 User-token mechanics — minting & token isolation (decided)

How the user token (paths 3 & 4) is obtained, and how we guarantee the FE bundle never sees the
*original* Keycloak token (which carries the user's full, un-intersected permissions).

### 6.6.1 How the parent gets the user token

The **parent Angular app mints it; the iframe never does.**

1. The logged-in user's **Keycloak access token** lives in the Valtimo app (auth/bootstrap layer)
   and authenticates all normal GZAC calls.
2. On tab mount the parent calls
   `POST /api/management/v1/external-plugin/user-token` with `Authorization: Bearer <keycloak-token>`
   and body `{pluginConfigurationId, documentId?}`.
3. GZAC's normal `BearerTokenAuthenticationFilter` validates the Keycloak token and resolves the
   user (`sub` + roles). The endpoint then loads the config's `external_plugin_granted_endpoint`
   rows, optionally PBAC-checks tab/case visibility, and **mints a new short-lived JWT** signed with
   the same `SHA-256(valtimo.plugin.encryption-secret)` key as service tokens but
   `type=external_plugin_user`. Claims: `sub` (real userId), the user's `roles`, `plugin_config_id`,
   `iss`, `exp = now + ≤15 min`. Returns `{userToken, expiresAt}`.
4. The parent pushes `userToken` into the iframe via `init.accessToken` (replacing the `''`
   placeholder) and re-mints + sends `tokenRefresh` before expiry (or reactively on a 401).

At **use** time, `ExternalPluginUserTokenFilter` rebuilds a **normal Valtimo user `Authentication`**
(same `sub` + roles) — *not* `runWithoutAuthorization` — so PBAC runs as for a real user, and the
allowlist filter additionally gates the endpoint → **PBAC ∩ allowlist**. Roles are embedded in the
token (frozen ≤15 min) so no Keycloak round-trip is needed at use time.

- **No escalation from exposing `/user-token` to all users:** the result is always bounded by
  PBAC ∩ allowlist, so a user can only ever exercise what they already could *and* what was granted.
  Need not be ADMIN-gated.
- **Path 4:** the iframe forwards this *same* user token to the host, which attaches it as bearer on
  its `gzac_api` call. GZAC verifies it; the host can't (no signing key) and doesn't need to — a
  forged token just fails signature check at GZAC. The host's `gzac_api` host function therefore
  needs a "call as the user" mode (use the forwarded token from `hostContext`) alongside the
  existing "call as the plugin" mode (service token). Event handlers have no user token → service
  token only.
- **Path 3 wiring:** iframe (host origin) → GZAC (other origin) needs GZAC **CORS** to allow the
  plugin-host origin + `Authorization` header, and the iframe's host-injected CSP `connect-src` must
  list the GZAC origin.

### 6.6.2 Guaranteeing the bundle can't reach the Keycloak token

The guarantee is **cross-origin iframe isolation (Same-Origin Policy)** — browser-enforced, not
policed in app code:

- The bundle iframe is served from the **plugin host origin**, a *different origin* than the Valtimo
  app. The browser therefore forbids the iframe's JS from reading the parent's `window`/memory or
  the parent's `localStorage`/`sessionStorage`/cookies. Wherever the Keycloak token sits in the
  Valtimo app, the iframe **cannot reach it.**
- The only parent↔iframe channel is `postMessage`; the parent controls exactly what crosses and
  **only ever sends the downscoped `userToken`** — the Keycloak token never enters a postMessage.
- The iframe also **can't mint its own** user token: `/user-token` requires the Keycloak bearer,
  which the iframe doesn't have.

Hard requirements that keep this true:

1. **The plugin host must be a distinct *origin* from the Valtimo app.** Isolation keys on
   **origin = scheme + host + port**, not on "domain"/site — see §6.6.3 for the production-ingress
   consequences. A bundle served from Valtimo's *exact* origin has zero isolation.
2. **`sandbox="allow-same-origin"` does not break this** (common misconception): it keeps the iframe
   at *its own* (plugin host) origin, never grants it Valtimo's origin. Dropping it makes the iframe
   an opaque origin (even more isolated) at the cost of its own same-origin features (storage; and
   its `fetch` then sends `Origin: null`, which complicates path-3 CORS).
3. **Parent-side defense in depth:** target `postMessage` at the exact iframe origin (not `'*'` —
   the component currently falls back to `'*'`), validate inbound `source`/`origin` (SDK already
   does), and never inject the raw Keycloak token into `ExternalPluginIframeComponent` — it only
   receives the downscoped token. A bug can't leak what the component never holds.

Net: the iframe only ever holds a **downscoped user token** (paths 3/4) or nothing (path 1) — never
the Keycloak token, never the service token (which stays server-side via the host's `hostContext`,
backend-plan §3.5).

### 6.6.3 Production ingress topology (origin vs. site) — deployment requirement

In production both the Valtimo BE and the plugin host sit behind an ingress, which makes the
deployment **origin** the load-bearing security decision. SOP keys on origin, and `localStorage`/
`sessionStorage`/IndexedDB/`window`/DOM access are all **origin-partitioned**, not site-partitioned.
Two topologies:

- **Same exact origin** (one hostname, path routing — `app.example.com/api/*` → BE,
  `app.example.com/plugins/*` → host): the iframe is **same-origin** with the parent → **zero
  isolation**, the iframe can read the parent's window/storage and lift the Keycloak token directly,
  bypassing postMessage. **Disallowed for plugin iframes.** postMessage discipline cannot save this.
- **Different subdomains of one domain** (`app.example.com` ↔ `plugins.example.com`): **different
  origins, same site.** SOP isolation **holds** (window/DOM/storage are origin-keyed). This is the
  standard, safe pattern — ingress routes by Host header. Three same-site caveats to close:
  - **`document.domain`:** the Valtimo app must never set it (it needs both sides to opt in, so the
    iframe can't relax origin unilaterally). Send `Origin-Agent-Cluster: ?1` to disable it outright.
  - **Cookie scope:** keep auth cookies **host-scoped** (`app.example.com`, not `.example.com`) and
    `HttpOnly`; ideally the SPA holds the Keycloak token in memory, not a JS-readable cookie. Cookies
    are domain-scoped (not origin-scoped), so a `.example.com` non-HttpOnly cookie *would* be
    readable by `plugins.example.com` JS.
  - **CORS agreement:** path 3 (iframe → GZAC, cross-origin) needs GZAC CORS to allow the plugin-host
    origin + `Authorization`. So "distinct origin" is required by *both* isolation and CORS — they
    agree.

**Deployment note:** a **distinct hostname** for the plugin host (subdomain or separate domain) is
the *clean* topology, but it is **not** the only way to get isolation — and we can't always trust an
operator to configure it. §6.6.4 makes isolation deployment-independent, which demotes "distinct
origin" from a hard requirement to an optimization.

### 6.6.4 Forcing isolation without a distinct origin (deployment-independent) — recommended default

The `sandbox` attribute is set by the **Valtimo parent (the embedder)**, not by the operator's
ingress or the plugin author — so Valtimo can force isolation unilaterally, regardless of how the
host is deployed. Mechanism: render the iframe with `sandbox="allow-scripts"` **without**
`allow-same-origin`. That forces the document into a **unique opaque origin** no matter what URL it
loads from, so it is never same-origin with the parent — the browser blocks all parent
window/DOM/`localStorage`/cookie access **even on `app.example.com/plugins/...`** (same hostname).
This also closes the `allow-scripts allow-same-origin`-on-a-same-origin-frame escape (a same-origin
sandboxed frame with both flags can rewrite its own `sandbox` and break out).

Cost: an opaque-origin iframe has no own storage and its `fetch` sends `Origin: null`. Two ways to
feed it data:

- **(I) Iframe fetches GZAC directly** → GZAC CORS must allow `Origin: null`. Tolerable **only**
  because these are **bearer-token-only, cookieless** calls (an attacker's `null`-origin frame still
  lacks the token); never acceptable for cookie-authenticated endpoints. The iframe holds the
  downscoped token.
- **(II) Parent-proxied data (recommended).** The iframe never fetches GZAC; it asks the parent over
  postMessage to make an allowlisted call, and the parent — which already mints/holds the downscoped
  token — performs it and returns the **data** (not the token). **"Iframe holds no token" = the
  bundle never possesses a credential and never authenticates directly; the *user* is still
  authenticated in the parent (Keycloak, as today), and the parent authenticates to GZAC on the
  bundle's behalf.** Crucially the parent uses the **downscoped** user token for these proxied calls,
  **not** the user's full Keycloak token: the bridge is a generic "make a request for me" channel, so
  proxying with the full token would make the parent a **confused deputy** a malicious bundle could
  drive against any endpoint the user can reach. The downscoped token bounds it to PBAC ∩ allowlist,
  enforced server-side regardless of what the bundle asks for (an optional client-side allowlist
  precheck in the parent is just defense-in-depth). No CORS, no `Origin: null`. Cost: a generic
  "proxy an allowlisted request" RPC bridge in the parent + async round-trips. Paths 1/4 (iframe →
  host) are handled the same way (proxy, or host allows `null`). With an opaque origin the parent
  targets `postMessage` at `'*'` and validates by `event.source === iframe.contentWindow` (origin
  can't be matched) — still robust.

**Recommended default:** ship `ExternalPluginIframeComponent` sandboxed **without**
`allow-same-origin`, data via the **parent-proxy bridge (II)**. Isolation then holds in *every*
topology with **zero operator dependency**. A distinct host origin becomes an *optimization*: when
present, you may grant `allow-same-origin` to buy back the iframe's own storage and clean (non-null)
CORS for direct fetches, still isolated from the parent because it's a different origin.

Rejected as the isolation primitive (don't chase): the **`<iframe csp>` attribute** (experimental,
unreliable browser support); **`credentialless` iframes** (strip cross-origin subresource
credentials under COEP, but don't change the same-origin *scripting* boundary); **COOP/COEP**
(process-isolate the top document and gate embedding — useful hardening, but don't stop a
same-origin child scripting its parent). The opaque-origin sandbox is the real primitive.

---

## 6.5 Data control & exfiltration — can option 3 be trusted?

Option 3 (and the allowlist) answers **"the plugin may only read what was approved at config
time."** It does **not** answer **"the plugin can't leak that data."** These are two different
controls and must not be conflated:

- **(A) Ingress / access approval** — *what the plugin may read.* This is exactly what the
  PBAC ∩ allowlist of option 3 enforces: the granted-endpoints list accepted at activation is the
  approval, and the token physically cannot call an ungranted endpoint. **The allowlist IS the
  "approved data" mechanism** — option 3 is not "impossible," it's the tool for (A).
- **(B) Egress / exfiltration** — *what the plugin does with data it legitimately read.* The
  allowlist does nothing here. Once data is in iframe JS, the plugin can transmit it.

**The fundamental limit:** while arbitrary plugin-authored JS runs in the browser with the data,
exfiltration cannot be fully prevented — if it can render a value it can transmit it (the classic
"can't DRM data shown to the client" problem). Raw option 3 has two concrete leaks: **over-fetch**
(a `/api/v1/document/**` grant lets the plugin read *every* case the user can see, not just this
tab's, for the whole token lifetime) and **egress** (token + data sit in JS, free to `fetch()`
anywhere CSP allows).

**Containment spectrum** (most plugin flexibility → most containment). The lever is *how much
capability the plugin holds*; flexibility trades directly against containment:

| Model | Plugin holds | Over-fetch? | Exfiltrate? | Build |
|---|---|---|---|---|
| **3 raw** | user token, calls GZAC freely | Yes (any resource in grant) | Yes — token+data in JS | low |
| **3 hardened** | *resource-scoped* short token (bound to *this* documentId, not user-wide); iframe served with locked CSP `connect-src` = GZAC + host only; `allow-same-origin` dropped | Only this case | Hard (CSP egress lock); host is a sink | medium |
| **Push (no token)** | *nothing* — Valtimo fetches the approved, PBAC-checked, case-scoped data server-side and pushes the exact fields via postMessage; bundle is pure presentation; served `default-src 'none'` + tight sandbox | No — can't fetch | Very hard — no network channel | medium |
| **Server-side render** (HTMX `render_page`) | nothing — plugin's template runs in the **Wasm sandbox** (no network) over Valtimo-supplied data; iframe shows static HTML, no token | No | Very hard | high (needs `render_page`) |

**The architectural realization:** to control egress, don't hand the plugin a token or fetch
capability and hope — **invert it so Valtimo decides what the plugin sees and hands over the
minimum, in a context that can't call out** (the push / SSR end). The plugin loses dynamic data
access; in exchange it can neither over-fetch nor leak. In the push model the approval also shifts
from "endpoint globs" to a **declared data contract** — the plugin declares the fields it needs,
the admin approves *that*, Valtimo sends exactly those PBAC-checked fields. That controls *depth*
(which fields), not just which API — a finer, cleaner approval than endpoint patterns.

**Two load-bearing assumptions** for any containment to hold:

1. **The iframe's CSP is set by infrastructure the operator controls, not the plugin author.** A
   document enforces `connect-src` from *its own* response headers, so the **plugin host**
   (operator-run — operators register hosts, authors only supply Wasm + static bundles) must inject
   a restrictive `Content-Security-Policy` header on bundle responses. Today bundles are served
   public with `Access-Control-Allow-Origin: *` and **no CSP** — a concrete gap. The parent's
   `frame-src` only controls *whether* the iframe loads, not its egress.
2. **No exfiltration sink reachable from the iframe.** If `connect-src` allows the plugin host
   (needed for paths 1/2/4) and the host could forward outbound, the leak just moves server-side.
   This is contained *only* because the host is operator-run with **no outbound egress today** (no
   `http_request` host function — §14); when that lands it needs its own allowlist. For genuinely
   sensitive data the safest stance is **no plugin host in the data path** — push model with
   `connect-src 'none'`.

**Recommendation — trust tiers, not a free choice.** A plugin's allowed data-sourcing model
should be a property of *how trusted it is*, not something the plugin author picks:

- **Trusted / first-party:** option 3 hardened (resource-scoped token + host-injected CSP egress
  lock + drop `allow-same-origin`).
- **Untrusted / third-party handling sensitive data:** the **push model** (no token,
  `default-src 'none'`) or server-side render — the plugin physically cannot phone home.

This supersedes the §6 "primary path = option 3" recommendation for *sensitive* data: option 3
hardened is the trusted-tier default; the push model is the untrusted-tier default. No client-side
model is airtight, so governance (plugin review / signing / first-party designation) remains the
backstop.

---

## 7. Decision 4 — Case context delivery to the iframe

The bundle must know which case it's showing. The `init.context` field already exists end-to-end
(`context` Input → `init.context` → SDK `getContext()`/`onContext()`) but is always `{}` today.

- **What to put in it:** `documentId`, `caseDefinitionKey`, `caseDefinitionVersionTag`, the
  `pluginConfigurationId`, and (optionally) `taskId` when the tab is opened in a task context. Keep
  it to identifiers — the bundle fetches the actual data itself via §6.
- **Source:** `CaseDetailComponent` already has the document/case-definition context; the new
  tab-dispatcher component passes it straight into the iframe component's `context` Input.
- **Alternative considered:** stuff the data itself into `context`. Rejected — couples the tab to
  whatever the parent happens to have loaded, can't reflect the user's live permissions, and
  duplicates fetch logic. Pass identifiers, let the bundle fetch.

---

## 8. Cross-cutting concerns

- **CSP** ✅ — plugin host origins are already added to `frame-src`/`img-src` at bootstrap from the
  registered hosts list. A case-tab bundle from a registered host is already allowed. No work
  unless tabs can load from an unregistered origin (they can't).
- **Iframe sandbox** — currently `sandbox="allow-scripts allow-same-origin"`. `allow-same-origin`
  lets the bundle read the host's own cookies/storage (its origin is the plugin host, not GZAC),
  which it needs for the SDK and its own fetches. The user token (path 3) means we are *not*
  relying on cookies for GZAC calls — good. Review whether `allow-forms`/`allow-popups` are needed
  per bundle; keep the default tight.
- **Token lifecycle (path 3)** — TTL ≤ 15 min; the parent should send `tokenRefresh` before expiry
  (the SDK already handles a `tokenRefresh` message; the Angular component doesn't send it yet —
  small addition). Decide refresh trigger: timer vs. on 401.
- **Loading / error states** — the dispatcher component should show a spinner until `readyEvent`,
  and a friendly error if the host is unreachable / bundle 404 / definition `UNAVAILABLE`. Plugin
  hosts can be down; the tab must degrade, not white-screen.
- **Sizing** — the iframe component already auto-grows from the `resize` message; confirm it plays
  well inside the case-detail tab container (which may itself scroll).
- **i18n / theme** — `init` already passes `locale` and `theme` (theme hard-coded `'white'` —
  consider feeding the real Carbon theme). The SDK's `t()` + manifest translations already work.
- **`navigate` / `notification` events** — the SDK defines them but the Angular component ignores
  them. A case tab may legitimately want to deep-link within Valtimo or raise a toast; decide
  whether to handle these (small additions to `_onMessage`).
- **Deletion guards** — a tab referencing a plugin configuration becomes another usage that should
  block deleting that configuration (consistent with backend-plan §12's strict, never-forced
  delete guards). Wire the new tab→config reference into the usage resolver.
- **Versioning** — a tab pins a `pluginConfigurationId`, which pins a definition+version (same
  coexistence model as process links, backend-plan §11). A final case definition's tab keeps
  pointing at its version; new case definitions can bind newer ones.

---

## 9. Recommended end-to-end design (a coherent pick)

Putting the recommendations together — the smallest coherent slice that is permission-correct:

1. **Tab type** (§4 Option A): new `CaseTabType.EXTERNAL_PLUGIN` + `ApiTabType.EXTERNAL_PLUGIN`;
   `CaseTabService.mapTab()` → new `CaseDetailExternalPluginTabComponent` wrapping
   `ExternalPluginIframeComponent`.
2. **Tab config** (§5 Option B): `case_external_plugin_tab` side table
   (`external_plugin_configuration_id`, `bundle_key`); dedicated endpoint
   `GET /api/v1/document/{documentId}/external-plugin-tab/{tabKey}` that, after a PBAC tab-visibility
   check, returns `{bundleUrl, context, userToken}`.
3. **Bundle resolution**: factor the duplicated `${baseUrl}/${version}${bundle.path}` into a shared
   resolver (filter `frontendBundles` for `type === 'case-tab'`, match `bundle_key`).
4. **Context** (§7): pass `documentId`, `caseDefinitionKey`, version tag, `pluginConfigurationId`
   into `init.context`.
5. **Data path** (§6.3, path 3): build the §13 user-token endpoint + `ExternalPluginUserTokenFilter`
   + allowlist intersection; the tab content endpoint mints the token; the Angular component puts it
   in `init.accessToken` (replacing `''`) and refreshes it. Plugin bundles call GZAC directly via
   `sdk.getAccessToken()`.
6. **Admin UI**: add "External plugin" to the tab-type picker, a content selector that lists the
   plugin's `case-tab` bundles, and (if needed) a small per-tab config screen branched in
   `onRowClicked()` like `WIDGETS`.

Defer: host data routes (`handle_request`), so paths 1/2/4 come later when a plugin needs its own
data. The first shippable tab is **iframe → GZAC, user-scoped** — directly answering "display data
based on the permissions of the user."

### Suggested phasing

- **Phase 1 — Plumbing & token:** §13 user-token endpoint + filter + allowlist intersection;
  frontend token wiring (`accessToken` + refresh). Verifiable independently of tabs (curl the
  endpoint, hit an allowed/denied GZAC endpoint with the token).
- **Phase 2 — Tab type & rendering:** new tab type, dispatcher component, bundle resolver, context
  delivery. A hard-coded sample `case-tab` bundle renders in a case with live, user-scoped data.
- **Phase 3 — Admin UX:** type picker, bundle selector, config screen, deletion-guard wiring.
- **Phase 4 (later) — Plugin-served data:** host `handle_request`/data routes (paths 1/2/4),
  enabling tabs whose data is the plugin's own.

---

## 10. Open questions

- **Token minting location:** mint the user token inside the tab content endpoint (one round trip)
  or keep `POST /user-token` separate as §13 describes (cleaner separation, two calls)? Leaning:
  separate endpoint for the contract, but the tab endpoint can call it server-side.
- **Refresh strategy:** proactive timer vs. reactive on-401? On-401 is simpler and avoids clock
  drift but needs the SDK to surface 401s.
- **One iframe per tab vs. shared:** re-create the iframe on each tab switch (simple, clean
  lifecycle) vs. keep it alive hidden (faster re-open, more memory). Start with re-create.
- **Bundle ↔ tab keying:** does a plugin declare named `case-tab` bundles (multiple tabs per
  plugin) or exactly one? The model already allows a `key` on bundles — support multiple.
- **`MAP='map'` enum drift:** the frontend `ApiTabType` already has a `MAP` value with no backend
  counterpart. Confirm intent and avoid repeating the drift when adding `EXTERNAL_PLUGIN`.
- **Theme:** feed the real Carbon theme into `init.theme` instead of the hard-coded `'white'`.
- **Sandbox flags:** is `allow-same-origin` (needed for the SDK) acceptable given the host origin is
  the plugin host, not GZAC? Confirm no GZAC cookies are reachable cross-origin.

---

## Appendix — concrete code anchors

- Iframe component / postMessage / `init`:
  `frontend/projects/valtimo/plugin/src/lib/components/external-plugin-iframe/external-plugin-iframe.component.ts`
  (`onIframeLoad()` sends `init` with `accessToken: ''`).
- Frontend SDK: `plugin-host/plugin-sdk/src/frontend/plugin-frontend-sdk.ts`
  (`getAccessToken()`, `getContext()`, `ready()`, `t()`).
- Bundle types incl. `'case-tab'`:
  `frontend/projects/valtimo/plugin/src/lib/models/external-plugin.model.ts`.
- Bundle URL built inline (3 sites): `plugin-external-configure`, `plugin-external-edit-modal`
  (both in `plugin-management`), `plugin-action-configuration` (in `process-link`).
- Bundle serving: `plugin-host/app/src/routes/plugin-bundles.ts`; manifest:
  `plugin-host/app/src/routes/plugin-actions.ts` (`GET …/plugin-manifest`).
- CSP: `frontend/projects/valtimo/security/src/lib/initializers/initialize-csp.ts`, fed by
  `frontend/projects/valtimo/bootstrap/src/lib/init.ts`.
- Case-tab dispatch: `frontend/projects/valtimo/case/src/lib/services/case-tab.service.ts`
  (`mapTab()`, `filterTab()`); models in `…/case/src/lib/models/tab-api.model.ts`,
  `…/case-detail-tab.model.ts`; constants `…/case/src/lib/constants/tab.ts`.
- Case-tab backend: `backend/case/src/main/kotlin/com/ritense/case/domain/CaseTab.kt`,
  `CaseTabType.kt`; end-user tabs `web/rest/CaseTabResource.kt`; admin CRUD
  `web/rest/CaseTabManagementResource.kt`; `WIDGETS` precedent
  `case_/rest/CaseWidgetTabResource.kt`, table `case_widget_tab`
  (`backend/core/.../20240513-add-case-widget-tab.xml`).
- Widget data + PBAC precedent: `backend/case/.../case_/service/CaseWidgetService.kt`
  (`getCaseWidgetData()` — `requirePermission` then `runWithoutAuthorization`).
- Service-token machinery to mirror for the user token:
  `backend/external-plugin/.../security/ExternalPluginServiceTokenFilter.kt`,
  `ExternalPluginEndpointAllowlistFilter.kt`, `ExternalPluginServiceTokenKeyProvider.kt`;
  management resource `web/rest/ExternalPluginManagementResource.kt`.
- Admin tab config UI: `frontend/projects/valtimo/case-management/src/lib/components/case-management-detail/tabs/`
  (`case-management-tabs.component.ts` `onRowClicked()`, `case-management-add-tab-modal` type picker,
  `tab-form` content-key form, `widget-tab/` per-type editor precedent).
