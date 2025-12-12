# Widget data sources

The data sources listed below are the ones that are included in Valtimo.

Each data source used must be imported in the `AppModule` of your front-end implementation if you want to use them. They are exported from `'@valtimo/dashboard'`.

## Case count

Key: `case-count`

Front-end module: `CaseCountDataSourceModule`

Returns the number of cases of a specific type that match the criteria have been set in the configuration.

### Properties

<table><thead><tr><th valign="top">Name</th><th valign="top">Description</th></tr></thead><tbody><tr><td valign="top"><code>documentDefinition</code></td><td valign="top">Required. The key of the document definition for which cases need to be counted.</td></tr><tr><td valign="top"><code>queryConditions</code></td><td valign="top">An array of conditions that the case needs to match in order to be included in the count. Each item in the array is a query condition object described in the table below.</td></tr></tbody></table>

### Query condition

<table><thead><tr><th valign="top">Name</th><th valign="top">Description</th></tr></thead><tbody><tr><td valign="top"><code>queryPath</code></td><td valign="top">The path of the variable that the condition uses to filter the count.</td></tr><tr><td valign="top"><code>queryOperator</code></td><td valign="top">The operator that the condition uses to filter the count. Available values are <code>!=</code>, <code>==</code>, <code>></code>, <code>>=</code>, <code>&#x3C;</code> and <code>&#x3C;=</code>.</td></tr><tr><td valign="top"><code>queryValue</code></td><td valign="top">The value which the queryPath variable is checked against.</td></tr></tbody></table>

## Multiple case counts <a href="#multiple-case-counts" id="multiple-case-counts"></a>

Key: `case-counts`

Front-end module: `CaseCountsDataSourceModule`

Returns multiple counts of cases of a specific type that match the criteria have been set for each count.

### **Properties**

<table><thead><tr><th valign="top">Name</th><th valign="top">Description</th></tr></thead><tbody><tr><td valign="top"><code>documentDefinition</code></td><td valign="top">Required. The key of the document definition for which cases need to be counted.</td></tr><tr><td valign="top"><code>queryItems</code></td><td valign="top">Required. Minimum of two need to be defined. Each <code>queryItem</code> requires a <code>label</code> and an array of <code>queryConditions</code>, the latter are similar to those require for the <code>case-count</code> data source.</td></tr></tbody></table>

## Case group by <a href="#case-group-by" id="case-group-by"></a>

Key: `case-group-by`

Front-end module: `CaseGroupByDataSourceModule`

### Properties

<table><thead><tr><th valign="top">Name</th><th valign="top">Description</th></tr></thead><tbody><tr><td valign="top"><code>documentDefinition</code></td><td valign="top">Required. The key of the document definition for which cases need to be counted.</td></tr><tr><td valign="top"><code>path</code></td><td valign="top">Required. The path of which the values need to be grouped. For example <code>case:createdBy</code>.</td></tr><tr><td valign="top"><code>queryConditions</code></td><td valign="top">Optional. An array of conditions that the case needs to match in order to be included in the counts. Each item in the array is a query condition object described in the table under <code>case-count</code>.</td></tr><tr><td valign="top"><code>enum</code></td><td valign="top">Optional. An object which defines how items retrieved by the group by need to be displayed. This can be used to show technical values in a user-friendly way. For example <code>{"isRequired": "Is required"}</code>.</td></tr></tbody></table>
