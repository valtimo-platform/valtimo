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

import {AfterViewInit, Component, ElementRef, ViewEncapsulation} from '@angular/core';
import {UserProviderService} from '@valtimo/security';
import SwaggerUI from 'swagger-ui';
import {NGXLogger} from 'ngx-logger';
import {ConfigService} from '@valtimo/config';

@Component({
  selector: 'valtimo-swagger',
  templateUrl: './swagger.component.html',
  styleUrls: ['./swagger.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SwaggerComponent implements AfterViewInit {

  private valtimoSwaggerConfig: any;

  constructor(
    private configService: ConfigService,
    private el: ElementRef,
    private userProviderService: UserProviderService,
    private logger: NGXLogger
  ) {
    this.valtimoSwaggerConfig = configService.config.swagger;
  }

  ngAfterViewInit() {
    this.userProviderService.getToken().then((authToken: string) => {
      this.logger.debug(`swagger ngAfterViewInit token: ${authToken}`);
      SwaggerUI({
        url: this.valtimoSwaggerConfig.endpointUri,
        domNode: this.el.nativeElement.querySelector('.swagger-container'),
        deepLinking: true,
        presets: [
          SwaggerUI.presets.apis
        ],
        requestInterceptor(request) {
          request.headers.Authorization = `Bearer ${authToken}`;
          return request;
        }
      });
    });
  }

}
