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
    required: ['openPlanUrl', 'openPlanToken', 'tenant'],
    properties: {
      openPlanUrl: {
        type: 'string',
        title: 'Open Plan URL',
        default: 'http://host.docker.internal:7501',
        'x-egress-target': true,
      },
      openPlanToken: {type: 'string', 'x-secret': true},
      tenant: {type: 'string'},
      mode: {type: 'string', enum: ['a', 'b']},
      retries: {type: 'integer', default: 0},
      apiKey: {type: 'string', default: 'changeme', 'x-secret': true},
    },
  };

  it('keeps only non-secret properties that declare a default', () => {
    expect(buildExternalPluginPropertiesSkeleton(schema)).toEqual({
      openPlanUrl: 'http://host.docker.internal:7501',
      retries: 0,
    });
  });

  it('leaves required properties without a default absent, so the schema still flags them', () => {
    const skeleton = buildExternalPluginPropertiesSkeleton(schema);

    expect('tenant' in skeleton).toBeFalse();
    expect('openPlanToken' in skeleton).toBeFalse();
  });

  it('is an empty object without a schema', () => {
    expect(buildExternalPluginPropertiesSkeleton(null)).toEqual({});
  });

  it('describes required, secret and egress fields', () => {
    const fields = externalPluginSchemaFields(schema);

    expect(fields[0]).toEqual(
      jasmine.objectContaining({key: 'openPlanUrl', required: true, egressTarget: true})
    );
    expect(fields[1]).toEqual(
      jasmine.objectContaining({key: 'openPlanToken', required: true, secret: true})
    );
    expect(fields[3].required).toBeFalse();
  });
});
