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

package com.ritense.case.service

import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.case.domain.CaseListColumnId
import com.ritense.case.exception.InvalidListColumnException
import com.ritense.case.exception.UnknownCaseDefinitionException
import com.ritense.case.repository.CaseDefinitionConfigurationIssueRepository
import com.ritense.case.repository.CaseDefinitionListColumnRepository
import com.ritense.case.repository.CaseDefinitionSpecificationHelper.Companion.byActive
import com.ritense.case.repository.CaseDefinitionSpecificationHelper.Companion.byCaseDefinitionKey
import com.ritense.case.repository.CaseDefinitionSpecificationHelper.Companion.byCaseDefinitionVersionTag
import com.ritense.case.repository.CaseDefinitionSpecificationHelper.Companion.byFinal
import com.ritense.case.service.finalization.CaseDefinitionFinalizationCheckResult
import com.ritense.case.service.finalization.CaseDefinitionFinalizationChecker
import com.ritense.case.service.validations.CreateCaseListColumnValidator
import com.ritense.case.service.validations.ListColumnValidator
import com.ritense.case.service.validations.Operation
import com.ritense.case.service.validations.UpdateCaseListColumnValidator
import com.ritense.case.web.rest.dto.CaseDefinitionDraftCreateRequest
import com.ritense.case.web.rest.dto.CaseListColumnDto
import com.ritense.case.web.rest.dto.CaseSettingsDto
import com.ritense.case.web.rest.dto.HiddenCaseListColumnDto
import com.ritense.case.web.rest.mapper.CaseListColumnMapper
import com.ritense.case_.authorization.CaseDefinitionActionProvider
import com.ritense.case_.domain.column.HiddenCaseListColumn
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.case_.repository.HiddenCaseListColumnRepository
import com.ritense.document.exception.UnknownDocumentDefinitionException
import com.ritense.document.service.DocumentDefinitionService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseDefinitionCreatedEvent
import com.ritense.valtimo.contract.event.CaseDefinitionPreDeleteEvent
import com.ritense.valtimo.contract.utils.SecurityUtils
import com.ritense.valueresolver.ValueResolverService
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.validation.ValidationException
import org.semver4j.Semver
import org.springframework.beans.factory.ObjectProvider
import org.springframework.context.ApplicationEventPublisher
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.jpa.domain.Specification
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime
import kotlin.jvm.optionals.getOrNull

@Transactional
@Service
@SkipComponentScan
class CaseDefinitionService(
    private val caseDefinitionListColumnRepository: CaseDefinitionListColumnRepository,
    private val documentDefinitionService: DocumentDefinitionService,
    private val caseDefinitionRepository: CaseDefinitionRepository,
    private val hiddenCaseListColumnRepository: HiddenCaseListColumnRepository,
    valueResolverService: ValueResolverService,
    private val authorizationService: AuthorizationService,
    private val applicationEventPublisher: ApplicationEventPublisher,
    private val caseDefinitionChecker: CaseDefinitionChecker,
    private val caseDefinitionFinalizationCheckersProvider: ObjectProvider<CaseDefinitionFinalizationChecker>,
    private val configurationIssueRepository: CaseDefinitionConfigurationIssueRepository,
    ) {
    var validators: Map<Operation, ListColumnValidator<CaseListColumnDto>> = mapOf(
        Operation.CREATE to CreateCaseListColumnValidator(
            caseDefinitionListColumnRepository,
            documentDefinitionService,
            valueResolverService
        ),
        Operation.UPDATE to UpdateCaseListColumnValidator(
            caseDefinitionListColumnRepository,
            documentDefinitionService,
            valueResolverService
        )
    )

    fun createCaseDefinitionDraft(
        request: CaseDefinitionDraftCreateRequest
    ): CaseDefinition {
        denyManagementOperation()
        val caseDefinitionId = request.getCaseDefinitionId()
        require(!caseDefinitionRepository.existsById(caseDefinitionId)) {
            "Failed to create case-definition-draft. Case-definition with id: '${caseDefinitionId}' already exists."
        }
        val basedOnCaseDefinitionId = request.getBasedOnCaseDefinitionId()
        val newCaseDefinition = if (basedOnCaseDefinitionId == null) {
            CaseDefinition(
                id = caseDefinitionId,
                name = request.name ?: error("Case definition name cannot be null"),
                description = request.description,
                final = false,
                createdBy = SecurityUtils.getCurrentUserLogin(),
                createdDate = LocalDateTime.now(),
                active = true
            )
        } else {
            val basedOnCaseDefinition = getCaseDefinition(basedOnCaseDefinitionId)
            require(basedOnCaseDefinition.final) {
                "Failed to create case-definition-draft. Case-definition with id: '$basedOnCaseDefinitionId' is not final."
            }
            basedOnCaseDefinition.copy(
                id = caseDefinitionId,
                name = request.name ?: basedOnCaseDefinition.name,
                description = request.description ?: basedOnCaseDefinition.description,
                final = false,
                createdBy = SecurityUtils.getCurrentUserLogin(),
                createdDate = LocalDateTime.now(),
                basedOnVersionTag = basedOnCaseDefinitionId.versionTag,
                active = false
            )
        }
        val newSavedCaseDefinition = caseDefinitionRepository.save(newCaseDefinition)
        caseDefinitionChecker.assertCanUpdateCaseDefinition(newSavedCaseDefinition.id)
        applicationEventPublisher.publishEvent(
            CaseDefinitionCreatedEvent(
                caseDefinitionId = newSavedCaseDefinition.id,
                caseDefinitionName = newSavedCaseDefinition.name,
                basedOnCaseDefinitionId = basedOnCaseDefinitionId,
                duplicate = basedOnCaseDefinitionId != null,
                copyFormDefinitionsAfterProcessLinks = true
            )
        )
        return newSavedCaseDefinition
    }

    fun deleteCaseDefinition(caseDefinitionId: CaseDefinitionId) {
        denyManagementOperation()
        caseDefinitionChecker.assertCanUpdateCaseDefinition(caseDefinitionId)
        val isLastCaseDefinition = getCaseDefinitions(
            caseDefinitionKey = caseDefinitionId.key,
            pageable = Pageable.ofSize(2)
        ).count() == 1
        require(isLastCaseDefinition || !getCaseDefinition(caseDefinitionId).active) {
            "Failed to delete case-definition. Case-definition with id: '$caseDefinitionId' is the global active version."
        }
        require(!getCaseDefinition(caseDefinitionId).final) {
            "Failed to delete case-definition. Case-definition with id: '$caseDefinitionId' is final."
        }
        applicationEventPublisher.publishEvent(
            CaseDefinitionPreDeleteEvent(caseDefinitionId)
        )
        caseDefinitionRepository.deleteById(caseDefinitionId)
    }

    fun existsCaseDefinition(caseDefinitionKey: String): Boolean {
        return caseDefinitionRepository.existsByIdKey(caseDefinitionKey)
    }

    fun getCaseDefinitions(
        caseDefinitionKey: String? = null,
        caseDefinitionVersionTag: Semver? = null,
        active: Boolean? = null,
        final: Boolean? = null,
        pageable: Pageable,
    ): Page<CaseDefinition> {
        if (active == null || !active) {
            denyManagementOperation()
        }
        val spec = getCaseDefinitionsQuery(
            caseDefinitionKey = caseDefinitionKey,
            caseDefinitionVersionTag = caseDefinitionVersionTag,
            active = active,
            final = final,
        )
        return caseDefinitionRepository.findAll(spec, pageable)
    }

    fun getCaseDefinitions(
        caseDefinitionKey: String? = null,
        caseDefinitionVersionTag: Semver? = null,
        active: Boolean? = null,
        final: Boolean? = null,
    ): List<CaseDefinition> {
        if (active == null || !active) {
            denyManagementOperation()
        }

        val spec =
            getCaseDefinitionsQuery(
                caseDefinitionKey = caseDefinitionKey,
                caseDefinitionVersionTag = caseDefinitionVersionTag,
                active = active,
                final = final,
            )
        return caseDefinitionRepository.findAll(spec, Sort.by(Sort.Order.asc("name")))
    }

    fun getCaseDefinition(caseDefinitionId: CaseDefinitionId): CaseDefinition {
        return caseDefinitionRepository.findByIdOrNull(caseDefinitionId)
            ?: throw UnknownCaseDefinitionException(caseDefinitionId)
    }

    fun findCaseDefinition(caseDefinitionId: CaseDefinitionId): CaseDefinition? {
        return caseDefinitionRepository.findByIdOrNull(caseDefinitionId)
    }

    fun getActiveCaseDefinition(caseDefinitionKey: String): CaseDefinition? {
        return caseDefinitionRepository.findByActiveIsTrueAndIdKey(caseDefinitionKey)
    }

    fun updateCaseDefinition(caseDefinitionId: CaseDefinitionId, name: String?, description: String?): CaseDefinition {
        denyManagementOperation()
        caseDefinitionChecker.assertCanUpdateCaseDefinition(caseDefinitionId)
        val caseDefinition = getCaseDefinition(caseDefinitionId)
        return caseDefinitionRepository.save(
            caseDefinition.copy(
                name = name ?: caseDefinition.name,
                description = description ?: caseDefinition.description
            )
        )
    }

    @Throws(UnknownDocumentDefinitionException::class)
    fun setActiveCaseDefinition(caseDefinitionId: CaseDefinitionId): CaseDefinition {
        denyManagementOperation()
        val caseDefinition = runWithoutAuthorization { getCaseDefinition(caseDefinitionId) }

        val unresolvedIssues = configurationIssueRepository.findUnresolvedByCaseDefinitionId(caseDefinitionId)
        require(unresolvedIssues.isEmpty()) {
            "Failed to set active case-definition. Case-definition with id: '$caseDefinitionId' has unresolved configuration issues."
        }

        val activeCaseDefinition = caseDefinitionRepository.findByActiveIsTrueAndIdKey(caseDefinitionId.key)
        if (activeCaseDefinition != null && activeCaseDefinition.id != caseDefinitionId) {
            caseDefinitionRepository.save(activeCaseDefinition.copy(active = false))
        }

        return caseDefinitionRepository.save(caseDefinition.copy(active = true))
    }

    fun finalizeCaseDefinition(caseDefinitionId: CaseDefinitionId): CaseDefinition {
        denyManagementOperation()

        val check = isCaseDefinitionFinalizable(caseDefinitionId)
        require(check.finalizable) {
            "Failed to finalize case-definition. Case-definition with id: '$caseDefinitionId' cannot be made definitive. Reason: '${check.code}'."
        }

        val caseDefinition = getCaseDefinition(caseDefinitionId)
        require(!caseDefinition.final) {
            "Failed to finalize case-definition. Case-definition with id: '$caseDefinitionId' is already final."
        }

        return caseDefinitionRepository.save(caseDefinition.copy(final = true))
    }

    fun getCaseDefinitionsBasedOnVersion(caseDefinitionKey: String, basedOnVersionTag: Semver): List<CaseDefinition> {
        return caseDefinitionRepository.findAllByIdKeyAndBasedOnVersionTag(caseDefinitionKey, basedOnVersionTag)
    }

    @Throws(UnknownDocumentDefinitionException::class)
    fun updateCaseSettings(caseDefinitionId: CaseDefinitionId, newSettings: CaseSettingsDto): CaseDefinition {
        denyManagementOperation()
        caseDefinitionChecker.assertCanUpdateCaseDefinition(caseDefinitionId)

        val caseDefinition = newSettings.update(
            runWithoutAuthorization { getCaseDefinition(caseDefinitionId) }
        )

        return caseDefinitionRepository.save(caseDefinition)
    }

    @Throws(InvalidListColumnException::class)
    fun createListColumn(
        caseDefinitionKey: String,
        caseListColumnDto: CaseListColumnDto
    ) {
        denyManagementOperation()

        runWithoutAuthorization {
            validators[Operation.CREATE]!!.validate(caseDefinitionKey, caseListColumnDto)
        }
        caseListColumnDto.order = caseDefinitionListColumnRepository.countByIdCaseDefinitionKey(caseDefinitionKey)

        if (caseListColumnDto.exportable) {
            validateExportPath(caseListColumnDto.path, caseListColumnDto.key)
        }

        caseDefinitionListColumnRepository
            .save(CaseListColumnMapper.toEntity(caseDefinitionKey, caseListColumnDto))

        logger.info { "User '${getCurrentUser()}' created a case list column configuration: '$caseListColumnDto' for case definition: '$caseDefinitionKey'"}
    }

    @Transactional
    fun updateListColumns(
        caseDefinitionName: String,
        caseListColumnDtoList: List<CaseListColumnDto>
    ) {
        denyManagementOperation()

        runWithoutAuthorization {
            validators[Operation.UPDATE]!!.validate(caseDefinitionName, caseListColumnDtoList)
        }

        caseListColumnDtoList.forEachIndexed { index, dto ->
            dto.order = index
        }

        caseListColumnDtoList
            .filter { it.exportable }
            .forEach { dto ->
                validateExportPath(dto.path, dto.key)
            }

        val entities = CaseListColumnMapper.toEntityList(caseDefinitionName, caseListColumnDtoList)

        val incomingKeys = entities.map { it.id.key }

        caseDefinitionListColumnRepository.deleteByIdCaseDefinitionKey(caseDefinitionName)

        caseDefinitionListColumnRepository.saveAll(entities)

        val currentUser = getCurrentUser()

        if(currentUser != null) {
            logger.info { "User '${currentUser}' " +
                "updated case list column configuration: '$entities' for case definition: '$caseDefinitionName'"}
        }
    }

    fun getHiddenCaseListColumns(caseDefinitionKey: String, userId: String): List<CaseListColumnDto> {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                CaseDefinition::class.java,
                CaseDefinitionActionProvider.VIEW,
                runWithoutAuthorization {
                    getCaseDefinitions(
                        caseDefinitionKey = caseDefinitionKey,
                        active = true
                    )
                }
            )
        )

        return CaseListColumnMapper.toDtoList(
            hiddenCaseListColumnRepository.findAllByUserIdAndCaseListColumnIdCaseDefinitionKey(
                userId,
                caseDefinitionKey
            ).map(HiddenCaseListColumn::caseListColumn)
        )
    }

    fun saveHiddenCaseListColumns(
        caseDefinitionKey: String,
        hiddenCaseListColumnDtoList: List<HiddenCaseListColumnDto>,
        userId: String
    ) {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                CaseDefinition::class.java,
                CaseDefinitionActionProvider.VIEW,
                runWithoutAuthorization {
                    getCaseDefinitions(
                        caseDefinitionKey = caseDefinitionKey,
                        active = true
                    )
                }
            )
        )

        hiddenCaseListColumnRepository.deleteAllByUserIdAndCaseListColumnIdCaseDefinitionKey(
            userId,
            caseDefinitionKey
        )

        val entities = hiddenCaseListColumnDtoList.mapNotNull {
            caseDefinitionListColumnRepository.findById(
                CaseListColumnId(caseDefinitionKey,
                    it.columnKey
                )
            ).getOrNull()
        }
        hiddenCaseListColumnRepository.saveAll(
            entities.map {
                HiddenCaseListColumn(caseListColumn = it, userId = userId)
            }
        )
    }

    @Throws(UnknownDocumentDefinitionException::class)
    fun getListColumns(caseDefinitionKey: String): List<CaseListColumnDto> {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                CaseDefinition::class.java,
                CaseDefinitionActionProvider.VIEW,
                runWithoutAuthorization {
                    getCaseDefinitions(
                        caseDefinitionKey = caseDefinitionKey,
                        active = true
                    )
                }
            )
        )

        return CaseListColumnMapper
            .toDtoList(
                caseDefinitionListColumnRepository.findByIdCaseDefinitionKeyOrderByOrderAsc(
                    caseDefinitionKey
                )
            )
    }

    @Throws(UnknownDocumentDefinitionException::class)
    fun deleteCaseListColumn(caseDefinitionKey: String, columnKey: String) {
        denyManagementOperation()

        runWithoutAuthorization { assertDocumentDefinitionExists(caseDefinitionKey) }

        if (caseDefinitionListColumnRepository
                .existsByIdCaseDefinitionKeyAndIdKey(caseDefinitionKey, columnKey)
        ) {
            hiddenCaseListColumnRepository.deleteAllByCaseListColumnIdCaseDefinitionKeyAndCaseListColumnIdKey(
                caseDefinitionKey,
                columnKey
            )
            caseDefinitionListColumnRepository.deleteByIdCaseDefinitionKeyAndIdKey(caseDefinitionKey, columnKey)
        }
    }

    fun setLatestToActiveIfNoneIsActive() {
        val allCaseDefinitions = caseDefinitionRepository.findAll()
        val caseDefinitionIdsWithIssues = configurationIssueRepository.findCaseDefinitionIdsWithUnresolvedIssues(
            allCaseDefinitions.map { it.id }
        )
        allCaseDefinitions
            .groupBy { it.id.key }
            .map { it.value }
            .filter { caseDefinitions -> caseDefinitions.none { caseDefinition -> caseDefinition.active } }
            .mapNotNull { caseDefinitions ->
                caseDefinitions
                    .filter { it.id !in caseDefinitionIdsWithIssues }
                    .maxByOrNull { it.id.versionTag }
            }
            .map { caseDefinition -> caseDefinition.copy(active = true) }
            .forEach { caseDefinition -> caseDefinitionRepository.save(caseDefinition) }
    }

    /**
     * Case definitions matching the filters, ordered by [Pageable.getSort] and paged. Collapses to the
     * representative version per key unless [allVersions] is set: the overview shows a single row per
     * case, while the version picker, case migration and the verzoek plugin need every version.
     *
     * Ordering happens in memory rather than in the database, because the version tag column is a string:
     * the database would rank 1.0.10 below 1.0.9 instead of following SemVer precedence.
     *
     * @throws ValidationException when [Pageable.getSort] names a property that is not sortable
     */
    fun getCaseDefinitionsForManagement(
        caseDefinitionKey: String? = null,
        active: Boolean? = null,
        final: Boolean? = null,
        allVersions: Boolean = false,
        pageable: Pageable,
    ): Page<CaseDefinition> {
        denyManagementOperation()

        // Resolved first, so a bad sort is refused even on an empty table.
        val comparator = toComparator(pageable.sort)

        val spec = getCaseDefinitionsQuery(
            caseDefinitionKey = caseDefinitionKey,
            active = active,
            final = final,
        )
        val result = caseDefinitionRepository.findAll(spec)
            .let { if (allVersions) it else latestPerKey(it) }
            .sortedWith(comparator)

        // Coerced as a Long: the offset of a high page number overflows Int and would wrap negative.
        val start = pageable.offset.coerceIn(0, result.size.toLong()).toInt()
        val end = (start.toLong() + pageable.pageSize).coerceAtMost(result.size.toLong()).toInt()
        return PageImpl(result.subList(start, end), pageable, result.size.toLong())
    }

    private fun latestPerKey(caseDefinitions: List<CaseDefinition>): List<CaseDefinition> =
        caseDefinitions
            .groupBy { it.id.key }
            .map { (_, versions) -> versions.find { it.active } ?: versions.maxBy { it.id.versionTag } }

    /**
     * Maps the requested sort onto comparators, refusing anything outside [SORT_COMPARATORS]. A key and
     * version tag tie-breaker is appended, so paging stays stable when the requested sort leaves ties.
     *
     * An unsorted [Sort] falls through to that tie-breaker alone; the endpoint declares its own defaults.
     */
    private fun toComparator(sort: Sort): Comparator<CaseDefinition> {
        val requested = sort.map { order ->
            val comparator = SORT_COMPARATORS[order.property]
                ?: throw ValidationException(
                    "Cannot sort case definitions on '${order.property}'. " +
                        "Sortable properties are: ${SORT_COMPARATORS.keys.joinToString()}."
                )
            if (order.isAscending) comparator else comparator.reversed()
        }.toList()

        return (requested + TIE_BREAKER).reduce { left, right -> left.then(right) }
    }

    fun isCaseDefinitionFinalizable(caseDefinitionId: CaseDefinitionId): CaseDefinitionFinalizationCheckResult {
        return caseDefinitionFinalizationCheckersProvider
            .orderedStream()
            .map { it.check(caseDefinitionId) }
            .filter { !it.finalizable }
            .findFirst()
            .orElse(CaseDefinitionFinalizationCheckResult(finalizable = true))
    }

    private fun getCaseDefinitionsQuery(
        caseDefinitionKey: String? = null,
        caseDefinitionVersionTag: Semver? = null,
        active: Boolean? = null,
        final: Boolean? = null,
    ): Specification<CaseDefinition> {
        var spec: Specification<CaseDefinition> = authorizationService.getAuthorizationSpecification(
            EntityAuthorizationRequest(
                CaseDefinition::class.java,
                CaseDefinitionActionProvider.VIEW_LIST
            )
        )

        if (caseDefinitionKey != null) {
            spec = spec.and(byCaseDefinitionKey(caseDefinitionKey))
        }
        if (caseDefinitionVersionTag != null) {
            spec = spec.and(byCaseDefinitionVersionTag(caseDefinitionVersionTag))
        }
        if (active != null) {
            spec = spec.and(byActive(active))
        }
        if (final != null) {
            spec = spec.and(byFinal(final))
        }
        return spec
    }

    private fun denyManagementOperation() {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                Any::class.java,
                Action.deny()
            )
        )
    }

    @Throws(UnknownDocumentDefinitionException::class)
    private fun assertDocumentDefinitionExists(caseDefinitionKey: String) {
        if (!documentDefinitionService.existsByName(caseDefinitionKey)) {
            throw UnknownCaseDefinitionException(caseDefinitionKey)
        }
    }

    private fun validateExportPath(path: String, key: String) {
        require(PATH_REGEX_EXPORTABLE.containsMatchIn(path)) {
            "Failed to save the case list column configuration for key '$key'. Only document or case properties can be exported."
        }
    }

    private fun getCurrentUser(): String? {
        return SecurityUtils.getCurrentUserLogin()
    }

    companion object {
        val logger = KotlinLogging.logger {}
        val PATH_REGEX_EXPORTABLE = Regex("^(case:|doc:)")

        private val BY_KEY: Comparator<CaseDefinition> = compareBy { it.id.key }
        private val BY_VERSION_TAG: Comparator<CaseDefinition> = compareBy { it.id.versionTag }

        /**
         * Sort property -> comparator. Both the entity path and the name the response uses are accepted,
         * so a caller can sort on a column it can actually see. Anything else is refused rather than
         * silently ignored.
         */
        private val SORT_COMPARATORS: Map<String, Comparator<CaseDefinition>> = mapOf(
            "name" to compareBy<CaseDefinition, String>(String.CASE_INSENSITIVE_ORDER) { it.name },
            "key" to BY_KEY,
            "id.key" to BY_KEY,
            "caseDefinitionKey" to BY_KEY,
            "versionTag" to BY_VERSION_TAG,
            "id.versionTag" to BY_VERSION_TAG,
            "caseDefinitionVersionTag" to BY_VERSION_TAG,
            "active" to compareBy<CaseDefinition> { it.active },
            "final" to compareBy<CaseDefinition> { it.final },
            "createdDate" to compareBy<CaseDefinition, LocalDateTime?>(nullsFirst()) { it.createdDate },
        )

        private val TIE_BREAKER: Comparator<CaseDefinition> = BY_KEY.thenByDescending { it.id.versionTag }
    }
}
