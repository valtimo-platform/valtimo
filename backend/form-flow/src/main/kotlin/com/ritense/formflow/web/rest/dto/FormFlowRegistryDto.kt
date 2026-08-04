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

package com.ritense.formflow.web.rest.dto

data class FormFlowRegistryDto(
    val stepTypes: List<FormFlowStepTypeDto>,
    val expressionBeans: List<FormFlowExpressionBeanDto>,
)

data class FormFlowStepTypeDto(
    val name: String,
    val properties: List<FormFlowStepTypePropertyDto>,
)

data class FormFlowStepTypePropertyDto(
    val name: String,
    val type: String,
)

data class FormFlowExpressionBeanDto(
    val name: String,
    val methods: List<FormFlowExpressionMethodDto>,
)

data class FormFlowExpressionMethodDto(
    val name: String,
    val parameters: List<FormFlowExpressionParameterDto>,
    val returnType: String,
)

data class FormFlowExpressionParameterDto(
    val name: String,
    val type: String,
)
