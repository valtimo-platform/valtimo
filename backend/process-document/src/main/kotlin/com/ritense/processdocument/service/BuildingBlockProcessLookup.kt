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
 * Extension point that lets the inspection page surface building-block context on
 * process instances. Implemented by the building-block module when present;
 * absent when an app does not include the building-block module.
 */
interface BuildingBlockProcessLookup {

    /**
     * Returns building-block metadata for the given process instance, or null
     * if the process instance does not belong to a building block.
     */
    fun findForProcessInstance(processInstanceId: String): BuildingBlockProcessReference?
}

data class BuildingBlockProcessReference(
    val instanceId: UUID,
    val definitionKey: String,
    val definitionVersionTag: String,
    val documentId: UUID,
)
