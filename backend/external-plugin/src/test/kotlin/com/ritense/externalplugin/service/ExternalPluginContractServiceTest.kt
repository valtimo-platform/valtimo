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

package com.ritense.externalplugin.service

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.client.ExternalPluginHostClient.ActionResponse
import com.ritense.externalplugin.domain.EventQueueMode
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginContractBinding
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostKind
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginContractBindingRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.externalplugin.service.ExternalPluginContractService.ProviderReply
import com.ritense.plugin.service.EncryptionService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import java.util.Optional
import java.util.UUID

class ExternalPluginContractServiceTest {

    private val objectMapper = ObjectMapper()
    private val contract = "nl.ritense.openplan@1"
    private val now = Instant.parse("2026-10-15T10:00:00Z")
    private val readTimeout = Duration.ofSeconds(40)

    private val definitions = mutableMapOf<UUID, ExternalPluginDefinition>()
    private val configurations = mutableMapOf<UUID, ExternalPluginConfiguration>()
    private val bindings = mutableListOf<ExternalPluginContractBinding>()

    private lateinit var hostClient: ExternalPluginHostClient
    private lateinit var service: ExternalPluginContractService

    private lateinit var callerDefinition: ExternalPluginDefinition
    private lateinit var providerDefinition: ExternalPluginDefinition
    private lateinit var caller: ExternalPluginConfiguration
    private lateinit var provider: ExternalPluginConfiguration
    private val host = ExternalPluginHost(
        id = UUID.randomUUID(),
        name = "host",
        baseUrl = "https://provider-host.example.com",
        secret = "encrypted",
        status = ExternalPluginHostStatus.CONNECTED,
        kind = ExternalPluginHostKind.PLUGIN_HOST,
        gzacCallbackBaseUrl = "http://gzac:8080",
        eventQueueMode = EventQueueMode.LIVE,
    )

    @BeforeEach
    fun setUp() {
        hostClient = mock()
        service = service(maxConcurrentCalls = 8)

        callerDefinition = definition("pdca", objectMapper.createObjectNode())
        providerDefinition = definition("openplan", providerManifest())
        caller = configuration(callerDefinition)
        provider = configuration(providerDefinition)
        bindings += ExternalPluginContractBinding(UUID.randomUUID(), caller.id, contract, provider.id)
    }

    @Test
    fun `delivers to the bound provider with a GZAC-stamped caller and returns its result`() {
        answer(200, """{"status":"completed","result":{"items":[1]}}""")

        val outcome = call("list", payload = objectMapper.createObjectNode().put("resource", "plan"))

        assertThat(outcome.status).isEqualTo("completed")
        assertThat(outcome.result!!.get("items").get(0).asInt()).isEqualTo(1)
        val body = argumentCaptor<ObjectNode>()
        verify(hostClient).invokeContract(
            eq(host.baseUrl), eq("openplan"), eq("1.0.0"), eq(contract), eq("list"), body.capture(), eq("host-secret"), any(),
        )
        assertThat(body.firstValue.get("configurationId").asText()).isEqualTo(provider.id.toString())
        assertThat(body.firstValue.get("caller").get("pluginId").asText()).isEqualTo("pdca")
        assertThat(body.firstValue.get("caller").get("configurationId").asText()).isEqualTo(caller.id.toString())
        assertThat(body.firstValue.get("payload").get("resource").asText()).isEqualTo("plan")
        assertThat(body.firstValue.get("chain").map { it.asText() }).containsExactly(caller.id.toString())
        assertThat(body.firstValue.has("jobId")).isFalse()
        assertThat(body.firstValue.has("documentId")).isFalse()
        assertThat(body.firstValue.has("requestedBy")).isFalse()
    }

    @Test
    fun `an unbound contract fails closed with NO_PROVIDER_BOUND`() {
        bindings.clear()

        assertError(call("list"), "NO_PROVIDER_BOUND")
        verifyNoDelivery()
    }

    @Test
    fun `a caller that awaits re-acceptance cannot call`() {
        callerDefinition.pendingContentHash = "sha256:changed"

        assertError(call("list"), "CALLER_UNAVAILABLE")
        verifyNoDelivery()
    }

    @Test
    fun `an unavailable provider is refused before anything leaves`() {
        providerDefinition.status = ExternalPluginDefinitionStatus.UNAVAILABLE

        assertError(call("list"), "PROVIDER_UNAVAILABLE")
        verifyNoDelivery()
    }

    @Test
    fun `a provider awaiting re-acceptance is refused`() {
        providerDefinition.pendingContentHash = "sha256:changed"

        assertError(call("list"), "PROVIDER_CONTENT_CHANGED")
        verifyNoDelivery()
    }

    @Test
    fun `a placeholder provider is unavailable`() {
        providerDefinition.manifestJson = null
        providerDefinition.contentHash = null
        providerDefinition.status = ExternalPluginDefinitionStatus.UNAVAILABLE

        assertError(call("list"), "PROVIDER_UNAVAILABLE")
    }

    @Test
    fun `an operation the provider does not declare is refused`() {
        assertError(call("drop-tables"), "OPERATION_NOT_PROVIDED")
        verifyNoDelivery()
    }

    @Test
    fun `a job operation cannot be called synchronously`() {
        assertError(call("generate"), "OPERATION_REQUIRES_JOB")
        verifyNoDelivery()
    }

    @Test
    fun `a job resolution accepts a job operation`() {
        val resolution = service.resolve(caller.id, contract, "generate", null, null, synchronous = false)

        assertThat(resolution).isInstanceOf(ExternalPluginContractService.Resolution.Resolved::class.java)
    }

    @Test
    fun `a provider already in the chain is a cycle`() {
        assertError(call("list", chain = "${provider.id},${UUID.randomUUID()}"), "CONTRACT_CYCLE")
        verifyNoDelivery()
    }

    @Test
    fun `a chain past the maximum depth is refused`() {
        val chain = List(4) { UUID.randomUUID() }.joinToString(",")

        assertError(call("list", chain = chain), "CONTRACT_DEPTH_EXCEEDED")
    }

    @Test
    fun `the received chain is extended with the caller`() {
        answer(200, """{"status":"completed","result":{}}""")
        val upstream = UUID.randomUUID()

        call("list", chain = upstream.toString())

        val body = argumentCaptor<ObjectNode>()
        verify(hostClient).invokeContract(any(), any(), any(), any(), any(), body.capture(), any(), any())
        assertThat(body.firstValue.get("chain").map { it.asText() }).containsExactly(upstream.toString(), caller.id.toString())
    }

    @Test
    fun `a malformed chain header is a bad request`() {
        assertThatThrownBy { call("list", chain = "not-a-uuid") }
            .isInstanceOf(IllegalArgumentException::class.java)
    }

    @Test
    fun `an oversized payload is refused`() {
        val payload = objectMapper.createObjectNode().put("blob", "x".repeat(100))

        assertError(call("list", payload = payload), "PAYLOAD_TOO_LARGE")
        verifyNoDelivery()
    }

    // ---------------------------------------------------------------- consumer-declared operations

    @Test
    fun `an operation outside the caller's declared operations is refused before anything else is looked up`() {
        callerDefinition.manifestJson = consumerManifest("""{"contract": "$contract", "operations": ["get"]}""")
        bindings.clear()

        val outcome = call("list")

        assertError(outcome, "OPERATION_NOT_DECLARED")
        assertThat(outcome.errorMessage).isEqualTo("'pdca@1.0.0' declares operations [get] of '$contract', not 'list'")
        verifyNoDelivery()
    }

    @Test
    fun `a declared operation passes the declaration guard`() {
        callerDefinition.manifestJson = consumerManifest("""{"contract": "$contract", "operations": ["get"]}""")
        answer(200, """{"status":"completed","result":{"body":"x"}}""")

        assertThat(call("get").status).isEqualTo("completed")
    }

    @Test
    fun `the string form declares every operation`() {
        callerDefinition.manifestJson = consumerManifest(""""$contract"""")
        answer(200, """{"status":"completed","result":{}}""")

        assertThat(call("list").status).isEqualTo("completed")
    }

    // ---------------------------------------------------------------- schemas

    @Test
    fun `a payload that breaks the input schema is refused with the validation messages`() {
        val outcome = call("search", payload = objectMapper.createObjectNode().put("query", 5))

        assertError(outcome, "CONTRACT_INPUT_INVALID")
        assertThat(outcome.errorMessage).startsWith("Payload does not match the input schema of operation 'search': ")
        verifyNoDelivery()
    }

    @Test
    fun `a payload that matches the input schema is delivered`() {
        answer(200, """{"status":"completed","result":{"hits":[]}}""")

        assertThat(call("search", payload = objectMapper.createObjectNode().put("query", "plan")).status).isEqualTo("completed")
    }

    @Test
    fun `at most five schema violations are reported`() {
        val outcome = call("search", payload = objectMapper.readTree("""{"a":1,"b":2,"c":3,"d":4,"e":5,"f":6,"g":7}"""))

        assertError(outcome, "CONTRACT_INPUT_INVALID")
        assertThat(outcome.errorMessage!!.substringAfter("': ").split("; ")).hasSize(5)
    }

    @Test
    fun `an uncompilable input schema is a validation failure`() {
        providerDefinition.manifestJson = providerManifest(searchInput = """{"type": "object", "pattern": "["}""")

        val outcome = call("search", payload = objectMapper.createObjectNode().put("query", "plan"))

        assertError(outcome, "CONTRACT_INPUT_INVALID")
        assertThat(outcome.errorMessage).startsWith("Operation 'search' declares an invalid input schema: ")
        verifyNoDelivery()
    }

    @Test
    fun `an input schema that is not an object is a validation failure`() {
        providerDefinition.manifestJson = providerManifest(searchInput = "\"string\"")

        val outcome = call("search", payload = objectMapper.createObjectNode().put("query", "plan"))

        assertThat(outcome.errorMessage).isEqualTo("Operation 'search' declares an invalid input schema: the schema must be a JSON object")
    }

    @Test
    fun `a schema never makes GZAC fetch a remote reference`() {
        providerDefinition.manifestJson = providerManifest(searchInput = """{"${'$'}ref": "https://schemas.example.com/plan.json"}""")

        val outcome = call("search", payload = objectMapper.createObjectNode().put("query", "plan"))

        assertError(outcome, "CONTRACT_INPUT_INVALID")
        assertThat(outcome.errorMessage).startsWith("Operation 'search' declares an invalid input schema: ")
    }

    @Test
    fun `a result that breaks the output schema is an invalid result`() {
        answer(200, """{"status":"completed","result":{"hits":"none"}}""")

        val outcome = call("search", payload = objectMapper.createObjectNode().put("query", "plan"))

        assertError(outcome, "PROVIDER_INVALID_RESULT")
        assertThat(outcome.errorMessage).startsWith("Result does not match the output schema of operation 'search': ")
    }

    @Test
    fun `a result larger than the payload limit is an invalid result`() {
        answer(200, """{"status":"completed","result":{"items":"${"x".repeat(100)}"}}""")

        val outcome = call("list")

        assertError(outcome, "PROVIDER_INVALID_RESULT")
        assertThat(outcome.errorMessage).isEqualTo("Result is 112 bytes; the maximum is 64")
    }

    @Test
    fun `a result missing a declared output is an invalid result`() {
        answer(200, """{"status":"completed","result":{"other":1}}""")

        assertError(call("get"), "PROVIDER_INVALID_RESULT")
    }

    @Test
    fun `a null output value is a valid result`() {
        answer(200, """{"status":"completed","result":{"body":null}}""")

        assertThat(call("get").status).isEqualTo("completed")
    }

    // ---------------------------------------------------------------- provider answers

    @Test
    fun `a provider error keeps PROVIDER_ERROR on top and its own code apart`() {
        answer(200, """{"status":"error","errorCode":"NOT_FOUND","errorMessage":"no such plan"}""")

        val outcome = call("list")

        assertError(outcome, "PROVIDER_ERROR")
        assertThat(outcome.errorMessage).isEqualTo("no such plan")
        assertThat(outcome.providerErrorCode).isEqualTo("NOT_FOUND")
    }

    @Test
    fun `a provider error without a message gets a generic one`() {
        answer(200, """{"status":"error"}""")

        val outcome = call("list")

        assertThat(outcome.errorMessage).isEqualTo("The provider reported an error")
        assertThat(outcome.providerErrorCode).isNull()
    }

    @Test
    fun `returned error texts are truncated`() {
        answer(200, """{"status":"error","errorCode":"${"C".repeat(300)}","errorMessage":"${"m".repeat(5000)}"}""")

        val outcome = call("list")

        assertThat(outcome.errorMessage).hasSize(2000)
        assertThat(outcome.providerErrorCode).hasSize(255)
    }

    @ParameterizedTest
    @CsvSource(
        "503, EXTERNAL_PLUGIN_HOST_UNREACHABLE, PROVIDER_UNREACHABLE, true",
        "502, , PROVIDER_UNREACHABLE, true",
        "504, , PROVIDER_UNREACHABLE, true",
        "404, , PROVIDER_UNSUPPORTED, false",
        "404, CONTRACT_OPERATION_NOT_PROVIDED, OPERATION_NOT_PROVIDED, false",
        "404, PLUGIN_NOT_LOADED, PROVIDER_UNAVAILABLE, true",
        "404, CONFIGURATION_NOT_FOUND, PROVIDER_UNAVAILABLE, true",
        "404, SOMETHING_ELSE, PROVIDER_ERROR, false",
        "501, CONTRACT_NOT_IMPLEMENTED, PROVIDER_UNSUPPORTED, false",
        "409, EXTERNAL_PLUGIN_CONTENT_CHANGED, PROVIDER_CONTENT_CHANGED, true",
        "500, HOST_ERROR, PROVIDER_ERROR, true",
        "400, , PROVIDER_ERROR, false",
    )
    fun `host failures map onto contract error codes`(status: Int, hostCode: String?, expected: String, retryable: Boolean) {
        val body = if (hostCode == null) """{"error":"nope"}""" else """{"errorCode":"$hostCode","errorMessage":"nope"}"""

        val reply = service.interpret(ActionResponse(status, json(body)), operation("list"), job = true) as ProviderReply.Failure

        assertThat(reply.errorCode).isEqualTo(expected)
        assertThat(reply.retryable).isEqualTo(retryable)
        assertThat(reply.providerErrorCode).isNull()
        assertThat(reply.errorMessage).isNotBlank()
    }

    @Test
    fun `a host-level code stays a diagnostic prefix of the message`() {
        val reply = service.interpret(
            ActionResponse(500, json("""{"errorCode":"HOST_ERROR","errorMessage":"boom"}""")), operation("list"), job = false,
        ) as ProviderReply.Failure

        assertThat(reply.errorMessage).isEqualTo("HOST_ERROR: boom")
        assertThat(reply.providerErrorCode).isNull()
    }

    @Test
    fun `accepted is not a valid answer to a synchronous call`() {
        answer(200, """{"status":"accepted"}""")

        assertError(call("list"), "PROVIDER_INVALID_RESULT")
    }

    @Test
    fun `an answer without a known status is an invalid result`() {
        answer(200, """{"status":"done"}""")

        assertError(call("list"), "PROVIDER_INVALID_RESULT")
    }

    @Test
    fun `transport failures are retryable for jobs, provider answers are not`() {
        val operation = (service.resolve(caller.id, contract, "generate", null, null, false)
            as ExternalPluginContractService.Resolution.Resolved).operation

        val unreachable = service.interpret(ActionResponse(503, json("""{"errorCode":"EXTERNAL_PLUGIN_HOST_UNREACHABLE"}""")), operation, job = true)
        val refused = service.interpret(ActionResponse(200, json("""{"status":"error","errorMessage":"no"}""")), operation, job = true)
        val accepted = service.interpret(ActionResponse(200, json("""{"status":"accepted"}""")), operation, job = true)

        assertThat((unreachable as ProviderReply.Failure).retryable).isTrue()
        assertThat((refused as ProviderReply.Failure).retryable).isFalse()
        assertThat(accepted).isEqualTo(ProviderReply.Accepted)
    }

    // ---------------------------------------------------------------- timeout, correlation, concurrency

    @Test
    fun `without a timeout header a synchronous call gets the read timeout as its budget`() {
        answer(200, """{"status":"completed","result":{}}""")

        call("list")

        assertThat(deliveredBody().get("timeoutMs").asLong()).isEqualTo(readTimeout.toMillis())
        assertThat(deliveredBody().has("deadline")).isFalse()
    }

    @Test
    fun `a shorter caller timeout is passed on`() {
        answer(200, """{"status":"completed","result":{}}""")

        call("list", timeoutMs = "5000")

        assertThat(deliveredBody().get("timeoutMs").asLong()).isEqualTo(5000)
    }

    @Test
    fun `a caller timeout beyond the read timeout is capped`() {
        answer(200, """{"status":"completed","result":{}}""")

        call("list", timeoutMs = "600000")

        assertThat(deliveredBody().get("timeoutMs").asLong()).isEqualTo(readTimeout.toMillis())
    }

    @Test
    fun `a caller with no time left is refused before anything is resolved`() {
        assertError(call("list", timeoutMs = "0"), "CONTRACT_DEADLINE_EXCEEDED")
        verifyNoDelivery()
    }

    @Test
    fun `a malformed timeout header is a bad request`() {
        listOf("soon", "-5", "1.5", "1234567890123").forEach { header ->
            assertThatThrownBy { call("list", timeoutMs = header) }
                .isInstanceOf(IllegalArgumentException::class.java)
                .hasMessageContaining("X-Valtimo-Contract-Timeout-Ms")
        }
    }

    @Test
    fun `a valid correlation id is passed on, an invalid one replaced`() {
        answer(200, """{"status":"completed","result":{}}""")

        call("list", correlationId = "trace-1234")
        call("list", correlationId = "not valid!")

        val correlationIds = argumentCaptor<String>()
        verify(hostClient, org.mockito.kotlin.times(2))
            .invokeContract(any(), any(), any(), any(), any(), any(), any(), correlationIds.capture())
        assertThat(correlationIds.firstValue).isEqualTo("trace-1234")
        assertThat(UUID.fromString(correlationIds.secondValue)).isNotNull()
    }

    @Test
    fun `a caller with every permit in use is refused, others are not`() {
        service = service(maxConcurrentCalls = 1)
        val otherCaller = configuration(callerDefinition)
        bindings += ExternalPluginContractBinding(UUID.randomUUID(), otherCaller.id, contract, provider.id)
        val nested = mutableListOf<ContractOutcome>()
        whenever(hostClient.invokeContract(any(), any(), any(), any(), any(), any(), any(), anyOrNull())).thenAnswer {
            if (nested.isEmpty()) {
                nested += service.call(caller.id, contract, "list", null, null, null, null)
                nested += service.call(otherCaller.id, contract, "list", null, null, null, null)
            }
            ActionResponse(200, json("""{"status":"completed","result":{}}"""))
        }

        val outer = call("list")

        assertThat(outer.status).isEqualTo("completed")
        assertError(nested[0], "TOO_MANY_CONCURRENT_CALLS")
        assertThat(nested[1].status).isEqualTo("completed")
        assertThat(call("list").status).describedAs("the permit is released afterwards").isEqualTo("completed")
    }

    @Test
    fun `a failing delivery still releases the permit`() {
        service = service(maxConcurrentCalls = 1)
        whenever(hostClient.invokeContract(any(), any(), any(), any(), any(), any(), any(), anyOrNull()))
            .thenThrow(IllegalStateException("boom"))

        assertThatThrownBy { call("list") }.isInstanceOf(IllegalStateException::class.java)
        assertError(call("list", chain = "${provider.id}"), "CONTRACT_CYCLE")
    }

    // ---------------------------------------------------------------- helpers

    private fun service(maxConcurrentCalls: Int): ExternalPluginContractService {
        val configurationRepository = mock<ExternalPluginConfigurationRepository>()
        val definitionRepository = mock<ExternalPluginDefinitionRepository>()
        val hostRepository = mock<ExternalPluginHostRepository>()
        val bindingRepository = mock<ExternalPluginContractBindingRepository>()
        val encryptionService = mock<EncryptionService>()
        whenever(configurationRepository.findById(any())).thenAnswer { Optional.ofNullable(configurations[it.getArgument(0)]) }
        whenever(definitionRepository.findById(any())).thenAnswer { Optional.ofNullable(definitions[it.getArgument(0)]) }
        whenever(hostRepository.findById(host.id)).thenReturn(Optional.of(host))
        whenever(bindingRepository.findByConfigurationIdAndContract(any(), any())).thenAnswer { invocation ->
            bindings.firstOrNull { it.configurationId == invocation.getArgument(0) && it.contract == invocation.getArgument(1) }
        }
        whenever(encryptionService.decrypt("encrypted")).thenReturn("host-secret")
        return ExternalPluginContractService(
            configurationRepository,
            definitionRepository,
            hostRepository,
            bindingRepository,
            hostClient,
            encryptionService,
            objectMapper,
            maxDepth = 4,
            maxPayloadBytes = 64,
            readTimeout = readTimeout,
            maxConcurrentCalls = maxConcurrentCalls,
            clock = Clock.fixed(now, ZoneOffset.UTC),
        )
    }

    private fun call(
        operation: String,
        payload: JsonNode? = null,
        chain: String? = null,
        timeoutMs: String? = null,
        correlationId: String? = null,
    ) = service.call(caller.id, contract, operation, payload, chain, timeoutMs, correlationId)

    private fun answer(status: Int, body: String) {
        whenever(hostClient.invokeContract(any(), any(), any(), any(), any(), any(), any(), anyOrNull()))
            .thenReturn(ActionResponse(status, json(body)))
    }

    private fun deliveredBody(): ObjectNode {
        val body = argumentCaptor<ObjectNode>()
        verify(hostClient).invokeContract(any(), any(), any(), any(), any(), body.capture(), any(), any())
        return body.firstValue
    }

    private fun operation(key: String) =
        com.ritense.externalplugin.domain.ExternalPluginManifestContracts.findOperation(providerDefinition.manifestJson, contract, key)!!

    private fun json(body: String): JsonNode = objectMapper.readTree(body)

    private fun assertError(outcome: ContractOutcome, code: String) {
        assertThat(outcome.status).isEqualTo("error")
        assertThat(outcome.errorCode).isEqualTo(code)
        assertThat(outcome.errorMessage).isNotBlank()
    }

    private fun verifyNoDelivery() {
        verify(hostClient, never()).invokeContract(any(), any(), any(), any(), any(), any(), any(), anyOrNull())
    }

    private fun consumerManifest(entry: String): ObjectNode =
        objectMapper.readTree("""{"permissions": {"contracts": [$entry]}}""") as ObjectNode

    private fun providerManifest(
        searchInput: String = """{"type": "object", "additionalProperties": false, "properties": {"query": {"type": "string"}}}""",
    ): ObjectNode = objectMapper.readTree(
        """
        {"provides": [{"contract": "$contract", "operations": [
            {"key": "list", "title": "List"},
            {"key": "get", "title": "Get", "outputs": ["body"]},
            {"key": "generate", "title": "Generate", "mode": "job", "timeout": "PT2H"},
            {"key": "search", "title": "Search",
             "input": $searchInput,
             "output": {"type": "object", "properties": {"hits": {"type": "array"}}}}
        ]}]}
        """.trimIndent()
    ) as ObjectNode

    private fun definition(pluginId: String, manifest: ObjectNode) = ExternalPluginDefinition(
        id = UUID.randomUUID(),
        pluginId = pluginId,
        version = "1.0.0",
        hostId = host.id,
        baseUrl = "${host.baseUrl}/plugins/$pluginId",
        status = ExternalPluginDefinitionStatus.AVAILABLE,
        manifestJson = manifest,
        contentHash = "sha256:accepted",
    ).also { definitions[it.id] = it }

    private fun configuration(definition: ExternalPluginDefinition) = ExternalPluginConfiguration(
        id = UUID.randomUUID(),
        definitionId = definition.id,
        title = definition.pluginId,
    ).also { configurations[it.id] = it }
}
