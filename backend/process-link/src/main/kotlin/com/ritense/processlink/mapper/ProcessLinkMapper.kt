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

package com.ritense.processlink.mapper

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.exporter.manifest.ArtifactDependency
import com.ritense.exporter.request.ExportRequest
import com.ritense.processlink.autodeployment.ProcessLinkDeployDto
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.web.rest.dto.MissingReferenceDto
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.processlink.web.rest.dto.ReplacedElementDto
import com.ritense.processlink.web.rest.dto.ProcessLinkExportResponseDto
import com.ritense.processlink.web.rest.dto.ProcessLinkResponseDto
import com.ritense.processlink.web.rest.dto.ProcessLinkUpdateRequestDto
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.springframework.context.ApplicationEventPublisher
import java.util.UUID

interface ProcessLinkMapper {
    fun supportsProcessLinkType(processLinkType: String): Boolean
    fun toProcessLinkResponseDto(processLink: ProcessLink): ProcessLinkResponseDto
    fun toProcessLinkCreateRequestDto(
        deployDto: ProcessLinkDeployDto,
        blueprintId: BlueprintId?
    ): ProcessLinkCreateRequestDto
    fun toProcessLinkUpdateRequestDto(
        deployDto: ProcessLinkDeployDto,
        existingProcessLinkId: UUID,
        blueprintId: BlueprintId?
    ): ProcessLinkUpdateRequestDto

    fun toProcessLinkExportResponseDto(processLink: ProcessLink): ProcessLinkExportResponseDto
    fun toNewProcessLink(createRequestDto: ProcessLinkCreateRequestDto, blueprintId: BlueprintId?): ProcessLink
    fun toUpdatedProcessLink(
        processLinkToUpdate: ProcessLink,
        updateRequestDto: ProcessLinkUpdateRequestDto,
        blueprintId: BlueprintId?
    ): ProcessLink

    /**
     * Used by the export service.
     * Should return export requests the provided processLink depends on.
     * @param processLink The processLink to create related export requests for
     * @param caseDefinitionId The caseDefinitionId of the case the processLink is part of
     */
    fun createRelatedExportRequests(processLink: ProcessLink, caseDefinitionId: CaseDefinitionId): Set<ExportRequest> =
        setOf()

    /**
     * Used by the export service for a process definition that is not part of a case definition.
     * Should return the (global) export requests the provided processLink depends on, so the
     * definitions it points at (e.g. forms) are bundled into the `config/global` export.
     * @param processLink The processLink to create related export requests for
     */
    fun createGlobalRelatedExportRequests(processLink: ProcessLink): Set<ExportRequest> =
        setOf()

    /**
     * Used by the export service to build the export manifest.
     * Should return the manifest dependencies (e.g. plugins) the provided processLink introduces.
     * @param processLink The processLink to derive manifest dependencies from
     */
    fun toManifestDependencies(processLink: ProcessLink): Set<ArtifactDependency> = setOf()

    fun getImporterType(): String? = null

    /**
     * Used when previewing an import.
     * Should return the definition this process link points at when it is not available, so the user
     * can be told what is missing before the import is attempted.
     * @param deployDto The process link as present in the import
     * @param blueprintId The case or building block the process link will be imported for, if any
     */
    fun getMissingReference(deployDto: ProcessLinkDeployDto, blueprintId: BlueprintId?): MissingReferenceDto? = null

    /**
     * Used when previewing an import of a process that is not part of a case definition. Should
     * return the definition this process link points at when it already exists on this environment
     * and is bundled in the import, so the user can be told it will be replaced before importing.
     * @param deployDto The process link as present in the import
     * @param blueprintId The case or building block the process link will be imported for, if any
     */
    fun getReplacedReference(deployDto: ProcessLinkDeployDto, blueprintId: BlueprintId?): ReplacedElementDto? = null

    /**
     * Called after all imports for a case definition are complete.
     * Used to check for configuration issues (e.g. missing plugin configurations).
     *
     * @param caseDefinitionId The case definition that was imported
     * @param processDefinitionIds All process definition IDs linked to the case definition
     * @param applicationEventPublisher Publisher for configuration issue events
     */
    fun afterImport(
        caseDefinitionId: CaseDefinitionId,
        processDefinitionIds: Set<String>,
        applicationEventPublisher: ApplicationEventPublisher
    ) { /* no-op default */ }

    /**
     * Called by the process-link importer for every deployment node this mapper is responsible for,
     * before the node is deserialized into a [ProcessLinkDeployDto]. Lets each mapper rewrite the
     * plugin-configuration-id field(s) it owns using the imported-to-target-environment mapping
     * (source configuration UUID -> target configuration UUID, or `null` when left dangling).
     * Default is a no-op — mappers that don't reference a plugin configuration by id don't need this.
     *
     * @param node the mutable deployment JSON node about to be deserialized
     * @param mappings source plugin-configuration UUID -> target plugin-configuration UUID (`null`
     *   value means "leave dangling", e.g. because the admin chose not to map it during import)
     */
    fun applyPluginConfigurationMappings(node: ObjectNode, mappings: Map<UUID, UUID?>) { /* no-op default */ }
}

/**
 * Rewrites a single UUID-valued text field on [node] using [mappings] (source UUID -> target UUID,
 * `null` meaning "leave dangling"). No-op when the field is absent, blank, not a valid UUID, or has
 * no entry in [mappings]. Shared by [ProcessLinkMapper] implementations backing
 * [ProcessLinkMapper.applyPluginConfigurationMappings].
 *
 * [allowNull] controls what happens when [mappings] resolves the original id to `null`: when `true`
 * (default) the field is nulled out on the node, leaving the id dangling for [ProcessLinkMapper]s
 * whose deploy DTO declares the field nullable. When `false` — for DTOs whose field is non-nullable
 * (e.g. `ExternalPluginTaskFormProcessLinkDeployDto.externalPluginConfigurationId`, where the
 * reference is always `FIXED` and a `null` configuration id has no meaning) — the field is left
 * unchanged rather than nulled out, since nulling it would fail deserialization; the id then simply
 * stays dangling against its original (unmapped) value.
 */
fun remapConfigurationIdField(
    node: ObjectNode,
    fieldName: String,
    mappings: Map<UUID, UUID?>,
    allowNull: Boolean = true,
) {
    if (!node.has(fieldName)) return
    val originalIdText = node.get(fieldName).asText(null) ?: return
    val originalId = try {
        UUID.fromString(originalIdText)
    } catch (_: IllegalArgumentException) {
        return
    }
    if (!mappings.containsKey(originalId)) return

    val mappedId = mappings[originalId]
    if (mappedId != null) {
        node.put(fieldName, mappedId.toString())
    } else if (allowNull) {
        node.putNull(fieldName)
    }
}
