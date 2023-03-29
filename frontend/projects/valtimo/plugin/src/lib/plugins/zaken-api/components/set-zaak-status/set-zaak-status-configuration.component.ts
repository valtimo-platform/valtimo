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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {FunctionConfigurationComponent} from '../../../../models';
import {
  BehaviorSubject,
  combineLatest,
  Observable,
  of,
  Subject,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {SetZaakStatusConfig} from '../../models';
import {ModalService, SelectItem} from '@valtimo/user-interface';
import {DocumentService} from '@valtimo/document';
import {map} from 'rxjs/operators';
import {ZakenApiService} from '../../services';

@Component({
  selector: 'valtimo-set-zaak-status-configuration',
  templateUrl: './set-zaak-status-configuration.component.html',
  styleUrls: ['./set-zaak-status-configuration.component.scss'],
})
export class SetZaakStatusConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<SetZaakStatusConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<SetZaakStatusConfig> =
    new EventEmitter<SetZaakStatusConfig>();

  public inputTypeZaakStatusToggle: boolean;

  readonly caseDefinitionSelectItems$ = new BehaviorSubject<Array<SelectItem>>(null);
  readonly selectedCaseDefinitionId$ = new BehaviorSubject<string>('');
  readonly clearStatusSelection$ = new Subject<void>();

  readonly statusTypeSelectItems$: Observable<{[caseDefinitionId: string]: Array<SelectItem>}> =
    this.modalService.modalData$.pipe(
      switchMap(params =>
        this.documentService.findProcessDocumentDefinitionsByProcessDefinitionKey(
          params?.processDefinitionKey
        )
      ),
      tap(processDocumentDefinitions => {
        const caseDefSelectItems = processDocumentDefinitions.map(processDocDef => ({
          text: processDocDef.id.documentDefinitionId.name,
          id: processDocDef.id.documentDefinitionId.name,
        }));

        this.caseDefinitionSelectItems$.next(caseDefSelectItems);

        if (this.oneSelectItem(caseDefSelectItems)) {
          this.selectedCaseDefinitionId$.next(caseDefSelectItems[0].id);
        }
      }),
      switchMap(processDocumentDefinitions =>
        combineLatest([
          of(processDocumentDefinitions.map(processDoc => processDoc.id.documentDefinitionId.name)),
          ...processDocumentDefinitions.map(processDocDef =>
            this.zakenApiService.getStatusTypesByCaseDefinition(
              processDocDef.id.documentDefinitionId.name
            )
          ),
        ])
      ),
      map(res => {
        const caseDefinitionIds = res[0];
        const statusTypes = res.filter((curr, index) => index !== 0);
        const selectObject = {};

        caseDefinitionIds.forEach((caseDefinitionId, index) => {
          selectObject[caseDefinitionId] = statusTypes[index].map(statusType => ({
            id: statusType.url,
            text: statusType.name,
          }));
        });

        return selectObject;
      }),
      tap(selectObject => {
        this.prefillConfiguration$.pipe(take(1)).subscribe(prefillConfig => {
          const statusTypeUrl = prefillConfig?.statustypeUrl;

          if (statusTypeUrl) {
            let selectedCaseDefinitionId!: string;

            Object.keys(selectObject).forEach(caseDefinitionId => {
              if (selectObject[caseDefinitionId].find(item => item.id === statusTypeUrl)) {
                selectedCaseDefinitionId = caseDefinitionId;
              }

              if (selectedCaseDefinitionId) {
                this.selectedCaseDefinitionId$.next(selectedCaseDefinitionId);
              } else {
                this.inputTypeZaakStatusToggle = true;
              }
            });
          }
        });
      })
    );

  private saveSubscription!: Subscription;

  private readonly formValue$ = new BehaviorSubject<SetZaakStatusConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly modalService: ModalService,
    private readonly documentService: DocumentService,
    private readonly zakenApiService: ZakenApiService
  ) {}

  ngOnInit(): void {
    this.openSaveSubscription();
  }

  ngOnDestroy() {
    this.saveSubscription?.unsubscribe();
  }

  formValueChange(formValue: SetZaakStatusConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  toggleInputZaakStatus(): void {
    this.inputTypeZaakStatusToggle = !this.inputTypeZaakStatusToggle;
  }

  selectCaseDefinition(caseDefinitionId: string): void {
    this.selectedCaseDefinitionId$.next(caseDefinitionId);
    this.clearStatusSelection$.next();
  }

  oneSelectItem(selectItems: Array<SelectItem>): boolean {
    if (Array.isArray(selectItems)) {
      return selectItems.length === 1;
    }

    return false;
  }

  private handleValid(formValue: SetZaakStatusConfig): void {
    const valid = !!formValue.statustypeUrl;

    this.valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this.saveSubscription = this.save$?.subscribe(save => {
      combineLatest([this.formValue$, this.valid$])
        .pipe(take(1))
        .subscribe(([formValue, valid]) => {
          if (valid) {
            this.configuration.emit(formValue);
          }
        });
    });
  }
}
