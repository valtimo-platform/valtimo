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

package com.ritense.case.mapper

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case.event.ConfigurationIssueUpdated
import com.ritense.case.event.ConfigurationIssueUpdatedSseEvent
import com.ritense.inbox.ValtimoEvent
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.LocalDateTime

class ConfigurationIssueSseEventMapperTest {

    private val mapper = ConfigurationIssueSseEventMapper()

    @Test
    fun `map should return ConfigurationIssueUpdatedSseEvent when type matches and result is ObjectNode`() {
        val objectNode = ObjectMapper().createObjectNode().apply {
            put("caseDefinitionKey", "my-case")
            put("caseDefinitionVersionTag", "1.0.0")
        }
        val event = ValtimoEvent(
            id = "test-id",
            type = ConfigurationIssueUpdated.TYPE,
            date = LocalDateTime.now(),
            userId = null,
            roles = null,
            resultType = null,
            resultId = "fallback-key",
            result = objectNode
        )

        val result = mapper.map(event)

        assertThat(result).isInstanceOf(ConfigurationIssueUpdatedSseEvent::class.java)
        val sseEvent = result as ConfigurationIssueUpdatedSseEvent
        assertThat(sseEvent.caseDefinitionKey).isEqualTo("my-case")
        assertThat(sseEvent.caseDefinitionVersionTag).isEqualTo("1.0.0")
    }

    @Test
    fun `map should fallback to resultId when result is not ObjectNode`() {
        val event = ValtimoEvent(
            id = "test-id",
            type = ConfigurationIssueUpdated.TYPE,
            date = LocalDateTime.now(),
            userId = null,
            roles = null,
            resultType = null,
            resultId = "fallback-key",
            result = null
        )

        val result = mapper.map(event)

        assertThat(result).isInstanceOf(ConfigurationIssueUpdatedSseEvent::class.java)
        val sseEvent = result as ConfigurationIssueUpdatedSseEvent
        assertThat(sseEvent.caseDefinitionKey).isEqualTo("fallback-key")
        assertThat(sseEvent.caseDefinitionVersionTag).isEqualTo("")
    }

    @Test
    fun `map should return null when result is not ObjectNode and resultId is null`() {
        val event = ValtimoEvent(
            id = "test-id",
            type = ConfigurationIssueUpdated.TYPE,
            date = LocalDateTime.now(),
            userId = null,
            roles = null,
            resultType = null,
            resultId = null,
            result = null
        )

        val result = mapper.map(event)

        assertThat(result).isNull()
    }

    @Test
    fun `map should return null when event type does not match`() {
        val event = ValtimoEvent(
            id = "test-id",
            type = "some.other.event.type",
            date = LocalDateTime.now(),
            userId = null,
            roles = null,
            resultType = null,
            resultId = null,
            result = null
        )

        val result = mapper.map(event)

        assertThat(result).isNull()
    }
}
