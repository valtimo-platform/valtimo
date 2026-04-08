# Front-end migration

## Teams module

The teams feature requires adding a new dependency, importing the teams module and adding a menu item.

### 1. Add new dependency

Add the following dependency to `package.json`:

```json
{
  "dependencies": {
    "@valtimo/teams": "13.23.0"
  }
}
```

{% hint style="info" %}
Replace `13.23.0` with the Valtimo version you are upgrading to, or use the appropriate package URL.
{% endhint %}

### 2. Import TeamsModule

In `app.module.ts`, add the import for `TeamsModule`:

```typescript
import {TeamsModule} from '@valtimo/teams';
```

Then add `TeamsModule` to the `imports` array of your `AppModule`:

```typescript
@NgModule({
  imports: [
    // ... existing imports
    TeamsModule,
  ],
})
export class AppModule {}
```

### 3. Add teams menu item

In your `environment.ts`, add a menu item for the teams page under the admin menu:

```typescript
{
  link: ['/teams'],
  title: 'teams.title',
  sequence: 2, // adjust sequence as needed
},
```
