\set service_id 11
--
-- Data for Name: zgw_consumers_service; Type: TABLE DATA; Schema: public; Owner: openzaak
--


INSERT INTO public.zgw_consumers_service
     VALUES (:service_id, 'Notificaties API', 'nrc', 'http://host.docker.internal:8002/api/v1/', 'openzaak', 'openzaak', 'zgw', '', '', '', '', '', NULL, NULL, '5c867a14-2ff4-4574-9451-5c23cc3f75a0', 10, '', 'notificaties-api', 43200);

INSERT INTO public.notifications_api_common_notificationsconfig VALUES (1, :service_id, 5, 3, 48, 4)
    ON CONFLICT (id)
DO UPDATE SET
    notifications_api_service_id = EXCLUDED.notifications_api_service_id;
