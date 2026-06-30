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

package com.ritense.documentenapi

import com.ritense.documentenapi.DocumentenApiPlugin.Companion.DOCUMENT_ID_PROCESS_VAR
import com.ritense.documentenapi.DocumentenApiPlugin.Companion.DOCUMENT_URL_PROCESS_VAR
import com.ritense.documentenapi.DocumentenApiPlugin.Companion.RESOURCE_ID_PROCESS_VAR
import com.ritense.documentenapi.client.CreateDocumentRequest
import com.ritense.documentenapi.client.CreateDocumentResult
import com.ritense.documentenapi.client.DocumentInformatieObject
import com.ritense.documentenapi.client.DocumentLock
import com.ritense.documentenapi.client.DocumentStatusType.DEFINITIEF
import com.ritense.documentenapi.client.DocumentStatusType.IN_BEWERKING
import com.ritense.documentenapi.client.DocumentenApiClient
import com.ritense.documentenapi.client.ObjectInformatieObject
import com.ritense.documentenapi.client.ObjectInformatieObjectRequest
import com.ritense.documentenapi.client.PatchDocumentRequest
import com.ritense.documentenapi.domain.DocumentenApiVersion
import com.ritense.documentenapi.event.DocumentCreated
import com.ritense.documentenapi.service.DocumentenApiVersionService
import com.ritense.documentenapi.service.DocumentenApiVersionService.Companion.MINIMUM_VERSION
import com.ritense.plugin.annotation.Plugin
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.domain.PluginDefinition
import com.ritense.plugin.service.PluginService
import com.ritense.resource.domain.VirusScanResult
import com.ritense.resource.domain.VirusScanStatus
import com.ritense.resource.service.TemporaryResourceStorageService
import com.ritense.resource.service.VirusScanService
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valtimo.contract.upload.VirusDetectedException
import com.ritense.valtimo.operaton.service.OperatonRuntimeService
import com.ritense.zgw.Rsin
import com.ritense.zgw.domain.Vertrouwelijkheid
import org.apache.commons.io.IOUtils
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.springframework.context.ApplicationEventPublisher
import java.io.ByteArrayInputStream
import java.net.URI
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

internal class DocumentenApiPluginTest {

    lateinit var pluginService: PluginService
    lateinit var client: DocumentenApiClient
    lateinit var runtimeService: OperatonRuntimeService
    lateinit var virusScanService: VirusScanService

    @BeforeEach
    fun setUp() {
        pluginService = mock()

        val pluginDefinition = PluginDefinition(
            key = "key",
            description = "description",
            fullyQualifiedClassName = "className",
            title = "title"
        )
        val pluginConfiguration = PluginConfiguration(
            id = PluginConfigurationId(UUID.randomUUID()),
            pluginDefinition = pluginDefinition,
            title = "title"
        )
        whenever(pluginService.findPluginConfiguration(any(), any()))
            .thenReturn(pluginConfiguration)

        client = mock()
        runtimeService = mock()
        virusScanService = mock()
    }

    @Test
    fun `should throw error when businessKey is null`() {
        val storageService: TemporaryResourceStorageService = mock()
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        val objectMapper = MapperSingleton.get()
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        val executionMock = mock<DelegateExecution>()
        val virusScanEnabledForDocumentenApiPlugin = false

        whenever(executionMock.getVariable("localDocumentVariableName"))
            .thenReturn("localDocumentLocation")
        whenever(executionMock.businessKey).thenReturn(null)

        val plugin = DocumentenApiPlugin(
            client = client,
            storageService = storageService,
            applicationEventPublisher = applicationEventPublisher,
            objectMapper = objectMapper,
            documentDeleteHandlers = mutableListOf(),
            documentenApiVersionService = documentenApiVersionService,
            pluginService = pluginService,
            runtimeService = runtimeService,
            virusScanService = virusScanService,
            virusScanEnabledForDocumentenApiPlugin = virusScanEnabledForDocumentenApiPlugin
        )
        plugin.url = URI("http://some-url")
        plugin.bronorganisatie = "123456789"

        val exception = assertThrows<IllegalStateException> {
            plugin.storeTemporaryDocument(
                execution = executionMock,
                fileName = "test.ext",
                confidentialityLevel = Vertrouwelijkheid.ZAAKVERTROUWELIJK.key,
                title = "title",
                description = "description",
                localDocumentLocation = "localDocumentVariableName",
                storedDocumentUrl = "storedDocumentVariableName",
                informatieobjecttype = "type",
                taal = "taal",
                status = IN_BEWERKING
            )
        }
        assertEquals("Failed to store document. Business key is null.", exception.message)
    }

    @Test
    fun `should call client to store file`() {
        val storageService: TemporaryResourceStorageService = mock()
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        val authenticationMock = mock<DocumentenApiAuthentication>()
        val objectMapper = MapperSingleton.get()
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        val pluginConfiguration: PluginConfiguration = mock()
        val pluginConfigurationId: PluginConfigurationId = mock()
        val executionMock = mock<DelegateExecution>()
        val content = "contentForRequest"
        val inputStream = ByteArrayInputStream(content.toByteArray())
        val virusScanEnabledForDocumentenApiPlugin = false
        val result = CreateDocumentResult(
            url = "returnedUrl",
            auteur = "returnedAuthor",
            bestandsnaam = "returnedFileName",
            bestandsomvang = 1L,
            beginRegistratie = OffsetDateTime.parse("2020-01-01T01:01:01Z"),
            bestandsdelen = listOf(),
            lock = null
        )

        whenever(executionMock.getVariable("localDocumentVariableName"))
            .thenReturn("localDocumentLocation")
        whenever(executionMock.businessKey).thenReturn("123e4567-e89b-12d3-a456-426655440000")
        whenever(storageService.getResourceContentAsInputStream("localDocumentLocation"))
            .thenReturn(inputStream)
        whenever(client.storeDocument(any(), any(), any(), any())).thenReturn(result)

        val plugin = DocumentenApiPlugin(
            client = client,
            storageService = storageService,
            applicationEventPublisher = applicationEventPublisher,
            objectMapper = objectMapper,
            documentDeleteHandlers = mutableListOf(),
            documentenApiVersionService = documentenApiVersionService,
            pluginService = pluginService,
            runtimeService = runtimeService,
            virusScanService = virusScanService,
            virusScanEnabledForDocumentenApiPlugin = virusScanEnabledForDocumentenApiPlugin
        )
        plugin.url = URI("http://some-url")
        plugin.bronorganisatie = "123456789"
        plugin.authenticationPluginConfiguration = authenticationMock

        whenever(pluginConfiguration.id).thenReturn(pluginConfigurationId)
        whenever(pluginConfigurationId.id).thenReturn(UUID.randomUUID())

        val pluginAnnotation: Plugin = mock()
        whenever(pluginAnnotation.key).thenReturn("documentenApiPluginKey")
        whenever(
            pluginService.findPluginConfiguration(
                eq(DocumentenApiPlugin::class.java),
                any()
            )
        ).thenReturn(pluginConfiguration)

        plugin.storeTemporaryDocument(
            execution = executionMock,
            fileName = "test.ext",
            confidentialityLevel = Vertrouwelijkheid.ZAAKVERTROUWELIJK.key,
            title = "title",
            description = "description",
            localDocumentLocation = "localDocumentVariableName",
            storedDocumentUrl = "storedDocumentVariableName",
            informatieobjecttype = "type",
            taal = "taal",
            status = IN_BEWERKING
        )

        val apiRequestCaptor = argumentCaptor<CreateDocumentRequest>()
        val eventCaptor = argumentCaptor<DocumentCreated>()
        verify(client).storeDocument(any(), any(), any(), apiRequestCaptor.capture())
        verify(applicationEventPublisher).publishEvent(eventCaptor.capture())
        verify(executionMock).setVariable("storedDocumentVariableName", "returnedUrl")

        val request = apiRequestCaptor.firstValue
        assertEquals("123456789", request.bronorganisatie)
        assertNotNull(request.creatiedatum)
        assertEquals("title", request.titel)
        assertEquals("GZAC", request.auteur)
        assertEquals("test.ext", request.bestandsnaam)
        assertEquals(Vertrouwelijkheid.ZAAKVERTROUWELIJK, request.vertrouwelijkheidaanduiding)
        assertEquals("taal", request.taal)
        assertEquals(content, IOUtils.toString(request.inhoud, Charsets.UTF_8))
        assertEquals("type", request.informatieobjecttype)
        assertEquals(IN_BEWERKING, request.status)
        assertEquals(false, request.indicatieGebruiksrecht)

        val emittedEvent = eventCaptor.firstValue
        assertEquals("returnedUrl", emittedEvent.url)
        assertEquals("returnedAuthor", emittedEvent.auteur)
        assertEquals("returnedFileName", emittedEvent.bestandsnaam)
        assertEquals(1L, emittedEvent.bestandsomvang)
        assertEquals(LocalDateTime.of(2020, 1, 1, 1, 1, 1), emittedEvent.beginRegistratie)
    }

    @Test
    fun `should call virus scan store file and throw exception when scan fails`() {
        val storageService: TemporaryResourceStorageService = mock()
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        val authenticationMock = mock<DocumentenApiAuthentication>()
        val objectMapper = MapperSingleton.get()
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        val pluginConfiguration: PluginConfiguration = mock()
        val pluginConfigurationId: PluginConfigurationId = mock()
        val executionMock = mock<DelegateExecution>()
        val content = "contentForRequest"
        val inputStream = ByteArrayInputStream(content.toByteArray())
        val virusScanEnabledForDocumentenApiPlugin = true
        val result = CreateDocumentResult(
            url = "returnedUrl",
            auteur = "returnedAuthor",
            bestandsnaam = "returnedFileName",
            bestandsomvang = 1L,
            beginRegistratie = OffsetDateTime.parse("2020-01-01T01:01:01Z"),
            bestandsdelen = listOf(),
            lock = null
        )
        val byFileResult = VirusScanResult(
            status = VirusScanStatus.VIRUS_FOUND,
            foundViruses = mapOf(
                "/tmp/upload/doc1.pdf" to listOf("Eicar-Test-Signature"),
                "/tmp/upload/image.png" to listOf("Dummy.Worm.XYZ")
            )
        )
        whenever(executionMock.getVariable("localDocumentVariableName"))
            .thenReturn("localDocumentLocation")
        whenever(virusScanService.scan(content.toByteArray()))
            .thenReturn(byFileResult)
        whenever(storageService.getResourceContentAsInputStream("localDocumentLocation"))
            .thenReturn(inputStream)
        whenever(client.storeDocument(any(), any(), any(), any())).thenReturn(result)

        val plugin = DocumentenApiPlugin(
            client = client,
            storageService = storageService,
            applicationEventPublisher = applicationEventPublisher,
            objectMapper = objectMapper,
            documentDeleteHandlers = mutableListOf(),
            documentenApiVersionService = documentenApiVersionService,
            pluginService = pluginService,
            runtimeService = runtimeService,
            virusScanService = virusScanService,
            virusScanEnabledForDocumentenApiPlugin = virusScanEnabledForDocumentenApiPlugin
        )
        plugin.url = URI("http://some-url")
        plugin.bronorganisatie = "123456789"
        plugin.authenticationPluginConfiguration = authenticationMock

        whenever(pluginConfiguration.id).thenReturn(pluginConfigurationId)
        whenever(pluginConfigurationId.id).thenReturn(UUID.randomUUID())

        val pluginAnnotation: Plugin = mock()
        whenever(pluginAnnotation.key).thenReturn("documentenApiPluginKey")
        whenever(
            pluginService.findPluginConfiguration(
                eq(DocumentenApiPlugin::class.java),
                any()
            )
        ).thenReturn(pluginConfiguration)

        assertThrows<VirusDetectedException> {
            plugin.storeTemporaryDocument(
                execution = executionMock,
                fileName = "test.ext",
                confidentialityLevel = Vertrouwelijkheid.ZAAKVERTROUWELIJK.key,
                title = "title",
                description = "description",
                localDocumentLocation = "localDocumentVariableName",
                storedDocumentUrl = "storedDocumentVariableName",
                informatieobjecttype = "type",
                taal = "taal",
                status = IN_BEWERKING
            )
        }
    }

    @Test
    fun `should call virus scan when storing file and pass scan`() {
        val storageService: TemporaryResourceStorageService = mock()
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        val authenticationMock = mock<DocumentenApiAuthentication>()
        val objectMapper = MapperSingleton.get()
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        val pluginConfiguration: PluginConfiguration = mock()
        val pluginConfigurationId: PluginConfigurationId = mock()
        val executionMock = mock<DelegateExecution>()
        val content = "contentForRequest"
        val inputStream = ByteArrayInputStream(content.toByteArray())
        val virusScanEnabledForDocumentenApiPlugin = true
        val result = CreateDocumentResult(
            url = "returnedUrl",
            auteur = "returnedAuthor",
            bestandsnaam = "returnedFileName",
            bestandsomvang = 1L,
            beginRegistratie = OffsetDateTime.parse("2020-01-01T01:01:01Z"),
            bestandsdelen = listOf(),
            lock = null
        )

        whenever(executionMock.getVariable("localDocumentVariableName"))
            .thenReturn("localDocumentLocation")
        whenever(executionMock.businessKey).thenReturn("123e4567-e89b-12d3-a456-426655440000")
        whenever(virusScanService.scan(content.toByteArray()))
            .thenReturn(VirusScanResult(VirusScanStatus.OK,mapOf()))
        whenever(storageService.getResourceContentAsInputStream("localDocumentLocation"))
            .thenReturn(inputStream)
        whenever(client.storeDocument(any(), any(), any(), any())).thenReturn(result)

        val plugin = DocumentenApiPlugin(
            client = client,
            storageService = storageService,
            applicationEventPublisher = applicationEventPublisher,
            objectMapper = objectMapper,
            documentDeleteHandlers = mutableListOf(),
            documentenApiVersionService = documentenApiVersionService,
            pluginService = pluginService,
            runtimeService = runtimeService,
            virusScanService = virusScanService,
            virusScanEnabledForDocumentenApiPlugin = virusScanEnabledForDocumentenApiPlugin
        )
        plugin.url = URI("http://some-url")
        plugin.bronorganisatie = "123456789"
        plugin.authenticationPluginConfiguration = authenticationMock

        whenever(pluginConfiguration.id).thenReturn(pluginConfigurationId)
        whenever(pluginConfigurationId.id).thenReturn(UUID.randomUUID())

        val pluginAnnotation: Plugin = mock()
        whenever(pluginAnnotation.key).thenReturn("documentenApiPluginKey")
        whenever(
            pluginService.findPluginConfiguration(
                eq(DocumentenApiPlugin::class.java),
                any()
            )
        ).thenReturn(pluginConfiguration)

        plugin.storeTemporaryDocument(
            execution = executionMock,
            fileName = "test.ext",
            confidentialityLevel = Vertrouwelijkheid.ZAAKVERTROUWELIJK.key,
            title = "title",
            description = "description",
            localDocumentLocation = "localDocumentVariableName",
            storedDocumentUrl = "storedDocumentVariableName",
            informatieobjecttype = "type",
            taal = "taal",
            status = IN_BEWERKING
        )

        val apiRequestCaptor = argumentCaptor<CreateDocumentRequest>()
        val eventCaptor = argumentCaptor<DocumentCreated>()
        verify(client).storeDocument(any(), any(), any(), apiRequestCaptor.capture())
        verify(applicationEventPublisher).publishEvent(eventCaptor.capture())
        verify(virusScanService, times(1)).scan(content.toByteArray())
    }

    @Test
    fun `should call client to store file after document upload`() {
        val storageService: TemporaryResourceStorageService = mock()
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        val authenticationMock = mock<DocumentenApiAuthentication>()
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        val pluginConfiguration: PluginConfiguration = mock()
        val pluginConfigurationId: PluginConfigurationId = mock()
        val executionMock = mock<DelegateExecution>()
        val content = "contentForRequest"
        val virusScanEnabledForDocumentenApiPlugin = false
        val inputStream = ByteArrayInputStream(content.toByteArray())
        val result = CreateDocumentResult(
            url = "returnedUrl",
            auteur = "returnedAuthor",
            bestandsnaam = "returnedFileName",
            bestandsomvang = 1L,
            beginRegistratie = OffsetDateTime.now(),
            bestandsdelen = listOf(),
            lock = null
        )

        whenever(executionMock.getVariable(RESOURCE_ID_PROCESS_VAR))
            .thenReturn("localDocumentLocation")
        whenever(storageService.getResourceContentAsInputStream("localDocumentLocation"))
            .thenReturn(inputStream)
        whenever(storageService.getResourceMetadata("localDocumentLocation"))
            .thenReturn(
                mapOf(
                    "title" to "title",
                    "confidentialityLevel" to "zaakvertrouwelijk",
                    "status" to "in_bewerking",
                    "author" to "author",
                    "language" to "taal",
                    "filename" to "wrong.ext", //This key is automatically added by the tempresource, and should be ignored when bestandsnaam is set
                    "bestandsnaam" to "test.ext",
                    "description" to "description",
                    "receiptDate" to "2022-09-15",
                    "sendDate" to "2022-09-16",
                    "description" to "description",
                    "informatieobjecttype" to "type"
                )
            )
        whenever(client.storeDocument(any(), any(), any(), any())).thenReturn(result)
        whenever(executionMock.businessKey).thenReturn("123e4567-e89b-12d3-a456-426655440000")
        whenever(pluginConfiguration.id).thenReturn(pluginConfigurationId)
        whenever(pluginConfigurationId.id).thenReturn(UUID.randomUUID())

        val pluginAnnotation: Plugin = mock()
        whenever(pluginAnnotation.key).thenReturn("documentenApiPluginKey")
        whenever(
            pluginService.findPluginConfiguration(
                eq(DocumentenApiPlugin::class.java),
                any()
            )
        ).thenReturn(pluginConfiguration)

        val plugin = DocumentenApiPlugin(
            client = client,
            storageService = storageService,
            applicationEventPublisher = applicationEventPublisher,
            objectMapper = MapperSingleton.get(),
            documentDeleteHandlers = mutableListOf(),
            documentenApiVersionService = documentenApiVersionService,
            pluginService = pluginService,
            runtimeService = runtimeService,
            virusScanService = virusScanService,
            virusScanEnabledForDocumentenApiPlugin = virusScanEnabledForDocumentenApiPlugin
        )
        plugin.url = URI("http://some-url")
        plugin.bronorganisatie = "123456789"
        plugin.authenticationPluginConfiguration = authenticationMock

        plugin.storeUploadedDocument(executionMock)

        val apiRequestCaptor = argumentCaptor<CreateDocumentRequest>()
        verify(client).storeDocument(any(), any(), any(), apiRequestCaptor.capture())
        verify(executionMock).setVariable(DOCUMENT_URL_PROCESS_VAR, "returnedUrl")

        val request = apiRequestCaptor.firstValue
        assertEquals("123456789", request.bronorganisatie)
        assertNotNull(request.creatiedatum)
        assertEquals(LocalDate.of(2022, 9, 16), request.verzenddatum)
        assertEquals(LocalDate.of(2022, 9, 15), request.ontvangstdatum)
        assertEquals("title", request.titel)
        assertEquals("author", request.auteur)
        assertEquals("description", request.beschrijving)
        assertEquals("test.ext", request.bestandsnaam)
        assertEquals("taal", request.taal)
        assertEquals(content, IOUtils.toString(request.inhoud, Charsets.UTF_8))
        assertEquals("type", request.informatieobjecttype)
        assertEquals(IN_BEWERKING, request.status)
        assertEquals(false, request.indicatieGebruiksrecht)
        assertEquals(Vertrouwelijkheid.ZAAKVERTROUWELIJK, request.vertrouwelijkheidaanduiding)
    }

    @Test
    fun `should call client to store file after document upload with minimal properties`() {
        val storageService: TemporaryResourceStorageService = mock()
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        val authenticationMock = mock<DocumentenApiAuthentication>()
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        val pluginConfiguration: PluginConfiguration = mock()
        val pluginConfigurationId: PluginConfigurationId = mock()
        val executionMock = mock<DelegateExecution>()
        val content = "contentForRequest"
        val inputStream = ByteArrayInputStream(content.toByteArray())
        val virusScanEnabledForDocumentenApiPlugin = false
        val result = CreateDocumentResult(
            url = "returnedUrl",
            auteur = "returnedAuthor",
            bestandsnaam = "returnedFileName",
            bestandsomvang = 1L,
            beginRegistratie = OffsetDateTime.now(),
            bestandsdelen = listOf(),
            lock = null
        )

        whenever(executionMock.getVariable(RESOURCE_ID_PROCESS_VAR))
            .thenReturn("localDocumentLocation")
        whenever(executionMock.businessKey).thenReturn("123e4567-e89b-12d3-a456-426655440000")
        whenever(storageService.getResourceContentAsInputStream("localDocumentLocation"))
            .thenReturn(inputStream)
        whenever(storageService.getResourceMetadata("localDocumentLocation"))
            .thenReturn(
                mapOf(
                    "title" to "title",
                    "status" to "in_bewerking",
                    "language" to "taal",
                    "filename" to "test.ext",
                    "informatieobjecttype" to "type"
                )
            )
        whenever(client.storeDocument(any(), any(), any(), any())).thenReturn(result)

        val plugin = DocumentenApiPlugin(
            client = client,
            storageService = storageService,
            applicationEventPublisher = applicationEventPublisher,
            objectMapper = MapperSingleton.get(),
            documentDeleteHandlers = listOf(),
            documentenApiVersionService = documentenApiVersionService,
            pluginService = pluginService,
            runtimeService = runtimeService,
            virusScanService = virusScanService,
            virusScanEnabledForDocumentenApiPlugin = virusScanEnabledForDocumentenApiPlugin
        )
        plugin.url = URI("http://some-url")
        plugin.bronorganisatie = "123456789"
        plugin.authenticationPluginConfiguration = authenticationMock

        whenever(pluginConfiguration.id).thenReturn(pluginConfigurationId)
        whenever(pluginConfigurationId.id).thenReturn(UUID.randomUUID())

        val pluginAnnotation: Plugin = mock()
        whenever(pluginAnnotation.key).thenReturn("documentenApiPluginKey")
        whenever(
            pluginService.findPluginConfiguration(
                eq(DocumentenApiPlugin::class.java),
                any()
            )
        ).thenReturn(pluginConfiguration)

        plugin.storeUploadedDocument(executionMock)

        val apiRequestCaptor = argumentCaptor<CreateDocumentRequest>()
        verify(client).storeDocument(any(), any(), any(), apiRequestCaptor.capture())
        verify(executionMock).setVariable(DOCUMENT_URL_PROCESS_VAR, "returnedUrl")

        val request = apiRequestCaptor.firstValue
        assertEquals("123456789", request.bronorganisatie)
        assertNotNull(request.creatiedatum)
        assertNull(request.verzenddatum)
        assertNull(request.ontvangstdatum)
        assertEquals("title", request.titel)
        assertNull(request.beschrijving)
        assertEquals("GZAC", request.auteur)
        assertEquals("test.ext", request.bestandsnaam)
        assertEquals("taal", request.taal)
        assertEquals(content, IOUtils.toString(request.inhoud, Charsets.UTF_8))
        assertEquals("type", request.informatieobjecttype)
        assertEquals(IN_BEWERKING, request.status)
        assertEquals(false, request.indicatieGebruiksrecht)
        assertNull(request.vertrouwelijkheidaanduiding)
    }

    @Test
    fun `should call client to get document`() {
        val storageService: TemporaryResourceStorageService = mock()
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        val authenticationMock = mock<DocumentenApiAuthentication>()
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        val virusScanEnabledForDocumentenApiPlugin = false

        val plugin = DocumentenApiPlugin(
            client = client,
            storageService = storageService,
            applicationEventPublisher = applicationEventPublisher,
            objectMapper = MapperSingleton.get(),
            documentDeleteHandlers = listOf(),
            documentenApiVersionService = documentenApiVersionService,
            pluginService = pluginService,
            runtimeService = runtimeService,
            virusScanService = virusScanService,
            virusScanEnabledForDocumentenApiPlugin = virusScanEnabledForDocumentenApiPlugin
        )
        plugin.url = URI("http://some-url")
        plugin.bronorganisatie = "123456789"
        plugin.authenticationPluginConfiguration = authenticationMock
        val caseDocumentId = UUID.randomUUID()
        val informatieObjectUrl = URI("http://some-url/informatie-object/123")
        plugin.getInformatieObject(informatieObjectUrl, caseDocumentId)

        val informatieObjectUrlCaptor = argumentCaptor<URI>()
        val authorizationCaptor = argumentCaptor<DocumentenApiAuthentication>()
        val caseDocumentIdCaptor = argumentCaptor<UUID>()

        verify(client).getInformatieObject(
            authentication = authorizationCaptor.capture(),
            caseDocumentId = caseDocumentIdCaptor.capture(),
            objectUrl = informatieObjectUrlCaptor.capture(),
        )

        assertEquals(informatieObjectUrl, informatieObjectUrlCaptor.firstValue)
        assertEquals(authenticationMock, authorizationCaptor.firstValue)
    }

    @Test
    fun `should not modify definitief document when version does not support it`() {
        val storageService: TemporaryResourceStorageService = mock()
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        val authenticationMock = mock<DocumentenApiAuthentication>()
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        val virusScanEnabledForDocumentenApiPlugin = false
        val informatieObjectUrl = URI("http://some-url/informatie-object/123")
        val caseDocumentId = UUID.randomUUID()
        val plugin = DocumentenApiPlugin(
            client = client,
            storageService = storageService,
            applicationEventPublisher = applicationEventPublisher,
            objectMapper = MapperSingleton.get(),
            documentDeleteHandlers = listOf(),
            documentenApiVersionService = documentenApiVersionService,
            pluginService = pluginService,
            runtimeService = runtimeService,
            virusScanService = virusScanService,
            virusScanEnabledForDocumentenApiPlugin = virusScanEnabledForDocumentenApiPlugin
        )
        plugin.url = URI("http://some-url")
        plugin.bronorganisatie = "123456789"
        plugin.authenticationPluginConfiguration = authenticationMock
        plugin.apiVersion = "1.0.0"
        whenever(documentenApiVersionService.getVersionByTag(plugin.apiVersion)).thenReturn(MINIMUM_VERSION)
        whenever(client.lockInformatieObject(authenticationMock, informatieObjectUrl)).thenReturn(DocumentLock("lock"))
        whenever( client.getInformatieObject(authenticationMock, caseDocumentId, informatieObjectUrl)).thenReturn(
            DocumentInformatieObject(
                url = informatieObjectUrl,
                bronorganisatie = Rsin("000000000"),
                creatiedatum = LocalDate.now(),
                titel = "titel",
                auteur = "auteur",
                taal = "taal",
                beginRegistratie = OffsetDateTime.now(),
                status = DEFINITIEF
            )
        )

        val exception = assertThrows<Exception> {
            plugin.modifyInformatieObject(
                caseDocumentId = caseDocumentId,
                documentUrl = informatieObjectUrl,
                patchDocumentRequest = PatchDocumentRequest(LocalDate.now(), "Nieuwe titel", "auteur", DEFINITIEF, "taal")
            )
        }
        assertEquals("InformatieObject 123 with status 'definitief' cannot be updated in Documenten API with '1.0.0'", exception.message)
    }

    @Test
    fun `should call client to get audit trail`() {
        val storageService: TemporaryResourceStorageService = mock()
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        val authenticationMock = mock<DocumentenApiAuthentication>()
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        val virusScanEnabledForDocumentenApiPlugin = false
        val executionMock = mock<DelegateExecution>()
        val documentUrl = URI("http://some-url/enkelvoudiginformatieobjecten/some-uuid")

        whenever(executionMock.businessKey).thenReturn("123e4567-e89b-12d3-a456-426655440000")
        whenever(client.getAuditTrail(any(), any(), any())).thenReturn(emptyList())

        val plugin = DocumentenApiPlugin(
            client = client,
            storageService = storageService,
            applicationEventPublisher = applicationEventPublisher,
            objectMapper = MapperSingleton.get(),
            documentDeleteHandlers = listOf(),
            documentenApiVersionService = documentenApiVersionService,
            pluginService = pluginService,
            runtimeService = runtimeService,
            virusScanService = virusScanService,
            virusScanEnabledForDocumentenApiPlugin = virusScanEnabledForDocumentenApiPlugin
        )
        plugin.url = URI("http://some-url")
        plugin.authenticationPluginConfiguration = authenticationMock

        plugin.getAuditTrail(
            execution = executionMock,
            documentUrl = documentUrl,
            processVariableName = "myAuditTrailVar"
        )

        verify(client).getAuditTrail(
            authentication = eq(authenticationMock),
            caseDocumentId = eq(UUID.fromString("123e4567-e89b-12d3-a456-426655440000")),
            documentUrl = eq(documentUrl)
        )
        verify(executionMock).setVariable(eq("myAuditTrailVar"), any<String>())
    }

    @Test
    fun `should throw error when document url does not belong to plugin`() {
        val storageService: TemporaryResourceStorageService = mock()
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        val virusScanEnabledForDocumentenApiPlugin = false
        val executionMock = mock<DelegateExecution>()
        val documentUrl = URI("http://other-url/enkelvoudiginformatieobjecten/some-uuid")

        val plugin = DocumentenApiPlugin(
            client = client,
            storageService = storageService,
            applicationEventPublisher = applicationEventPublisher,
            objectMapper = MapperSingleton.get(),
            documentDeleteHandlers = listOf(),
            documentenApiVersionService = documentenApiVersionService,
            pluginService = pluginService,
            runtimeService = runtimeService,
            virusScanService = virusScanService,
            virusScanEnabledForDocumentenApiPlugin = virusScanEnabledForDocumentenApiPlugin
        )
        plugin.url = URI("http://some-url")

        val exception = assertThrows<IllegalStateException> {
            plugin.getAuditTrail(
                execution = executionMock,
                documentUrl = documentUrl,
                processVariableName = "myAuditTrailVar"
            )
        }
        assertEquals(
            "Failed to get audit trail for document with url 'http://other-url/enkelvoudiginformatieobjecten/some-uuid'. Document isn't part of Documenten API with url 'http://some-url'.",
            exception.message
        )
    }

    @Test
    fun `should throw error when businessKey is null for audit trail`() {
        val storageService: TemporaryResourceStorageService = mock()
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        val virusScanEnabledForDocumentenApiPlugin = false
        val executionMock = mock<DelegateExecution>()
        val documentUrl = URI("http://some-url/enkelvoudiginformatieobjecten/some-uuid")

        whenever(executionMock.businessKey).thenReturn(null)

        val plugin = DocumentenApiPlugin(
            client = client,
            storageService = storageService,
            applicationEventPublisher = applicationEventPublisher,
            objectMapper = MapperSingleton.get(),
            documentDeleteHandlers = listOf(),
            documentenApiVersionService = documentenApiVersionService,
            pluginService = pluginService,
            runtimeService = runtimeService,
            virusScanService = virusScanService,
            virusScanEnabledForDocumentenApiPlugin = virusScanEnabledForDocumentenApiPlugin
        )
        plugin.url = URI("http://some-url")

        val exception = assertThrows<IllegalArgumentException> {
            plugin.getAuditTrail(
                executionMock,
                documentUrl,
                "myAuditTrailVar"
            )
        }
        assertEquals("Failed to get audit trail. Business key is null.", exception.message)
    }

    private fun createPlugin(
        documentenApiVersionService: DocumentenApiVersionService,
        authenticationMock: DocumentenApiAuthentication = mock(),
        apiVersion: String? = null,
    ): DocumentenApiPlugin {
        val plugin = DocumentenApiPlugin(
            client = client,
            storageService = mock(),
            applicationEventPublisher = mock(),
            objectMapper = MapperSingleton.get(),
            documentDeleteHandlers = listOf(),
            documentenApiVersionService = documentenApiVersionService,
            pluginService = pluginService,
            runtimeService = runtimeService,
            virusScanService = virusScanService,
            virusScanEnabledForDocumentenApiPlugin = false
        )
        plugin.url = URI("http://some-url")
        plugin.bronorganisatie = "123456789"
        plugin.authenticationPluginConfiguration = authenticationMock
        plugin.apiVersion = apiVersion
        return plugin
    }

    @Test
    fun `should delegate linkDocumentToObject to client when feature is supported`() {
        val authenticationMock = mock<DocumentenApiAuthentication>()
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        val version = DocumentenApiVersion(version = "1.5.0-baseflow", supportsObjectInformatieObjecten = true)
        whenever(documentenApiVersionService.getVersionByTag("1.5.0-baseflow")).thenReturn(version)

        val plugin = createPlugin(
            documentenApiVersionService = documentenApiVersionService,
            authenticationMock = authenticationMock,
            apiVersion = "1.5.0-baseflow"
        )

        val request = ObjectInformatieObjectRequest(
            informatieobject = URI("http://some-url/enkelvoudiginformatieobjecten/123"),
            `object` = URI("http://some-url/zaken/456"),
            objectType = "zaak",
        )
        val expectedResult = ObjectInformatieObject(
            url = URI("http://some-url/objectinformatieobjecten/789"),
            informatieobject = request.informatieobject,
            `object` = request.`object`,
            objectType = "zaak",
        )
        val caseDocumentId = UUID.randomUUID()
        whenever(client.linkDocument(authenticationMock, plugin.url, caseDocumentId, request))
            .thenReturn(expectedResult)

        val result = plugin.linkDocumentToObject(caseDocumentId, request)

        verify(client).linkDocument(authenticationMock, plugin.url, caseDocumentId, request)
        assertEquals(expectedResult, result)
    }

    @Test
    fun `should throw when linkDocumentToObject is called on unsupported version`() {
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        whenever(documentenApiVersionService.getVersionByTag("1.0.0"))
            .thenReturn(DocumentenApiVersion("1.0.0", supportsObjectInformatieObjecten = false))

        val plugin = createPlugin(
            documentenApiVersionService = documentenApiVersionService,
            apiVersion = "1.0.0"
        )

        val exception = assertThrows<Exception> {
            plugin.linkDocumentToObject(
                UUID.randomUUID(),
                ObjectInformatieObjectRequest(
                    informatieobject = URI("http://some-url/enkelvoudiginformatieobjecten/123"),
                    `object` = URI("http://some-url/zaken/456"),
                    objectType = "zaak",
                )
            )
        }
        assertEquals("Documenten API version '1.0.0' does not support objectinformatieobjecten", exception.message)
    }

    @Test
    fun `should delegate deleteDocumentLink to client when feature is supported`() {
        val authenticationMock = mock<DocumentenApiAuthentication>()
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        val version = DocumentenApiVersion(version = "1.5.0-baseflow", supportsObjectInformatieObjecten = true)
        whenever(documentenApiVersionService.getVersionByTag("1.5.0-baseflow")).thenReturn(version)

        val plugin = createPlugin(
            documentenApiVersionService = documentenApiVersionService,
            authenticationMock = authenticationMock,
            apiVersion = "1.5.0-baseflow"
        )

        val objectInformatieObjectUrl = URI("http://some-url/objectinformatieobjecten/789")
        val caseDocumentId = UUID.randomUUID()

        plugin.deleteDocumentLink(caseDocumentId, objectInformatieObjectUrl)

        verify(client).deleteDocumentLink(
            authentication = authenticationMock,
            baseUrl = plugin.url,
            caseDocumentId = caseDocumentId,
            url = objectInformatieObjectUrl
        )
    }

    @Test
    fun `should throw when deleteDocumentLink is called on unsupported version`() {
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        whenever(documentenApiVersionService.getVersionByTag("1.0.0"))
            .thenReturn(DocumentenApiVersion(version = "1.0.0", supportsObjectInformatieObjecten = false))

        val plugin = createPlugin(
            documentenApiVersionService = documentenApiVersionService,
            apiVersion = "1.0.0"
        )

        val exception = assertThrows<Exception> {
            plugin.deleteDocumentLink(
                caseDocumentId = UUID.randomUUID(),
                objectInformatieObjectUrl = URI("http://some-url/objectinformatieobjecten/789")
            )
        }
        assertEquals("Documenten API version '1.0.0' does not support objectinformatieobjecten", exception.message)
    }

    @Test
    fun `should linkDocumentToObject via plugin action using documentUrl process variable`() {
        val authenticationMock = mock<DocumentenApiAuthentication>()
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        val version = DocumentenApiVersion(version = "1.5.0-baseflow", supportsObjectInformatieObjecten = true)
        whenever(documentenApiVersionService.getVersionByTag("1.5.0-baseflow")).thenReturn(version)

        val plugin = createPlugin(
            documentenApiVersionService = documentenApiVersionService,
            authenticationMock = authenticationMock,
            apiVersion = "1.5.0-baseflow"
        )

        val execution = mock<DelegateExecution>()
        val caseDocumentId = UUID.fromString("123e4567-e89b-12d3-a456-426655440000")
        whenever(execution.businessKey).thenReturn(caseDocumentId.toString())
        whenever(execution.getVariable(DocumentenApiPlugin.DOCUMENT_URL_PROCESS_VAR))
            .thenReturn("http://some-url/enkelvoudiginformatieobjecten/123")

        val expectedResult = ObjectInformatieObject(
            url = URI("http://some-url/objectinformatieobjecten/550e8400-e29b-41d4-a716-446655440000"),
            informatieobject = URI("http://some-url/enkelvoudiginformatieobjecten/123"),
            `object` = URI("http://some-url/zaken/456"),
            objectType = "zaak",
        )
        whenever(client.linkDocument(eq(authenticationMock), eq(plugin.url), eq(caseDocumentId), any())).thenReturn(expectedResult)

        val result = plugin.linkDocumentToObject(
            execution,
            objectUrl = "http://some-url/zaken/456",
            objectType = "zaak",
        )

        val requestCaptor = argumentCaptor<ObjectInformatieObjectRequest>()
        verify(client).linkDocument(eq(authenticationMock), eq(plugin.url), eq(caseDocumentId), requestCaptor.capture())
        assertEquals(URI("http://some-url/enkelvoudiginformatieobjecten/123"), requestCaptor.firstValue.informatieobject)
        assertEquals(URI("http://some-url/zaken/456"), requestCaptor.firstValue.`object`)
        assertEquals("zaak", requestCaptor.firstValue.objectType)
        assertEquals(expectedResult, result)

        verify(execution).setVariable(
            DocumentenApiPlugin.OBJECT_INFORMATIE_OBJECT_URL_PROCESS_VAR,
            "http://some-url/objectinformatieobjecten/550e8400-e29b-41d4-a716-446655440000"
        )
        verify(execution).setVariable(
            DocumentenApiPlugin.OBJECT_INFORMATIE_OBJECT_ID_PROCESS_VAR,
            "550e8400-e29b-41d4-a716-446655440000"
        )
    }

    @Test
    fun `should throw when linkDocumentToObject plugin action has no documentUrl process variable`() {
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        whenever(documentenApiVersionService.getVersionByTag("1.5.0-baseflow"))
            .thenReturn(DocumentenApiVersion(version = "1.5.0-baseflow", supportsObjectInformatieObjecten = true))

        val plugin = createPlugin(
            documentenApiVersionService = documentenApiVersionService,
            apiVersion = "1.5.0-baseflow"
        )

        val execution = mock<DelegateExecution>()
        whenever(execution.businessKey).thenReturn("123e4567-e89b-12d3-a456-426655440000")
        whenever(execution.getVariable(DocumentenApiPlugin.DOCUMENT_URL_PROCESS_VAR)).thenReturn(null)

        val exception = assertThrows<IllegalStateException> {
            plugin.linkDocumentToObject(execution, "http://some-url/zaken/456", "zaak")
        }
        assertEquals(
            "Failed to link document. No process variable '${DocumentenApiPlugin.DOCUMENT_URL_PROCESS_VAR}' found.",
            exception.message
        )
    }

    @Test
    fun `should deleteDocumentLink via plugin action`() {
        val authenticationMock = mock<DocumentenApiAuthentication>()
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        val version = DocumentenApiVersion(version = "1.5.0-baseflow", supportsObjectInformatieObjecten = true)
        whenever(documentenApiVersionService.getVersionByTag("1.5.0-baseflow")).thenReturn(version)

        val plugin = createPlugin(
            documentenApiVersionService = documentenApiVersionService,
            authenticationMock = authenticationMock,
            apiVersion = "1.5.0-baseflow"
        )

        val execution = mock<DelegateExecution>()
        val caseDocumentId = UUID.fromString("123e4567-e89b-12d3-a456-426655440000")
        whenever(execution.businessKey).thenReturn(caseDocumentId.toString())
        val linkUrl = "http://some-url/objectinformatieobjecten/789"

        plugin.deleteDocumentLink(execution, linkUrl)

        verify(client).deleteDocumentLink(authenticationMock, plugin.url, caseDocumentId, URI(linkUrl))
    }

    @Test
    fun `should download document via plugin action using documentId process variable`() {
        val storageService: TemporaryResourceStorageService = mock()
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        val authenticationMock = mock<DocumentenApiAuthentication>()
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        val executionMock = mock<DelegateExecution>()
        val documentId = "3bd88200-11cb-45cf-a742-da01261755b1"
        val caseDocumentId = "123e4567-e89b-12d3-a456-426655440000"

        whenever(executionMock.getVariable(DOCUMENT_URL_PROCESS_VAR))
            .thenReturn(null)
        whenever(executionMock.getVariable(DOCUMENT_ID_PROCESS_VAR))
            .thenReturn(documentId)
        whenever(executionMock.businessKey)
            .thenReturn(caseDocumentId)
        whenever(client.getInformatieObject(any<DocumentenApiAuthentication>(), any<UUID>(), any<URI>()))
            .thenReturn(
                DocumentInformatieObject(
                    url = URI("http://some-url/enkelvoudiginformatieobjecten/$documentId"),
                    bronorganisatie = Rsin("000000000"),
                    creatiedatum = LocalDate.now(),
                    titel = "titel",
                    auteur = "auteur",
                    taal = "taal",
                    beginRegistratie = OffsetDateTime.now(),
                    status = DEFINITIEF,
                    bestandsnaam = "passport.jpg"
                )
            )
        whenever(client.downloadInformatieObjectContent(any<DocumentenApiAuthentication>(), any<UUID>(), any<URI>()))
            .thenReturn(ByteArrayInputStream("content".toByteArray()))
        whenever(storageService.store(any(), any()))
            .thenReturn("tempResourceId")

        val plugin = DocumentenApiPlugin(
            client = client,
            storageService = storageService,
            applicationEventPublisher = applicationEventPublisher,
            objectMapper = MapperSingleton.get(),
            documentDeleteHandlers = listOf(),
            documentenApiVersionService = documentenApiVersionService,
            pluginService = pluginService,
            runtimeService = runtimeService,
            virusScanService = virusScanService,
            virusScanEnabledForDocumentenApiPlugin = false
        )
        plugin.url = URI("http://some-url")
        plugin.bronorganisatie = "123456789"
        plugin.authenticationPluginConfiguration = authenticationMock

        val result = plugin.downloadInformatieObject(executionMock)

        assertEquals("tempResourceId", result)

        val expectedDocumentUrl = URI("http://some-url/enkelvoudiginformatieobjecten/$documentId")
        verify(client).getInformatieObject(
            authentication = eq(authenticationMock),
            caseDocumentId = eq(UUID.fromString(caseDocumentId)),
            objectUrl = eq(expectedDocumentUrl)
        )
        verify(client).downloadInformatieObjectContent(
            authentication = eq(authenticationMock),
            caseDocumentId = eq(UUID.fromString(caseDocumentId)),
            objectUrl = eq(expectedDocumentUrl)
        )
        verify(executionMock).setVariable(RESOURCE_ID_PROCESS_VAR, "tempResourceId")
    }

    @Test
    fun `should fall back to documentId when documentUrl process variable is blank`() {
        val storageService: TemporaryResourceStorageService = mock()
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        val authenticationMock = mock<DocumentenApiAuthentication>()
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        val executionMock = mock<DelegateExecution>()
        val documentId = "3bd88200-11cb-45cf-a742-da01261755b1"
        val caseDocumentId = "123e4567-e89b-12d3-a456-426655440000"

        whenever(executionMock.getVariable(DOCUMENT_URL_PROCESS_VAR))
            .thenReturn("")
        whenever(executionMock.getVariable(DOCUMENT_ID_PROCESS_VAR))
            .thenReturn(documentId)
        whenever(executionMock.businessKey)
            .thenReturn(caseDocumentId)
        whenever(client.getInformatieObject(any<DocumentenApiAuthentication>(), any<UUID>(), any<URI>()))
            .thenReturn(
                DocumentInformatieObject(
                    url = URI("http://some-url/enkelvoudiginformatieobjecten/$documentId"),
                    bronorganisatie = Rsin("000000000"),
                    creatiedatum = LocalDate.now(),
                    titel = "titel",
                    auteur = "auteur",
                    taal = "taal",
                    beginRegistratie = OffsetDateTime.now(),
                    status = DEFINITIEF,
                    bestandsnaam = "passport.jpg"
                )
            )
        whenever(client.downloadInformatieObjectContent(any<DocumentenApiAuthentication>(), any<UUID>(), any<URI>()))
            .thenReturn(ByteArrayInputStream("content".toByteArray()))
        whenever(storageService.store(any(), any()))
            .thenReturn("tempResourceId")

        val plugin = DocumentenApiPlugin(
            client = client,
            storageService = storageService,
            applicationEventPublisher = applicationEventPublisher,
            objectMapper = MapperSingleton.get(),
            documentDeleteHandlers = listOf(),
            documentenApiVersionService = documentenApiVersionService,
            pluginService = pluginService,
            runtimeService = runtimeService,
            virusScanService = virusScanService,
            virusScanEnabledForDocumentenApiPlugin = false
        )
        plugin.url = URI("http://some-url")
        plugin.bronorganisatie = "123456789"
        plugin.authenticationPluginConfiguration = authenticationMock

        val result = plugin.downloadInformatieObject(executionMock)

        assertEquals("tempResourceId", result)

        val expectedDocumentUrl = URI("http://some-url/enkelvoudiginformatieobjecten/$documentId")
        verify(client).getInformatieObject(
            authentication = eq(authenticationMock),
            caseDocumentId = eq(UUID.fromString(caseDocumentId)),
            objectUrl = eq(expectedDocumentUrl)
        )
        verify(client).downloadInformatieObjectContent(
            authentication = eq(authenticationMock),
            caseDocumentId = eq(UUID.fromString(caseDocumentId)),
            objectUrl = eq(expectedDocumentUrl)
        )
        verify(executionMock).setVariable(RESOURCE_ID_PROCESS_VAR, "tempResourceId")
    }

    @Test
    fun `should throw when download plugin action has neither documentUrl nor documentId`() {
        val storageService: TemporaryResourceStorageService = mock()
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        val documentenApiVersionService: DocumentenApiVersionService = mock()
        val executionMock = mock<DelegateExecution>()

        whenever(executionMock.getVariable(DOCUMENT_URL_PROCESS_VAR))
            .thenReturn(null)
        whenever(executionMock.getVariable(DOCUMENT_ID_PROCESS_VAR))
            .thenReturn(null)

        val plugin = DocumentenApiPlugin(
            client = client,
            storageService = storageService,
            applicationEventPublisher = applicationEventPublisher,
            objectMapper = MapperSingleton.get(),
            documentDeleteHandlers = listOf(),
            documentenApiVersionService = documentenApiVersionService,
            pluginService = pluginService,
            runtimeService = runtimeService,
            virusScanService = virusScanService,
            virusScanEnabledForDocumentenApiPlugin = false
        )
        plugin.url = URI("http://some-url")

        val exception = assertThrows<IllegalStateException> {
            plugin.downloadInformatieObject(executionMock)
        }
        assertEquals(
            "Failed to download document. No process variable '$DOCUMENT_URL_PROCESS_VAR' or '$DOCUMENT_ID_PROCESS_VAR' found.",
            exception.message
        )
    }
}
