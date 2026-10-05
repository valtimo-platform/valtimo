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

package com.ritense.processdocument.resolver

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case_.caseconfiguration.service.CaseConfigurationService
import com.ritense.document.domain.Document
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valueresolver.ValueResolverFactory
import com.ritense.valueresolver.ValueResolverOption
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.DOCUMENT_ID
import org.operaton.bpm.engine.delegate.VariableScope
import java.util.UUID
import java.util.function.Function

// Reads only stored declarations and environment values, never process environment or Spring properties
class CaseConfigurationValueResolverFactory(
    private val processDocumentService: ProcessDocumentService,
    private val documentService: DocumentService,
    private val caseConfigurationService: CaseConfigurationService,
) : ValueResolverFactory {

    override fun supportedPrefix() = PREFIX

    override fun resolverCacheKey(properties: Map<String, Any>): Any? {
        return properties[DOCUMENT_ID]?.toString()
    }

    override fun createResolver(processInstanceId: String, variableScope: VariableScope): Function<String, Any?> {
        val document = processDocumentService.getCaseDocument(OperatonProcessInstanceId(processInstanceId), variableScope)
        return createResolver(document)
    }

    override fun createResolver(documentId: String): Function<String, Any?> {
        return createResolver(runWithoutAuthorization { documentService.get(documentId) })
    }

    override fun handleValues(processInstanceId: String, variableScope: VariableScope?, values: Map<String, Any?>) {
        throw UnsupportedOperationException("Values with prefix '$PREFIX' are read-only")
    }

    override fun handleValues(documentId: UUID, values: Map<String, Any?>) {
        throw UnsupportedOperationException("Values with prefix '$PREFIX' are read-only")
    }

    override fun getResolvableKeyOptions(caseDefinitionId: CaseDefinitionId): List<ValueResolverOption> {
        return createFieldList(caseConfigurationService.getDeclarations(caseDefinitionId).map { it.id.key })
    }

    override fun getResolvableKeyOptions(caseDefinitionKey: String): List<ValueResolverOption> {
        return createFieldList(caseConfigurationService.getDeclaredKeys(caseDefinitionKey))
    }

    private fun createResolver(document: Document): Function<String, Any?> {
        val caseDefinitionId = document.definitionId().caseDefinitionId()
        return Function { key -> caseConfigurationService.resolveValue(caseDefinitionId, key) }
    }

    companion object {
        const val PREFIX = "config"
    }
}
