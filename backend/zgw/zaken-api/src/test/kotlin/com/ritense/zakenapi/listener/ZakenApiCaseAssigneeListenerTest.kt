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
package com.ritense.zakenapi.listener

import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.event.DocumentAssigneeChangedEvent
import com.ritense.document.event.DocumentUnassignedEvent
import com.ritense.document.service.DocumentService
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.domain.ZaakInstanceLink
import com.ritense.zakenapi.domain.ZaakInstanceLinkId
import com.ritense.zakenapi.link.ZaakInstanceLinkNotFoundException
import com.ritense.zakenapi.link.ZaakInstanceLinkService
import com.ritense.zakenapi.sync.CaseZakenApiSync
import com.ritense.zakenapi.sync.CaseZakenApiSyncManagementService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import java.net.URI
import java.time.LocalDateTime
import java.util.UUID

class ZakenApiCaseAssigneeListenerTest {

    private val zaakInstanceLinkService = mock<ZaakInstanceLinkService>()
    private val pluginService = mock<PluginService>()
    private val caseZakenApiSyncManagementService = mock<CaseZakenApiSyncManagementService>()
    private val documentService = mock<DocumentService>()
    private val caseDocumentResolver = mock<CaseDocumentResolver>()

    private val listener = ZakenApiCaseAssigneeListener(
        zaakInstanceLinkService,
        pluginService,
        caseZakenApiSyncManagementService,
        documentService,
        caseDocumentResolver,
    )

    private val documentId = UUID.fromString("d1f1b3ed-7575-45bb-a02b-18f378ddc34d")
    private val caseDefinitionId = CaseDefinitionId("house", "1.0.0")
    private val zaakUrl = URI("http://zaak.local/zaken/1")
    private val zaaktypeUrl = URI("http://catalogi.local/zaaktypen/1")
    private val behandelaarRoltypeUrl = URI("http://catalogi.local/roltypen/behandelaar")

    private val zakenApiPlugin = mock<ZakenApiPlugin>()

    @BeforeEach
    fun setUp() {
        val link = ZaakInstanceLink(
            zaakInstanceLinkId = ZaakInstanceLinkId.newId(UUID.randomUUID()),
            zaakInstanceUrl = zaakUrl,
            zaakInstanceId = UUID.randomUUID(),
            documentId = documentId,
            zaakTypeUrl = zaaktypeUrl,
        )
        whenever(zaakInstanceLinkService.getByDocumentId(documentId)).thenReturn(link)

        whenever(caseDocumentResolver.resolveCaseDocumentId(documentId)).thenReturn(documentId)
        val definitionId = JsonSchemaDocumentDefinitionId.existingId("house", caseDefinitionId)
        val document = mock<Document> { on { definitionId() }.thenReturn(definitionId) }
        whenever(documentService[documentId.toString()]).thenReturn(document)

        whenever(caseZakenApiSyncManagementService.getSyncConfiguration(eq(caseDefinitionId)))
            .thenReturn(
                CaseZakenApiSync(
                    caseDefinitionId = caseDefinitionId,
                    assigneeSyncEnabled = true,
                    roltypeUrl = behandelaarRoltypeUrl,
                )
            )

        whenever(pluginService.createInstance(eq(ZakenApiPlugin::class.java), any())).thenReturn(zakenApiPlugin)
    }

    @Test
    fun `upserts GZAC behandelaar atomically on assign`() {
        listener.handleAssigneeChanged(assigneeChangedEvent("alice"))

        verify(zakenApiPlugin).upsertGzacBehandelaarRol(
            zaakUrl = eq(zaakUrl),
            roltypeUrl = eq(behandelaarRoltypeUrl),
            username = eq("alice"),
        )
        verify(zakenApiPlugin, never()).removeGzacBehandelaarRollen(any())
    }

    @Test
    fun `unassign removes existing behandelaar but does not upsert a new one`() {
        listener.handleUnassigned(unassignedEvent("alice"))

        verify(zakenApiPlugin).removeGzacBehandelaarRollen(zaakUrl)
        verify(zakenApiPlugin, never()).upsertGzacBehandelaarRol(any(), any(), any())
    }

    @Test
    fun `does nothing when assignee sync is enabled but roltype is missing`() {
        whenever(caseZakenApiSyncManagementService.getSyncConfiguration(eq(caseDefinitionId)))
            .thenReturn(
                CaseZakenApiSync(
                    caseDefinitionId = caseDefinitionId,
                    assigneeSyncEnabled = true,
                    roltypeUrl = null,
                )
            )

        listener.handleAssigneeChanged(assigneeChangedEvent("alice"))

        verifyNoInteractions(zakenApiPlugin)
    }

    @Test
    fun `does nothing when sync flag is disabled in configuration`() {
        whenever(caseZakenApiSyncManagementService.getSyncConfiguration(eq(caseDefinitionId)))
            .thenReturn(CaseZakenApiSync(caseDefinitionId = caseDefinitionId, assigneeSyncEnabled = false))

        listener.handleAssigneeChanged(assigneeChangedEvent("alice"))

        verifyNoInteractions(zakenApiPlugin)
    }

    @Test
    fun `does nothing when no sync configuration exists for case definition`() {
        whenever(caseZakenApiSyncManagementService.getSyncConfiguration(eq(caseDefinitionId)))
            .thenReturn(null)

        listener.handleAssigneeChanged(assigneeChangedEvent("alice"))

        verifyNoInteractions(zakenApiPlugin)
    }

    @Test
    fun `does nothing when no zaak instance link exists`() {
        whenever(zaakInstanceLinkService.getByDocumentId(documentId))
            .thenThrow(ZaakInstanceLinkNotFoundException("none"))

        listener.handleAssigneeChanged(assigneeChangedEvent("alice"))

        verifyNoInteractions(zakenApiPlugin)
    }

    private fun assigneeChangedEvent(assigneeUsername: String) = DocumentAssigneeChangedEvent(
        UUID.randomUUID(),
        "test",
        LocalDateTime.now(),
        "admin",
        documentId,
        assigneeUsername,
        null,
    )

    private fun unassignedEvent(formerAssigneeUsername: String) = DocumentUnassignedEvent(
        UUID.randomUUID(),
        "test",
        LocalDateTime.now(),
        "admin",
        documentId,
        formerAssigneeUsername,
        null,
    )
}
