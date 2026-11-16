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

package com.ritense.objectenapi.service

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.form.domain.FormDefinitionBlueprintId
import com.ritense.form.domain.FormIoFormDefinition
import com.ritense.form.service.FormDefinitionService
import com.ritense.objectenapi.ObjectenApiPlugin
import com.ritense.objectenapi.client.ObjectRecord
import com.ritense.objectenapi.client.ObjectWrapper
import com.ritense.objectenapi.client.ObjectenApiClient
import com.ritense.objectenapi.exception.ObjectUrlNotAllowedException
import com.ritense.objectenapi.management.ObjectManagementInfo
import com.ritense.objectenapi.management.ObjectManagementInfoProvider
import com.ritense.objecttypenapi.ObjecttypenApiPlugin
import com.ritense.objecttypenapi.client.Objecttype
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.zakenapi.ZaakUrlProvider
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.domain.ZaakObject
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import java.net.URI
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

internal class ZaakObjectServiceTest {

    lateinit var zaakUrlProvider: ZaakUrlProvider
    lateinit var pluginService:PluginService
    lateinit var formDefinitionService:FormDefinitionService
    lateinit var objectManagementInfoProvider:ObjectManagementInfoProvider
    lateinit var zaakObjectService:ZaakObjectService

    var zaakPlugin: ZakenApiPlugin? = null
    var objectenApiPlugin: ObjectenApiPlugin? = null
    var objecttypenApiPlugin: ObjecttypenApiPlugin? = null

    lateinit var zaakObjecten: MutableList<ZaakObject>

    val caseDefinitionId = CaseDefinitionId("test", "1.0.0")

    private val objectManagementId = UUID.randomUUID()
    private var objectenApiConfigurationId: UUID = UUID.randomUUID()

    @BeforeEach
    fun init() {
        zaakUrlProvider = mock()
        pluginService = mock()
        formDefinitionService = mock()
        objectManagementInfoProvider = mock()
        zaakObjectService = ZaakObjectService(zaakUrlProvider, pluginService, formDefinitionService, objectManagementInfoProvider)

        zaakPlugin = null
        objectenApiPlugin = null
        objecttypenApiPlugin = null
        zaakObjecten = mutableListOf()
    }

    @Test
    fun `should get objecttypes for document`() {
        val documentId = UUID.randomUUID()

        val zaakInstanceUrl = setupZaakInstanceLink(documentId)
        setupPlugins(zaakInstanceUrl)
        val objecttype1 = setupObjecttypeWithRelations(zaakInstanceUrl)
        val objecttype2 = setupObjecttypeWithRelations(zaakInstanceUrl)

        val zaakObjectTypes = zaakObjectService.getZaakObjectTypes(documentId)

        assertEquals(objecttype1, zaakObjectTypes[0])
        assertEquals(objecttype2, zaakObjectTypes[1])
    }

    @Test
    fun `isZaakObject should be true when object url belongs to the zaak`() {
        val documentId = UUID.randomUUID()
        val zaakInstanceUrl = setupZaakInstanceLink(documentId)
        setupPlugins(zaakInstanceUrl)
        val zaakObject = setupZaakObject(zaakInstanceUrl)

        assertTrue(zaakObjectService.isZaakObject(documentId, zaakObject.objectUrl))
    }

    @Test
    fun `isZaakObject should be false when object url does not belong to the zaak`() {
        val documentId = UUID.randomUUID()
        val zaakInstanceUrl = setupZaakInstanceLink(documentId)
        setupPlugins(zaakInstanceUrl)
        setupZaakObject(zaakInstanceUrl)

        assertFalse(zaakObjectService.isZaakObject(documentId, URI("http://example.com/object/other")))
    }

    @Test
    fun `should get only one objecttype when multiple objects are same type`() {
        val documentId = UUID.randomUUID()

        val zaakInstanceUrl = setupZaakInstanceLink(documentId)
        setupPlugins(zaakInstanceUrl)
        val objecttype = mock<Objecttype>()
        val objecttypeUrl = URI("http://example.com/objecttype/123")
        setupObjectForObjecttype(zaakInstanceUrl, objecttype, objecttypeUrl)
        setupObjectForObjecttype(zaakInstanceUrl, objecttype, objecttypeUrl)

        val zaakObjectTypes = zaakObjectService.getZaakObjectTypes(documentId)

        assertEquals(objecttype, zaakObjectTypes[0])
        assertEquals(1, zaakObjectTypes.size)
    }

    @Test
    fun `should throw exception if zaak instance link is not found`() {
        val documentId = UUID.randomUUID()
        whenever(zaakUrlProvider.getZaakUrl(documentId))
            .thenThrow(RuntimeException::class.java)

        assertThrows(RuntimeException::class.java) {
            zaakObjectService.getZaakObjectTypes(documentId)
        }
    }

    @Test
    fun `should throw exception if no plugin is found for zaak`() {
        val documentId = UUID.randomUUID()

        val zaakInstanceUrl = setupZaakInstanceLink(documentId)
        setupPlugins(zaakInstanceUrl)
        setupObjecttypeWithRelations(zaakInstanceUrl)
        whenever(pluginService.createInstance(eq(ZakenApiPlugin::class.java), any()))
            .thenReturn(null)

        val exception = assertThrows(IllegalArgumentException::class.java) {
            zaakObjectService.getZaakObjectTypes(documentId)
        }

        assertEquals("No plugin configuration was found for zaak with URL $zaakInstanceUrl", exception.message)
    }

    @Test
    fun `should skip object if no plugin is found for object`() {
        val documentId = UUID.randomUUID()

        val zaakInstanceUrl = setupZaakInstanceLink(documentId)
        setupPlugins(zaakInstanceUrl)
        setupObjecttypeWithRelations(zaakInstanceUrl)
        whenever(pluginService.createInstance(eq(ObjectenApiPlugin::class.java), any()))
            .thenReturn(null)

        val zaakObjectTypes = zaakObjectService.getZaakObjectTypes(documentId)

        assertTrue(zaakObjectTypes.isEmpty())
    }

    @Test
    fun `should skip objecttype if no plugin is found for objecttype`() {
        val documentId = UUID.randomUUID()

        val zaakInstanceUrl = setupZaakInstanceLink(documentId)
        setupPlugins(zaakInstanceUrl)
        setupObjecttypeWithRelations(zaakInstanceUrl)
        whenever(pluginService.createInstance(eq(ObjecttypenApiPlugin::class.java), any()))
            .thenReturn(null)

        val zaakObjectTypes = zaakObjectService.getZaakObjectTypes(documentId)

        assertTrue(zaakObjectTypes.isEmpty())
    }

    @Test
    fun `should get objects for document and objecttype`() {
        val documentId = UUID.randomUUID()
        val objecttypeUrl = URI("http://example.com/objecttype")

        val zaakInstanceUrl = setupZaakInstanceLink(documentId)
        setupPlugins(zaakInstanceUrl)
        val object1 = setupObjectWithRelations(zaakInstanceUrl, objecttypeUrl)
        val object2 = setupObjectWithRelations(zaakInstanceUrl, objecttypeUrl)

        val zaakObjects = zaakObjectService.getZaakObjectenOfType(documentId, objecttypeUrl)

        assertEquals(object1, zaakObjects[0])
        assertEquals(object2, zaakObjects[1])
    }

    @Test
    fun `should not get objects for other objecttype`() {
        val documentId = UUID.randomUUID()
        val objecttypeUrl = URI("http://example.com/objecttype")
        val otherObjecttypeUrl = URI("http://example.com/objecttype/2")

        val zaakInstanceUrl = setupZaakInstanceLink(documentId)
        setupPlugins(zaakInstanceUrl)

        setupObjectWithRelations(zaakInstanceUrl, otherObjecttypeUrl)
        setupObjectWithRelations(zaakInstanceUrl, otherObjecttypeUrl)

        val zaakObjects = zaakObjectService.getZaakObjectenOfType(documentId, objecttypeUrl)

        assertTrue(zaakObjects.isEmpty())
    }

    @Test
    fun `should get zaakobject of correct type`() {
        val documentId = UUID.randomUUID()
        val objecttypeName = "test"
        val objecttypeUrl = URI("http://example.com/objecttype")
        val otherObjecttypeUrl = URI("http://example.com/objecttype/2")

        val zaakInstanceUrl = setupZaakInstanceLink(documentId)
        setupPlugins(zaakInstanceUrl)

        //set up object that should not be found
        val otherObjecttype = mock<Objecttype>()
        whenever(otherObjecttype.name).thenReturn("other")
        setupObjectForObjecttype(zaakInstanceUrl, otherObjecttype, otherObjecttypeUrl)

        //set up object with correct type name that should be found
        val objecttype = mock<Objecttype>()
        whenever(objecttype.name).thenReturn(objecttypeName)
        val objectOfType = setupObjectForObjecttype(zaakInstanceUrl, objecttype, objecttypeUrl)

        val resultObject = zaakObjectService.getZaakObjectOfTypeByName(documentId, objecttypeName)

        assertEquals(objectOfType, resultObject)
    }

    @Test
    fun `should throw exception when there are multiple types with same name`() {
        val documentId = UUID.randomUUID()
        val objecttypeName = "test"
        val objecttypeUrl = URI("http://example.com/objecttype")
        val otherObjecttypeUrl = URI("http://example.com/objecttype/2")

        val zaakInstanceUrl = setupZaakInstanceLink(documentId)
        setupPlugins(zaakInstanceUrl)

        //set up objecttype
        val objecttype = mock<Objecttype>()
        whenever(objecttype.name).thenReturn(objecttypeName)
        setupObjectForObjecttype(zaakInstanceUrl, objecttype, objecttypeUrl)

        //set up other objecttype with same name but different url
        val otherObjecttype = mock<Objecttype>()
        whenever(otherObjecttype.name).thenReturn(objecttypeName)
        setupObjectForObjecttype(zaakInstanceUrl, otherObjecttype, otherObjecttypeUrl)

        val exception = assertThrows(IllegalStateException::class.java) {
            zaakObjectService.getZaakObjectOfTypeByName(documentId, objecttypeName)
        }

        assertEquals("More than one objecttype with name 'test' was found for document $documentId",
            exception.message)
    }

    @Test
    fun `should throw exception when getting object by type and there are multiple objects`() {
        val documentId = UUID.randomUUID()
        val objecttypeName = "test"
        val objecttypeUrl = URI("http://example.com/objecttype")

        val zaakInstanceUrl = setupZaakInstanceLink(documentId)
        setupPlugins(zaakInstanceUrl)

        //set up objecttype with multiple objects for that type
        val objecttype = mock<Objecttype>()
        whenever(objecttype.name).thenReturn(objecttypeName)
        setupObjectForObjecttype(zaakInstanceUrl, objecttype, objecttypeUrl)
        setupObjectForObjecttype(zaakInstanceUrl, objecttype, objecttypeUrl)

        val exception = assertThrows(IllegalStateException::class.java) {
            zaakObjectService.getZaakObjectOfTypeByName(documentId, objecttypeName)
        }

        assertEquals("More than one object of type 'test' was found for document $documentId",
            exception.message)
    }

    @Test
    fun `should throw exception when getting object by type and there are no objects`() {
        val documentId = UUID.randomUUID()
        val objecttypeName = "test"

        val zaakInstanceUrl = setupZaakInstanceLink(documentId)
        setupPlugins(zaakInstanceUrl)

        val exception = assertThrows(IllegalStateException::class.java) {
            zaakObjectService.getZaakObjectOfTypeByName(documentId, objecttypeName)
        }

        assertEquals("No object was found of type 'test' for document $documentId",
            exception.message)
    }

    @Test
    fun `should get prefilled form for object`() {
        val zaakInstanceUrl = URI("http://not-relevant")
        val objectUrl = URI("http://example.com/object")
        val objecttypeUrl = URI("http://example.com/objecttype")
        val objecttypeName = "some-type"

        setupPlugins(zaakInstanceUrl)
        val theObject = setupObjectWithRelations(zaakInstanceUrl, objecttypeUrl)
        val objecttype = setupObjecttype(theObject)
        whenever(objecttype.name).thenReturn(objecttypeName)
        whenever(objectenApiPlugin?.getObject(objectUrl)).thenReturn(theObject)

        val objectRecord = mock<ObjectRecord>()
        whenever(theObject.record).thenReturn(objectRecord)
        val objectData = MapperSingleton.get().readTree("""
            {
              "test": "test-value"
            }
        """.trimIndent())
        whenever(objectRecord.data).thenReturn(objectData)

        val formDefinition = FormIoFormDefinition(
            UUID.randomUUID(),
            "form-name",
            """
                {
                    "display": "form",
                    "settings": {},
                    "components": [
                        {
                            "label": "Test",
                            "key": "test",
                            "type": "textfield",
                            "input": true
                        }
                    ]
                }
            """.trimIndent(),
            FormDefinitionBlueprintId.forCase(caseDefinitionId),
            false
        )
        whenever(formDefinitionService.getFormDefinitionByNameIgnoringCase("some-type.editform"))
            .thenReturn(Optional.of(formDefinition))

        val resultingForm = zaakObjectService.getZaakObjectForm(objectUrl)

        assertNotNull(resultingForm)
        assertEquals("test-value", resultingForm.formDefinition.get("components").get(0).get("defaultValue").textValue())
    }

    @Test
    fun `should return null when getting form for object and object does not exist`() {
        val zaakInstanceUrl = URI("http://not-relevant")
        val objectUrl = URI("http://example.com/object")

        setupPlugins(zaakInstanceUrl)
        whenever(objectenApiPlugin?.getObject(objectUrl)).thenReturn(null)

        val resultingForm = zaakObjectService.getZaakObjectForm(objectUrl)

        verify(objectenApiPlugin)?.getObject(any())
        assertNull(resultingForm)
    }

    @Test
    fun `should return null when getting form for object and objecttype does not exist`() {
        val zaakInstanceUrl = URI("http://not-relevant")
        val objectUrl = URI("http://example.com/object")
        val objecttypeUrl = URI("http://example.com/objecttype")

        setupPlugins(zaakInstanceUrl)
        val theObject = setupObjectWithRelations(zaakInstanceUrl, objecttypeUrl)
        whenever(objectenApiPlugin?.getObject(objectUrl)).thenReturn(theObject)

        val objectRecord = mock<ObjectRecord>()
        whenever(theObject.record).thenReturn(objectRecord)
        val objectData = MapperSingleton.get().readTree("""
            {
              "test": "test-value"
            }
        """.trimIndent())
        whenever(objectRecord.data).thenReturn(objectData)

        val resultingForm = zaakObjectService.getZaakObjectForm(objectUrl)

        verify(objecttypenApiPlugin)?.getObjecttype(any())
        assertNull(resultingForm)
    }

    @Test
    fun `should return null when getting form for object and form does not exist`() {
        val zaakInstanceUrl = URI("http://not-relevant")
        val objectUrl = URI("http://example.com/object")
        val objecttypeUrl = URI("http://example.com/objecttype")
        val objecttypeName = "some-type"

        setupPlugins(zaakInstanceUrl)
        val theObject = setupObjectWithRelations(zaakInstanceUrl, objecttypeUrl)
        val objecttype = setupObjecttype(theObject)
        whenever(objecttype.name).thenReturn(objecttypeName)
        whenever(objectenApiPlugin?.getObject(objectUrl)).thenReturn(theObject)

        val objectRecord = mock<ObjectRecord>()
        whenever(theObject.record).thenReturn(objectRecord)
        val objectData = MapperSingleton.get().readTree("""
            {
              "test": "test-value"
            }
        """.trimIndent())
        whenever(objectRecord.data).thenReturn(objectData)

        whenever(formDefinitionService.getFormDefinitionByNameIgnoringCase("some-type.editform")).thenReturn(null)

        val resultingForm = zaakObjectService.getZaakObjectForm(objectUrl)

        verify(formDefinitionService).getFormDefinitionByNameIgnoringCase("some-type.editform")
        assertNull(resultingForm)
    }

    @Test
    fun `should not call objecten api on update when object url is foreign`() {
        val client = setupRealObjectenApiPlugin()
        setupObjectManagement()

        assertThrows(ObjectUrlNotAllowedException::class.java) {
            zaakObjectService.updateObject(
                objectManagementId,
                URI("http://objecten.attacker.tld/api/v2/objects/1"),
                MapperSingleton.get().createObjectNode()
            )
        }

        verifyNoInteractions(client)
    }

    @Test
    fun `should not call objecten api on delete when object url is foreign`() {
        val client = setupRealObjectenApiPlugin()
        setupObjectManagement()

        assertThrows(ObjectUrlNotAllowedException::class.java) {
            zaakObjectService.deleteObject(objectManagementId, objectUrl = URI("http://attacker.tld/api/v2/objects/1"))
        }

        verifyNoInteractions(client)
    }

    @Test
    fun `should delete object when object url belongs to objecten api`() {
        val client = setupRealObjectenApiPlugin()
        setupObjectManagement()
        val objectUrl = URI("$OBJECTEN_URL/objects/${UUID.randomUUID()}")
        whenever(client.deleteObject(any(), eq(objectUrl))).thenReturn(HttpStatus.NO_CONTENT)

        val status = zaakObjectService.deleteObject(objectManagementId, objectUrl = objectUrl)

        assertEquals(HttpStatus.NO_CONTENT, status)
        verify(client).deleteObject(any(), eq(objectUrl))
    }

    @Test
    fun `should resolve object url from object id on delete`() {
        val client = setupRealObjectenApiPlugin()
        setupObjectManagement()
        val objectId = UUID.randomUUID()
        val objectUrl = URI("$OBJECTEN_URL/objects/$objectId")
        whenever(client.deleteObject(any(), eq(objectUrl))).thenReturn(HttpStatus.NO_CONTENT)

        zaakObjectService.deleteObject(objectManagementId, objectId = objectId)

        verify(client).deleteObject(any(), eq(objectUrl))
    }

    @Test
    fun `should return null when getting object by foreign url`() {
        val foreignUrl = URI("http://objecten.attacker.tld/api/v2/objects/1")
        val plugin = mock<ObjectenApiPlugin>()
        whenever(pluginService.createInstance(eq(ObjectenApiPlugin::class.java), any())).thenAnswer { invocation ->
            @Suppress("UNCHECKED_CAST")
            val matcher = invocation.getArgument<(JsonNode) -> Boolean>(1)
            val properties = MapperSingleton.get().createObjectNode().put(ObjectenApiPlugin.URL_PROPERTY, OBJECTEN_URL)
            if (matcher(properties)) plugin else null
        }

        assertNull(zaakObjectService.getObjectByObjectUrl(foreignUrl))
        verify(plugin, never()).getObject(any())
    }

    private fun setupRealObjectenApiPlugin(): ObjectenApiClient {
        val client = mock<ObjectenApiClient>()
        val plugin = ObjectenApiPlugin(client)
        plugin.authenticationPluginConfiguration = mock()
        plugin.url = URI(OBJECTEN_URL)
        val configurationId = UUID.randomUUID()
        whenever(pluginService.createInstance(PluginConfigurationId(configurationId))).thenReturn(plugin)
        objectenApiConfigurationId = configurationId
        return client
    }

    private fun setupObjectManagement() {
        val objecttypenPlugin = mock<ObjecttypenApiPlugin>()
        val objecttypenConfigurationId = UUID.randomUUID()
        whenever(pluginService.createInstance(PluginConfigurationId(objecttypenConfigurationId)))
            .thenReturn(objecttypenPlugin)
        whenever(objecttypenPlugin.getObjectTypeUrlById(any())).thenReturn(URI("http://example.com/objecttype"))

        val info = mock<ObjectManagementInfo>()
        whenever(info.objectenApiPluginConfigurationId).thenReturn(objectenApiConfigurationId)
        whenever(info.objecttypenApiPluginConfigurationId).thenReturn(objecttypenConfigurationId)
        whenever(info.objecttypeId).thenReturn("type-id")
        whenever(info.objecttypeVersion).thenReturn(1)
        whenever(objectManagementInfoProvider.getObjectManagementInfo(objectManagementId)).thenReturn(info)
    }

    private fun setupZaakInstanceLink(documentId: UUID): URI {
        val zaakInstanceUrl = URI("http://example.com/zaak/${UUID.randomUUID()}")
        whenever(zaakUrlProvider.getZaakUrl(documentId)).thenReturn(zaakInstanceUrl)
        return zaakInstanceUrl
    }

    private fun setupPlugins(zaakUrl: URI) {
        zaakPlugin = mock()
        whenever(pluginService.createInstance(eq(ZakenApiPlugin::class.java), any()))
            .thenReturn(zaakPlugin)

        objectenApiPlugin = mock()
        whenever(pluginService.createInstance(eq(ObjectenApiPlugin::class.java), any()))
            .thenReturn(objectenApiPlugin)

        objecttypenApiPlugin = mock()
        whenever(pluginService.createInstance(eq(ObjecttypenApiPlugin::class.java), any()))
            .thenReturn(objecttypenApiPlugin)

        whenever(zaakPlugin?.getZaakObjecten(zaakUrl)).thenReturn(zaakObjecten)
    }

    private fun setupObjecttypeWithRelations(zaakUrl: URI): Objecttype {
        val zaakobject = setupZaakObject(zaakUrl)
        val objectWrapper = setupObject(zaakobject)
        return setupObjecttype(objectWrapper)
    }

    private fun setupObjectForObjecttype(zaakUrl: URI, objecttype: Objecttype, objecttypeUrl: URI): ObjectWrapper {
        val zaakobject = setupZaakObject(zaakUrl)
        val objectWrapper = setupObject(zaakobject, objecttypeUrl)
        mockObjecttypeRetrieval(objectWrapper, objecttype)
        return objectWrapper
    }

    private fun setupObjectWithRelations(zaakUrl: URI, objecttypeUrl: URI): ObjectWrapper {
        val zaakobject = setupZaakObject(zaakUrl)
        return setupObject(zaakobject, objecttypeUrl)
    }

    private fun setupZaakObject(zaakUrl: URI): ZaakObject{
        val zaakObject = mock<ZaakObject>()
        val objectUrl = URI("http://example.com/object/${UUID.randomUUID()}")
        whenever(zaakObject.objectUrl).thenReturn(objectUrl)
        zaakObjecten.add(zaakObject)
        return zaakObject
    }

    private fun setupObject(zaakObject: ZaakObject, objecttypeUrl: URI? = null): ObjectWrapper{
        val objectWrapper = mock<ObjectWrapper>()
        val defaultObjecttypeUrl = URI("http://example.com/objecttype/${UUID.randomUUID()}")
        whenever(objectWrapper.type).thenReturn(objecttypeUrl?:defaultObjecttypeUrl)
        whenever(objectenApiPlugin?.getObject(zaakObject.objectUrl)).thenReturn(objectWrapper)
        return objectWrapper
    }

    private fun setupObjecttype(referringObject: ObjectWrapper): Objecttype {
        val objecttype = mock<Objecttype>()
        mockObjecttypeRetrieval(referringObject, objecttype)
        return objecttype
    }

    private fun mockObjecttypeRetrieval(referringObject: ObjectWrapper, objecttype: Objecttype): Objecttype {
        whenever(objecttypenApiPlugin?.getObjecttype(referringObject.type)).thenReturn(objecttype)
        return objecttype
    }

    companion object {
        private const val OBJECTEN_URL = "http://objecten.example.com/api/v2"
    }
}
