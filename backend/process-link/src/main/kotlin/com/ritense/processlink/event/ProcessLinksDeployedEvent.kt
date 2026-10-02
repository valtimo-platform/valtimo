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

package com.ritense.processlink.event

import com.ritense.valtimo.contract.BlueprintId

/**
 * Published after a process definition and its process links have been deployed, also when that leaves the
 * process definition without any process links at all. Unlike [ProcessLinkCreatedEvent] and
 * [ProcessLinkDeletedEvent] this event does not depend on individual process links being written, which makes
 * it the only signal available to listeners when a deployment results in no process links.
 */
class ProcessLinksDeployedEvent(
    val processDefinitionId: String,
    val blueprintId: BlueprintId?
)
