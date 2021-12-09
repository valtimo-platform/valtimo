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

import {Component, Input, OnInit, ViewChild, ViewContainerRef} from '@angular/core';
import {ConfigService} from '../config.service';
import {Extension, ExtensionLoader, ExtensionPoint} from '@valtimo/contract';

@Component({
  selector: 'valtimo-extension',
  templateUrl: './extension.component.html',
  styleUrls: ['./extension.component.css']
})
export class ExtensionComponent implements OnInit {

  public extensionLoader: ExtensionLoader = null;
  public selectedExtensionPoint: ExtensionPoint;
  public supportedExtensions: Array<Extension>;
  @Input() public module: string;
  @Input() public page: string;
  @Input() public section: string;
  @ViewChild('injectExtension', {read: ViewContainerRef, static: true}) viewContainerRef: ViewContainerRef;

  constructor(private configService: ConfigService) {
  }

  ngOnInit() {
    this.configService.getSupportedExtensionPoints(this.module, this.page, this.section).forEach(extension => {
      this.configService.loadExtensionPoint(this.viewContainerRef, extension.extensionPoint);
    });
  }

}
