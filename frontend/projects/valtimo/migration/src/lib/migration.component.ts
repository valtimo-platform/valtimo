/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import {AfterViewInit, Component, viewChild, ViewChild} from '@angular/core';
import {ProcessDefinition, ProcessService} from '@valtimo/process';
import {MigrationProcessDiagramComponent} from './migration-process-diagram/migration-process-diagram.component';
import {NGXLogger} from 'ngx-logger';
import {AlertService} from '@valtimo/components';
import {ComboBox, ListItem} from 'carbon-components-angular';

@Component({
  standalone: false,
  selector: 'valtimo-migration',
  templateUrl: './migration.component.html',
  styleUrls: ['./migration.component.scss'],
})
export class MigrationComponent implements AfterViewInit, AfterViewInit {
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
  @ViewChild('sourceVersionCombobox') sourceVersionCombobox: ComboBox;
  @ViewChild('targetDefinitionComboBox') targetDefinitionComboBox: ComboBox;
  @ViewChild('targetVersionCombobox') targetVersionCombobox: ComboBox;
  public diagram: any = null;

  constructor(
    private processService: ProcessService,
    private logger: NGXLogger,
    private alertService: AlertService
  ) {}

  ngAfterViewInit() {
    this.diagram = {
      source: this.sourceDiagram,
      target: this.targetDiagram,
    };
    this.loadProcessDefinitions();
  }

  public get taskMappingLength() {
    return Object.keys(this.taskMapping).length;
  }

  public sourceDefinitionItems: ListItem[] = [];
  public targetDefinitionItems: ListItem[] = [];
  public sourceVersionItems: ListItem[] = [];
  public targetVersionItems: ListItem[] = [];
  private readonly targetFlowNodeItemsMap = new Map<string, ListItem[]>();

  private refreshDefinitionItems(): void {
    this.sourceDefinitionItems = this.processDefinitions.map(processDef => ({
      key: processDef.key,
      content: processDef.name,
      selected: this.fields.source.definition === processDef.key,
    }));
    this.targetDefinitionItems = this.processDefinitions.map(processDef => ({
      key: processDef.key,
      content: processDef.name,
      selected: this.fields.target.definition === processDef.key,
    }));
  }

  private refreshVersionItems(type: string): void {
    const items = this.selectedVersions[type].map(processVer => ({
      id: processVer.id,
      content: `${processVer.version}`,
      selected: this.fields[type].version === processVer.id,
    }));
    if (type === 'source') {
      this.sourceVersionItems = items;
    } else {
      this.targetVersionItems = items;
    }
  }

  loadProcessDefinitions() {
    this.processService
      .getProcessDefinitions()
      .subscribe((processDefinitions: ProcessDefinition[]) => {
        this.processDefinitions = processDefinitions;
        this.refreshDefinitionItems();
      });
  }

  public onDefinitionSelected(selection: ListItem | ListItem[], type: string) {
    const item = Array.isArray(selection) ? selection[0] : selection;
    const key = item?.key ?? null;

    this.loadProcessDefinitionVersions(key, type);
    if (type === 'source') {
      this.loadProcessDefinitionVersions(key, 'target');
    }
  }

  public onVersionSelected(selection: ListItem | ListItem[], type: string) {
    const item = Array.isArray(selection) ? selection[0] : selection;
    this.loadProcess(item?.id ?? null, type);
  }

  public onSourceDefinitionClear(event: Event): void {
    this.sourceVersionCombobox.clearInput(event);
    this.targetDefinitionComboBox.clearInput(event);
    this.targetVersionCombobox.clearInput(event);
  }

  public onTaskMappingSelected(selection: ListItem | ListItem[], nodeId: string) {
    const item = Array.isArray(selection) ? selection[0] : selection;
    this.taskMapping[nodeId] = item?.id ?? null;
  }

  loadProcessDefinitionVersions(key: string | null, type: string) {
    this.fields[type].definition = key;
    this.selectedVersions[type] = [];
    this.clearProcess(type);
    this.refreshDefinitionItems();
    this.refreshVersionItems(type);
    if (key) {
      this.processService
        .getProcessDefinitionVersions(key)
        .subscribe((processDefinitionVersions: ProcessDefinition[]) => {
          if (this.fields[type].definition !== key) {
            return;
          }
          this.selectedVersions[type] = processDefinitionVersions;
          this.refreshVersionItems(type);
        });
    }
  }

  loadProcess(id: string | null, type: string) {
    this.fields[type].version = id;
    this.clearProcess(type);
    this.refreshVersionItems(type);
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
      if (!xml.bpmn20Xml) return;
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

  public getFilteredTargetFlowNodeMapItems(node): ListItem[] {
    if (!this.targetFlowNodeItemsMap.has(node.id)) {
      this.targetFlowNodeItemsMap.set(
        node.id,
        this.getFilteredTargetFlowNodeMap(node.$type).map(targetFlowNode => ({
          id: targetFlowNode.id,
          content: targetFlowNode.name || targetFlowNode.id,
          selected: this.taskMapping[node.id] === targetFlowNode.id,
        }))
      );
    }
    return this.targetFlowNodeItemsMap.get(node.id);
  }

  diagramLoaded(diagramName: string) {
    this.loaded[diagramName] = true;
    if (this.loaded.source && this.loaded.target) {
      this.taskMapping = {};
      this.targetFlowNodeItemsMap.clear();
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
          this.refreshDefinitionItems();
          this.refreshVersionItems('source');
          this.refreshVersionItems('target');
        },
        err => {
          this.alertService.error('Process migration failed!');
          this.logger.debug(err);
        }
      );
  }
}
