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
import com.ritense.case.service.TaskColumnService
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.document.service.SearchFieldService
import com.ritense.importer.ImportService
import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.repository.findByIdOrNull
import org.springframework.transaction.annotation.Transactional
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** Imports a full zip of a new version while an older version stays active. */
@Transactional
class CaseDefinitionVersionImportIntTest @Autowired constructor(
    private val importService: ImportService,
    private val caseDefinitionRepository: CaseDefinitionRepository,
    private val caseDefinitionService: CaseDefinitionService,
    private val taskColumnService: TaskColumnService,
    private val searchFieldService: SearchFieldService,
) : BaseIntegrationTest() {

    @BeforeEach
    fun setUp() {
        runWithoutAuthorization {
            importService.import(
                ByteArrayInputStream(zip(V1, V1_ENTRIES)),
                emptyList()
            )
            caseDefinitionService.setActiveCaseDefinition(V1)
        }
        assertThat(caseDefinitionRepository.findByIdOrNull(V1)?.active).isTrue()
    }

    @Test
    fun `should import a new version with paths that only exist in that version and keep the old version active`() {
        val importedId = runWithoutAuthorization {
            importService.import(ByteArrayInputStream(zip(V1_1, v1_1Entries(NEW_PATH))), emptyList())
        }

        assertThat(importedId).isEqualTo(V1_1)
        assertThat(caseDefinitionRepository.findByIdOrNull(V1)?.active).isTrue()
        assertThat(caseDefinitionRepository.findByIdOrNull(V1_1)?.active).isFalse()
        runWithoutAuthorization {
            assertThat(caseDefinitionService.getListColumns(KEY).map { it.path }).containsExactly(NEW_PATH)
            assertThat(taskColumnService.getListColumns(KEY).map { it.path }).containsExactly(NEW_PATH)
            assertThat(searchFieldService.getSearchFields(KEY).map { it.path }).containsExactly(NEW_PATH)
        }
    }

    @Test
    fun `should reject an imported version that uses a path unknown to that version`() {
        assertThatThrownBy {
            runWithoutAuthorization {
                importService.import(ByteArrayInputStream(zip(V1_1, v1_1Entries("doc:fase.unknown"))), emptyList())
            }
        }.hasStackTraceContaining("doesn't point to any property")
    }

    private fun v1_1Entries(path: String) = mapOf(
        "case/definition/$KEY.case-definition.json" to caseDefinition("1.1.0"),
        "document/definition/$KEY.document-definition.json" to documentDefinition(withFase = true),
        "case/list/$KEY.case-list.json" to
            """[{ "key": "fase", "path": "$path", "displayType": { "type": "text", "displayTypeParameters": {} }, "sortable": true }]""",
        "case/task-list/$KEY.case-task-list.json" to
            """[{ "key": "fase", "path": "$path", "displayType": { "type": "text", "displayTypeParameters": {} }, "sortable": true }]""",
        "case/search-field/$KEY.case-search-field.json" to
            """{ "searchFields": [{ "key": "fase", "path": "$path", "dataType": "text", "fieldType": "single", "matchType": "like" }] }""",
    )

    private fun zip(caseDefinitionId: CaseDefinitionId, entries: Map<String, String>): ByteArray {
        val prefix = "config/case/$KEY/${caseDefinitionId.versionTag.toString().replace('.', '-')}/"
        val output = ByteArrayOutputStream()
        ZipOutputStream(output).use { zip ->
            entries.forEach { (name, content) ->
                zip.putNextEntry(ZipEntry(prefix + name))
                zip.write(content.toByteArray())
                zip.closeEntry()
            }
        }
        return output.toByteArray()
    }

    private companion object {
        const val KEY = "case-definition-version-import-int-test"
        const val NEW_PATH = "doc:fase.huidigefase"
        val V1 = CaseDefinitionId(KEY, "1.0.0")
        val V1_1 = CaseDefinitionId(KEY, "1.1.0")

        val V1_ENTRIES = mapOf(
            "case/definition/$KEY.case-definition.json" to caseDefinition("1.0.0"),
            "document/definition/$KEY.document-definition.json" to documentDefinition(withFase = false),
        )

        fun caseDefinition(versionTag: String) = """
            {
                "key": "$KEY",
                "name": "Version import test",
                "versionTag": "$versionTag",
                "final": false,
                "canHaveAssignee": true,
                "autoAssignTasks": false
            }
        """.trimIndent()

        fun documentDefinition(withFase: Boolean): String {
            val fase = if (withFase) {
                """, "fase": { "type": "object", "properties": { "huidigefase": { "type": ["string", "null"] } }, "additionalProperties": false }"""
            } else {
                ""
            }
            return """
                {
                    "${'$'}id": "$KEY.schema",
                    "${'$'}schema": "http://json-schema.org/draft-07/schema#",
                    "type": "object",
                    "properties": { "name": { "type": "string" }$fase },
                    "additionalProperties": false
                }
            """.trimIndent()
        }
    }
}
