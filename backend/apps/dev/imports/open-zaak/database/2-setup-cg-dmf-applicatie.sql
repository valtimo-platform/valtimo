-- Registers cg-dmf as an OpenZaak "Applicatie" so it can call the Catalogi API
-- to validate informatieobjecttypen. Client id/secret must match OPENZAAK_CLIENT_ID
-- and OPENZAAK_CLIENT_SECRET on the cg-dmf service in docker-compose.yaml.

INSERT INTO authorizations_applicatie (uuid, client_ids, label, heeft_alle_autorisaties) VALUES (uuid_generate_v4(), '{cg-dmf}', 'CG-DMF', true);

INSERT INTO vng_api_common_jwtsecret (identifier, secret) VALUES ('cg-dmf', 'e19ea7fbe4a0b2acf0451abe44344967');
