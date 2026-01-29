# IKO Client - Kennisdocument

## Wat is IKO?

**IKO** staat voor **Integraal Klant- en Objectbeeld**. Het doel is om de zaakbehandelaar een volledig beeld te geven van de Klant of het Object waarvoor de Zaak loopt.

## Architectuur

IKO bestaat uit twee componenten:

1. **IKO Server**: Een apart component (Spring Boot applicatie op basis van Apache Camel) die data uit meerdere achterliggende bronnen haalt om een volledig beeld op te bouwen. De IKO Server heeft een eigen beheerinterface (buiten scope van deze documentatie).

2. **IKO Client**: Gerealiseerd in Valtimo als module. De IKO Client toont de geaggregeerde data aan de behandelaar en biedt een beheerinterface voor het configureren van de presentatie.

## Bronnen

De IKO Server kan data ophalen uit diverse achterliggende bronnen, zoals:
- BRP (Basisregistratie Personen)
- KVK (Kamer van Koophandel)
- ZGW API's (Zaakgericht Werken)
- Domeinregistraties

## Vereisten

- De IKO Server moet apart geïnstalleerd zijn en bereikbaar zijn via een URL
- De IKO module moet geactiveerd zijn in Valtimo

---

## Toegang tot IKO-beeld

De behandelaar kan op twee manieren bij het IKO-beeld komen:

1. **Handmatig zoeken**: Via het zoekscherm in het Views-menu kan de behandelaar zoeken op bijvoorbeeld BSN, achternaam + geboortedatum, of adres.

2. **Directe link vanuit zaak**: Op het zaak-detailscherm kan een widget geconfigureerd worden met een knop/link naar het klant-detailscherm. De identifier (zoals BSN of KVK-nummer) wordt dan automatisch meegegeven vanuit het zaakdocument.

---

## Beheerscherm Structuur

Het IKO beheerscherm is te vinden onder **Admin → Beelden**.

### Hiërarchie

```
IKO Management
└── IKO Server(s)
    └── Views (bijv. Klant BRP, Object, Pand)
        ├── Search Actions (zoekacties)
        ├── List (zoekresultaten configuratie)
        └── Tabs (detailscherm tabs)
            └── Widgets (per tab)
```

---

## IKO Server Configuratie

Bij het toevoegen van een IKO Server worden de volgende velden geconfigureerd:

| Veld | Beschrijving |
|------|--------------|
| Title | Weergavenaam voor de IKO Server |
| Key | Technische sleutel (auto-gegenereerd, aanpasbaar) |
| IKO Server URL | URL naar de IKO Server |

---

## Views

Een View representeert een type beeld, bijvoorbeeld "Klant (BRP)", "Object", of "Pand". Per IKO Server kunnen meerdere Views geconfigureerd worden.

### View Configuratie

| Veld | Beschrijving |
|------|--------------|
| Title | Weergavenaam (bijv. "Klant BRP") |
| Key | Technische sleutel (bijv. "klant-brp") |
| Connector Reference | Referentie naar de connector (bijv. "connector-in-iko") |
| Connector Instance Reference | Instance referentie (bijv. "connector-instance") |
| Endpoint Reference | API endpoint op de IKO Server (bijv. "list_personen") |
| Endpoint Query Parameters | Key-Value paren voor query parameters |

### View Onderdelen

Elke View heeft drie configureerbare onderdelen:

1. **Search Actions** - Zoekacties voor de View
2. **List** - Kolommen voor de zoekresultaten tabel
3. **Tabs** - Tabs voor het detailscherm

---

## Search Actions

Search Actions definiëren hoe gebruikers kunnen zoeken binnen een View.

### Voorbeelden van Search Actions
- BSN (zoeken op Burgerservicenummer)
- Achternaam en geboortedatum
- Adres

### Search Action Configuratie

Per Search Action worden zoekveldedn geconfigureerd:

| Veld | Beschrijving |
|------|--------------|
| Key | Technische sleutel (bijv. "achternaam") |
| Title | Weergavenaam (bijv. "Achternaam") |
| Path | Data pad in het resultaat (bijv. "geslachtsnaam") |
| Data type | Type data: Text, Date, etc. |
| Field type | Single of Multiple |

De volgorde van zoekvelden is aanpasbaar via drag & drop.

---

## List Configuratie

De List configuratie bepaalt welke kolommen getoond worden in de zoekresultaten tabel.

### Kolom Configuratie

| Veld | Beschrijving |
|------|--------------|
| Title | Kolomnaam |
| Key | Technische sleutel |
| Path | Data pad (bijv. "/naam/volledigeNaam") |
| Display Type | Weergavetype: Text, Date, etc. |
| Parameters | Extra parameters |
| Sortable | Kolom sorteerbaar maken |
| Default Sort | Standaard sortering |

---

## Tabs

Tabs organiseren de informatie op het detailscherm in logische groepen.

### Voorbeelden van Tabs
- Algemeen
- Lopende Zaken
- Notities
- Producten
- Contactmomenten
- Documenten
- Werk
- Inkomen

Elke Tab bevat één of meerdere Widgets.

---

## Widgets

Widgets zijn de bouwstenen van een Tab en tonen de daadwerkelijke data.

### Widget Types

| Type | Beschrijving | Voorbeeld |
|------|--------------|-----------|
| Fields | Vaste velden weergave | Klantgegevens, Verblijfplaats |
| Collection | Collectie van items | Nationaliteiten, Partners |
| Interactive table | Interactieve tabel | Lopende zaken |

### Widget Configuratie Wizard

De widget configuratie doorloopt 6 stappen:

#### Stap 1: Choose widget type
Keuze uit: Fields, Collection, Interactive table

#### Stap 2: Choose widget width
- **Small** - 1 kolom breedte
- **Xtra large** - Volledige breedte

#### Stap 3: Choose widget density
- **Default** - Normale afstand tussen elementen
- **Compact** - Compacte weergave

#### Stap 4: Choose widget style
- **Default** - Normale weergave voor reguliere content
- **High contrast** - Geaccentueerde weergave met donkere achtergrond voor prioritaire content

#### Stap 5: Choose widget content

| Veld | Beschrijving |
|------|--------------|
| Widget title | Titel van de widget |
| Icon | Optioneel icoon |
| Target URL (with placeholders) | Link URL met placeholders |
| Button label | Tekst op de knop |
| Columns | Kolommen met velden |

**Veld configuratie binnen een kolom:**

| Veld | Beschrijving |
|------|--------------|
| Title | Veldnaam |
| Display type | Text, Date, Date and time, Currency, Yes/No |
| Value | Data pad (bijv. "iko:/persoon/naam/volledigeNaam") |
| Ellipsis character limit | Maximaal aantal tekens (optioneel) |
| Hide when empty | Veld verbergen als waarde leeg is |

#### Stap 6: Set display conditions

Display conditions bepalen wanneer een widget getoond wordt.

| Veld | Beschrijving |
|------|--------------|
| Path | Data pad voor de conditie |
| Operator | Vergelijkingsoperator (bijv. "==", "Equal to") |
| Value | Waarde om te vergelijken |

Meerdere condities kunnen toegevoegd worden.

### Widget Volgorde

De volgorde van widgets binnen een tab is aanpasbaar via drag & drop. Ook kan een **divider** toegevoegd worden om widgets visueel te scheiden.

### Visual Editor vs JSON Editor

Widgets kunnen geconfigureerd worden via:
- **Visual editor** - Grafische interface (wizard)
- **JSON editor** - Direct JSON bewerken voor geavanceerde configuratie

---

## Data Placeholders en Prefixes

Bij het configureren van URLs en waarden kunnen placeholders gebruikt worden om dynamisch data op te halen.

### Beschikbare Prefixes

| Prefix | Bron | Voorbeeld |
|--------|------|-----------|
| `doc:` | Zaakdocument (JSON document van de zaak) | `${doc:id}`, `doc:kelderId` |
| `iko:` | IKO data | `iko:/persoon/naam/volledigeNaam` |
| `pv:` | Procesvariabelen | `${pv:aanvrager}` |
| `case:` | Case-metadata | `${case:id}` |

### Voorbeeld Target URL
```
/iko/kelders/kelder_id/details/${doc:id}
```

Dit creëert een link naar het IKO detailscherm waarbij de ID uit het zaakdocument wordt gehaald.

---

## Koppeling vanuit Zaak

Op het zaak-detailscherm kan een widget geconfigureerd worden die linkt naar het IKO-beeld.

### Configuratie

| Veld | Waarde (voorbeeld) |
|------|-------------------|
| Action button type | Link |
| Target URL (with placeholders) | `/iko/kelders/kelder_id/details/${doc:id}` |
| Button label | Kelderbeeld |

De Value van velden kan via een dropdown gekoppeld worden aan zaakdocument velden (bijv. `doc:kelderId`).

---

## JSON Structuur (Referentie)

Voorbeeld van een widget configuratie in JSON:

```json
{
  "type": "fields",
  "key": "klant",
  "title": "Klant",
  "icon": "",
  "width": 1,
  "highContrast": true,
  "isCompact": false,
  "actions": [],
  "displayConditions": [
    {
      "path": "/alleen-tonen-als",
      "operator": "==",
      "value": "true"
    }
  ],
  "properties": {
    "columns": [
      {
        "key": "naam",
        "title": "Naam",
        "value": "iko:/persoon/naam/volledigeNaam",
        "displayProperties": {
          "type": "text",
          "hideWhenEmpty": false
        }
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
      },
      {
        "key": "bsn",
        "title": "BSN",
        "value": "iko:/persoon/burgerservicenummer",
        "displayProperties": {
          "type": "text",
          "hideWhenEmpty": false
        }
      }
    ]
  }
}
```

---

## Samenvatting Configuratie Flow

1. **IKO Server toevoegen** - Configureer URL en basisgegevens
2. **View aanmaken** - Definieer het type beeld (Klant, Object, etc.)
3. **Search Actions configureren** - Bepaal hoe gebruikers kunnen zoeken
4. **List configureren** - Stel de zoekresultaten kolommen in
5. **Tabs aanmaken** - Organiseer de detailinformatie in tabs
6. **Widgets toevoegen** - Configureer de data-weergave per tab
7. **Koppeling vanuit zaak** - Optioneel: configureer directe link op zaak-detailscherm
