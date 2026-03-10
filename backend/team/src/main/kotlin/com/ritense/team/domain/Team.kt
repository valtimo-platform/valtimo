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

package com.ritense.team.domain

import jakarta.persistence.CollectionTable
import jakarta.persistence.Column
import jakarta.persistence.ElementCollection
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.Table

@Entity
@Table(name = "team")
data class Team(
    @Id
    @Column(name = "team_key", nullable = false, unique = true, length = 255)
    var key: String,

    @Column(name = "title", nullable = false, length = 255)
    var title: String,

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "team_user", joinColumns = [JoinColumn(name = "team_key")])
    @Column(name = "username")
    var users: List<String> = emptyList()
)
