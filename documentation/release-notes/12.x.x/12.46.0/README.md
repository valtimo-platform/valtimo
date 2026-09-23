# 12.46.0

## Security

* **JavaScript script tasks can no longer escape the allowed-class list**

  A script could reach any Java class through the objects it was handed, giving anyone who can deploy a process
  definition control over the server. Scripts now have no access to reflection, files, network connections,
  databases or the process engine, and classes such as `java.lang.Runtime` are refused even when listed under
  `valtimo.camunda.scripting.allowedClasses`.

* **Critical** — Apache Tomcat upgraded from 10.1.56 to 10.1.60. Fixes a bypass of URL-based access rules, five
  further request-handling flaws and five high-severity issues
  ([CVE-2026-59083](https://nvd.nist.gov/vuln/detail/CVE-2026-59083),
  [CVE-2026-59084](https://nvd.nist.gov/vuln/detail/CVE-2026-59084)).
* **Critical** — Apache HttpClient upgraded from 5.5.2 to 5.6.4. The async client ignored its TLS hostname
  verification setting ([CVE-2026-71290](https://nvd.nist.gov/vuln/detail/CVE-2026-71290)).
* **Critical** — FreeMarker upgraded from 2.3.34 to 2.3.35. Fixes a path traversal in template loading
  ([CVE-2026-84939](https://nvd.nist.gov/vuln/detail/CVE-2026-84939)).
* **Critical** — Netty upgraded from 4.1.135.Final to 4.1.138.Final. Fixes a bypassable certificate revocation
  check, plus ten high-severity issues ([CVE-2026-56820](https://nvd.nist.gov/vuln/detail/CVE-2026-56820)).
* **High** — PostgreSQL driver upgraded from 42.7.11 to 42.7.13. Connections requiring channel binding could be
  silently downgraded ([CVE-2026-54291](https://nvd.nist.gov/vuln/detail/CVE-2026-54291)).
* Spring Boot upgraded from 3.5.15 to 3.5.16.
