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

package com.ritense.gzac.opensearch

import org.apache.http.auth.AuthScope
import org.apache.http.auth.UsernamePasswordCredentials
import org.apache.http.conn.ssl.NoopHostnameVerifier
import org.apache.http.conn.ssl.TrustAllStrategy
import org.apache.http.impl.client.BasicCredentialsProvider
import org.apache.http.ssl.SSLContextBuilder
import org.opensearch.client.RestClientBuilder
import org.opensearch.spring.boot.autoconfigure.RestClientBuilderCustomizer
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/**
 * Dev-only configuration that disables SSL certificate verification for OpenSearch
 * and configures basic authentication.
 * Allows connecting to OpenSearch with self-signed certificates in local development.
 *
 * DO NOT use this configuration in production.
 */
@Configuration
class InsecureSslOpenSearchClientConfig {

    @Value("\${opensearch.username:}")
    private lateinit var username: String

    @Value("\${opensearch.password:}")
    private lateinit var password: String

    @Bean
    fun insecureSslRestClientBuilderCustomizer(): RestClientBuilderCustomizer {
        return object : RestClientBuilderCustomizer {
            override fun customize(builder: RestClientBuilder) {
                builder.setHttpClientConfigCallback { httpClientBuilder ->
                    val sslContext = SSLContextBuilder.create()
                        .loadTrustMaterial(TrustAllStrategy.INSTANCE)
                        .build()

                    httpClientBuilder
                        .setSSLContext(sslContext)
                        .setSSLHostnameVerifier(NoopHostnameVerifier.INSTANCE)

                    if (username.isNotBlank() && password.isNotBlank()) {
                        val credentialsProvider = BasicCredentialsProvider()
                        credentialsProvider.setCredentials(
                            AuthScope.ANY,
                            UsernamePasswordCredentials(username, password)
                        )
                        httpClientBuilder.setDefaultCredentialsProvider(credentialsProvider)
                    }

                    httpClientBuilder
                }
            }
        }
    }
}
