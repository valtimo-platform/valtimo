# IKO Documentatie Notities

## Wat is IKO?
- **Naam**: Integraal Klant- en Objectbeeld
- **Doel**: De zaakbehandelaar een volledig beeld geven van de Klant of het Object waarvoor de Zaak loopt
- **Architectuur**:
  - IKO Server: Een apart component (Spring Boot op basis van Apache Camel) die data uit meerdere achterliggende bronnen haalt
  - IKO Client: Gerealiseerd in Valtimo, toont de data aan de behandelaar
  - Beheerder kan het beeld configureren (hoe data gepresenteerd wordt)

## Bronnen
Typische bronnen die IKO kan benaderen:
- BRP (Basisregistratie Personen)
- KVK (Kamer van Koophandel)
- ZGW API's (Zaakgericht Werken)
- Domeinregistraties

---

## Beheerscherm Analyse (uit video)

### 1. IKO Management Hoofdscherm
- **Locatie**: Admin → Beelden
- **URL**: `/iko-management`
- **Functie**: Overzicht van geconfigureerde IKO Servers
- **Actie**: "Configure IKO Server" knop om nieuwe server toe te voegen

### 2. IKO Server Configuratie
- **Velden**:
  - Title: Naam voor de API configuratie
  - Key: Wordt auto-gegenereerd (kan handmatig aangepast)
  - IKO Server URL: URL naar de IKO server

### 3. Views per IKO Server
- **Locatie**: `/iko-management/iko-server`
- **Bestaande views in demo**:
  - Kelders
  - Klant (BRP)
  - Klant (mock)
  - Object
  - Pand
  - Type klantbeeld
- **Actie**: "Add view" knop

### 4. View Configuratie (Add/Edit View)
- **Velden**:
  - Title: Weergavenaam (bijv. "Type klantbeeld")
  - Key: Technische sleutel (bijv. "type-klantbeeld")
  - Connector Reference: Referentie naar connector (bijv. "connector-in-iko")
  - Connector Instance Reference: Instance referentie (bijv. "connector-instance")
  - Endpoint Reference: API endpoint (bijv. "list_personen", "list_klanten")
  - Endpoint Query Parameters: Key-Value paren (bijv. "voornaam" → value)

### 5. View Details - Drie Tabs

#### 5.1 Search Actions Tab
- **Locatie**: `/iko-management/iko-server/klant/search`
- **Functie**: Configureer zoekacties voor de view
- **Bestaande search actions**:
  - BSN (key: "bsn")
  - Achternaam en geboortedatum (key: "achternaam-geboortedatum")
  - Adres (key: "adres")
- **Actie**: "Add search action" knop

#### 5.2 Search Action Configuratie
- **URL**: `/iko-management/iko-server/klant/search/search-action/achternaam-geboortedatum`
- **Velden per search field**:
  - Key: Technische sleutel (bijv. "achternaam")
  - Title: Weergavenaam (bijv. "Achternaam")
  - Path: Data pad (bijv. "geslachtsnaam")
  - Data type: Text, Date, etc.
  - Field type: Single, Multiple
- **Actie**: "Add search field" knop
- **Drag & drop**: Volgorde aanpasbaar

#### 5.3 List Tab
- **Locatie**: `/iko-management/iko-server/klant/list`
- **Functie**: Configureer de kolommen in de zoekresultaten tabel
- **Kolommen configuratie**:
  - Title: Kolomnaam
  - Key: Technische sleutel
  - Path: Data pad (bijv. "/naam/volledigeNaam", "/burgerservicenummer")
  - Display Type: Text, Date, etc.
  - Parameters: Extra parameters
  - Sortable: Ja/Nee
  - Default Sort: Standaard sortering
- **Actie**: "Add Column" knop

#### 5.4 Tabs Tab
- **Locatie**: `/iko-management/iko-server/klant/tabs`
- **Functie**: Configureer de tabs in het detailscherm
- **Actie**: "Add tab" knop

### 6. Tab Configuratie
- Elke tab bevat widgets
- **Bestaande tabs in demo** (Klant BRP - Algemeen):
  - Algemeen
  - Lopende Zaken
  - Notities
  - Producten
  - Contactmomenten
  - Documenten
  - Werk
  - Inkomen

### 7. Widget Details Overzicht
- **Locatie**: `/iko-management/iko-server/klant/tabs/widget-details/general`
- **Kolommen in overzicht**:
  - Title
  - Type (Fields, Collection, Interactive table)
  - Key
  - Width (Small, Xtra large)
  - Density (Default, Compact)
  - High contrast (Yes/No)
- **Acties**:
  - "Add widget" knop
  - "Add divider" knop
  - Drag & drop volgorde

### 8. Widget Types
1. **Fields**: Vaste velden weergave (bijv. Klant info, Verblijfplaats)
2. **Collection**: Collectie van items (bijv. Nationaliteiten, Partners)
3. **Interactive table**: Interactieve tabel (bijv. Lopende zaken)

### 9. Widget Configuratie Wizard (Edit Widget)

#### Stap 1: Choose widget type
- Fields
- Collection
- Interactive table

#### Stap 2: Choose widget width
- Small (1 kolom)
- Xtra large (volledige breedte)

#### Stap 3: Choose widget density
- Default
- Compact

#### Stap 4: Choose widget style
- **Default**: "For regular content" - normale weergave
- **High contrast**: "For higher priority content" - geaccentueerde weergave met donkere achtergrond

#### Stap 5: Choose widget content
- **Widget title**: Titel van de widget
- **Icon**: Optioneel icoon
- **Target URL (with placeholders)**: Link URL met placeholders (bijv. "https://ritense.nl/zaak/${doc:/zaak/id}")
- **Button label**: Knop tekst (bijv. "Go to zaak")
- **Columns**: Meerdere kolommen mogelijk
  - Per kolom: velden toevoegen/verwijderen
  - Per veld:
    - Title: Veldnaam
    - Display type: Text, Date, Date and time, Currency, Yes/No
    - Value: Data pad (bijv. "iko:/persoon/naam/volledigeNaam")
    - Hide when empty: Checkbox
- **Actie**: "Add field" knop

#### Stap 6: Set display conditions
- **Functie**: Conditionele weergave van widgets
- **Configuratie**:
  - Path: Data pad voor conditie (bijv. "/alleen-tonen-als")
  - Operator: Vergelijkingsoperator (bijv. "Equal to", "==")
  - Value: Waarde om te vergelijken (bijv. "true")
- **Actie**: "Add condition" knop

### 10. Visual Editor vs JSON Editor
- **Visual editor**: Grafische interface voor widget configuratie
- **JSON editor**: Direct JSON bewerken voor geavanceerde configuratie

### 11. JSON Structuur (uit video)
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

### 12. Gebruikersweergave (Views menu)
- **Locatie**: Views menu in sidebar
- **Functie**: Eindgebruiker zoekscherm
- **URL**: `/iko/klant`
- **Search via tabs**: BSN, Achternaam en geboortedatum, Adres
- **Zoekresultaten**: Tabel met geconfigureerde kolommen
- **Detail view**: Klantbeeld met alle geconfigureerde tabs en widgets

### 13. Klantbeeld Detail View
- **URL**: `/iko/klant/bsn/details/999990755?bsn=999990755`
- **Tabs**: Algemeen, Lopende Zaken, Notities, Producten, Contactmomenten, Documenten, Werk, Inkomen
- **Widgets op Algemeen tab**:
  - Klant (Fields, High contrast) - Naam, Geboortedatum, BSN
  - Nationaliteiten (Collection) - Nationaliteit, Ingangsdatum
  - Verblijfplaats (Fields, High contrast) - Verblijfadres, Huisnummer, Postcode, Ingangsdatum
  - Partners (Collection) - BSN, Voornamen, Geslachtsnaam
  - Lopende zaken (Interactive table) - Identificatie, Zaaktype, Status, Uiterlijke einddatum afdoening

---

## Nog te beantwoorden vragen
1. Hoe wordt IKO gebruikt vanuit een Zaak?
2. Wordt het IKO-beeld automatisch getoond bij een zaak?
3. Hoe weet Valtimo welk "beeld" (view) getoond moet worden voor een specifieke zaak?
4. Technische implementatie details (backend/frontend)
5. Configuratie van de IKO Server zelf (Apache Camel routes)
