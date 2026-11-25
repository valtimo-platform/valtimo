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

package com.ritense.externalplugin.service

import net.javacrumbs.shedlock.spring.annotation.SchedulerLock
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.springframework.scheduling.annotation.Scheduled
import java.lang.reflect.Modifier

/** Same CGLIB/ShedLock pitfalls as [ExternalPluginDiscoveryJobTest]: pinned, because they fail silently. */
class ExternalPluginContractJobDispatchJobTest {

    private val dispatchMethod = ExternalPluginContractJobDispatchJob::class.java.getDeclaredMethod("dispatch")

    @Test
    fun `dispatch delegates to the dispatcher`() {
        val dispatcher = mock<ExternalPluginContractJobDispatcher>()

        ExternalPluginContractJobDispatchJob(dispatcher).dispatch()

        verify(dispatcher).dispatch()
    }

    @Test
    fun `class and method stay open for the ShedLock proxy`() {
        assertThat(Modifier.isFinal(ExternalPluginContractJobDispatchJob::class.java.modifiers)).isFalse()
        assertThat(Modifier.isFinal(dispatchMethod.modifiers)).isFalse()
    }

    @Test
    fun `scheduled on the configurable interval under a named lock`() {
        assertThat(dispatchMethod.getAnnotation(Scheduled::class.java).fixedDelayString)
            .isEqualTo("\${valtimo.external-plugin.contract-job.dispatch-interval:PT5S}")
        val lock = dispatchMethod.getAnnotation(SchedulerLock::class.java)
        assertThat(lock.name).isEqualTo("ExternalPluginContractJobDispatchJob_dispatch")
        assertThat(lock.lockAtMostFor).isEqualTo("PT10M")
    }
}
