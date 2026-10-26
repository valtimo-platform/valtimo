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

package com.ritense.zakenapi.resolver

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.valueresolver.ValueResolverService
import com.ritense.zakenapi.BaseIntegrationTest
import com.ritense.zakenapi.repository.ZaakInstanceLinkRepository
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.net.URI
import java.util.UUID

class ZaakValueResolverFailureIT @Autowired constructor(
    private val documentService: JsonSchemaDocumentService,
    private val documentRepository: JsonSchemaDocumentRepository,
    private val zaakInstanceLinkRepository: ZaakInstanceLinkRepository,
    private val valueResolverService: ValueResolverService,
    private val transactionManager: PlatformTransactionManager,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    lateinit var server: MockWebServer
    lateinit var previousPluginUrl: String
    private var documentId: UUID? = null

    private val baseUrl get() = server.url("").toString().removeSuffix("/")

    @BeforeEach
    internal fun setUp() {
        server = MockWebServer()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when (request.requestLine) {
                    "GET $ZAKEN_API_PATH/zaken/$ZAAK_UUID HTTP/1.1" -> MockResponse().setResponseCode(403)
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }
        server.start()
        previousPluginUrl = setPluginConfigurationUrl(ZAKEN_API_PLUGIN_ID, server.url("$ZAKEN_API_PATH/").toString())
    }

    @AfterEach
    internal fun tearDown() {
        TransactionTemplate(transactionManager).executeWithoutResult {
            documentId?.let { id ->
                zaakInstanceLinkRepository.findByDocumentId(id)?.let { zaakInstanceLinkRepository.delete(it) }
                documentRepository.deleteById(JsonSchemaDocumentId.existingId(id))
            }
        }
        setPluginConfigurationUrl(ZAKEN_API_PLUGIN_ID, previousPluginUrl)
        server.shutdown()
    }

    @Test
    fun `should resolve zaak field to null without poisoning the read-only transaction when Zaken API returns 403`() {
        val id = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest("profile", "profile", "1.0.0", objectMapper.createObjectNode())
            ).resultingDocument().get().id.id
        }
        documentId = id
        zaakInstanceLinkService.createZaakInstanceLink(
            URI("$baseUrl$ZAKEN_API_PATH/zaken/$ZAAK_UUID"),
            UUID.fromString(ZAAK_UUID),
            id,
            URI("$baseUrl/catalogi/e02753ba-9055-11ee-b9d1-0242ac120002")
        )

        val readOnlyTransaction = TransactionTemplate(transactionManager).apply { isReadOnly = true }
        val resolvedValues = readOnlyTransaction.execute {
            runWithoutAuthorization {
                valueResolverService.resolveValuesOrNull(id.toString(), listOf("zaak:identificatie"))
            }
        }

        assertThat(resolvedValues).containsEntry("zaak:identificatie", null)
    }

    companion object {
        private const val ZAKEN_API_PATH = "/zaken/api/v1"
        private const val ZAKEN_API_PLUGIN_ID = "3079d6fe-42e3-4f8f-a9db-52ce2507b7ee"
        private const val ZAAK_UUID = "1d0b8a5e-7c3f-4e0b-9a51-3f6c2e8d4b71"
    }
}
