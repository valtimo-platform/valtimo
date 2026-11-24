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
  ExternalPluginContractProvider,
  ExternalPluginManifest,
  getExternalPluginContractTitle,
  getExternalPluginDeclaredContracts,
} from './external-plugin.model';

describe('external plugin contract helpers', () => {
  describe('getExternalPluginDeclaredContracts', () => {
    it('reads both the string and the object form', () => {
      const manifest = {
        permissions: {
          contracts: [
            'nl.ritense.openplan@1',
            {contract: 'nl.ritense.zaakdms@1', operations: ['store', 'fetch']},
          ],
        },
      } as ExternalPluginManifest;

      expect(getExternalPluginDeclaredContracts(manifest)).toEqual([
        {contract: 'nl.ritense.openplan@1', operations: null},
        {contract: 'nl.ritense.zaakdms@1', operations: ['store', 'fetch']},
      ]);
    });

    it('skips malformed entries and repeats of a contract', () => {
      const manifest = {
        permissions: {
          contracts: [
            'nl.ritense.openplan@1',
            'nl.ritense.openplan@1',
            '',
            {operations: ['x']},
            42,
          ],
        },
      } as unknown as ExternalPluginManifest;

      expect(getExternalPluginDeclaredContracts(manifest)).toEqual([
        {contract: 'nl.ritense.openplan@1', operations: null},
      ]);
    });

    it('is empty without a manifest', () => {
      expect(getExternalPluginDeclaredContracts(null)).toEqual([]);
    });
  });

  describe('getExternalPluginContractTitle', () => {
    const provider = (
      overrides: Partial<ExternalPluginContractProvider>
    ): ExternalPluginContractProvider =>
      ({
        contractTitle: null,
        contractTranslations: {},
        ...overrides,
      }) as ExternalPluginContractProvider;
    const key = 'contracts.nl.ritense.openplan@1.title';

    it('prefers the translation for the language, then English, then the plain title', () => {
      const translated = provider({
        contractTitle: 'Plain',
        contractTranslations: {en: {[key]: 'English'}, nl: {[key]: 'Nederlands'}},
      });

      expect(getExternalPluginContractTitle(translated, 'nl.ritense.openplan@1', 'nl')).toBe(
        'Nederlands'
      );
      expect(getExternalPluginContractTitle(translated, 'nl.ritense.openplan@1', 'de')).toBe(
        'English'
      );
      expect(
        getExternalPluginContractTitle(
          provider({contractTitle: 'Plain'}),
          'nl.ritense.openplan@1',
          'nl'
        )
      ).toBe('Plain');
    });

    it('is null when the provider names nothing', () => {
      expect(
        getExternalPluginContractTitle(provider({}), 'nl.ritense.openplan@1', 'nl')
      ).toBeNull();
    });
  });
});
