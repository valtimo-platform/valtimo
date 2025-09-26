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
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {DeleteZaakeigenschapConfig, InputOption} from '../../models';
import {RadioValue, SelectItem} from '@valtimo/components';
import {ZakenApiService} from '../../services';
import {PluginTranslatePipe} from '../../../../pipes';
import {CaseManagementParams, ManagementContext} from '@valtimo/shared';
import {map} from 'rxjs/operators';

@Component({
  standalone: false,
  selector: 'valtimo-delete-zaakeigenschap',
  templateUrl: './delete-zaakeigenschap.component.html',
  providers: [PluginTranslatePipe],
})
export class DeleteZaakeigenschapComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() public save$: Observable<void>;
  @Input() public disabled$: Observable<boolean>;
  @Input() public set pluginId(value: string) {
    this.pluginId$.next(value);
  }
  @Input() public prefillConfiguration$: Observable<DeleteZaakeigenschapConfig>;
  @Input() public context$: Observable<[ManagementContext, CaseManagementParams]>;

  @Output() public valid = new EventEmitter<boolean>();
  @Output() public configuration = new EventEmitter<DeleteZaakeigenschapConfig>();

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly selectedInputOption$ = new BehaviorSubject<InputOption>('selection');
  public readonly pluginId$ = new BehaviorSubject<string>('');
  public readonly formValue$ = new BehaviorSubject<DeleteZaakeigenschapConfig | null>(null);
  public readonly valid$ = new BehaviorSubject<boolean>(false);
  public readonly eigenschapSelectItems$ = new BehaviorSubject<SelectItem[]>([]);

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

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly zakenApiService: ZakenApiService,
    private readonly pluginTranslatePipe: PluginTranslatePipe
  ) {}

  public ngOnInit(): void {
    this.initEigenschapHandling();
    this.initSaveHandling();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  formValueChange(formValue: DeleteZaakeigenschapConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);

    if (formValue.inputTypeEigenschapToggle) {
      this.selectedInputOption$.next(formValue.inputTypeEigenschapToggle);
    }
  }

  private initEigenschapHandling(): void {
    if (!this.context$) return;

    const sub = this.context$
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
            this.zakenApiService.getEigenschappenByCaseAndVersion(
              params.caseDefinitionKey,
              params.caseDefinitionVersionTag
            ),
            this.prefillConfiguration$.pipe(take(1)),
          ])
        ),
        tap(([eigenschappen, prefill]) => {
          const selectItems = eigenschappen.map(item => ({id: item.url, text: item.name}));
          this.eigenschapSelectItems$.next(selectItems);

          const matched = selectItems.find(item => item.id === prefill?.eigenschapUrl);
          this.selectedInputOption$.next(matched ? 'selection' : 'text');

          this.loading$.next(false);
        })
      )
      .subscribe();

    this._subscriptions.add(sub);
  }

  private initSaveHandling(): void {
    if (!this.save$) return;

    const sub = this.save$.subscribe(() => {
      combineLatest([this.formValue$, this.valid$])
        .pipe(take(1))
        .subscribe(([formValue, valid]) => {
          if (valid) {
            this.configuration.emit({
              eigenschapUrl: formValue.eigenschapUrl,
            });
          }
        });
    });

    this._subscriptions.add(sub);
  }

  private handleValid(formValue: DeleteZaakeigenschapConfig): void {
    const valid = !!formValue.eigenschapUrl;
    this.valid$.next(valid);
    this.valid.emit(valid);
  }
}
