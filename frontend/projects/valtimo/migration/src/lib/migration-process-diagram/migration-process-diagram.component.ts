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
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';

import BpmnJS from 'bpmn-js/dist/bpmn-navigated-viewer.production.min.js';
import {NGXLogger} from 'ngx-logger';

@Component({
  selector: 'valtimo-migration-process-diagram',
  templateUrl: './migration-process-diagram.component.html',
  styleUrls: ['./migration-process-diagram.component.scss'],
})
export class MigrationProcessDiagramComponent implements OnInit, OnDestroy {
  private bpmnJS: BpmnJS;
  public flowNodeMap: any = null;

  @ViewChild('ref') public el: ElementRef;
  @Input() name: string;
  @Output() loaded = new EventEmitter();

  constructor(private logger: NGXLogger) {}

  ngOnInit() {
    this.bpmnJS = new BpmnJS();
    this.bpmnJS.on('import.done', ({error}: any) => {
      if (!error) {
        const canvas = this.bpmnJS.get('canvas');
        canvas.zoom('fit-viewport', 'auto');
      }
    });
  }

  ngOnDestroy() {
    if (this.bpmnJS) {
      this.bpmnJS.destroy();
    }
  }

  clear() {
    this.bpmnJS.clear();
  }

  public loadXml(xml: string): void {
    this.bpmnJS.attachTo(this.el.nativeElement);
    this.bpmnJS.importXML(xml, err => {
      this.logger.debug(err);
      const processElements = this.bpmnJS.getDefinitions().rootElements.filter(function (element) {
        return element.isExecutable;
      });
      this.flowNodeMap = processElements[0].flowElements.filter(function (element) {
        if (element.name === null || element.name === '') {
          element.name = element.id;
        }
        return element.$type !== 'bpmn:SequenceFlow';
      });
      this.loaded.emit(this.name);
    });
  }
}
