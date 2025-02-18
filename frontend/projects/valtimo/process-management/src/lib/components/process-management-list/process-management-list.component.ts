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
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {Router} from '@angular/router';
import {Upload16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListModule, ColumnConfig} from '@valtimo/components';
import {ProcessDefinition, ProcessService} from '@valtimo/process';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {BehaviorSubject, startWith, switchMap, tap} from 'rxjs';
import {ProcessManagementStateService} from '../../services';

@Component({
  selector: 'valtimo-process-management-list',
  templateUrl: './process-management-list.component.html',
  styleUrls: ['./process-management-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ButtonModule, CarbonListModule, IconModule, TranslateModule],
})
export class ProcessManagementListComponent {
  public readonly loading$ = new BehaviorSubject<boolean>(true);

  public readonly reloadDefinitions$ = this.processManagementStateService.reloadDefinitions$;

  public readonly processDefinitions$ = this.reloadDefinitions$.pipe(
    startWith(null),
    switchMap(() =>
      this.processService.getProcessDefinitions().pipe(tap(() => this.loading$.next(false)))
    )
  );

  public readonly FIELDS: ColumnConfig[] = [
    {key: 'name', label: 'Name'},
    {key: 'key', label: 'Key'},
    {key: 'readOnly', label: 'Read-only'},
  ];

  constructor(
    private readonly processService: ProcessService,
    private readonly router: Router,
    private readonly iconService: IconService,
    private readonly processManagementStateService: ProcessManagementStateService
  ) {
    this.iconService.registerAll([Upload16]);
  }

  public editProcessDefinition(processDefinition: ProcessDefinition): void {
    this.router.navigate(['/processes/process', processDefinition.key]);
  }

  public openModal(): void {
    this.processManagementStateService.openModal();
  }

  public onCreateClick(): void {
    this.router.navigate(['create']);
  }
}
