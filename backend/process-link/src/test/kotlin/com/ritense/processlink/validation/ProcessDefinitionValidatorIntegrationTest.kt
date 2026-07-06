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

package com.ritense.processlink.validation

import com.ritense.processlink.BaseIntegrationTest
import com.ritense.valtimo.contract.annotation.ProcessBean
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.model.bpmn.Bpmn
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import

@Import(ProcessDefinitionValidatorIntegrationTest.TestProcessBeanConfig::class)
class ProcessDefinitionValidatorIntegrationTest : BaseIntegrationTest() {

    @Autowired
    lateinit var processDefinitionValidator: ProcessDefinitionValidator

    @Test
    fun `should have process beans injected`() {
        val bpmnModel = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .serviceTask("task1")
            .operatonExpression("\${testProcessBean.doSomething()}")
            .endEvent()
            .done()

        val result = processDefinitionValidator.validate(bpmnModel, emptyList())

        assertThat(result.errors).noneMatch {
            it.errorCode == ExpressionValidationErrorCode.BEAN_NOT_FOUND.name
        }
    }

    @Test
    fun `should report error for non-existent bean`() {
        val bpmnModel = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .serviceTask("task1")
            .operatonExpression("\${nonExistentBean.doSomething()}")
            .endEvent()
            .done()

        val result = processDefinitionValidator.validate(bpmnModel, emptyList())

        assertThat(result.errors).anyMatch {
            it.errorCode == ExpressionValidationErrorCode.BEAN_NOT_FOUND.name &&
                it.expression == "\${nonExistentBean.doSomething()}"
        }
    }

    @TestConfiguration
    class TestProcessBeanConfig {
        @ProcessBean
        @Bean
        fun testProcessBean(): TestProcessBeanService = TestProcessBeanService()
    }

    class TestProcessBeanService {
        fun doSomething(): String = "done"
    }
}
