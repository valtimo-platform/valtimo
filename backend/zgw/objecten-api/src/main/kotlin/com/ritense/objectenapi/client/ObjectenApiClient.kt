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

package com.ritense.objectenapi.client

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.objectenapi.ObjectenApiAuthentication
import com.ritense.objectenapi.client.typed.TypedObjectenApiClient
import com.ritense.outbox.OutboxService
import org.springframework.data.domain.Pageable
import org.springframework.http.HttpStatus
import org.springframework.web.client.RestClient
import java.net.URI

class ObjectenApiClient {

    private val typedObjectenApiClient: TypedObjectenApiClient

    constructor(
        restClientBuilder: RestClient.Builder,
        outboxService: OutboxService,
        objectMapper: ObjectMapper
    ) {
        typedObjectenApiClient = TypedObjectenApiClient(restClientBuilder, outboxService, objectMapper)
    }

    constructor(typedObjectenApiClient: TypedObjectenApiClient) {
        this.typedObjectenApiClient = typedObjectenApiClient
    }

    fun getObject(
        authentication: ObjectenApiAuthentication,
        objectUrl: URI
    ): ObjectWrapper {
        return ObjectWrapper.fromTyped(
            typedObjectenApiClient.getObject(authentication, objectUrl, JsonNode::class.java)
        )
    }

    fun getObjectsByObjecttypeUrl(
        authentication: ObjectenApiAuthentication,
        objecttypesApiUrl: URI,
        objectsApiUrl: URI,
        objectypeId: String,
        ordering: String? = "",
        pageable: Pageable
    ): ObjectsList {
        return ObjectsList.fromTyped(
            typedObjectenApiClient.getObjectsByObjecttypeUrl(
                authentication,
                objecttypesApiUrl,
                objectsApiUrl,
                objectypeId,
                ordering,
                pageable,
                JsonNode::class.java,
            )
        )
    }

    fun getObjectsByObjecttypeUrlWithSearchParams(
        authentication: ObjectenApiAuthentication,
        objecttypesApiUrl: URI,
        objectsApiUrl: URI,
        objectypeId: String,
        searchString: String,
        ordering: String? = "",
        pageable: Pageable
    ): ObjectsList {
        return ObjectsList.fromTyped(
            typedObjectenApiClient.getObjectsByObjecttypeUrlWithSearchParams(
                authentication,
                objecttypesApiUrl,
                objectsApiUrl,
                objectypeId,
                searchString,
                ordering,
                pageable,
                JsonNode::class.java,
            )
        )
    }

    fun createObject(
        authentication: ObjectenApiAuthentication,
        objectsApiUrl: URI,
        objectRequest: ObjectRequest
    ): ObjectWrapper {
        return ObjectWrapper.fromTyped(
            typedObjectenApiClient.createObject(
                authentication,
                objectsApiUrl,
                ObjectRequest.toTyped(objectRequest),
                JsonNode::class.java,
            )
        )
    }

    fun objectPatch(
        authentication: ObjectenApiAuthentication,
        objectUrl: URI,
        objectRequest: ObjectRequest
    ): ObjectWrapper {
        return ObjectWrapper.fromTyped(
            typedObjectenApiClient.objectPatch(
                authentication,
                objectUrl,
                ObjectRequest.toTyped(objectRequest),
                JsonNode::class.java,
            )
        )
    }

    fun objectUpdate(
        authentication: ObjectenApiAuthentication,
        objectUrl: URI,
        objectRequest: ObjectRequest
    ): ObjectWrapper {
        return ObjectWrapper.fromTyped(
            typedObjectenApiClient.objectUpdate(
                authentication,
                objectUrl,
                ObjectRequest.toTyped(objectRequest),
                JsonNode::class.java,
            )
        )
    }

    fun deleteObject(authentication: ObjectenApiAuthentication, objectUrl: URI): HttpStatus {
        return typedObjectenApiClient.deleteObject(
            authentication,
            objectUrl,
        )
    }
}
