/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.processdocument.migration

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.BaseIntegrationTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.TaskService
import org.operaton.bpm.engine.repository.ProcessDefinition
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

/** Migrates a running instance across every BPMN activity type against the real engine, using the exact plan build the executor performs. Leaf activities are renamed between the fixtures, gateways and events are not. */
@Transactional
class AllActivityTypesMigrationEngineIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var repositoryService: RepositoryService

    @Autowired
    lateinit var runtimeService: RuntimeService

    @Autowired
    lateinit var taskService: TaskService

    @Autowired
    lateinit var documentService: DocumentService

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Test
    fun `builds and executes a migration mapping every activity type`() {
        val source = deploy("migration/all-activity-types-v1.bpmn")
        val target = deploy("migration/all-activity-types-v2.bpmn")

        // 1. The build runs Operaton's instruction validators, so a successful build proves every activity-type mapping is accepted.
        val plan = runtimeService.createMigrationPlan(source.id, target.id)
            .mapEqualActivities()
            .mapActivities("registreer_ontvangst", "registreer_ontvangst_v3")
            .mapActivities("markeer_spoed", "markeer_spoed_v3")
            .mapActivities("beoordelen_verhuizing", "beoordelen_verhuizing_v3")
            .mapActivities("afronden", "afronden_v3")
            .mapActivities("script_task", "script_task_v3")
            .mapActivities("business_rule_task", "business_rule_task_v3")
            .mapActivities("send_task", "send_task_v3")
            .mapActivities("manual_task", "manual_task_v3")
            .mapActivities("receive_task", "receive_task_v3")
            .mapActivities("call_activity", "call_activity_v3")
            .build()

        // 2. A running instance whose token rests on the user task must actually migrate.
        // Business key must be a document id — the engine's task-created listeners resolve the case from it.
        val instance = runtimeService.startProcessInstanceById(source.id, createDocumentId())
        assertEquals(
            "beoordelen_verhuizing",
            taskService.createTaskQuery().processInstanceId(instance.id).singleResult().taskDefinitionKey,
        )

        runtimeService.newMigration(plan).processInstanceIds(listOf(instance.id)).execute()

        assertEquals(
            "beoordelen_verhuizing_v3",
            taskService.createTaskQuery().processInstanceId(instance.id).singleResult().taskDefinitionKey,
        )
        assertEquals(
            target.id,
            runtimeService.createProcessInstanceQuery().processInstanceId(instance.id).singleResult().processDefinitionId,
        )
    }

    private fun createDocumentId() = runWithoutAuthorization {
        documentService.createDocument(
            NewDocumentRequest("house", "house", "1.0.0", objectMapper.readTree("""{"street": "aStreet"}"""))
        ).resultingDocument().orElseThrow()
    }.id().toString()

    private fun deploy(resource: String): ProcessDefinition {
        val deployment = repositoryService.createDeployment()
            .addClasspathResource(resource)
            .deploy()
        return repositoryService.createProcessDefinitionQuery()
            .deploymentId(deployment.id)
            .singleResult()
    }
}
