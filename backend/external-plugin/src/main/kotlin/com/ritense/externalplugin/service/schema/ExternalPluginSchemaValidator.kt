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

package com.ritense.externalplugin.service.schema

import com.fasterxml.jackson.databind.JsonNode
import com.networknt.schema.JsonSchema
import com.networknt.schema.JsonSchemaFactory
import com.networknt.schema.SchemaValidatorsConfig
import com.networknt.schema.SpecVersion
import com.networknt.schema.resource.DisallowSchemaLoader
import com.ritense.externalplugin.domain.ExternalPluginManifestContracts
import java.time.Duration

/**
 * The only way GZAC compiles or runs a JSON Schema that a plugin manifest supplied (contract
 * `input`/`output`, `configurationSchema`). Remote `$ref`s are refused; patterns run under a time budget.
 */
class ExternalPluginSchemaValidator(
    private val budget: Duration = DEFAULT_BUDGET,
    private val maxSchemaBytes: Int = DEFAULT_MAX_SCHEMA_BYTES,
    private val maxCachedSchemas: Int = DEFAULT_MAX_CACHED_SCHEMAS,
) {
    sealed interface Compiled {
        data class Ok(val schema: JsonSchema) : Compiled
        data class Invalid(val reason: String) : Compiled
    }

    sealed interface Outcome {
        data object Valid : Outcome
        data class Violations(val messages: List<String>) : Outcome
        data class SchemaInvalid(val reason: String) : Outcome
        data class Unverifiable(val reason: String) : Outcome
    }

    private val cache = object : LinkedHashMap<String, Compiled>(64, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Compiled>) = size > maxCachedSchemas
    }

    fun compile(schema: JsonNode): Compiled {
        if (!schema.isObject) return Compiled.Invalid("the schema must be a JSON object")
        val key = schema.toString()
        val bytes = key.toByteArray(Charsets.UTF_8).size
        if (bytes > maxSchemaBytes) return Compiled.Invalid("the schema is $bytes bytes; the maximum is $maxSchemaBytes")
        return synchronized(cache) { cache.getOrPut(key) { compileUncached(schema) } }
    }

    fun validate(schema: JsonNode, value: JsonNode): Outcome {
        val compiled = when (val c = compile(schema)) {
            is Compiled.Invalid -> return Outcome.SchemaInvalid(c.reason)
            is Compiled.Ok -> c.schema
        }
        return try {
            val messages = BoundedRegularExpressionFactory.within(budget) { compiled.validate(value) }.map { it.message }
            if (messages.isEmpty()) Outcome.Valid else Outcome.Violations(messages)
        } catch (e: SchemaBudgetExceededException) {
            Outcome.Unverifiable("checking it took longer than ${budget.toMillis()} ms")
        } catch (e: StackOverflowError) {
            Outcome.Unverifiable("a pattern or the value is nested too deeply to check")
        } catch (e: Exception) {
            Outcome.SchemaInvalid(e.message ?: e.javaClass.simpleName)
        }
    }

    /** One entry per provided operation whose `input`/`output` schema GZAC cannot use; empty when all compile. */
    fun contractSchemaErrors(manifest: JsonNode?): List<String> =
        ExternalPluginManifestContracts.providedContracts(manifest).flatMap { contract ->
            contract.operations.flatMap { op ->
                listOfNotNull(
                    op.input?.let { schemaError(contract.contract, op.key, "input", it) },
                    op.output?.let { schemaError(contract.contract, op.key, "output", it) },
                )
            }
        }

    private fun schemaError(contract: String, key: String, kind: String, schema: JsonNode): String? =
        (compile(schema) as? Compiled.Invalid)?.let {
            "Operation '$key' of contract '$contract' declares an invalid $kind schema: ${it.reason}"
        }

    private fun compileUncached(schema: JsonNode): Compiled = try {
        Compiled.Ok(FACTORY.getSchema(schema, CONFIG).also { it.initializeValidators() })
    } catch (e: Exception) {
        Compiled.Invalid(e.message ?: e.javaClass.simpleName)
    }

    companion object {
        val DEFAULT_BUDGET: Duration = Duration.ofMillis(200)
        const val DEFAULT_MAX_SCHEMA_BYTES = 65_536
        const val DEFAULT_MAX_CACHED_SCHEMAS = 512

        // Remote `$ref`s are refused: a provider manifest must not make GZAC fetch arbitrary URLs.
        private val FACTORY = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012) { builder ->
            builder.schemaLoaders { it.add(DisallowSchemaLoader.getInstance()) }
        }
        private val CONFIG = SchemaValidatorsConfig.builder().regularExpressionFactory(BoundedRegularExpressionFactory).build()
    }
}
