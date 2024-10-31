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

import org.springframework.boot.context.event.ApplicationEnvironmentPreparedEvent;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.PropertySource;

import javax.validation.constraints.NotNull;

public class ParameterStoreConfiguration {
    private final ConfigurableEnvironment environment;
    private final boolean enabled;
    private final String projectName;
    private final String region;
    private final String awsProfile;

    public ParameterStoreConfiguration(@NotNull ApplicationEnvironmentPreparedEvent event) {
        this.environment = event.getEnvironment();
        this.enabled = environment.getProperty("aws.ssm.enabled", Boolean.class, false);
        this.projectName = environment.getProperty("aws.ssm.projectName");
        this.region = environment.getProperty("aws.ssm.region");
        this.awsProfile = environment.getProperty("aws.profile");
    }

    boolean isParameterStoreEnabled() {
        return enabled;
    }

    String getProjectName() {
        return projectName;
    }

    String getRegion() {
        return region;
    }

    public String getAwsProfile() {
        return awsProfile;
    }

    String[] getActiveProfiles() {
        return environment.getActiveProfiles();
    }

    void addPropertySource(PropertySource propertiesPropertySource) {
        environment.getPropertySources().addFirst(propertiesPropertySource);
    }

}