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

package com.ritense.zakenapi.web.rest.dto

import com.fasterxml.jackson.databind.JsonNode
import java.net.URI
import java.time.LocalDateTime
import java.util.UUID

data class CaseZgwInspectionDto(
    val zaakInstanceLink: ZaakInstanceLinkDto?,
    val zaak: JsonNode?,
    val eigenschappen: List<ZaakEigenschapDto>,
    val rollen: List<ZaakRolDto>,
    val statusHistory: List<ZaakStatusDto>,
    val resultaat: ZaakResultaatDto?,
    val zaakObjecten: List<ZaakObjectDto>,
    val zaakInformatieObjecten: List<ZaakInformatieObjectDto>,
    val besluiten: List<ZaakBesluitDto>,
    val warnings: List<String>,
)

data class ZaakInstanceLinkDto(
    val zaakInstanceUrl: URI,
    val zaakInstanceId: UUID,
    val zaakTypeUrl: URI,
)

data class ZaakEigenschapDto(
    val url: URI,
    val eigenschap: URI,
    val naam: String?,
    val waarde: String,
)

data class ZaakRolDto(
    val url: URI?,
    val betrokkeneType: String,
    val roltype: URI,
    val omschrijving: String?,
    val omschrijvingGeneriek: String?,
    val indicatieMachtiging: String?,
    val betrokkeneIdentificatie: JsonNode?,
)

data class ZaakStatusDto(
    val url: URI,
    val statustype: URI,
    val datumStatusGezet: LocalDateTime,
    val statustoelichting: String?,
)

data class ZaakResultaatDto(
    val url: URI,
    val resultaattype: URI,
    val toelichting: String?,
)

data class ZaakObjectDto(
    val url: URI,
    val objectUrl: URI,
    val objectType: String,
    val objectTypeOverige: String?,
    val relatieomschrijving: String?,
)

data class ZaakInformatieObjectDto(
    val url: URI,
    val informatieobject: URI,
    val titel: String?,
    val registratiedatum: LocalDateTime,
)

data class ZaakBesluitDto(
    val url: URI,
    val besluit: URI,
)
