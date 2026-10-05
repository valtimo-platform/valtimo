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

package com.ritense.case_.caseconfiguration

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.BaseIntegrationTest
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case.web.rest.dto.CaseDefinitionDraftCreateRequest
import com.ritense.case_.caseconfiguration.exporter.CaseConfigurationExporter
import com.ritense.case_.caseconfiguration.importer.CaseConfigurationDto
import com.ritense.case_.caseconfiguration.repository.CaseConfigurationEnvironmentValueRepository
import com.ritense.case_.caseconfiguration.service.CaseConfigurationItem
import com.ritense.case_.caseconfiguration.service.CaseConfigurationService
import com.ritense.exporter.request.DocumentDefinitionExportRequest
import com.ritense.importer.ValtimoImportService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.repository.SemverConverter
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.core.io.ByteArrayResource
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.security.access.AccessDeniedException
import org.springframework.transaction.annotation.Transactional

@Transactional
class CaseConfigurationIntTest @Autowired constructor(
    private val service: CaseConfigurationService,
    private val caseDefinitionService: CaseDefinitionService,
    private val exporter: CaseConfigurationExporter,
    private val valtimoImportService: ValtimoImportService,
    private val environmentValueRepository: CaseConfigurationEnvironmentValueRepository,
    private val jdbcTemplate: JdbcTemplate,
    private val entityManager: EntityManager,
) : BaseIntegrationTest() {

    @Test
    fun `should persist declarations and environment values in their own tables`() {
        val caseDefinitionId = createDraft("config-storage", "1.0.0")
        runWithoutAuthorization {
            service.createDeclaration(caseDefinitionId, "notificationEmail", "test@example.com")
            service.setEnvironmentValue(caseDefinitionId, "notificationEmail", "afdeling@example.com")
        }
        entityManager.flush()

        val defaultValue = jdbcTemplate.queryForObject(
            "SELECT default_value FROM case_configuration_declaration WHERE case_definition_key = ? AND case_definition_version_tag = ? AND configuration_key = ?",
            String::class.java, "config-storage", SemverConverter.convertToDatabaseColumn(caseDefinitionId.versionTag), "notificationEmail"
        )
        val environmentValue = jdbcTemplate.queryForObject(
            "SELECT environment_value FROM case_configuration_environment_value WHERE case_definition_key = ? AND configuration_key = ?",
            String::class.java, "config-storage", "notificationEmail"
        )
        assertThat(defaultValue).isEqualTo("test@example.com")
        assertThat(environmentValue).isEqualTo("afdeling@example.com")
    }

    @Test
    fun `should create, update and delete declarations on a draft`() {
        val caseDefinitionId = createDraft("config-crud", "1.0.0")
        runWithoutAuthorization {
            service.createDeclaration(caseDefinitionId, "notificationEmail", "test@example.com")
            service.createDeclaration(caseDefinitionId, "mailProvider", "smtp")
            service.updateDeclaration(caseDefinitionId, "mailProvider", "api")
            assertThat(service.getConfiguration(caseDefinitionId)).containsExactly(
                CaseConfigurationItem("mailProvider", "api", null),
                CaseConfigurationItem("notificationEmail", "test@example.com", null),
            )

            service.deleteDeclaration(caseDefinitionId, "mailProvider")
            assertThat(service.getConfiguration(caseDefinitionId).map { it.key }).containsExactly("notificationEmail")
        }
    }

    @Test
    fun `should deny managing configuration without permission`() {
        val caseDefinitionId = createDraft("config-denied", "1.0.0")
        runWithoutAuthorization { service.createDeclaration(caseDefinitionId, "notificationEmail", null) }

        assertThrows<AccessDeniedException> { service.createDeclaration(caseDefinitionId, "other", null) }
        assertThrows<AccessDeniedException> { service.updateDeclaration(caseDefinitionId, "notificationEmail", "x") }
        assertThrows<AccessDeniedException> { service.deleteDeclaration(caseDefinitionId, "notificationEmail") }
        assertThrows<AccessDeniedException> { service.setEnvironmentValue(caseDefinitionId, "notificationEmail", "x") }
        assertThrows<AccessDeniedException> { service.clearEnvironmentValue(caseDefinitionId, "notificationEmail") }
    }

    @Test
    fun `should refuse declaration changes on a final version but allow setting and clearing its environment value`() {
        val caseDefinitionId = createDraft("config-final", "1.0.0")
        runWithoutAuthorization {
            service.createDeclaration(caseDefinitionId, "notificationEmail", "test@example.com")
            caseDefinitionService.finalizeCaseDefinition(caseDefinitionId)

            assertThrows<IllegalArgumentException> { service.createDeclaration(caseDefinitionId, "other", null) }
            assertThrows<IllegalArgumentException> { service.updateDeclaration(caseDefinitionId, "notificationEmail", "x") }
            assertThrows<IllegalArgumentException> { service.deleteDeclaration(caseDefinitionId, "notificationEmail") }

            service.setEnvironmentValue(caseDefinitionId, "notificationEmail", "afdeling@example.com")
            assertThat(service.getConfiguration(caseDefinitionId))
                .containsExactly(CaseConfigurationItem("notificationEmail", "test@example.com", "afdeling@example.com"))
            assertThat(service.resolveValue(caseDefinitionId, "notificationEmail")).isEqualTo("afdeling@example.com")

            service.clearEnvironmentValue(caseDefinitionId, "notificationEmail")
            assertThat(service.getConfiguration(caseDefinitionId))
                .containsExactly(CaseConfigurationItem("notificationEmail", "test@example.com", null))
            assertThat(service.resolveValue(caseDefinitionId, "notificationEmail")).isEqualTo("test@example.com")
        }
    }

    @Test
    fun `should import an auto-deployed configuration file with its property placeholder resolved`() {
        val configuration = service.getConfiguration(CaseDefinitionId.of("definition-test", "1.0.0"))

        assertThat(configuration).containsExactly(
            CaseConfigurationItem("mailProvider", "smtp", null),
            CaseConfigurationItem("notificationEmail", "test@example.com", null),
        )
    }

    @Test
    fun `should export declarations without environment values`() {
        val caseDefinitionId = CaseDefinitionId.of("definition-test", "1.0.0")
        runWithoutAuthorization { service.setEnvironmentValue(caseDefinitionId, "notificationEmail", "afdeling@example.com") }

        val result = exporter.export(DocumentDefinitionExportRequest("definition-test", caseDefinitionId))

        val file = result.exportFiles.single()
        assertThat(file.path).isEqualTo("config/case/definition-test/1-0-0/case/configuration/definition-test.case-configuration.json")
        assertThat(String(file.content)).doesNotContain("afdeling@example.com")
        assertThat(jacksonObjectMapper().readValue<List<CaseConfigurationDto>>(file.content)).containsExactly(
            CaseConfigurationDto("mailProvider", "smtp"),
            CaseConfigurationDto("notificationEmail", "test@example.com"),
        )
    }

    @Test
    fun `should export no configuration file for a version without declarations`() {
        val result = exporter.export(DocumentDefinitionExportRequest("house", CaseDefinitionId.of("house", "1.0.0")))

        assertThat(result.exportFiles).isEmpty()
    }

    @Test
    fun `should restore exported declarations on import and keep the environment value for the new version`() {
        val caseDefinitionId = CaseDefinitionId.of("definition-test", "1.0.0")
        runWithoutAuthorization { service.setEnvironmentValue(caseDefinitionId, "notificationEmail", "afdeling@example.com") }
        val exported = exporter.export(DocumentDefinitionExportRequest("definition-test", caseDefinitionId)).exportFiles.single()

        val newVersion = CaseDefinitionId.of("definition-test", "2.0.0")
        runWithoutAuthorization {
            valtimoImportService.importCaseDefinition(
                listOf(
                    "/case/definition/definition-test.case-definition.json" to ByteArrayResource(
                        """{"key": "definition-test", "name": "Definition Test", "versionTag": "2.0.0"}""".toByteArray()
                    ),
                    "/case/configuration/definition-test.case-configuration.json" to ByteArrayResource(exported.content),
                ),
                emptyList()
            )
        }

        assertThat(service.getDeclarations(newVersion).map { CaseConfigurationDto.of(it) }).containsExactly(
            CaseConfigurationDto("mailProvider", "smtp"),
            CaseConfigurationDto("notificationEmail", "test@example.com"),
        )
        assertThat(service.resolveValue(newVersion, "notificationEmail")).isEqualTo("afdeling@example.com")
        assertThat(service.resolveValue(newVersion, "mailProvider")).isEqualTo("smtp")
    }

    @Test
    fun `should copy declarations into a draft based on another version`() {
        val basedOn = createDraft("config-copy", "1.0.0")
        runWithoutAuthorization {
            service.createDeclaration(basedOn, "notificationEmail", "test@example.com")
            caseDefinitionService.finalizeCaseDefinition(basedOn)
        }

        val draft = createDraft("config-copy", "1.1.0", basedOn.versionTag.version)

        assertThat(service.getConfiguration(draft))
            .containsExactly(CaseConfigurationItem("notificationEmail", "test@example.com", null))
    }

    @Test
    fun `should delete declarations with their version and environment values with the last version`() {
        val first = createDraft("config-delete", "1.0.0")
        runWithoutAuthorization {
            service.createDeclaration(first, "notificationEmail", "test@example.com")
            service.setEnvironmentValue(first, "notificationEmail", "afdeling@example.com")
            caseDefinitionService.finalizeCaseDefinition(first)
        }
        val second = createDraft("config-delete", "1.1.0", "1.0.0")

        runWithoutAuthorization { caseDefinitionService.deleteCaseDefinition(second) }

        assertThat(service.getDeclarations(second)).isEmpty()
        assertThat(environmentValueRepository.findAllByIdCaseDefinitionKey("config-delete")).hasSize(1)

        val only = createDraft("config-delete-last", "1.0.0")
        runWithoutAuthorization {
            service.createDeclaration(only, "notificationEmail", "test@example.com")
            service.setEnvironmentValue(only, "notificationEmail", "afdeling@example.com")
            caseDefinitionService.deleteCaseDefinition(only)
        }

        assertThat(service.getDeclarations(only)).isEmpty()
        assertThat(environmentValueRepository.findAllByIdCaseDefinitionKey("config-delete-last")).isEmpty()
    }

    private fun createDraft(key: String, version: String, basedOnVersion: String? = null): CaseDefinitionId {
        return runWithoutAuthorization {
            caseDefinitionService.createCaseDefinitionDraft(
                CaseDefinitionDraftCreateRequest(
                    caseDefinitionKey = key,
                    caseDefinitionVersion = version,
                    name = "Configuration test",
                    basedOnCaseDefinitionVersion = basedOnVersion,
                )
            ).id
        }
    }
}
