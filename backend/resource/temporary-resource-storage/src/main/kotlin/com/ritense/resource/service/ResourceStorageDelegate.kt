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

package com.ritense.resource.service

import java.io.InputStream

class ResourceStorageDelegate(
    private val service: TemporaryResourceStorageService
) {

    fun store(inputStream: InputStream): String {
        return service.store(inputStream, emptyMap())
    }

    fun store(inputStream: InputStream, metadata: Map<String, Any?>): String {
        return service.store(inputStream, metadata)
    }

    fun getMetadata(id: String, key: String): Any? {
        return service.getMetadataValue(id, key)
    }

    fun getResourceContentAsInputStream(id: String): InputStream {
        return service.getResourceContentAsInputStream(id)
    }

    fun deleteResource(resourceStorageFileId: String): Boolean {
        return service.deleteResource(resourceStorageFileId)
    }
}