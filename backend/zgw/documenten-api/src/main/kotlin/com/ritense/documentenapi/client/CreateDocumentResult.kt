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

package com.ritense.documentenapi.client

import com.fasterxml.jackson.databind.annotation.JsonDeserialize
import com.ritense.valtimo.contract.json.Iso8601Deserializer
import java.time.OffsetDateTime

class CreateDocumentResult(
    val url: String,
    val auteur: String,
    val bestandsnaam: String,
    val bestandsomvang: Long,
    @JsonDeserialize(using = Iso8601Deserializer::class)
    val beginRegistratie: OffsetDateTime,
    val bestandsdelen: List<Bestandsdeel>,
    val lock: String?
) {
    fun getLockOrEmpty() = lock.orEmpty()

    fun getDocumentUUIDFromUrl(): String {
        return url.substring(url.lastIndexOf("/") + 1)
    }
}