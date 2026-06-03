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

import com.fasterxml.jackson.annotation.JsonCreator
import com.fasterxml.jackson.annotation.JsonProperty
import com.fasterxml.jackson.annotation.JsonView
import com.ritense.valtimo.contract.audit.AuditEvent
import com.ritense.valtimo.contract.audit.AuditMetaData
import com.ritense.valtimo.contract.audit.view.AuditView
import java.time.LocalDateTime
import java.util.UUID

class ProcessVariableInspectionEditedEvent @JsonCreator constructor(
    id: UUID,
    origin: String,
    occurredOn: LocalDateTime,
    user: String,
    private val documentId: UUID,
    private val processInstanceId: String,
    private val variableName: String,
    private val mutation: Mutation,
    private val previousValue: String?,
    private val newValue: String?,
) : AuditMetaData(id, origin, occurredOn, user), AuditEvent {

    override fun getDocumentId(): UUID = documentId

    @JsonProperty
    @JsonView(AuditView.Public::class)
    fun getProcessInstanceId(): String = processInstanceId

    @JsonProperty
    @JsonView(AuditView.Public::class)
    fun getVariableName(): String = variableName

    @JsonProperty
    @JsonView(AuditView.Public::class)
    fun getMutation(): Mutation = mutation

    @JsonProperty
    @JsonView(AuditView.Public::class)
    fun getPreviousValue(): String? = previousValue

    @JsonProperty
    @JsonView(AuditView.Public::class)
    fun getNewValue(): String? = newValue

    enum class Mutation { CREATE, UPDATE, DELETE }
}
