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

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.EnumerablePropertySource;
import software.amazon.awssdk.services.ssm.SsmClient;
import software.amazon.awssdk.services.ssm.model.GetParametersByPathRequest;
import software.amazon.awssdk.services.ssm.model.GetParametersByPathResponse;
import software.amazon.awssdk.services.ssm.model.Parameter;

import javax.validation.constraints.NotNull;
import java.util.Properties;

@Slf4j
public class ParameterStorePropertySource extends EnumerablePropertySource<SsmClient> {

    private final String path;
    private String[] propertyNames;
    private Properties properties;

    public ParameterStorePropertySource(String name, SsmClient source, String path) {
        super(name, source);
        this.path = path;
        fetchParameters();
    }

    private void fetchParameters() {
        properties = new Properties();
        var request = GetParametersByPathRequest.builder()
            .path(path)
            .withDecryption(true)
            .build();

        GetParametersByPathResponse response;
        do {
            response = source.getParametersByPath(request);
            for (Parameter parameter : response.parameters()) {
                String key = parameter.name().substring(path.length());
                logger.debug("Added property {}", key);
                properties.put(key, parameter.value());
            }
            request = GetParametersByPathRequest.builder()
                .path(path)
                .withDecryption(true)
                .nextToken(response.nextToken())
                .build();
        } while (response.nextToken() != null);
        propertyNames = properties.keySet().stream().map(Object::toString).toArray(String[]::new);
    }

    @NotNull
    @Override
    public String[] getPropertyNames() {
        return propertyNames;
    }

    @Override
    public Object getProperty(@NotNull String name) {
        return properties.get(name);
    }

}