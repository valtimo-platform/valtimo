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

interface ExchangeConfiguration {
  enabled: boolean;
  url: string | null;
}

type ExchangeArtifactType = 'CASE_DEFINITION' | 'BUILDING_BLOCK';

type ExchangeCompatibility = 'COMPATIBLE' | 'NEWER' | 'UNKNOWN';

type ExchangeDependencyType = 'PLUGIN' | 'BUILDING_BLOCK';

interface ExchangeDependency {
  type: ExchangeDependencyType;
  key: string;
  title: string;
  versionTag: string | null;
}

interface ExchangeArtifact {
  publicationId: string;
  publicationName: string;
  artifactId: string;
  type: ExchangeArtifactType;
  title: string;
  versionTag: string | null;
  fileName: string | null;
  valtimoVersion: string | null;
  runningValtimoVersion: string | null;
  compatibility: ExchangeCompatibility;
  dependencies: Array<ExchangeDependency>;
}

interface ExchangeInstallRequest {
  publicationId: string;
  artifactId: string;
}

/** `installed` is null for dependencies whose presence is not checked (plugins). */
interface ExchangeDependencyStatus {
  dependency: ExchangeDependency;
  installed: boolean | null;
}

export {
  ExchangeArtifact,
  ExchangeArtifactType,
  ExchangeCompatibility,
  ExchangeConfiguration,
  ExchangeDependency,
  ExchangeDependencyStatus,
  ExchangeDependencyType,
  ExchangeInstallRequest,
};
