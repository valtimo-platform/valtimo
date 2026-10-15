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

package com.ritense.processlink.importer

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case.service.CaseDefinitionImportService
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportService
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.BaseIntegrationTest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.importer.OperatonProcessDefinitionImporter
import com.ritense.valtimo.service.OperatonProcessService
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.core.io.ByteArrayResource
import org.springframework.core.io.Resource
import org.springframework.transaction.annotation.Transactional
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/**
 * Imports a case definition package over an existing draft version of the same case definition, which is how a
 * case definition is moved from one environment to the next.
 */
@Transactional
class CaseDefinitionProcessImportIntTest @Autowired constructor(
    private val caseDefinitionImportService: CaseDefinitionImportService,
    private val valtimoImportService: ValtimoImportService,
    private val operatonProcessDefinitionImporter: OperatonProcessDefinitionImporter,
    private val operatonProcessService: OperatonProcessService,
    private val processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
    private val caseDefinitionRepository: CaseDefinitionRepository,
    private val repositoryService: RepositoryService,
    private val runtimeService: RuntimeService,
    private val entityManager: EntityManager,
) : BaseIntegrationTest() {

    @Test
    fun `should remove a process from the version when the package no longer contains it`() {
        import(casePackage("process-a", "process-b", "process-c", "process-d"))
        assertThat(processKeys()).containsExactlyInAnyOrder("process-a", "process-b", "process-c", "process-d")

        import(casePackage("process-a", "process-b", "process-c"))

        assertThat(processKeys()).containsExactlyInAnyOrder("process-a", "process-b", "process-c")
    }

    @Test
    fun `should let a running instance of a removed process finish while the version no longer offers it`() {
        import(casePackage("process-a", "process-b", "process-c", "process-d"))
        val removed = definitionId("process-d")
        assertThat(linkedProcessDefinitionIds()).contains(removed)
        val runningInstance = runtimeService.startProcessInstanceById(removed).id

        import(casePackage("process-a", "process-b", "process-c"))

        assertThat(versionTag(removed)).isEqualTo("DETACHED:$CASE_DEFINITION_ID")
        assertThat(linkedProcessDefinitionIds()).doesNotContain(removed)
        assertThat(runtimeService.createProcessInstanceQuery().processInstanceId(runningInstance).singleResult())
            .isNotNull
        // A start arrives in a later request, which does not share this test's persistence context
        entityManager.flush()
        entityManager.clear()
        assertThatThrownBy {
            runWithoutAuthorization { operatonProcessService.startProcessById(removed, "business-key", emptyMap()) }
        }.isInstanceOf(IllegalStateException::class.java)
    }

    @Test
    fun `should keep the processes of the package as they were`() {
        import(casePackage("process-a", "process-b", "process-c"))
        val unchanged = definitionId("process-b")

        import(casePackage("process-a", "process-b", "process-c"))

        assertThat(processKeys()).containsExactlyInAnyOrder("process-a", "process-b", "process-c")
        assertThat(definitionId("process-b")).isEqualTo(unchanged)
    }

    @Test
    fun `should replace a process the package changed and detach its previous definition once`() {
        import(casePackage("process-a", "process-b", "process-c"))
        val previous = definitionId("process-a")
        val unchanged = definitionId("process-b")

        import(
            casePackage(
                mapOf(
                    "process-a.bpmn" to listOf("process-a"),
                    "process-b.bpmn" to listOf("process-b"),
                ),
                changedProcessIds = setOf("process-a"),
            )
        )

        assertThat(processKeys()).containsExactlyInAnyOrder("process-a", "process-b")
        assertThat(definitionId("process-a")).isNotEqualTo(previous)
        assertThat(definitionId("process-b")).isEqualTo(unchanged)
        assertThat(versionTag(previous)).isEqualTo("DETACHED:$CASE_DEFINITION_ID")
    }

    @Test
    fun `should match a process by its id rather than its file name`() {
        import(casePackage(mapOf("renamed-file.bpmn" to listOf("process-a"), "process-b.bpmn" to listOf("process-b"))))
        val process = definitionId("process-a")

        import(casePackage(mapOf("renamed-file.bpmn" to listOf("process-a"))))

        assertThat(processKeys()).containsExactly("process-a")
        assertThat(definitionId("process-a")).isEqualTo(process)
    }

    @Test
    fun `should keep every process of a file that holds several`() {
        import(
            casePackage(
                mapOf(
                    "collaboration.bpmn" to listOf("process-a", "process-b"),
                    "process-c.bpmn" to listOf("process-c"),
                )
            )
        )

        import(casePackage(mapOf("collaboration.bpmn" to listOf("process-a", "process-b"))))

        assertThat(processKeys()).containsExactlyInAnyOrder("process-a", "process-b")
    }

    @Test
    fun `should leave every process definition outside the imported version alone`() {
        val otherVersion = CaseDefinitionId("process-import", "2.0.0")
        import(casePackage(mapOf("process-a.bpmn" to listOf("process-a")), caseDefinitionId = otherVersion))
        import(casePackage("process-a", "process-b", "process-c"))
        val before = definitionsOutsideTheImportedVersion()

        import(casePackage("process-a"))

        assertThat(definitionsOutsideTheImportedVersion()).isEqualTo(before)
        assertThat(processKeys(otherVersion)).containsExactly("process-a")
        assertThat(before.values).anyMatch { it == null }
        assertThat(before.values).anyMatch { it == "CD:autodeploy:1.0.0" }
    }

    @Test
    fun `should change nothing when the version was final before the import`() {
        import(casePackage(caseDefinitionPackageFiles("process-a", "process-b", "process-c"), final = true))

        import(casePackage(caseDefinitionPackageFiles("process-a"), final = true))

        assertThat(processKeys()).containsExactlyInAnyOrder("process-a", "process-b", "process-c")
    }

    @Test
    fun `should finalise the version with exactly the processes of a final package`() {
        import(casePackage("process-a", "process-b", "process-c", "process-d"))

        import(casePackage(caseDefinitionPackageFiles("process-a", "process-b", "process-c"), final = true))

        assertThat(caseDefinitionRepository.findById(CASE_DEFINITION_ID).get().final).isTrue()
        assertThat(processKeys()).containsExactlyInAnyOrder("process-a", "process-b", "process-c")
    }

    @Test
    fun `should leave the processes alone when the package holds no process`() {
        import(casePackage("process-a", "process-b"))

        import(casePackage(emptyMap()))

        assertThat(processKeys()).containsExactlyInAnyOrder("process-a", "process-b")
    }

    @Test
    fun `should remove a process from a version deployed from configuration once its file is gone`() {
        autodeploy(casePackage("process-a", "process-b", "process-c", "process-d"))

        autodeploy(casePackage("process-a", "process-b", "process-c"))

        assertThat(processKeys()).containsExactlyInAnyOrder("process-a", "process-b", "process-c")
    }

    @Test
    fun `should detach nothing when a process file is imported outside an import run`() {
        import(casePackage("process-a", "process-b"))

        runWithoutAuthorization {
            operatonProcessDefinitionImporter.import(
                ImportRequest("/bpmn/process-a.bpmn", bpmn(listOf("process-a")).toByteArray(), CASE_DEFINITION_ID)
            )
        }

        assertThat(processKeys()).containsExactlyInAnyOrder("process-a", "process-b")
    }

    private fun import(casePackage: ByteArray) {
        runWithoutAuthorization {
            caseDefinitionImportService.import(ByteArrayInputStream(casePackage))
        }
    }

    // Unpacks a package into the paths autodeploy reads from config/case/<key>/<version>/
    private fun autodeploy(casePackage: ByteArray) {
        val root = "config/case/${CASE_DEFINITION_ID.key}/${CASE_DEFINITION_ID.versionTag}"
        val resources = ZipInputStream(ByteArrayInputStream(casePackage)).use { zip ->
            generateSequence { zip.nextEntry }
                .map { entry -> entry.name.removePrefix(root) to (ByteArrayResource(zip.readBytes()) as Resource) }
                .toList()
        }
        runWithoutAuthorization {
            valtimoImportService.importCaseDefinition(resources, emptyList())
        }
    }

    private fun definitionId(processKey: String, caseDefinitionId: CaseDefinitionId = CASE_DEFINITION_ID): String {
        return runWithoutAuthorization {
            operatonProcessService.getDefinitionsByKeyAndBlueprint(caseDefinitionId, processKey).single().id
        }
    }

    private fun versionTag(processDefinitionId: String): String? {
        return repositoryService.createProcessDefinitionQuery().processDefinitionId(processDefinitionId).singleResult()
            ?.versionTag
    }

    private fun linkedProcessDefinitionIds(): List<String> {
        return runWithoutAuthorization {
            processDefinitionCaseDefinitionService.findProcessDefinitionCaseDefinitions(CASE_DEFINITION_ID)
                .map { it.id.processDefinitionId.id }
        }
    }

    private fun definitionsOutsideTheImportedVersion(): Map<String, String?> {
        return repositoryService.createProcessDefinitionQuery().list()
            .filterNot { it.versionTag?.endsWith(CASE_DEFINITION_ID.toString()) == true }
            .associate { it.id to it.versionTag }
    }

    private fun processKeys(caseDefinitionId: CaseDefinitionId = CASE_DEFINITION_ID): List<String> {
        return runWithoutAuthorization {
            operatonProcessService.getAllDefinitions(caseDefinitionId).map { it.key }
        }
    }

    private fun casePackage(vararg processKeys: String): ByteArray {
        return casePackage(caseDefinitionPackageFiles(*processKeys))
    }

    private fun caseDefinitionPackageFiles(vararg processKeys: String): Map<String, List<String>> {
        return processKeys.associate { "$it.bpmn" to listOf(it) }
    }

    private fun casePackage(
        bpmnFiles: Map<String, List<String>>,
        final: Boolean = false,
        caseDefinitionId: CaseDefinitionId = CASE_DEFINITION_ID,
        changedProcessIds: Set<String> = emptySet(),
    ): ByteArray {
        val root = "config/case/${caseDefinitionId.key}/${caseDefinitionId.versionTag}"
        val output = ByteArrayOutputStream()
        ZipOutputStream(output).use { zip ->
            zip.putNextEntry(ZipEntry("$root/case/definition/${caseDefinitionId.key}.case-definition.json"))
            zip.write(
                """
                {
                    "key": "${caseDefinitionId.key}",
                    "name": "Process import",
                    "versionTag": "${caseDefinitionId.versionTag}",
                    "final": $final
                }
                """.trimIndent().toByteArray()
            )
            zip.closeEntry()
            bpmnFiles.forEach { (fileName, processIds) ->
                zip.putNextEntry(ZipEntry("$root/bpmn/$fileName"))
                zip.write(bpmn(processIds, changedProcessIds).toByteArray())
                zip.closeEntry()
            }
        }
        return output.toByteArray()
    }

    private fun bpmn(processIds: List<String>, changedProcessIds: Set<String> = emptySet()): String {
        val processes = processIds.joinToString("\n") { processId ->
            val name = if (processId in changedProcessIds) "$processId, changed" else processId
            """
            <process id="$processId" name="$name" isExecutable="true">
                <startEvent id="$processId-start" />
                <sequenceFlow id="$processId-to-task" sourceRef="$processId-start" targetRef="$processId-task" />
                <receiveTask id="$processId-task" />
                <sequenceFlow id="$processId-to-end" sourceRef="$processId-task" targetRef="$processId-end" />
                <endEvent id="$processId-end" />
            </process>
            """.trimIndent()
        }
        return """
            <?xml version="1.0" encoding="UTF-8"?>
            <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
                         id="definitions"
                         targetNamespace="http://bpmn.io/schema/bpmn">
        """.trimIndent() + "\n$processes\n</definitions>"
    }

    private companion object {
        val CASE_DEFINITION_ID = CaseDefinitionId("process-import", "1.0.0")
    }
}
