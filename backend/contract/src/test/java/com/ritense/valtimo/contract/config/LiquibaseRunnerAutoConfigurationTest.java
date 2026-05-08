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

package com.ritense.valtimo.contract.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class LiquibaseRunnerAutoConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(LiquibaseRunnerAutoConfiguration.class))
        .withBean(DataSource.class, () -> mock(DataSource.class));

    @Test
    void liquibaseRunnerIsCreatedByDefault() {
        contextRunner.run(context -> assertThat(context).hasSingleBean(LiquibaseRunner.class));
    }

    @Test
    void staleLockThresholdDefaultsToThirtyMinutes() {
        contextRunner.run(context -> {
            ValtimoProperties properties = context.getBean(ValtimoProperties.class);
            assertThat(properties.getLiquibase().getStaleLockThresholdMinutes()).isEqualTo(30);
        });
    }

    @Test
    void staleLockThresholdIsConfigurable() {
        contextRunner
            .withPropertyValues("valtimo.liquibase.stale-lock-threshold-minutes=5")
            .run(context -> {
                ValtimoProperties properties = context.getBean(ValtimoProperties.class);
                assertThat(properties.getLiquibase().getStaleLockThresholdMinutes()).isEqualTo(5);
            });
    }
}
