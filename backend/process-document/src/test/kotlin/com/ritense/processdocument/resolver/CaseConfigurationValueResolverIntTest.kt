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

package com.ritense.processdocument.resolver

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case_.caseconfiguration.service.CaseConfigurationService
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valueresolver.ValueResolverOptionRequest
import com.ritense.valueresolver.ValueResolverOptionType
import com.ritense.valueresolver.ValueResolverService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.annotation.Transactional

@Transactional
class CaseConfigurationValueResolverIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var processDocumentService: ProcessDocumentService

    @Autowired
    lateinit var documentService: DocumentService

    @Autowired
    lateinit var valueResolverService: ValueResolverService

    @Autowired
    lateinit var caseConfigurationService: CaseConfigurationService

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [AuthoritiesConstants.USER])
    fun `should resolve the default in a BPMN expression when no environment value is set`() {
        assertThat(startProcessAndReadDocument()).isEqualTo("test@example.com")
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [AuthoritiesConstants.USER])
    fun `should resolve the environment value in a BPMN expression when one is set`() {
        runWithoutAuthorization {
            caseConfigurationService.setEnvironmentValue(CASE_DEFINITION_ID, "notificationEmail", "afdeling@example.com")
        }

        assertThat(startProcessAndReadDocument()).isEqualTo("afdeling@example.com")
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [AuthoritiesConstants.USER])
    fun `should resolve configuration for a document id`() {
        val documentId = startProcessAndGetDocumentId()
        runWithoutAuthorization {
            caseConfigurationService.setEnvironmentValue(CASE_DEFINITION_ID, "mailProvider", "api")
        }

        val values = valueResolverService.resolveValues(documentId, listOf("config:mailProvider", "config:notificationEmail"))

        assertThat(values).containsEntry("config:mailProvider", "api")
        assertThat(values).containsEntry("config:notificationEmail", "test@example.com")
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [AuthoritiesConstants.USER])
    fun `should fail naming key and case definition for an undeclared key`() {
        val documentId = startProcessAndGetDocumentId()

        val exception = assertThrows<RuntimeException> {
            valueResolverService.resolveValues(documentId, listOf("config:missingKey"))
        }

        assertThat(generateSequence(exception as Throwable) { it.cause }.mapNotNull { it.message }.joinToString())
            .contains("missingKey")
            .contains("case-configuration:1.0.0")
    }

    @Test
    fun `should offer the declared keys as resolvable options`() {
        val request = ValueResolverOptionRequest(listOf("config"), type = ValueResolverOptionType.FIELD)

        assertThat(valueResolverService.getResolvableKeys(request, CASE_DEFINITION_ID).map { it.path })
            .containsExactly("config:mailProvider", "config:notificationEmail")
        assertThat(valueResolverService.getResolvableKeys(request, "case-configuration").map { it.path })
            .containsExactly("config:mailProvider", "config:notificationEmail")
    }

    private fun startProcessAndReadDocument(): String {
        val documentId = startProcessAndGetDocumentId()
        return runWithoutAuthorization {
            documentService.get(documentId)
        }.content().asJson().get("notificationEmail").asText()
    }

    private fun startProcessAndGetDocumentId(): String {
        val result = runWithoutAuthorization {
            processDocumentService.newDocumentAndStartProcess(
                NewDocumentAndStartProcessRequest(
                    "case-configuration-process",
                    NewDocumentRequest("case-configuration", "case-configuration", "1.0.0", objectMapper.createObjectNode())
                )
            )
        }
        assertThat(result.errors()).isEmpty()
        return result.resultingDocument().get().id().toString()
    }

    private companion object {
        val CASE_DEFINITION_ID = CaseDefinitionId.of("case-configuration", "1.0.0")
    }
}
