package com.ritense.valtimo.practice.plugin

import org.springframework.stereotype.Component

@Component
class SampleClient {
    fun hello() {
        println("PLUGIN HELLO")
    }
}