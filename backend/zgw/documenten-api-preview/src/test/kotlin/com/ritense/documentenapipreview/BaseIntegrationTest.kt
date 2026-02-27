package com.ritense.documentenapipreview

import com.ritense.plugin.repository.PluginConfigurationRepository
import com.ritense.plugin.service.PluginService
import okhttp3.mockwebserver.MockResponse
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean
import org.springframework.test.context.junit.jupiter.SpringExtension

@SpringBootTest(classes = [TestApplication::class])
@ExtendWith(SpringExtension::class)
@Tag("integration")
class BaseIntegrationTest {
    @MockitoSpyBean
    lateinit var pluginService: PluginService

    @MockitoSpyBean
    lateinit var pluginConfigurationRepository: PluginConfigurationRepository

    fun mockResponse(body: String): MockResponse {
        return MockResponse()
            .addHeader("Content-Type", "application/json")
            .setBody(body)
    }
}