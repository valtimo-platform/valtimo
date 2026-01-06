# Notes

## Access control

Access to the case notes can be configured through access control. More information about access control can be found [here](https://docs.valtimo.nl/features/access-control).

### Resources and actions

<table><thead><tr><th width="329" valign="top">Resource type</th><th width="143" valign="top">Action</th><th valign="top">Effect</th></tr></thead><tbody><tr><td valign="top"><code>com.ritense.note.domain.Note</code></td><td valign="top"><code>view_list</code></td><td valign="top">Allows viewing notes.</td></tr><tr><td valign="top"></td><td valign="top"><code>create</code></td><td valign="top">Allows creating a note</td></tr><tr><td valign="top"></td><td valign="top"><code>modify</code></td><td valign="top">Allows modifying a note</td></tr><tr><td valign="top"></td><td valign="top"><code>delete</code></td><td valign="top">Allows deleting a note</td></tr></tbody></table>

### Examples

<details>

<summary>Permission to view all notes</summary>

<pre class="language-json" data-overflow="wrap"><code class="lang-json">{
<strong>    "resourceType": "com.ritense.note.domain.Note",
</strong>    "action": "view_list",
    "conditions": []
}
</code></pre>

</details>

<details>

<summary>Permission to delete notes created by the logged-in user</summary>

{% code overflow="wrap" %}
```json
{
   "resourceType": "com.ritense.note.domain.Note",
   "action": "delete",
   "conditions": [
      {
         "type": "field",
         "field": "createdByUserId",
         "operator": "==",
         "value": "${currentUsername}"
      }
   ]
}
```
{% endcode %}

</details>
