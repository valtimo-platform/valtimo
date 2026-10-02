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
 * Extension point that contributes process definitions which may be started by message for a case,
 * e.g. the main processes of the building blocks linked to the case definition.
 *
 * Targets are returned as concrete process definition ids rather than keys: a case pins a specific
 * building-block version, and engine-level start correlation would always pick the latest deployed
 * version of a key.
 *
 * Implemented by the building-block module when present; absent when an app does not include it.
 */
fun interface CaseCorrelationStartTargetProvider {

    /**
     * Returns the ids of the process definitions that declare a message start event named [message]
     * and may be started for the given case.
     */
    fun getStartTargets(caseDocumentId: UUID, message: String): List<String>
}
