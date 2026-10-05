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

package com.ritense.case_.caseconfiguration.service

import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.case_.caseconfiguration.domain.CaseConfigurationDeclaration
import com.ritense.case_.caseconfiguration.domain.CaseConfigurationDeclarationId
import com.ritense.case_.caseconfiguration.domain.CaseConfigurationEnvironmentValue
import com.ritense.case_.caseconfiguration.domain.CaseConfigurationEnvironmentValueId
import com.ritense.case_.caseconfiguration.exception.CaseConfigurationAlreadyExistsException
import com.ritense.case_.caseconfiguration.exception.CaseConfigurationNotFoundException
import com.ritense.case_.caseconfiguration.repository.CaseConfigurationDeclarationRepository
import com.ritense.case_.caseconfiguration.repository.CaseConfigurationEnvironmentValueRepository
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Transactional
@Service
@SkipComponentScan
class CaseConfigurationService(
    private val declarationRepository: CaseConfigurationDeclarationRepository,
    private val environmentValueRepository: CaseConfigurationEnvironmentValueRepository,
    private val caseDefinitionRepository: CaseDefinitionRepository,
    private val caseDefinitionChecker: CaseDefinitionChecker,
    private val authorizationService: AuthorizationService,
) {

    @Transactional(readOnly = true)
    fun getDeclarations(caseDefinitionId: CaseDefinitionId): List<CaseConfigurationDeclaration> {
        return declarationRepository.findAllByIdCaseDefinitionIdOrderByIdKey(caseDefinitionId)
    }

    @Transactional(readOnly = true)
    fun getDeclaredKeys(caseDefinitionKey: String): List<String> {
        return declarationRepository.findAllByIdCaseDefinitionIdKey(caseDefinitionKey)
            .map { it.id.key }
            .distinct()
            .sorted()
    }

    @Transactional(readOnly = true)
    fun getConfiguration(caseDefinitionId: CaseDefinitionId): List<CaseConfigurationItem> {
        val environmentValues = environmentValueRepository.findAllByIdCaseDefinitionKey(caseDefinitionId.key)
            .associate { it.id.key to it.value }
        return getDeclarations(caseDefinitionId).map {
            CaseConfigurationItem(it.id.key, it.defaultValue, environmentValues[it.id.key])
        }
    }

    @Transactional(readOnly = true)
    fun getConfiguration(caseDefinitionId: CaseDefinitionId, key: String): CaseConfigurationItem {
        val declaration = getDeclaration(caseDefinitionId, key)
        return CaseConfigurationItem(key, declaration.defaultValue, findEnvironmentValue(caseDefinitionId.key, key))
    }

    @Transactional(readOnly = true)
    fun resolveValue(caseDefinitionId: CaseDefinitionId, key: String): String? {
        val declaration = getDeclaration(caseDefinitionId, key)
        return findEnvironmentValue(caseDefinitionId.key, key) ?: declaration.defaultValue
    }

    fun exists(caseDefinitionId: CaseDefinitionId, key: String): Boolean {
        return declarationRepository.existsById(CaseConfigurationDeclarationId(caseDefinitionId, key))
    }

    fun createDeclaration(caseDefinitionId: CaseDefinitionId, key: String, defaultValue: String?): CaseConfigurationDeclaration {
        denyManagementOperation()
        caseDefinitionChecker.assertCanUpdateCaseDefinition(caseDefinitionId)
        val id = CaseConfigurationDeclarationId(caseDefinitionId, key)
        if (declarationRepository.existsById(id)) {
            throw CaseConfigurationAlreadyExistsException(key, caseDefinitionId)
        }
        return declarationRepository.save(CaseConfigurationDeclaration(id, defaultValue))
    }

    fun updateDeclaration(caseDefinitionId: CaseDefinitionId, key: String, defaultValue: String?): CaseConfigurationDeclaration {
        denyManagementOperation()
        caseDefinitionChecker.assertCanUpdateCaseDefinition(caseDefinitionId)
        val declaration = getDeclaration(caseDefinitionId, key)
        return declarationRepository.save(declaration.copy(defaultValue = defaultValue))
    }

    fun deleteDeclaration(caseDefinitionId: CaseDefinitionId, key: String) {
        denyManagementOperation()
        caseDefinitionChecker.assertCanUpdateCaseDefinition(caseDefinitionId)
        declarationRepository.delete(getDeclaration(caseDefinitionId, key))
    }

    fun copyDeclarations(from: CaseDefinitionId, to: CaseDefinitionId) {
        getDeclarations(from).forEach { createDeclaration(to, it.id.key, it.defaultValue) }
    }

    fun deleteAll(caseDefinitionId: CaseDefinitionId) {
        denyManagementOperation()
        declarationRepository.deleteAll(getDeclarations(caseDefinitionId))
        val otherVersionExists = caseDefinitionRepository.findAllByIdKeyOrderByIdVersionTagDesc(caseDefinitionId.key)
            .any { it.id != caseDefinitionId }
        if (!otherVersionExists) {
            environmentValueRepository.deleteAll(
                environmentValueRepository.findAllByIdCaseDefinitionKey(caseDefinitionId.key)
            )
        }
    }

    // Deliberately no draft check: environment values are environment state, not part of the definition
    fun setEnvironmentValue(caseDefinitionId: CaseDefinitionId, key: String, value: String): CaseConfigurationItem {
        denyManagementOperation()
        assertCaseDefinitionExists(caseDefinitionId)
        val declaration = getDeclaration(caseDefinitionId, key)
        if (value.isBlank()) {
            clearEnvironmentValue(caseDefinitionId, key)
            return CaseConfigurationItem(key, declaration.defaultValue, null)
        }
        environmentValueRepository.save(
            CaseConfigurationEnvironmentValue(CaseConfigurationEnvironmentValueId(caseDefinitionId.key, key), value)
        )
        return CaseConfigurationItem(key, declaration.defaultValue, value)
    }

    fun clearEnvironmentValue(caseDefinitionId: CaseDefinitionId, key: String) {
        denyManagementOperation()
        assertCaseDefinitionExists(caseDefinitionId)
        getDeclaration(caseDefinitionId, key)
        val id = CaseConfigurationEnvironmentValueId(caseDefinitionId.key, key)
        if (environmentValueRepository.existsById(id)) {
            environmentValueRepository.deleteById(id)
        }
    }

    private fun assertCaseDefinitionExists(caseDefinitionId: CaseDefinitionId) {
        require(caseDefinitionRepository.existsById(caseDefinitionId)) { "CaseDefinition $caseDefinitionId does not exist." }
    }

    private fun getDeclaration(caseDefinitionId: CaseDefinitionId, key: String): CaseConfigurationDeclaration {
        return declarationRepository.findByIdOrNull(CaseConfigurationDeclarationId(caseDefinitionId, key))
            ?: throw CaseConfigurationNotFoundException(key, caseDefinitionId)
    }

    private fun findEnvironmentValue(caseDefinitionKey: String, key: String): String? {
        return environmentValueRepository.findByIdOrNull(CaseConfigurationEnvironmentValueId(caseDefinitionKey, key))?.value
    }

    private fun denyManagementOperation() {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                Any::class.java,
                Action.deny()
            )
        )
    }
}
