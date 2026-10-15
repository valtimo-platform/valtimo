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
import com.ritense.plugin.service.EncryptionService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

class ExternalPluginContractServiceTest {

    private val objectMapper = ObjectMapper()
    private val contract = "nl.ritense.openplan@1"

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
        val configurationRepository = mock<ExternalPluginConfigurationRepository>()
        val definitionRepository = mock<ExternalPluginDefinitionRepository>()
        val hostRepository = mock<ExternalPluginHostRepository>()
        val bindingRepository = mock<ExternalPluginContractBindingRepository>()
        val encryptionService = mock<EncryptionService>()
        hostClient = mock()
        whenever(configurationRepository.findById(any())).thenAnswer { Optional.ofNullable(configurations[it.getArgument(0)]) }
        whenever(definitionRepository.findById(any())).thenAnswer { Optional.ofNullable(definitions[it.getArgument(0)]) }
        whenever(hostRepository.findById(host.id)).thenReturn(Optional.of(host))
        whenever(bindingRepository.findByConfigurationIdAndContract(any(), any())).thenAnswer { invocation ->
            bindings.firstOrNull { it.configurationId == invocation.getArgument(0) && it.contract == invocation.getArgument(1) }
        }
        whenever(encryptionService.decrypt("encrypted")).thenReturn("host-secret")

        service = ExternalPluginContractService(
            configurationRepository,
            definitionRepository,
            hostRepository,
            bindingRepository,
            hostClient,
            encryptionService,
            objectMapper,
            maxDepth = 4,
            maxPayloadBytes = 64,
        )

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
            eq(host.baseUrl), eq("openplan"), eq("1.0.0"), eq(contract), eq("list"), body.capture(), eq("host-secret"),
        )
        assertThat(body.firstValue.get("configurationId").asText()).isEqualTo(provider.id.toString())
        assertThat(body.firstValue.get("caller").get("pluginId").asText()).isEqualTo("pdca")
        assertThat(body.firstValue.get("caller").get("configurationId").asText()).isEqualTo(caller.id.toString())
        assertThat(body.firstValue.get("payload").get("resource").asText()).isEqualTo("plan")
        assertThat(body.firstValue.get("chain").map { it.asText() }).containsExactly(caller.id.toString())
        assertThat(body.firstValue.has("jobId")).isFalse()
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
        verify(hostClient).invokeContract(any(), any(), any(), any(), any(), body.capture(), any())
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

    @Test
    fun `a provider error keeps PROVIDER_ERROR on top and carries the provider's code in the message`() {
        answer(200, """{"status":"error","errorCode":"NOT_FOUND","errorMessage":"no such plan"}""")

        val outcome = call("list")

        assertError(outcome, "PROVIDER_ERROR")
        assertThat(outcome.errorMessage).isEqualTo("NOT_FOUND: no such plan")
    }

    @ParameterizedTest
    @CsvSource(
        "503, EXTERNAL_PLUGIN_HOST_UNREACHABLE, PROVIDER_UNREACHABLE",
        "502, , PROVIDER_UNREACHABLE",
        "404, , PROVIDER_UNSUPPORTED",
        "404, CONTRACT_OPERATION_NOT_PROVIDED, OPERATION_NOT_PROVIDED",
        "501, CONTRACT_NOT_IMPLEMENTED, PROVIDER_UNSUPPORTED",
        "409, EXTERNAL_PLUGIN_CONTENT_CHANGED, PROVIDER_CONTENT_CHANGED",
        "500, HOST_ERROR, PROVIDER_ERROR",
        "400, , PROVIDER_ERROR",
    )
    fun `host failures map onto contract error codes`(status: Int, hostCode: String?, expected: String) {
        val body = if (hostCode == null) """{"error":"nope"}""" else """{"errorCode":"$hostCode","errorMessage":"nope"}"""
        answer(status, body)

        assertError(call("list"), expected)
    }

    @Test
    fun `accepted is not a valid answer to a synchronous call`() {
        answer(200, """{"status":"accepted"}""")

        assertError(call("list"), "PROVIDER_INVALID_RESULT")
    }

    @Test
    fun `transport failures are retryable for jobs, provider answers are not`() {
        val operation = (service.resolve(caller.id, contract, "generate", null, null, false)
            as ExternalPluginContractService.Resolution.Resolved).operation

        val unreachable = service.interpret(ActionResponse(503, json("""{"errorCode":"EXTERNAL_PLUGIN_HOST_UNREACHABLE"}""")), operation, job = true)
        val refused = service.interpret(ActionResponse(200, json("""{"status":"error","errorMessage":"no"}""")), operation, job = true)
        val accepted = service.interpret(ActionResponse(200, json("""{"status":"accepted"}""")), operation, job = true)

        assertThat((unreachable as ExternalPluginContractService.ProviderReply.Failure).retryable).isTrue()
        assertThat((refused as ExternalPluginContractService.ProviderReply.Failure).retryable).isFalse()
        assertThat(accepted).isEqualTo(ExternalPluginContractService.ProviderReply.Accepted)
    }

    private fun call(operation: String, payload: JsonNode? = null, chain: String? = null) =
        service.call(caller.id, contract, operation, payload, chain)

    private fun answer(status: Int, body: String) {
        whenever(hostClient.invokeContract(any(), any(), any(), any(), any(), any(), any()))
            .thenReturn(ActionResponse(status, json(body)))
    }

    private fun json(body: String): JsonNode = objectMapper.readTree(body)

    private fun assertError(outcome: ContractOutcome, code: String) {
        assertThat(outcome.status).isEqualTo("error")
        assertThat(outcome.errorCode).isEqualTo(code)
        assertThat(outcome.errorMessage).isNotBlank()
    }

    private fun verifyNoDelivery() {
        verify(hostClient, never()).invokeContract(any(), any(), any(), any(), any(), any(), any())
    }

    private fun providerManifest(): ObjectNode = objectMapper.readTree(
        """
        {"provides": [{"contract": "$contract", "operations": [
            {"key": "list", "title": "List"},
            {"key": "get", "title": "Get", "outputs": ["body"]},
            {"key": "generate", "title": "Generate", "mode": "job", "timeout": "PT2H"}
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
