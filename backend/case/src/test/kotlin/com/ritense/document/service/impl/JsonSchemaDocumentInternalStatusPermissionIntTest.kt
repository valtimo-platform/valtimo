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

package com.ritense.document.service.impl

import com.ritense.BaseIntegrationTest
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.condition.FieldPermissionCondition
import com.ritense.authorization.permission.condition.PermissionConditionOperator
import com.ritense.authorization.permission.condition.PermissionConditionOperator.EQUAL_TO
import com.ritense.authorization.permission.condition.PermissionConditionOperator.NOT_EQUAL_TO
import com.ritense.document.domain.impl.JsonDocumentContent
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.JsonSchemaDocumentActionProvider.VIEW
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.USER
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * A new case has no internal status until one is set explicitly. Permission conditions on the internal status must
 * treat that as a null value instead of failing on the missing relation.
 */
@Tag("integration")
@Transactional
internal class JsonSchemaDocumentInternalStatusPermissionIntTest : BaseIntegrationTest() {

    @Test
    @WithMockUser(username = USERNAME, authorities = [USER])
    fun `should view case without internal status when condition excludes another status`() {
        setUpViewPermission(NOT_EQUAL_TO, "closed")
        val document = createCaseWithoutStatus()
        assertThat(document.internalStatus()).isNull()

        val result = documentService.getDocumentBy(document.id())

        assertThat(result.id()).isEqualTo(document.id())
    }

    @Test
    @WithMockUser(username = USERNAME, authorities = [USER])
    fun `should deny viewing case without internal status when condition requires a status`() {
        setUpViewPermission(EQUAL_TO, "started")
        val document = createCaseWithoutStatus()
        assertThat(document.internalStatus()).isNull()

        assertThatThrownBy { documentService.getDocumentBy(document.id()) }
            .isExactlyInstanceOf(AccessDeniedException::class.java)
    }

    @Test
    @WithMockUser(username = USERNAME, authorities = [USER])
    fun `should view case once the required internal status is set`() {
        setUpViewPermission(EQUAL_TO, "started")
        val document = createCaseWithoutStatus()
        runWithoutAuthorization { documentService.setInternalStatus(document.id(), "started") }

        val result = documentService.getDocumentBy(document.id())

        assertThat(result.internalStatus()).isEqualTo("started")
    }

    @Test
    @WithMockUser(username = USERNAME, authorities = [USER])
    fun `should view case without internal status when condition requires no status`() {
        setUpViewPermission(EQUAL_TO, null)
        val document = createCaseWithoutStatus()

        val result = documentService.getDocumentBy(document.id())

        assertThat(result.id()).isEqualTo(document.id())
    }

    private fun setUpViewPermission(operator: PermissionConditionOperator, statusKey: String?) {
        permissionRepository.deleteAll()
        permissionRepository.saveAndFlush(
            Permission(
                UUID.randomUUID(),
                JsonSchemaDocument::class.java,
                mutableListOf(VIEW),
                ConditionContainer(listOf(FieldPermissionCondition("internalStatus.id.key", operator, statusKey))),
                roleRepository.findByKey(USER)!!
            )
        )
    }

    private fun createCaseWithoutStatus(): JsonSchemaDocument {
        val definition = definition()
        return runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(
                    definition.id().name(),
                    definition.id().caseDefinitionId().key,
                    definition.id().caseDefinitionId().versionTag.version,
                    JsonDocumentContent("""{"street": "Funenpark"}""").asJson()
                )
            )
        }.resultingDocument().orElseThrow() as JsonSchemaDocument
    }

    companion object {
        private const val USERNAME = "john@ritense.com"
    }
}
