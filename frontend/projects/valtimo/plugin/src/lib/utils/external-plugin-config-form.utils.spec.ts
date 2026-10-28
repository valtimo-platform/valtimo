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

import {ExternalPluginDefinition, ExternalPluginManifest} from '../models/external-plugin.model';
import {
  canRenderExternalPluginConfigValue,
  getExternalPluginActionStructure,
  getExternalPluginConfigFieldTexts,
  getExternalPluginConfigurationStructure,
  isExternalPluginValueExpression,
  resolveExternalPluginFormMode,
} from './external-plugin-config-form.utils';

describe('external plugin config form utils', () => {
  const manifest = {
    translations: {
      en: {
        name: 'Open Plan',
        description: 'Plans',
        'config.currency.label': 'Currency',
        'config.currency.tooltip': 'ISO 4217 code',
        'config.mode.options.fast': 'Fast',
        'action.greet.name.label': 'Name to greet',
        'action.name.label': 'Name',
        'action.name.tooltip': 'Who to greet',
      },
      nl: {
        name: 'Open Plan',
        description: 'Plannen',
        'config.currency.label': 'Valuta',
        'action.name.label': 'Naam',
      },
    },
    actions: [
      {
        key: 'greet',
        properties: [
          {key: 'name', type: 'string', required: true},
          {key: 'times', type: 'integer'},
          {key: 'loud', type: 'boolean'},
        ],
      },
      {key: 'echo'},
      {key: 'store', properties: [{key: 'payload', type: 'object'}]},
    ],
  } as unknown as ExternalPluginManifest;

  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['currency', 'apiUrl'],
    additionalProperties: false,
    properties: {
      currency: {type: 'string', title: 'Currency code', default: 'EUR', maxLength: 3},
      apiUrl: {type: 'string', format: 'uri', 'x-egress-target': true},
      token: {type: 'string', 'x-secret': true},
      mode: {type: 'string', enum: ['fast', 'safe']},
      retries: {type: 'integer', minimum: 0, maximum: 5},
      ratio: {type: ['number', 'null'], description: 'Share of cases'},
      enabled: {type: 'boolean'},
    },
  };

  describe('getExternalPluginConfigurationStructure', () => {
    it('describes flat typed properties in declaration order', () => {
      const structure = getExternalPluginConfigurationStructure(schema, manifest);

      expect(structure?.translationKeyPrefixes).toEqual(['config']);
      expect(structure?.allowValueExpressions).toBeFalse();
      expect(structure?.fields.map(({key, type, required}) => [key, type, required])).toEqual([
        ['currency', 'string', true],
        ['apiUrl', 'string', true],
        ['token', 'string', false],
        ['mode', 'string', false],
        ['retries', 'integer', false],
        ['ratio', 'number', false],
        ['enabled', 'boolean', false],
      ]);
      expect(structure?.fields[1]).toEqual(jasmine.objectContaining({url: true, secret: false}));
      expect(structure?.fields[2].secret).toBeTrue();
      expect(structure?.fields[3].options).toEqual(['fast', 'safe']);
      expect(structure?.fields[4]).toEqual(jasmine.objectContaining({minimum: 0, maximum: 5}));
    });

    it('accepts an empty property list', () => {
      expect(
        getExternalPluginConfigurationStructure({type: 'object', properties: {}}, manifest)?.fields
      ).toEqual([]);
    });

    it('leaves every other schema to the JSON editor', () => {
      const unsupported = [
        null,
        {type: 'object'},
        {type: 'array', properties: {}},
        {type: 'object', properties: {}, oneOf: [{required: ['a']}]},
        {type: 'object', properties: {}, additionalProperties: {type: 'string'}},
        {type: 'object', properties: {nested: {type: 'object', properties: {}}}},
        {type: 'object', properties: {list: {type: 'array', items: {type: 'string'}}}},
        {type: 'object', properties: {ref: {$ref: '#/$defs/thing'}}},
        {type: 'object', properties: {either: {type: ['string', 'number']}}},
        {type: 'object', properties: {untyped: {title: 'Anything'}}},
        {type: 'object', properties: {flag: {type: 'boolean', enum: [true]}}},
        {type: 'object', properties: {mixed: {type: 'string', enum: ['a', 1]}}},
      ];

      unsupported.forEach(candidate =>
        expect(getExternalPluginConfigurationStructure(candidate, manifest))
          .withContext(JSON.stringify(candidate))
          .toBeNull()
      );
    });
  });

  describe('getExternalPluginActionStructure', () => {
    it('describes the declared properties, labelled under the action before the generic prefix', () => {
      const structure = getExternalPluginActionStructure(manifest, 'greet');

      expect(structure?.translationKeyPrefixes).toEqual(['action.greet', 'action']);
      expect(structure?.allowValueExpressions).toBeTrue();
      expect(structure?.fields.map(({key, type, required}) => [key, type, required])).toEqual([
        ['name', 'string', true],
        ['times', 'integer', false],
        ['loud', 'boolean', false],
      ]);
    });

    it('is null for an unknown action, one without properties, or a non-primitive property', () => {
      expect(getExternalPluginActionStructure(manifest, 'missing')).toBeNull();
      expect(getExternalPluginActionStructure(manifest, 'echo')).toBeNull();
      expect(getExternalPluginActionStructure(manifest, 'store')).toBeNull();
      expect(getExternalPluginActionStructure(manifest, null)).toBeNull();
    });
  });

  describe('canRenderExternalPluginConfigValue', () => {
    const configuration = getExternalPluginConfigurationStructure(schema, manifest)!;
    const action = getExternalPluginActionStructure(manifest, 'greet')!;

    it('accepts declared keys holding their declared types', () => {
      expect(
        canRenderExternalPluginConfigValue(configuration, {
          currency: 'USD',
          mode: 'safe',
          retries: 3,
          ratio: null,
          enabled: false,
        })
      ).toBeTrue();
      expect(canRenderExternalPluginConfigValue(configuration, null)).toBeTrue();
    });

    it('rejects undeclared keys and values the inputs cannot hold', () => {
      expect(canRenderExternalPluginConfigValue(configuration, {legacy: 'x'})).toBeFalse();
      expect(canRenderExternalPluginConfigValue(configuration, {mode: 'slow'})).toBeFalse();
      expect(canRenderExternalPluginConfigValue(configuration, {retries: 1.5})).toBeFalse();
      expect(
        canRenderExternalPluginConfigValue(configuration, {retries: 'pv:retries'})
      ).toBeFalse();
      expect(canRenderExternalPluginConfigValue(configuration, {enabled: 'yes'})).toBeFalse();
      expect(canRenderExternalPluginConfigValue(configuration, ['currency'])).toBeFalse();
    });

    it('accepts value expressions in numeric action properties, not in booleans', () => {
      expect(
        canRenderExternalPluginConfigValue(action, {name: 'doc:/name', times: 'pv:times'})
      ).toBeTrue();
      expect(canRenderExternalPluginConfigValue(action, {times: 2})).toBeTrue();
      expect(canRenderExternalPluginConfigValue(action, {loud: 'pv:loud'})).toBeFalse();
    });
  });

  describe('getExternalPluginConfigFieldTexts', () => {
    const configuration = getExternalPluginConfigurationStructure(schema, manifest)!;
    const action = getExternalPluginActionStructure(manifest, 'greet')!;
    const field = (structure: typeof configuration, key: string) =>
      structure.fields.find(candidate => candidate.key === key)!;

    it('uses the active language, then en, then the schema, then the key', () => {
      expect(
        getExternalPluginConfigFieldTexts(configuration, field(configuration, 'currency'), 'nl')
      ).toEqual(
        jasmine.objectContaining({label: 'Valuta', tooltip: 'ISO 4217 code', placeholder: null})
      );
      expect(
        getExternalPluginConfigFieldTexts(configuration, field(configuration, 'ratio'), 'nl')
      ).toEqual(jasmine.objectContaining({label: 'ratio', tooltip: 'Share of cases'}));
      expect(
        getExternalPluginConfigFieldTexts(configuration, field(configuration, 'retries'), 'de')
          .label
      ).toBe('retries');
    });

    it('prefers a translation in the active language over a more specific key in en', () => {
      expect(getExternalPluginConfigFieldTexts(action, field(action, 'name'), 'nl')).toEqual(
        jasmine.objectContaining({label: 'Naam', tooltip: 'Who to greet'})
      );
      expect(getExternalPluginConfigFieldTexts(action, field(action, 'name'), 'en').label).toBe(
        'Name to greet'
      );
    });

    it('labels enum options from translations, falling back to the value', () => {
      expect(
        getExternalPluginConfigFieldTexts(configuration, field(configuration, 'mode'), 'en').options
      ).toEqual([
        {value: 'fast', label: 'Fast'},
        {value: 'safe', label: 'safe'},
      ]);
    });
  });

  describe('resolveExternalPluginFormMode', () => {
    const definition = (frontendBundles: Array<object> = []): ExternalPluginDefinition =>
      ({
        baseUrl: 'https://host.example',
        version: '1.0.0',
        configurationSchema: schema,
        manifest: {...manifest, frontendBundles},
      }) as unknown as ExternalPluginDefinition;

    it('prefers the plugin bundle for the target', () => {
      const withBundles = definition([
        {type: 'config', path: '/config.html'},
        {type: 'process-link-action', key: 'echo', path: '/echo.html'},
      ]);

      expect(resolveExternalPluginFormMode(withBundles, {type: 'config'}, {})).toEqual({
        kind: 'bundle',
        url: 'https://host.example/1.0.0/config.html',
      });
      expect(
        resolveExternalPluginFormMode(
          withBundles,
          {type: 'process-link-action', actionKey: 'echo'},
          {}
        )
      ).toEqual({kind: 'bundle', url: 'https://host.example/1.0.0/echo.html'});
    });

    it("takes a keyless action bundle for every action, but not another action's", () => {
      const keyless = definition([{type: 'process-link-action', path: '/action.html'}]);
      const keyed = definition([{type: 'process-link-action', key: 'echo', path: '/echo.html'}]);
      const greet = {type: 'process-link-action', actionKey: 'greet'} as const;

      expect(resolveExternalPluginFormMode(keyless, greet, {}).kind).toBe('bundle');
      expect(resolveExternalPluginFormMode(keyed, greet, {}).kind).toBe('form');
    });

    it('generates a form only when it can hold the value', () => {
      const plain = definition();
      const greet = {type: 'process-link-action', actionKey: 'greet'} as const;

      expect(resolveExternalPluginFormMode(plain, {type: 'config'}, {currency: 'EUR'}).kind).toBe(
        'form'
      );
      expect(resolveExternalPluginFormMode(plain, {type: 'config'}, {unknown: 1}).kind).toBe(
        'json'
      );
      expect(resolveExternalPluginFormMode(plain, greet, {loud: 'pv:loud'}).kind).toBe('json');
      expect(
        resolveExternalPluginFormMode(plain, {type: 'process-link-action', actionKey: 'store'}, {})
          .kind
      ).toBe('json');
    });
  });

  it('recognises value-resolver expressions', () => {
    expect(isExternalPluginValueExpression('pv:amount')).toBeTrue();
    expect(isExternalPluginValueExpression('doc:/customer/name')).toBeTrue();
    expect(isExternalPluginValueExpression('42')).toBeFalse();
    expect(isExternalPluginValueExpression('pv:')).toBeFalse();
    expect(isExternalPluginValueExpression(42)).toBeFalse();
  });
});
