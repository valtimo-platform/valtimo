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
import {PatchZaakNotitieConfig, PropertyFormField} from '../../models';
import {
  PatchZaakNotitieProperties,
  PatchZaakNotitiePropertyOptions,
} from '../../models/patch-zaaknotitie-properties';
import {ZAAKNOTIFICATIE_TYPES} from '../../models/zaaknotificatie-types';
import {ZAAKNOTIFICATIE_STATUSES} from '../../models/zaaknotificatie-statuses';

@Component({
  standalone: false,
  selector: 'valtimo-patch-zaaknotitie-configuration',
  templateUrl: './patch-zaaknotitie-configuration.component.html',
  styleUrls: ['./patch-zaaknotitie-configuration.component.scss'],
})
export class PatchZaakNotitieConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() save$: Observable<void>;
  @Input() prefillConfiguration$: Observable<PatchZaakNotitieConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<PatchZaakNotitieConfig> =
    new EventEmitter<PatchZaakNotitieConfig>();

  public readonly propertyOptions: string[] = Object.values(PatchZaakNotitiePropertyOptions);
  public readonly propertyList: Array<PropertyFormField> = [];
  public readonly statusOptions: string[] = ZAAKNOTIFICATIE_STATUSES;
  public readonly notitieTypeOptions: string[] = ZAAKNOTIFICATIE_TYPES;

  private readonly _formValue$ = new BehaviorSubject<PatchZaakNotitieConfig>({
    zaakNotitieUrl: undefined,
  });
  private readonly _properties = new Map<PatchZaakNotitieProperties, string>();
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

  public onFormValueChanged(formValue: PatchZaakNotitieConfig): void {
    const _formValue = this.formValueIncludingProperties(formValue);
    this._formValue$.next(_formValue);
    this.handleValid(_formValue);
  }

  public onPropertyChanged(property: PatchZaakNotitieProperties, value: any): void {
    this._properties.set(property, value);
    this.onFormValueChanged(this._formValue$.getValue());
  }

  public addProperty(property: PatchZaakNotitieProperties): void {
    if (!this.hasPropertyBeenAdded(property)) {
      this.propertyList.push(this.propertyFormFieldFor(property));
      this.onPropertyChanged(property, undefined);
    }
  }

  public removeProperty(property: PatchZaakNotitieProperties): void {
    if (this.hasPropertyBeenAdded(property)) {
      this.propertyList.splice(
        this.propertyList.findIndex(item => item.name === property),
        1
      );
      this.onPropertyChanged(property, undefined);
    }
  }

  public hasPropertyBeenAdded(property: PatchZaakNotitieProperties): boolean {
    return this.propertyList.findIndex(item => item.name === property) !== -1;
  }

  public prefillValueFor(
    property: PatchZaakNotitieProperties,
    prefill: PatchZaakNotitieConfig
  ): string | null {
    return prefill !== null ? prefill[property] : null;
  }

  private initPropertyList(): void {
    this.prefillConfiguration$.pipe(take(1)).subscribe(prefill => {
      if (prefill) {
        PatchZaakNotitiePropertyOptions.forEach(property => {
          if (!!prefill[property]) this.addProperty(property);
        });
      }
    });
  }

  private formValueIncludingProperties(formValue: PatchZaakNotitieConfig): PatchZaakNotitieConfig {
    this._properties.forEach((value, key) => {
      formValue[key] = value;
    });
    return formValue;
  }

  private propertyFormFieldFor(property: PatchZaakNotitieProperties): PropertyFormField {
    return {
      type: this.inputTypeForProperty(property),
      name: property,
      translationKey: this.translationKeyFor(property),
      presetOptions: this.presetOptionsForProperty(property),
    };
  }

  private inputTypeForProperty(property: PatchZaakNotitieProperties): string {
    switch (property) {
      case 'tekst':
        return 'textarea';
      default:
        return 'text';
    }
  }

  private translationKeyFor(property: string): string {
    return property;
  }

  private translationKeyForPropertyList(property: PatchZaakNotitieProperties): string {
    return this.translationKeyFor(property);
  }

  private presetOptionsForProperty(property: PatchZaakNotitieProperties): string[] {
    switch (property) {
      case 'notitieType':
        return this.notitieTypeOptions;
      case 'status':
        return this.statusOptions;
      default:
        return [];
    }
  }

  private handleValid(formValue: PatchZaakNotitieConfig): void {
    const isPropertyInvalid = this.propertyList.some(property => !!!formValue[property.name]);
    const valid = !isPropertyInvalid;
    this._valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this._saveSubscription = this.save$.subscribe(save => {
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
