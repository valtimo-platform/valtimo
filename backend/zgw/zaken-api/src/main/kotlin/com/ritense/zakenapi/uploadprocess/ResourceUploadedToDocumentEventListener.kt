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

package com.ritense.zakenapi.uploadprocess

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.catalogiapi.service.CatalogiService
import com.ritense.documentenapi.authorization.ZgwDocument
import com.ritense.documentenapi.authorization.ZgwDocumentActionProvider.Companion.CREATE
import com.ritense.documentenapi.domain.DocumentenApiUploadFieldKey
import com.ritense.processdocument.helper.GetJsonSchemaDocumentHelper.getJsonSchemaDocumentIdOrNull
import com.ritense.resource.domain.MetadataType
import com.ritense.resource.domain.TemporaryResourceUploadedEvent
import com.ritense.resource.service.TemporaryResourceStorageService
import com.ritense.temporaryresource.domain.StorageMetadataKeys
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.operaton.service.OperatonRuntimeService
import io.github.oshai.kotlinlogging.KotlinLogging
import java.net.URI
import java.util.UUID
import org.springframework.context.event.EventListener

class ResourceUploadedToDocumentEventListener(
    private val resourceService: TemporaryResourceStorageService,
    private val uploadProcessService: UploadProcessService,
    private val authorizationService: AuthorizationService,
    private val catalogiService: CatalogiService,
    private val caseDocumentResolver: CaseDocumentResolver,
    private val runtimeService: OperatonRuntimeService,
) {

    @EventListener(TemporaryResourceUploadedEvent::class)
    fun handle(event: TemporaryResourceUploadedEvent) {
        logger.debug { "Handling TemporaryResourceUploadedEvent with resourceId: ${event.resourceId}" }

        val metadata = resourceService.getResourceMetadata(event.resourceId)
        val documentId = resolveDocumentId(metadata)

        if (documentId != null) {
            val caseDocumentId = runWithoutAuthorization { caseDocumentResolver.resolveCaseDocumentId(documentId) }
            val informatieobjecttypeUrl = metadata[DocumentenApiUploadFieldKey.INFORMATIEOBJECTTYPE.property] as String?
            authorizationService.requirePermission(
                EntityAuthorizationRequest(
                    ZgwDocument::class.java,
                    CREATE,
                    ZgwDocument(
                        caseDocumentId = caseDocumentId,
                        vertrouwelijkheidaanduiding = metadata[DocumentenApiUploadFieldKey.VERTROUWELIJKHEIDAANDUIDING.property] as String?,
                        status = metadata[DocumentenApiUploadFieldKey.STATUS.property] as String?,
                        informatieobjecttypeUrl = informatieobjecttypeUrl,
                        informatieobjecttypeOmschrijving = informatieobjecttypeUrl
                            ?.takeIf { it.isNotBlank() }
                            ?.let { catalogiService.getInformatieobjecttype(URI(it))?.omschrijving },
                    )
                )
            )
            logger.debug { "Uploading resource to document: ${event.resourceId}" }
            uploadProcessService.startUploadResourceProcess(documentId.toString(), event.resourceId)
        }
    }

    private fun resolveDocumentId(metadata: Map<String, Any>): UUID? {
        return (metadata[MetadataType.DOCUMENT_ID.key] as String?)
            ?.toUuidOrNull()
            ?: resolveDocumentIdByProcessInstance(metadata[StorageMetadataKeys.PROCESS_INSTANCE_ID.key] as? String)
    }

    private fun resolveDocumentIdByProcessInstance(processInstanceId: String?): UUID? {
        if (processInstanceId.isNullOrBlank()) {
            return null
        }

        val processInstance = runWithoutAuthorization { runtimeService.findProcessInstanceById(processInstanceId) }
            ?: run {
                logger.debug { "No running process instance found with id '$processInstanceId'." }
                return null
            }

        return processInstance.getJsonSchemaDocumentIdOrNull()
    }

    private fun String.toUuidOrNull(): UUID? = this
        .takeIf { it.isNotBlank() }
        ?.let {
            try {
                UUID.fromString(it)
            } catch (_: IllegalArgumentException) {
                logger.warn { "Failed to parse document id '$it' from resource metadata." }
                null
            }
        }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
