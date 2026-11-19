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

package com.ritense.case.web.rest.error

import com.ritense.case.exception.InvalidGroupListColumnException
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.zalando.problem.Problem
import org.springframework.http.HttpStatus
import kotlin.test.assertEquals

class InvalidGroupListColumnExceptionMapperTest {

    @Test
    fun `maps exception to bad request`() {
        val response = InvalidGroupListColumnExceptionMapper()
            .toResponse(InvalidGroupListColumnException("not sortable"), mock())

        assertEquals(HttpStatus.BAD_REQUEST, response.statusCode)
        assertEquals("error.invalidGroupListColumn", (response.body as Problem).parameters["message"])
    }
}
