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

import com.ritense.valtimo.contract.annotation.ProcessBean
import com.ritense.valtimo.contract.annotation.ProcessBeanMethod

@ProcessBean(description = "Accesses temporary resource storage metadata and deletion")
class ResourceStorageDelegate(
    private val service: TemporaryResourceStorageService
) {

    @ProcessBeanMethod(
        description = "Gets metadata value from a temporary resource",
        example = "\${resourceStorageDelegate.getMetadata(fileId, 'filename')}"
    )
    fun getMetadata(resourceStorageFileId: String, metadataKey: String): String {
        return service.getMetadataValue(resourceStorageFileId, metadataKey)
    }

    @ProcessBeanMethod(
        description = "Deletes a temporary resource",
        example = "\${resourceStorageDelegate.deleteResource(fileId)}"
    )
    fun deleteResource(resourceStorageFileId: String): Boolean {
        return service.deleteResource(resourceStorageFileId)
    }
}