# Valtimo Frontend Feature & Function List

**Doel:** Telbare lijst van features en functies voor KPI tracking, E2E test planning en documentatie.

**Legenda:**
- **Feature** = Hoog-niveau capability (bijv. "Case Definition Management")
- **Functie** = Specifieke actie/operatie binnen een feature (bijv. "Proces aanmaken")

**Status:** 🟢 Gedocumenteerd met screenshots | 🟡 Geïdentificeerd, geen screenshots | 🔴 Nog te verwerken

---

## Samenvatting

| Categorie | Aantal Features | Aantal Functies |
|-----------|-----------------|-----------------|
| User Features | 5 | 21 |
| Admin Features | 15 | 122 |
| **Totaal** | **20** | **143** |

---

## User Features (ROLE_USER)

### Feature 1: Dashboard 🟡

- 1.1. Widget-based dashboard weergeven
- 1.2. Widgets configureren per gebruiker/rol
- 1.3. Real-time data updates (SSE)

### Feature 2: Cases (User) 🔴

- 2.1. Cases overzicht bekijken per definitie
- 2.2. Case details bekijken (tabs)
- 2.3. Cases zoeken/filteren
- 2.4. Case documenten bekijken
- 2.5. Case voortgang/status bekijken
- 2.6. Taken uitvoeren binnen case

### Feature 3: Tasks 🟡

- 3.1. Alle open taken bekijken
- 3.2. Taken filteren/sorteren
- 3.3. Taakdetails bekijken
- 3.4. Taak claimen
- 3.5. Taak uitvoeren (formulier invullen)
- 3.6. Taak voltooien

### Feature 4: Objects 🟡

- 4.1. Objecten bekijken per type
- 4.2. Object details bekijken
- 4.3. Objecten zoeken/filteren

### Feature 5: Views / Beelden (IKO User) 🟡

- 5.1. IKO objecten zoeken
- 5.2. Zoekresultaten bekijken
- 5.3. IKO object details bekijken

---

## Admin Features (ROLE_ADMIN)

### Feature 6: Case Definition Management 🟢

**6A. General tab**

- 6.1. Upload process koppelen aan case
- 6.2. Case handler toggle instellen
- 6.3. Auto-assign taken aan case handler toggle
- 6.4. External start form toggle instellen
- 6.5. External start form URL invoeren

**6B. Processes tab**

- 6.6. Gekoppelde processen bekijken
- 6.7. Nieuw proces aanmaken
- 6.8. Proces openen in BPMN modeler
- 6.9. BPMN elementen drag-drop toevoegen
- 6.10. Proces eigenschappen instellen (Starts case, Startable by user)
- 6.11. Proces opslaan

**6C. Process Links**

- 6.12. Process link aanmaken (wizard)
- 6.13. Link type Form configureren
- 6.14. Link type FormFlow configureren
- 6.15. Link type Plugin configureren
- 6.16. Plugin actie configureren

**6D. Version Management**

- 6.17. Versie selecteren
- 6.18. Alle versies bekijken
- 6.19. Versie beheren

**6E. Decision Tables tab**

- 6.20. Gekoppelde beslistabellen bekijken
- 6.21. Beslistabel uploaden (.dmn)
- 6.22. Beslistabel openen in DMN editor
- 6.23. DMN Hit policy instellen
- 6.24. DMN input/output kolommen beheren
- 6.25. DMN regels toevoegen/bewerken/verwijderen
- 6.26. Beslistabel opslaan

**6F. Document tab**

- 6.27. JSON Schema definitie bekijken
- 6.28. JSON Schema downloaden
- 6.29. JSON Schema bewerken
- 6.30. JSON Schema opslaan

**6G. Forms tab**

- 6.31. Formulieren lijst bekijken
- 6.32. Formulieren zoeken/filteren
- 6.33. Formulier aanmaken
- 6.34. Form.io builder - componenten toevoegen (drag-drop)
- 6.35. Form.io builder - component configureren
- 6.36. Form.io JSON editor gebruiken
- 6.37. Formulier preview bekijken
- 6.38. Formulier opslaan

**6H. Form Flows tab**

- 6.39. Form flows lijst bekijken
- 6.40. Form flow aanmaken
- 6.41. Form flow JSON bewerken
- 6.42. Form flow opslaan

**6I. Tasks tab**

- 6.43. Takenlijst kolommen bekijken
- 6.44. Takenlijst kolom toevoegen
- 6.45. Takenlijst kolommen herschikken
- 6.46. Takenlijst zoekvelden bekijken
- 6.47. Takenlijst zoekveld toevoegen
- 6.48. Takenlijst JSON/tabel view toggle

**6J. Case List tab**

- 6.49. Dossierlijst kolommen bekijken
- 6.50. Dossierlijst kolom toevoegen
- 6.51. Dossierlijst kolommen herschikken
- 6.52. Dossierlijst zoekvelden bekijken
- 6.53. Dossierlijst zoekveld toevoegen
- 6.54. Dossierlijst configuratie downloaden

**6K. Case Details tab - Tabbladen**

- 6.55. Tabs bekijken
- 6.56. Tab toevoegen (Standaard/FormIO/Maatwerk/Widgets)
- 6.57. Tabs herschikken

**6L. Case Details tab - Statussen**

- 6.58. Statussen bekijken
- 6.59. Status toevoegen
- 6.60. Status kleur instellen
- 6.61. Status zichtbaarheid instellen
- 6.62. Statussen herschikken

**6M. Case Details tab - Tags**

- 6.63. Tags bekijken
- 6.64. Tag toevoegen
- 6.65. Tag kleur instellen

**6N. Case Details tab - Header Widgets**

- 6.66. Header widgets bekijken
- 6.67. Header widget toevoegen

**6O. Case Details tab - Widgets**

- 6.68. Widgets lijst bekijken
- 6.69. Widget toevoegen (6-stappen wizard)
- 6.70. Widget type selecteren (Velden/Eigen component/Form.io/Tabel/Collectie/Kaart)
- 6.71. Widget breedte instellen
- 6.72. Widget dichtheid instellen
- 6.73. Widget stijl instellen
- 6.74. Widget inhoud configureren
- 6.75. Widget weergavecondities instellen
- 6.76. Widget scheiding toevoegen
- 6.77. Widgets herschikken
- 6.78. Widget JSON editor gebruiken

**6P. ZGW tab - Algemeen**

- 6.79. Zaakdetails-synchronisatie configureren
- 6.80. Zaak type koppelen
- 6.81. Zaak type bewerken
- 6.82. Zaak type verwijderen

**6Q. ZGW tab - Document kolommen**

- 6.83. Document kolommen bekijken
- 6.84. Document kolom toevoegen
- 6.85. Document kolom sortering instellen
- 6.86. Document kolommen herschikken

**6R. ZGW tab - Document upload-velden**

- 6.87. Upload velden bekijken
- 6.88. Upload veld zichtbaarheid instellen
- 6.89. Upload veld standaardwaarde instellen

**6S. ZGW tab - Document trefwoorden**

- 6.90. Trefwoorden bekijken
- 6.91. Trefwoord toevoegen
- 6.92. Trefwoorden zoeken

---

### Feature 7: Process Management 🟡

- 7.1. Processen overzicht bekijken
- 7.2. Nieuw proces aanmaken
- 7.3. BPMN proces bewerken
- 7.4. Proces deployen
- 7.5. Proces versies beheren

### Feature 8: Decision Table Management 🟡

- 8.1. Beslistabellen overzicht bekijken
- 8.2. Beslistabel aanmaken
- 8.3. Beslistabel bewerken (DMN modeler)
- 8.4. Beslistabel testen

### Feature 9: Plugin Management 🟡

- 9.1. Plugin configuraties beheren
- 9.2. Plugin configuratie toevoegen
- 9.3. Plugin configuratie bewerken
- 9.4. Plugin configuratie verwijderen

### Feature 10: Dashboard Management 🟡

- 10.1. Dashboards beheren
- 10.2. Dashboard widgets configureren
- 10.3. Dashboard aan rollen toewijzen

### Feature 11: Access Control Management 🟡

- 11.1. Rollen bekijken
- 11.2. Rol permissies configureren
- 11.3. Permissies per resource type instellen

### Feature 12: Object Management 🟡

- 12.1. Object types beheren
- 12.2. Object type configuratie bewerken

### Feature 13: Building Block Management 🟡

- 13.1. Building blocks beheren
- 13.2. Building block processen configureren
- 13.3. Building block versies beheren

### Feature 14: Translation Management 🟡

- 14.1. Vertalingen beheren
- 14.2. Vertaling toevoegen
- 14.3. Vertaling bewerken

### Feature 15: IKO Management 🟡

- 15.1. IKO APIs configureren
- 15.2. Zoekacties configureren
- 15.3. IKO widgets configureren

### Feature 16: Choice Fields Management 🟡

- 16.1. Keuzeveld definities beheren
- 16.2. Keuzeveld opties toevoegen/bewerken/verwijderen

### Feature 17: Failed Notifications 🟡

- 17.1. Gefaalde notificaties bekijken
- 17.2. Notificatie opnieuw proberen
- 17.3. Notificatie verwijderen

### Feature 18: Logs 🟡

- 18.1. Applicatie logs bekijken
- 18.2. Logs filteren/zoeken

### Feature 19: Case Migration (Beta) 🟡

- 19.1. Cases migreren tussen versies
- 19.2. Migratie status bekijken

### Feature 20: Process Migration 🟡

- 20.1. Process instances migreren
- 20.2. Migratie status bekijken

---

## Totaal Telling

| Metric | Aantal |
|--------|--------|
| **Features totaal** | 20 |
| **Functies totaal** | 143 |
| **Functies gedocumenteerd (🟢)** | 92 (Feature 6) |
| **Functies te documenteren (🟡🔴)** | 51 |

---

## Nog te verwerken

- [ ] Cases (User) screenshots verwerken
- [ ] Overige admin features screenshots (indien nodig)

---

*Laatst bijgewerkt: 30 januari 2026*
