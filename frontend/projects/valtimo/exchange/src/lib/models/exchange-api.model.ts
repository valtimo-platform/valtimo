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

type ExchangePublicationType = 'CaseDefinition' | 'BuildingBlock' | 'Plugin';

type ExchangePublicationStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED';

type ExchangeEstafetteStage = 'HELP_WANTED' | 'COMMUNITY' | 'CANDIDATE' | 'HALL_OF_FAME';

type ExchangeLicense =
  | 'EUPL_1_2'
  | 'MIT'
  | 'Apache_2_0'
  | 'BSD_3_Clause'
  | 'GPL_3_0'
  | 'LGPL_3_0'
  | 'AGPL_3_0'
  | 'MPL_2_0'
  | 'CC0_1_0'
  | 'CC_BY_4_0'
  | 'Other';

type ExchangeSort = 'nameAsc' | 'recent';

interface ExchangePublicationSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly publicationType: ExchangePublicationType;
  readonly tags: ReadonlyArray<string>;
  readonly shortDescription?: string | null;
  readonly logo?: string | null;
  readonly publisherOrganization?: string | null;
  readonly valtimoVersion?: string | null;
  readonly latestVersion: string;
  readonly estafetteStage: ExchangeEstafetteStage;
}

interface ExchangeSearchResultDto {
  readonly content: ReadonlyArray<ExchangePublicationSummaryDto>;
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
}

interface ExchangeTagsDto {
  readonly tags: ReadonlyArray<string>;
}

interface ExchangeDependencyDto {
  readonly dependencyType: string;
  readonly key: string;
  readonly title: string;
  readonly versionTag?: string | null;
}

interface ExchangeArtifactDto {
  readonly id: string;
  readonly url?: string | null;
  readonly default: boolean;
  readonly versionTag?: string | null;
  readonly title: string;
  readonly manifestType: string;
  readonly valtimoVersion: string;
  readonly releaseNotes?: string | null;
  readonly fileName?: string | null;
  readonly uploadedAt: string;
  readonly dependencies: ReadonlyArray<ExchangeDependencyDto>;
}

interface ExchangePublicationDto {
  readonly id: string;
  readonly name: string;
  readonly status: ExchangePublicationStatus;
  readonly publicationType: ExchangePublicationType;
  readonly estafetteStage: ExchangeEstafetteStage;
  readonly tags: ReadonlyArray<string>;
  readonly shortDescription?: string | null;
  readonly description?: string | null;
  readonly implementationInstructions?: string | null;
  readonly logo?: string | null;
  readonly screenshots: ReadonlyArray<string>;
  readonly repositoryUrl?: string | null;
  readonly license?: ExchangeLicense | null;
  readonly licenseOther?: string | null;
  readonly publisherOrganization?: string | null;
  readonly publisherOrganizationLogoUrl?: string | null;
  readonly publisherOrganizationWebsite?: string | null;
  readonly artifacts: ReadonlyArray<ExchangeArtifactDto>;
}

export {
  ExchangeArtifactDto,
  ExchangeDependencyDto,
  ExchangeEstafetteStage,
  ExchangeLicense,
  ExchangePublicationDto,
  ExchangePublicationStatus,
  ExchangePublicationSummaryDto,
  ExchangePublicationType,
  ExchangeSearchResultDto,
  ExchangeSort,
  ExchangeTagsDto,
};
