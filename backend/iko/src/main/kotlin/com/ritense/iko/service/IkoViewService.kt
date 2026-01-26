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

import com.ritense.authorization.Action
import com.ritense.authorization.Action.Companion.deny
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.iko.authorization.IkoViewActionProvider
import com.ritense.iko.domain.IkoView
import com.ritense.iko.event.IkoViewPreDeleteEvent
import com.ritense.iko.repository.IkoViewRepository
import com.ritense.iko.repository.IkoViewSpecificationHelper.Companion.byIkoRepositoryConfigKey
import com.ritense.iko.repository.IkoViewSpecificationHelper.Companion.byKey
import com.ritense.iko.repository.IkoViewSpecificationHelper.Companion.byTitleContains
import com.ritense.valtimo.contract.iko.IkoRepository
import com.ritense.valtimo.contract.iko.PropertyField
import org.springframework.context.ApplicationEventPublisher
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.domain.Specification
import org.springframework.transaction.annotation.Transactional

@Transactional
class IkoViewService(
    private val ikoViewRepository: IkoViewRepository,
    private val ikoRepositoryService: IkoRepositoryService,
    private val authorizationService: AuthorizationService,
    private val ikoRepositories: List<IkoRepository>,
    private val applicationEventPublisher: ApplicationEventPublisher,
) {

    fun getIkoViewPropertyFields(type: Any): List<PropertyField> {
        denyAuthorization()
        return ikoRepositories.single { it.getType() == type }.getIkoViewPropertyFields()
    }

    fun findAll(
        key: String? = null,
        title: String? = null,
        ikoRepositoryConfigKey: String? = null,
        pageable: Pageable = Pageable.unpaged()
    ): Page<IkoView> {
        val spec = getSpecification(
            key = key,
            titlePart = title,
            ikoRepositoryConfigKey = ikoRepositoryConfigKey,
        )
        return ikoViewRepository.findAll(spec, pageable)
    }

    fun getByKey(key: String): IkoView {
        val ikoView = ikoViewRepository.findById(key).orElseThrow()
        requirePermission(ikoView, IkoViewActionProvider.VIEW)
        return ikoView
    }

    fun createIkoView(
        key: String,
        ikoRepositoryConfigKey: String,
        title: String,
        properties: Map<String, Any?>,
    ): IkoView {
        denyAuthorization()
        require(!existsByKey(key)) { "IKO view '$key' already exists" }
        return ikoViewRepository.save(
            IkoView(
                key = key,
                title = title,
                properties = properties,
                ikoRepositoryConfig = ikoRepositoryService.getByKey(ikoRepositoryConfigKey),
            )
        )
    }

    fun saveIkoView(
        key: String,
        ikoRepositoryConfigKey: String,
        title: String,
        properties: Map<String, Any?> = emptyMap(),
    ): IkoView {
        denyAuthorization()
        return ikoViewRepository.save(
            IkoView(
                key = key,
                title = title,
                properties = properties,
                ikoRepositoryConfig = ikoRepositoryService.getByKey(ikoRepositoryConfigKey),
            )
        )
    }

    fun deleteIkoView(key: String) {
        denyAuthorization()
        applicationEventPublisher.publishEvent(
            IkoViewPreDeleteEvent(key)
        )
        ikoViewRepository.deleteById(key)
    }

    fun requirePermission(key: String, action: Action<IkoView>) {
        requirePermission(ikoViewRepository.findById(key).orElseThrow(), action)
    }

    fun requirePermission(ikoView: IkoView, action: Action<IkoView>) {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                IkoView::class.java,
                action,
                ikoView,
            )
        )
    }

    fun denyAuthorization() {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                IkoView::class.java,
                deny()
            )
        )
    }

    private fun getSpecification(
        key: String? = null,
        ikoRepositoryConfigKey: String? = null,
        titlePart: String? = null,
    ): Specification<IkoView> {
        var spec: Specification<IkoView> = authorizationService.getAuthorizationSpecification(
            EntityAuthorizationRequest(
                IkoView::class.java,
                IkoViewActionProvider.VIEW_LIST
            )
        )
        if (key != null) {
            spec = spec.and(byKey(key))
        }
        if (ikoRepositoryConfigKey != null) {
            spec = spec.and(byIkoRepositoryConfigKey(ikoRepositoryConfigKey))
        }
        if (titlePart != null) {
            spec = spec.and(byTitleContains(titlePart))
        }
        return spec
    }

    private fun existsByKey(key: String): Boolean {
        return ikoViewRepository.existsById(key)
    }

}
