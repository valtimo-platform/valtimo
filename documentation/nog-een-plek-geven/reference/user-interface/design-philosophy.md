# Design philosophy

In valtimo-frontend-libraries major version 5, a new library was introduced: `@valtimo/user-interface`. It aims to provide a set of components which will give Valtimo a clean and consistent look and feel. The initial set of components are based on [this Figma design](https://www.figma.com/file/Tl6wqdvPDTBi1LLofWxIiz/Valtimo-screens---nieuwe-opzet).

Note: as of valtimo-front-end-libraries major version 10, the development and use of this library has been discontinued. For new features, the [Carbon design system](carbon-design-system.md) will be used.

## Design tokens

All main design aspects - like color, typography, and spacing - are stored in CSS variables, which are then referenced in specific design tokens used by components.

### Including design tokens in an implementation

All design tokens are specified in one file, and exported from `@valtimo/user-interface`.

They are included by adding the following line to the `styles` array in an implementation's `angular.json` file:

`node_modules/valtimo/user-interface/assets/design-tokens.css`;

Implementation developers can later add their own sheets with tokens after this import, in order to override values, for example to customize an implementation's accent colors.

### Design token system

#### Prefixes

All design tokens are prefixed with `--v-*`.

#### Values

All spacing and sizing is done through the use of pixel values. Margins and padding are added with the `block` and `inline` syntax. So for example, `margin-inline-start` as opposed to `margin-left`.

#### Definition

All main design aspects are defined at the top of \`design-tokens.css. For example, this line defines the main accent color:

```css
/* colors */
--v-color-accent-1: #ef6622;
```

New design aspects are always added at the top of the file, with the main tokens, and are appropriately categorized using CSS comments.

#### Component tokens

Subsequently, specific tokens are specified for each component, which reference these main design aspects:

```css
/* Button */
--v-button-primary-bg-color: var(--v-color-accent-1);
```

In this way, the design remains consistent, and it offers implementation developers the choice to either override a main design aspect in all components (for example, changing an accent color), or to override a specific property of a specific component.

Stylesheets of components refer to component tokens only, never to main tokens, like so:

#### **`button.component.scss`**

```css
.v-button--primary {
    background-color: var(--v-button-primary-bg-color);
}
```

## Components

### Library structure

All components using this new design are exported from the library `@valtimo/user-interface` with their own module. In this way, components are only imported into other modules as needed.

### Selector naming

Components using the new design are prefixed with `v-*`, for example `v-paragraph`.

### HTML structure

Components are made from scratch, and as much as possible, without the help of third party components. Their HTML structure is to conform to the BEM naming convention. For a guide on how to use BEM, refer to [this page](http://getbem.com/naming/).

### Component input

As a way to reuse code as much as possible, the appearance of features of a component may be altered through the use of component inputs. If a new feature or look is required, make sure to determine if this is best added to an existing component and enabled through the use of inputs.

### Spacing

By default, margins external to the component - for example, the margin below a title element - are optional and can be turned off. In this way, spacing is flexible and may be customized to satisfy specific needs.

## Example component: v-paragraph

Taking all the above guidelines into account, view the reference code below with comments, to see how it all comes together.

#### **`paragraph.component.html`**

```angular2html
<p
    <!-- Main component class using a v-* prefix -->
    class="v-paragraph"
    <!-- BEM modifier classes triggered based on component input -->
    [ngClass]="{
        'v-paragraph--center': center,
        'v-paragraph--full-width': fullWidth,
        'v-paragraph--margin': margin,
        'v-paragraph--italic': italic
    }"
>
    <ng-content></ng-content>
</p>
```

#### **`paragraph.component.ts`**

```typescript
import {Component, Input} from '@angular/core';

@Component({
    // Component selector prefixed with v-*
    selector: 'v-paragraph',
    templateUrl: './paragraph.component.html',
    styleUrls: ['./paragraph.component.scss'],
})
export class ParagraphComponent {
    // Component inputs which trigger the BEM classnames in the template
    @Input() center = false;
    @Input() fullWidth = false;
    @Input() margin = false;
    @Input() italic = false;
}
```

#### **`paragraph.component.scss`**

```scss
/* Main component class using a v-* prefix */
.v-paragraph {
    margin: 0;
    font-size: var(--v-paragraph-font-size);
    line-height: var(--v-paragraph-line-height);
    color: var(--v-paragraph-color);
    font-weight: var(--v-paragraph-font-weight);
}

/* BEM modifier classnames triggered by component inputs */

.v-paragraph--center {
    text-align: center;
}

.v-paragraph--full-width {
    width: 100%;
}

.v-paragraph--margin {
    /* Component only uses component specific design tokens */
    margin-block-end: var(--v-paragraph-margin);
}

.v-paragraph--italic {
    font-style: italic;
}
```

The component is then exported separately from its own module, so that it can be used on its own in other modules.

#### **`paragraph.module.ts`**

```typescript
import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ParagraphComponent} from './paragraph.component';

@NgModule({
    declarations: [ParagraphComponent],
    imports: [CommonModule],
    exports: [ParagraphComponent],
})
export class ParagraphModule {}
```
