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

package com.ritense.externalplugin.web.rest

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.externalplugin.BaseIntegrationTest
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.client.ExternalPluginHostClient.ActionResponse
import com.ritense.externalplugin.domain.EventQueueMode
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginContractBinding
import com.ritense.externalplugin.domain.ExternalPluginContractJob
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostKind
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import com.ritense.externalplugin.exception.ExternalPluginConfigurationInUseException
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginContractBindingRepository
import com.ritense.externalplugin.repository.ExternalPluginContractJobRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.externalplugin.service.ExternalPluginConfigurationService
import com.ritense.externalplugin.service.ExternalPluginContractJobDispatcher
import com.ritense.externalplugin.service.ExternalPluginServiceTokenService
import com.ritense.plugin.service.EncryptionService
import com.ritense.plugin.web.rest.dto.PluginUsageParentType
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.HttpMethod
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

/**
 * Contract calls and the job ledger through the assembled security chain and the real database:
 * plugin tokens reach the contract surface without any endpoint grant, the token decides whose
 * bindings and jobs are reachable, payloads are stored encrypted, and the dispatcher's queries and
 * row locks run on the target database.
 */
@AutoConfigureMockMvc
@Transactional
class ExternalPluginContractIntTest @Autowired constructor(
    private val mockMvc: MockMvc,
    private val hostRepository: ExternalPluginHostRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val bindingRepository: ExternalPluginContractBindingRepository,
    private val jobRepository: ExternalPluginContractJobRepository,
    private val serviceTokenService: ExternalPluginServiceTokenService,
    private val configurationService: ExternalPluginConfigurationService,
    private val dispatcher: ExternalPluginContractJobDispatcher,
    private val encryptionService: EncryptionService,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    @MockitoBean
    lateinit var hostClient: ExternalPluginHostClient

    private val contract = "nl.ritense.document.generate@1"

    private lateinit var requester: ExternalPluginConfiguration
    private lateinit var provider: ExternalPluginConfiguration
    private lateinit var outsider: ExternalPluginConfiguration
    private lateinit var requesterToken: String
    private lateinit var providerToken: String
    private lateinit var outsiderToken: String

    @BeforeEach
    fun seed() {
        val host = hostRepository.saveAndFlush(
            ExternalPluginHost(
                id = UUID.randomUUID(),
                name = "host-${UUID.randomUUID()}",
                baseUrl = "https://plugin-host-${UUID.randomUUID()}:8090",
                secret = encryptionService.encrypt("host-secret"),
                status = ExternalPluginHostStatus.CONNECTED,
                kind = ExternalPluginHostKind.PLUGIN_HOST,
                gzacCallbackBaseUrl = "http://gzac:8080",
                eventQueueMode = EventQueueMode.LIVE,
            )
        )
        val requesterDefinition = definition(host, "pdca", """{"permissions": {"contracts": ["$contract"]}}""")
        val providerDefinition = definition(
            host,
            "generator",
            """
            {"provides": [{"contract": "$contract", "operations": [
                {"key": "generate", "title": "Generate", "mode": "job", "timeout": "PT2H", "outputs": ["documentRef"]}
            ]}]}
            """.trimIndent(),
        )
        val outsiderDefinition = definition(host, "outsider", "{}")
        requester = configuration(requesterDefinition)
        provider = configuration(providerDefinition)
        outsider = configuration(outsiderDefinition)
        bindingRepository.saveAndFlush(ExternalPluginContractBinding(UUID.randomUUID(), requester.id, contract, provider.id))
        requesterToken = serviceTokenService.issue(requester, requesterDefinition)
        providerToken = serviceTokenService.issue(provider, providerDefinition)
        outsiderToken = serviceTokenService.issue(outsider, outsiderDefinition)
    }

    @Test
    fun `a service token reaches the contract surface without any endpoint grant`() {
        val response = post("/api/v1/plugin-contract/call", outsiderToken, """{"contract":"nl.ritense.none@1","operation":"x"}""")

        assertThat(response.status).isEqualTo(200)
        assertThat(json(response).get("errorCode").asText()).isEqualTo("NO_PROVIDER_BOUND")
    }

    @Test
    fun `a job operation cannot be called synchronously`() {
        val response = post("/api/v1/plugin-contract/call", requesterToken, """{"contract":"$contract","operation":"generate"}""")

        assertThat(json(response).get("errorCode").asText()).isEqualTo("OPERATION_REQUIRES_JOB")
    }

    @Test
    fun `a malformed body is a bad request`() {
        assertThat(post("/api/v1/plugin-contract/call", requesterToken, """{"operation":"generate"}""").status).isEqualTo(400)
    }

    @Test
    fun `a job travels from request to delivered reply`() {
        val created = post(
            "/api/v1/plugin-contract/jobs",
            requesterToken,
            """{"contract":"$contract","operation":"generate","payload":{"templateKey":"pdca-report"}}""",
        )
        assertThat(created.status).isEqualTo(202)
        val jobId = UUID.fromString(json(created).get("jobId").asText())
        assertThat(job(jobId).requestPayload).doesNotContain("pdca-report")
        assertThat(job(jobId).deadline).isAfter(Instant.now().plusSeconds(7_000))
        assertThat(configurationService.findUsages(requester.id).map { it.parentType })
            .containsExactly(PluginUsageParentType.CONTRACT_JOB)

        whenever(hostClient.invokeContract(any(), any(), any(), any(), any(), any(), any()))
            .thenReturn(ActionResponse(200, objectMapper.readTree("""{"status":"accepted"}""")))
        dispatcher.dispatch()
        assertThat(job(jobId).status).isEqualTo(ExternalPluginContractJobStatus.ACCEPTED)

        val completion = """{"status":"completed","result":{"documentRef":"https://docs/1"}}"""
        assertThat(post("/api/v1/plugin-contract/jobs/$jobId/complete", requesterToken, completion).status).isEqualTo(404)
        val completed = post("/api/v1/plugin-contract/jobs/$jobId/complete", providerToken, completion)
        assertThat(completed.status).isEqualTo(200)
        assertThat(json(completed).get("status").asText()).isEqualTo("completed")
        assertThat(post("/api/v1/plugin-contract/jobs/$jobId/complete", providerToken, completion).status).isEqualTo(409)
        assertThat(job(jobId).resultPayload).doesNotContain("docs/1")

        val read = get("/api/v1/plugin-contract/jobs/$jobId", requesterToken)
        assertThat(read.status).isEqualTo(200)
        assertThat(json(read).get("status").asText()).isEqualTo("completed")
        assertThat(json(read).get("result").get("documentRef").asText()).isEqualTo("https://docs/1")
        assertThat(get("/api/v1/plugin-contract/jobs/$jobId", outsiderToken).status).isEqualTo(404)

        whenever(hostClient.invokeContractReply(any(), any(), any(), any(), any()))
            .thenReturn(ActionResponse(200, objectMapper.readTree("""{"status":"completed"}""")))
        dispatcher.dispatch()
        assertThat(job(jobId).status).isEqualTo(ExternalPluginContractJobStatus.DELIVERED)

        val listed = mockMvc.perform(
            MockMvcRequestBuilders.get("/api/management/v1/external-plugin/contract-job")
                .param("configurationId", requester.id.toString())
                .with(user("admin").authorities(SimpleGrantedAuthority(ADMIN)))
        ).andReturn().response
        assertThat(listed.status).isEqualTo(200)
        val entry = json(listed).get("content").single()
        assertThat(entry.get("status").asText()).isEqualTo("DELIVERED")
        assertThat(entry.get("requesterPluginId").asText()).isEqualTo("pdca")
        assertThat(entry.get("providerTitle").asText()).isEqualTo("generator")

        val detail = mockMvc.perform(
            MockMvcRequestBuilders.get("/api/management/v1/external-plugin/contract-job/$jobId")
                .with(user("admin").authorities(SimpleGrantedAuthority(ADMIN)))
        ).andReturn().response
        assertThat(json(detail).get("requestPayload").get("templateKey").asText()).isEqualTo("pdca-report")
    }

    @Test
    fun `providers of a contract are listed by name, including the version suffix`() {
        val response = mockMvc.perform(
            MockMvcRequestBuilders.get("/api/management/v1/external-plugin/contract/{contract}/providers", contract)
                .with(user("admin").authorities(SimpleGrantedAuthority(ADMIN)))
        ).andReturn().response

        assertThat(response.status).isEqualTo(200)
        val providers = json(response).map { it.get("configurationId").asText() }
        assertThat(providers).contains(provider.id.toString())
        assertThat(providers).doesNotContain(requester.id.toString(), outsider.id.toString())
    }

    @Test
    fun `a bound provider cannot be deleted`() {
        assertThat(configurationService.findUsages(provider.id).map { it.parentType })
            .containsExactly(PluginUsageParentType.CONTRACT_BINDING)
        assertThatThrownBy { configurationService.delete(provider.id) }
            .isInstanceOf(ExternalPluginConfigurationInUseException::class.java)
    }

    @Test
    fun `the dispatcher's expiry, delivery and purge queries run on the database`() {
        val expired = jobRepository.saveAndFlush(
            ExternalPluginContractJob(
                id = UUID.randomUUID(),
                contract = contract,
                operation = "generate",
                requesterConfigurationId = requester.id,
                providerConfigurationId = provider.id,
                status = ExternalPluginContractJobStatus.ACCEPTED,
                requestPayload = encryptionService.encrypt("{}"),
                deadline = Instant.now().minusSeconds(60),
                nextAttemptAt = null,
            )
        )
        val stale = jobRepository.saveAndFlush(
            ExternalPluginContractJob(
                id = UUID.randomUUID(),
                contract = contract,
                operation = "generate",
                requesterConfigurationId = requester.id,
                providerConfigurationId = provider.id,
                status = ExternalPluginContractJobStatus.DELIVERED,
                requestPayload = encryptionService.encrypt("{}"),
                deadline = Instant.now(),
                createdAt = Instant.now().minusSeconds(60L * 60 * 24 * 40),
                nextAttemptAt = null,
            )
        )
        whenever(hostClient.invokeContractReply(any(), any(), any(), any(), any()))
            .thenReturn(ActionResponse(503, null))

        dispatcher.dispatch()

        val afterExpiry = job(expired.id)
        assertThat(afterExpiry.status).isEqualTo(ExternalPluginContractJobStatus.EXPIRED)
        assertThat(afterExpiry.errorCode).isEqualTo("CONTRACT_JOB_EXPIRED")
        assertThat(afterExpiry.deliveryAttempts).isEqualTo(1)
        assertThat(jobRepository.findById(stale.id)).isEmpty()
    }

    private fun post(path: String, token: String, body: String): MockHttpServletResponse =
        mockMvc.perform(
            MockMvcRequestBuilders.request(HttpMethod.POST, path)
                .header("Authorization", "Bearer $token")
                .contentType("application/json")
                .content(body)
        ).andReturn().response

    private fun get(path: String, token: String): MockHttpServletResponse =
        mockMvc.perform(
            MockMvcRequestBuilders.get(path).header("Authorization", "Bearer $token")
        ).andReturn().response

    private fun json(response: MockHttpServletResponse): JsonNode = objectMapper.readTree(response.contentAsString)

    private fun job(id: UUID): ExternalPluginContractJob = jobRepository.findById(id).orElseThrow()

    private fun definition(host: ExternalPluginHost, pluginId: String, manifest: String) =
        definitionRepository.saveAndFlush(
            ExternalPluginDefinition(
                id = UUID.randomUUID(),
                pluginId = pluginId,
                version = "1.0.0-${UUID.randomUUID()}",
                manifestJson = objectMapper.readTree(manifest) as ObjectNode,
                hostId = host.id,
                baseUrl = "${host.baseUrl}/plugins/$pluginId",
                status = ExternalPluginDefinitionStatus.AVAILABLE,
                contentHash = "sha256:accepted",
            )
        )

    private fun configuration(definition: ExternalPluginDefinition) = configurationRepository.saveAndFlush(
        ExternalPluginConfiguration(
            id = UUID.randomUUID(),
            definitionId = definition.id,
            title = definition.pluginId,
            properties = objectMapper.createObjectNode(),
        )
    )
}
