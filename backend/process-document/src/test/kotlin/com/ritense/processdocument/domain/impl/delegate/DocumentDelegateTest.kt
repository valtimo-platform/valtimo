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

package com.ritense.processdocument.domain.impl.delegate

import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.OauthConfigHolder
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.authentication.model.ValtimoUserBuilder
import com.ritense.valtimo.contract.config.ValtimoProperties.Oauth
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.springframework.boot.test.system.CapturedOutput
import org.springframework.boot.test.system.OutputCaptureExtension
import java.util.Optional
import java.util.UUID

@ExtendWith(OutputCaptureExtension::class)
internal class DocumentDelegateTest {

    lateinit var userManagementService: UserManagementService
    lateinit var documentService: DocumentService
    lateinit var caseDocumentResolver: CaseDocumentResolver
    lateinit var documentDelegate: DocumentDelegate

    @BeforeEach
    fun beforeEach() {
        userManagementService = mock()
        documentService = mock()
        caseDocumentResolver = mock()
        whenever(caseDocumentResolver.resolveCaseDocumentId(any())).thenAnswer { it.arguments[0] }
        documentDelegate = DocumentDelegate(
            userManagementService,
            documentService,
            caseDocumentResolver,
        )
        OauthConfigHolder(Oauth())
    }

    @Test
    fun `should assign user to document`() {
        val documentId = "11111111-1111-1111-1111-111111111111"
        val processInstanceId = "00000000-0000-0000-0000-000000000000"
        val delegateExecution = mock<DelegateExecution>()
        whenever(delegateExecution.id).thenReturn("id")
        whenever(delegateExecution.processInstanceId).thenReturn(processInstanceId)
        whenever(delegateExecution.businessKey).thenReturn(documentId)
        val user = ValtimoUserBuilder().id("anId").build()
        whenever(userManagementService.findByEmail("john@example.com")).thenReturn(Optional.of(user))
        whenever(userManagementService.findById("anId")).thenReturn(user)

        documentDelegate.setAssignee(delegateExecution, "john@example.com")

        verify(documentService, times(1)).assignUserToDocument(UUID.fromString(documentId), "anId")
    }

    @Test
    fun `should skip assigning the case when the user no longer exists`(output: CapturedOutput) {
        val documentId = "11111111-1111-1111-1111-111111111111"
        val delegateExecution = mock<DelegateExecution>()
        whenever(delegateExecution.id).thenReturn("id")
        whenever(delegateExecution.processInstanceId).thenReturn("00000000-0000-0000-0000-000000000000")
        whenever(delegateExecution.businessKey).thenReturn(documentId)
        whenever(userManagementService.findByEmail("removed@example.com")).thenReturn(Optional.empty())

        documentDelegate.setAssignee(delegateExecution, "removed@example.com")

        verify(documentService, never()).assignUserToDocument(any(), any())
        verify(documentService, never()).unassignUserFromDocument(any())
        assertThat(output.out).contains("User 'removed@example.com' could not be found.")
    }

    @Test
    fun `should skip assigning the case when the user is disabled`(output: CapturedOutput) {
        val documentId = "11111111-1111-1111-1111-111111111111"
        val delegateExecution = mock<DelegateExecution>()
        whenever(delegateExecution.id).thenReturn("id")
        whenever(delegateExecution.processInstanceId).thenReturn("00000000-0000-0000-0000-000000000000")
        whenever(delegateExecution.businessKey).thenReturn(documentId)
        whenever(userManagementService.findByEmail("disabled@example.com"))
            .thenReturn(Optional.of(ValtimoUserBuilder().id("disabledId").build()))
        whenever(userManagementService.findById("disabledId")).thenReturn(null)

        documentDelegate.setAssignee(delegateExecution, "disabled@example.com")

        verify(documentService, never()).assignUserToDocument(any(), any())
        assertThat(output.out).contains("User 'disabled@example.com' could not be found.")
    }

    @Test
    fun `should unassign user from document`() {
        val documentId = "11111111-1111-1111-1111-111111111111"
        val processInstanceId = "00000000-0000-0000-0000-000000000000"
        val delegateExecution = mock<DelegateExecution>()
        whenever(delegateExecution.id).thenReturn("id")
        whenever(delegateExecution.processInstanceId).thenReturn(processInstanceId)
        whenever(delegateExecution.businessKey).thenReturn(documentId)

        documentDelegate.unassign(delegateExecution)

        verify(documentService, times(1)).unassignUserFromDocument(UUID.fromString(documentId))
    }
}
