package com.ritense.pdca.mock

import org.springframework.stereotype.Component

data class ProductRecord(
    val id: String,
    val naam: String,
    val categorie: String,
    val omschrijving: String,
    val aanbieder: String,
    val duur: String,
    val doelgroep: List<String>
)

@Component
class MockProductRegister {

    private val products = listOf(
        ProductRecord(
            id = "prod-werkfit-001",
            naam = "Werkfit Traject WIO",
            categorie = "Werk & Dagbesteding",
            omschrijving = "Traject gericht op het vergroten van werkfit-vaardigheden binnen de WIO-doelgroep",
            aanbieder = "Werkse!",
            duur = "6 maanden",
            doelgroep = listOf("Werkzoekenden", "WIO-doelgroep")
        ),
        ProductRecord(
            id = "prod-jobcoach-001",
            naam = "Jobcoaching",
            categorie = "Werk & Dagbesteding",
            omschrijving = "Individuele begeleiding op de werkplek door een gecertificeerde jobcoach",
            aanbieder = "Randstad",
            duur = "12 maanden",
            doelgroep = listOf("Werkenden met ondersteuningsbehoefte", "Arbeidsbeperking")
        ),
        ProductRecord(
            id = "prod-leerbaarheid-001",
            naam = "Leerbaarheidstoets",
            categorie = "Intake & Assessment",
            omschrijving = "Assessment om leervermogen en ontwikkelmogelijkheden in kaart te brengen",
            aanbieder = "ROC Mondriaan",
            duur = "2 weken",
            doelgroep = listOf("Jongeren", "Herintreders")
        ),
        ProductRecord(
            id = "prod-orienterend-001",
            naam = "Orienterend Aanbod",
            categorie = "Werk & Dagbesteding",
            omschrijving = "Korte orientatieperiode om werkinteresses en mogelijkheden te verkennen",
            aanbieder = "Gemeente Den Haag",
            duur = "3 maanden",
            doelgroep = listOf("Werkzoekenden", "Statushouders")
        ),
        ProductRecord(
            id = "prod-nazorg-001",
            naam = "Nazorgtraject",
            categorie = "Werk & Dagbesteding",
            omschrijving = "Nazorg en monitoring na succesvolle plaatsing op een werkplek",
            aanbieder = "Gemeente Den Haag",
            duur = "6 maanden",
            doelgroep = listOf("Recent geplaatste werknemers")
        ),
        ProductRecord(
            id = "prod-brandveiligheid-001",
            naam = "Brandveiligheidsonderzoek",
            categorie = "Analyse & Advies",
            omschrijving = "Onderzoek naar brandveiligheid van gebouwen en objecten",
            aanbieder = "Brandweer NL",
            duur = "4 weken",
            doelgroep = listOf("Gebouweigenaren", "Monumentenbeheerders")
        ),
        ProductRecord(
            id = "prod-bhv-001",
            naam = "BHV-training",
            categorie = "Training & Educatie",
            omschrijving = "Bedrijfshulpverleningstraining conform wettelijke eisen",
            aanbieder = "Veiligheidsregio",
            duur = "2 dagen",
            doelgroep = listOf("BHV-ers", "Medewerkers")
        ),
        ProductRecord(
            id = "prod-inspectie-001",
            naam = "Inspectiedienst",
            categorie = "Inspectie & Controle",
            omschrijving = "Technische inspectie en controle van installaties en constructies",
            aanbieder = "TUV Nederland",
            duur = "1 week",
            doelgroep = listOf("Gebouweigenaren", "Installatiebeheerders")
        ),
        ProductRecord(
            id = "prod-financiele-intake-001",
            naam = "Financiele Intake",
            categorie = "Intake & Assessment",
            omschrijving = "Inventarisatie van de financiele situatie en mogelijkheden voor ondersteuning",
            aanbieder = "Gemeente Den Haag",
            duur = "2 weken",
            doelgroep = listOf("Bijstandsgerechtigden", "Minima")
        )
    )

    fun findAll(): List<ProductRecord> {
        return products
    }

    fun findById(id: String): ProductRecord? {
        return products.find { it.id == id }
    }

    fun findByCategory(category: String): List<ProductRecord> {
        return products.filter { it.categorie.equals(category, ignoreCase = true) }
    }

    fun findByTargetGroup(targetGroup: String): List<ProductRecord> {
        return products.filter { product ->
            product.doelgroep.any { it.equals(targetGroup, ignoreCase = true) }
        }
    }

    fun findByCategoryAndTargetGroup(category: String?, targetGroup: String?): List<ProductRecord> {
        var result = products
        if (!category.isNullOrBlank()) {
            result = result.filter { it.categorie.equals(category, ignoreCase = true) }
        }
        if (!targetGroup.isNullOrBlank()) {
            result = result.filter { product ->
                product.doelgroep.any { it.equals(targetGroup, ignoreCase = true) }
            }
        }
        return result
    }
}
