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

package com.ritense.processdocument.repository

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationEntityMapperResult
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.valtimo.operaton.domain.OperatonExecution
import jakarta.persistence.EntityManager
import jakarta.persistence.criteria.Predicate
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

@Transactional
internal class OperatonExecutionCaseDefinitionMapperIntTest : BaseIntegrationTest() {

    @Autowired
    private lateinit var mapper: OperatonExecutionCaseDefinitionMapper

    @Autowired
    private lateinit var processDocumentService: ProcessDocumentService

    @Autowired
    private lateinit var objectMapper: ObjectMapper

    @Autowired
    private lateinit var entityManager: EntityManager

    @Test
    fun `mapQuery should find execution linked to case definition via process-document-link`() {
        val result = runWithoutAuthorization {
            processDocumentService.newDocumentAndStartProcess(
                NewDocumentAndStartProcessRequest(
                    "single-user-task-process",
                    NewDocumentRequest(
                        "house",
                        "house",
                        "1.0.0",
                        objectMapper.readTree("""{"city":"Amsterdam"}""")
                    )
                )
            )
        }

        val processInstanceId = result.resultingProcessInstanceId().get().toString()

        val executions = findExecutionsWithCaseDefinitionKey("house", processInstanceId)

        assertThat(executions).isNotEmpty
    }

    @Test
    fun `mapQuery should not find execution when case definition key does not match`() {
        val result = runWithoutAuthorization {
            processDocumentService.newDocumentAndStartProcess(
                NewDocumentAndStartProcessRequest(
                    "single-user-task-process",
                    NewDocumentRequest(
                        "house",
                        "house",
                        "1.0.0",
                        objectMapper.readTree("""{"city":"Amsterdam"}""")
                    )
                )
            )
        }

        val processInstanceId = result.resultingProcessInstanceId().get().toString()

        val executions = findExecutionsWithCaseDefinitionKey("non-existent-case", processInstanceId)

        assertThat(executions).isEmpty()
    }

    private fun findExecutionsWithCaseDefinitionKey(
        caseDefinitionKey: String,
        processInstanceId: String
    ): List<OperatonExecution> {
        val cb = entityManager.criteriaBuilder
        val cq = cb.createQuery(OperatonExecution::class.java)
        val root = cq.from(OperatonExecution::class.java)

        val mapperResult: AuthorizationEntityMapperResult<CaseDefinition> =
            mapper.mapQuery(root, cq, cb)

        val cd = mapperResult.root
        val sub = mapperResult.query

        val caseKeyPredicate: Predicate = cb.equal(cd.get<Any>("id").get<String>("key"), caseDefinitionKey)

        val existing = (sub as jakarta.persistence.criteria.Subquery<*>).restriction
        if (existing != null) {
            sub.where(cb.and(existing, caseKeyPredicate))
        } else {
            sub.where(caseKeyPredicate)
        }

        cq.where(
            cb.and(
                mapperResult.joinPredicate,
                cb.equal(
                    root.get<Any>("processInstance").get<String>("id"),
                    processInstanceId
                )
            )
        )

        return entityManager.createQuery(cq).resultList
    }
}
