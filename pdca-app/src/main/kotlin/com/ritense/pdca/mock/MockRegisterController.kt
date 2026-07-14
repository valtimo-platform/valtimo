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

    @GetMapping("/stamtabel/doeltypen")
    fun getGoalTypes(): ResponseEntity<List<StamtabelEntry>> {
        return ResponseEntity.ok(listOf(
            StamtabelEntry("INVENTARISATIE", "Inventarisatie", "In kaart brengen van de huidige situatie"),
            StamtabelEntry("ONTWIKKELING", "Ontwikkeling", "Vaardigheden of kennis ontwikkelen"),
            StamtabelEntry("PRAKTISCH", "Praktisch", "Praktische zaken regelen"),
            StamtabelEntry("VERKENNING", "Verkenning", "Opties en mogelijkheden onderzoeken"),
            StamtabelEntry("PLAATSING", "Plaatsing", "Duurzame plaatsing realiseren"),
            StamtabelEntry("BORGING", "Borging", "Resultaten structureel borgen"),
            StamtabelEntry("ANALYSE", "Analyse", "Risico's en situatie analyseren"),
            StamtabelEntry("HERSTEL", "Herstel", "Tekortkomingen of problemen verhelpen"),
            StamtabelEntry("CONTROLE", "Controle", "Resultaten toetsen en valideren")
        ))
    }

    @GetMapping("/stamtabel/rollen")
    fun getRoles(): ResponseEntity<List<StamtabelEntry>> {
        return ResponseEntity.ok(listOf(
            StamtabelEntry("REGIEBEHANDELAAR", "Regiebehandelaar", "Hoofdverantwoordelijke voor het plan"),
            StamtabelEntry("ARBEIDSCOACH", "Arbeidscoach", "Begeleiding richting werk"),
            StamtabelEntry("SCHULDHULPVERLENER", "Schuldhulpverlener", "Ondersteuning bij schulden"),
            StamtabelEntry("INWONER", "Inwoner / Eigenaar", "Subject van het plan"),
            StamtabelEntry("PROJECTLEIDER", "Projectleider", "Leidt het project"),
            StamtabelEntry("BRANDVEILIGHEIDSADVISEUR", "Brandveiligheidsadviseur", "Advies over brandveiligheid"),
            StamtabelEntry("GEBOUWBEHEERDER", "Gebouwbeheerder", "Verantwoordelijk voor gebouwonderhoud"),
            StamtabelEntry("INSPECTEUR", "Inspecteur", "Voert inspecties uit"),
            StamtabelEntry("AANBIEDER", "Aanbieder", "Externe dienstverlener"),
            StamtabelEntry("COACH", "Coach", "Begeleiding en coaching")
        ))
    }
}

data class StamtabelEntry(
    val code: String,
    val label: String,
    val beschrijving: String
)
