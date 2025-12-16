# Search fields API

Search fields add the ability to filter cases. Each search field adds the ability to filter on a specific field. This page describes how the search fields can be created, read, updated and deleted.

## Creating search fields

**Endpoint:**\
`POST /api/v1/document-search/{documentDefinitionName}/fields`

**Request body:**

```json
{
  "title": "title",   
  "key": "key_to_search_on",
  "path": "doc:path.to.key",
  "dataType": "date",
  "fieldType": "range",
  "matchType": "exact"
}
```

## Get all search fields

To retrieve all the search fields created for a certain document definition use the following endpoint: `GET /api/v1/document-search/{documentDefinitionName}/fields`. This will return an array of search fields.

## Update existing search field

Existing search fields can be updated with new values by using the endpoint below. The endpoint below accepts a list of search fields. The ordering of search fields in this list is preserved. `PUT /api/v1/document-search/{documentDefinitionName}/fields` and providing the following request body:

```json
[
  {
    "title": "title",
    "key": "key_to_search_on",
    "path": "doc:path.to.key",
    "dataType": "boolean",
    "fieldType": "single",
    "matchType": "exact"
  }
]
```

The `dataType`, `fieldType` and `matchType` only allow for specific values. A list of these allowed values can be found [here](configuring-search-fields.md#allowed-values).

## Deleting an existing search field.

An existing search field can be deleted by calling the following endpoint: `DELETE /api/v1/document-search/{documentDefinitionName}/fields?key={someKey}` and providing both a query parameter with the value of the key that should be deleted.

## Allowed values

This paragraph will mention all available values for each field and how to use the search types.

### Title

The allowed value for `title` is:

* text

#### How to use

The `title` property is an optional field that appears as a label for the current search field. When the title is not defined, the default value will be the search field key translation (the original value is displayed if no translation is available).

For a better example, follow the table below:

| Has title | Key has translation | Result                 |
| --------- | ------------------- | ---------------------- |
| **Yes**   | Yes                 | _show title_           |
| **Yes**   | No                  | _show title_           |
| **No**    | Yes                 | _show key translation_ |
| **No**    | No                  | _show key value_       |

#### Add translation

To add a translation to a key, a `searchField` **key** must exist under the `searchFields` object in the translations files.

Add the name of the created **key** and the label you want to display.

Follow the example below using `fullname` as key:

```
"searchFields": {
  "fullname": "Full name"
},
```

### Key

The allowed value for `key` is:

* text

#### How to use

The `key` property is a unique key identified by the search field. You cannot save the search field if the key is not unique.

### Path

The allowed value for `path` is:

* text

#### How to use

The property `path` is a path to the property you want to search on. For searching in the document's JSON schema the `path` should have a prefix `doc:` and end with a jsonpath without `$.`. For example:

```jsonpath
doc:customer.firstName
```

```jsonpath
doc:customer.addresses[0].street
```

```jsonpath
doc:["loan-accepted"]
```

The `path` also support functions. Since the jsonpath -part is executed directly on the database, the supported functions might be different for different database types. Both MySQL and Postgres databases support the following `path`:

```jsonpath
doc:customer.addresses.size()
```

It's also possible to search for some properties that do not exist in the document JSON schema. These properties are:

```jsonpath
case:createdBy
```

```jsonpath
case:sequence
```

```jsonpath
case:assigneeFullName
```

### Data type

The allowed values for `dataType` are:

* boolean
* date
* datetime
* number
* text

#### How to use

These values determine the type of search that will show. For example when the `dataType` is `date` the search field will be a datepicker.

### Field type

The allowed values for `fieldType` are:

* range
* single
* multi-select-dropdown
* single-select-dropdown

#### How to use

The `fieldType` value determines how the search should be performed. For example when the `fieldType` is `range` the search field will be from/to fields. For the option `single`, the user can only input a single value.

### Match type

The allowed values for `matchType` are:

* exact
* like

#### How to use

The `matchType` will determine what type of search is performed.

For example:

* **Contains**: When the `matchType` is `contains` and the search term is `John`, the result will also include a `John Doe`.
* **Exact**: If the `matchType` selected is `exact`, the value `John` would only be matched to the specific value `John`, i.e. `John Doe` will not be part of the result.

## Adding tooltip

The Tooltips property display helps text when you hover over the question mark icon.

To add this tooltip to search fields, a `searchField` key must exist under `searchFieldsTooltips` in the translation files.

Within each file, it is possible to find a structure with existing translations. Below the `searchFieldsTooltips` object, add the name of the created key and the description you want to display.

Follow the example below using `fullname` as key:

```
"searchFieldsTooltips": {
  "fullname": "Enter the full name of the responsible person you want to search for"
},
```

This configuration is optional and will only be displayed if previously defined in the translation files.
