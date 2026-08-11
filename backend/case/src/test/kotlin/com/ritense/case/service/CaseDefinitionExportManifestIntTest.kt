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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.BaseIntegrationTest
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.exporter.ExportService
import com.ritense.exporter.manifest.ExportManifest
import com.ritense.exporter.request.CaseDefinitionExportRequest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.io.ByteArrayInputStream
import java.util.zip.ZipInputStream

class CaseDefinitionExportManifestIntTest @Autowired constructor(
    private val exportService: ExportService,
    private val objectMapper: ObjectMapper,
    private val caseDefinitionRepository: CaseDefinitionRepository,
) : BaseIntegrationTest() {

    @Test
    fun `should include an export manifest describing the exported case definition`(): Unit = runWithoutAuthorization {
        val caseDefinitionKey = "manifest-case-type"
        val caseDefinitionVersionTag = "1.0.0"
        val caseDefinitionId = CaseDefinitionId.of(caseDefinitionKey, caseDefinitionVersionTag)

        caseDefinitionRepository.save(caseDefinition(id = caseDefinitionId, name = "Manifest case type"))

        val bytes = exportService.export(CaseDefinitionExportRequest(caseDefinitionId)).toByteArray()

        val manifestContent = ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
            generateSequence { zip.nextEntry }
                .firstOrNull { it.name == ExportManifest.MANIFEST_FILE_NAME }
                ?.let { zip.readBytes() }
        }
        requireNotNull(manifestContent) { "Expected ${ExportManifest.MANIFEST_FILE_NAME} in the export ZIP" }

        val expectedPath = "config/case/$caseDefinitionKey/1-0-0/case/definition/$caseDefinitionKey.case-definition.json"
        val artifact = objectMapper.readTree(manifestContent).path("artifacts").single()
        assertThat(artifact.path("type").asText()).isEqualTo("CASE_DEFINITION")
        assertThat(artifact.path("artifactVersionTag").path("\$ref").asText()).isEqualTo("$expectedPath#/versionTag")
        assertThat(artifact.path("title").path("\$ref").asText()).isEqualTo("$expectedPath#/name")
        assertThat(artifact.has("valtimoVersion")).isTrue()
        assertThat(artifact.path("dependencies").isArray).isTrue()
    }
}
