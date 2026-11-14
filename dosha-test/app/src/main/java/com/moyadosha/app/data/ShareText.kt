package com.moyadosha.app.data

object ShareText {
    fun build(name: String, age: Int, kid: Boolean, r: DoshaResult, lang: Lang): String = buildString {
        val ru = lang == Lang.RU
        val s = UiStrings(lang)
        val rec = Recommendations(lang)
        val who = name.trim().ifEmpty { if (ru) "Я" else "Me" }
        appendLine(if (ru) "🪷 Тест «Моя доша»" else "🪷 \"My Dosha\" test")
        appendLine()
        appendLine("$who, $age ${s.years(age)}")
        appendLine((if (ru) "Тип по Аюрведе: " else "Ayurvedic type: ") + "${r.typeName(lang)} ${r.emoji}")
        appendLine(Dosha.entries.joinToString(" · ") { "${it.title(lang)} ${r.percent.getValue(it)}%" })
        appendLine()
        appendLine(rec.summary(r, kid))
        appendLine()
        appendLine(
            when {
                ru && kid -> "Главные советы:"
                ru -> "Главные рекомендации:"
                else -> "Top tips:"
            }
        )
        val perDosha = if (r.leading.size == 1) 3 else 2
        r.leading.forEach { d ->
            rec.profile(d, kid).sections.take(perDosha).forEach { sec ->
                appendLine("• ${sec.emoji} ${sec.tips.first()}")
            }
        }
        appendLine()
        append(
            if (ru) "А какая доша у тебя? Пройди тест «Моя доша» 🌬️🔥🌿"
            else "What's your dosha? Take the \"My Dosha\" test 🌬️🔥🌿"
        )
    }
}
