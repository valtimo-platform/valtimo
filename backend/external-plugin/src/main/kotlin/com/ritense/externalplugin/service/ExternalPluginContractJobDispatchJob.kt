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

package com.ritense.externalplugin.service

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock
import org.springframework.scheduling.annotation.Scheduled

// `open` for ShedLock's CGLIB subclass, same as ExternalPluginDiscoveryJob.
@SkipComponentScan
open class ExternalPluginContractJobDispatchJob(
    private val dispatcher: ExternalPluginContractJobDispatcher,
) {

    /** Single-node: two replicas would deliver every due job twice. */
    @Scheduled(fixedDelayString = "\${valtimo.external-plugin.contract-job.dispatch-interval:PT5S}")
    @SchedulerLock(
        name = "ExternalPluginContractJobDispatchJob_dispatch",
        lockAtLeastFor = "PT1S",
        lockAtMostFor = "PT10M",
    )
    open fun dispatch() {
        dispatcher.dispatch()
    }
}
