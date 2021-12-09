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

import {Component, ElementRef, EventEmitter, OnInit, Output, ViewChild} from '@angular/core';
import {ProcessManagementService} from '../process-management.service';
import {AlertService} from '@valtimo/components';

@Component({
  selector: 'valtimo-process-management-upload',
  templateUrl: './process-management-upload.component.html',
  styleUrls: ['./process-management-upload.component.scss']
})
export class ProcessManagementUploadComponent implements OnInit {
  public bpmn: File | null = null;
  @Output() reload = new EventEmitter();
  @ViewChild('bpmnFile') bpmnFile: ElementRef;

  constructor(
    private processManagementService: ProcessManagementService,
    private alertService: AlertService
  ) { }

  ngOnInit() {
  }

  onChange(files: FileList): void {
    this.bpmn = files.item(0);
  }

  uploadProcessBpmn() {
    this.processManagementService.deployBpmn(this.bpmn).subscribe(() => {
      this.bpmn = null;
      this.bpmnFile.nativeElement.value = '';
      this.alertService.success('Deployment successful');
      this.reload.emit();
    }, error => {
      this.bpmn = null;
      this.bpmnFile.nativeElement.value = '';
      this.alertService.error(`Deployment failed. ${error}`);
    });
  }

}
