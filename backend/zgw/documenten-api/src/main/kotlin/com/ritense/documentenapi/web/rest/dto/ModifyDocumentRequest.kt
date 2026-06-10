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

package com.ritense.documentenapi.web.rest.dto

import com.fasterxml.jackson.annotation.JsonFormat
import com.ritense.documentenapi.client.DocumentStatusType
import jakarta.validation.constraints.Size
import java.time.LocalDate

/**
 * Mirrors the constraints of OpenZaak's `EnkelvoudigInformatieObjectWithLockRequest`
 * (PUT /documenten/api/v1/enkelvoudiginformatieobjecten/{uuid}). Failing fast here gives
 * Valtimo clients a field-level error before the request reaches OpenZaak.
 */
class ModifyDocumentRequest(
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    val creatiedatum: LocalDate,
    @field:Size(min = 1, max = 200)
    val titel: String,
    @field:Size(min = 1, max = 200)
    val auteur: String,
    val status: DocumentStatusType? = null,
    @field:Size(min = 3, max = 3)
    val taal: String,
    @field:Size(max = 255)
    val bestandsnaam: String? = null,
    @field:Size(max = 1000)
    val beschrijving: String? = null,
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    val ontvangstdatum: LocalDate? = null,
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    val verzenddatum: LocalDate? = null,
    val indicatieGebruiksrecht: Boolean? = false,
    val vertrouwelijkheidaanduiding: String? = null,
    @field:Size(min = 1, max = 200)
    val informatieobjecttype: String? = null,
    val trefwoorden: List<@Size(min = 1, max = 100) String>? = null,
)