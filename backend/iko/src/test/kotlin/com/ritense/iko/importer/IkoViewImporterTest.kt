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

package com.ritense.iko.importer

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.iko.service.IkoViewService
import com.ritense.importer.ValtimoImportTypes.Companion.IKO_REPOSITORY_CONFIG
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension

@ExtendWith(MockitoExtension::class)
class IkoViewImporterTest(
    @Mock private val objectMapper: ObjectMapper,
    @Mock private val ikoViewService: IkoViewService,
) {
    private lateinit var importer: IkoViewImporter

    @BeforeEach
    fun before() {
        importer = IkoViewImporter(objectMapper, ikoViewService)
    }

    @Test
    fun `should be of type 'ikoview'`() {
        assertThat(importer.type()).isEqualTo("ikoview")
    }

    @Test
    fun `should depend on 'ikorepositoryconfig' type`() {
        assertThat(importer.dependsOn()).isEqualTo(setOf(IKO_REPOSITORY_CONFIG))
    }

    @Test
    fun `should support iko-view fileName`() {
        assertThat(importer.supports("/global/iko/person/person.iko-view.json")).isTrue()
    }

    @Test
    fun `should not support non-iko-view fileName`() {
        assertThat(importer.supports("/case/iko/person/person.iko-view.json")).isFalse()
        assertThat(importer.supports("/global/iko/person/person.non-iko-view.json")).isFalse()
    }
}
