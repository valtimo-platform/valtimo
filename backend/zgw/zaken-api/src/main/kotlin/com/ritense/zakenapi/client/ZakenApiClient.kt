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

package com.ritense.zakenapi.client

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.documentenapi.authorization.ZgwDocument
import com.ritense.documentenapi.authorization.ZgwDocumentActionProvider
import com.ritense.outbox.OutboxService
import com.ritense.zakenapi.ZakenApiAuthentication
import com.ritense.zakenapi.domain.CreateZaakRequest
import com.ritense.zakenapi.domain.CreateZaakResultaatRequest
import com.ritense.zakenapi.domain.CreateZaakResultaatResponse
import com.ritense.zakenapi.domain.CreateZaakStatusRequest
import com.ritense.zakenapi.domain.CreateZaakStatusResponse
import com.ritense.zakenapi.domain.CreateZaakeigenschapRequest
import com.ritense.zakenapi.domain.GetZaakResultatenRequest
import com.ritense.zakenapi.domain.PatchZaakRequest
import com.ritense.zakenapi.domain.UpdateZaakeigenschapRequest
import com.ritense.zakenapi.domain.ZaakInformatieObject
import com.ritense.zakenapi.domain.ZaakObject
import com.ritense.zakenapi.domain.ZaakResponse
import com.ritense.zakenapi.domain.ZaakResultaat
import com.ritense.zakenapi.domain.ZaakStatus
import com.ritense.zakenapi.domain.ZaakbesluitResponse
import com.ritense.zakenapi.domain.ZaakeigenschapResponse
import com.ritense.zakenapi.domain.ZaakopschortingRequest
import com.ritense.zakenapi.domain.ZaakopschortingResponse
import com.ritense.zakenapi.domain.rol.Rol
import com.ritense.zakenapi.domain.rol.RolType
import com.ritense.zakenapi.domain.zaakobjectrequest.SimpleZaakObjectRequest
import com.ritense.zakenapi.domain.zaakobjectrequest.ZaakObjectOverigeRequest
import com.ritense.zakenapi.domain.zaakobjectrequest.ZaakObjectRequest
import com.ritense.zakenapi.domain.zaakobjectrequest.ZaakObjectType
import com.ritense.zakenapi.event.DocumentLinkedToZaak
import com.ritense.zakenapi.event.ZaakCreated
import com.ritense.zakenapi.event.ZaakInformatieObjectenListed
import com.ritense.zakenapi.event.ZaakObjectCreated
import com.ritense.zakenapi.event.ZaakObjectViewed
import com.ritense.zakenapi.event.ZaakObjectenListed
import com.ritense.zakenapi.event.ZaakOpschortingUpdated
import com.ritense.zakenapi.event.ZaakPatched
import com.ritense.zakenapi.event.ZaakResultaatCreated
import com.ritense.zakenapi.event.ZaakResultaatDeleted
import com.ritense.zakenapi.event.ZaakResultaatViewed
import com.ritense.zakenapi.event.ZaakRolCreated
import com.ritense.zakenapi.event.ZaakRolDeleted
import com.ritense.zakenapi.event.ZaakRolUpdated
import com.ritense.zakenapi.event.ZaakRollenListed
import com.ritense.zakenapi.event.ZaakStatusCreated
import com.ritense.zakenapi.event.ZaakStatusViewed
import com.ritense.zakenapi.event.ZaakViewed
import com.ritense.zakenapi.event.ZaakbesluitenListed
import com.ritense.zakenapi.event.ZaakeigenschapCreated
import com.ritense.zakenapi.event.ZaakeigenschapDeleted
import com.ritense.zakenapi.event.ZaakeigenschapListed
import com.ritense.zakenapi.event.ZaakeigenschapUpdated
import com.ritense.zakenapi.exception.ZaakRolNotUpdatedException
import com.ritense.zgw.ClientTools
import com.ritense.zgw.Page
import mu.KLogger
import mu.KotlinLogging
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.web.client.RestClient
import org.springframework.web.client.body
import java.net.URI
import java.util.UUID

class ZakenApiClient(
    private val restClientBuilder: RestClient.Builder,
    private val outboxService: OutboxService,
    private val objectMapper: ObjectMapper,
    private val authorizationService: AuthorizationService,
    private val authorizationEnabled: Boolean = false,
) {
    fun linkDocument(
        authentication: ZakenApiAuthentication,
        caseDocumentId: UUID,
        baseUrl: URI,
        request: LinkDocumentRequest
    ): LinkDocumentResult {
        if (authorizationEnabled) {
            authorizationService.requirePermission(
                EntityAuthorizationRequest(
                    ZgwDocument::class.java,
                    ZgwDocumentActionProvider.CREATE,
                    ZgwDocument(caseDocumentId = caseDocumentId)
                )
            )
        }

        val result = buildRestClient(authentication)
            .post()
            .uri {
                ClientTools.baseUrlToBuilder(it, baseUrl)
                    .path("zaakinformatieobjecten")
                    .build()
            }
            .contentType(MediaType.APPLICATION_JSON)
            .body(request)
            .retrieve()
            .body<LinkDocumentResult>()!!

        outboxService.send { DocumentLinkedToZaak(result.uuid, objectMapper.valueToTree(result)) }
        return result
    }

    fun getZaakObjecten(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        zaakUrl: URI,
        page: Int
    ): Page<ZaakObject> {
        val result = buildRestClient(authentication)
            .get()
            .uri {
                ClientTools.baseUrlToBuilder(it, baseUrl)
                    .path("zaakobjecten")
                    .queryParam("page", page)
                    .queryParam("zaak", zaakUrl)
                    .build()
            }
            .retrieve()
            .body<Page<ZaakObject>>()!!

        outboxService.send { ZaakObjectenListed(objectMapper.valueToTree(result.results)) }
        return result
    }

    fun getZaakObject(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        zaakUrl: URI,
        objectUrl: URI
    ): ZaakObject? {
        val result = buildRestClient(authentication)
            .get()
            .uri {
                ClientTools.baseUrlToBuilder(it, baseUrl)
                    .path("zaakobjecten")
                    .queryParam("zaak", zaakUrl)
                    .queryParam("object", objectUrl)
                    .build()
            }
            .retrieve()
            .body<Page<ZaakObject>>()!!

        if (result.results.isNotEmpty()) {
            outboxService.send { ZaakObjectViewed(objectMapper.valueToTree(result.results.first())) }
        }
        return result.results.firstOrNull()
    }


    fun getZaakInformatieObjecten(
        authentication: ZakenApiAuthentication,
        caseDocumentId: UUID?,
        baseUrl: URI,
        zaakUrl: URI? = null,
        informatieobjectUrl: URI? = null,
    ): List<ZaakInformatieObject> {
        if (!authorizationService.hasPermission(
                EntityAuthorizationRequest(
                    ZgwDocument::class.java,
                    ZgwDocumentActionProvider.VIEW_LIST,
                    ZgwDocument(caseDocumentId = caseDocumentId)
                )
            )
        ) {
            return emptyList()
        }

        val result = buildRestClient(authentication)
            .get()
            .uri {
                ClientTools.baseUrlToBuilder(it, baseUrl)
                    .path("zaakinformatieobjecten").also {
                        zaakUrl?.let { url ->
                            it.queryParam("zaak", url)
                        }
                    }.also {
                        informatieobjectUrl?.let { url ->
                            it.queryParam("informatieobject", url)
                        }
                    }
                    .build()
            }
            .retrieve()
            .body<List<ZaakInformatieObject>>()!!

        outboxService.send { ZaakInformatieObjectenListed(objectMapper.valueToTree(result)) }
        return result
    }

    fun getZaakRollen(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        zaakUrl: URI,
        page: Int,
        roleType: RolType? = null
    ): Page<Rol> {
        val result = buildRestClient(authentication)
            .get()
            .uri {
                ClientTools.baseUrlToBuilder(it, baseUrl)
                    .path("rollen")
                    .queryParam("page", page)
                    .queryParam("zaak", zaakUrl)
                    .apply {
                        if (roleType != null) {
                            queryParam("omschrijvingGeneriek", roleType.getApiValue())
                        }
                    }
                    .build()
            }
            .retrieve()
            .body<Page<Rol>>()!!

        outboxService.send { ZaakRollenListed(objectMapper.valueToTree(result.results)) }
        return result
    }

    fun createZaakRol(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        rol: Rol
    ): Rol {
        val result = buildRestClient(authentication)
            .post()
            .uri {
                ClientTools.baseUrlToBuilder(it, baseUrl)
                    .path("rollen")
                    .build()
            }
            .body(rol)
            .retrieve()
            .body<Rol>()!!

        outboxService.send {
            ZaakRolCreated(result.url.toString(), objectMapper.valueToTree(result))
        }
        return result
    }

    fun deleteZaakRol(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        rolUuid: UUID,
    ) {
        buildRestClient(authentication)
            .delete()
            .uri {
                ClientTools.baseUrlToBuilder(it, baseUrl)
                    .pathSegment("rollen", "{rolUuid}")
                    .build(rolUuid)
            }
            .retrieve()
            .toBodilessEntity()

        val event = ZaakRolDeleted(zaakRolUuid = rolUuid.toString())
        outboxService.send { event }
    }

    fun updateZaakRol(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        rolUuid: UUID,
        rol: Rol
    ): Rol {
        val result = buildRestClient(authentication)
            .put()
            .uri {
                ClientTools.baseUrlToBuilder(it, baseUrl)
                    .pathSegment("rollen", "{rolUuid}")
                    .build(rolUuid)
            }
            .body(rol)
            .retrieve()
            .body<Rol>() ?: throw ZaakRolNotUpdatedException("No body was returned when updating rol($rolUuid)")

        outboxService.send {
            ZaakRolUpdated(result.url.toString(), objectMapper.valueToTree(result))
        }

        return result
    }

    fun createZaak(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        request: CreateZaakRequest,
    ): ZaakResponse {
        val result = buildRestClient(authentication)
            .post()
            .uri {
                ClientTools.baseUrlToBuilder(it, baseUrl)
                    .path("zaken")
                    .build()
            }
            .headers(this::defaultHeaders)
            .contentType(MediaType.APPLICATION_JSON)
            .body(request)
            .retrieve()
            .body<ZaakResponse>()!!

        outboxService.send { ZaakCreated(result.url.toString(), objectMapper.valueToTree(result)) }
        return result
    }

    fun patchZaak(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        zaakUrl: URI,
        request: PatchZaakRequest,
    ): ZaakResponse {
        validateUrlHost(baseUrl, zaakUrl)
        val result = buildRestClient(authentication)
            .patch()
            .uri(zaakUrl)
            .headers(this::defaultHeaders)
            .contentType(MediaType.APPLICATION_JSON)
            .body(request)
            .retrieve()
            .body<ZaakResponse>()!!
        outboxService.send { ZaakPatched(result.url.toString(), objectMapper.valueToTree(result)) }
        return result
    }

    fun createZaakStatus(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        request: CreateZaakStatusRequest,
    ): CreateZaakStatusResponse {
        val result = buildRestClient(authentication)
            .post()
            .uri {
                ClientTools.baseUrlToBuilder(it, baseUrl)
                    .path("statussen")
                    .build()
            }
            .headers(this::defaultHeaders)
            .contentType(MediaType.APPLICATION_JSON)
            .body(request)
            .retrieve()
            .body<CreateZaakStatusResponse>()!!

        outboxService.send { ZaakStatusCreated(result.url.toString(), objectMapper.valueToTree(result)) }
        return result
    }

    fun getZaakStatus(
        authentication: ZakenApiAuthentication,
        zaakStatusUrl: URI,
    ): ZaakStatus {
        val result = buildRestClient(authentication)
            .get()
            .uri(zaakStatusUrl)
            .retrieve()
            .body<ZaakStatus>()!!

        outboxService.send { ZaakStatusViewed(objectMapper.valueToTree(result)) }
        return result
    }

    fun getZaakResultaat(
        authentication: ZakenApiAuthentication,
        zaakResultaatUrl: URI,
    ): ZaakResultaat {
        val result = buildRestClient(authentication)
            .get()
            .uri(zaakResultaatUrl)
            .retrieve()
            .body<ZaakResultaat>()!!

        outboxService.send { ZaakResultaatViewed(objectMapper.valueToTree(result)) }
        return result
    }

    fun getAllZaakResultaten(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        request: GetZaakResultatenRequest
    ): Page<ZaakResultaat> {
        val result = buildRestClient(authentication)
            .get()
            .uri {
                ClientTools.baseUrlToBuilder(it, baseUrl)
                    .path("resultaten")
                    .apply {
                        request.page?.let { page -> queryParam("page", page) }
                        request.pageSize?.let { pageSize -> queryParam("pageSize", pageSize) }
                        request.resultaattype?.let { resultaattype -> queryParam("resultaattype", resultaattype) }
                        queryParam("zaak", request.zaak)
                    }
                    .build()
            }
            .retrieve()
            .body<Page<ZaakResultaat>>()!!

        // There can only be one ZaakResultaat for a given Zaak but the API returns a list, so we log an event for each ZaakResultaat that is returned even though in practice there should only be one.
        result.results.forEach {
            outboxService.send { ZaakResultaatViewed(objectMapper.valueToTree(it)) }
        }

        return result
    }

    fun createZaakResultaat(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        request: CreateZaakResultaatRequest,
    ): CreateZaakResultaatResponse {
        val result = buildRestClient(authentication)
            .post()
            .uri {
                ClientTools.baseUrlToBuilder(it, baseUrl)
                    .path("resultaten")
                    .build()
            }
            .headers(this::defaultHeaders)
            .contentType(MediaType.APPLICATION_JSON)
            .body(request)
            .retrieve()
            .body<CreateZaakResultaatResponse>()!!

        outboxService.send { ZaakResultaatCreated(result.url.toString(), objectMapper.valueToTree(result)) }
        return result
    }

    fun deleteZaakResultaat(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        resultaatUuid: UUID,
    ) {
        buildRestClient(authentication)
            .delete()
            .uri {
                ClientTools.baseUrlToBuilder(it, baseUrl)
                    .pathSegment("resultaten", "{resultaatUuid}")
                    .build(resultaatUuid)
            }
            .retrieve()
            .toBodilessEntity()

        val event = ZaakResultaatDeleted(resultaatUuid.toString())
        outboxService.send { event }
    }

    fun setZaakOpschorting(
        authentication: ZakenApiAuthentication,
        url: URI,
        request: ZaakopschortingRequest,
    ): ZaakopschortingResponse {
        val result = buildRestClient(authentication)
            .patch()
            .uri { url }
            .headers(this::defaultHeaders)
            .contentType(MediaType.APPLICATION_JSON)
            .body(request)
            .retrieve()
            .body<ZaakopschortingResponse>()!!

        outboxService.send { ZaakOpschortingUpdated(result.url, objectMapper.valueToTree(result)) }
        return result
    }

    fun getZaak(authentication: ZakenApiAuthentication, zaakUrl: URI): ZaakResponse {
        val result = buildRestClient(authentication)
            .get()
            .uri(zaakUrl)
            .headers(this::defaultHeaders)
            .retrieve()
            .body<ZaakResponse>()!!

        outboxService.send {
            ZaakViewed(
                result.url.toString(),
                objectMapper.valueToTree(result)
            )
        }
        return result
    }

    fun createZaakeigenschap(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        request: CreateZaakeigenschapRequest,
    ): ZaakeigenschapResponse {
        validateUrlHost(baseUrl, request.zaak)
        val result = buildRestClient(authentication)
            .post()
            .uri {
                ClientTools.baseUrlToBuilder(it, request.zaak)
                    .pathSegment("zaakeigenschappen")
                    .build()
            }
            .headers(this::defaultHeaders)
            .contentType(MediaType.APPLICATION_JSON)
            .body(request)
            .retrieve()
            .body<ZaakeigenschapResponse>()!!

        outboxService.send {
            ZaakeigenschapCreated(
                result.url.toString(),
                objectMapper.valueToTree(result)
            )
        }
        return result
    }

    fun updateZaakeigenschap(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        zaakeigenschapUrl: URI,
        request: UpdateZaakeigenschapRequest,
    ): ZaakeigenschapResponse {
        validateUrlHost(baseUrl, zaakeigenschapUrl)
        validateUrlHost(baseUrl, request.zaak)
        val result = buildRestClient(authentication)
            .put()
            .uri(zaakeigenschapUrl)
            .headers(this::defaultHeaders)
            .contentType(MediaType.APPLICATION_JSON)
            .body(request)
            .retrieve()
            .body<ZaakeigenschapResponse>()!!

        outboxService.send {
            ZaakeigenschapUpdated(
                result.url.toString(),
                objectMapper.valueToTree(result)
            )
        }
        return result
    }

    fun deleteZaakeigenschap(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        zaakeigenschapUrl: URI,
    ) {
        validateUrlHost(baseUrl, zaakeigenschapUrl)
        buildRestClient(authentication)
            .delete()
            .uri(zaakeigenschapUrl)
            .headers(this::defaultHeaders)
            .retrieve()
            .toBodilessEntity()

        outboxService.send {
            ZaakeigenschapDeleted(zaakeigenschapUrl.toString())
        }
    }

    fun getZaakeigenschappen(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        zaakUrl: URI,
    ): List<ZaakeigenschapResponse> {
        validateUrlHost(baseUrl, zaakUrl)
        val result = buildRestClient(authentication)
            .get()
            .uri {
                ClientTools.baseUrlToBuilder(it, zaakUrl)
                    .pathSegment("zaakeigenschappen")
                    .build()
            }
            .retrieve()
            .body<List<ZaakeigenschapResponse>>()!!

        outboxService.send {
            ZaakeigenschapListed(objectMapper.valueToTree(result))
        }
        return result
    }

    fun getZaakbesluiten(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        zaakUrl: URI,
    ): List<ZaakbesluitResponse> {
        validateUrlHost(baseUrl, zaakUrl)
        val result = buildRestClient(authentication)
            .get()
            .uri {
                ClientTools.baseUrlToBuilder(it, zaakUrl)
                    .pathSegment("besluiten")
                    .build()
            }
            .retrieve()
            .body<List<ZaakbesluitResponse>>()!!

        outboxService.send {
            ZaakbesluitenListed(objectMapper.valueToTree(result))
        }
        return result
    }

    fun deleteZaakInformatieObject(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        zaakInformatieobjectUrl: URI,
        caseDocumentId: UUID?
    ) {
        require(zaakInformatieobjectUrl.toString().startsWith(baseUrl.toString())) {
            "zaakInformatieobjectUrl '$zaakInformatieobjectUrl' does not start with baseUrl '$baseUrl'"
        }
        if (authorizationEnabled) {
            authorizationService.requirePermission(
                EntityAuthorizationRequest(
                    ZgwDocument::class.java,
                    ZgwDocumentActionProvider.DELETE,
                    ZgwDocument(caseDocumentId = caseDocumentId)
                )
            )
        }

        buildRestClient(authentication)
            .delete()
            .uri(zaakInformatieobjectUrl)
            .retrieve()
            .toBodilessEntity()
    }

    fun deleteZaakObject(authentication: ZakenApiAuthentication, baseUrl: URI, zaakObjectUrl: URI) {
        require(zaakObjectUrl.toString().startsWith(baseUrl.toString())) {
            "zaakObjectUrl '$zaakObjectUrl' does not start with baseUrl '$baseUrl'"
        }
        buildRestClient(authentication)
            .delete()
            .uri(zaakObjectUrl)
            .retrieve()
            .toBodilessEntity()
    }

    fun deleteZaak(authentication: ZakenApiAuthentication, baseUrl: URI, zaakUrl: URI) {
        require(zaakUrl.toString().startsWith(baseUrl.toString())) {
            "zaakUrl '$zaakUrl' does not start with baseUrl '$baseUrl'"
        }
        buildRestClient(authentication)
            .delete()
            .uri(zaakUrl)
            .retrieve()
            .toBodilessEntity()
    }

    @Deprecated("Use createZaakObject(ZakenApiAuthentication, URI, com.ritense.zakenapi.domain.zaakobjectrequest.ZaakObjectRequest) instead.")
    fun createZaakObject(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        request: com.ritense.zakenapi.domain.ZaakObjectRequest
    ): ZaakObject {
        val convertedRequest: ZaakObjectRequest = if (request.objectType == ZaakObjectType.OVERIGE.value) {
            ZaakObjectOverigeRequest(
                zaakUrl = request.zaakUrl,
                objectUrl = request.objectUrl,
                objectTypeOverige = request.objectTypeOverige
            )
        } else {
            SimpleZaakObjectRequest(
                zaakUrl = request.zaakUrl,
                objectUrl = request.objectUrl,
                objectType = ZaakObjectType.fromValue(request.objectType)
            )
        }

        return createZaakObject(authentication, baseUrl, convertedRequest)
    }

    fun createZaakObject(
        authentication: ZakenApiAuthentication,
        baseUrl: URI,
        request: ZaakObjectRequest
    ): ZaakObject {
        validateUrlHost(baseUrl, request.zaakUrl)
        requireNotNull(request.zaakUrl)

        var result = buildRestClient(authentication)
            .post()
            .uri {
                ClientTools.baseUrlToBuilder(it, baseUrl)
                    .pathSegment("zaakobjecten")
                    .build()
            }
            .headers(this::defaultHeaders)
            .contentType(MediaType.APPLICATION_JSON)
            .body(request)
            .retrieve()
            .body<ZaakObject>()!!

        result = result.copy(objectUrl = result.objectUrl)

        outboxService.send {
            ZaakObjectCreated(result.url.toString(), objectMapper.valueToTree(result))
        }
        return result
    }

    private fun validateUrlHost(baseUrl: URI, url: URI?) {
        if (url != null && baseUrl.host != url.host) {
            throw IllegalArgumentException(
                "Requested url '$url' is not valid for baseUrl '$baseUrl'"
            )
        }
    }

    private fun defaultHeaders(headers: HttpHeaders) {
        headers.set("Accept-Crs", "EPSG:4326")
        headers.set("Content-Crs", "EPSG:4326")
    }

    private fun buildRestClient(authentication: ZakenApiAuthentication): RestClient {
        return restClientBuilder
            .clone()
            .apply {
                authentication.applyAuth(it)
            }
            .build()
    }

    companion object {
        private val logger: KLogger = KotlinLogging.logger {}
    }
}
