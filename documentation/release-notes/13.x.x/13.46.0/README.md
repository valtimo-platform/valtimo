# 13.46.0

Release date: 16-09-2026

---

## New Features

### Roltypen from the Catalogi API

Two new Catalogi API plugin actions make the roltypen of a zaaktype available to a process:

- **Roltypen opvragen** stores every roltype of the zaaktype in a process variable, each with its
  URL and its description, ready to be offered in a form.
- **Roltype opvragen** stores the URL of a single roltype in a process variable. The roltype can be
  given as a description, which is looked up against the zaaktype of the case, or as a URL.

Until now a process that added a zaakrol needed the roltype URL written into its configuration by
hand, which had to be corrected whenever the case was taken to another environment. The URL that
**Roltype opvragen** stores can be handed straight to the zaakrol actions of the Zaken API plugin,
so the process no longer depends on a URL that only holds in one place.

Both actions use the zaaktype of the zaak linked to the case, or a zaaktype URL of your choosing.
When a description matches no roltype, or matches more than one, the action says which of the two
happened instead of continuing with a roltype nobody picked.
