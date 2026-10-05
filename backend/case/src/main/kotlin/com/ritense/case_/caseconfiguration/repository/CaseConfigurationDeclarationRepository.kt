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

package com.ritense.case_.caseconfiguration.repository

import com.ritense.case_.caseconfiguration.domain.CaseConfigurationDeclaration
import com.ritense.case_.caseconfiguration.domain.CaseConfigurationDeclarationId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.springframework.data.jpa.repository.JpaRepository

interface CaseConfigurationDeclarationRepository :
    JpaRepository<CaseConfigurationDeclaration, CaseConfigurationDeclarationId> {

    fun findAllByIdCaseDefinitionIdOrderByIdKey(caseDefinitionId: CaseDefinitionId): List<CaseConfigurationDeclaration>

    fun findAllByIdCaseDefinitionIdKey(caseDefinitionKey: String): List<CaseConfigurationDeclaration>
}
