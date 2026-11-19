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

import {isValidDocumentReference} from './document-reference.utils';

describe('isValidDocumentReference', () => {
  const RESOLVER_PREFIXES = ['pv', 'doc', 'case', 'zaak'];

  describe('resolver expressions', () => {
    it('should accept a registered prefix with a path', () => {
      expect(isValidDocumentReference('pv:documentUrl', RESOLVER_PREFIXES)).toBeTrue();
    });

    it('should accept registered prefixes other than pv', () => {
      expect(isValidDocumentReference('doc:documents/0/url', RESOLVER_PREFIXES)).toBeTrue();
      expect(isValidDocumentReference('case:documentUrl', RESOLVER_PREFIXES)).toBeTrue();
    });

    it('should reject a registered prefix with an empty path', () => {
      expect(isValidDocumentReference('pv:', RESOLVER_PREFIXES)).toBeFalse();
      expect(isValidDocumentReference('doc:   ', RESOLVER_PREFIXES)).toBeFalse();
    });

    it('should reject an unregistered prefix', () => {
      expect(isValidDocumentReference('unknown:documentUrl', RESOLVER_PREFIXES)).toBeFalse();
    });

    it('should reject expressions when no prefixes are registered', () => {
      expect(isValidDocumentReference('pv:documentUrl', [])).toBeFalse();
    });
  });

  describe('literal values', () => {
    it('should accept absolute HTTP(S) URLs', () => {
      expect(
        isValidDocumentReference(
          'https://openzaak.example.com/documenten/api/v1/enkelvoudiginformatieobjecten/123',
          RESOLVER_PREFIXES
        )
      ).toBeTrue();
      expect(
        isValidDocumentReference('http://localhost:8001/documenten/api/v1/x', RESOLVER_PREFIXES)
      ).toBeTrue();
    });

    it('should accept absolute HTTP(S) URLs when no prefixes are registered', () => {
      expect(isValidDocumentReference('https://example.com/doc/1', [])).toBeTrue();
    });

    it('should reject values that are not URLs', () => {
      expect(isValidDocumentReference('not-a-url', RESOLVER_PREFIXES)).toBeFalse();
      expect(isValidDocumentReference('/relative/path', RESOLVER_PREFIXES)).toBeFalse();
    });

    it('should reject non-HTTP(S) URLs', () => {
      expect(isValidDocumentReference('ftp://example.com/doc', RESOLVER_PREFIXES)).toBeFalse();
      expect(isValidDocumentReference('javascript:alert(1)', RESOLVER_PREFIXES)).toBeFalse();
    });

    it('should reject an HTTP(S) URL without a host', () => {
      expect(isValidDocumentReference('http://', RESOLVER_PREFIXES)).toBeFalse();
    });
  });

  it('should reject empty values', () => {
    expect(isValidDocumentReference('', RESOLVER_PREFIXES)).toBeFalse();
    expect(isValidDocumentReference('   ', RESOLVER_PREFIXES)).toBeFalse();
    expect(isValidDocumentReference(null, RESOLVER_PREFIXES)).toBeFalse();
    expect(isValidDocumentReference(undefined, RESOLVER_PREFIXES)).toBeFalse();
  });
});
