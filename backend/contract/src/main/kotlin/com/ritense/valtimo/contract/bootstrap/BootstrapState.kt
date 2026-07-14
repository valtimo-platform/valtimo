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

package com.ritense.valtimo.contract.bootstrap

import java.util.Collections
import java.util.concurrent.ConcurrentHashMap

/**
 * Thread-safe holder tracking the progress of the application's startup bootstrap (Liquibase
 * migrations, the Operaton schema migration and autodeployments).
 *
 * The state starts as [Status.IN_PROGRESS]. Bootstrap components report a failure via
 * [markFailed]; once startup completes [markComplete] moves it to [Status.COMPLETE] — unless a
 * failure was recorded, in which case it stays [Status.FAILED]. It is read by the `bootstrap`
 * health indicator so that the `readiness` and `startup` health groups only report `UP` after a
 * successful bootstrap.
 */
class BootstrapState {

    @Volatile
    var status: Status = Status.IN_PROGRESS
        private set

    private val mutableFailures: MutableMap<String, String> = ConcurrentHashMap()

    val failures: Map<String, String>
        get() = Collections.unmodifiableMap(mutableFailures)

    /**
     * Marks bootstrap as successfully completed. No-op when a failure was already recorded, so a
     * failed step keeps the application unready.
     */
    @Synchronized
    fun markComplete() {
        if (status != Status.FAILED) {
            status = Status.COMPLETE
        }
    }

    /**
     * Records that a bootstrap step failed. This is terminal: the state can no longer become
     * [Status.COMPLETE].
     *
     * @param step a short identifier of the failing step, e.g. `"liquibase"`
     * @param cause the failure
     */
    @Synchronized
    fun markFailed(step: String, cause: Throwable?) {
        status = Status.FAILED
        mutableFailures[step] = cause?.message ?: "unknown error"
    }

    enum class Status {
        IN_PROGRESS,
        COMPLETE,
        FAILED
    }
}
