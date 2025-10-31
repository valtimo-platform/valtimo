package com.ritense.zakenapi.service

import com.ritense.plugin.service.PluginService
import com.ritense.zakenapi.ZaakUrlProvider
import com.ritense.zakenapi.repository.ZaakNotitieLinkRepository
import org.junit.Test

internal class ZaakNotitieServiceTest {

    private lateinit var zaakUrlProvider: ZaakUrlProvider
    private lateinit var pluginService: PluginService
    private lateinit var zaakNotitieLinkRepository: ZaakNotitieLinkRepository

    private lateinit var zaakNotitieService: ZaakNotitieService

    @Test
    fun `should create ZaakNotitie`(){

    }

    @Test
    fun `should not create ZaakNotitie when ZaakNotitieLink already exist`(){

    }

    @Test
    fun `should update ZaakNotitie`(){

    }

    @Test
    fun `should not update ZaakNotitie when ZaakNotitieLink does not exist`(){

    }

    @Test
    fun `should delete ZaakNotitie`(){

    }

    @Test
    fun `should not delete ZaakNotitie when ZaakNotitieLink does not exist`(){

    }
}