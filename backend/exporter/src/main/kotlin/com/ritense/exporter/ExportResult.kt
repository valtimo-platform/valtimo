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

package com.ritense.exporter

import com.ritense.exporter.manifest.ArtifactDependency
import com.ritense.exporter.manifest.ArtifactManifestEntry
import com.ritense.exporter.request.ExportRequest

data class ExportResult(
    val exportFiles: Set<ExportFile> = setOf(),
    val relatedRequests: Set<ExportRequest> = setOf(),
) {
    /**
     * The manifest artifact this export produces. Only used when this result belongs to the root
     * export request; ignored when the request was pulled in as a (transitive) dependency.
     *
     * NOTE: the manifest fields are kept out of the primary constructor on purpose. Exporters are
     * shipped as separately-compiled plugins that call this constructor; adding parameters to the
     * primary constructor of a data class changes its (synthetic) constructor signature and breaks
     * binary compatibility with those plugins (NoSuchMethodError at runtime). They are populated
     * through the secondary constructor below instead.
     */
    var manifestArtifact: ArtifactManifestEntry? = null
        private set

    /**
     * Manifest dependencies contributed by this export (e.g. plugins referenced by a process link, or
     * a building block pulled in as a dependency). Collected for non-root export requests.
     *
     * See the note on [manifestArtifact] for why this is not a primary-constructor parameter.
     */
    var manifestDependencies: Set<ArtifactDependency> = setOf()
        private set

    constructor(exportFile: ExportFile?, relatedRequests: Set<ExportRequest> = setOf()) : this(
        if (exportFile != null) setOf(exportFile) else setOf(),
        relatedRequests
    )

    /**
     * Constructor for exports that contribute to the manifest. [manifestArtifact] and
     * [manifestDependencies] are intentionally required (no defaults): giving them defaults would make
     * this constructor callable with the same argument shapes as the primary constructor, causing an
     * overload-resolution ambiguity. Pass `null` / `emptySet()` for the facet that does not apply.
     */
    constructor(
        exportFiles: Set<ExportFile> = setOf(),
        relatedRequests: Set<ExportRequest> = setOf(),
        manifestArtifact: ArtifactManifestEntry?,
        manifestDependencies: Set<ArtifactDependency>,
    ) : this(exportFiles, relatedRequests) {
        this.manifestArtifact = manifestArtifact
        this.manifestDependencies = manifestDependencies
    }
}
