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

package com.ritense.documentenapi.authorization

import com.ritense.authorization.permission.Permission
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.authorization.specification.AuthorizationSpecification
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Predicate
import jakarta.persistence.criteria.Root

class ZgwResourceSpecification(
    authRequest: AuthorizationRequest<ZgwResourcePermission>,
    permissionSupplier: () -> List<Permission>,
) : AuthorizationSpecification<ZgwResourcePermission>(authRequest, permissionSupplier) {

    override fun toPredicate(
        root: Root<ZgwResourcePermission>,
        query: AbstractQuery<*>,
        criteriaBuilder: CriteriaBuilder
    ): Predicate {
        logger.info { "Creating predicate for ResourceSpecification" }
        return criteriaBuilder.conjunction()
    }

    override fun identifierToEntity(identifier: String): ZgwResourcePermission {
        return ZgwResourcePermission()
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}

