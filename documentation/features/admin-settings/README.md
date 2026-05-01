# Admin settings

The admin settings page allows administrators to manage platform-wide appearance and feature toggle settings from the
browser. It is available under **Admin > Admin settings** and requires the `ROLE_ADMIN` role.

The page has two tabs: [Appearance](#appearance) and [Feature toggles](#feature-toggles).

## Appearance

The appearance tab lets administrators upload a custom logo for the application top bar. Two logo slots are available:

| Logo slot        | Description                                                                 |
|------------------|-----------------------------------------------------------------------------|
| **Logo**         | Displayed in the top bar when the application is in light mode.             |
| **Dark mode logo** | Displayed in the top bar when the application is in dark mode.           |

### Uploading a logo

1. Navigate to **Admin > Admin settings > Appearance**.
2. Click **Add file** and select a PNG or SVG image (max 10 MB).
3. Click **Upload**.

The new logo is applied immediately across all sessions. A preview is shown on a background that matches where the logo
will appear (light or dark), so you can verify contrast and readability before uploading.

### Deleting a logo

Click the **Delete** button below the logo preview and confirm the action. The application reverts to the default logo
configured in the front-end environment file.

### Supported formats

* **PNG** — Raster images are validated and normalized on upload. Images larger than 1024 px on either axis are resized
  proportionally and re-encoded as PNG.
* **SVG** — Vector images are stored as-is without rasterization. This is the recommended format for logos because SVGs
  scale to any resolution.

## Feature toggles

The feature toggles tab lists all front-end feature flags and their current state. Toggling a switch updates the back-end override and applies the change immediately in the current session. Other
sessions pick up the new values on their next page load.

### How feature toggles work

Feature toggles are resolved from two sources, merged at runtime:

1. **Front-end defaults** — Defined in the `featureToggles` object inside `environment.ts`. These are the baseline
   values that ship with the application.
2. **Back-end overrides** — Stored in the database and managed through the admin settings page or via
   auto-deployment. When an override exists for a toggle, it takes precedence over the front-end default.

The merged result is exposed as a reactive observable via `ConfigService.getFeatureToggleObservable()`. Components that
subscribe to it receive updates automatically when an administrator changes a toggle.

## Auto-deployment

Admin settings can be deployed automatically on application startup from JSON changeset files on the classpath. This
uses the same changelog-based auto-deployment mechanism as dashboards and other Valtimo resources: each changeset is
tracked by an MD5 checksum and only applied when the content changes.

### Feature toggle deployment

Create a JSON file matching the pattern `*.admin-settings-feature-toggles.json` and place it on the classpath (e.g.
`src/main/resources/config/admin-settings/`).

**File format:**

```json
{
  "changesetId": "admin-settings-feature-toggles-v1",
  "featureToggles": {
    "showUserNameInTopBar": true,
    "showPlantATreeButton": true,
    "experimentalDmnEditing": true,
    "largeLogoMargin": false,
    "sortFilesByDate": true,
    "disableCaseCount": false,
    "returnToLastUrlAfterTokenExpiration": true,
    "useStartEventNameAsStartFormTitle": true,
    "allowUserThemeSwitching": true,
    "enableUserNameInTopBarToggle": true,
    "enableTabManagement": true,
    "enableObjectManagement": true,
    "enableFormViewModel": true,
    "enableIntermediateSave": true,
    "enableFormFlowBreadcrumbs": true,
    "enablePbacDocumentenApiDocuments": true,
    "enableSuppressDocumentError": false
  }
}
```

| Field             | Description                                                                                  |
|-------------------|----------------------------------------------------------------------------------------------|
| `changesetId`     | Unique identifier for this changeset. Change it when you want to force redeployment.         |
| `featureToggles`  | Map of feature toggle keys to boolean values. Only listed toggles are overridden.             |

{% hint style="info" %}
Toggles not included in the changeset file are left unchanged. To reset a toggle to the front-end default, remove its
back-end override via the admin settings page.
{% endhint %}

### Logo deployment

Create a JSON file matching the pattern `*.admin-settings-logo.json` and place it on the classpath alongside the
referenced image files.

**File format:**

```json
{
  "changesetId": "admin-settings-logo-v1",
  "logos": [
    {
      "logoType": "LOGO",
      "file": "logo.svg"
    },
    {
      "logoType": "LOGO_DARK_MODE",
      "file": "logo-dark-mode.svg"
    }
  ]
}
```

| Field                | Description                                                                              |
|----------------------|------------------------------------------------------------------------------------------|
| `changesetId`        | Unique identifier for this changeset.                                                    |
| `logos[].logoType`   | Either `LOGO` (light mode) or `LOGO_DARK_MODE` (dark mode).                             |
| `logos[].file`       | Filename of the image. The file must be on the classpath (e.g. in the same directory).   |

**Supported image formats:** PNG and SVG. SVG files are stored as-is. PNG files are validated and normalized (resized
if larger than 1024 px).

**Example directory structure:**

```
src/main/resources/config/admin-settings/
  default.admin-settings-logo.json
  default.admin-settings-feature-toggles.json
  logo.svg
  logo-dark-mode.svg
```

### Clear tables on startup

Both deployers support a `clear-tables` property that deletes all existing data and changelog entries before
redeploying. This is useful for development environments where you want a clean state on every restart.

```yaml
valtimo:
  changelog:
    admin-settings-logo:
      clear-tables: true
    admin-settings-feature-toggles:
      clear-tables: true
```

{% hint style="warning" %}
Do not enable `clear-tables` in production. It removes all manually configured admin settings on every application
startup.
{% endhint %}
