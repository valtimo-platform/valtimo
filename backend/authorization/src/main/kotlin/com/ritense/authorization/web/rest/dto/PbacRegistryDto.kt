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

package com.ritense.authorization.web.rest.dto

data class PbacRegistryDto(
    val resources: List<PbacResourceDto>,
    val operators: List<PbacOperatorDto>,
    val conditionTypes: List<PbacConditionTypeDto>,
    val entityMappers: List<PbacEntityMapperDto>,
    val roles: List<String>,
)

data class PbacResourceDto(
    val resourceType: String,
    val shortName: String,
    val actions: List<String>,
    val fields: List<PbacConditionFieldDto>,
    val fieldAliases: List<PbacFieldAliasDto>,
    val hasSpecificationFactory: Boolean,
    val containerTargets: List<String>,
)

data class PbacConditionFieldDto(
    val name: String,
    val type: String,
)

data class PbacFieldAliasDto(
    val alias: String,
    val field: String,
)

data class PbacEntityMapperDto(
    val fromResourceType: String,
    val toResourceType: String,
)

data class PbacOperatorDto(
    val key: String,
    val label: String,
)

data class PbacConditionTypeDto(
    val key: String,
    val label: String,
)
