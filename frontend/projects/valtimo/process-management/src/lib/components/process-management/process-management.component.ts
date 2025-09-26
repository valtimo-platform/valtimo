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
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {LoadingModule} from 'carbon-components-angular';
import {BehaviorSubject} from 'rxjs';
import {ProcessManagementService} from '../../services';
import {ProcessManagementBuilderComponent} from '../process-management-builder/process-management-builder.component';
import {ProcessManagementListComponent} from '../process-management-list/process-management-list.component';
import {ProcessManagementUploadComponent} from '../process-management-upload/process-management-upload.component';
import {CaseProcessInstance} from '../../models';

@Component({
  selector: 'valtimo-process-management',
  templateUrl: './process-management.component.html',
  styleUrls: ['./process-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ProcessManagementListComponent,
    ProcessManagementUploadComponent,
    ProcessManagementBuilderComponent,
    LoadingModule,
  ],
})
export class ProcessManagementComponent {
  public readonly selectedProcess$ = new BehaviorSubject<CaseProcessInstance | null>(null);
  public readonly paramsAreSet$ = new BehaviorSubject<boolean>(false);
  @Input() public set params(value: {documentDefinitionKey: string; versionTag: string} | null) {
    if (!value) return;

    this.processManagementService.setParams(value.documentDefinitionKey, value.versionTag);
    this.paramsAreSet$.next(true);
  }

  constructor(private readonly processManagementService: ProcessManagementService) {}

  public navigateBack(): void {
    this.selectedProcess$.next(null);
  }

  public onProcessSelected(process: CaseProcessInstance): void {
    console.log({process});
    this.selectedProcess$.next(process);
  }
}
