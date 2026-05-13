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

package com.ritense.valtimo.security

import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ACTUATOR
import org.springframework.boot.actuate.endpoint.SecurityContext
import org.springframework.boot.actuate.health.HealthEndpointGroup
import org.springframework.boot.actuate.health.HealthEndpointGroups

// Code-override of management.endpoint.health.{show-details,roles} and per-group equivalents:
// regardless of what application.yml configures, /actuator/health responses only include
// components/details when the caller is authenticated and holds ROLE_ACTUATOR. Mirrors the
// safety invariant in ActuatorSecurityFilterChainFactory.healthDetailsAreSafeForAnonymous.
internal class ActuatorRoleHealthEndpointGroup(
    private val delegate: HealthEndpointGroup
) : HealthEndpointGroup by delegate {

    override fun showDetails(securityContext: SecurityContext): Boolean =
        isActuator(securityContext) && delegate.showDetails(securityContext)

    override fun showComponents(securityContext: SecurityContext): Boolean =
        isActuator(securityContext) && delegate.showComponents(securityContext)

    private fun isActuator(context: SecurityContext): Boolean =
        context.principal != null && context.isUserInRole(ACTUATOR)
}

// Wraps every HealthEndpointGroup returned by the delegate. getPrimary() covers the top-level
// /actuator/health (uses HealthEndpointProperties.showDetails); get(name) covers each named
// group at /actuator/health/<name> (uses props.group.<name>.show-details with inheritance).
class ActuatorRoleHealthEndpointGroups(
    private val delegate: HealthEndpointGroups
) : HealthEndpointGroups {

    override fun getPrimary(): HealthEndpointGroup = ActuatorRoleHealthEndpointGroup(delegate.primary)

    override fun getNames(): Set<String> = delegate.names

    override fun get(name: String): HealthEndpointGroup? =
        delegate.get(name)?.let { ActuatorRoleHealthEndpointGroup(it) }
}
