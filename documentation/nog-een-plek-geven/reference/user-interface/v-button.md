# v-button

The `v-button` component is used for all buttons in the application. It supports text buttons, text buttons with an icon, and icon buttons.

## Usage

Import `ButtonModule` from `@valtimo/user-interface` in the module which includes your component. Use `v-button` in your component template code:

#### **`sample.component.html`**

```angular2html
<v-button
    [disabled]="disabled"
    (clickEvent)="buttonClick()"
    mdiIcon="check"
    type="success"
>
    // The text displayed inside v-button is put inside the v-button html tags
    {{ 'success' | translate }}
</v-button>
```

## Inputs

| Property  | Type           | Required | Default     | Description                                                                                |
| --------- | -------------- | -------- | ----------- | ------------------------------------------------------------------------------------------ |
| `type`    | `ButtonType`\* | no       | `'primary'` | The type of the button displayed. Types with `icon` in the name will not display any text. |
| Paragraph | Text           |          |             |                                                                                            |

* `'primary'` | `'secondary'` | `'success'` | `'text'` | `'icon-danger'` | `'danger'` | `'icon-grey'` | `'icon-danger-small'` | `'icon-grey-small'`
