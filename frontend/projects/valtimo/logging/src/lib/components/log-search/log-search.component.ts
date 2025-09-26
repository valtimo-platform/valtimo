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
import {CommonModule} from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import {FormArray, FormBuilder, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {TrashCan16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {CARBON_THEME, CdsThemeService, CurrentCarbonTheme} from '@valtimo/components';
import {
  ButtonModule,
  DatePicker,
  DatePickerModule,
  DropdownModule,
  IconModule,
  IconService,
  InputModule,
  ListItem,
  TimePickerModule,
} from 'carbon-components-angular';
import flatpickr from 'flatpickr';
import {debounceTime, map, Observable, Subscription} from 'rxjs';
import {
  LoggingEventProperty,
  LoggingEventSearchFormValue,
  LoggingEventSearchRequest,
  LogLevel,
} from '../../models';

@Component({
  selector: 'valtimo-log-search',
  templateUrl: './log-search.component.html',
  styleUrl: './log-search.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    DropdownModule,
    IconModule,
    InputModule,
    ReactiveFormsModule,
    FormsModule,
    DatePickerModule,
    TimePickerModule,
  ],
})
export class LogSearchComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('afterTimestamp') private readonly _afterTimestampDatePicker: DatePicker;
  @ViewChild('beforeTimestamp') private readonly _beforeTimestampDatePicker: DatePicker;

  @Input() public initSearchRequest: LoggingEventSearchRequest;
  @Output() public readonly searchSubmitEvent = new EventEmitter<LoggingEventSearchRequest>();

  public readonly theme$: Observable<CARBON_THEME> = this.cdsThemeService.currentTheme$.pipe(
    map((theme: CurrentCarbonTheme) =>
      theme === CurrentCarbonTheme.G10 ? CARBON_THEME.WHITE : CARBON_THEME.G100
    )
  );

  public readonly formGroup = this.fb.group({
    likeFormattedMessage: this.fb.control<string>(''),
    level: this.fb.control<ListItem>({content: '', selected: false}),
    beforeTimestamp: this.fb.control<string>(''),
    beforeTime: this.fb.control<string>(''),
    afterTimestamp: this.fb.control<string>(''),
    afterTime: this.fb.control<string>(''),
    properties: this.fb.array([
      this.fb.group({
        key: this.fb.control<string>(''),
        value: this.fb.control<string>(''),
      }),
    ]),
  });

  public logLevelItems: Partial<ListItem>[] = [
    {
      content: LogLevel.ERROR,
    },
    {
      content: LogLevel.WARN,
    },
    {
      content: LogLevel.INFO,
    },
    {
      content: LogLevel.DEBUG,
    },
    {
      content: LogLevel.TRACE,
    },
  ];

  private readonly _subscriptions = new Subscription();

  public get propertiesArray(): FormArray {
    return this.formGroup.get('properties') as FormArray;
  }

  constructor(
    private readonly cdsThemeService: CdsThemeService,
    private readonly fb: FormBuilder,
    private readonly iconService: IconService
  ) {
    this.iconService.register(TrashCan16);
  }

  public ngOnInit(): void {
    this.setInitialForm();

    this._subscriptions.add(
      this.formGroup.valueChanges.pipe(debounceTime(500)).subscribe(() => {
        this.searchSubmitEvent.emit(this.mapFormValueToLogSearch());
      })
    );
  }

  public ngAfterViewInit(): void {
    const afterTimestampControlValue = this.formGroup.get('afterTimestamp')?.value;
    const beforeTimestampControlValue = this.formGroup.get('beforeTimestamp')?.value;

    if (!!afterTimestampControlValue) {
      this._afterTimestampDatePicker.writeValue([
        flatpickr.formatDate(new Date(afterTimestampControlValue), 'd-m-Y'),
      ]);
    }

    if (!!beforeTimestampControlValue) {
      this._beforeTimestampDatePicker.writeValue([
        flatpickr.formatDate(new Date(beforeTimestampControlValue), 'd-m-Y'),
      ]);
    }
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onClearFilter(): void {
    this.formGroup.reset();
    this._afterTimestampDatePicker.writeValue([]);
    this._beforeTimestampDatePicker.writeValue([]);
  }

  public onDateSelected(control: 'afterTimestamp' | 'beforeTimestamp', event: Date[]): void {
    this.formGroup.get(control)?.patchValue(flatpickr.formatDate(event[0], 'Z'));
  }

  public addPropertySearchField(): void {
    this.propertiesArray.push(
      this.fb.group({
        key: this.fb.control<string>(''),
        value: this.fb.control<string>(''),
      })
    );
  }

  public removePropertySearchField(index: number): void {
    this.propertiesArray.removeAt(index);
  }

  private initLogItems(formValue: LoggingEventSearchFormValue): void {
    if (!formValue.level) return;

    this.logLevelItems = this.logLevelItems.map((levelItem: Partial<ListItem>) => ({
      ...levelItem,
      selected: formValue.level?.content === levelItem.content,
    }));
  }

  private initPropertiesForm(formValue: LoggingEventSearchFormValue): void {
    if (!formValue.properties) return;

    for (let i = 1; i < formValue.properties.length; i++) {
      this.addPropertySearchField();
    }
  }

  private initTimeForm(formValue: LoggingEventSearchFormValue): void {
    const {beforeTimestamp, afterTimestamp} = formValue;

    if (!!beforeTimestamp) {
      const {hours, minutes} = this.convertTimestampToTimeString(beforeTimestamp);
      this.formGroup.patchValue({beforeTime: `${hours}:${minutes}`}, {emitEvent: false});
    }

    if (!!afterTimestamp) {
      const {hours, minutes} = this.convertTimestampToTimeString(afterTimestamp);
      this.formGroup.patchValue({afterTime: `${hours}:${minutes}`}, {emitEvent: false});
    }
  }

  private convertTimestampToTimeString(timestamp: string): {hours: string; minutes: string} {
    const date = new Date(timestamp);
    return {
      hours: `0${date.getHours()}`.slice(-2),
      minutes: `0${date.getMinutes()}`.slice(-2),
    };
  }

  private mapFormValueToLogSearch(): LoggingEventSearchRequest {
    const formValue = this.formGroup.getRawValue();
    const properties = formValue.properties.filter(
      (property: {key: string | null; value: string | null}) => !!property.key && !!property.value
    ) as LoggingEventProperty[];

    return {
      ...(!!formValue.likeFormattedMessage && {
        likeFormattedMessage: formValue.likeFormattedMessage,
      }),
      ...(!!formValue.level?.content && {level: formValue.level.content}),
      ...(!!formValue.afterTimestamp && {
        afterTimestamp: this.mapTimeStamps(formValue.afterTimestamp, formValue.afterTime),
      }),
      ...(!!formValue.beforeTimestamp && {
        beforeTimestamp: this.mapTimeStamps(formValue.beforeTimestamp, formValue.beforeTime),
      }),
      ...(!!properties.length && {properties}),
    };
  }

  private mapSearchRequestToFormValue(
    searchRequest: LoggingEventSearchRequest
  ): LoggingEventSearchFormValue {
    return {
      ...(searchRequest.likeFormattedMessage && {
        likeFormattedMessage: searchRequest.likeFormattedMessage,
      }),
      ...(searchRequest.level && {
        level: {
          content: searchRequest.level,
          selected: true,
        },
      }),
      ...(searchRequest.afterTimestamp && {afterTimestamp: searchRequest.afterTimestamp}),
      ...(searchRequest.beforeTimestamp && {beforeTimestamp: searchRequest.beforeTimestamp}),
      ...(searchRequest.properties && {properties: searchRequest.properties}),
    };
  }

  private mapTimeStamps(date: string, time: string | null): string {
    if (!time) return date;

    const timeValue: string[] = time.split(':');
    const dateObject = new Date(date);
    dateObject.setHours(+timeValue[0], +timeValue[1]);

    return flatpickr.formatDate(dateObject, 'Z');
  }

  private setInitialForm(): void {
    const mappedFormValue: LoggingEventSearchFormValue = this.mapSearchRequestToFormValue(
      this.initSearchRequest
    );
    this.initLogItems(mappedFormValue);
    this.initPropertiesForm(mappedFormValue);
    this.initTimeForm(mappedFormValue);

    this.formGroup.patchValue(mappedFormValue, {emitEvent: false});
  }
}
