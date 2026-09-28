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

package com.ritense.zaakdetails.web.rest

import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.logging.LoggableResource
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import com.ritense.zaakdetails.service.CaseZaakdetailsInspectionService
import com.ritense.zaakdetails.web.rest.dto.CaseZaakdetailsInspectionDto
import com.ritense.zaakdetails.web.rest.dto.ZaakdetailsObjectContentDto
import com.ritense.zakenapi.web.rest.dto.ZaakobjectResolveResultDto
import org.springframework.http.ResponseEntity
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.net.URI
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping("/api/management", produces = [APPLICATION_JSON_UTF8_VALUE])
class CaseZaakdetailsInspectionResource(
    private val authorizationService: AuthorizationService,
    private val caseZaakdetailsInspectionService: CaseZaakdetailsInspectionService,
) {

    @EndpointDescription(
        en = "Get zaakdetails inspection for case",
        nl = "Zaakdetails-inspectie voor dossier ophalen",
    )
    @GetMapping("/v1/case/{caseId}/zgw/zaakdetails")
    @Transactional
    fun getZaakdetailsInspection(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID,
    ): ResponseEntity<CaseZaakdetailsInspectionDto> {
        val document = caseZaakdetailsInspectionService.loadDocument(caseId)
        requireInspectPermission(document)
        return ResponseEntity.ok(caseZaakdetailsInspectionService.getInspection(caseId, document))
    }

    @EndpointDescription(
        en = "Get zaakdetails object content for case",
        nl = "Zaakdetails-objectinhoud voor dossier ophalen",
    )
    @GetMapping("/v1/case/{caseId}/zgw/zaakdetails/object")
    @Transactional
    fun getZaakdetailsObjectContent(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID,
    ): ResponseEntity<ZaakdetailsObjectContentDto> {
        val document = caseZaakdetailsInspectionService.loadDocument(caseId)
        requireInspectPermission(document)
        return ResponseEntity.ok(caseZaakdetailsInspectionService.getZaakdetailsObjectContent(caseId))
    }

    @EndpointDescription(
        en = "Resolve zaakobject content for case",
        nl = "Zaakobjectinhoud voor dossier ophalen",
    )
    @GetMapping("/v1/case/{caseId}/zgw/zaakobject/resolve")
    @Transactional
    fun resolveZaakobjectContent(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID,
        @RequestParam objectUrl: URI,
    ): ResponseEntity<ZaakobjectResolveResultDto> {
        val document = caseZaakdetailsInspectionService.loadDocument(caseId)
        requireInspectPermission(document)
        return ResponseEntity.ok(caseZaakdetailsInspectionService.resolveZaakobjectContent(caseId, objectUrl))
    }

    private fun requireInspectPermission(document: JsonSchemaDocument) {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                JsonSchemaDocument::class.java,
                JsonSchemaDocumentActionProvider.INSPECT,
                document,
            )
        )
    }
}
