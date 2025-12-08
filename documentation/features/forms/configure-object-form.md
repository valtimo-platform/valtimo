# Objecten API object form

In order to display objects from the Objecten API a form can be used to define the way the data is shown. This form will be used when opening the details of an object from the [case detail tabs for an object type](../zgw/configure-tab-object-type.md).

Which form is used to display an object is determined based on the name of the form. The name of the form needs to be the name of the objecttype followed by the `.editform` suffix. For example, to create a form to display objects of type 'Monument' the form name would need to be `Monument.editform`. The form name is case-insensitive.

When adding fields to the form the field do **not** need to use the `zaakobject` prefix, as opposed to [editing zaak objects in a task form](broken-reference). The object data is the root used to prefill the form. This means that when an object contains the data shown below, the 'title' property can be used in the form by just using `title` as the 'Property Name' of the field.

```json
{
    "title": "Example data",
    ...
}
```
