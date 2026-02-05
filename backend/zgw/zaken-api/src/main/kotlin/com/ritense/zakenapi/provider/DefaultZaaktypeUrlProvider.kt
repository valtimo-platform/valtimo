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

package com.ritense.zakenapi.provider

import com.ritense.catalogiapi.exception.ZaakTypeLinkNotFoundException
import com.ritense.catalogiapi.service.ZaaktypeUrlProvider
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.logging.LoggableResource
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.zakenapi.service.ZaakTypeLinkService
import org.springframework.stereotype.Component
import java.net.URI
import java.util.UUID

@Component
@SkipComponentScan
class DefaultZaaktypeUrlProvider(
    private val zaakTypeLinkService: ZaakTypeLinkService,
    private val caseDocumentResolver: CaseDocumentResolver,
    private val jsonSchemaDocumentService: JsonSchemaDocumentService,
) : ZaaktypeUrlProvider {

    override fun getZaaktypeUrl(
        @LoggableResource("caseDefinitionId") caseDefinitionId: CaseDefinitionId
    ): URI {
        val zaakTypeLink = zaakTypeLinkService.get(caseDefinitionId)
            ?: throw ZaakTypeLinkNotFoundException("For case definition $caseDefinitionId")
        return zaakTypeLink.zaakTypeUrl
    }

    override fun getZaaktypeUrl(documentId: UUID): URI {
        val caseDocumentId = caseDocumentResolver.resolveCaseDocumentId(documentId)
        val caseDocument = jsonSchemaDocumentService.get(caseDocumentId)
        return getZaaktypeUrl(caseDocument.definitionId().caseDefinitionId())
    }
}