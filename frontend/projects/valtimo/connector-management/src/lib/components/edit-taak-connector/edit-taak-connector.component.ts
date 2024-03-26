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
import {editTaakConnectorForm} from './edit-taak-connector.form';
import {FormMappingService, FormTranslationService} from '@valtimo/form';
import {BehaviorSubject, combineLatest, Subject, Subscription, timer} from 'rxjs';
import {ConnectorProperties} from '@valtimo/config';
import {FormioForm, FormioRefreshValue} from '@formio/angular';
import {FormioOptions} from '@formio/angular/formio.common';
import {cloneDeep} from 'lodash';
import {TranslateService} from '@ngx-translate/core';
import {map, tap} from 'rxjs/operators';
import {ConnectorManagementService} from '../../services/connector-management/connector-management.service';
import {ConnectorManagementStateService} from '../../services/connector-management-state/connector-management-state.service';

/**
 * @deprecated Use the new plugin framework
 */
@Component({
  selector: 'valtimo-edit-taak-connector',
  templateUrl: './edit-taak-connector.component.html',
  styleUrls: ['./edit-taak-connector.component.scss'],
})
export class EditTaakConnectorComponent implements OnInit, OnChanges, OnDestroy {
  @Input() properties: ConnectorProperties;
  @Input() defaultName!: string;
  @Input() showDeleteButton = false;

  @Output() propertiesSave = new EventEmitter<{properties: ConnectorProperties; name: string}>();
  @Output() connectorDelete = new EventEmitter<any>();

  formRefresh$ = new Subject<FormioRefreshValue>();
  formDefinition$ = new BehaviorSubject<FormioForm>(undefined);
  translatedFormDefinition$ = this.formDefinition$.pipe(
    map(definition => this.formTranslationService.translateForm(definition))
  );

  readonly options: FormioOptions = {
    disableAlerts: true,
  };

  private formDefinitionSubscription!: Subscription;
  private translateSubscription!: Subscription;
  private deleteSubscription!: Subscription;

  constructor(
    private readonly formTranslationService: FormTranslationService,
    private readonly formMappingService: FormMappingService,
    private readonly translateService: TranslateService,
    private readonly connectorManagementService: ConnectorManagementService,
    private readonly stateService: ConnectorManagementStateService
  ) {}

  ngOnInit(): void {
    this.openFormDefinitionSubscription();
    this.openDeleteSubscription();
    this.formDefinition$.next(editTaakConnectorForm);
    this.loadConnectorNames();
    this.prefillForm();
    this.stateService.hideModalSaveButton();
  }

  ngOnChanges(): void {
    this.formDefinition$.next(editTaakConnectorForm);
    this.loadConnectorNames();
    this.prefillForm();
  }

  ngOnDestroy(): void {
    this.formDefinitionSubscription?.unsubscribe();
    this.translateSubscription?.unsubscribe();
    this.deleteSubscription?.unsubscribe();
  }

  onSubmit(event: any): void {
    const submission = event.data;
    const properties = cloneDeep(this.properties);

    properties.objectsApiConnectionName = submission.objectsApiConnectionName;
    properties.openNotificatieConnectionName = submission.openNotificatieConnectionName;

    this.propertiesSave.emit({properties, name: submission.connectorName});
  }

  onDelete(): void {
    this.stateService.disableInput();
    this.connectorDelete.emit();
  }

  private openFormDefinitionSubscription(): void {
    this.formDefinitionSubscription = combineLatest([
      this.formDefinition$,
      this.translateService.stream('key'),
    ]).subscribe(([form]) => {
      const translatedForm = this.formTranslationService.translateForm(form);
      this.refreshForm({form: translatedForm});
    });
  }

  private prefillForm(): void {
    timer(100)
      .pipe(
        tap(() => {
          if (this.defaultName !== undefined) {
            const properties = cloneDeep(this.properties);
            const submission: {[key: string]: any} = {};

            submission.objectsApiConnectionName = properties.objectsApiConnectionName;
            submission.openNotificatieConnectionName = properties.openNotificatieConnectionName;
            submission.connectorName = this.defaultName;

            this.refreshForm({submission: {data: submission}});
          }
        })
      )
      .subscribe();
  }

  private refreshForm(refreshValue: FormioRefreshValue): void {
    this.formRefresh$.next(refreshValue);
  }

  private loadConnectorNames(): void {
    this.connectorManagementService
      .getConnectorTypes()
      .pipe(
        tap(res => {
          res.forEach(connectorType => {
            if (connectorType.name === 'ObjectsApi') {
              this.loadConnectorNamesByType('objectApiConnectorNames', connectorType.id);
            } else if (connectorType.name === 'OpenNotificatie') {
              this.loadConnectorNamesByType('openNotificatieConnectorNames', connectorType.id);
            }
          });
        })
      )
      .subscribe();
  }

  private loadConnectorNamesByType(windowKey: string, connectorTypeId: string) {
    this.connectorManagementService
      .getConnectorInstancesByType(connectorTypeId)
      .pipe(map(res => (window[windowKey] = res.content.map(connector => connector.name))))
      .subscribe();
  }

  private openDeleteSubscription(): void {
    this.deleteSubscription = this.stateService.delete$.subscribe(() => {
      this.onDelete();
    });
  }
}
