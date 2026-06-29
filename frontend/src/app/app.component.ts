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

import {Component, OnInit} from '@angular/core';
import {ExtensionService} from '@valtimo/extension-management';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(private readonly extensionService: ExtensionService) {}

  public ngOnInit(): void {
    // Load every started extension's frontend bundle on each app start so its UI
    // contributions (e.g. plugin specifications) re-register after a hard refresh.
    // Done here in the host's root component rather than in @valtimo/layout to
    // avoid a dependency cycle (layout -> extension-management -> case-management
    // -> layout); the extension file/id endpoints are public, so no auth gating is
    // needed. loadAll() is fire-and-forget and logs per-extension load failures.
    this.extensionService.loadAll();
  }
}
