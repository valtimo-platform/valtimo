/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {AfterViewInit, Component, EventEmitter, OnDestroy, Output, ViewChild} from '@angular/core';
import {ModalComponent as vModalComponent, ModalService} from '@valtimo/user-interface';
import {BehaviorSubject, combineLatest, map, Observable, Subscription} from 'rxjs';
import {take} from 'rxjs/operators';
import {ObjectManagementStateService} from '../../services/object-management-state.service';
import {FormManagementService} from '@valtimo/form-management';
import {PluginConfiguration, PluginManagementService} from '@valtimo/plugin';
import {ObjectManagementService} from '../../services/object-management.service';

@Component({
  selector: 'valtimo-object-management-add-modal',
  templateUrl: './object-management-add-modal.component.html',
  styleUrls: ['./object-management-add-modal.component.scss'],
})
export class ObjectManagementAddModalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('objectManagementAddModal') objectManagementAddModal: vModalComponent;
  @Output() createNoteEvent: EventEmitter<any> = new EventEmitter();

  readonly disabled$!: Observable<boolean>;
  readonly valid$ = new BehaviorSubject<boolean>(false);
  readonly showForm$: Observable<boolean> = this.modalService.modalVisible$;
  readonly formData$ = new BehaviorSubject<any>(null);

  showSubscription!: Subscription;
  hideSubscription!: Subscription;

  readonly selectedObjecttype$ = new BehaviorSubject<string | null>(null);

  readonly formDefinitions$: Observable<Array<{id: string; text: string}>> =
    this.formManagementService.queryFormDefinitions().pipe(
      map((results) =>
        results?.body?.content.map(configuration => ({
          id: configuration.id,
          text: configuration.name
        }))
      )
    );

  readonly configurationInstances$: Observable<Array<PluginConfiguration>> =
    this.pluginManagementService.getAllPluginConfigurations().pipe(
      map((configurations) => configurations
      )
    );

  readonly objectsApiConfigurations$: Observable<any> = this.configurationInstances$.pipe(
    map((configurations) => {
      const filteredObjectsApiConfigurations = configurations.filter(configuration => configuration?.pluginDefinition?.key === 'objectenapi');
      return filteredObjectsApiConfigurations.map(configuration => ({
        id: configuration.id,
        text: configuration.title,
      }))
      }
    )
  )

  readonly objecttypesApiConfigurations$: Observable<any> = this.configurationInstances$.pipe(
    map((configurations) => {
        const filteredObjecttypesApiConfigurations = configurations.filter(configuration => configuration?.pluginDefinition?.key === 'objecttypenapi');
        return filteredObjecttypesApiConfigurations.map(configuration => ({
          id: configuration.id,
          text: configuration.title,
          properties: configuration.properties
        }))
      }
    )
  )

  readonly objecttypesApiUrls$: Observable<any> = combineLatest([
    this.objecttypesApiConfigurations$,
    this.selectedObjecttype$
  ]).pipe(
    map(([objecttypesApi, selectedObjecttype]) =>
        objecttypesApi.map(objecttypes => ({
          id: objecttypes.id,
          text: objecttypes.properties.url
        }))
    )
  )

  constructor(
    private readonly objectManagementState: ObjectManagementStateService,
    private readonly objectManagementService: ObjectManagementService,
    private readonly formManagementService: FormManagementService,
    private readonly pluginManagementService: PluginManagementService,
    private readonly modalService: ModalService
  ) {}

  ngAfterViewInit(): void {
    this.openShowSubscription();
    this.openHideSubscription();
  }

  ngOnDestroy(): void {
    this.showSubscription?.unsubscribe();
    this.hideSubscription?.unsubscribe();
  }

  hide(): void {
    this.formData$.next(null);
    this.valid$.next(false);
    this.modalService.closeModal();
  }

  cancel(): void {
    this.hide();
  }

  save(): void {
    combineLatest([this.valid$, this.formData$])
      .pipe(take(1))
      .subscribe(([valid, formData]) => {
        if (valid) {
          this.objectManagementService.createObject({...formData}).subscribe(() => {
            this.objectManagementState.refresh();
            this.objectManagementState.hideModal();
          })
        }
      });
  }

  private openShowSubscription(): void {
    this.showSubscription = this.objectManagementState.showModal$.subscribe(() => {
      this.show();
    });
  }

  private openHideSubscription(): void {
    this.hideSubscription = this.objectManagementState.hideModal$.subscribe(() => {
      this.hide();
    });
  }

  private show(): void {
    this.objectManagementState.modalType$.pipe(take(1)).subscribe(modalType => {
      if (modalType === 'add') {
        this.modalService.openModal(this.objectManagementAddModal);
      }
    });
  }

  formValueChange(data: any): void {
    if (data.showInDataMenu === '') {
      data.showInDataMenu = false;
    }
    this.formData$.next(data);
    this.setValid(data);
  }

  private setValid(data: any): void {
    this.valid$.next(
      !!(
        data.title &&
        data.objectenApiPluginConfigurationId &&
        data.objecttypenApiPluginConfigurationId &&
        data.objecttypeId
      )
    );
  }

  selectObjectType(objecttype): void {
    this.selectedObjecttype$.next(objecttype);
  }

}
