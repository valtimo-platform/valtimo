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
package com.ritense.valtimo.test.golden

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.outbox.CloudEventFactory
import com.ritense.outbox.UserProvider
import com.ritense.outbox.domain.BaseEvent
import io.cloudevents.core.provider.EventFormatProvider
import io.cloudevents.jackson.JsonFormat

/**
 * Serialises an event the way the outbox does, for tests whose outbox is mocked.
 */
object GoldenEvents {

    @JvmStatic
    @JvmOverloads
    fun serialize(event: BaseEvent, objectMapper: ObjectMapper, cloudEventSource: String = "valtimo"): String {
        val cloudEvent = CloudEventFactory(objectMapper, UserProvider(), cloudEventSource).create(event)
        val format = checkNotNull(EventFormatProvider.getInstance().resolveFormat(JsonFormat.CONTENT_TYPE))
        return String(format.serialize(cloudEvent), Charsets.UTF_8)
    }
}
