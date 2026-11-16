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

import {
  ExchangeArtifactType,
  ExchangeCompatibility,
  ExchangeDependency,
} from './exchange-view.model';

interface ExchangeInstallRequest {
  readonly publicationId: string;
  readonly publicationName: string;
  readonly artifactId: string;
  readonly type: ExchangeArtifactType;
  readonly versionTag: string;
  readonly valtimoVersion: string;
  readonly releaseNotes: string;
  readonly dependencies: ReadonlyArray<ExchangeDependency>;
}

interface ExchangeInstallSummary {
  readonly publicationName: string;
  readonly type: ExchangeArtifactType;
  readonly versionTag: string | null;
  readonly valtimoVersion: string | null;
  readonly compatibility: ExchangeCompatibility;
  readonly runningValtimoVersion: string | null;
  readonly releaseNotes: string | null;
}

/** Building blocks are INSTALLED/NOT_INSTALLED, plugins CONFIGURED/NOT_CONFIGURED; UNKNOWN when the check failed. */
type ExchangeDependencyState =
  | 'INSTALLED'
  | 'NOT_INSTALLED'
  | 'CONFIGURED'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN';

interface ExchangeDependencyStatus {
  readonly dependency: ExchangeDependency;
  readonly state: ExchangeDependencyState;
}

export {
  ExchangeDependencyState,
  ExchangeDependencyStatus,
  ExchangeInstallRequest,
  ExchangeInstallSummary,
};
