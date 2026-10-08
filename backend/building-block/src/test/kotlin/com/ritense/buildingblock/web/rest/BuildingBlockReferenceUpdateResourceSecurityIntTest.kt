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

package com.ritense.buildingblock.web.rest

import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateExecuteRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdatePreviewRequestDto
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.USER
import com.ritense.valtimo.web.rest.SecuritySpecificEndpointIntegrationTest
import org.junit.jupiter.api.Test
import org.springframework.http.HttpMethod.GET
import org.springframework.http.HttpMethod.POST
import org.springframework.http.HttpStatus.FORBIDDEN
import org.springframework.http.HttpStatus.NOT_FOUND
import org.springframework.http.HttpStatus.OK
import org.springframework.security.test.context.support.WithMockUser

class BuildingBlockReferenceUpdateResourceSecurityIntTest : SecuritySpecificEndpointIntegrationTest() {

    private val preview = BuildingBlockReferenceUpdatePreviewRequestDto("no-such-block", "1.0.0", "1.0.1")
    private val execute = BuildingBlockReferenceUpdateExecuteRequestDto("no-such-block", "1.0.0", "1.0.1", listOf("chain"))

    @Test
    @WithMockUser(authorities = [ADMIN])
    fun `an admin can list the references to a building block version`() {
        assertHttpStatus(GET, "$BASE/references/no-such-block/version/1.0.0", OK)
    }

    @Test
    @WithMockUser(authorities = [USER])
    fun `a user cannot list the references to a building block version`() {
        assertHttpStatus(GET, "$BASE/references/no-such-block/version/1.0.0", FORBIDDEN)
    }

    @Test
    @WithMockUser(authorities = [ADMIN])
    fun `an admin reaches the reference update preview`() {
        assertHttpStatus(POST, "$BASE/preview", preview, NOT_FOUND)
    }

    @Test
    @WithMockUser(authorities = [USER])
    fun `a user cannot preview a reference update`() {
        assertHttpStatus(POST, "$BASE/preview", preview, FORBIDDEN)
    }

    @Test
    @WithMockUser(authorities = [ADMIN])
    fun `an admin reaches the reference update execution`() {
        assertHttpStatus(POST, "$BASE/execute", execute, NOT_FOUND)
    }

    @Test
    @WithMockUser(authorities = [USER])
    fun `a user cannot execute a reference update`() {
        assertHttpStatus(POST, "$BASE/execute", execute, FORBIDDEN)
    }

    private companion object {
        const val BASE = "/api/management/v1/building-block/reference-update"
    }
}
