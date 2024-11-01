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

package com.ritense.extension.listener

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.importer.ImportRequest
import com.ritense.importer.ImportService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.extension.ExtensionResourcesRegistrationListener
import org.springframework.core.io.Resource
import org.springframework.stereotype.Component

@SkipComponentScan
@Component
class ValtimoConfigImportExtensionResourcesListener(
    private val importService: ImportService
) : ExtensionResourcesRegistrationListener {

    override fun registerResources(resources: List<Resource>) {
        runWithoutAuthorization {
            val importRequest = resources
                .map { ImportRequest(it.uri.toString().substringAfterLast("!/"), it.contentAsByteArray) }
                .filter { it.fileName.startsWith("config") || it.fileName.startsWith("bpmn") }
            importService.import(importRequest)
        }
    }

    override fun unregisterResources(resources: List<Resource>) {
        // ignored
    }
}