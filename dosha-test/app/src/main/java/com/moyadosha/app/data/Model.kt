package com.moyadosha.app.data

import java.util.Locale

/** Язык приложения: русский, если система на русском, иначе английский. */
enum class Lang {
    RU, EN;

    companion object {
        fun system(locale: Locale = Locale.getDefault()): Lang = if (locale.language == "ru") RU else EN
    }
}

enum class Dosha(
    val emoji: String,
    private val titleRu: String,
    private val titleEn: String,
    private val elementRu: String,
    private val elementEn: String,
) {
    VATA("🌬️", "Вата", "Vata", "воздух и эфир", "air and space"),
    PITTA("🔥", "Питта", "Pitta", "огонь и вода", "fire and water"),
    KAPHA("🌿", "Капха", "Kapha", "земля и вода", "earth and water");

    fun title(lang: Lang) = if (lang == Lang.RU) titleRu else titleEn
    fun element(lang: Lang) = if (lang == Lang.RU) elementRu else elementEn
}

/**
 * Каждый вариант ответа даёт 2 балла: либо целиком одной доше,
 * либо поровну двум (смешанные варианты). Так 6 вариантов покрывают
 * все оттенки: В, П, К, В+П, П+К, В+К.
 */
enum class Mix(val vata: Int, val pitta: Int, val kapha: Int) {
    V(2, 0, 0), P(0, 2, 0), K(0, 0, 2),
    VP(1, 1, 0), PK(0, 1, 1), VK(1, 0, 1);

    fun points(d: Dosha) = when (d) {
        Dosha.VATA -> vata
        Dosha.PITTA -> pitta
        Dosha.KAPHA -> kapha
    }
}

data class Option(val mix: Mix, val text: String)

data class Question(val text: String, val options: List<Option>)

internal fun q(text: String, vararg options: Pair<Mix, String>) =
    Question(text, options.map { Option(it.first, it.second) })

/** Возраст, до которого показывается детская версия теста. */
const val KID_MAX_AGE = 12

/** Варианты длины теста. */
val TEST_LENGTHS = listOf(20, 35, 50)

/**
 * Номера (с нуля) ключевых вопросов для короткого теста из 20.
 * Тест из 35 = первые 35 вопросов списка, из 50 = все.
 * Ключевые 20 всегда входят в первые 35.
 */
private val ADULT_CORE_20 = setOf(0, 1, 2, 3, 6, 7, 8, 11, 12, 14, 15, 17, 18, 19, 20, 22, 23, 24, 27, 34)
private val KID_CORE_20 = setOf(0, 1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 19, 20, 22, 32, 33)

fun allQuestions(kid: Boolean, lang: Lang): List<Question> = when {
    kid && lang == Lang.RU -> KidQuestions.ru
    kid -> KidQuestionsEn.en
    lang == Lang.RU -> AdultQuestions.ru
    else -> AdultQuestionsEn.en
}

/** Самый короткий набор (20, 35 или 50), в который входит вопрос с этим номером (с нуля). */
fun minLengthFor(index: Int, kid: Boolean): Int = when {
    index in (if (kid) KID_CORE_20 else ADULT_CORE_20) -> 20
    index < 35 -> 35
    else -> 50
}

fun questionsFor(age: Int, count: Int, lang: Lang): List<Question> {
    val kid = age <= KID_MAX_AGE
    return allQuestions(kid, lang).filterIndexed { i, _ -> minLengthFor(i, kid) <= count }
}
