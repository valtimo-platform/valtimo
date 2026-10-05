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

package com.ritense.externalplugin.exception

/**
 * Thrown when an external plugin action returns a non-success response — a 4xx plugin-level error
 * (e.g. the plugin rejected the input) or a 5xx host/infrastructure error.
 *
 * This is deliberately a plain [RuntimeException] rather than an Operaton `BpmnError`. External
 * plugin actions execute from a service-task **execution listener** that is bridged through the
 * `@Transactional` `OperatonEventListener`. A `BpmnError` thrown from that path is *not* routed to
 * BPMN error boundary events (Operaton only catches `BpmnError`s raised by an activity's behaviour,
 * not by execution listeners) and, when uncaught, it leaves the surrounding transaction marked
 * rollback-only. The commit then fails with an opaque
 * `"Transaction silently rolled back because it has been marked as rollback-only"` message, hiding
 * the real cause on the resulting job incident. Throwing a normal exception instead lets the actual
 * [errorCode] and message propagate to the failed job and its incident, so operators can see why the
 * plugin failed.
 */
class ExternalPluginActionFailedException(
    val errorCode: String,
    message: String,
) : RuntimeException(message)
