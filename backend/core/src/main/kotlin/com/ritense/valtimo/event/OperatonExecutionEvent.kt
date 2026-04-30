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

package com.ritense.valtimo.event

import org.operaton.bpm.engine.delegate.DelegateExecution

/**
 * Wrapper for [DelegateExecution] to be used in [org.springframework.context.event.EventListener].
 *
 * The [DelegateExecution.getEventName] can be modified by an [org.operaton.bpm.engine.delegate.ExecutionListener].
 * This event stores the original event name to ensure that subsequent [org.springframework.context.event.EventListener]
 * conditions based on the event name remain valid.
 */
class OperatonExecutionEvent(
    val delegateExecution: DelegateExecution,
    val eventName: String = delegateExecution.eventName,
)