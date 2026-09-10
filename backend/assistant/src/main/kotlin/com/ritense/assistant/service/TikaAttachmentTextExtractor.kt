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

package com.ritense.assistant.service

import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.tika.Tika
import org.apache.tika.metadata.Metadata
import org.apache.tika.metadata.TikaCoreProperties
import java.io.InputStream

class TikaAttachmentTextExtractor(
    private val maxTextLength: Int = DEFAULT_MAX_TEXT_LENGTH
) : AttachmentTextExtractor {

    private val logger = KotlinLogging.logger {}
    private val tika = Tika()

    override fun extractText(inputStream: InputStream, fileName: String, mimeType: String?): String? {
        return try {
            val metadata = Metadata().apply {
                set(TikaCoreProperties.RESOURCE_NAME_KEY, fileName)
                mimeType?.let { set(Metadata.CONTENT_TYPE, it) }
            }

            val text = tika.parseToString(inputStream, metadata, maxTextLength)
            text?.takeIf { it.isNotBlank() }?.trim()
        } catch (e: Exception) {
            logger.warn(e) { "Failed to extract text from file: $fileName" }
            null
        }
    }

    override fun supportedMimeTypes(): Set<String> = SUPPORTED_MIME_TYPES

    override fun isSupported(mimeType: String?): Boolean {
        if (mimeType == null) return false
        val baseMimeType = mimeType.split(";").first().trim().lowercase()
        return SUPPORTED_MIME_TYPES.contains(baseMimeType)
    }

    companion object {
        const val DEFAULT_MAX_TEXT_LENGTH = 50 * 1024

        val SUPPORTED_MIME_TYPES = setOf(
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.oasis.opendocument.text",
            "application/vnd.oasis.opendocument.spreadsheet",
            "application/vnd.oasis.opendocument.presentation",
            "application/rtf",
            "text/plain",
            "text/csv",
            "text/html",
            "text/xml",
            "application/xml",
            "application/json"
        )
    }
}
