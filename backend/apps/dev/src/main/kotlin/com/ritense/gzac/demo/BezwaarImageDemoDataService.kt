/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.gzac.demo

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.documentenapi.DocumentenApiPlugin
import com.ritense.documentenapi.client.CreateDocumentRequest
import com.ritense.documentenapi.client.DocumentStatusType
import com.ritense.documentenapi.client.DocumentenApiClient
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.service.PluginService
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.resource.domain.MetadataType
import com.ritense.resource.service.TemporaryResourceStorageService
import com.ritense.temporaryresource.domain.StorageMetadataKeys
import com.ritense.zgw.domain.Vertrouwelijkheid
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Profile
import org.springframework.core.io.ResourceLoader
import org.springframework.core.io.support.ResourcePatternUtils
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Component
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.io.ByteArrayInputStream
import java.time.LocalDate
import java.util.UUID

/**
 * Development-only demo-data seeder for the "Present images as thumbnails" (GH-289) feature.
 *
 * On boot it creates a single Bezwaar case, uploads a handful of demo images to the Documenten API
 * and stores references to them in the case content so the image widgets configured on the
 * "Afbeeldingen" tab (see the bezwaar case-widget-tab autodeploy config) have data to render:
 * a single image, a grid of multiple images and a carousel of the same images.
 *
 * It is invoked from [com.ritense.gzac.Application.main] after the application context is fully
 * initialised (so the bezwaar case definition has been deployed) and is guarded so it only seeds
 * once, even when the development database is reused across restarts.
 */
@Component
@Profile("dev")
class BezwaarImageDemoDataService(
    private val objectMapper: ObjectMapper,
    private val resourceLoader: ResourceLoader,
    private val documentService: DocumentService,
    private val processDocumentService: ProcessDocumentService,
    private val pluginService: PluginService,
    private val documentenApiClient: DocumentenApiClient,
    private val temporaryResourceStorageService: TemporaryResourceStorageService,
    transactionManager: PlatformTransactionManager,
    @Value("\${VALTIMO_CATALOGI_API_URL:http://localhost:8001/catalogi/api/v1/}")
    private val catalogiApiUrl: String,
    @Value("\${VALTIMO_INFORMATIEOBJECTTYPE:efc332f2-be3b-4bad-9e3c-49a6219c92ad}")
    private val informatieObjectTypeId: String,
) {

    // A transaction is required because uploading to the Documenten API publishes an outbox
    // message with propagation MANDATORY. Wrap the whole seed so all writes commit (or roll back)
    // together.
    private val transactionTemplate = TransactionTemplate(transactionManager)

    fun deployBezwaarWithImages() {
        try {
            runWithoutAuthorization {
                transactionTemplate.executeWithoutResult {
                    val existingDemoCase = findDemoCase()
                    if (existingDemoCase != null && hasImages(existingDemoCase)) {
                        logger.info { "Bezwaar image demo case already present, skipping demo seed." }
                        return@executeWithoutResult
                    }

                    val images = loadDemoImages()
                    if (images.isEmpty()) {
                        logger.warn { "No demo images found on the classpath ('$IMAGES_LOCATION'), skipping demo seed." }
                        return@executeWithoutResult
                    }

                    // Reuse a marked-but-imageless case (e.g. from an interrupted earlier run) so we
                    // complete it instead of creating a duplicate; otherwise create a fresh case.
                    val caseDocumentId = existingDemoCase?.id()?.id ?: createBezwaarCase()
                    val uploadedImages = images.map { uploadImageToDocumentenApi(it, caseDocumentId) }
                    addImagesToCaseContent(caseDocumentId, uploadedImages)

                    logger.info {
                        "Seeded bezwaar image demo case '$caseDocumentId' with ${uploadedImages.size} images in the Documenten API."
                    }
                }
            }
        } catch (e: Exception) {
            logger.error(e) { "Failed to seed the bezwaar image demo case. The demo image widgets will have no data." }
        }
    }

    private fun findDemoCase(): Document? =
        documentService.getAllByDocumentDefinitionName(PageRequest.of(0, 500), DOCUMENT_DEFINITION_KEY)
            .firstOrNull { it.content().asJson().path(DEMO_MARKER_FIELD).asBoolean(false) }

    private fun hasImages(document: Document): Boolean =
        document.content().asJson().path("afbeeldingen").let { it.isArray && it.size() > 0 }

    private fun createBezwaarCase(): UUID {
        val content = objectMapper.createObjectNode().apply {
            put(DEMO_MARKER_FIELD, true)
            put("aanhef", "De heer")
            put("voornaam", "Bram")
            put("achternaam", "de Vries")
            put("bsn", "999990755")
            put("straatnaam", "Kalverstraat")
            put("huisnummer", "1")
            put("postcode", "1012 NX")
            put("plaats", "Amsterdam")
            put("telefoonnummer", "06-12345678")
            put("e-mailadres", "bram.devries@example.com")
            put("zaaknummer", "ZAAK-2026-000123")
            put(
                "bezwaar",
                "Ik ben het niet eens met het genomen besluit en dien hierbij mijn bezwaar in. " +
                    "Ter onderbouwing heb ik enkele afbeeldingen toegevoegd."
            )
            put("communicatie", "E-mail")
        }

        val request = NewDocumentAndStartProcessRequest(
            PROCESS_DEFINITION_KEY,
            NewDocumentRequest(DOCUMENT_DEFINITION_KEY, CASE_DEFINITION_KEY, CASE_VERSION_TAG, content),
        )

        val result = processDocumentService.newDocumentAndStartProcess(request)
        check(result.errors().isEmpty()) { "Could not create bezwaar demo case: ${result.errors()}" }
        return result.resultingDocument().orElseThrow().id().id
    }

    /**
     * Uploads a single image to the Documenten API and registers the download URL against a
     * temporary-resource id, mirroring what the regular ZGW upload process does. The returned
     * object is the file reference as it is stored in Form.io/case content: the image widget reads
     * `data.resourceId` and the frontend resolves that id to a download URL via the
     * resource-storage metadata.
     */
    private fun uploadImageToDocumentenApi(image: DemoImage, caseDocumentId: UUID): ObjectNode {
        val plugin = pluginService.createInstance(
            PluginConfigurationId.existingId(DOCUMENTEN_API_PLUGIN_ID)
        ) as DocumentenApiPlugin

        val createDocumentRequest = CreateDocumentRequest(
            bronorganisatie = plugin.bronorganisatie,
            creatiedatum = LocalDate.now(),
            titel = image.title,
            vertrouwelijkheidaanduiding = Vertrouwelijkheid.ZAAKVERTROUWELIJK,
            auteur = DEMO_AUTHOR,
            status = DocumentStatusType.DEFINITIEF,
            taal = DEMO_LANGUAGE,
            bestandsnaam = image.fileName,
            bestandsomvang = image.bytes.size.toLong(),
            inhoud = ByteArrayInputStream(image.bytes),
            informatieobjecttype = "${catalogiApiUrl}informatieobjecttypen/$informatieObjectTypeId",
        )

        val storedDocument = documentenApiClient.storeDocument(
            plugin.authenticationPluginConfiguration,
            plugin.url,
            caseDocumentId,
            createDocumentRequest,
        )
        val documentId = storedDocument.url.substringAfterLast('/')

        val resourceId = temporaryResourceStorageService.store(
            ByteArrayInputStream(image.bytes),
            mapOf(
                MetadataType.FILE_NAME.key to image.fileName,
                MetadataType.CONTENT_TYPE.key to image.contentType,
                MetadataType.DOCUMENT_ID.key to documentId,
            )
        )
        temporaryResourceStorageService.saveMetadataValue(
            resourceId,
            StorageMetadataKeys.DOWNLOAD_URL,
            "/api/v1/documenten-api/$DOCUMENTEN_API_PLUGIN_ID/files/$documentId/download",
        )
        temporaryResourceStorageService.saveMetadataValue(resourceId, StorageMetadataKeys.DOCUMENT_URL, storedDocument.url)
        temporaryResourceStorageService.saveMetadataValue(resourceId, StorageMetadataKeys.DOCUMENT_ID, documentId)

        val fileReference = objectMapper.createObjectNode()
        fileReference.put("originalName", image.fileName)
        fileReference.put("type", image.extension)
        fileReference.put("size", image.bytes.size.toLong())
        fileReference.put("storage", "openZaak")
        fileReference.put("customUpload", true)
        fileReference.put("url", "/api/v1/resource/$resourceId/download")
        fileReference.putObject("data").apply {
            put("name", image.fileName)
            put("resourceId", resourceId)
            put("sizeInBytes", image.bytes.size.toLong())
            put("extension", image.extension)
        }
        return fileReference
    }

    private fun addImagesToCaseContent(caseDocumentId: UUID, uploadedImages: List<ObjectNode>) {
        val document = documentService.get(caseDocumentId.toString())
        val content: ObjectNode = (document.content().asJson() as ObjectNode).deepCopy()

        // A single image for the "single image" widget.
        content.putArray("enkeleAfbeelding").add(uploadedImages.first())
        // All images for the grid and carousel widgets.
        content.putArray("afbeeldingen").apply { uploadedImages.forEach { add(it) } }

        documentService.modifyDocument(document, content)
    }

    private fun loadDemoImages(): List<DemoImage> =
        ResourcePatternUtils.getResourcePatternResolver(resourceLoader)
            .getResources(IMAGES_LOCATION)
            .filter { it.filename != null }
            .sortedBy { it.filename }
            .map { resource ->
                val fileName = resource.filename!!
                val extension = fileName.substringAfterLast('.', "jpg").lowercase()
                DemoImage(
                    fileName = fileName,
                    title = toTitle(fileName),
                    extension = extension,
                    contentType = "image/jpeg",
                    bytes = resource.inputStream.use { it.readBytes() },
                )
            }

    private fun toTitle(fileName: String): String =
        fileName.substringBeforeLast('.')
            .replace(Regex("^\\d+-"), "")
            .replace('-', ' ')
            .replaceFirstChar { it.uppercase() }

    private data class DemoImage(
        val fileName: String,
        val title: String,
        val extension: String,
        val contentType: String,
        val bytes: ByteArray,
    )

    companion object {
        private val logger = KotlinLogging.logger {}

        private const val DOCUMENT_DEFINITION_KEY = "bezwaar"
        private const val CASE_DEFINITION_KEY = "bezwaar"
        private const val CASE_VERSION_TAG = "1.0.1"
        private const val PROCESS_DEFINITION_KEY = "bezwaar"
        private const val DEMO_MARKER_FIELD = "demoAfbeeldingen"
        private const val DEMO_AUTHOR = "Valtimo demo"
        private const val DEMO_LANGUAGE = "nld"
        private const val IMAGES_LOCATION = "classpath*:demo/bezwaar/images/*.jpg"

        // Documenten API plugin configuration id from config/plugin-configurations/app.pluginconfig.json
        private val DOCUMENTEN_API_PLUGIN_ID: UUID = UUID.fromString("5474fe57-532a-4050-8d89-32e62ca3e895")
    }
}
