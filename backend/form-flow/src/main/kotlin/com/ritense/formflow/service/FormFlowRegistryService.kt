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

package com.ritense.formflow.service

import com.fasterxml.jackson.databind.jsontype.NamedType
import com.ritense.formflow.domain.definition.configuration.step.StepTypeProperties
import com.ritense.formflow.expression.FormFlowBean
import com.ritense.formflow.handler.FormFlowStepTypeHandler
import com.ritense.formflow.web.rest.dto.FormFlowExpressionBeanDto
import com.ritense.formflow.web.rest.dto.FormFlowExpressionMethodDto
import com.ritense.formflow.web.rest.dto.FormFlowExpressionParameterDto
import com.ritense.formflow.web.rest.dto.FormFlowRegistryDto
import com.ritense.formflow.web.rest.dto.FormFlowStepTypeDto
import com.ritense.formflow.web.rest.dto.FormFlowStepTypePropertyDto
import org.springframework.context.ApplicationContext
import org.springframework.core.DefaultParameterNameDiscoverer
import org.springframework.util.ClassUtils
import java.lang.reflect.Method
import java.lang.reflect.Modifier

class FormFlowRegistryService(
    private val stepTypeHandlers: List<FormFlowStepTypeHandler>,
    private val stepPropertiesTypes: Collection<NamedType>,
    private val applicationContext: ApplicationContext,
) {
    private val parameterNameDiscoverer = DefaultParameterNameDiscoverer()
    private val cacheLock = Any()

    @Volatile
    private var cachedRegistry: FormFlowRegistryDto? = null

    /**
     * Returns the registry that describes what can be used in a form flow definition.
     *
     * Step types and expression beans are determined by the application classpath and Spring
     * configuration, so they do not change while the application is running. The result is
     * therefore built once and reused for subsequent calls.
     */
    fun getRegistry(): FormFlowRegistryDto {
        cachedRegistry?.let { return it }

        return synchronized(cacheLock) {
            cachedRegistry ?: createRegistry().also {
                cachedRegistry = it
            }
        }
    }

    private fun createRegistry(): FormFlowRegistryDto {
        return FormFlowRegistryDto(
            stepTypes = createStepTypes(),
            expressionBeans = createExpressionBeans(),
        )
    }

    private fun createStepTypes(): List<FormFlowStepTypeDto> {
        val propertiesByTypeName = stepPropertiesTypes
            .filter { StepTypeProperties::class.java.isAssignableFrom(it.type) }
            .associate { it.name to it.type }

        return stepTypeHandlers
            .map { it.getType() }
            .distinct()
            .sorted()
            .map { typeName ->
                FormFlowStepTypeDto(
                    name = typeName,
                    properties = propertiesByTypeName[typeName]
                        ?.let(::extractStepTypeProperties)
                        ?: emptyList(),
                )
            }
    }

    private fun extractStepTypeProperties(clazz: Class<*>): List<FormFlowStepTypePropertyDto> {
        return clazz.declaredFields
            .filterNot { it.isSynthetic || Modifier.isStatic(it.modifiers) }
            .map {
                FormFlowStepTypePropertyDto(
                    name = it.name,
                    type = it.type.simpleName,
                )
            }
    }

    private fun createExpressionBeans(): List<FormFlowExpressionBeanDto> {
        return applicationContext.getBeansWithAnnotation(FormFlowBean::class.java)
            .map { (beanName, bean) ->
                FormFlowExpressionBeanDto(
                    name = beanName,
                    methods = extractMethods(ClassUtils.getUserClass(bean)),
                )
            }
            .sortedBy(FormFlowExpressionBeanDto::name)
    }

    private fun extractMethods(clazz: Class<*>): List<FormFlowExpressionMethodDto> {
        return clazz.methods
            .filterNot { it.isSynthetic || it.isBridge }
            .filterNot { it.declaringClass == Any::class.java }
            .filterNot { Modifier.isStatic(it.modifiers) }
            .map { method ->
                FormFlowExpressionMethodDto(
                    name = method.name,
                    parameters = extractParameters(method),
                    returnType = method.returnType.simpleName,
                )
            }
            .sortedWith(
                compareBy(
                    { it.name },
                    { it.parameters.size },
                )
            )
    }

    private fun extractParameters(method: Method): List<FormFlowExpressionParameterDto> {
        val parameterNames = parameterNameDiscoverer.getParameterNames(method)

        return method.parameters.mapIndexed { index, parameter ->
            FormFlowExpressionParameterDto(
                name = parameterNames?.getOrNull(index) ?: parameter.name,
                type = parameter.type.simpleName,
            )
        }
    }
}
