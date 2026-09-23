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

package com.ritense.externalplugin.web.rest

import com.ritense.valtimo.service.ProcessDefinitionCaseDefinitionLinker
import com.ritense.valtimo.web.rest.SecuritySmokeIntegrationTest
import org.springframework.test.context.bean.override.mockito.MockitoBean

/**
 * Every endpoint this module contributes must answer 401/403 to an unauthenticated caller. The
 * external-plugin module is the one place where a *missing* security matcher is especially dangerous:
 * the callback endpoints exist to be reached by plugin hosts carrying a plugin-minted token, so an
 * unguarded route would be reachable from outside the platform entirely.
 *
 * Runs under `:backend:external-plugin:securityTesting` (the `security` tag, inherited from the base
 * class, plus the docker-compose Postgres the task already declares). The complementary
 * [ExternalPluginEndpointAccessIntTest] covers the *positive* direction — an authenticated user
 * reaching the endpoints they should — which this scan cannot express.
 */
class ExternalPluginSecuritySmokeIntegrationTest : SecuritySmokeIntegrationTest(
    basePackageName = "com.ritense.externalplugin"
) {
    // UserManagementService and MailSender are already mocked by the base class.
    @MockitoBean
    lateinit var processDefinitionCaseDefinitionLinker: ProcessDefinitionCaseDefinitionLinker
}
