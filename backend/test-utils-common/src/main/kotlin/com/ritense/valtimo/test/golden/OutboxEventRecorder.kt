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
import com.ritense.outbox.CloudEventFactory
import com.ritense.outbox.OutboxService
import com.ritense.outbox.domain.BaseEvent
import io.cloudevents.core.provider.EventFormatProvider
import io.cloudevents.jackson.JsonFormat
import org.aopalliance.intercept.MethodInterceptor
import org.springframework.aop.framework.Advised
import org.springframework.aop.framework.ProxyFactory
import org.springframework.aop.framework.ReflectiveMethodInvocation
import org.springframework.beans.factory.BeanFactory
import org.springframework.beans.factory.BeanFactoryAware
import org.springframework.beans.factory.config.BeanPostProcessor
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardOpenOption.APPEND
import java.nio.file.StandardOpenOption.CREATE
import java.util.function.Supplier

/**
 * Writes every event sent to the outbox during a test run to `<directory>/<event type>.jsonl`, serialised as the outbox
 * does, normalised by [GoldenJson] and de-duplicated, so the events of two builds can be diffed per type. It hooks
 * [OutboxService.send], so it also sees events of tests that roll back or run with the local outbox.
 */
class OutboxEventRecorder(private val directory: Path) : BeanPostProcessor, BeanFactoryAware {

    private val mapper = JsonMapper.builder()
        .enable(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY)
        .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
        .build()
    private val seen = mutableMapOf<String, MutableSet<String>>()
    private lateinit var beanFactory: BeanFactory

    override fun setBeanFactory(beanFactory: BeanFactory) {
        this.beanFactory = beanFactory
    }

    override fun postProcessAfterInitialization(bean: Any, beanName: String): Any {
        if (bean !is OutboxService) {
            return bean
        }
        val interceptor = MethodInterceptor { invocation ->
            val supplier = invocation.arguments.singleOrNull()
            if (invocation.method.name == "send" && supplier is Supplier<*> && invocation is ReflectiveMethodInvocation) {
                val event = supplier.get() as BaseEvent
                invocation.arguments[0] = Supplier { event }
                runCatching { record(event) }.onFailure { System.err.println("[golden] could not record ${event.type}: $it") }
            }
            invocation.proceed()
        }
        if (bean is Advised && !bean.isFrozen) {
            bean.addAdvice(0, interceptor)
            return bean
        }
        return ProxyFactory(bean).apply {
            isProxyTargetClass = true
            addAdvice(interceptor)
        }.proxy
    }

    @Synchronized
    private fun record(event: BaseEvent) {
        val cloudEvent = beanFactory.getBean(CloudEventFactory::class.java).create(event)
        val format = checkNotNull(EventFormatProvider.getInstance().resolveFormat(JsonFormat.CONTENT_TYPE))
        val json = String(format.serialize(cloudEvent), Charsets.UTF_8)
        val normalized = GoldenJson.normalize(json)
        val line = mapper.writeValueAsString(mapper.treeToValue(normalized, Any::class.java))
        val file = directory.resolve("${event.type}.jsonl")
        val lines = seen.getOrPut(event.type) {
            if (Files.exists(file)) Files.readAllLines(file).toMutableSet() else mutableSetOf()
        }
        if (lines.add(line)) {
            Files.createDirectories(directory)
            Files.writeString(file, line + "\n", CREATE, APPEND)
        }
    }
}
