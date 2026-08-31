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

package com.ritense

import com.ritense.case.TestFormExporter
import com.ritense.case_.TestResolverFactory
import com.ritense.case_.service.migration.CaseMigrationRunner
import com.ritense.case_.service.migration.CaseMigrationService
import com.ritense.case_.widget.TestCaseWidgetDataProvider
import com.ritense.case_.widget.TestCaseWidgetMapper
import com.ritense.valtimo.contract.config.LiquibaseMasterChangeLogLocation
import org.mockito.kotlin.spy
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingClass
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
        fun testResolverFactory(): TestResolverFactory {
            return spy(TestResolverFactory())
        }

        @Bean
        @ConditionalOnMissingClass("com.ritense.form.service.FormDefinitionImporter")
        fun fakeFormDefinitionImporter(): FakeFormDefinitionImporter = FakeFormDefinitionImporter()

        @Bean
        fun testFormExporter() = TestFormExporter()

        @Bean
        fun testCaseWidgetMapper() = TestCaseWidgetMapper()

        @Bean
        fun testCaseWidgetDataProvider() = TestCaseWidgetDataProvider()

        /**
         * Run migrations on the calling thread instead of the background pool (D17).
         *
         * No integration test here starts a run yet; this is here so that the first one to do so cannot
         * quietly become a race. A run dispatched to the pool returns before it has migrated anything, so
         * an assertion made straight after the call is asserting against an unfinished run — which is how
         * `BuildingBlockMigrationCascadeIT` broke. What the pool itself adds is covered by
         * `CaseMigrationRunnerTest`.
         */
        @Bean
        fun caseMigrationRunner(caseMigrationService: CaseMigrationService) =
            CaseMigrationRunner(caseMigrationService, SyncTaskExecutor())
    }
}
