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
import {Heatpoint} from '../models';
import BpmnJS from 'bpmn-js/dist/bpmn-navigated-viewer.production.min.js';
import heatmap from 'heatmap.js-fixed/build/heatmap.js';
import {PageTitleService} from '@valtimo/components';

@Component({
  selector: 'valtimo-analyse-process-diagram',
  templateUrl: './analyse-process-diagram.component.html',
  styleUrls: ['./analyse-process-diagram.component.scss'],
})
export class AnalyseProcessDiagramComponent implements OnInit, OnDestroy {
  private bpmnJS: BpmnJS;
  private heatMapInstance: any;

  @ViewChild('ref') public el: ElementRef;
  @Output() public importDone: EventEmitter<any> = new EventEmitter();

  public processDefinitionKey: string;
  public processDefinitions: ProcessDefinition[];
  public processDiagram: any;
  public processDefinition: ProcessDefinition;
  public processDefinitionVersions: ProcessDefinition[];
  public showHeatmap: boolean;
  public enumHeatmapOptions: string[] = ['count', 'duration'];
  public heatmapOption: string;
  public version: number;
  public heatPoints: {data: Heatpoint[]};
  public min: number;
  public max: number;
  public inputData: any[];
  public valueKey: string;
  private initialized = false;

  constructor(
    private readonly processService: ProcessService,
    private readonly pageTitleService: PageTitleService
  ) {}

  ngOnInit() {
    this.pageTitleService.disableReset();
    this.processService
      .getProcessDefinitions()
      .subscribe((processDefinitions: ProcessDefinition[]) => {
        this.processDefinitions = processDefinitions;
        if (!this.processDefinitionKey && processDefinitions.length !== 0) {
          this.processDefinitionKey = processDefinitions[0].key;
          this.loadProcessDefinitionFromKey(this.processDefinitionKey);
        }
      });
    this.createBpmnViewerInstance();
  }

  private createBpmnViewerInstance() {
    this.bpmnJS = new BpmnJS();
    this.bpmnJS.on('import.done', ({error}: any) => {
      if (!error && !this.initialized) {
        const canvas = this.bpmnJS.get('canvas');
        const eventBus = this.bpmnJS.get('eventBus');
        if (this.processDiagram.historicActivityInstances) {
          this.processDiagram.historicActivityInstances.forEach((instance: any) => {
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
        this.initialized = true;
      }
      this.clearHeatmap();
      if (this.showHeatmap) {
        this.loadHeatmapData();
      }
    });
  }

  ngOnDestroy() {
    if (this.bpmnJS) {
      this.bpmnJS.destroy();
    }
    this.pageTitleService.enableReset();
  }

  public loadProcessDefinition(processDefinitionKey: string): void {
    this.processService
      .getProcessDefinition(processDefinitionKey)
      .subscribe((processDefinition: ProcessDefinition) => {
        this.heatmapOption = this.enumHeatmapOptions[0];
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

  public loadProcessDefinitionHeatmapCount(processDefinition: ProcessDefinition): void {
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

  public onWindowResize(): void {
    const oldCanvas = this.el.nativeElement.querySelector('canvas[class=heatmap-canvas]');
    if (oldCanvas) {
      oldCanvas.remove();
      this.heatMapInstance = null;
    }
    if (this.showHeatmap) {
      this.loadHeatmap();
    }
  }

  public loadProcessDefinitionHeatmapDuration(processDefinition: ProcessDefinition): void {
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

  public setProcessDefinitionKey(processDefinitionKey: string): void {
    this.processDefinitionKey = processDefinitionKey;
    this.loadProcessDefinitionFromKey(this.processDefinitionKey);
  }

  public setProcessDefinitionVersion(version: string): void {
    this.version = +version;
    this.loadHeatmapData();
  }

  public setHeatmapOption(heatmapOption: string): void {
    this.heatmapOption = heatmapOption;
    this.loadHeatmapData();
  }

  public toggleShowHeatmap(): void {
    this.showHeatmap = !this.showHeatmap;
    this.loadHeatmapData();
  }

  public loadHeatmap(): void {
    if (!this.heatMapInstance) {
      this.heatMapInstance = heatmap.create({
        radius: 54,
        blur: 0.7,
        maxOpacity: 0.4,
        minOpacity: 0,
        container: this.el.nativeElement,
      });
      const heatmapCanvas = this.el.nativeElement.querySelector('canvas[class=heatmap-canvas]');
      heatmapCanvas.style.zIndex = 1;
    }
    this.heatMapInstance.setData({
      min: this.min,
      max: this.max,
      data: this.heatPoints.data,
    });
  }

  public clearHeatmap(): void {
    if (this.heatMapInstance) {
      this.heatMapInstance.setData({data: []});
    }
  }

  public loadHeatmapData(): void {
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
    if (this.valueKey === 'averageDurationInMilliseconds') {
      this.max = Math.max(this.inputData[key].averageDurationInMilliseconds, this.max);
    } else if (this.valueKey === 'totalCount') {
      this.max = Math.max(this.inputData[key].totalCount + this.inputData[key].count, this.max);
    }
  }

  public addCounterActiveOverlays(key: string, inputData: any[]): void {
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
