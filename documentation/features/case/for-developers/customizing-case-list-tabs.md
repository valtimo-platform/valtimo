# Case list tab order

When a case is configured so that a case handler can be assigned the case list screen in the UI is divided into 3 tabs. These tabs - and their order - can be customized through the frontend code of an implementation.

The following tabs are created when case handlers are enabled:

* My cases
* Unassigned cases
* All cases

## Modifying the tabs in environment file

To customize which tabs are displayed and in what order, you will need to configure this in the `environment` file.

Here, the `ValtimoConfig` property is defined, and within it, it is possible to declare in the `visibleDossierListTabs` property the tabs you want to show and what order they should be displayed in.

### Example:

```typescript
export const environment: ValtimoConfig = {
    ...,
    visibleDossierListTabs: [DossierListTab.MINE, DossierListTab.OPEN, DossierListTab.ALL]
}
```
