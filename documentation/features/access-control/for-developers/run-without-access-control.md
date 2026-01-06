# Running custom code without access control

When writing custom code, it might be necessary to call a method that is protected by access control. In some cases, it might be necessary to run this code without access control because this action is considered part of another action that was already checked.

For example, when creating a method that specifically updates a name in the document, this method needs to retrieve the document and update the name. Assuming this method already checks for the update permission on documents, permission for retrieving the document should not be checked again.

There are two ways to run code without access control. The first is through a method, and the second is by using an annotation. These are explained below.

## Using the `AuthorizationContext.runWithoutAuthorization` method

When writing custom code, certain calls to authorized methods can be wrapped in a `runWithoutAuthorization` call to prevent access control checks. This can be done by using the `runWithoutAuthorization` method on the `AuthorizationContext` class. This method takes a `Callable` as an argument, and runs the code without access control.

```kotlin
class SomeDocumentService(
    private val documentService: JsonSchemaDocumentService,
    private val authorizationService: AuthorizationService
) {

    fun updateName(name: String, documentId: String) {
        // We wrap authorized code in a runWithoutAuthorization call to prevent access control checks
        val document = runWithoutAuthorization {
            // calling this method would normally require the JsonSchemaDocument VIEW permission
            documentService.get(documentId)
        }

        // update the document
        ...

        // Do a permission check to protect this method from unauthorized access
        // In this case we're checking for the custom JsonSchemaDocument UPDATE-NAME permission
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                JsonSchemaDocument::class.java,
                Action("UPDATE-NAME"),
                document
            )
        )
    }
}
```

## Using the `@RunWithoutAuthorization` annotation

Any calls to methods that are annotated with `@RunWithoutAuthorization` will not be checked by the access control layer. This is accomplished by using Spring AOP to intercept the method call and run the method without access control. This means this will not work for methods that are called from within the same class, as the annotation is not intercepted when called from within the same class.

```kotlin
class SomeDocumentService(
    private val documentService: JsonSchemaDocumentService,
) {
    
    // Any calls to this method disable access control checks just for this method
    @RunWithoutAuthorization
    fun updateName(name: String, documentId: String) {
        // Retrieve the document. Calling this method would normally require the JsonSchemaDocument VIEW permission 
        val document = documentService.get(documentId)

        // Update the document
        ...
    }
}
```

The downside to this approach is that it disables access control for the entire method, which means the method is insecure and should be used with caution. It is usually better to use the `AuthorizationContext.runWithoutAuthorization` method instead.
