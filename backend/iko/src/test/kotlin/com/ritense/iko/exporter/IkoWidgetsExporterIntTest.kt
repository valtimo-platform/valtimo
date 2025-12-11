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

package com.ritense.iko.exporter

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.iko.BaseIntegrationTest
import org.junit.jupiter.api.Test
import org.skyscreamer.jsonassert.JSONAssert
import org.skyscreamer.jsonassert.JSONCompareMode
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.core.io.ResourceLoader
import org.springframework.transaction.annotation.Transactional

@Transactional(readOnly = true)
class IkoWidgetsExporterIntTest @Autowired constructor(
    private val objectMapper: ObjectMapper,
    private val resourceLoader: ResourceLoader,
    private val ikoWidgetsExporter: IkoWidgetsExporter
) : BaseIntegrationTest() {

    @Test
    fun `should export ikoWidgets`(): Unit = runWithoutAuthorization {
        val ikoViewKey = "klant"
        val ikoTabKey = "general"
        val request = IkoWidgetsExportRequest(ikoViewKey, ikoTabKey)

        val exportFiles = ikoWidgetsExporter.export(request).exportFiles
        val expectedPath = IkoWidgetsExporter.PATH.format(ikoViewKey, ikoTabKey)
        val exportedFile = exportFiles.singleOrNull { it.path == expectedPath }
            ?: error("Exported file not found for path: $expectedPath")

        val actualJson = objectMapper.readTree(exportedFile.content)
        val expectedJson = resourceLoader
            .getResource("classpath:$expectedPath")
            .inputStream
            .bufferedReader(Charsets.UTF_8)
            .use { it.readText() }

        JSONAssert.assertEquals(
            expectedJson,
            objectMapper.writeValueAsString(actualJson),
            JSONCompareMode.NON_EXTENSIBLE
        )
    }
}
