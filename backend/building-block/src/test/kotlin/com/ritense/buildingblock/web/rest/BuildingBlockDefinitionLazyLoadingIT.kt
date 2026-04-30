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

package com.ritense.buildingblock.web.rest

import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinitionArtwork
import com.ritense.buildingblock.repository.BuildingBlockDefinitionArtworkRepository
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import jakarta.persistence.EntityManager
import jakarta.transaction.Transactional
import org.assertj.core.api.Assertions.assertThat
import org.hibernate.Hibernate
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.semver4j.Semver
import org.springframework.beans.factory.annotation.Autowired
import java.time.LocalDateTime
import java.util.Base64

@Transactional
class BuildingBlockDefinitionLazyLoadingIT @Autowired constructor(
    private val em: EntityManager,
    private val definitionRepository: BuildingBlockDefinitionRepository,
    private val artworkRepository: BuildingBlockDefinitionArtworkRepository
) : BaseIntegrationTest() {

    private val key = "lazy-bb"
    private val version = "3.0.0"
    private val id = BuildingBlockDefinitionId(key, Semver.parse(version)!!)

    @BeforeEach
    fun setUp() {
        artworkRepository.deleteAll()
        definitionRepository.deleteAll()

        val def = BuildingBlockDefinition(
            id = id,
            name = "Lazy Block",
            description = "desc",
            createdBy = "tester",
            createdDate = LocalDateTime.now(),
            basedOnVersionTag = null,
            final = false
        )
        definitionRepository.saveAndFlush(def)

        val imageBase64 = Base64.getEncoder().encodeToString(byteArrayOf(1, 2, 3))
        val artwork = BuildingBlockDefinitionArtwork(
            id = id,
            definition = def,
            imageBase64 = imageBase64
        )
        artworkRepository.saveAndFlush(artwork)

        em.clear()
    }

    @Test
    fun `should lazy load artwork when accessed from definition`() {
        val defRef = definitionRepository.getReferenceById(id)

        assertThat(Hibernate.isPropertyInitialized(defRef, "artwork")).isFalse()

        val base64 = defRef.artwork?.imageBase64

        assertThat(Hibernate.isPropertyInitialized(defRef, "artwork")).isTrue()
        assertThat(base64).isNotNull()
    }
}