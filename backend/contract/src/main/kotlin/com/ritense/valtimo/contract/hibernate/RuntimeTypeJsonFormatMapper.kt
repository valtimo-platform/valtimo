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
package com.ritense.valtimo.contract.hibernate

import com.fasterxml.jackson.databind.ObjectMapper
import org.hibernate.type.format.AbstractJsonFormatMapper
import java.lang.reflect.Type

/**
 * Hibernate's own Jackson mapper writes a value with its declared type. For a declared type without properties, such as
 * a sealed interface, every element then becomes `{}`, which breaks Hibernate's deep copy of the value. This writes the
 * runtime type, as hypersistence-utils did before Valtimo moved to Hibernate 7, and reads the declared type.
 */
class RuntimeTypeJsonFormatMapper(private val objectMapper: ObjectMapper) : AbstractJsonFormatMapper() {

    override fun <T> fromString(charSequence: CharSequence, type: Type): T =
        objectMapper.readValue(charSequence.toString(), objectMapper.constructType(type))

    override fun <T> toString(value: T, type: Type): String = objectMapper.writeValueAsString(value)
}
