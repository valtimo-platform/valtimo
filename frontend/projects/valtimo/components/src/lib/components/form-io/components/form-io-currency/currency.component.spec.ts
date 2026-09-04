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

import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {ReactiveFormsModule} from '@angular/forms';
import {FormIoCurrencyComponent} from './currency.component';

describe('FormIoCurrencyComponent', () => {
  let component: FormIoCurrencyComponent;
  let fixture: ComponentFixture<FormIoCurrencyComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [FormIoCurrencyComponent],
      imports: [ReactiveFormsModule],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FormIoCurrencyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  // The formatter separates the symbol with a non-breaking space, which is not what these assert on.
  const renderedValue = (): string =>
    (component.currencyForm.value.currencyValue ?? '').replace(/\s/g, ' ');

  const emittedValues = (): Array<number> => {
    const values: Array<number> = [];
    component.valueChange.subscribe(value => values.push(value));
    return values;
  };

  const applyInputs = (value?: number): void => {
    fixture.componentRef.setInput('currencyLocale', 'nl-NL');
    fixture.componentRef.setInput('currencyCurrency', 'EUR');

    if (value !== undefined) {
      fixture.componentRef.setInput('value', value);
    }

    fixture.detectChanges();
  };

  describe('a default value rendered once the currency inputs arrive', () => {
    it('should render a whole amount in full', () => {
      applyInputs(100);

      expect(renderedValue()).toBe('€ 100,00');
    });

    it('should render a small whole amount in full', () => {
      applyInputs(10);

      expect(renderedValue()).toBe('€ 10,00');
    });

    it('should render an amount that already has decimals unchanged', () => {
      applyInputs(1234.56);

      expect(renderedValue()).toBe('€ 1.234,56');
    });

    it('should not write the amount back to the model as a smaller number', () => {
      const values = emittedValues();

      applyInputs(100);

      expect(values.pop()).toBe(100);
    });

    it('should render an empty input when there is no value', () => {
      applyInputs();

      expect(renderedValue()).toBe('');
    });
  });

  describe('a default value rendered by the value input alone', () => {
    it('should render a whole amount in full', () => {
      fixture.componentRef.setInput('value', 100);

      expect(renderedValue()).toBe('€ 100,00');
    });
  });
});
