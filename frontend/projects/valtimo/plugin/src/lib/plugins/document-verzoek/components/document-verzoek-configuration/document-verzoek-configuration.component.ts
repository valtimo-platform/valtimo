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
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {DocumentVerzoekConfig, DocumentVerzoekType} from '../../models';
import {PluginManagementService, PluginTranslationService} from '../../../../services';
import {TranslateService} from '@ngx-translate/core';
import {
  SelectItem,
  ValuePathSelectorPrefix,
  VModalComponent,
} from '@valtimo/components';
import {DocumentVerzoekPluginService} from '../../services';
import {ProcessService} from '@valtimo/process';
import {DataTable16} from '@carbon/icons';
import {IconService} from 'carbon-components-angular';

@Component({
  standalone: false,
  selector: 'valtimo-document-verzoek-configuration',
  templateUrl: './document-verzoek-configuration.component.html',
  styleUrls: ['./document-verzoek-configuration.component.scss'],
})
export class DocumentVerzoekConfigurationComponent
  implements PluginConfigurationComponent, OnInit, OnDestroy
{
  @ViewChildren(VModalComponent) mappingModals: QueryList<VModalComponent>;

  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<DocumentVerzoekConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<DocumentVerzoekConfig> =
    new EventEmitter<DocumentVerzoekConfig>();

  mappedPrefill$: Observable<DocumentVerzoekConfig>;

  readonly zakenPluginSelectItems$: Observable<Array<SelectItem>> = combineLatest([
    this.pluginManagementService.getPluginConfigurationsByPluginDefinitionKey('zakenapi'),
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

  readonly documentenPluginSelectItems$: Observable<Array<SelectItem>> = combineLatest([
    this.pluginManagementService.getPluginConfigurationsByPluginDefinitionKey('documentenapi'),
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

  private saveSubscription!: Subscription;

  private readonly formValue$ = new BehaviorSubject<DocumentVerzoekConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  public readonly ValuePathSelectorPrefix = ValuePathSelectorPrefix;

  constructor(
    private readonly pluginManagementService: PluginManagementService,
    private readonly translateService: TranslateService,
    private readonly pluginTranslationService: PluginTranslationService,
    private readonly verzoekPluginService: DocumentVerzoekPluginService,
    private readonly processService: ProcessService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([DataTable16]);
  }

  ngOnInit(): void {
    this.openSaveSubscription();
    this.setMappedPrefill();
  }

  private setMappedPrefill(): void {
    this.mappedPrefill$ = this.prefillConfiguration$.pipe(
      filter(prefill => !!prefill),
      map(prefill => ({
        ...prefill,
      })),
      tap(prefill => {
        setTimeout(() => {
          this.formValue$.pipe(take(1)).subscribe(formValue => {
            const prefillVerzoeken = prefill?.documentVerzoekProperties;
            const formValueVerzoeken = formValue?.documentVerzoekProperties;

            prefillVerzoeken.forEach((verzoek, index) => {
              const uuidForMapping = formValueVerzoeken[index].uuid;
            });
          });
        }, 250);
      })
    );
  }

  ngOnDestroy() {
    this.saveSubscription?.unsubscribe();
  }

  formValueChange(formValue: DocumentVerzoekConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  verzoekTypeFormChange(formValue: DocumentVerzoekType, uuid: string): void {
    const caseDefinitionKey = formValue?.caseDefinitionKey;
  }

  informatieObjectTypeFormChange(formValue: DocumentType, uuid: string): void {
    const fietsDefinitionKey = formValue;
  }

  deleteRow(uuid: string): void {}

  private handleValid(formValue: DocumentVerzoekConfig): void {
    const validForm = !!(
      formValue.configurationTitle &&
      formValue.notificatiesApiPluginConfiguration &&
      formValue.zakenApiPlugin &&
      formValue.documentenApiPlugin &&
      formValue.externalDocumentType &&
      formValue.eventMessage
    );
    const verzoekTypen = formValue.documentVerzoekProperties || [];
    const validVerzoekTypen = verzoekTypen.filter(type => !!type.caseDefinitionKey);
    const valid = validForm && verzoekTypen.length === validVerzoekTypen.length;
    this.valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this.saveSubscription = this.save$?.subscribe(save => {
      combineLatest([this.formValue$, this.valid$])
        .pipe(take(1))
        .subscribe(([formValue, valid]) => {
          const formValueToSave: DocumentVerzoekConfig = {
            ...formValue,
            documentVerzoekProperties: formValue.documentVerzoekProperties.map(verzoek => {
              const verzoekToReturn: DocumentVerzoekType = {...verzoek};

              return {
                ...verzoekToReturn,
              };
            }),
          };
          if (valid) {
            this.configuration.emit(formValueToSave);
          }
        });
    });
  }
}
