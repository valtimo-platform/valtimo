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

import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.operaton.bpm.engine.ProcessEngine
import org.operaton.bpm.engine.ProcessEngineConfiguration
import org.operaton.bpm.engine.repository.ProcessDefinition

/**
 * Proves that the process-migration feature can migrate a running process instance across **every**
 * BPMN activity type — the exact plan build (`mapEqualActivities()` + explicit `mapActivities`) and
 * synchronous `execute()` that [ProcessMigrationComponentExecutor] performs, run against a real
 * (standalone, in-memory) Operaton engine.
 *
 * The two fixtures (`all-activity-types-v{1,2}.bpmn`) each contain one of every activity type:
 * service / user / script / business-rule / send / receive / manual tasks, a call activity, an
 * embedded sub-process, timer/message/signal intermediate catch events, a boundary event, and
 * exclusive/parallel/inclusive/event-based gateways. Following the engine's rules, the leaf activity
 * nodes are renamed between versions (so they flow through explicit `mapActivities`) while the
 * gateways, events and the sub-process scope keep their ids (handled by `mapEqualActivities()`).
 *
 * These fixtures are the source (verhuizing 1.0.2) and target (verhuizing 1.0.3) processes used by
 * the dev-app case-migration POC scaffold under `config/case/verhuizing/1-0-{2,3}`.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AllActivityTypesMigrationEngineTest {

    private lateinit var engine: ProcessEngine

    @BeforeAll
    fun setUp() {
        engine = ProcessEngineConfiguration
            .createStandaloneInMemProcessEngineConfiguration()
            .setProcessEngineName("all-activity-types-migration")
            .setJdbcUrl("jdbc:h2:mem:all-activity-types-migration;DB_CLOSE_DELAY=-1")
            .setJobExecutorActivate(false)
            .buildProcessEngine()
    }

    @AfterAll
    fun tearDown() {
        engine.close()
    }

    @Test
    fun `builds and executes a migration mapping every activity type`() {
        val repositoryService = engine.repositoryService
        val runtimeService = engine.runtimeService
        val taskService = engine.taskService

        val source = deploy("migration/all-activity-types-v1.bpmn")
        val target = deploy("migration/all-activity-types-v2.bpmn")

        // 1. The plan that maps every renamed activity type must BUILD. The build runs Operaton's
        //    instruction validators, so a successful build proves each activity-type mapping is
        //    accepted by the engine (a rejected mapping throws MigrationPlanValidationException).
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
        val instance = runtimeService.startProcessInstanceById(source.id)
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

    private fun deploy(resource: String): ProcessDefinition {
        val deployment = engine.repositoryService.createDeployment()
            .addClasspathResource(resource)
            .deploy()
        return engine.repositoryService.createProcessDefinitionQuery()
            .deploymentId(deployment.id)
            .singleResult()
    }
}
