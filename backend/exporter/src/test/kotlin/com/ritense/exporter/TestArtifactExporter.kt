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

package com.ritense.exporter

import com.ritense.exporter.manifest.ArtifactDependency
import com.ritense.exporter.manifest.ArtifactManifestEntry
import com.ritense.exporter.manifest.ArtifactType
import com.ritense.exporter.manifest.DependencyType
import com.ritense.exporter.manifest.ResolvableValue
import org.springframework.stereotype.Component

const val TEST_ARTIFACT_FILE_PATH = "config/case/test/1-0-0/case/definition/test.case-definition.json"

@Component
class TestArtifactExporter : Exporter<TestArtifactExportRequest> {

    override fun supports(): Class<TestArtifactExportRequest> =
        TestArtifactExportRequest::class.java

    override fun export(request: TestArtifactExportRequest) = ExportResult(
        exportFiles = setOf(ExportFile(TEST_ARTIFACT_FILE_PATH, "{}".toByteArray())),
        relatedRequests = setOf(TestNestedExportRequest()),
        manifestArtifact = ArtifactManifestEntry(
            artifactVersionTag = ResolvableValue.ref(TEST_ARTIFACT_FILE_PATH, "/versionTag"),
            title = ResolvableValue.ref(TEST_ARTIFACT_FILE_PATH, "/name"),
            type = ArtifactType.CASE_DEFINITION,
            valtimoVersion = "",
            dependencies = emptyList(),
        ),
    )
}

@Component
class TestManifestDependencyExporter : Exporter<TestNestedExportRequest> {

    override fun supports(): Class<TestNestedExportRequest> =
        TestNestedExportRequest::class.java

    override fun export(request: TestNestedExportRequest) = ExportResult(
        manifestDependencies = setOf(
            ArtifactDependency(
                type = DependencyType.PLUGIN,
                key = ResolvableValue.of("test-plugin"),
                title = ResolvableValue.of("Test Plugin"),
            )
        ),
    )
}
