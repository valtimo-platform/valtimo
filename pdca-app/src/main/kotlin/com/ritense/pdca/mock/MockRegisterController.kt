package com.ritense.pdca.mock

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/mock")
class MockRegisterController(
    private val personRegister: MockPersonRegister,
    private val objectRegister: MockObjectRegister,
    private val productRegister: MockProductRegister
) {

    @GetMapping("/persons/{bsn}")
    fun getPerson(@PathVariable bsn: String): ResponseEntity<PersonRecord> {
        val person = personRegister.findByBsn(bsn)
        return if (person != null) {
            ResponseEntity.ok(person)
        } else {
            ResponseEntity.notFound().build()
        }
    }

    @GetMapping("/objects/{objectId}")
    fun getObject(@PathVariable objectId: String): ResponseEntity<ObjectRecord> {
        val obj = objectRegister.findById(objectId)
        return if (obj != null) {
            ResponseEntity.ok(obj)
        } else {
            ResponseEntity.notFound().build()
        }
    }

    @GetMapping("/products")
    fun getProducts(
        @RequestParam(required = false) category: String?,
        @RequestParam(required = false) targetGroup: String?
    ): ResponseEntity<List<ProductRecord>> {
        val products = productRegister.findByCategoryAndTargetGroup(category, targetGroup)
        return ResponseEntity.ok(products)
    }

    @GetMapping("/products/{id}")
    fun getProduct(@PathVariable id: String): ResponseEntity<ProductRecord> {
        val product = productRegister.findById(id)
        return if (product != null) {
            ResponseEntity.ok(product)
        } else {
            ResponseEntity.notFound().build()
        }
    }
}
