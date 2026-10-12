# 13.50.0

Release date: 14-10-2026

{% hint style="warning" %}
This release contains security fixes. See [Security](#security) for details.
{% endhint %}

---

## New Features

### Building block references

Building block versions no longer have to be traced and updated by hand. The new **References** tab of a
building block version lists every case and building block that references it, with a link to the process
or actions tab where the reference is configured. **Update references** opens a
wizard that moves those references onto another version — newer or older — of the same building block,
or onto another building block. See the [references documentation](../../../configuration-guides/building-blocks/references.md).

---

## Enhancements

### New enhancement title

New enhancement explanation.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Area name | New bugfix. |

---

## Security

| Severity | Fix |
|----------|-----|
| Medium | The dropdown list and translation data endpoints no longer let a logged-in user read JSON files outside the `config/dropdown` and `config/translation` folders, such as plugin configurations or permission files, by putting `../` in the requested key |
