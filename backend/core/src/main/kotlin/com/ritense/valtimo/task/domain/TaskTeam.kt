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

package com.ritense.valtimo.task.domain

import com.ritense.valtimo.contract.authentication.Team
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "task_team")
data class TaskTeam(
    @Id
    @Column(name = "task_id", nullable = false, length = 64)
    val taskId: String,

    @Column(name = "team_key", nullable = false, length = 255)
    var teamKey: String,

    @Column(name = "team_title", nullable = false, length = 255)
    var teamTitle: String
) : Team {
    override val key: String get() = teamKey
    override val title: String get() = teamTitle
}
