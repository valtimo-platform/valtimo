# ⭕ Processes

Valtimo is built on top of Operaton, it uses Operaton to create BPMN processes.

This section contains information on how to configure and use BPMN processes in Valtimo.

* [System processes](systemprocesses.md)
* [Correlating messages](correlation-service.md)
* [Manipulating jobs](job-service.md)

## Access control

Access to the processes can be configured through access control. More information about access control can be found [here](https://docs.valtimo.nl/features/access-control).

### Resources and actions

<table><thead><tr><th width="329">Resource type</th><th width="143">Action</th><th>Effect</th></tr></thead><tbody><tr><td><code>com.ritense.valtimo.operaton.domain.OperatonExecution</code></td><td><code>create</code></td><td>Allows creating an execution for a process definition.</td></tr><tr><td><code>com.ritense.valtimo.operaton.domain.OperatonProcessDefinition</code></td><td>-</td><td>-</td></tr></tbody></table>

Process definitions have no actions currently. As a result, they can only be used as part of container conditions. See the example [here](./#permission-to-start-a-process-for-one-specific-process-definition) on how to use this.

### Examples

<details>

<summary>Permission to start a process for one specific process definition</summary>

<pre class="language-json" data-overflow="wrap"><code class="lang-json">{
<strong>    "resourceType": "com.ritense.valtimo.camunda.domain.CamundaExecution",
</strong>    "action": "create",
    "conditions": [
        {
            "type": "container",
            "resourceType": "com.ritense.valtimo.camunda.domain.CamundaProcessDefinition",
            "conditions": [
                {
                    "type": "field",
                    "field": "key",
                    "operator": "==",
                    "value": "evenementenvergunning"
                }
            ]
        }
    ]
}
</code></pre>

</details>
