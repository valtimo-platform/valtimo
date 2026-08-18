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

package com.ritense.case.service

import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.authorization.specification.AuthorizationSpecification
import com.ritense.case.domain.CaseTab
import com.ritense.case.domain.CaseTabId
import com.ritense.case.domain.CaseTabType
import com.ritense.case.repository.CaseTabRepository
import com.ritense.case.service.exception.InvalidTabContentKeyException
import com.ritense.case.web.rest.dto.CaseTabDto
import com.ritense.case.web.rest.dto.CaseTabUpdateDto
import com.ritense.case.web.rest.dto.CaseTabUpdateOrderDto
import com.ritense.case_.service.event.CaseTabCreatedEvent
import com.ritense.case_.service.event.CaseTabUpdatedEvent
import com.ritense.document.service.DocumentDefinitionService
import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationEventPublisher
import org.springframework.data.domain.Sort
import org.springframework.data.jpa.domain.Specification
import java.util.Optional
import java.util.UUID


@ExtendWith(MockitoExtension::class)
class CaseTabServiceTest(
    @Mock private val caseTabRepository: CaseTabRepository,
    @Mock private val documentDefinitionService: DocumentDefinitionService,
    @Mock private val authorizationService: AuthorizationService,
    @Mock private val applicationEventPublisher: ApplicationEventPublisher,
    @Mock private val userManagementService: UserManagementService,
    @Mock private val documentService: DocumentService
) {
    private lateinit var caseTabService: CaseTabService

    @BeforeEach
    fun before() {
        caseTabService = CaseTabService(
            caseTabRepository,
            documentDefinitionService,
            authorizationService,
            applicationEventPublisher,
            userManagementService,
            documentService,
            mock(),
        )
    }

    @Test
    fun `should publish create event`() {
        val caseDefinitionId = CaseDefinitionId.of("myCaseDefinitionName", "1.0.0")

        val caseTab = CaseTab(CaseTabId(caseDefinitionId, "myKey"), "myName", 0, CaseTabType.WIDGETS, "myContentKey")

        whenever(documentDefinitionService.findByBlueprintId(caseDefinitionId)).thenReturn(Optional.of(mock()))
        val specMock = mock<AuthorizationSpecification<CaseTab>>()
        whenever(specMock.and(any())).thenReturn(specMock)
        whenever(authorizationService.getAuthorizationSpecification(any<EntityAuthorizationRequest<CaseTab>>(), anyOrNull())).thenReturn(specMock)
        whenever(caseTabRepository.findAll(any<AuthorizationSpecification<CaseTab>>(), any<Sort>())).thenReturn(emptyList())
        whenever(caseTabRepository.save(any<CaseTab>())).thenReturn(caseTab)


        caseTabService.createCaseTab(caseDefinitionId, CaseTabDto.of(caseTab))

        verify(applicationEventPublisher).publishEvent(eq(CaseTabCreatedEvent(caseTab)))
    }

    @Test
    fun `should reject creation of an EXTERNAL_PLUGIN tab with a malformed contentKey`() {
        val caseDefinitionId = CaseDefinitionId.of("myCaseDefinitionName", "1.0.0")
        val caseTabDto = CaseTabDto(
            key = "myKey",
            name = "myName",
            type = CaseTabType.EXTERNAL_PLUGIN,
            contentKey = "not-a-uuid:overview"
        )

        val specMock = mock<AuthorizationSpecification<CaseTab>>()
        whenever(specMock.and(any())).thenReturn(specMock)
        whenever(authorizationService.getAuthorizationSpecification(any<EntityAuthorizationRequest<CaseTab>>(), anyOrNull())).thenReturn(specMock)
        whenever(caseTabRepository.findAll(any<AuthorizationSpecification<CaseTab>>(), any<Sort>())).thenReturn(emptyList())

        assertThatThrownBy { caseTabService.createCaseTab(caseDefinitionId, caseTabDto) }
            .isInstanceOf(InvalidTabContentKeyException::class.java)

        verify(caseTabRepository, never()).save(any())
        verify(applicationEventPublisher, never()).publishEvent(any<CaseTabCreatedEvent>())
    }

    @Test
    fun `should create an EXTERNAL_PLUGIN tab with a valid contentKey`() {
        val caseDefinitionId = CaseDefinitionId.of("myCaseDefinitionName", "1.0.0")
        val caseTab = CaseTab(
            CaseTabId(caseDefinitionId, "myKey"),
            "myName",
            0,
            CaseTabType.EXTERNAL_PLUGIN,
            "${UUID.randomUUID()}:overview"
        )

        val specMock = mock<AuthorizationSpecification<CaseTab>>()
        whenever(specMock.and(any())).thenReturn(specMock)
        whenever(authorizationService.getAuthorizationSpecification(any<EntityAuthorizationRequest<CaseTab>>(), anyOrNull())).thenReturn(specMock)
        whenever(caseTabRepository.findAll(any<AuthorizationSpecification<CaseTab>>(), any<Sort>())).thenReturn(emptyList())
        whenever(caseTabRepository.save(any<CaseTab>())).thenReturn(caseTab)

        caseTabService.createCaseTab(caseDefinitionId, CaseTabDto.of(caseTab))

        verify(applicationEventPublisher).publishEvent(eq(CaseTabCreatedEvent(caseTab)))
    }

    @Test
    fun `should reject update of an EXTERNAL_PLUGIN tab with a malformed contentKey`() {
        val caseDefinitionId = CaseDefinitionId.of("myCaseDefinitionName", "1.0.0")
        val updateDto = CaseTabUpdateDto(
            name = "myName",
            type = CaseTabType.EXTERNAL_PLUGIN,
            contentKey = "not-a-uuid"
        )

        assertThatThrownBy { caseTabService.updateCaseTab(caseDefinitionId, "myKey", updateDto) }
            .isInstanceOf(InvalidTabContentKeyException::class.java)

        verify(caseTabRepository, never()).save(any())
        verify(applicationEventPublisher, never()).publishEvent(any<CaseTabUpdatedEvent>())
    }

    @Test
    fun `should publish update events when updating tab order`() {
        val caseDefinitionId = CaseDefinitionId.of("myCaseDefinitionName", "1.0.0")
        val existingTab = CaseTab(CaseTabId(caseDefinitionId, "myKey"), "myName", 0, CaseTabType.WIDGETS, "myContentKey")
        val updateDto = CaseTabUpdateOrderDto(
            key = "myKey",
            name = "myName",
            type = CaseTabType.STANDARD,
            contentKey = "myContentKey"
        )

        whenever(caseTabRepository.findAll(any<Specification<CaseTab>>())).thenReturn(listOf(existingTab))
        whenever(caseTabRepository.saveAll(any<List<CaseTab>>())).thenAnswer { it.arguments[0] }

        caseTabService.updateCaseTabs(caseDefinitionId, listOf(updateDto))

        verify(applicationEventPublisher).publishEvent(any<CaseTabUpdatedEvent>())
    }

    @Test
    fun `should reject tab order update containing an EXTERNAL_PLUGIN tab with a malformed contentKey`() {
        val caseDefinitionId = CaseDefinitionId.of("myCaseDefinitionName", "1.0.0")
        val existingTab = CaseTab(CaseTabId(caseDefinitionId, "myKey"), "myName", 0, CaseTabType.WIDGETS, "myContentKey")
        val updateDto = CaseTabUpdateOrderDto(
            key = "myKey",
            name = "myName",
            type = CaseTabType.EXTERNAL_PLUGIN,
            contentKey = "not-a-uuid"
        )

        whenever(caseTabRepository.findAll(any<Specification<CaseTab>>())).thenReturn(listOf(existingTab))

        assertThatThrownBy { caseTabService.updateCaseTabs(caseDefinitionId, listOf(updateDto)) }
            .isInstanceOf(InvalidTabContentKeyException::class.java)

        verify(caseTabRepository, never()).saveAll(any<List<CaseTab>>())
        verify(applicationEventPublisher, never()).publishEvent(any<CaseTabUpdatedEvent>())
    }
}