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

package com.ritense.objectmanagement.service

import com.ritense.authorization.AuthorizationService
import com.ritense.objectenapi.ObjectenApiPlugin
import com.ritense.objectenapi.client.ObjectsList
import com.ritense.objectmanagement.domain.ObjectManagement
import com.ritense.objectmanagement.repository.ObjectManagementRepository
import com.ritense.objecttypenapi.ObjecttypenApiPlugin
import com.ritense.outbox.OutboxContext
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.service.PluginService
import com.ritense.search.service.SearchFieldV2Service
import com.ritense.search.service.SearchListColumnService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageRequest
import java.net.URI
import java.util.UUID

internal class ObjectManagementServiceTest {

    val objectManagementRepository = mock<ObjectManagementRepository>()
    val pluginService = mock<PluginService>()
    val searchFieldV2Service = mock<SearchFieldV2Service>()
    val searchListColumnService = mock<SearchListColumnService>()
    val authorizationService = mock<AuthorizationService>()

    val objectManagementService = ObjectManagementService(
        objectManagementRepository,
        pluginService,
        searchFieldV2Service,
        searchListColumnService,
        authorizationService,
        false
    )

    lateinit var objectenApiPlugin: ObjectenApiPlugin
    lateinit var objecttypenApiPlugin: ObjecttypenApiPlugin

    @BeforeEach
    fun setup() {
        objectenApiPlugin = mock()
        objecttypenApiPlugin = mock()
    }

    @Test
    fun `getObjects should suppress outbox when suppressOutbox is true`() {
        val objectManagement = createObjectManagement(suppressOutbox = true)
        preparePlugins(objectManagement)
        prepareObjectsList()

        var outboxWasSuppressed = false
        whenever(objectenApiPlugin.getObjectsByObjectTypeId(any(), any(), any(), any(), any())).thenAnswer {
            outboxWasSuppressed = OutboxContext.outboxSuppressed
            ObjectsList(count = 0, results = emptyList())
        }

        objectManagementService.getObjects(objectManagement.id, PageRequest.of(0, 10))

        assertThat(outboxWasSuppressed).isTrue()
        assertThat(OutboxContext.outboxSuppressed).isFalse()
    }

    @Test
    fun `getObjects should not suppress outbox when suppressOutbox is false`() {
        val objectManagement = createObjectManagement(suppressOutbox = false)
        preparePlugins(objectManagement)
        prepareObjectsList()

        var outboxWasSuppressed = false
        whenever(objectenApiPlugin.getObjectsByObjectTypeId(any(), any(), any(), any(), any())).thenAnswer {
            outboxWasSuppressed = OutboxContext.outboxSuppressed
            ObjectsList(count = 0, results = emptyList())
        }

        objectManagementService.getObjects(objectManagement.id, PageRequest.of(0, 10))

        assertThat(outboxWasSuppressed).isFalse()
    }

    @Test
    fun `getObjectsWithSearchParams should suppress outbox when suppressOutbox is true`() {
        val objectManagement = createObjectManagement(suppressOutbox = true)
        preparePlugins(objectManagement)

        var outboxWasSuppressed = false
        whenever(objectenApiPlugin.getObjectsByObjectTypeIdWithSearchParams(any(), any(), any(), any(), any())).thenAnswer {
            outboxWasSuppressed = OutboxContext.outboxSuppressed
            ObjectsList(count = 0, results = emptyList())
        }

        objectManagementService.getObjectsWithSearchParams(objectManagement, emptyList(), PageRequest.of(0, 10))

        assertThat(outboxWasSuppressed).isTrue()
        assertThat(OutboxContext.outboxSuppressed).isFalse()
    }

    @Test
    fun `getObjectsWithSearchParams should not suppress outbox when suppressOutbox is false`() {
        val objectManagement = createObjectManagement(suppressOutbox = false)
        preparePlugins(objectManagement)

        var outboxWasSuppressed = false
        whenever(objectenApiPlugin.getObjectsByObjectTypeIdWithSearchParams(any(), any(), any(), any(), any())).thenAnswer {
            outboxWasSuppressed = OutboxContext.outboxSuppressed
            ObjectsList(count = 0, results = emptyList())
        }

        objectManagementService.getObjectsWithSearchParams(objectManagement, emptyList(), PageRequest.of(0, 10))

        assertThat(outboxWasSuppressed).isFalse()
    }

    private fun createObjectManagement(suppressOutbox: Boolean = false): ObjectManagement {
        val objectManagement = ObjectManagement(
            objecttypeId = "objectTypeId",
            title = "myTitle",
            objectenApiPluginConfigurationId = UUID.randomUUID(),
            objecttypenApiPluginConfigurationId = UUID.randomUUID(),
            suppressOutbox = suppressOutbox
        )
        whenever(objectManagementRepository.findById(objectManagement.id)).thenReturn(java.util.Optional.of(objectManagement))
        return objectManagement
    }

    private fun preparePlugins(objectManagement: ObjectManagement) {
        whenever(pluginService.createInstance(PluginConfigurationId.existingId(objectManagement.objectenApiPluginConfigurationId)))
            .thenReturn(objectenApiPlugin)
        whenever(pluginService.createInstance(PluginConfigurationId.existingId(objectManagement.objecttypenApiPluginConfigurationId)))
            .thenReturn(objecttypenApiPlugin)
        whenever(objecttypenApiPlugin.url).thenReturn(URI.create("http://objecttypen.example.com"))
        whenever(objectenApiPlugin.url).thenReturn(URI.create("http://objecten.example.com"))
    }

    private fun prepareObjectsList() {
        whenever(objectenApiPlugin.getObjectsByObjectTypeId(any(), any(), any(), any(), any())).thenReturn(
            ObjectsList(count = 0, results = emptyList())
        )
    }

    @Test
    fun `getObjectsByConfig should resolve config by id`() {
        val objectManagement = createObjectManagement()
        preparePlugins(objectManagement)
        whenever(objectenApiPlugin.getObjectsByObjectTypeIdWithSearchParams(any(), any(), any(), any(), any()))
            .thenReturn(ObjectsList(count = 0, results = emptyList()))

        objectManagementService.getObjectsByConfig(
            id = objectManagement.id,
            title = null,
            dataAttrs = null,
            pageable = PageRequest.of(0, 10)
        )

        verify(objectenApiPlugin).getObjectsByObjectTypeIdWithSearchParams(any(), any(), any(), any(), any())
    }

    @Test
    fun `getObjectsByConfig should resolve config by title`() {
        val objectManagement = createObjectManagement()
        whenever(objectManagementRepository.findByTitle(objectManagement.title)).thenReturn(objectManagement)
        preparePlugins(objectManagement)
        whenever(objectenApiPlugin.getObjectsByObjectTypeIdWithSearchParams(any(), any(), any(), any(), any()))
            .thenReturn(ObjectsList(count = 0, results = emptyList()))

        objectManagementService.getObjectsByConfig(
            id = null,
            title = objectManagement.title,
            dataAttrs = null,
            pageable = PageRequest.of(0, 10)
        )

        verify(objectenApiPlugin).getObjectsByObjectTypeIdWithSearchParams(any(), any(), any(), any(), any())
    }

    @Test
    fun `getObjectsByConfig should return empty when config not found by id`() {
        val id = UUID.randomUUID()
        whenever(objectManagementRepository.findById(id)).thenReturn(java.util.Optional.empty())

        val result = objectManagementService.getObjectsByConfig(
            id = id,
            title = null,
            dataAttrs = null,
            pageable = PageRequest.of(0, 10)
        )

        assertThat(result.content).isEmpty()
        assertThat(result.totalElements).isEqualTo(0)
    }

    @Test
    fun `getObjectsByConfig should return empty when config not found by title`() {
        whenever(objectManagementRepository.findByTitle("nonexistent")).thenReturn(null)

        val result = objectManagementService.getObjectsByConfig(
            id = null,
            title = "nonexistent",
            dataAttrs = null,
            pageable = PageRequest.of(0, 10)
        )

        assertThat(result.content).isEmpty()
        assertThat(result.totalElements).isEqualTo(0)
    }

    @Test
    fun `getObjectsByConfig should throw when neither id nor title provided`() {
        assertThatThrownBy {
            objectManagementService.getObjectsByConfig(
                id = null,
                title = null,
                dataAttrs = null,
                pageable = PageRequest.of(0, 10)
            )
        }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("Either id or title must be provided")
    }

    @Test
    fun `getObjectsByConfig should parse dataAttrs correctly`() {
        val objectManagement = createObjectManagement()
        preparePlugins(objectManagement)
        whenever(objectenApiPlugin.getObjectsByObjectTypeIdWithSearchParams(any(), any(), any(), any(), any()))
            .thenReturn(ObjectsList(count = 0, results = emptyList()))

        objectManagementService.getObjectsByConfig(
            id = objectManagement.id,
            title = null,
            dataAttrs = "name__icontains__test,status__exact__active",
            pageable = PageRequest.of(0, 10)
        )

        verify(objectenApiPlugin).getObjectsByObjectTypeIdWithSearchParams(
            any(), any(), any(), any(), any()
        )
    }

    @Test
    fun `getObjectsByConfig should throw on invalid dataAttrs format`() {
        val objectManagement = createObjectManagement()
        preparePlugins(objectManagement)

        assertThatThrownBy {
            objectManagementService.getObjectsByConfig(
                id = objectManagement.id,
                title = null,
                dataAttrs = "invalid_format",
                pageable = PageRequest.of(0, 10)
            )
        }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("Invalid dataAttrs entry")
    }

    @Test
    fun `getObjectsByConfig should throw on unknown comparator`() {
        val objectManagement = createObjectManagement()
        preparePlugins(objectManagement)

        assertThatThrownBy {
            objectManagementService.getObjectsByConfig(
                id = objectManagement.id,
                title = null,
                dataAttrs = "name__unknown__test",
                pageable = PageRequest.of(0, 10)
            )
        }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("Invalid dataAttrs entry")
    }

    @Test
    fun `getObjectsByConfig should parse nested dataAttrs path`() {
        val objectManagement = createObjectManagement()
        preparePlugins(objectManagement)
        whenever(objectenApiPlugin.getObjectsByObjectTypeIdWithSearchParams(any(), any(), any(), any(), any()))
            .thenReturn(ObjectsList(count = 0, results = emptyList()))

        objectManagementService.getObjectsByConfig(
            id = objectManagement.id,
            title = null,
            dataAttrs = "address__city__icontains__amsterdam",
            pageable = PageRequest.of(0, 10)
        )

        val searchString = argumentCaptor<String>()
        verify(objectenApiPlugin).getObjectsByObjectTypeIdWithSearchParams(
            any(), any(), searchString.capture(), any(), any()
        )
        assertThat(searchString.firstValue).isEqualTo("address__city__icontains__amsterdam")
    }

    @Test
    fun `getObjectsByConfig should keep multi-word dataAttrs value intact`() {
        val objectManagement = createObjectManagement()
        preparePlugins(objectManagement)
        whenever(objectenApiPlugin.getObjectsByObjectTypeIdWithSearchParams(any(), any(), any(), any(), any()))
            .thenReturn(ObjectsList(count = 0, results = emptyList()))

        objectManagementService.getObjectsByConfig(
            id = objectManagement.id,
            title = null,
            dataAttrs = "name__icontains__van der berg",
            pageable = PageRequest.of(0, 10)
        )

        val searchString = argumentCaptor<String>()
        verify(objectenApiPlugin).getObjectsByObjectTypeIdWithSearchParams(
            any(), any(), searchString.capture(), any(), any()
        )
        assertThat(searchString.firstValue).isEqualTo("name__icontains__van der berg")
    }
}
