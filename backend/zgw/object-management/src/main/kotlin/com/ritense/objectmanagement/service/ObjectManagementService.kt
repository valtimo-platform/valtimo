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

package com.ritense.objectmanagement.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.objectenapi.ObjectenApiPlugin
import com.ritense.objectmanagement.authorization.ObjectManagementActionProvider
import com.ritense.objectenapi.client.Comparator
import com.ritense.objectenapi.client.Comparator.EQUAL_TO
import com.ritense.objectenapi.client.Comparator.GREATER_THAN_OR_EQUAL_TO
import com.ritense.objectenapi.client.Comparator.LOWER_THAN_OR_EQUAL_TO
import com.ritense.objectenapi.client.Comparator.STRING_CONTAINS
import com.ritense.objectenapi.client.ObjectSearchParameter
import com.ritense.objectenapi.client.ObjectWrapper
import com.ritense.objectmanagement.domain.ObjectManagement
import com.ritense.objectmanagement.domain.ObjectsListRowDto
import com.ritense.objectmanagement.domain.search.SearchRequestValue
import com.ritense.objectmanagement.domain.search.SearchWithConfigFilter
import com.ritense.objectmanagement.domain.search.SearchWithConfigRequest
import com.ritense.objectmanagement.repository.ObjectManagementRepository
import com.ritense.objecttypenapi.ObjecttypenApiPlugin
import com.ritense.outbox.OutboxContext.Companion.runWithSuppressedOutbox
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.service.PluginService
import com.ritense.search.domain.DataType.BOOLEAN
import com.ritense.search.domain.DataType.BSN
import com.ritense.search.domain.DataType.DATE
import com.ritense.search.domain.DataType.DATETIME
import com.ritense.search.domain.DataType.NUMBER
import com.ritense.search.domain.DataType.TEXT
import com.ritense.search.domain.DataType.TIME
import com.ritense.search.domain.FieldType.MULTI_SELECT_DROPDOWN
import com.ritense.search.domain.FieldType.RANGE
import com.ritense.search.domain.FieldType.SINGLE
import com.ritense.search.domain.FieldType.SINGLE_SELECT_DROPDOWN
import com.ritense.search.domain.FieldType.TEXT_CONTAINS
import com.ritense.search.domain.LEGACY_OWNER_TYPE
import com.ritense.search.domain.SearchFieldV2
import com.ritense.search.service.SearchFieldV2Service
import com.ritense.search.service.SearchListColumnService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.data.repository.findByIdOrNull
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZonedDateTime
import java.util.UUID

@Transactional(readOnly = true)
@Service
@SkipComponentScan
class ObjectManagementService(
    private val objectManagementRepository: ObjectManagementRepository,
    private val pluginService: PluginService,
    private val searchFieldV2Service: SearchFieldV2Service,
    private val searchListColumnService: SearchListColumnService,
    private val authorizationService: AuthorizationService,
    private val authorizationEnabled: Boolean = false
) {

    @Transactional
    fun create(objectManagement: ObjectManagement): ObjectManagement {
        logger.info { "Create $objectManagement" }
        with(objectManagementRepository.findByTitle(objectManagement.title)) {
            if (this != null) {
                throw ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This title already exists. Please choose another title"
                )
            }
            val result = objectManagementRepository.save(objectManagement)
            return result
        }
    }

    @Transactional
    fun update(objectManagement: ObjectManagement): ObjectManagement {
        logger.info { "Update $objectManagement" }
        with(objectManagementRepository.findByTitle(objectManagement.title)) {
            val result = if (this != null && objectManagement.id != id) {
                objectManagementRepository.save(objectManagement.copy(id = this.id))
            } else {
                objectManagementRepository.save(objectManagement)
            }
            return result
        }
    }

    fun getById(id: UUID): ObjectManagement? {
        val objectManagement = objectManagementRepository.findByIdOrNull(id) ?: return null
        if (authorizationEnabled) {
            authorizationService.requirePermission(
                EntityAuthorizationRequest(ObjectManagement::class.java, ObjectManagementActionProvider.VIEW, objectManagement)
            )
        }
        return objectManagement
    }

    fun getByIdByTitle(title: String): ObjectManagement? = objectManagementRepository.findByTitle(title)

    private fun getObjectManagementForListing(id: UUID): ObjectManagement {
        val objectManagement = objectManagementRepository.findByIdOrNull(id)
            ?: throw IllegalArgumentException("ObjectManagement not found with id: $id")
        if (authorizationEnabled) {
            authorizationService.requirePermission(
                EntityAuthorizationRequest(ObjectManagement::class.java, ObjectManagementActionProvider.VIEW_LIST, objectManagement)
            )
        }
        return objectManagement
    }

    fun getAll(): List<ObjectManagement> {
        return if (authorizationEnabled) {
            val spec = authorizationService.getAuthorizationSpecification(
                EntityAuthorizationRequest(
                    ObjectManagement::class.java,
                    ObjectManagementActionProvider.VIEW_LIST
                ),
                null
            )
            objectManagementRepository.findAll(spec).sortedBy { it.title }
        } else {
            runWithoutAuthorization { objectManagementRepository.findAll().sortedBy { it.title } }
        }
    }

    @Transactional
    fun deleteById(id: UUID) {
        logger.info { "Delete by id=$id" }
        objectManagementRepository.deleteById(id)
    }

    @Transactional
    fun getObjects(id: UUID, pageable: Pageable): PageImpl<ObjectsListRowDto> {
        logger.debug { "Get objects id=$id pageable=$pageable" }
        val objectManagement = getObjectManagementForListing(id)

        return runWithSuppressedOutbox(objectManagement.suppressOutbox) {
            val objectTypePluginInstance = getObjectTypenApiPlugin(objectManagement.objecttypenApiPluginConfigurationId)

            val objectenPluginInstance = getObjectenApiPlugin(objectManagement.objectenApiPluginConfigurationId)

            val objectsList = objectenPluginInstance.getObjectsByObjectTypeId(
                objecttypesApiUrl = objectTypePluginInstance.url,
                objectsApiUrl = objectenPluginInstance.url,
                objecttypeId = objectManagement.objecttypeId,
                pageable = pageable
            )

            val objectsListDto = objectsList.results.map {
                ObjectsListRowDto(
                    it.url.toString(), listOf(
                        ObjectsListRowDto.ObjectsListItemDto("objectUrl", it.url),
                        ObjectsListRowDto.ObjectsListItemDto("recordIndex", it.record.index),
                    )
                )
            }

            PageImpl(objectsListDto, pageable, objectsList.count.toLong())
        }
    }

    @Transactional
    fun getObjectsWithSearchParams(
        searchWithConfigRequest: SearchWithConfigRequest,
        id: UUID,
        pageable: Pageable
    ): PageImpl<ObjectsListRowDto> {
        logger.debug {
            "Get objects with searchParams searchWithConfigRequest=$searchWithConfigRequest id=$id pageable=$pageable"
        }
        val objectManagement = getObjectManagementForListing(id)

        val searchFieldList = searchFieldV2Service.findAllByOwnerTypeAndOwnerId(LEGACY_OWNER_TYPE, id.toString())

        val searchDtoList = searchFieldList.flatMap { searchField ->
            searchWithConfigRequest.otherFilters
                .filter { otherFilter -> otherFilter.key == searchField.key }
                .flatMap { otherFilter -> mapToObjectSearchParameters(searchField, otherFilter) }
        }

        val objectsList = getObjectsWithSearchParams(objectManagement, searchDtoList, pageable)
        val objectsListDto = mapToObjectListRowDto(objectsList.toList(), id)
        return PageImpl(objectsListDto, pageable, objectsList.totalElements)
    }

    fun getObjectsWithSearchParams(
        objectManagement: ObjectManagement,
        searchParameters: List<ObjectSearchParameter>,
        pageable: Pageable
    ): PageImpl<ObjectWrapper> {
        logger.debug {
            "Get objects with searchParams objectManagement=$objectManagement searchParameters=$searchParameters pageable=$pageable"
        }
        return runWithSuppressedOutbox(objectManagement.suppressOutbox) {
            val searchString = ObjectSearchParameter.toQueryParameter(searchParameters)

            val objectTypePluginInstance = getObjectTypenApiPlugin(objectManagement.objecttypenApiPluginConfigurationId)

            val objectenPluginInstance = getObjectenApiPlugin(objectManagement.objectenApiPluginConfigurationId)

            val ordering = toObjectsApiOrdering(pageable)

            val objectsList = objectenPluginInstance.getObjectsByObjectTypeIdWithSearchParams(
                objecttypesApiUrl = objectTypePluginInstance.url,
                objecttypeId = objectManagement.objecttypeId,
                searchString = searchString,
                ordering = ordering,
                pageable = pageable
            )

            PageImpl(objectsList.results, pageable, objectsList.count.toLong())
        }
    }

    private fun toObjectsApiOrdering(pageable: Pageable): String {
        return pageable.sort.map { order ->
            val property = order.property
            val sortField = if (property.startsWith("object:") || property.startsWith("/")) {
                "record__data__" + property.substringAfter(':').replace("/", "__").trim('_')
            } else {
                property.replace("/", "__").trim('_')
            }
            if (order.isAscending) sortField else "-$sortField"
        }.joinToString(",")
    }

    private fun mapToObjectListRowDto(
        objectsList: List<ObjectWrapper>,
        objectManagementId: UUID
    ): List<ObjectsListRowDto> {
        val listColumns = searchListColumnService.findByOwnerId(objectManagementId.toString())
        return objectsList.map { objectApiObject ->
            val listRowDto = listColumns?.map { listColumn ->
                if (!listColumn.path.startsWith("object:/") && !listColumn.path.startsWith("/")) {
                    throw IllegalArgumentException("Unknown list column path prefix in: '${listColumn.path}'")
                }

                ObjectsListRowDto.ObjectsListItemDto(
                    listColumn.key,
                    objectApiObject.record.data?.at(listColumn.path.substringAfter(":"))
                )
            }
            ObjectsListRowDto(objectApiObject.uuid.toString(), listRowDto!!)
        }
    }

    private fun mapToObjectSearchParameters(
        searchField: SearchFieldV2,
        otherFilter: SearchWithConfigFilter,
    ): List<ObjectSearchParameter> {
        if (otherFilter.values.size > 1) {
            throw IllegalArgumentException("The objects api does not support the multiselect options")
        }

        return when (searchField.fieldType) {
            RANGE -> {
                val searchGte = mapToObjectSearchParameter(
                    searchField,
                    GREATER_THAN_OR_EQUAL_TO,
                    otherFilter.rangeFrom
                )
                val searchLte = mapToObjectSearchParameter(
                    searchField,
                    LOWER_THAN_OR_EQUAL_TO,
                    otherFilter.rangeTo
                )
                listOfNotNull(searchGte, searchLte)
            }

            SINGLE ->
                otherFilter.values.mapNotNull { value ->
                    if (searchField.dataType == TEXT || searchField.dataType == BOOLEAN) {
                        // Note: Implementations assume that TEXT + SINGLE should do a STRING_CONTAINS search
                        // Note: Searching for BOOLEAN types in the Objects API only works when using STRING_CONTAINS
                        mapToObjectSearchParameter(searchField, STRING_CONTAINS, value)
                    } else {
                        mapToObjectSearchParameter(searchField, EQUAL_TO, value)
                    }
                }

            TEXT_CONTAINS ->
                otherFilter.values.mapNotNull { value ->
                    mapToObjectSearchParameter(searchField, STRING_CONTAINS, value)
                }

            SINGLE_SELECT_DROPDOWN ->
                otherFilter.values.mapNotNull { value ->
                    mapToObjectSearchParameter(searchField, EQUAL_TO, value)
                }

            MULTI_SELECT_DROPDOWN ->
                throw IllegalArgumentException("The objects api does not support the multiselect options")

            else ->
                throw IllegalArgumentException("Unknown search field type '${searchField.fieldType}'")
        }
    }

    private fun mapToObjectSearchParameter(
        searchField: SearchFieldV2,
        comparator: Comparator,
        value: SearchRequestValue?
    ): ObjectSearchParameter? {
        return if (value?.value == null) {
            null
        } else {
            ObjectSearchParameter(
                mapToObjectApiPath(searchField.path),
                comparator,
                castValueToDataType(searchField, value)
            )
        }
    }

    private fun mapToObjectApiPath(jsonPointerPath: String): String {
        if (!jsonPointerPath.startsWith("object:/") && !jsonPointerPath.startsWith("/")) {
            throw IllegalArgumentException("Unknown search path prefix in: '${jsonPointerPath}'")
        }
        return jsonPointerPath
            .substringAfter("object:")
            .substringAfter("/")
            .replace("/", "__")
    }

    private fun castValueToDataType(searchField: SearchFieldV2, searchRequestValue: SearchRequestValue): String {
        val value = searchRequestValue.value!!
        return when (searchField.dataType) {
            TEXT -> value as String
            NUMBER -> if (value is String) value else (value as Number).toString()
            BOOLEAN -> if (value is String) value else (value as Boolean).toString()
            DATE -> parseDate(value)
            DATETIME -> parseDatetime(value, searchField)
            TIME -> parseTime(value, searchField)
            BSN -> value as String
        }
    }

    private fun parseDate(value: Any): String {
        return if (value is String) {
            LocalDate.parse(value).toString()
        } else {
            (value as LocalDate).toString()
        }
    }

    private fun parseDatetime(value: Any, searchField: SearchFieldV2): String {
        return if (value is String) {
            val dateTimeValue = ZonedDateTime.parse(value)
            if (searchField.fieldType == RANGE) {
                // Note: Objects API doesn't support field type 'RANGE' with data type 'DATETIME'
                dateTimeValue.toLocalDate().toString()
            } else {
                dateTimeValue.toString()
            }
        } else {
            (value as ZonedDateTime).toString()
        }
    }

    private fun parseTime(value: Any, searchField: SearchFieldV2): String {
        return if (searchField.fieldType == RANGE) {
            throw IllegalStateException("Objects API doesn't support field type 'RANGE' with data type 'TIME'")
        } else if (value is String) {
            LocalTime.parse(value).toString()
        } else {
            (value as LocalTime).toString()
        }
    }

    private fun getObjectenApiPlugin(id: UUID) = pluginService
        .createInstance(
            PluginConfigurationId.existingId(id)
        ) as ObjectenApiPlugin

    private fun getObjectTypenApiPlugin(id: UUID) = pluginService
        .createInstance(
            PluginConfigurationId.existingId(id)
        ) as ObjecttypenApiPlugin

    fun findByObjectTypeId(id: String) = objectManagementRepository.findByObjecttypeId(id)

    fun getObjectsByConfig(
        id: UUID? = null,
        title: String? = null,
        dataAttrs: String? = null,
        pageable: Pageable
    ): PageImpl<ObjectWrapper> {
        return if (authorizationEnabled) {
            val objectManagement = resolveConfigWithAuth(id, title)
                ?: return PageImpl(emptyList(), pageable, 0)
            val searchParameters = parseDataAttrs(dataAttrs)
            getObjectsWithSearchParams(objectManagement, searchParameters, pageable)
        } else {
            runWithoutAuthorization {
                val objectManagement = resolveConfigNoAuth(id, title)
                    ?: return@runWithoutAuthorization PageImpl(emptyList(), pageable, 0)
                val searchParameters = parseDataAttrs(dataAttrs)
                getObjectsWithSearchParams(objectManagement, searchParameters, pageable)
            }
        }
    }

    private fun resolveConfigWithAuth(id: UUID?, title: String?): ObjectManagement? {
        val objectManagement = when {
            id != null -> objectManagementRepository.findByIdOrNull(id)
            title != null -> objectManagementRepository.findByTitle(title)
            else -> throw IllegalArgumentException("Either id or title must be provided")
        } ?: return null

        val hasPermission = authorizationService.hasPermission(
            EntityAuthorizationRequest(ObjectManagement::class.java, ObjectManagementActionProvider.VIEW, objectManagement)
        ) && authorizationService.hasPermission(
            EntityAuthorizationRequest(ObjectManagement::class.java, ObjectManagementActionProvider.VIEW_LIST, objectManagement)
        )
        return if (hasPermission) objectManagement else null
    }

    private fun resolveConfigNoAuth(id: UUID?, title: String?): ObjectManagement? = when {
        id != null -> objectManagementRepository.findByIdOrNull(id)
        title != null -> objectManagementRepository.findByTitle(title)
        else -> throw IllegalArgumentException("Either id or title must be provided")
    }

    private fun parseDataAttrs(dataAttrs: String?): List<ObjectSearchParameter> {
        if (dataAttrs.isNullOrBlank()) return emptyList()
        return dataAttrs.split(",").map { raw ->
            val parts = raw.split("__")
            val comparatorIndex = parts.indexOfFirst { part ->
                Comparator.entries.any { it.value == part }
            }
            require(comparatorIndex > 0 && comparatorIndex < parts.lastIndex) {
                "Invalid dataAttrs entry: '$raw' (expected attribute__comparator__value)"
            }
            val comparator = Comparator.entries.first { it.value == parts[comparatorIndex] }
            ObjectSearchParameter(
                parts.subList(0, comparatorIndex).joinToString("__"),
                comparator,
                parts.subList(comparatorIndex + 1, parts.size).joinToString("__")
            )
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
