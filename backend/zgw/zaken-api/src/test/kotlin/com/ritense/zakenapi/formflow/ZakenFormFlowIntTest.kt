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

package com.ritense.zakenapi.formflow

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.formflow.expression.ExpressionProcessorFactoryHolder
import com.ritense.formflow.expression.spel.SpelExpressionProcessorFactory
import com.ritense.zakenapi.BaseIntegrationTest
import com.ritense.zakenapi.domain.ZaakResponse
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.ApplicationContext
import org.springframework.transaction.annotation.Transactional

@Transactional
class ZakenFormFlowIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var applicationContext: ApplicationContext

    lateinit var server: MockWebServer

    @BeforeEach
    internal fun setUp() {
        server = MockWebServer()
        setupMockZakenApiServer()
        server.start(port = 56273)

        ExpressionProcessorFactoryHolder
            .setInstance(SpelExpressionProcessorFactory(), applicationContext = applicationContext)
    }

    @AfterEach
    internal fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `should register zakenFormFlow as form flow bean`() {
        val factory = ExpressionProcessorFactoryHolder.getInstance() as SpelExpressionProcessorFactory

        assertThat(factory.formFlowBeans).containsKey("zakenFormFlow")
        assertThat(factory.formFlowBeans["zakenFormFlow"]).isInstanceOf(ZakenFormFlow::class.java)
    }

    @Test
    fun `should resolve zaak through form flow expression`() {
        val result = runWithoutAuthorization {
            ExpressionProcessorFactoryHolder
                .getInstance()
                .create()
                .process<Any>("\${zakenFormFlow.getZaak('$ZAAK_IDENTIFICATIE', null)}")
        }

        assertThat(result).isInstanceOf(ZaakResponse::class.java)
        assertThat((result as ZaakResponse).identificatie).isEqualTo(ZAAK_IDENTIFICATIE)
    }

    @Test
    fun `should resolve to null when no zaak is found`() {
        val result = runWithoutAuthorization {
            ExpressionProcessorFactoryHolder
                .getInstance()
                .create()
                .process<Any>("\${zakenFormFlow.getZaak('UNKNOWN-ZAAK', null)}")
        }

        assertThat(result).isNull()
    }

    private fun setupMockZakenApiServer() {
        server.dispatcher = object : Dispatcher() {
            @Throws(InterruptedException::class)
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path?.substringBefore('?')
                val identificatie = request.requestUrl?.queryParameter("identificatie")
                return if (request.method == "GET" && path == "$ZAKEN_API_PATH/zaken") {
                    if (identificatie == ZAAK_IDENTIFICATIE) {
                        searchZakenResponse(identificatie)
                    } else {
                        searchZakenResponse(null)
                    }
                } else {
                    MockResponse().setResponseCode(404)
                }
            }
        }
    }

    private fun searchZakenResponse(identificatie: String?): MockResponse {
        val results = if (identificatie == null) "[]" else "[${zaak(identificatie)}]"
        val body = """
            {
                "count": ${if (identificatie == null) 0 else 1},
                "next": null,
                "previous": null,
                "results": $results
            }
        """.trimIndent()
        return mockResponse(body)
    }

    private fun zaak(identificatie: String) = """
        {
            "url": "http://localhost:56273$ZAKEN_API_PATH/zaken/57f66ff6-db7f-43bc-84ef-6847640d3609",
            "uuid": "57f66ff6-db7f-43bc-84ef-6847640d3609",
            "identificatie": "$identificatie",
            "bronorganisatie": "419071349",
            "omschrijving": "",
            "toelichting": "",
            "zaaktype": "http://localhost:56273/catalogi/api/v1/zaaktypen/21c0946a-9058-11ee-b9d1-0242ac120002",
            "registratiedatum": "2024-02-13",
            "verantwoordelijkeOrganisatie": "420936440",
            "startdatum": "2023-01-23",
            "einddatum": null
        }
    """.trimIndent()

    companion object {
        private const val ZAKEN_API_PATH = "/zaken/api/v1"
        private const val ZAAK_IDENTIFICATIE = "ZAAK-2023-0000000001"
    }
}
