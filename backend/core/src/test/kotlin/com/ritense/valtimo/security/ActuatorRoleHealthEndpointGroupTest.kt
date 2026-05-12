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
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.boot.actuate.endpoint.SecurityContext
import org.springframework.boot.actuate.health.HealthEndpointGroup
import java.security.Principal

class ActuatorRoleHealthEndpointGroupTest {

    private val delegate: HealthEndpointGroup = mock()
    private val wrapper = ActuatorRoleHealthEndpointGroup(delegate)

    @Test
    fun `anonymous caller never sees details, even when delegate would allow`() {
        val context = anonymousContext()
        whenever(delegate.showDetails(context)).thenReturn(true)

        assertThat(wrapper.showDetails(context)).isFalse
    }

    @Test
    fun `authenticated non-actuator caller never sees details, even when delegate would allow`() {
        val context = authenticatedContext(hasActuatorRole = false)
        whenever(delegate.showDetails(context)).thenReturn(true)

        assertThat(wrapper.showDetails(context)).isFalse
    }

    @Test
    fun `actuator caller sees details when delegate allows`() {
        val context = authenticatedContext(hasActuatorRole = true)
        whenever(delegate.showDetails(context)).thenReturn(true)

        assertThat(wrapper.showDetails(context)).isTrue
    }

    @Test
    fun `actuator caller does not see details when delegate denies (e g show-details=NEVER)`() {
        val context = authenticatedContext(hasActuatorRole = true)
        whenever(delegate.showDetails(context)).thenReturn(false)

        assertThat(wrapper.showDetails(context)).isFalse
    }

    @Test
    fun `showComponents follows the same role rule`() {
        val anonymous = anonymousContext()
        whenever(delegate.showComponents(anonymous)).thenReturn(true)
        assertThat(wrapper.showComponents(anonymous)).isFalse

        val actuator = authenticatedContext(hasActuatorRole = true)
        whenever(delegate.showComponents(actuator)).thenReturn(true)
        assertThat(wrapper.showComponents(actuator)).isTrue
    }

    private fun anonymousContext(): SecurityContext {
        val context = mock<SecurityContext>()
        whenever(context.principal).thenReturn(null)
        whenever(context.isUserInRole(ACTUATOR)).thenReturn(false)
        return context
    }

    private fun authenticatedContext(hasActuatorRole: Boolean): SecurityContext {
        val context = mock<SecurityContext>()
        whenever(context.principal).thenReturn(mock<Principal>())
        whenever(context.isUserInRole(ACTUATOR)).thenReturn(hasActuatorRole)
        return context
    }
}
