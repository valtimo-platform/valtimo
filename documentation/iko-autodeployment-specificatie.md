# IKO Autodeployment Specificatie

## Inleiding

De IKO (Integraal Klantbeeld Overzicht) module biedt een configureerbare manier om klantgegevens uit verschillende bronnen te tonen. Via het autodeployment mechanisme kunnen IKO-configuraties als JSON-bestanden worden beheerd en automatisch bij applicatie-startup in de database worden geladen.

Dit document beschrijft de structuur en opties van alle configuratiebestanden voor IKO autodeployment.

## Hoe werkt Autodeployment?

Bij het opstarten van de applicatie scant de IKO module de `config/global/iko/` directory voor JSON-configuratiebestanden. Elk bestandstype wordt herkend aan de extensie en in de juiste volgorde verwerkt om afhankelijkheden te respecteren.

### Bestandslocatie

Alle configuratiebestanden moeten in de volgende directory structuur staan:

```
config/global/iko/
├── {naam}.iko-repository-config.json      # Repository configuraties
└── {view-naam}/                            # Subdirectory per view
    ├── {naam}.iko-view.json
    ├── {naam}.iko-search-action.json
    ├── {naam}.iko-search-field.json
    ├── {naam}.iko-list-column.json
    ├── {naam}.iko-tab.json
    └── {naam}.iko-widget.json
```

### Bestandsextensies

| Extensie | Beschrijving |
|----------|--------------|
| `.iko-repository-config.json` | Backend databron configuratie |
| `.iko-view.json` | View definitie |
| `.iko-search-action.json` | Zoekopdrachten |
| `.iko-search-field.json` | Zoekvelden per zoekopdracht |
| `.iko-list-column.json` | Kolommen in zoekresultaten |
| `.iko-tab.json` | Tabbladen binnen een view |
| `.iko-widget.json` | Widgets binnen een tab |

### Deployment Volgorde

De importers verwerken bestanden in een specifieke volgorde vanwege onderlinge afhankelijkheden:

```
1. iko-repository-config  ─────────────────────────────────┐
                                                           │
2. iko-view ──────────────── hangt af van: repository-config
       │
       ├── 3. iko-search-action ── hangt af van: view
       │           │
       │           └── 4. iko-search-field ── hangt af van: search-action
       │
       ├── 5. iko-tab ──────────── hangt af van: view
       │           │
       │           └── 7. iko-widget ──────── hangt af van: tab
       │
       └── 6. iko-list-column ──── hangt af van: view
```

---

## Configuratie Specificaties

### 1. Repository Config

Definieert de backend databron waarmee de IKO view verbinding maakt.

**Bestandsextensie:** `*.iko-repository-config.json`

#### Schema

| Veld | Type | Verplicht | Beschrijving |
|------|------|-----------|--------------|
| `key` | string | ✓ | Unieke identifier voor de repository config |
| `title` | string | ✓ | Weergavenaam |
| `type` | string | ✓ | Type repository (bijv. `iko`) |
| `properties` | object | | Configuratie-eigenschappen specifiek voor het type |

#### Voorbeeld

```json
{
  "key": "iko-api",
  "title": "IKO API Server",
  "type": "iko",
  "properties": {
    "ikoServerUrl": "${VALTIMO_IKO_API_URL}"
  }
}
```

---

### 2. View

Definieert een IKO view die gekoppeld is aan een repository config. Een view is het startpunt voor het tonen van klantgegevens.

**Bestandsextensie:** `*.iko-view.json`

#### Schema

| Veld | Type | Verplicht | Beschrijving |
|------|------|-----------|--------------|
| `key` | string | ✓ | Unieke identifier voor de view |
| `ikoRepositoryConfigKey` | string | ✓ | Verwijzing naar een repository config |
| `title` | string | ✓ | Weergavenaam van de view |
| `properties` | object | | View-specifieke eigenschappen |

#### Properties

| Property | Type | Beschrijving |
|----------|------|--------------|
| `connectorTag` | string | Tag van de connector (bijv. `brp`) |
| `connectorInstanceTag` | string | Tag van de connector instance |
| `endpointOperation` | string | Naam van de API operatie |
| `endpointQueryParameters` | object | Query parameters voor de API |

#### Voorbeeld

```json
{
  "key": "klant",
  "ikoRepositoryConfigKey": "iko-api",
  "title": "Klant (BRP)",
  "properties": {
    "connectorTag": "brp",
    "connectorInstanceTag": "brp1",
    "endpointOperation": "Personen",
    "endpointQueryParameters": {
      "fields": "burgerservicenummer,naam,geboorte,verblijfplaats"
    }
  }
}
```

---

### 3. Search Actions (Zoekopdrachten)

Definieert de beschikbare zoekopdrachten binnen een view. Gebruikers kunnen tussen deze zoekopdrachten kiezen om op verschillende manieren te zoeken.

**Bestandsextensie:** `*.iko-search-action.json`

#### Schema

| Veld | Type | Verplicht | Beschrijving |
|------|------|-----------|--------------|
| `ikoViewKey` | string | ✓ | Verwijzing naar de parent view |
| `ikoSearchActions` | array | ✓ | Lijst van search actions |

#### Search Action Object

| Veld | Type | Verplicht | Beschrijving |
|------|------|-----------|--------------|
| `key` | string | ✓ | Unieke identifier |
| `title` | string | ✓ | Weergavenaam |
| `properties` | object | | Actie-specifieke eigenschappen |

#### Voorbeeld

```json
{
  "ikoViewKey": "klant",
  "ikoSearchActions": [
    {
      "key": "bsn",
      "title": "Zoeken op BSN",
      "properties": {
        "endpointQueryParameters": {
          "type": "RaadpleegMetBurgerservicenummer"
        }
      }
    },
    {
      "key": "naam-geboortedatum",
      "title": "Zoeken op naam en geboortedatum",
      "properties": {
        "endpointQueryParameters": {
          "type": "ZoekMetGeslachtsnaamEnGeboortedatum"
        }
      }
    }
  ]
}
```

---

### 4. Search Fields (Zoekvelden)

Definieert de invoervelden die getoond worden voor een specifieke zoekopdracht.

**Bestandsextensie:** `*.iko-search-field.json`

#### Schema

| Veld | Type | Verplicht | Beschrijving |
|------|------|-----------|--------------|
| `ikoViewKey` | string | ✓ | Verwijzing naar de parent view |
| `ikoSearchActionKey` | string | ✓ | Verwijzing naar de search action |
| `ikoSearchFields` | array | ✓ | Lijst van zoekvelden |

#### Search Field Object

| Veld | Type | Verplicht | Default | Beschrijving |
|------|------|-----------|---------|--------------|
| `key` | string | ✓ | | Unieke identifier |
| `title` | string | | | Weergavenaam (label) |
| `path` | string | ✓ | | Pad naar het data veld in de query |
| `dataType` | enum | ✓ | | Data type van het veld |
| `fieldType` | enum | ✓ | | Type invoerveld |
| `matchType` | enum | | | Match strategie |
| `dropdownDataProvider` | string | | | Data provider voor dropdown opties |
| `required` | boolean | | `false` | Is het veld verplicht? |

#### DataType Waarden

| Waarde | Beschrijving |
|--------|--------------|
| `text` | Tekst invoer |
| `number` | Numerieke invoer |
| `date` | Datum (zonder tijd) |
| `datetime` | Datum met tijd |
| `time` | Alleen tijd |
| `boolean` | Ja/Nee keuze |
| `bsn` | Burgerservicenummer (met validatie) |

#### FieldType Waarden

| Waarde | Beschrijving |
|--------|--------------|
| `single` | Enkelvoudig invoerveld |
| `range` | Bereik (van-tot) |
| `single-select-dropdown` | Dropdown met enkele selectie |
| `multi-select-dropdown` | Dropdown met meervoudige selectie |

#### MatchType Waarden

| Waarde | Beschrijving |
|--------|--------------|
| `exact` | Exacte match |
| `like` | Gedeeltelijke match (contains) |

#### Voorbeeld

```json
{
  "ikoViewKey": "klant",
  "ikoSearchActionKey": "naam-geboortedatum",
  "ikoSearchFields": [
    {
      "key": "achternaam",
      "title": "Achternaam",
      "path": "geslachtsnaam",
      "dataType": "text",
      "fieldType": "single",
      "matchType": "exact",
      "required": true
    },
    {
      "key": "geboortedatum",
      "title": "Geboortedatum",
      "path": "geboortedatum",
      "dataType": "date",
      "fieldType": "single",
      "matchType": "exact",
      "required": true
    },
    {
      "key": "geslacht",
      "title": "Geslacht",
      "path": "geslachtsaanduiding",
      "dataType": "text",
      "fieldType": "single-select-dropdown",
      "dropdownDataProvider": "geslachtDataProvider",
      "required": false
    }
  ]
}
```

---

### 5. List Columns

Definieert de kolommen die getoond worden in de zoekresultatenlijst.

**Bestandsextensie:** `*.iko-list-column.json`

#### Schema

| Veld | Type | Verplicht | Beschrijving |
|------|------|-----------|--------------|
| `ikoViewKey` | string | ✓ | Verwijzing naar de parent view |
| `ikoListColumns` | array | ✓ | Lijst van kolommen |

#### List Column Object

| Veld | Type | Verplicht | Beschrijving |
|------|------|-----------|--------------|
| `id` | UUID | | Optionele vaste ID |
| `key` | string | ✓ | Unieke identifier |
| `title` | string | | Kolomkop |
| `path` | string | ✓ | JSON path naar de data |
| `displayType` | object | ✓ | Weergave configuratie |
| `sortable` | boolean | ✓ | Is de kolom sorteerbaar? |
| `defaultSort` | enum | | Standaard sorteerrichting (`ASC` of `DESC`) |

#### Display Type Object

| Veld | Type | Beschrijving |
|------|------|--------------|
| `type` | string | Type weergave (bijv. `text`) |
| `displayTypeParameters` | object | Type-specifieke parameters |

#### Voorbeeld

```json
{
  "ikoViewKey": "klant",
  "ikoListColumns": [
    {
      "key": "bsn",
      "title": "BSN",
      "path": "/burgerservicenummer",
      "displayType": {
        "type": "text",
        "displayTypeParameters": {}
      },
      "sortable": false
    },
    {
      "key": "naam",
      "title": "Naam",
      "path": "/naam/volledigeNaam",
      "displayType": {
        "type": "text",
        "displayTypeParameters": {}
      },
      "sortable": true,
      "defaultSort": "ASC"
    },
    {
      "key": "geboortedatum",
      "title": "Geboortedatum",
      "path": "/geboorte/datum/datum",
      "displayType": {
        "type": "text",
        "displayTypeParameters": {}
      },
      "sortable": true
    }
  ]
}
```

---

### 6. Tabs

Definieert de tabbladen die getoond worden wanneer een specifiek record is geselecteerd.

**Bestandsextensie:** `*.iko-tab.json`

#### Schema

| Veld | Type | Verplicht | Beschrijving |
|------|------|-----------|--------------|
| `ikoViewKey` | string | ✓ | Verwijzing naar de parent view |
| `ikoTabs` | array | ✓ | Lijst van tabs |

#### Tab Object

| Veld | Type | Verplicht | Beschrijving |
|------|------|-----------|--------------|
| `key` | string | ✓ | Unieke identifier |
| `title` | string | | Weergavenaam van de tab |
| `type` | string | ✓ | Tab type (bijv. `widgets`) |
| `properties` | object | | Tab-specifieke eigenschappen |

#### Properties

| Property | Type | Beschrijving |
|----------|------|--------------|
| `aggregatedDataProfileName` | string | Naam van het data profiel voor aggregatie |

#### Voorbeeld

```json
{
  "ikoViewKey": "klant",
  "ikoTabs": [
    {
      "key": "algemeen",
      "title": "Algemeen",
      "type": "widgets",
      "properties": {
        "aggregatedDataProfileName": "Personen"
      }
    },
    {
      "key": "zaken",
      "title": "Zaken",
      "type": "widgets"
    },
    {
      "key": "documenten",
      "title": "Documenten",
      "type": "widgets"
    }
  ]
}
```

---

### 7. Widgets

Definieert de widgets die getoond worden binnen een tab. Widgets zijn de bouwblokken voor het tonen van informatie.

**Bestandsextensie:** `*.iko-widget.json`

#### Schema

| Veld | Type | Verplicht | Beschrijving |
|------|------|-----------|--------------|
| `ikoViewKey` | string | ✓ | Verwijzing naar de parent view |
| `ikoTabKey` | string | ✓ | Verwijzing naar de parent tab |
| `ikoWidgets` | array | ✓ | Lijst van widgets |

#### Basis Widget Object

Alle widgets delen deze basis eigenschappen:

| Veld | Type | Verplicht | Beschrijving |
|------|------|-----------|--------------|
| `type` | string | ✓ | Widget type (discriminator) |
| `key` | string | ✓ | Unieke identifier |
| `title` | string | ✓ | Titel van de widget |
| `icon` | string | | Icoon naam |
| `width` | integer | ✓ | Breedte in kolommen (1-4) |
| `highContrast` | boolean | ✓ | Hoog contrast weergave |
| `isCompact` | boolean | | Compacte weergave |
| `actions` | array | | Widget acties |
| `displayConditions` | array | | Voorwaarden voor tonen |
| `properties` | object | ✓ | Type-specifieke eigenschappen |

#### Beschikbare Widget Types

| Type | Beschrijving |
|------|--------------|
| `fields` | Key-value velden in kolommen |
| `collection` | Lijst van items met paginering |
| `table` | Data in tabelvorm |
| `interactive-table` | Tabel met sortering en filtering |
| `map` | Geografische kaartweergave |
| `divider` | Visuele scheiding |
| `custom` | Aangepaste widget |

---

#### 7.1 Fields Widget

Toont key-value velden georganiseerd in kolommen. Ideaal voor het tonen van basisgegevens.

**Type:** `fields`

##### Properties

| Veld | Type | Beschrijving |
|------|------|--------------|
| `columns` | array[array] | 2D array van velden per kolom |

##### Field Object

| Veld | Type | Verplicht | Beschrijving |
|------|------|-----------|--------------|
| `key` | string | ✓ | Unieke identifier |
| `title` | string | ✓ | Label |
| `value` | string | ✓ | Waarde path (met `iko:` prefix) |
| `displayProperties` | object | | Weergave eigenschappen |

##### Voorbeeld

```json
{
  "type": "fields",
  "key": "persoonsgegevens",
  "title": "Persoonsgegevens",
  "width": 2,
  "highContrast": true,
  "actions": [],
  "displayConditions": [],
  "properties": {
    "columns": [
      [
        {
          "key": "naam",
          "title": "Naam",
          "value": "iko:/persoon/naam/volledigeNaam"
        },
        {
          "key": "geboortedatum",
          "title": "Geboortedatum",
          "value": "iko:/persoon/geboorte/datum/datum",
          "displayProperties": {
            "type": "date",
            "format": "DD-MM-YYYY",
            "hideWhenEmpty": false
          }
        }
      ],
      [
        {
          "key": "bsn",
          "title": "BSN",
          "value": "iko:/persoon/burgerservicenummer"
        },
        {
          "key": "geslacht",
          "title": "Geslacht",
          "value": "iko:/persoon/geslacht/omschrijving"
        }
      ]
    ]
  }
}
```

---

#### 7.2 Collection Widget

Toont een lijst van gerelateerde items met paginering. Geschikt voor 1-op-N relaties.

**Type:** `collection`

##### Properties

| Veld | Type | Beschrijving |
|------|------|--------------|
| `collection` | string | Path naar de collectie (met `iko:` prefix) |
| `defaultPageSize` | integer | Aantal items per pagina |
| `title` | object | Titel configuratie per item |
| `fields` | array | Velden per item |

##### Collection Field Object

| Veld | Type | Beschrijving |
|------|------|--------------|
| `key` | string | Unieke identifier |
| `title` | string | Label |
| `value` | string | Relatief path binnen het item |
| `width` | string | Breedte: `full` of `half` |

##### Voorbeeld

```json
{
  "type": "collection",
  "key": "nationaliteiten",
  "title": "Nationaliteiten",
  "width": 1,
  "highContrast": false,
  "actions": [],
  "displayConditions": [],
  "properties": {
    "collection": "iko:/persoon/nationaliteiten",
    "defaultPageSize": 4,
    "title": {
      "value": "/nationaliteit/omschrijving"
    },
    "fields": [
      {
        "key": "nationaliteit",
        "title": "Nationaliteit",
        "value": "/nationaliteit/omschrijving",
        "width": "full"
      },
      {
        "key": "datumIngang",
        "title": "Ingangsdatum",
        "value": "/datumIngangGeldigheid/langFormaat",
        "width": "half"
      }
    ]
  }
}
```

---

#### 7.3 Table Widget

Toont data in een eenvoudige tabel zonder interactieve features.

**Type:** `table`

##### Properties

| Veld | Type | Beschrijving |
|------|------|--------------|
| `collection` | string | Path naar de data collectie |
| `defaultPageSize` | integer | Aantal rijen per pagina |
| `columns` | array | Kolom definities |
| `firstColumnAsTitle` | boolean | Eerste kolom als titel gebruiken |

##### Voorbeeld

```json
{
  "type": "table",
  "key": "contactmomenten",
  "title": "Contactmomenten",
  "width": 3,
  "highContrast": false,
  "actions": [],
  "displayConditions": [],
  "properties": {
    "collection": "iko:/contactmomenten",
    "defaultPageSize": 5,
    "columns": [
      {
        "key": "datum",
        "title": "Datum",
        "value": "registratiedatum",
        "displayProperties": {
          "type": "date",
          "format": "DD-MM-YYYY"
        }
      },
      {
        "key": "kanaal",
        "title": "Kanaal",
        "value": "kanaal"
      },
      {
        "key": "onderwerp",
        "title": "Onderwerp",
        "value": "onderwerp"
      }
    ],
    "firstColumnAsTitle": false
  }
}
```

---

#### 7.4 Interactive Table Widget

Tabel met sorteer- en filtermogelijkheden.

**Type:** `interactive-table`

##### Properties

| Veld | Type | Beschrijving |
|------|------|--------------|
| `collection` | string | Path naar de data collectie |
| `defaultPageSize` | integer | Aantal rijen per pagina |
| `columns` | array | Kolom definities met sorteeropties |
| `filters` | array | Filter definities |
| `firstColumnAsTitle` | boolean | Eerste kolom als titel gebruiken |
| `canStartCase` | boolean | Kan een nieuwe zaak starten |

##### Interactive Column Object

| Veld | Type | Beschrijving |
|------|------|--------------|
| `key` | string | Unieke identifier |
| `title` | string | Kolomkop |
| `value` | string | Data path |
| `sortable` | boolean | Is sorteerbaar |
| `defaultSort` | string | Standaard sorteerrichting (`ASC`/`DESC`) |
| `displayProperties` | object | Weergave eigenschappen |

##### Voorbeeld

```json
{
  "type": "interactive-table",
  "key": "zaken",
  "title": "Lopende Zaken",
  "width": 4,
  "highContrast": false,
  "actions": [],
  "displayConditions": [],
  "properties": {
    "collection": "iko:/zaken",
    "defaultPageSize": 10,
    "columns": [
      {
        "key": "identificatie",
        "title": "Zaaknummer",
        "value": "identificatie",
        "sortable": true,
        "displayProperties": {
          "type": "text"
        }
      },
      {
        "key": "startdatum",
        "title": "Startdatum",
        "value": "startdatum",
        "sortable": true,
        "defaultSort": "DESC",
        "displayProperties": {
          "type": "date",
          "format": "DD-MM-YYYY"
        }
      },
      {
        "key": "status",
        "title": "Status",
        "value": "status/statustype/omschrijving",
        "sortable": false
      }
    ],
    "filters": [
      {
        "key": "status",
        "title": "Status",
        "dataType": "text",
        "fieldType": "single-select-dropdown",
        "matchType": "exact"
      }
    ],
    "firstColumnAsTitle": true,
    "canStartCase": false
  }
}
```

---

#### 7.5 Map Widget

Toont geografische data op een kaart.

**Type:** `map`

##### Properties

| Veld | Type | Beschrijving |
|------|------|--------------|
| `geoJsonSources` | array | Lijst van GeoJSON bronnen |

##### GeoJSON Source Object

| Veld | Type | Beschrijving |
|------|------|--------------|
| `key` | string | Path naar GeoJSON data |

##### Voorbeeld

```json
{
  "type": "map",
  "key": "locatie",
  "title": "Locatie",
  "width": 2,
  "highContrast": false,
  "actions": [],
  "displayConditions": [],
  "properties": {
    "geoJsonSources": [
      {
        "key": "iko:/verblijfplaats/geometry"
      }
    ]
  }
}
```

---

#### 7.6 Divider Widget

Visuele scheiding tussen widgets.

**Type:** `divider`

##### Voorbeeld

```json
{
  "type": "divider",
  "key": "scheiding-1",
  "title": "",
  "width": 4,
  "highContrast": false,
  "actions": [],
  "displayConditions": []
}
```

---

### Display Properties

Voor velden in widgets kunnen display properties worden geconfigureerd om de weergave aan te passen.

#### Beschikbare Types

| Type | Parameters | Beschrijving |
|------|------------|--------------|
| `text` | `hideWhenEmpty` | Standaard tekst weergave |
| `number` | `hideWhenEmpty` | Numerieke weergave |
| `date` | `format`, `hideWhenEmpty` | Datum weergave |
| `datetime` | `format`, `hideWhenEmpty` | Datum en tijd weergave |
| `boolean` | `hideWhenEmpty` | Ja/Nee weergave |
| `currency` | `hideWhenEmpty` | Valuta weergave |
| `percent` | `hideWhenEmpty` | Percentage weergave |
| `link` | `hideWhenEmpty` | Hyperlink weergave |
| `enum` | `hideWhenEmpty` | Enum mapping weergave |

#### Datum Formaten

Het `format` veld voor `date` en `datetime` types gebruikt standaard datum formaat patronen:

| Patroon | Beschrijving | Voorbeeld |
|---------|--------------|-----------|
| `DD-MM-YYYY` | Dag-Maand-Jaar | 31-12-2024 |
| `YYYY-MM-DD` | Jaar-Maand-Dag | 2024-12-31 |
| `DD/MM/YYYY` | Dag/Maand/Jaar | 31/12/2024 |

#### Voorbeeld

```json
{
  "displayProperties": {
    "type": "date",
    "format": "DD-MM-YYYY",
    "hideWhenEmpty": true
  }
}
```

---

### Value Resolvers

Waarden in widgets worden opgehaald via value resolvers. Het `iko:` prefix geeft aan dat de waarde uit de IKO context moet worden opgehaald.

#### Syntax

| Patroon | Beschrijving |
|---------|--------------|
| `iko:/pad/naar/veld` | Absolute path vanuit de root context |
| `/pad/naar/veld` | Relatief path binnen een collection item |

#### Voorbeelden

```json
// Absolute path - haalt data op uit de hoofd context
"value": "iko:/persoon/naam/volledigeNaam"

// Relatief path - binnen een collection item
"value": "/nationaliteit/omschrijving"
```

---

### Widget Actions

Widgets kunnen acties bevatten die gebruikers kunnen uitvoeren.

#### Beschikbare Action Types

| Type | Beschrijving |
|------|--------------|
| `createNewCase` | Start een nieuwe zaak |
| `startProcess` | Start een proces |
| `navigateTo` | Navigeer naar een andere pagina |

#### Voorbeeld

```json
{
  "actions": [
    {
      "type": "createNewCase",
      "label": "Nieuwe zaak starten",
      "caseDefinitionName": "bezwaar"
    }
  ]
}
```

---

## Volledige Configuratie Voorbeeld

Hieronder een compleet voorbeeld van alle configuratiebestanden voor een "Klant" view:

### Directory Structuur

```
config/global/iko/
├── iko-api.iko-repository-config.json
└── klant/
    ├── klant.iko-view.json
    ├── klant.iko-search-action.json
    ├── bsn.iko-search-field.json
    ├── naam-geboortedatum.iko-search-field.json
    ├── klant.iko-list-column.json
    ├── klant.iko-tab.json
    └── algemeen.iko-widget.json
```

### 1. iko-api.iko-repository-config.json

```json
{
  "key": "iko-api",
  "title": "IKO API",
  "type": "iko",
  "properties": {
    "ikoServerUrl": "${VALTIMO_IKO_API_URL}"
  }
}
```

### 2. klant/klant.iko-view.json

```json
{
  "key": "klant",
  "ikoRepositoryConfigKey": "iko-api",
  "title": "Klant (BRP)",
  "properties": {
    "connectorTag": "brp",
    "connectorInstanceTag": "brp1",
    "endpointOperation": "Personen",
    "endpointQueryParameters": {
      "fields": "burgerservicenummer,naam,geboorte,verblijfplaats,nationaliteiten"
    }
  }
}
```

### 3. klant/klant.iko-search-action.json

```json
{
  "ikoViewKey": "klant",
  "ikoSearchActions": [
    {
      "key": "bsn",
      "title": "Zoeken op BSN",
      "properties": {
        "endpointQueryParameters": {
          "type": "RaadpleegMetBurgerservicenummer"
        }
      }
    },
    {
      "key": "naam-geboortedatum",
      "title": "Zoeken op naam en geboortedatum",
      "properties": {
        "endpointQueryParameters": {
          "type": "ZoekMetGeslachtsnaamEnGeboortedatum"
        }
      }
    }
  ]
}
```

### 4. klant/bsn.iko-search-field.json

```json
{
  "ikoViewKey": "klant",
  "ikoSearchActionKey": "bsn",
  "ikoSearchFields": [
    {
      "key": "bsn",
      "title": "Burgerservicenummer",
      "path": "burgerservicenummer",
      "dataType": "bsn",
      "fieldType": "single",
      "matchType": "exact",
      "required": true
    }
  ]
}
```

### 5. klant/klant.iko-list-column.json

```json
{
  "ikoViewKey": "klant",
  "ikoListColumns": [
    {
      "key": "bsn",
      "title": "BSN",
      "path": "/burgerservicenummer",
      "displayType": {
        "type": "text",
        "displayTypeParameters": {}
      },
      "sortable": false
    },
    {
      "key": "naam",
      "title": "Naam",
      "path": "/naam/volledigeNaam",
      "displayType": {
        "type": "text",
        "displayTypeParameters": {}
      },
      "sortable": true,
      "defaultSort": "ASC"
    }
  ]
}
```

### 6. klant/klant.iko-tab.json

```json
{
  "ikoViewKey": "klant",
  "ikoTabs": [
    {
      "key": "algemeen",
      "title": "Algemeen",
      "type": "widgets",
      "properties": {
        "aggregatedDataProfileName": "Personen"
      }
    }
  ]
}
```

### 7. klant/algemeen.iko-widget.json

```json
{
  "ikoViewKey": "klant",
  "ikoTabKey": "algemeen",
  "ikoWidgets": [
    {
      "type": "fields",
      "key": "persoonsgegevens",
      "title": "Persoonsgegevens",
      "width": 2,
      "highContrast": true,
      "actions": [],
      "displayConditions": [],
      "properties": {
        "columns": [
          [
            {
              "key": "naam",
              "title": "Naam",
              "value": "iko:/persoon/naam/volledigeNaam"
            },
            {
              "key": "bsn",
              "title": "BSN",
              "value": "iko:/persoon/burgerservicenummer"
            }
          ],
          [
            {
              "key": "geboortedatum",
              "title": "Geboortedatum",
              "value": "iko:/persoon/geboorte/datum/datum",
              "displayProperties": {
                "type": "date",
                "format": "DD-MM-YYYY"
              }
            }
          ]
        ]
      }
    },
    {
      "type": "collection",
      "key": "nationaliteiten",
      "title": "Nationaliteiten",
      "width": 2,
      "highContrast": false,
      "actions": [],
      "displayConditions": [],
      "properties": {
        "collection": "iko:/persoon/nationaliteiten",
        "defaultPageSize": 4,
        "title": {
          "value": "/nationaliteit/omschrijving"
        },
        "fields": [
          {
            "key": "nationaliteit",
            "title": "Nationaliteit",
            "value": "/nationaliteit/omschrijving",
            "width": "full"
          }
        ]
      }
    }
  ]
}
```

---

## Tips en Best Practices

1. **Gebruik beschrijvende keys**: Keys worden gebruikt als identifiers en moeten uniek zijn binnen hun scope.

2. **Organiseer per view**: Plaats alle configuraties voor een view in een eigen subdirectory.

3. **Valideer JSON**: Controleer of alle JSON-bestanden geldig zijn voordat je deploy.

4. **Test incrementeel**: Deploy en test configuraties stap voor stap om problemen snel te identificeren.

5. **Gebruik environment variables**: Gebruik `${VAR_NAME}` syntax voor omgevingsafhankelijke waarden zoals URLs.

6. **Documenteer properties**: Niet alle properties zijn hier gedocumenteerd - raadpleeg de broncode voor geavanceerde opties.
