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

package com.ritense.exporter.manifest

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class ResolvableValueSerializerTest {

    private val objectMapper = jacksonObjectMapper()

    @Test
    fun `should serialize a string value as a plain json string`() {
        val json = objectMapper.writeValueAsString(ResolvableValue.of("openzaak"))

        assertThat(json).isEqualTo("\"openzaak\"")
    }

    @Test
    fun `should serialize a ref value as a json object with a ref property`() {
        val value = ResolvableValue.ref(
            "config/case/bezwaar/1-0-0/case/definition/bezwaar.case-definition.json",
            "/versionTag"
        )

        val json = objectMapper.writeValueAsString(value)

        assertThat(json).isEqualTo(
            "{\"\$ref\":\"config/case/bezwaar/1-0-0/case/definition/bezwaar.case-definition.json#/versionTag\"}"
        )
    }
}
