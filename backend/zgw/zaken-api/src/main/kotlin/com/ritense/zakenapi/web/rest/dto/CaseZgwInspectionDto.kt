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
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.zakenapi.domain.ZaakInformatieObject
import com.ritense.zakenapi.domain.ZaakInstanceLink
import com.ritense.zakenapi.domain.ZaakObject
import com.ritense.zakenapi.domain.ZaakResultaat
import com.ritense.zakenapi.domain.ZaakStatus
import com.ritense.zakenapi.domain.ZaakbesluitResponse
import com.ritense.zakenapi.domain.ZaakeigenschapResponse
import com.ritense.zakenapi.domain.rol.Rol
import java.net.URI
import java.time.LocalDateTime
import java.util.UUID

data class CaseZgwInspectionDto(
    val zaakInstanceLink: ZaakInstanceLinkDto? = null,
    val zaak: JsonNode? = null,
    val eigenschappen: List<ZaakEigenschapDto> = emptyList(),
    val rollen: List<ZaakRolDto> = emptyList(),
    val statusHistory: List<ZaakStatusDto> = emptyList(),
    val resultaat: ZaakResultaatDto? = null,
    val zaakObjecten: List<ZaakObjectDto> = emptyList(),
    val zaakInformatieObjecten: List<ZaakInformatieObjectDto> = emptyList(),
    val besluiten: List<ZaakBesluitDto> = emptyList(),
    val warnings: List<String> = emptyList(),
)

data class ZaakInstanceLinkDto(
    val zaakInstanceUrl: URI,
    val zaakInstanceId: UUID,
    val zaakTypeUrl: URI,
) {
    companion object {
        fun fromDomain(link: ZaakInstanceLink) = ZaakInstanceLinkDto(
            zaakInstanceUrl = link.zaakInstanceUrl,
            zaakInstanceId = link.zaakInstanceId,
            zaakTypeUrl = link.zaakTypeUrl,
        )
    }
}

data class ZaakEigenschapDto(
    val url: URI,
    val eigenschap: URI,
    val naam: String?,
    val waarde: String,
) {
    companion object {
        fun fromDomain(eigenschap: ZaakeigenschapResponse) = ZaakEigenschapDto(
            url = eigenschap.url,
            eigenschap = eigenschap.eigenschap,
            naam = eigenschap.naam,
            waarde = eigenschap.waarde,
        )
    }
}

data class ZaakRolDto(
    val url: URI?,
    val betrokkeneType: String,
    val roltype: URI,
    val omschrijving: String?,
    val omschrijvingGeneriek: String?,
    val indicatieMachtiging: String?,
    val betrokkeneIdentificatie: JsonNode?,
) {
    companion object {
        fun fromDomain(rol: Rol, objectMapper: ObjectMapper) = ZaakRolDto(
            url = rol.url,
            betrokkeneType = rol.betrokkeneType.name,
            roltype = rol.roltype,
            omschrijving = rol.omschrijving,
            omschrijvingGeneriek = rol.omschrijvingGeneriek?.name,
            indicatieMachtiging = rol.indicatieMachtiging?.key,
            betrokkeneIdentificatie = rol.betrokkeneIdentificatie?.let { objectMapper.valueToTree(it) },
        )
    }
}

data class ZaakStatusDto(
    val url: URI,
    val statustype: URI,
    val datumStatusGezet: LocalDateTime,
    val statustoelichting: String?,
) {
    companion object {
        fun fromDomain(status: ZaakStatus) = ZaakStatusDto(
            url = status.url,
            statustype = status.statustype,
            datumStatusGezet = status.datumStatusGezet,
            statustoelichting = status.statustoelichting,
        )
    }
}

data class ZaakResultaatDto(
    val url: URI,
    val resultaattype: URI,
    val toelichting: String?,
) {
    companion object {
        fun fromDomain(resultaat: ZaakResultaat) = ZaakResultaatDto(
            url = resultaat.url,
            resultaattype = resultaat.resultaattype,
            toelichting = resultaat.toelichting,
        )
    }
}

data class ZaakObjectDto(
    val url: URI,
    val objectUrl: URI,
    val objectType: String,
    val objectTypeOverige: String?,
    val relatieomschrijving: String?,
) {
    companion object {
        fun fromDomain(zaakObject: ZaakObject) = ZaakObjectDto(
            url = zaakObject.url,
            objectUrl = zaakObject.objectUrl,
            objectType = zaakObject.objectType,
            objectTypeOverige = zaakObject.objectTypeOverige,
            relatieomschrijving = zaakObject.relatieomschrijving,
        )
    }
}

data class ZaakInformatieObjectDto(
    val url: URI,
    val informatieobject: URI,
    val titel: String?,
    val registratiedatum: LocalDateTime,
) {
    companion object {
        fun fromDomain(zaakInformatieObject: ZaakInformatieObject) = ZaakInformatieObjectDto(
            url = zaakInformatieObject.url,
            informatieobject = zaakInformatieObject.informatieobject,
            titel = zaakInformatieObject.titel,
            registratiedatum = zaakInformatieObject.registratiedatum,
        )
    }
}

data class ZaakBesluitDto(
    val url: URI,
    val besluit: URI,
) {
    companion object {
        fun fromDomain(besluit: ZaakbesluitResponse) = ZaakBesluitDto(
            url = besluit.url,
            besluit = besluit.besluit,
        )
    }
}
