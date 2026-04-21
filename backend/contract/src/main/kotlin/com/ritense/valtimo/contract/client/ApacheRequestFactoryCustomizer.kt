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

package com.ritense.valtimo.contract.client

import org.apache.hc.client5.http.config.ConnectionConfig
import org.apache.hc.client5.http.impl.classic.HttpClients
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder
import org.apache.hc.core5.util.Timeout
import org.springframework.boot.restclient.RestClientCustomizer
import org.springframework.http.client.BufferingClientHttpRequestFactory
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory
import org.springframework.web.client.RestClient
import java.time.Duration

class ApacheRequestFactoryCustomizer(
    private val valtimoHttpRestClientConfigurationProperties: ValtimoHttpRestClientConfigurationProperties
) : RestClientCustomizer {

    override fun customize(restClientBuilder: RestClient.Builder) {
        val connectionManager = PoolingHttpClientConnectionManagerBuilder.create()
            .setDefaultConnectionConfig(
                ConnectionConfig.custom()
                    .setConnectTimeout(Timeout.ofSeconds(valtimoHttpRestClientConfigurationProperties.connectTimeout))
                    .build()
            )
            .build()
        val httpClient = HttpClients.custom()
            .setConnectionManager(connectionManager)
            .build()
        val apacheRequestFactory = HttpComponentsClientHttpRequestFactory(httpClient)
        valtimoHttpRestClientConfigurationProperties.connectionRequestTimeout.let {
            apacheRequestFactory.setConnectionRequestTimeout(Duration.ofSeconds(it))
        }
        restClientBuilder.requestFactory(BufferingClientHttpRequestFactory(apacheRequestFactory))
    }

}