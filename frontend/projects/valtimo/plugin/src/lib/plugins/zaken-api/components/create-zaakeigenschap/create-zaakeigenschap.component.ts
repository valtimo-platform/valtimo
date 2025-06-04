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
  of,
  Subject,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {CreateZaakeigenschapConfig, InputOption} from '../../models';
import {ModalService, RadioValue, SelectItem} from '@valtimo/components';
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

  readonly caseDefinitionSelectItems$ = new BehaviorSubject<Array<SelectItem>>(null);
  readonly selectedCaseDefinitionName$ = new BehaviorSubject<string>('');
  readonly clearEigenschapSelection$ = new Subject<void>();
  readonly loading$ = new BehaviorSubject<boolean>(true);
  readonly selectedInputOption$ = new BehaviorSubject<InputOption>('selection');
  readonly pluginId$ = new BehaviorSubject<string>('');
  readonly formValue$ = new BehaviorSubject<CreateZaakeigenschapConfig | null>(null);
  readonly valid$ = new BehaviorSubject<boolean>(false);
  readonly eigenschapSelectItems$ = new BehaviorSubject<{
    [caseDefinitionId: string]: Array<SelectItem>;
  }>(null);

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
    private readonly modalService: ModalService,
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

  public selectCaseDefinition(caseDefinitionName: string): void {
    this.selectedCaseDefinitionName$.next(caseDefinitionName);
    this.clearEigenschapSelection$.next();
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
          this.documentService.findProcessDefinitionCaseDefinitions(params.caseDefinitionKey)
        ),
        tap(processDocumentDefinitions => {
          const caseDefSelectItems = processDocumentDefinitions.map(doc => ({
            text: doc.id.caseDefinitionId.key,
            id: doc.id.caseDefinitionId.key,
          }));

          this.caseDefinitionSelectItems$.next(caseDefSelectItems);

          if (this.oneSelectItem(caseDefSelectItems)) {
            this.selectedCaseDefinitionName$.next(caseDefSelectItems[0].id);
          }
        }),
        switchMap(processDocumentDefinitions =>
          combineLatest([
            of(processDocumentDefinitions.map(doc => doc.id.caseDefinitionId.key)),
            ...processDocumentDefinitions.map(doc =>
              this.zakenApiService.getEigenschappenByCaseDefinition(doc.id.caseDefinitionId.key)
            ),
          ])
        ),
        map(res => {
          const caseDefinitionIds = res[0];
          const eigenschappen = res.slice(1);
          const selectObject = {};

          caseDefinitionIds.forEach((id, index) => {
            selectObject[id] = eigenschappen[index].map(eigenschap => ({
              id: eigenschap.url,
              text: eigenschap.name,
            }));
          });

          return selectObject;
        }),
        tap(selectObject => {
          this.prefillConfiguration$.pipe(take(1)).subscribe(prefillConfig => {
            const eigenschapUrl = prefillConfig?.eigenschapUrl;
            let selectedCaseDefinitionId: string | null = null;

            Object.keys(selectObject).forEach(caseDefinitionId => {
              if (selectObject[caseDefinitionId].find(item => item.id === eigenschapUrl)) {
                selectedCaseDefinitionId = caseDefinitionId;
              }
            });

            if (selectedCaseDefinitionId) {
              this.selectedCaseDefinitionName$.next(selectedCaseDefinitionId);
            } else {
              this.selectedInputOption$.next('text');
            }
          });
        }),
        tap(selectObject => {
          this.eigenschapSelectItems$.next(selectObject);
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
