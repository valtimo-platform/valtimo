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

package com.ritense.zaakdetails.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.service.DocumentService
import com.ritense.objectenapi.ObjectenApiPlugin
import com.ritense.objectenapi.client.ObjectRecord
import com.ritense.objectenapi.client.ObjectWrapper
import com.ritense.objectmanagement.domain.ObjectManagement
import com.ritense.objectmanagement.service.ObjectManagementService
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.zaakdetails.documentobjectenapisync.DocumentObjectenApiSync
import com.ritense.zaakdetails.documentobjectenapisync.DocumentObjectenApiSyncManagementService
import com.ritense.zaakdetails.domain.ZaakdetailsObject
import com.ritense.zaakdetails.service.ZaakdetailsObjectService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.net.URI
import java.time.LocalDate
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CaseZaakdetailsInspectionResourceTest {

    private lateinit var documentService: DocumentService
    private lateinit var authorizationService: AuthorizationService
    private lateinit var zaakdetailsObjectService: ZaakdetailsObjectService
    private lateinit var documentObjectenApiSyncManagementService: DocumentObjectenApiSyncManagementService
    private lateinit var objectManagementService: ObjectManagementService
    private lateinit var pluginService: PluginService

    private val objectMapper: ObjectMapper = ObjectMapper().findAndRegisterModules()

    private lateinit var resource: CaseZaakdetailsInspectionResource

    private val caseId: UUID = UUID.randomUUID()
    private val caseDefinitionId: CaseDefinitionId = CaseDefinitionId("loan-application", "1.0.0")

    @BeforeEach
    fun setUp() {
        documentService = mock()
        authorizationService = mock()
        zaakdetailsObjectService = mock()
        documentObjectenApiSyncManagementService = mock()
        objectManagementService = mock()
        pluginService = mock()

        resource = CaseZaakdetailsInspectionResource(
            documentService = documentService,
            authorizationService = authorizationService,
            zaakdetailsObjectService = zaakdetailsObjectService,
            documentObjectenApiSyncManagementService = documentObjectenApiSyncManagementService,
            objectManagementService = objectManagementService,
            pluginService = pluginService,
            objectMapper = objectMapper,
        )

        val document = mock<JsonSchemaDocument>()
        val definitionId = mock<JsonSchemaDocumentDefinitionId>()
        whenever(definitionId.caseDefinitionId()).thenReturn(caseDefinitionId)
        whenever(document.definitionId()).thenReturn(definitionId)
        whenever(documentService.findBy(any<Document.Id>())).thenReturn(Optional.of(document))
    }

    // ---------- getZaakdetailsInspection ----------

    @Test
    fun `should require INSPECT permission on the document`() {
        resource.getZaakdetailsInspection(caseId)

        val captor = argumentCaptor<EntityAuthorizationRequest<JsonSchemaDocument>>()
        verify(authorizationService).requirePermission(captor.capture())
        assertEquals(JsonSchemaDocument::class.java, captor.firstValue.resourceType)
    }

    @Test
    fun `should propagate authorization failure without calling downstream services`() {
        doThrow(RuntimeException("denied")).whenever(authorizationService)
            .requirePermission(any<AuthorizationRequest<JsonSchemaDocument>>())

        assertThrows<RuntimeException> { resource.getZaakdetailsInspection(caseId) }

        verify(zaakdetailsObjectService, never()).findByDocumentId(any())
        verify(documentObjectenApiSyncManagementService, never()).getSyncConfiguration(any())
    }

    @Test
    fun `should return populated DTO when sync and zaakdetailsObject both exist`() {
        val omId = UUID.randomUUID()
        val sync = DocumentObjectenApiSync(
            caseDefinitionId = caseDefinitionId,
            objectManagementConfigurationId = omId,
            enabled = true,
        )
        val objectUrl = URI("https://objecten.example.nl/api/v2/objects/${UUID.randomUUID()}")
        val zo = ZaakdetailsObject(documentId = caseId, objectURI = objectUrl, linkedToZaak = true)
        val om = ObjectManagement(
            id = omId,
            title = "Loan Details",
            objecttypenApiPluginConfigurationId = UUID.randomUUID(),
            objecttypeId = UUID.randomUUID().toString(),
            objectenApiPluginConfigurationId = UUID.randomUUID(),
        )
        whenever(documentObjectenApiSyncManagementService.getSyncConfiguration(caseDefinitionId)).thenReturn(sync)
        whenever(zaakdetailsObjectService.findByDocumentId(caseId)).thenReturn(Optional.of(zo))
        whenever(objectManagementService.getById(omId)).thenReturn(om)

        val body = resource.getZaakdetailsInspection(caseId).body!!

        assertNotNull(body.syncConfig)
        assertEquals("loan-application", body.syncConfig!!.caseDefinitionKey)
        assertEquals("1.0.0", body.syncConfig.caseDefinitionVersionTag)
        assertEquals(omId, body.syncConfig.objectManagementConfigurationId)
        assertEquals("Loan Details", body.syncConfig.objectManagementTitle)
        assertTrue(body.syncConfig.enabled)
        assertNotNull(body.zaakdetailsObject)
        assertEquals(caseId, body.zaakdetailsObject!!.documentId)
        assertEquals(objectUrl, body.zaakdetailsObject.objectUrl)
        assertTrue(body.zaakdetailsObject.linkedToZaak)
    }

    @Test
    fun `should return null syncConfig when not configured`() {
        whenever(documentObjectenApiSyncManagementService.getSyncConfiguration(caseDefinitionId)).thenReturn(null)
        whenever(zaakdetailsObjectService.findByDocumentId(caseId)).thenReturn(Optional.empty())

        val body = resource.getZaakdetailsInspection(caseId).body!!

        assertNull(body.syncConfig)
        assertNull(body.zaakdetailsObject)
    }

    // ---------- getZaakdetailsObjectContent ----------

    @Test
    fun `should return resolved=false when no zaakdetails object exists for the case`() {
        whenever(zaakdetailsObjectService.findByDocumentId(caseId)).thenReturn(Optional.empty())

        val body = resource.getZaakdetailsObjectContent(caseId).body!!

        assertFalse(body.resolved)
        assertNull(body.record)
        assertEquals("No zaakdetails object stored for this case", body.message)
        assertNull(body.objectUrl)
    }

    @Test
    fun `should return resolved=false when no ObjectenApiPlugin matches the URL host`() {
        val objectUrl = URI("https://unknown.example.nl/api/v2/objects/${UUID.randomUUID()}")
        whenever(zaakdetailsObjectService.findByDocumentId(caseId))
            .thenReturn(Optional.of(ZaakdetailsObject(caseId, objectUrl)))
        whenever(pluginService.createInstance(eq(ObjectenApiPlugin::class.java), any<(com.fasterxml.jackson.databind.JsonNode) -> Boolean>()))
            .thenReturn(null)

        val body = resource.getZaakdetailsObjectContent(caseId).body!!

        assertFalse(body.resolved)
        assertNull(body.record)
        assertTrue(body.message!!.contains("No Objecten API plugin configured"))
        assertEquals(objectUrl, body.objectUrl)
    }

    @Test
    fun `should return resolved=true with the record JSON on the happy path`() {
        val objectUrl = URI("https://objecten.example.nl/api/v2/objects/${UUID.randomUUID()}")
        whenever(zaakdetailsObjectService.findByDocumentId(caseId))
            .thenReturn(Optional.of(ZaakdetailsObject(caseId, objectUrl)))
        val plugin = mock<ObjectenApiPlugin>()
        whenever(pluginService.createInstance(eq(ObjectenApiPlugin::class.java), any<(com.fasterxml.jackson.databind.JsonNode) -> Boolean>()))
            .thenReturn(plugin)
        whenever(plugin.getObject(objectUrl)).thenReturn(stubObjectWrapper(objectUrl))

        val body = resource.getZaakdetailsObjectContent(caseId).body!!

        assertTrue(body.resolved)
        assertNotNull(body.record)
        assertEquals(objectUrl, body.objectUrl)
        assertNull(body.message)
    }

    // ---------- resolveZaakobjectContent ----------

    @Test
    fun `zaakobject resolve returns resolved=false when no Objecten API plugin matches host`() {
        val objectUrl = URI("https://unknown.example.nl/api/v2/objects/${UUID.randomUUID()}")
        whenever(pluginService.createInstance(eq(ObjectenApiPlugin::class.java), any<(com.fasterxml.jackson.databind.JsonNode) -> Boolean>()))
            .thenReturn(null)

        val body = resource.resolveZaakobjectContent(caseId, objectUrl).body!!

        assertFalse(body.resolved)
        assertTrue(body.message!!.contains("No Objecten API plugin configured"))
        assertEquals(objectUrl, body.objectUrl)
    }

    @Test
    fun `zaakobject resolve returns resolved=true with the record JSON on the happy path`() {
        val objectUrl = URI("https://objecten.example.nl/api/v2/objects/${UUID.randomUUID()}")
        val plugin = mock<ObjectenApiPlugin>()
        whenever(pluginService.createInstance(eq(ObjectenApiPlugin::class.java), any<(com.fasterxml.jackson.databind.JsonNode) -> Boolean>()))
            .thenReturn(plugin)
        whenever(plugin.getObject(objectUrl)).thenReturn(stubObjectWrapper(objectUrl))

        val body = resource.resolveZaakobjectContent(caseId, objectUrl).body!!

        assertTrue(body.resolved)
        assertNotNull(body.record)
        assertEquals(objectUrl, body.objectUrl)
    }

    @Test
    fun `zaakobject resolve returns resolved=false when the plugin call throws`() {
        val objectUrl = URI("https://objecten.example.nl/api/v2/objects/${UUID.randomUUID()}")
        val plugin = mock<ObjectenApiPlugin>()
        whenever(pluginService.createInstance(eq(ObjectenApiPlugin::class.java), any<(com.fasterxml.jackson.databind.JsonNode) -> Boolean>()))
            .thenReturn(plugin)
        whenever(plugin.getObject(objectUrl)).thenThrow(RuntimeException("404"))

        val body = resource.resolveZaakobjectContent(caseId, objectUrl).body!!

        assertFalse(body.resolved)
        assertNotNull(body.message)
        assertEquals(objectUrl, body.objectUrl)
    }

    private fun stubObjectWrapper(objectUrl: URI): ObjectWrapper {
        val recordData: ObjectNode = objectMapper.createObjectNode().put("naam", "Jan Jansen")
        val record = ObjectRecord(
            typeVersion = 1,
            data = recordData,
            startAt = LocalDate.parse("2026-05-21"),
            index = 1,
        )
        return ObjectWrapper(
            url = objectUrl,
            uuid = UUID.randomUUID(),
            type = URI("https://objecttypen.example.nl/api/v2/objecttypes/${UUID.randomUUID()}"),
            record = record,
        )
    }
}
