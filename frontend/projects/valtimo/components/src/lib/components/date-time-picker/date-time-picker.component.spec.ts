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

import {TranslateService} from '@ngx-translate/core';
import {MockTranslateService} from '@valtimo/shared';
import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {Subject, take} from 'rxjs';
import {DateTimePickerComponent} from './date-time-picker.component';

describe('DateTimePickerComponent', () => {
  let component: DateTimePickerComponent;
  let fixture: ComponentFixture<DateTimePickerComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DateTimePickerComponent],
      providers: [{provide: TranslateService, useClass: MockTranslateService}],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DateTimePickerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  const emittedValues = (): Array<string> => {
    const values: Array<string> = [];
    component.valueChange.subscribe(value => values.push(value));
    return values;
  };

  describe('emitted value with the default valueFormat', () => {
    beforeEach(() => {
      component.ngAfterViewInit();
    });

    it('should emit a selected date in the localised format', () => {
      const values = emittedValues();

      component.onDateSelected([new Date(2012, 2, 12)]);

      expect(values.pop()).toBe('12-3-2012');
    });

    it('should emit a selected date and time in the localised format', () => {
      component.enableTime = true;
      const values = emittedValues();

      component.onDateSelected([new Date(2012, 2, 12)]);
      component.onTimeSelected('09:30');

      expect(values.pop()).toBe('12-3-2012 09:30');
    });

    it('should emit an iso default date in the localised format', () => {
      const values = emittedValues();

      component.defaultDate = '2012-03-12';

      expect(values.pop()).toBe('12-3-2012');
    });

    it('should emit a day-first default date unchanged', () => {
      const values = emittedValues();

      component.defaultDate = '12-03-2012';

      expect(values.pop()).toBe('12-3-2012');
    });
  });

  describe('emitted value with valueFormat iso', () => {
    beforeEach(() => {
      component.valueFormat = 'iso';
      component.ngAfterViewInit();
    });

    it('should emit a selected date as yyyy-mm-dd', () => {
      const values = emittedValues();

      component.onDateSelected([new Date(2012, 2, 12)]);

      expect(values.pop()).toBe('2012-03-12');
    });

    it('should emit a selected date and time separated by a space', () => {
      component.enableTime = true;
      const values = emittedValues();

      component.onDateSelected([new Date(2012, 2, 12)]);
      component.onTimeSelected('09:30');

      expect(values.pop()).toBe('2012-03-12 09:30');
    });

    it('should emit an empty value when no date is selected', () => {
      const values = emittedValues();

      component.onDateSelected([]);

      expect(values.pop()).toBe('');
    });

    it('should emit a day-first default date as yyyy-mm-dd', () => {
      const values = emittedValues();

      component.defaultDate = '12-03-2012';

      expect(values.pop()).toBe('2012-03-12');
    });

    it('should keep an iso default date unchanged', () => {
      const values = emittedValues();

      component.defaultDate = '2012-03-12';

      expect(values.pop()).toBe('2012-03-12');
    });

    it('should split a default date and time', () => {
      component.enableTime = true;
      const values = emittedValues();

      component.defaultDate = '2012-03-12 09:30';

      expect(values.pop()).toBe('2012-03-12 09:30');
    });

    it('should pass the date to the date picker as a date object', () => {
      let pickerDates: Array<Date> = [];

      component.defaultDate = '2012-03-12';
      component.pickerDates$.pipe(take(1)).subscribe(dates => (pickerDates = dates));

      expect(pickerDates.length).toBe(1);
      expect(pickerDates[0].getFullYear()).toBe(2012);
      expect(pickerDates[0].getMonth()).toBe(2);
      expect(pickerDates[0].getDate()).toBe(12);
    });
  });

  describe('rendered input', () => {
    const settle = (): Promise<void> =>
      new Promise(resolve =>
        setTimeout(() => {
          fixture.detectChanges();
          resolve();
        }, 100)
      );

    const renderedDate = (): string =>
      (fixture.nativeElement.querySelector('cds-date-picker input') as HTMLInputElement).value;

    it('should render an iso date in the default display format', async () => {
      component.defaultDate = '2012-03-12';
      fixture.detectChanges();
      await settle();

      expect(renderedDate()).toBe('12-03-2012');
    });

    it('should render a day-first date in the default display format', async () => {
      component.defaultDate = '12-03-2012';
      fixture.detectChanges();
      await settle();

      expect(renderedDate()).toBe('12-03-2012');
    });

    it('should render a date in the display format of an overridden dateFormat', async () => {
      component.dateFormat = 'Y-m-d';
      component.defaultDate = '2012-03-12';
      fixture.detectChanges();
      await settle();

      expect(renderedDate()).toBe('2012-03-12');
    });

    it('should empty the input when the picker is cleared', async () => {
      const clear$ = new Subject<null>();
      component.clear$ = clear$;
      component.defaultDate = '2012-03-12';
      fixture.detectChanges();
      await settle();
      expect(renderedDate()).toBe('12-03-2012');

      clear$.next(null);
      fixture.detectChanges();
      await settle();

      expect(renderedDate()).toBe('');
    });

    it('should render an iso date and time in the default display format', async () => {
      component.enableTime = true;
      component.defaultDate = '2012-03-12 09:30';
      fixture.detectChanges();
      await settle();

      expect(renderedDate()).toBe('12-03-2012');
      expect(
        (fixture.nativeElement.querySelector('cds-timepicker input') as HTMLInputElement).value
      ).toBe('09:30');
    });
  });
});
