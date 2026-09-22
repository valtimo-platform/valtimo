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

package com.ritense.adminsettings.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.adminsettings.web.rest.dto.MenuConfigurationDto
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatCode
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.util.UUID

/**
 * The finder is the one place the backend interprets the otherwise-opaque, frontend-owned menu JSON,
 * and it sits on the plugin delete path. So the cases that matter most are the hostile ones: a
 * malformed node must be skipped rather than break an unrelated delete, and a node of another kind
 * that happens to carry a `configurationId` must not be reported as a page usage.
 */
class MenuConfigurationPluginUsageFinderTest {

    private val objectMapper = ObjectMapper()
    private lateinit var menuConfigurationService: MenuConfigurationService
    private lateinit var finder: MenuConfigurationPluginUsageFinder

    @BeforeEach
    fun setUp() {
        menuConfigurationService = mock()
        finder = MenuConfigurationPluginUsageFinder(menuConfigurationService)
    }

    @Test
    fun `reports a matching top-level plugin-page node with its title and bundle key`() {
        val configurationId = UUID.randomUUID()
        givenMenu(
            """
            {
              "version": 1,
              "items": [
                {"kind": "catalog", "key": "dossiers"},
                {
                  "kind": "plugin-page",
                  "configurationId": "$configurationId",
                  "bundleKey": "overview",
                  "title": "CRM overview",
                  "icon": "user"
                }
              ]
            }
            """
        )

        val usages = finder.findUsages(configurationId)

        assertThat(usages).hasSize(1)
        assertThat(usages.first().configurationId).isEqualTo(configurationId)
        assertThat(usages.first().title).isEqualTo("CRM overview")
        assertThat(usages.first().bundleKey).isEqualTo("overview")
    }

    @Test
    fun `finds a plugin-page node nested two levels deep under children`() {
        val configurationId = UUID.randomUUID()
        givenMenu(
            """
            {
              "items": [
                {
                  "kind": "group",
                  "title": "Admin",
                  "children": [
                    {
                      "kind": "group",
                      "title": "Plugins",
                      "children": [
                        {
                          "kind": "plugin-page",
                          "configurationId": "$configurationId",
                          "title": "Nested page"
                        }
                      ]
                    }
                  ]
                }
              ]
            }
            """
        )

        val usages = finder.findUsages(configurationId)

        assertThat(usages).hasSize(1)
        assertThat(usages.first().title).isEqualTo("Nested page")
        // No bundleKey in the document — reported as null rather than defaulted.
        assertThat(usages.first().bundleKey).isNull()
    }

    @Test
    fun `reports every menu node referencing the same configuration`() {
        val configurationId = UUID.randomUUID()
        givenMenu(
            """
            {
              "items": [
                {"kind": "plugin-page", "configurationId": "$configurationId", "title": "First"},
                {
                  "kind": "group",
                  "children": [
                    {"kind": "plugin-page", "configurationId": "$configurationId", "title": "Second"}
                  ]
                }
              ]
            }
            """
        )

        val usages = finder.findUsages(configurationId)

        assertThat(usages).extracting<String> { it.title }.containsExactlyInAnyOrder("First", "Second")
    }

    @Test
    fun `ignores a plugin-page node pointing at another configuration`() {
        givenMenu(
            """
            {
              "items": [
                {"kind": "plugin-page", "configurationId": "${UUID.randomUUID()}", "title": "Other"}
              ]
            }
            """
        )

        assertThat(finder.findUsages(UUID.randomUUID())).isEmpty()
    }

    @Test
    fun `an unset menu configuration reports no usages`() {
        givenMenu("{}")

        assertThat(finder.findUsages(UUID.randomUUID())).isEmpty()
    }

    @Test
    fun `an empty items array reports no usages`() {
        givenMenu("""{"version": 1, "items": []}""")

        assertThat(finder.findUsages(UUID.randomUUID())).isEmpty()
    }

    @Test
    fun `an items value that is not an array reports no usages instead of throwing`() {
        givenMenu("""{"items": "not-an-array"}""")

        assertThat(finder.findUsages(UUID.randomUUID())).isEmpty()
    }

    @Test
    fun `a plugin-page node without a configurationId is skipped, and its siblings still resolve`() {
        val configurationId = UUID.randomUUID()
        givenMenu(
            """
            {
              "items": [
                {"kind": "plugin-page", "title": "Missing id"},
                {"kind": "plugin-page", "configurationId": "$configurationId", "title": "Good page"}
              ]
            }
            """
        )

        val usages = finder.findUsages(configurationId)

        assertThat(usages).hasSize(1)
        assertThat(usages.first().title).isEqualTo("Good page")
    }

    @Test
    fun `a plugin-page node whose configurationId is not a UUID is skipped instead of throwing`() {
        val configurationId = UUID.randomUUID()
        givenMenu(
            """
            {
              "items": [
                {"kind": "plugin-page", "configurationId": "not-a-uuid", "title": "Broken"},
                {"kind": "plugin-page", "configurationId": "$configurationId", "title": "Good page"}
              ]
            }
            """
        )

        assertThatCode { finder.findUsages(configurationId) }.doesNotThrowAnyException()
        assertThat(finder.findUsages(configurationId)).extracting<String> { it.title }
            .containsExactly("Good page")
    }

    @Test
    fun `a node of another kind carrying the configurationId is not reported`() {
        val configurationId = UUID.randomUUID()
        givenMenu(
            """
            {
              "items": [
                {
                  "kind": "custom-link",
                  "title": "Looks like a page",
                  "link": "/plugins/page",
                  "configurationId": "$configurationId"
                }
              ]
            }
            """
        )

        assertThat(finder.findUsages(configurationId)).isEmpty()
    }

    @Test
    fun `a deeply nested menu is walked iteratively, so depth costs no stack`() {
        // The menu JSON is frontend-owned and its size is only bounded by MAX_CONFIGURATION_LENGTH,
        // hence the explicit work queue in the finder rather than recursion. The depth here stays
        // under Jackson's own default read constraint (1000 nesting levels), which is the real
        // upstream bound: MenuConfigurationService.getMenuConfiguration() reads the document with a
        // plain ObjectMapper, so anything deeper throws StreamConstraintsException at parse time and
        // never reaches this finder at all. Each menu level costs two nesting levels (the node object
        // plus its `children` array), so 400 groups sits at roughly 800.
        val configurationId = UUID.randomUUID()
        val depth = 400
        val leaf = """{"kind": "plugin-page", "configurationId": "$configurationId", "title": "Deep"}"""
        val nested = (1..depth).fold(leaf) { inner, _ -> """{"kind": "group", "children": [$inner]}""" }
        givenMenu("""{"items": [$nested]}""")

        val usages = finder.findUsages(configurationId)

        assertThat(usages).hasSize(1)
        assertThat(usages.first().title).isEqualTo("Deep")
    }

    private fun givenMenu(json: String) {
        whenever(menuConfigurationService.getMenuConfiguration())
            .thenReturn(MenuConfigurationDto(objectMapper.readTree(json)))
    }
}
