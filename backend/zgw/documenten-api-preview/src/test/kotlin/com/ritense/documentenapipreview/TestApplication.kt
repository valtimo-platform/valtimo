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

package com.ritense.documentenapipreview

import com.ritense.zakenapi.config.ZakenApiAutoConfiguration
import com.ritense.zakenapi.uploadprocess.UploadProcessAutoConfiguration
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.boot.test.context.TestConfiguration

// The zaken-api auto-configurations are excluded because the preview integration test only needs
// ZaakDocumentService (mocked in BaseIntegrationTest) for the linkage check, not the full zaken-api bean graph.
@SpringBootApplication(exclude = [ZakenApiAutoConfiguration::class, UploadProcessAutoConfiguration::class])
class TestApplication {

    fun main(args: Array<String>) {
        runApplication<TestApplication>(*args)
    }

    @TestConfiguration
    class TestConfig {
    }
}
