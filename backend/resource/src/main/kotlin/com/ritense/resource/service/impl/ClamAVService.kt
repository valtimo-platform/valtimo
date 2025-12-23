package com.ritense.resource.service.impl

import com.ritense.resource.client.ClamAVVirusScan
import com.ritense.resource.service.VirusScanService
import com.ritense.resource.domain.VirusScanResult
import com.ritense.resource.domain.VirusScanStatus
import xyz.capybara.clamav.ClamavClient
import xyz.capybara.clamav.commands.scan.result.ScanResult
import java.io.ByteArrayInputStream
import kotlin.io.use

class ClamAVService(
    private val clamAVVirusScanProperties: ClamAVVirusScan.ClamAVVirusScanConfigProperties,
) : VirusScanService {

    override fun scan(bytes: ByteArray): VirusScanResult {
        val clamAVClient =
            ClamavClient(
                clamAVVirusScanProperties.hostName,
                clamAVVirusScanProperties.port,
            )
        return ByteArrayInputStream(bytes).use {
            when (val scanResult = clamAVClient.scan(it)) {
                is ScanResult.OK -> {
                    VirusScanResult(VirusScanStatus.OK, mapOf())
                }

                is ScanResult.VirusFound -> {
                    VirusScanResult(VirusScanStatus.VIRUS_FOUND, scanResult.foundViruses)
                }
            }
        }
    }
}
