# Front-end migration

## Admin settings module

The admin settings feature requires adding a new dependency, importing the module, and adding a menu item.

### 1. Add new dependency

Add the following dependency to `package.json`:

```json
{
  "dependencies": {
    "@valtimo/admin-settings": "13.28.0"
  }
}
```

{% hint style="info" %}
Replace `13.28.0` with the Valtimo version you are upgrading to, or use the appropriate package URL.
{% endhint %}

### 2. Import AdminSettingsModule

In `app.module.ts`, add the import for `AdminSettingsModule`:

```typescript
import {AdminSettingsModule} from '@valtimo/admin-settings';
```

Then add `AdminSettingsModule` to the `imports` array of your `AppModule`:

```typescript
@NgModule({
  imports: [
    // ... existing imports
    AdminSettingsModule,
  ],
})
export class AppModule {}
```

### 3. Add admin settings menu item

In your `environment.ts`, add a menu item for the admin settings page under the admin menu:

```typescript
{
  link: ['/admin-settings'],
  title: 'adminSettings.title'
},
```

