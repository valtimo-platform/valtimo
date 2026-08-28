/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.buildingblock.service

import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.exception.UnknownBuildingBlockDefinitionException
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.BuildingBlockDefinitionSpecificationHelper.Companion.byIds
import com.ritense.buildingblock.repository.BuildingBlockDefinitionSpecificationHelper.Companion.bySearchTerm
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.web.rest.dto.BuildingBlockDefinitionDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionDto
import com.ritense.buildingblock.web.rest.dto.CreateBuildingBlockDefinitionDto
import com.ritense.buildingblock.web.rest.dto.UpdateBuildingBlockDefinitionDto
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.event.BuildingBlockDefinitionCreatedEvent
import org.springframework.context.ApplicationEventPublisher
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
class BuildingBlockManagementService(
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
    private val buildingBlockDocumentDefinitionService: BuildingBlockDocumentDefinitionService,
    private val buildingBlockDefinitionProcessDefinitionService: BuildingBlockDefinitionProcessDefinitionService,
    private val buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker,
    private val authorizationService: AuthorizationService,
    private val applicationEventPublisher: ApplicationEventPublisher
) {
    @Transactional(readOnly = true)
    fun getLatestPerKey(includeArtwork: Boolean = false): List<BuildingBlockDefinitionDto> {
        denyAuthorization()

        return latestPerKey(buildingBlockDefinitionRepository.findAll()) { it.id }
            .map { BuildingBlockDefinitionDto.from(it, includeArtwork) }
    }

    /**
     * Latest version per key, narrowed by [searchTerm], ordered by [Pageable.getSort] and paged.
     *
     * Only the SemVer ranking happens in Kotlin; search, ordering and paging are left to the database.
     * Resolving latest versions first keeps the search honest, since a name may differ between versions.
     *
     * @throws IllegalArgumentException when [Pageable.getSort] names a property that is not sortable
     */
    @Transactional(readOnly = true)
    fun searchLatestPerKey(
        searchTerm: String?,
        pageable: Pageable
    ): Page<BuildingBlockDefinitionDto> {
        denyAuthorization()

        // Validated first, so a bad sort is refused even on an empty table.
        val requestedSort = if (pageable.sort.isSorted) pageable.sort else BY_NAME_ASCENDING
        val entitySort = withStableTieBreaker(toEntitySort(requestedSort))

        /*
           The returned page reports the sort the caller asked for, not the entity paths it was
           translated to. Reporting 'id.key' would hand back a property this endpoint refuses as
           input, so a client could not feed its own page metadata back to it.
         */
        val responsePageable = pageable.withSort(requestedSort)

        val latestIds = latestIdPerKey()
        if (latestIds.isEmpty()) {
            return PageImpl(emptyList(), responsePageable, 0)
        }

        val page = buildingBlockDefinitionRepository
            .findAll(byIds(latestIds).and(bySearchTerm(searchTerm)), pageable.withSort(entitySort))

        return PageImpl(
            page.content.map { BuildingBlockDefinitionDto.from(it) },
            responsePageable,
            page.totalElements
        )
    }

    private fun Pageable.withSort(sort: Sort): Pageable =
        if (isUnpaged) Pageable.unpaged(sort) else PageRequest.of(pageNumber, pageSize, sort)

    private fun latestIdPerKey(): List<BuildingBlockDefinitionId> =
        latestPerKey(buildingBlockDefinitionRepository.findAllIds()) { it }

    /**
     * Highest version tag per key by SemVer; shared by the id-only and entity variants so they cannot drift.
     */
    private fun <T> latestPerKey(items: Iterable<T>, id: (T) -> BuildingBlockDefinitionId): List<T> {
        return items
            .groupBy { id(it).key }
            .values
            .mapNotNull { forKey ->
                forKey.maxWithOrNull { a, b -> id(a).versionTag.compareTo(id(b).versionTag) }
            }
    }

    private fun withStableTieBreaker(entitySort: Sort): Sort =
        if (entitySort.getOrderFor(KEY_PATH) != null) {
            entitySort
        } else {
            entitySort.and(Sort.by(Sort.Order.asc(KEY_PATH)))
        }

    /**
     * Maps the requested sort onto entity paths, refusing anything outside [SORT_PROPERTIES]; case-insensitive.
     */
    private fun toEntitySort(sort: Sort): Sort {
        return Sort.by(
            sort.map { order ->
                val property = requireNotNull(SORT_PROPERTIES[order.property]) {
                    "Cannot sort building block definitions on '${order.property}'. " +
                        "Sortable properties are: ${SORT_PROPERTIES.keys.joinToString()}."
                }
                Sort.Order(order.direction, property).ignoreCase()
            }.toList()
        )
    }

    @Transactional
    fun create(dto: CreateBuildingBlockDefinitionDto): BuildingBlockDefinitionDto {
        denyAuthorization()

        val entity = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId(dto.key, dto.versionTag),
            name = dto.name,
            description = dto.description,
            createdBy = null,
            createdDate = null,
            basedOnVersionTag = null,
            final = false
        )
        val saved = buildingBlockDefinitionRepository.saveAndFlush(entity)

        buildingBlockDocumentDefinitionService.ensureEmptyFor(saved.id.key, saved.id.versionTag.toString())

        runWithoutAuthorization {
            buildingBlockDefinitionProcessDefinitionService.createEmptyProcessAndLink(
                saved.name,
                saved.id.key,
                saved.id.versionTag.toString()
            )
        }

        applicationEventPublisher.publishEvent(
            BuildingBlockDefinitionCreatedEvent(
                buildingBlockDefinitionId = saved.id,
                buildingBlockDefinitionName = saved.name,
                basedOnBuildingBlockDefinitionId = null,
                duplicate = false
            )
        )

        return BuildingBlockDefinitionDto.from(saved)
    }

    @Transactional
    fun createDraft(key: String, basedOnVersionTag: String, newVersionTag: String): BuildingBlockDefinitionDto {
        denyAuthorization()

        val basedOnId = BuildingBlockDefinitionId.of(key, basedOnVersionTag)
        val newId = BuildingBlockDefinitionId.of(key, newVersionTag)

        require(!buildingBlockDefinitionRepository.existsById(newId)) {
            "Building block definition with id '$newId' already exists"
        }

        val basedOn = buildingBlockDefinitionRepository.findByIdOrNull(basedOnId)
            ?: throw UnknownBuildingBlockDefinitionException(basedOnId)

        require(basedOn.final) {
            "Only final building block definitions can be used to create a draft"
        }

        val draftDefinition = BuildingBlockDefinition(
            id = newId,
            name = basedOn.name,
            description = basedOn.description,
            createdBy = null,
            createdDate = LocalDateTime.now(),
            basedOnVersionTag = basedOn.id.versionTag,
            final = false
        )

        val savedDraft = buildingBlockDefinitionRepository.saveAndFlush(draftDefinition)

        applicationEventPublisher.publishEvent(
            BuildingBlockDefinitionCreatedEvent(
                buildingBlockDefinitionId = savedDraft.id,
                buildingBlockDefinitionName = savedDraft.name,
                basedOnBuildingBlockDefinitionId = basedOnId,
                duplicate = true
            )
        )

        return BuildingBlockDefinitionDto.from(savedDraft)
    }

    @Transactional
    fun update(key: String, versionTag: String, dto: UpdateBuildingBlockDefinitionDto): BuildingBlockDefinitionDto? {
        denyAuthorization()

        val id = BuildingBlockDefinitionId(key, versionTag)
        val existing = buildingBlockDefinitionRepository.findByIdOrNull(id)
            ?: throw UnknownBuildingBlockDefinitionException(id)

        buildingBlockDefinitionChecker.assertCanUpdateBuildingBlockDefinition(id)

        val updated = BuildingBlockDefinition(
            id = existing.id,
            name = dto.name,
            description = dto.description,
            createdBy = existing.createdBy,
            createdDate = existing.createdDate,
            basedOnVersionTag = existing.basedOnVersionTag,
            final = existing.final
        )

        val saved = buildingBlockDefinitionRepository.save(updated)

        return BuildingBlockDefinitionDto.from(saved)
    }

    @Transactional
    fun finalize(key: String, versionTag: String): BuildingBlockDefinitionDto {
        denyAuthorization()

        val id = BuildingBlockDefinitionId(key, versionTag)
        val existing = buildingBlockDefinitionRepository.findByIdOrNull(id)
            ?: throw UnknownBuildingBlockDefinitionException(id)

        if (existing.final) {
            return BuildingBlockDefinitionDto.from(existing)
        }

        val finalized = buildingBlockDefinitionRepository.save(existing.copy(final = true))
        return BuildingBlockDefinitionDto.from(finalized)
    }

    @Transactional(readOnly = true)
    fun getPagedVersionsWithFinalFlag(key: String, pageable: Pageable): Page<BuildingBlockVersionDto> {
        denyAuthorization()

        val page = buildingBlockDefinitionRepository.findAllByIdKey(key, pageable)

        return page.map {
            BuildingBlockVersionDto(
                versionTag = it.id.versionTag.toString(),
                final = it.final
            )
        }
    }

    @Transactional(readOnly = true)
    fun getAllVersionsWithFinalFlag(key: String): Page<BuildingBlockVersionDto> {
        denyAuthorization()

        val buildingBlocks = buildingBlockDefinitionRepository.findAllByIdKeyOrderByIdVersionTag(key)

        return PageImpl(
            buildingBlocks.map {
                BuildingBlockVersionDto(
                    versionTag = it.id.versionTag.toString(),
                    final = it.final
                )
            }
        )
    }

    private fun denyAuthorization() {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                BuildingBlockDefinition::class.java,
                Action.deny()
            )
        )
    }

    companion object {
        private const val KEY_PATH: String = "id.key"

        /**
         * Sort property -> entity path. The version tag is absent by design: sorting it in SQL would be
         * lexicographic, not SemVer. Anything else is refused rather than silently ignored.
         */
        private val SORT_PROPERTIES: Map<String, String> = mapOf(
            "name" to "name",
            "key" to KEY_PATH,
        )

        private val BY_NAME_ASCENDING: Sort = Sort.by(Sort.Order.asc("name"))
    }
}
