/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
package com.ritense.processdocument.domain

import jakarta.persistence.Column
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.Table

@Entity
@Table(name = "case_definition_process_link")
class CaseDefinitionProcessLink(
    @EmbeddedId
    val id: CaseDefinitionProcessLinkId,

    @Column(name = "link_type", nullable = false)
    val type: String,

    /**
     * Set only for an unowned (system) process, where a new version would otherwise silently change what a
     * finalized case definition runs. An owned process needs no pin: its version tag already resolves it.
     *
     * `null` means "the latest version". The value is an engine-local version number, so it is not exported.
     */
    @Column(name = "process_definition_version")
    val processDefinitionVersion: Int? = null
)
