# 14.0.0

Release date: 00-00-YYYY

---

## Enhancements

### Upgraded Form.io to version 5

Valtimo has upgraded its Form.io implementation to `@formio/js` v5.5.2 and `@formio/angular`
v11.0.5, replacing the end-of-life `formiojs` v4 and `@formio/angular` v7.

The core Form.io library has been renamed from `formiojs` to `@formio/js`. Implementations that
import from Form.io directly follow the same rename:

| Before | After |
|--------|-------|
| `import {Components} from 'formiojs'` | `import {Components} from '@formio/js'` |
| `import {Formio} from 'formiojs'` | `import {Formio} from '@formio/js'` |
| `FormioUtils.getRandomComponentId()` from `formiojs` | `getRandomComponentId()` from `@formio/js/utils` |
| `import {FormioOptions} from '@formio/angular'` | `import {FormioOptions} from '@valtimo/components'` |

Form.io 5 no longer ships framework templates by default. Valtimo registers the Bootstrap 4
template set, matching the Bootstrap 4.x stylesheet it already ships, so no action is required.

Custom Form.io components can use the new `buildCustomComponentEditForm()` helper from
`@valtimo/components` to derive an edit form from Form.io's built-in textfield edit form, keeping
the hidden `type` field and limiting the dialog to the Display, Conditional and Logic tabs.
