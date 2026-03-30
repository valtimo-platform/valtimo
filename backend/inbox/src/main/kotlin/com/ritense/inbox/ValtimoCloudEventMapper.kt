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

package com.ritense.inbox

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import io.cloudevents.CloudEvent
import io.cloudevents.core.provider.EventFormatProvider
import io.cloudevents.jackson.JsonFormat
import io.github.oshai.kotlinlogging.KotlinLogging

class ValtimoCloudEventMapper(
    private val objectMapper: ObjectMapper
) {

    private val cloudEventFormat = EventFormatProvider
        .getInstance()
        .resolveFormat(JsonFormat.CONTENT_TYPE)!!

    fun fromJson(payload: String): CloudEvent? {
        return try {
            cloudEventFormat.deserialize(payload.encodeToByteArray())
        } catch (ex: Exception) {
            logger.warn(ex) { "Failed to deserialize CloudEvent from payload" }
            null
        }
    }

    fun toValtimoEvent(cloudEvent: CloudEvent): ValtimoEvent? {
        return try {
            val cloudEventData = cloudEvent.data?.let { objectMapper.readValue<CloudEventData>(it.toBytes()) }
            ValtimoEvent(
                id = cloudEvent.id,
                type = cloudEvent.type,
                date = cloudEvent.time?.toLocalDateTime(),
                userId = cloudEventData?.userId,
                roles = cloudEventData?.roles,
                resultType = cloudEventData?.resultType,
                resultId = cloudEventData?.resultId,
                result = cloudEventData?.result
            )
        } catch (ex: Exception) {
            logger.warn(ex) { "Failed to map CloudEvent to ValtimoEvent" }
            null
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
