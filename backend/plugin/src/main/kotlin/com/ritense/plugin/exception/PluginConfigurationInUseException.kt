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

package com.ritense.plugin.exception

import com.ritense.plugin.web.rest.dto.PluginUsageDto
import org.zalando.problem.AbstractThrowableProblem
import org.zalando.problem.Exceptional
import org.zalando.problem.Status
import java.util.UUID

class PluginConfigurationInUseException(
    configurationId: UUID,
    usages: Collection<PluginUsageDto>,
) : AbstractThrowableProblem(
    null,
    "Plugin configuration is in use",
    Status.CONFLICT,
    "One or more BPMN process links reference this plugin configuration. " +
        "Remove the references before deleting the configuration.",
    null,
    null,
    mapOf(
        "configurationId" to configurationId.toString(),
        "usages" to usages,
    ),
) {
    override fun getCause(): Exceptional? = null
}
