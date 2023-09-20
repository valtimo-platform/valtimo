/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import flatpickr from 'flatpickr';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';
import {key as LocaleKey} from 'flatpickr/dist/types/locale';
import {Dutch} from 'flatpickr/dist/l10n/nl';
import {German} from 'flatpickr/dist/l10n/de';
import {english} from 'flatpickr/dist/l10n/default';
import Locale = flatpickr.Locale;
import CustomLocale = flatpickr.CustomLocale;

/**
 * @deprecated Migrate old design to Carbon
 */
@Component({
  selector: 'v-date-picker',
  templateUrl: './date-picker.component.html',
  styleUrls: ['./date-picker.component.scss'],
})
export class DatePickerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('datePickerElement') datePickerElement!: ElementRef<HTMLInputElement>;

  @Input() name = '';
  @Input() title = '';
  @Input() titleTranslationKey = '';
  @Input() widthPx!: number;
  @Input() fullWidth = false;
  @Input() margin = false;
  @Input() disabled = false;
  @Input() tooltip = '';
  @Input() required = false;
  @Input() defaultDate!: string;
  @Input() defaultDateIsToday!: boolean;
  @Input() smallLabel = false;
  @Input() clear$!: Observable<null>;
  @Input() enableTime = false;

  @Output() valueChange: EventEmitter<any> = new EventEmitter();

  dateValue$ = new BehaviorSubject<string>('');

  private flatpickrInstance!: flatpickr.Instance;
  private localeSubscription!: Subscription;
  private dateValueSubscription!: Subscription;
  private clearSubscription!: Subscription;

  constructor(private readonly translateService: TranslateService) {}

  ngAfterViewInit(): void {
    this.openLocaleSubscription();
    this.openDateValueSubscription();
    this.openClearSubscription();
  }

  ngOnDestroy(): void {
    this.localeSubscription?.unsubscribe();
    this.dateValueSubscription?.unsubscribe();
    this.clearSubscription?.unsubscribe();
  }

  private openLocaleSubscription(): void {
    this.localeSubscription = this.translateService.stream('key').subscribe(() => {
      this.setFlatpickrInstance(this.translateService.currentLang as LocaleKey);
    });
  }

  private openDateValueSubscription(): void {
    this.dateValueSubscription = this.dateValue$.subscribe(dateValue => {
      this.valueChange.emit(dateValue);
    });
  }

  private setFlatpickrInstance(localeKey: LocaleKey): void {
    this.flatpickrInstance?.destroy();
    this.flatpickrInstance = flatpickr(this.datePickerElement.nativeElement, {
      locale: this.getLocale(localeKey),
      onChange: [this.onChange],
      defaultDate: this.getFlatpickrValue(),
      enableTime: this.enableTime,
    });
    this.emitDate();
  }

  private onChange = (
    selectedDates: Array<Date>,
    dateStr: string,
    instance: flatpickr.Instance
  ): void => {
    this.dateValue$.next(dateStr);
  };

  private emitDate(): void {
    const currentDate = this.flatpickrInstance.selectedDates[0];
    const formattedDate = currentDate && this.flatpickrInstance.formatDate(currentDate, 'Y-m-d');
    if (formattedDate) {
      this.dateValue$.next(formattedDate);
    }
  }

  private getFlatpickrValue(): string | Date {
    const savedValue = this.dateValue$.getValue();
    const todayDate = this.defaultDateIsToday && new Date();
    const defaultDate = this.defaultDate;
    return todayDate || defaultDate || savedValue;
  }

  private getLocale(localeKey: LocaleKey): Locale | CustomLocale {
    let locale!: Locale | CustomLocale;

    switch (localeKey) {
      case 'nl':
        locale = Dutch;
        break;
      case 'de':
        locale = German;
        break;
      case 'en':
        locale = english;
        break;
      default:
        locale = english;
        break;
    }

    return locale;
  }

  private openClearSubscription(): void {
    if (this.clear$) {
      this.clearSubscription = this.clear$.subscribe(() => {
        this.dateValue$.next('');
      });
    }
  }
}
