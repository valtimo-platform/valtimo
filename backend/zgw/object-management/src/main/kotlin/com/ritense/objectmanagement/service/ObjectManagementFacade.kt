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

package com.ritense.objectmanagement.service

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.objectenapi.ObjectenApiPlugin
import com.ritense.objectenapi.client.ObjectWrapper
import com.ritense.objectenapi.client.ObjectsList
import com.ritense.objectenapi.client.dto.TypedObjectRecord
import com.ritense.objectenapi.client.dto.TypedObjectRequest
import com.ritense.objectenapi.client.dto.TypedObjectWrapper
import com.ritense.objectenapi.client.dto.TypedObjectsPage
import com.ritense.objectenapi.client.toObjectWrapper
import com.ritense.objectenapi.client.toObjectsList
import com.ritense.objectmanagement.domain.ObjectManagement
import com.ritense.objectmanagement.repository.ObjectManagementRepository
import com.ritense.objecttypenapi.ObjecttypenApiPlugin
import com.ritense.plugin.service.PluginService
import mu.KotlinLogging
import org.springframework.data.domain.PageRequest
import org.springframework.http.HttpStatus
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClientResponseException
import java.net.URI
import java.time.LocalDate
import java.util.UUID

class ObjectManagementFacade(
    private val objectManagementRepository: ObjectManagementRepository,
    private val pluginService: PluginService
) {
    fun getObjectByUuid(
        objectName: String,
        uuid: UUID
    ): ObjectWrapper {
        return getObjectByUuid(objectName = objectName, uuid = uuid, type = JsonNode::class.java).toObjectWrapper()
    }

    fun <T> getObjectByUuid(
        objectName: String,
        uuid: UUID,
        type: Class<T>
    ): TypedObjectWrapper<T> {
        logger.debug { "Get object by UUID objectName=$objectName uuid=$uuid" }
        val accessObject = getAccessObject(objectName)
        return findObjectByUuid(accessObject = accessObject, uuid = uuid, type = type)
    }

    fun getObjectsByUuids(
        objectName: String,
        uuids: List<UUID>
    ): ObjectsList {
        return getObjectsByUuids(objectName = objectName, uuids = uuids, type = JsonNode::class.java).toObjectsList()
    }

    fun <T> getObjectsByUuids(
        objectName: String,
        uuids: List<UUID>,
        type: Class<T>
    ): TypedObjectsPage<T> {
        logger.debug { "Get object by UUIDs objectName=$objectName uuids=$uuids" }
        val accessObject = getAccessObject(objectName)
        val objects = uuids.map {
            findObjectByUuid(accessObject = accessObject, uuid = it, type = type)
        }
        return TypedObjectsPage(count = objects.size, results = objects)
    }

    fun getObjectByUri(
        objectName: String,
        objectUrl: URI
    ): ObjectWrapper {
        return getObjectByUri(objectName = objectName, objectUrl = objectUrl, JsonNode::class.java).toObjectWrapper()
    }

    fun <T> getObjectByUri(
        objectName: String,
        objectUrl: URI,
        type: Class<T>
    ): TypedObjectWrapper<T> {
        logger.debug { "Get object by URI objectName=$objectName objectUrl=$objectUrl" }
        val accessObject = getAccessObject(objectName)
        return findObjectByUri(accessObject = accessObject, objectUrl = objectUrl, type = type)
    }

    fun getObjectsByUris(
        objectName: String,
        objectUrls: List<URI>
    ): ObjectsList {
        return getObjectsByUris(objectName = objectName, objectUrls = objectUrls, type = JsonNode::class.java).toObjectsList()
    }

    fun <T> getObjectsByUris(
        objectName: String,
        objectUrls: List<URI>,
        type: Class<T>
    ): TypedObjectsPage<T> {
        logger.debug { "Get object by URIs objectName=$objectName objectUrls=$objectUrls" }
        val accessObject = getAccessObject(objectName)
        val objects = objectUrls.map {
            findObjectByUri(accessObject = accessObject, objectUrl = it, type = type)
        }
        return TypedObjectsPage(count = objects.size, results = objects)
    }

    fun getObjectsPaged(
        objectName: String,
        searchString: String?,
        pageNumber: Int,
        ordering: String?,
        pageSize: Int
    ): ObjectsList {
        return getObjectsPaged(objectName, searchString, pageNumber, ordering, pageSize, JsonNode::class.java).toObjectsList()
    }

    fun <T> getObjectsPaged(
        objectName: String,
        searchString: String?,
        pageNumber: Int,
        ordering: String?,
        pageSize: Int,
        type: Class<T>
    ): TypedObjectsPage<T> {
        logger.debug {
            "get objects paged objectName=$objectName " +
                "searchString=$searchString, pageNumber=$pageNumber, pageSize=$pageSize"
        }
        val accessObject = getAccessObject(objectName)
        return findObjectsPaged(
            accessObject = accessObject,
            objectName = objectName,
            searchString = searchString,
            ordering = ordering,
            pageNumber = pageNumber,
            pageSize = pageSize,
            type = type
        )
    }

    // Please use this function with caution, as it could result in poor application performance.
    // It is advised to use getObjectsPaged() instead, where possible.
    fun getObjectsUnpaged(
        objectName: String,
        searchString: String?,
        ordering: String?
    ): ObjectsList {
        return getObjectsUnpaged(objectName = objectName, searchString = searchString, ordering = ordering, type = JsonNode::class.java).toObjectsList()
    }

    // Please use this function with caution, as it could result in poor application performance.
    // It is advised to use getObjectsPaged() instead, where possible.
    fun <T> getObjectsUnpaged(
        objectName: String,
        searchString: String?,
        ordering: String?,
        type: Class<T>
    ): TypedObjectsPage<T> {
        logger.debug { "get objects unpaged objectName=$objectName searchString=$searchString" }
        val accessObject = getAccessObject(objectName)

        val all = TypedObjectsPage.getAll { pageNumber ->
            findObjectsPaged(
                accessObject = accessObject,
                objectName = objectName,
                searchString = searchString,
                ordering = ordering,
                pageNumber = pageNumber,
                pageSize = 500,
                type = type
            )
        }

        return TypedObjectsPage(count = all.size, results = all)
    }

    fun createObject(
        objectName: String,
        data: JsonNode,
        objectId: UUID? = null
    ): ObjectWrapper {
        return createObject(objectName, data, objectId, JsonNode::class.java).toObjectWrapper()
    }

    fun <T> createObject(
        objectName: String,
        data: T,
        objectId: UUID? = null,
        type: Class<T>
    ): TypedObjectWrapper<T> {
        logger.info { "Create object objectName=$objectName objectId=$objectId" }
        val accessObject = getAccessObject(objectName)
        val objectTypeUrl = accessObject.objectTypenApiPlugin.getObjectTypeUrlById(
            accessObject.objectManagement.objecttypeId
        )

        val objectRequest = TypedObjectRequest(
            uuid = objectId,
            type = objectTypeUrl,
            record = TypedObjectRecord(
                typeVersion = accessObject.objectManagement.objecttypeVersion,
                data = data,
                startAt = LocalDate.now()
            )
        )

        try {
            return accessObject.objectenApiPlugin.createObject(objectRequest, type)
        } catch (ex: RestClientResponseException) {
            throw Exception("Exception thrown while making a call to the Objects API. Response from the API: ${ex.responseBodyAsString}")
        }
    }

    fun updateObject(
        objectId: UUID,
        objectName: String,
        data: JsonNode,
    ): ObjectWrapper {
        return updateObject(objectId, objectName, data, JsonNode::class.java).toObjectWrapper()
    }

    fun <T> updateObject(
        objectId: UUID,
        objectName: String,
        data: T,
        type: Class<T>
    ): TypedObjectWrapper<T> {
        logger.info { "Update object objectId=$objectId objectName=$objectName" }
        val accessObject = getAccessObject(objectName)
        val objectTypeUrl = accessObject.objectTypenApiPlugin.getObjectTypeUrlById(
            accessObject.objectManagement.objecttypeId
        )

        val objectRequest = TypedObjectRequest(
            objectTypeUrl,
            TypedObjectRecord(
                typeVersion = accessObject.objectManagement.objecttypeVersion,
                data = data,
                startAt = LocalDate.now()
            )
        )

        try {
            val objectUrl = accessObject.objectenApiPlugin.getObjectUrl(objectId)
            return accessObject.objectenApiPlugin
                .updateObject(
                    objectUrl = objectUrl,
                    objectRequest = objectRequest,
                    type = type
                )
        } catch (ex: RestClientResponseException) {
            throw Exception("Error while updating object ${objectId}. Response from Objects API: ${ex.responseBodyAsString}")
        }
    }

    fun deleteObject(
        objectName: String,
        objectId: UUID
    ): HttpStatus {
        val accessObject = getAccessObject(objectName)

        try {
            logger.trace { "Deleting object '$objectId' of type '${accessObject.objectManagement.objecttypeId}' from Objecten API using plugin ${accessObject.objectManagement.objectenApiPluginConfigurationId}" }
            return accessObject.objectenApiPlugin.deleteObject(
                accessObject.objectenApiPlugin.getObjectUrl(objectId)
            )
        } catch (ex: HttpClientErrorException) {
            throw IllegalStateException("Error while deleting object $objectId. Response from Objects API: ${ex.responseBodyAsString}", ex)
        }
    }

    private fun getAccessObject(objectName: String): ObjectManagementAccessObject {
        logger.debug { "Get access object objectName=$objectName" }
        val objectManagement = objectManagementRepository.findByTitle(objectName)
            ?: throw NoSuchElementException("Object type $objectName is not found in Object Management.")
        val objectenApiPlugin =
            pluginService.createInstance<ObjectenApiPlugin>(objectManagement.objectenApiPluginConfigurationId)
        val objectTypenApiPlugin =
            pluginService.createInstance<ObjecttypenApiPlugin>(objectManagement.objecttypenApiPluginConfigurationId)

        return ObjectManagementAccessObject(
            objectManagement,
            objectenApiPlugin,
            objectTypenApiPlugin
        )
    }

    private fun <T> findObjectByUuid(
        accessObject: ObjectManagementAccessObject,
        uuid: UUID,
        type: Class<T>
    ): TypedObjectWrapper<T> {
        logger.debug { "Find object by uuid accessObject=$accessObject uuid=$uuid" }
        val objectUrl = accessObject.objectenApiPlugin.getObjectUrl(uuid)

        logger.trace { "Getting object $objectUrl" }
        return accessObject.objectenApiPlugin.getObject(objectUrl = objectUrl, type = type)
    }

    private fun <T> findObjectByUri(
        accessObject: ObjectManagementAccessObject,
        objectUrl: URI,
        type: Class<T>
    ): TypedObjectWrapper<T> {
        logger.debug { "Getting object $objectUrl" }
        return accessObject.objectenApiPlugin.getObject(objectUrl = objectUrl, type = type)
    }

    private fun <T> findObjectsPaged(
        accessObject: ObjectManagementAccessObject,
        objectName: String,
        searchString: String?,
        ordering: String? = "",
        pageNumber: Int,
        pageSize: Int,
        type: Class<T>,
    ): TypedObjectsPage<T> {
        return if (!searchString.isNullOrBlank()) {
            logger.debug { "Getting object page for object type $objectName with search string $searchString" }

            accessObject.objectenApiPlugin.getObjectsByObjectTypeIdWithSearchParams(
                objecttypesApiUrl = accessObject.objectTypenApiPlugin.url,
                objecttypeId = accessObject.objectManagement.objecttypeId,
                searchString = searchString,
                ordering = ordering,
                pageable = PageRequest.of(pageNumber, pageSize),
                type = type
            )
        } else {
            logger.debug { "Getting object page for object type $objectName" }

            accessObject.objectenApiPlugin.getObjectsByObjectTypeId(
                objecttypesApiUrl = accessObject.objectTypenApiPlugin.url,
                objectsApiUrl = accessObject.objectenApiPlugin.url,
                objecttypeId = accessObject.objectManagement.objecttypeId,
                ordering = ordering,
                pageable = PageRequest.of(pageNumber, pageSize),
                type = type
            )
        }
    }

    private data class ObjectManagementAccessObject(
        val objectManagement: ObjectManagement,
        val objectenApiPlugin: ObjectenApiPlugin,
        val objectTypenApiPlugin: ObjecttypenApiPlugin
    )

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
