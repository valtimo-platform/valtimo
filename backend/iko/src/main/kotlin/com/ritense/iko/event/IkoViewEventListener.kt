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

package com.ritense.iko.event

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.iko.service.IkoSeachActionService
import com.ritense.iko.service.IkoListColumnService
import com.ritense.iko.service.IkoTabService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Transactional
@Component
@SkipComponentScan
class IkoViewEventListener(
    private val ikoSeachActionService: IkoSeachActionService,
    private val ikoListColumnService: IkoListColumnService,
    private val ikoTabService: IkoTabService,
) {

    @RunWithoutAuthorization
    @EventListener(IkoViewPreDeleteEvent::class)
    fun deleteIkoSeachActions(event: IkoViewPreDeleteEvent) {
        ikoSeachActionService.findAll(
            ikoViewKey = event.ikoViewKey,
        ).forEach { ikoSeachAction ->
            ikoSeachActionService.delete(
                ikoViewKey = event.ikoViewKey,
                key = ikoSeachAction.id.key,
            )
        }
    }

    @RunWithoutAuthorization
    @EventListener(IkoViewPreDeleteEvent::class)
    fun deleteIkoListColumns(event: IkoViewPreDeleteEvent) {
        ikoListColumnService.deleteByIkoViewKey(event.ikoViewKey)
    }

    @RunWithoutAuthorization
    @EventListener(IkoViewPreDeleteEvent::class)
    fun deleteIkoTabs(event: IkoViewPreDeleteEvent) {
        ikoTabService.findAllTabsByIkoViewKey(
            ikoViewKey = event.ikoViewKey,
        ).forEach { tab ->
            ikoTabService.deleteByKey(
                ikoViewKey = event.ikoViewKey,
                tabKey = tab.key
            )
        }
    }
}
