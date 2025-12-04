# Access control

{% hint style="success" %}
Available since Valtimo 12.10.0.
{% endhint %}

Access to the documents that were uploaded to the case, can be configured through access control. More information about access control can be found [here](https://docs.valtimo.nl/features/access-control).

### Resources and actions

<table><thead><tr><th width="329">Resource type</th><th width="143">Action</th><th>Effect</th></tr></thead><tbody><tr><td><code>com.ritense.resource.authorization.ResourcePermission</code></td><td><code>view_list</code></td><td>Allows viewing the list of documents</td></tr><tr><td></td><td><code>view</code></td><td>Allows downloading a document</td></tr><tr><td></td><td><code>create</code></td><td>Allows uploading a document</td></tr><tr><td></td><td><code>modify</code></td><td>Allows modifying the metadata of a document</td></tr><tr><td></td><td><code>delete</code></td><td>Allows deleting a document</td></tr></tbody></table>

### Examples

#### Permission to view all documents

<pre class="language-json"><code class="lang-json">{
<strong>    "resourceType": "com.ritense.resource.authorization.ResourcePermission",
</strong>    "action": "view_list",
    "conditions": []
}
</code></pre>

This permission doesn't support any conditions.
