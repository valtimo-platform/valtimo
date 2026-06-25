/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.resource.service.request

import com.ritense.resource.domain.MetadataType
import org.apache.commons.io.FilenameUtils
import java.io.InputStream

class TempResourceFileUploadRequest(
    private val name: String,
    private val extension: String,
    private val size: Long,
    private val contentType: String,
    private val inputStream: InputStream
) : FileUploadRequest {

    override fun getName(): String = name

    override fun getExtension(): String = extension

    override fun getSize(): Long = size

    override fun getContentType(): String = contentType

    override fun getInputStream(): InputStream = inputStream

    companion object {
        fun from(metadata: Map<String, Any>, inputStream: InputStream): TempResourceFileUploadRequest {
            val filename = metadata[MetadataType.FILE_NAME.key] as? String
                ?: throw IllegalArgumentException("Missing filename in metadata")
            val contentType = metadata[MetadataType.CONTENT_TYPE.key] as? String
                ?: "application/octet-stream"
            val fileSize = (metadata[MetadataType.FILE_SIZE.key] as? String)?.toLongOrNull()
                ?: throw IllegalArgumentException("Missing or invalid fileSize in metadata")

            return TempResourceFileUploadRequest(
                name = filename,
                extension = FilenameUtils.getExtension(filename),
                size = fileSize,
                contentType = contentType,
                inputStream = inputStream
            )
        }
    }
}
