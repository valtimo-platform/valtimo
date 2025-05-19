/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {Location} from '@angular/common';
import {Component, OnInit} from '@angular/core';
import {UntypedFormBuilder, UntypedFormControl, UntypedFormGroup} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {GlobalNotificationService} from '@valtimo/shared';
import {TaskService} from '@valtimo/task';

@Component({
  selector: 'app-custom-form-example',
  templateUrl: './custom-form-example.component.html',
  styleUrls: ['./custom-form-example.component.scss'],
  standalone: false,
})
export class CustomFormExampleComponent implements OnInit {
  public customForm: UntypedFormGroup;
  public task: any;
  public id: string;

  constructor(
    private readonly formBuilder: UntypedFormBuilder,
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly location: Location,
    private readonly route: ActivatedRoute,
    private readonly taskService: TaskService
  ) {
    this.id = this.route.snapshot.paramMap.get('taskId');
  }

  ngOnInit() {
    this.getTask(this.id);
    this.customForm = this.createFormGroup();
  }

  public getTask(id) {
    this.taskService.getTask(id).subscribe(task => {
      this.task = task;
    });
  }

  private createFormGroup() {
    const group = this.formBuilder.group({
      inputText: new UntypedFormControl(''),
      inputPassword: new UntypedFormControl(''),
      inputPlaceholder: new UntypedFormControl(''),
      inputDisabled: new UntypedFormControl({value: '', disabled: true}),
      inputReadonly: new UntypedFormControl('Readonly input text'),
      inputTextarea: new UntypedFormControl(''),
    });
    return group;
  }

  public reset() {
    this.customForm = this.createFormGroup();
  }

  public onSubmit() {
    this.taskService.completeTask(this.id, this.customForm.value).subscribe(() => {
      this.globalNotificationService.showToast({
        title: this.task.task.name + ' has successfully been completed',
        type: 'success',
      });
      this.location.back();
    });
  }
}
