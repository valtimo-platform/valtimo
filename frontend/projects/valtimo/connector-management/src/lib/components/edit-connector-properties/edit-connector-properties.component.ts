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

import {Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output} from '@angular/core';
import {
  ConnectorProperties,
  ConnectorPropertyEditField,
  ConnectorPropertyValueType,
} from '@valtimo/config';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {map, take} from 'rxjs/operators';
import {cloneDeep, get, set} from 'lodash';
import {ConnectorManagementStateService} from '../../services/connector-management-state/connector-management-state.service';

/**
 * @deprecated Use the new plugin framework
 */
@Component({
  selector: 'valtimo-edit-connector-properties',
  templateUrl: './edit-connector-properties.component.html',
  styleUrls: ['./edit-connector-properties.component.scss'],
})
export class EditConnectorPropertiesComponent implements OnInit, OnChanges, OnDestroy {
  @Input() properties: ConnectorProperties;
  @Input() withDefaults = false;
  @Input() showDeleteButton = false;
  @Input() showSaveButton = true;
  @Input() defaultName!: string;

  @Output() propertiesSave = new EventEmitter<{properties: ConnectorProperties; name: string}>();
  @Output() connectorDelete = new EventEmitter<any>();

  readonly disabled$!: Observable<boolean>;

  readonly modifiedProperties$ = new BehaviorSubject<ConnectorProperties>(undefined);

  readonly editFields$ = new BehaviorSubject<Array<ConnectorPropertyEditField>>([]);

  readonly connectorName$ = new BehaviorSubject<string>('');

  readonly saveButtonDisabled$ = this.stateService.saveButtonDisabled$;

  private saveButtonDisabledSubscription!: Subscription;
  private saveSubscription!: Subscription;
  private deleteSubscription!: Subscription;

  constructor(private readonly stateService: ConnectorManagementStateService) {
    this.disabled$ = this.stateService.inputDisabled$;
  }

  ngOnInit(): void {
    this.setEditFields();
    this.setName();
    this.openSaveButtonDisabledSubscription();
    this.openSaveSubscription();
    this.openDeleteSubscription();
    this.stateService.showModalSaveButton();
  }

  ngOnChanges(): void {
    this.setEditFields();
    this.setName();
  }

  ngOnDestroy(): void {
    this.saveButtonDisabledSubscription?.unsubscribe();
    this.saveSubscription?.unsubscribe();
    this.deleteSubscription?.unsubscribe();
  }

  multiFieldValuesSet(event: {editFieldKey: string; values: Array<string> | Array<number>}): void {
    this.modifiedProperties$.pipe(take(1)).subscribe(properties => {
      set(properties, event.editFieldKey, event.values);
      this.modifiedProperties$.next(properties);
    });
  }

  onSingleValueChange(value: any, editField: ConnectorPropertyEditField): void {
    this.modifiedProperties$.pipe(take(1)).subscribe(properties => {
      set(
        properties,
        editField.key,
        editField.editType === 'string' ? value.trim() : parseInt(value, 10)
      );
      this.modifiedProperties$.next(properties);
    });
  }

  onNameValueChange(value: string): void {
    this.connectorName$.next(value.trim());
  }

  onSave(): void {
    this.stateService.disableInput();

    combineLatest([this.modifiedProperties$, this.connectorName$])
      .pipe(take(1))
      .subscribe(([properties, name]) => {
        this.propertiesSave.emit({properties, name});
      });
  }

  onDelete(): void {
    this.stateService.disableInput();
    this.connectorDelete.emit();
  }

  private setName(): void {
    if (this.withDefaults && this.defaultName) {
      this.connectorName$.next(this.defaultName);
    } else {
      this.connectorName$.next('');
    }
  }

  private setModifiedProperties(editFields: Array<ConnectorPropertyEditField>): void {
    const propertiesCopy = cloneDeep(this.properties);

    if (!this.withDefaults) {
      editFields.forEach(editField => {
        set(propertiesCopy, editField.key, undefined);
      });
    }

    this.modifiedProperties$.next(propertiesCopy);
  }

  private setEditFields(): void {
    const editFields: Array<ConnectorPropertyEditField> = [];
    const keysToFilter = ['className'];

    const handlePropertyLevel = (propertyLevel: ConnectorProperties, previousKeys: string) => {
      const propertyLevelKeys = Object.keys(propertyLevel).filter(
        key => !keysToFilter.includes(key)
      );

      propertyLevelKeys.forEach(key => {
        const propertyValue = propertyLevel[key];
        const baseEditField = {
          key: previousKeys + key,
          ...(this.withDefaults && {defaultValue: propertyValue as ConnectorPropertyValueType}),
        };

        if (typeof propertyValue === 'number') {
          editFields.push({...baseEditField, editType: 'number'});
        } else if (Array.isArray(propertyValue)) {
          if (propertyValue[0] && typeof propertyValue[0] === 'number') {
            editFields.push({...baseEditField, editType: 'number[]'});
          } else {
            editFields.push({...baseEditField, editType: 'string[]'});
          }
        } else if (typeof propertyValue === 'string') {
          editFields.push({...baseEditField, editType: 'string'});
        } else if (typeof propertyValue === 'object') {
          handlePropertyLevel(propertyValue, `${previousKeys}${key}.`);
        }
      });
    };

    handlePropertyLevel(this.properties, '');

    this.editFields$.next(editFields);
    this.setModifiedProperties(editFields);
  }

  private openSaveButtonDisabledSubscription(): void {
    this.saveButtonDisabledSubscription = combineLatest([
      this.editFields$,
      this.modifiedProperties$,
      this.connectorName$,
    ])
      .pipe(
        map(([editFields, modifiedProperties, connectorName]) => {
          const values = editFields.map(field => get(modifiedProperties, field.key));
          const validValues = values.filter(value =>
            Array.isArray(value) ? value.length > 0 : value === 0 || value
          );
          const invalidProperties = editFields.length !== validValues.length || !connectorName;

          if (invalidProperties) {
            this.stateService.disableSaveButton();
          } else {
            this.stateService.enableSaveButton();
          }
        })
      )
      .subscribe();
  }

  private openSaveSubscription(): void {
    this.saveSubscription = this.stateService.save$.subscribe(() => {
      this.onSave();
    });
  }

  private openDeleteSubscription(): void {
    this.deleteSubscription = this.stateService.delete$.subscribe(() => {
      this.onDelete();
    });
  }
}
