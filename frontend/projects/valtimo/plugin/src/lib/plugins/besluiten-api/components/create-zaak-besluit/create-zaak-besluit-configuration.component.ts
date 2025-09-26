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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {FunctionConfigurationComponent} from '../../../../models';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  of,
  Subject,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {CreateZaakBesluitConfig, Vervalredenen} from '../../models';
import {PluginTranslationService} from '../../../../services';
import {TranslateService} from '@ngx-translate/core';
import {ModalService, RadioValue, SelectItem} from '@valtimo/components';
import {DocumentService} from '@valtimo/document';
import {BesluitenApiService} from '../../services';
import {InputOption} from '../../../zaken-api/models';
import {PluginTranslatePipe} from '../../../../pipes';

@Component({
  selector: 'valtimo-create-zaak-besluit-configuration',
  templateUrl: './create-zaak-besluit-configuration.component.html',
  styleUrls: ['./create-zaak-besluit-configuration.component.scss'],
  providers: [PluginTranslatePipe],
})
export class CreateZaakBesluitConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() set pluginId(value: string) {
    this.pluginId$.next(value);
  }
  @Input() prefillConfiguration$: Observable<CreateZaakBesluitConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<CreateZaakBesluitConfig> =
    new EventEmitter<CreateZaakBesluitConfig>();
  readonly VERVALREDENEN: Array<Vervalredenen> = [
    'tijdelijk',
    'ingetrokken_overheid',
    'ingetrokken_belanghebbende',
  ];
  readonly vervalredenenSelectItems$: Observable<Array<{id: Vervalredenen; text: string}>> =
    this.translateService.stream('key').pipe(
      switchMap(() => this.pluginId$),
      map(pluginId =>
        this.VERVALREDENEN.map(item => ({
          id: item,
          text: this.pluginTranslationService.instant(item, pluginId),
        }))
      )
    );

  readonly caseDefinitionSelectItems$ = new BehaviorSubject<Array<SelectItem>>(null);
  readonly selectedCaseDefinitionId$ = new BehaviorSubject<string>('');

  readonly selectedInputOption$ = new BehaviorSubject<InputOption>('selection');
  readonly selectedStartDateInputOption$ = new BehaviorSubject<InputOption>('selection');
  readonly selectedExpirationDateInputOption$ = new BehaviorSubject<InputOption>('selection');

  readonly loading$ = new BehaviorSubject<boolean>(true);

  readonly pluginId$ = new BehaviorSubject<string>('');
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

  readonly startDateInputTypeOptions$: Observable<Array<RadioValue>> = this.pluginId$.pipe(
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

  readonly expirationDateInputTypeOptions$: Observable<Array<RadioValue>> = this.pluginId$.pipe(
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

  readonly besluitTypeSelectItems$: Observable<{[caseDefinitionId: string]: Array<SelectItem>}> =
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
            this.besluitenApiService.getBesluitTypesByCaseDefinition(
              processDocDef.id.documentDefinitionId.name
            )
          ),
        ])
      ),
      map(res => {
        const caseDefinitionIds = res[0];
        const resultaatTypes = res.filter((curr, index) => index !== 0);
        const selectObject = {};

        caseDefinitionIds.forEach((caseDefinitionId, index) => {
          selectObject[caseDefinitionId] = resultaatTypes[index].map(statusType => ({
            id: statusType.url,
            text: statusType.name,
          }));
        });

        return selectObject;
      }),
      tap(selectObject => {
        this.prefillConfiguration$.pipe(take(1)).subscribe(prefillConfig => {
          const besluittypeUrl = prefillConfig?.besluittypeUrl;

          if (besluittypeUrl) {
            let selectedCaseDefinitionId!: string;

            Object.keys(selectObject).forEach(caseDefinitionId => {
              if (selectObject[caseDefinitionId].find(item => item.id === besluittypeUrl)) {
                selectedCaseDefinitionId = caseDefinitionId;
              }

              if (selectedCaseDefinitionId) {
                this.selectedCaseDefinitionId$.next(selectedCaseDefinitionId);
              } else {
                this.selectedInputOption$.next('text');
              }
            });
          }
        });
      }),
      tap(() => {
        this.loading$.next(false);
      })
    );

  readonly clearBesluitSelection$ = new Subject<void>();

  private saveSubscription!: Subscription;
  private readonly formValue$ = new BehaviorSubject<CreateZaakBesluitConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly translateService: TranslateService,
    private readonly pluginTranslationService: PluginTranslationService,
    private readonly modalService: ModalService,
    private readonly documentService: DocumentService,
    private readonly besluitenApiService: BesluitenApiService,
    private readonly pluginTranslatePipe: PluginTranslatePipe
  ) {}

  ngOnInit(): void {
    this.openSaveSubscription();
  }

  ngOnDestroy(): void {
    this.saveSubscription?.unsubscribe();
  }

  formValueChange(formValue: CreateZaakBesluitConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);

    if (formValue.inputTypeBesluitToggle) {
      this.selectedInputOption$.next(formValue.inputTypeBesluitToggle);
    }

    if (formValue.inputTypeStartingDateToggle) {
      this.selectedStartDateInputOption$.next(formValue.inputTypeStartingDateToggle);
    }

    if (formValue.inputTypeExpirationDateToggle) {
      this.selectedExpirationDateInputOption$.next(formValue.inputTypeExpirationDateToggle);
    }
  }

  oneSelectItem(selectItems: Array<SelectItem>): boolean {
    if (Array.isArray(selectItems)) {
      return selectItems.length === 1;
    }

    return false;
  }

  selectCaseDefinition(caseDefinitionId: string): void {
    this.selectedCaseDefinitionId$.next(caseDefinitionId);
    this.clearBesluitSelection$.next();
  }

  private handleValid(formValue: CreateZaakBesluitConfig): void {
    const valid = !!formValue.besluittypeUrl && !!formValue.ingangsdatum;

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
