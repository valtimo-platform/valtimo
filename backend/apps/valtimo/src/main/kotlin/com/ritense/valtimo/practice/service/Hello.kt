package com.ritense.valtimo.practice.service

import org.springframework.stereotype.Service

@Service
class Hello {
    fun hello(input: String) {
        println(input)
    }

    fun error(input: String) {
        println(input)
    }
}