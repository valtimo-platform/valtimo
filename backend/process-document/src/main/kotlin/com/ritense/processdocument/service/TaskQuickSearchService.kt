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

package com.ritense.processdocument.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.authorization.CaseDefinitionActionProvider
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.processdocument.domain.TaskQuickSearch
import com.ritense.processdocument.repository.TaskQuickSearchRepository
import com.ritense.processdocument.web.request.TaskQuickSearchDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Transactional(readOnly = true)
@Service
@SkipComponentScan
class TaskQuickSearchService(
    private val taskQuickSearchRepository: TaskQuickSearchRepository,
    private val caseDefinitionService: CaseDefinitionService,
    private val authorizationService: AuthorizationService,
) {

    @Transactional
    fun storeQuickSearch(
        caseDefinitionKey: String,
        request: TaskQuickSearchDto,
        currentUserId: String,
    ) {
        requireViewListPermission(caseDefinitionKey)

        require(
            !taskQuickSearchRepository.existsByCaseDefinitionKeyAndUserIdAndTitle(
                caseDefinitionKey = caseDefinitionKey,
                userId = currentUserId,
                title = request.title
            )
        ) {
            "Failed to create task quick search. A quick search for this user, for this case definition key, " +
                "with this title, already exists."
        }

        taskQuickSearchRepository.save(
            TaskQuickSearch(
                queryPath = request.queryPath,
                title = request.title,
                caseDefinitionKey = caseDefinitionKey,
                userId = currentUserId,
            )
        )
    }

    @Transactional
    fun deleteQuickSearch(
        caseDefinitionKey: String,
        currentUserId: String,
        quickSearchTitle: String,
    ) {
        requireViewListPermission(caseDefinitionKey)

        require(
            taskQuickSearchRepository.existsByCaseDefinitionKeyAndUserIdAndTitle(
                caseDefinitionKey = caseDefinitionKey,
                userId = currentUserId,
                title = quickSearchTitle
            )
        ) {
            "Failed to delete task quick search. No quick search for this user, for this case definition key, " +
                "with this title, was found."
        }

        taskQuickSearchRepository.deleteByCaseDefinitionKeyAndUserIdAndTitle(
            caseDefinitionKey,
            currentUserId,
            quickSearchTitle
        )
    }

    fun getQuickSearchList(caseDefinitionKey: String, currentUserId: String): List<TaskQuickSearch> {
        requireViewListPermission(caseDefinitionKey)
        return taskQuickSearchRepository.findAllByCaseDefinitionKeyAndUserId(caseDefinitionKey, currentUserId)
    }

    private fun requireViewListPermission(caseDefinitionKey: String) {
        val caseDefinition = runWithoutAuthorization {
            caseDefinitionService.getActiveCaseDefinition(caseDefinitionKey)
        }
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                CaseDefinition::class.java,
                CaseDefinitionActionProvider.VIEW_LIST,
                caseDefinition
            )
        )
    }
}
