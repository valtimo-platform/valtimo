/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

package com.ritense.aws.parameterstore;

import com.ritense.aws.config.ValtimoCredentialsProviderChain;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.ssm.SsmClient;

public class AwsSsmPropertiesExtractor {
    private static final Logger logger = LoggerFactory.getLogger(AwsSsmPropertiesExtractor.class);

    private final ParameterStoreConfiguration parameterStoreConfiguration;
    private final SsmClient ssmClient;

    public AwsSsmPropertiesExtractor(ParameterStoreConfiguration parameterStoreConfiguration) {
        this(parameterStoreConfiguration, null);
    }

    public AwsSsmPropertiesExtractor(
        ParameterStoreConfiguration parameterStoreConfiguration,
        SsmClient ssmClient
    ) {
        this.parameterStoreConfiguration = parameterStoreConfiguration;
        this.ssmClient = ssmClient != null ? ssmClient : buildSsmClient(parameterStoreConfiguration);

        init();
    }

    private void init() {
        if (!parameterStoreConfiguration.isParameterStoreEnabled()) {
            logger.trace("parameterStoreProperties.enabled is not set to true. Parameter Store properties will not be loaded in.");
            return;
        }

        for (String activeProfile : parameterStoreConfiguration.getActiveProfiles()) {
            addParameterStorePropertiesForProfile(activeProfile);
        }
    }

    private void addParameterStorePropertiesForProfile(String profile) {
        final String path = String.format("/%s/%s/", parameterStoreConfiguration.getProjectName(), profile);
        logger.info("Loading in AWS Parameter Store properties for path: {}", path);
        parameterStoreConfiguration.addPropertySource(
            new ParameterStorePropertySource(
                String.format("AWSParameterStoreProperties[profile=%s]", profile),
                ssmClient,
                path
            )
        );
    }

    private static SsmClient buildSsmClient(ParameterStoreConfiguration parameterStoreConfiguration) {
        return SsmClient.builder()
            .credentialsProvider(ValtimoCredentialsProviderChain.create(parameterStoreConfiguration.getAwsProfile()))
            .region(Region.of(parameterStoreConfiguration.getRegion()))
            .build();
    }
}