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
import com.ritense.iko.service.IkoSeachActionService
import com.ritense.importer.ValtimoImportTypes.Companion.IKO_VIEW
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension

@ExtendWith(MockitoExtension::class)
class IkoSeachActionImporterTest(
    @Mock private val objectMapper: ObjectMapper,
    @Mock private val ikoSeachActionService: IkoSeachActionService,
    @Mock private val ikoViewService: IkoViewService,
) {
    private lateinit var importer: IkoSeachActionImporter

    @BeforeEach
    fun before() {
        importer = IkoSeachActionImporter(objectMapper, ikoSeachActionService, ikoViewService)
    }

    @Test
    fun `should be of type 'ikodatarequest'`() {
        assertThat(importer.type()).isEqualTo("ikodatarequest")
    }

    @Test
    fun `should depend on 'ikodataaggregate' type`() {
        assertThat(importer.dependsOn()).isEqualTo(setOf(IKO_VIEW))
    }

    @Test
    fun `should support iko-search-action fileName`() {
        assertThat(importer.supports("/global/iko/person/person.iko-search-action.json")).isTrue()
    }

    @Test
    fun `should not support non-iko-search-action fileName`() {
        assertThat(importer.supports("/case/iko/person/person.iko-search-action.json")).isFalse()
        assertThat(importer.supports("/global/iko/person/person.non-iko-search-action.json")).isFalse()
    }
}
