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

import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.catalogiapi.service.CatalogiService
import com.ritense.documentenapi.authorization.ZgwDocument
import com.ritense.documentenapi.authorization.ZgwDocumentActionProvider.Companion.CREATE
import com.ritense.documentenapi.domain.DocumentenApiUploadFieldKey
import com.ritense.resource.domain.MetadataType
import com.ritense.resource.domain.TemporaryResourceUploadedEvent
import com.ritense.resource.service.TemporaryResourceStorageService
import mu.KotlinLogging
import org.springframework.context.event.EventListener
import java.net.URI
import java.util.UUID

class ResourceUploadedToDocumentEventListener(
    private val resourceService: TemporaryResourceStorageService,
    private val uploadProcessService: UploadProcessService,
    private val authorizationService: AuthorizationService,
    private val authorizationEnabled: Boolean = false,
    private val catalogiService: CatalogiService,
) {

    @EventListener(TemporaryResourceUploadedEvent::class)
    fun handle(event: TemporaryResourceUploadedEvent) {
        logger.debug { "Handling TemporaryResourceUploadedEvent with resourceId: ${event.resourceId}" }

        val metadata = resourceService.getResourceMetadata(event.resourceId)
        val caseDocumentId = metadata[MetadataType.DOCUMENT_ID.key] as String?

        if (caseDocumentId != null) {
            if (authorizationEnabled) {
                val informatieobjecttypeUrl = metadata[DocumentenApiUploadFieldKey.INFORMATIEOBJECTTYPE.property] as String?
                authorizationService.requirePermission(
                    EntityAuthorizationRequest(
                        ZgwDocument::class.java,
                        CREATE,
                        ZgwDocument(
                            caseDocumentId = UUID.fromString(caseDocumentId),
                            vertrouwelijkheidaanduiding = metadata[DocumentenApiUploadFieldKey.VERTROUWELIJKHEIDAANDUIDING.property] as String?,
                            status = metadata[DocumentenApiUploadFieldKey.STATUS.property] as String?,
                            informatieobjecttypeUrl = informatieobjecttypeUrl,
                            informatieobjecttypeOmschrijving = informatieobjecttypeUrl
                                ?.takeIf { it.isNotBlank() }
                                ?.let { catalogiService.getInformatieobjecttype(URI(it))?.omschrijving },
                        )
                    )
                )
            }

            logger.debug { "Uploading resource to document: ${event.resourceId}" }
            uploadProcessService.startUploadResourceProcess(caseDocumentId, event.resourceId)
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
