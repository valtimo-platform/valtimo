# Front-end migration

## Building block management module

The building blocks feature requires adding a new dependency and importing the building block management module.

### 1. Add new dependency

Add the following dependency to `package.json`:

```json
{
  "dependencies": {
    "@valtimo/building-block-management": "13.13.0"
  }
}
```

{% hint style="info" %}
Replace `13.13.0` with the Valtimo version you are upgrading to, or use the appropriate package URL.
{% endhint %}

### 2. Import BuildingBlockManagementModule

In `app.module.ts`, add the import for `BuildingBlockManagementModule`:

```typescript
import {BuildingBlockManagementModule} from '@valtimo/building-block-management';
```

Then add `BuildingBlockManagementModule` to the `imports` array of your `AppModule`:

```typescript
@NgModule({
  imports: [
    // ... existing imports
    BuildingBlockManagementModule,
  ],
})
export class AppModule {}
```

### 3. Add building block management menu item

In your `environment.ts`, add a menu item for the building block management page under the admin menu:

```typescript
{
  link: ['/building-block-management'],
  title: 'buildingBlockManagement.title',
  sequence: 2, // adjust sequence as needed
},
```
