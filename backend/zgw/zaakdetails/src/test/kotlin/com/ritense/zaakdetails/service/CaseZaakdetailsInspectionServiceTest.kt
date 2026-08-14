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

package com.ritense.zaakdetails.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
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
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.domain.ZaakInstanceLink
import com.ritense.zakenapi.domain.ZaakObject
import com.ritense.zakenapi.link.ZaakInstanceLinkNotFoundException
import com.ritense.zakenapi.link.ZaakInstanceLinkService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.web.server.ResponseStatusException
import java.net.URI
import java.time.LocalDate
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CaseZaakdetailsInspectionServiceTest {

    private lateinit var documentService: DocumentService
    private lateinit var zaakdetailsObjectService: ZaakdetailsObjectService
    private lateinit var documentObjectenApiSyncManagementService: DocumentObjectenApiSyncManagementService
    private lateinit var objectManagementService: ObjectManagementService
    private lateinit var pluginService: PluginService
    private lateinit var zaakInstanceLinkService: ZaakInstanceLinkService

    private val objectMapper: ObjectMapper = ObjectMapper().findAndRegisterModules()

    private lateinit var service: CaseZaakdetailsInspectionService
    private lateinit var document: JsonSchemaDocument

    private val caseId: UUID = UUID.randomUUID()
    private val caseDefinitionId: CaseDefinitionId = CaseDefinitionId("loan-application", "1.0.0")

    @BeforeEach
    fun setUp() {
        documentService = mock()
        zaakdetailsObjectService = mock()
        documentObjectenApiSyncManagementService = mock()
        objectManagementService = mock()
        pluginService = mock()
        zaakInstanceLinkService = mock()

        service = CaseZaakdetailsInspectionService(
            documentService = documentService,
            zaakdetailsObjectService = zaakdetailsObjectService,
            documentObjectenApiSyncManagementService = documentObjectenApiSyncManagementService,
            objectManagementService = objectManagementService,
            pluginService = pluginService,
            zaakInstanceLinkService = zaakInstanceLinkService,
            objectMapper = objectMapper,
        )

        document = mock()
        val definitionId = mock<JsonSchemaDocumentDefinitionId>()
        whenever(definitionId.caseDefinitionId()).thenReturn(caseDefinitionId)
        whenever(document.definitionId()).thenReturn(definitionId)
        whenever(documentService.findBy(any<Document.Id>())).thenReturn(Optional.of(document))
    }

    // ---------- getInspection ----------

    @Test
    fun `getInspection returns populated DTO when sync and zaakdetailsObject both exist`() {
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

        val dto = service.getInspection(caseId, document)

        assertNotNull(dto.syncConfig)
        assertEquals("loan-application", dto.syncConfig!!.caseDefinitionKey)
        assertEquals("1.0.0", dto.syncConfig.caseDefinitionVersionTag)
        assertEquals(omId, dto.syncConfig.objectManagementConfigurationId)
        assertEquals("Loan Details", dto.syncConfig.objectManagementTitle)
        assertTrue(dto.syncConfig.enabled)
        assertNotNull(dto.zaakdetailsObject)
        assertEquals(caseId, dto.zaakdetailsObject!!.documentId)
        assertEquals(objectUrl, dto.zaakdetailsObject.objectUrl)
        assertTrue(dto.zaakdetailsObject.linkedToZaak)
    }

    @Test
    fun `getInspection returns null syncConfig when not configured`() {
        whenever(documentObjectenApiSyncManagementService.getSyncConfiguration(caseDefinitionId)).thenReturn(null)
        whenever(zaakdetailsObjectService.findByDocumentId(caseId)).thenReturn(Optional.empty())

        val dto = service.getInspection(caseId, document)

        assertNull(dto.syncConfig)
        assertNull(dto.zaakdetailsObject)
    }

    // ---------- getZaakdetailsObjectContent ----------

    @Test
    fun `getZaakdetailsObjectContent returns resolved=false when no zaakdetails object exists for the case`() {
        whenever(zaakdetailsObjectService.findByDocumentId(caseId)).thenReturn(Optional.empty())

        val dto = service.getZaakdetailsObjectContent(caseId)

        assertFalse(dto.resolved)
        assertNull(dto.record)
        assertEquals("No zaakdetails object stored for this case", dto.message)
        assertNull(dto.objectUrl)
    }

    @Test
    fun `getZaakdetailsObjectContent returns resolved=false when no ObjectenApiPlugin matches the URL host`() {
        val objectUrl = URI("https://unknown.example.nl/api/v2/objects/${UUID.randomUUID()}")
        whenever(zaakdetailsObjectService.findByDocumentId(caseId))
            .thenReturn(Optional.of(ZaakdetailsObject(caseId, objectUrl)))
        whenever(pluginService.createInstance(eq(ObjectenApiPlugin::class.java), any<(com.fasterxml.jackson.databind.JsonNode) -> Boolean>()))
            .thenReturn(null)

        val dto = service.getZaakdetailsObjectContent(caseId)

        assertFalse(dto.resolved)
        assertNull(dto.record)
        assertTrue(dto.message!!.contains("No Objecten API plugin configured"))
        assertEquals(objectUrl, dto.objectUrl)
    }

    @Test
    fun `getZaakdetailsObjectContent returns resolved=true with the record JSON on the happy path`() {
        val objectUrl = URI("https://objecten.example.nl/api/v2/objects/${UUID.randomUUID()}")
        whenever(zaakdetailsObjectService.findByDocumentId(caseId))
            .thenReturn(Optional.of(ZaakdetailsObject(caseId, objectUrl)))
        val plugin = mock<ObjectenApiPlugin>()
        whenever(pluginService.createInstance(eq(ObjectenApiPlugin::class.java), any<(com.fasterxml.jackson.databind.JsonNode) -> Boolean>()))
            .thenReturn(plugin)
        whenever(plugin.getObject(objectUrl)).thenReturn(stubObjectWrapper(objectUrl))

        val dto = service.getZaakdetailsObjectContent(caseId)

        assertTrue(dto.resolved)
        assertNotNull(dto.record)
        assertEquals(objectUrl, dto.objectUrl)
        assertNull(dto.message)
    }

    // ---------- resolveZaakobjectContent ----------

    @Test
    fun `resolveZaakobjectContent returns resolved=false when no Objecten API plugin matches host`() {
        val objectUrl = URI("https://unknown.example.nl/api/v2/objects/${UUID.randomUUID()}")
        stubZaakObjecten(objectUrl)
        whenever(pluginService.createInstance(eq(ObjectenApiPlugin::class.java), any<(com.fasterxml.jackson.databind.JsonNode) -> Boolean>()))
            .thenReturn(null)

        val dto = service.resolveZaakobjectContent(caseId, objectUrl)

        assertFalse(dto.resolved)
        assertTrue(dto.message!!.contains("No Objecten API plugin configured"))
        assertEquals(objectUrl, dto.objectUrl)
    }

    @Test
    fun `resolveZaakobjectContent returns resolved=true with the record JSON on the happy path`() {
        val objectUrl = URI("https://objecten.example.nl/api/v2/objects/${UUID.randomUUID()}")
        stubZaakObjecten(objectUrl)
        val plugin = mock<ObjectenApiPlugin>()
        whenever(pluginService.createInstance(eq(ObjectenApiPlugin::class.java), any<(com.fasterxml.jackson.databind.JsonNode) -> Boolean>()))
            .thenReturn(plugin)
        whenever(plugin.getObject(objectUrl)).thenReturn(stubObjectWrapper(objectUrl))

        val dto = service.resolveZaakobjectContent(caseId, objectUrl)

        assertTrue(dto.resolved)
        assertNotNull(dto.record)
        assertEquals(objectUrl, dto.objectUrl)
    }

    @Test
    fun `resolveZaakobjectContent returns resolved=false when the plugin call throws`() {
        val objectUrl = URI("https://objecten.example.nl/api/v2/objects/${UUID.randomUUID()}")
        stubZaakObjecten(objectUrl)
        val plugin = mock<ObjectenApiPlugin>()
        whenever(pluginService.createInstance(eq(ObjectenApiPlugin::class.java), any<(com.fasterxml.jackson.databind.JsonNode) -> Boolean>()))
            .thenReturn(plugin)
        whenever(plugin.getObject(objectUrl)).thenThrow(RuntimeException("404"))

        val dto = service.resolveZaakobjectContent(caseId, objectUrl)

        assertFalse(dto.resolved)
        assertNotNull(dto.message)
        assertEquals(objectUrl, dto.objectUrl)
    }

    @Test
    fun `resolveZaakobjectContent rejects objectUrl not linked to the case`() {
        val linkedUrl = URI("https://objecten.example.nl/api/v2/objects/${UUID.randomUUID()}")
        val unrelatedUrl = URI("https://objecten.example.nl/api/v2/objects/${UUID.randomUUID()}")
        stubZaakObjecten(linkedUrl)

        assertThrows<ResponseStatusException> {
            service.resolveZaakobjectContent(caseId, unrelatedUrl)
        }
    }

    @Test
    fun `resolveZaakobjectContent rejects when no zaak is linked to the case`() {
        val objectUrl = URI("https://objecten.example.nl/api/v2/objects/${UUID.randomUUID()}")
        whenever(zaakInstanceLinkService.getByDocumentId(caseId))
            .thenThrow(ZaakInstanceLinkNotFoundException("no link"))

        assertThrows<ResponseStatusException> {
            service.resolveZaakobjectContent(caseId, objectUrl)
        }
    }

    private fun stubZaakObjecten(vararg objectUrls: URI) {
        val link = mock<ZaakInstanceLink>()
        val zaakInstanceUrl = URI("https://zaken.example.nl/api/v1/zaken/${UUID.randomUUID()}")
        whenever(link.zaakInstanceUrl).thenReturn(zaakInstanceUrl)
        whenever(zaakInstanceLinkService.getByDocumentId(caseId)).thenReturn(link)

        val zakenApiPlugin = mock<ZakenApiPlugin>()
        whenever(pluginService.createInstance(eq(ZakenApiPlugin::class.java), any<(com.fasterxml.jackson.databind.JsonNode) -> Boolean>()))
            .thenReturn(zakenApiPlugin)
        whenever(zakenApiPlugin.getZaakObjecten(zaakInstanceUrl)).thenReturn(
            objectUrls.map { url ->
                ZaakObject(
                    url = URI("https://zaken.example.nl/api/v1/zaakobjecten/${UUID.randomUUID()}"),
                    uuid = UUID.randomUUID(),
                    zaakUrl = zaakInstanceUrl,
                    objectUrl = url,
                    objectType = "object",
                    objectTypeOverige = null,
                    relatieomschrijving = null,
                )
            }
        )
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
