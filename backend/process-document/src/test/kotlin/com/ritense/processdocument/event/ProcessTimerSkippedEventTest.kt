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

package com.ritense.processdocument.event

import com.ritense.valtimo.contract.audit.AuditEvent
import com.ritense.valtimo.contract.json.MapperSingleton
import org.junit.jupiter.api.Test
import java.time.LocalDateTime
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ProcessTimerSkippedEventTest {

    private val objectMapper = MapperSingleton.get()

    @Test
    fun `should round-trip through the audit object mapper preserving all fields`() {
        val id = UUID.randomUUID()
        val documentId = UUID.randomUUID()
        val event: AuditEvent = ProcessTimerSkippedEvent(
            id,
            "127.0.0.1",
            LocalDateTime.parse("2026-07-21T12:00:00"),
            "admin@example.com",
            documentId,
            "process-instance-1",
            "job-1",
            "Event_timer",
        )

        val json = objectMapper.writeValueAsString(event)
        // documentId must be serialized, otherwise deserialization of the non-null
        // creator parameter fails (regression guard for the audit round-trip).
        assertTrue(json.contains("documentId"), "documentId should be serialized: $json")

        val restored = objectMapper.readValue(json, AuditEvent::class.java)

        assertTrue(restored is ProcessTimerSkippedEvent)
        restored as ProcessTimerSkippedEvent
        assertEquals(documentId, restored.getDocumentId())
        assertEquals(id, restored.id)
        assertEquals("admin@example.com", restored.user)
        assertEquals("process-instance-1", restored.getProcessInstanceId())
        assertEquals("job-1", restored.getJobId())
        assertEquals("Event_timer", restored.getActivityId())
    }

    @Test
    fun `should round-trip when activityId is null`() {
        val event: AuditEvent = ProcessTimerSkippedEvent(
            UUID.randomUUID(),
            "127.0.0.1",
            LocalDateTime.parse("2026-07-21T12:00:00"),
            "admin@example.com",
            UUID.randomUUID(),
            "process-instance-1",
            "job-1",
            null,
        )

        val json = objectMapper.writeValueAsString(event)
        val restored = objectMapper.readValue(json, AuditEvent::class.java) as ProcessTimerSkippedEvent

        assertEquals(null, restored.getActivityId())
    }
}
