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

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.externalplugin.client.ExternalPluginHostClient
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
import com.ritense.externalplugin.repository.ExternalPluginGrantedCapabilityRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEgressRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEndpointRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEventRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.externalplugin.web.rest.dto.ContractBindingEntry
import com.ritense.plugin.service.EncryptionService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.inOrder
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

/**
 * Contract bindings: exact match against `permissions.contracts`, bind-time target checks, the
 * re-acceptance rule, the push, and that a contract-free configuration behaves exactly as before.
 */
class ExternalPluginConfigurationServiceContractBindingTest {

    private val objectMapper = ObjectMapper()
    private val openplan = "nl.ritense.openplan@1"

    private val definitions = mutableMapOf<UUID, ExternalPluginDefinition>()
    private val configurations = mutableMapOf<UUID, ExternalPluginConfiguration>()
    private val bindings = mutableListOf<ExternalPluginContractBinding>()

    private lateinit var bindingRepository: ExternalPluginContractBindingRepository
    private lateinit var hostClient: ExternalPluginHostClient
    private lateinit var service: ExternalPluginConfigurationService

    private lateinit var consumerDefinition: ExternalPluginDefinition
    private lateinit var providerDefinition: ExternalPluginDefinition
    private lateinit var provider: ExternalPluginConfiguration
    private lateinit var unrelated: ExternalPluginConfiguration

    @BeforeEach
    fun setUp() {
        val configurationRepository = mock<ExternalPluginConfigurationRepository>()
        val definitionRepository = mock<ExternalPluginDefinitionRepository>()
        bindingRepository = mock()
        hostClient = mock()
        val propertyEncryptor = mock<PluginPropertyEncryptor>()
        val encryptionService = mock<EncryptionService>()
        val serviceTokenService = mock<ExternalPluginServiceTokenService>()
        val hostRepository = mock<ExternalPluginHostRepository>()

        whenever(definitionRepository.findById(any())).thenAnswer { Optional.ofNullable(definitions[it.getArgument(0)]) }
        whenever(definitionRepository.findAll()).thenAnswer { definitions.values.toList() }
        whenever(definitionRepository.save(any<ExternalPluginDefinition>())).thenAnswer { it.getArgument(0) }
        whenever(configurationRepository.findById(any())).thenAnswer { Optional.ofNullable(configurations[it.getArgument(0)]) }
        whenever(configurationRepository.findAllByDefinitionId(any())).thenAnswer { invocation ->
            configurations.values.filter { it.definitionId == invocation.getArgument(0) }
        }
        whenever(configurationRepository.save(any<ExternalPluginConfiguration>())).thenAnswer {
            it.getArgument<ExternalPluginConfiguration>(0).also { saved -> configurations[saved.id] = saved }
        }
        whenever(bindingRepository.findAll()).thenAnswer { bindings.toList() }
        whenever(bindingRepository.findAllByConfigurationId(any())).thenAnswer { invocation ->
            bindings.filter { it.configurationId == invocation.getArgument(0) }
        }
        whenever(bindingRepository.findAllByTargetConfigurationIdIn(any())).thenAnswer { invocation ->
            val ids = invocation.getArgument<Collection<UUID>>(0)
            bindings.filter { it.targetConfigurationId in ids }
        }
        whenever(bindingRepository.save(any<ExternalPluginContractBinding>())).thenAnswer {
            it.getArgument<ExternalPluginContractBinding>(0).also { saved -> bindings += saved }
        }
        whenever(bindingRepository.deleteAllByConfigurationId(any())).thenAnswer { invocation ->
            bindings.removeIf { it.configurationId == invocation.getArgument(0) }
        }
        whenever(bindingRepository.deleteAll(any<Iterable<ExternalPluginContractBinding>>())).thenAnswer { invocation ->
            bindings.removeAll(invocation.getArgument<Iterable<ExternalPluginContractBinding>>(0).toSet())
        }
        whenever(propertyEncryptor.encryptSecretFields(any(), anyOrNull())).thenAnswer { it.getArgument(0) }
        whenever(propertyEncryptor.decryptSecretFields(any(), anyOrNull())).thenAnswer { it.getArgument(0) }
        whenever(encryptionService.decrypt(any())).thenReturn("admin-token")
        whenever(serviceTokenService.issue(any(), any())).thenReturn("svc-token")
        whenever(hostRepository.findById(any())).thenReturn(Optional.empty())
        whenever(hostClient.pushConfiguration(
            any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), anyOrNull(), any(), any(), any(),
            any(), any(), anyOrNull(), any(), any(), any(), anyOrNull(),
        )).thenReturn(true)

        service = ExternalPluginConfigurationService(
            configurationRepository,
            definitionRepository,
            hostRepository,
            mock<ExternalPluginGrantedEndpointRepository>(),
            mock<ExternalPluginGrantedEventRepository>(),
            mock<ExternalPluginGrantedCapabilityRepository>(),
            mock<ExternalPluginGrantedEgressRepository>(),
            hostClient,
            propertyEncryptor,
            encryptionService,
            objectMapper,
            serviceTokenService,
            mock<ExternalPluginHostUsageResolver>(),
            "valtimo-events",
            "http://localhost:8080",
            bindingRepository,
        )

        consumerDefinition = definition("pdca", manifest(consumes = listOf(openplan)))
        providerDefinition = definition("openplan", manifest(provides = listOf(openplan)))
        provider = configuration(providerDefinition, "Open Plan")
        unrelated = configuration(definition("case-summary", manifest()), "Case summary")
    }

    // ---------------------------------------------------------------- create

    @Test
    fun `create stores a binding to a configuration that provides the declared contract`() {
        val created = create(consumerDefinition, listOf(ContractBindingEntry(openplan, provider.id)))

        assertThat(bindings).singleElement().satisfies({
            assertThat(it.configurationId).isEqualTo(created.id)
            assertThat(it.contract).isEqualTo(openplan)
            assertThat(it.targetConfigurationId).isEqualTo(provider.id)
        })
    }

    @Test
    fun `create rejects a declared contract that is left unbound`() {
        assertThatThrownBy { create(consumerDefinition, emptyList()) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("All contract bindings declared in the plugin manifest must be granted")
            .hasMessageContaining(openplan)
        assertThat(bindings).isEmpty()
    }

    @Test
    fun `create rejects a binding for a contract the manifest does not declare`() {
        val extra = "nl.ritense.other@1"
        definition("other", manifest(provides = listOf(extra))).let { configuration(it, "Other") }.also { other ->
            assertThatThrownBy {
                create(
                    consumerDefinition,
                    listOf(ContractBindingEntry(openplan, provider.id), ContractBindingEntry(extra, other.id)),
                )
            }
                .isInstanceOf(IllegalArgumentException::class.java)
                .hasMessageContaining("must be declared in the plugin manifest")
                .hasMessageContaining(extra)
        }
    }

    @Test
    fun `create rejects binding a contract twice`() {
        assertThatThrownBy {
            create(
                consumerDefinition,
                listOf(ContractBindingEntry(openplan, provider.id), ContractBindingEntry(openplan, unrelated.id)),
            )
        }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("bound only once")
    }

    @Test
    fun `create rejects a target that does not provide the contract`() {
        assertThatThrownBy { create(consumerDefinition, listOf(ContractBindingEntry(openplan, unrelated.id))) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("does not provide it")
    }

    @Test
    fun `create rejects a target that does not exist`() {
        assertThatThrownBy { create(consumerDefinition, listOf(ContractBindingEntry(openplan, UUID.randomUUID()))) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("does not exist")
    }

    @Test
    fun `a configuration cannot bind to itself`() {
        val selfProviding = definition("loop", manifest(consumes = listOf(openplan), provides = listOf(openplan)))
        val id = UUID.randomUUID()

        assertThatThrownBy { create(selfProviding, listOf(ContractBindingEntry(openplan, id)), id = id) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("cannot be bound to the configuration itself")
    }

    @Test
    fun `a binding that closes a cycle is rejected`() {
        val a = "nl.ritense.a@1"
        val b = "nl.ritense.b@1"
        val first = configuration(definition("first", manifest(consumes = listOf(b), provides = listOf(a))), "First")
        val second = configuration(definition("second", manifest(consumes = listOf(a), provides = listOf(b))), "Second")
        bindings += ExternalPluginContractBinding(UUID.randomUUID(), second.id, a, first.id)

        assertThatThrownBy {
            service.update(first.id, first.title, objectMapper.createObjectNode(), contractBindings = listOf(ContractBindingEntry(b, second.id)))
        }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("cycle")
        assertThat(bindings.filter { it.configurationId == first.id }).isEmpty()
    }

    @Test
    fun `a descriptor may bind to a target that does not exist yet, and skips the provides-check for placeholders`() {
        val placeholder = definition("pdca", null, status = ExternalPluginDefinitionStatus.UNAVAILABLE, contentHash = null)
        val missingTarget = UUID.randomUUID()

        service.create(
            definitionId = placeholder.id,
            title = "PDCA",
            properties = objectMapper.createObjectNode(),
            grantedEndpoints = emptyList(),
            grantedEvents = emptyList(),
            allowPlaceholder = true,
            contractBindings = listOf(ContractBindingEntry(openplan, missingTarget)),
        )
        val other = service.create(
            definitionId = placeholder.id,
            title = "PDCA 2",
            properties = objectMapper.createObjectNode(),
            grantedEndpoints = emptyList(),
            grantedEvents = emptyList(),
            allowPlaceholder = true,
            contractBindings = listOf(ContractBindingEntry(openplan, unrelated.id)),
        )

        assertThat(bindings.map { it.targetConfigurationId }).containsExactlyInAnyOrder(missingTarget, unrelated.id)
        assertThat(other.id).isNotNull()
    }

    @Test
    fun `a contract-free configuration activates and pushes exactly as before`() {
        val plain = definition("plain", manifest())

        val created = create(plain, emptyList())
        service.pushToHost(created, plain, host())

        assertThat(bindings).isEmpty()
        val pushed = argumentCaptor<List<String>>()
        verify(hostClient).pushConfiguration(
            any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), anyOrNull(), any(), any(), any(),
            any(), pushed.capture(), anyOrNull(), any(), any(), any(), anyOrNull(),
        )
        assertThat(pushed.firstValue).isEmpty()
    }

    // ---------------------------------------------------------------- push / update

    @Test
    fun `push carries the bound contract names as grantedContracts`() {
        val created = create(consumerDefinition, listOf(ContractBindingEntry(openplan, provider.id)))

        service.pushToHost(created, consumerDefinition, host())

        val pushed = argumentCaptor<List<String>>()
        verify(hostClient).pushConfiguration(
            any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), anyOrNull(), any(), any(), any(),
            any(), pushed.capture(), anyOrNull(), any(), any(), any(), anyOrNull(),
        )
        assertThat(pushed.firstValue).containsExactly(openplan)
    }

    @Test
    fun `update without bindings leaves them alone, with bindings replaces them after flushing the delete`() {
        val created = create(consumerDefinition, listOf(ContractBindingEntry(openplan, provider.id)))
        val second = configuration(providerDefinition, "Open Plan (acceptance)")

        service.update(created.id, "PDCA", objectMapper.createObjectNode())
        assertThat(bindings.single().targetConfigurationId).isEqualTo(provider.id)

        service.update(created.id, "PDCA", objectMapper.createObjectNode(), contractBindings = listOf(ContractBindingEntry(openplan, second.id)))

        assertThat(bindings.single().targetConfigurationId).isEqualTo(second.id)
        inOrder(bindingRepository) {
            verify(bindingRepository).deleteAllByConfigurationId(created.id)
            verify(bindingRepository).flush()
            verify(bindingRepository).save(any())
        }
    }

    @Test
    fun `getContractBindings names the target`() {
        val created = create(consumerDefinition, listOf(ContractBindingEntry(openplan, provider.id)))

        assertThat(service.getContractBindings(created.id)).singleElement().satisfies({
            assertThat(it.contract).isEqualTo(openplan)
            assertThat(it.targetConfigurationTitle).isEqualTo("Open Plan")
        })
    }

    @Test
    fun `providers lists every configuration whose definition provides the contract`() {
        val providers = service.findContractProviders(openplan)

        assertThat(providers).singleElement().satisfies({
            assertThat(it.configurationId).isEqualTo(provider.id)
            assertThat(it.pluginId).isEqualTo("openplan")
            assertThat(it.available).isTrue()
            assertThat(it.operations.map { op -> op.key to op.mode }).containsExactly("list" to "sync", "generate" to "job")
            assertThat(it.operations.last().timeout).isEqualTo("PT2H")
        })
    }

    @Test
    fun `deleting a configuration removes its own bindings`() {
        val created = create(consumerDefinition, listOf(ContractBindingEntry(openplan, provider.id)))

        service.delete(created.id)

        assertThat(bindings).isEmpty()
    }

    // ---------------------------------------------------------------- re-acceptance

    @Test
    fun `re-acceptance keeps declared bindings, drops undeclared ones and auto-binds a sole provider`() {
        val dropped = "nl.ritense.dropped@1"
        val added = "nl.ritense.added@1"
        val droppedProvider = configuration(definition("dropped", manifest(provides = listOf(dropped))), "Dropped")
        val addedProvider = configuration(definition("added", manifest(provides = listOf(added))), "Added")
        consumerDefinition.manifestJson = manifest(consumes = listOf(openplan, dropped))
        val consumer = create(
            consumerDefinition,
            listOf(ContractBindingEntry(openplan, provider.id), ContractBindingEntry(dropped, droppedProvider.id)),
        )
        stagePending(consumerDefinition, manifest(consumes = listOf(openplan, added)))

        service.acceptContent(consumerDefinition.id, "sha256:pending")

        assertThat(bindings.filter { it.configurationId == consumer.id }.map { it.contract to it.targetConfigurationId })
            .containsExactlyInAnyOrder(openplan to provider.id, added to addedProvider.id)
    }

    @Test
    fun `re-acceptance leaves a newly declared contract unbound when several providers exist`() {
        val added = "nl.ritense.added@1"
        configuration(definition("added-a", manifest(provides = listOf(added))), "A")
        configuration(definition("added-b", manifest(provides = listOf(added))), "B")
        val consumer = create(consumerDefinition, listOf(ContractBindingEntry(openplan, provider.id)))
        stagePending(consumerDefinition, manifest(consumes = listOf(openplan, added)))

        service.acceptContent(consumerDefinition.id, "sha256:pending")

        assertThat(bindings.filter { it.configurationId == consumer.id }.map { it.contract }).containsExactly(openplan)
    }

    @Test
    fun `findGrantMismatches reports a contract the descriptor did not bind`() {
        val placeholder = definition("pdca", null, status = ExternalPluginDefinitionStatus.UNAVAILABLE, contentHash = null)
        service.create(
            definitionId = placeholder.id,
            title = "PDCA",
            properties = objectMapper.createObjectNode(),
            grantedEndpoints = emptyList(),
            grantedEvents = emptyList(),
            allowPlaceholder = true,
        )
        placeholder.manifestJson = manifest(consumes = listOf(openplan))

        assertThat(service.findGrantMismatches(placeholder)).singleElement().satisfies({
            assertThat(it).contains("contract bindings declared but not granted: $openplan")
        })
    }

    @Test
    fun `findGrantMismatches is silent for a contract-free manifest`() {
        val plain = definition("plain", manifest())
        create(plain, emptyList())

        assertThat(service.findGrantMismatches(plain)).isEmpty()
    }

    // ---------------------------------------------------------------- helpers

    private fun create(
        definition: ExternalPluginDefinition,
        contractBindings: List<ContractBindingEntry>,
        id: UUID = UUID.randomUUID(),
    ): ExternalPluginConfiguration = service.create(
        definitionId = definition.id,
        title = "PDCA",
        properties = objectMapper.createObjectNode(),
        grantedEndpoints = emptyList(),
        grantedEvents = emptyList(),
        id = id,
        contractBindings = contractBindings,
    )

    private fun stagePending(definition: ExternalPluginDefinition, pending: ObjectNode) {
        definition.pendingContentHash = "sha256:pending"
        definition.pendingManifestJson = pending
    }

    private fun definition(
        pluginId: String,
        manifest: ObjectNode?,
        status: ExternalPluginDefinitionStatus = ExternalPluginDefinitionStatus.AVAILABLE,
        contentHash: String? = "sha256:accepted",
    ) = ExternalPluginDefinition(
        id = UUID.randomUUID(),
        pluginId = pluginId,
        version = "1.0.0",
        hostId = UUID.randomUUID(),
        baseUrl = "https://host.example.com/plugins/$pluginId",
        status = status,
        manifestJson = manifest,
        contentHash = contentHash,
    ).also { definitions[it.id] = it }

    private fun configuration(definition: ExternalPluginDefinition, title: String) = ExternalPluginConfiguration(
        id = UUID.randomUUID(),
        definitionId = definition.id,
        title = title,
    ).also { configurations[it.id] = it }

    private fun manifest(consumes: List<String> = emptyList(), provides: List<String> = emptyList()): ObjectNode =
        objectMapper.createObjectNode().apply {
            putObject("permissions").apply {
                if (consumes.isNotEmpty()) putArray("contracts").apply { consumes.forEach { add(it) } }
            }
            if (provides.isNotEmpty()) {
                putArray("provides").apply {
                    provides.forEach { contract ->
                        addObject().put("contract", contract).putArray("operations").apply {
                            addObject().put("key", "list").put("title", "List")
                            addObject().put("key", "generate").put("title", "Generate").put("mode", "job").put("timeout", "PT2H")
                        }
                    }
                }
            }
        }

    private fun host() = ExternalPluginHost(
        id = UUID.randomUUID(),
        name = "host",
        baseUrl = "https://host.example.com",
        secret = "encrypted",
        status = ExternalPluginHostStatus.CONNECTED,
        kind = ExternalPluginHostKind.PLUGIN_HOST,
        gzacCallbackBaseUrl = "http://gzac:8080",
        eventQueueMode = EventQueueMode.LIVE,
    )
}
