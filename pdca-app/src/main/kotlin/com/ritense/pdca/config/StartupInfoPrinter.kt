package com.ritense.pdca.config

import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.core.env.Environment
import org.springframework.stereotype.Component

@Component
class StartupInfoPrinter(private val env: Environment) {

    @EventListener(ApplicationReadyEvent::class)
    fun onReady() {
        val port = env.getProperty("server.port", "8090")
        val base = "http://localhost:$port"

        println("""

            ┌──────────────────────────────────────────────────────────────────┐
            │  PDCA App running at $base                              │
            ├──────────────────────────────────────────────────────────────────┤
            │                                                                  │
            │  To connect to GZAC, register as external plugin:                │
            │                                                                  │
            │  1. Open GZAC admin → Plugin Management → Add App                │
            │  2. Fill in:                                                      │
            │     • Name:     PDCA Planbeheer                                  │
            │     • Base URL: $base                                    │
            │     • Secret:   (anything — HMAC not enforced in prototype)        │
            │  3. Save → GZAC will discover the plugin automatically           │
            │  4. Create a plugin configuration for the discovered plugin       │
            │  5. Add external plugin case tabs to your case definitions:       │
            │     • inwonerplan → plan-overview, plan-goals, plan-evaluations  │
            │     • binnenhof-renovatie → same tabs                            │
            │                                                                  │
            │  Standalone API:                                                 │
            │    Plans:     $base/api/v1/plans/11111111-1111-1111-1111-111111111111
            │    Goals:     $base/api/v1/plans/11111111-1111-1111-1111-111111111111/goals
            │    Binnenhof: $base/api/v1/plans/33333333-3333-3333-3333-333333333333
            │    Persons:   $base/api/v1/mock/persons/445775187
            │    Objects:   $base/api/v1/mock/objects/binnenhof-001
            │    Products:  $base/api/v1/mock/products
            │    Phases:    $base/api/v1/admin/phase-configs
            │    Health:    $base/health
            │    Manifest:  $base/api/host/plugins
            │                                                                  │
            │  Bundles (open in browser):                                       │
            │    Overview:    $base/bundles/plan-overview.js
            │    Goals:       $base/bundles/plan-goals.js
            │    Evaluations: $base/bundles/plan-evaluations.js
            │    Admin:       $base/bundles/pdca-admin.js
            │                                                                  │
            └──────────────────────────────────────────────────────────────────┘

        """.trimIndent())
    }
}
