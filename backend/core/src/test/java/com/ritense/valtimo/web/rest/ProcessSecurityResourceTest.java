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

package com.ritense.valtimo.web.rest;

import static com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN;
import static com.ritense.valtimo.contract.authentication.AuthoritiesConstants.USER;
import static org.springframework.http.HttpMethod.GET;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;
import static org.springframework.http.HttpStatus.NO_CONTENT;
import static org.springframework.http.HttpStatus.OK;

import org.junit.jupiter.api.Test;
import org.springframework.security.test.context.support.WithMockUser;

class ProcessSecurityResourceTest extends SecuritySpecificEndpointIntegrationTest {

    private static final String USER_EMAIL = "user@valtimo.nl";

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {ADMIN})
    void migrateProcessInstancesByProcessDefinitionIdsAsAdmin() throws Exception {
        assertHttpStatus(POST, "/api/v1/process/definition/sourceProcessDefinitionId/targetProcessDefinitionId/migrate", INTERNAL_SERVER_ERROR);
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {USER})
    void migrateProcessInstancesByProcessDefinitionIdsAsUser() throws Exception {
        assertHttpStatus(POST, "/api/v1/process/definition/sourceProcessDefinitionId/targetProcessDefinitionId/migrate", FORBIDDEN);
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {ADMIN})
    void deleteAsAdmin() throws Exception {
        assertHttpStatus(POST, "/api/v1/process/processInstanceId/delete", BAD_REQUEST);
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {USER})
    void deleteAsUser() throws Exception {
        assertHttpStatus(POST, "/api/v1/process/processInstanceId/delete", FORBIDDEN);
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {USER})
    void getProcessInstanceHistoryAsUser() throws Exception {
        assertHttpStatus(GET, "/api/v1/process/processInstanceId/history", FORBIDDEN);
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {ADMIN})
    void getProcessInstanceHistoryAsAdmin() throws Exception {
        assertHttpStatus(GET, "/api/v1/process/processInstanceId/history", OK);
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {USER})
    void getProcessInstanceAsUser() throws Exception {
        assertHttpStatus(GET, "/api/v1/process/processInstanceId", FORBIDDEN);
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {USER})
    void getProcessInstanceXmlAsUser() throws Exception {
        assertHttpStatus(GET, "/api/v1/process/processInstanceId/xml", FORBIDDEN);
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {USER})
    void getProcessInstanceVariablesAsUser() throws Exception {
        assertHttpStatus(POST, "/api/v1/process-instance/processInstanceId/variables", FORBIDDEN);
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {USER})
    void getProcessInstanceActivitiesAsUser() throws Exception {
        assertHttpStatus(GET, "/api/v1/process/processInstanceId/activities", FORBIDDEN);
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {USER})
    void getProcessInstanceOperationLogAsUser() throws Exception {
        assertHttpStatus(GET, "/api/v1/process/processInstanceId/log", FORBIDDEN);
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {USER})
    void getProcessInstanceActiveTaskAsUser() throws Exception {
        assertHttpStatus(GET, "/api/v1/process/processInstanceId/activetask", FORBIDDEN);
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {USER})
    void getProcessInstanceCommentsAsUser() throws Exception {
        assertHttpStatus(GET, "/api/v1/process/processInstanceId/comments", FORBIDDEN);
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {USER})
    void getProcessInstanceTasksStaysAuthenticatedForUser() throws Exception {
        // /tasks keeps per-document VIEW_LIST filtering, so it stays reachable for non-admins
        assertHttpStatus(GET, "/api/v1/process/processInstanceId/tasks", NO_CONTENT);
    }

}