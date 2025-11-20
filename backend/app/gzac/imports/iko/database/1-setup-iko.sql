/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

INSERT INTO connector(id,name,tag,connector_code) VALUES ('e6aac203-a3b1-4832-b57e-6215bd6ef51e', 'BRP', 'brp', '- route:
      id: "direct:iko:endpoint:transform:brp.personen"
      errorHandler:
          noErrorHandler: {}
      from:
          uri: "direct:iko:endpoint:transform:brp.personen"
          steps:
              - setBody:
                    jq: |
                        {
                          type: (header("type") | tostring | split(",")),
                           gemeenteVanInschrijving: header("gemeenteVanInschrijving"),
                           inclusiefOverledenPersonen: header("inclusiefOverledenPersonen"),
                           geboortedatum: header("geboortedatum"),
                           geslachtsnaam: header("geslachtsnaam"),
                           geslacht: header("geslacht"),
                           voorvoegsel: header("voorvoegsel"),
                           voornamen: header("voornamen"),
                           burgerservicenummer: (header("burgerservicenummer") | tostring | split(",")),
                           huisletter: header("huisletter"),
                           huisnummer: header("huisnummer"),
                           huisnummertoevoeging: header("huisnummertoevoeging"),
                           postcode: header("postcode"),
                           geboortedatum: header("geboortedatum"),
                           geslachtsnaam: header("geslachtsnaam"),
                           straat: header("straat"),
                           nummeraanduidingIdentificatie: header("nummeraanduidingIdentificatie"),
                           adresseerbaarObjectIdentificatie: header("adresseerbaarObjectIdentificatie")
                           } | with_entries(select(.value!=null))
              - removeHeaders:
                    pattern: "*"
                    excludePattern: "type|gemeenteVanInschrijving|inclusiefOverledenPersonen|geboortedatum|geslachtsnaam|geslacht|voorvoegsel|voornamen|burgerservicenummer|huisletter|huisnummer|huisnummertoevoeging|postcode|geboortedatum|geslachtsnaam|straat|nummeraanduidingIdentificatie|adresseerbaarObjectIdentificatie"
- route:
      id: "direct:iko:connector:brp"
      errorHandler:
          noErrorHandler: {}
      from:
          uri: "direct:iko:connector:brp"
          steps:
              - setHeader:
                    name: "Content-Type"
                    constant: "application/json"
              - setHeader:
                    name: "Accept"
                    constant: "application/json"
              - script:
                    groovy: |-
                        exchange.in.setHeader("X-Api-Key", "${exchange.getVariable(''configProperties'', Map).secret}")
              - log: "BODY: ${header.Accept}"
              - toD:
                    uri: "language:groovy:\"rest-openapi:${variable.configProperties.specificationUri}#${variable.operation}?host=${variable.configProperties.host}\""
              - unmarshal:
                    json: {}
              - log: "BODY: ${body}"
');

INSERT INTO connector_instance(id,name,connector_id,tag,config) VALUES('0734b815-1166-42eb-8200-26a19a86c605','brp1','e6aac203-a3b1-4832-b57e-6215bd6ef51e','brp1', NULL);
INSERT INTO connector_instance_config(connector_instance_id,key,value) VALUES('0734b815-1166-42eb-8200-26a19a86c605', 'host', 'mVwcp2iZuNh8f2+8KLlCVPMy04B3vP+rwmzEu/n4Za4uy3h6bmkKNhjhHQdy26oBEA==');
INSERT INTO connector_instance_config(connector_instance_id,key,value) VALUES('0734b815-1166-42eb-8200-26a19a86c605', 'specificationUri', 't5YB+lqLDYOLXJ2srmkrLLiGqG3rOlfxGgxgjn47A6LpMewKnzXOKpJRvljV1+aTtXR9zCJvnU8zZohpID8XL2fjplNwFk0svbQmUxsTJe8LI++AXmMu6+qYKLbivjtM');
INSERT INTO connector_endpoint(id,name,connector_id,operation) VALUES('d53096fe-0fab-4bb0-9406-6859b6ba4274','Personen','e6aac203-a3b1-4832-b57e-6215bd6ef51e','Personen');
INSERT INTO connector_endpoint_role(id,connector_endpoint_id,connector_instance_id,role) VALUES('c6c88840-074d-4a22-9af3-42037a600670','d53096fe-0fab-4bb0-9406-6859b6ba4274','0734b815-1166-42eb-8200-26a19a86c605','ROLE_USER');
INSERT INTO connector_endpoint_role(id,connector_endpoint_id,connector_instance_id,role) VALUES('acb1a41c-555f-41ee-a00f-e9a90ea80a16','d53096fe-0fab-4bb0-9406-6859b6ba4274','0734b815-1166-42eb-8200-26a19a86c605','ROLE_ADMIN');
INSERT INTO connector_endpoint_role(id,connector_endpoint_id,connector_instance_id,role) VALUES('acb1a41c-555f-41ee-a00f-e9a90ea80a17','d53096fe-0fab-4bb0-9406-6859b6ba4274','0734b815-1166-42eb-8200-26a19a86c605','ROLE_ENDPOINT_BRPPERSONENENDPOINT');





INSERT INTO connector(id,name,tag,connector_code) VALUES ('bc18d7dd-84b5-4097-9576-0c64fe211632', 'Demo', 'demo', '- route:
    id: "getMockData"
    from:
      uri: "direct:iko:connector:demo"
      steps:
        - setBody:
            constant: ''{
   "content":[
      {
         "basisgegevens":{
            "naam":"Sofia Rahman",
            "geslacht":"Vrouw",
            "geboortedatum":"1985-08-08",
            "bsn":"987654321",
            "adres":"Acacialaan 14, 3523GH Utrecht",
            "telefoon":"06-34567890",
            "e_mail":"sofia.rahman@example.com",
            "nationaliteit":"Nederlands",
            "burgerlijke_staat":"Alleenstaand"
         },
         "werkprofiel":{
            "huidig_dienstverband":{
               "werkgever":"Kinderdagverblijf zonnestraal",
               "functie":"Pedagogisch medewerker",
               "uren_per_week":32
            },
            "arbeidsverleden":"8 jaar ervaring in kinderopvang en onderwijsassistentie",
            "opleidingsniveau":"MBO pedagogisch werk",
            "re_integratietraject":"Geen, wel recent scholingstraject kinderpsychologie afgerond"
         },
         "inkomensprofiel":{
            "primair_inkomen":"€2300 bruto per maand",
            "aanvullende_inkomsten":"Geen",
            "uitkering":"Geen, wel recht op zorg- en huurtoeslag",
            "schulden":"Geen noemenswaardige schulden",
            "vermogen":"Spaarsaldo €1200"
         },
         "gezinsprofiel":{
            "gezin":{
               "kinderen":[
                  {
                     "naam":"Amina",
                     "leeftijd":7,
                     "relatie":"Kind"
                  },
                  {
                     "naam":"Jan",
                     "leeftijd":12,
                     "relatie":"Kind"
                  }
               ]
            },
            "mantelzorg":"Ondersteunt haar tante (65) met wekelijkse boodschappen",
            "huishoudsamenstelling":"Eenoudergezin",
            "zorgbehoefte":"Dochter volgt logopediebegeleiding"
         },
         "producten_en_voorzieningen":{
            "overheidsdocumenten":{
               "rijbewijs_b":"geldig tot 2031",
               "paspoort":"geldig tot 2033"
            },
            "toeslagen":[
               {
                  "type":"Huurtoeslag"
               },
               {
                  "type":"Zorgtoeslag"
               },
               {
                  "type":"Kindgebonden budget"
               }
            ],
            "gemeentelijke_regelingen":[
               "bijzondere bijstand voor schoolspullen"
            ]
         },
         "lopende_zaken":[
            {
               "type":"Bijzondere bijstand",
               "beschrijving":"Aanvraag voor logopediekosten in behandeling"
            },
            {
               "type":"Jeugdhulp",
               "beschrijving":"Dossier voor logopedie dochter"
            },
            {
               "type":"Wijkteam",
               "beschrijving":"Contact voor ondersteuning kinderopvangtoeslag"
            },
            {
               "type":"Evenementenvergunning",
               "beschrijving":"Aanvraag voor evenementenvergunning",
               "link":"/cases/evenementenvergunning/document/50fb0582-ad5e-42f0-b274-bb33d7beab18/general"
            }
         ],
         "contactmomenten":[
            {
               "kanaal":"Telefonisch",
               "beschrijving":"Gesprek met jeugdhulpcoördinator 2 weken geleden"
            },
            {
               "kanaal":"E-mail",
               "beschrijving":"Bevestiging toekenning huurtoeslag vorige maand"
            },
            {
               "kanaal":"Fysiek",
               "beschrijving":"Huisbezoek door wijkteam 3 maanden geleden"
            },
            {
               "kanaal":"Digitaal portaal",
               "beschrijving":"Laatste login 1 week geleden voor upload documenten"
            }
         ],
         "notities":[
            {
               "categorie":"casemanager",
               "inhoud":"sofia is proactief in het zoeken van hulp en houdt afspraken goed na."
            },
            {
               "categorie":"opmerking",
               "inhoud":"voorkeur voor digitale communicatie; reageert snel via e-mail."
            },
            {
               "categorie":"vervolgactie",
               "inhoud":"herbeoordeling bijzondere bijstand gepland op 20 oktober."
            }
         ],
         "geometry":{
            "type":"FeatureCollection",
            "features":[
               {
                  "type":"Feature",
                  "geometry":{
                     "type":"Point",
                     "coordinates":[
                        102.0,
                        0.5
                     ]
                  },
                  "properties":{
                     "prop0":"value0"
                  }
               },
               {
                  "type":"Feature",
                  "geometry":{
                     "type":"LineString",
                     "coordinates":[
                        [
                           102.0,
                           0.0
                        ],
                        [
                           103.0,
                           1.0
                        ],
                        [
                           104.0,
                           0.0
                        ],
                        [
                           105.0,
                           1.0
                        ]
                     ]
                  },
                  "properties":{
                     "prop0":"value0",
                     "prop1":0.0
                  }
               },
               {
                  "type":"Feature",
                  "geometry":{
                     "type":"Polygon",
                     "coordinates":[
                        [
                           [
                              100.0,
                              0.0
                           ],
                           [
                              101.0,
                              0.0
                           ],
                           [
                              101.0,
                              1.0
                           ],
                           [
                              100.0,
                              1.0
                           ],
                           [
                              100.0,
                              0.0
                           ]
                        ]
                     ]
                  },
                  "properties":{
                     "prop0":"value0",
                     "prop1":{
                        "this":"that"
                     }
                  }
               }
            ]
         }
      }
   ]
}''
        - setHeader:
            name: "Content-Type"
            constant: "application/json"
        - unmarshal:
            json: {}');

INSERT INTO connector_instance(id,name,connector_id,tag,config) VALUES('9b43db4a-0d10-4027-b7be-58ad8e4481af','Demo1','bc18d7dd-84b5-4097-9576-0c64fe211632','demo1', NULL);
INSERT INTO connector_endpoint(id,name,connector_id,operation) VALUES('e6396e4a-3e6c-4243-afaa-8e369f464ccb','mockdata','bc18d7dd-84b5-4097-9576-0c64fe211632','getMockData');
INSERT INTO connector_endpoint_role(id,connector_endpoint_id,connector_instance_id,role) VALUES('e6396e4a-3e6c-4243-afaa-8e369f464cca','e6396e4a-3e6c-4243-afaa-8e369f464ccb','9b43db4a-0d10-4027-b7be-58ad8e4481af','ROLE_USER');
INSERT INTO connector_endpoint_role(id,connector_endpoint_id,connector_instance_id,role) VALUES('e6396e4a-3e6c-4243-afaa-8e369f464ccc','e6396e4a-3e6c-4243-afaa-8e369f464ccb','9b43db4a-0d10-4027-b7be-58ad8e4481af','ROLE_ADMIN');
INSERT INTO connector_endpoint_role(id,connector_endpoint_id,connector_instance_id,role) VALUES('e6396e4a-3e6c-4243-afaa-8e369f464ccd','e6396e4a-3e6c-4243-afaa-8e369f464ccb','9b43db4a-0d10-4027-b7be-58ad8e4481af','ROLE_ENDPOINT_BRPPERSONENENDPOINT');
INSERT INTO aggregated_data_profile(id,name,primary_endpoint,transform,role,connector_endpoint_id,connector_instance_id) VALUES('fef3cd88-0470-4cfa-8112-fb27727a4f67', 'demo', NULL, '.content[0]','ROLE_ENDPOINT_BRPPERSONENENDPOINT', 'e6396e4a-3e6c-4243-afaa-8e369f464ccb','9b43db4a-0d10-4027-b7be-58ad8e4481af');
