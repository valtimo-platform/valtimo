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
  ExchangeEstafetteStage,
  ExchangeLicense,
  ExchangePublicationType,
} from './exchange-api.model';

type ExchangeArtifactType = 'CASE_DEFINITION' | 'BUILDING_BLOCK';

type ExchangeCompatibility = 'COMPATIBLE' | 'NEWER' | 'UNKNOWN';

type ExchangeDependencyType = 'PLUGIN' | 'BUILDING_BLOCK';

interface ExchangeCatalogItem {
  readonly id: string;
  readonly name: string;
  readonly shortDescription: string;
  readonly publicationType: ExchangePublicationType;
  readonly tags: ReadonlyArray<string>;
  readonly logo: string | null;
  readonly publisherOrganization: string | null;
  readonly valtimoVersion: string | null;
}

interface ExchangeDependency {
  readonly type: string;
  readonly key: string;
  readonly title: string;
  readonly versionTag: string | null;
}

interface ExchangeVersion {
  readonly artifactId: string;
  readonly versionTag: string;
  readonly valtimoVersion: string;
  readonly releaseNotes: string;
  readonly fileName: string;
  readonly uploadedAt: string;
  readonly isDefault: boolean;
  readonly manifestType: string;
  readonly installable: boolean;
  readonly dependencies: ReadonlyArray<ExchangeDependency>;
}

interface ExchangePublicationDetail {
  readonly id: string;
  readonly name: string;
  readonly isPublished: boolean;
  readonly publicationType: ExchangePublicationType;
  readonly estafetteStage: ExchangeEstafetteStage;
  readonly tags: ReadonlyArray<string>;
  readonly shortDescription: string;
  readonly description: string;
  readonly implementationInstructions: string;
  readonly logo: string | null;
  readonly screenshots: ReadonlyArray<string>;
  readonly repositoryUrl: string | null;
  readonly license: ExchangeLicense | null;
  readonly licenseOther: string;
  readonly publisherOrganization: string | null;
  readonly publisherOrganizationLogoUrl: string | null;
  readonly publisherOrganizationWebsite: string | null;
  readonly isEmbedded: boolean;
  readonly versions: ReadonlyArray<ExchangeVersion>;
  readonly defaultVersion: ExchangeVersion | null;
}

export {
  ExchangeArtifactType,
  ExchangeCatalogItem,
  ExchangeCompatibility,
  ExchangeDependency,
  ExchangeDependencyType,
  ExchangePublicationDetail,
  ExchangeVersion,
};
