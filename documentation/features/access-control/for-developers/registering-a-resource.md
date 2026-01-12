# Creating a resource

Access control can be exercised over resources that have been registered. Valtimo registers a few resources out of the box. These are:

* `com.ritense.document.domain.impl.JsonSchemaDocument`
* `com.ritense.document.domain.impl.JsonSchemaDocumentDefinition`
* `com.ritense.document.domain.impl.snapshot.JsonSchemaDocumentSnapshot`
* `com.ritense.document.domain.impl.searchfield.SearchField`
* `com.ritense.note.domain.Note`
* `com.ritense.valtimo.camunda.domain.CamundaTask`
* `com.ritense.valtimo.camunda.domain.CamundaIdentityLink`
* `com.ritense.case.domain.CaseTab`

The authorization module allows developers to register their own resources, which allows said resources to be used when configuring permissions.

## Registering a resource

In order to register a resource for use in access control, there are two interfaces that should be implemented; the `AuthorizationSpecification`, and the `AuthorizationSpecificationFactory`.

### Specification

The `AuthorizationSpecification` is an abstract class built upon the Spring `Specification` interface. Generally, only two methods have to be overridden. The `toPredicate` method creates predicates that are used to enhance queries. For example, when a user looks at a list of documents, only the documents this user has access to will be shown.

Secondly, the `identifierToEntity` method is used to go from an identifier to the actual entity. This is used when checking permissions for an entity directly, e.g. when checking if a user has a specific permission via the `userHasPermission` endpoint.

In the example below, the `Audit` resource will be registered for access control. The class extending `AuthorizationSpecification` has to apply to this resource in order for the Authorization module to see it as a registered resource.

```kotlin
class AuditSpecification(
    authRequest: AuthorizationRequest<Audit>,
    permissions: List<Permission>,
    private val auditService: AuditService,
    private val queryDialectHelper: QueryDialectHelper
) : AuthorizationSpecification<Audit>(authRequest, permissions) {
    override fun toPredicate(
        root: Root<Audit>,
        query: CriteriaQuery<*>,
        criteriaBuilder: CriteriaBuilder
    ): Predicate {
        // Filter the permissions for the relevant ones and use those to  find the filters that are required
        // Turn those filters into predicates
        val groupList = query.groupList.toMutableList()
        groupList.add(root.get<UUID>("id"))
        query.groupBy(groupList)

        // This will be mostly the same across classes implementing AuthorizationSpecification
        // It ensures predicates are created based on permissions
        val predicates = permissions.stream()
            .filter { permission: Permission ->
                Audit::class.java == permission.resourceType &&
                    authRequest.action == permission.action
            }
            .map { permission: Permission ->
                permission.toPredicate(
                    root,
                    query,
                    criteriaBuilder,
                    authRequest.resourceType,
                    queryDialectHelper
                )
            }.toList()
        return combinePredicates(criteriaBuilder, predicates)
    }

    override fun identifierToEntity(identifier: String): Audit {
        return auditService.getAuditById(UUID.fromString(identifier))
    }
}
```

### Specification Factory

In order to determine which specification should be used for which resource, a class that implements the `AuthorizationSpecificationFactory` interface should be created. The methods that should be implemented are the `create` and `canCreate` methods. As the name implies, the first method creates the `AuthorizationSpecification` for the resource, and the second method is determined to see if the requested resource matches the resource this factory is intended to apply to.

In the example below, the `Audit` resource will be registered for access control. The class extending `AuthorizationSpecificationFactory` has to apply to this resource in order for the Authorization module to see it as a registered resource.

```kotlin
class AuditSpecificationFactory(
    private val auditService: AuditService,
    private var queryDialectHelper: QueryDialectHelper
) : AuthorizationSpecificationFactory<Audit> {

    override fun create(
        context: AuthorizationRequest<Audit>,
        permissions: List<Permission>
    ): AuthorizationSpecification<Audit> {
        return AuditSpecification(
            context,
            permissions,
            auditService,
            queryDialectHelper
        )
    }

    override fun canCreate(context: AuthorizationRequest<*>, permissions: List<Permission>): Boolean {
        return Audit::class.java == context.resourceType
    }
}
```
