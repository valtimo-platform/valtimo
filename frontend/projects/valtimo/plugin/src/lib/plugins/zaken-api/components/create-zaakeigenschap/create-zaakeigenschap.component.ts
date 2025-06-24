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
import {CreateZaakeigenschapConfig, InputOption} from '../../models';
import {RadioValue, SelectItem} from '@valtimo/components';
import {DocumentService} from '@valtimo/document';
import {map} from 'rxjs/operators';
import {ZakenApiService} from '../../services';
import {PluginTranslatePipe} from '../../../../pipes';
import {CaseManagementParams, ManagementContext} from '@valtimo/shared';

@Component({
  standalone: false,
  selector: 'valtimo-create-zaakeigenschap',
  templateUrl: './create-zaakeigenschap.component.html',
  providers: [PluginTranslatePipe],
})
export class CreateZaakeigenschapComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() set pluginId(value: string) {
    this.pluginId$.next(value);
  }
  @Input() prefillConfiguration$: Observable<CreateZaakeigenschapConfig>;
  @Input() context$: Observable<[ManagementContext, CaseManagementParams]>;

  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<CreateZaakeigenschapConfig> =
    new EventEmitter<CreateZaakeigenschapConfig>();

  readonly loading$ = new BehaviorSubject<boolean>(true);
  readonly selectedInputOption$ = new BehaviorSubject<InputOption>('selection');
  readonly pluginId$ = new BehaviorSubject<string>('');
  readonly formValue$ = new BehaviorSubject<CreateZaakeigenschapConfig | null>(null);
  readonly valid$ = new BehaviorSubject<boolean>(false);
  readonly eigenschapSelectItems$ = new BehaviorSubject<SelectItem[]>([]);
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
    private readonly documentService: DocumentService,
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

  public formValueChange(formValue: CreateZaakeigenschapConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);

    if (formValue.inputTypeEigenschapToggle) {
      this.selectedInputOption$.next(formValue.inputTypeEigenschapToggle);
    }
  }

  public oneSelectItem(selectItems: Array<SelectItem>): boolean {
    return Array.isArray(selectItems) && selectItems.length === 1;
  }

  private initEigenschapHandling(): void {
    if (!this.context$) {
      return;
    }

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
          this.zakenApiService.getEigenschappenByCaseAndVersion(
            params.caseDefinitionKey,
            params.caseDefinitionVersionTag
          )
        ),
        tap(eigenschappen => {
          this.eigenschapSelectItems$.next(
            eigenschappen.map(item => ({id: item.url, text: item.name}))
          );
          this.selectedInputOption$.next('selection');
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
              eigenschapValue: formValue.eigenschapValue,
            });
          }
        });
    });

    this._subscriptions.add(sub);
  }

  private handleValid(formValue: CreateZaakeigenschapConfig): void {
    const valid = !!formValue.eigenschapUrl;
    this.valid$.next(valid);
    this.valid.emit(valid);
  }
}
