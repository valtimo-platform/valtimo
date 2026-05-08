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

package com.ritense.processdocument.service

import com.fasterxml.jackson.core.JsonProcessingException
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.JsonDocumentContent
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.document.service.result.CreateDocumentResult
import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.processdocument.domain.CaseTask
import com.ritense.processdocument.domain.impl.request.StartProcessForDocumentRequest
import com.ritense.processdocument.tasksearch.AdvancedSearchRequest
import com.ritense.processdocument.tasksearch.SearchWithConfigRequest
import com.ritense.search.domain.DataType
import com.ritense.search.domain.FieldType
import com.ritense.search.domain.SearchFieldMatchType
import com.ritense.search.service.SearchFieldV2Service
import com.ritense.search.web.rest.dto.SearchFieldV2Dto
import com.ritense.valtimo.contract.Constants
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants
import com.ritense.valtimo.service.OperatonTaskService
import com.ritense.valtimo.task.domain.TaskTeam
import com.ritense.valtimo.task.repository.TaskTeamRepository
import com.ritense.team.repository.TeamRepository
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
class CaseTaskListSearchServiceIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var caseTaskListSearchService: CaseTaskListSearchService

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var documentService: DocumentService

    @Autowired
    lateinit var searchFieldV2Service: SearchFieldV2Service

    @Autowired
    lateinit var taskTeamRepository: TaskTeamRepository

    @Autowired
    lateinit var teamRepository: TeamRepository

    @Autowired
    lateinit var entityManager: EntityManager

    private var definition: JsonSchemaDocumentDefinition? = null

    private var originalDocument: CreateDocumentResult? = null

    @BeforeEach
    fun init() {
        definition = definition()
        val content = JsonDocumentContent("{\"street\": \"Funenpark\", \"houseNumber\": 1, \"isEnrolled\": \"yes\"}")

        originalDocument = runWithoutAuthorization<CreateDocumentResult> {
            val result: CreateDocumentResult = documentService.createDocument(
                NewDocumentRequest(
                    definition!!.id().name(),
                    definition!!.id.caseDefinitionId().key,
                    definition!!.id.caseDefinitionId().versionTag.version,
                    content.asJson()
                )
            )
            result
        }

        val content2 = JsonDocumentContent("{\"street\": \"Kalverstraat\"}")

        runWithoutAuthorization<CreateDocumentResult> {
            val result: CreateDocumentResult = documentService.createDocument(
                NewDocumentRequest(
                    definition!!.id().name(),
                    definition!!.id.caseDefinitionId().key,
                    definition!!.id.caseDefinitionId().versionTag.version,
                    content2.asJson()
                )
            )
            result
        }

        searchFieldV2Service.create(
            SearchFieldV2Dto(
                id = UUID.randomUUID(),
                ownerId = definition!!.id!!.name(),
                ownerType = SEARCH_FIELD_OWNER_TYPE,
                key = "street",
                title = "Street",
                path = "doc:street",
                order = 1,
                dataType = DataType.TEXT,
                fieldType = FieldType.TEXT_CONTAINS,
                matchType = SearchFieldMatchType.LIKE,
                dropdownDataProvider = null
            )
        )

        searchFieldV2Service.create(
            SearchFieldV2Dto(
                id = UUID.randomUUID(),
                ownerId = definition!!.id!!.name(),
                ownerType = SEARCH_FIELD_OWNER_TYPE,
                key = "number",
                title = "House number",
                path = "doc:houseNumber",
                order = 1,
                dataType = DataType.NUMBER,
                fieldType = FieldType.RANGE,
                matchType = null,
                dropdownDataProvider = null
            )
        )

        searchFieldV2Service.create(
            SearchFieldV2Dto(
                id = UUID.randomUUID(),
                ownerId = definition!!.id!!.name(),
                ownerType = SEARCH_FIELD_OWNER_TYPE,
                key = "caseCreatedBy",
                title = "Case created by",
                path = "case:createdBy",
                order = 1,
                dataType = DataType.TEXT,
                fieldType = FieldType.SINGLE,
                matchType = SearchFieldMatchType.EXACT,
                dropdownDataProvider = null
            )
        )

        searchFieldV2Service.create(
            SearchFieldV2Dto(
                id = UUID.randomUUID(),
                ownerId = definition!!.id!!.name(),
                ownerType = SEARCH_FIELD_OWNER_TYPE,
                key = "taskName",
                title = "Task name",
                path = "task:name",
                order = 1,
                dataType = DataType.TEXT,
                fieldType = FieldType.SINGLE,
                matchType = SearchFieldMatchType.EXACT,
                dropdownDataProvider = null
            )
        )

        runWithoutAuthorization {
            operatonProcessJsonSchemaDocumentService.startProcessForDocument(
                StartProcessForDocumentRequest(
                    originalDocument!!.resultingDocument().orElseThrow().id(),
                    "loan-process-demo",
                    mapOf()
                )
            )
        }
    }

    @Test
    @Throws(JsonProcessingException::class)
    fun shouldFindTaskByStreet() {
        val filter = SearchWithConfigRequest.SearchWithConfigFilter()
        filter.key = "street"
        filter.setValues(listOf("Funenpark"))

        val searchResult = searchTasks(filter)
        assertThat(searchResult).hasSize(1)

        val matchedResult = searchResult!!.content[0]
        assertThat(matchedResult.name).isEqualTo("Akkoord op lening?")
    }

    @Test
    @Throws(JsonProcessingException::class)
    fun shouldNotFindTaskByStreet() {
        val filter = SearchWithConfigRequest.SearchWithConfigFilter()
        filter.key = "street"
        filter.setValues(listOf("Herengracht"))

        val searchResult = searchTasks(filter)
        assertThat(searchResult).isEmpty()
    }

    @Test
    @Throws(JsonProcessingException::class)
    fun shouldFindTaskByCaseDefinitionName() {
        val filter = SearchWithConfigRequest.SearchWithConfigFilter()
        filter.key = "caseCreatedBy"
        filter.setValues(listOf(Constants.SYSTEM_ACCOUNT))

        val searchResult = searchTasks(filter)
        assertThat(searchResult).hasSize(1)

        val matchedResult = searchResult!!.content[0]
        assertThat(matchedResult.name).isEqualTo("Akkoord op lening?")
    }

    @Test
    @Throws(JsonProcessingException::class)
    fun shouldNotFindTaskByCaseDefinitionName() {
        val filter = SearchWithConfigRequest.SearchWithConfigFilter()
        filter.key = "caseCreatedBy"
        filter.setValues(listOf("!${Constants.SYSTEM_ACCOUNT}"))

        val searchResult = searchTasks(filter)
        assertThat(searchResult).isEmpty()
    }

    @Test
    @Throws(JsonProcessingException::class)
    fun shouldFindTaskByTaskName() {
        val filter = SearchWithConfigRequest.SearchWithConfigFilter()
        filter.key = "taskName"
        filter.setValues(listOf("Akkoord op lening?"))

        val searchResult = searchTasks(filter)
        assertThat(searchResult).hasSize(1)

        val matchedResult = searchResult!!.content[0]
        assertThat(matchedResult.name).isEqualTo("Akkoord op lening?")
    }

    @Test
    @Throws(JsonProcessingException::class)
    fun shouldNotFindTaskByTaskName() {
        val filter = SearchWithConfigRequest.SearchWithConfigFilter()
        filter.key = "taskName"
        filter.setValues(listOf("!Akkoord op lening?"))

        val searchResult = searchTasks(filter)
        assertThat(searchResult).isEmpty()
    }

    @Test
    @Throws(JsonProcessingException::class)
    fun shouldFindTaskByHouseNumberRange() {
        val filter = SearchWithConfigRequest.SearchWithConfigFilter()
        filter.key = "number"
        filter.setRangeFrom(0)
        filter.setRangeTo(10)

        val searchResult = searchTasks(filter)
        assertThat(searchResult).hasSize(1)

        val matchedResult = searchResult!!.content[0]
        assertThat(matchedResult.name).isEqualTo("Akkoord op lening?")
    }

    @Test
    @Throws(JsonProcessingException::class)
    fun shouldNotFindTaskByHouseNumberRange() {
        val filter = SearchWithConfigRequest.SearchWithConfigFilter()
        filter.key = "number"
        filter.setRangeFrom(10)
        filter.setRangeTo(20)

        val searchResult = searchTasks(filter)
        assertThat(searchResult).hasSize(0)
    }

    @Test
    @Throws(JsonProcessingException::class)
    @WithMockUser(username = "user@ritense.com", authorities = [AuthoritiesConstants.USER, "ROLE_HOUSE_OWNER"])
    fun shouldNotFindInaccessibleTasks() {
        val museumDefinition = definition("museum")
        val content = JsonDocumentContent("{\"street\": \"Funenpark\", \"houseNumber\": 1, \"isEnrolled\": \"yes\"}")

        val museumDocument = runWithoutAuthorization<CreateDocumentResult> {
            val result: CreateDocumentResult = documentService.createDocument(
                NewDocumentRequest(
                    museumDefinition!!.id().name(),
                    museumDefinition!!.id.caseDefinitionId().key,
                    museumDefinition!!.id.caseDefinitionId().versionTag.version,
                    content.asJson()
                )
            )
            result
        }

        runWithoutAuthorization {
            operatonProcessJsonSchemaDocumentService.startProcessForDocument(
                StartProcessForDocumentRequest(
                    museumDocument.resultingDocument().orElseThrow().id(),
                    "conditional-candidate-group",
                    mapOf("candidateGroup" to "ROLE_HOUSE_OWNER")
                )
            )
        }

        runWithoutAuthorization {
            operatonProcessJsonSchemaDocumentService.startProcessForDocument(
                StartProcessForDocumentRequest(
                    museumDocument.resultingDocument().orElseThrow().id(),
                    "conditional-candidate-group",
                    mapOf("candidateGroup" to "ROLE_HOUSE_OWNER")
                )
            )
        }

        runWithoutAuthorization {
            operatonProcessJsonSchemaDocumentService.startProcessForDocument(
                StartProcessForDocumentRequest(
                    museumDocument.resultingDocument().orElseThrow().id(),
                    "conditional-candidate-group",
                    mapOf("candidateGroup" to "ROLE_ADMIN")
                )
            )
        }

        searchFieldV2Service.create(
            SearchFieldV2Dto(
                id = UUID.randomUUID(),
                ownerId = museumDefinition.id!!.name(),
                ownerType = SEARCH_FIELD_OWNER_TYPE,
                key = "hideInaccessibleTasks",
                title = "Hide inaccessible tasks",
                path = "task:hideInaccessibleTasks",
                order = 1,
                dataType = DataType.BOOLEAN,
                fieldType = FieldType.SINGLE,
                matchType = SearchFieldMatchType.EXACT,
                dropdownDataProvider = null
            )
        )

        val filter = SearchWithConfigRequest.SearchWithConfigFilter()
        filter.key = "hideInaccessibleTasks"
        filter.setValues(listOf(true))

        val searchWithConfigRequest = SearchWithConfigRequest()
        searchWithConfigRequest.otherFilters = listOf(filter)

        val searchResult = caseTaskListSearchService.search("museum", searchWithConfigRequest, PageRequest.of(0, 50))

        assertThat(searchResult).hasSize(2)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [AuthoritiesConstants.USER])
    fun shouldReturnMoreThan10Results() {
        val definition2 = definition("task")
        createDocumentAndTwoProcesses("Funenpark1", definition2.id().name())
        createDocumentAndTwoProcesses("Funenpark2", definition2.id().name())
        createDocumentAndTwoProcesses("Funenpark3", definition2.id().name())
        createDocumentAndTwoProcesses("Funenpark4", definition2.id().name())
        createDocumentAndTwoProcesses("Funenpark5", definition2.id().name())
        createDocumentAndTwoProcesses("Funenpark6", definition2.id().name())
        createDocumentAndTwoProcesses("Funenpark7", definition2.id().name())
        createDocumentAndTwoProcesses("Funenpark8", definition2.id().name())
        createDocumentAndTwoProcesses("Funenpark9", definition2.id().name())
        createDocumentAndTwoProcesses("Funenpark10", definition2.id().name())
        createDocumentAndTwoProcesses("Funenpark11", definition2.id().name())
        createDocumentAndTwoProcesses("Funenpark12", definition2.id().name())

        val filter = OperatonTaskService.TaskFilter.ALL
        val searchResult = caseTaskListSearchService.getTasksByCaseDefinition(
            definition2.id().name(),
            filter,
            PageRequest.of(0, 10)
        )
        assertThat(searchResult.totalElements).isEqualTo(24)
        assertThat(searchResult.numberOfElements).isEqualTo(10)
    }

    private fun createTeamAndAssignToTask(taskId: String, teamKey: String, teamTitle: String) {
        if (!teamRepository.existsById(teamKey)) {
            teamRepository.save(com.ritense.team.domain.Team(key = teamKey, title = teamTitle))
        }
        taskTeamRepository.save(TaskTeam(taskId, teamKey, teamTitle))
        entityManager.flush()
    }

    @Test
    fun shouldReturnAssignedTeamTitleWhenTaskHasTeam() {
        val filter = SearchWithConfigRequest.SearchWithConfigFilter()
        filter.key = "street"
        filter.setValues(listOf("Funenpark"))

        val searchResult = searchTasks(filter)
        assertThat(searchResult).hasSize(1)

        val task = searchResult!!.content[0]
        assertThat(task.assignedTeamTitle).isNull()

        createTeamAndAssignToTask(task.taskId, "team-a", "Team Alpha")

        val searchResultAfter = searchTasks(filter)
        assertThat(searchResultAfter).hasSize(1)
        assertThat(searchResultAfter!!.content[0].assignedTeamTitle).isEqualTo("Team Alpha")
    }

    @Test
    fun shouldFilterByAssignedTeamTitle() {
        val streetFilter = SearchWithConfigRequest.SearchWithConfigFilter()
        streetFilter.key = "street"
        streetFilter.setValues(listOf("Funenpark"))

        val searchResult = searchTasks(streetFilter)
        val task = searchResult!!.content[0]

        createTeamAndAssignToTask(task.taskId, "team-a", "Team Alpha")

        searchFieldV2Service.create(
            SearchFieldV2Dto(
                id = UUID.randomUUID(),
                ownerId = definition!!.id!!.name(),
                ownerType = SEARCH_FIELD_OWNER_TYPE,
                key = "assignedTeamTitle",
                title = "Assigned team title",
                path = "task:assignedTeamTitle",
                order = 1,
                dataType = DataType.TEXT,
                fieldType = FieldType.SINGLE,
                matchType = SearchFieldMatchType.EXACT,
                dropdownDataProvider = null
            )
        )

        val filter = SearchWithConfigRequest.SearchWithConfigFilter()
        filter.key = "assignedTeamTitle"
        filter.setValues(listOf("Team Alpha"))

        val filteredResult = searchTasks(filter)
        assertThat(filteredResult).hasSize(1)
        assertThat(filteredResult!!.content[0].assignedTeamTitle).isEqualTo("Team Alpha")

        // Search for non-existing team title should return no results
        val filterNoMatch = SearchWithConfigRequest.SearchWithConfigFilter()
        filterNoMatch.key = "assignedTeamTitle"
        filterNoMatch.setValues(listOf("Non-existing Team"))

        val noMatchResult = searchTasks(filterNoMatch)
        assertThat(noMatchResult).isEmpty()
    }

    @Test
    fun shouldSortTasksByDateFieldChronologicallyAsc() {
        searchFieldV2Service.create(
            SearchFieldV2Dto(
                id = UUID.randomUUID(),
                ownerId = definition!!.id!!.name(),
                ownerType = SEARCH_FIELD_OWNER_TYPE,
                key = "buildDate",
                title = "Build date",
                path = "doc:buildDate",
                order = 5,
                dataType = DataType.DATE,
                fieldType = FieldType.SINGLE,
                matchType = SearchFieldMatchType.EXACT,
                dropdownDataProvider = null
            )
        )

        val docId1 = createDocumentWithProcess("{\"street\": \"A\", \"buildDate\": \"2024-12-01\"}")
        val docId2 = createDocumentWithProcess("{\"street\": \"B\", \"buildDate\": \"2023-06-15\"}")
        val docId3 = createDocumentWithProcess("{\"street\": \"C\", \"buildDate\": \"2024-01-20\"}")

        val result = runWithoutAuthorization {
            caseTaskListSearchService.search(
                "house",
                AdvancedSearchRequest(),
                PageRequest.of(0, 10, Sort.by(Sort.Direction.ASC, "doc:buildDate"))
            )
        }

        val docIds = result.content.map { it.documentInstanceId }
        assertThat(docIds).containsSubsequence(docId2, docId3, docId1)
    }

    @Test
    fun shouldSortTasksByDateFieldChronologicallyDesc() {
        searchFieldV2Service.create(
            SearchFieldV2Dto(
                id = UUID.randomUUID(),
                ownerId = definition!!.id!!.name(),
                ownerType = SEARCH_FIELD_OWNER_TYPE,
                key = "buildDate",
                title = "Build date",
                path = "doc:buildDate",
                order = 5,
                dataType = DataType.DATE,
                fieldType = FieldType.SINGLE,
                matchType = SearchFieldMatchType.EXACT,
                dropdownDataProvider = null
            )
        )

        val docId1 = createDocumentWithProcess("{\"street\": \"A\", \"buildDate\": \"2024-12-01\"}")
        val docId2 = createDocumentWithProcess("{\"street\": \"B\", \"buildDate\": \"2023-06-15\"}")
        val docId3 = createDocumentWithProcess("{\"street\": \"C\", \"buildDate\": \"2024-01-20\"}")

        val result = runWithoutAuthorization {
            caseTaskListSearchService.search(
                "house",
                AdvancedSearchRequest(),
                PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "doc:buildDate"))
            )
        }

        val docIds = result.content.map { it.documentInstanceId }
        assertThat(docIds).containsSubsequence(docId1, docId3, docId2)
    }

    @Test
    fun shouldSortTasksByDateTimeFieldChronologicallyAsc() {
        searchFieldV2Service.create(
            SearchFieldV2Dto(
                id = UUID.randomUUID(),
                ownerId = definition!!.id!!.name(),
                ownerType = SEARCH_FIELD_OWNER_TYPE,
                key = "inspectionDateTime",
                title = "Inspection date time",
                path = "doc:inspectionDateTime",
                order = 6,
                dataType = DataType.DATETIME,
                fieldType = FieldType.SINGLE,
                matchType = SearchFieldMatchType.EXACT,
                dropdownDataProvider = null
            )
        )

        val docId1 = createDocumentWithProcess("{\"street\": \"A\", \"inspectionDateTime\": \"2024-01-01T23:00:00\"}")
        val docId2 = createDocumentWithProcess("{\"street\": \"B\", \"inspectionDateTime\": \"2024-01-01T08:30:00\"}")
        val docId3 = createDocumentWithProcess("{\"street\": \"C\", \"inspectionDateTime\": \"2024-01-01T15:45:00\"}")

        val result = runWithoutAuthorization {
            caseTaskListSearchService.search(
                "house",
                AdvancedSearchRequest(),
                PageRequest.of(0, 10, Sort.by(Sort.Direction.ASC, "doc:inspectionDateTime"))
            )
        }

        val docIds = result.content.map { it.documentInstanceId }
        assertThat(docIds).containsSubsequence(docId2, docId3, docId1)
    }

    @Test
    fun shouldSortTasksByNumberFieldNumericallyAsc() {
        searchFieldV2Service.create(
            SearchFieldV2Dto(
                id = UUID.randomUUID(),
                ownerId = definition!!.id!!.name(),
                ownerType = SEARCH_FIELD_OWNER_TYPE,
                key = "floorCount",
                title = "Floor count",
                path = "doc:floorCount",
                order = 7,
                dataType = DataType.NUMBER,
                fieldType = FieldType.SINGLE,
                matchType = SearchFieldMatchType.EXACT,
                dropdownDataProvider = null
            )
        )

        val docId1 = createDocumentWithProcess("{\"street\": \"A\", \"floorCount\": 3}")
        val docId2 = createDocumentWithProcess("{\"street\": \"B\", \"floorCount\": 20}")
        val docId3 = createDocumentWithProcess("{\"street\": \"C\", \"floorCount\": 10}")

        val result = runWithoutAuthorization {
            caseTaskListSearchService.search(
                "house",
                AdvancedSearchRequest(),
                PageRequest.of(0, 10, Sort.by(Sort.Direction.ASC, "doc:floorCount"))
            )
        }

        // Without numeric sorting, string order would be "10", "20", "3"
        val docIds = result.content.map { it.documentInstanceId }
        assertThat(docIds).containsSubsequence(docId1, docId3, docId2)
    }

    @Test
    fun shouldSortTasksByNumberFieldNumericallyDesc() {
        searchFieldV2Service.create(
            SearchFieldV2Dto(
                id = UUID.randomUUID(),
                ownerId = definition!!.id!!.name(),
                ownerType = SEARCH_FIELD_OWNER_TYPE,
                key = "floorCount",
                title = "Floor count",
                path = "doc:floorCount",
                order = 7,
                dataType = DataType.NUMBER,
                fieldType = FieldType.SINGLE,
                matchType = SearchFieldMatchType.EXACT,
                dropdownDataProvider = null
            )
        )

        val docId1 = createDocumentWithProcess("{\"street\": \"A\", \"floorCount\": 3}")
        val docId2 = createDocumentWithProcess("{\"street\": \"B\", \"floorCount\": 20}")
        val docId3 = createDocumentWithProcess("{\"street\": \"C\", \"floorCount\": 10}")

        val result = runWithoutAuthorization {
            caseTaskListSearchService.search(
                "house",
                AdvancedSearchRequest(),
                PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "doc:floorCount"))
            )
        }

        val docIds = result.content.map { it.documentInstanceId }
        assertThat(docIds).containsSubsequence(docId2, docId3, docId1)
    }

    private fun createDocumentWithProcess(contentJson: String): UUID {
        val content = JsonDocumentContent(contentJson)
        val document = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(
                    definition!!.id().name(),
                    definition!!.id.caseDefinitionId().key,
                    definition!!.id.caseDefinitionId().versionTag.version,
                    content.asJson()
                )
            )
        }
        val docId = document.resultingDocument().orElseThrow().id()
        runWithoutAuthorization {
            operatonProcessJsonSchemaDocumentService.startProcessForDocument(
                StartProcessForDocumentRequest(docId, "loan-process-demo", mapOf())
            )
        }
        return docId.id
    }

    private fun createDocumentAndTwoProcesses(streetName: String, documentName: String) {
        val content2 = JsonDocumentContent("{\"street\": \"$streetName\"}")

        val document = runWithoutAuthorization<CreateDocumentResult> {
            val result: CreateDocumentResult = documentService.createDocument(
                NewDocumentRequest(
                    documentName,
                    documentName,
                    "1.0.0",
                    content2.asJson()
                )
            )
            result
        }

        runWithoutAuthorization {
            operatonProcessJsonSchemaDocumentService.startProcessForDocument(
                StartProcessForDocumentRequest(
                    document.resultingDocument().orElseThrow().id(),
                    "loan-process-demo-3",
                    mapOf()
                )
            )
        }

        runWithoutAuthorization {
            operatonProcessJsonSchemaDocumentService.startProcessForDocument(
                StartProcessForDocumentRequest(
                    document.resultingDocument().orElseThrow().id(),
                    "loan-process-demo-3",
                    mapOf()
                )
            )
        }
    }

    private fun searchTasks(
        filter: SearchWithConfigRequest.SearchWithConfigFilter,
        pageSize: Int = 50
    ): Page<CaseTask>? {
        val searchWithConfigRequest = SearchWithConfigRequest()

        searchWithConfigRequest.otherFilters = listOf(filter)

        val searchResult = runWithoutAuthorization {
            caseTaskListSearchService.search("house", searchWithConfigRequest, PageRequest.of(0, pageSize))
        }
        return searchResult
    }
}