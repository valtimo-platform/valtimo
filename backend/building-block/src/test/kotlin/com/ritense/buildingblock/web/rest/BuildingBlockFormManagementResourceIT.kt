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

package com.ritense.buildingblock.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.service.BuildingBlockFormDefinitionService
import com.ritense.form.domain.FormDefinitionBlueprintId
import com.ritense.form.domain.FormIoFormDefinition
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doNothing
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.PageImpl
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import java.util.Optional
import java.util.UUID

class BuildingBlockFormManagementResourceIT @Autowired constructor(
    private val mockMvc: MockMvc,
    private val objectMapper: ObjectMapper
) : BaseIntegrationTest() {

    @MockitoSpyBean
    lateinit var buildingBlockFormDefinitionService: BuildingBlockFormDefinitionService

    private val base = "/api/management/v1/building-block"
    private val key = "my-bb"
    private val versionTag = "1.0.0"
    private val buildingBlockDefinitionId = BuildingBlockDefinitionId(key, versionTag)
    private val formDefinitionJson = """{"display": "form", "components": []}"""

    private lateinit var testForm: FormIoFormDefinition
    private lateinit var testFormId: UUID

    @BeforeEach
    fun setup() {
        testFormId = UUID.randomUUID()
        val blueprintId = FormDefinitionBlueprintId.forBuildingBlock(buildingBlockDefinitionId)
        testForm = FormIoFormDefinition(testFormId, "test-form", formDefinitionJson, blueprintId, false)
    }

    @Test
    @WithMockUser
    fun `should return paginated form definitions`() {
        doReturn(PageImpl(listOf(testForm)))
            .whenever(buildingBlockFormDefinitionService)
            .queryFormDefinitions(eq(buildingBlockDefinitionId), eq(null), any())

        mockMvc.get("$base/{key}/version/{versionTag}/form", key, versionTag) {
            param("page", "0")
            param("size", "10")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].name") { value("test-form") }
            jsonPath("$.content[0].id") { value(testFormId.toString()) }
        }
    }

    @Test
    @WithMockUser
    fun `should return form definitions with search term`() {
        doReturn(PageImpl(listOf(testForm)))
            .whenever(buildingBlockFormDefinitionService)
            .queryFormDefinitions(eq(buildingBlockDefinitionId), eq("test"), any())

        mockMvc.get("$base/{key}/version/{versionTag}/form", key, versionTag) {
            param("searchTerm", "test")
            param("page", "0")
            param("size", "10")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].name") { value("test-form") }
        }
    }

    @Test
    @WithMockUser
    fun `should return form definition by id`() {
        doReturn(Optional.of(testForm))
            .whenever(buildingBlockFormDefinitionService)
            .getFormDefinitionById(eq(buildingBlockDefinitionId), eq(testFormId))

        mockMvc.get("$base/{key}/version/{versionTag}/form/{formDefinitionId}", key, versionTag, testFormId)
            .andExpect {
                status { isOk() }
                jsonPath("$.id") { value(testFormId.toString()) }
                jsonPath("$.name") { value("test-form") }
            }
    }

    @Test
    @WithMockUser
    fun `should return 404 when form definition not found by id`() {
        val nonExistentId = UUID.randomUUID()

        doReturn(Optional.empty<FormIoFormDefinition>())
            .whenever(buildingBlockFormDefinitionService)
            .getFormDefinitionById(eq(buildingBlockDefinitionId), eq(nonExistentId))

        mockMvc.get("$base/{key}/version/{versionTag}/form/{formDefinitionId}", key, versionTag, nonExistentId)
            .andExpect { status { isNotFound() } }
    }

    @Test
    @WithMockUser
    fun `should return form definition by name`() {
        doReturn(Optional.of(testForm))
            .whenever(buildingBlockFormDefinitionService)
            .getFormDefinitionByName(eq(buildingBlockDefinitionId), eq("test-form"))

        mockMvc.get("$base/{key}/version/{versionTag}/form/name/{name}", key, versionTag, "test-form")
            .andExpect {
                status { isOk() }
                jsonPath("$.name") { value("test-form") }
            }
    }

    @Test
    @WithMockUser
    fun `should return 404 when form definition not found by name`() {
        doReturn(Optional.empty<FormIoFormDefinition>())
            .whenever(buildingBlockFormDefinitionService)
            .getFormDefinitionByName(eq(buildingBlockDefinitionId), eq("non-existent"))

        mockMvc.get("$base/{key}/version/{versionTag}/form/name/{name}", key, versionTag, "non-existent")
            .andExpect { status { isNotFound() } }
    }

    @Test
    @WithMockUser
    fun `should return true when form definition exists`() {
        doReturn(Optional.of(testForm))
            .whenever(buildingBlockFormDefinitionService)
            .getFormDefinitionByName(eq(buildingBlockDefinitionId), eq("test-form"))

        mockMvc.get("$base/{key}/version/{versionTag}/form/{name}/exists", key, versionTag, "test-form")
            .andExpect {
                status { isOk() }
                content { string("true") }
            }
    }

    @Test
    @WithMockUser
    fun `should return false when form definition does not exist`() {
        doReturn(Optional.empty<FormIoFormDefinition>())
            .whenever(buildingBlockFormDefinitionService)
            .getFormDefinitionByName(eq(buildingBlockDefinitionId), eq("non-existent"))

        mockMvc.get("$base/{key}/version/{versionTag}/form/{name}/exists", key, versionTag, "non-existent")
            .andExpect {
                status { isOk() }
                content { string("false") }
            }
    }

    @Test
    @WithMockUser
    fun `should create form definition`() {
        val newFormId = UUID.randomUUID()
        val blueprintId = FormDefinitionBlueprintId.forBuildingBlock(buildingBlockDefinitionId)
        val createdForm = FormIoFormDefinition(newFormId, "new-form", formDefinitionJson, blueprintId, false)

        doReturn(createdForm)
            .whenever(buildingBlockFormDefinitionService)
            .createFormDefinition(eq(buildingBlockDefinitionId), eq("new-form"), eq(formDefinitionJson), eq(false))

        val body = mapOf(
            "name" to "new-form",
            "formDefinition" to formDefinitionJson
        )

        mockMvc.post("$base/{key}/version/{versionTag}/form", key, versionTag) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(body)
        }.andExpect {
            status { isOk() }
            jsonPath("$.id") { value(newFormId.toString()) }
            jsonPath("$.name") { value("new-form") }
        }
    }

    @Test
    @WithMockUser
    fun `should create read-only form definition`() {
        val newFormId = UUID.randomUUID()
        val blueprintId = FormDefinitionBlueprintId.forBuildingBlock(buildingBlockDefinitionId)
        val createdForm = FormIoFormDefinition(newFormId, "readonly-form", formDefinitionJson, blueprintId, true)

        doReturn(createdForm)
            .whenever(buildingBlockFormDefinitionService)
            .createFormDefinition(eq(buildingBlockDefinitionId), eq("readonly-form"), eq(formDefinitionJson), eq(true))

        val body = mapOf(
            "name" to "readonly-form",
            "formDefinition" to formDefinitionJson,
            "isReadOnly" to true
        )

        mockMvc.post("$base/{key}/version/{versionTag}/form", key, versionTag) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(body)
        }.andExpect {
            status { isOk() }
            jsonPath("$.name") { value("readonly-form") }
            jsonPath("$.isReadOnly") { value(true) }
        }
    }

    @Test
    @WithMockUser
    fun `should update form definition`() {
        val updatedFormDefinition = """{"display": "form", "components": [{"type": "textfield"}]}"""
        val blueprintId = FormDefinitionBlueprintId.forBuildingBlock(buildingBlockDefinitionId)
        val updatedForm = FormIoFormDefinition(testFormId, "updated-form", updatedFormDefinition, blueprintId, false)

        doReturn(updatedForm)
            .whenever(buildingBlockFormDefinitionService)
            .updateFormDefinition(eq(buildingBlockDefinitionId), eq(testFormId), eq("updated-form"), eq(updatedFormDefinition))

        val body = mapOf(
            "name" to "updated-form",
            "formDefinition" to updatedFormDefinition
        )

        mockMvc.put("$base/{key}/version/{versionTag}/form/{formDefinitionId}", key, versionTag, testFormId) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(body)
        }.andExpect {
            status { isOk() }
            jsonPath("$.name") { value("updated-form") }
        }
    }

    @Test
    @WithMockUser
    fun `should delete form definition`() {
        doNothing()
            .whenever(buildingBlockFormDefinitionService)
            .deleteFormDefinition(eq(buildingBlockDefinitionId), eq(testFormId))

        mockMvc.delete("$base/{key}/version/{versionTag}/form/{formDefinitionId}", key, versionTag, testFormId)
            .andExpect { status { isNoContent() } }
    }
}
