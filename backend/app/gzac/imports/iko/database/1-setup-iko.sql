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
      id: "direct:iko:endpoint:transform:brp.Personen"
      errorHandler:
          noErrorHandler: {}
      from:
          uri: "direct:iko:endpoint:transform:brp.Personen"
          steps:
              - setHeader:
                    name: "id"
                    variable: "id"
              - setBody:
                    jq: |
                        {
                           type: (if (header("type") != null) then header("type") else "RaadpleegMetBurgerservicenummer" end),
                           fields: (if (header("fields") != null) then header("fields") | split(",") else ["burgerservicenummer","naam","geboorte","nationaliteiten","verblijfplaats","partners"] end),
                           gemeenteVanInschrijving: header("gemeenteVanInschrijving"),
                           inclusiefOverledenPersonen: header("inclusiefOverledenPersonen"),
                           geboortedatum: header("geboortedatum"),
                           geslachtsnaam: header("geslachtsnaam"),
                           geslacht: header("geslacht"),
                           voorvoegsel: header("voorvoegsel"),
                           voornamen: header("voornamen"),
                           burgerservicenummer: (if header("burgerservicenummer") != null then header("burgerservicenummer") | split(",") else [header("id")] end),
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
                    excludePattern: "type|fields|gemeenteVanInschrijving|inclusiefOverledenPersonen|geboortedatum|geslachtsnaam|geslacht|voorvoegsel|voornamen|burgerservicenummer|huisletter|huisnummer|huisnummertoevoeging|postcode|geboortedatum|geslachtsnaam|straat|nummeraanduidingIdentificatie|adresseerbaarObjectIdentificatie"
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
INSERT INTO connector_instance_config(connector_instance_id,key,value) VALUES('0734b815-1166-42eb-8200-26a19a86c605', 'host', 'kQ/JVrXIlxyUxRadQ72e53zlv6mvdGMKhmw6a26uOqJ6BBWPbfNictxxT/w9N7A78zzn7AmPyCKO2+gL');
INSERT INTO connector_instance_config(connector_instance_id,key,value) VALUES('0734b815-1166-42eb-8200-26a19a86c605', 'specificationUri', 't5YB+lqLDYOLXJ2srmkrLLiGqG3rOlfxGgxgjn47A6LpMewKnzXOKpJRvljV1+aTtXR9zCJvnU8zZohpID8XL2fjplNwFk0svbQmUxsTJe8LI++AXmMu6+qYKLbivjtM');
INSERT INTO connector_endpoint(id,name,connector_id,operation) VALUES('d53096fe-0fab-4bb0-9406-6859b6ba4274','Personen','e6aac203-a3b1-4832-b57e-6215bd6ef51e','Personen');
INSERT INTO connector_endpoint_role(id,connector_endpoint_id,connector_instance_id,role) VALUES('c6c88840-074d-4a22-9af3-42037a600670','d53096fe-0fab-4bb0-9406-6859b6ba4274','0734b815-1166-42eb-8200-26a19a86c605','ROLE_USER');
INSERT INTO connector_endpoint_role(id,connector_endpoint_id,connector_instance_id,role) VALUES('acb1a41c-555f-41ee-a00f-e9a90ea80a16','d53096fe-0fab-4bb0-9406-6859b6ba4274','0734b815-1166-42eb-8200-26a19a86c605','ROLE_ADMIN');
INSERT INTO connector_endpoint_role(id,connector_endpoint_id,connector_instance_id,role) VALUES('acb1a41c-555f-41ee-a00f-e9a90ea80a17','d53096fe-0fab-4bb0-9406-6859b6ba4274','0734b815-1166-42eb-8200-26a19a86c605','ROLE_ENDPOINT_BRPPERSONENENDPOINT');
INSERT INTO aggregated_data_profile(id,name,primary_endpoint,transform,role,connector_endpoint_id,connector_instance_id) VALUES('4d4b7633-46d3-4eaf-9d78-9f9c95599c42','Personen',NULL,'{persoon: .personen[0]}','ROLE_ENDPOINT_BRPPERSONENENDPOINT','d53096fe-0fab-4bb0-9406-6859b6ba4274','0734b815-1166-42eb-8200-26a19a86c605');





INSERT INTO connector(id,name,tag,connector_code) VALUES ('bc18d7dd-84b5-4097-9576-0c64fe211632', 'Demo', 'demo', '- route:
    id: "getMockData"
    from:
      uri: "direct:iko:connector:demo"
      steps:
        - delay:
           asyncDelayed: true
           expression:
             simple: "${random(0,1000)}"
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
                  },
                  {
                    "naam": "Sofie",
                    "leeftijd": 10,
                    "relatie": "Kind"
                  },
                  {
                    "naam": "Dirk",
                    "leeftijd": 14,
                    "relatie": "Kind"
                  },
                  {
                    "naam": "Lotte",
                    "leeftijd": 5,
                    "relatie": "Kind"
                  },
                  {
                    "naam": "Peter",
                    "leeftijd": 9,
                    "relatie": "Kind"
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
               },
               {
                  "type":"Kinderopvangtoeslag"
               },
               {
                  "type":"Energietoeslag"
               },
               {
                  "type":"Alleenstaande-ouderkop"
               },
               {
                  "type":"Tegemoetkoming scholieren"
               },
               {
                  "type":"Individuele inkomenstoeslag"
               },
               {
                  "type":"Bijzondere bijstand"
               },
               {
                  "type":"Studietoeslag"
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
            },
            {
              "type": "Omgevingsvergunning",
              "beschrijving": "Aanvraag voor verbouwing van woning"
            },
            {
              "type": "Parkeervergunning",
              "beschrijving": "Aanvraag bewonersparkeervergunning"
            },
            {
              "type": "Uitkering Participatiewet",
              "beschrijving": "Aanvraag voor bijstandsuitkering"
            },
            {
              "type": "Leerlingenvervoer",
              "beschrijving": "Aanvraag vervoer naar speciaal onderwijs"
            },
            {
              "type": "Melding openbare ruimte",
              "beschrijving": "Melding van kapotte straatverlichting"
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
            },
            {
              "kanaal": "Balie",
              "beschrijving": "Persoonlijk gesprek op het gemeentehuis"
            },
            {
              "kanaal": "Post",
              "beschrijving": "Ontvangst van schriftelijke beschikking per brief"
            },
            {
              "kanaal": "Chat",
              "beschrijving": "Online chatgesprek met klantenservice"
            },
            {
              "kanaal": "Videogesprek",
              "beschrijving": "Videobelafspraak met consulent"
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
                        4.9,
                        52.37
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
                           4.9,
                           51.9
                        ],
                        [
                           5.9,
                           52.9
                        ],
                        [
                           6.9,
                           51.9
                        ],
                        [
                           7.9,
                           52.9
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
                              2.3,
                              51.9
                           ],
                           [
                              3.9,
                              51.9
                           ],
                           [
                              3.9,
                              52.9
                           ],
                           [
                              2.3,
                              52.9
                           ],
                           [
                              2.3,
                              51.9
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
INSERT INTO aggregated_data_profile(id,name,transform,role,connector_endpoint_id,connector_instance_id,endpoint_transform) VALUES('fef3cd88-0470-4cfa-8112-fb27727a4f67', 'demo',
'def parse_header_json($name):
  (header($name)
   | if . == null or . == "" then {} else (try fromjson catch {}) end);

def dir_is_desc($dir):
  (($dir // "ASC") | ascii_upcase) == "DESC";

def prop_path($p):
  ($p // "")
  | sub("^data\\."; "")
  | split(".")
  | map(select(. != ""));

def apply_sort_and_page($cfg):
  ($cfg.sort[0]? // {}) as $s0
  | ($s0.property // "") as $p
  | ($s0.direction // "ASC") as $d
  | ($cfg.pageNumber? // null) as $pn
  | ($cfg.pageSize?   // null) as $ps
  | (if $p == "" then .
     else sort_by( (getpath(prop_path($p)) // "") )
     end)
  | (if dir_is_desc($d) then reverse else . end)
  | (if ($pn != null and $ps != null) then .[($pn*$ps):(($pn*$ps)+$ps)] else . end);

def apply_filter($fobj):
  map(
    . as $item
    | select(
        ($item | type == "object")
        and all($fobj | keys[]; ($item[.] // null) == $fobj[.])
      )
  );

. as $root
| (parse_header_json("sortParams"))   as $spv
| (parse_header_json("filterParams")) as $fpv
| ($root.content[0] // {}) as $c0

# Determine the target collection key (prefer sortParams key, else filterParams key)
| (if ($spv|type)=="object" and ($spv|length)>0 then ($spv|keys[0])
   elif ($fpv|type)=="object" and ($fpv|length)>0 then ($fpv|keys[0])
   else null
   end) as $k

| if $k == null then
    $c0
  else
    # Start from the original array
    ($c0[$k] // []) as $orig

    # Apply filter first (for correct totalElements)
    | ($orig
       | if ($fpv|type)=="object" and ($fpv|length)>0 and ($fpv[$k]?|type)=="object"
         then apply_filter($fpv[$k])
         else .
         end
      ) as $filtered

    # totalElements BEFORE paging
    | ($filtered | length) as $total

    # Apply sort + paging after filtering
    | ($filtered
       | if ($spv|type)=="object" and ($spv|length)>0 and ($spv[$k]?|type)=="object"
         then apply_sort_and_page($spv[$k])
         else .
         end
      ) as $paged

    # Page metadata
    | ($spv[$k].pageNumber // 0) as $num
    | ($spv[$k].pageSize   // ($paged|length)) as $size

    # Replace the array with the wrapped object
    | ($c0
       | .[$k] = {
           totalElements: $total,
           number: $num,
           size: $size,
           content: $paged
         }
      )
  end
','ROLE_ENDPOINT_BRPPERSONENENDPOINT', 'e6396e4a-3e6c-4243-afaa-8e369f464ccb','9b43db4a-0d10-4027-b7be-58ad8e4481af',
'. + {
  sortParams: ((.sortParams // {}) | tojson),
  filterParams: ((.filterParams // {}) | tojson)
}');
