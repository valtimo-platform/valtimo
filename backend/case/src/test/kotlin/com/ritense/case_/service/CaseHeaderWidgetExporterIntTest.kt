/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.BaseIntegrationTest
import com.ritense.authorization.AuthorizationContext
import com.ritense.exporter.request.DocumentDefinitionExportRequest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.junit.jupiter.api.Test
import org.skyscreamer.jsonassert.JSONAssert
import org.skyscreamer.jsonassert.JSONCompareMode
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.core.io.ResourceLoader
import org.springframework.core.io.support.ResourcePatternUtils
import org.springframework.transaction.annotation.Transactional
import org.springframework.util.StreamUtils

@Transactional(readOnly = true)
class CaseHeaderWidgetExporterIntTest @Autowired constructor(
    private val objectMapper: ObjectMapper,
    private val resourceLoader: ResourceLoader,
    private val exporter: CaseHeaderWidgetExporter
) : BaseIntegrationTest() {

    @Test
    fun `should export header widget for case definition`(): Unit = AuthorizationContext.runWithoutAuthorization {
        val caseDefinitionName = "some-other-case-type"

        val request = DocumentDefinitionExportRequest(
            caseDefinitionName,
            CaseDefinitionId("some-other-case-type", "1.1.1")
        )
        val exportResult = exporter.export(request)

        val path = PATH.format(caseDefinitionName, "1-1-1", caseDefinitionName)
        val headerExport = exportResult.exportFiles.singleOrNull { it.path == path }
        requireNotNull(headerExport)

        val exportJson = objectMapper.readTree(headerExport.content)

        val expectedJson = ResourcePatternUtils.getResourcePatternResolver(resourceLoader)
            .getResource("classpath:config/case/$caseDefinitionName/1-1-1/case/header-widget/some-header-widget.case-header-widget.json")
            .inputStream
            .use { inputStream ->
                StreamUtils.copyToString(inputStream, Charsets.UTF_8)
            }

        JSONAssert.assertEquals(
            expectedJson,
            objectMapper.writeValueAsString(exportJson),
            JSONCompareMode.LENIENT
        )
    }

    companion object {
        private const val PATH = "config/case/%s/%s/case/header-widget/%s.case-header-widget.json"
    }
}