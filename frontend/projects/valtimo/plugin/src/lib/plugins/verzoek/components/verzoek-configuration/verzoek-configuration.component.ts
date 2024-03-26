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
import {PluginConfigurationComponent} from '../../../../models';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  of,
  Subscription,
  take,
  tap,
} from 'rxjs';
import {CopyStrategy, VerzoekConfig, VerzoekType} from '../../models';
import {PluginManagementService, PluginTranslationService} from '../../../../services';
import {TranslateService} from '@ngx-translate/core';
import {MultiInputValues, RadioValue, SelectItem} from '@valtimo/components';
import {VerzoekPluginService} from '../../services';
import {ProcessService} from '@valtimo/process';
import {DocumentService} from '@valtimo/document';

@Component({
  selector: 'valtimo-verzoek-configuration',
  templateUrl: './verzoek-configuration.component.html',
  styleUrls: ['./verzoek-configuration.component.scss'],
})
export class VerzoekConfigurationComponent
  implements PluginConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<VerzoekConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<VerzoekConfig> = new EventEmitter<VerzoekConfig>();

  mappedPrefill$: Observable<VerzoekConfig>;

  private mappingSet!: boolean;

  readonly notificatiePluginSelectItems$: Observable<Array<SelectItem>> = combineLatest([
    this.pluginManagementService.getPluginConfigurationsByPluginDefinitionKey('notificatiesapi'),
    this.translateService.stream('key'),
  ]).pipe(
    map(([configurations]) =>
      configurations.map(configuration => ({
        id: configuration.id,
        text: `${configuration.title} - ${this.pluginTranslationService.instant(
          'title',
          configuration.pluginDefinition.key
        )}`,
      }))
    )
  );

  readonly objectManagementSelectItems$: Observable<Array<SelectItem>> = this.verzoekPluginService
    .getAllObjects()
    .pipe(
      map(objects =>
        objects.map(object => ({
          id: object.id,
          text: object.title,
        }))
      )
    );

  readonly processSelectItems$: Observable<Array<SelectItem>> = this.processService
    .getProcessDefinitions()
    .pipe(
      map(processDefinitions =>
        processDefinitions.map(processDefinition => ({
          id: processDefinition.key,
          text: processDefinition.name ?? '',
        }))
      )
    );

  readonly documentSelectItems$: Observable<Array<SelectItem>> = this.documentService
    .getAllDefinitions()
    .pipe(
      map(documentDefinitions =>
        documentDefinitions.content.map(documentDefinition => ({
          id: documentDefinition.id.name,
          text: documentDefinition.id.name,
        }))
      )
    );

  readonly RADIO_ITEMS: Array<CopyStrategy> = ['full', 'specified'];
  readonly radioItems$: Observable<Array<RadioValue>> = this.translateService.stream('key').pipe(
    map(() =>
      this.RADIO_ITEMS.map(radioItem => ({
        value: radioItem,
        title: this.pluginTranslationService.instant(radioItem, this.pluginId),
      }))
    )
  );

  readonly rolTypeSelectItemsObservables: {
    [uuid: string]: {caseDefinitionName: string; items: Observable<Array<SelectItem>>};
  } = {};

  readonly showMappingButtons: {[uuid: string]: boolean} = {};

  readonly showMappingModals: {[uuid: string]: boolean} = {};
  readonly showMappingModalsDelay: {[uuid: string]: boolean} = {};

  readonly tempMappings: {[uuid: string]: MultiInputValues} = {};

  readonly mappings: {[uuid: string]: MultiInputValues} = {};

  private saveSubscription!: Subscription;

  private readonly formValue$ = new BehaviorSubject<VerzoekConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly pluginManagementService: PluginManagementService,
    private readonly translateService: TranslateService,
    private readonly pluginTranslationService: PluginTranslationService,
    private readonly verzoekPluginService: VerzoekPluginService,
    private readonly processService: ProcessService,
    private readonly documentService: DocumentService
  ) {}

  ngOnInit(): void {
    this.openSaveSubscription();
    this.setMappedPrefill();
  }

  ngOnDestroy() {
    this.saveSubscription?.unsubscribe();
  }

  formValueChange(formValue: VerzoekConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  verzoekTypeFormChange(formValue: VerzoekType, uuid: string): void {
    const caseDefinitionName = formValue?.caseDefinitionName;
    const rolTypeSelectItemsObservables = this.rolTypeSelectItemsObservables;

    this.showMappingButtons[uuid] = formValue.copyStrategy === 'specified';

    if (caseDefinitionName) {
      if (
        !rolTypeSelectItemsObservables[uuid] ||
        rolTypeSelectItemsObservables[uuid].caseDefinitionName !== caseDefinitionName
      ) {
        rolTypeSelectItemsObservables[uuid] = {
          caseDefinitionName,
          items: this.verzoekPluginService
            .getRoltypesByDocumentDefinitionName(caseDefinitionName)
            .pipe(
              map(rolTypes => rolTypes.map(rolType => ({text: rolType.name, id: rolType.url})))
            ),
        };
      }
    } else {
      rolTypeSelectItemsObservables[uuid] = {
        caseDefinitionName,
        items: of([]),
      };
    }
  }

  deleteRow(uuid: string): void {
    delete this.rolTypeSelectItemsObservables[uuid];
  }

  openMappingModal(uuid: string): void {
    this.showMappingModals[uuid] = true;
    this.showMappingModalsDelay[uuid] = true;
  }

  closeMappingModal(uuid: string): void {
    this.showMappingModals[uuid] = false;

    setTimeout(() => {
      this.showMappingModalsDelay[uuid] = false;
    }, 250);
  }

  mappingValueChange(newValue: MultiInputValues, uuid: string): void {
    this.tempMappings[uuid] = newValue;
  }

  saveMapping(uuid: string): void {
    this.mappings[uuid] = [...this.tempMappings[uuid]];
    this.tempMappings[uuid] = [];
    this.closeMappingModal(uuid);
  }

  private handleValid(formValue: VerzoekConfig): void {
    const validForm = !!(
      formValue.configurationTitle &&
      formValue.notificatiesApiPluginConfiguration &&
      formValue.rsin &&
      formValue.processToStart
    );
    const verzoekTypen = formValue.verzoekProperties || [];
    const validVerzoekTypen = verzoekTypen.filter(
      type =>
        !!(
          type.type &&
          type.caseDefinitionName &&
          type.objectManagementId &&
          type.initiatorRoltypeUrl &&
          type.processDefinitionKey &&
          type.initiatorRolDescription
        )
    );
    const valid = validForm && verzoekTypen.length === validVerzoekTypen.length;
    this.valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this.saveSubscription = this.save$?.subscribe(save => {
      combineLatest([this.formValue$, this.valid$])
        .pipe(take(1))
        .subscribe(([formValue, valid]) => {
          const formValueToSave: VerzoekConfig = {
            ...formValue,
            verzoekProperties: formValue.verzoekProperties.map(verzoek => {
              const verzoekToReturn: VerzoekType = {...verzoek};
              delete verzoekToReturn.uuid;

              if (this.mappings[verzoek.uuid] && verzoek.copyStrategy === 'specified') {
                verzoekToReturn.mapping = this.mappings[verzoek.uuid];
              }

              return {
                ...verzoekToReturn,
                ...(verzoekToReturn.mapping && {
                  mapping: verzoekToReturn.mapping.map(verzoekMapping => ({
                    source: verzoekMapping.key,
                    target: verzoekMapping.value,
                  })) as Array<any>,
                }),
              };
            }),
          };
          if (valid) {
            this.configuration.emit(formValueToSave);
          }
        });
    });
  }

  private setMappedPrefill(): void {
    this.mappedPrefill$ = this.prefillConfiguration$.pipe(
      filter(prefill => !!prefill),
      map(prefill => ({
        ...prefill,
        verzoekProperties: prefill.verzoekProperties.map(verzoekType => ({
          ...verzoekType,
          ...(verzoekType.mapping &&
            Array.isArray(verzoekType.mapping) && {
              mapping: verzoekType.mapping.map(mapping => ({
                key: mapping.source,
                value: mapping.target,
              })),
            }),
        })),
      })),
      tap(prefill => {
        setTimeout(() => {
          this.formValue$.pipe(take(1)).subscribe(formValue => {
            if (!this.mappingSet) {
              const prefillVerzoeken = prefill?.verzoekProperties;
              const formValueVerzoeken = formValue?.verzoekProperties;

              prefillVerzoeken.forEach((verzoek, index) => {
                const mappingForVerzoek = verzoek?.mapping;
                const uuidForMapping = formValueVerzoeken[index].uuid;

                if (mappingForVerzoek && uuidForMapping) {
                  this.mappings[uuidForMapping] = mappingForVerzoek;
                }
              });

              this.mappingSet = true;
            }
          });
        }, 250);
      })
    );
  }
}
