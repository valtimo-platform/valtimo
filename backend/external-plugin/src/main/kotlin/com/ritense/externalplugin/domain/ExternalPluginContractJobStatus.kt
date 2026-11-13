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

package com.ritense.externalplugin.domain

enum class ExternalPluginContractJobStatus {
    /** Stored, not yet acknowledged by the provider. */
    PENDING,

    /** Provider took it and completes it later. */
    ACCEPTED,
    COMPLETED,
    FAILED,

    /** Deadline passed without an answer. */
    EXPIRED,

    /** Requester acknowledged the reply. */
    DELIVERED,

    /** Reply delivery gave up after the maximum number of attempts. */
    UNDELIVERABLE;

    val isOpen: Boolean
        get() = this != DELIVERED && this != UNDELIVERABLE

    val awaitsReply: Boolean
        get() = this == COMPLETED || this == FAILED || this == EXPIRED

    companion object {
        val OPEN: Set<ExternalPluginContractJobStatus> = entries.filter { it.isOpen }.toSet()
        val AWAITING_PROVIDER: Set<ExternalPluginContractJobStatus> = setOf(PENDING, ACCEPTED)
        val AWAITING_REPLY: Set<ExternalPluginContractJobStatus> = entries.filter { it.awaitsReply }.toSet()
        val TERMINAL: Set<ExternalPluginContractJobStatus> = setOf(DELIVERED, UNDELIVERABLE)
    }
}
