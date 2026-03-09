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

package com.ritense.zakenapi.domain

import java.time.LocalDate
import java.time.LocalDateTime
import java.util.UUID

data class ZaakDocument(
    val fileId: UUID,
    val fileName: String?,
    val sizeInBytes: Long?,
    val createdOn: LocalDateTime,
    val createdBy: String,
    val pluginConfigurationId: UUID,
    val author: String? = null,
    val title: String? = null,
    val status: String? = null,
    val language: String? = null,
    val identification: String? = null,
    val description: String? = null,
    val informatieobjecttype: String? = null,
    val informatieobjecttypeOmschrijving: String? = null,
    val keywords: List<String>? = null,
    val format: String? = null,
    val sendDate: LocalDate? = null,
    val receiptDate: LocalDate? = null,
    val confidentialityLevel: String? = null,
    val version: Int? = null,
    val indicationUsageRights: Boolean? = null
)