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
  buildExternalPluginPropertiesSkeleton,
  externalPluginSchemaFields,
} from './external-plugin-properties-skeleton.util';

describe('external plugin properties skeleton', () => {
  const schema = {
    type: 'object',
    required: ['openPlanUrl', 'openPlanToken'],
    properties: {
      openPlanUrl: {
        type: 'string',
        title: 'Open Plan URL',
        default: 'http://host.docker.internal:7501',
        'x-egress-target': true,
      },
      openPlanToken: {type: 'string', 'x-secret': true},
      mode: {type: 'string', enum: ['a', 'b']},
      retries: {type: 'integer'},
    },
  };

  it('fills defaults, enum values and empty values per type', () => {
    expect(JSON.parse(buildExternalPluginPropertiesSkeleton(schema))).toEqual({
      openPlanUrl: 'http://host.docker.internal:7501',
      openPlanToken: '',
      mode: 'a',
      retries: 0,
    });
  });

  it('is an empty object without a schema', () => {
    expect(buildExternalPluginPropertiesSkeleton(null)).toBe('{}');
  });

  it('describes required, secret and egress fields', () => {
    const fields = externalPluginSchemaFields(schema);

    expect(fields[0]).toEqual(
      jasmine.objectContaining({key: 'openPlanUrl', required: true, egressTarget: true})
    );
    expect(fields[1]).toEqual(
      jasmine.objectContaining({key: 'openPlanToken', required: true, secret: true})
    );
    expect(fields[2].required).toBeFalse();
  });
});
