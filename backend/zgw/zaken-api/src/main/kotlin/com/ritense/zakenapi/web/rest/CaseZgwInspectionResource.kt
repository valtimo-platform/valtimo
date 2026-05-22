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

package com.ritense.zakenapi.web.rest

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.logging.LoggableResource
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.domain.ZaakInformatieObject
import com.ritense.zakenapi.domain.ZaakInstanceLink
import com.ritense.zakenapi.domain.ZaakObject
import com.ritense.zakenapi.domain.ZaakResultaat
import com.ritense.zakenapi.domain.ZaakStatus
import com.ritense.zakenapi.domain.ZaakbesluitResponse
import com.ritense.zakenapi.domain.ZaakeigenschapResponse
import com.ritense.zakenapi.domain.rol.Rol
import com.ritense.zakenapi.link.ZaakInstanceLinkService
import com.ritense.zakenapi.web.rest.dto.CaseZgwInspectionDto
import com.ritense.zakenapi.web.rest.dto.ZaakBesluitDto
import com.ritense.zakenapi.web.rest.dto.ZaakEigenschapDto
import com.ritense.zakenapi.web.rest.dto.ZaakInformatieObjectDto
import com.ritense.zakenapi.web.rest.dto.ZaakInstanceLinkDto
import com.ritense.zakenapi.web.rest.dto.ZaakObjectDto
import com.ritense.zakenapi.web.rest.dto.ZaakResultaatDto
import com.ritense.zakenapi.web.rest.dto.ZaakRolDto
import com.ritense.zakenapi.web.rest.dto.ZaakStatusDto
import org.springframework.http.ResponseEntity
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping("/api/management", produces = [APPLICATION_JSON_UTF8_VALUE])
class CaseZgwInspectionResource(
    private val documentService: DocumentService,
    private val authorizationService: AuthorizationService,
    private val zaakInstanceLinkService: ZaakInstanceLinkService,
    private val pluginService: PluginService,
    private val objectMapper: ObjectMapper,
) {

    @GetMapping("/v1/case/{caseId}/zgw")
    @Transactional
    fun getZgwInspection(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID
    ): ResponseEntity<CaseZgwInspectionDto> {
        loadDocumentAndCheckPermission(caseId)
        return ResponseEntity.ok(buildInspectionDto(caseId))
    }

    private fun loadDocumentAndCheckPermission(caseId: UUID): JsonSchemaDocument {
        val document = runWithoutAuthorization {
            documentService.findBy(JsonSchemaDocumentId.existingId(caseId)).orElseThrow()
        } as JsonSchemaDocument

        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                JsonSchemaDocument::class.java,
                JsonSchemaDocumentActionProvider.INSPECT,
                document,
            )
        )
        return document
    }

    private fun buildInspectionDto(caseId: UUID): CaseZgwInspectionDto {
        val warnings = mutableListOf<String>()

        val link = runCatching { zaakInstanceLinkService.getByDocumentId(caseId) }.getOrNull()
            ?: return emptyInspection()

        val plugin = pluginService.createInstance(
            ZakenApiPlugin::class.java,
            ZakenApiPlugin.findConfigurationByUrl(link.zaakInstanceUrl),
        )
        if (plugin == null) {
            warnings += "zaak: no Zaken API plugin configured for host ${link.zaakInstanceUrl.host}"
            return emptyInspection(linkDto = link.toDto(), warnings = warnings)
        }

        val zaak = trySection(warnings, "zaak") { plugin.getZaak(link.zaakInstanceUrl) }
        if (zaak == null) {
            // Zaak itself is unreachable (404, network failure, etc.) — every
            // sub-resource call would hit the same error. Short-circuit so the
            // frontend can render a single, focused "zaak unreachable" empty
            // state instead of seven repeated warnings.
            return emptyInspection(linkDto = link.toDto(), warnings = warnings)
        }
        val zaakJson: JsonNode = objectMapper.valueToTree(zaak)

        val eigenschappen = trySection(warnings, "eigenschappen") {
            plugin.getZaakeigenschappen(link.zaakInstanceUrl).map { it.toDto() }
        } ?: emptyList()

        val rollen = trySection(warnings, "rollen") {
            plugin.getZaakRollen(link.zaakInstanceUrl).map { it.toDto() }
        } ?: emptyList()

        val statusHistory = trySection(warnings, "statusHistory") {
            plugin.getZaakStatussen(link.zaakInstanceUrl).map { it.toDto() }
        } ?: emptyList()

        val resultaat = trySection(warnings, "resultaat") {
            plugin.getZaakResultaat(link.zaakInstanceUrl)?.toDto()
        }

        val zaakObjecten = trySection(warnings, "zaakObjecten") {
            plugin.getZaakObjecten(link.zaakInstanceUrl).map { it.toDto() }
        } ?: emptyList()

        val zaakInformatieObjecten = trySection(warnings, "zaakInformatieObjecten") {
            plugin.getZaakInformatieObjecten(caseId, link.zaakInstanceUrl).map { it.toDto() }
        } ?: emptyList()

        val besluiten = trySection(warnings, "besluiten") {
            plugin.getZaakbesluiten(link.zaakInstanceUrl).map { it.toDto() }
        } ?: emptyList()

        return CaseZgwInspectionDto(
            zaakInstanceLink = link.toDto(),
            zaak = zaakJson,
            eigenschappen = eigenschappen,
            rollen = rollen,
            statusHistory = statusHistory,
            resultaat = resultaat,
            zaakObjecten = zaakObjecten,
            zaakInformatieObjecten = zaakInformatieObjecten,
            besluiten = besluiten,
            warnings = warnings,
        )
    }

    private fun emptyInspection(
        linkDto: ZaakInstanceLinkDto? = null,
        warnings: List<String> = emptyList(),
    ) = CaseZgwInspectionDto(
        zaakInstanceLink = linkDto,
        zaak = null,
        eigenschappen = emptyList(),
        rollen = emptyList(),
        statusHistory = emptyList(),
        resultaat = null,
        zaakObjecten = emptyList(),
        zaakInformatieObjecten = emptyList(),
        besluiten = emptyList(),
        warnings = warnings,
    )

    private inline fun <T> trySection(
        warnings: MutableList<String>,
        name: String,
        block: () -> T,
    ): T? = try {
        block()
    } catch (e: Exception) {
        warnings += "$name: ${e.message ?: e.javaClass.simpleName}"
        null
    }

    private fun ZaakInstanceLink.toDto() = ZaakInstanceLinkDto(
        zaakInstanceUrl = zaakInstanceUrl,
        zaakInstanceId = zaakInstanceId,
        zaakTypeUrl = zaakTypeUrl,
    )

    private fun ZaakeigenschapResponse.toDto() = ZaakEigenschapDto(
        url = url,
        eigenschap = eigenschap,
        naam = naam,
        waarde = waarde,
    )

    private fun Rol.toDto() = ZaakRolDto(
        url = url,
        betrokkeneType = betrokkeneType.name,
        roltype = roltype,
        omschrijving = omschrijving,
        omschrijvingGeneriek = omschrijvingGeneriek?.name,
        indicatieMachtiging = indicatieMachtiging?.key,
        betrokkeneIdentificatie = betrokkeneIdentificatie?.let { objectMapper.valueToTree(it) },
    )

    private fun ZaakStatus.toDto() = ZaakStatusDto(
        url = url,
        statustype = statustype,
        datumStatusGezet = datumStatusGezet,
        statustoelichting = statustoelichting,
    )

    private fun ZaakResultaat.toDto() = ZaakResultaatDto(
        url = url,
        resultaattype = resultaattype,
        toelichting = toelichting,
    )

    private fun ZaakObject.toDto() = ZaakObjectDto(
        url = url,
        objectUrl = objectUrl,
        objectType = objectType,
        objectTypeOverige = objectTypeOverige,
        relatieomschrijving = relatieomschrijving,
    )

    private fun ZaakInformatieObject.toDto() = ZaakInformatieObjectDto(
        url = url,
        informatieobject = informatieobject,
        titel = titel,
        registratiedatum = registratiedatum,
    )

    private fun ZaakbesluitResponse.toDto() = ZaakBesluitDto(
        url = url,
        besluit = besluit,
    )
}
