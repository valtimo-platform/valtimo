# Custom value resolvers

## Creating a custom value resolver

Value resolvers can be used throughout the application to retrieve, store, or process values from different sources by using references.

A reference concatenation of a prefix, separator and a key/path to the value, like this: `doc:/some/value`. In this example, `doc` is the prefix, `:` is the separator, and `/some/value` is the path in the document.

## Implementing a custom value resolver

A custom value resolver can be created by implementing the `ValueResolverFactory` interface and adding it as a Spring Bean to your application.

Each value resolver has to implement the `supportedPrefix()` method, the returned value should be unique among the configured value resolvers within the application.
