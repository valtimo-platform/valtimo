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

package com.ritense.pdca.web.rest.dto

import com.ritense.pdca.domain.Instrument
import com.ritense.pdca.domain.InstrumentStatus
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.UUID

data class CreateInstrumentRequest(
    val title: String,
    val externalProductId: String? = null,
    val providerName: String? = null,
    val category: String? = null,
    val startDate: LocalDate? = null,
    val endDate: LocalDate? = null
)

data class UpdateInstrumentRequest(
    val title: String? = null,
    val externalProductId: String? = null,
    val providerName: String? = null,
    val category: String? = null,
    val status: InstrumentStatus? = null,
    val startDate: LocalDate? = null,
    val endDate: LocalDate? = null,
    val result: String? = null
)

data class InstrumentResponse(
    val id: UUID,
    val goalId: UUID,
    val externalProductId: String?,
    val title: String,
    val providerName: String?,
    val category: String?,
    val status: InstrumentStatus,
    val startDate: LocalDate?,
    val endDate: LocalDate?,
    val result: String?,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime
) {
    constructor(instrument: Instrument) : this(
        id = instrument.id,
        goalId = instrument.goalId,
        externalProductId = instrument.externalProductId,
        title = instrument.title,
        providerName = instrument.providerName,
        category = instrument.category,
        status = instrument.status,
        startDate = instrument.startDate,
        endDate = instrument.endDate,
        result = instrument.result,
        createdAt = instrument.createdAt,
        updatedAt = instrument.updatedAt
    )
}
