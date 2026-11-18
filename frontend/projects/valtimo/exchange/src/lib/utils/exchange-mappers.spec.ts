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
  ExchangePublicationDto,
  ExchangePublicationSummaryDto,
} from '../models';
import {toCatalogItem, toPublicationDetail} from './exchange-mappers';

const artifact = (overrides: Partial<ExchangeArtifactDto> = {}): ExchangeArtifactDto => ({
  id: 'a1',
  url: '/api/v1/publications/p1/artifacts/a1',
  default: false,
  versionTag: '1.0.0',
  title: 'Plan 1.0.0',
  manifestType: 'CASE_DEFINITION',
  valtimoVersion: '13.0.0',
  releaseNotes: null,
  fileName: 'plan.zip',
  uploadedAt: '2026-03-13T10:00:00Z',
  dependencies: [],
  ...overrides,
});

const publication = (overrides: Partial<ExchangePublicationDto> = {}): ExchangePublicationDto => ({
  id: 'p1',
  name: 'Plan',
  status: 'PUBLISHED',
  publicationType: 'CaseDefinition',
  estafetteStage: 'COMMUNITY',
  tags: ['finance'],
  screenshots: [],
  artifacts: [artifact({default: true})],
  ...overrides,
});

describe('exchange mappers', () => {
  describe('toCatalogItem', () => {
    it('maps a summary and defaults null fields', () => {
      const summary: ExchangePublicationSummaryDto = {
        id: 'p1',
        name: 'Plan',
        publicationType: 'BuildingBlock',
        tags: ['hr'],
        shortDescription: null,
        logo: null,
        publisherOrganization: null,
        valtimoVersion: null,
        latestVersion: '1.0.0',
        estafetteStage: 'COMMUNITY',
      };

      expect(toCatalogItem(summary)).toEqual({
        id: 'p1',
        name: 'Plan',
        shortDescription: '',
        publicationType: 'BuildingBlock',
        tags: ['hr'],
        logo: null,
        publisherOrganization: null,
        valtimoVersion: null,
      });
    });
  });

  describe('toPublicationDetail', () => {
    it('marks only PUBLISHED as published', () => {
      expect(toPublicationDetail(publication()).isPublished).toBeTrue();
      expect(toPublicationDetail(publication({status: 'DRAFT'})).isPublished).toBeFalse();
      expect(toPublicationDetail(publication({status: 'PENDING_REVIEW'})).isPublished).toBeFalse();
    });

    it('sorts versions default-first and keeps the backend order otherwise', () => {
      const detail = toPublicationDetail(
        publication({
          artifacts: [
            artifact({id: 'a1', versionTag: '1.0.0'}),
            artifact({id: 'a2', versionTag: '2.0.0'}),
            artifact({id: 'a3', versionTag: '3.0.0', default: true}),
          ],
        })
      );

      expect(detail.versions.map(version => version.artifactId)).toEqual(['a3', 'a1', 'a2']);
      expect(detail.defaultVersion?.artifactId).toBe('a3');
    });

    it('falls back to the first artifact when none is default', () => {
      const detail = toPublicationDetail(
        publication({artifacts: [artifact({id: 'a1'}), artifact({id: 'a2'})]})
      );

      expect(detail.defaultVersion?.artifactId).toBe('a1');
    });

    it('has no default version without artifacts', () => {
      const detail = toPublicationDetail(publication({artifacts: []}));

      expect(detail.defaultVersion).toBeNull();
      expect(detail.versions).toEqual([]);
      expect(detail.isEmbedded).toBeFalse();
    });

    it('treats a default artifact without url as embedded', () => {
      const detail = toPublicationDetail(
        publication({artifacts: [artifact({default: true, url: null})]})
      );

      expect(detail.isEmbedded).toBeTrue();
      expect(detail.defaultVersion?.installable).toBeFalse();
    });

    it('only allows installing case definitions and building blocks with a stored file', () => {
      const detail = toPublicationDetail(
        publication({
          artifacts: [
            artifact({id: 'a1', default: true, manifestType: 'CASE_DEFINITION'}),
            artifact({id: 'a2', manifestType: 'BUILDING_BLOCK'}),
            artifact({id: 'a3', manifestType: 'PLUGIN'}),
            artifact({id: 'a4', manifestType: 'CASE_DEFINITION', url: null}),
          ],
        })
      );

      expect(detail.versions.map(version => version.installable)).toEqual([
        true,
        true,
        false,
        false,
      ]);
    });

    it('defaults null text fields and maps dependencies', () => {
      const detail = toPublicationDetail(
        publication({
          shortDescription: null,
          description: null,
          implementationInstructions: null,
          licenseOther: null,
          artifacts: [
            artifact({
              default: true,
              releaseNotes: null,
              versionTag: null,
              fileName: null,
              dependencies: [
                {dependencyType: 'PLUGIN', key: 'k', title: 'Plugin', versionTag: null},
                {dependencyType: 'BUILDING_BLOCK', key: 'bb', title: 'Block', versionTag: '1.2.0'},
              ],
            }),
          ],
        })
      );

      expect(detail.shortDescription).toBe('');
      expect(detail.description).toBe('');
      expect(detail.implementationInstructions).toBe('');
      expect(detail.licenseOther).toBe('');
      expect(detail.defaultVersion?.releaseNotes).toBe('');
      expect(detail.defaultVersion?.versionTag).toBe('');
      expect(detail.defaultVersion?.dependencies).toEqual([
        {type: 'PLUGIN', key: 'k', title: 'Plugin', versionTag: null},
        {type: 'BUILDING_BLOCK', key: 'bb', title: 'Block', versionTag: '1.2.0'},
      ]);
    });
  });
});
