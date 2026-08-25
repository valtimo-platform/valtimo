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

package com.ritense.valtimo.exporter

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.exporter.ExportService
import com.ritense.exporter.request.GlobalProcessDefinitionExportRequest
import com.ritense.valtimo.BaseIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.io.ByteArrayInputStream
import java.util.zip.ZipInputStream

@Transactional
class GlobalProcessDefinitionExporterIntTest @Autowired constructor(
    private val exportService: ExportService,
    private val repositoryService: RepositoryService,
) : BaseIntegrationTest() {

    @Test
    fun `should include the referenced dmn when bundled in the same deployment`(): Unit = runWithoutAuthorization {
        repositoryService.createDeployment()
            .addClasspathResource("config/global/dmn/dmn-global-sample.dmn")
            .addClasspathResource("config/global/bpmn/dmn-global-sample.bpmn")
            .deploy()

        assertExportContainsDmn()
    }

    @Test
    fun `should include the referenced dmn when deployed separately from the process`(): Unit = runWithoutAuthorization {
        repositoryService.createDeployment()
            .addClasspathResource("config/global/dmn/dmn-global-sample.dmn")
            .deploy()
        repositoryService.createDeployment()
            .addClasspathResource("config/global/bpmn/dmn-global-sample.bpmn")
            .deploy()

        assertExportContainsDmn()
    }

    private fun assertExportContainsDmn() {
        val processDefinitionId = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey("dmn-global-sample")
            .latestVersion()
            .singleResult()
            .id

        val entries = readZipEntryNames(
            exportService.export(GlobalProcessDefinitionExportRequest(processDefinitionId)).toByteArray()
        )

        assertThat(entries).contains("config/global/bpmn/dmn-global-sample.bpmn")
        assertThat(entries).contains("config/global/dmn/dmn-global-sample.dmn")
    }

    private fun readZipEntryNames(bytes: ByteArray): Set<String> {
        val names = mutableSetOf<String>()
        ZipInputStream(ByteArrayInputStream(bytes)).use { zis ->
            var entry = zis.nextEntry
            while (entry != null) {
                names.add(entry.name)
                entry = zis.nextEntry
            }
        }
        return names
    }
}
