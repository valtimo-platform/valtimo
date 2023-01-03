/*
 * Copyright 2015-2021 Ritense BV, the Netherlands.
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
import {editProductAanvragenConnectorForm} from './edit-product-aanvragen-connector.form';
import {FormMappingService, FormTranslationService} from '@valtimo/form';
import {DocumentDefinition, DocumentService} from '@valtimo/document';
import {ExtendedComponentSchema} from 'formiojs';
import {BehaviorSubject, combineLatest, Subject, Subscription} from 'rxjs';
import {ConnectorProperties} from '@valtimo/config';
import {FormioForm, FormioRefreshValue} from '@formio/angular';
import {FormioOptions} from '@formio/angular/formio.common';
import {cloneDeep} from 'lodash';
import {TranslateService} from '@ngx-translate/core';
import {map, switchMap, tap} from 'rxjs/operators';
import {ConnectorManagementService} from '../../services/connector-management/connector-management.service';
import {ConnectorManagementStateService} from '../../services/connector-management-state/connector-management-state.service';

@Component({
  selector: 'valtimo-edit-product-aanvragen-connector',
  templateUrl: './edit-product-aanvragen-connector.component.html',
  styleUrls: ['./edit-product-aanvragen-connector.component.scss'],
})
export class EditProductAanvragenConnectorComponent implements OnInit, OnChanges, OnDestroy {
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
  caseDefinitionOptions: Array<{label: string; value: string}> = [];
  processDocumentDefinitionOptions: {[caseDefinitionId: string]: Array<string>} = {};

  readonly options: FormioOptions = {
    disableAlerts: true,
  };

  private formDefinitionSubscription!: Subscription;
  private translateSubscription!: Subscription;
  private deleteSubscription!: Subscription;

  constructor(
    private readonly formTranslationService: FormTranslationService,
    private readonly formMappingService: FormMappingService,
    private readonly documentService: DocumentService,
    private readonly translateService: TranslateService,
    private readonly connectorManagementService: ConnectorManagementService,
    private readonly stateService: ConnectorManagementStateService
  ) {}

  ngOnInit(): void {
    window['productRequestDefinitions'] = {};
    this.openFormDefinitionSubscription();
    this.openDeleteSubscription();
    this.formDefinition$.next(editProductAanvragenConnectorForm);
    this.loadConnectorNames();
    this.loadDefinitions();
    this.stateService.hideModalSaveButton();
  }

  ngOnChanges(): void {
    this.formDefinition$.next(editProductAanvragenConnectorForm);
    this.loadConnectorNames();
    this.loadDefinitions();
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
    properties.aanvragerRolTypeUrl = submission.applicantRoleTypeUrl;
    properties.typeMapping = submission.productAanvraagTypes;

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
    const properties = cloneDeep(this.properties);
    const submission: {[key: string]: string} = {};

    submission.objectsApiConnectionName = properties.objectsApiConnectionName;
    submission.openNotificatieConnectionName = properties.openNotificatieConnectionName;
    submission.applicantRoleTypeUrl = properties.aanvragerRolTypeUrl;
    submission.productAanvraagTypes = properties.typeMapping;
    submission.connectorName = this.defaultName;

    this.refreshForm({submission: {data: submission}});
  }

  private mapCaseDefinitionKeyComponent = (
    component: ExtendedComponentSchema
  ): ExtendedComponentSchema => {
    if (component.key === 'caseDefinitionKey') {
      return {...component, disabled: false, data: {values: this.caseDefinitionOptions}};
    }

    return component;
  };

  private refreshForm(refreshValue: FormioRefreshValue): void {
    this.formRefresh$.next(refreshValue);
  }

  private loadDefinitions(): void {
    let documentDefinitions: Array<DocumentDefinition>;

    this.documentService
      .getAllDefinitions()
      .pipe(
        tap(resDocumentDefinitions => (documentDefinitions = resDocumentDefinitions.content)),
        switchMap(resDocumentDefinitions =>
          combineLatest(
            resDocumentDefinitions.content.map(definition =>
              this.documentService.findProcessDocumentDefinitions(definition.id.name)
            )
          )
        ),
        tap(res => {
          this.caseDefinitionOptions = documentDefinitions.map(documentDefinition => ({
            label: documentDefinition.id.name,
            value: documentDefinition.id.name,
          }));

          documentDefinitions.forEach((documentDefinition, index) => {
            this.processDocumentDefinitionOptions[documentDefinition.id.name] = res[index].map(
              processDocumentDefinition => processDocumentDefinition.id.processDefinitionKey
            );
          });

          window['productRequestDefinitions'] = this.processDocumentDefinitionOptions;

          const definitionWithCaseDefinitionOptions = this.formMappingService.mapComponents(
            this.formDefinition$.getValue(),
            this.mapCaseDefinitionKeyComponent
          );

          this.formDefinition$.next(definitionWithCaseDefinitionOptions);

          if (this.properties?.aanvragerRolTypeUrl) {
            this.prefillForm();
          }
        })
      )
      .subscribe();
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
