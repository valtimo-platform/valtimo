-- Registers cg-dmf as an OpenZaak "Applicatie" so it can call the Catalogi API
-- to validate informatieobjecttypen. Client id/secret must match OPENZAAK_CLIENT_ID
-- and OPENZAAK_CLIENT_SECRET on the cg-dmf service in docker-compose.yaml.

INSERT INTO authorizations_applicatie (uuid, client_ids, label, heeft_alle_autorisaties) VALUES (uuid_generate_v4(), '{cg-dmf}', 'CG-DMF', true);

INSERT INTO vng_api_common_jwtsecret (identifier, secret) VALUES ('cg-dmf', 'e19ea7fbe4a0b2acf0451abe44344967');

-- Registers cg-dmf as a "Service" so OpenZaak can authenticate when it fetches
-- informatieobject URLs back from cg-dmf (e.g. validating a zaakinformatieobject
-- link). client_id/secret reuse the "valtimo_client" credential — the requests
-- being validated originate from Valtimo's own writes, not a distinct caller.
-- api_root must match cg-dmf's BASE_URL on the cg-dmf service in docker-compose.yaml.
INSERT INTO zgw_consumers_service (uuid, label, api_type, api_root, client_id, secret, auth_type, header_key, header_value, oas, nlx, user_id, user_representation, oas_file, timeout, api_connection_check_path, slug)
VALUES (uuid_generate_v4(), 'CG-DMF', 'drc', 'http://cg-dmf.localhost:8083/documenten/api/v1/', 'valtimo_client', 'e09b8bc5-5831-4618-ab28-41411304309d', 'zgw', '', '', '', '', 'openzaak', 'Open Zaak', '', 10, '', 'cg-dmf');
