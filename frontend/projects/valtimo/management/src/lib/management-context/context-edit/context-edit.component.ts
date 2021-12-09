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

import {Component, OnInit} from '@angular/core';
import {ContextService} from '@valtimo/context';
import {Context, Authority, ProcessDefinition} from '@valtimo/contract';
import {ActivatedRoute, Router} from '@angular/router';
import {AlertService} from '@valtimo/components';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {ProcessService} from '@valtimo/process';
import {AuthorityService} from '@valtimo/authority';

@Component({
  selector: 'valtimo-context-edit',
  templateUrl: './context-edit.component.html',
  styleUrls: ['./context-edit.component.css']
})
export class ContextEditComponent implements OnInit {
  public id: number | 0;
  public data: Context | undefined;
  public form: FormGroup | undefined;
  public processDefinitions: Array<ProcessDefinition> = [];
  public authorities: Array<Authority> = [];
  public menuItemForm: any;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private contextService: ContextService,
    private processService: ProcessService,
    private authorityService: AuthorityService,
    private formBuilder: FormBuilder,
    private alertService: AlertService
  ) {
    const snapshot = this.route.snapshot.paramMap;
    const snapshotId = snapshot.get('id') || 0;
    this.id = +snapshotId;
  }

  ngOnInit() {
    this.loadProcessDefinitions();
    this.loadAuthorities();
    this.reset();
  }

  private loadProcessDefinitions() {
    this.processService.getProcessDefinitions().subscribe(results => {
      this.processDefinitions = results;
    });
  }

  private loadAuthorities() {
    this.authorityService.query().subscribe((results: { body: any[]; }) => {
      if (results.body) {
        this.authorities = results.body;
      }
    });
  }

  public get formControls() {
    if (this.form) {
      return this.form.controls;
    }
    return null;
  }

  private setValues() {
    if (this.form && this.data) {
      this.form.controls.id.setValue(this.data.id);
      this.form.controls.name.setValue(this.data.name);
      this.form.controls.menuItems.setValue(this.data.menuItems);
      this.form.controls.processes.setValue(this.data.processes);
      this.form.controls.roles.setValue(this.data.roles);
    }
    this.mergeContextProcessesProcessDefinitions(this.data.processes);
  }

  private createFormGroup() {
    return this.formBuilder.group({
      id: new FormControl(null),
      name: new FormControl('', Validators.required),
      menuItems: new FormControl([]),
      processes: new FormControl([]),
      roles: new FormControl([])
    });
  }

  private loadData() {
    if (this.id !== 0) {
      this.contextService.get(this.id).subscribe(result => {
        this.data = result;
        this.setValues();
      });
    }
  }

  public delete() {
    // confirm action
    const mssg = 'Delete context?';
    const confirmations = [
      {
        label: 'Cancel',
        class: 'btn btn-default',
        value: false
      },
      {
        label: 'Delete',
        class: 'btn btn-primary',
        value: true
      }
    ];
    this.alertService.notification(mssg, confirmations);
    this.alertService.getAlertConfirmChangeEmitter()
      .subscribe((alert: { confirm: boolean; }) => {
        if (alert.confirm) {
          this.deleteConfirmed();
        }
      });
  }

  private deleteConfirmed() {
    this.contextService.delete(this.id).subscribe(() => {
      this.router.navigate([`/contexts`]);
    });
  }

  public onSubmit() {
    if (this.form && this.form.value && this.form.value.id) {
      this.onUpdate();
    } else {
      this.onCreate();
    }
  }

  private onUpdate() {
    if (this.form) {
      this.contextService.update(this.form.value).subscribe(() => {
        this.router.navigate([`/contexts`]);
      }, error => {
        this.alertService.error(error.statusText);
      });
    }
  }

  private onCreate() {
    if (this.form) {
      this.contextService.create(this.form.value).subscribe(() => {
        this.router.navigate([`/contexts`]);
      }, error => {
        this.alertService.error(error.statusText);
      });
    }
  }

  public reset() {
    this.form = this.createFormGroup();
    this.resetMenuItem();
    this.loadData();
  }

  public validateRole(role: string) {
    if (this.form) {
      return this.form.controls.roles.value.indexOf(role) !== -1;
    }
    return false;
  }

  public toggleRole(role: string) {
    if (this.form) {
      const rolesArray = this.form.controls.roles.value;
      const posRoleInRoles = rolesArray.indexOf(role);
      if (posRoleInRoles === -1) {
        rolesArray.push(role);
      } else {
        rolesArray.splice(posRoleInRoles, 1);
      }
    }
  }

  public setContextProcess(processDefinitionKey: string, visibleInMenu: any) {
    if (this.form) {
      const contextProcessesArray = this.form.controls.processes.value;
      const indexContextProcesses = this.form.controls.processes.value
        .findIndex(process => process.processDefinitionKey === processDefinitionKey);
      if (indexContextProcesses === -1 && visibleInMenu !== null) {
        contextProcessesArray.push({processDefinitionKey: processDefinitionKey, visibleInMenu: visibleInMenu});
      } else if (indexContextProcesses !== -1 && visibleInMenu !== null) {
        contextProcessesArray[indexContextProcesses] = {processDefinitionKey: processDefinitionKey, visibleInMenu: visibleInMenu};
      } else if (indexContextProcesses !== -1 && visibleInMenu === null) {
        contextProcessesArray.splice(indexContextProcesses, 1);
      }
      this.mergeContextProcessesProcessDefinitions(contextProcessesArray);
    }
  }

  private mergeContextProcessesProcessDefinitions(contextProcessesArray: any) {
    this.processDefinitions.forEach(process => {
      process['visibleInMenu'] = null;
      contextProcessesArray.forEach(contextProcess => {
        if (process.key === contextProcess.processDefinitionKey) {
          process['visibleInMenu'] = contextProcess.visibleInMenu;
        }
      });
    });
  }

  public resetMenuItem() {
    this.menuItemForm = {
      name: '',
      url: ''
    };
  }

  public addMenuItem() {
    if (this.menuItemForm.name && this.menuItemForm.url) {
      this.form.controls.menuItems.value.push(this.menuItemForm);
      this.resetMenuItem();
    }
  }

  public deleteMenuItem(menuItemToDelete: any) {
    const indexContextMenuItem = this.form.controls.menuItems.value
      .findIndex(menuItem => menuItem.name === menuItemToDelete.name
        && menuItem.url === menuItemToDelete.url);
    this.form.controls.menuItems.value.splice(indexContextMenuItem, 1);
  }
}
