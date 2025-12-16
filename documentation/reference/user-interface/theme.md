# Theme

By using the Carbon Design System, it has enabled us to make implementing custom changes to the look and feel of the application
easy. By using the appropriate color tokens provided in the [official color documentation](https://carbondesignsystem.com/elements/color/tokens), 
consistency can be achieved easily.

## Custom theme overrides

The theme used by Carbon can be customized to a large degree. By default, the libary `@valtimo/components` exports a
theme from the following path: `"node_modules/@valtimo/components/assets/css/carbon.scss"`. Also, a stylesheet is
exported to ensure compatibility with the previous Beagle theme, FormIO forms and other Carbon specific overrides that are
necessary: `"node_modules/@valtimo/components/assets/css/compatibility.scss"`.

### Custom color palette

You can override the default Valtimo blue colors by adding these to your `styles.scss`. See the example below and replace
the hex values with your custom values. 

It is recommended that the contrast between your custom color and `#FFFFFF` is 4.5:1 or higher. This can 
be checked by using the [WCAG Contrast Checker](https://contrastchecker.com) and setting your custom color as the 
background color and setting `#FFFFFF` as the foreground color.

If your custom color has a contrast ratio higher than 4.5:1, you can use the [Color Shades Generator](https://mdigi.tools/color-shades/)
to create 10 shades based on your color. These 10 colors will be your new values with `--vcds-color-10` being the
lightest (almost white) color and `--vcds-color-100` being the darkest (almost black).

_**Sidenote:**_ Please make sure that you never use red as the main color. Red means "danger" and it can have a negative
effect on the hierarchy of colors in the UI when used as the main color.

#### **`styles.scss`**
```scss
/* these are the colors that override the default Valtimo blue colors */
:root {
  --vcds-color-100: #100a0b;
  --vcds-color-90: #301d21;
  --vcds-color-80: #4f3038;
  --vcds-color-70: #6f434e;
  --vcds-color-60: #8f5664;
  --vcds-color-50: #a9707d;
  --vcds-color-40: #bc909a;
  --vcds-color-30: #cfb0b7;
  --vcds-color-20: #e2cfd4;
  --vcds-color-10: #f5eff1;
}
```

### Overriding other color tokens

The Carbon design system theme and custom color overrides should cover all necessary needs for an implementation. If extra
customization is needed however, it can be done by completely overriding the way the theme is initialized with the following 
code:

#### **`custom-theme.scss`**
```scss
/* The default carbon themes are imported */
@use '@carbon/styles/scss/themes';
@use '@carbon/colors';

/* here we assign the themes we want to use as light themes */
$lightThemeVariables: (
        'g10': themes.$g10,
);

/* and here we assign the themes we want to use as dark themes */
$darkThemeVariables: (
        'g90': themes.$g90,
);

/* this is where we override the default properties that are used in the light themes */
$lightThemeOverwriteVariables: (
  // Color 80
        active-primary: var(--vcds-color-80),
        active-tertiary: var(--vcds-color-80),
  // Color 70
        link-02: var(--vcds-color-70),
        support-04: var(--vcds-color-70),
        hover-primary-text: var(--vcds-color-70),
        link-secondary: var(--vcds-color-70),
        support-info: var(--vcds-color-70),
        link-primary-hover: var(--vcds-color-70),
  // Color 60
        interactive-01: var(--vcds-color-60),
        interactive-03: var(--vcds-color-60),
        interactive-04: var(--vcds-color-60),
        link-01: var(--vcds-color-60),
        focus: var(--vcds-color-60),
        background-brand: var(--vcds-color-60),
        interactive: var(--vcds-color-60),
        border-interactive: var(--vcds-color-60),
        link-primary: var(--vcds-color-60),
        brand-01: var(--vcds-color-60),
        brand-03: var(--vcds-color-60),
  // Color 50
        inverse-support-04: var(--vcds-color-50),
        support-info-inverse: var(--vcds-color-50),
  // Color 40
        inverse-link: var(--vcds-color-40),
        link-inverse: var(--vcds-color-40),
  // Color 20
        highlight: var(--vcds-color-20)
);

/* this is where we override the default properties that are used in the dark themes */
$darkThemeOverwriteVariables: (
  // Color 80
        active-primary: var(--vcds-color-80),
        active-tertiary: var(--vcds-color-80),
        highlight: var(--vcds-color-80),
  // Color 70
        inverse-support-04: var(--vcds-color-70),
        support-info-inverse: var(--vcds-color-70),
  // Color 60
        interactive-01: var(--vcds-color-60),
        background-brand: var(--vcds-color-60),
        brand-01: var(--vcds-color-60),
        brand-03: var(--vcds-color-60),
  // Color 50
        support-04: var(--vcds-color-50),
        support-info: var(--vcds-color-50),
        interactive-04: var(--vcds-color-50),
        interactive: var(--vcds-color-50),
        border-interactive: var(--vcds-color-50),
  // Color 40
        link-01: var(--vcds-color-40),
        link-primary: var(--vcds-color-40),
  // Color 30
        link-02: var(--vcds-color-30),
        hover-primary-text: var(--vcds-color-30),
        link-secondary: var(--vcds-color-30),
        link-primary-hover: var(--vcds-color-30)
);

/* The initial theme is defined here */
@use '@carbon/styles/scss/theme' with (
  $theme: map-merge(themes.$g10, $lightThemeOverwriteVariables)
);

/* button colors are defined here */
@use '@carbon/styles/scss/components/button/tokens' as button-tokens with (
  $button-primary-active: var(--vcds-color-80),
  $button-tertiary-active: var(--vcds-color-80),
  $button-primary-hover: var(--vcds-color-70),
  $button-tertiary-hover: var(--vcds-color-70),
  $button-primary: var(--vcds-color-60),
  $button-tertiary: var(--vcds-color-60)
);

/* here, all Carbon styles are included.*/
@use '@carbon/styles';
@use '@carbon/grid';
@include grid.flex-grid();

/* Class names are generated for all available themes, so they can be used wherever necessary */
@each $name, $variable in $lightThemeVariables {
  [data-carbon-theme='#{$name}'] {
    @include theme.theme($variable, $lightThemeOverwriteVariables);
  }
}

@each $name, $variable in $darkThemeVariables {
  [data-carbon-theme='#{$name}'] {
    @include theme.theme($variable, $darkThemeOverwriteVariables);
  }
}

/* default Valtimo colors serve as a back-up in case no other colors are set. */

:root {
  --vcds-color-100: #002547;
  --vcds-color-90: #002c54;
  --vcds-color-80: #003361;
  --vcds-color-70: #286198;
  --vcds-color-60: #2b79bd;
  --vcds-color-50: #61aedf;
  --vcds-color-40: #8acff2;
  --vcds-color-30: #aadcf6;
  --vcds-color-20: #c9e9f9;
  --vcds-color-10: #e9f6fd;
}
```

### Non-Carbon related theme overrides

It might be possible that you want to override certain items based on the theme that is currently active. This can be done
by using the value `currentTheme$`, imported by `CdsThemeService` from `'@valtimo/components'`. This value is either `'G10'` (Light)
or `'G90'` (dark). The option `'SYSTEM'` is not a theme, but only a toggle for the auto-switching of themes based on the
preferred system theme, which gets its value from the browsers `(prefers-color-scheme: 'value')`. 
