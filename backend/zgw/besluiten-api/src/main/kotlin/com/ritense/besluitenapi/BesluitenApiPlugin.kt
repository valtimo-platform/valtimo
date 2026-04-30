/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.besluitenapi

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.besluitenapi.client.Besluit
import com.ritense.besluitenapi.client.BesluitNotFoundException
import com.ritense.besluitenapi.client.BesluitenApiClient
import com.ritense.besluitenapi.client.CreateBesluitInformatieObject
import com.ritense.besluitenapi.client.CreateBesluitRequest
import com.ritense.besluitenapi.client.PatchBesluitRequest
import com.ritense.besluitenapi.client.Vervalreden
import com.ritense.logging.withLoggingContext
import com.ritense.plugin.annotation.Plugin
import com.ritense.plugin.annotation.PluginAction
import com.ritense.plugin.annotation.PluginActionProperty
import com.ritense.plugin.annotation.PluginProperty
import com.ritense.plugin.domain.PluginDependency
import com.ritense.processlink.domain.ActivityTypeWithEventName.SERVICE_TASK_START
import com.ritense.valtimo.contract.validation.Url
import com.ritense.zakenapi.ZaakUrlProvider
import com.ritense.zgw.LoggingConstants.BESLUITEN_API
import com.ritense.zgw.LoggingConstants.DOCUMENTEN_API
import com.ritense.zgw.Rsin
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.delegate.DelegateExecution
import java.net.URI
import java.time.LocalDate
import java.util.UUID

@Plugin(
    key = BesluitenApiPlugin.PLUGIN_KEY,
    title = "Besluiten API",
    description = "Connects to the Besluiten API",
    dependencies = [PluginDependency.ZAAK_INSTANCE_LINK]
)
class BesluitenApiPlugin(
    private val besluitenApiClient: BesluitenApiClient,
    private val zaakUrlProvider: ZaakUrlProvider,
    private val objectMapper: ObjectMapper
) {
    @Url
    @PluginProperty(key = "url", secret = false)
    lateinit var url: URI

    @PluginProperty(key = "rsin", secret = false)
    lateinit var rsin: Rsin

    @PluginProperty(key = "authenticationPluginConfiguration", secret = false)
    lateinit var authenticationPluginConfiguration: BesluitenApiAuthentication

    @PluginAction(
        key = "link-document-to-besluit",
        title = "Link Document to besluit",
        description = "Links a document to a besluit",
        activityTypes = [SERVICE_TASK_START]
    )
    fun linkDocumentToBesluit(
        @PluginActionProperty documentUrl: String,
        @PluginActionProperty besluitUrl: String
    ) = linkDocumentToBesluit(URI(documentUrl), URI(besluitUrl))

    fun linkDocumentToBesluit(
        documentUrl: URI,
        besluitUrl: URI
    ) = withLoggingContext(
        DOCUMENTEN_API.ENKELVOUDIG_INFORMATIE_OBJECT to documentUrl.toString(),
        BESLUITEN_API.BESLUIT to besluitUrl.toString()
    ) {
        logger.info { "Linking ZGW document $documentUrl to besluit $besluitUrl" }
        besluitenApiClient.createBesluitInformatieObject(
            authenticationPluginConfiguration,
            url,
            CreateBesluitInformatieObject(documentUrl.toString(), besluitUrl.toString())
        )
    }

    @PluginAction(
        key = "create-besluit",
        title = "Create besluit",
        description = "Creates a besluit in the Besluiten API",
        activityTypes = [SERVICE_TASK_START]
    )
    fun createBesluit(
        execution: DelegateExecution,
        @PluginActionProperty besluittypeUrl: String,
        @PluginActionProperty toelichting: String?,
        @PluginActionProperty bestuursorgaan: String?,
        @PluginActionProperty ingangsdatum: LocalDate?,
        @PluginActionProperty vervaldatum: LocalDate?,
        @PluginActionProperty vervalreden: Vervalreden?,
        @PluginActionProperty publicatiedatum: LocalDate?,
        @PluginActionProperty verzenddatum: LocalDate?,
        @PluginActionProperty uiterlijkeReactieDatum: LocalDate?,
        @PluginActionProperty createdBesluitUrl: String?,
    ) {
        val documentId = UUID.fromString(execution.businessKey)
        val zaakUrl = zaakUrlProvider.getZaakUrl(documentId)
        withLoggingContext(
            "com.ritense.document.domain.impl.JsonSchemaDocument" to documentId.toString()
        ) {
            val besluit = createBesluit(
                zaakUrl = zaakUrl,
                besluittypeUrl = URI(besluittypeUrl),
                ingangsdatum = ingangsdatum ?: LocalDate.now(),
                toelichting = toelichting,
                bestuursorgaan = bestuursorgaan,
                vervaldatum = vervaldatum,
                vervalreden = vervalreden,
                publicatiedatum = publicatiedatum,
                verzenddatum = verzenddatum,
                uiterlijkeReactieDatum = uiterlijkeReactieDatum
            )
            createdBesluitUrl?.let {
                logger.info { "Storing reference to newly created besluit ${besluit.url} in process variable $it" }
                execution.setVariable(it, besluit.url)
            }
        }
    }

    @PluginAction(
        key = "patch-besluit",
        title = "Patch besluit",
        description = "Patches a besluit in the Besluiten API",
        activityTypes = [SERVICE_TASK_START]
    )
    fun patchBesluit(
        execution: DelegateExecution,
        @PluginActionProperty besluitUrl: String,
        @PluginActionProperty beslisdatum: String? = null,
        @PluginActionProperty toelichting: String? = null,
        @PluginActionProperty bestuursorgaan: String? = null,
        @PluginActionProperty ingangsdatum: String? = null,
        @PluginActionProperty vervaldatum: String? = null,
        @PluginActionProperty vervalreden: Vervalreden? = null,
        @PluginActionProperty publicatiedatum: String? = null,
        @PluginActionProperty verzenddatum: String? = null,
        @PluginActionProperty uiterlijkeReactieDatum: String? = null
    ) {
        val documentId = UUID.fromString(execution.businessKey)
        withLoggingContext(
            "com.ritense.document.domain.impl.JsonSchemaDocument" to documentId.toString()
        ) {
            patchBesluit(
                besluitUrl = URI(besluitUrl),
                beslisdatum = beslisdatum?.let { toLocalDate(it) },
                toelichting = toelichting,
                bestuursorgaan = bestuursorgaan,
                ingangsdatum = ingangsdatum?.let { toLocalDate(it) },
                vervaldatum = vervaldatum?.let { toLocalDate(it) },
                vervalreden = vervalreden,
                publicatiedatum = publicatiedatum?.let { toLocalDate(it) },
                verzenddatum = verzenddatum?.let { toLocalDate(it) },
                uiterlijkeReactieDatum = uiterlijkeReactieDatum?.let { toLocalDate(it) }
            )
        }
    }

    @PluginAction(
        key = "get-besluit",
        title = "Get besluit",
        description = "This retreives a besluit from Besluiten API",
        activityTypes = [SERVICE_TASK_START]
    )
    fun getBesluit(
        execution: DelegateExecution,
        @PluginActionProperty besluitUrl: String,
        @PluginActionProperty resultProcessVariable: String
    ): Besluit {
        val documentId = UUID.fromString(execution.businessKey)

        logger.debug { "Retrieving besluit with besluitUrl '$besluitUrl' for document '$documentId'" }

        val besluit = try {
            besluitenApiClient.getBesluit(
                authenticationPluginConfiguration,
                url,
                getUuid(besluitUrl)
            )
        } catch (ex: Exception) {
            throw BesluitNotFoundException(besluitUrl)
        }

        resultProcessVariable.let { name ->
            execution.setVariable(name, objectMapper.valueToTree(besluit))
        }

        logger.info { "Besluit retrieved with besluitUrl '$besluitUrl' for document '$documentId'" }

        return besluit
    }

    fun patchBesluit(
        besluitUrl: URI,
        beslisdatum: LocalDate? = null,
        toelichting: String? = null,
        bestuursorgaan: String? = null,
        ingangsdatum: LocalDate? = null,
        vervaldatum: LocalDate? = null,
        vervalreden: Vervalreden? = null,
        publicatiedatum: LocalDate? = null,
        verzenddatum: LocalDate? = null,
        uiterlijkeReactieDatum: LocalDate? = null,
    ): Besluit {
        val request = PatchBesluitRequest(
            datum = beslisdatum,
            toelichting = toelichting,
            bestuursorgaan = bestuursorgaan,
            ingangsdatum = ingangsdatum,
            vervaldatum = vervaldatum,
            vervalreden = vervalreden,
            publicatiedatum = publicatiedatum,
            verzenddatum = verzenddatum,
            uiterlijkeReactiedatum = uiterlijkeReactieDatum
        )

        return besluitenApiClient.patchBesluit(
            authenticationPluginConfiguration,
            besluitUrl,
            request
        )
    }

    fun createBesluit(
        zaakUrl: URI,
        besluittypeUrl: URI,
        toelichting: String? = null,
        bestuursorgaan: String? = null,
        ingangsdatum: LocalDate? = null,
        vervaldatum: LocalDate? = null,
        vervalreden: Vervalreden? = null,
        publicatiedatum: LocalDate? = null,
        verzenddatum: LocalDate? = null,
        uiterlijkeReactieDatum: LocalDate? = null,
    ): Besluit {
        withLoggingContext("zaakUrl" to zaakUrl.toString()) {
            logger.info { "Creating besluit for zaak $zaakUrl of type $besluittypeUrl" }
            return besluitenApiClient.createBesluit(
                authentication = authenticationPluginConfiguration,
                baseUrl = url,
                request = CreateBesluitRequest(
                    zaak = zaakUrl,
                    besluittype = besluittypeUrl,
                    verantwoordelijkeOrganisatie = rsin.toString(),
                    datum = LocalDate.now(),
                    ingangsdatum = ingangsdatum ?: LocalDate.now(),
                    toelichting = toelichting,
                    bestuursorgaan = bestuursorgaan,
                    vervaldatum = vervaldatum,
                    vervalreden = vervalreden,
                    publicatiedatum = publicatiedatum,
                    verzenddatum = verzenddatum,
                    uiterlijkeReactiedatum = uiterlijkeReactieDatum
                )
            )
        }
    }

    private fun toLocalDate(date: String): LocalDate {
        return LocalDate.parse(date.take(10))
    }

    private fun getUuid(url: String): String {
        return url.trimEnd('/')
            .substringAfterLast('/')
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        const val PLUGIN_KEY = "besluitenapi"
    }
}