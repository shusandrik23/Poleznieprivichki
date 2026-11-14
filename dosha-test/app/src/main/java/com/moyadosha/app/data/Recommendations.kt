package com.moyadosha.app.data

data class TipSection(val emoji: String, val title: String, val tips: List<String>)

data class DoshaProfile(
    val dosha: Dosha,
    val about: String,
    val strengths: List<String>,
    val imbalance: List<String>,
    val sections: List<TipSection>,
)

/** Тексты результата на одном языке. */
interface RecTexts {
    val adults: Map<Dosha, DoshaProfile>
    val kids: Map<Dosha, DoshaProfile>
    val disclaimer: String
    fun pairText(pair: Set<Dosha>, kid: Boolean): String
    fun tri(kid: Boolean): String
    fun seasonPart(d: Dosha): String
    fun seasonLead(kid: Boolean): String
}

/** Описание типа и рекомендации на нужном языке. Для детей — свои, простые тексты. */
class Recommendations(lang: Lang) {
    private val t: RecTexts = if (lang == Lang.RU) RecommendationsRu else RecommendationsEn

    val disclaimer: String get() = t.disclaimer

    fun profile(d: Dosha, kid: Boolean): DoshaProfile = (if (kid) t.kids else t.adults).getValue(d)

    /** Короткое описание результата: для одной доши — её описание, для смешанных — отдельный текст. */
    fun summary(r: DoshaResult, kid: Boolean): String = when (r.leading.size) {
        1 -> profile(r.leading[0], kid).about
        2 -> t.pairText(r.leading.toSet(), kid)
        else -> t.tri(kid)
    }

    /** Совет по сезонам для смешанных типов. */
    fun seasonTip(r: DoshaResult, kid: Boolean): String? {
        if (r.leading.size < 2) return null
        val parts = r.leading.sortedBy { it.ordinal }.map { t.seasonPart(it) }
        return t.seasonLead(kid) + " " + parts.joinToString(", ") + "."
    }
}
