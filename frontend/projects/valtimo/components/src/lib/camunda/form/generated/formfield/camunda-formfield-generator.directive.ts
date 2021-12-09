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

import {ComponentFactoryResolver, ComponentRef, Directive, Input, OnInit, ViewContainerRef} from '@angular/core';
import {FormGroup} from '@angular/forms';
import {FormField} from './formfield.model';
import {CamundaStringFormfieldComponent} from './string/camunda-string-formfield.component';
import {CamundaBooleanFormfieldComponent} from './boolean/camunda-boolean-formfield.component';
import {CamundaDateFormfieldComponent} from './date/camunda-date-formfield.component';
import {CamundaLongFormfieldComponent} from './long/camunda-long-formfield.component';
import {CamundaEnumFormfieldComponent} from './enum/camunda-enum-formfield.component';
import {CamundaTextareaFormfieldComponent} from './textarea/camunda-textarea-formfield.component';
import {CamundaChoicefieldFormfieldComponent} from './choicefield/camunda-choicefield-formfield.component';

@Directive({
  selector: '[valtimoCamundaFormfieldGenerator]'
})
export class CamundaFormfieldGeneratorDirective implements OnInit {
  @Input() formField: FormField;

  @Input() formGroup: FormGroup;

  private readonly COMPONENTS = {
    string: CamundaStringFormfieldComponent,
    boolean: CamundaBooleanFormfieldComponent,
    date: CamundaDateFormfieldComponent,
    long: CamundaLongFormfieldComponent,
    enum: CamundaEnumFormfieldComponent,
    textarea: CamundaTextareaFormfieldComponent,
    choicefield: CamundaChoicefieldFormfieldComponent
  };

  private component: ComponentRef<any>;

  constructor(
    private viewContainerRef: ViewContainerRef,
    private componentFactoryResolver: ComponentFactoryResolver
  ) {

  }

  ngOnInit(): void {
    const typeName = this.formField.typeName.toLowerCase();
    if ( !this.COMPONENTS[typeName] ) {
      throw new Error(
        'Could not find component for formfield type: ' + typeName
      );
    }
    const component = this.COMPONENTS[ typeName ];
    const factory = this.componentFactoryResolver.resolveComponentFactory(component);
    this.component = this.viewContainerRef.createComponent(factory);
    this.component.instance.formGroup = this.formGroup;
    this.component.instance.formField = this.formField;
  }


}

