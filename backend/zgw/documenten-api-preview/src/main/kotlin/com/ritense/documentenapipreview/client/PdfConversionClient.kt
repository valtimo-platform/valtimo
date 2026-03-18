package com.ritense.documentenapipreview.client

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.zgw.ClientTools
import org.springframework.core.io.InputStreamResource
import org.springframework.core.io.Resource
import org.springframework.http.client.MultipartBodyBuilder
import org.springframework.http.converter.ResourceHttpMessageConverter
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.body
import java.io.InputStream
import java.net.URI

@SkipComponentScan
@Component
class PdfConversionClient(
    private val restClientBuilder: RestClient.Builder,
) {
    fun convertDocument(
        baseUrl: URI,
        document: InputStream,
        fileName: String?,
    ): InputStream {
        val bodyBuilder = MultipartBodyBuilder().apply {
            part("files", InputStreamResource(document)).filename(fileName ?: "file_name_unknown")
            part("exportFormFields", "false")
            part("pdfa", "PDF/A-1b")
            part("pdfua", "true")
        }

        val result = restClient()
            .post()
            .uri {
                ClientTools.baseUrlToBuilder(it, baseUrl)
                    .path("forms/libreoffice/convert")
                    .build()
            }
            .body(bodyBuilder.build())
            .retrieve()
            .body<Resource>()!!

        return result.inputStream
    }

    private fun restClient(): RestClient {
        return restClientBuilder
            .clone()
            .messageConverters {
                it + ResourceHttpMessageConverter(true)
            }
            .build()
    }
}