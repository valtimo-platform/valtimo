# 12.46.0

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* New bugfix.

## Security

* **Critical** — Apache Tomcat upgraded from 10.1.56 to 10.1.60. Fixes a bypass of URL-based access
  rules and five further request-handling vulnerabilities, plus five high-severity issues
  ([CVE-2026-59083](https://nvd.nist.gov/vuln/detail/CVE-2026-59083),
  [CVE-2026-59084](https://nvd.nist.gov/vuln/detail/CVE-2026-59084)).
* **Critical** — Apache HttpClient upgraded from 5.5.2 to 5.6.4. The asynchronous client ignored its
  TLS hostname verification setting, so a server could present a certificate for another domain
  ([CVE-2026-71290](https://nvd.nist.gov/vuln/detail/CVE-2026-71290)).
* **Critical** — FreeMarker upgraded from 2.3.34 to 2.3.35. Fixes a path traversal in template
  loading ([CVE-2026-84939](https://nvd.nist.gov/vuln/detail/CVE-2026-84939)).
* **Critical** — Netty upgraded from 4.1.135.Final to 4.1.138.Final. Fixes a certificate revocation
  check that could be bypassed, plus ten high-severity issues
  ([CVE-2026-56820](https://nvd.nist.gov/vuln/detail/CVE-2026-56820)).
* **High** — The PostgreSQL driver upgraded from 42.7.11 to 42.7.13. Connections requiring channel
  binding could be silently downgraded, losing protection against interception
  ([CVE-2026-54291](https://nvd.nist.gov/vuln/detail/CVE-2026-54291)).
* Spring Boot upgraded from 3.5.15 to 3.5.16.
