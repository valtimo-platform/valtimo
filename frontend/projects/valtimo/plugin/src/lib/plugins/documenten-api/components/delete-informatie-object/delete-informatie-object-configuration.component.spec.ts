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

import {Observable, of, Subject, throwError} from 'rxjs';
import {DeleteInformatieObjectConfig} from '../../models';
import {DocumentenApiService} from '../../services';
import {DeleteInformatieObjectConfigurationComponent} from './delete-informatie-object-configuration.component';

describe('DeleteInformatieObjectConfigurationComponent', () => {
  let component: DeleteInformatieObjectConfigurationComponent;
  let save$: Subject<void>;
  let validEmissions: boolean[];
  let emittedConfigurations: DeleteInformatieObjectConfig[];

  const createComponent = (prefixes$: Observable<string[]>): void => {
    save$ = new Subject<void>();
    validEmissions = [];
    emittedConfigurations = [];

    component = new DeleteInformatieObjectConfigurationComponent(
      jasmine.createSpyObj<DocumentenApiService>('DocumentenApiService', {
        getValueResolverPrefixes: prefixes$,
      })
    );
    component.save$ = save$;
    component.valid.subscribe(valid => validEmissions.push(valid));
    component.configuration.subscribe(configuration => emittedConfigurations.push(configuration));
    component.ngOnInit();
  };

  const submit = (documentUrl: string): void => {
    component.formValueChange({documentUrl});
    save$.next();
  };

  afterEach(() => {
    component.ngOnDestroy();
  });

  describe('with registered resolver prefixes', () => {
    beforeEach(() => createComponent(of(['pv', 'doc'])));

    it('should save a resolver expression', () => {
      submit('pv:documentUrl');

      expect(validEmissions).toEqual([true]);
      expect(emittedConfigurations).toEqual([{documentUrl: 'pv:documentUrl'}]);
    });

    it('should save an absolute URL', () => {
      const documentUrl =
        'https://openzaak.example.com/documenten/api/v1/enkelvoudiginformatieobjecten/1';

      submit(documentUrl);

      expect(validEmissions).toEqual([true]);
      expect(emittedConfigurations).toEqual([{documentUrl}]);
    });

    it('should not save a value that is not a URL', () => {
      submit('not-a-url');

      expect(validEmissions).toEqual([false]);
      expect(emittedConfigurations).toEqual([]);
    });

    it('should not save a resolver expression without a path', () => {
      submit('pv:');

      expect(validEmissions).toEqual([false]);
      expect(emittedConfigurations).toEqual([]);
    });
  });

  describe('when resolver prefixes cannot be loaded', () => {
    beforeEach(() => createComponent(throwError(() => new Error('Request failed'))));

    it('should still save an absolute URL', () => {
      submit('https://example.com/documenten/api/v1/enkelvoudiginformatieobjecten/1');

      expect(emittedConfigurations.length).toBe(1);
    });

    it('should not save a resolver expression', () => {
      submit('pv:documentUrl');

      expect(validEmissions).toEqual([false]);
      expect(emittedConfigurations).toEqual([]);
    });
  });

  describe('while resolver prefixes are loading', () => {
    let prefixes$: Subject<string[]>;

    beforeEach(() => {
      prefixes$ = new Subject<string[]>();
      createComponent(prefixes$);
    });

    it('should report invalid until prefixes arrive, then re-validate', () => {
      component.formValueChange({documentUrl: 'pv:documentUrl'});
      expect(validEmissions).toEqual([false]);

      prefixes$.next(['pv']);
      expect(validEmissions).toEqual([false, true]);
    });

    it('should not save before prefixes arrive', () => {
      submit('pv:documentUrl');

      expect(emittedConfigurations).toEqual([]);
    });
  });
});
