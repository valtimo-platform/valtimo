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

package com.ritense.processdocument.exporter

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.exporter.request.DocumentDefinitionExportRequest
import com.ritense.exporter.request.ProcessDefinitionExportRequest
import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinitionId
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.skyscreamer.jsonassert.JSONAssert
import org.skyscreamer.jsonassert.JSONCompareMode
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.core.io.ResourceLoader
import org.springframework.core.io.support.ResourcePatternUtils
import org.springframework.transaction.annotation.Transactional
import org.springframework.util.StreamUtils

@Transactional
class ProcessDocumentLinkExporterIntTest @Autowired constructor(
    private val resourceLoader: ResourceLoader,
    private val operatonRepositoryService: OperatonRepositoryService,
    private val processDocumentLinkExporter: ProcessDocumentLinkExporter,
    private val processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository,
    private val entityManager: EntityManager
) : BaseIntegrationTest() {

    @Test
    fun `should export process document links`(): Unit = runWithoutAuthorization {
        val caseDefinitionId = CaseDefinitionId("house", "1.0.0")
        val documentDefinitionName = "house"
        val result = processDocumentLinkExporter.export(DocumentDefinitionExportRequest(documentDefinitionName, caseDefinitionId))

        val exportFile = result.exportFiles.single {
            it.path == PATH.format(documentDefinitionName)
        }

        val exportJson = exportFile.content.toString(Charsets.UTF_8)
        val expectedJson = ResourcePatternUtils.getResourcePatternResolver(resourceLoader)
            .getResource("classpath:${PATH.format(documentDefinitionName)}")
            .inputStream
            .use { inputStream ->
                StreamUtils.copyToString(inputStream, Charsets.UTF_8)
            }
        JSONAssert.assertEquals(
            expectedJson,
            exportJson,
            JSONCompareMode.NON_EXTENSIBLE
        )

        val processDefinitionId = operatonRepositoryService.findLatestProcessDefinition("loan-process-demo")!!.id
        assertThat(result.relatedRequests).contains(
            ProcessDefinitionExportRequest(processDefinitionId, caseDefinitionId)
        )
    }

    @Test
    fun `should skip orphaned process document links during export`(): Unit = runWithoutAuthorization {
        val caseDefinitionId = CaseDefinitionId("house", "1.0.0")
        val documentDefinitionName = "house"

        val orphanedLink = ProcessDefinitionCaseDefinition(
            id = ProcessDefinitionCaseDefinitionId(
                processDefinitionId = ProcessDefinitionId("non-existent-process:1:12345"),
                caseDefinitionId = caseDefinitionId
            ),
            canInitializeDocument = false,
            startableByUser = true
        )
        processDefinitionCaseDefinitionRepository.saveAndFlush(orphanedLink)
        entityManager.clear()

        val result = processDocumentLinkExporter.export(DocumentDefinitionExportRequest(documentDefinitionName, caseDefinitionId))

        val exportFile = result.exportFiles.single {
            it.path == PATH.format(documentDefinitionName)
        }
        val exportJson = exportFile.content.toString(Charsets.UTF_8)

        assertThat(exportJson).doesNotContain("non-existent-process")

        assertThat(result.relatedRequests).noneMatch {
            it is ProcessDefinitionExportRequest && it.processDefinitionId.contains("non-existent-process")
        }
    }

    companion object {
        private const val PATH = "config/case/house/1-0-0/process-document-link/%s.process-document-link.json";
    }
}