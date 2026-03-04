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
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.event.EventListener
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.transaction.annotation.Transactional

open class UserTaskOpenedStatusService(
    private val userTaskOpenedStatusRepository: UserTaskOpenedStatusRepository
) {

    open fun markTaskAsOpened(taskId: String, userId: String) {
        try {
            userTaskOpenedStatusRepository.saveAndFlush(UserTaskOpenedStatus(UserTaskOpenedStatusId(taskId, userId)))
        } catch (_: DataIntegrityViolationException) {
            logger.debug { "Unable to mark task $taskId as opened." }
        }
    }

    @Transactional(readOnly = true)
    open fun getOpenedTaskIdsForUser(taskIds: Set<String>, userId: String): Set<String> {
        if (taskIds.isEmpty()) return emptySet()
        return userTaskOpenedStatusRepository.findAllByIdTaskIdInAndIdUserId(taskIds, userId)
            .map { it.id.taskId }
            .toSet()
    }

    @EventListener
    @Transactional
    open fun onTaskCompleted(event: TaskCompletedEvent) {
        userTaskOpenedStatusRepository.deleteByIdTaskId(event.taskId)
    }

    companion object {
        val logger = KotlinLogging.logger {}
    }
}
