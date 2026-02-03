# Valtimo Frontend - Functielijst

Platte lijst van alle functies, gegroepeerd per feature.

---

## User Features

### Feature 1: Dashboard
1. Widget-based dashboard weergeven
2. Widgets configureren per gebruiker/rol
3. Real-time data updates (SSE)

### Feature 2: Cases (User)
4. Cases overzicht bekijken per definitie
5. Case details bekijken (tabs)
6. Cases zoeken/filteren
7. Case documenten bekijken
8. Case voortgang/status bekijken
9. Taken uitvoeren binnen case

### Feature 3: Tasks
10. Alle open taken bekijken
11. Taken filteren/sorteren
12. Taakdetails bekijken
13. Taak claimen
14. Taak uitvoeren (formulier invullen)
15. Taak voltooien

### Feature 4: Objects
16. Objecten bekijken per type
17. Object details bekijken
18. Objecten zoeken/filteren

### Feature 5: Views / Beelden (IKO)
19. IKO objecten zoeken
20. Zoekresultaten bekijken
21. IKO object details bekijken

---

## Admin Features

### Feature 6: Case Definition Management

**General tab**
22. Upload process koppelen aan case
23. Case handler toggle instellen
24. Auto-assign taken aan case handler toggle
25. External start form toggle instellen
26. External start form URL invoeren

**Processes tab**
27. Gekoppelde processen bekijken
28. Nieuw proces aanmaken
29. Proces openen in BPMN modeler
30. BPMN elementen drag-drop toevoegen
31. Proces eigenschappen instellen (Starts case, Startable by user)
32. Proces opslaan

**Process Links**
33. Process link aanmaken (wizard)
34. Link type Form configureren
35. Link type FormFlow configureren
36. Link type Plugin configureren
37. Plugin actie configureren

**Version Management**
38. Versie selecteren
39. Alle versies bekijken
40. Versie beheren

**Decision Tables tab**
41. Gekoppelde beslistabellen bekijken
42. Beslistabel uploaden (.dmn)
43. Beslistabel openen in DMN editor
44. DMN Hit policy instellen
45. DMN input/output kolommen beheren
46. DMN regels toevoegen/bewerken/verwijderen
47. Beslistabel opslaan

**Document tab**
48. JSON Schema definitie bekijken
49. JSON Schema downloaden
50. JSON Schema bewerken
51. JSON Schema opslaan

**Forms tab**
52. Formulieren lijst bekijken
53. Formulieren zoeken/filteren
54. Formulier aanmaken
55. Form.io builder - componenten toevoegen (drag-drop)
56. Form.io builder - component configureren
57. Form.io JSON editor gebruiken
58. Formulier preview bekijken
59. Formulier opslaan

**Form Flows tab**
60. Form flows lijst bekijken
61. Form flow aanmaken
62. Form flow JSON bewerken
63. Form flow opslaan

**Tasks tab**
64. Takenlijst kolommen bekijken
65. Takenlijst kolom toevoegen
66. Takenlijst kolommen herschikken
67. Takenlijst zoekvelden bekijken
68. Takenlijst zoekveld toevoegen
69. Takenlijst JSON/tabel view toggle

**Case List tab**
70. Dossierlijst kolommen bekijken
71. Dossierlijst kolom toevoegen
72. Dossierlijst kolommen herschikken
73. Dossierlijst zoekvelden bekijken
74. Dossierlijst zoekveld toevoegen
75. Dossierlijst configuratie downloaden

**Case Details - Tabbladen**
76. Tabs bekijken
77. Tab toevoegen (Standaard/FormIO/Maatwerk/Widgets)
78. Tabs herschikken

**Case Details - Statussen**
79. Statussen bekijken
80. Status toevoegen
81. Status kleur instellen
82. Status zichtbaarheid instellen
83. Statussen herschikken

**Case Details - Tags**
84. Tags bekijken
85. Tag toevoegen
86. Tag kleur instellen

**Case Details - Header Widgets**
87. Header widgets bekijken
88. Header widget toevoegen

**Case Details - Widgets**
89. Widgets lijst bekijken
90. Widget toevoegen (wizard)
91. Widget type selecteren (Velden/Eigen component/Form.io/Tabel/Collectie/Kaart)
92. Widget breedte instellen
93. Widget dichtheid instellen
94. Widget stijl instellen
95. Widget inhoud configureren
96. Widget weergavecondities instellen
97. Widget scheiding toevoegen
98. Widgets herschikken
99. Widget JSON editor gebruiken

**ZGW - Algemeen**
100. Zaakdetails-synchronisatie configureren
101. Zaak type koppelen
102. Zaak type bewerken
103. Zaak type verwijderen

**ZGW - Document kolommen**
104. Document kolommen bekijken
105. Document kolom toevoegen
106. Document kolom sortering instellen
107. Document kolommen herschikken

**ZGW - Document upload-velden**
108. Upload velden bekijken
109. Upload veld zichtbaarheid instellen
110. Upload veld standaardwaarde instellen

**ZGW - Document trefwoorden**
111. Trefwoorden bekijken
112. Trefwoord toevoegen
113. Trefwoorden zoeken

### Feature 7: Process Management
114. Processen overzicht bekijken
115. Nieuw proces aanmaken
116. BPMN proces bewerken
117. Proces deployen
118. Proces versies beheren

### Feature 8: Decision Table Management
119. Beslistabellen overzicht bekijken
120. Beslistabel aanmaken
121. Beslistabel bewerken (DMN modeler)
122. Beslistabel testen

### Feature 9: Plugin Management
123. Plugin configuraties beheren
124. Plugin configuratie toevoegen
125. Plugin configuratie bewerken
126. Plugin configuratie verwijderen

### Feature 10: Dashboard Management
127. Dashboards beheren
128. Dashboard widgets configureren
129. Dashboard aan rollen toewijzen

### Feature 11: Access Control Management
130. Rollen bekijken
131. Rol permissies configureren
132. Permissies per resource type instellen

### Feature 12: Object Management
133. Object types beheren
134. Object type configuratie bewerken

### Feature 13: Building Block Management
135. Building blocks beheren
136. Building block processen configureren
137. Building block versies beheren

### Feature 14: Translation Management
138. Vertalingen beheren
139. Vertaling toevoegen
140. Vertaling bewerken

### Feature 15: IKO Management
141. IKO APIs configureren
142. Zoekacties configureren
143. IKO widgets configureren

### Feature 16: Choice Fields Management
144. Keuzeveld definities beheren
145. Keuzeveld opties toevoegen/bewerken/verwijderen

### Feature 17: Failed Notifications
146. Gefaalde notificaties bekijken
147. Notificatie opnieuw proberen
148. Notificatie verwijderen

### Feature 18: Logs
149. Applicatie logs bekijken
150. Logs filteren/zoeken

### Feature 19: Case Migration (Beta)
151. Cases migreren tussen versies
152. Migratie status bekijken

### Feature 20: Process Migration
153. Process instances migreren
154. Migratie status bekijken

---

## Totaal: 154 functies

| Categorie | Functies |
|-----------|----------|
| User Features (1-5) | 21 |
| Case Definition Management (6) | 92 |
| Overige Admin Features (7-20) | 41 |
| **Totaal** | **154** |

---

*Laatst bijgewerkt: 30 januari 2026*
