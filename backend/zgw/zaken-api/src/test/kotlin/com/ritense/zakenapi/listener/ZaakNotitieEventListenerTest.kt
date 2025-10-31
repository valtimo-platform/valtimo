package com.ritense.zakenapi.listener

import com.ritense.plugin.service.PluginService
import com.ritense.zakenapi.ZaakUrlProvider
import com.ritense.zakenapi.service.ZaakNotitieService
import org.junit.Test

class ZaakNotitieEventListenerTest {

    private lateinit var zaakUrlProvider: ZaakUrlProvider
    private lateinit var pluginService: PluginService
    private lateinit var zaakNotitieService: ZaakNotitieService

    private lateinit var zaakNotitieEventListener: ZaakNotitieEventListener

    @Test
    fun `should handle NoteCreatedEvent and trigger create zaaknotitie when plugin property noteEventListenerEnabled is true`(){

    }

    @Test
    fun `should handle NoteCreatedUpdated and trigger update zaaknotitie when plugin property noteEventListenerEnabled is true`(){

    }

    @Test
    fun `should handle NoteCreatedDeleted and trigger delete zaaknotitie when plugin property noteEventListenerEnabled is true`(){

    }

}