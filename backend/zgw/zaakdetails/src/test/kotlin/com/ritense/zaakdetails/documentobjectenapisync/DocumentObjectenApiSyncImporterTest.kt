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

package com.ritense.zaakdetails.documentobjectenapisync

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.importer.ImportRequest
import com.ritense.objectmanagement.repository.ObjectManagementRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseConfigurationIssueDetectedEvent
import com.ritense.valtimo.contract.event.CaseConfigurationIssueResolvedEvent
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationEventPublisher
import java.util.UUID

class DocumentObjectenApiSyncImporterTest {

    lateinit var documentObjectenApiSyncRepository: DocumentObjectenApiSyncRepository
    lateinit var applicationEventPublisher: ApplicationEventPublisher
    lateinit var objectManagementRepository: ObjectManagementRepository
    lateinit var importer: DocumentObjectenApiSyncImporter

    private val caseDefinitionId = CaseDefinitionId("test-case", "1.0.0")
    private val objectMapper = jacksonObjectMapper()
    private val objectManagementConfigId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        documentObjectenApiSyncRepository = mock()
        applicationEventPublisher = mock()
        objectManagementRepository = mock()
        importer = DocumentObjectenApiSyncImporter(
            objectMapper,
            documentObjectenApiSyncRepository,
            applicationEventPublisher,
            objectManagementRepository
        )
    }

    @Test
    fun `should be of type zgwzaakdetailsync`() {
        assertThat(importer.type()).isEqualTo("zgwzaakdetailsync")
    }

    @Test
    fun `should depend on documentdefinition`() {
        assertThat(importer.dependsOn()).contains("documentdefinition", "objectmanagement")
    }

    @Test
    fun `should support matching filename`() {
        assertThat(importer.supports(FILENAME)).isTrue()
    }

    @Test
    fun `should not support non-matching filename`() {
        assertThat(importer.supports("/some/other/file.json")).isFalse()
    }

    @Test
    fun `import should publish detected event and set objectManagementId to null when config does not exist`() {
        whenever(objectManagementRepository.existsById(objectManagementConfigId)).thenReturn(false)
        whenever(documentObjectenApiSyncRepository.findByCaseDefinitionId(caseDefinitionId)).thenReturn(null)
        whenever(documentObjectenApiSyncRepository.save(any<DocumentObjectenApiSync>())).thenAnswer { it.getArgument(0) }

        val jsonContent = """
            {
                "objectManagementConfigurationId": "$objectManagementConfigId",
                "enabled": true
            }
        """.trimIndent()

        importer.import(ImportRequest(FILENAME, jsonContent.toByteArray(), caseDefinitionId))

        val syncCaptor = argumentCaptor<DocumentObjectenApiSync>()
        verify(documentObjectenApiSyncRepository).save(syncCaptor.capture())
        assertThat(syncCaptor.firstValue.objectManagementConfigurationId).isNull()

        val eventCaptor = argumentCaptor<CaseConfigurationIssueDetectedEvent>()
        verify(applicationEventPublisher).publishEvent(eventCaptor.capture())
        assertThat(eventCaptor.firstValue.caseDefinitionId).isEqualTo(caseDefinitionId)
        assertThat(eventCaptor.firstValue.issueType).isEqualTo("zaakdetail-sync")
    }

    @Test
    fun `import should publish resolved event and preserve objectManagementId when config exists`() {
        whenever(objectManagementRepository.existsById(objectManagementConfigId)).thenReturn(true)
        whenever(documentObjectenApiSyncRepository.findByCaseDefinitionId(caseDefinitionId)).thenReturn(null)
        whenever(documentObjectenApiSyncRepository.save(any<DocumentObjectenApiSync>())).thenAnswer { it.getArgument(0) }

        val jsonContent = """
            {
                "objectManagementConfigurationId": "$objectManagementConfigId",
                "enabled": true
            }
        """.trimIndent()

        importer.import(ImportRequest(FILENAME, jsonContent.toByteArray(), caseDefinitionId))

        val syncCaptor = argumentCaptor<DocumentObjectenApiSync>()
        verify(documentObjectenApiSyncRepository).save(syncCaptor.capture())
        assertThat(syncCaptor.firstValue.objectManagementConfigurationId).isEqualTo(objectManagementConfigId)

        val eventCaptor = argumentCaptor<CaseConfigurationIssueResolvedEvent>()
        verify(applicationEventPublisher).publishEvent(eventCaptor.capture())
        assertThat(eventCaptor.firstValue.caseDefinitionId).isEqualTo(caseDefinitionId)
        assertThat(eventCaptor.firstValue.issueType).isEqualTo("zaakdetail-sync")
    }

    @Test
    fun `import should update existing sync when one already exists`() {
        val existingSync = DocumentObjectenApiSync(
            caseDefinitionId = caseDefinitionId,
            objectManagementConfigurationId = UUID.randomUUID(),
            enabled = false
        )
        whenever(objectManagementRepository.existsById(objectManagementConfigId)).thenReturn(true)
        whenever(documentObjectenApiSyncRepository.findByCaseDefinitionId(caseDefinitionId)).thenReturn(existingSync)
        whenever(documentObjectenApiSyncRepository.save(any<DocumentObjectenApiSync>())).thenAnswer { it.getArgument(0) }

        val jsonContent = """
            {
                "objectManagementConfigurationId": "$objectManagementConfigId",
                "enabled": true
            }
        """.trimIndent()

        importer.import(ImportRequest(FILENAME, jsonContent.toByteArray(), caseDefinitionId))

        val syncCaptor = argumentCaptor<DocumentObjectenApiSync>()
        verify(documentObjectenApiSyncRepository).save(syncCaptor.capture())
        assertThat(syncCaptor.firstValue.id).isEqualTo(existingSync.id)
        assertThat(syncCaptor.firstValue.objectManagementConfigurationId).isEqualTo(objectManagementConfigId)
        assertThat(syncCaptor.firstValue.enabled).isTrue()
    }

    private companion object {
        const val FILENAME = "/zgw/zaakdetail-sync/test-case.zaakdetail-sync.json"
    }
}
