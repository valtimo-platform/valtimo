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

package com.ritense.zakenapi.uploadprocess

import com.ritense.case_.service.ActiveCaseDefinitionService
import com.ritense.processdocument.service.CaseDefinitionProcessLinkService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import java.util.UUID

class UploadProcessResourceTest {

    private lateinit var activeCaseDefinitionService: ActiveCaseDefinitionService
    private lateinit var caseDefinitionProcessLinkService: CaseDefinitionProcessLinkService
    private lateinit var uploadProcessService: UploadProcessService
    private lateinit var uploadProcessResource: UploadProcessResource

    @BeforeEach
    fun beforeEach() {
        activeCaseDefinitionService = mock()
        caseDefinitionProcessLinkService = mock()
        uploadProcessService = mock()
        uploadProcessResource = UploadProcessResource(
            activeCaseDefinitionService,
            caseDefinitionProcessLinkService,
            uploadProcessService,
        )
    }

    @Test
    fun `should add the resource to the document`() {
        val response = uploadProcessResource.startUploadResourceProcess(DOCUMENT_ID, RESOURCE_ID)

        verify(uploadProcessService).startUploadResourceProcess(eq(DOCUMENT_ID), eq(RESOURCE_ID))
        assertThat(response.statusCode.value()).isEqualTo(204)
    }

    companion object {
        private const val RESOURCE_ID = "1234567890"
        private val DOCUMENT_ID: UUID = UUID.randomUUID()
    }
}
