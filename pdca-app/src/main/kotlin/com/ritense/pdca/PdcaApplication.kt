package com.ritense.pdca

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration
import org.springframework.boot.runApplication

@SpringBootApplication(exclude = [UserDetailsServiceAutoConfiguration::class])
class PdcaApplication

fun main(args: Array<String>) {
    runApplication<PdcaApplication>(*args)
}
