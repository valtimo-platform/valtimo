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

package com.ritense.processdocument.importer

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case.service.CaseDefinitionService
import com.ritense.exporter.ExportService
import com.ritense.exporter.request.CaseDefinitionExportRequest
import com.ritense.importer.ImportService
import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.springframework.beans.factory.annotation.Autowired

class ProcessDocumentLinkRoundTripIntTest @Autowired constructor(
    private val exportService: ExportService,
    private val importService: ImportService,
    private val operatonRepositoryService: OperatonRepositoryService,
    private val repositoryService: RepositoryService,
    private val caseDefinitionService: CaseDefinitionService,
) : BaseIntegrationTest() {

    @Test
    fun `should preserve process settings when exporting and importing a case definition`() {
        val source = CaseDefinitionId.of("notahouse", "1.0.0")

        // a process saved as a draft is kept suspended, which is only visible on the deployed definition
        val draftProcessDefinitionId = processDefinitionIdOf(source, "loan-process-demo-2")
        repositoryService.suspendProcessDefinitionById(draftProcessDefinitionId)

        var imported: CaseDefinitionId? = null
        try {
            imported = exportAndImport(source, "notahouse-copy")

            assertThat(settingsByProcessDefinitionKey(imported))
                .isEqualTo(settingsByProcessDefinitionKey(source))
                .containsEntry("loan-process-demo-2", ProcessSettings(startableByUser = true, canInitializeDocument = true, draft = true))
        } finally {
            // the case definitions are shared between integration tests, so leave no traces behind
            repositoryService.activateProcessDefinitionById(draftProcessDefinitionId)
            imported?.let { runWithoutAuthorization { caseDefinitionService.deleteCaseDefinition(it) } }
        }
    }

    private fun exportAndImport(source: CaseDefinitionId, keyOverride: String): CaseDefinitionId {
        val zip = runWithoutAuthorization {
            exportService.export(CaseDefinitionExportRequest(source)).toByteArray()
        }
        return runWithoutAuthorization {
            importService.import(zip.inputStream(), emptyList(), keyOverride, keyOverride, null)
        } ?: error("Import of case definition '$source' did not return a case definition id")
    }

    private fun processDefinitionIdOf(caseDefinitionId: CaseDefinitionId, processDefinitionKey: String) =
        runWithoutAuthorization {
            processDefinitionCaseDefinitionService.findProcessDefinitionCaseDefinitions(caseDefinitionId)
                .single { it.processDefinitionKey == processDefinitionKey }
                .id.processDefinitionId.id
        }

    private fun settingsByProcessDefinitionKey(caseDefinitionId: CaseDefinitionId) = runWithoutAuthorization {
        processDefinitionCaseDefinitionService.findProcessDefinitionCaseDefinitions(caseDefinitionId)
            .associate { link ->
                link.processDefinitionKey!! to ProcessSettings(
                    startableByUser = link.startableByUser,
                    canInitializeDocument = link.canInitializeDocument,
                    draft = operatonRepositoryService.findProcessDefinitionById(link.id.processDefinitionId.id)!!
                        .isSuspended()
                )
            }
    }

    private data class ProcessSettings(
        val startableByUser: Boolean,
        val canInitializeDocument: Boolean,
        val draft: Boolean,
    )
}
