/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {StructuredListModule, TagModule} from 'carbon-components-angular';
import {ExternalPluginProvidedContract} from '@valtimo/plugin';
import {ExternalPluginDurationPipe} from '../../pipes';
import {PLUGIN_EXTERNAL_PROVIDED_CONTRACTS_TEST_IDS} from '../../constants';

/**
 * The contracts a plugin answers for other plugins (manifest `provides`), per operation. Purely
 * informational: providing a contract is not a permission and needs no acceptance.
 */
@Component({
  standalone: true,
  selector: 'valtimo-plugin-external-provided-contracts',
  templateUrl: './plugin-external-provided-contracts.component.html',
  styleUrls: ['./plugin-external-provided-contracts.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    StructuredListModule,
    TagModule,
    ExternalPluginDurationPipe,
  ],
})
export class PluginExternalProvidedContractsComponent {
  @Input() public providedContracts: Array<ExternalPluginProvidedContract> = [];

  protected readonly testIds = PLUGIN_EXTERNAL_PROVIDED_CONTRACTS_TEST_IDS;
}
