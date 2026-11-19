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
import com.ritense.objectenapi.client.ObjectRecord
import com.ritense.objectenapi.client.ObjectRequest
import com.ritense.objectenapi.client.ObjectWrapper
import com.ritense.objectenapi.client.ObjectenApiClient
import com.ritense.objectenapi.client.ObjectsList
import com.ritense.objectenapi.exception.ObjectUrlNotAllowedException
import com.ritense.plugin.annotation.Plugin
import com.ritense.plugin.annotation.PluginAction
import com.ritense.plugin.annotation.PluginActionProperty
import com.ritense.plugin.annotation.PluginProperty
import com.ritense.plugin.domain.PluginDependency
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.contract.validation.Url
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.domain.Pageable
import org.springframework.http.HttpStatus
import org.springframework.web.util.UriComponentsBuilder
import java.net.URI
import java.util.UUID

@Plugin(
    key = "objectenapi",
    title = "Objecten API",
    description = "Connects to the Objecten API",
    dependencies = [PluginDependency.ZAAK_INSTANCE_LINK]
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
            if (!belongsToObjectenApi(objectUrl)) {
                throw IllegalStateException("Failed to delete object with url '$objectUrl'. Object isn't part of Objecten API with url '$url'.")
            }

            logger.info { "Deleting Objecten API object with url '$objectUrl'" }

            return objectenApiClient.deleteObject(authenticationPluginConfiguration, objectUrl)
        }
    }

    fun getObject(objectUrl: URI): ObjectWrapper {
        requireObjectUrlBelongsToObjectenApi(objectUrl)
        withLoggingContext("objectUrl" to objectUrl.toString()) {
            logger.debug { "Getting Objecten API object with url '$objectUrl'" }
            return objectenApiClient.getObject(authenticationPluginConfiguration, objectUrl)
        }
    }

    fun getObjectRecord(objectUrl: URI, index: Int): ObjectRecord {
        requireObjectUrlBelongsToObjectenApi(objectUrl)
        withLoggingContext("objectUrl" to objectUrl.toString()) {
            logger.debug { "Getting Objecten API object with url '$objectUrl' and index '$index'" }
            return objectenApiClient.getObjectRecord(authenticationPluginConfiguration, objectUrl, index)
        }
    }

    fun getObjectsByObjectTypeId(
        objecttypesApiUrl: URI,
        objectsApiUrl: URI,
        objecttypeId: String,
        ordering: String? = "",
        pageable: Pageable
    ): ObjectsList {
        logger.debug { "Getting Objecten API objects of type '$objecttypeId', page '${pageable.pageNumber}'" }
        return objectenApiClient.getObjectsByObjecttypeUrl(
            authentication = authenticationPluginConfiguration,
            objecttypesApiUrl = objecttypesApiUrl,
            objectsApiUrl = objectsApiUrl,
            objectypeId = objecttypeId,
            ordering = ordering,
            pageable = pageable
        )
    }

    fun getObjectsByObjectTypeIdWithSearchParams(
        objecttypesApiUrl: URI,
        objecttypeId: String,
        searchString: String,
        ordering: String? = "",
        pageable: Pageable
    ): ObjectsList {
        logger.debug { "Searching Objecten API objects of type '$objecttypeId', page '${pageable.pageNumber}', searchString '$searchString'" }
        return objectenApiClient.getObjectsByObjecttypeUrlWithSearchParams(
            authentication = authenticationPluginConfiguration,
            objecttypesApiUrl = objecttypesApiUrl,
            objectsApiUrl = url,
            objectypeId = objecttypeId,
            searchString = searchString,
            ordering = ordering,
            pageable = pageable
        )
    }

    fun objectUpdate(objectUrl: URI, objectRequest: ObjectRequest): ObjectWrapper {
        requireObjectUrlBelongsToObjectenApi(objectUrl)
        logger.info { "Updating Objecten API object with url '$objectUrl'" }
        return objectenApiClient.objectUpdate(authenticationPluginConfiguration, objectUrl, objectRequest)
    }

    fun objectPatch(objectUrl: URI, objectRequest: ObjectRequest): ObjectWrapper {
        requireObjectUrlBelongsToObjectenApi(objectUrl)
        logger.info { "Patching Objecten API object with url '$objectUrl'" }
        return objectenApiClient.objectPatch(authenticationPluginConfiguration, objectUrl, objectRequest)
    }

    fun createObject(objectRequest: ObjectRequest): ObjectWrapper {
        logger.info { "Creating Objecten API object of type '${objectRequest.type}'" }
        return objectenApiClient.createObject(authenticationPluginConfiguration, url, objectRequest)
    }

    fun getObjectUrl(objectId: UUID): URI {
        return UriComponentsBuilder
            .fromUri(url)
            .pathSegment("objects")
            .pathSegment(objectId.toString())
            .build()
            .toUri()
    }

    fun belongsToObjectenApi(objectUrl: URI): Boolean = isUrlOfObjectenApi(url, objectUrl)

    private fun requireObjectUrlBelongsToObjectenApi(objectUrl: URI) {
        if (!belongsToObjectenApi(objectUrl)) {
            throw ObjectUrlNotAllowedException("Object url '$objectUrl' does not belong to Objecten API with url '$url'")
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}

        const val URL_PROPERTY = "url"

        fun findConfigurationByUrl(url: URI) = { properties: JsonNode ->
            val baseUrl = properties[URL_PROPERTY]?.textValue()
                ?.let { runCatching { URI(it) }.getOrNull() }
            baseUrl != null && isUrlOfObjectenApi(baseUrl, url)
        }

        fun isUrlOfObjectenApi(baseUrl: URI, objectUrl: URI): Boolean {
            if (baseUrl.isOpaque || objectUrl.isOpaque) return false
            if (baseUrl.scheme == null || baseUrl.host == null || objectUrl.scheme == null || objectUrl.host == null) {
                return false
            }
            if (!baseUrl.scheme.equals(objectUrl.scheme, ignoreCase = true)) return false
            if (!baseUrl.host.equals(objectUrl.host, ignoreCase = true)) return false
            if (effectivePort(baseUrl) != effectivePort(objectUrl)) return false
            if (objectUrl.rawUserInfo != null && objectUrl.rawUserInfo != baseUrl.rawUserInfo) return false

            val objectPath = objectUrl.path.orEmpty()
            if (objectPath.split('/').any { it == ".." }) return false
            val normalizedPath = objectUrl.normalize().path.orEmpty()
            val basePath = baseUrl.normalize().path.orEmpty().trimEnd('/')
            return normalizedPath == basePath || normalizedPath.startsWith("$basePath/")
        }

        private fun effectivePort(uri: URI): Int = when {
            uri.port != -1 -> uri.port
            uri.scheme.equals("https", ignoreCase = true) -> 443
            uri.scheme.equals("http", ignoreCase = true) -> 80
            else -> -1
        }
    }
}
