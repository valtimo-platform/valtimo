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
import {InputOption, SetZaakStatusConfig} from '../../models';
import {ModalService, RadioValue, SelectItem} from '@valtimo/components';
import {DocumentService} from '@valtimo/document';
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

  readonly caseDefinitionSelectItems$ = new BehaviorSubject<Array<SelectItem>>(null);
  readonly selectedCaseDefinitionId$ = new BehaviorSubject<string>('');
  readonly clearStatusSelection$ = new Subject<void>();
  readonly loading$ = new BehaviorSubject<boolean>(true);
  readonly selectedInputOption$ = new BehaviorSubject<InputOption>('selection');
  readonly pluginId$ = new BehaviorSubject<string>('');
  readonly formValue$ = new BehaviorSubject<SetZaakStatusConfig | null>(null);
  readonly valid$ = new BehaviorSubject<boolean>(false);
  readonly statusTypeSelectItems$ = new BehaviorSubject<{
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

  public selectCaseDefinition(caseDefinitionId: string): void {
    this.selectedCaseDefinitionId$.next(caseDefinitionId);
    this.clearStatusSelection$.next();
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
          this.documentService.findProcessDefinitionCaseDefinitions(params.caseDefinitionKey)
        ),
        tap(processDocumentDefinitions => {
          const caseDefSelectItems = processDocumentDefinitions.map(processDocDef => ({
            text: processDocDef.id.caseDefinitionId.key,
            id: processDocDef.id.caseDefinitionId.key,
          }));

          this.caseDefinitionSelectItems$.next(caseDefSelectItems);

          if (this.oneSelectItem(caseDefSelectItems)) {
            this.selectedCaseDefinitionId$.next(caseDefSelectItems[0].id);
          }
        }),
        switchMap(processDocumentDefinitions =>
          combineLatest([
            of(processDocumentDefinitions.map(doc => doc.id.caseDefinitionId.key)),
            ...processDocumentDefinitions.map(doc =>
              this.zakenApiService.getStatusTypesByCaseDefinition(doc.id.caseDefinitionId.key)
            ),
          ])
        ),
        map(res => {
          const caseDefinitionIds = res[0];
          const statusTypes = res.slice(1);
          const selectObject = {};

          caseDefinitionIds.forEach((id, index) => {
            selectObject[id] = statusTypes[index].map(statusType => ({
              id: statusType.url,
              text: statusType.name,
            }));
          });

          return selectObject;
        }),
        tap(selectObject => {
          this.prefillConfiguration$.pipe(take(1)).subscribe(prefillConfig => {
            const statusTypeUrl = prefillConfig?.statustypeUrl;
            let selectedCaseDefinitionId: string | null = null;

            Object.keys(selectObject).forEach(caseDefinitionId => {
              if (selectObject[caseDefinitionId].find(item => item.id === statusTypeUrl)) {
                selectedCaseDefinitionId = caseDefinitionId;
              }
            });

            if (selectedCaseDefinitionId) {
              this.selectedCaseDefinitionId$.next(selectedCaseDefinitionId);
            } else {
              this.selectedInputOption$.next('text');
            }
          });
        }),
        tap(selectObject => {
          this.statusTypeSelectItems$.next(selectObject);
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
