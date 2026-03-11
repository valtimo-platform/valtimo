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

package com.ritense.valtimo.authorization

import com.ritense.authorization.permission.Permission
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.authorization.specification.AuthorizationSpecification
import com.ritense.authorization.specification.AuthorizationSpecificationFactory
import com.ritense.valtimo.contract.authentication.ManageableUser

class ManageableUserSpecificationFactory : AuthorizationSpecificationFactory<ManageableUser> {
    override fun create(
        request: AuthorizationRequest<ManageableUser>,
        permissionSupplier: () -> List<Permission>
    ): AuthorizationSpecification<ManageableUser> {
        return ManageableUserSpecification(request, permissionSupplier)
    }

    override fun canCreate(
        request: AuthorizationRequest<*>,
        permissionSupplier: () -> List<Permission>
    ): Boolean {
        return ManageableUser::class.java == request.resourceType
    }
}
