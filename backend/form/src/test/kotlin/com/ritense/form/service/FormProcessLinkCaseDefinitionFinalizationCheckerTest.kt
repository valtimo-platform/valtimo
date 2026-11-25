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

package com.ritense.form.service

import com.ritense.form.repository.FormProcessLinkRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.service.OperatonProcessService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class FormProcessLinkCaseDefinitionFinalizationCheckerTest {

    private lateinit var operatonProcessService: OperatonProcessService
    private lateinit var formProcessLinkRepository: FormProcessLinkRepository
    private lateinit var checker: FormProcessLinkCaseDefinitionFinalizationChecker

    private val caseDefinitionId = CaseDefinitionId.of("person", "1.0.0")

    @BeforeEach
    fun setUp() {
        operatonProcessService = mock()
        formProcessLinkRepository = mock()
        checker = FormProcessLinkCaseDefinitionFinalizationChecker(operatonProcessService, formProcessLinkRepository)
    }

    @Test
    fun `should not be finalizable when a process link points to a missing form`() {
        givenProcessDefinitions("process:1:abc")
        whenever(formProcessLinkRepository.existsDanglingByProcessDefinitionIdIn(listOf("process:1:abc")))
            .thenReturn(true)

        val result = checker.check(caseDefinitionId)

        assertThat(result.finalizable).isFalse()
        assertThat(result.code).isEqualTo("PROCESS_LINK_FORM_MISSING")
    }

    @Test
    fun `should be finalizable when all process links point to existing forms`() {
        givenProcessDefinitions("process:1:abc")
        whenever(formProcessLinkRepository.existsDanglingByProcessDefinitionIdIn(listOf("process:1:abc")))
            .thenReturn(false)

        val result = checker.check(caseDefinitionId)

        assertThat(result.finalizable).isTrue()
        assertThat(result.code).isEqualTo("OK")
    }

    @Test
    fun `should be finalizable without querying when the case has no processes`() {
        givenProcessDefinitions()

        val result = checker.check(caseDefinitionId)

        assertThat(result.finalizable).isTrue()
        verify(formProcessLinkRepository, never()).existsDanglingByProcessDefinitionIdIn(org.mockito.kotlin.any())
    }

    private fun givenProcessDefinitions(vararg ids: String) {
        val definitions = ids.map { id ->
            mock<OperatonProcessDefinition>().also { whenever(it.id).thenReturn(id) }
        }
        whenever(operatonProcessService.getAllDefinitions(caseDefinitionId)).thenReturn(definitions)
    }
}
