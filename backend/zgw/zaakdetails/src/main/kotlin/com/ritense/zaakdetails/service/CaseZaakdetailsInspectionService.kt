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

package com.ritense.zaakdetails.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.objectenapi.ObjectenApiPlugin
import com.ritense.objectmanagement.service.ObjectManagementService
import com.ritense.plugin.service.PluginService
import com.ritense.zaakdetails.documentobjectenapisync.DocumentObjectenApiSync
import com.ritense.zaakdetails.documentobjectenapisync.DocumentObjectenApiSyncManagementService
import com.ritense.zaakdetails.domain.ZaakdetailsObject
import com.ritense.zaakdetails.web.rest.dto.CaseZaakdetailsInspectionDto
import com.ritense.zaakdetails.web.rest.dto.ZaakdetailsObjectContentDto
import com.ritense.zaakdetails.web.rest.dto.ZaakdetailsObjectDto
import com.ritense.zaakdetails.web.rest.dto.ZaakdetailsSyncConfigDto
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.link.ZaakInstanceLinkNotFoundException
import com.ritense.zakenapi.link.ZaakInstanceLinkService
import com.ritense.zakenapi.web.rest.dto.ZaakobjectResolveResultDto
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException
import java.net.URI
import java.util.UUID

class CaseZaakdetailsInspectionService(
    private val documentService: DocumentService,
    private val zaakdetailsObjectService: ZaakdetailsObjectService,
    private val documentObjectenApiSyncManagementService: DocumentObjectenApiSyncManagementService,
    private val objectManagementService: ObjectManagementService,
    private val pluginService: PluginService,
    private val zaakInstanceLinkService: ZaakInstanceLinkService,
    private val objectMapper: ObjectMapper,
) {

    fun loadDocument(caseId: UUID): JsonSchemaDocument =
        runWithoutAuthorization {
            documentService.findBy(JsonSchemaDocumentId.existingId(caseId)).orElseThrow {
                ResponseStatusException(HttpStatus.NOT_FOUND, "Case document not found: $caseId")
            }
        } as? JsonSchemaDocument ?: throw ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Case document is not a JsonSchemaDocument: $caseId"
        )

    fun getInspection(caseId: UUID, document: JsonSchemaDocument): CaseZaakdetailsInspectionDto {
        val syncConfig = documentObjectenApiSyncManagementService.getSyncConfiguration(
            document.definitionId().caseDefinitionId()
        )
        val zaakdetailsObject = zaakdetailsObjectService.findByDocumentId(caseId).orElse(null)

        return CaseZaakdetailsInspectionDto(
            syncConfig = syncConfig?.toDto(),
            zaakdetailsObject = zaakdetailsObject?.toDto(),
        )
    }

    fun getZaakdetailsObjectContent(caseId: UUID): ZaakdetailsObjectContentDto {
        val zaakdetailsObject = zaakdetailsObjectService.findByDocumentId(caseId).orElse(null)
            ?: return ZaakdetailsObjectContentDto(
                resolved = false,
                record = null,
                message = "No zaakdetails object stored for this case",
                objectUrl = null,
            )

        val objectUrl = zaakdetailsObject.objectURI
        val plugin = pluginService.createInstance(
            ObjectenApiPlugin::class.java,
            ObjectenApiPlugin.findConfigurationByUrl(objectUrl),
        ) ?: return ZaakdetailsObjectContentDto(
            resolved = false,
            record = null,
            message = "No Objecten API plugin configured for host ${objectUrl.host}",
            objectUrl = objectUrl,
        )

        return runCatching { plugin.getObject(objectUrl) }
            .map { wrapper ->
                ZaakdetailsObjectContentDto(
                    resolved = true,
                    record = objectMapper.valueToTree(wrapper),
                    message = null,
                    objectUrl = objectUrl,
                )
            }
            .getOrElse { error ->
                logger.warn(error) { "Failed to resolve zaakdetails object at $objectUrl" }
                ZaakdetailsObjectContentDto(
                    resolved = false,
                    record = null,
                    message = "Failed to resolve object",
                    objectUrl = objectUrl,
                )
            }
    }

    fun resolveZaakobjectContent(caseId: UUID, objectUrl: URI): ZaakobjectResolveResultDto {
        requireObjectUrlBelongsToCase(caseId, objectUrl)

        val plugin = pluginService.createInstance(
            ObjectenApiPlugin::class.java,
            ObjectenApiPlugin.findConfigurationByUrl(objectUrl),
        ) ?: return ZaakobjectResolveResultDto(
            resolved = false,
            record = null,
            message = "No Objecten API plugin configured for host ${objectUrl.host}",
            objectUrl = objectUrl,
        )

        return runCatching { plugin.getObject(objectUrl) }
            .map { wrapper ->
                ZaakobjectResolveResultDto(
                    resolved = true,
                    record = objectMapper.valueToTree(wrapper),
                    message = null,
                    objectUrl = objectUrl,
                )
            }
            .getOrElse { error ->
                logger.warn(error) { "Failed to resolve zaakobject at $objectUrl" }
                ZaakobjectResolveResultDto(
                    resolved = false,
                    record = null,
                    message = "Failed to resolve object",
                    objectUrl = objectUrl,
                )
            }
    }

    private fun requireObjectUrlBelongsToCase(caseId: UUID, objectUrl: URI) {
        val link = try {
            zaakInstanceLinkService.getByDocumentId(caseId)
        } catch (e: ZaakInstanceLinkNotFoundException) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "No zaak linked to case $caseId")
        }

        val zakenApiPlugin = pluginService.createInstance(
            ZakenApiPlugin::class.java,
            ZakenApiPlugin.findConfigurationByUrl(link.zaakInstanceUrl),
        ) ?: throw ResponseStatusException(
            HttpStatus.FAILED_DEPENDENCY,
            "No Zaken API plugin configured for host ${link.zaakInstanceUrl.host}"
        )

        val zaakObjecten = runWithoutAuthorization {
            zakenApiPlugin.getZaakObjecten(link.zaakInstanceUrl)
        }
        if (zaakObjecten.none { it.objectUrl == objectUrl }) {
            throw ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Object $objectUrl is not linked to case $caseId"
            )
        }
    }

    private fun DocumentObjectenApiSync.toDto(): ZaakdetailsSyncConfigDto {
        val title = objectManagementConfigurationId?.let { objectManagementService.getById(it)?.title }
        return ZaakdetailsSyncConfigDto(
            caseDefinitionKey = caseDefinitionId.key,
            caseDefinitionVersionTag = caseDefinitionId.versionTag.toString(),
            objectManagementConfigurationId = objectManagementConfigurationId,
            objectManagementTitle = title,
            enabled = enabled,
        )
    }

    private fun ZaakdetailsObject.toDto() = ZaakdetailsObjectDto(
        documentId = documentId,
        objectUrl = objectURI,
        linkedToZaak = linkedToZaak,
    )

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
