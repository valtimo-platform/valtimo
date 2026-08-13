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

package com.ritense.processdocument.service

import java.util.UUID

/**
 * Extension point that contributes business keys of additional process instances belonging to a
 * case, e.g. building-block instances that run under their own document id. Used by
 * [CaseCorrelationService] to fan a message out over every process instance of a case.
 *
 * Implemented by the building-block module when present; absent when an app does not include it.
 */
fun interface CaseCorrelationBusinessKeyProvider {

    /**
     * Returns the business keys of the process instances this provider knows about for the given
     * case, excluding the case's own processes (those already use the case document id).
     */
    fun getBusinessKeysForCase(caseDocumentId: UUID): List<String>
}
