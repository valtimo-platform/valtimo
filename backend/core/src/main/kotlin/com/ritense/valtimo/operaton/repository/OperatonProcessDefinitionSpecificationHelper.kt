/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.valtimo.operaton.repository

import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.process.ProcessConstants.OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX
import com.ritense.valtimo.contract.process.ProcessConstants.OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.service.OperatonProcessService.DETACHED_PROCESS_DEFINITION_PREFIX
import org.operaton.bpm.engine.impl.persistence.entity.SuspensionState
import org.springframework.data.jpa.domain.Specification

class OperatonProcessDefinitionSpecificationHelper {

    companion object {

        const val ID: String = "id"
        const val REVISION: String = "revision"
        const val CATEGORY: String = "category"
        const val NAME: String = "name"
        const val KEY: String = "key"
        const val VERSION: String = "version"
        const val DEPLOYMENT_ID: String = "deploymentId"
        const val RESOURCE_NAME: String = "resourceName"
        const val DIAGRAM_RESOURCE_NAME: String = "diagramResourceName"
        const val HAS_START_FORM_KEY: String = "hasStartFormKey"
        const val SUSPENSION_STATE: String = "suspensionState"
        const val TENANT_ID: String = "tenantId"
        const val VERSION_TAG: String = "versionTag"
        const val HISTORY_TIME_TO_LIVE: String = "historyTimeToLive"
        const val IS_STARTABLE_IN_TASK_LIST: String = "isStartableInTasklist"

        @JvmStatic
        fun byId(id: String) = Specification<OperatonProcessDefinition> { root, _, cb ->
            cb.equal(root.get<Any>(ID), id)
        }

        @JvmStatic
        fun byKey(processDefinitionKey: String) = Specification<OperatonProcessDefinition> { root, _, cb ->
            cb.equal(root.get<Any>(KEY), processDefinitionKey)
        }

        @JvmStatic
        fun byKeyIn(processDefinitionKeys: Collection<String>) = Specification<OperatonProcessDefinition> { root, _, _ ->
            root.get<Any>(KEY).`in`(processDefinitionKeys)
        }

        @JvmStatic
        fun byVersion(version: Int) = Specification<OperatonProcessDefinition> { root, _, cb ->
            cb.equal(root.get<Any>(VERSION), version)
        }

        @JvmStatic
        fun byVersionTag(versionTag: String) = Specification<OperatonProcessDefinition> { root, _, cb ->
            cb.equal(root.get<Any>(VERSION_TAG), versionTag)
        }

        @JvmStatic
        fun byLatestVersion() = Specification<OperatonProcessDefinition> { root, query, cb ->
            val sub = query.subquery(Long::class.java)
            val subRoot = sub.from(OperatonProcessDefinition::class.java)
            sub.select(cb.max(subRoot.get(VERSION)))
            sub.where(
                cb.and(
                    cb.equal(subRoot.get<Any>(KEY), root.get<Any>(KEY)),
                    cb.or(
                        cb.equal(subRoot.get<Any>(TENANT_ID), root.get<Any>(TENANT_ID)),
                        cb.and(subRoot.get<Any>(TENANT_ID).isNull, root.get<Any>(TENANT_ID).isNull)
                    )
                )
            )
            sub.groupBy(subRoot.get<Any>(TENANT_ID), subRoot.get<Any>(KEY))
            cb.equal(root.get<Any>(VERSION), sub)
        }

        @JvmStatic
        fun maxVersionOf(spec: Specification<OperatonProcessDefinition>) =
            Specification<OperatonProcessDefinition> { root, query, cb ->
                val sub = query.subquery(Long::class.java)
                val subRoot = sub.from(OperatonProcessDefinition::class.java)
                sub.select(cb.max(subRoot.get(VERSION)))
                sub.where(
                    cb.and(
                        cb.equal(subRoot.get<Any>(KEY), root.get<Any>(KEY)),
                        spec.toPredicate(subRoot, query, cb),
                        cb.or(
                            cb.equal(subRoot.get<Any>(TENANT_ID), root.get<Any>(TENANT_ID)),
                            cb.and(subRoot.get<Any>(TENANT_ID).isNull, root.get<Any>(TENANT_ID).isNull)
                        )
                    )
                )
                sub.groupBy(subRoot.get<Any>(TENANT_ID), subRoot.get<Any>(KEY))
                cb.equal(root.get<Any>(VERSION), sub)
            }

        @JvmStatic
        fun byActive() = Specification<OperatonProcessDefinition> { root, _, cb ->
            cb.equal(root.get<Any>(SUSPENSION_STATE), SuspensionState.ACTIVE.stateCode)
        }

        @JvmStatic
        fun byBlueprintId(blueprintId: BlueprintId?): Specification<OperatonProcessDefinition> {
            return if (blueprintId != null) {
                byVersionTag(blueprintId.getTagPrefix() + blueprintId.toString())
            } else {
                maxVersionOf(byNotLinkedToCaseDefinition())
            }
        }

        @JvmStatic
        fun byNotLinkedToCaseDefinition() = Specification<OperatonProcessDefinition> { root, _, cb ->
            cb.or(
                cb.isNull(root.get<Any>(VERSION_TAG)),
                cb.and(
                    cb.not(
                        cb.equal(
                            cb.function(
                                "left",
                                String::class.java,
                                root.get<String>(VERSION_TAG),
                                cb.literal(3)
                            ),
                            OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX
                        )
                    ),
                    cb.not(
                        cb.equal(
                            cb.function(
                                "left",
                                String::class.java,
                                root.get<String>(VERSION_TAG),
                                cb.literal(DETACHED_PROCESS_DEFINITION_PREFIX.length)
                            ),
                            DETACHED_PROCESS_DEFINITION_PREFIX
                        )
                    )
                )
            )
        }

        @JvmStatic
        fun byNotLinkedToBuildingBlock() = Specification<OperatonProcessDefinition> { root, _, cb ->
            cb.or(
                cb.isNull(root.get<Any>(VERSION_TAG)),
                cb.and(
                    cb.not(
                        cb.equal(
                            cb.function(
                                "left",
                                String::class.java,
                                root.get<String>(VERSION_TAG),
                                cb.literal(3)
                            ),
                            OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX
                        )
                    ),
                    cb.not(
                        cb.equal(
                            cb.function(
                                "left",
                                String::class.java,
                                root.get<String>(VERSION_TAG),
                                cb.literal(DETACHED_PROCESS_DEFINITION_PREFIX.length)
                            ),
                            DETACHED_PROCESS_DEFINITION_PREFIX
                        )
                    )
                )
            )
        }
    }
}