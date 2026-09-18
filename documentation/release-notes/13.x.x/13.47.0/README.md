# 13.47.0

Release date: 23-09-2026

---

## New Features

### New feature title

New feature explanation.

---

## Enhancements

### The task panel in a case keeps the width you give it

The panel on the right of a case can now be dragged wider or narrower while the task list is shown, not only
while a task is open. The width you set is remembered for you across all case types and after logging in again.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Area name | New bugfix. |

---

## Security

| Severity | Fix |
|----------|-----|
| Critical | The embedded web server no longer allows security constraints to be bypassed, or an authenticated request to be replayed, so protected resources stay protected ([CVE-2026-65637](https://nvd.nist.gov/vuln/detail/CVE-2026-65637), [CVE-2026-65905](https://nvd.nist.gov/vuln/detail/CVE-2026-65905), [CVE-2026-59083](https://nvd.nist.gov/vuln/detail/CVE-2026-59083), [CVE-2026-59084](https://nvd.nist.gov/vuln/detail/CVE-2026-59084), [CVE-2026-65182](https://nvd.nist.gov/vuln/detail/CVE-2026-65182), [CVE-2026-68525](https://nvd.nist.gov/vuln/detail/CVE-2026-68525)) |
| Critical | Outgoing HTTPS calls now verify the server's hostname on asynchronous requests, so another server can no longer impersonate the one being called ([CVE-2026-71290](https://nvd.nist.gov/vuln/detail/CVE-2026-71290)) |
| Critical | The template engine no longer allows files outside the template directory to be reached through a malformed language setting ([CVE-2026-84939](https://nvd.nist.gov/vuln/detail/CVE-2026-84939)) |
| Critical | The networking layer now checks that a certificate status response belongs to the certificate that was asked about, so a revoked certificate can no longer be presented as valid ([CVE-2026-56820](https://nvd.nist.gov/vuln/detail/CVE-2026-56820)) |
| High | The embedded web server no longer grants access to users who should not have it, and no longer leaks resources on interrupted connections ([CVE-2026-65183](https://nvd.nist.gov/vuln/detail/CVE-2026-65183), [CVE-2026-66422](https://nvd.nist.gov/vuln/detail/CVE-2026-66422), [CVE-2026-68569](https://nvd.nist.gov/vuln/detail/CVE-2026-68569), [CVE-2026-65927](https://nvd.nist.gov/vuln/detail/CVE-2026-65927), [CVE-2026-68763](https://nvd.nist.gov/vuln/detail/CVE-2026-68763)) |
| High | The networking layer can no longer be brought down or made to exhaust memory by malformed network traffic ([CVE-2026-55851](https://nvd.nist.gov/vuln/detail/CVE-2026-55851), [CVE-2026-56745](https://nvd.nist.gov/vuln/detail/CVE-2026-56745), [CVE-2026-59901](https://nvd.nist.gov/vuln/detail/CVE-2026-59901), [CVE-2026-56817](https://nvd.nist.gov/vuln/detail/CVE-2026-56817), [CVE-2026-44891](https://nvd.nist.gov/vuln/detail/CVE-2026-44891), [CVE-2026-55831](https://nvd.nist.gov/vuln/detail/CVE-2026-55831), [CVE-2026-55833](https://nvd.nist.gov/vuln/detail/CVE-2026-55833), [CVE-2026-56816](https://nvd.nist.gov/vuln/detail/CVE-2026-56816), [CVE-2026-56819](https://nvd.nist.gov/vuln/detail/CVE-2026-56819), [CVE-2026-56821](https://nvd.nist.gov/vuln/detail/CVE-2026-56821), [CVE-2026-56822](https://nvd.nist.gov/vuln/detail/CVE-2026-56822)) |
| High | PostgreSQL connections that are configured to require channel binding are no longer silently downgraded to a weaker protection ([CVE-2026-54291](https://nvd.nist.gov/vuln/detail/CVE-2026-54291)) |
| High | The MySQL driver no longer allows a user with limited rights to reach data they should not have access to ([CVE-2026-60586](https://nvd.nist.gov/vuln/detail/CVE-2026-60586), [CVE-2026-60623](https://nvd.nist.gov/vuln/detail/CVE-2026-60623)) |
