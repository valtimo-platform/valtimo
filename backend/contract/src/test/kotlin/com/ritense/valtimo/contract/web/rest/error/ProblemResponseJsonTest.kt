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

package com.ritense.valtimo.contract.web.rest.error

import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder
import tools.jackson.databind.json.JsonMapper

class ProblemResponseJsonTest {

    private val problem = BadRequestAlertException(
        "Bad thing happened",
        "goldenEntity",
        "badThing",
        IllegalStateException("database password is secret")
    )

    @Test
    fun `should write a problem with Jackson 2 without stack trace or cause`() {
        val json = readTree(Jackson2ObjectMapperBuilder.json().build<ObjectMapper>().writeValueAsString(ProblemResponse.of(problem.body)))

        assertThat(json.fieldNames().asSequence().toList()).containsExactlyInAnyOrder(*PROBLEM_FIELDS)
    }

    @Test
    fun `should write a problem with Jackson 3 without stack trace or cause`() {
        val json = readTree(JsonMapper.builder().build().writeValueAsString(ProblemResponse.of(problem.body)))

        assertThat(json.fieldNames().asSequence().toList()).containsExactlyInAnyOrder(*PROBLEM_FIELDS)
    }

    @Test
    fun `should leave out a missing title and type`() {
        val withoutTitle = ProblemException(null, null, HttpStatus.BAD_REQUEST)

        val json = readTree(JsonMapper.builder().build().writeValueAsString(ProblemResponse.of(withoutTitle.body)))

        assertThat(json.toString()).isEqualTo("""{"status":400}""")
    }

    private fun readTree(json: String) = ObjectMapper().readTree(json)

    companion object {
        private val PROBLEM_FIELDS = arrayOf("type", "title", "status", "message", "params", "entityName", "errorKey")
    }
}
