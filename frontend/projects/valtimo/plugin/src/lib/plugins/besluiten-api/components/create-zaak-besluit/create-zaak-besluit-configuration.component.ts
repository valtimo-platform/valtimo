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
import {CaseManagementParams, ManagementContext} from '@valtimo/shared';

@Component({
  standalone: false,
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
  @Input() context$: Observable<[ManagementContext, CaseManagementParams]>;

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
  readonly clearBesluitSelection$ = new Subject<void>();
  readonly besluitTypeSelectItems$ = new BehaviorSubject<{
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

  readonly startDateInputTypeOptions$ = this.inputTypeOptions$;
  readonly expirationDateInputTypeOptions$ = this.inputTypeOptions$;

  private readonly formValue$ = new BehaviorSubject<CreateZaakBesluitConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly translateService: TranslateService,
    private readonly pluginTranslationService: PluginTranslationService,
    private readonly modalService: ModalService,
    private readonly documentService: DocumentService,
    private readonly besluitenApiService: BesluitenApiService,
    private readonly pluginTranslatePipe: PluginTranslatePipe
  ) {}

  public ngOnInit(): void {
    this.initBesluitHandling();
    this.initSaveHandling();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public formValueChange(formValue: CreateZaakBesluitConfig): void {
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

  public oneSelectItem(selectItems: Array<SelectItem>): boolean {
    return Array.isArray(selectItems) && selectItems.length === 1;
  }

  public selectCaseDefinition(caseDefinitionId: string): void {
    this.selectedCaseDefinitionId$.next(caseDefinitionId);
    this.clearBesluitSelection$.next();
  }

  private initBesluitHandling(): void {
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
          this.documentService.findProcessDefinitionCaseDefinitions(params.caseDefinitionKey)
        ),
        tap(processDocumentDefinitions => {
          const selectItems = processDocumentDefinitions.map(doc => ({
            text: doc.id.caseDefinitionId.key,
            id: doc.id.caseDefinitionId.key,
          }));

          this.caseDefinitionSelectItems$.next(selectItems);

          if (this.oneSelectItem(selectItems)) {
            this.selectedCaseDefinitionId$.next(selectItems[0].id);
          }
        }),
        switchMap(processDocumentDefinitions =>
          combineLatest([
            of(processDocumentDefinitions.map(doc => doc.id.caseDefinitionId.key)),
            ...processDocumentDefinitions.map(doc =>
              this.besluitenApiService.getBesluitTypesByCaseDefinition(doc.id.caseDefinitionId.key)
            ),
          ])
        ),
        map(res => {
          const caseDefinitionIds = res[0];
          const besluitTypes = res.slice(1);
          const selectObject = {};

          caseDefinitionIds.forEach((id, index) => {
            selectObject[id] = besluitTypes[index].map(besluit => ({
              id: besluit.url,
              text: besluit.name,
            }));
          });

          return selectObject;
        }),
        tap(selectObject => {
          this.prefillConfiguration$.pipe(take(1)).subscribe(prefillConfig => {
            const besluittypeUrl = prefillConfig?.besluittypeUrl;
            let selectedCaseDefinitionId: string | null = null;

            Object.keys(selectObject).forEach(caseDefinitionId => {
              if (selectObject[caseDefinitionId].find(item => item.id === besluittypeUrl)) {
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
          this.besluitTypeSelectItems$.next(selectObject);
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
            this.configuration.emit(formValue);
          }
        });
    });

    this._subscriptions.add(sub);
  }

  private handleValid(formValue: CreateZaakBesluitConfig): void {
    const valid = !!formValue.besluittypeUrl && !!formValue.ingangsdatum;
    this.valid$.next(valid);
    this.valid.emit(valid);
  }
}
