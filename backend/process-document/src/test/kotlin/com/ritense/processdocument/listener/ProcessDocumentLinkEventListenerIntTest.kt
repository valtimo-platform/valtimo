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

package com.ritense.processdocument.listener

import com.ritense.processdocument.BaseIntegrationTest
import org.assertj.core.api.Assertions.assertThatCode
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate

class ProcessDocumentLinkEventListenerIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var processDocumentLinkEventListener: ProcessDocumentLinkEventListener

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @Autowired
    lateinit var transactionManager: PlatformTransactionManager

    @AfterEach
    fun cleanUp() {
        TransactionTemplate(transactionManager).execute {
            jdbcTemplate.update("DELETE FROM case_definition_process_link WHERE case_definition_key = ?", CASE_KEY)
        }
    }

    @Test
    fun `should not stop startup when a case-definition-process-link has no case definition version tag`() {
        // Left behind by the v12 document_definition_process_link table
        TransactionTemplate(transactionManager).execute {
            jdbcTemplate.update(
                """
                INSERT INTO case_definition_process_link
                (case_definition_key, case_definition_version_tag, process_definition_key, link_type)
                VALUES (?, NULL, 'document-upload', 'DOCUMENT_UPLOAD')
                """.trimIndent(),
                CASE_KEY
            )
        }

        assertThatCode { processDocumentLinkEventListener.handleApplicationReadyEvent() }
            .doesNotThrowAnyException()
    }

    private companion object {
        const val CASE_KEY = "legacy-case"
    }
}
