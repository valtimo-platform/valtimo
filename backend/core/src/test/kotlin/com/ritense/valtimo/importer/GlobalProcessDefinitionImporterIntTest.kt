/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.valtimo.importer

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.importer.ImportRequest
import com.ritense.valtimo.BaseIntegrationTest
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.exception.FileExtensionNotSupportedException
import com.ritense.valtimo.service.OperatonProcessService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.ProcessDefinition
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Value
import org.springframework.core.io.Resource
import java.io.ByteArrayInputStream

class GlobalProcessDefinitionImporterIntTest @Autowired constructor(
    private val processDefinitionImporter: GlobalProcessDefinitionImporter,
    private val operatonProcessService: OperatonProcessService,
    private val repositoryService: RepositoryService,
    @Value("classpath:examples/bpmn/shouldDeploy.bpmn")
    private val processDefinition: Resource,
    @Value("classpath:examples/bpmn/shouldDeploy.bpmn")
    private val processDefinitionAsXml: Resource
) : BaseIntegrationTest() {
    @Test
    fun `should import process definition with bpmn extension`() {
        val validPath = "/global/bpmn/shouldDeploy.bpmn"
        val request = processDefinition.inputStream.use {
            ImportRequest(validPath, it.readAllBytes())
        }

        runWithoutAuthorization {
            processDefinitionImporter.import(request)
        }
        val storedDefinition = runWithoutAuthorization {
            operatonProcessService.getProcessDefinition("deployedProcess")
        }
        assertThat(storedDefinition).isNotNull
    }

    @Test
    fun `should not import process definition with xml extension`() {
        val validPath = "/global/bpmn/shouldDeploy.xml"
        val request = processDefinition.inputStream.use {
            ImportRequest(validPath, it.readAllBytes())
        }

        assertThrows(FileExtensionNotSupportedException::class.java) {
            runWithoutAuthorization {
                processDefinitionImporter.import(request)
            }
        }
    }

    @Test
    fun `should not import an unchanged configuration file over a version deployed in the application`() {
        val key = "configurationProcessChangedInApplication"
        importFromConfiguration(key, bpmn(key, FROM_CONFIGURATION))
        deployInApplication(key, bpmn(key, CHANGED_IN_APPLICATION))

        importFromConfiguration(key, bpmn(key, FROM_CONFIGURATION))

        assertThat(deployedVersionsOf(key)).hasSize(2)
        assertThat(latestVersionOf(key).name).isEqualTo(CHANGED_IN_APPLICATION)
    }

    @Test
    fun `should import a configuration file that changed over a version deployed in the application`() {
        val key = "configurationProcessThatChanged"
        importFromConfiguration(key, bpmn(key, FROM_CONFIGURATION))
        deployInApplication(key, bpmn(key, CHANGED_IN_APPLICATION))

        importFromConfiguration(key, bpmn(key, CHANGED_IN_CONFIGURATION))

        assertThat(deployedVersionsOf(key)).hasSize(3)
        assertThat(latestVersionOf(key).name).isEqualTo(CHANGED_IN_CONFIGURATION)
    }

    @Test
    fun `should import content deployed in an earlier version when it does not come from configuration`() {
        val key = "importedProcessDeployedBefore"
        importFromConfiguration(key, bpmn(key, FROM_CONFIGURATION))
        deployInApplication(key, bpmn(key, CHANGED_IN_APPLICATION))

        // An import someone triggered, of content that was deployed before, is a deliberate roll back to it
        runWithoutAuthorization {
            processDefinitionImporter.import(
                ImportRequest("/global/bpmn/$key.bpmn", bpmn(key, FROM_CONFIGURATION))
            )
        }

        assertThat(deployedVersionsOf(key)).hasSize(3)
        assertThat(latestVersionOf(key).name).isEqualTo(FROM_CONFIGURATION)
    }

    @Test
    fun `should import a configuration file when a building block deployed the same process key`() {
        val key = "processKeySharedWithBuildingBlock"
        deployInBuildingBlock(key, bpmn(key, IN_BUILDING_BLOCK))

        importFromConfiguration(key, bpmn(key, FROM_CONFIGURATION))

        assertThat(deployedVersionsOf(key)).hasSize(2)
        assertThat(globalVersionsOf(key)).hasSize(1)
        assertThat(globalVersionsOf(key).single().name).isEqualTo(FROM_CONFIGURATION)
    }

    private fun importFromConfiguration(key: String, bpmn: ByteArray) {
        runWithoutAuthorization {
            processDefinitionImporter.import(
                ImportRequest("/global/bpmn/$key.bpmn", bpmn, fromConfiguration = true)
            )
        }
    }

    private fun deployInApplication(key: String, bpmn: ByteArray) {
        runWithoutAuthorization {
            operatonProcessService.deploy(null, "$key.bpmn", ByteArrayInputStream(bpmn), false, true)
        }
    }

    private fun deployInBuildingBlock(key: String, bpmn: ByteArray) {
        runWithoutAuthorization {
            operatonProcessService.deploy(
                BuildingBlockDefinitionId(key, "1.0.0"),
                "$key.bpmn",
                ByteArrayInputStream(bpmn),
                false,
                true
            )
        }
    }

    private fun deployedVersionsOf(key: String): List<ProcessDefinition> =
        repositoryService.createProcessDefinitionQuery().processDefinitionKey(key).list()

    private fun globalVersionsOf(key: String): List<ProcessDefinition> =
        deployedVersionsOf(key).filter { it.versionTag == null }

    private fun latestVersionOf(key: String): ProcessDefinition =
        repositoryService.createProcessDefinitionQuery().processDefinitionKey(key).latestVersion().singleResult()

    private fun bpmn(key: String, name: String): ByteArray =
        processDefinition.inputStream.use { String(it.readAllBytes()) }
            .replace("deployedProcess", key)
            .replace("""<bpmn:process id="$key" """, """<bpmn:process id="$key" name="$name" """)
            .toByteArray()

    private companion object {
        const val FROM_CONFIGURATION = "From configuration"
        const val CHANGED_IN_APPLICATION = "Changed in the application"
        const val CHANGED_IN_CONFIGURATION = "Changed in the configuration"
        const val IN_BUILDING_BLOCK = "In a building block"
    }
}
