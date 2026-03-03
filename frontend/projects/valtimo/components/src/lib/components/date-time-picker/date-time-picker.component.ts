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
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
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

  @Input() set defaultDate(value: string | null) {
    const dateTimeValue = value ?? '';
    const {date, time} = this.splitDateTime(dateTimeValue);
    this.dateValue$.next(date);
    this.timeValue$.next(time);
  }

  @Input() defaultDateIsToday = false;
  @Input() clear$!: Observable<null>;

  @Output() valueChange = new EventEmitter<string>();

  public readonly dateValue$ = new BehaviorSubject<string>('');
  public readonly timeValue$ = new BehaviorSubject<string>('');

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
        const fullValue = this.enableTime && time ? `${date} ${time}` : date;
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

    const parts = trimmed.split(' ');
    if (parts.length >= 2) {
      return {date: parts[0] ?? '', time: parts.slice(1).join(' ') ?? ''};
    }
    return {date: trimmed, time: ''};
  }

  private normalizeDate(date: unknown): string {
    if (typeof date === 'string') return date;
    if (date instanceof Date) return this.formatDate(date);
    return '';
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('nl-NL');
  }
}
