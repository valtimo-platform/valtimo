---
description: >-
  This page explains how the front-end was constructed and what kind of
  customisation to the look and feel is supported.
---

# Front-end customization

## Architectural overview

### Beagle

At the start of the development of the [front-end libraries](https://github.com/valtimo-platform/valtimo-frontend-libraries), the user interface was constructed using [Beagle](https://foxythemes.net/preview/products/beagle/index.html), which is a custom theme based on [Bootstrap 4](https://getbootstrap.com/docs/4.0).  For backwards compatibility, Beagle and Bootstrap are still included in the front-end libraries, but will not be upgraded in the future.

### Carbon

At a later stage, the use of the [Carbon Design System](https://carbondesignsystem.com/) was introduced. All current front-end development in the product is done through the [Angular implementation](https://angular.carbondesignsystem.com/?path=/story/components-welcome--to-carbon-angular) of this design system. Using these components, the effort needed to develop a professional, accessible front-end is greatly reduced.&#x20;

### Beagle/Carbon Compatibility

Some effort was made to allow Beagle and Carbon to work together in the same application. However, Carbon is now the default way to develop for Valtimo, so implementations are advised to develop custom screens and components using Carbon components, with minimal, if any, custom CSS.

### Stylesheets

By default, various stylesheets need to be included in the `styles` array in the implementation's `angular.json`. For an up-to-date overview of these stylesheets, refer to the [angular.json of the Valtimo development implementation](https://github.com/valtimo-platform/valtimo-frontend-template/blob/v/12/angular.json).

### Form.io

[Form.io](https://form.io/) is used throughout the application. By default, its components use Bootstrap 4 classes for styling. Out-of-the-box, Valtimo applies some styling to Form.io.&#x20;

Since [Valtimo 12.4.1](https://docs.valtimo.nl/release-notes/12.x.x/12.4.0/12.4.1), a Carbon Form.io theme has been included. Going forward, this is the officially supported Form.io look and feel. This theme can be applied by including `node_modules/@valtimo/components/assets/css/formio-carbon.scss` in the `styles`array of `angular.json.`&#x20;

## Customization

### Custom accent color

Out-of-the-box, a custom accent color used by Carbon components is supported. [Refer to this page ](customizing-carbon-theme.md)for more information on how to configure this custom accent color.

### Custom logo

The logo, displayed at the top left of the application, can be customized. More information can be found [here](./#custom-logo).

### Additional customization

Further customisation of Valtimo's look and feel is possible by overriding styles using global CSS code. Please be advised that this kind of customization is not officially supported, and it's possible any custom CSS will break in future versions, both through updates to Valtimo or to its dependencies (notably the Carbon Design System).&#x20;
