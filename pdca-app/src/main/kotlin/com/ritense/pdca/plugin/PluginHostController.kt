package com.ritense.pdca.plugin

import org.slf4j.LoggerFactory
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

@RestController
class PluginHostController(
    private val configurationStore: ConfigurationStore
) {

    private val logger = LoggerFactory.getLogger(PluginHostController::class.java)

    @GetMapping("/health")
    fun health(): Map<String, String> {
        return mapOf("status" to "UP")
    }

    @GetMapping("/api/host/plugins")
    fun getPlugins(): List<Map<String, Any>> {
        return listOf(
            mapOf(
                "pluginId" to "pdca",
                "version" to "0.1.0",
                "translations" to mapOf(
                    "en" to mapOf(
                        "name" to "PDCA Plan Manager",
                        "description" to "Generic plan management with PDCA cycle",
                        "pdca-admin.title" to "PDCA Management"
                    ),
                    "nl" to mapOf(
                        "name" to "PDCA Planbeheer",
                        "description" to "Generiek planbeheer met PDCA-cyclus",
                        "pdca-admin.title" to "PDCA Beheer"
                    )
                ),
                "configurationSchema" to mapOf(
                    "type" to "object",
                    "properties" to mapOf(
                        "planRegisterUrl" to mapOf("type" to "string", "title" to "Plan Register URL")
                    )
                ),
                "frontendBundles" to listOf(
                    mapOf(
                        "type" to "case-tab",
                        "key" to "plan-overview",
                        "path" to "/bundles/plan-overview.html",
                        "title" to "Planoverzicht"
                    ),
                    mapOf(
                        "type" to "case-tab",
                        "key" to "plan-goals",
                        "path" to "/bundles/plan-goals.html",
                        "title" to "Doelen & Acties"
                    ),
                    mapOf(
                        "type" to "case-tab",
                        "key" to "plan-evaluations",
                        "path" to "/bundles/plan-evaluations.html",
                        "title" to "Evaluaties"
                    ),
                    mapOf(
                        "type" to "page",
                        "key" to "pdca-admin",
                        "path" to "/bundles/pdca-admin.html",
                        "title" to "pdca-admin.title"
                    ),
                    mapOf(
                        "type" to "task-form",
                        "key" to "create-plan",
                        "path" to "/bundles/create-plan.html"
                    ),
                    mapOf(
                        "type" to "task-form",
                        "key" to "update-goals",
                        "path" to "/bundles/update-goals.html"
                    ),
                    mapOf(
                        "type" to "task-form",
                        "key" to "evaluate",
                        "path" to "/bundles/evaluate.html"
                    )
                ),
                "actions" to listOf(
                    mapOf("key" to "create-plan", "title" to "Plan aanmaken"),
                    mapOf("key" to "sync-status", "title" to "Status synchroniseren naar zaak")
                ),
                "permissions" to mapOf(
                    "endpoints" to listOf(
                        mapOf("method" to "GET", "pattern" to "/api/v1/case/*"),
                        mapOf("method" to "POST", "pattern" to "/api/v1/case/*/document"),
                        mapOf("method" to "GET", "pattern" to "/api/v1/document/*"),
                        mapOf("method" to "POST", "pattern" to "/api/v1/process-link/*/task/*/complete"),
                        mapOf("method" to "GET", "pattern" to "/api/management/v1/case-definition")
                    )
                )
            )
        )
    }

    // TODO: Add HMAC signature verification for production use.
    //  The X-Plugin-Signature header should be validated against the shared secret
    //  to ensure requests originate from the trusted GZAC instance.
    @PostMapping("/api/host/configurations/{configId}")
    fun pushConfiguration(
        @PathVariable configId: String,
        @RequestBody body: Map<String, Any>
    ): ResponseEntity<Void> {
        logger.info("Received configuration push for configId={}: {}", configId, body)

        val serviceToken = body["serviceToken"] as? String ?: ""
        val gzacBaseUrl = body["gzacBaseUrl"] as? String ?: ""
        val properties = body["properties"] as? Map<String, Any> ?: emptyMap()

        @Suppress("UNCHECKED_CAST")
        val eventSubscriptions = body["eventSubscriptions"] as? List<String> ?: emptyList()

        val configuration = PluginConfiguration(
            configId = configId,
            properties = properties,
            serviceToken = serviceToken,
            gzacBaseUrl = gzacBaseUrl,
            eventSubscriptions = eventSubscriptions
        )

        configurationStore.store(configId, configuration)

        return ResponseEntity.ok().build()
    }

    @DeleteMapping("/api/host/configurations/{configId}")
    fun removeConfiguration(@PathVariable configId: String): ResponseEntity<Void> {
        configurationStore.remove(configId)
        return ResponseEntity.noContent().build()
    }
}
