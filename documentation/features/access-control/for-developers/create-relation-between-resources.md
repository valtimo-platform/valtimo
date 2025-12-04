# Creating a relation to another resource

When setting conditions for a permission you sometimes want those conditions to apply to related resources. For example, you might want to view tasks for cases that have not yet been assigned. In this case the not assigned part does not apply directly to the task, but to the related case resource. To define conditions on related resources there first has to be a relation that Valtimo can use to base its logic on. This page describes how to create a relation from one resource to another.

## How to create a mapper

In order to support conditions on a related entity, an implementation of `AuthorizationEntityMapper` needs to be created. This will tell Valtimo how to access the related data. Two different ways of accessing the data are supported for two scenarios.

* `mapQuery` is the method used when requesting a list of the primary resource with a condition on the related resource. In this situation the SQL query will have to be changed to allow for filtering on a database level and proper pagination. This method should use criteria query logic to join the related table.
* `mapRelated` is the method used when checking access based on a single entity that has already been retrieved the related entity needs to be found. This method should return the related objects based on a given entity. This can either be done by calling a service or repository to find the entity, or when the primary resource has a JPA relation by simply accessing the corresponding property.

For example, if you have a related custom entity `Meeting` that belong to a Document the following code could be used.

```kotlin

class Meeting {
  ...
  @ManyToOne
  @JoinColumn(name="document_id", nullable=false)
  lateinit var document: JsonSchemaDocument
  ...
}

class MeetingDocumentMapper() : AuthorizationEntityMapper<Meeting, JsonSchemaDocument> {

  override fun mapRelated(entity: Meeting): List<JsonSchemaDocument> {
    // since meeting has a direct relation to document, we can directly return
    return listOf(entity.document)
  }

  override fun mapQuery(
    root: Root<Meeting>,
    query: CriteriaQuery<*>,
    criteriaBuilder: CriteriaBuilder
  ): AuthorizationEntityMapperResult<JsonSchemaDocument> {
    val documentRoot = query.from(JsonSchemaDocument::class.java)
    return AuthorizationEntityMapperResult(
      documentRoot,
      query,
      criteriaBuilder.equal(root.get<Meeting>("document"), documentRoot.get<JsonSchemaDocumentId>("id").get<UUID>("id"))
    )
  }

  override fun supports(fromClass: Class<*>, toClass: Class<*>): Boolean {
    // this mapper is only used to map from Meeting to JsonSchemaDocument
    return fromClass == Meeting::class.java && toClass == JsonSchemaDocument::class.java
  }
}
```

## How to configure conditions for a related resource

In order to configure conditions for a related resource, a mapper needs to exist that can map from the primary resource to the related resource. Some mappers come packaged with Valtimo. Which mappers these are can be found on the [reference page](/broken/pages/rfQzYBDmfUkfTpDzFOGC).

When a mapper to another resource exists, a condition of type container can be used to nest conditions on the related resource. This condition has a conditions array that can be used to define conditions that apply to the related resource.

For example, if we want users with role `ROLE_USER` to only be able to view meetings for Documents that are assigned to them, the following configuration can be used.

```json
{
    "resourceType": "com.ritense.example.Meeting",
    "action": "view",
    "roleKey": "ROLE_USER",
    "conditions": [
        {
            "type": "container",
            "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocument",
            "conditions": [
                {
                    "type": "field",
                    "field": "assigneeId",
                    "operator": "==",
                    "value": "${currentUserId}"
                }
            ]
        }
    ]
}
```
