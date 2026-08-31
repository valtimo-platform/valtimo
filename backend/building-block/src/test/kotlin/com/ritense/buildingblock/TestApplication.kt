/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.buildingblock

import com.ritense.case_.service.migration.CaseMigrationRunner
import com.ritense.case_.service.migration.CaseMigrationService
import com.ritense.plugin.PluginFactory
import com.ritense.plugin.service.PluginService
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.core.task.SyncTaskExecutor

@SpringBootApplication
class TestApplication {

    fun main(args: Array<String>) {
        runApplication<TestApplication>(*args)
    }

    @TestConfiguration
    class TestConfig {
        @Bean
        fun testMailPluginFactory(pluginService: PluginService): PluginFactory<TestMailPlugin> {
            return TestMailPluginFactory(pluginService)
        }

        /**
         * Run migrations on the calling thread instead of the background pool.
         *
         * Production dispatches a run to a pool (D17) because it takes hours; an integration test
         * migrates one or two cases and asserts the outcome immediately after. Left asynchronous, every
         * assertion would be a race, and the polling needed to avoid that would hold a second connection
         * open for the length of the run. What the pool adds — claim, dispatch, abandon on rejection — is
         * covered by `CaseMigrationRunnerTest`; what these tests are about is the migration itself.
         */
        @Bean
        fun caseMigrationRunner(caseMigrationService: CaseMigrationService) =
            CaseMigrationRunner(caseMigrationService, SyncTaskExecutor())
    }
}
