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
package com.ritense.valtimo.contract.json

import org.springframework.boot.context.properties.bind.BindException
import org.springframework.boot.diagnostics.AbstractFailureAnalyzer
import org.springframework.boot.diagnostics.FailureAnalysis
import org.springframework.core.Ordered
import org.springframework.core.convert.ConversionFailedException

/**
 * Spring Boot 4 binds `spring.jackson.*` to its Jackson 3 configuration, so a Boot 3 key that names a Jackson 2 feature
 * stops startup. Valtimo serializes with Jackson 2, which reads the same keys under `spring.jackson2.*`.
 */
class JacksonPropertiesFailureAnalyzer : AbstractFailureAnalyzer<BindException>(), Ordered {

    override fun analyze(rootFailure: Throwable, cause: BindException): FailureAnalysis? {
        val group = cause.name.toString()
        if (!JACKSON_FEATURE_GROUP.matches(group)) {
            return null
        }
        val feature = generateSequence(cause.cause) { it.cause }
            .filterIsInstance<ConversionFailedException>()
            .firstOrNull()
            ?.value
        val name = "$group.${feature ?: "*"}"
        return FailureAnalysis(
            "Property '$name' names a Jackson 2 feature that Spring Boot 4's Jackson 3 configuration doesn't support.",
            "Valtimo serializes with Jackson 2. Move the property to " +
                "'${name.replaceFirst("spring.jackson.", "spring.jackson2.")}'.",
            cause
        )
    }

    override fun getOrder() = Ordered.HIGHEST_PRECEDENCE

    companion object {
        private val JACKSON_FEATURE_GROUP =
            Regex("""spring\.jackson\.(serialization|deserialization|mapper|parser|generator)""")
    }
}
