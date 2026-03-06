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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationEntityMapper
import com.ritense.authorization.AuthorizationEntityMapperResult
import com.ritense.resource.authorization.ResourcePermission
import com.ritense.zakenapi.domain.ZaakDocument
import com.ritense.zakenapi.service.ZaakDocumentService
import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Root

class ZaakDocumentMapper(
    private val zaakDocumentService: ZaakDocumentService

) : AuthorizationEntityMapper<ResourcePermission, ZaakDocument> {

    override fun mapRelated(
        entity: ResourcePermission
    ): List<ZaakDocument> {
        return runWithoutAuthorization {
            entity.caseDocumentId?.let { caseDocumentId ->
                zaakDocumentService.getInformatieObjectenAsZaakDocumenten(caseDocumentId)
                    .filter { it.informatieobjecttype == entity.informatieobjecttype }
            } ?: emptyList()
        }
    }

    override fun mapQuery(
        root: Root<ResourcePermission>,
        query: AbstractQuery<*>,
        criteriaBuilder: CriteriaBuilder
    ): AuthorizationEntityMapperResult<ZaakDocument> {
        throw UnsupportedOperationException("Mapping query for ResourcePermission to ZaakDocument is not supported")
    }

    override fun supports(fromClass: Class<*>, toClass: Class<*>): Boolean {
        return fromClass == ResourcePermission::class.java && toClass == ZaakDocument::class.java
    }
}