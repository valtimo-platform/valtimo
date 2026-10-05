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

package com.ritense.case_.caseconfiguration.service

import com.ritense.authorization.AuthorizationService
import com.ritense.case.repository.CaseDefinitionConfigurationIssueRepository
import com.ritense.case.service.CaseDefinitionCheckerImpl
import com.ritense.case_.caseconfiguration.domain.CaseConfigurationDeclaration
import com.ritense.case_.caseconfiguration.domain.CaseConfigurationDeclarationId
import com.ritense.case_.caseconfiguration.domain.CaseConfigurationEnvironmentValue
import com.ritense.case_.caseconfiguration.domain.CaseConfigurationEnvironmentValueId
import com.ritense.case_.caseconfiguration.exception.CaseConfigurationAlreadyExistsException
import com.ritense.case_.caseconfiguration.exception.CaseConfigurationNotFoundException
import com.ritense.case_.caseconfiguration.repository.CaseConfigurationDeclarationRepository
import com.ritense.case_.caseconfiguration.repository.CaseConfigurationEnvironmentValueRepository
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.core.env.Environment
import java.time.LocalDateTime
import java.util.Optional

class CaseConfigurationServiceTest {

    private val caseDefinitionId = CaseDefinitionId.of("mail-case", "1.0.0")

    private lateinit var declarationRepository: CaseConfigurationDeclarationRepository
    private lateinit var environmentValueRepository: CaseConfigurationEnvironmentValueRepository
    private lateinit var caseDefinitionRepository: CaseDefinitionRepository
    private lateinit var environment: Environment

    @BeforeEach
    fun setUp() {
        declarationRepository = mock()
        environmentValueRepository = mock()
        caseDefinitionRepository = mock()
        environment = mock()
        whenever(declarationRepository.save(any<CaseConfigurationDeclaration>())).doAnswer { it.arguments[0] as CaseConfigurationDeclaration }
        whenever(environmentValueRepository.save(any<CaseConfigurationEnvironmentValue>())).doAnswer { it.arguments[0] as CaseConfigurationEnvironmentValue }
    }

    @Test
    fun `should create a declaration on an editable draft`() {
        val service = service(draftEnvironment = true, final = false)

        service.createDeclaration(caseDefinitionId, "notificationEmail", "test@example.com")

        val captor = argumentCaptor<CaseConfigurationDeclaration>()
        verify(declarationRepository).save(captor.capture())
        assertThat(captor.firstValue.id).isEqualTo(CaseConfigurationDeclarationId(caseDefinitionId, "notificationEmail"))
        assertThat(captor.firstValue.defaultValue).isEqualTo("test@example.com")
    }

    @Test
    fun `should refuse to create, update or delete a declaration on a final case definition`() {
        val service = service(draftEnvironment = true, final = true)
        declare("notificationEmail", "test@example.com")

        assertThrows<IllegalArgumentException> { service.createDeclaration(caseDefinitionId, "other", null) }
        assertThrows<IllegalArgumentException> { service.updateDeclaration(caseDefinitionId, "notificationEmail", "x") }
        assertThrows<IllegalArgumentException> { service.deleteDeclaration(caseDefinitionId, "notificationEmail") }
        verify(declarationRepository, never()).save(any<CaseConfigurationDeclaration>())
        verify(declarationRepository, never()).delete(any<CaseConfigurationDeclaration>())
    }

    @Test
    fun `should refuse to create, update or delete a declaration where drafts are not supported`() {
        val service = service(draftEnvironment = false, final = false)
        declare("notificationEmail", "test@example.com")

        val exception = assertThrows<IllegalArgumentException> { service.createDeclaration(caseDefinitionId, "other", null) }
        assertThrows<IllegalArgumentException> { service.updateDeclaration(caseDefinitionId, "notificationEmail", "x") }
        assertThrows<IllegalArgumentException> { service.deleteDeclaration(caseDefinitionId, "notificationEmail") }
        assertThat(exception.message).contains("does not support drafts")
        verify(declarationRepository, never()).save(any<CaseConfigurationDeclaration>())
        verify(declarationRepository, never()).delete(any<CaseConfigurationDeclaration>())
    }

    @Test
    fun `should refuse a duplicate key`() {
        val service = service(draftEnvironment = true, final = false)
        declare("notificationEmail", "test@example.com")

        assertThrows<CaseConfigurationAlreadyExistsException> {
            service.createDeclaration(caseDefinitionId, "notificationEmail", "other@example.com")
        }
    }

    @Test
    fun `should refuse a blank key or a key with whitespace`() {
        val service = service(draftEnvironment = true, final = false)

        assertThrows<IllegalArgumentException> { service.createDeclaration(caseDefinitionId, " ", null) }
        assertThrows<IllegalArgumentException> { service.createDeclaration(caseDefinitionId, "notification email", null) }
        verify(declarationRepository, never()).save(any<CaseConfigurationDeclaration>())
    }

    @Test
    fun `should refuse a key that cannot be addressed as a URL path segment`() {
        val service = service(draftEnvironment = true, final = false)

        listOf("mail/provider", "mail%provider", "mail;provider", "mail\\provider", "mail?provider", "mail#provider").forEach { key ->
            assertThrows<IllegalArgumentException>(key) { service.createDeclaration(caseDefinitionId, key, null) }
        }
        verify(declarationRepository, never()).save(any<CaseConfigurationDeclaration>())
    }

    @Test
    fun `should accept a key with letters, digits, dots, underscores and dashes`() {
        val service = service(draftEnvironment = true, final = false)

        service.createDeclaration(caseDefinitionId, "mail.provider_v2-test", null)

        verify(declarationRepository).save(any<CaseConfigurationDeclaration>())
    }

    @Test
    fun `should set an environment value on a final case definition where drafts are not supported`() {
        val service = service(draftEnvironment = false, final = true)
        declare("notificationEmail", "test@example.com")

        val item = service.setEnvironmentValue(caseDefinitionId, "notificationEmail", "afdeling@example.com")

        val captor = argumentCaptor<CaseConfigurationEnvironmentValue>()
        verify(environmentValueRepository).save(captor.capture())
        assertThat(captor.firstValue.id).isEqualTo(CaseConfigurationEnvironmentValueId("mail-case", "notificationEmail"))
        assertThat(captor.firstValue.value).isEqualTo("afdeling@example.com")
        assertThat(item).isEqualTo(CaseConfigurationItem("notificationEmail", "test@example.com", "afdeling@example.com"))
        verify(declarationRepository, never()).save(any<CaseConfigurationDeclaration>())
    }

    @Test
    fun `should clear an environment value on a final case definition where drafts are not supported`() {
        val service = service(draftEnvironment = false, final = true)
        declare("notificationEmail", "test@example.com")
        val id = CaseConfigurationEnvironmentValueId("mail-case", "notificationEmail")
        whenever(environmentValueRepository.existsById(id)).thenReturn(true)

        service.clearEnvironmentValue(caseDefinitionId, "notificationEmail")

        verify(environmentValueRepository).deleteById(id)
    }

    @Test
    fun `should clear the environment value instead of storing a blank one`() {
        val service = service(draftEnvironment = false, final = true)
        declare("notificationEmail", "test@example.com")
        val id = CaseConfigurationEnvironmentValueId("mail-case", "notificationEmail")
        whenever(environmentValueRepository.existsById(id)).thenReturn(true)

        val item = service.setEnvironmentValue(caseDefinitionId, "notificationEmail", " ")

        verify(environmentValueRepository, never()).save(any<CaseConfigurationEnvironmentValue>())
        verify(environmentValueRepository).deleteById(id)
        assertThat(item).isEqualTo(CaseConfigurationItem("notificationEmail", "test@example.com", null))
        assertThat(service.resolveValue(caseDefinitionId, "notificationEmail")).isEqualTo("test@example.com")
    }

    @Test
    fun `should refuse an environment value for a key the version does not declare`() {
        val service = service(draftEnvironment = false, final = true)

        assertThrows<CaseConfigurationNotFoundException> {
            service.setEnvironmentValue(caseDefinitionId, "notificationEmail", "afdeling@example.com")
        }
        verify(environmentValueRepository, never()).save(any<CaseConfigurationEnvironmentValue>())
    }

    @Test
    fun `should refuse an environment value for a case definition that does not exist`() {
        val service = service(draftEnvironment = true, final = false)
        whenever(caseDefinitionRepository.existsById(caseDefinitionId)).thenReturn(false)

        assertThrows<IllegalArgumentException> {
            service.setEnvironmentValue(caseDefinitionId, "notificationEmail", "afdeling@example.com")
        }
    }

    @Test
    fun `should resolve the environment value before the default`() {
        val service = service(draftEnvironment = false, final = true)
        declare("notificationEmail", "test@example.com")
        whenever(environmentValueRepository.findById(CaseConfigurationEnvironmentValueId("mail-case", "notificationEmail")))
            .thenReturn(Optional.of(CaseConfigurationEnvironmentValue(CaseConfigurationEnvironmentValueId("mail-case", "notificationEmail"), "afdeling@example.com")))

        assertThat(service.resolveValue(caseDefinitionId, "notificationEmail")).isEqualTo("afdeling@example.com")
    }

    @Test
    fun `should resolve the default when no environment value is set`() {
        val service = service(draftEnvironment = false, final = true)
        declare("notificationEmail", "test@example.com")

        assertThat(service.resolveValue(caseDefinitionId, "notificationEmail")).isEqualTo("test@example.com")
    }

    @Test
    fun `should fail naming key and case definition when resolving an undeclared key`() {
        val service = service(draftEnvironment = false, final = true)

        val exception = assertThrows<CaseConfigurationNotFoundException> { service.resolveValue(caseDefinitionId, "missing") }

        assertThat(exception.message).contains("missing").contains("mail-case:1.0.0")
    }

    @Test
    fun `should delete environment values only with the last version of a case definition`() {
        val service = service(draftEnvironment = true, final = false)
        val environmentValues = listOf(
            CaseConfigurationEnvironmentValue(CaseConfigurationEnvironmentValueId("mail-case", "notificationEmail"), "a@example.com")
        )
        whenever(environmentValueRepository.findAllByIdCaseDefinitionKey("mail-case")).thenReturn(environmentValues)
        whenever(caseDefinitionRepository.findAllByIdKeyOrderByIdVersionTagDesc("mail-case"))
            .thenReturn(listOf(caseDefinition(caseDefinitionId, false), caseDefinition(CaseDefinitionId.of("mail-case", "0.9.0"), true)))

        service.deleteAll(caseDefinitionId)
        verify(environmentValueRepository, never()).deleteAll(any<Iterable<CaseConfigurationEnvironmentValue>>())

        whenever(caseDefinitionRepository.findAllByIdKeyOrderByIdVersionTagDesc("mail-case"))
            .thenReturn(listOf(caseDefinition(caseDefinitionId, false)))
        service.deleteAll(caseDefinitionId)
        verify(environmentValueRepository).deleteAll(environmentValues)
    }

    private fun declare(key: String, defaultValue: String?) {
        val id = CaseConfigurationDeclarationId(caseDefinitionId, key)
        whenever(declarationRepository.existsById(id)).thenReturn(true)
        whenever(declarationRepository.findById(id)).thenReturn(Optional.of(CaseConfigurationDeclaration(id, defaultValue)))
    }

    private fun service(draftEnvironment: Boolean, final: Boolean): CaseConfigurationService {
        whenever(environment.matchesProfiles("dev", "test")).thenReturn(draftEnvironment)
        whenever(caseDefinitionRepository.findById(caseDefinitionId)).thenReturn(Optional.of(caseDefinition(caseDefinitionId, final)))
        whenever(caseDefinitionRepository.existsById(caseDefinitionId)).thenReturn(true)
        val checker = CaseDefinitionCheckerImpl(
            caseDefinitionRepository,
            environment,
            "dev,test",
            false,
            mock<CaseDefinitionConfigurationIssueRepository>(),
        )
        return CaseConfigurationService(
            declarationRepository,
            environmentValueRepository,
            caseDefinitionRepository,
            checker,
            mock<AuthorizationService>(),
        )
    }

    private fun caseDefinition(id: CaseDefinitionId, final: Boolean) = CaseDefinition(
        id = id,
        name = "Mail case",
        createdDate = LocalDateTime.now(),
        final = final,
    )
}
