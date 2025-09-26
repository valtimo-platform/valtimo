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

import {
    OpenProductConfigurationComponent
} from './components/open-product-configuration/open-product-configuration.component';
import {OPEN_PRODUCT_PLUGIN_LOGO_BASE64} from './assets';
import {PluginSpecification} from "../../models"
import {CreateProductConfigurationComponent} from "./components/create-product/create-product-configuration.component";
import {UpdateProductConfigurationComponent} from "./components/update-product/update-product-configuration.component";
import {DeleteProductConfigurationComponent} from "./components/delete-product/delete-product-configuration.component";


const openProductPluginSpecification: PluginSpecification = {
    pluginId: 'openproduct',
    pluginConfigurationComponent: OpenProductConfigurationComponent,
    pluginLogoBase64: OPEN_PRODUCT_PLUGIN_LOGO_BASE64,
    functionConfigurationComponents: {
        /*
         For each plugin action id received from the backend, a component is provided of the interface FunctionConfigurationComponent.
         These are used to configure each plugin action.
         */
        'create-product': CreateProductConfigurationComponent,
        'update-product': UpdateProductConfigurationComponent,
        'delete-product': DeleteProductConfigurationComponent
    },

    pluginTranslations: {
        nl: {
            title: 'Open Product Plugin',
            description: 'Deze plugin maakt het mogelijk om producten van de open producten API te beheren binnen Valtimo.',
            configurationTitle: 'Configuratienaam',
            configurationTitleTooltip: 'Configuratie naam is de naam die gebruikt wordt om de configuratie te identificeren.',
            baseUrl: 'URL',
            productUUID: 'De UUID van het product',
            productNaam: 'De naam van het product',
            productTypeUUID: 'De UUID van het producttype',
            eigenaarBSN: 'De bsn van de eigenaar',
            eigenaarData: 'De gegevens van de eigenaar',
            gepubliceerd: 'Kan het object getoond worden?',
            productPrijs: 'De prijs van het product',
            frequentie: 'De frequentie van de betalingen',
            status: 'De status van het product',
            resultaatPV: 'De naam van de process variable waar het resultaat in komt',
            authenticationPluginConfiguration: 'Selecteer de authenticatie plugin configuratie',
        },
        en: {
            title: 'Open Product Plugin',
            description: 'This plugin enables management of products from the Open Products API within Valtimo.',
            configurationTitle: 'Configuration Name',
            configurationTitleTooltip: 'The name used to identify this configuration.',
            baseUrl: 'URL',
            productUUID: 'The UUID of the product',
            productNaam: 'The name of the product',
            productTypeUUID: 'The UUID of the product type',
            eigenaarBSN: 'The citizen service number (BSN) of the owner',
            eigenaarData: 'The owner’s data',
            gepubliceerd: 'Should this product be publicly visible?',
            productPrijs: 'The price of the product',
            frequentie: 'The payment frequency',
            status: 'The product’s status',
            resultaatPV: 'The name of the process variable that will contain the result',
            authenticationPluginConfiguration: 'Select the authentication plugin configuration',
        },
        de: {
            title: 'Open Product Plugin',
            description: 'Dieses Plugin ermöglicht die Verwaltung von Produkten der Open Products API innerhalb von Valtimo.',
            configurationTitle: 'Konfigurationsname',
            configurationTitleTooltip: 'Der Name, mit dem diese Konfiguration identifiziert wird.',
            baseUrl: 'URL',
            productUUID: 'Die UUID des Produkts',
            productNaam: 'Der Name des Produkts',
            productTypeUUID: 'Die UUID des Produkttyps',
            eigenaarBSN: 'Die BSN (Bürgernummer) des Eigentümers',
            eigenaarData: 'Die Daten des Eigentümers',
            gepubliceerd: 'Soll dieses Produkt öffentlich angezeigt werden?',
            productPrijs: 'Der Preis des Produkts',
            frequentie: 'Die Häufigkeit der Zahlungen',
            status: 'Der Status des Produkts',
            resultaatPV: 'Der Name der Prozessvariablen, in der das Ergebnis gespeichert wird',
            authenticationPluginConfiguration: 'Wählen Sie die Authentifizierungs-Plugin-Konfiguration aus',
        }
    }
};

export {openProductPluginSpecification};
