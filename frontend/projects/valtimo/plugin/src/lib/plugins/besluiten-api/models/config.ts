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

import {PluginConfigurationData} from '../../../models';
import {InputOption} from './input';

interface BesluitenApiConfig extends PluginConfigurationData {
  rsin: string;
  url: string;
  authenticationPluginConfiguration: string;
}

type Vervalredenen = 'tijdelijk' | 'ingetrokken_overheid' | 'ingetrokken_belanghebbende';

interface CreateZaakBesluitConfig {
  besluittypeUrl: string;
  toelichting: string;
  bestuursorgaan: string;
  ingangsdatum: string;
  vervaldatum: string;
  vervalreden: Vervalredenen;
  publicatiedatum: string;
  verzenddatum: string;
  uiterlijkeReactieDatum: string;
  createdBesluitUrl: string;
  inputTypeBesluitToggle?: InputOption;
  inputTypeStartingDateToggle?: InputOption;
  inputTypeExpirationDateToggle?: InputOption;
}
interface LinkDocumentToBesluitConfig {
  besluitUrl: string;
  documentUrl: string;
}

export {BesluitenApiConfig, CreateZaakBesluitConfig, Vervalredenen, LinkDocumentToBesluitConfig};
