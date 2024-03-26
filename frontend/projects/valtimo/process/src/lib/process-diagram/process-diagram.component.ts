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
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {ProcessService} from '../process.service';

import BpmnJS from 'bpmn-js/dist/bpmn-navigated-viewer.production.min.js';
import heatmap from 'heatmap.js-fixed/build/heatmap.js';

@Component({
  selector: 'valtimo-process-diagram',
  templateUrl: './process-diagram.component.html',
  styleUrls: ['./process-diagram.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ProcessDiagramComponent implements OnInit, OnDestroy, OnChanges {
  private bpmnJS: BpmnJS;
  private heatMapInstance: any;

  @ViewChild('ref', {static: true}) public el: ElementRef;
  @Output() public importDone: EventEmitter<any> = new EventEmitter();
  @Input() public processDefinitionKey?: string;
  @Input() public processInstanceId?: string;

  public processDiagram: any;
  public processDefinition: any;
  public processDefinitionVersions: any;
  public heatmapCount: any;
  public heatmapDuration: any;
  public tasksCount: any;
  public showHeatmap: boolean;
  public enumHeatmapOptions = ['count', 'duration'];
  public heatmapOption: string;
  public version: any;
  public heatPoints: any;
  public min: number;
  public max: number;
  public inputData: any;
  public valueKey: any;

  constructor(private processService: ProcessService) {}

  ngOnInit() {
    if (this.processDefinitionKey) {
      this.loadProcessDefinitionFromKey(this.processDefinitionKey);
    }
    if (this.processInstanceId) {
      this.loadProcessInstanceXml(this.processInstanceId);
    }
    this.bpmnJS = new BpmnJS();
    this.bpmnJS.on('import.done', ({error}) => {
      if (!error) {
        const canvas = this.bpmnJS.get('canvas');
        const eventBus = this.bpmnJS.get('eventBus');
        if (this.processDiagram.historicActivityInstances) {
          this.processDiagram.historicActivityInstances.forEach(instance => {
            // exclude multiInstanceBody
            if (instance.activityType !== 'multiInstanceBody') {
              canvas.addMarker(
                instance.activityId,
                instance.endTime ? 'highlight-overlay-past' : 'highlight-overlay-current'
              );
            }
          });
        }

        canvas.zoom('fit-viewport', 'auto');
        if (this.processDefinitionVersions) {
          eventBus.on('canvas.init', () => {
            if (this.showHeatmap) {
              this.clearHeatmap();
            }
            this.loadHeatmapData();
          });
          eventBus.on('canvas.viewbox.changing', () => {
            if (this.showHeatmap) {
              this.clearHeatmap();
            }
          });
          eventBus.on('canvas.viewbox.changed', () => {
            this.loadHeatmapData();
          });
        }
      }
    });
  }

  ngOnChanges(): void {
    if (this.processDefinitionKey) {
      this.loadProcessDefinitionFromKey(this.processDefinitionKey);
    } else if (this.processInstanceId) {
      this.loadProcessInstanceXml(this.processInstanceId);
    }
  }

  ngOnDestroy() {
    if (this.bpmnJS) {
      this.bpmnJS.destroy();
    }
  }

  public loadProcessDefinition(processDefinitionKey) {
    this.processService.getProcessDefinition(processDefinitionKey).subscribe(response => {
      this.heatmapOption = this.enumHeatmapOptions[0];
      this.version = response.version;
      this.loadProcessDefinitionXml(response.id);
    });
  }

  public loadProcessDefinitionVersions(processDefinitionKey) {
    this.processService.getProcessDefinitionVersions(processDefinitionKey).subscribe(response => {
      this.processDefinitionVersions = response;
    });
  }

  public loadProcessDefinitionFromKey(processDefinitionKey) {
    this.loadProcessDefinitionVersions(processDefinitionKey);
    this.loadProcessDefinition(processDefinitionKey);
  }

  public loadProcessDefinitionXml(processDefinitionId) {
    this.processService.getProcessDefinitionXml(processDefinitionId).subscribe(response => {
      this.processDiagram = response;
      this.bpmnJS.importXML(this.processDiagram.bpmn20Xml);
      this.bpmnJS.attachTo(this.el.nativeElement);
    });
  }

  private loadProcessInstanceXml(processInstanceId) {
    this.processService.getProcessXml(processInstanceId).subscribe(response => {
      this.processDiagram = response;
      this.bpmnJS.importXML(this.processDiagram.bpmn20Xml);
      this.bpmnJS.attachTo(this.el.nativeElement);
    });
  }

  public loadProcessDefinitionHeatmapCount(processDefinition) {
    this.processService.getProcessHeatmapCount(processDefinition).subscribe(response => {
      this.inputData = response;
      this.valueKey = 'totalCount';
      this.heatPoints = {data: []};
      this.min = 0;
      this.max = 0;

      Object.keys(this.inputData).forEach(key => {
        const diagramContainer = this.el.nativeElement.querySelector('svg').getBoundingClientRect();
        const diagramElm = this.el.nativeElement
          .querySelector(`g[data-element-id=${key}]`)
          .getBoundingClientRect();
        this.setMax(key);
        this.heatPoints.data.push({
          x: Math.round(diagramElm.x - diagramContainer.x + diagramElm.width / 2),
          y: Math.round(diagramElm.y - diagramContainer.y + diagramElm.height / 2),
          value: this.inputData[key][this.valueKey],
          radius: diagramElm.width / 2,
        });
        this.addCounterActiveOverlays(key, this.inputData);
      });
      this.clearHeatmap();
      if (this.showHeatmap) {
        this.loadHeatmap();
      }
    });
  }

  public onWindowResize() {
    const oldCanvas = this.el.nativeElement.querySelector('canvas[class=heatmap-canvas]');
    if (oldCanvas) {
      oldCanvas.remove();
      this.heatMapInstance = null;
    }
    if (this.showHeatmap) {
      this.loadHeatmap();
    }
  }

  public loadProcessDefinitionHeatmapDuration(processDefinition) {
    this.processService.getProcessHeatmapDuration(processDefinition).subscribe(response => {
      this.inputData = response;
      this.valueKey = 'averageDurationInMilliseconds';
      this.heatPoints = {data: []};
      this.min = 0;
      this.max = 0;

      Object.keys(this.inputData).forEach(key => {
        const diagramContainer = this.el.nativeElement.querySelector('svg').getBoundingClientRect();
        const diagramElm = this.el.nativeElement
          .querySelector(`g[data-element-id=${key}]`)
          .getBoundingClientRect();
        this.setMax(key);
        this.heatPoints.data.push({
          x: Math.round(diagramElm.x - diagramContainer.x + diagramElm.width / 2),
          y: Math.round(diagramElm.y - diagramContainer.y + diagramElm.height / 2),
          value: this.inputData[key][this.valueKey],
          radius: diagramElm.width / 2,
        });
        this.addCounterActiveOverlays(key, this.inputData);
      });
      this.clearHeatmap();
      if (this.showHeatmap) {
        this.loadHeatmap();
      }
    });
  }

  public setProcessDefinitionKey(processDefinitionKey) {
    this.processDefinitionKey = processDefinitionKey;
    this.loadProcessDefinitionFromKey(this.processDefinitionKey);
  }

  public setProcessDefinitionVersion(version) {
    this.version = +version;
    this.loadHeatmapData();
  }

  public setHeatmapOption(heatmapOption) {
    this.heatmapOption = heatmapOption;
    this.loadHeatmapData();
  }

  public toggleShowHeatmap() {
    this.showHeatmap = !this.showHeatmap;
    this.loadHeatmapData();
  }

  public loadHeatmap() {
    if (!this.heatMapInstance) {
      this.heatMapInstance = heatmap.create({
        radius: 54,
        blur: 0.7,
        maxOpacity: 0.4,
        minOpacity: 0,
        container: this.el.nativeElement,
      });
    }
    this.heatMapInstance.setData({
      min: this.min,
      max: this.max,
      data: this.heatPoints.data,
    });
  }

  public clearHeatmap() {
    if (this.heatMapInstance) {
      this.heatMapInstance.setData({data: []});
    }
  }

  public loadHeatmapData() {
    this.processDefinition = this.processDefinitionVersions.find(
      definition => definition.version === this.version
    );

    if (this.heatmapOption === 'count') {
      this.loadProcessDefinitionHeatmapCount(this.processDefinition);
    }
    if (this.heatmapOption === 'duration') {
      this.loadProcessDefinitionHeatmapDuration(this.processDefinition);
    }
  }

  public setMax(key: any) {
    if (this.heatmapDuration) {
      this.max = Math.max(this.heatmapDuration[key].averageDurationInMilliseconds, this.max);
    } else if (this.heatmapCount) {
      this.max = Math.max(
        this.heatmapCount[key].totalCount + this.heatmapCount[key].count,
        this.max
      );
    }
  }

  public addCounterActiveOverlays(key: any, inputData: any) {
    const overlays = this.bpmnJS.get('overlays');
    overlays.add(key, {
      position: {
        bottom: 13,
        left: -12,
      },
      show: {
        minZoom: 0,
        maxZoom: 5.0,
      },
      html: `<span class="badge badge-pill badge-primary">${inputData[key].count}</span>`,
    });
  }
}
