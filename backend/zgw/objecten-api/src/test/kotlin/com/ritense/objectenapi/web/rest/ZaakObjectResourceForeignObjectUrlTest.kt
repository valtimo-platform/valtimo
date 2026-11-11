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

package com.ritense.objectenapi.web.rest

import com.ritense.authorization.AuthorizationService
import com.ritense.document.service.DocumentService
import com.ritense.form.service.FormDefinitionService
import com.ritense.objectenapi.ObjectenApiPlugin
import com.ritense.objectenapi.client.ObjectenApiClient
import com.ritense.objectenapi.management.ObjectManagementInfo
import com.ritense.objectenapi.management.ObjectManagementInfoProvider
import com.ritense.objectenapi.service.ZaakObjectService
import com.ritense.objecttypenapi.ObjecttypenApiPlugin
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.service.PluginService
import com.ritense.zakenapi.ZaakUrlProvider
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import java.net.URI
import java.util.UUID

internal class ZaakObjectResourceForeignObjectUrlTest {

    private val objectManagementId = UUID.randomUUID()
    private lateinit var client: ObjectenApiClient
    private lateinit var mockMvc: MockMvc

    @BeforeEach
    fun init() {
        client = mock()
        val objectenApiPlugin = ObjectenApiPlugin(client)
        objectenApiPlugin.authenticationPluginConfiguration = mock()
        objectenApiPlugin.url = URI("http://objecten.example.com/api/v2")

        val objecttypenApiPlugin = mock<ObjecttypenApiPlugin>()
        whenever(objecttypenApiPlugin.getObjectTypeUrlById(any())).thenReturn(URI("http://example.com/objecttype"))

        val objectenConfigurationId = UUID.randomUUID()
        val objecttypenConfigurationId = UUID.randomUUID()
        val pluginService = mock<PluginService>()
        whenever(pluginService.createInstance(PluginConfigurationId(objectenConfigurationId)))
            .thenReturn(objectenApiPlugin)
        whenever(pluginService.createInstance(PluginConfigurationId(objecttypenConfigurationId)))
            .thenReturn(objecttypenApiPlugin)

        val info = mock<ObjectManagementInfo>()
        whenever(info.objectenApiPluginConfigurationId).thenReturn(objectenConfigurationId)
        whenever(info.objecttypenApiPluginConfigurationId).thenReturn(objecttypenConfigurationId)
        whenever(info.objecttypeId).thenReturn("type-id")
        whenever(info.objecttypeVersion).thenReturn(1)
        val infoProvider = mock<ObjectManagementInfoProvider>()
        whenever(infoProvider.getObjectManagementInfo(objectManagementId)).thenReturn(info)

        val zaakObjectService = ZaakObjectService(
            mock<ZaakUrlProvider>(),
            pluginService,
            mock<FormDefinitionService>(),
            infoProvider
        )
        val resource = ZaakObjectResource(zaakObjectService, mock<DocumentService>(), mock<AuthorizationService>())
        mockMvc = MockMvcBuilders.standaloneSetup(resource).build()
    }

    @Test
    fun `should return 400 without outbound request on update with foreign object url`() {
        mockMvc.perform(
            put("/api/v1/object?objectManagementId=$objectManagementId&objectUrl=http://attacker.tld/api/v2/objects/1")
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content("""{"key": 1}""")
        )
            .andExpect(status().isBadRequest)

        verifyNoInteractions(client)
    }

    @Test
    fun `should return 400 without outbound request on delete with foreign object url`() {
        mockMvc.perform(
            delete(
                "/api/v1/object?objectManagementId=$objectManagementId" +
                    "&objectUrl=http://objecten.example.com.attacker.tld/api/v2/objects/1"
            )
        )
            .andExpect(status().isBadRequest)

        verifyNoInteractions(client)
    }
}
