/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import {CommonModule} from '@angular/common';
import {
  AfterViewInit,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {
  DatePickerModule,
  InputModule,
  LayerModule,
  TimePickerModule,
} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable, Subscription} from 'rxjs';
import {InputLabelModule} from '../input-label/input-label.module';

@Component({
  selector: 'valtimo-date-time-picker',
  templateUrl: './date-time-picker.component.html',
  styleUrls: ['./date-time-picker.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    InputLabelModule,
    FormsModule,
    TranslateModule,
    InputModule,
    DatePickerModule,
    TimePickerModule,
    LayerModule,
  ],
})
export class DateTimePickerComponent implements AfterViewInit, OnDestroy {
  @HostBinding('class.valtimo-date-time-picker')
  readonly hostClass = true;

  @Input()
  @HostBinding('class.full-width')
  fullWidth = false;

  @Input()
  @HostBinding('class.margin')
  margin = false;

  @Input() name = '';
  @Input() title = '';
  @Input() placeholder = '';
  @Input() titleTranslationKey = '';
  @Input() disabled = false;
  @Input() tooltip = '';
  @Input() required = false;
  @Input() smallLabel = false;
  @Input() enableTime = false;
  @Input() carbonTheme = 'white';
  @Input() dateFormat = 'd-m-Y';
  @Input() showFieldLabel = true;
  @Input() datePlaceholder = 'dd-mm-yyyy';
  @Input() timePlaceholder = 'hh:mm';
  @Input() labelText = '';

  /**
   * Format of the emitted value. Use `iso` when the value is passed on to an API. Defaults to the
   * localised format the input shows, which is what existing consumers expect.
   */
  @Input() valueFormat: 'display' | 'iso' = 'display';

  @Input() set defaultDate(value: string | null) {
    const dateTimeValue = value ?? '';
    const {date, time} = this.splitDateTime(dateTimeValue);
    this.dateValue$.next(date);
    this.timeValue$.next(time);
  }

  @Input() defaultDateIsToday = false;
  @Input() clear$!: Observable<null>;

  @Output() valueChange = new EventEmitter<string>();

  /** Holds the date as `yyyy-mm-dd`, independent of how `dateFormat` renders it. */
  public readonly dateValue$ = new BehaviorSubject<string>('');
  public readonly timeValue$ = new BehaviorSubject<string>('');

  /** The Carbon date picker parses strings with `dateFormat`, so it is fed a date object instead. */
  public readonly pickerDates$: Observable<Array<Date>> = this.dateValue$.pipe(
    map(date => (date ? [new Date(`${date}T00:00:00`)] : []))
  );

  private readonly ISO_DATE_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  private readonly DAY_FIRST_DATE_PATTERN = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;

  private readonly subscriptions = new Subscription();

  public ngAfterViewInit(): void {
    if (this.defaultDateIsToday) {
      this.dateValue$.next(this.formatDate(new Date()));
    }

    if (this.clear$) {
      this.subscriptions.add(
        this.clear$.subscribe(() => {
          this.dateValue$.next('');
          this.timeValue$.next('');
          this.valueChange.emit('');
        })
      );
    }

    this.subscriptions.add(
      combineLatest([this.dateValue$, this.timeValue$]).subscribe(([date, time]) => {
        if (!date) {
          this.valueChange.emit('');
          return;
        }
        const emittedDate = this.valueFormat === 'iso' ? date : this.formatDisplayDate(date);
        const fullValue = this.enableTime && time ? `${emittedDate} ${time}` : emittedDate;
        this.valueChange.emit(fullValue);
      })
    );
  }

  public ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  public onDateSelected(value: string | Date[]): void {
    const formatted = Array.isArray(value) ? value[0] : value;
    this.dateValue$.next(this.normalizeDate(formatted));
  }

  public onTimeSelected(value: any): void {
    this.timeValue$.next(this.normalizeTime(value));
  }

  private normalizeTime(value: any): string {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      if (typeof value.value === 'string') return value.value;
      if (typeof value.target?.value === 'string') return value.target.value;
    }
    return '';
  }

  private splitDateTime(value: string): {date: string; time: string} {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return {date: '', time: ''};

    const parts = trimmed.split(/[ T]/);
    if (parts.length >= 2) {
      return {date: this.normalizeDate(parts[0]), time: parts.slice(1).join(' ') ?? ''};
    }
    return {date: this.normalizeDate(trimmed), time: ''};
  }

  private normalizeDate(date: unknown): string {
    if (date instanceof Date) return this.formatDate(date);
    if (typeof date !== 'string') return '';

    const trimmed = date.trim();
    const isoMatch = this.ISO_DATE_PATTERN.exec(trimmed);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return this.joinDate(year, month, day);
    }

    const dayFirstMatch = this.DAY_FIRST_DATE_PATTERN.exec(trimmed);
    if (dayFirstMatch) {
      const [, day, month, year] = dayFirstMatch;
      return this.joinDate(year, month, day);
    }

    return '';
  }

  private formatDate(date: Date): string {
    return this.joinDate(`${date.getFullYear()}`, `${date.getMonth() + 1}`, `${date.getDate()}`);
  }

  private formatDisplayDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('nl-NL');
  }

  private joinDate(year: string, month: string, day: string): string {
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
}
