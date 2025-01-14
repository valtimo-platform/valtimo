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

package com.ritense.documentenapi.web.rest.dto

import com.ritense.documentenapi.domain.DocumentenApiUploadField
import com.ritense.documentenapi.domain.DocumentenApiUploadFieldId
import com.ritense.documentenapi.domain.DocumentenApiUploadFieldKey

data class DocumentenApiUploadFieldDto(
    val key: String,
    val defaultValue: String?,
    val visible: Boolean = true,
    val readonly: Boolean = false,
) {
    companion object {
        fun of(uploadField: DocumentenApiUploadField) = DocumentenApiUploadFieldDto(
            key = uploadField.id.key.property,
            defaultValue = uploadField.defaultValue,
            visible = uploadField.visible,
            readonly = uploadField.readonly,
        )

        fun of(uploadField: DocumentenApiUploadField, defaultValue: String?) = DocumentenApiUploadFieldDto(
            key = uploadField.id.key.property,
            defaultValue = defaultValue ?: uploadField.defaultValue,
            visible = uploadField.visible,
            readonly = uploadField.readonly,
        )

        fun toEntity(caseDefinitionName: String, dto: DocumentenApiUploadFieldDto): DocumentenApiUploadField {
            return DocumentenApiUploadField(
                id = DocumentenApiUploadFieldId(caseDefinitionName, DocumentenApiUploadFieldKey.fromProperty(dto.key)!!),
                defaultValue = dto.defaultValue ?: "",
                visible = dto.visible,
                readonly = dto.readonly,
            )
        }
    }
}