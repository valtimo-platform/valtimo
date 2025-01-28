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

package com.ritense.objectenapi

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.logging.withLoggingContext
import com.ritense.objectenapi.client.ObjectRequest
import com.ritense.objectenapi.client.ObjectWrapper
import com.ritense.objectenapi.client.ObjectenApiClient
import com.ritense.objectenapi.client.ObjectsList
import com.ritense.objectenapi.client.dto.TypedObjectRequest
import com.ritense.objectenapi.client.dto.TypedObjectWrapper
import com.ritense.objectenapi.client.dto.TypedObjectsPage
import com.ritense.objectenapi.client.toObjectWrapper
import com.ritense.objectenapi.client.toObjectsList
import com.ritense.plugin.annotation.Plugin
import com.ritense.plugin.annotation.PluginAction
import com.ritense.plugin.annotation.PluginActionProperty
import com.ritense.plugin.annotation.PluginProperty
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.contract.validation.Url
import mu.KLogger
import mu.KotlinLogging
import org.springframework.data.domain.Pageable
import org.springframework.http.HttpStatus
import org.springframework.web.util.UriComponentsBuilder
import java.net.URI
import java.util.UUID

@Plugin(
    key = "objectenapi",
    title = "Objecten API",
    description = "Connects to the Objecten API"
)
class ObjectenApiPlugin(
    private val objectenApiClient: ObjectenApiClient
) {
    @Url
    @PluginProperty(key = "url", secret = false)
    lateinit var url: URI

    @PluginProperty(key = "authenticationPluginConfiguration", secret = false)
    lateinit var authenticationPluginConfiguration: ObjectenApiAuthentication

    @PluginAction(
        key = "delete-object",
        title = "Delete object",
        description = "Delete an object from the Objecten API",
        activityTypes = [ActivityTypeWithEventName.SERVICE_TASK_START]
    )
    fun deleteObject(@PluginActionProperty objectUrl: URI): HttpStatus {
        withLoggingContext("objectUrl" to objectUrl.toString()) {
            if (!objectUrl.toASCIIString().startsWith(url.toASCIIString())) {
                throw IllegalStateException("Failed to delete object with url '$objectUrl'. Object isn't part of Objecten API with url '$url'.")
            }

            logger.info { "Deleting Objecten API object with url '$objectUrl'" }

            return objectenApiClient.deleteObject(authenticationPluginConfiguration, objectUrl)
        }
    }

    fun getObject(objectUrl: URI): ObjectWrapper {
        return getObject(
            objectUrl = objectUrl,
            type = JsonNode::class.java
        ).toObjectWrapper()
    }

    fun <T> getObject(
        objectUrl: URI,
        type: Class<T>,
    ): TypedObjectWrapper<T> {
        withLoggingContext("objectUrl" to objectUrl.toString()) {
            logger.debug { "Getting Objecten API object with url '$objectUrl'" }
            return objectenApiClient.getObject(
                authentication = authenticationPluginConfiguration,
                objectUrl = objectUrl,
                type = type
            )
        }
    }

    fun getObjectsByObjectTypeId(
        objecttypesApiUrl: URI,
        objectsApiUrl: URI,
        objecttypeId: String,
        ordering: String? = "",
        pageable: Pageable
    ): ObjectsList {
        return getObjectsByObjectTypeId(
                objecttypesApiUrl = objecttypesApiUrl,
                objectsApiUrl = objectsApiUrl,
                objecttypeId = objecttypeId,
                ordering = ordering,
                pageable = pageable,
                type = JsonNode::class.java
            ).toObjectsList()
    }

    fun <T> getObjectsByObjectTypeId(
        objecttypesApiUrl: URI,
        objectsApiUrl: URI,
        objecttypeId: String,
        ordering: String? = "",
        pageable: Pageable,
        type: Class<T>
    ): TypedObjectsPage<T> {
        logger.debug { "Getting Objecten API objects of type '$objecttypeId', page '${pageable.pageNumber}'" }
        return objectenApiClient.getObjectsByObjecttypeUrl(
            authentication = authenticationPluginConfiguration,
            objecttypesApiUrl = objecttypesApiUrl,
            objectsApiUrl = objectsApiUrl,
            objectypeId = objecttypeId,
            ordering = ordering,
            pageable = pageable,
            type = type
        )
    }

    fun getObjectsByObjectTypeIdWithSearchParams(
        objecttypesApiUrl: URI,
        objecttypeId: String,
        searchString: String,
        ordering: String? = "",
        pageable: Pageable
    ): ObjectsList {
        return getObjectsByObjectTypeIdWithSearchParams(
            objecttypesApiUrl = objecttypesApiUrl,
            objecttypeId = objecttypeId,
            searchString = searchString,
            ordering = ordering,
            pageable = pageable,
            type = JsonNode::class.java
        ).toObjectsList()
    }

    fun <T> getObjectsByObjectTypeIdWithSearchParams(
        objecttypesApiUrl: URI,
        objecttypeId: String,
        searchString: String,
        ordering: String? = "",
        pageable: Pageable,
        type: Class<T>
    ): TypedObjectsPage<T> {
        logger.debug { "Searching Objecten API objects of type '$objecttypeId', page '${pageable.pageNumber}', searchString '$searchString'" }
        return objectenApiClient.getObjectsByObjecttypeUrlWithSearchParams(
            authentication = authenticationPluginConfiguration,
            objecttypesApiUrl = objecttypesApiUrl,
            objectsApiUrl = url,
            objectypeId = objecttypeId,
            searchString = searchString,
            ordering = ordering,
            pageable = pageable,
            type = type
        )
    }

    @Deprecated("Since 12.8.0.", replaceWith = ReplaceWith("updateObject(objectUrl, objectRequest)"))
    fun objectUpdate(
        objectUrl: URI,
        objectRequest: ObjectRequest
    ): ObjectWrapper {
        return updateObject(objectUrl, objectRequest)
    }

    fun updateObject(
        objectUrl: URI,
        objectRequest: ObjectRequest
    ): ObjectWrapper {
        return updateObject(
            objectUrl = objectUrl,
            objectRequest = ObjectRequest.toTyped(objectRequest),
            type = JsonNode::class.java
        ).toObjectWrapper()
    }

    fun <T> updateObject(
        objectUrl: URI,
        objectRequest: TypedObjectRequest<T>,
        type: Class<T>
    ): TypedObjectWrapper<T> {
        logger.info { "Updating Objecten API object with url '$objectUrl'" }
        return objectenApiClient.updateObject(
            authentication = authenticationPluginConfiguration,
            objectUrl = objectUrl,
            objectRequest = objectRequest,
            type = type
        )
    }

    @Deprecated("Since 12.8.0", replaceWith = ReplaceWith("patchObject(objectUrl, objectRequest)"))
    fun objectPatch(
        objectUrl: URI,
        objectRequest: ObjectRequest
    ): ObjectWrapper {
        return patchObject(objectUrl, objectRequest)
    }

    fun patchObject(
        objectUrl: URI,
        objectRequest: ObjectRequest
    ): ObjectWrapper {
        return patchObject(
            objectUrl = objectUrl,
            objectRequest = ObjectRequest.toTyped(objectRequest),
            type = JsonNode::class.java
        ).toObjectWrapper()
    }

    fun <T> patchObject(
        objectUrl: URI,
        objectRequest: TypedObjectRequest<T>,
        type: Class<T>
    ): TypedObjectWrapper<T> {
        logger.info { "Patching Objecten API object with url '$objectUrl'" }
        return objectenApiClient.patchObject(
            authentication = authenticationPluginConfiguration,
            objectUrl = objectUrl,
            objectRequest = objectRequest,
            type
        )
    }

    fun createObject(objectRequest: ObjectRequest): ObjectWrapper {
        return createObject(
            objectRequest = ObjectRequest.toTyped(objectRequest),
            type = JsonNode::class.java
        ).toObjectWrapper()
    }

    fun <T> createObject(
        objectRequest: TypedObjectRequest<T>,
        type: Class<T>
    ): TypedObjectWrapper<T> {
        logger.info { "Creating Objecten API object of type '${objectRequest.type}'" }
        return objectenApiClient.createObject(
            authentication = authenticationPluginConfiguration,
            objectsApiUrl = url,
            objectRequest = objectRequest,
            type = type
        )
    }

    fun getObjectUrl(objectId: UUID): URI {
        return UriComponentsBuilder
            .fromUri(url)
            .pathSegment("objects")
            .pathSegment(objectId.toString())
            .build()
            .toUri()
    }

    companion object {
        private val logger: KLogger = KotlinLogging.logger {}

        const val URL_PROPERTY = "url"

        fun findConfigurationByUrl(url: URI) =
            { properties: JsonNode -> url.toString().startsWith(properties.get(URL_PROPERTY).textValue()) }
    }
}