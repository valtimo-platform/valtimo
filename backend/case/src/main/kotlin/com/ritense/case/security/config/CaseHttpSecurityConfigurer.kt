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

package com.ritense.case.security.config

import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.USER
import com.ritense.valtimo.contract.security.config.HttpConfigurerConfigurationException
import com.ritense.valtimo.contract.security.config.HttpSecurityConfigurer
import org.springframework.http.HttpMethod.DELETE
import org.springframework.http.HttpMethod.GET
import org.springframework.http.HttpMethod.PATCH
import org.springframework.http.HttpMethod.POST
import org.springframework.http.HttpMethod.PUT
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher.pathPattern

class CaseHttpSecurityConfigurer : HttpSecurityConfigurer {

    override fun configure(http: HttpSecurity) {
        try {
            http.authorizeHttpRequests { requests ->
                requests.requestMatchers(pathPattern(GET, LIST_COLUMN_URL)).authenticated()
                    .requestMatchers(pathPattern(POST, LIST_COLUMN_URL)).hasAuthority(ADMIN) // Deprecated
                    .requestMatchers(pathPattern(PUT, LIST_COLUMN_URL)).hasAuthority(ADMIN) // Deprecated
                    .requestMatchers(pathPattern(DELETE, "$LIST_COLUMN_URL/{columnKey}"))
                    .hasAuthority(ADMIN) // Deprecated
                    .requestMatchers(pathPattern(GET, "/api/v1/case-definition")).authenticated()
                    .requestMatchers(pathPattern(GET, "/api/management/v1/case-definition")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "/api/management/v1/case-definition/{caseDefinitionName}/version"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "/api/v1/case-definition/{caseDefinitionKey}/settings"))
                    .authenticated()
                    .requestMatchers(
                        pathPattern(
                            GET,
                            "/api/v1/case-definition/{caseDefinitionkey}/version/{caseDefinitionVersionTag}/tab"
                        )
                    ).authenticated() // Deprecated
                    .requestMatchers(pathPattern(GET, "/api/v1/document/{documentId}/tab")).authenticated()
                    .requestMatchers(pathPattern(POST, "/api/v1/case/{caseDefinitionName}/search")).authenticated()
                    .requestMatchers(pathPattern(POST, "/api/v1/case/{caseDefinitionKey}/stored-quick-search")).authenticated()
                    .requestMatchers(pathPattern(DELETE, "/api/v1/case/{caseDefinitionKey}/stored-quick-search/{title}")).authenticated()
                    .requestMatchers(pathPattern(GET, "/api/v1/case/{caseDefinitionKey}/stored-quick-search")).authenticated()
                    .requestMatchers(pathPattern(POST, "/api/v1/case/{caseDefinitionName}/export")).authenticated()
                    .requestMatchers(pathPattern(GET, "/api/v1/case/{caseDefinitionKey}/hidden-list-column")).authenticated()
                    .requestMatchers(pathPattern(POST, "/api/v1/case/{caseDefinitionKey}/hidden-list-column")).authenticated()
                    .requestMatchers(pathPattern(GET, "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/configuration-issues")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/settings")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PATCH, "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/settings")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "/api/management/v1/case-definition/{caseDefinitionKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/active")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "/api/management/v1/case-definition/{key}/version/{version}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(DELETE, "/api/management/v1/case-definition/{key}/version/{version}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PATCH, "/api/management/v1/case-definition/{key}/version/{version}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, "/api/management/v1/case-definition/draft")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, "/api/management/v1/case-definition/{key}/version/{version}/finalize")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, MANAGEMENT_CASE_LIST_COLUMN_URL)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, MANAGEMENT_CASE_LIST_COLUMN_URL)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, MANAGEMENT_CASE_LIST_COLUMN_URL)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, MANAGEMENT_CASE_LIST_COLUMN_URL)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(DELETE, "$MANAGEMENT_CASE_LIST_COLUMN_URL/{columnKey}"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, CASE_COLUMN_URL)).authenticated()
                    .requestMatchers(pathPattern(GET, MANAGEMENT_TASK_LIST_COLUMN_URL)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, MANAGEMENT_TASK_LIST_COLUMN_URL)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, MANAGEMENT_TASK_LIST_COLUMN_V2_URL)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, "$MANAGEMENT_TASK_LIST_COLUMN_URL/{columnKey}"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(DELETE, "$MANAGEMENT_TASK_LIST_COLUMN_URL/{columnKey}"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, MANAGEMENT_TAB_URL)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, MANAGEMENT_TAB_URL)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, "$MANAGEMENT_TAB_URL/{tabKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(DELETE, "$MANAGEMENT_TAB_URL/{tabKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_TAB_URL/{tabKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, MANAGEMENT_TAB_URL)).hasAuthority(ADMIN)
                    .requestMatchers(
                        pathPattern(
                            GET,
                            "/api/management/v1/case/{caseDefinitionName}/version/{caseDefinitionVersion}/export"
                        )
                    ).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, "/api/management/v1/case/import")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, "/api/management/v1/case/import/preview")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "/api/management/v1/case-definition/check")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_WIDGET_TAB_URL/{tabKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, "$MANAGEMENT_WIDGET_TAB_URL/{tabKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$DOCUMENT_WIDGET_TAB_URL/{tabKey}/widget/{widgetKey}"))
                    .hasAuthority(USER)
                    .requestMatchers(pathPattern(GET, "$DOCUMENT_WIDGET_TAB_URL/{tabKey}")).hasAuthority(USER)
                    .requestMatchers(pathPattern(POST, MANAGEMENT_HEADER_WIDGET_URL)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, MANAGEMENT_HEADER_WIDGET_URL)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, MANAGEMENT_HEADER_WIDGET_URL)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(DELETE, MANAGEMENT_HEADER_WIDGET_URL)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$DOCUMENT_WIDGET_TAB_URL/{tabKey}/widget/{widgetKey}"))
                    .hasAuthority(USER)
                    .requestMatchers(pathPattern(GET, HEADER_WIDGET_URL))
                    .hasAuthority(USER)
                    .requestMatchers(pathPattern(GET, "$HEADER_WIDGET_URL/data")).hasAuthority(USER)
                    .requestMatchers(pathPattern(GET, "/api/management/v1/case-definition/{key}/version/{version}/finalizable")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, STARTABLE_ITEMS_PATH)).authenticated()
                    .requestMatchers(pathPattern(GET, MANAGEMENT_STARTABLE_ITEMS_URL)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, MANAGEMENT_STARTABLE_ITEMS_URL)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(DELETE, "$MANAGEMENT_STARTABLE_ITEMS_URL/{itemKey}/version/{versionTag}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(DELETE, "$MANAGEMENT_STARTABLE_ITEMS_URL/{itemKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, "$MANAGEMENT_STARTABLE_ITEMS_URL/order")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_STARTABLE_ITEMS_URL/{itemKey}/version/{versionTag}/properties")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_STARTABLE_ITEMS_URL/{itemKey}/properties")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, "$MANAGEMENT_STARTABLE_ITEMS_URL/{itemKey}/version/{versionTag}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, "$MANAGEMENT_STARTABLE_ITEMS_URL/{itemKey}")).hasAuthority(ADMIN)
            }
        } catch (e: Exception) {
            throw HttpConfigurerConfigurationException(e)
        }
    }

    companion object {

        private const val LIST_COLUMN_URL = "/api/v1/case/{caseDefinitionName}/list-column"
        private const val CASE_COLUMN_URL = "/api/v1/case/{caseDefinitionName}/task-list-column"
        private const val MANAGEMENT_CASE_LIST_COLUMN_URL = "/api/management/v1/case/{caseDefinitionName}/list-column"
        private const val MANAGEMENT_TASK_LIST_COLUMN_URL =
            "/api/management/v1/case/{caseDefinitionName}/task-list-column"
        private const val MANAGEMENT_TASK_LIST_COLUMN_V2_URL =
            "/api/management/v2/case/{caseDefinitionName}/task-list-column"
        private const val MANAGEMENT_TAB_URL =
            "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/tab"
        private const val MANAGEMENT_WIDGET_TAB_URL =
            "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/widget-tab"
        private const val DOCUMENT_WIDGET_TAB_URL = "/api/v1/document/{documentId}/widget-tab"
        private const val MANAGEMENT_HEADER_WIDGET_URL =
            "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/header-widget"
        private const val HEADER_WIDGET_URL =
            "/api/v1/case/{documentId}/header-widget"
        private const val STARTABLE_ITEMS_PATH = "/api/v1/case/startable-item"
        private const val MANAGEMENT_STARTABLE_ITEMS_URL =
            "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/startable-item"
    }
}