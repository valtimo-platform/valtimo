/*
 *
 *  Copyright 2015-2025 Ritense BV, the Netherlands.
 *
 *  Licensed under EUPL, Version 1.2 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" basis,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

package com.ritense.valtimo.job.retries

import com.ritense.valtimo.contract.annotation.ProcessBean
import com.ritense.valtimo.contract.annotation.ProcessBeanMethod
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.annotation.PostConstruct
import java.util.regex.Pattern

@ProcessBean(description = "Provides retry cycle configurations for failed jobs")
class RetryCycleProvider(val config: RetryConfiguration) {

    val standardRetryCycles = mutableMapOf<String, String>()

    init {
        standardRetryCycles[DEFAULT] = "R3/PT1M,PT30M,PT2H"
        standardRetryCycles[QUICK] = "R3/PT30S,PT2M,PT10M"
        standardRetryCycles[CRITICAL] = "R5/PT1M,PT15M,PT4H,PT24H,PT48H"

        logger.info { "Standard retry cycles: $standardRetryCycles"}
    }

    @PostConstruct
    fun validateRetryCycles() {
        config.cycles.forEach { cycle ->
            if (!RETRY_PATTERN.matcher(cycle.value).matches()) {
                logger.error { "Invalid retry pattern for service ${cycle.key}: ${cycle.value}" }
            }
        }

    }

    @ProcessBeanMethod(
        description = "Gets the default retry cycle (R3/PT1M,PT30M,PT2H)",
        example = "\${retryCycleProvider.default()}"
    )
    fun default(): String {
       return getCycle(DEFAULT)
    }

    @ProcessBeanMethod(
        description = "Gets the quick retry cycle (R3/PT30S,PT2M,PT10M)",
        example = "\${retryCycleProvider.quick()}"
    )
    fun quick(): String {
       return getCycle(QUICK)
    }

    @ProcessBeanMethod(
        description = "Gets the critical retry cycle (R5/PT1M,PT15M,PT4H,PT24H,PT48H)",
        example = "\${retryCycleProvider.critical()}"
    )
    fun critical(): String {
        return getCycle(CRITICAL)
    }

    @ProcessBeanMethod(
        description = "Gets a custom retry cycle by name",
        example = "\${retryCycleProvider.custom('my-custom-cycle')}"
    )
    fun custom(name: String): String? {
       return  config.getCycle(name)
    }

    private fun getCycle(type: String): String {
        if(config.hasCycle(type)) {
            return config.getCycle(type)!!
        }
        return standardRetryCycles[type]!!
    }

    companion object {
        val logger = KotlinLogging.logger {}

        val RETRY_PATTERN = Pattern.compile("^R\\d+/(PT\\d+[HMS],?)+$")

        const val DEFAULT = "default"
        const val QUICK = "quick"
        const val CRITICAL = "critical"
    }
}