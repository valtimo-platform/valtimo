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
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.documentenapi.authorization.ZgwDocument
import com.ritense.documentenapi.authorization.ZgwDocumentActionProvider.Companion.CREATE
import com.ritense.documentenapi.domain.DocumentenApiUploadFieldKey
import com.ritense.processdocument.domain.impl.request.StartProcessForDocumentRequest
import com.ritense.processdocument.service.CaseDefinitionProcessLinkService
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.resource.service.TemporaryResourceStorageService
import com.ritense.temporaryresource.domain.StorageMetadataKeys
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import io.github.oshai.kotlinlogging.KotlinLogging
import java.net.URI
import java.util.UUID
import org.springframework.stereotype.Service

@Service
@SkipComponentScan
class UploadProcessService(
    private val documentService: DocumentService,
    private val processDocumentService: ProcessDocumentService,
    private val caseDefinitionProcessLinkService: CaseDefinitionProcessLinkService,
    private val caseDocumentResolver: CaseDocumentResolver,
    private val resourceService: TemporaryResourceStorageService,
    private val authorizationService: AuthorizationService,
    private val catalogiService: CatalogiService,
) {

    fun startUploadResourceProcess(documentId: UUID, resourceId: String) {
        // Checked before the metadata is read, because the resource itself may no longer exist once it was added
        if (resourceService.getMetadataValueOrNull(resourceId, StorageMetadataKeys.DOCUMENT_URL) != null) {
            logger.debug {
                "Skipping resource '$resourceId' for document '$documentId'. It was already added to a case."
            }
            return
        }
        requireZgwDocumentCreatePermission(documentId, resourceService.getResourceMetadata(resourceId))

        logger.debug { "Adding resource '$resourceId' to document '$documentId'" }
        val caseDocumentId = runWithoutAuthorization { caseDocumentResolver.resolveCaseDocumentId(documentId) }
        val caseDefinitionId =
            runWithoutAuthorization { documentService.get(caseDocumentId.toString()) }.definitionId().caseDefinitionId()
        val link = caseDefinitionProcessLinkService.getDocumentDefinitionProcessLink(caseDefinitionId, DOCUMENT_UPLOAD)
            ?: throw IllegalStateException("No upload-process linked to case: $caseDefinitionId")

        val result = runWithoutAuthorization {
            processDocumentService.startProcessForDocument(
                StartProcessForDocumentRequest(
                    JsonSchemaDocumentId.existingId(documentId),
                    link.id.processDefinitionKey,
                    mapOf(RESOURCE_ID_PROCESS_VAR to resourceId)
                )
            )
        }

        if (result.resultingDocument().isEmpty) {
            var message = "Failed to upload resource. Found ${result.errors().size} errors:\n"
            result.errors().forEach { message += it.asString() + "\n" }
            throw RuntimeException(message)
        }
    }

    private fun requireZgwDocumentCreatePermission(documentId: UUID, metadata: Map<String, Any>) {
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
    }

    companion object {
        private val logger = KotlinLogging.logger {}

        const val RESOURCE_ID_PROCESS_VAR = "resourceId"
        const val DOCUMENT_UPLOAD = "DOCUMENT_UPLOAD"
    }
}
