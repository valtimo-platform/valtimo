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
import {CreateZaakResultaatConfig, InputOption} from '../../models';
import {RadioValue, SelectItem} from '@valtimo/components';
import {map} from 'rxjs/operators';
import {ZakenApiService} from '../../services';
import {PluginTranslatePipe} from '../../../../pipes';
import {CaseManagementParams, ManagementContext} from '@valtimo/shared';

@Component({
  standalone: false,
  selector: 'valtimo-create-zaak-resultaat-configuration',
  templateUrl: './create-zaak-resultaat-configuration.component.html',
  styleUrls: ['./create-zaak-resultaat-configuration.component.scss'],
  providers: [PluginTranslatePipe],
})
export class CreateZaakResultaatConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() public save$: Observable<void>;
  @Input() public disabled$: Observable<boolean>;
  @Input() public set pluginId(value: string) {
    this.pluginId$.next(value);
  }
  @Input() public prefillConfiguration$: Observable<CreateZaakResultaatConfig>;
  @Input() public context$: Observable<[ManagementContext, CaseManagementParams]>;

  @Output() public valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() public configuration: EventEmitter<CreateZaakResultaatConfig> =
    new EventEmitter<CreateZaakResultaatConfig>();

  public readonly clearStatusSelection$ = new Subject<void>();

  public readonly loading$ = new BehaviorSubject<boolean>(true);

  public readonly resultaatTypeSelectItems$ = new BehaviorSubject<SelectItem[]>([]);

  public readonly selectedInputOption$ = new BehaviorSubject<InputOption>('selection');

  public readonly pluginId$ = new BehaviorSubject<string>('');

  public readonly inputTypeOptions$: Observable<Array<RadioValue>> = this.pluginId$.pipe(
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

  private readonly formValue$ = new BehaviorSubject<CreateZaakResultaatConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly zakenApiService: ZakenApiService,
    private readonly pluginTranslatePipe: PluginTranslatePipe
  ) {}

  public ngOnInit(): void {
    this.initContextHandling();
    this.openSaveSubscription();
  }

  public ngOnDestroy() {
    this._subscriptions.unsubscribe();
  }

  public formValueChange(formValue: CreateZaakResultaatConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);

    if (formValue.inputTypeZaakResultaatToggle) {
      this.selectedInputOption$.next(formValue.inputTypeZaakResultaatToggle);
    }
  }

  public oneSelectItem(selectItems: Array<SelectItem>): boolean {
    if (Array.isArray(selectItems)) {
      return selectItems.length === 1;
    }

    return false;
  }

  private handleValid(formValue: CreateZaakResultaatConfig): void {
    const valid = !!formValue.resultaattypeUrl;

    this.valid$.next(valid);
    this.valid.emit(valid);
  }

  private initContextHandling(): void {
    if (!this.context$) return;

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
            this.zakenApiService.getResultaatTypesByCaseAndVersion(
              params.caseDefinitionKey,
              params.caseDefinitionVersionTag
            ),
            this.prefillConfiguration$.pipe(take(1)),
          ])
        ),
        tap(([resultaatTypes, prefill]) => {
          const selectItems = resultaatTypes.map(rt => ({id: rt.url, text: rt.name}));
          this.resultaatTypeSelectItems$.next(selectItems);

          const matched = selectItems.find(item => item.id === prefill?.resultaattypeUrl);
          this.selectedInputOption$.next(matched ? 'selection' : 'text');

          this.loading$.next(false);
        })
      )
      .subscribe();

    this._subscriptions.add(contextSub);
  }

  private openSaveSubscription(): void {
    this._subscriptions.add(
      this.save$?.subscribe(save => {
        combineLatest([this.formValue$, this.valid$])
          .pipe(take(1))
          .subscribe(([formValue, valid]) => {
            if (valid) {
              this.configuration.emit({
                toelichting: formValue.toelichting,
                resultaattypeUrl: formValue.resultaattypeUrl,
              });
            }
          });
      })
    );
  }
}
