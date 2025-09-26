/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
  HostBinding,
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
  @HostBinding('class.full-width') fullWidthClass = false;

  @ViewChild('datePickerElement') datePickerElement!: ElementRef<HTMLInputElement>;

  @Input() public name = '';
  @Input() public title = '';
  @Input() public titleTranslationKey = '';
  @Input() public widthPx!: number;
  @Input() public set fullWidth(value: boolean) {
    this.fullWidthClass = value;
  }
  @Input() public margin = false;
  @Input() public disabled = false;
  @Input() public tooltip = '';
  @Input() public required = false;
  @Input() public defaultDate!: string;
  @Input() public defaultDateIsToday!: boolean;
  @Input() public smallLabel = false;
  @Input() public clear$!: Observable<null>;
  @Input() public enableTime = false;
  @Input() public carbonTheme = 'g10';

  @Output() public valueChange: EventEmitter<any> = new EventEmitter();

  public readonly dateValue$ = new BehaviorSubject<string>('');

  private _flatpickrInstance!: flatpickr.Instance;
  private readonly _subscriptions = new Subscription();

  constructor(private readonly translateService: TranslateService) {}

  public ngAfterViewInit(): void {
    this.openLocaleSubscription();
    this.openDateValueSubscription();
    this.openClearSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private openLocaleSubscription(): void {
    this._subscriptions.add(
      this.translateService.stream('key').subscribe(() => {
        this.setFlatpickrInstance(this.translateService.currentLang as LocaleKey);
      })
    );
  }

  private openDateValueSubscription(): void {
    this._subscriptions.add(
      this.dateValue$.subscribe(dateValue => {
        this.valueChange.emit(dateValue);
      })
    );
  }

  private setFlatpickrInstance(localeKey: LocaleKey): void {
    this._flatpickrInstance?.destroy();
    this._flatpickrInstance = flatpickr(this.datePickerElement.nativeElement, {
      locale: this.getLocale(localeKey),
      onChange: [this.onChange],
      defaultDate: this.getFlatpickrValue(),
      enableTime: this.enableTime,
    });
    this.emitDate();
  }

  private onChange = (selectedDates: Array<Date>, dateStr: string): void => {
    this.dateValue$.next(dateStr);
  };

  private emitDate(): void {
    const currentDate = this._flatpickrInstance.selectedDates[0];
    const formattedDate = currentDate && this._flatpickrInstance.formatDate(currentDate, 'Y-m-d');
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
      this._subscriptions.add(
        this.clear$.subscribe(() => {
          this.dateValue$.next('');
        })
      );
    }
  }
}
