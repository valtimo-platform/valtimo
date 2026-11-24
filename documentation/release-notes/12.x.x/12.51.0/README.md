# 12.51.0

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* New bugfix.

## Security

* **Patch Zaakbesluit only accepts besluiten of its own Besluiten API**

  The **Patch Zaakbesluit** action of the Besluiten API plugin now only accepts besluit URLs that belong to the Besluiten API it is configured with. If your Besluiten API returns besluit URLs with a different host, port or path than the URL in the plugin configuration, update the plugin configuration to match, otherwise the action fails for those besluiten.
