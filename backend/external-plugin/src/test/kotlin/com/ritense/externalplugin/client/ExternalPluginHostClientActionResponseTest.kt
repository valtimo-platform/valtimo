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

package com.ritense.externalplugin.client

import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestTemplate
import java.util.UUID

/**
 * Every failure mode of an action/submit invocation has to arrive at the caller as a structured
 * [ActionResponse], never as a thrown exception (plan §7): the service-task listener turns a non-2xx
 * into a BPMN error and the task-form service turns it into form errors. A leaking exception would
 * bypass both paths, so an unreachable host must surface as a synthetic 503 rather than blowing up
 * the process.
 */
class ExternalPluginHostClientActionResponseTest {

    private val secret = "host-admin-secret"
    private val baseUrl = "http://plugin-host:8090"
    private val objectMapper = ObjectMapper()
    private lateinit var restTemplate: RestTemplate
    private lateinit var server: MockRestServiceServer
    private lateinit var client: ExternalPluginHostClient

    private val actionPath = "/plugins/case-summary/0.1.0/actions/summarize"
    private val submitPath = "/plugins/case-summary/0.1.0/submit/review"

    @BeforeEach
    fun setUp() {
        restTemplate = RestTemplate()
        server = MockRestServiceServer.createServer(restTemplate)
        client = ExternalPluginHostClient(restTemplate, objectMapper)
    }

    private fun payload() = objectMapper.createObjectNode().apply {
        put("configurationId", UUID.randomUUID().toString())
    }

    private fun invokeAction() =
        client.invokeAction(baseUrl, "case-summary", "0.1.0", "summarize", payload(), secret)

    private fun invokeSubmit() =
        client.invokeSubmit(baseUrl, "case-summary", "0.1.0", "review", payload(), secret)

    private fun respondWith(path: String, status: HttpStatus, body: String) {
        server.expect(requestTo("$baseUrl$path"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withStatus(status).contentType(MediaType.APPLICATION_JSON).body(body))
    }

    // ---------------------------------------------------------------- success

    @Test
    fun `a 2xx returns the host status and the parsed body`() {
        respondWith(actionPath, HttpStatus.OK, """{"status":"completed","variables":{"done":true}}""")

        val response = invokeAction()

        assertThat(response.status).isEqualTo(200)
        assertThat(response.body!!.get("status").asText()).isEqualTo("completed")
        assertThat(response.body!!.get("variables").get("done").asBoolean()).isTrue()
        server.verify()
    }

    @Test
    fun `a result channel on the action output is passed through untouched`() {
        respondWith(
            actionPath,
            HttpStatus.OK,
            """{"status":"completed","variables":{},"result":{"summary":"a summary"}}""",
        )

        val response = invokeAction()

        assertThat(response.body!!.get("result").get("summary").asText()).isEqualTo("a summary")
    }

    // ---------------------------------------------------------------- host-reported failures

    @Test
    fun `a 4xx plugin rejection keeps the host status and error body`() {
        respondWith(
            actionPath,
            HttpStatus.UNPROCESSABLE_ENTITY,
            """{"status":"error","errorCode":"BOOM","errorMessage":"nope"}""",
        )

        val response = invokeAction()

        assertThat(response.status).isEqualTo(422)
        assertThat(response.body!!.get("errorCode").asText()).isEqualTo("BOOM")
        assertThat(response.body!!.get("errorMessage").asText()).isEqualTo("nope")
    }

    @Test
    fun `a 5xx host failure keeps the host status and error body`() {
        respondWith(
            actionPath,
            HttpStatus.INTERNAL_SERVER_ERROR,
            """{"status":"error","errorCode":"HOST_ERROR","errorMessage":"wasm crashed"}""",
        )

        val response = invokeAction()

        assertThat(response.status).isEqualTo(500)
        assertThat(response.body!!.get("errorCode").asText()).isEqualTo("HOST_ERROR")
    }

    @Test
    fun `a 404 for an unknown plugin version surfaces as such, not as unreachable`() {
        respondWith(actionPath, HttpStatus.NOT_FOUND, """{"error":"Plugin not found"}""")

        val response = invokeAction()

        assertThat(response.status).isEqualTo(404)
        assertThat(response.body!!.get("error").asText()).contains("Plugin not found")
    }

    @Test
    fun `a 401 from a rejected signature surfaces as 401`() {
        respondWith(actionPath, HttpStatus.UNAUTHORIZED, """{"error":"Invalid signature"}""")

        assertThat(invokeAction().status).isEqualTo(401)
    }

    @Test
    fun `a non-JSON error body degrades to a null body instead of throwing`() {
        server.expect(requestTo("$baseUrl$actionPath"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(
                withStatus(HttpStatus.BAD_GATEWAY).contentType(MediaType.TEXT_HTML)
                    .body("<html>502 Bad Gateway</html>")
            )

        val response = invokeAction()

        assertThat(response.status).isEqualTo(502)
        assertThat(response.body).isNull()
    }

    @Test
    fun `an empty error body degrades to a null body`() {
        server.expect(requestTo("$baseUrl$actionPath"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE))

        val response = invokeAction()

        assertThat(response.status).isEqualTo(503)
        assertThat(response.body).isNull()
    }

    // ---------------------------------------------------------------- transport failures

    @Test
    fun `an unreachable host becomes a synthetic 503 carrying the host-unreachable code`() {
        server.expect(requestTo("$baseUrl$actionPath"))
            .andExpect(method(HttpMethod.POST))
            .andRespond { throw ResourceAccessException("Connection refused") }

        val response = invokeAction()

        assertThat(response.status).isEqualTo(503)
        assertThat(response.body!!.get("errorCode").asText())
            .isEqualTo(ExternalPluginHostClient.HOST_UNREACHABLE_ERROR_CODE)
        assertThat(response.body!!.get("errorMessage").asText()).contains("Connection refused")
    }

    @Test
    fun `a read timeout becomes the same synthetic 503`() {
        server.expect(requestTo("$baseUrl$actionPath"))
            .andExpect(method(HttpMethod.POST))
            .andRespond { throw ResourceAccessException("Read timed out") }

        val response = invokeAction()

        assertThat(response.status).isEqualTo(503)
        assertThat(response.body!!.get("errorCode").asText())
            .isEqualTo("EXTERNAL_PLUGIN_HOST_UNREACHABLE")
    }

    // ---------------------------------------------------------------- the submit path shares it all

    @Test
    fun `invokeSubmit maps a hook rejection to the host status and body`() {
        respondWith(
            submitPath,
            HttpStatus.UNPROCESSABLE_ENTITY,
            """{"status":"error","errorMessage":"needs a comment","fieldErrors":{"comment":"Required"}}""",
        )

        val response = invokeSubmit()

        assertThat(response.status).isEqualTo(422)
        assertThat(response.body!!.get("fieldErrors").get("comment").asText()).isEqualTo("Required")
    }

    @Test
    fun `invokeSubmit maps an unreachable host to the synthetic 503 as well`() {
        server.expect(requestTo("$baseUrl$submitPath"))
            .andExpect(method(HttpMethod.POST))
            .andRespond { throw ResourceAccessException("Connection refused") }

        val response = invokeSubmit()

        assertThat(response.status).isEqualTo(503)
        assertThat(response.body!!.get("errorCode").asText())
            .isEqualTo(ExternalPluginHostClient.HOST_UNREACHABLE_ERROR_CODE)
    }

    // ---------------------------------------------------------------- health probe

    @Test
    fun `health reports true only for a reachable, healthy host`() {
        server.expect(requestTo("$baseUrl/health"))
            .andRespond(withStatus(HttpStatus.OK).contentType(MediaType.APPLICATION_JSON).body("""{"status":"UP"}"""))

        assertThat(client.health(baseUrl)).isTrue()
        server.verify()
    }

    @Test
    fun `health reports false for an unreachable host`() {
        server.expect(requestTo("$baseUrl/health"))
            .andRespond { throw ResourceAccessException("Connection refused") }

        assertThat(client.health(baseUrl)).isFalse()
    }

    @Test
    fun `health reports false for a 4xx or 5xx response`() {
        server.expect(requestTo("$baseUrl/health")).andRespond(withStatus(HttpStatus.NOT_FOUND))
        assertThat(client.health(baseUrl)).isFalse()

        server.reset()
        server.expect(requestTo("$baseUrl/health"))
            .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR))
        assertThat(client.health(baseUrl)).isFalse()
    }
}
