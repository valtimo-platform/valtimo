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

package com.ritense.exporter.manifest

/**
 * Describes a single exported artifact (a case definition or a building block) in the export manifest.
 */
data class ArtifactManifestEntry(
    val artifactVersionTag: ResolvableValue,
    val title: ResolvableValue,
    val type: ArtifactType,
    val valtimoVersion: String,
    val dependencies: List<ArtifactDependency>,
)
