/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {CreateZaakConfig, InputOption} from '../../models';
import {OpenZaakService, ZaakType, ZaakTypeLink} from '@valtimo/resource';
import {ModalService, RadioValue, SelectItem} from '@valtimo/components';
import { CaseManagementParams, ManagementContext, TEST_IDS } from '@valtimo/shared';
import {PluginTranslatePipe} from '../../../../pipes';
import {Add16, TrashCan16} from '@carbon/icons';
import {IconService} from 'carbon-components-angular';
import {
  CreateZaakExtraProperties,
  CreateZaakExtraPropertyOptions,
} from '../../models/create-zaak-properties';
import {GEOMETRY_TYPES} from '../../models/geometry-types';
import {PAYMENT_INDICATION_TYPES} from '../../models/payment-indication-types';

@Component({
  standalone: false,
  selector: 'valtimo-create-zaak-configuration',
  templateUrl: './create-zaak-configuration.component.html',
  styleUrls: ['./create-zaak-configuration.component.scss'],
  providers: [PluginTranslatePipe],
})
export class CreateZaakConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  readonly TEST_IDS = TEST_IDS;

  @Input() context$: Observable<[ManagementContext, CaseManagementParams]>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() save$: Observable<void>;
  @Input() prefillConfiguration$: Observable<CreateZaakConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<CreateZaakConfig> = new EventEmitter<CreateZaakConfig>();

  public readonly propertyOptions: string[] = Object.values(CreateZaakExtraPropertyOptions);
  public readonly propertyList: Array<CreateZaakExtraProperties> = [];
  public readonly geometryTypes: string[] = GEOMETRY_TYPES;
  public readonly paymentIndicationTypes: string[] = PAYMENT_INDICATION_TYPES;

  public readonly pluginId$ = new BehaviorSubject<string>('');
  public readonly selectedInputOption$ = new BehaviorSubject<InputOption>('selection');
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly inputTypeOptions$: Observable<Array<RadioValue>> = this.pluginId$.pipe(
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
  public readonly zaakTypeItems$: Observable<Array<SelectItem>> = this.modalService.modalData$.pipe(
    switchMap(() => this.context$),
    tap(([context]) => {
      if (context === 'independent' || context === 'buildingBlock') {
        this.selectedInputOption$.next('text');
        this.loading$.next(false);
      }
    }),
    filter(([context]) => context === 'case'),
    switchMap(([context, params]) =>
      combineLatest([
        this.openZaakService.getZaakTypes(),
        context === 'case'
          ? this.openZaakService.getZaakTypeLink(
              params.caseDefinitionKey,
              params.caseDefinitionVersionTag
            )
          : null,
      ])
    ),
    map(results => {
      const zaakTypes = results[0] as Array<ZaakType>;
      const zaakTypeLink = results[1] as ZaakTypeLink;

      return [zaakTypeLink]
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

  protected readonly CASE_GEOMETRY_TYPE: string = 'caseGeometryType';
  protected readonly CASE_GEOMETRY_COORDINATES: string = 'caseGeometryCoordinates';
  protected readonly PAYMENT_INDICATION_TYPE: string = 'paymentIndication';

  private readonly _formValue$ = new BehaviorSubject<CreateZaakConfig>(null);
  private readonly _properties = new Map<CreateZaakExtraProperties, string>();
  private saveSubscription!: Subscription;
  private readonly _valid$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly openZaakService: OpenZaakService,
    private readonly modalService: ModalService,
    private readonly pluginTranslatePipe: PluginTranslatePipe,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Add16, TrashCan16]);
  }

  public ngOnInit(): void {
    this.openSaveSubscription();

    this.prefillConfiguration$.pipe(take(1)).subscribe(prefill => {
      CreateZaakExtraPropertyOptions.filter(property => prefill && !!prefill[property]).forEach(
        property => this.addProperty(property)
      );
    });
  }

  public ngOnDestroy(): void {
    this.saveSubscription?.unsubscribe();
  }

  public onFormValueChanged(formValue: CreateZaakConfig): void {
    const inputTypeZaakTypeToggle = formValue?.inputTypeZaakTypeToggle;
    this._properties.forEach((value, key) => (formValue[key] = value));
    this._formValue$.next(formValue);
    this.handleValid(formValue);

    if (inputTypeZaakTypeToggle) {
      this.selectedInputOption$.next(inputTypeZaakTypeToggle);
    }
  }

  public oneSelectItem(selectItems: Array<SelectItem>): boolean {
    if (Array.isArray(selectItems)) {
      return selectItems.length === 1;
    }
    return false;
  }

  public selectItemsIncludeId(selectItems: Array<SelectItem>, id: string): boolean {
    if (Array.isArray(selectItems)) {
      return !!selectItems.find(item => item.id === id);
    }
    return false;
  }

  public prefillValueFor(property: string, prefill: CreateZaakConfig): string | null {
    return prefill !== null ? (prefill?.[property] ?? null) : null;
  }

  public translationKeyFor(property: string): string {
    return property === 'description' ? 'beschrijving' : property;
  }

  public translationKeyForPropertyList(property: string): string {
    return property === this.CASE_GEOMETRY_TYPE ? 'caseGeometry' : this.translationKeyFor(property);
  }

  public addProperty(property: CreateZaakExtraProperties): void {
    // only add the property to the list if it is not in the list
    if (this.propertyList.indexOf(property) === -1) {
      this.propertyList.push(property);
    }
    if (property === this.CASE_GEOMETRY_TYPE) {
      this.addProperty(this.CASE_GEOMETRY_COORDINATES as CreateZaakExtraProperties);
    }
  }

  public removeProperty(property: CreateZaakExtraProperties): void {
    // only remove the property from the list if it is in the list
    if (this.propertyList.indexOf(property) !== -1) {
      this.propertyList.splice(this.propertyList.indexOf(property), 1);
      this.onPropertyChanged(property, undefined);
    }
    if (property === this.CASE_GEOMETRY_TYPE) {
      this.removeProperty(this.CASE_GEOMETRY_COORDINATES as CreateZaakExtraProperties);
    }
  }

  public hasPropertyBeenAdded(property: CreateZaakExtraProperties): boolean {
    return this.propertyList.indexOf(property) !== -1;
  }

  public onPropertyChanged(property: CreateZaakExtraProperties, value: any): void {
    this._properties.set(property, value);
    this._formValue$
      .pipe(
        filter(formValue => formValue !== null),
        take(1)
      )
      .subscribe(formValue => {
        this.onFormValueChanged(formValue);
      });
  }

  private handleValid(formValue: CreateZaakConfig): void {
    const isPropertyInvalid = this.propertyList.some(property => !!!formValue[property]);
    const valid = !!(formValue.rsin && formValue.zaaktypeUrl) && !isPropertyInvalid;

    this._valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this.saveSubscription = this.save$?.subscribe(() => {
      combineLatest([this._formValue$, this._valid$])
        .pipe(take(1))
        .subscribe(([formValue, valid]) => {
          if (valid) {
            const payload: CreateZaakConfig = {
              rsin: formValue.rsin,
              zaaktypeUrl: formValue.zaaktypeUrl,
              manualZaakTypeUrl: formValue.manualZaakTypeUrl,
            };
            this.propertyList.forEach(property => (payload[property] = formValue[property]));
            this.configuration.emit(payload);
          }
        });
    });
  }
}
