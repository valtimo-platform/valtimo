# Form field data resolver

FormIO forms in Valtimo can be prefilled with data from custom sources.

{% hint style="danger" %}
Form field data resolvers have been deprecated as of version `11.0.0` and will be removed in the future. Please use [value resolvers](../creating-forms-in-valtimo.md#value-resolvers) instead.
{% endhint %}

## Introduction

A `FormFieldDataResolver` is a spring bean that is used by Valtimo to get data to be preloaded in a form. By adding a new implementation of the `FormFieldDataResolver` interface and registering this as bean, a new prefix can be supported.

## Implementing the FormFieldDataResolver

There are two methods that need to be implemented:

* The `supports(String externalFormFieldType)` method determines if the current resolver is applicable for a certain prefix. When `true` is returned, it means the current resolver supports the prefix that Valtimo has found and the _get_ method will be called.
* The `get(String documentDefinitionName, UUID documentId, String... varNames)` method is used by Valtimo get retrieve the actual data. `documentDefinitionName` and `documentId` are passed in as context that can be used to find the data for the current form. Any fields in the form that use the same prefix will be bundled and passed into this method as the varargs parameter `varNames`. The intention is to be able to combine and reduce calls to other systems and resources in order to reduce load and load times (e.g. retrieve a database record once, and get multiple properties from the result). The result of this method is a `Map<String, Object>` where the key is the name of the field (one entry from the `varNames`) and the value is the value that needs to be loaded in the form.

Below is an example of a `FormFieldDataResolver`. This example would be called for each form field where the `example` prefix is used (e.g. `example:some-field`).

```kotlin
class ExampleDataResolver : FormFieldDataResolver {
    
    override fun supports(externalFormFieldType: String): Boolean {
        return externalFormFieldType == PREFIX
    }

    @Override
    override fun get(documentDefinitionName: String, documentId: UUID, vararg varNames: String): Map<String, Object> {
        // get values for all requested variables
    }

    companion object {
        private const val PREFIX = "example"
    }
}
```
