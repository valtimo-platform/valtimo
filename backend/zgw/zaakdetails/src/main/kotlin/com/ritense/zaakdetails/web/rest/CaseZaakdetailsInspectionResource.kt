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

package com.ritense.zaakdetails.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.logging.LoggableResource
import com.ritense.objectenapi.ObjectenApiPlugin
import com.ritense.objectmanagement.service.ObjectManagementService
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.zaakdetails.documentobjectenapisync.DocumentObjectenApiSync
import com.ritense.zaakdetails.documentobjectenapisync.DocumentObjectenApiSyncManagementService
import com.ritense.zaakdetails.domain.ZaakdetailsObject
import com.ritense.zaakdetails.service.ZaakdetailsObjectService
import com.ritense.zaakdetails.web.rest.dto.CaseZaakdetailsInspectionDto
import com.ritense.zaakdetails.web.rest.dto.ZaakdetailsObjectContentDto
import com.ritense.zaakdetails.web.rest.dto.ZaakdetailsObjectDto
import com.ritense.zaakdetails.web.rest.dto.ZaakdetailsSyncConfigDto
import com.ritense.zakenapi.web.rest.dto.ZaakobjectResolveResultDto
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.http.ResponseEntity
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.net.URI
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping("/api/management", produces = [APPLICATION_JSON_UTF8_VALUE])
class CaseZaakdetailsInspectionResource(
    private val documentService: DocumentService,
    private val authorizationService: AuthorizationService,
    private val zaakdetailsObjectService: ZaakdetailsObjectService,
    private val documentObjectenApiSyncManagementService: DocumentObjectenApiSyncManagementService,
    private val objectManagementService: ObjectManagementService,
    private val pluginService: PluginService,
    private val objectMapper: ObjectMapper,
) {

    @GetMapping("/v1/case/{caseId}/zgw/zaakdetails")
    @Transactional
    fun getZaakdetailsInspection(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID,
    ): ResponseEntity<CaseZaakdetailsInspectionDto> {
        val document = loadDocumentAndCheckPermission(caseId)

        val syncConfig = documentObjectenApiSyncManagementService.getSyncConfiguration(
            document.definitionId().caseDefinitionId()
        )

        val zaakdetailsObject = zaakdetailsObjectService.findByDocumentId(caseId).orElse(null)

        return ResponseEntity.ok(
            CaseZaakdetailsInspectionDto(
                syncConfig = syncConfig?.toDto(),
                zaakdetailsObject = zaakdetailsObject?.toDto(),
            )
        )
    }

    @GetMapping("/v1/case/{caseId}/zgw/zaakdetails/object")
    @Transactional
    fun getZaakdetailsObjectContent(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID,
    ): ResponseEntity<ZaakdetailsObjectContentDto> {
        loadDocumentAndCheckPermission(caseId)
        val zaakdetailsObject = zaakdetailsObjectService.findByDocumentId(caseId).orElse(null)
            ?: return ResponseEntity.ok(
                ZaakdetailsObjectContentDto(
                    resolved = false,
                    record = null,
                    message = "No zaakdetails object stored for this case",
                    objectUrl = null,
                )
            )

        val objectUrl = zaakdetailsObject.objectURI
        val plugin = pluginService.createInstance(
            ObjectenApiPlugin::class.java,
            ObjectenApiPlugin.findConfigurationByUrl(objectUrl),
        ) ?: return ResponseEntity.ok(
            ZaakdetailsObjectContentDto(
                resolved = false,
                record = null,
                message = "No Objecten API plugin configured for host ${objectUrl.host}",
                objectUrl = objectUrl,
            )
        )

        return ResponseEntity.ok(
            runCatching { plugin.getObject(objectUrl) }
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
        )
    }

    @GetMapping("/v1/case/{caseId}/zgw/zaakobject/resolve")
    @Transactional
    fun resolveZaakobjectContent(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID,
        @RequestParam objectUrl: URI,
    ): ResponseEntity<ZaakobjectResolveResultDto> {
        loadDocumentAndCheckPermission(caseId)

        val plugin = pluginService.createInstance(
            ObjectenApiPlugin::class.java,
            ObjectenApiPlugin.findConfigurationByUrl(objectUrl),
        ) ?: return ResponseEntity.ok(
            ZaakobjectResolveResultDto(
                resolved = false,
                record = null,
                message = "No Objecten API plugin configured for host ${objectUrl.host}",
                objectUrl = objectUrl,
            )
        )

        return ResponseEntity.ok(
            runCatching { plugin.getObject(objectUrl) }
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
        )
    }

    private fun loadDocumentAndCheckPermission(caseId: UUID): JsonSchemaDocument {
        val document = runWithoutAuthorization {
            documentService.findBy(JsonSchemaDocumentId.existingId(caseId)).orElseThrow()
        } as JsonSchemaDocument

        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                JsonSchemaDocument::class.java,
                JsonSchemaDocumentActionProvider.INSPECT,
                document,
            )
        )
        return document
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
