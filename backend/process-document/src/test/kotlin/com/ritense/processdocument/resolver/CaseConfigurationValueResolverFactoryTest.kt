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

import com.ritense.case_.caseconfiguration.domain.CaseConfigurationDeclaration
import com.ritense.case_.caseconfiguration.domain.CaseConfigurationDeclarationId
import com.ritense.case_.caseconfiguration.service.CaseConfigurationService
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateTask
import java.util.UUID

class CaseConfigurationValueResolverFactoryTest {

    private val caseDefinitionId = CaseDefinitionId.of("mail-case", "1.0.0")

    private lateinit var processDocumentService: ProcessDocumentService
    private lateinit var documentService: DocumentService
    private lateinit var caseConfigurationService: CaseConfigurationService
    private lateinit var resolver: CaseConfigurationValueResolverFactory
    private lateinit var document: Document

    @BeforeEach
    fun setUp() {
        processDocumentService = mock()
        documentService = mock()
        caseConfigurationService = mock()
        resolver = CaseConfigurationValueResolverFactory(processDocumentService, documentService, caseConfigurationService)
        document = mock()
        whenever(document.definitionId()).thenReturn(JsonSchemaDocumentDefinitionId.existingId("mail-case", caseDefinitionId))
    }

    @Test
    fun `should have config prefix`() {
        assertThat(resolver.supportedPrefix()).isEqualTo("config")
    }

    @Test
    fun `should resolve a key for the case document of a process instance`() {
        val processInstanceId = UUID.randomUUID().toString()
        val variableScope: DelegateTask = mock()
        whenever(processDocumentService.getCaseDocument(OperatonProcessInstanceId(processInstanceId), variableScope)).thenReturn(document)
        whenever(caseConfigurationService.resolveValue(caseDefinitionId, "notificationEmail")).thenReturn("afdeling@example.com")

        val result = resolver.createResolver(processInstanceId, variableScope).apply("notificationEmail")

        assertThat(result).isEqualTo("afdeling@example.com")
    }

    @Test
    fun `should resolve a key for a document id`() {
        val documentId = UUID.randomUUID().toString()
        whenever(documentService.get(documentId)).thenReturn(document)
        whenever(caseConfigurationService.resolveValue(caseDefinitionId, "mailProvider")).thenReturn("smtp")

        assertThat(resolver.createResolver(documentId).apply("mailProvider")).isEqualTo("smtp")
    }

    @Test
    fun `should offer the declared keys`() {
        whenever(caseConfigurationService.getDeclarations(caseDefinitionId)).thenReturn(
            listOf(CaseConfigurationDeclaration(CaseConfigurationDeclarationId(caseDefinitionId, "notificationEmail"), null))
        )
        whenever(caseConfigurationService.getDeclaredKeys("mail-case")).thenReturn(listOf("mailProvider", "notificationEmail"))

        assertThat(resolver.getResolvableKeyOptions(caseDefinitionId).map { it.path }).containsExactly("config:notificationEmail")
        assertThat(resolver.getResolvableKeyOptions("mail-case").map { it.path })
            .containsExactly("config:mailProvider", "config:notificationEmail")
    }

    @Test
    fun `should refuse writing values`() {
        assertThrows<UnsupportedOperationException> {
            resolver.handleValues(UUID.randomUUID(), mapOf("notificationEmail" to "x"))
        }
    }
}
