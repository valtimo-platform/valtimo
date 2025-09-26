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

import {
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import {ProcessDefinition, ProcessService} from '@valtimo/process';

import BpmnJS from 'bpmn-js/dist/bpmn-navigated-viewer.production.min.js';
import {ActivatedRoute} from '@angular/router';
import {combineLatest} from 'rxjs';
import {map} from 'rxjs/operators';
import {PageTitleService} from '@valtimo/components';

@Component({
  selector: 'valtimo-form-link-process-diagram',
  templateUrl: './form-link-process-diagram.component.html',
  styleUrls: ['./form-link-process-diagram.component.scss'],
})
export class FormLinkProcessDiagramComponent implements OnInit, OnDestroy {
  private bpmnJS: BpmnJS;

  @ViewChild('ref') public el: ElementRef;
  @Output() public bpmnElementModalOpen: EventEmitter<any> = new EventEmitter();
  @Output() public bpmnElementModalClose: EventEmitter<any> = new EventEmitter();

  public processDefinitionKey: string;
  public processDefinitions: ProcessDefinition[];
  public processDiagram: any;
  public processDefinition: ProcessDefinition;
  public processDefinitionVersions: ProcessDefinition[];
  public version: number;
  private callbacksAdded = false;
  private processDefinitionId!: string;

  constructor(
    private readonly processService: ProcessService,
    private readonly route: ActivatedRoute,
    private readonly pageTitleService: PageTitleService
  ) {}

  ngOnInit() {
    this.pageTitleService.disableReset();
    combineLatest([this.route.queryParams, this.processService.getProcessDefinitions()])
      .pipe(map(([queryParams, processDefinitions]) => ({queryParams, processDefinitions})))
      .subscribe(response => {
        this.processDefinitions = response.processDefinitions;
        if (response.queryParams.process) {
          this.processDefinitionKey = response.queryParams.process;
          this.loadProcessDefinitionFromKey(this.processDefinitionKey);
          this.bpmnElementModalOpen.emit({
            element: {
              id: 'start-event',
              type: 'bpmn:StartEvent',
            },
            processDefinitionKey: this.processDefinitionKey,
            processDefinitionId: this.processDefinitionId,
          });
        }
        if (!this.processDefinitionKey && response.processDefinitions.length !== 0) {
          this.processDefinitionKey = response.processDefinitions[0].key;
          this.loadProcessDefinitionFromKey(this.processDefinitionKey);
        }
      });
    this.bpmnJS = new BpmnJS();
    this.bpmnJS.on('import.done', ({error}: any) => {
      if (!error) {
        const canvas = this.bpmnJS.get('canvas');
        const eventBus = this.bpmnJS.get('eventBus');
        canvas.zoom('fit-viewport', 'auto');

        if (this.processDefinitionVersions && !this.callbacksAdded) {
          eventBus.on('element.click', e => {
            let activityListenerType = e.element.businessObject.$type;
            if (activityListenerType === 'bpmn:UserTask') {
              activityListenerType += ':create';
            } else {
              activityListenerType += ':start';
            }

            this.bpmnElementModalOpen.emit({
              element: {
                id: e.element.businessObject.id,
                type: e.element.businessObject.$type,
                activityListenerType,
                name: e.element?.businessObject?.name,
              },
              processDefinitionKey: this.processDefinitionKey,
              processDefinitionId: this.processDefinitionId,
            });
          });
          this.callbacksAdded = true;
        }
      }
    });
  }

  ngOnDestroy() {
    this.bpmnElementModalClose.emit();
    if (this.bpmnJS) {
      this.bpmnJS.destroy();
    }
    this.pageTitleService.enableReset();
  }

  public loadProcessDefinition(processDefinitionKey: string): void {
    this.processService
      .getProcessDefinition(processDefinitionKey)
      .subscribe((processDefinition: ProcessDefinition) => {
        this.processDefinitionId = processDefinition.id;
        this.version = processDefinition.version;
        this.loadProcessDefinitionXml(processDefinition.id);
      });
  }

  public loadProcessDefinitionVersions(processDefinitionKey: string): void {
    this.processService
      .getProcessDefinitionVersions(processDefinitionKey)
      .subscribe((processDefinitionVersions: ProcessDefinition[]) => {
        this.processDefinitionVersions = processDefinitionVersions;
      });
  }

  public loadProcessDefinitionFromKey(processDefinitionKey: string): void {
    this.loadProcessDefinitionVersions(processDefinitionKey);
    this.loadProcessDefinition(processDefinitionKey);
  }

  public loadProcessDefinitionXml(processDefinitionId: string): void {
    this.processService.getProcessDefinitionXml(processDefinitionId).subscribe(response => {
      this.processDiagram = response;
      this.bpmnJS.importXML(this.processDiagram.bpmn20Xml);
      this.bpmnJS.attachTo(this.el.nativeElement);
    });
  }

  public setProcessDefinitionKey(processDefinitionKey: string): void {
    this.processDefinitionKey = processDefinitionKey;
    this.loadProcessDefinitionFromKey(this.processDefinitionKey);
  }

  public setProcessDefinitionVersion(version: string): void {
    const processDefinitionId = this.processDefinitionVersions.find(
      definition => definition.version === +version
    )?.id;

    if (processDefinitionId) {
      this.processDefinitionId = processDefinitionId;
      this.loadProcessDefinitionXml(this.processDefinitionId);
    }

    this.version = +version;
  }
}
