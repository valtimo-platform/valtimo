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

package com.ritense.authorization

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Service

/**
 * Resolves a resource type name to its [Class], but only for names that are known authorization
 * resource types.
 *
 * Resource type names can originate from a request body. Loading an arbitrary caller supplied class
 * name runs that class's static initializer and reveals whether the class is present on the
 * classpath, so resolution is restricted to the finite set of resource types that
 * [PbacRegistryService] derives from the application itself. Anything else is rejected before the
 * class loader is consulted.
 */
@Service
@SkipComponentScan
class AuthorizationResourceTypeResolver(
    private val pbacRegistryService: PbacRegistryService,
) {

    /**
     * @throws UnknownAuthorizationResourceTypeException when [resourceType] is not a known
     * authorization resource type.
     */
    fun resolve(resourceType: String): Class<*> {
        if (resourceType !in pbacRegistryService.getAllowedResourceTypes()) {
            // The submitted value is deliberately left out of the message. Echoing it back turns
            // this check into an oracle for what is present on the classpath.
            throw UnknownAuthorizationResourceTypeException(
                "Unknown authorization resource type"
            )
        }

        return Class.forName(resourceType)
    }
}
