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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.exporter.manifest.ArtifactDependency
import com.ritense.exporter.manifest.ArtifactManifestEntry
import com.ritense.exporter.manifest.ExportManifest
import com.ritense.exporter.manifest.RefValue
import com.ritense.exporter.manifest.ResolvableValue
import com.ritense.exporter.manifest.StringValue
import com.ritense.exporter.manifest.ValtimoVersionResolver
import com.ritense.exporter.request.ExportRequest
import io.github.oshai.kotlinlogging.KotlinLogging
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class ValtimoExportService(
    private val exporters: List<Exporter<ExportRequest>>,
    private val objectMapper: ObjectMapper,
    private val valtimoVersionResolver: ValtimoVersionResolver,
) : ExportService {

    override fun export(request: ExportRequest): ByteArrayOutputStream {
        val artifacts = mutableSetOf<ArtifactManifestEntry>()
        val dependencies = mutableSetOf<ArtifactDependency>()
        val exportList: MutableSet<ExportFile> = collectExportFiles(
            request = request,
            artifacts = artifacts,
            dependencies = dependencies,
            isRoot = true,
        ).toMutableSet()

        createManifestFile(artifacts, dependencies)?.let { exportList.add(it) }

        val outputStream = ByteArrayOutputStream()
        ZipOutputStream(outputStream).use { zos ->
            exportList.forEach { exportFile ->
                val zipEntry = ZipEntry(exportFile.path)
                zos.putNextEntry(zipEntry)
                zos.write(exportFile.content)
                zos.closeEntry()
            }
        }
        return outputStream
    }

    private fun collectExportFiles(
        request: ExportRequest,
        history: MutableSet<ExportRequest> = mutableSetOf(),
        artifacts: MutableSet<ArtifactManifestEntry>,
        dependencies: MutableSet<ArtifactDependency>,
        isRoot: Boolean,
    ): Set<ExportFile> {
        //This history prevents stack-overflows
        if (history.contains(request)) {
            return setOf()
        }
        history.add(request)

        return exporters.filter { exporter ->
            exporter.supports().isInstance(request)
        }.apply {
            if (isEmpty()) {
                logger.error { "No exporter found for export request of type '${request::class.java}'" }
            }
        }.mapNotNull { exporter ->
            try {
                val result = exporter.export(request)
                // The manifestDependencies of the exporter that contributes the artifact describe that
                // artifact itself, for when it is pulled in as a dependency of another export. It is not
                // a dependency of itself, so those are ignored here. Any other exporter of the root
                // request does contribute dependencies: a root request can be answered by more than one
                // exporter (a process definition and its process links, for example).
                val artifact = result.manifestArtifact
                if (isRoot && artifact != null) {
                    artifacts.add(artifact)
                } else {
                    dependencies.addAll(result.manifestDependencies)
                }
                result.exportFiles + result.relatedRequests.flatMap {
                    collectExportFiles(it, history, artifacts, dependencies, isRoot = false)
                }
            } catch (e: NoSuchElementException) {
                if (!request.required) {
                    null
                } else {
                    throw e
                }
            }
        }.flatten().toSet()
    }

    private fun createManifestFile(
        artifacts: Set<ArtifactManifestEntry>,
        dependencies: Set<ArtifactDependency>,
    ): ExportFile? {
        if (artifacts.isEmpty()) {
            return null
        }
        val valtimoVersion = valtimoVersionResolver.getValtimoVersion()
        val sortedDependencies = dependencies.sortedWith(dependencyComparator)
        val manifest = ExportManifest(
            artifacts.map { artifact ->
                artifact.copy(
                    valtimoVersion = valtimoVersion,
                    dependencies = sortedDependencies,
                )
            }
        )
        return ExportFile(
            ExportManifest.MANIFEST_FILE_NAME,
            objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(manifest)
        )
    }

    companion object {
        val logger = KotlinLogging.logger {}

        private fun ResolvableValue.sortKey(): String = when (this) {
            is StringValue -> value
            is RefValue -> ref
        }

        private val dependencyComparator: Comparator<ArtifactDependency> = compareBy(
            { it.type },
            { it.key.sortKey() },
            { it.title.sortKey() },
        )
    }
}
