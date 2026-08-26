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
     * Set only for a process the case definition does not own — a system process — where without it
     * a new version would silently change what an already finalized case definition runs. A process
     * the case definition owns needs no pin: it is resolved by version tag and immutable already.
     *
     * `null` means "the latest version", how every link behaved before pinning existed. The value is
     * an engine version number, local to this environment, so it is deliberately not exported.
     */
    @Column(name = "process_definition_version")
    val processDefinitionVersion: Int? = null
)