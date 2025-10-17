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
import {PatchZaakNotitieConfig} from '../../models';
import {PatchZaakNotitieProperties, PatchZaakNotitiePropertyOptions} from '../../models/patch-zaaknotitie-properties';
import {ZAAKNOTIFICATIE_TYPES} from '../../models/zaaknotificatie-types';
import {ZAAKNOTIFICATIE_STATUSES} from '../../models/zaaknotificatie-statuses';

@Component({
  standalone: false,
  selector: 'valtimo-patch-zaaknotitie-configuration',
  templateUrl: './patch-zaaknotitie-configuration.component.html',
  styleUrls: ['./patch-zaaknotitie-configuration.component.scss'],
})
export class PatchZaaknotitieConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() prefillConfiguration$: Observable<PatchZaakNotitieConfig>;
  @Input() pluginId: string;

  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<PatchZaakNotitieConfig> =
    new EventEmitter<PatchZaakNotitieConfig>();

  public readonly propertyOptions: string[] = Object.values(PatchZaakNotitiePropertyOptions);
  public readonly propertyList: Array<PatchZaakNotitieProperties> = [];
  public readonly statusOptions: string[] = ZAAKNOTIFICATIE_STATUSES
  public readonly notitieTypeOptions: string[] = ZAAKNOTIFICATIE_TYPES

  private readonly _formValue$ = new BehaviorSubject<PatchZaakNotitieConfig | null>(null);
  private readonly _properties = new Map<PatchZaakNotitieProperties, string>();
  private readonly _valid$ = new BehaviorSubject<boolean>(false);
  private _saveSubscription!: Subscription;

  constructor(private readonly iconService: IconService) {
    this.iconService.registerAll([Add16, TrashCan16]);
  }

  public ngOnInit(): void {
    this.openSaveSubscription();
    this.prefillConfiguration$.pipe(take(1)).subscribe(prefill => {
      if (prefill) {
        PatchZaakNotitiePropertyOptions.filter(property => !!prefill[property]).forEach(property =>
          this.addProperty(property)
        );
      }
    });
  }

  public ngOnDestroy(): void {
    this._saveSubscription?.unsubscribe();
  }

  public onFormValueChanged(value: PatchZaakNotitieConfig): void {
    this._formValue$.next(value);
    this.handleValid(value);
  }

  public onPropertyChanged(property: PatchZaakNotitieProperties, value: any): void {
    this._properties.set(property, value);
    const formValue = this._formValue$.value;
    this._properties.forEach((value, key) => {
      formValue[key] = value;
    });
    this.onFormValueChanged(formValue);
  }

  public prefillValueFor(property: string, prefill: PatchZaakNotitieConfig): string | null {
    return prefill != null ? prefill[property] : null;
  }

  public translationKeyFor(property: string): string {
    return property;
  }

  public translationKeyForPropertyList(property: string): string {
    return this.translationKeyFor(property);
  }

  public addProperty(property: PatchZaakNotitieProperties): void {
    // only add the property to the list if it is not in the list
    if (this.propertyList.indexOf(property) == -1) {
      this.propertyList.push(property);
      this.onPropertyChanged(property, undefined);
    }
  }

  public removeProperty(property: PatchZaakNotitieProperties): void {
    // only remove the property from the list if it is in the list
    if (this.propertyList.indexOf(property) != -1) {
      this.propertyList.splice(this.propertyList.indexOf(property), 1);
      this.onPropertyChanged(property, undefined);
    }
  }

  public hasPropertyBeenAdded(property: PatchZaakNotitieProperties): boolean {
    return this.propertyList.indexOf(property) !== -1;
  }

  public inputTypeForProperty(property): string {
    switch (property) {
      case 'tekst':
        return 'textarea';
      default:
        return 'text';
    }
  }

  public presetOptionsForProperty(property: string): string[] {
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
    const isPropertyInvalid = this.propertyList.some(property => !!!formValue[property]);
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
            const payload: PatchZaakNotitieConfig = {};
            this.propertyList.forEach(property => (payload[property] = formValue[property]));
            this.configuration.emit(formValue);
          }
        });
    });
  }
}
