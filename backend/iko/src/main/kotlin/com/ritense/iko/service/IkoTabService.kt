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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.iko.authorization.IkoViewActionProvider.Companion.VIEW
import com.ritense.iko.domain.IkoViewTab
import com.ritense.iko.domain.IkoViewTabId
import com.ritense.iko.event.IkoViewTabPreDeleteEvent
import com.ritense.iko.repository.IkoViewTabRepository
import com.ritense.tab.domain.Tab
import com.ritense.tab.service.TabService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Transactional
@SkipComponentScan
@Service
class IkoTabService(
    private val tabService: TabService,
    private val ikoViewTabRepository: IkoViewTabRepository,
    private val ikoViewService: IkoViewService,
    private val applicationEventPublisher: ApplicationEventPublisher,
) {

    fun findByKey(ikoViewKey: String, tabKey: String): Tab? {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        return ikoViewTabRepository.findByIdIkoViewKeyAndTabKey(ikoViewKey, tabKey)?.tab
    }

    fun getByKey(ikoViewKey: String, tabKey: String): Tab {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        return findByKey(ikoViewKey, tabKey)
            ?: error("Unknown tab key: $tabKey")
    }

    fun findAllTabsByIkoViewKey(ikoViewKey: String): List<Tab> {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        return ikoViewTabRepository.findAllByIdIkoViewKeyOrderByTabOrder(ikoViewKey)
            .map { it.tab }
    }

    fun deleteByKey(ikoViewKey: String, tabKey: String) {
        ikoViewService.denyAuthorization()
        applicationEventPublisher.publishEvent(
            IkoViewTabPreDeleteEvent(ikoViewKey, tabKey)
        )
        ikoViewTabRepository.deleteByIdIkoViewKeyAndTabKey(ikoViewKey, tabKey)
    }

    fun create(ikoViewKey: String, tab: Tab): Tab {
        ikoViewService.denyAuthorization()
        val tabs = findAllTabsByIkoViewKey(ikoViewKey)
        require(tabs.none { it.key == tab.key })
        val createdTab = tabService.create(tab.copy(order = tabs.maxOfOrNull { it.order + 1 } ?: 0))
        ikoViewTabRepository.save(
            IkoViewTab(
                id = IkoViewTabId(ikoViewKey, tab.id),
                tab = createdTab,
            )
        )
        return createdTab
    }

    fun update(ikoViewKey: String, tab: Tab): Tab {
        ikoViewService.denyAuthorization()
        val ikoViewTab = ikoViewTabRepository.findByIdIkoViewKeyAndTabKey(
            ikoViewKey,
            tab.key
        )
        requireNotNull(ikoViewTab)
        val updatedTab = runWithoutAuthorization {
            tabService.update(tab.copy(id = ikoViewTab.id.tabId))
        }
        ikoViewTabRepository.save(
            IkoViewTab(
                id = IkoViewTabId(ikoViewKey, updatedTab.id),
                tab = updatedTab,
            )
        )
        return updatedTab
    }

}
