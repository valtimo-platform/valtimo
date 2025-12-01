package com.ritense.resource.autoconfigure

import com.ritense.resource.client.ClamAVVirusScanConfig
import com.ritense.resource.service.VirusScanService
import com.ritense.resource.service.impl.ClamAVService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
@ConditionalOnProperty(prefix = "valtimo.config.virusscan.clamav", name = ["enabled"], havingValue = "true")
@EnableConfigurationProperties(ClamAVVirusScanConfig::class)
class ClamAVConfiguration {
    @Bean
    fun clamAVVirusScanConfig(): ClamAVVirusScanConfig {
        return ClamAVVirusScanConfig()
    }

    @Bean
    @ConditionalOnMissingBean(VirusScanService::class)
    fun virusScanService(clamAVVirusScanConfig: ClamAVVirusScanConfig): VirusScanService {
        logger.info {
            "ClamAV virusscan is loaded with host: ${clamAVVirusScanConfig.properties.hostName} and port: ${clamAVVirusScanConfig.properties.port}"
        }
        return ClamAVService(clamAVVirusScanConfig.properties)
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}