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

package com.ritense.formflow.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.formflow.domain.definition.FormFlowDefinition
import com.ritense.formflow.domain.definition.FormFlowDefinitionId
import com.ritense.formflow.service.FormFlowService
import com.ritense.formflow.BaseIntegrationTest
import com.ritense.formflow.web.rest.result.FormFlowDefinitionDto
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import jakarta.ws.rs.core.MediaType.APPLICATION_JSON
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.context.WebApplicationContext
import java.util.UUID

@Transactional
class FormFlowManagementResourceIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var webApplicationContext: WebApplicationContext

    @Autowired
    lateinit var formFlowService: FormFlowService

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @PersistenceContext
    lateinit var entityManager: EntityManager

    @MockitoSpyBean
    lateinit var caseDefinitionChecker: CaseDefinitionChecker

    lateinit var mockMvc: MockMvc

    @BeforeEach
    fun init() {
        mockMvc = MockMvcBuilders
            .webAppContextSetup(this.webApplicationContext)
            .build()
    }

    @Test
    fun `should return form flow definition schema`() {
        mockMvc
            .perform(get("/api/management/v1/form-flow-definition/schema"))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.title").value("Form flow definition"))
            .andExpect(jsonPath("$.properties.steps").exists())
    }

    @Test
    fun `should return form flow definitions`() {
        mockMvc
            .perform(get("/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form-flow-definition", "profile", "1.0.0"))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.content[?(@.key=='inkomens_loket')].key").value("inkomens_loket"))
            .andExpect(jsonPath("$.content[?(@.key=='inkomens_loket')].readOnly").value(false))
    }

    @Test
    fun `should return form flow definition by id`() {
        mockMvc
            .perform(get("/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form-flow-definition/{definitionKey}", "profile", "1.0.0", "inkomens_loket", 1))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.key").value("inkomens_loket"))
            .andExpect(jsonPath("$.startStep").value("woonplaats"))
            .andExpect(jsonPath("$.steps").exists())
    }

    @Test
    fun `should delete form flow definition by key`() {
        val caseDefinitionId = CaseDefinitionId("profile", "1.0.0")
        formFlowService.save(FormFlowDefinition(FormFlowDefinitionId.existingId("test", caseDefinitionId), "start-step", setOf()))
        mockMvc
            .perform(delete("/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form-flow-definition/{definitionKey}", "profile", "1.0.0", "test"))
            .andDo(print())
            .andExpect(status().isOk)
    }

    @Test
    fun `should delete form flow definition with instances`() {
        createSingleStepDefinition("delete-test")
        val instanceIds = createInstances("delete-test", 2)
        entityManager.flush()
        entityManager.clear()

        mockMvc
            .perform(delete("/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form-flow-definition/{definitionKey}", "profile", "1.0.0", "delete-test"))
            .andDo(print())
            .andExpect(status().isOk)

        entityManager.flush()
        entityManager.clear()

        assertNull(formFlowService.findDefinitionOrNull("delete-test", CASE_DEFINITION_ID))
        assertEquals(0L, countInstances(instanceIds))
        assertEquals(0L, countStepInstances(instanceIds))
    }

    @Test
    fun `should keep instances of other form flow definitions when deleting a form flow definition`() {
        createSingleStepDefinition("delete-test")
        createSingleStepDefinition("keep-test")
        createInstances("delete-test", 1)
        val keptInstanceIds = createInstances("keep-test", 1)
        entityManager.flush()
        entityManager.clear()

        mockMvc
            .perform(delete("/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form-flow-definition/{definitionKey}", "profile", "1.0.0", "delete-test"))
            .andExpect(status().isOk)

        entityManager.flush()
        entityManager.clear()

        assertNotNull(formFlowService.findDefinitionOrNull("keep-test", CASE_DEFINITION_ID))
        assertEquals(1L, countInstances(keptInstanceIds))
        assertEquals(1L, countStepInstances(keptInstanceIds))
    }

    @Test
    fun `should not delete form flow definition or its instances when the case definition cannot be updated`() {
        createSingleStepDefinition("read-only-test")
        val instanceIds = createInstances("read-only-test", 1)
        entityManager.flush()
        entityManager.clear()
        doReturn(false).whenever(caseDefinitionChecker).canUpdateCaseDefinition(CASE_DEFINITION_ID)

        mockMvc
            .perform(delete("/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form-flow-definition/{definitionKey}", "profile", "1.0.0", "read-only-test"))
            .andExpect(status().isForbidden)

        entityManager.flush()
        entityManager.clear()

        assertNotNull(formFlowService.findDefinitionOrNull("read-only-test", CASE_DEFINITION_ID))
        assertEquals(1L, countInstances(instanceIds))
        assertEquals(1L, countStepInstances(instanceIds))
    }

    @Test
    fun `should create form flow definition`() {
        val definition = FormFlowDefinitionDto(
            key = "test",
            startStep = "start-step",
            steps = listOf()
        )

        mockMvc.perform(
            post("/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form-flow-definition", "profile", "1.0.0")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(definition))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.key").value("test"))
            .andExpect(jsonPath("$.startStep").value("start-step"))
            .andExpect(jsonPath("$.steps").exists())
    }

    @Test
    fun `should update form flow definition`() {
        val caseDefinitionId = CaseDefinitionId("profile", "1.0.0")
        formFlowService.save(FormFlowDefinition(FormFlowDefinitionId.existingId("test", caseDefinitionId), "start-step", setOf()))

        val definition = FormFlowDefinitionDto(
            key = "test",
            startStep = "start-step-changed",
            steps = listOf()
        )

        mockMvc.perform(
            put("/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form-flow-definition/{definitionKey}", "profile", "1.0.0", "test")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(definition))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.key").value("test"))
            .andExpect(jsonPath("$.startStep").value("start-step-changed"))
            .andExpect(jsonPath("$.steps").exists())
    }

    @Test
    fun `should remove steps that are dropped from the definition on update`() {
        val caseDefinitionId = CaseDefinitionId("profile", "1.0.0")

        // A freshly created flow is seeded with a 'start-step' step (mirrors the new-form-flow modal).
        mockMvc.perform(
            post("/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form-flow-definition", "profile", "1.0.0")
                .contentType(APPLICATION_JSON)
                .content("""{"key":"orphan-test","startStep":"start-step","steps":[{"key":"start-step","type":{"name":"form","properties":{"definition":""}},"nextSteps":[]}]}""")
        )
            .andExpect(status().isOk)

        // Commit the create and drop the first-level cache so the update runs against a freshly
        // loaded definition, exactly as it would across two separate HTTP requests.
        entityManager.flush()
        entityManager.clear()

        // The admin replaces 'start-step' with 'personal-details' and saves, dropping 'start-step'.
        mockMvc.perform(
            put("/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form-flow-definition/{definitionKey}", "profile", "1.0.0", "orphan-test")
                .contentType(APPLICATION_JSON)
                .content("""{"key":"orphan-test","startStep":"personal-details","steps":[{"key":"personal-details","type":{"name":"form","properties":{"definition":""}},"nextSteps":[]}]}""")
        )
            .andExpect(status().isOk)

        // Flush the pending orphan removal and drop the first-level cache, so the assertion sees the
        // real persisted state rather than the managed entity still held in the session.
        entityManager.flush()
        entityManager.clear()

        val persisted = formFlowService.findDefinition(FormFlowDefinitionId.existingId("orphan-test", caseDefinitionId))
        val stepKeys = persisted.steps.map { it.id.key }
        assertEquals(1, stepKeys.size)
        assertTrue(stepKeys.contains("personal-details"))
        assertTrue(!stepKeys.contains("start-step"), "The dropped 'start-step' step should have been deleted")
    }

    private fun createSingleStepDefinition(key: String) {
        mockMvc.perform(
            post("/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form-flow-definition", "profile", "1.0.0")
                .contentType(APPLICATION_JSON)
                .content("""{"key":"$key","startStep":"start-step","steps":[{"key":"start-step","type":{"name":"form","properties":{"definition":""}},"nextSteps":[]}]}""")
        )
            .andExpect(status().isOk)
    }

    private fun createInstances(definitionKey: String, count: Int): List<UUID> {
        val definition = formFlowService.findDefinition(definitionKey, CASE_DEFINITION_ID)
        return (1..count).map {
            formFlowService.save(definition.createInstance(mapOf("taskInstanceId" to UUID.randomUUID().toString()))).id.id
        }
    }

    private fun countInstances(instanceIds: List<UUID>): Long =
        entityManager.createQuery("SELECT count(i) FROM FormFlowInstance i WHERE i.id.id IN :ids", Long::class.javaObjectType)
            .setParameter("ids", instanceIds)
            .singleResult

    private fun countStepInstances(instanceIds: List<UUID>): Long =
        entityManager.createQuery("SELECT count(s) FROM FormFlowStepInstance s WHERE s.instance.id.id IN :ids", Long::class.javaObjectType)
            .setParameter("ids", instanceIds)
            .singleResult

    private companion object {
        val CASE_DEFINITION_ID = CaseDefinitionId("profile", "1.0.0")
    }
}
