# Security Configuration Baseline

This page describes the security configuration baseline for Valtimo deployments, covering web server parameters, cookie settings, and security headers.

## Architecture Overview

Valtimo uses a **stateless JWT-based architecture**:
- No server-side HTTP sessions (`SessionCreationPolicy.STATELESS`)
- Authentication via JWT tokens issued by Keycloak

## Security Headers

### Backend Headers (Spring Security)

The following headers are applied to all backend responses:

| Header | Value | Configuration |
|--------|-------|---------------|
| `X-Content-Type-Options` | `nosniff` | Spring Security default |
| `X-Frame-Options` | `DENY` | Spring Security default |
| `Cache-Control` | `no-cache, no-store, max-age=0, must-revalidate` | Spring Security default |
| `Pragma` | `no-cache` | Spring Security default |
| `Expires` | `0` | Spring Security default |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | SecurityHeadersHttpSecurityConfigurer |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | SecurityHeadersHttpSecurityConfigurer |
| `X-XSS-Protection` | `0` | Spring Security default (disabled; modern browsers use CSP) |

**Headers intentionally suppressed:**
- `Server` - Suppressed via `server.server-header: ""` to avoid technology disclosure
- `X-Powered-By` - Not added by Spring Boot / Tomcat by default

### HSTS (Strict-Transport-Security)

Spring Security sends the HSTS header by default on HTTPS requests:

| Header | Value | Condition |
|--------|-------|-----------|
| `Strict-Transport-Security` | `max-age=31536000 ; includeSubDomains` | Only sent when request is detected as HTTPS |

**When TLS terminates at a reverse proxy:**

Spring determines HTTPS via `ServletRequest.isSecure()`. If your proxy terminates TLS and forwards plain HTTP to the backend, configure the proxy to send the `X-Forwarded-Proto: https` header and enable forwarded header processing in Spring:

```yaml
server:
  forward-headers-strategy: NATIVE
```

Without this, Spring cannot detect the original HTTPS request and will not send the HSTS header.

### Frontend Headers

| Header | Description | Configuration |
|--------|-------------|---------------|
| Content-Security-Policy | Restricts resource loading | Configured via `csp-header` package in Angular |

See [Content Security Policy (CSP)](content-security-policy.md) for frontend CSP configuration.

## Cookie Inventory

### Keycloak Cookies

Keycloak manages SSO session cookies on its own origin (e.g., `keycloak.example.com:8081`):

| Cookie | Purpose | HttpOnly | Secure | SameSite | Notes |
|--------|---------|----------|--------|----------|-------|
| `KEYCLOAK_SESSION` | SSO session hash | No | Yes | None | Post-login, tracks active session |
| `KEYCLOAK_IDENTITY` | User identity JWT | Yes | Yes | None | Post-login, contains identity token |
| `AUTH_SESSION_ID` | Authorization session | Yes | Yes | None | Used during login flow only |
| `KC_RESTART` | Session restart data | Yes | Yes | None | Cleared after successful login |

`SameSite=None` is required for OAuth cross-origin redirects between the application and Keycloak. Browsers require `Secure=true` when `SameSite=None`, so these cookies only work over HTTPS in production.

### Application Cookies

**None.** Valtimo backend uses stateless JWT authentication and does not create any HTTP cookies. Tokens are passed via the `Authorization` header.

### Analytics/Third-party Cookies

Depends on deployment. Valtimo does not use any third-party cookies by default.

## Session Management

### Keycloak Session Settings

Configure in Keycloak admin console under Realm Settings → Sessions:

| Setting | Recommended Value | Description |
|---------|-------------------|-------------|
| SSO Session Idle | 30 minutes | Timeout for idle sessions |
| SSO Session Max | 10 hours | Maximum session duration |
| Access Token Lifespan | 5 minutes | JWT validity period |
| Revoke Refresh Token | ON | Invalidate refresh tokens on use |

See [Configuring Keycloak](configuring-keycloak.md) for detailed instructions.

### Application Session

| Setting | Value | Configuration |
|---------|-------|---------------|
| Session Policy | STATELESS | `StatelessHttpSecurityConfigurer.java` |
| CSRF Protection | Disabled | `CsrfHttpSecurityConfigurer.java` (appropriate for stateless API) |

## TLS/HTTPS Enforcement

### Production Requirements

1. **Keycloak SSL Mode**: Set `sslRequired` to `external` or `all` in realm settings
   - `external`: Requires HTTPS for external requests (recommended)
   - `all`: Requires HTTPS for all requests including internal

2. **Reverse Proxy (Optional)**: Terminate TLS at the proxy and forward via HTTP to backend
   - Configure HSTS header at proxy level
   - Set `X-Forwarded-*` headers

3. **Spring Configuration (Optional, required when using a reverse proxy)**: Enable forward headers strategy
   ```yaml
   server:
     forward-headers-strategy: NATIVE
   ```

### Development

- `sslRequired: none` is acceptable for local development only
- Do not deploy with `sslRequired: none` in production

## Error Handling

| Setting | Configuration | Purpose |
|---------|---------------|---------|
| Stack trace exposure | `valtimo.hardening.allowStacktraceOnIps: [127.0.0.1, 0:0:0:0:0:0:0:1]` | Only show stack traces to localhost |
| Server header | `server.server-header: ""` | Suppress server technology disclosure |

## Configuration Reference

| Security Aspect | Configuration File |
|-----------------|-------------------|
| Security headers | `application.yml` (`valtimo.security.headers.*`) |
| Stateless session | `StatelessHttpSecurityConfigurer.java` |
| CSRF disabled | `CsrfHttpSecurityConfigurer.java` |
| Error handling | `application.yml` (`valtimo.hardening.*`) |
| Keycloak sessions | Keycloak admin console / `realm.json` |
| CSP | Frontend environment files |
| CORS | `application.yml` (`valtimo.web.cors.*`) |
| IP whitelist | `application.yml` (`valtimo.security.whitelist.hosts`) |

### Security Header Properties

The `Referrer-Policy` and `Permissions-Policy` headers can be customized:

```yaml
valtimo:
  security:
    headers:
      referrer-policy: strict-origin-when-cross-origin  # default
      permissions-policy: "geolocation=(), microphone=(), camera=()"  # default
```

For applications requiring browser features (e.g., location-based workflows):

```yaml
valtimo:
  security:
    headers:
      permissions-policy: "geolocation=(self), microphone=(), camera=()"
```

Valid `referrer-policy` values: `no-referrer`, `no-referrer-when-downgrade`, `same-origin`, `origin`, `strict-origin`, `origin-when-cross-origin`, `strict-origin-when-cross-origin`, `unsafe-url`
