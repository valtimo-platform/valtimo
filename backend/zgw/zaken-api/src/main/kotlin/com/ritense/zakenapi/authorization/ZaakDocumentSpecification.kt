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
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.authorization.specification.AuthorizationSpecification
import com.ritense.documentenapi.DocumentenApiPlugin
import com.ritense.plugin.service.PluginService
import com.ritense.zakenapi.domain.ZaakDocument
import com.ritense.zakenapi.service.ZaakDocumentService
import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Predicate
import jakarta.persistence.criteria.Root

class ZaakDocumentSpecification(
    authRequest: AuthorizationRequest<ZaakDocument>,
    permissionSupplier: () -> List<Permission>,
    private val zaakDocumentService: ZaakDocumentService,
    private val pluginService: PluginService
) : AuthorizationSpecification<ZaakDocument>(authRequest, permissionSupplier) {

    override fun toPredicate(
        root: Root<ZaakDocument>,
        query: AbstractQuery<*>,
        criteriaBuilder: CriteriaBuilder
    ): Predicate {
        throw NotImplementedError()
    }

    override fun identifierToEntity(identifier: String): ZaakDocument {
        return runWithoutAuthorization {
            val (informatieObject, pluginConfiguration) = pluginService.findPluginConfigurations(DocumentenApiPlugin::class.java)
                .firstNotNullOfOrNull { pluginConfiguration ->
                    try {
                        val plugin = pluginService.createInstance(pluginConfiguration) as DocumentenApiPlugin
                        val informatieObject = plugin.getInformatieObject(identifier, null)
                        informatieObject to pluginConfiguration
                    } catch (_: Exception) {
                        null
                    }
                } ?: throw IllegalArgumentException("Could not find ZaakDocument for identifier: $identifier")

            zaakDocumentService.mapZaakDocument(informatieObject, pluginConfiguration)
        }
    }
}