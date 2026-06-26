/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.catalogiapi

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.plugin.repository.PluginProcessLinkRepository
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processdocument.service.impl.result.NewDocumentAndStartProcessResultSucceeded
import com.ritense.processlink.domain.ActivityTypeWithEventName
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doCallRealMethod
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.HistoryService
import org.operaton.bpm.engine.RepositoryService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.client.RestClient
import org.springframework.web.reactive.function.client.ClientRequest
import org.springframework.web.reactive.function.client.ClientResponse
import org.springframework.web.reactive.function.client.ExchangeFunction
import reactor.core.publisher.Mono
import java.net.URI
import java.time.LocalDate
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@Transactional
class CatalogiApiPluginIT : BaseIntegrationTest() {

    @Autowired
    lateinit var repositoryService: RepositoryService

    @Autowired
    lateinit var historyService: HistoryService

    @Autowired
    lateinit var pluginProcessLinkRepository: PluginProcessLinkRepository

    @MockitoSpyBean
    lateinit var processDocumentService: ProcessDocumentService

    @MockitoSpyBean
    lateinit var documentService: DocumentService

    @Autowired
    lateinit var objectMapper: ObjectMapper

    lateinit var server: MockWebServer
    lateinit var processDefinitionId: String
    lateinit var pluginConfigurationId: PluginConfigurationId
    private var executedRequests: MutableList<RecordedRequest> = mutableListOf()

    @BeforeEach
    internal fun setUp() {
        executedRequests.clear()
        server = MockWebServer()
        setupMockCatalogiApiServer()
        server.start(port = 56274)
        Thread.sleep(2000)

        val mockedId = PluginConfigurationId.existingId(UUID.fromString(AUTHENTICATION_PLUGIN_ID))
        doReturn(Optional.of(mock<PluginConfiguration>()))
            .whenever(pluginConfigurationRepository).findById(mockedId)
        doReturn(TestAuthentication())
            .whenever(pluginService).createInstance(mockedId)
        doCallRealMethod()
            .whenever(pluginService).createPluginConfiguration(any(), any(), any())

        val pluginPropertiesJson = """
            {
              "url": "${server.url("$CATALOGI_API_PATH/")}",
              "authenticationPluginConfiguration": "$AUTHENTICATION_PLUGIN_ID"
            }
        """.trimIndent()

        val configuration = pluginService.createPluginConfiguration(
            title = "Catalogi API plugin configuration",
            properties = objectMapper.readTree(pluginPropertiesJson) as ObjectNode,
            pluginDefinitionKey = "catalogiapi"
        )
        pluginConfigurationId = configuration.id

        processDefinitionId = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey("catalogi-api-plugin")
            .latestVersion()
            .singleResult()
            .id
    }

    @AfterEach
    internal fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `should get informatieobjecttype url by omschrijving through process execution`() {
        createProcessLink(INFORMATIEOBJECTTYPE_OMSCHRIJVING)
        setupZaaktypeUrlProviderMock()

        val request = NewDocumentAndStartProcessRequest(PROCESS_DEFINITION_KEY, newDocumentRequest())
        val response = runWithoutAuthorization { processDocumentService.newDocumentAndStartProcess(request) }

        assertTrue(response is NewDocumentAndStartProcessResultSucceeded)

        val processInstanceId = response.resultingProcessInstanceId().get().toString()
        val processVariable = getHistoricProcessVariable(processInstanceId, PROCESS_VARIABLE_NAME)

        assertEquals(INFORMATIEOBJECTTYPE_URL, processVariable)

        val zaaktypeInformatieobjecttypesRequest = executedRequests.find {
            it.path?.contains("zaaktype-informatieobjecttypen") == true
        }
        assertNotNull(zaaktypeInformatieobjecttypesRequest)
        assertTrue(zaaktypeInformatieobjecttypesRequest.path?.contains("zaaktype=$ZAAKTYPE_URL") == true)
    }

    private fun createProcessLink(informatieobjecttype: String) {
        pluginProcessLinkRepository.save(
            PluginProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId,
                activityId = "GetInformatieobjecttype",
                activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
                actionProperties = objectMapper.readTree("""
                    {
                        "informatieobjecttype": "$informatieobjecttype",
                        "processVariable": "$PROCESS_VARIABLE_NAME"
                    }
                """) as ObjectNode,
                pluginConfigurationId = pluginConfigurationId,
                pluginConfigurationReference = PluginConfigurationReference(),
                pluginActionDefinitionKey = "get-informatieobjecttype"
            )
        )
    }

    private fun setupZaaktypeUrlProviderMock() {
        doReturn(URI.create(ZAAKTYPE_URL))
            .whenever(zaaktypeUrlProvider).getZaaktypeUrl(any<UUID>())
    }

    private fun getHistoricProcessVariable(processInstanceId: String, variableName: String): Any? {
        return historyService.createHistoricVariableInstanceQuery()
            .processInstanceId(processInstanceId)
            .variableName(variableName)
            .singleResult()
            ?.value
    }

    private fun newDocumentRequest() = NewDocumentRequest(
        DOCUMENT_DEFINITION_KEY,
        "profile",
        "1.0.0",
        objectMapper.createObjectNode()
    )

    private fun setupMockCatalogiApiServer() {
        val dispatcher: Dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                executedRequests.add(request)
                return when {
                    request.path?.contains("zaaktype-informatieobjecttypen") == true ->
                        zaaktypeInformatieobjecttypesResponse()
                    request.path?.contains("informatieobjecttypen/$INFORMATIEOBJECTTYPE_ID") == true ->
                        informatieobjecttypeResponse()
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }
        server.dispatcher = dispatcher
    }

    private fun zaaktypeInformatieobjecttypesResponse(): MockResponse {
        val body = """
            {
                "count": 1,
                "next": null,
                "previous": null,
                "results": [{
                    "url": "$ZAAKTYPE_INFORMATIEOBJECTTYPE_URL",
                    "zaaktype": "$ZAAKTYPE_URL",
                    "informatieobjecttype": "$INFORMATIEOBJECTTYPE_URL",
                    "volgnummer": 1,
                    "richting": "inkomend",
                    "statustype": null
                }]
            }
        """.trimIndent()
        return mockResponse(body)
    }

    private fun informatieobjecttypeResponse(): MockResponse {
        val body = """
            {
                "url": "$INFORMATIEOBJECTTYPE_URL",
                "catalogus": "$CATALOGUS_URL",
                "omschrijving": "$INFORMATIEOBJECTTYPE_OMSCHRIJVING",
                "vertrouwelijkheidaanduiding": "openbaar",
                "beginGeldigheid": "${LocalDate.now().minusDays(1)}",
                "eindeGeldigheid": null,
                "concept": false
            }
        """.trimIndent()
        return mockResponse(body)
    }

    private inline fun <reified T : Any> mock(): T = org.mockito.kotlin.mock()

    class TestAuthentication : CatalogiApiAuthentication {
        override fun applyAuth(builder: RestClient.Builder): RestClient.Builder {
            return builder.defaultHeaders { headers ->
                headers.setBearerAuth("test")
            }
        }

        override fun filter(request: ClientRequest, next: ExchangeFunction): Mono<ClientResponse> {
            return next.exchange(request)
        }
    }

    companion object {
        private const val PROCESS_DEFINITION_KEY = "catalogi-api-plugin"
        private const val DOCUMENT_DEFINITION_KEY = "profile"
        private const val AUTHENTICATION_PLUGIN_ID = "27a399c7-9d70-4833-a651-57664e2e9e09"

        private const val CATALOGI_API_PATH = "/catalogi/api/v1"
        private const val CATALOGUS_URL = "http://localhost:56274$CATALOGI_API_PATH/catalogussen/8225508a-6840-413e-acc9-6422af120db1"
        private const val ZAAKTYPE_URL = "http://localhost:56274$CATALOGI_API_PATH/zaaktypen/21c0946a-9058-11ee-b9d1-0242ac120002"
        private const val ZAAKTYPE_INFORMATIEOBJECTTYPE_URL = "http://localhost:56274$CATALOGI_API_PATH/zaaktype-informatieobjecttypen/f1234567-1234-1234-1234-123456789012"
        private const val INFORMATIEOBJECTTYPE_ID = "12345678-be3b-4bad-9e3c-49a6219c92ad"
        private const val INFORMATIEOBJECTTYPE_URL = "http://localhost:56274$CATALOGI_API_PATH/informatieobjecttypen/$INFORMATIEOBJECTTYPE_ID"
        private const val INFORMATIEOBJECTTYPE_OMSCHRIJVING = "Bijlage"
        private const val PROCESS_VARIABLE_NAME = "informatieobjecttypeUrl"
    }
}
