package com.moyadosha.app.data

/** Все надписи интерфейса на одном языке. */
class UiStrings(val lang: Lang) {
    private val ru = lang == Lang.RU
    private fun t(ru: String, en: String) = if (this.ru) ru else en

    val appName = t("Моя доша", "My Dosha")
    val intro = t(
        "Узнайте свой тип по Аюрведе — Вата, Питта или Капха — и получите советы по питанию, режиму дня и образу жизни.",
        "Discover your Ayurvedic type — Vata, Pitta or Kapha — and get tips on food, daily routine and lifestyle.",
    )
    val meet = t("Давайте познакомимся", "Let's get acquainted")
    val name = t("Имя", "Name")
    val age = t("Возраст (полных лет)", "Age (years)")
    val ageError = t("Введите возраст от 1 до 110", "Enter an age from 1 to 110")
    val howMany = t("Сколько вопросов?", "How many questions?")
    fun lengthHint(n: Int) = when (n) {
        20 -> t("быстро, ~4 мин", "quick, ~4 min")
        35 -> t("оптимально, ~7 мин", "optimal, ~7 min")
        else -> t("точнее всего, ~10 мин", "most accurate, ~10 min")
    }
    val kidNote = t(
        "🧸 Будет детская версия теста: простые вопросы про игры, еду и сон. Если читать пока трудно — пусть помогут мама или папа.",
        "🧸 This will be the kids' version: simple questions about games, food and sleep. If reading is still hard, ask mum or dad to help.",
    )
    val adultNote = t(
        "📝 Отвечайте, каким вы были большую часть жизни, а не только в последние дни. Выбирайте самый близкий вариант.",
        "📝 Answer how you have been for most of your life, not just recently. Choose the closest option.",
    )
    val start = t("Начать тест", "Start the test")
    val threeDoshas = t("Три доши", "The three doshas")
    fun doshaIntro(d: Dosha) = when (d) {
        Dosha.VATA -> t("лёгкость, движение, творчество", "lightness, movement, creativity")
        Dosha.PITTA -> t("огонь, сила воли, ясный ум", "fire, willpower, a clear mind")
        Dosha.KAPHA -> t("спокойствие, выносливость, доброта", "calm, stamina, kindness")
    }

    fun questionOf(i: Int, n: Int) = t("Вопрос $i из $n", "Question $i of $n")
    val kidBadge = t("🧸 детский", "🧸 kids")
    val back = t("Назад", "Back")
    val next = t("Далее", "Next")
    val seeResult = t("Узнать результат", "See my result")
    val quitTitle = t("Прервать тест?", "Quit the test?")
    val quitText = t("Ответы не сохранятся.", "Your answers won't be saved.")
    val quit = t("Прервать", "Quit")
    val continueTest = t("Продолжить", "Continue")

    fun yourDosha(kid: Boolean) = if (kid) t("твоя доша", "your dosha") else t("ваша доша", "your dosha")
    fun proportions(kid: Boolean) = if (kid) t("Из чего ты состоишь", "What you're made of") else t("Соотношение дош", "Dosha balance")
    fun yourType(kid: Boolean) = if (kid) t("Какой ты", "What you're like") else t("Ваш тип", "Your type")
    fun tipsTitle(kid: Boolean) = if (kid) t("Советы для тебя", "Tips for you") else t("Рекомендации", "Recommendations")
    fun forDosha(d: Dosha) = t("Для доши ${d.title(lang)}", "For ${d.title(lang)}")
    fun strengths(kid: Boolean) = if (kid) t("💪 Твои сильные стороны", "💪 Your strengths") else t("💪 Сильные стороны", "💪 Strengths")
    fun imbalance(d: Dosha, kid: Boolean) =
        if (kid) t("⚠️ Когда ${d.title(lang)} «шалит»", "⚠️ When ${d.title(lang)} gets naughty")
        else t("⚠️ Признаки дисбаланса", "⚠️ Signs of imbalance")
    val collapse = t("Свернуть", "Collapse")
    val expand = t("Развернуть", "Expand")
    val share = t("Поделиться результатом", "Share my result")
    val retake = t("Пройти заново", "Take the test again")
    val shareSubject = t("Мой результат теста «Моя доша»", "My \"My Dosha\" test result")

    fun years(n: Int): String {
        if (!ru) return if (n == 1) "year old" else "years old"
        val mod100 = n % 100
        val mod10 = n % 10
        return when {
            mod100 in 11..14 -> "лет"
            mod10 == 1 -> "год"
            mod10 in 2..4 -> "года"
            else -> "лет"
        }
    }
}
