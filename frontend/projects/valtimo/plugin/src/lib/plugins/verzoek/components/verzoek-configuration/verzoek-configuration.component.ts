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

import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  QueryList,
  ViewChildren,
} from '@angular/core';
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
import {
  ModalService,
  MultiInputValues,
  RadioValue,
  SelectItem,
  ValuePathSelectorPrefix,
  VModalComponent,
} from '@valtimo/components';
import {VerzoekPluginService} from '../../services';
import {ProcessService} from '@valtimo/process';
import {DataTable16} from '@carbon/icons';
import {IconService} from 'carbon-components-angular';

@Component({
  standalone: false,
  selector: 'valtimo-verzoek-configuration',
  templateUrl: './verzoek-configuration.component.html',
  styleUrls: ['./verzoek-configuration.component.scss'],
})
export class VerzoekConfigurationComponent
  implements PluginConfigurationComponent, OnInit, OnDestroy
{
  @ViewChildren(VModalComponent) mappingModals: QueryList<VModalComponent>;

  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<VerzoekConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<VerzoekConfig> = new EventEmitter<VerzoekConfig>();

  mappedPrefill$: Observable<VerzoekConfig>;

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

  readonly caseSelectItems$: Observable<Array<SelectItem>> = this.verzoekPluginService
    .getCaseDefinitions({active: true})
    .pipe(
      map(caseDefinitions =>
        caseDefinitions.content.map(caseDefinition => ({
          id: caseDefinition.caseDefinitionKey,
          text: caseDefinition.caseDefinitionKey,
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

  readonly caseVersionTagSelectItemsObservables: {
    [uuid: string]: {caseDefinitionKey: string; items: Observable<Array<SelectItem>>};
  } = {};

  readonly rolTypeSelectItemsObservables: {
    [uuid: string]: {caseDefinitionId: string; items: Observable<Array<SelectItem>>};
  } = {};

  readonly showMappingButtons: {[uuid: string]: boolean} = {};

  readonly showMappingModalsDelay: {[uuid: string]: boolean} = {};

  readonly tempMappings: {[uuid: string]: MultiInputValues} = {};

  readonly mappings: {[uuid: string]: MultiInputValues} = {};

  private saveSubscription!: Subscription;

  private readonly formValue$ = new BehaviorSubject<VerzoekConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  public getSelectedCaseDefinitionKeyForIndex(index: number): Observable<string> {
    return this.formValue$.pipe(
      map(
        formValue =>
          Array.isArray(formValue.verzoekProperties) &&
          formValue.verzoekProperties[index]?.caseDefinitionKey
      )
    );
  }

  public readonly ValuePathSelectorPrefix = ValuePathSelectorPrefix;

  constructor(
    private readonly pluginManagementService: PluginManagementService,
    private readonly translateService: TranslateService,
    private readonly pluginTranslationService: PluginTranslationService,
    private readonly verzoekPluginService: VerzoekPluginService,
    private readonly processService: ProcessService,
    private readonly modalService: ModalService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([DataTable16]);
  }

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
    const caseDefinitionKey = formValue?.caseDefinitionKey;
    const caseDefinitionVersionTag = formValue?.caseDefinitionVersionTag;
    const caseDefinitionId = `${caseDefinitionKey}:${caseDefinitionVersionTag}`;
    const rolTypeSelectItemsObservables = this.rolTypeSelectItemsObservables;
    const caseVersionTagSelectItemsObservables = this.caseVersionTagSelectItemsObservables;

    this.showMappingButtons[uuid] = formValue.copyStrategy === 'specified';

    if (caseDefinitionKey) {
      if (
        !caseVersionTagSelectItemsObservables[uuid] ||
        caseVersionTagSelectItemsObservables[uuid].caseDefinitionKey !== caseDefinitionKey
      ) {
        caseVersionTagSelectItemsObservables[uuid] = {
          caseDefinitionKey,
          items: this.verzoekPluginService.getCaseDefinitions({caseDefinitionKey}).pipe(
            map(caseDefinitions =>
              [{text: 'Active version', id: ''}].concat(
                caseDefinitions.content.map(caseDefinition => ({
                  text: caseDefinition.caseDefinitionVersionTag,
                  id: caseDefinition.caseDefinitionVersionTag,
                }))
              )
            )
          ),
        };
      }
      if (
        !rolTypeSelectItemsObservables[uuid] ||
        rolTypeSelectItemsObservables[uuid].caseDefinitionId !== caseDefinitionId
      ) {
        rolTypeSelectItemsObservables[uuid] = {
          caseDefinitionId,
          items: this.verzoekPluginService
            .getRoltypesByCaseDefinition(caseDefinitionKey, {caseDefinitionVersionTag})
            .pipe(
              map(rolTypes => rolTypes.map(rolType => ({text: rolType.name, id: rolType.url})))
            ),
        };
      }
    } else {
      caseVersionTagSelectItemsObservables[uuid] = {
        caseDefinitionKey,
        items: of([]),
      };
      rolTypeSelectItemsObservables[uuid] = {
        caseDefinitionId,
        items: of([]),
      };
    }
  }

  deleteRow(uuid: string): void {
    delete this.caseVersionTagSelectItemsObservables[uuid];
    delete this.rolTypeSelectItemsObservables[uuid];
  }

  openMappingModal(uuid: string): void {
    this.showMappingModalsDelay[uuid] = true;
    this.modalService.openModal(
      this.mappingModals.find(mappingModal => mappingModal.parentId === uuid)
    );
  }

  closeMappingModal(uuid): void {
    this.modalService.closeModal();

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
          type.caseDefinitionKey &&
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

              if (!verzoek.caseDefinitionVersionTag) {
                verzoekToReturn.caseDefinitionVersionTag = null;
              }

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
            const prefillVerzoeken = prefill?.verzoekProperties;
            const formValueVerzoeken = formValue?.verzoekProperties;

            prefillVerzoeken.forEach((verzoek, index) => {
              const mappingForVerzoek = verzoek?.mapping;
              const uuidForMapping = formValueVerzoeken[index].uuid;

              if (mappingForVerzoek && uuidForMapping) {
                this.mappings[uuidForMapping] = mappingForVerzoek;
              }
            });
          });
        }, 250);
      })
    );
  }
}
