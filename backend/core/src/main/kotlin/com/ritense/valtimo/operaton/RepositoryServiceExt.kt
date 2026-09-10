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

package com.ritense.valtimo.operaton

import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.ProcessDefinition

/** The process definition [processDefinitionId] names, or null when Operaton has none. Unlike `getProcessDefinition` it does not throw — an exception leaving an Operaton command marks the caller's transaction rollback-only, so catching it buys nothing. */
fun RepositoryService.findProcessDefinitionOrNull(processDefinitionId: String): ProcessDefinition? =
    createProcessDefinitionQuery().processDefinitionId(processDefinitionId).singleResult()
