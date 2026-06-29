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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.authorization.specification.AuthorizationSpecification
import com.ritense.objectmanagement.domain.ObjectManagement
import com.ritense.objectmanagement.repository.ObjectManagementRepository
import com.ritense.valtimo.contract.database.QueryDialectHelper
import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Predicate
import jakarta.persistence.criteria.Root
import java.util.UUID

class ObjectManagementSpecification(
    authRequest: AuthorizationRequest<ObjectManagement>,
    permissions: List<Permission>,
    private val objectManagementRepository: ObjectManagementRepository,
    private val queryDialectHelper: QueryDialectHelper
) : AuthorizationSpecification<ObjectManagement>(authRequest, permissions) {

    override fun toPredicate(
        root: Root<ObjectManagement>,
        query: AbstractQuery<*>,
        criteriaBuilder: CriteriaBuilder
    ): Predicate {
        val predicates = permissions
            .filter { permission ->
                ObjectManagement::class.java == permission.resourceType &&
                    permission.actions.contains(authRequest.action)
            }
            .map { permission ->
                permission.toPredicate(
                    root,
                    query,
                    criteriaBuilder,
                    authRequest,
                    queryDialectHelper
                )
            }
        return combinePredicates(criteriaBuilder, predicates)
    }

    override fun identifierToEntity(identifier: String): ObjectManagement {
        return runWithoutAuthorization {
            objectManagementRepository.getReferenceById(UUID.fromString(identifier))
        }
    }
}
