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

package com.ritense.externalplugin.web.rest.error

import com.ritense.externalplugin.exception.ExternalPluginHostValidationException
import com.ritense.externalplugin.web.rest.error.ExternalPluginHostValidationExceptionMapper.ExternalPluginHostValidationErrorResponse
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.springframework.http.HttpStatus

/**
 * The add-host modal renders `detail` verbatim next to the fields the admin filled in, so the status
 * and that field are the contract. Without this mapper the same failure reaches the catch-all
 * handler and becomes a 500 carrying only a reference id, which the modal cannot explain.
 */
class ExternalPluginHostValidationExceptionMapperTest {

    private val mapper = ExternalPluginHostValidationExceptionMapper()

    private fun bodyOf(exception: ExternalPluginHostValidationException) =
        mapper.toResponse(exception, mock()).body as ExternalPluginHostValidationErrorResponse

    @Test
    fun `maps to 400 with the exception message as detail`() {
        val exception = ExternalPluginHostValidationException(
            "'http://0.0.0.0:8090' is not a reachable address for the base URL."
        )

        val response = mapper.toResponse(exception, mock())

        assertThat(response.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        val body = response.body as ExternalPluginHostValidationErrorResponse
        assertThat(body.status).isEqualTo(400)
        assertThat(body.detail).isEqualTo("'http://0.0.0.0:8090' is not a reachable address for the base URL.")
        assertThat(body.title).isNotBlank()
    }

    @Test
    fun `always yields a non-blank detail, even for an exception without a usable message`() {
        assertThat(bodyOf(ExternalPluginHostValidationException("")).detail).isNotBlank()
    }

    @Test
    fun `declares the exception type the translator resolves it by`() {
        assertThat(mapper.supportedType).isEqualTo(ExternalPluginHostValidationException::class.java)
    }
}
