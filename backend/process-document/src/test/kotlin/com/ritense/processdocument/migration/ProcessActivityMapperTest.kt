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

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.model.bpmn.Bpmn
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.builder.AbstractFlowNodeBuilder

/** One activity appended to a process being built. */
private typealias Step = (AbstractFlowNodeBuilder<*, *>) -> AbstractFlowNodeBuilder<*, *>

class ProcessActivityMapperTest {

    private lateinit var repositoryService: RepositoryService
    private lateinit var activityValidator: ProcessMigrationActivityValidator
    private lateinit var mapper: ProcessActivityMapper

    @BeforeEach
    fun setUp() {
        repositoryService = mock()
        activityValidator = mock()
        // The engine's own compatibility check is exercised by its own tests; here every pair is
        // accepted so the assertions are about the alignment and nothing else.
        whenever(activityValidator.retainValidActivityMappings(any(), any(), any()))
            .thenAnswer { invocation -> invocation.getArgument<Map<String, String>>(2) }
        mapper = ProcessActivityMapper(repositoryService, activityValidator)
    }

    @Test
    fun `should say nothing about activities that kept their id`() {
        deploy(SOURCE, userTask("beoordelen"), serviceTask("afronden"))
        deploy(TARGET, userTask("beoordelen"), serviceTask("afronden"))

        // The engine's mapEqualActivities() migrates these; mapping them explicitly would double-map.
        assertThat(mapper.suggestActivityMapping(SOURCE, TARGET)).isEmpty()
    }

    @Test
    fun `should pair every activity with its own rename when a version suffixes all of them`() {
        deploy(
            SOURCE,
            serviceTask("registreer_ontvangst"),
            serviceTask("markeer_spoed"),
            userTask("beoordelen_verhuizing"),
            serviceTask("afronden"),
        )
        deploy(
            TARGET,
            serviceTask("registreer_ontvangst_v3"),
            serviceTask("markeer_spoed_v3"),
            userTask("beoordelen_verhuizing_v3"),
            serviceTask("afronden_v3"),
        )

        // Placed by position alone, the three service tasks cross: `markeer_spoed` lands on
        // `registreer_ontvangst_v3` and `afronden` on `markeer_spoed_v3`, silently resuming each token
        // in the wrong task.
        assertThat(mapper.suggestActivityMapping(SOURCE, TARGET)).containsExactlyInAnyOrderEntriesOf(
            mapOf(
                "registreer_ontvangst" to "registreer_ontvangst_v3",
                "markeer_spoed" to "markeer_spoed_v3",
                "beoordelen_verhuizing" to "beoordelen_verhuizing_v3",
                "afronden" to "afronden_v3",
            )
        )
    }

    @Test
    fun `should not let two activities claim the same rename`() {
        deploy(SOURCE, serviceTask("controleren"), serviceTask("controleren_extra"))
        deploy(TARGET, serviceTask("controleren_v2"), serviceTask("afronden_v2"))

        val mapping = mapper.suggestActivityMapping(SOURCE, TARGET)

        assertThat(mapping["controleren"]).isEqualTo("controleren_v2")
        assertThat(mapping["controleren_extra"]).isEqualTo("afronden_v2")
    }

    @Test
    fun `should fall back to the flow position when no name is close enough`() {
        deploy(SOURCE, serviceTask("een"), userTask("twee"))
        deploy(TARGET, serviceTask("alpha"), userTask("beta"))

        // Nothing resembles anything, so the positional rule stands — and the activity type still
        // decides which candidate each one gets.
        assertThat(mapper.suggestActivityMapping(SOURCE, TARGET)).containsExactlyInAnyOrderEntriesOf(
            mapOf("een" to "alpha", "twee" to "beta")
        )
    }

    @Test
    fun `should advance a removed activity to the following surviving anchor`() {
        deploy(SOURCE, serviceTask("voorbereiden"), userTask("beoordelen"), serviceTask("afronden"))
        deploy(SOURCE_TWO, serviceTask("voorbereiden"), serviceTask("afronden"))

        assertThat(mapper.suggestActivityMapping(SOURCE, SOURCE_TWO)).isEqualTo(mapOf("beoordelen" to "afronden"))
    }

    @Test
    fun `should suggest nothing when the target has no activities at all`() {
        deploy(SOURCE, userTask("beoordelen"))
        deploy(TARGET)

        assertThat(mapper.suggestActivityMapping(SOURCE, TARGET)).isEmpty()
    }

    private fun deploy(processDefinitionId: String, vararg activities: Step) {
        whenever(repositoryService.getBpmnModelInstance(eq(processDefinitionId))).thenReturn(model(*activities))
    }

    private fun model(vararg activities: Step): BpmnModelInstance {
        var builder: AbstractFlowNodeBuilder<*, *> = Bpmn.createExecutableProcess("p").startEvent()
        activities.forEach { activity -> builder = activity(builder) }
        return builder.endEvent().done()
    }

    private fun userTask(id: String): Step = { builder -> builder.userTask(id) }

    private fun serviceTask(id: String): Step = { builder -> builder.serviceTask(id) }

    private companion object {
        const val SOURCE = "verhuizing:1:aaa"
        const val SOURCE_TWO = "verhuizing:2:bbb"
        const val TARGET = "verhuizing:3:ccc"
    }
}
