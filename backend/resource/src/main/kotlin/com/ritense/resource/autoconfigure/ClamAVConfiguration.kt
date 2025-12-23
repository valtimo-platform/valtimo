package com.ritense.resource.autoconfigure

import com.ritense.resource.client.ClamAVVirusScan
import com.ritense.resource.service.VirusScanService
import com.ritense.resource.service.impl.ClamAVService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.context.annotation.Bean

@AutoConfiguration
class ClamAVConfiguration {
    @Bean
    fun clamAVVirusScanConfig(): ClamAVVirusScan {
        return ClamAVVirusScan()
    }

    @Bean
    @ConditionalOnMissingBean(VirusScanService::class)
    fun virusScanService(clamAVVirusScan: ClamAVVirusScan): VirusScanService {
        logger.info {
            "ClamAV virusscan is loaded with host: ${clamAVVirusScan.properties.hostName} and port: ${clamAVVirusScan.properties.port}"
        }
        return ClamAVService(clamAVVirusScan.properties)
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}