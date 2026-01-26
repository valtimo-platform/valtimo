--
-- PostgreSQL database dump
--

\restrict buBslvaDlgTns71FgYJbmA5gkFsLxFCs9c1f0d0VjmiwmXbX2fPh7ddzzVvdf6N

-- Dumped from database version 17.0 (Debian 17.0-1.pgdg110+1)
-- Dumped by pg_dump version 17.7 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: accounts_user; Type: TABLE DATA; Schema: public; Owner: openzaak
--

INSERT INTO public.accounts_user VALUES (2, 'pbkdf2_sha256$150000$5dnJUqLDsmX0$EEbO4AGZqyp88ZCTu+7W2uGRLkdidlL4HkXWc8ZfZV8=', NULL, true, 'demo', 'Valtimo', 'Demo', 'demo@valtimo.nl', true, true, '2026-01-20 14:35:49.92462+00');
INSERT INTO public.accounts_user VALUES (1, 'pbkdf2_sha256$870000$slBPeyCLnVbcZA99mwTTA6$6E6iT3F9tP+rSo7qKsONWodaH11gB9JbJC083nPUBAg=', '2026-01-20 14:54:48.756742+00', true, 'admin', '', '', 'admin@admin.org', true, true, '2026-01-20 14:35:47.311779+00');


--
-- Data for Name: authorizations_applicatie; Type: TABLE DATA; Schema: public; Owner: openzaak
--

INSERT INTO public.authorizations_applicatie VALUES (1, '6495886c-e2f2-4fa5-b6c4-48f560171e81', '{valtimo_client}', 'Valtimo', true);
INSERT INTO public.authorizations_applicatie VALUES (2, 'b51519df-121f-416e-9859-193fcc86c308', '{opennotificaties}', 'Open notificaties', true);
INSERT INTO public.authorizations_applicatie VALUES (3, '045c8e37-78e5-434a-9959-bddf30b91c0e', '{openformulieren}', 'Open Formulieren', true);


--
-- Data for Name: catalogi_catalogus; Type: TABLE DATA; Schema: public; Owner: openzaak
--

INSERT INTO public.catalogi_catalogus VALUES (1, 'valtimo', '8225508a-6840-413e-acc9-6422af120db1', 'VAL', '002564440', 'Valtimo Demo', '06-12345678', 'demo@valtimo.nl', '0a43d706f6c6e8be3492d94ad2568e3b', NULL, '1');


--
-- Data for Name: catalogi_eigenschapspecificatie; Type: TABLE DATA; Schema: public; Owner: openzaak
--

INSERT INTO public.catalogi_eigenschapspecificatie VALUES (1, 'tekst', 'tekst', '100', '1', '{}');


--
-- Data for Name: catalogi_zaaktype; Type: TABLE DATA; Schema: public; Owner: openzaak
--

INSERT INTO public.catalogi_zaaktype VALUES (1, '2021-01-01', NULL, false, '744ca059-f412-49d4-8963-5800e4afd486', 'bezwaar-behandelen', 'Bezwaar behandelen', 'Bezwaar behandelen', 'zaakvertrouwelijk', 'Een uitspraak doen op een ingekomen bezwaar tegen een eerder genomen besluit.', 'Er is een bezwaarschrift ontvangen tegen een besluit dat genomen is door de gemeente.', 'Conform de Algemene Wet Bestuursrecht (AWB) heeft een natuurlijk of niet-natuurlijk persoon de mogelijkheid om bezwaar te maken tegen een genomen besluit van de gemeente, bijvoorbeeld het niet verlenen van een vergunning.', 'extern', 'Indienen', 'Bezwaar', 'Behandelen', '84 days', NULL, false, true, '42 days', '{bezwaar,bezwaarschrift}', false, '', '{}', '2021-01-01', '{https://github.com/valtimo-platform/valtimo-platform}', 'https://selectielijst.openzaak.nl/api/v1/procestypen/e1b73b12-b2f6-4c4e-8929-94f84dd2a57d', 'Bezwaar behandelen', 'http://www.gemmaonline.nl/index.php/Referentieproces_bezwaar_behandelen', 1, 2017, '_etag', '', '', '000000000', '', '', '', '');
INSERT INTO public.catalogi_zaaktype VALUES (2, '2026-01-21', NULL, false, 'ef599e32-7189-4022-8824-2a0c6fd5928a', 'parkeervergunning-aanvraag', 'Parkeervergunning aanvraag', 'Parkeervergunning aanvraag', 'vertrouwelijk', 'Een parkeerverguning aanvraag in behandeling nemen', 'Auto aangeschaft', 'wil voor de deur parkeren', 'extern', 'Indienen', 'Parkeervergunning', 'Behandeling', '1 mon', '00:00:00', false, false, NULL, '{parkeerbeheer}', false, '', '{}', '2026-01-21', '{https://github.com/valtimo-platform/valtimo-platform}', 'https://selectielijst.openzaak.nl/api/v1/procestypen/aa8aa2fd-b9c6-4e34-9a6c-58a677f60ea0', 'Parkeervergunning aanvraag', '', 1, 2020, '81a52012c67ab652a07e063add1fe45d', '-', '', '', '', '', '', '');


--
-- Data for Name: catalogi_statustype; Type: TABLE DATA; Schema: public; Owner: openzaak
--

INSERT INTO public.catalogi_statustype VALUES (1, 'ab79ab37-4c99-480d-a070-d6266bfa9125', 'Intake afgerond', 'Intake afgerond', 1, true, 'Geachte heer/mevrouw, Op %ZAAK. Registratiedatum% heeft u een bezwaar ingediend. Uw bezwaar is bij ons in behandeling genomen onder zaaknummer %ZAAK. Zaakidentificatie%. Wij vragen u dit zaaknummer te gebruiken in geval van correspondentie over dit bezwaar cq. deze zaak.  U wordt per e-mail op de hoogte gehouden van de status van de behandeling van uw bezwaar.', 'Initiële status van de zaak waarbij het bezwaarschrift ontvangen is en naar aanleiding daarvan de zaak aangemaakt en de behandelaar bepaald is. De indiener is een ontvangstbevestiging van zijn (of haar) bezwaar gezonden.', 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_statustype VALUES (2, '9c7a8349-bfb6-4ec2-920d-f00cafea316f', 'Indieningsvereisten getoetst', 'Indieningsvereisten getoetst', 2, true, 'Geachte heer/mevrouw, Op %ZAAK.Registratiedatum% heeft u een bezwaar ingediend. Uw bezwaar is bij ons in behandeling onder zaaknummer %ZAAK.Zaakidentificatie% en is compleet bevonden. Dit houdt in dat wij uw bezwaar gaan beoordelen.  U wordt per e-mail op de hoogte gehouden van de status van de behandeling van uw bezwaar.', 'Het ingediende bezwaar is getoetst op de indieningsvereisten. De uitkomst van deze toets wordt vastgelegd in de eigenschap Uitslag toetsing. Indien er niet aan de indieningseisen wordt voldaan, dan wordt het bezwaar niet-ontvankelijk verklaard en kunnen de volgende vier statussen worden overgeslagen.', 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_statustype VALUES (3, '2def6744-68e6-44a6-8e64-b207393cae6c', 'Bezwaar beoordeeld', 'Bezwaar beoordeeld', 3, true, 'Geachte heer/mevrouw, Op %ZAAK.Registratiedatum% heeft u een bezwaar ingediend. Uw bezwaar is bij ons in behandeling onder zaaknummer %ZAAK.Zaakidentificatie%. Wij hebben uw bezwaar beoordeeld en gaan nu de hoorzitting voorbereiden.  U wordt per e-mail op de hoogte gehouden van de status van de behandeling van uw bezwaar.', 'Het ingediende bezwaar is inhoudelijk beoordeeld. Indien gegrond dan is, indien mogelijk, het besluit herroepen of aangepast. Indien niet gegrond dan heeft, indien van toepassing, mediation plaatsgevonden. Indien het besluit als gegrond is beoordeeld of indien mediation heeft geleid tot overeenstemming, dan wordt de volgende status overgeslagen. In het andere geval wordt een statusmelding verzonden.', 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_statustype VALUES (4, '14c88967-4dfe-4de9-98d2-8305ea5a8bf3', 'Hoorzitting gehouden', 'Hoorzitting gehouden', 4, false, '', 'Er is een verweerschrift opgesteld en verstuurd, een pleitnota is opgesteld en er heeft een hoorzitting plaatsgevonden. De bezwarencommissie heeft een advies uitgebracht.', 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_statustype VALUES (5, '60398624-9118-4224-b14a-ee18c9b9b19d', 'Concept-besluit opgesteld', 'Concept-besluit opgesteld', 5, false, '', 'Het conceptbesluit voor de beslisser is opgesteld, indien van toepassing op basis van het advies van de bezwarencommissie.', 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_statustype VALUES (6, '03b3ecdc-8aba-466a-87ba-7fdf38043bff', 'Besluit vastgesteld', 'Besluit vastgesteld', 6, true, 'Geachte heer/mevrouw, Op %ZAAK.Registratiedatum% hebben wij heeft u een bezwaar ingediend. Uw bezwaar is bij ons in behandeling onder zaaknummer %ZAAK.Zaakidentificatie%.  De gemeente heeft een besluit genomen over uw bezwaar onder besluitnummer %BESLUIT. Besluitidentificatie%.  Het besluit van de gemeente is:  %BESLUIT.Toelichting%  Het schriftelijke besluit op uw bezwaar inclusief motivatie wordt zo spoedig mogelijk per post naar u toegestuurd.', 'De uitspraak op het bezwaar is vastgesteld door de beslisser.', 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_statustype VALUES (7, '02c5585a-70a0-4ad6-99aa-b284e71415de', 'Zaak afgerond', 'Zaak afgerond', 7, true, 'Geachte heer/mevrouw, Op %ZAAK. Registratiedatum% heeft u een bezwaar ingediend. Uw bezwaar is bij ons in behandeling onder zaaknummer %ZAAK.Zaakidentificatie%. Onlangs bent u al op de hoogte gesteld van het besluit. Met deze e-mail willen wij u mededelen dat het besluit per post naar u is toegestuurd en dat wij de zaak hebben afgesloten.', 'Het besluit is schriftelijk kenbaar gemaakt aan de indiener van het bezwaar. De zaak is gearchiveerd en afgehandeld.', 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_statustype VALUES (9, '0cdbd15d-73fc-4ca6-a881-bacaf6fc9b74', 'Aanvraag beoordeeld', 'Aanvraag beoordeeld', 2, true, 'Geachte heer/mevrouw, Op %ZAAK.Registratiedatum% heeft u een aanvraag ingediend. Uw aanvraag is bij ons in behandeling onder zaaknummer %ZAAK.Zaakidentificatie%. Wij hebben uw bezwaar beoordeeld en gaan nu de hoorzitting voorbereiden. U wordt per e-mail op de hoogte gehouden van de status van de behandeling van uw aanvraag. Toelichting:', 'De ingediende aanvraag is inhoudelijk beoordeeld. Indien gegrond dan is, indien mogelijk, het besluit herroepen of aangepast. Indien niet gegrond dan heeft, indien van toepassing, mediation plaatsgevonden. Indien het besluit als gegrond is beoordeeld of indien mediation heeft geleid tot overeenstemming, dan wordt de volgende status overgeslagen. In het andere geval wordt een statusmelding verzonden.', 2, '2f75f45e7921613e66446eb6faa94256', NULL, NULL, NULL);
INSERT INTO public.catalogi_statustype VALUES (10, 'ec4c31b9-9dda-4ace-8716-02431cb3690c', 'Aanvraag afgerond', 'Aanvraag afgerond', 3, true, 'Geachte heer/mevrouw, Op %ZAAK. Registratiedatum% heeft u een aanvraag ingediend. Uw aanvraag is bij ons in behandeling onder zaaknummer %ZAAK.Zaakidentificatie%. Onlangs bent u al op de hoogte gesteld van het besluit. Met deze e-mail willen wij u mededelen dat het besluit per post naar u is toegestuurd en dat wij de zaak hebben afgesloten.', 'Het besluit is schriftelijk kenbaar gemaakt aan de indiener van de aanvraag. De zaak is gearchiveerd en afgehandeld.', 2, 'ac41a069883eb9ded925058e508b67f5', NULL, NULL, NULL);
INSERT INTO public.catalogi_statustype VALUES (8, '5890dbf3-89fd-485a-a73a-e8a92154e80f', 'Aanvraag ontvangen', 'Aanvraag ontvangen', 1, true, 'Geachte heer/mevrouw, Op %ZAAK. Registratiedatum% heeft u een aanvraag ingediend. Uw aanvraag is bij ons in behandeling genomen onder zaaknummer %ZAAK. Zaakidentificatie%. Wij vragen u dit zaaknummer te gebruiken in geval van correspondentie over dit bezwaar cq. deze zaak. U wordt per e-mail op de hoogte gehouden van de status van de behandeling van uw aanvraag.', 'Initiële status van de zaak waarbij de aancraag ontvangen is en naar aanleiding daarvan de zaak aangemaakt en de behandelaar bepaald is. De indiener is een ontvangstbevestiging van zijn (of haar) aanvraag gezonden.', 2, '87e6bba6b6f1bf5adf5a4016bef582fd', NULL, NULL, NULL);


--
-- Data for Name: catalogi_eigenschap; Type: TABLE DATA; Schema: public; Owner: openzaak
--

INSERT INTO public.catalogi_eigenschap VALUES (1, '7158027f-1b0e-4349-ae64-310383441db9', 'voornaam', 'voornaam', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (2, '57be569a-8047-4072-9ed0-83c0aa740117', 'achternaam', 'achternaam', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (3, 'c2d89f96-b9d4-4245-9e13-ae37c6f66ec0', 'bsn', 'bsn', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (4, '0589c96d-6634-42a6-bbe6-95a47ba40704', 'bezwaar', 'bezwaar', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (5, '536f8804-8bda-48a2-abbf-e981b9d230e4', 'straatnaam', 'straatnaam', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (6, '2496db6d-551f-4d75-877f-31bb0ad91f93', 'huisnummer', 'huisnummer', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (7, '6d3efae9-0c81-4283-b561-72d9f62acf37', 'toevoeging', 'toevoeging', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (8, '9e50d426-25b2-42f8-9e57-c4634c1bfe7a', 'postcode', 'postcode', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (9, 'd6c23d8b-814f-4ed7-8f74-f37b3f240d63', 'plaats', 'plaats', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (10, 'fe758a2d-577c-4156-8fc8-7882181dd3f1', 'telefoonnummer', 'telefoonnummer', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (11, 'b8ee8c32-6cbe-4240-824d-0cb58cce8aa1', 'e-mailadres', 'e-mailadres', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (12, 'c83cb736-8886-44d7-9ce5-fee13cd9c91b', 'zaaknummer', 'zaaknummer', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (13, 'd3a829e5-6137-4f10-86b2-69c2d2d312d0', 'datumBesluit', 'datumBesluit', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (14, '1af00531-1dda-4c86-aad2-94eb62197ef8', 'besluit', 'besluit', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (15, 'bbd8add9-8ca6-4cb2-b3fe-3bb0c2ef5977', 'communicatie', 'communicatie', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (16, 'b4f8a406-022a-41c6-b2a0-550d9050d3b8', 'beslissingBezwaar', 'beslissingBezwaar', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (17, '0c4dc53f-aa64-4027-b5c2-7e7acf3f6541', 'naamBehandelaar', 'naamBehandelaar', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (18, '4b935b29-21b6-4532-b567-4df6f4b48539', 'e-mailBehandelaar', 'e-mailBehandelaar', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (19, '245fbfc6-a95c-4558-a429-7293cdc05b42', 'aanvraagAanvulInfo', 'aanvraagAanvulInfo', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (20, '2c19d985-37bb-45ce-9b9d-ab4b22e7ba14', 'aanvullendeInfo', 'aanvullendeInfo', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (21, '5de90d10-54a5-4145-bc9b-85662fac8bac', 'naamBeslisser', 'naamBeslisser', '', 1, 1, '_etag', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (22, '07e9d9eb-739c-4715-b525-369154017391', 'achternaam', 'achternaam', 'achternaam', 1, 2, '89e35f5c6bb73860b9a142052ac594d0', NULL, NULL, NULL);
INSERT INTO public.catalogi_eigenschap VALUES (23, '34d7c9d3-0252-44e3-af7d-89192876740b', 'voornaam', 'voornaam', '', 1, 2, '3a6316266e952a738a2a2838818112a0', NULL, NULL, NULL);


--
-- Data for Name: catalogi_informatieobjecttype; Type: TABLE DATA; Schema: public; Owner: openzaak
--

INSERT INTO public.catalogi_informatieobjecttype VALUES (1, '2021-10-04', NULL, false, 'efc332f2-be3b-4bad-9e3c-49a6219c92ad', 'test', 'zaakvertrouwelijk', 1, '8725e864ba5e521c1f7e6de710f56ff8', '', '', '', '', '', '{rood,rond,groot}', '');


--
-- Data for Name: catalogi_roltype; Type: TABLE DATA; Schema: public; Owner: openzaak
--

INSERT INTO public.catalogi_roltype VALUES (1, '1c359a1b-c38d-47b8-bed5-994db88ead61', 'Aanvrager', 'initiator', 1, '_etag', NULL, NULL);
INSERT INTO public.catalogi_roltype VALUES (2, '9c44b192-e103-4999-88ad-f5120e5ac8d5', 'Behandelaar', 'behandelaar', 2, '3f61eda3e5d4b0aafcccba77c77b0cbe', NULL, NULL);


--
-- Data for Name: catalogi_zaaktypeinformatieobjecttype; Type: TABLE DATA; Schema: public; Owner: openzaak
--

INSERT INTO public.catalogi_zaaktypeinformatieobjecttype VALUES (1, '405da8a9-7296-439c-a2eb-a470b84f17ee', 1, 'inkomend', 1, NULL, 1, '_etag');
INSERT INTO public.catalogi_zaaktypeinformatieobjecttype VALUES (2, 'f85fa3c9-5ce9-447c-b38d-e5f258d83966', 1, 'inkomend', 1, NULL, 2, 'edb3c508217fb0f8f6989351ca112d47');


--
-- Data for Name: vng_api_common_jwtsecret; Type: TABLE DATA; Schema: public; Owner: openzaak
--

INSERT INTO public.vng_api_common_jwtsecret VALUES (1, 'valtimo_client', 'e09b8bc5-5831-4618-ab28-41411304309d');
INSERT INTO public.vng_api_common_jwtsecret VALUES (2, 'opennotificaties', 'opennotificaties');
INSERT INTO public.vng_api_common_jwtsecret VALUES (3, 'openformulieren', 'openformulieren');


--
-- Data for Name: zaken_rol; Type: TABLE DATA; Schema: public; Owner: openzaak
--



--
-- Data for Name: zaken_natuurlijkpersoon; Type: TABLE DATA; Schema: public; Owner: openzaak
--



--
-- Data for Name: zaken_zaakidentificatie; Type: TABLE DATA; Schema: public; Owner: openzaak
--

INSERT INTO public.zaken_zaakidentificatie VALUES (1, 'ZAAK-2024-0000000001', '000000000');
INSERT INTO public.zaken_zaakidentificatie VALUES (2, 'ZAAK-2026-0000000001', '000000000');


--
-- Name: accounts_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: openzaak
--

SELECT pg_catalog.setval('public.accounts_user_id_seq', 2, true);


--
-- Name: authorizations_applicatie_id_seq; Type: SEQUENCE SET; Schema: public; Owner: openzaak
--

SELECT pg_catalog.setval('public.authorizations_applicatie_id_seq', 3, true);


--
-- Name: catalogi_catalogus_id_seq; Type: SEQUENCE SET; Schema: public; Owner: openzaak
--

SELECT pg_catalog.setval('public.catalogi_catalogus_id_seq', 1, true);


--
-- Name: catalogi_eigenschap_id_seq; Type: SEQUENCE SET; Schema: public; Owner: openzaak
--

SELECT pg_catalog.setval('public.catalogi_eigenschap_id_seq', 23, true);


--
-- Name: catalogi_eigenschapspecificatie_id_seq; Type: SEQUENCE SET; Schema: public; Owner: openzaak
--

SELECT pg_catalog.setval('public.catalogi_eigenschapspecificatie_id_seq', 1, true);


--
-- Name: catalogi_informatieobjecttype_id_seq; Type: SEQUENCE SET; Schema: public; Owner: openzaak
--

SELECT pg_catalog.setval('public.catalogi_informatieobjecttype_id_seq', 1, true);


--
-- Name: catalogi_roltype_id_seq; Type: SEQUENCE SET; Schema: public; Owner: openzaak
--

SELECT pg_catalog.setval('public.catalogi_roltype_id_seq', 2, true);


--
-- Name: catalogi_statustype_id_seq; Type: SEQUENCE SET; Schema: public; Owner: openzaak
--

SELECT pg_catalog.setval('public.catalogi_statustype_id_seq', 10, true);


--
-- Name: catalogi_zaaktype_id_seq; Type: SEQUENCE SET; Schema: public; Owner: openzaak
--

SELECT pg_catalog.setval('public.catalogi_zaaktype_id_seq', 2, true);


--
-- Name: catalogi_zaaktypeinformatieobjecttype_id_seq; Type: SEQUENCE SET; Schema: public; Owner: openzaak
--

SELECT pg_catalog.setval('public.catalogi_zaaktypeinformatieobjecttype_id_seq', 2, true);


--
-- Name: vng_api_common_jwtsecret_id_seq; Type: SEQUENCE SET; Schema: public; Owner: openzaak
--

SELECT pg_catalog.setval('public.vng_api_common_jwtsecret_id_seq', 3, true);


--
-- Name: zaken_natuurlijkpersoon_id_seq; Type: SEQUENCE SET; Schema: public; Owner: openzaak
--

SELECT pg_catalog.setval('public.zaken_natuurlijkpersoon_id_seq', 1, true);


--
-- Name: zaken_rol_id_seq; Type: SEQUENCE SET; Schema: public; Owner: openzaak
--

SELECT pg_catalog.setval('public.zaken_rol_id_seq', 1, true);


--
-- Name: zaken_zaakidentificatie_id_seq; Type: SEQUENCE SET; Schema: public; Owner: openzaak
--

SELECT pg_catalog.setval('public.zaken_zaakidentificatie_id_seq', 2, true);


--
-- PostgreSQL database dump complete
--

\unrestrict buBslvaDlgTns71FgYJbmA5gkFsLxFCs9c1f0d0VjmiwmXbX2fPh7ddzzVvdf6N

