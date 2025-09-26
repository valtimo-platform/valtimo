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
  AfterContentInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  EventEmitter,
  OnInit,
} from '@angular/core';
import BpmnJS from 'bpmn-js/dist/bpmn-navigated-viewer.production.min.js';
import heatmap from 'heatmap.js-fixed/build/heatmap.js';

@Component({
  selector: 'valtimo-bpmn-js-diagram',
  templateUrl: './bpmn-js-diagram.component.html',
  styleUrls: ['./bpmn-js-diagram.component.css'],
})
export class BpmnJsDiagramComponent implements OnInit, AfterContentInit, OnDestroy {
  private bpmnJS: BpmnJS;
  private heatMapInstance: any;

  @ViewChild('ref', {static: true}) public el: ElementRef;
  @Output() public importDone: EventEmitter<any> = new EventEmitter();
  @Input() public bpmn20Xml: any;
  @Input() public heatmapDuration?: any;
  @Input() public heatmapCount?: any;
  @Input() public historicActivityInstances?: any;

  public heatmapMode: boolean;
  public heatPoints = {data: []};
  public min: number;
  public max: number;

  constructor() {}

  ngOnInit(): void {
    this.bpmnJS = new BpmnJS();
    this.bpmnJS.on('import.done', ({error}) => {
      if (!error) {
        const canvas = this.bpmnJS.get('canvas');
        const eventBus = this.bpmnJS.get('eventBus');

        if (this.historicActivityInstances) {
          this.historicActivityInstances.forEach(instance => {
            canvas.addMarker(
              instance.activityId,
              instance.endTime ? 'highlight-overlay-past' : 'highlight-overlay-current'
            );
          });
        }

        canvas.zoom('fit-viewport', 'auto');

        if (this.heatmapDuration || this.heatmapCount) {
          eventBus.on('canvas.init', () => {
            if (this.heatmapMode) {
              this.clearHeatmap();
            }
            this.getHeatmapData();
          });
          eventBus.on('canvas.viewbox.changing', () => {
            if (this.heatmapMode) {
              this.clearHeatmap();
            }
          });
          eventBus.on('canvas.viewbox.changed', () => {
            this.getHeatmapData();
          });
        }
      }
    });
  }

  ngAfterContentInit(): void {
    this.bpmnJS.importXML(this.bpmn20Xml);
    this.bpmnJS.attachTo(this.el.nativeElement);
  }

  getHeatmapData() {
    let inputData: any;
    let valueKey: any;

    this.heatPoints = {data: []};
    this.min = 0;
    this.max = 0;

    if (this.heatmapDuration) {
      inputData = this.heatmapDuration;
      valueKey = 'averageDurationInMilliseconds';
    } else if (this.heatmapCount) {
      inputData = this.heatmapCount;
      valueKey = 'totalCount';
    }

    if (inputData) {
      Object.keys(inputData).forEach(key => {
        const diagramContainer = this.el.nativeElement.querySelector('svg').getBoundingClientRect();
        const diagramElm = this.el.nativeElement
          .querySelector(`g[data-element-id=${key}]`)
          .getBoundingClientRect();
        this.setMax(key);
        this.heatPoints.data.push({
          x: Math.round(diagramElm.x - diagramContainer.x + diagramElm.width / 2),
          y: Math.round(diagramElm.y - diagramContainer.y + diagramElm.height / 2),
          value: inputData[key][valueKey],
          radius: diagramElm.width / 2,
        });
        if (inputData[key].count > 0) {
          this.addCounterActiveOverlays(key, inputData);
        }
      });

      if (this.heatmapMode) {
        this.showHeatmap();
      }
    }
  }

  setMax(key: any) {
    if (this.heatmapDuration) {
      this.max = Math.max(this.heatmapDuration[key].averageDurationInMilliseconds, this.max);
    } else if (this.heatmapCount) {
      this.max = Math.max(
        this.heatmapCount[key].totalCount + this.heatmapCount[key].count,
        this.max
      );
    }
  }

  addCounterActiveOverlays(key: any, inputData: any) {
    const overlays = this.bpmnJS.get('overlays');
    overlays.add(key, {
      position: {
        bottom: -10,
        left: 0,
      },
      show: {
        minZoom: 0,
        maxZoom: 5.0,
      },
      html: `<span class="badge badge-pill badge-primary">${inputData[key].count}</span>`,
    });
  }

  showHeatmap() {
    this.heatMapInstance = heatmap.create({
      radius: 54,
      blur: 0.7,
      maxOpacity: 0.4,
      minOpacity: 0,
      container: this.el.nativeElement,
    });
    this.heatMapInstance.setData({
      min: this.min,
      max: this.max,
      data: this.heatPoints.data,
    });
  }

  clearHeatmap() {
    this.heatMapInstance.setData({data: []});
  }

  toggleHeatmap() {
    this.heatmapMode = !this.heatmapMode;
    if (this.heatmapMode) {
      this.showHeatmap();
    } else {
      this.clearHeatmap();
    }
  }

  ngOnDestroy(): void {
    this.bpmnJS.destroy();
  }
}
