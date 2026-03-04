package com.ritense.documentenapipreview.client

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.zgw.ClientTools
import org.springframework.core.io.InputStreamResource
import org.springframework.core.io.Resource
import org.springframework.http.HttpEntity
import org.springframework.http.MediaType
import org.springframework.http.converter.ResourceHttpMessageConverter
import org.springframework.stereotype.Component
import org.springframework.util.LinkedMultiValueMap
import org.springframework.util.MultiValueMap
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
        document: InputStream
    ): InputStream {
        val fileEntity: HttpEntity<InputStreamResource> = HttpEntity(InputStreamResource(document))
        val formData: MultiValueMap<String, Any> = LinkedMultiValueMap()
        formData.add("files", fileEntity)
        formData.add("exportFormFields", "false")
        formData.add("pdfa", "PDF/A-1b")
        formData.add("pdfua", "true")

        val result = restClient()
            .post()
            .uri {
                ClientTools.baseUrlToBuilder(it, baseUrl)
                    .path("forms/libreoffice/convert")
                    .build()
            }
            .contentType(MediaType.MULTIPART_FORM_DATA)
            .body(formData)
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