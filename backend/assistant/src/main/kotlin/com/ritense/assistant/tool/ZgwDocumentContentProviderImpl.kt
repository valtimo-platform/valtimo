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

package com.ritense.assistant.tool

import com.ritense.documentenapi.web.rest.dto.RelatedFileDto
import com.ritense.zakenapi.service.ZaakDocumentService
import io.github.oshai.kotlinlogging.KotlinLogging
import java.util.UUID

class ZgwDocumentContentProviderImpl(
    private val zaakDocumentService: ZaakDocumentService
) : ZgwDocumentContentProvider {

    private val logger = KotlinLogging.logger {}

    override fun listDocuments(caseDocumentId: UUID): List<ZgwDocumentInfo> {
        logger.debug { "Listing ZGW documents for case $caseDocumentId" }
        return zaakDocumentService.getInformatieObjectenAsRelatedFiles(caseDocumentId)
            .filterIsInstance<RelatedFileDto>()
            .filter { it.canView }
            .map { dto ->
                ZgwDocumentInfo(
                    id = dto.fileId.toString(),
                    fileName = dto.fileName ?: dto.title,
                    sizeInBytes = dto.sizeInBytes,
                    createdOn = dto.createdOn?.toString(),
                    pluginConfigurationId = dto.pluginConfigurationId.toString(),
                    canView = dto.canView
                )
            }
    }

    override fun getContent(
        pluginConfigurationId: String,
        caseDocumentId: UUID,
        documentId: String
    ): AttachmentContent? {
        logger.debug { "Downloading ZGW document $documentId for case $caseDocumentId" }
        return try {
            val inputStream = zaakDocumentService.downloadInformatieObject(
                pluginConfigurationId,
                caseDocumentId,
                documentId
            )

            AttachmentContent(
                inputStream = inputStream,
                fileName = null,
                mimeType = null,
                sizeInBytes = null
            )
        } catch (e: Exception) {
            logger.warn(e) { "Failed to download ZGW document $documentId: ${e.message}" }
            null
        }
    }
}
