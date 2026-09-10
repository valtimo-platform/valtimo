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

import com.ritense.resource.service.ResourceService
import java.io.ByteArrayInputStream
import java.util.UUID

class ResourceContentProviderImpl(
    private val resourceService: ResourceService
) : ResourceContentProvider {

    override fun getContent(resourceId: UUID): AttachmentContent? {
        return try {
            val contentDto = resourceService.getResourceContent(resourceId)
            val resource = contentDto.resource

            AttachmentContent(
                inputStream = ByteArrayInputStream(contentDto.content),
                fileName = resource.name,
                mimeType = resource.extension?.let { getMimeType(it) },
                sizeInBytes = resource.sizeInBytes
            )
        } catch (e: Exception) {
            null
        }
    }

    private fun getMimeType(extension: String): String {
        return when (extension.lowercase()) {
            "pdf" -> "application/pdf"
            "doc" -> "application/msword"
            "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            "xls" -> "application/vnd.ms-excel"
            "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            "ppt" -> "application/vnd.ms-powerpoint"
            "pptx" -> "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            "txt" -> "text/plain"
            "csv" -> "text/csv"
            "html", "htm" -> "text/html"
            "xml" -> "application/xml"
            "json" -> "application/json"
            "rtf" -> "application/rtf"
            "odt" -> "application/vnd.oasis.opendocument.text"
            "ods" -> "application/vnd.oasis.opendocument.spreadsheet"
            "odp" -> "application/vnd.oasis.opendocument.presentation"
            else -> "application/octet-stream"
        }
    }
}
