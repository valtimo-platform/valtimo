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
package com.ritense.valtimo.test.golden

import com.fasterxml.jackson.databind.MapperFeature
import com.fasterxml.jackson.databind.SerializationFeature
import com.fasterxml.jackson.databind.json.JsonMapper
import com.ritense.outbox.OutboxMessage
import com.ritense.outbox.repository.OutboxMessageRepository
import org.aopalliance.intercept.MethodInterceptor
import org.springframework.aop.framework.Advised
import org.springframework.aop.framework.ProxyFactory
import org.springframework.beans.factory.config.BeanPostProcessor
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardOpenOption.APPEND
import java.nio.file.StandardOpenOption.CREATE

/**
 * Writes every outbox message a test run stores to `<directory>/<event type>.jsonl`, normalised by [GoldenJson] and
 * de-duplicated, so the events of two builds can be diffed per type.
 */
class OutboxEventRecorder(private val directory: Path) : BeanPostProcessor {

    private val mapper = JsonMapper.builder()
        .enable(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY)
        .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
        .build()
    private val seen = mutableMapOf<String, MutableSet<String>>()

    override fun postProcessAfterInitialization(bean: Any, beanName: String): Any {
        if (bean !is OutboxMessageRepository) {
            return bean
        }
        val interceptor = MethodInterceptor { invocation ->
            when (invocation.method.name) {
                "save" -> record(listOf(invocation.arguments[0]))
                "saveAll" -> record((invocation.arguments[0] as Iterable<*>).toList())
            }
            invocation.proceed()
        }
        if (bean is Advised && !bean.isFrozen) {
            bean.addAdvice(0, interceptor)
            return bean
        }
        return ProxyFactory(bean).apply { addAdvice(interceptor) }.proxy
    }

    @Synchronized
    private fun record(messages: List<Any?>) {
        messages.filterIsInstance<OutboxMessage>().forEach { message ->
            val normalized = GoldenJson.normalize(message.message)
            val type = normalized.path("type").asText("unknown")
            val line = mapper.writeValueAsString(mapper.treeToValue(normalized, Any::class.java))
            val file = directory.resolve("$type.jsonl")
            val lines = seen.getOrPut(type) {
                if (Files.exists(file)) Files.readAllLines(file).toMutableSet() else mutableSetOf()
            }
            if (lines.add(line)) {
                Files.createDirectories(directory)
                Files.writeString(file, line + "\n", CREATE, APPEND)
            }
        }
    }
}
