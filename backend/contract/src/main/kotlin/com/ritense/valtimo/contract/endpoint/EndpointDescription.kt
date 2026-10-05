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

package com.ritense.valtimo.contract.endpoint

/**
 * Documents a REST endpoint with a human-readable description in English and Dutch, placed directly
 * on the controller handler method that defines the endpoint. It is the single source of truth for
 * the endpoint's description: the description shown to an admin when granting an external plugin
 * access to specific endpoints is resolved from this annotation, and a test enforces that every
 * endpoint declares one.
 */
@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.RUNTIME)
@MustBeDocumented
annotation class EndpointDescription(
    val en: String,
    val nl: String,
)
