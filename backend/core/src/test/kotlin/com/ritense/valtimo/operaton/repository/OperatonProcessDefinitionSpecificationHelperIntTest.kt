package com.ritense.valtimo.operaton.repository

import com.ritense.valtimo.BaseIntegrationTest
import org.assertj.core.api.Assertions
import org.operaton.bpm.engine.RepositoryService
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

class OperatonProcessDefinitionSpecificationHelperIntTest @Autowired constructor(
    private val definitionRepository: OperatonProcessDefinitionRepository,
    private val repositoryService: RepositoryService
) : BaseIntegrationTest() {

    @Test
    @Transactional
    fun byId() {
        val processDefinition = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(USER_TASK_PROCESS)
            .latestVersion()
            .singleResult()

        val result = definitionRepository.findOne(
                OperatonProcessDefinitionSpecificationHelper.byId(processDefinition.id)
        ).get()
        Assertions.assertThat(result.key).isEqualTo(USER_TASK_PROCESS)
    }

    @Test
    @Transactional
    fun byKey() {
        val processDefinitionIds = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(USER_TASK_PROCESS)
            .list()
            .map { it.id }

        val result = definitionRepository.findAll(
            OperatonProcessDefinitionSpecificationHelper.byKey(USER_TASK_PROCESS)
        ).map { it.id }

        Assertions.assertThat(result).containsAll(processDefinitionIds)
    }

    @Test
    @Transactional
    fun byVersion() {
        val deployedProcessDefinition = repositoryService.createDeployment()
            .addClasspathResource("config/case/everything/1-0-0/bpmn/$USER_TASK_PROCESS.bpmn")
            .deployWithResult()
            .deployedProcessDefinitions.first()

        val version1Id = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(USER_TASK_PROCESS)
            .processDefinitionVersion(1)
            .singleResult().id

        val resultIds = definitionRepository.findAll(
            OperatonProcessDefinitionSpecificationHelper.byKey(USER_TASK_PROCESS)
                .and(OperatonProcessDefinitionSpecificationHelper.byVersion(2))
        ).map { it.id }

        Assertions.assertThat(resultIds).contains(deployedProcessDefinition.id)
        Assertions.assertThat(resultIds).doesNotContain(version1Id)
    }

    @Test
    @Transactional
    fun byLatestVersion() {
        val deployedProcessDefinition = repositoryService.createDeployment()
            .addClasspathResource("config/case/everything/1-0-0/bpmn/$USER_TASK_PROCESS.bpmn")
            .deployWithResult()
            .deployedProcessDefinitions.first()

        val version1Id = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(USER_TASK_PROCESS)
            .processDefinitionVersion(1)
            .singleResult().id

        val resultIds = definitionRepository.findAll(
            OperatonProcessDefinitionSpecificationHelper.byKey(USER_TASK_PROCESS)
                .and(OperatonProcessDefinitionSpecificationHelper.byLatestVersion())
        ).map { it.id }

        Assertions.assertThat(resultIds).contains(deployedProcessDefinition.id)
        Assertions.assertThat(resultIds).doesNotContain(version1Id)
    }

    @Test
    @Transactional
    fun byActive() {
        val deployedProcessDefinition = repositoryService.createDeployment()
            .addClasspathResource("config/case/everything/1-0-0/bpmn/$USER_TASK_PROCESS.bpmn")
            .deployWithResult()
            .deployedProcessDefinitions.first()

        val version1Id = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(USER_TASK_PROCESS)
            .processDefinitionVersion(1)
            .singleResult().id

        repositoryService.suspendProcessDefinitionById(version1Id)

        val resultIds = definitionRepository.findAll(
            OperatonProcessDefinitionSpecificationHelper.byKey(USER_TASK_PROCESS)
                .and(OperatonProcessDefinitionSpecificationHelper.byActive())
        ).map { it.id }

        Assertions.assertThat(resultIds).contains(deployedProcessDefinition.id)
        Assertions.assertThat(resultIds).doesNotContain(version1Id)
    }

    @Test
    @Transactional
    fun `unlinked spec should prefer an untagged definition over a higher versioned building block one`() {
        // Version 1 of this key is deployed by the case fixture and therefore carries a CD: version tag,
        // so deploy two more: one that stays untagged and a higher one standing in for a building block.
        val untaggedId = deployUserTaskProcess()
        val buildingBlockDefinitionId = deployUserTaskProcess()
        definitionRepository.setVersionTag(buildingBlockDefinitionId, "BB:bezwaar:1.0.1")

        val resultIds = definitionRepository.findAll(byKeyOfUnlinkedProcess(USER_TASK_PROCESS)).map { it.id }

        Assertions.assertThat(resultIds).containsExactly(untaggedId)
        Assertions.assertThat(resultIds).doesNotContain(buildingBlockDefinitionId)
    }

    private fun deployUserTaskProcess(): String {
        return repositoryService.createDeployment()
            .addClasspathResource("config/case/everything/1-0-0/bpmn/$USER_TASK_PROCESS.bpmn")
            .deployWithResult()
            .deployedProcessDefinitions.first()
            .id
    }

    @Test
    @Transactional
    fun `unlinked spec should match nothing when every version of the key belongs to a building block`() {
        repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(USER_TASK_PROCESS)
            .list()
            .forEach { definitionRepository.setVersionTag(it.id, "BB:bezwaar:1.0.0") }

        val resultIds = definitionRepository.findAll(byKeyOfUnlinkedProcess(USER_TASK_PROCESS)).map { it.id }

        Assertions.assertThat(resultIds).isEmpty()
    }

    /**
     * Mirrors the specification OperatonProcessService uses to resolve a process definition from its key
     * alone. Blueprint-owned definitions must never match, because every blueprint version redeploys the
     * same key under a new engine version and so cannot be told apart by key.
     */
    private fun byKeyOfUnlinkedProcess(processDefinitionKey: String) =
        OperatonProcessDefinitionSpecificationHelper.byNotLinkedToCaseDefinition()
            .and(OperatonProcessDefinitionSpecificationHelper.byNotLinkedToBuildingBlock())
            .let { unlinked ->
                OperatonProcessDefinitionSpecificationHelper.byKey(processDefinitionKey)
                    .and(unlinked)
                    .and(OperatonProcessDefinitionSpecificationHelper.maxVersionOf(unlinked))
            }

    companion object {
        const val USER_TASK_PROCESS = "user-task-process"
    }
}