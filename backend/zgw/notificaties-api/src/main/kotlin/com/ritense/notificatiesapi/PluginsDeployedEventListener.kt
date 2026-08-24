/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.notificatiesapi

import com.ritense.notificatiesapi.client.NotificatiesApiClient
import com.ritense.notificatiesapi.config.NotificatiesApiAbonnementRegistrationProperties
import com.ritense.notificatiesapi.domain.Abonnement
import com.ritense.notificatiesapi.domain.Kanaal
import com.ritense.notificatiesapi.domain.NotificatiesApiAbonnementLink
import com.ritense.notificatiesapi.domain.NotificatiesApiConfigurationId
import com.ritense.notificatiesapi.exception.NotificatiesApiAbonnementException
import com.ritense.notificatiesapi.repository.NotificatiesApiAbonnementLinkRepository
import com.ritense.logging.withLoggingContext
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.events.PluginConfigurationCreatedEvent
import com.ritense.plugin.events.PluginConfigurationDeletedEvent
import com.ritense.plugin.events.PluginConfigurationUpdatedEvent
import com.ritense.processlink.event.ProcessLinkCreatedEvent
import com.ritense.processlink.event.ProcessLinkUpdatedEvent
import com.ritense.plugin.service.PluginConfigurationSearchParameters
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.event.ApplicationFullyReadyEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.event.EventListener
import org.springframework.transaction.event.TransactionPhase.AFTER_COMMIT
import org.springframework.transaction.event.TransactionalEventListener
import java.net.URI
import java.security.SecureRandom
import java.time.Duration
import java.util.Base64
import java.util.concurrent.Executor

/**
 * @param registrationExecutor executor the startup registration is handed off to. Defaults to
 * running inline; the auto-configuration supplies a dedicated single-threaded executor so the
 * retry loop never blocks the event thread.
 */
class PluginsDeployedEventListener(
    private val client: NotificatiesApiClient,
    private val notificatiesApiAbonnementLinkRepository: NotificatiesApiAbonnementLinkRepository,
    private val pluginService: PluginService,
    private val registerAbonnementen: Boolean,
    private val registrationProperties: NotificatiesApiAbonnementRegistrationProperties =
        NotificatiesApiAbonnementRegistrationProperties(),
    private val registrationExecutor: Executor = Executor { it.run() }
) {

    private var applicationFullyReady = false

    @EventListener(ApplicationFullyReadyEvent::class)
    fun handleApplicationFullyReadyEvent() {
        applicationFullyReady = true
        registrationExecutor.execute { registerAbonnementenWithBackoff() }
    }

    /**
     * Registers abonnementen with exponential backoff until it succeeds, or until
     * [NotificatiesApiAbonnementRegistrationProperties.maxDuration] has elapsed.
     *
     * Open Notificaties validates a new abonnement by immediately calling back to the configured
     * `callbackUrl`. On Kubernetes that callback cannot succeed before the pod is routable, and the
     * pod only becomes routable after kubelet has observed the readiness probe turn UP -- which
     * happens because of the very same [ApplicationFullyReadyEvent] that triggers this method.
     * Retrying inline within milliseconds therefore could never work; the retries have to outlive
     * the probe interval, and a pod that has not managed to subscribe yet must stay up rather than
     * crash-loop.
     */
    fun registerAbonnementenWithBackoff() {
        val deadline = System.nanoTime() + registrationProperties.maxDuration.toNanos()
        var backoff = registrationProperties.initialBackoff
        var attempt = 1

        while (true) {
            try {
                registerAbonnementenForNotificatiesApiPlugins(attemptsPerConfiguration = 1)
                if (attempt > 1) {
                    logger.info { "Successfully registered abonnementen on attempt $attempt" }
                }
                return
            } catch (e: Exception) {
                val remaining = Duration.ofNanos(deadline - System.nanoTime())
                if (remaining <= backoff) {
                    logger.error(e) {
                        "Giving up on registering abonnementen after $attempt attempt(s) within " +
                            "${registrationProperties.maxDuration}. The application stays up, but no " +
                            "notifications will be received until registration succeeds."
                    }
                    return
                }
                logger.warn(e) { "Attempt $attempt to register abonnementen failed; retrying in $backoff" }
                if (!sleep(backoff)) return
                backoff = minOf(backoff.multipliedBy(2), registrationProperties.maxBackoff)
                attempt++
            }
        }
    }

    private fun sleep(duration: Duration): Boolean =
        try {
            Thread.sleep(duration.toMillis().coerceAtLeast(1))
            true
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
            logger.info { "Abonnement registration was interrupted; not retrying" }
            false
        }

    @TransactionalEventListener(phase = AFTER_COMMIT)
    fun handlePluginConfigurationCreatedEvent(event: PluginConfigurationCreatedEvent) {
        handleNotificatiesApiPluginConfigurationChanged(event.pluginConfiguration)
    }

    @TransactionalEventListener(phase = AFTER_COMMIT)
    fun handlePluginConfigurationUpdatedEvent(event: PluginConfigurationUpdatedEvent) {
        handleNotificatiesApiPluginConfigurationChanged(event.pluginConfiguration)
    }

    @TransactionalEventListener(phase = AFTER_COMMIT)
    fun handlePluginConfigurationDeletedEvent(event: PluginConfigurationDeletedEvent) {
        if (!applicationFullyReady || !isNotificatiesApiListener(event.pluginConfiguration)) return
        removeAbonnementForDeletedConfiguration(event.pluginConfiguration)
        registerAbonnementenForNotificatiesApiPlugins()
    }

    private fun handleNotificatiesApiPluginConfigurationChanged(pluginConfiguration: PluginConfiguration) {
        if (!applicationFullyReady || !isNotificatiesApiListener(pluginConfiguration)) return
        registerAbonnementenForNotificatiesApiPlugins()
    }

    /**
     * The plugin configuration lifecycle events fire for every plugin, so only react when the
     * configuration involved actually participates in Notificaties API subscriptions. Uses the
     * (eagerly fetched) plugin definition class name to avoid touching the lazily loaded categories
     * on the detached event payload.
     */
    private fun isNotificatiesApiListener(pluginConfiguration: PluginConfiguration): Boolean =
        NotificatiesApiListener::class.java.isAssignableFrom(
            Class.forName(pluginConfiguration.pluginDefinition.fullyQualifiedClassName)
        )

    @TransactionalEventListener(phase = AFTER_COMMIT)
    fun handleProcessLinkCreatedEvent(event: ProcessLinkCreatedEvent) {
        if (!applicationFullyReady || event.processLinkType != "plugin") return
        registerAbonnementenForNotificatiesApiPlugins()
    }

    @TransactionalEventListener(phase = AFTER_COMMIT)
    fun handleProcessLinkUpdatedEvent(event: ProcessLinkUpdatedEvent) {
        if (!applicationFullyReady || event.processLinkType != "plugin") return
        registerAbonnementenForNotificatiesApiPlugins()
    }

    @JvmOverloads
    fun registerAbonnementenForNotificatiesApiPlugins(attemptsPerConfiguration: Int = DEFAULT_ATTEMPTS) {
        if (!registerAbonnementen) {
            logger.info { "Notificaties API abonnement registration is disabled (valtimo.zgw.register-abonnementen=false); skipping" }
            return
        }

        val pluginConfigurations = pluginService
            .getPluginConfigurations(PluginConfigurationSearchParameters(category = "notificaties-api-plugin"))
            .map { pluginService.createInstance(it) as NotificatiesApiListener }
            .groupBy { it.getNotificatiesApiPlugin().url }

        val knownNotificatiesApiAbonnementLinks = notificatiesApiAbonnementLinkRepository.findAll()

        pluginConfigurations.forEach { (_, configurations) ->
            val notificatiesApiPluginInstance = configurations.first().getNotificatiesApiPlugin()

            withLoggingContext(
                PluginConfiguration::class.java.canonicalName to
                    notificatiesApiPluginInstance.notificatiesApiConfigurationId.id.toString()
            ) {
                retry(times = attemptsPerConfiguration) {
                    registerAbonnementenForPluginNotificatiesApiPlugins(
                        notificatiesApiPluginInstance, knownNotificatiesApiAbonnementLinks, configurations
                    )
                }
            }
        }
    }

    private fun removeAbonnementForDeletedConfiguration(deletedConfiguration: PluginConfiguration) {
        if (!registerAbonnementen) {
            logger.info {
                "Notificaties API abonnement registration is disabled (valtimo.zgw.register-abonnementen=false); skipping"
            }
            return
        }

        val notificatiesApiConfigurationId = NotificatiesApiConfigurationId(deletedConfiguration.id.id)
        val abonnementLink =
            notificatiesApiAbonnementLinkRepository.findById(notificatiesApiConfigurationId).orElse(null)
                ?: return

        withLoggingContext(
            PluginConfiguration::class.java.canonicalName to notificatiesApiConfigurationId.id.toString()
        ) {
            retry {
                val notificatiesApiPluginInstance =
                    pluginService.createInstance(deletedConfiguration) as? NotificatiesApiPlugin
                        ?: return@retry
                client.deleteAbonnement(
                    authentication = notificatiesApiPluginInstance.authenticationPluginConfiguration,
                    baseUrl = notificatiesApiPluginInstance.url,
                    abonnementId = abonnementLink.getAbonnementId()
                )
                notificatiesApiAbonnementLinkRepository.delete(abonnementLink)
                logger.info {
                    "Successfully deleted abonnement with id '${abonnementLink.getAbonnementId()}' for removed plugin configuration"
                }
            }
        }
    }

    private fun registerAbonnementenForPluginNotificatiesApiPlugins(
        notificatiesApiPluginInstance: NotificatiesApiPlugin,
        knownNotificatiesApiAbonnementLinks: List<NotificatiesApiAbonnementLink>,
        configurations: List<NotificatiesApiListener>
    ) {
        val abonnementenInApi = client.getAbonnementen(
            authentication = notificatiesApiPluginInstance.authenticationPluginConfiguration,
            baseUrl = notificatiesApiPluginInstance.url
        )

        abonnementenInApi
            .filter { abonnement ->
                abonnement.callbackUrl == notificatiesApiPluginInstance.callbackUrl.toString() &&
                    knownNotificatiesApiAbonnementLinks.none { it.url == abonnement.url }
            }.forEach { abonnement ->
                client.deleteAbonnement(
                    authentication = notificatiesApiPluginInstance.authenticationPluginConfiguration,
                    baseUrl = notificatiesApiPluginInstance.url,
                    abonnementId = abonnement.getId()!!
                )
                logger.info {
                    "Successfully deleted stale abonnement with id '${abonnement.getId()}' not tracked locally"
                }
            }

        val kanalen = configurations
            .flatMap { it.getKanaalFilters() }
            .distinct()

        val currentNotificatiesApiAbonnementLink = knownNotificatiesApiAbonnementLinks.firstOrNull {
            it.notificatiesApiConfigurationId.id == configurations.first()
                .getNotificatiesApiPlugin().notificatiesApiConfigurationId.id
        }

        val authKey = notificatiesApiPluginInstance.authHeader?.takeIf { it.isNotBlank() }
            ?: currentNotificatiesApiAbonnementLink?.auth?.takeIf { it.isNotBlank() }
            ?: createRandomKey()

        ensureKanalenExist(
            kanalen.map { it.naam }.toSet(),
            notificatiesApiPluginInstance.authenticationPluginConfiguration,
            notificatiesApiPluginInstance.url
        )

        val currentNotificatiesApiAbonnement = abonnementenInApi.firstOrNull { abonnement ->
            currentNotificatiesApiAbonnementLink != null &&
                currentNotificatiesApiAbonnementLink.url == abonnement.url
        }

        val abonnement = if (currentNotificatiesApiAbonnement == null) {
            logger.debug {
                "Creating new abonnement for Notificaties API plugin configuration with id " +
                    "'${notificatiesApiPluginInstance.notificatiesApiConfigurationId.id}'"
            }
            client.createAbonnement(
                notificatiesApiPluginInstance.authenticationPluginConfiguration,
                notificatiesApiPluginInstance.url,
                Abonnement(
                    callbackUrl = notificatiesApiPluginInstance.callbackUrl.toASCIIString(),
                    auth = authKey,
                    kanalen = kanalen
                )
            ).also { created ->
                logger.info { "Successfully created abonnement with id '${created.getId()}'" }
            }
        } else {
            val desiredCallbackUrl = notificatiesApiPluginInstance.callbackUrl.toASCIIString()
            val abonnementUnchanged = currentNotificatiesApiAbonnement.callbackUrl == desiredCallbackUrl &&
                currentNotificatiesApiAbonnement.kanalen.toSet() == kanalen.toSet()

            if (abonnementUnchanged) {
                logger.debug {
                    "Skipping update for Notificaties API plugin configuration with id " +
                        "'${notificatiesApiPluginInstance.notificatiesApiConfigurationId.id}' because abonnement is unchanged"
                }
                currentNotificatiesApiAbonnement
            } else {
                logger.debug {
                    "Updating abonnement for Notificaties API plugin configuration with id " +
                        "'${notificatiesApiPluginInstance.notificatiesApiConfigurationId.id}'"
                }
                client.updateAbonnement(
                    authentication = notificatiesApiPluginInstance.authenticationPluginConfiguration,
                    baseUrl = notificatiesApiPluginInstance.url,
                    abonnementId = currentNotificatiesApiAbonnementLink!!.getAbonnementId(),
                    abonnement = Abonnement(
                        callbackUrl = desiredCallbackUrl,
                        auth = authKey,
                        kanalen = kanalen
                    )
                ).also { updated ->
                    logger.info { "Successfully updated abonnement with id '${updated.getId()}'" }
                }
            }
        }

        if (currentNotificatiesApiAbonnement == null && currentNotificatiesApiAbonnementLink != null) {
            logger.debug {
                "Removing existing Notificaties API abonnement link with " +
                    "abonnement id '${currentNotificatiesApiAbonnementLink.getAbonnementId()}' for " +
                    "plugin configuration with id '${notificatiesApiPluginInstance.notificatiesApiConfigurationId.id}' " +
                    "because it is not known in the API"
            }
            notificatiesApiAbonnementLinkRepository.delete(currentNotificatiesApiAbonnementLink)
        }

        notificatiesApiAbonnementLinkRepository.save(
            NotificatiesApiAbonnementLink(
                notificatiesApiConfigurationId = notificatiesApiPluginInstance.notificatiesApiConfigurationId,
                url = abonnement.url!!,
                auth = abonnement.auth ?: authKey
            )
        )
    }

    private fun ensureKanalenExist(
        kanalen: Set<String>,
        authenticationPluginConfiguration: NotificatiesApiAuthentication,
        url: URI,
    ) {
        logger.debug {
            "Ensuring Notificaties API kanalen '$kanalen' exist for authentication configuration with " +
                "id '${authenticationPluginConfiguration.configurationId.id}'"
        }
        val existingKanalen = client.getKanalen(authenticationPluginConfiguration, url).map { it.naam }
        kanalen
            .filter { !existingKanalen.contains(it) }
            .forEach { kanaalNaam ->
                logger.debug {
                    "Attempting to create Notificaties API kanaal with name '$kanaalNaam' for authentication " +
                        "configuration with id '${authenticationPluginConfiguration.configurationId.id}'"
                }
                client.createKanaal(
                    authentication = authenticationPluginConfiguration,
                    baseUrl = url,
                    kanaal = Kanaal(naam = kanaalNaam)
                )
                logger.info {
                    "Successfully created Notificaties API kanaal with name '$kanaalNaam' for authentication " +
                        "configuration with id '${authenticationPluginConfiguration.configurationId.id}'"
                }
            }
    }

    private fun <T> retry(times: Int = DEFAULT_ATTEMPTS, block: () -> T): T {
        var lastException: Exception? = null
        repeat(times) {
            try {
                return block()
            } catch (e: Exception) {
                lastException = e
                logger.warn(e) { "Attempt ${it + 1} of $times to register abonnementen failed" }
            }
        }
        // With a single attempt the caller is [registerAbonnementenWithBackoff], which reports the
        // failure itself along with the retry it is about to schedule.
        if (times > 1) {
            logger.error(lastException) { "Failed to register abonnementen after $times attempts" }
        }
        throw NotificatiesApiAbonnementException(lastException)
    }

    private fun createRandomKey(): String {
        val random = SecureRandom()
        val bytes = ByteArray(32)
        random.nextBytes(bytes)
        return Base64.getEncoder().encodeToString(bytes)
    }

    companion object {
        private const val DEFAULT_ATTEMPTS = 3
        private val logger = KotlinLogging.logger {}
    }
}
