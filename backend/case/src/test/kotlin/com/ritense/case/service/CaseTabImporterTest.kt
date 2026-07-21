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

package com.ritense.case.service

import com.ritense.case.domain.CaseTab
import com.ritense.case.domain.CaseTabId
import com.ritense.case.domain.CaseTabType
import com.ritense.case.repository.CaseTabRepository
import com.ritense.case_.service.event.CaseTabCreatedEvent
import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportTypes.Companion.DOCUMENT_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.FORM
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationEventPublisher
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class CaseTabImporterTest(
    @Mock private val caseTabRepository: CaseTabRepository,
) {
    private val objectMapper = MapperSingleton.get()
    private lateinit var applicationEventPublisher: ApplicationEventPublisher
    private lateinit var importer: CaseTabImporter

    @BeforeEach
    fun before() {
        applicationEventPublisher = mock()
        importer = CaseTabImporter(objectMapper, caseTabRepository, applicationEventPublisher)
        whenever(caseTabRepository.save(any())).thenAnswer { it.arguments[0] }
    }

    @Test
    fun `should be of type 'casetab'`() {
        assertThat(importer.type()).isEqualTo("casetab")
    }

    @Test
    fun `should depend on 'documentdefinition' and 'form' type`() {
        assertThat(importer.dependsOn()).isEqualTo(setOf(DOCUMENT_DEFINITION))
    }

    @Test
    fun `should support caseTab fileName`() {
        assertThat(importer.supports(FILENAME)).isTrue()
    }

    @Test
    fun `should not support non-caseTab fileName`() {
        assertThat(importer.supports("/case/tab/x/test.case-tab.json")).isFalse()
        assertThat(importer.supports("/case/tab/test.case-tab-json")).isFalse()
    }

    @Test
    fun `should remap the config id embedded in the contentKey of an EXTERNAL_PLUGIN tab`() {
        val sourceConfigId = UUID.randomUUID()
        val targetConfigId = UUID.randomUUID()
        val content = """
            [
              {
                "key": "summary",
                "name": "Summary",
                "type": "external_plugin",
                "contentKey": "$sourceConfigId:overview",
                "showTasks": false
              }
            ]
        """.trimIndent()

        val request = ImportRequest(
            fileName = FILENAME,
            content = content.toByteArray(Charsets.UTF_8),
            caseDefinitionId = CASE_DEFINITION_ID,
            pluginConfigurationMappings = mapOf(sourceConfigId to targetConfigId),
        )

        importer.import(request)

        val captor = argumentCaptor<CaseTab>()
        verify(caseTabRepository).save(captor.capture())
        assertThat(captor.firstValue.contentKey).isEqualTo("$targetConfigId:overview")
    }

    @Test
    fun `should leave the contentKey unchanged when no mapping applies`() {
        val sourceConfigId = UUID.randomUUID()
        val content = """
            [
              {
                "key": "summary",
                "name": "Summary",
                "type": "external_plugin",
                "contentKey": "$sourceConfigId",
                "showTasks": false
              }
            ]
        """.trimIndent()

        val request = ImportRequest(
            fileName = FILENAME,
            content = content.toByteArray(Charsets.UTF_8),
            caseDefinitionId = CASE_DEFINITION_ID,
            pluginConfigurationMappings = null,
        )

        importer.import(request)

        val captor = argumentCaptor<CaseTab>()
        verify(caseTabRepository).save(captor.capture())
        assertThat(captor.firstValue.contentKey).isEqualTo(sourceConfigId.toString())
    }

    @Test
    fun `should publish CaseTabCreatedEvent for imported EXTERNAL_PLUGIN tabs so the side row gets created`() {
        val configId = UUID.randomUUID()
        val content = """
            [
              {
                "key": "summary",
                "name": "Summary",
                "type": "external_plugin",
                "contentKey": "$configId",
                "showTasks": false
              }
            ]
        """.trimIndent()

        val request = ImportRequest(
            fileName = FILENAME,
            content = content.toByteArray(Charsets.UTF_8),
            caseDefinitionId = CASE_DEFINITION_ID,
        )

        importer.import(request)

        val captor = argumentCaptor<CaseTabCreatedEvent>()
        verify(applicationEventPublisher).publishEvent(captor.capture())
        assertThat(captor.firstValue.tab.contentKey).isEqualTo(configId.toString())
        assertThat(captor.firstValue.tab.type).isEqualTo(CaseTabType.EXTERNAL_PLUGIN)
    }

    @Test
    fun `should not publish CaseTabCreatedEvent for non-EXTERNAL_PLUGIN tabs`() {
        val content = """
            [
              {
                "key": "widgets",
                "name": "Widgets",
                "type": "widgets",
                "contentKey": "widgets-tab",
                "showTasks": false
              }
            ]
        """.trimIndent()

        val request = ImportRequest(
            fileName = FILENAME,
            content = content.toByteArray(Charsets.UTF_8),
            caseDefinitionId = CASE_DEFINITION_ID,
        )

        importer.import(request)

        verify(applicationEventPublisher, never()).publishEvent(any<CaseTabCreatedEvent>())
    }

    private companion object {
        const val FILENAME = "/case/tab/my-doc-def.case-tab.json"
        val CASE_DEFINITION_ID: CaseDefinitionId = CaseDefinitionId.of("my-doc-def", "1.0.0")
    }
}
