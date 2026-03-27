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

import com.ritense.authorization.AuthorizationEntityMapper
import com.ritense.authorization.AuthorizationService
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinitionId
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.document.DocumentCaseDefinitionPredicateProvider
import com.ritense.valtimo.contract.database.QueryDialectHelper
import com.ritense.valtimo.operaton.domain.OperatonExecution
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class OperatonExecutionCaseDefinitionMapperTest {

    private lateinit var processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository
    private lateinit var caseDefinitionService: CaseDefinitionService
    private lateinit var executionDocumentMapper: OperatonExecutionJsonSchemaDocumentMapper
    private lateinit var authorizationService: AuthorizationService
    private lateinit var queryDialectHelper: QueryDialectHelper
    private lateinit var documentCaseDefinitionPredicateProvider: DocumentCaseDefinitionPredicateProvider
    private lateinit var mapper: OperatonExecutionCaseDefinitionMapper

    @BeforeEach
    fun setUp() {
        processDefinitionCaseDefinitionRepository = mock()
        caseDefinitionService = mock()
        executionDocumentMapper = mock()
        authorizationService = mock()
        queryDialectHelper = mock()
        documentCaseDefinitionPredicateProvider = mock()
        mapper = OperatonExecutionCaseDefinitionMapper(
            processDefinitionCaseDefinitionRepository,
            caseDefinitionService,
            executionDocumentMapper,
            authorizationService,
            queryDialectHelper,
            documentCaseDefinitionPredicateProvider,
        )
    }

    @Test
    fun `supports should return true for OperatonExecution to CaseDefinition`() {
        assertTrue(mapper.supports(OperatonExecution::class.java, CaseDefinition::class.java))
    }

    @Test
    fun `supports should return false for other class combinations`() {
        assertFalse(mapper.supports(JsonSchemaDocument::class.java, CaseDefinition::class.java))
        assertFalse(mapper.supports(OperatonExecution::class.java, JsonSchemaDocument::class.java))
    }

    @Test
    fun `mapRelated should return case definition via ProcessDefinitionCaseDefinition link`() {
        val processDefinition = mock<OperatonProcessDefinition>()
        whenever(processDefinition.id).thenReturn("proc-def-id")

        val execution = mock<OperatonExecution>()
        whenever(execution.processDefinition).thenReturn(processDefinition)

        val caseDefinitionId = mock<CaseDefinitionId>()
        val link = mock<ProcessDefinitionCaseDefinition>()
        val linkId = mock<ProcessDefinitionCaseDefinitionId>()
        whenever(link.id).thenReturn(linkId)
        whenever(linkId.caseDefinitionId).thenReturn(caseDefinitionId)

        whenever(
            processDefinitionCaseDefinitionRepository.findByIdProcessDefinitionId(
                ProcessDefinitionId("proc-def-id")
            )
        ).thenReturn(link)

        val caseDefinition = mock<CaseDefinition>()
        whenever(caseDefinitionService.getCaseDefinition(caseDefinitionId)).thenReturn(caseDefinition)

        val result = mapper.mapRelated(execution)

        assertEquals(1, result.size)
        assertEquals(caseDefinition, result[0])
        verify(executionDocumentMapper, never()).mapRelated(any())
    }

    @Test
    fun `mapRelated should fall back to document path when no ProcessDefinitionCaseDefinition link exists`() {
        val processDefinition = mock<OperatonProcessDefinition>()
        whenever(processDefinition.id).thenReturn("proc-def-id")

        val execution = mock<OperatonExecution>()
        whenever(execution.processDefinition).thenReturn(processDefinition)

        whenever(
            processDefinitionCaseDefinitionRepository.findByIdProcessDefinitionId(
                ProcessDefinitionId("proc-def-id")
            )
        ).thenReturn(null)

        val document = mock<JsonSchemaDocument>()
        whenever(executionDocumentMapper.mapRelated(execution)).thenReturn(listOf(document))

        val docCdMapper = mock<AuthorizationEntityMapper<JsonSchemaDocument, CaseDefinition>>()
        whenever(
            authorizationService.getMapper(JsonSchemaDocument::class.java, CaseDefinition::class.java)
        ).thenReturn(docCdMapper)

        val caseDefinition = mock<CaseDefinition>()
        whenever(docCdMapper.mapRelated(document)).thenReturn(listOf(caseDefinition))

        val result = mapper.mapRelated(execution)

        assertEquals(1, result.size)
        assertEquals(caseDefinition, result[0])
    }

    @Test
    fun `mapRelated should fall back to document path when processDefinition is null`() {
        val execution = mock<OperatonExecution>()
        whenever(execution.processDefinition).thenReturn(null)

        val document = mock<JsonSchemaDocument>()
        whenever(executionDocumentMapper.mapRelated(execution)).thenReturn(listOf(document))

        val docCdMapper = mock<AuthorizationEntityMapper<JsonSchemaDocument, CaseDefinition>>()
        whenever(
            authorizationService.getMapper(JsonSchemaDocument::class.java, CaseDefinition::class.java)
        ).thenReturn(docCdMapper)

        val caseDefinition = mock<CaseDefinition>()
        whenever(docCdMapper.mapRelated(document)).thenReturn(listOf(caseDefinition))

        val result = mapper.mapRelated(execution)

        assertEquals(1, result.size)
        assertEquals(caseDefinition, result[0])
        verify(processDefinitionCaseDefinitionRepository, never()).findByIdProcessDefinitionId(any())
    }

    @Test
    fun `mapRelated should return empty list when document path yields no results`() {
        val execution = mock<OperatonExecution>()
        whenever(execution.processDefinition).thenReturn(null)

        whenever(executionDocumentMapper.mapRelated(execution)).thenReturn(emptyList())

        val docCdMapper = mock<AuthorizationEntityMapper<JsonSchemaDocument, CaseDefinition>>()
        whenever(
            authorizationService.getMapper(JsonSchemaDocument::class.java, CaseDefinition::class.java)
        ).thenReturn(docCdMapper)

        val result = mapper.mapRelated(execution)

        assertTrue(result.isEmpty())
    }
}
