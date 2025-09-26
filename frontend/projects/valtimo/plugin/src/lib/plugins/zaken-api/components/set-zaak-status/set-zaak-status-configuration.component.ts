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
import {RadioValue, SelectItem} from '@valtimo/components';
import {map} from 'rxjs/operators';
import {ZakenApiService} from '../../services';
import {PluginTranslatePipe} from '../../../../pipes';
import {CaseManagementParams, ManagementContext} from '@valtimo/shared';

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
  readonly pluginId$ = new BehaviorSubject<string>('');
  readonly formValue$ = new BehaviorSubject<SetZaakStatusConfig | null>(null);
  readonly valid$ = new BehaviorSubject<boolean>(false);
  readonly statusTypeSelectItems$ = new BehaviorSubject<SelectItem[]>([]);

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

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly zakenApiService: ZakenApiService,
    private readonly pluginTranslatePipe: PluginTranslatePipe
  ) {}

  public ngOnInit(): void {
    this.initContextHandling();
    this.initSaveHandling();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public formValueChange(formValue: SetZaakStatusConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);

    if (formValue.inputTypeZaakStatusToggle) {
      this.selectedInputOption$.next(formValue.inputTypeZaakStatusToggle);
    }
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
            this.configuration.emit({
              statustoelichting: formValue.statustoelichting,
              statustypeUrl: formValue.statustypeUrl,
            });
          }
        });
    });

    this._subscriptions.add(saveSub);
  }

  private handleValid(formValue: SetZaakStatusConfig): void {
    const valid = !!formValue.statustypeUrl;
    this.valid$.next(valid);
    this.valid.emit(valid);
  }
}
