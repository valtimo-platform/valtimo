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

package com.ritense.processdocument.importer

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case.service.CaseListImporter
import com.ritense.case.service.CaseTaskListImporter
import com.ritense.case.service.TaskColumnService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.document.importer.SearchFieldImporter
import com.ritense.document.service.SearchFieldService
import com.ritense.document.service.impl.JsonSchemaDocumentDefinitionService
import com.ritense.document.service.result.DeployDocumentDefinitionResultSucceeded
import com.ritense.importer.ImportContext.Companion.runImporter
import com.ritense.importer.ImportRequest
import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valueresolver.ValueResolverService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

/** Importing a new version while an older one is active: paths are validated against the imported version's schema. */
@Transactional
class CaseDefinitionVersionPathValidationIntTest @Autowired constructor(
    private val caseDefinitionRepository: CaseDefinitionRepository,
    private val documentDefinitionService: JsonSchemaDocumentDefinitionService,
    private val valueResolverService: ValueResolverService,
    private val caseListImporter: CaseListImporter,
    private val caseTaskListImporter: CaseTaskListImporter,
    private val searchFieldImporter: SearchFieldImporter,
    private val caseDefinitionService: CaseDefinitionService,
    private val taskColumnService: TaskColumnService,
    private val searchFieldService: SearchFieldService,
) : BaseIntegrationTest() {

    @BeforeEach
    fun setUp() {
        deploy(ACTIVE, active = true, properties = """{ "name": { "type": "string" } }""")
        deploy(
            IMPORTED,
            active = false,
            properties = """
                {
                    "name": { "type": "string" },
                    "fase": {
                        "type": "object",
                        "properties": { "huidigefase": { "type": ["string", "null"] } },
                        "additionalProperties": false
                    }
                }
            """
        )
    }

    @Test
    fun `should import case list column with path that only exists in the imported version`() {
        import(
            "/case/list/$KEY.case-list.json",
            """[{ "key": "fase", "path": "$NEW_PATH", "displayType": { "type": "text", "displayTypeParameters": {} }, "sortable": true }]"""
        )

        val columns = runWithoutAuthorization { caseDefinitionService.getListColumns(KEY) }
        assertThat(columns.map { it.path }).containsExactly(NEW_PATH)
    }

    @Test
    fun `should import task list column with path that only exists in the imported version`() {
        import(
            "/case/task-list/$KEY.case-task-list.json",
            """[{ "key": "fase", "path": "$NEW_PATH", "displayType": { "type": "text", "displayTypeParameters": {} }, "sortable": true }]"""
        )

        val columns = runWithoutAuthorization { taskColumnService.getListColumns(KEY) }
        assertThat(columns.map { it.path }).containsExactly(NEW_PATH)
    }

    @Test
    fun `should import search field with path that only exists in the imported version`() {
        import(
            "/case/search-field/$KEY.case-search-field.json",
            """{ "searchFields": [{ "key": "fase", "path": "$NEW_PATH", "dataType": "text", "fieldType": "single", "matchType": "like" }] }"""
        )

        val searchFields = runWithoutAuthorization { searchFieldService.getSearchFields(KEY) }
        assertThat(searchFields.map { it.path }).containsExactly(NEW_PATH)
    }

    @Test
    fun `should still reject a path that does not exist in the imported version`() {
        assertThatThrownBy {
            runWithoutAuthorization { valueResolverService.validateValues(IMPORTED, listOf("doc:fase.unknown")) }
        }.hasMessageContaining("doesn't point to any property")
    }

    @Test
    fun `should validate against the active version when no version is given`() {
        assertThatThrownBy {
            runWithoutAuthorization { valueResolverService.validateValues(KEY, listOf(NEW_PATH)) }
        }.hasMessageContaining("doesn't point to any property")
    }

    private fun import(fileName: String, content: String) {
        val request = ImportRequest(fileName, content.toByteArray(), IMPORTED)
        val importer = listOf(caseListImporter, caseTaskListImporter, searchFieldImporter)
            .single { it.supports(fileName) }
        runWithoutAuthorization { runImporter<Unit> { importer.import(request) } }
    }

    private fun deploy(caseDefinitionId: CaseDefinitionId, active: Boolean, properties: String) {
        caseDefinitionRepository.saveAndFlush(
            CaseDefinition(id = caseDefinitionId, name = KEY, createdDate = null, active = active)
        )
        val result = runWithoutAuthorization {
            documentDefinitionService.deploy(
                """
                    {
                        "${'$'}id": "$KEY.schema",
                        "${'$'}schema": "http://json-schema.org/draft-07/schema#",
                        "type": "object",
                        "properties": $properties,
                        "additionalProperties": false
                    }
                """,
                caseDefinitionId
            )
        }
        assertThat(result).isInstanceOf(DeployDocumentDefinitionResultSucceeded::class.java)
    }

    private companion object {
        const val KEY = "case-definition-version-path-validation-int-test"
        const val NEW_PATH = "doc:fase.huidigefase"
        val ACTIVE = CaseDefinitionId(KEY, "1.0.0")
        val IMPORTED = CaseDefinitionId(KEY, "1.1.0")
    }
}
