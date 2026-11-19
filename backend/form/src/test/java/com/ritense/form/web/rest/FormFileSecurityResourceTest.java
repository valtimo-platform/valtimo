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

package com.ritense.form.web.rest;

import static com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN;
import static com.ritense.valtimo.contract.authentication.AuthoritiesConstants.USER;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpMethod.DELETE;
import static org.springframework.http.HttpMethod.GET;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.FOUND;

import com.ritense.form.BaseIntegrationTest;
import java.net.URL;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

@AutoConfigureMockMvc
class FormFileSecurityResourceTest extends BaseIntegrationTest {

    private static final String USER_EMAIL = "user@valtimo.nl";
    private static final String PATH = "/api/v1/form-file?form=x";

    @Autowired
    private MockMvc mockMvc;

    private void assertHttpStatus(HttpMethod method, String path, HttpStatus status) throws Exception {
        int actual = mockMvc.perform(MockMvcRequestBuilders.request(method, path).accept(MediaType.ALL))
            .andReturn()
            .getResponse()
            .getStatus();
        assertThat(actual).isEqualTo(status.value());
    }

    @Test
    void getFormFileAnonymous() throws Exception {
        assertHttpStatus(GET, PATH, FORBIDDEN);
        verify(resourceService, never()).getResourceUrl(anyString());
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {USER})
    void getFormFileAsUser() throws Exception {
        when(resourceService.getResourceUrl(anyString())).thenReturn(new URL("http://www.nu.nl"));

        assertHttpStatus(GET, PATH, FOUND);
    }

    @Test
    void uploadFormFileAnonymous() throws Exception {
        assertHttpStatus(POST, "/api/v1/form-file/upload", FORBIDDEN);
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {USER})
    void deleteFormFileAsUser() throws Exception {
        assertHttpStatus(DELETE, PATH, FORBIDDEN);
        verify(resourceService, never()).removeResource(any(String.class));
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {ADMIN})
    void deleteFormFileAsAdmin() throws Exception {
        assertHttpStatus(DELETE, PATH, FORBIDDEN);
        verify(resourceService, never()).removeResource(any(String.class));
    }

}
