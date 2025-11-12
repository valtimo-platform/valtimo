/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.buildingblock.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.importer.ValtimoImportService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockImporterRan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.commons.lang3.StringUtils
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.event.EventListener
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.core.io.ResourceLoader
import org.springframework.core.io.support.ResourcePatternUtils
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.io.FileNotFoundException

@Transactional
@Service
@SkipComponentScan
class BuildingBlockDefinitionDeploymentService(
    private val resourceLoader: ResourceLoader,
    private val valtimoImportService: ValtimoImportService,
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
    private val applicationEventPublisher: ApplicationEventPublisher
) {
    @Order(Ordered.LOWEST_PRECEDENCE-1)
    @EventListener(ApplicationReadyEvent::class)
    fun deployOnStartup() {
        deployBuildingBlock()
        applicationEventPublisher.publishEvent(BuildingBlockImporterRan())
    }

    private fun deployBuildingBlock() {
        try {
            val resources =
                ResourcePatternUtils.getResourcePatternResolver(resourceLoader).getResources(BUILDING_BLOCK_DEFINITION_PATH)
                    .groupBy { resource ->
                        val relativePath = resource.url.path.substringAfter(BUILDING_BLOCK_DEFINITION_FOLDER_STRUCTURE)
                        relativePath.substring(0, StringUtils.ordinalIndexOf(relativePath, "/", 3))
                    }
                    .map { (key, files) ->
                        key to (files.map {
                            it.url.path.substringAfter(BUILDING_BLOCK_DEFINITION_FOLDER_STRUCTURE).substring(key.length) to it
                        })
                    }
            resources.forEach { (_, files) ->
                runWithoutAuthorization {
                    valtimoImportService.importBuildingBlockDefinition(files, buildingBlockDefinitionRepository.findAll().map { it.id })
                }
            }

        } catch (ex: FileNotFoundException) {
            // No resources found, nothing to import
            logger.info { "No case definitions found. Continuing startup without importing case definitions." }
        }
    }

    companion object {
        private const val BUILDING_BLOCK_DEFINITION_PATH = "classpath*:config/building-block/*/*/**/*.*"
        private const val BUILDING_BLOCK_DEFINITION_FOLDER_STRUCTURE = "/config/building-block"

        val logger = KotlinLogging.logger {}
    }
}