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
                "title" to mapOf("en" to "PDCA Plan Manager", "nl" to "PDCA Planbeheer"),
                "description" to mapOf("nl" to "Generiek planbeheer met PDCA-cyclus"),
                "configSchema" to mapOf(
                    "type" to "object",
                    "properties" to mapOf(
                        "planRegisterUrl" to mapOf("type" to "string", "title" to "Plan Register URL")
                    )
                ),
                "frontendBundles" to listOf(
                    mapOf(
                        "type" to "case-tab",
                        "key" to "plan-overview",
                        "path" to "/bundles/plan-overview.js",
                        "title" to mapOf("nl" to "Planoverzicht")
                    ),
                    mapOf(
                        "type" to "case-tab",
                        "key" to "plan-goals",
                        "path" to "/bundles/plan-goals.js",
                        "title" to mapOf("nl" to "Doelen & Acties")
                    ),
                    mapOf(
                        "type" to "case-tab",
                        "key" to "plan-evaluations",
                        "path" to "/bundles/plan-evaluations.js",
                        "title" to mapOf("nl" to "Evaluaties")
                    ),
                    mapOf(
                        "type" to "page",
                        "key" to "pdca-admin",
                        "path" to "/bundles/pdca-admin.js",
                        "title" to mapOf("nl" to "PDCA Beheer")
                    ),
                    mapOf(
                        "type" to "task-form",
                        "key" to "create-plan",
                        "path" to "/bundles/create-plan.js"
                    ),
                    mapOf(
                        "type" to "task-form",
                        "key" to "update-goals",
                        "path" to "/bundles/update-goals.js"
                    ),
                    mapOf(
                        "type" to "task-form",
                        "key" to "evaluate",
                        "path" to "/bundles/evaluate.js"
                    )
                ),
                "actions" to listOf(
                    mapOf("key" to "create-plan", "title" to mapOf("nl" to "Plan aanmaken")),
                    mapOf("key" to "sync-status", "title" to mapOf("nl" to "Status synchroniseren naar zaak"))
                ),
                "permissions" to mapOf(
                    "endpoints" to listOf(
                        mapOf("method" to "GET", "path" to "/api/v1/case/*"),
                        mapOf("method" to "POST", "path" to "/api/v1/case/*/document"),
                        mapOf("method" to "GET", "path" to "/api/v1/document/*"),
                        mapOf("method" to "POST", "path" to "/api/v1/process-link/*/task/*/complete"),
                        mapOf("method" to "GET", "path" to "/api/management/v1/case-definition")
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
