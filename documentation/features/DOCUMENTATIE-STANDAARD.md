# Valtimo Documentatie Standaard

Dit document beschrijft de standaard structuur, tone of voice en richtlijnen voor het documenteren van nieuwe features in Valtimo.

---

## Doelgroep

De Valtimo documentatie richt zich op twee primaire doelgroepen:

| Doelgroep | Kenmerken | Typische content |
|-----------|-----------|------------------|
| **Functioneel beheerders** | Configureren via UI, geen code-ervaring vereist | UI-instructies, conceptuele uitleg, screenshots |
| **Developers** | Configureren via IDE/code, technische achtergrond | Code snippets, auto-deployment, API's, extensies |

---

## Tone of Voice

### Kenmerken
- **Zakelijk en professioneel** - geen informele taal
- **Direct en instructief** - gebruik actieve werkwoorden
- **Neutraal en objectief** - beschrijf functies, vermijd superlatieven
- **Consistent in terminologie** - gebruik vaste begrippen (zie Begrippenlijst)

### Voorbeelden

| Goed | Vermijden |
|------|-----------|
| "A case is created after an event" | "Je kunt super makkelijk een case maken" |
| "Go to the Admin menu" | "Ga naar het Admin menu en klik op..." |
| "This page requires knowledge of JSON schema" | "Je moet JSON wel een beetje snappen" |

### Taal
- Documentatie is in het **Engels**
- Gebruik Britse of Amerikaanse spelling consistent (kies één)
- Technische termen blijven in het Engels (case, plugin, document definition)

---

## Paginastructuur

### README.md (Feature Overview)

Elke feature folder bevat een `README.md` als hoofdpagina met de volgende structuur:

```markdown
# [Emoji] [Feature Naam]

## What is [feature]?
[Conceptuele uitleg van de feature - 2-4 alinea's]

### [Subconcepten]
[Uitleg van gerelateerde concepten binnen de feature]

{% hint style="info" %}
[Belangrijke nuances of verduidelijkingen]
{% endhint %}

## Creating/Configuring [feature]

{% tabs %}
{% tab title="Via UI" %}
* Stapsgewijze instructies
* Screenshots waar relevant
{% endtab %}

{% tab title="Via IDE" %}
Code-gebaseerde configuratie met voorbeelden
{% endtab %}
{% endtabs %}

## Access control

[Referentie naar access control configuratie]

### Resources and actions

[Tabel met resource types, actions en effecten]

### Examples

<details>
<summary>[Beschrijving van voorbeeld]</summary>
[JSON code voorbeeld]
</details>
```

### Emoji conventies voor README titels

| Feature type | Emoji |
|--------------|-------|
| Cases | 🗃️ |
| Plugins | 🔌 |
| Forms | 📋 |
| Access Control | 🔏 |
| Dashboard | 📊 |
| ZGW | 📃 |
| Logging | 📝 |
| Tasks | ✅ |

---

## Documenttypen

### 1. Feature Overview (README.md)
**Doel:** Introductie en conceptuele uitleg van de feature
**Structuur:** Zie Paginastructuur hierboven
**Lengte:** Uitgebreid, volledig overzicht

### 2. Configuratie Documentatie (configure-*.md)
**Doel:** Specifieke plugin of component configuratie
**Structuur:**
```markdown
# [Component naam]

{% hint style="success" %}
[Beschikbaarheid of editie-specifieke info]
{% endhint %}

[Korte beschrijving van het doel]

### Prerequisites

[Vereiste kennis of configuraties]

## Configuring the [component]

[Referentie naar algemene configuratie-instructies]

[Specifieke properties met beschrijving]

An example [component] configuration:

<figure><img src="..." alt=""><figcaption></figcaption></figure>
```

### 3. Developer Documentatie (for-developers.md)
**Doel:** Technische extensie en custom implementaties
**Structuur:**
```markdown
---
icon: laptop-code
---

# For developers

{% hint style="info" %}
The for developers section within each feature gives more tech heavy information...
{% endhint %}

<details>
<summary>[Implementatie titel]</summary>

#### [Sectie titel]

[Uitleg]

**Dependencies**

```kotlin
[dependency code]
```

**Considerations**

[Technische overwegingen]

#### Implementing [component]

```kotlin
[Implementatie code]
```

#### Bean configuration

```kotlin
[Spring configuratie]
```

</details>
```

### 4. How-to Documentatie (specifieke taken)
**Doel:** Stapsgewijze instructies voor specifieke taken
**Structuur:**
```markdown
# [Taak beschrijving]

{% hint style="info" %}
This page requires:
* [Vereiste kennis]
{% endhint %}

## Use case

**Use case:** [Scenario beschrijving]

**Solution:**
* [Stappen]

## [Hoofdsectie]

[Instructies met tabs voor UI/IDE waar relevant]
```

---

## Opmaak Conventies

### GitBook Componenten

#### Hints
```markdown
{% hint style="info" %}
Algemene informatie of tips
{% endhint %}

{% hint style="success" %}
Beschikbaarheid: "Available since Valtimo X.X.X"
{% endhint %}

{% hint style="warning" %}
Waarschuwingen voor potentiële problemen
{% endhint %}

{% hint style="danger" %}
Kritieke waarschuwingen (dataverlies, onomkeerbare acties)
{% endhint %}
```

#### Tabs
Gebruik tabs voor UI vs IDE instructies:
```markdown
{% tabs %}
{% tab title="Via UI" %}
[UI instructies]
{% endtab %}

{% tab title="Via IDE" %}
[Code-based instructies]
{% endtab %}
{% endtabs %}
```

#### Collapsible Secties
Gebruik voor voorbeelden en optionele details:
```markdown
<details>
<summary>[Titel]</summary>

[Content]

</details>
```

#### Code Blocks
```markdown
{% code title="bestandsnaam.json" %}
```json
{
  "example": "code"
}
```
{% endcode %}
```

#### Figuren
```markdown
<figure><img src="../../.gitbook/assets/[bestandsnaam].png" alt=""><figcaption><p>[Beschrijving]</p></figcaption></figure>
```

### Tabellen

Gebruik voor:
- Resource types en actions
- Properties en beschrijvingen
- Import/export overzichten
- Operators en hun betekenis

```markdown
| Kolom 1 | Kolom 2 | Kolom 3 |
|---------|---------|---------|
| Waarde  | Waarde  | Waarde  |
```

### Links

#### Interne links
```markdown
[link tekst](../relatief/pad.md)
[link naar sectie](./bestand.md#sectie-id)
```

#### Externe links
```markdown
[Form.io](https://www.form.io/)
```

---

## Code Voorbeelden

### JSON Configuratie
- Gebruik altijd geldige, complete JSON
- Voeg commentaar toe via omringende tekst, niet in JSON
- Toon realistische voorbeelden met herkenbare waarden

### Kotlin/Java Code
- Toon complete, werkende voorbeelden
- Inclusief imports waar relevant
- Voeg dependencies sectie toe

### YAML Configuratie
```yaml
valtimo:
  imports:
    whitelistedPaths:
      - "VALTIMO_.*"
```

---

## Access Control Sectie

Elke feature die toegangsbeheer ondersteunt bevat:

1. **Referentie naar hoofdpagina**
```markdown
Access to [resource] can be configured through access control.
More information about access control can be found [here](../access-control).
```

2. **Resources and actions tabel**
```markdown
| Resource type | Action | Effect |
|---------------|--------|--------|
| `com.ritense...` | `view` | Allows viewing of... |
| | `view_list` | Allows viewing of... |
```

3. **Voorbeelden in collapsible secties**
```markdown
<details>
<summary>Permission to [beschrijving]</summary>

```json
{
    "resourceType": "...",
    "action": "...",
    "conditions": []
}
```

</details>
```

---

## Begrippenlijst

Gebruik deze termen consistent:

| Term | Betekenis |
|------|-----------|
| Case | Een instantie van een case definition (business process) |
| Case definition | De definitie/blueprint van een case |
| Document | JSON document met case data |
| Document definition | JSON schema dat document structuur definieert |
| Plugin | Extensie voor integratie met externe services |
| Plugin configuration | Geconfigureerde instantie van een plugin |
| Plugin action | Actie die een plugin kan uitvoeren |
| Process link | Koppeling tussen proces activiteit en actie |
| Access control | PBAC-gebaseerd toegangsbeheer |
| Permission | Toegangsrecht voor een resource en actie |
| Condition | Extra voorwaarde op een permission |

---

## Checklist Nieuwe Feature Documentatie

### Structuur
- [ ] Bepaal of feature subpagina's nodig heeft (zie "Wanneer aparte pagina's maken?")
- [ ] README.md met feature overview en emoji
- [ ] Subpagina's voor afzonderlijke onderdelen (indien van toepassing)
- [ ] Navigatie-links in README naar subpagina's ("In this section" tabel)
- [ ] Maximaal 3 navigatieniveaus

### Content per pagina
- [ ] Conceptuele uitleg ("What is..." / "Overview")
- [ ] Prerequisites/vereisten vermeld (indien van toepassing)
- [ ] UI en IDE tabs waar relevant
- [ ] Screenshots voor UI instructies
- [ ] Code voorbeelden voor IDE instructies
- [ ] Access control sectie (indien van toepassing)
- [ ] "Related" sectie met links naar gerelateerde pagina's
- [ ] Hints voor belangrijke informatie
- [ ] Consistente terminologie

### Optioneel
- [ ] For-developers.md voor technische extensies

---

## Navigatiestructuur & Pagina-indeling

De documentatie gebruikt een hiërarchische navigatiestructuur. Grote features worden opgesplitst in logische onderdelen met eigen pagina's.

### Wanneer aparte pagina's maken?

| Situatie | Aanpak |
|----------|--------|
| Feature heeft **meerdere duidelijk afgebakende onderdelen** | Maak subpagina's per onderdeel |
| Onderdeel heeft **eigen configuratieopties** | Aparte pagina |
| Onderdeel kan **onafhankelijk gebruikt worden** | Aparte pagina |
| Content zou **>500 regels** worden op één pagina | Splits op in subpagina's |
| Onderdeel heeft **zowel UI als IDE configuratie** | Aparte pagina met tabs |
| Informatie is puur **aanvullend/optioneel** | Subpagina of collapsible sectie |

### Voorbeeld: Cases feature

```
Cases/
├── README.md           → Hoofdoverzicht "Cases"
├── general.md          → Algemene case configuratie
├── processes.md        → Processen koppelen aan cases
├── decision-tables.md  → Decision tables configuratie
├── document.md         → Document/schema configuratie
├── forms/
│   ├── README.md       → Forms overzicht
│   └── ...             → Specifieke form onderwerpen
├── form-flows.md       → Form flows configuratie
├── tasks/
│   ├── README.md       → Tasks overzicht
│   └── ...             → Specifieke task onderwerpen
├── case-list/
│   ├── README.md       → Case list overzicht
│   ├── search-fields.md → Zoekveldenonfiguratie
│   └── columns.md      → Kolomconfiguratie
├── case-detail/
│   ├── README.md       → Case detail overzicht
│   ├── statuses.md     → Status configuratie
│   ├── tags.md         → Tags configuratie
│   └── tabs/
│       ├── README.md   → Tabs overzicht
│       └── ...         → Specifieke tab types
```

### Navigatieniveaus

De documentatie ondersteunt **maximaal 3 niveaus** in de navigatie:

```
Niveau 1: Feature (Cases, Access Control, Plugins, etc.)
└── Niveau 2: Onderdeel (Case list, Case detail, Forms, etc.)
    └── Niveau 3: Sub-onderdeel (Search fields, Columns, Tabs, etc.)
```

### README.md als navigatie-hub

Bij folders met subpagina's fungeert de README.md als overzichtspagina:

```markdown
# [Onderdeel naam]

[Korte beschrijving van dit onderdeel]

## Overview

[Conceptuele uitleg - wat is dit onderdeel en waarom gebruik je het]

## In this section

| Page | Description |
|------|-------------|
| [Search fields](search-fields.md) | Configure which fields are searchable |
| [Columns](columns.md) | Configure which columns are displayed |

## Quick start

[Optioneel: snelle start instructies die naar subpagina's verwijzen]
```

### Subpagina structuur

Subpagina's volgen een consistente structuur:

```markdown
# [Onderdeel naam]

[Eén zin beschrijving van wat deze pagina behandelt]

{% hint style="info" %}
This page requires:
* [Prerequisites indien van toepassing]
{% endhint %}

## Overview

[Conceptuele uitleg - wanneer en waarom gebruik je dit]

## Configuration

{% tabs %}
{% tab title="Via UI" %}
[UI configuratie stappen]
{% endtab %}

{% tab title="Via IDE" %}
[Code/JSON configuratie]
{% endtab %}
{% endtabs %}

## [Specifieke secties voor dit onderdeel]

[Verdere uitleg, voorbeelden, etc.]

## Related

* [Link naar gerelateerde pagina](../related-page.md)
* [Link naar andere gerelateerde pagina](../other-page.md)
```

---

## Mappenstructuur

```
/features
├── [feature-naam]/
│   ├── README.md                    # Feature overview (niveau 1)
│   ├── [onderdeel].md               # Standalone onderdeel pagina
│   ├── [onderdeel-met-subpaginas]/  # Onderdeel met eigen sectie (niveau 2)
│   │   ├── README.md                # Onderdeel overview
│   │   ├── [subonderdeel].md        # Subpagina (niveau 3)
│   │   └── [subonderdeel].md
│   └── for-developers.md            # Developer extensies (optioneel)
```

---

## Versie Informatie

Bij nieuwe features of wijzigingen:

```markdown
{% hint style="success" %}
Available since Valtimo `X.X.X`
{% endhint %}
```

Bij ZGW/GZAC specifieke features:

```markdown
{% hint style="success" %}
The [feature] is a ZGW plugin and can only be used in the GZAC edition.
{% endhint %}
```
