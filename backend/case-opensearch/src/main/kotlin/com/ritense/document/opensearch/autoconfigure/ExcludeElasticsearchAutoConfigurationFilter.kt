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

package com.ritense.document.opensearch.autoconfigure

import org.springframework.boot.autoconfigure.AutoConfigurationImportFilter
import org.springframework.boot.autoconfigure.AutoConfigurationMetadata

/**
 * Vetoes Spring Boot's built-in Elasticsearch auto-configurations.
 *
 * The `spring-data-opensearch-starter` transitively puts `spring-data-elasticsearch` (and its
 * Elasticsearch client classes) on the classpath. Spring Boot detects those classes and activates
 * its own Elasticsearch auto-configuration — including a reactive REST client configuration that
 * fails to construct against OpenSearch and aborts application startup with
 * "Lookup method resolution failed".
 *
 * OpenSearch connectivity is provided instead by spring-data-opensearch's own auto-configuration
 * (driven by the `opensearch.*` properties), so Boot's Elasticsearch auto-configs are not just
 * unnecessary but actively harmful. Excluding them here — inside the library — means any consuming
 * application gets a working setup out of the box, without having to add
 * `spring.autoconfigure.exclude` entries to its own configuration.
 */
class ExcludeElasticsearchAutoConfigurationFilter : AutoConfigurationImportFilter {

    override fun match(
        autoConfigurationClasses: Array<String?>,
        autoConfigurationMetadata: AutoConfigurationMetadata,
    ): BooleanArray = BooleanArray(autoConfigurationClasses.size) { index ->
        autoConfigurationClasses[index] !in EXCLUDED_AUTO_CONFIGURATIONS
    }

    companion object {
        private val EXCLUDED_AUTO_CONFIGURATIONS = setOf(
            "org.springframework.boot.autoconfigure.elasticsearch.ElasticsearchClientAutoConfiguration",
            "org.springframework.boot.autoconfigure.elasticsearch.ElasticsearchRestClientAutoConfiguration",
            "org.springframework.boot.autoconfigure.elasticsearch.ReactiveElasticsearchClientAutoConfiguration",
            "org.springframework.boot.autoconfigure.data.elasticsearch.ElasticsearchDataAutoConfiguration",
            "org.springframework.boot.autoconfigure.data.elasticsearch.ElasticsearchRepositoriesAutoConfiguration",
            "org.springframework.boot.autoconfigure.data.elasticsearch.ReactiveElasticsearchRepositoriesAutoConfiguration",
        )
    }
}
