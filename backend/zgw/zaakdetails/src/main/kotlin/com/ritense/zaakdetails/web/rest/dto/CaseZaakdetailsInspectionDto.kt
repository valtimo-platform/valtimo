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

package com.ritense.zaakdetails.web.rest.dto

import com.fasterxml.jackson.databind.JsonNode
import java.net.URI
import java.util.UUID

data class CaseZaakdetailsInspectionDto(
    val syncConfig: ZaakdetailsSyncConfigDto?,
    val zaakdetailsObject: ZaakdetailsObjectDto?,
    val warnings: List<String>,
)

data class ZaakdetailsSyncConfigDto(
    val caseDefinitionKey: String,
    val caseDefinitionVersionTag: String,
    val objectManagementConfigurationId: UUID?,
    val objectManagementTitle: String?,
    val enabled: Boolean,
)

data class ZaakdetailsObjectDto(
    val documentId: UUID,
    val objectUrl: URI,
    val linkedToZaak: Boolean,
)

data class ZaakdetailsObjectContentDto(
    val resolved: Boolean,
    val record: JsonNode?,
    val message: String?,
    val objectUrl: URI?,
)
