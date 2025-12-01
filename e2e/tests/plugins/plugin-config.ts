export const pluginTypes = [
    "Besluiten API",
    "Catalogi API",
    "Documenten API",
    "Klantinteracties API",
    "Notificaties API",
    "OpenNotificaties",
    "Objecten API",
    "Object token authentication",
    "Objecttypen API",
    "OpenKlant token authentication",
    "OpenZaak",
    "Portal task",
    "SmartDocuments",
    "Verzoek",
    "Zaken API",
];

export const pluginFieldMap = {
    "Besluiten API": [
        { label: "Configuration ID", value: "857d4312-c420-4a22-979b-625818d97ed4" },
        { label: "Configuration name", value: "Test Besluiten API" },
        { label: "RSIN", value: "328674989" },
        { label: "Besluiten API URL", value: "http://localhost:8001/besluiten/api/v1/" },
        { label: "Authentication plugin configuration", value: "OpenZaak Authentication - OpenZaak" },
    ],

    "Catalogi API": [
        { label: "Configuration ID", value: "22c78b91-0b0f-4008-8d8f-c4a84b8e71ed" },
        { label: "Configuration name", value: "Test Catalogi API" },
        { label: "Catalogi API URL", value: "http://localhost:8001/catalogi/api/v1/" },
        { label: "Authentication plugin configuration", value: "OpenZaak Authentication - OpenZaak" },
    ],

    "Documenten API": [
        { label: "Configuration ID", value: "5474fe57-532a-4050-8d89-32e62ca3e896" },
        { label: "Configuration name", value: "Test Documenten API" },
        { label: "Documenten API URL", value: "http://localhost:8001/documenten/api/v1/" },
        { label: "Organisation RSIN", value: "151368508" },
        { label: "Authentication plugin configuration", value: "OpenZaak Authentication - OpenZaak" },
        { label: "Documenten API version", value: "1.4.2-maykin-1.13.0" },
    ],

    "Klantinteracties API": [
        { label: "Configuration ID", value: "5474fe57-532a-4050-8d89-32e62ca3e896" },
        { label: "Configuration name", value: "Besluiten config" },
        { label: "Klantinteracties API URL", value: "Besluiten config" },
        { label: "Authentication plugin configuration", value: "OpenZaak Authentication - OpenZaak" },
    ],

    "Notificaties API": [
        { label: "Configuration ID", value: "config-besluiten-id" },
        { label: "Configuration name", value: "Test Notificaties API" },
        { label: "Notificaties API URL", value: "Besluiten config" },
        { label: "Callback URL", value: "123456789" },
        { label: "Authentication plugin configuration", value: "123456789" },
    ],

    "OpenNotificaties": [
        { label: "Configuration ID", value: "config-besluiten-id" },
        { label: "Configuration name", value: "Test OpenNotificaties" },
        { label: "Client ID", value: "Besluiten config" },
        { label: "Secret", value: "123456789" },
    ],

    "Objecten API": [
        { label: "Configuration ID", value: "config-besluiten-id" },
        { label: "Configuration name", value: "Test Objecten API" },
        { label: "Objecten API URL", value: "Besluiten config" },
        { label: "Authentication plugin configuration", value: "123456789" },
    ],

    "Object token authentication": [
        { label: "Configuration ID", value: "config-besluiten-id" },
        { label: "Configuration name", value: "Test Object token authentication" },
        { label: "Token", value: "Besluiten config" },
    ],

    "Objecttypen API": [
        { label: "Configuration ID", value: "config-besluiten-id" },
        { label: "Configuration name", value: "Test Objecttypen API" },
        { label: "Objecttypen API UR", value: "Besluiten config" },
        { label: "Authentication plugin configuration", value: "Besluiten config" },
    ],

    "OpenKlant token authentication": [
        { label: "Configuration ID", value: "config-besluiten-id" },
        { label: "Configuration name", value: "Test OpenKlant token authentication" },
        { label: "Token", value: "Besluiten config" },
    ],

    "OpenZaak": [
        { label: "Configuration ID", value: "config-besluiten-id" },
        { label: "Configuration name", value: "Test OpenZaak" },
        { label: "Client ID", value: "Besluiten config" },
        { label: "Secret", value: "Besluiten config" },
    ],

    "Portal task": [
        { label: "Configuration ID", value: "config-besluiten-id" },
        { label: "Configuration name", value: "Test Portal task" },
        { label: "Notificaties API plugin", value: "Besluiten config" },
        { label: "Object management configuration", value: "Besluiten config" },
        { label: "Process to complete Portaaltaak", value: "Besluiten config" },
    ],

    "SmartDocuments": [
        { label: "Configuration ID", value: "config-besluiten-id" },
        { label: "Configuration name", value: "Test SmartDocuments" },
        { label: "Notificaties API plugin", value: "Besluiten config" },
        { label: "Username", value: "Besluiten config" },
        { label: "Password", value: "Besluiten config" },
    ],

    "Verzoek": [
        { label: "Configuration ID", value: "config-besluiten-id" },
        { label: "Configuration name", value: "Test Verzoek" },
        { label: "Notificaties API configuration", value: "Besluiten config" },
        { label: "Process", value: "Besluiten config" },
        { label: "RSIN", value: "Besluiten config" },
    ],

    "Zaken API": [
        { label: "Configuration ID", value: "config-besluiten-id" },
        { label: "Configuration name", value: "Test Zaken API" },
        { label: "URL", value: "Besluiten config" },
        { label: "Authentication plugin configuration", value: "Besluiten config" },
    ],
};