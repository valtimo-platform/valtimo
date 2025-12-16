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

import {AfterViewInit, Component, EventEmitter, HostBinding, Input, Output} from '@angular/core';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';

@Component({
  selector: 'valtimo-date-time-picker',
  templateUrl: './date-time-picker.component.html',
  styleUrls: ['./date-time-picker.component.scss'],
  standalone: false,
})
export class DateTimePickerComponent implements AfterViewInit {
  @HostBinding('class.full-width') fullWidthClass = false;

  @Input() name = '';
  @Input() title = '';
  @Input() placeholder = '';
  @Input() titleTranslationKey = '';
  @Input() margin = false;
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

  @Input() set fullWidth(value: boolean) {
    this.fullWidthClass = value;
  }

  @Input() set defaultDate(value: string | null) {
    if (value) this.dateValue$.next(value);
  }

  @Input() defaultDateIsToday = false;
  @Input() clear$!: Observable<null>;

  @Output() valueChange = new EventEmitter<string>();

  public readonly dateValue$ = new BehaviorSubject<string>('');
  private _timeValue = '';

  private readonly _subscriptions = new Subscription();

  constructor() {}

  public ngAfterViewInit(): void {
    if (this.defaultDateIsToday) {
      this.dateValue$.next(this.formatDate(new Date()));
    }

    if (this.clear$) {
      this._subscriptions.add(
        this.clear$.subscribe(() => {
          this.dateValue$.next('');
          this._timeValue = '';
          this.valueChange.emit('');
        })
      );
    }

    this._subscriptions.add(this.dateValue$.subscribe(val => this.emitValue(val, this._timeValue)));
  }

  public onDateSelected(value: string | Date[]): void {
    const formatted = Array.isArray(value) ? value[0] : value;
    this.dateValue$.next(this.normalizeDate(formatted));
  }

  public onTimeSelected(value: string): void {
    this._timeValue = value;
    this.emitValue(this.dateValue$.getValue(), value);
  }

  public get timeValue(): string {
    return this._timeValue;
  }

  private emitValue(date: string, time: string): void {
    if (!date) {
      this.valueChange.emit('');
      return;
    }

    const full = this.enableTime && time ? `${date} ${time}` : date;

    this.valueChange.emit(full);
  }

  private normalizeDate(date: any): string {
    if (typeof date === 'string') return date;
    if (date instanceof Date) return this.formatDate(date);
    return '';
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('nl-NL');
  }
}
