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
import {BehaviorSubject, combineLatest, Observable, Subscription, take} from 'rxjs';
import {IconService} from 'carbon-components-angular';
import {Add16, TrashCan16} from '@carbon/icons';
import {PatchZaakConfig, PatchZaakNotitieConfig, PropertyFormField} from '../../models';
import {PatchZaakProperties, PatchZaakPropertyOptions} from '../../models/patch-zaak-properties';
import {GEOMETRY_TYPES} from '../../models/geometry-types';
import {PAYMENT_INDICATION_TYPES} from '../../models/payment-indication-types';

@Component({
  standalone: false,
  selector: 'valtimo-patch-zaak-configuration',
  templateUrl: './patch-zaak-configuration.component.html',
  styleUrl: './patch-zaak-configuration.component.scss',
})
export class PatchZaakConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() save$: Observable<void>;
  @Input() prefillConfiguration$: Observable<PatchZaakConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<PatchZaakConfig> = new EventEmitter<PatchZaakConfig>();

  public readonly propertyOptions: string[] = Object.values(PatchZaakPropertyOptions);
  public readonly propertyList: Array<PropertyFormField> = [];
  public readonly geometryTypes: string[] = GEOMETRY_TYPES;
  public readonly paymentIndicationTypes: string[] = PAYMENT_INDICATION_TYPES;

  protected readonly CASE_GEOMETRY_TYPE: string = 'caseGeometryType';
  protected readonly CASE_GEOMETRY_COORDINATES: string = 'caseGeometryCoordinates';
  protected readonly PAYMENT_INDICATION_TYPE: string = 'paymentIndication';

  private readonly _formValue$ = new BehaviorSubject<PatchZaakConfig>({});
  private readonly _properties = new Map<PatchZaakProperties, string>();
  private _saveSubscription!: Subscription;
  private readonly _valid$ = new BehaviorSubject<boolean>(false);

  constructor(private readonly iconService: IconService) {
    this.iconService.registerAll([Add16, TrashCan16]);
  }

  public ngOnInit(): void {
    this.initPropertyList();
    this.openSaveSubscription();
  }

  public ngOnDestroy(): void {
    this._saveSubscription?.unsubscribe();
  }

  public onFormValueChanged(formValue: PatchZaakConfig): void {
    this._formValue$.next(formValue);
    this.handleValid(formValue);
  }

  public onPropertyChanged(property: PatchZaakProperties, value: any): void {
    this._properties.set(property, value);
    const formValue = this._formValue$.value;
    this._properties.forEach((value, key) => {
      formValue[key] = value;
    });
    this.onFormValueChanged(formValue);
  }

  public addProperty(property: PatchZaakProperties): void {
    if (!this.hasPropertyBeenAdded(property)) {
      this.propertyList.push(this.propertyFormFieldFor(property));
      this.onPropertyChanged(property, undefined);
    }
    // add linked field coordinates
    if (property === this.CASE_GEOMETRY_TYPE) {
      this.addProperty(this.CASE_GEOMETRY_COORDINATES as PatchZaakProperties);
    }
  }

  public removeProperty(property: PatchZaakProperties): void {
    if (this.hasPropertyBeenAdded(property)) {
      this.propertyList.splice(
        this.propertyList.findIndex(item => item.name === property),
        1
      );
      this.onPropertyChanged(property, undefined);
    }
    // remove linked field coordinates
    if (property === this.CASE_GEOMETRY_TYPE) {
      this.removeProperty(this.CASE_GEOMETRY_COORDINATES as PatchZaakProperties);
    }
  }

  public hasPropertyBeenAdded(property: PatchZaakProperties): boolean {
    return this.propertyList.findIndex(item => item.name === property) !== -1;
  }

  public prefillValueFor(
    property: PatchZaakProperties,
    prefill: PatchZaakNotitieConfig
  ): string | null {
    return prefill != null ? prefill[property] : null;
  }

  public translationKeyForPropertyList(property: PatchZaakProperties): string {
    return property === this.CASE_GEOMETRY_TYPE ? 'caseGeometry' : this.translationKeyFor(property);
  }

  private initPropertyList(): void {
    this.prefillConfiguration$.pipe(take(1)).subscribe(prefill => {
      if (prefill) {
        PatchZaakPropertyOptions.forEach(property => {
          if (!!prefill[property]) this.addProperty(property);
        });
      }
    });
  }

  private propertyFormFieldFor(property: PatchZaakProperties): PropertyFormField {
    return {
      name: property,
      translationKey: this.translationKeyFor(property),
      tooltipTranslationKey: this.tooltipTranslationKeyFor(property),
      presetOptions: this.presetOptionsForProperty(property),
    };
  }

  private translationKeyFor(property: PatchZaakProperties): string {
    return property === 'description' ? 'omschrijving' : property;
  }

  private tooltipTranslationKeyFor(property: PatchZaakProperties): string | null {
    if (property.includes('Date')) {
      return 'dateformatTooltip';
    } else if (property === this.CASE_GEOMETRY_COORDINATES) {
      return `${property}Tooltip`;
    }
    return null;
  }

  private presetOptionsForProperty(property: PatchZaakProperties): string[] {
    switch (property) {
      case this.CASE_GEOMETRY_TYPE:
        return this.geometryTypes;
      case this.PAYMENT_INDICATION_TYPE:
        return this.paymentIndicationTypes;
      default:
        return [];
    }
  }

  private handleValid(formValue: PatchZaakConfig): void {
    const isPropertyInvalid = this.propertyList.some(property => !!!formValue[property.name]);
    const valid = !isPropertyInvalid;
    this._valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this._saveSubscription = this.save$?.subscribe(save => {
      combineLatest([this._formValue$, this._valid$])
        .pipe(take(1))
        .subscribe(([formValue, valid]) => {
          if (valid) {
            this.configuration.emit(formValue);
          }
        });
    });
  }
}
