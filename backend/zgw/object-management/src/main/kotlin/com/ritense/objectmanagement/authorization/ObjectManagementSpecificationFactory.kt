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

package com.ritense.objectmanagement.authorization

import com.ritense.authorization.permission.Permission
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.authorization.specification.AuthorizationSpecification
import com.ritense.authorization.specification.AuthorizationSpecificationFactory
import com.ritense.objectmanagement.domain.ObjectManagement
import com.ritense.objectmanagement.repository.ObjectManagementRepository
import com.ritense.valtimo.contract.database.QueryDialectHelper

class ObjectManagementSpecificationFactory(
    private val objectManagementRepository: ObjectManagementRepository,
    private val queryDialectHelper: QueryDialectHelper
) : AuthorizationSpecificationFactory<ObjectManagement> {

    override fun create(
        request: AuthorizationRequest<ObjectManagement>,
        permissions: List<Permission>
    ): AuthorizationSpecification<ObjectManagement> {
        return ObjectManagementSpecification(
            request,
            permissions,
            objectManagementRepository,
            queryDialectHelper
        )
    }

    override fun canCreate(context: AuthorizationRequest<*>, permissions: List<Permission>): Boolean {
        return ObjectManagement::class.java == context.resourceType
    }
}
