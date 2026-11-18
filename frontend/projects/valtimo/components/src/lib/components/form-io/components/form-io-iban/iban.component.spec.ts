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

import {fakeAsync, flush} from '@angular/core/testing';
import {FormIoIbanComponent} from './iban.component';

describe('FormIoIbanComponent', () => {
  let component: FormIoIbanComponent;
  let emitted: Array<string>;

  beforeEach(fakeAsync(() => {
    component = new FormIoIbanComponent();
    emitted = [];
    component.valueChange.subscribe(value => emitted.push(value));
    component.value = 'NL91ABNA0417164300';
    component.ngAfterViewInit();
    flush();
  }));

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should show a value set after init without emitting it', () => {
    component.value = 'NL20INGB0001234567';

    expect(component.ibanForm.controls.iban.value).toBe('NL20INGB0001234567');
    expect(component.value).toBe('NL20INGB0001234567');
    expect(emitted).toEqual([]);
  });

  it('should clear the input when the value is set to null', () => {
    component.value = null;

    expect(component.ibanForm.controls.iban.value).toBeNull();
    expect(emitted).toEqual([]);
  });

  it('should emit and expose the value the user enters', () => {
    component.ibanForm.controls.iban.setValue('NL20INGB0001234567');

    expect(emitted).toEqual(['NL20INGB0001234567']);
    expect(component.value).toBe('NL20INGB0001234567');
  });
});
