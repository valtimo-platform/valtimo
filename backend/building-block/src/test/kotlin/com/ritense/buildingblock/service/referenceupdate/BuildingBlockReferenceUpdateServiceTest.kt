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


package com.ritense.buildingblock.service.referenceupdate

import com.ritense.buildingblock.exception.BuildingBlockReferenceUpdateException
import com.ritense.buildingblock.exception.UnknownBuildingBlockDefinitionException
import com.ritense.buildingblock.processlink.dto.BuildingBlockFieldDto
import com.ritense.buildingblock.processlink.dto.BuildingBlockInputMappingDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateChainResolutionDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType.CASE
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateExecuteRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdatePreviewRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateReasonCode.DRAFTS_NOT_ALLOWED
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.domain.PluginDefinition
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.inOrder
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.semver4j.Semver
import java.util.UUID

class BuildingBlockReferenceUpdateServiceTest {

    private val source = BuildingBlockDefinitionId.of("send-email", "1.0.0")
    private val target = BuildingBlockDefinitionId.of("send-email", "1.0.1")
    private val case = ReferenceContainer(CASE, "moving", Semver("1.3.0"))
    private val configurationId = UUID.randomUUID()

    private val index = BuildingBlockReferenceIndex(
        references = listOf(
            IndexedReference(
                container = case,
                location = CaseLinkLocation(source.key),
                child = source,
                linkId = UUID.randomUUID(),
                processDefinitionId = null,
                inputMappings = emptyList(),
                outputMappings = emptyList(),
                pluginConfigurationMappings = emptyMap(),
            )
        ),
        containers = listOf(
            ReferenceContainerInfo(ReferenceContainer.of(source), final = true, basedOnVersionTag = null, name = "Send email"),
            ReferenceContainerInfo(ReferenceContainer.of(target), final = true, basedOnVersionTag = null, name = "Send email"),
            ReferenceContainerInfo(case, final = false, basedOnVersionTag = null, name = "Moving"),
        ),
    )
    private val applier = mock<BuildingBlockReferenceUpdateApplier>()
    private val entityManager = mock<EntityManager>()

    private fun service(
        draftsAllowed: Boolean = true,
        targetFields: List<BuildingBlockFieldDto> = emptyList(),
        targetPluginKeys: Set<String> = emptySet(),
        pluginService: PluginService = mock(),
    ) = BuildingBlockReferenceUpdateService(
        referenceIndexLoader = mock { on { load(anyOrNull()) } doReturn index },
        referenceUpdateApplier = applier,
        buildingBlockFieldService = mock { on { getFields(any()) } doReturn targetFields },
        buildingBlockPluginDefinitionService = mock { on { getPluginDefinitionKeysForBuildingBlock(any()) } doReturn targetPluginKeys },
        buildingBlockDefinitionChecker = mock<BuildingBlockDefinitionChecker> {
            on { canUpdateGlobalConfiguration() } doReturn draftsAllowed
        },
        pluginService = pluginService,
        authorizationService = mock(),
        entityManager = entityManager,
    )

    @Test
    fun `the preview marks every chain not updatable where drafts are not allowed`() {
        val preview = service(draftsAllowed = false).preview(request())

        assertThat(preview.draftsAllowed).isFalse()
        val chain = preview.chains.single()
        assertThat(chain.updatable).isFalse()
        assertThat(chain.notUpdatableReasons.map { it.code }).containsExactly(DRAFTS_NOT_ALLOWED)
    }

    @Test
    fun `execution fails early where drafts are not allowed and changes nothing`() {
        val service = service(draftsAllowed = false)
        val preview = service.preview(request())

        assertThatThrownBy { service.execute(execute(listOf(preview.chains.single().id), preview.fingerprint)) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessage("This environment does not allow drafts, so building block references cannot be updated here.")
        assertNothingWritten()
    }

    @Test
    fun `execution refuses a plan that differs from the reviewed preview and changes nothing`() {
        val service = service()
        val chainId = service.preview(request()).chains.single().id

        assertThatThrownBy { service.execute(execute(listOf(chainId), "stale")) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessage(
                "The references changed since the preview, so the reviewed changes are no longer accurate. " +
                    "Refresh the preview, review the changes again and retry."
            )
        assertNothingWritten()
    }

    @Test
    fun `execution with the reviewed fingerprint locks, rechecks and writes in that order`() {
        val service = service()
        val preview = service.preview(request())

        service.execute(execute(listOf(preview.chains.single().id), preview.fingerprint))

        inOrder(applier, entityManager) {
            verify(applier).lock(ReferenceContainer.of(source))
            verify(applier).assertWritable(any())
            verify(applier).createDrafts(any())
            verify(applier).applyChanges(any(), any())
            verify(entityManager).flush()
        }
    }

    @Test
    fun `execution refuses the source as target and changes nothing`() {
        val service = service()
        val preview = service.preview(request())

        assertThatThrownBy {
            service.execute(execute(listOf(preview.chains.single().id), preview.fingerprint).copy(targetVersionTag = "1.0.0"))
        }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessage("Source and target are the same version: send-email:1.0.0.")
        assertNothingWritten()
    }

    @Test
    fun `execution refuses an invalid version and changes nothing`() {
        val service = service()
        val preview = service.preview(request())

        assertThatThrownBy {
            service.execute(execute(listOf(preview.chains.single().id), preview.fingerprint).copy(targetVersionTag = "not-a-version"))
        }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessage("Given version 'not-a-version' is not a valid Semver version")
        assertNothingWritten()
    }

    @Test
    fun `execution refuses an unknown source and changes nothing`() {
        val service = service()
        val preview = service.preview(request())

        assertThatThrownBy {
            service.execute(execute(listOf(preview.chains.single().id), preview.fingerprint).copy(sourceVersionTag = "0.9.0"))
        }
            .isInstanceOf(UnknownBuildingBlockDefinitionException::class.java)
            .hasMessage("Building block definition with id send-email:0.9.0 could not be found")
        assertNothingWritten()
    }

    @Test
    fun `execution refuses an unknown target and changes nothing`() {
        val service = service()
        val preview = service.preview(request())

        assertThatThrownBy {
            service.execute(execute(listOf(preview.chains.single().id), preview.fingerprint).copy(targetVersionTag = "2.0.0"))
        }
            .isInstanceOf(UnknownBuildingBlockDefinitionException::class.java)
            .hasMessage("Building block definition with id send-email:2.0.0 could not be found")
        assertNothingWritten()
    }

    @Test
    fun `execution refuses unknown chains and changes nothing`() {
        val service = service()
        val preview = service.preview(request())

        assertThatThrownBy { service.execute(execute(listOf(preview.chains.single().id, "unknown"), preview.fingerprint)) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessage("Unknown chains selected: unknown. Refresh the preview and try again.")
        assertNothingWritten()
    }

    @Test
    fun `execution refuses an empty selection and changes nothing`() {
        val service = service()
        val preview = service.preview(request())

        assertThatThrownBy { service.execute(execute(emptyList(), preview.fingerprint)) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessage("No chains selected. Select at least one reference to update.")
        assertNothingWritten()
    }

    @Test
    fun `execution refuses duplicate resolutions and changes nothing`() {
        val service = service(targetFields = listOf(BuildingBlockFieldDto("name", required = true)))
        val chainId = service.preview(request()).chains.single().id
        val resolution = resolution(chainId, "doc:/name")
        val fingerprint = service.preview(request().copy(resolutions = listOf(resolution))).fingerprint

        assertThatThrownBy { service.execute(execute(listOf(chainId), fingerprint, resolution, resolution)) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessage("Duplicate resolutions for chains: $chainId.")
        assertNothingWritten()
    }

    @Test
    fun `execution refuses a resolution for an unknown chain and changes nothing`() {
        val service = service()
        val preview = service.preview(request())

        assertThatThrownBy {
            service.execute(execute(listOf(preview.chains.single().id), preview.fingerprint, resolution("unknown", "doc:/name")))
        }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessage("Resolution given for unknown chain unknown. Refresh the preview and try again.")
        assertNothingWritten()
    }

    @Test
    fun `execution refuses an input source without a prefix and changes nothing`() {
        val service = service(targetFields = listOf(BuildingBlockFieldDto("name", required = true)))
        val chainId = service.preview(request()).chains.single().id
        val fingerprint = service.preview(request().copy(resolutions = listOf(resolution(chainId, "doc:/name")))).fingerprint

        assertThatThrownBy { service.execute(execute(listOf(chainId), fingerprint, resolution(chainId, "/name"))) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessage("Chain $chainId maps '/name', which is not a path starting with doc: or case:.")
        assertNothingWritten()
    }

    @Test
    fun `execution refuses an input source with a blank path and changes nothing`() {
        val service = service(targetFields = listOf(BuildingBlockFieldDto("name", required = true)))
        val chainId = service.preview(request()).chains.single().id
        val fingerprint = service.preview(request().copy(resolutions = listOf(resolution(chainId, "doc:/name")))).fingerprint

        assertThatThrownBy { service.execute(execute(listOf(chainId), fingerprint, resolution(chainId, "doc:/"))) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessage("Chain $chainId maps 'doc:/', which is not a path starting with doc: or case:.")
        assertNothingWritten()
    }

    @Test
    fun `execution refuses an input target that is not a field of the target and changes nothing`() {
        val service = service(targetFields = listOf(BuildingBlockFieldDto("name", required = true)))
        val chainId = service.preview(request()).chains.single().id
        val fingerprint = service.preview(request().copy(resolutions = listOf(resolution(chainId, "doc:/name")))).fingerprint

        assertThatThrownBy {
            service.execute(execute(listOf(chainId), fingerprint, resolution(chainId, "doc:/name", target = "/unknown")))
        }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessage("Chain $chainId maps 'doc:/name' to '/unknown', which is not a field of send-email:1.0.1.")
        assertNothingWritten()
    }

    @Test
    fun `execution refuses a configuration for a plugin that is not missing and changes nothing`() {
        val service = service()
        val preview = service.preview(request())
        val chainId = preview.chains.single().id

        assertThatThrownBy {
            service.execute(execute(listOf(chainId), preview.fingerprint, pluginResolution(chainId, "smtp")))
        }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessage("Chain $chainId selects a configuration for plugin 'smtp', which is not missing.")
        assertNothingWritten()
    }

    @Test
    fun `execution refuses a plugin configuration that does not exist and changes nothing`() {
        val validService = service(targetPluginKeys = setOf("smtp"), pluginService = pluginServiceReturning("smtp"))
        val chainId = validService.preview(request()).chains.single().id
        val fingerprint = validService.preview(request().copy(resolutions = listOf(pluginResolution(chainId, "smtp")))).fingerprint
        val service = service(targetPluginKeys = setOf("smtp"), pluginService = pluginServiceReturning(null))

        assertThatThrownBy { service.execute(execute(listOf(chainId), fingerprint, pluginResolution(chainId, "smtp"))) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessage(
                "Chain $chainId selects plugin configuration $configurationId for 'smtp', " +
                    "but no configuration of that plugin exists with that id."
            )
        assertNothingWritten()
    }

    @Test
    fun `execution refuses a plugin configuration of another plugin and changes nothing`() {
        val validService = service(targetPluginKeys = setOf("smtp"), pluginService = pluginServiceReturning("smtp"))
        val chainId = validService.preview(request()).chains.single().id
        val fingerprint = validService.preview(request().copy(resolutions = listOf(pluginResolution(chainId, "smtp")))).fingerprint
        val service = service(targetPluginKeys = setOf("smtp"), pluginService = pluginServiceReturning("other"))

        assertThatThrownBy { service.execute(execute(listOf(chainId), fingerprint, pluginResolution(chainId, "smtp"))) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessage(
                "Chain $chainId selects plugin configuration $configurationId for 'smtp', " +
                    "but no configuration of that plugin exists with that id."
            )
        assertNothingWritten()
    }

    @Test
    fun `execution refuses a chain without a source for a required input and changes nothing`() {
        val service = service(targetFields = listOf(BuildingBlockFieldDto("name", required = true)))
        val preview = service.preview(request())
        val chainId = preview.chains.single().id

        assertThatThrownBy { service.execute(execute(listOf(chainId), preview.fingerprint)) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessage("Chain $chainId is not fully configured. Required inputs without a source: /name.")
        assertNothingWritten()
    }

    @Test
    fun `the preview refuses an input source without a prefix`() {
        val service = service(targetFields = listOf(BuildingBlockFieldDto("name", required = true)))
        val chainId = service.preview(request()).chains.single().id

        assertThatThrownBy { service.preview(request().copy(resolutions = listOf(resolution(chainId, "/name")))) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessage("Chain $chainId maps '/name', which is not a path starting with doc: or case:.")
    }

    @Test
    fun `the preview refuses a plugin configuration of another plugin`() {
        val service = service(targetPluginKeys = setOf("smtp"), pluginService = pluginServiceReturning("other"))
        val chainId = service.preview(request()).chains.single().id

        assertThatThrownBy { service.preview(request().copy(resolutions = listOf(pluginResolution(chainId, "smtp")))) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessage(
                "Chain $chainId selects plugin configuration $configurationId for 'smtp', " +
                    "but no configuration of that plugin exists with that id."
            )
    }

    @Test
    fun `the preview ignores a resolution for a chain that no longer exists`() {
        val service = service()

        val preview = service.preview(request().copy(resolutions = listOf(resolution("vanished", "/not-validated"))))

        assertThat(preview.chains).hasSize(1)
    }

    private fun request() = BuildingBlockReferenceUpdatePreviewRequestDto(source.key, "1.0.0", "1.0.1")

    private fun execute(
        chainIds: List<String>,
        fingerprint: String,
        vararg resolutions: BuildingBlockReferenceUpdateChainResolutionDto,
    ) = BuildingBlockReferenceUpdateExecuteRequestDto(
        source.key,
        "1.0.0",
        "1.0.1",
        chainIds,
        resolutions = resolutions.toList(),
        expectedFingerprint = fingerprint,
    )

    private fun resolution(chainId: String, inputSource: String, target: String = "/name") =
        BuildingBlockReferenceUpdateChainResolutionDto(chainId, inputMappings = listOf(BuildingBlockInputMappingDto(inputSource, target)))

    private fun pluginResolution(chainId: String, pluginDefinitionKey: String) =
        BuildingBlockReferenceUpdateChainResolutionDto(chainId, pluginConfigurations = mapOf(pluginDefinitionKey to configurationId))

    private fun pluginServiceReturning(pluginDefinitionKey: String?): PluginService {
        val configuration = pluginDefinitionKey?.let { key ->
            val definition = mock<PluginDefinition> { on { this.key } doReturn key }
            mock<PluginConfiguration> { on { pluginDefinition } doReturn definition }
        }
        return mock { on { findPluginConfiguration(any<PluginConfigurationId>()) } doReturn configuration }
    }

    private fun assertNothingWritten() {
        verify(applier, never()).assertWritable(any())
        verify(applier, never()).createDrafts(any())
        verify(applier, never()).applyChanges(any(), any())
        verifyNoInteractions(entityManager)
    }
}
