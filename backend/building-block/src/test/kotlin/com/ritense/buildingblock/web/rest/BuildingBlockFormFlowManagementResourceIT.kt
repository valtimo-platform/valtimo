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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.buildingblock.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.service.BuildingBlockFormFlowDefinitionImporter
import com.ritense.buildingblock.service.BuildingBlockFormFlowDefinitionService
import com.ritense.formflow.domain.definition.FormFlowDefinition
import com.ritense.formflow.domain.definition.FormFlowDefinitionId
import com.ritense.formflow.repository.FormFlowDefinitionRepository
import com.ritense.formflow.web.rest.result.FormFlowDefinitionDto
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doNothing
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put

/**
 * Integration test for [BuildingBlockFormFlowManagementResource].
 *
 * Seeds the database with both a building-block-linked and a case-linked form flow to verify
 * that the building-block endpoints only expose form flows that belong to the requested
 * building block definition — not those belonging to a case definition.
 *
 * Write operation tests (POST/PUT/DELETE) stub the service layer because the auto-deployed
 * `bezwaar` building block is marked `final`, which prevents real write operations.
 */
class BuildingBlockFormFlowManagementResourceIT @Autowired constructor(
    private val mockMvc: MockMvc,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    @MockitoSpyBean
    lateinit var buildingBlockFormFlowDefinitionService: BuildingBlockFormFlowDefinitionService

    @MockitoSpyBean
    lateinit var buildingBlockFormFlowDefinitionImporter: BuildingBlockFormFlowDefinitionImporter

    @Autowired
    lateinit var formFlowDefinitionRepository: FormFlowDefinitionRepository

    private val base = "/api/management/v1/building-block"

    // bezwaar/1.0.0 is auto-deployed from test resources — assertBuildingBlockDefinitionExists passes
    private val bbId = BuildingBlockDefinitionId("bezwaar", "1.0.0")
    private val caseId = CaseDefinitionId("bb-case", "1.0.0")

    private val bbDefinitionId = FormFlowDefinitionId.existingId("bb-test-flow", bbId)
    private val caseDefinitionId = FormFlowDefinitionId.existingId("case-test-flow", caseId)

    @BeforeEach
    fun seedDatabase() {
        // Both a building-block-linked and a case-linked form flow are present in the DB
        formFlowDefinitionRepository.save(FormFlowDefinition(bbDefinitionId, "start", emptySet()))
        formFlowDefinitionRepository.save(FormFlowDefinition(caseDefinitionId, "start", emptySet()))
    }

    @AfterEach
    fun cleanDatabase() {
        listOf(bbDefinitionId, caseDefinitionId).forEach { id ->
            if (formFlowDefinitionRepository.existsById(id)) {
                formFlowDefinitionRepository.deleteById(id)
            }
        }
    }

    // -----------------------------------------------------------------------
    // Data-isolation tests — the spy calls through to the real service so the
    // actual database query is exercised.
    // -----------------------------------------------------------------------

    @Test
    @WithMockUser
    fun `GET all returns only building-block form flows, not case form flows`() {
        mockMvc.get("$base/{key}/version/{versionTag}/form-flow-definition", "bezwaar", "1.0.0")
            .andExpect {
                status { isOk() }
                jsonPath("$.content[?(@.key=='bb-test-flow')]") { exists() }
                jsonPath("$.content[?(@.key=='case-test-flow')]") { doesNotExist() }
            }
    }

    @Test
    @WithMockUser
    fun `GET by key returns the building-block form flow`() {
        mockMvc.get("$base/{key}/version/{versionTag}/form-flow-definition/{definitionKey}",
            "bezwaar", "1.0.0", "bb-test-flow")
            .andExpect {
                status { isOk() }
                jsonPath("$.key") { value("bb-test-flow") }
            }
    }

    @Test
    @WithMockUser
    fun `GET by key returns 404 for a case form flow that has the same key`() {
        // case-test-flow exists in the DB but belongs to a case, not this building block
        mockMvc.get("$base/{key}/version/{versionTag}/form-flow-definition/{definitionKey}",
            "bezwaar", "1.0.0", "case-test-flow")
            .andExpect { status { isNotFound() } }
    }

    // -----------------------------------------------------------------------
    // Write operation tests — bezwaar is final so the real checker blocks writes;
    // we stub the service layer to test the resource logic in isolation.
    // -----------------------------------------------------------------------

    @Test
    @WithMockUser
    fun `POST create returns 400 when definition already exists`() {
        val dto = FormFlowDefinitionDto(key = "bb-test-flow", startStep = "start", steps = emptyList())

        doReturn(formFlowDefinitionRepository.findById(bbDefinitionId).orElseThrow())
            .whenever(buildingBlockFormFlowDefinitionService)
            .getFormFlowDefinition(eq(bbId), eq("bb-test-flow"))

        mockMvc.post("$base/{key}/version/{versionTag}/form-flow-definition", "bezwaar", "1.0.0") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(dto)
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    @WithMockUser
    fun `POST create returns 200 with the saved definition`() {
        val newDefinitionId = FormFlowDefinitionId.existingId("new-flow", bbId)
        val savedDefinition = FormFlowDefinition(newDefinitionId, "start", emptySet())
        val dto = FormFlowDefinitionDto(key = "new-flow", startStep = "start", steps = emptyList())

        doReturn(null)
            .whenever(buildingBlockFormFlowDefinitionService)
            .getFormFlowDefinition(eq(bbId), eq("new-flow"))
        doReturn(savedDefinition)
            .whenever(buildingBlockFormFlowDefinitionService)
            .save(eq(bbId), any())

        mockMvc.post("$base/{key}/version/{versionTag}/form-flow-definition", "bezwaar", "1.0.0") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(dto)
        }.andExpect {
            status { isOk() }
            jsonPath("$.key") { value("new-flow") }
        }
    }

    @Test
    @WithMockUser
    fun `PUT update returns 200 with the updated definition`() {
        val updatedDefinition = FormFlowDefinition(bbDefinitionId, "updated-start", emptySet())
        val dto = FormFlowDefinitionDto(key = "bb-test-flow", startStep = "updated-start", steps = emptyList())

        doReturn(updatedDefinition)
            .whenever(buildingBlockFormFlowDefinitionService)
            .save(eq(bbId), any())

        mockMvc.put("$base/{key}/version/{versionTag}/form-flow-definition/{definitionKey}",
            "bezwaar", "1.0.0", "bb-test-flow") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(dto)
        }.andExpect {
            status { isOk() }
            jsonPath("$.key") { value("bb-test-flow") }
        }
    }

    @Test
    @WithMockUser
    fun `PUT update returns 403 when definition is auto-deployed (read-only)`() {
        val dto = FormFlowDefinitionDto(key = "readonly-flow", startStep = "start", steps = emptyList())

        doReturn(true)
            .whenever(buildingBlockFormFlowDefinitionImporter)
            .isAutoDeployed(eq("readonly-flow"))

        mockMvc.put("$base/{key}/version/{versionTag}/form-flow-definition/{definitionKey}",
            "bezwaar", "1.0.0", "readonly-flow") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(dto)
        }.andExpect { status { isForbidden() } }
    }

    @Test
    @WithMockUser
    fun `DELETE returns 200`() {
        doNothing()
            .whenever(buildingBlockFormFlowDefinitionService)
            .delete(eq(bbId), eq("bb-test-flow"))

        mockMvc.delete("$base/{key}/version/{versionTag}/form-flow-definition/{definitionKey}",
            "bezwaar", "1.0.0", "bb-test-flow")
            .andExpect { status { isOk() } }
    }

    @Test
    @WithMockUser
    fun `DELETE returns 403 when definition is auto-deployed (read-only)`() {
        doReturn(true)
            .whenever(buildingBlockFormFlowDefinitionImporter)
            .isAutoDeployed(eq("readonly-flow"))

        mockMvc.delete("$base/{key}/version/{versionTag}/form-flow-definition/{definitionKey}",
            "bezwaar", "1.0.0", "readonly-flow")
            .andExpect { status { isForbidden() } }
    }
}
