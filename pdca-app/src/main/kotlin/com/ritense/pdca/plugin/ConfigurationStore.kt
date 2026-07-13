package com.ritense.pdca.plugin

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.util.concurrent.ConcurrentHashMap

data class PluginConfiguration(
    val configId: String,
    val properties: Map<String, Any>,
    val serviceToken: String,
    val gzacBaseUrl: String,
    val eventSubscriptions: List<String> = emptyList()
)

@Component
class ConfigurationStore {

    private val logger = LoggerFactory.getLogger(ConfigurationStore::class.java)
    private val configurations = ConcurrentHashMap<String, PluginConfiguration>()

    fun store(configId: String, configuration: PluginConfiguration) {
        configurations[configId] = configuration
        logger.info("Stored plugin configuration for configId={}", configId)
    }

    fun get(configId: String): PluginConfiguration? {
        return configurations[configId]
    }

    fun remove(configId: String): Boolean {
        val removed = configurations.remove(configId) != null
        if (removed) {
            logger.info("Removed plugin configuration for configId={}", configId)
        } else {
            logger.warn("Attempted to remove non-existent configuration for configId={}", configId)
        }
        return removed
    }

    fun getAll(): Map<String, PluginConfiguration> {
        return configurations.toMap()
    }
}
