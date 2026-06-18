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

import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.service.DocumentService
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.semver4j.Semver
import java.util.Optional
import java.util.UUID

class BuildingBlockInstanceResourceTest {

    private lateinit var buildingBlockInstanceService: BuildingBlockInstanceService
    private lateinit var documentService: DocumentService
    private lateinit var authorizationService: AuthorizationService
    private lateinit var resource: BuildingBlockInstanceResource

    @BeforeEach
    fun setUp() {
        buildingBlockInstanceService = mock()
        documentService = mock()
        authorizationService = mock()
        resource = BuildingBlockInstanceResource(
            buildingBlockInstanceService = buildingBlockInstanceService,
            documentService = documentService,
            authorizationService = authorizationService,
        )

        whenever(documentService.findBy(any<Document.Id>())).thenReturn(Optional.of(mock<JsonSchemaDocument>()))
    }

    @Test
    fun `should require INSPECT permission on the case document`() {
        val caseId = UUID.randomUUID()
        whenever(buildingBlockInstanceService.findAllByCaseDocumentId(caseId)).thenReturn(emptyList())

        resource.getInstancesForCase(caseId)

        val captor = argumentCaptor<EntityAuthorizationRequest<JsonSchemaDocument>>()
        verify(authorizationService).requirePermission(captor.capture())
        assertThat(captor.firstValue.resourceType).isEqualTo(JsonSchemaDocument::class.java)
        assertThat(captor.firstValue.action).isEqualTo(JsonSchemaDocumentActionProvider.INSPECT)
    }

    @Test
    fun `should propagate authorization failure without querying instances`() {
        val caseId = UUID.randomUUID()
        doThrow(RuntimeException("denied"))
            .whenever(authorizationService)
            .requirePermission(any<AuthorizationRequest<JsonSchemaDocument>>())

        assertThrows<RuntimeException> { resource.getInstancesForCase(caseId) }

        verify(buildingBlockInstanceService, never()).findAllByCaseDocumentId(any())
    }

    @Test
    fun `should map instances to DTOs and return them`() {
        val caseId = UUID.randomUUID()
        val instance = mock<BuildingBlockInstance>()
        val definition = mock<BuildingBlockDefinition>()
        val defId = BuildingBlockDefinitionId("kvk-lookup", Semver.parse("1.0.0")!!)
        whenever(definition.id).thenReturn(defId)
        whenever(instance.id).thenReturn(UUID.randomUUID())
        whenever(instance.documentId).thenReturn(UUID.randomUUID())
        whenever(instance.caseDocumentId).thenReturn(caseId)
        whenever(instance.definition).thenReturn(definition)
        whenever(instance.activityId).thenReturn("Activity_1")
        whenever(instance.callerProcessDefinitionId).thenReturn("caller-pd")
        whenever(instance.processInstanceId).thenReturn("pi-123")
        whenever(instance.parentBuildingBlockInstanceId).thenReturn(null)
        whenever(instance.rootBuildingBlockInstanceId).thenReturn(null)

        whenever(buildingBlockInstanceService.findAllByCaseDocumentId(caseId)).thenReturn(listOf(instance))

        val response = resource.getInstancesForCase(caseId)
        val dtos = response.body!!

        assertThat(response.statusCode.value()).isEqualTo(200)
        assertThat(dtos).hasSize(1)
        val dto = dtos.single()
        assertThat(dto.id).isEqualTo(instance.id)
        assertThat(dto.caseDocumentId).isEqualTo(caseId)
        assertThat(dto.definitionKey).isEqualTo("kvk-lookup")
        assertThat(dto.definitionVersionTag).isEqualTo("1.0.0")
        assertThat(dto.activityId).isEqualTo("Activity_1")
        assertThat(dto.processInstanceId).isEqualTo("pi-123")
    }

    @Test
    fun `should return empty list when no instances exist for the case`() {
        val caseId = UUID.randomUUID()
        whenever(buildingBlockInstanceService.findAllByCaseDocumentId(caseId)).thenReturn(emptyList())

        val response = resource.getInstancesForCase(caseId)

        assertThat(response.body).isEmpty()
    }
}
