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

package com.ritense.externalplugin.exception

import com.ritense.plugin.web.rest.dto.PluginUsageDto
import org.zalando.problem.AbstractThrowableProblem
import org.zalando.problem.Exceptional
import org.zalando.problem.Status
import java.util.UUID

class ExternalPluginHostInUseException(
    hostId: UUID,
    usages: Collection<PluginUsageDto>,
) : AbstractThrowableProblem(
    null,
    "External plugin host is in use",
    Status.CONFLICT,
    "One or more BPMN process links reference configurations under this host. " +
        "Remove the references before deleting the host.",
    null,
    null,
    mapOf(
        "hostId" to hostId.toString(),
        "usages" to usages,
    ),
) {
    override fun getCause(): Exceptional? = null
}
