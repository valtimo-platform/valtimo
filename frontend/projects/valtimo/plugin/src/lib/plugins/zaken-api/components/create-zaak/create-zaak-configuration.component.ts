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

import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {FunctionConfigurationComponent} from '../../../../models';
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
import {CreateZaakConfig, InputOption} from '../../models';
import {OpenZaakService, ZaakType, ZaakTypeLink} from '@valtimo/resource';
import {DocumentService} from '@valtimo/document';
import {ModalService, RadioValue, SelectItem} from '@valtimo/components';
import {PluginTranslatePipe} from '../../../../pipes';
import {Add16, TrashCan16} from '@carbon/icons';
import {IconService} from 'carbon-components-angular';
import {ExtraPropertiesOptions, ExtraProperties} from '../../models/create-zaak-properties'

@Component({
  selector: 'valtimo-create-zaak-configuration',
  templateUrl: './create-zaak-configuration.component.html',
  styleUrls: ['./create-zaak-configuration.component.scss'],
  providers: [PluginTranslatePipe],
})
export class CreateZaakConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() set pluginId(value: string) {
    this.pluginId$.next(value);
  }
  @Input() prefillConfiguration$: Observable<CreateZaakConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<CreateZaakConfig> = new EventEmitter<CreateZaakConfig>();

  public readonly propertyList: Array<ExtraProperties> = [];

  readonly pluginId$ = new BehaviorSubject<string>('');
  readonly selectedInputOption$ = new BehaviorSubject<InputOption>('selection');

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

  private saveSubscription!: Subscription;

  private readonly formValue$ = new BehaviorSubject<CreateZaakConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);
  private readonly _properties = new Map<ExtraProperties, string>

  readonly loading$ = new BehaviorSubject<boolean>(true);

  readonly zaakTypeItems$: Observable<Array<SelectItem>> = this.modalService.modalData$.pipe(
    switchMap(params =>
      this.documentService.findProcessDocumentDefinitionsByProcessDefinitionKey(
        params?.processDefinitionKey
      )
    ),
    switchMap(processDocumentDefinitions =>
      combineLatest([
        this.openZaakService.getZaakTypes(),
        ...processDocumentDefinitions.map(processDocumentDefinition =>
          this.openZaakService.getZaakTypeLink(
            processDocumentDefinition.id.documentDefinitionId.name
          )
        ),
      ])
    ),
    map(results => {
      const zaakTypes = results[0] as Array<ZaakType>;
      const zaakTypeLinks = results.filter((result, index) => index !== 0) as Array<ZaakTypeLink>;

      return zaakTypeLinks
        .filter(zaakTypeLink => !!zaakTypeLink?.zaakTypeUrl)
        .map(zaakTypeLink => ({
          id: zaakTypeLink.zaakTypeUrl,
          text:
            zaakTypes.find(zaakType => zaakType.url === zaakTypeLink.zaakTypeUrl)?.omschrijving ||
            zaakTypeLink.zaakTypeUrl,
        }));
    }),
    tap(zaakTypeSelectItems => {
      this.prefillConfiguration$.pipe(take(1)).subscribe(prefillConfig => {
        const zaakTypeUrl = prefillConfig?.zaaktypeUrl;

        if (
          zaakTypeUrl &&
          !((zaakTypeSelectItems as Array<SelectItem>) || []).find(item => item.id === zaakTypeUrl)
        ) {
          this.selectedInputOption$.next('text');
        }
      });
    }),
    tap(() => {
      this.loading$.next(false);
    })
  );

  constructor(
    private readonly openZaakService: OpenZaakService,
    private readonly documentService: DocumentService,
    private readonly modalService: ModalService,
    private readonly pluginTranslatePipe: PluginTranslatePipe,
    private readonly iconService: IconService,
  ) {
    this.iconService.registerAll([Add16, TrashCan16])
  }

  ngOnInit(): void {
    this.openSaveSubscription();

    this.prefillConfiguration$
      .pipe(take(1))
      .subscribe(prefill => {
        ExtraPropertiesOptions.filter(property => !!prefill[property])
          .forEach(property => this.addCaseProperty(property))
      })
  }

  ngOnDestroy() {
    this.saveSubscription?.unsubscribe();
  }

  formValueChange(formValue: CreateZaakConfig): void {
    this._properties.forEach((value, key) => formValue[key] = value)

    const inputTypeZaakTypeToggle = formValue.inputTypeZaakTypeToggle;
    this.formValue$.next(formValue);
    this.handleValid(formValue);

    if (inputTypeZaakTypeToggle) {
      this.selectedInputOption$.next(inputTypeZaakTypeToggle);
    }
  }

  oneSelectItem(selectItems: Array<SelectItem>): boolean {
    if (Array.isArray(selectItems)) {
      return selectItems.length === 1;
    }

    return false;
  }

  selectItemsIncludeId(selectItems: Array<SelectItem>, id: string): boolean {
    if (Array.isArray(selectItems)) {
      return !!selectItems.find(item => item.id === id);
    }

    return false;
  }

  private handleValid(formValue: CreateZaakConfig): void {
    const isPropertyInvalid = this.propertyList
      .some(property => !!!formValue[property])
    const valid = !!(formValue.rsin && formValue.zaaktypeUrl) && !isPropertyInvalid;

    this.valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this.saveSubscription = this.save$?.subscribe(save => {
      combineLatest([this.formValue$, this.valid$])
        .pipe(take(1))
        .subscribe(([formValue, valid]) => {
          if (valid) {
            const payload: CreateZaakConfig = {
              rsin: formValue.rsin,
              zaaktypeUrl: formValue.zaaktypeUrl,
              manualZaakTypeUrl: formValue.manualZaakTypeUrl,
            }
            this.propertyList.forEach(property => payload[property] = formValue[property])
            this.configuration.emit(payload);
          }
        });
    });
  }

  public addCaseProperty(property: ExtraProperties): void {
    this.propertyList.push(property)
  }

  public removeCaseProperty(property: ExtraProperties): void {
    this.propertyList.splice(this.propertyList.indexOf(property), 1)
    this._properties.delete(property)
    this.onPropertyChanged(property, undefined)
  }

  public hasPropertyBeenAdded(property: ExtraProperties): boolean {
    return this.propertyList.indexOf(property) !== -1
  }

  public onPropertyChanged(property: ExtraProperties, value: any): void {
    this._properties.set(property, value)
    this.formValue$
      .pipe(
        filter(formValue => formValue !== null),
        take(1)
      ).subscribe(formValue => {
        this.formValueChange(formValue)
      })
  }
}
