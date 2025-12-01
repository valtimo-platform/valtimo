package com.ritense.resource.service.impl

import com.ritense.resource.client.ClamAVVirusScanConfig
import com.ritense.resource.service.VirusScanService
import com.ritense.resource.domain.VirusScanResult
import com.ritense.resource.domain.VirusScanStatus
import org.springframework.core.io.buffer.DataBuffer
import org.springframework.core.io.buffer.DataBufferUtils


import reactor.core.publisher.Flux
import reactor.core.scheduler.Schedulers
import xyz.capybara.clamav.ClamavClient
import xyz.capybara.clamav.commands.scan.result.ScanResult
import java.io.ByteArrayInputStream
import java.io.IOException
import java.io.InputStream
import java.io.PipedInputStream
import java.io.PipedOutputStream
import kotlin.io.use
import kotlin.jvm.Throws

class ClamAVService(
    private val clamAVVirusScanConfigProperties: ClamAVVirusScanConfig.ClamAVVirusScanConfigProperties,
) : VirusScanService {

    override fun scan(bytes: ByteArray): VirusScanResult {
        return scan(ByteArrayInputStream(bytes))
    }

    override fun scan(inputStream: InputStream): VirusScanResult {
        val clamAVClient =
            ClamavClient(
                clamAVVirusScanConfigProperties.hostName,
                clamAVVirusScanConfigProperties.port,
            )
        return inputStream.use {
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

    @Throws(IOException::class)
    private fun getInputStreamFromFluxDataBuffer(content: Flux<DataBuffer>): InputStream {
        val osPipe = PipedOutputStream()
        val isPipe = PipedInputStream(osPipe)
        DataBufferUtils.write(content, osPipe)
            .subscribeOn(Schedulers.boundedElastic())
            .doOnComplete {
                osPipe.close()
            }
            .subscribe(DataBufferUtils.releaseConsumer())
        return isPipe
    }
}
