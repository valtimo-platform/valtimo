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

package com.ritense.zakenapi.service

import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.event.DocumentDeletedEvent
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.domain.ZaakInstanceLink
import com.ritense.zakenapi.link.ZaakInstanceLinkNotFoundException
import com.ritense.zakenapi.link.ZaakInstanceLinkService
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import java.net.URI
import java.util.UUID

class ZakenApiDocumentDeletedEventListenerTest {

    private val zaakInstanceService = mock<ZaakInstanceLinkService>()
    private val zaakDocumentService = mock<ZaakDocumentService>()
    private val pluginService = mock<PluginService>()

    private val listener: ZakenApiDocumentDeletedEventListener = ZakenApiDocumentDeletedEventListener(zaakInstanceService, zaakDocumentService, pluginService)

    @Test
    fun `should delete zaak when one is linked`() {
        val documentId = UUID.fromString("d1f1b3ed-7575-45bb-a02b-18f378ddc34d")

        val zaakInstanceUrl = URI("http://zaaak.url")
        val zaakInstanceLink = mock<ZaakInstanceLink>()

        whenever(zaakInstanceService.getByDocumentId(documentId)).thenReturn(zaakInstanceLink)
        whenever(zaakInstanceLink.zaakInstanceUrl).thenReturn(zaakInstanceUrl)

        val pluginInstance = mock<ZakenApiPlugin>()
        whenever(pluginService.createInstance(eq(ZakenApiPlugin::class.java), any())).thenReturn(pluginInstance)

        listener.handle(DocumentDeletedEvent(documentId))

        verify(zaakDocumentService).deleteRelatedInformatieObjecten(zaakInstanceUrl)
        verify(pluginInstance).deleteZaak(zaakInstanceUrl)
    }

    @Test
    fun `should not throw exception when no zaak is linked`() {
        val documentId = UUID.fromString("d1f1b3ed-7575-45bb-a02b-18f378ddc34d")

        whenever(zaakInstanceService.getByDocumentId(documentId)).thenThrow(ZaakInstanceLinkNotFoundException("No link found"))

        listener.handle(DocumentDeletedEvent(documentId))

        verifyNoInteractions(zaakDocumentService)
        verifyNoInteractions(pluginService)
    }
}