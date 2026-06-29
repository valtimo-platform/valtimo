package com.ritense.valtimo

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.processdocument.service.ProcessDocumentService
import org.springframework.core.io.Resource
import org.springframework.core.io.ResourceLoader
import org.springframework.core.io.support.ResourcePatternUtils
import org.springframework.stereotype.Component

@Component
class DemoDataService(
    private val objectMapper: ObjectMapper,
    private val processDocumentService: ProcessDocumentService,
    private val resourceLoader: ResourceLoader,
    private val jsonSchemaDocumentRepository: JsonSchemaDocumentRepository,
) {
    fun deployDocuments() {
        if (jsonSchemaDocumentRepository.count().toInt().equals(0)) {
            val resourceList = getDocumentFileList()
            resourceList.forEach { resource ->
                val resourceContent = resource.inputStream.bufferedReader().use { it.readText() }
                val documentData = getDocumentData(resourceContent)

                val newDocumentRequest = NewDocumentRequest(DOCUMENT_DEFINITION_KEY, documentData)
                val newDocumentAndStartProcessRequest =
                    NewDocumentAndStartProcessRequest(
                        PROCESS_DEFINITION_KEY,
                        newDocumentRequest,
                    )

                runWithoutAuthorization {
                    processDocumentService.newDocumentAndStartProcess(
                        newDocumentAndStartProcessRequest,
                    )
                }
            }
        }
    }

    private fun getDocumentFileList(): List<Resource> =
        ResourcePatternUtils
            .getResourcePatternResolver(resourceLoader)
            .getResources("classpath*:data/evenementenvergunning/documents/*.json")
            .toList()

    private fun getDocumentData(fileContent: String): ObjectNode = objectMapper.readValue<ObjectNode>(fileContent)

    companion object {
        private val DOCUMENT_DEFINITION_KEY = "evenementenvergunning"
        private val PROCESS_DEFINITION_KEY = "afhandelen-aanvraag-evenementenvergunning"
    }
}