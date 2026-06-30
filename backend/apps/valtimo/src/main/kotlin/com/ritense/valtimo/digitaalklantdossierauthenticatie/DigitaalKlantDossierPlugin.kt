package com.ritense.valtimo.digitaalklantdossierauthenticatie

import com.ritense.plugin.annotation.Plugin
import com.ritense.plugin.annotation.PluginProperty
import java.net.URI

@Plugin(
    key = "digitaalklantdossier",
    title = "Digitaal Klant Dossier",
    description = "Connects to DKD via OpenTunnel",
)
class DigitaalKlantDossierPlugin {
    @PluginProperty(key = "url", secret = false)
    lateinit var url: URI

    @PluginProperty(key = "username", secret = false)
    lateinit var username: String

    @PluginProperty(key = "password", secret = true)
    lateinit var password: String
}