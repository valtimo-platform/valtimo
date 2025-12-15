/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.iko.service

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.iko.authorization.IkoViewActionProvider.Companion.VIEW
import com.ritense.iko.domain.IkoSearchAction
import com.ritense.iko.domain.IkoSearchActionId
import com.ritense.iko.event.IkoSearchActionPreDeleteEvent
import com.ritense.iko.helper.MergeHelper.deepMerge
import com.ritense.iko.repository.IkoSearchActionRepository
import com.ritense.iko.repository.IkoSearchActionSpecificationHelper.Companion.byIkoViewKey
import com.ritense.iko.repository.IkoSearchActionSpecificationHelper.Companion.byKey
import com.ritense.iko.repository.IkoSearchActionSpecificationHelper.Companion.byTitleContains
import com.ritense.iko.repository.IkoSearchActionSpecificationHelper.Companion.query
import com.ritense.valtimo.contract.iko.DataFilter
import com.ritense.valtimo.contract.iko.IkoRepository
import com.ritense.valtimo.contract.iko.PropertyField
import org.springframework.context.ApplicationEventPublisher
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.domain.Sort.Direction.ASC
import org.springframework.data.jpa.domain.Specification
import org.springframework.transaction.annotation.Transactional

@Transactional
class IkoSearchActionService(
    private val ikoSearchActionRepository: IkoSearchActionRepository,
    private val ikoViewService: IkoViewService,
    private val ikoRepositories: List<IkoRepository>,
    private val applicationEventPublisher: ApplicationEventPublisher,
) {

    fun searchData(
        key: String,
        ikoViewKey: String,
        filters: List<DataFilter>,
        pageable: Pageable
    ): Page<JsonNode> {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        val ikoSearchAction = getByKey(key, ikoViewKey)
        val ikoRepository = ikoRepositories.first {
            it.getType() == ikoSearchAction.id.ikoView.ikoRepositoryConfig.type
        }
        return ikoRepository.findAll(
            ikoSearchAction.id.ikoView.ikoRepositoryConfig.properties
                .deepMerge(ikoSearchAction.id.ikoView.properties)
                .deepMerge(ikoSearchAction.properties),
            filters,
            pageable
        )
    }

    fun findAll(
        key: String? = null,
        ikoViewKey: String? = null,
        title: String? = null,
    ): List<IkoSearchAction> {
        if (ikoViewKey != null) {
            ikoViewService.requirePermission(ikoViewKey, VIEW)
        } else {
            ikoViewService.denyAuthorization()
        }
        val spec = getSpecification(
            key = key,
            ikoViewKey = ikoViewKey,
            titlePart = title,
        )
        return ikoSearchActionRepository.findAll(spec, Sort.by(ASC, "order"))
    }

    fun getIkoSearchActionPropertyFields(type: Any): List<PropertyField> {
        ikoViewService.denyAuthorization()
        return ikoRepositories.single { it.getType() == type }.getIkoSearchActionPropertyFields()
    }

    fun getByKey(key: String, ikoViewKey: String): IkoSearchAction {
        val ikoView = runWithoutAuthorization { ikoViewService.getByKey(ikoViewKey) }
        ikoViewService.requirePermission(ikoView, VIEW)
        val id = IkoSearchActionId(key, ikoView)
        val ikoSearchAction = ikoSearchActionRepository.findById(id).orElseThrow()
        return ikoSearchAction
    }

    fun create(ikoSearchAction: IkoSearchAction): IkoSearchAction {
        ikoViewService.denyAuthorization()
        require(!existsByKey(key = ikoSearchAction.id.key, ikoViewKey = ikoSearchAction.id.ikoView.key))
        return ikoSearchActionRepository.save(ikoSearchAction)
    }

    fun update(ikoSearchAction: IkoSearchAction): IkoSearchAction {
        ikoViewService.denyAuthorization()
        require(existsByKey(key = ikoSearchAction.id.key, ikoViewKey = ikoSearchAction.id.ikoView.key))
        return ikoSearchActionRepository.save(ikoSearchAction)
    }

    fun delete(
        key: String,
        ikoViewKey: String,
    ) {
        ikoViewService.denyAuthorization()
        applicationEventPublisher.publishEvent(
            IkoSearchActionPreDeleteEvent(ikoViewKey, key)
        )
        ikoSearchActionRepository.delete(
            getSpecification(
                key = key,
                ikoViewKey = ikoViewKey,
            )
        )
    }

    private fun getSpecification(
        key: String? = null,
        ikoViewKey: String? = null,
        titlePart: String? = null,
    ): Specification<IkoSearchAction> {
        var spec = query()
        if (key != null) {
            spec = spec.and(byKey(key))
        }
        if (ikoViewKey != null) {
            spec = spec.and(byIkoViewKey(ikoViewKey))
        }
        if (titlePart != null) {
            spec = spec.and(byTitleContains(titlePart))
        }
        return spec
    }

    private fun existsByKey(key: String, ikoViewKey: String): Boolean {
        val ikoView = ikoViewService.getByKey(ikoViewKey)
        val id = IkoSearchActionId(key, ikoView)
        return ikoSearchActionRepository.existsById(id)
    }
}
