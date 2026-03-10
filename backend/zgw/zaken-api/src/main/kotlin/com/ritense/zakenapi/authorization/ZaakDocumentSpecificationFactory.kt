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

package com.ritense.zakenapi.authorization

import com.ritense.authorization.permission.Permission
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.authorization.specification.AuthorizationSpecification
import com.ritense.authorization.specification.AuthorizationSpecificationFactory
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.zakenapi.domain.ZaakDocument
import com.ritense.zakenapi.service.ZaakDocumentService
import org.springframework.stereotype.Component

@Component
@SkipComponentScan
class ZaakDocumentSpecificationFactory(
    private val zaakDocumentService: ZaakDocumentService,
    private val pluginService: PluginService
) : AuthorizationSpecificationFactory<ZaakDocument> {

    override fun create(
        request: AuthorizationRequest<ZaakDocument>,
        permissionSupplier: () -> List<Permission>
    ): AuthorizationSpecification<ZaakDocument> {
        return ZaakDocumentSpecification(request, permissionSupplier, zaakDocumentService, pluginService)
    }

    override fun canCreate(request: AuthorizationRequest<*>, permissionSupplier: () -> List<Permission>): Boolean {
        return ZaakDocument::class.java == request.resourceType
    }
}