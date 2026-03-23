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

package com.ritense.zakenapi.importer

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.importer.ImportRequest
import com.ritense.plugin.repository.PluginConfigurationRepository
import com.ritense.processdocument.importer.ZaakTypeLinkImporter
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseConfigurationIssueDetectedEvent
import com.ritense.valtimo.contract.event.CaseConfigurationIssueResolvedEvent
import com.ritense.zakenapi.domain.ZaakTypeLink
import com.ritense.zakenapi.service.ZaakTypeLinkService
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

class ZaakTypeLinkImporterTest {

    lateinit var zaakTypeLinkService: ZaakTypeLinkService
    lateinit var applicationEventPublisher: ApplicationEventPublisher
    lateinit var pluginConfigurationRepository: PluginConfigurationRepository
    lateinit var importer: ZaakTypeLinkImporter

    private val caseDefinitionId = CaseDefinitionId("test-case", "1.0.0")
    private val objectMapper: ObjectMapper = jacksonObjectMapper()
    private val pluginConfigId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        zaakTypeLinkService = mock()
        applicationEventPublisher = mock()
        pluginConfigurationRepository = mock()
        importer = ZaakTypeLinkImporter(
            objectMapper,
            zaakTypeLinkService,
            applicationEventPublisher,
            pluginConfigurationRepository
        )
        whenever(zaakTypeLinkService.createZaakTypeLink(any(), any())).thenReturn(mock<ZaakTypeLink>())
    }

    @Test
    fun `should be of type zgwzaaktypelink`() {
        assertThat(importer.type()).isEqualTo("zgwzaaktypelink")
    }

    @Test
    fun `should depend on documentdefinition`() {
        assertThat(importer.dependsOn()).contains("documentdefinition")
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
    fun `import should publish CaseConfigurationIssueDetectedEvent when plugin config does not exist`() {
        whenever(pluginConfigurationRepository.existsById(any())).thenReturn(false)

        val jsonContent = """
            {
                "zaakTypeUrl": "http://example.com/zaaktype",
                "zakenApiPluginConfigurationId": "$pluginConfigId"
            }
        """.trimIndent()

        importer.import(ImportRequest(FILENAME, jsonContent.toByteArray(), caseDefinitionId))

        val captor = argumentCaptor<CaseConfigurationIssueDetectedEvent>()
        verify(applicationEventPublisher).publishEvent(captor.capture())
        assertThat(captor.firstValue.caseDefinitionId).isEqualTo(caseDefinitionId)
        assertThat(captor.firstValue.issueType).isEqualTo("zaak-type-link")
    }

    @Test
    fun `import should publish CaseConfigurationIssueResolvedEvent when plugin config exists`() {
        whenever(pluginConfigurationRepository.existsById(any())).thenReturn(true)

        val jsonContent = """
            {
                "zaakTypeUrl": "http://example.com/zaaktype",
                "zakenApiPluginConfigurationId": "$pluginConfigId"
            }
        """.trimIndent()

        importer.import(ImportRequest(FILENAME, jsonContent.toByteArray(), caseDefinitionId))

        val captor = argumentCaptor<CaseConfigurationIssueResolvedEvent>()
        verify(applicationEventPublisher).publishEvent(captor.capture())
        assertThat(captor.firstValue.caseDefinitionId).isEqualTo(caseDefinitionId)
        assertThat(captor.firstValue.issueType).isEqualTo("zaak-type-link")
    }

    @Test
    fun `import should publish CaseConfigurationIssueResolvedEvent when plugin config id is null`() {
        val jsonContent = """
            {
                "zaakTypeUrl": "http://example.com/zaaktype"
            }
        """.trimIndent()

        importer.import(ImportRequest(FILENAME, jsonContent.toByteArray(), caseDefinitionId))

        val captor = argumentCaptor<CaseConfigurationIssueResolvedEvent>()
        verify(applicationEventPublisher).publishEvent(captor.capture())
        assertThat(captor.firstValue.caseDefinitionId).isEqualTo(caseDefinitionId)
        assertThat(captor.firstValue.issueType).isEqualTo("zaak-type-link")
    }

    private companion object {
        const val FILENAME = "/zgw/zaak-type-link/test-case.zaak-type-link.json"
    }
}
