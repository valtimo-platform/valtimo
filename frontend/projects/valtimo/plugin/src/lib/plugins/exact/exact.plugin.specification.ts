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

import {PluginSpecification} from '../../models';
import {ExactPluginConfigurationComponent} from './components/exact-plugin-configuration/exact-plugin-configuration.component';
import {ExactGetRequestConfigurationComponent} from './components/exact-action-get-request-configuration/exact-get-request-configuration.component';
import {ExactPutRequestConfigurationComponent} from './components/exact-action-put-request-configuration/exact-put-request-configuration.component';
import {ExactPostRequestConfigurationComponent} from './components/exact-action-post-request-configuration/exact-post-request-configuration.component';

const exactPluginSpecification: PluginSpecification = {
  pluginId: 'exact',
  pluginConfigurationComponent: ExactPluginConfigurationComponent,
  pluginLogoBase64:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKgAAAAkCAMAAAAq54ElAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAACqVBMVEUAAADWIinZJCrZJirYJCrZJSvaJSv/AADXKCjcIyvWJCn/AADMMzPYJyfdKC3aJi3bJCrZJivXKCjRLi7XJSvZJivaJivYJSrZJSrZJivZJivZJSrXJC3YJivYJivYJSrZJinmGjPaJSvZJSvaJSvYJSvZJSq/QEDaJSrZJirYJyfaJSraJSvcIy7aJSvZJivaJSvZJivaJirdIiLZJircKSnZJirYJSvZJSvZJivYJSr/AADbJCTYJSvaJSvYJSvYJivaJSvSHi3ZJCvZJirbJivYJyvZJivaJSvYJyzaJSzYJSvXJSvYJCvZJirYJyfZJivaJSvZJibaJSrZJSrZJSvZJivYJSvYJSrbJirZJi3aJSvYJivVKyvZJivYJSvZJSvaJSrZJivYJCnYJSvZJivYJSvZJSrZJivaJSvYJyraJivWISnZJiraJSzfIDDYJivaJSvYJivYJivZJSveJyzXJSrXJCvYJyvYJynfICDYJivYJCrVKyvbJCzZJivYJSnZJivaJivYJSvZJizfJSvXJCvaJSvaJSnYJyvZJivaJSvbJivbJCvaJSzaJSrZJSrYJivYJSrbJCTYJivZJirZJirbJivZJivYJCvZJSraJSnZJivZJirZJirZJinaJinZJiraJSvjHBzaJSrYJyrhJCvYJSvZJirZJSrZJivZJSrZJivXJCzbJCrbJirZJivYJSraJSnZJiraJSvYJiraJSzbJCTXJC3bJC7dIivYJirZJivZJivZJivXKCjbJiraJivYJivZJirYJSrZJivZJivZJirYJSrZJivaJSvaJSrbJiraJivVICvYJSrWIinWKSmqVVXVJCrbJCrYJSneJyfZJSnbJC7ZJCrZJi/ZJinYJSnaJCvVJCvYJSndKSnZJCr////a6T7OAAAA4nRSTlMARL2vW/zpAhMkMgEFJy0iMe0mC1qa16T4PFj3OfnSnVcKWZnWsrsEdOwN1OEW73LjZOsPvSzyuNCungMOv2B9nNsRfrx+Ql/1NCl8U1TlGmuPFPH5tGyll4Yo8L4Mp5am2udprPPGzzWET+4fw0wQ+92V+p8uZ007YwjLYhIjoG9liHZRMEfce0iU1Y0qRZLOxasHxKm1k5t3wqaoeT1dREPiCdNWKrm2yV7HakYrgKGYPuaJqksVPxweo3jR0iCFZsxJsfSB2Wg29pGM5BhuJRkDK1uXJ6AyeRtRfY8qgiWT0Pv9JgAAAAFiS0dE4sYBnhwAAAAHdElNRQfiChMHJTUkS/K4AAAEWklEQVRYw+2Y90MURxTHX/RWNHeiWCIiZwXRCBgwFMEGoiIWRDSKgJpY46mgZ+8NeyWxJxqikdgSNBoS0iyxd43GXv4Tb2/ezM4uO8Oe7g/+4Ptp3vu+efvZ29mZtwfwbtoHtfxWG951cyh+q/Me9D1oABZUt96HvDnBRYf1dYnBGG0A4NTNaNigrstC7XoaaAiNNbII2bhJ048Ug/mu2QyHoc253DAMtggHcBknuVu2am2AbdO2XYQuJ1IDZdbeEmZUh45KdfNd7+NOOI6OYcn1YzHWGUxAVfskjq/dOd6ovzFol0/NLqeCQkIiOklB9PdJxkhXpwhUUVJSae1u7aurbwrq6q4IQaEH9Xpidi/009JBDKr0pr9nhmIfaB9FAsrA3H39bj90M/uDDNSdRWoPUCyDDhwkMPp+xCRKQdmjHpzNL4UhIAVVcvzy0FzroMNEpYYj6GcsEjFiZB5nuM5G5aNcEAWF9OUajZNT+Ql5Y8Z+Tmt94ZfHsdrR47Xa/TTQCTQWVzPoRPQnTRYsDbodKV+y7Sqim2gdTfFgylTVm0b3gek1b/g1gRYVE3dGunARz8QZ3lk4mDBbvOLnYM5cdTvB2omj4O1B56E7X3ztBQsNUyW5UOgmOYt843D2KGwAxV+geLHk4ktCdDOXSjeRNJK0zDdcjhOC7QBdQbzclXqL05VdVcxNbNnYeLCVrOZ2kzUka61PyCPDfKcV0LjlAltH9PXmt7FBX3ejpuRu0kubI033twE+aQsZbrWle1pqDhphOL22McWhE4pKBQ9MBU3Bfc0W0FJLoFDCNsSvdO/Z14oEdDsZ7rAFdLQlUGckU3by8RWKDHQENjS2gO6yBLqbk1prYfMjkoG2I8M9lkD3fiOwb4meY+Vl2hfKSbFav79fkYLiK5gGdmxP2Dtlflems3C+asz3upnJB6jQFCNjyrQPjYMaaE9spdrYAfoDuockH1Plhqm7qPIj8bfz2Yc10EHccfrWoIfQ3SgG7Y0p8fTQV46gcpS4xwSgWZheXr1mE+wCnJZBXdjFtTgu4izz4ik7NygJ5yb+RKQC4v4sAI2in1cdqndZqDSyDAoVtCk/cbKLGWf2L5hwyrdYo3HcqdCvncYHmGAOCrNYr/xrpb7qb7Rh/t0y6Dou5o3nrIoc5PSLao/a8Tenr/8ffvFPepN/lTPzcKCbTWurJ1U2i3tIENJFVkib9L8Fd/KPXz5DW3Zy6yupelb1Gsq3J0hNNpPOqdIaQ9DClr/PLQE9j32TF5ew819UL5SoboYcFOaFikD7BA4KQ8SgVXXQuUiTF8/AyCV1RQfny0HhcrEAtHJw4KDgiBWAsqYpg/2jAFeuYuy0urWc98hBISzWHBRO5gcOCtnXPKag13F44yaXfIsm3FK92129UlC4kxNiCgpZBYGDAty999/aU/creBsKD/7H4UNdJ/UIo70I/uMnT5+lVBhtClf7uUNX+wUVXjpevKKXeA1u5WsFezws2AAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAxOC0xMC0xOVQwNzozNzo1MyswMDowMIPF6M0AAAAldEVYdGRhdGU6bW9kaWZ5ADIwMTgtMTAtMTlUMDc6Mzc6NTMrMDA6MDDymFBxAAAAAElFTkSuQmCC',
  functionConfigurationComponents: {
    'exact-get-request': ExactGetRequestConfigurationComponent,
    'exact-post-request': ExactPostRequestConfigurationComponent,
    'exact-put-request': ExactPutRequestConfigurationComponent,
  },
  pluginTranslations: {
    nl: {
      title: 'Exact Plugin',
      description: 'Plugin to set up Exact API connection',
      configurationTitle: 'Configuratienaam',
      clientId: 'Client Id',
      clientSecret: 'Client Secret',
      'exact-get-request': 'Exact GET request',
      'exact-post-request': 'Exact POST request',
      'exact-put-request': 'Exact PUT request',
      uri: 'URI',
      bean: 'Service class',
      content: 'Bericht',
    },
    en: {
      title: 'Exact Plugin',
      description: 'Plugin to set up Exact API connection',
      configurationTitle: 'Configuratienaam',
      clientId: 'Client Id',
      clientSecret: 'Client Secret',
      'exact-get-request': 'Exact GET request',
      'exact-post-request': 'Exact POST request',
      'exact-put-request': 'Exact PUT request',
      uri: 'URI',
      bean: 'Service class',
      content: 'Content',
    },
    de: {
      title: 'Exact Plugin',
      description: 'Plugin zum Einrichten einer Exact-API-Verbindung',
      configurationTitle: 'Konfigurationsname',
      clientId: 'Kunden ID',
      clientSecret: 'Client-Geheimnis',
      'exact-get-request': 'Exakte GET-Anfrage',
      'exact-post-request': 'Exakte POST-Anfrage',
      'exact-put-request': 'Exakte PUT-Anfrage',
      uri: 'URI',
      bean: 'Serviceklasse',
      content: 'Inhalt',
    },
  },
};

export {exactPluginSpecification};
