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

import com.ritense.externalplugin.exception.ExternalPluginConfigurationValidationException
import com.ritense.externalplugin.web.rest.error.ExternalPluginConfigurationValidationExceptionMapper.ExternalPluginConfigurationValidationErrorResponse
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.springframework.http.HttpStatus

class ExternalPluginConfigurationValidationExceptionMapperTest {

    private val mapper = ExternalPluginConfigurationValidationExceptionMapper()

    @Test
    fun `maps to 400 with the exception message as detail`() {
        val exception = ExternalPluginConfigurationValidationException(
            "These contract bindings would create a cycle"
        )

        val response = mapper.toResponse(exception, mock())

        assertThat(response.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        val body = response.body as ExternalPluginConfigurationValidationErrorResponse
        assertThat(body.status).isEqualTo(400)
        assertThat(body.detail).isEqualTo("These contract bindings would create a cycle")
        assertThat(body.title).isNotBlank()
    }

    @Test
    fun `always yields a non-blank detail`() {
        val body = mapper.toResponse(ExternalPluginConfigurationValidationException(""), mock()).body
            as ExternalPluginConfigurationValidationErrorResponse
        assertThat(body.detail).isNotBlank()
    }

    @Test
    fun `declares the exception type the translator resolves it by`() {
        assertThat(mapper.supportedType).isEqualTo(ExternalPluginConfigurationValidationException::class.java)
    }
}
