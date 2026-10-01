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

package com.ritense.formflow.handler

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.formflow.BaseIntegrationTest
import com.ritense.formflow.domain.instance.FormFlowInstance
import com.ritense.formflow.service.FormFlowService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.json.JSONObject
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import kotlin.test.assertEquals

@Transactional
class FormFlowStepTypeFormHandlerIT : BaseIntegrationTest() {

    @Autowired
    lateinit var formFlowService: FormFlowService

    @Autowired
    lateinit var documentService: DocumentService

    @Autowired
    lateinit var objectMapper: ObjectMapper

    lateinit var instance: FormFlowInstance

    @BeforeEach
    fun beforeEach() {
        val document = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(
                    "profile",
                    "profile",
                    "1.0.0",
                    objectMapper.readTree("""{"firstName":"Jan","lastName":"Jansen"}""")
                )
            ).resultingDocument().get()
        }
        instance = formFlowService.save(
            formFlowService.findDefinition("source-key", CaseDefinitionId("profile", "1.0.0"))
                .createInstance(mapOf("documentId" to document.id().toString()))
        )
    }

    @Test
    fun `should prefill the first step from the case`() {
        val defaultValues = getDefaultValues()

        assertEquals("Jan", defaultValues["firstName"])
        assertEquals("Jansen", defaultValues["lastName"])
    }

    @Test
    fun `should prefill a field with a sourceKey with the value submitted in an earlier step`() {
        instance.complete(
            instance.currentFormFlowStepInstanceId!!,
            JSONObject("""{"firstName":"Piet","lastName":"Pietersen"}""")
        )

        val defaultValues = getDefaultValues()

        assertEquals("Piet", defaultValues["firstName"])
        assertEquals("Pietersen", defaultValues["lastName"])
    }

    private fun getDefaultValues(): Map<String, String?> {
        val typeProperties = formFlowService.getTypeProperties(instance.getCurrentStep()) as FormTypeProperties
        return typeProperties.definition.at("/components")
            .associate { it["key"].asText() to it["defaultValue"]?.asText() }
    }
}
