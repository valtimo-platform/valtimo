# Admin settings

The admin settings page allows administrators to manage platform-wide appearance and feature toggle settings from the
browser. It is available under **Admin > Admin settings** and requires the `ROLE_ADMIN` role.

The page has two tabs: [Appearance](#appearance) and [Feature toggles](#feature-toggles).

## Appearance

The appearance tab lets administrators customize the look and feel of the application. It is divided into two sections:
[logos](#logos) and [accent colors](#accent-colors).

### Logos

Administrators can upload a custom logo for the application top bar. Two logo slots are available:

| Logo slot        | Description                                                                 |
|------------------|-----------------------------------------------------------------------------|
| **Logo**         | Displayed in the top bar when the application is in light mode.             |
| **Dark mode logo** | Displayed in the top bar when the application is in dark mode.           |

#### Uploading a logo

1. Navigate to **Admin > Admin settings > Appearance**.
2. Click **Add file** and select a PNG or SVG image (max 10 MB).
3. Click **Upload**.

The new logo is applied immediately across all sessions. A preview is shown on a background that matches where the logo
will appear (light or dark), so you can verify contrast and readability before uploading.

#### Deleting a logo

Click the **Delete** button below the logo preview and confirm the action. The application reverts to the default logo
configured in the front-end environment file.

#### Supported formats

* **PNG** — Raster images are validated and normalized on upload. Images larger than 1024 px on either axis are resized
  proportionally and re-encoded as PNG.
* **SVG** — Vector images are stored as-is without rasterization. This is the recommended format for logos because SVGs
  scale to any resolution.

### Accent colors

The accent colors section allows administrators to customize the application's color scheme by overriding the VCDS
(Valtimo Carbon Design System) accent color palette. Ten color levels are available, ranging from the darkest shade
(color 100) to the lightest (color 10).

Each color is shown with a preview swatch and a hex color code. Click the swatch or the hex code to open a color picker.
A **Reset** button next to each color restores it to the default value from the CSS theme.

#### Saving colors

After adjusting one or more colors, click **Save** at the bottom of the section. The new accent colors are applied
immediately. All sessions pick up the changes on their next page load.

#### Resetting all colors

Click **Reset all** to revert every accent color to the default CSS theme values in a single action.

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

Admin settings can be deployed automatically on application startup using the importer framework. Place resource files
under `config/global/admin-settings/` on the classpath (e.g. in `src/main/resources/config/global/admin-settings/`).
Files are matched by name pattern and imported on every startup.

### Feature toggle deployment

Create a JSON file matching the pattern `<name>.feature-toggles.json`.

**File format:**

```json
{
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
```

The file is a flat JSON map of feature toggle keys to boolean values. Each key-value pair sets the corresponding
back-end override. Only listed toggles are affected.

{% hint style="info" %}
Toggles not included in the file are left unchanged. To reset a toggle to the front-end default, remove its
back-end override via the admin settings page.
{% endhint %}

### Accent colors deployment

Create a JSON file matching the pattern `<name>.accent-colors.json`.

**File format:**

```json
{
  "--vcds-color-100": "#002547",
  "--vcds-color-90": "#002c54",
  "--vcds-color-80": "#003361",
  "--vcds-color-70": "#286198",
  "--vcds-color-60": "#2b79bd",
  "--vcds-color-50": "#61aedf",
  "--vcds-color-40": "#8acff2",
  "--vcds-color-30": "#aadcf6",
  "--vcds-color-20": "#c9e9f9",
  "--vcds-color-10": "#e9f6fd"
}
```

The file is a flat JSON map of CSS custom property names to hex color values. The full set of colors is replaced on
each import, so include all ten levels to ensure a consistent palette.

### Logo deployment

Place image files directly in the `admin-settings/` directory. The importer recognizes logo files by their filename:

| Filename              | Logo slot       |
|-----------------------|-----------------|
| `logo.svg` or `logo.png`             | Light mode logo |
| `logo-dark-mode.svg` or `logo-dark-mode.png` | Dark mode logo  |

**Supported image formats:** PNG and SVG. SVG files are stored as-is. PNG files are validated and normalized (resized
if larger than 1024 px).

### Example directory structure

```
src/main/resources/config/global/admin-settings/
  default.feature-toggles.json
  default.accent-colors.json
  logo.svg
  logo-dark-mode.svg
```
