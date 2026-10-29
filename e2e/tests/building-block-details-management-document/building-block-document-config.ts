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

/**
 * The building block the tests operate on. Created through the API in `beforeAll`
 * with a unique key: the document tab is read-only on finalized versions, so the
 * suite needs a draft it fully controls.
 */
export const TEST_BUILDING_BLOCK = {
  keyPrefix: 'e2e-bb-doc',
  namePrefix: 'E2E BB Document',
  description: 'Building block created by the e2e building block document test.',
  versionTag: '1.0.0',
} as const;

/**
 * Document schema seeded before the tests run. It deliberately covers every field
 * type the coverage list mentions, carries a description on each field, and marks
 * exactly one root property as required.
 */
export function buildSeedSchema(key: string) {
  return {
    $id: `${key}.schema`,
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: [SEED_FIELDS.applicantName.name],
    properties: {
      applicantName: {type: 'string', description: SEED_FIELDS.applicantName.description},
      applicantAge: {type: 'integer', description: SEED_FIELDS.applicantAge.description},
      hasPartner: {type: 'boolean', description: SEED_FIELDS.hasPartner.description},
      address: {
        type: 'object',
        description: SEED_FIELDS.address.description,
        properties: {
          street: {type: 'string', description: SEED_FIELDS.street.description},
          houseNumber: {type: 'integer', description: SEED_FIELDS.houseNumber.description},
        },
      },
      attachments: {
        type: 'array',
        description: SEED_FIELDS.attachments.description,
        items: {type: 'string'},
      },
    },
  };
}

export const SEED_FIELDS = {
  applicantName: {
    name: 'applicantName',
    type: 'string',
    description: 'Full name of the applicant',
  },
  applicantAge: {name: 'applicantAge', type: 'integer', description: 'Age in whole years'},
  hasPartner: {
    name: 'hasPartner',
    type: 'boolean',
    description: 'Whether the applicant has a partner',
  },
  address: {name: 'address', type: 'object', description: 'Home address of the applicant'},
  street: {name: 'street', type: 'string', description: 'Street name'},
  houseNumber: {name: 'houseNumber', type: 'integer', description: 'House number'},
  attachments: {name: 'attachments', type: 'array', description: 'Uploaded attachments'},
} as const;

/** Every field type the seeded schema exercises. */
export const SEED_FIELD_TYPES = ['string', 'integer', 'boolean', 'object', 'array'] as const;

/** Schema typed into the editor by the edit test. */
export function buildEditedSchema(key: string) {
  return {
    $id: `${key}.schema`,
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
      [EDITED_FIELD.name]: {type: EDITED_FIELD.type, description: EDITED_FIELD.description},
    },
  };
}

export const EDITED_FIELD = {
  name: 'editedField',
  type: 'string',
  description: 'Field added by the e2e document test',
} as const;

/** Not valid JSON — used to check the editor refuses to save it. */
export const INVALID_SCHEMA_TEXT = '{"type": ';

export const SEARCH_TERMS = {
  /** Appears once in the schema. */
  singleMatch: 'applicantAge',
  singleMatchCount: '1/1',
  /** Appears as a property name and inside its description. */
  multipleMatches: 'street',
  multipleMatchesCount: '1/2',
  noMatch: 'zzz-not-a-field',
  noMatchCount: '0',
} as const;

export const DOCUMENT_TEXTS = {
  saveConfirmation:
    'Are you sure you want to save? Removing or changing an attribute can be breaking.',
  requiredFieldsPanelTitle: 'Required fields',
  rootObjectLevel: 'Root level',
} as const;
