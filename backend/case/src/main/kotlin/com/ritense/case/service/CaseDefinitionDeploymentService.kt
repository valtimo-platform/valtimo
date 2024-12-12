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

package com.ritense.case.service

import CaseDefinitionDto
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import mu.KotlinLogging
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.core.io.Resource
import org.springframework.core.io.ResourceLoader
import org.springframework.core.io.support.ResourcePatternUtils
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.util.StreamUtils
import java.nio.charset.StandardCharsets


@Transactional
@Service
@SkipComponentScan
class CaseDefinitionDeploymentService(
    private val resourceLoader: ResourceLoader,
    private val objectMapper: ObjectMapper,
    private val caseDefinitionRepository: CaseDefinitionRepository
) {

    @EventListener(ApplicationReadyEvent::class)
    fun deployOnStartup() {
        try {
            loadResources().forEach { resource ->
                if (resource.filename != null) {
                    val fileContent = StreamUtils.copyToString(resource.inputStream, StandardCharsets.UTF_8)
                    deploy(fileContent)
                }
            }
        } catch (e: Exception) {
            throw RuntimeException("Error deploying Case Definitions", e)
        }
    }

    fun deploy(fileContent: String, forceDeploy: Boolean = false) {
        val caseDefinitionDto = try {
            objectMapper.readValue(fileContent, CaseDefinitionDto::class.java)
        } catch (e: Exception) {
            throw IllegalArgumentException("Failed to parse file content as a valid case definition: ${e.message}", e)
        }

        val caseDefinition = caseDefinitionDto.toEntity()

        logger.debug { "Deploying case definition with id '${caseDefinition.id}'" }

        val existingCaseDefinition = caseDefinitionRepository.findByIdOrNull(caseDefinition.id)

        if (existingCaseDefinition == null || forceDeploy) {
            caseDefinitionRepository.save(caseDefinition)
            logger.debug { "Case definition with id '${caseDefinition.id}' was saved" }
        } else {
            logger.debug { "Not deploying case definition with '${caseDefinition.id}', it already exists" }
        }
    }

    private fun loadResources(): Array<Resource> {
        return ResourcePatternUtils.getResourcePatternResolver(resourceLoader).getResources(CASE_DEFINITION_PATH)
    }

    companion object {
        val logger = KotlinLogging.logger {}
        const val CASE_DEFINITION_PATH = "classpath:config/*/*/case/definition/*.json"
    }
}
