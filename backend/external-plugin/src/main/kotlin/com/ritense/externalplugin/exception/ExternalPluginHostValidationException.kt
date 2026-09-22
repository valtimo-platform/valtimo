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
 * A host registration or host update the operator can fix by correcting the form. Carries a message
 * written for that operator — it names the offending field and what to enter instead — and is mapped
 * to a `400 Bad Request` whose `detail` is exactly this message, so the add-host modal can render it
 * next to the fields the admin already filled in. Anything mapped through the catch-all handler
 * instead becomes a `500` with only a reference id, which the modal cannot explain.
 */
class ExternalPluginHostValidationException(message: String) : RuntimeException(message)