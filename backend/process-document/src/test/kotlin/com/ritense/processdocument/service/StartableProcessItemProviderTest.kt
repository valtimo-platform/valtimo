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

import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.AuthorizationSupportedHelper
import com.ritense.case.web.rest.dto.StartableItemType
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinitionId
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationContext
import org.springframework.core.ResolvableType

class StartableProcessItemProviderTest {

    private lateinit var repository: ProcessDefinitionCaseDefinitionRepository
    private lateinit var authorizationService: AuthorizationService
    private lateinit var provider: StartableProcessItemProvider

    private val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")

    @BeforeEach
    fun setUp() {
        repository = mock()
        authorizationService = mock()

        val applicationContext = mock<ApplicationContext>()
        whenever(applicationContext.getBeanNamesForType(any<ResolvableType>()))
            .thenReturn(arrayOf("mockBean"))
        AuthorizationSupportedHelper.setApplicationContext(applicationContext)

        whenever(authorizationService.hasPermission<Any>(any())).thenReturn(true)

        provider = StartableProcessItemProvider(
            processDefinitionCaseDefinitionRepository = repository,
            authorizationService = authorizationService
        )
    }

    @Test
    fun `should return PROCESS as type`() {
        assertThat(provider.type).isEqualTo(StartableItemType.PROCESS)
    }

    @Test
    fun `should get startable items that are startable by user regardless of canInitializeDocument`() {
        val pdcdId = ProcessDefinitionCaseDefinitionId(
            processDefinitionId = ProcessDefinitionId("process:1"),
            caseDefinitionId = caseDefinitionId
        )
        val pdcd = ProcessDefinitionCaseDefinition(
            id = pdcdId,
            canInitializeDocument = false,
            startableByUser = true
        ).apply {
            processDefinitionName = "My Process"
            processDefinitionKey = "my-process"
        }

        val pdcdId2 = ProcessDefinitionCaseDefinitionId(
            processDefinitionId = ProcessDefinitionId("process:2"),
            caseDefinitionId = caseDefinitionId
        )
        val pdcd2 = ProcessDefinitionCaseDefinition(
            id = pdcdId2,
            canInitializeDocument = true,
            startableByUser = true
        ).apply {
            processDefinitionName = "Dossier Starter Process"
            processDefinitionKey = "dossier-starter-process"
        }

        whenever(repository.findAll(caseDefinitionId, startableByUser = true, canInitializeDocument = null))
            .thenReturn(listOf(pdcd, pdcd2))

        val result = provider.getStartableItems(caseDefinitionId)

        assertThat(result).hasSize(2)
        assertThat(result[0].type).isEqualTo(StartableItemType.PROCESS)
        assertThat(result[0].name).isEqualTo("My Process")
        assertThat(result[0].key).isEqualTo("my-process")
        assertThat(result[0].processDefinitionId).isEqualTo("process:1")
        assertThat(result[0].versionTag).isNull()
        assertThat(result[1].type).isEqualTo(StartableItemType.PROCESS)
        assertThat(result[1].name).isEqualTo("Dossier Starter Process")
        assertThat(result[1].key).isEqualTo("dossier-starter-process")
        assertThat(result[1].processDefinitionId).isEqualTo("process:2")
    }

    @Test
    fun `should filter items without execution permission`() {
        val pdcdId = ProcessDefinitionCaseDefinitionId(
            processDefinitionId = ProcessDefinitionId("process:1"),
            caseDefinitionId = caseDefinitionId
        )
        val pdcd = ProcessDefinitionCaseDefinition(
            id = pdcdId,
            canInitializeDocument = false,
            startableByUser = true
        ).apply {
            processDefinitionName = "Unauthorized Process"
            processDefinitionKey = "unauthorized-process"
        }

        whenever(repository.findAll(caseDefinitionId, startableByUser = true, canInitializeDocument = null))
            .thenReturn(listOf(pdcd))
        whenever(authorizationService.hasPermission<Any>(any())).thenReturn(false)

        val result = provider.getStartableItems(caseDefinitionId)

        assertThat(result).isEmpty()
    }

    @Test
    fun `should create item by setting startableByUser to true`() {
        val objectMapper = MapperSingleton.get()
        val properties = objectMapper.readTree("""{"processDefinitionId": "process:1"}""")

        val pdcdId = ProcessDefinitionCaseDefinitionId(
            processDefinitionId = ProcessDefinitionId("process:1"),
            caseDefinitionId = caseDefinitionId
        )
        val pdcd = ProcessDefinitionCaseDefinition(
            id = pdcdId,
            canInitializeDocument = false,
            startableByUser = false
        ).apply {
            processDefinitionName = "My Process"
            processDefinitionKey = "my-process"
        }

        whenever(repository.findAllByIdCaseDefinitionIdAndIdProcessDefinitionIdId(caseDefinitionId, "process:1"))
            .thenReturn(listOf(pdcd))
        whenever(repository.save(any<ProcessDefinitionCaseDefinition>()))
            .thenAnswer { it.arguments[0] }

        val result = provider.createItem(caseDefinitionId, properties)

        assertThat(result.type).isEqualTo(StartableItemType.PROCESS)
        assertThat(result.key).isEqualTo("my-process")
        assertThat(result.name).isEqualTo("My Process")
        assertThat(result.processDefinitionId).isEqualTo("process:1")

        verify(repository).save(any<ProcessDefinitionCaseDefinition>())
    }

    @Test
    fun `should throw when creating item without processDefinitionId`() {
        val objectMapper = MapperSingleton.get()
        val properties = objectMapper.readTree("""{}""")

        assertThrows<IllegalArgumentException> {
            provider.createItem(caseDefinitionId, properties)
        }
    }

    @Test
    fun `should throw when creating item for unlinked process definition`() {
        val objectMapper = MapperSingleton.get()
        val properties = objectMapper.readTree("""{"processDefinitionId": "non-existent"}""")

        whenever(repository.findAllByIdCaseDefinitionIdAndIdProcessDefinitionIdId(caseDefinitionId, "non-existent"))
            .thenReturn(emptyList())

        assertThrows<NoSuchElementException> {
            provider.createItem(caseDefinitionId, properties)
        }
    }

    @Test
    fun `should delete item by setting startableByUser to false`() {
        val pdcdId = ProcessDefinitionCaseDefinitionId(
            processDefinitionId = ProcessDefinitionId("process:1"),
            caseDefinitionId = caseDefinitionId
        )
        val pdcd = ProcessDefinitionCaseDefinition(
            id = pdcdId,
            canInitializeDocument = false,
            startableByUser = true
        ).apply {
            processDefinitionKey = "my-process"
        }

        whenever(repository.findByIdCaseDefinitionId(caseDefinitionId)).thenReturn(listOf(pdcd))
        whenever(repository.save(any<ProcessDefinitionCaseDefinition>())).thenAnswer { it.arguments[0] }

        provider.deleteItem(caseDefinitionId, "my-process", "0")

        verify(repository).save(any<ProcessDefinitionCaseDefinition>())
    }

    @Test
    fun `should not fail when deleting non-existent process definition key`() {
        whenever(repository.findByIdCaseDefinitionId(caseDefinitionId)).thenReturn(emptyList())

        // Should not throw - just does nothing
        provider.deleteItem(caseDefinitionId, "non-existent", "0")
    }
}
