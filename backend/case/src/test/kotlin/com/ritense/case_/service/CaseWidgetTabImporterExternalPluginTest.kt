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

package com.ritense.case_.service

import com.fasterxml.jackson.databind.jsontype.NamedType
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.case_.domain.tab.CaseWidgetTab
import com.ritense.case_.domain.tab.CaseWidgetTabWidget
import com.ritense.case_.repository.CaseWidgetTabRepository
import com.ritense.case_.rest.dto.CaseWidgetTabWidgetDto
import com.ritense.case_.widget.CaseWidgetMapper
import com.ritense.case_.widget.externalplugin.ExternalPluginCaseWidget
import com.ritense.case_.widget.externalplugin.ExternalPluginCaseWidgetDto
import com.ritense.case_.widget.externalplugin.ExternalPluginCaseWidgetMapper
import com.ritense.importer.ImportRequest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.plugin.PluginConfigurationMappingResolver
import jakarta.validation.Validation
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import java.util.UUID

class CaseWidgetTabImporterExternalPluginTest {

    private val objectMapper = jacksonObjectMapper().apply {
        registerSubtypes(NamedType(ExternalPluginCaseWidgetDto::class.java, "external-plugin"))
    }
    private val validator = Validation.buildDefaultValidatorFactory().validator
    private val caseWidgetTabRepository = mock<CaseWidgetTabRepository>()

    @Suppress("UNCHECKED_CAST")
    private val mappers = listOf(ExternalPluginCaseWidgetMapper())
        as List<CaseWidgetMapper<CaseWidgetTabWidget, CaseWidgetTabWidgetDto>>

    private val mappingResolver = mock<PluginConfigurationMappingResolver>()

    private lateinit var importer: CaseWidgetTabImporter

    private val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")

    @BeforeEach
    fun before() {
        importer = CaseWidgetTabImporter(
            objectMapper,
            validator,
            caseWidgetTabRepository,
            mappers,
            listOf(mappingResolver),
        )
    }

    @Test
    fun `import remaps a mapped external-plugin widget configuration id`() {
        val sourceId = UUID.randomUUID()
        val targetId = UUID.randomUUID()

        importer.import(request(json(sourceId), mapOf(sourceId to targetId)))

        val widget = savedExternalPluginWidget()
        assertThat(widget.externalPluginConfigurationId).isEqualTo(targetId)
        assertThat(widget.pluginDefinitionKey).isEqualTo("case-summary")
    }

    @Test
    fun `import leaves an unmapped external-plugin widget dangling on its original id`() {
        val sourceId = UUID.randomUUID()

        importer.import(request(json(sourceId), mapOf(sourceId to null)))

        val widget = savedExternalPluginWidget()
        assertThat(widget.externalPluginConfigurationId).isEqualTo(sourceId)
    }

    @Test
    fun `import leaves the id untouched when no mappings are given`() {
        val sourceId = UUID.randomUUID()

        importer.import(request(json(sourceId), null))

        val widget = savedExternalPluginWidget()
        assertThat(widget.externalPluginConfigurationId).isEqualTo(sourceId)
    }

    @Test
    fun `afterImport rechecks configuration issues for the case definition`() {
        importer.afterImport(request(json(UUID.randomUUID()), null))

        verify(mappingResolver).recheckIssuesForCaseDefinition(caseDefinitionId)
    }

    private fun savedExternalPluginWidget(): ExternalPluginCaseWidget {
        val captor = argumentCaptor<List<CaseWidgetTab>>()
        verify(caseWidgetTabRepository).saveAll(captor.capture())
        return captor.firstValue.single().widgets.single() as ExternalPluginCaseWidget
    }

    private fun request(content: String, mappings: Map<UUID, UUID?>?) = ImportRequest(
        fileName = "config/case/my-case/1-0-0/case/widget-tab/my-case.case-widget-tab.json",
        content = content.toByteArray(),
        caseDefinitionId = caseDefinitionId,
        pluginConfigurationMappings = mappings,
    )

    private fun json(configurationId: UUID) = """
        [
          {
            "key": "widgets-tab",
            "widgets": [
              {
                "type": "external-plugin",
                "key": "summary-widget",
                "title": "Summary",
                "width": 2,
                "highContrast": false,
                "properties": {
                  "configurationId": "$configurationId",
                  "bundleKey": "summary-widget",
                  "pluginDefinitionKey": "case-summary",
                  "pluginDefinitionVersion": "0.1.0"
                }
              }
            ]
          }
        ]
    """.trimIndent()
}
