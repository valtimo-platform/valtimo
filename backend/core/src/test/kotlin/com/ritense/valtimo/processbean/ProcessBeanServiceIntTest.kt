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

package com.ritense.valtimo.processbean

import com.ritense.valtimo.BaseIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

class ProcessBeanServiceIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var processBeanService: ProcessBeanService

    @Test
    fun `should discover process beans annotated on Bean methods`() {
        val processBeans = processBeanService.getProcessBeans()

        assertThat(processBeans).isNotEmpty

        // Verify some known process beans are discovered
        val beanNames = processBeans.map { it.name }
        assertThat(beanNames).contains("jobService")
        assertThat(beanNames).contains("timerService")
    }

    @Test
    fun `should get specific process bean by name`() {
        val jobServiceBean = processBeanService.getProcessBean("jobService")

        assertThat(jobServiceBean).isNotNull
        assertThat(jobServiceBean!!.name).isEqualTo("jobService")
        assertThat(jobServiceBean.methods).isNotEmpty
    }

    @Test
    fun `should return null for unknown bean`() {
        val unknownBean = processBeanService.getProcessBean("nonExistentBean")

        assertThat(unknownBean).isNull()
    }
}
