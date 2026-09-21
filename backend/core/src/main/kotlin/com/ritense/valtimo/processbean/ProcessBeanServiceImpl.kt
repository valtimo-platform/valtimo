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

package com.ritense.valtimo.processbean

import com.ritense.valtimo.contract.annotation.ProcessBean
import com.ritense.valtimo.contract.annotation.ProcessBeanMethod
import com.ritense.valtimo.processbean.dto.ProcessBeanDto
import com.ritense.valtimo.processbean.dto.ProcessBeanMethodDto
import com.ritense.valtimo.processbean.dto.ProcessBeanMethodParameterDto
import org.springframework.context.ApplicationContext
import java.lang.reflect.Method
import java.lang.reflect.Modifier
import kotlin.reflect.full.findAnnotation

class ProcessBeanServiceImpl(
    private val applicationContext: ApplicationContext
) : ProcessBeanService {

    private val processBeans: Map<String, Any> by lazy {
        applicationContext.getBeansWithAnnotation(ProcessBean::class.java)
    }

    private val excludedMethodNames = setOf(
        "equals", "hashCode", "toString", "getClass",
        "wait", "notify", "notifyAll", "clone", "finalize"
    )

    override fun getProcessBeans(): List<ProcessBeanDto> {
        return processBeans.map { (beanName, bean) ->
            introspectBean(beanName, bean)
        }.sortedBy { it.name }
    }

    override fun getProcessBean(beanName: String): ProcessBeanDto? {
        val bean = processBeans[beanName] ?: return null
        return introspectBean(beanName, bean)
    }

    private fun introspectBean(beanName: String, bean: Any): ProcessBeanDto {
        val beanClass = bean.javaClass
        val annotation = findProcessBeanAnnotation(beanClass)

        val methods = beanClass.methods
            .filter { isEligibleMethod(it) }
            .map { introspectMethod(it) }
            .sortedBy { it.name }

        return ProcessBeanDto(
            name = beanName,
            className = beanClass.name,
            description = annotation?.description?.takeIf { it.isNotBlank() },
            methods = methods
        )
    }

    private fun findProcessBeanAnnotation(beanClass: Class<*>): ProcessBean? {
        // Check class and its interfaces/superclasses for @ProcessBean
        beanClass.getAnnotation(ProcessBean::class.java)?.let { return it }

        // Check Kotlin annotation
        beanClass.kotlin.findAnnotation<ProcessBean>()?.let { return it }

        // Check interfaces
        for (iface in beanClass.interfaces) {
            iface.getAnnotation(ProcessBean::class.java)?.let { return it }
        }

        // Check superclass
        beanClass.superclass?.let { superClass ->
            if (superClass != Any::class.java) {
                findProcessBeanAnnotation(superClass)?.let { return it }
            }
        }

        return null
    }

    private fun isEligibleMethod(method: Method): Boolean {
        return Modifier.isPublic(method.modifiers) &&
            !method.isSynthetic &&
            !method.isBridge &&
            method.name !in excludedMethodNames &&
            method.declaringClass != Any::class.java &&
            findProcessBeanMethodAnnotation(method) != null
    }

    private fun findProcessBeanMethodAnnotation(method: Method): ProcessBeanMethod? {
        // Check directly on method
        method.getAnnotation(ProcessBeanMethod::class.java)?.let { return it }

        // Check on interface methods with same signature
        for (iface in method.declaringClass.interfaces) {
            try {
                val ifaceMethod = iface.getMethod(method.name, *method.parameterTypes)
                ifaceMethod.getAnnotation(ProcessBeanMethod::class.java)?.let { return it }
            } catch (_: NoSuchMethodException) {
                // Method not declared in this interface
            }
        }

        return null
    }

    private fun introspectMethod(method: Method): ProcessBeanMethodDto {
        val annotation = findProcessBeanMethodAnnotation(method)

        return ProcessBeanMethodDto(
            name = method.name,
            description = annotation?.description?.takeIf { it.isNotBlank() },
            example = annotation?.example?.takeIf { it.isNotBlank() },
            returnType = method.returnType.simpleName,
            parameters = method.parameters.mapIndexed { index, param ->
                ProcessBeanMethodParameterDto(
                    name = param.name.takeIf { !it.startsWith("arg") } ?: "param$index",
                    type = param.type.simpleName
                )
            }
        )
    }
}
