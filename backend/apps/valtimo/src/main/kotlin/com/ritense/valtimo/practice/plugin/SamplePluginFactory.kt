package com.ritense.valtimo.practice.plugin

import com.ritense.plugin.PluginFactory
import com.ritense.plugin.service.PluginService
import org.springframework.stereotype.Component

@Component
class SamplePluginFactory(
    pluginService: PluginService,
    val sampleClient: SampleClient,
) : PluginFactory<SamplePlugin>(pluginService) {
    override fun create(): SamplePlugin = SamplePlugin(sampleClient)
}