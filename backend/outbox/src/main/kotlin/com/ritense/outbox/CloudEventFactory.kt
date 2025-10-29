/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.outbox

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.outbox.domain.BaseEvent
import com.ritense.outbox.domain.CloudEventData
import io.cloudevents.CloudEvent
import io.cloudevents.core.builder.CloudEventBuilder
import java.net.URI
import java.time.ZonedDateTime

class CloudEventFactory(
    private val objectMapper: ObjectMapper,
    private val userProvider: UserProvider,
    private val cloudEventSource: String
) {
    fun create(baseEvent: BaseEvent): CloudEvent {
        val userId = baseEvent.userId ?: userProvider.getCurrentUserLogin() ?: "System"
        val roles = if (baseEvent.roles.isEmpty()) userProvider.getCurrentUserRoles().toSet() else baseEvent.roles
        val cloudEventData = CloudEventData(
            userId = userId,
            roles = roles,
            resultType = baseEvent.resultType,
            resultId = baseEvent.resultId,
            result = baseEvent.result
        )
        val dataBytes = objectMapper.writeValueAsBytes(cloudEventData)

        return CloudEventBuilder.v1()
            .withId(baseEvent.id.toString())
            .withSource(URI(cloudEventSource))
            .withTime(baseEvent.date.atOffset(ZonedDateTime.now().offset))
            .withType(baseEvent.type)
            .withDataContentType("application/json")
            .withData(dataBytes)
            .build()
    }
}
