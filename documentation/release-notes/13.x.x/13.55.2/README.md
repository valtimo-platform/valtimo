# 13.55.2

Release date: 24-11-2026

{% hint style="warning" %}
This release contains security fixes. See [Security](#security) for details.
{% endhint %}

---

## Security

| Severity | Fix |
|----------|-----|
| Critical | The front-end now runs on nginx 1.31.9, which fixes two vulnerabilities that could let an attacker run code on the server ([CVE-2026-123007](https://nvd.nist.gov/vuln/detail/CVE-2026-123007), [CVE-2026-123633](https://nvd.nist.gov/vuln/detail/CVE-2026-123633)) |
| High | The back-end now runs on the latest Java 21 runtime, which fixes a vulnerability that could let an attacker take over the application ([CVE-2026-114938](https://nvd.nist.gov/vuln/detail/CVE-2026-114938)) |
