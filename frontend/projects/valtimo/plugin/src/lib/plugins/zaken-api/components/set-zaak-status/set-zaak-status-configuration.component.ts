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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {FunctionConfigurationComponent} from '../../../../models';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  Observable,
  Subject,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {InputOption, SetZaakStatusConfig} from '../../models';
import {
  CARBON_THEME,
  CdsThemeService,
  CurrentCarbonTheme,
  RadioValue,
  SelectItem,
} from '@valtimo/components';
import {map} from 'rxjs/operators';
import {ZakenApiService} from '../../services';
import {PluginTranslatePipe} from '../../../../pipes';
import {CaseManagementParams, ManagementContext} from '@valtimo/shared';
import flatpickr from 'flatpickr';

@Component({
  standalone: false,
  selector: 'valtimo-set-zaak-status-configuration',
  templateUrl: './set-zaak-status-configuration.component.html',
  styleUrls: ['./set-zaak-status-configuration.component.scss'],
  providers: [PluginTranslatePipe],
})
export class SetZaakStatusConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() set pluginId(value: string) {
    this.pluginId$.next(value);
  }
  @Input() prefillConfiguration$: Observable<SetZaakStatusConfig>;
  @Input() context$: Observable<[ManagementContext, CaseManagementParams]>;

  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<SetZaakStatusConfig> =
    new EventEmitter<SetZaakStatusConfig>();

  readonly clearStatusSelection$ = new Subject<void>();
  readonly loading$ = new BehaviorSubject<boolean>(true);
  readonly selectedInputOption$ = new BehaviorSubject<InputOption>('selection');
  readonly datumStatusGezetSelectedInputOption$ = new BehaviorSubject<string>('now');
  readonly pluginId$ = new BehaviorSubject<string>('');
  readonly formValue$ = new BehaviorSubject<SetZaakStatusConfig | null>(null);
  readonly valid$ = new BehaviorSubject<boolean>(false);
  readonly statusTypeSelectItems$ = new BehaviorSubject<SelectItem[]>([]);
  readonly datePickerInvalid$ = new BehaviorSubject<boolean>(false);

  readonly inputTypeOptions$: Observable<Array<RadioValue>> = this.pluginId$.pipe(
    filter(pluginId => !!pluginId),
    switchMap(pluginId =>
      combineLatest([
        this.pluginTranslatePipe.transform('selection', pluginId),
        this.pluginTranslatePipe.transform('text', pluginId),
      ])
    ),
    map(([selectionTranslation, textTranslation]) => [
      {value: 'selection', title: selectionTranslation},
      {value: 'text', title: textTranslation},
    ])
  );

  readonly datePickerInputTypeOptions$: Observable<Array<RadioValue>> = this.pluginId$.pipe(
    filter(pluginId => !!pluginId),
    switchMap(pluginId =>
      combineLatest([
        this.pluginTranslatePipe.transform('now', pluginId),
        this.pluginTranslatePipe.transform('selection', pluginId),
        this.pluginTranslatePipe.transform('text', pluginId),
      ])
    ),
    map(([nowTranslation, selectionTranslation, textTranslation]) => [
      {value: 'now', title: nowTranslation},
      {value: 'selection', title: selectionTranslation},
      {value: 'text', title: textTranslation},
    ])
  );

  public readonly theme$: Observable<CARBON_THEME> = this.cdsThemeService.currentTheme$.pipe(
    map((theme: CurrentCarbonTheme) =>
      theme === CurrentCarbonTheme.G10 ? CARBON_THEME.WHITE : CARBON_THEME.G100
    )
  );

  private readonly _subscriptions = new Subscription();

  public selectedDate: string | null = null;
  public selectedTime: string | null = null;

  constructor(
    private readonly zakenApiService: ZakenApiService,
    private readonly pluginTranslatePipe: PluginTranslatePipe,
    private readonly cdsThemeService: CdsThemeService
  ) {}

  public ngOnInit(): void {
    this.initContextHandling();
    this.initSaveHandling();
    this.prefillToday();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public formValueChange(formValue: SetZaakStatusConfig): void {
    const currentFormValue = this.formValue$.value ?? ({} as SetZaakStatusConfig);
    const updatedFormValue: SetZaakStatusConfig = {
      ...currentFormValue,
      ...formValue,
    };

    this.formValue$.next(updatedFormValue);
    this.handleValid(updatedFormValue);
    if (updatedFormValue.inputTypeZaakStatusToggle) {
      this.selectedInputOption$.next(updatedFormValue.inputTypeZaakStatusToggle);
    }
    if (updatedFormValue.inputDatumStatusGezetToggle) {
      this.datumStatusGezetSelectedInputOption$.next(updatedFormValue.inputDatumStatusGezetToggle);
    }
    if (updatedFormValue.inputDatumStatusGezetToggle === 'now') {
        this.selectedDate = null;
        this.selectedTime = null;
    }
  }

  public onDateSelected(event: Date[]): void {
    const date = Array.isArray(event) && event[0];
    if (!date) return;
    this.selectedDate = date.toISOString();
    this.updateDatumStatusGezet();
  }

  public onTimeSelected(event: string): void {
    this.selectedTime = event;
    this.updateDatumStatusGezet();
  }

  private updateDatumStatusGezet(): void {
    if (!this.selectedDate && !this.selectedTime) {
      return;
    }

    let hoursStr;
    let minutesStr;
    let secondsStr;
    try {
      [hoursStr, minutesStr = '00', secondsStr = '00'] = this.selectedTime.split(':');
    } catch (error) {
      [hoursStr, minutesStr = '00', secondsStr = '00'] = ['00', '00'];
    }
    const date = new Date(this.selectedDate);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hh = hoursStr.padStart(2, '0');
    const mm = minutesStr.padStart(2, '0');
    const ss = secondsStr.padStart(2, '0');

    const isoWithoutMs = `${year}-${month}-${day}T${hh}:${mm}:${ss}Z`;

    const currentFormValue = this.formValue$.value ?? ({} as SetZaakStatusConfig);
    const updatedFormValue: SetZaakStatusConfig = {
      ...currentFormValue,
      datumStatusGezet: isoWithoutMs,
    };

    this.formValueChange(updatedFormValue);
  }

  private prefillToday(): void {
    this._subscriptions.add(
      this.prefillConfiguration$.subscribe(config => {
        let baseDate;

        if (config?.datumStatusGezet !== null) {
          try {
            baseDate = flatpickr.formatDate(
              !!config?.datumStatusGezet ? new Date(config!.datumStatusGezet) : new Date(),
              'Z'
            );
            this.datumStatusGezetSelectedInputOption$.next('selection');
          } catch (error) {
            baseDate = config.datumStatusGezet;
            this.datumStatusGezetSelectedInputOption$.next('text');
          }
        } else {
          baseDate = null;
          this.datumStatusGezetSelectedInputOption$.next('now');
        }

        this.selectedDate = baseDate;
        this.selectedTime = this.formatTime(baseDate);
      })
    );

    this.updateDatumStatusGezet();
  }

  private formatTime(date: string): string {
    const [hours, minutes, seconds] = date.split('T')[1].split(':');
    return `${hours}:${minutes}:${seconds.split('.')[0]}`;
  }

  public oneSelectItem(selectItems: Array<SelectItem>): boolean {
    return Array.isArray(selectItems) && selectItems.length === 1;
  }

  private initContextHandling(): void {
    if (!this.context$) {
      return;
    }

    const contextSub = this.context$
      .pipe(
        filter(([context]) => {
          if (context === 'independent') {
            this.selectedInputOption$.next('text');
            this.loading$.next(false);
          }
          return context === 'case';
        }),
        switchMap(([_, params]) =>
          combineLatest([
            this.zakenApiService.getStatusTypesByCaseAndVersion(
              params.caseDefinitionKey,
              params.caseDefinitionVersionTag
            ),
            this.context$,
          ])
        ),
        tap(([statusTypeItems, params]) => {
          this.statusTypeSelectItems$.next(
            statusTypeItems.map(item => ({id: item.url, text: item.name}))
          );
          this.selectedInputOption$.next('selection');
          this.loading$.next(false);
        })
      )
      .subscribe();

    this._subscriptions.add(contextSub);
  }

  private initSaveHandling(): void {
    if (!this.save$) {
      return;
    }

    const saveSub = this.save$.subscribe(() => {
      combineLatest([this.formValue$, this.valid$])
        .pipe(take(1))
        .subscribe(([formValue, valid]) => {
          if (valid) {
            if (formValue.inputDatumStatusGezetToggle == 'now') {
              formValue.datumStatusGezet = null;
            }
            this.configuration.emit({
              statustoelichting: formValue.statustoelichting,
              statustypeUrl: formValue.statustypeUrl,
              datumStatusGezet: formValue.datumStatusGezet,
            });
          }
        });
    });

    this._subscriptions.add(saveSub);
  }

  private isValidDatumStatusGezet(value: string | null | undefined): boolean {
    if (['text', 'now'].includes(this.datumStatusGezetSelectedInputOption$.getValue())) {
      return true;
    }

    if (!value) {
      return false;
    }

    const trimmed = value.trim();

    // Required format: YYYY-MM-DDTHH:mm:ssZ
    const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

    if (!regex.test(trimmed)) {
      return false;
    }

    const date = new Date(trimmed);
    return !isNaN(date.getTime());
  }

  private isDateNotInFuture(value: string | null | undefined): boolean {
    if (['text', 'now'].includes(this.datumStatusGezetSelectedInputOption$.getValue())) {
      return true;
    }

    if (!value) {
      return false;
    }

    const date = new Date(value);
    const now = new Date();
    const isDateNotInFuture = date.getTime() <= now.getTime();

    this.datePickerInvalid$.next(!isDateNotInFuture);

    return isDateNotInFuture;
  }

  private hasEnteredDateText(value: string | null | undefined): boolean {
    if (this.datumStatusGezetSelectedInputOption$.getValue() !== 'text') {
      return true;
    }

    return !value === false;
  }

  private handleValid(formValue: SetZaakStatusConfig): void {
    const hasStatusType = !!formValue.statustypeUrl;
    const hasValidDatumStatusGezet = this.isValidDatumStatusGezet(formValue.datumStatusGezet);
    const dateIsNotInFuture = this.isDateNotInFuture(formValue.datumStatusGezet);
    const hasEnteredDateText = this.hasEnteredDateText(formValue.datumStatusGezet);

    const valid = hasStatusType && hasValidDatumStatusGezet && dateIsNotInFuture && hasEnteredDateText;

    this.valid$.next(valid);
    this.valid.emit(valid);
  }
}
