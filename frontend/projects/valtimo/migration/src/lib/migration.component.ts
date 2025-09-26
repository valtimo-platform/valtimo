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

import {AfterViewInit, Component, OnInit, ViewChild} from '@angular/core';
import {ProcessService, ProcessDefinition} from '@valtimo/process';
import {MigrationProcessDiagramComponent} from './migration-process-diagram/migration-process-diagram.component';
import {NGXLogger} from 'ngx-logger';
import {AlertService} from '@valtimo/components';

@Component({
  selector: 'valtimo-migration',
  templateUrl: './migration.component.html',
  styleUrls: ['./migration.component.scss'],
})
export class MigrationComponent implements OnInit, AfterViewInit {
  public processDefinitions: ProcessDefinition[] = [];
  public selectedVersions = {
    source: [],
    target: [],
  };
  public selectedId = {
    source: null,
    target: null,
  };
  public loaded = {
    source: false,
    target: false,
  };
  public fields = {
    source: {
      definition: null,
      version: null,
    },
    target: {
      definition: null,
      version: null,
    },
  };

  public processCount: number | null = null;
  public uniqueFlowNodeMap: any[] = [];
  public taskMapping: any = {};

  @ViewChild('sourceDiagram') sourceDiagram: MigrationProcessDiagramComponent;
  @ViewChild('targetDiagram') targetDiagram: MigrationProcessDiagramComponent;

  public diagram: any = null;

  constructor(
    private processService: ProcessService,
    private logger: NGXLogger,
    private alertService: AlertService
  ) {}

  ngOnInit() {
    this.loadProcessDefinitions();
  }

  ngAfterViewInit() {
    this.diagram = {
      source: this.sourceDiagram,
      target: this.targetDiagram,
    };
  }

  public get taskMappingLength() {
    return Object.keys(this.taskMapping).length;
  }

  loadProcessDefinitions() {
    this.processService
      .getProcessDefinitions()
      .subscribe((processDefinitions: ProcessDefinition[]) => {
        this.processDefinitions = processDefinitions;
      });
  }

  loadProcessDefinitionVersions(key: string | null, type: string) {
    this.fields[type].definition = key;
    this.selectedVersions[type] = [];
    this.clearProcess(type);
    if (key) {
      this.processService
        .getProcessDefinitionVersions(key)
        .subscribe((processDefinitionVersions: ProcessDefinition[]) => {
          this.selectedVersions[type] = processDefinitionVersions;
        });
    }
  }

  loadProcess(id: string | null, type: string) {
    this.fields[type].version = id;
    this.clearProcess(type);
    if (id) {
      this.loadProcessDefinitionXML(id, type);
      if (type === 'source') {
        this.loadProcessCount(id);
      }
    }
  }

  private clearProcess(type: string) {
    this.loaded[type] = false;
    this.selectedId[type] = null;
    this.diagram[type].clear();
    if (type === 'source') {
      this.processCount = null;
    }
  }

  loadProcessDefinitionXML(id: string, type: string) {
    this.processService.getProcessDefinitionXml(id).subscribe(xml => {
      this.diagram[type].loadXml(xml['bpmn20Xml']);
      this.selectedId[type] = id;
    });
  }

  loadProcessCount(id: string) {
    this.processService.getProcessCount(id).subscribe(response => {
      this.processCount = response.count;
    });
  }

  setUniqueFlowNodeMap() {
    this.uniqueFlowNodeMap = [];
    const sourceFlowNodeMap = this.sourceDiagram.flowNodeMap;
    const targetFlowNodeMap = this.targetDiagram.flowNodeMap;

    if (sourceFlowNodeMap != null && targetFlowNodeMap != null) {
      this.uniqueFlowNodeMap = sourceFlowNodeMap.filter(
        sourceFlowNode =>
          !targetFlowNodeMap.some(
            targetFlowNode =>
              sourceFlowNode.id === targetFlowNode.id &&
              sourceFlowNode.$type === targetFlowNode.$type
          )
      );
    }
  }

  getFilteredTargetFlowNodeMap(flowNodeType) {
    const targetFlowNodeMap = this.targetDiagram.flowNodeMap;
    return targetFlowNodeMap.filter(function (flowNode) {
      return flowNode.$type === flowNodeType;
    });
  }

  diagramLoaded(diagramName: string) {
    this.loaded[diagramName] = true;
    if (this.loaded.source && this.loaded.target) {
      this.taskMapping = {};
      this.setUniqueFlowNodeMap();
    }
  }

  migrateProcess() {
    this.processService
      .migrateProcess(this.selectedId.source, this.selectedId.target, this.taskMapping)
      .subscribe(
        res => {
          this.alertService.success('Process successfully migrated!');
          this.clearProcess('source');
          this.clearProcess('target');
          this.fields = {
            source: {
              definition: null,
              version: null,
            },
            target: {
              definition: null,
              version: null,
            },
          };
        },
        err => {
          this.alertService.error('Process migration failed!');
          this.logger.debug(err);
        }
      );
  }
}
