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
  ExchangeArtifactDto,
  ExchangeCatalogItem,
  ExchangePublicationDetail,
  ExchangePublicationDto,
  ExchangePublicationSummaryDto,
  ExchangeVersion,
} from '../models';

const INSTALLABLE_MANIFEST_TYPES = ['CASE_DEFINITION', 'BUILDING_BLOCK'];

const toCatalogItem = (dto: ExchangePublicationSummaryDto): ExchangeCatalogItem => ({
  id: dto.id,
  name: dto.name,
  shortDescription: dto.shortDescription ?? '',
  publicationType: dto.publicationType,
  tags: dto.tags ?? [],
  logo: dto.logo ?? null,
  publisherOrganization: dto.publisherOrganization ?? null,
  valtimoVersion: dto.valtimoVersion ?? null,
});

const toVersion = (artifact: ExchangeArtifactDto): ExchangeVersion => ({
  artifactId: artifact.id,
  versionTag: artifact.versionTag ?? '',
  valtimoVersion: artifact.valtimoVersion ?? '',
  releaseNotes: artifact.releaseNotes ?? '',
  fileName: artifact.fileName ?? '',
  uploadedAt: artifact.uploadedAt,
  isDefault: artifact.default,
  manifestType: artifact.manifestType,
  installable: INSTALLABLE_MANIFEST_TYPES.includes(artifact.manifestType) && !!artifact.url,
  dependencies: (artifact.dependencies ?? []).map(dependency => ({
    type: dependency.dependencyType,
    key: dependency.key,
    title: dependency.title,
    versionTag: dependency.versionTag ?? null,
  })),
});

const toPublicationDetail = (dto: ExchangePublicationDto): ExchangePublicationDetail => {
  const artifacts = dto.artifacts ?? [];
  // Stable sort: default first, backend order otherwise
  const versions = artifacts
    .map(toVersion)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const defaultArtifact = artifacts.find(artifact => artifact.default) ?? artifacts[0];
  const defaultVersion = defaultArtifact
    ? (versions.find(version => version.artifactId === defaultArtifact.id) ?? null)
    : null;

  return {
    id: dto.id,
    name: dto.name,
    isPublished: dto.status === 'PUBLISHED',
    publicationType: dto.publicationType,
    estafetteStage: dto.estafetteStage,
    tags: dto.tags ?? [],
    shortDescription: dto.shortDescription ?? '',
    description: dto.description ?? '',
    implementationInstructions: dto.implementationInstructions ?? '',
    logo: dto.logo ?? null,
    screenshots: dto.screenshots ?? [],
    repositoryUrl: dto.repositoryUrl ?? null,
    license: dto.license ?? null,
    licenseOther: dto.licenseOther ?? '',
    publisherOrganization: dto.publisherOrganization ?? null,
    publisherOrganizationLogoUrl: dto.publisherOrganizationLogoUrl ?? null,
    publisherOrganizationWebsite: dto.publisherOrganizationWebsite ?? null,
    isEmbedded: !!defaultArtifact && !defaultArtifact.url,
    versions,
    defaultVersion,
  };
};

export {toCatalogItem, toPublicationDetail};
