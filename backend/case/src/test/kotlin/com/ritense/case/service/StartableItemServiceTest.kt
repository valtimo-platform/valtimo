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

import com.ritense.case.repository.StartableItemRepository
import com.ritense.case.web.rest.dto.StartableItemDto
import com.ritense.case.web.rest.dto.StartableItemType
import com.ritense.document.service.DocumentService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

class StartableItemServiceTest {

    private lateinit var startableItemProvider: StartableItemProvider
    private lateinit var startableItemRepository: StartableItemRepository
    private lateinit var documentService: DocumentService
    private lateinit var caseDefinitionService: CaseDefinitionService
    private lateinit var service: StartableItemService

    @BeforeEach
    fun setUp() {
        startableItemProvider = mock()
        startableItemRepository = mock()
        documentService = mock()
        caseDefinitionService = mock()

        whenever(startableItemRepository.findAllByIdCaseDefinitionId(any())).thenReturn(emptyList())

        service = StartableItemService(
            startableItemProviders = listOf(startableItemProvider),
            startableItemRepository = startableItemRepository,
            documentService = documentService,
            caseDefinitionService = caseDefinitionService,
        )
    }

    @Test
    fun `should exclude items that are not startable by user`() {
        whenever(startableItemProvider.getStartableItems(any(), anyOrNull())).thenReturn(
            listOf(
                StartableItemDto(
                    type = StartableItemType.BUILDING_BLOCK,
                    name = "Visible",
                    key = "visible-block",
                    versionTag = "1.0.0"
                ),
                StartableItemDto(
                    type = StartableItemType.BUILDING_BLOCK,
                    name = "Hidden",
                    key = "hidden-block",
                    versionTag = "1.0.0",
                    startableByUser = false
                )
            )
        )

        val result = service.getStartableItems(
            caseDefinitionKey = "my-case",
            caseDefinitionVersionTag = "1.0.0"
        )

        assertThat(result).extracting("key").containsExactly("visible-block")
    }
}
