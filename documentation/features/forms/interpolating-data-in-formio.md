# Interpolating data

Data can be included in Form.io forms in multiple ways. One of the more common ways is to interpolate variables in field descriptions and HTML type fields.

## How to interpolate data

By adding expressions to any text field in the form configuration, it is possible to use variables in that text. The example below shows how the name stored in the case document can be used in a HTML field in a form. This is used to display the name as part of a message.

First, when configuring the field an expression is used that will combine the data. More information on the syntax can be found below in the section [Available syntaxes](interpolating-data-in-formio.md#available-syntaxes).

![Setting up an HTML field with data interpolation](../../using-valtimo/forms/img/setting-up-html-field.png)

Only data that Form.io has access to at runtime can be used in the expression. This means that any data from the case document that needs to be displayed, first needs to be made available to Form.io. This can be done by for example adding a hidden field in the same form that the data will be prefilled in.

![Add hidden field for prefilling data](../../using-valtimo/forms/img/add-hidden-field-for-prefilling.png)

This results in the following form:

![Create a case with prefillable information](../../using-valtimo/forms/img/create-case-with-prefill-information.png)

When creating a case with the required information that will be stored.

![Add case data](../../using-valtimo/forms/img/add-case-data.png)

This data is used in the form to display the name in the message.

![Interpolated data example](../../using-valtimo/forms/img/interpolated-data-example.png)

This same feature can be used in other text fields. For example, the label of a field can also be dynamically changed.

![Configuration of label with interpolated data](../../using-valtimo/forms/img/interpolate-label-configuration.png)

Which results in the following field.

![Example of label with interpolated data](../../using-valtimo/forms/img/interpolate-label-example.png)

## Available syntaxes

There are two different syntaxes for interpolating data in Form.io forms:

* `{{{ expression }}}` for interpolation and escaping
* `{{ expression }}` for only interpolation

Because the data that is interpolated in the form can come from the user, it is important to escape the data to prevent it from being interpreted as HTML. This can be done by using the `{{{ expression }}}` syntax.

For example if a user were to enter the following text in a form fields.

![Example input with HTML](../../using-valtimo/forms/img/input-with-html.png)

This would result in the following text being displayed in the form when using the `{{{ expression }}}` syntax

![Example of escaped data](../../using-valtimo/forms/img/example-escaped-data.png)

When using the `{{ expression }}` syntax, the data is not escaped. This means that the data is interpreted as HTML as shown below.

![Example of interpolated data](../../using-valtimo/forms/img/example-interpolated-data.png)

It is recommended to always use the `{{{ expression }}}` syntax to prevent any issues with the data being displayed, unless it is intended to use HTML in the form and the data is trusted.

Sometimes it is useful to use html as part of the expression itself. The example below can be used to display a list of names in a form. It uses an unordered list for clarity. The actual value is escaped using the `_.escape` function from lodash. The way the data need to be escaped can be different depending on the data that is used, and the context in which it is displayed. Please always think about the security implications when displaying data in a form.

```html
<p>
  Names:
  <ul>
    {{ data.names ? ((data.names).map(name => '<li>'+_.escape(name)+'</li>').join('')) : '-' }}
  </ul>
</p>
```
