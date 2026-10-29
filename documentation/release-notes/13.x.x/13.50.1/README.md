# 13.50.1

Release date: 16-10-2026

{% hint style="warning" %}
This release contains security fixes. See [Security](#security) for details.
{% endhint %}

---

## Security

| Severity | Fix |
|----------|-----|
| Medium | Fixed a stored cross-site scripting (XSS) vulnerability in the e-mail preview form component, which previously rendered its value as unsanitised HTML. Preview content is now sanitised before it is displayed. |
