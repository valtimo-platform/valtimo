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
import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {Router} from '@angular/router';
import {Upload16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {ActionItem, CarbonListModule, ColumnConfig, ViewType} from '@valtimo/components';
import {ProcessDefinition, ProcessService} from '@valtimo/process';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {
  BehaviorSubject,
  Observable,
  Subject,
  filter,
  map,
  startWith,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {ProcessManagementStateService, ProcessManagementApiService} from '../../services';

@Component({
  selector: 'valtimo-process-management-list',
  templateUrl: './process-management-list.component.html',
  styleUrls: ['./process-management-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ButtonModule, CarbonListModule, IconModule, IconModule, TranslateModule],
  providers: [ProcessManagementApiService],
})
export class ProcessManagementListComponent {
  private readonly _params$ = new BehaviorSubject<{
    documentDefinitionKey: string;
    versionTag: string;
  } | null>(null);
  @Input() public set params(value: {documentDefinitionKey: string; versionTag: string} | null) {
    if (!value) return;

    this._params$.next(value);
  }
  @Output() public readonly processSelected = new EventEmitter<ProcessDefinition | 'create'>();

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'Delete',
      callback: this.onDeleteProcess.bind(this),
      type: 'danger',
    },
  ];

  // public readonly reloadDefinitions$ = this.processManagementStateService.reloadDefinitions$;

  public readonly processDefinitions$: Observable<any[]> = this._params$.pipe(
    filter(params => !!params),
    switchMap(params => {
      this.processManagementApiService.setParams(
        params?.documentDefinitionKey ?? '',
        params?.versionTag ?? ''
      );

      return this.processManagementApiService.getProcesses();
    }),
    map(res => res.map(i => ({...i.processDefinition, data: i}))),
    tap(() => this.loading$.next(false))
  );

  public readonly FIELDS: ColumnConfig[] = [
    {key: 'name', label: 'Name'},
    {key: 'key', label: 'Key'},
    {key: 'readOnly', label: 'Read-only', viewType: ViewType.BOOLEAN},
  ];

  constructor(
    private readonly processManagementApiService: ProcessManagementApiService,
    private readonly processManagementStateService: ProcessManagementStateService,
    private readonly processService: ProcessService,
    private readonly router: Router,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Upload16]);
  }

  public editProcessDefinition(processDefinition: any): void {
    this.processSelected.emit(processDefinition.data);
    // this.router.navigate(['/processes/process', processDefinition.key]);
  }

  public openModal(): void {
    this.processManagementStateService.openModal();
  }

  public onCreateProcess(): void {
    this.processSelected.emit('create');
    // this.router.navigate(['create']);
  }

  public onDeleteProcess(processDefinition: any): void {
    this.processManagementApiService.deleteProcess(processDefinition.id).pipe(take(1)).subscribe();
  }
}
