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

package com.ritense.valtimo.task.service

import com.ritense.valtimo.contract.event.TaskCompletedEvent
import com.ritense.valtimo.task.domain.UserTaskOpenedStatus
import com.ritense.valtimo.task.domain.UserTaskOpenedStatusId
import com.ritense.valtimo.task.repository.UserTaskOpenedStatusRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.capture
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.dao.DataIntegrityViolationException
import java.time.LocalDateTime
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class UserTaskOpenedStatusServiceTest {

    @Mock
    lateinit var userTaskOpenedStatusRepository: UserTaskOpenedStatusRepository

    lateinit var service: UserTaskOpenedStatusService

    @BeforeEach
    fun setUp() {
        service = UserTaskOpenedStatusService(userTaskOpenedStatusRepository)
    }

    @Test
    fun `markTaskAsOpened saves record with correct task and user id`() {
        val taskId = "task-1"
        val userId = "user-1"
        whenever(userTaskOpenedStatusRepository.saveAndFlush(any()))
            .thenAnswer { it.arguments[0] as UserTaskOpenedStatus }

        service.markTaskAsOpened(taskId, userId)

        val captor = ArgumentCaptor.forClass(UserTaskOpenedStatus::class.java)
        verify(userTaskOpenedStatusRepository).saveAndFlush(capture(captor))
        assertThat(captor.value.id.taskId).isEqualTo(taskId)
        assertThat(captor.value.id.userId).isEqualTo(userId)
    }

    @Test
    fun `markTaskAsOpened silently ignores DataIntegrityViolationException`() {
        whenever(userTaskOpenedStatusRepository.saveAndFlush(any()))
            .thenThrow(DataIntegrityViolationException("duplicate key"))

        // should not throw
        service.markTaskAsOpened("task-1", "user-1")
    }

    @Test
    fun `getOpenedTaskIdsForUser returns ids of opened tasks`() {
        val userId = "user-1"
        val taskId1 = "task-1"
        val taskId2 = "task-2"
        val taskIds = setOf(taskId1, taskId2, "task-3")

        whenever(userTaskOpenedStatusRepository.findAllByIdTaskIdInAndIdUserId(taskIds, userId))
            .thenReturn(listOf(
                UserTaskOpenedStatus(UserTaskOpenedStatusId(taskId1, userId)),
                UserTaskOpenedStatus(UserTaskOpenedStatusId(taskId2, userId))
            ))

        val result = service.getOpenedTaskIdsForUser(taskIds, userId)

        assertThat(result).containsExactlyInAnyOrder(taskId1, taskId2)
    }

    @Test
    fun `getOpenedTaskIdsForUser returns empty set without querying when taskIds is empty`() {
        val result = service.getOpenedTaskIdsForUser(emptySet(), "user-1")

        assertThat(result).isEmpty()
        verify(userTaskOpenedStatusRepository, never()).findAllByIdTaskIdInAndIdUserId(any(), any())
    }

    @Test
    fun `onTaskCompleted deletes all opened-status records for the task`() {
        val taskId = "task-1"
        val event = TaskCompletedEvent(
            UUID.randomUUID(), "origin", LocalDateTime.now(), "user",
            "assignee", LocalDateTime.now(), taskId, "Task name",
            "process-def:1", "process-instance-1", emptyMap(), null
        )

        service.onTaskCompleted(event)

        verify(userTaskOpenedStatusRepository).deleteByIdTaskId(taskId)
    }
}
