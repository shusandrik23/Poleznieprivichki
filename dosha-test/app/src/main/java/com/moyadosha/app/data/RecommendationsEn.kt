package com.moyadosha.app.data

/** Type descriptions and recommendations in English. */
object RecommendationsEn : RecTexts {
    override fun tri(kid: Boolean) = if (kid) KID_TRI else ADULT_TRI

    override fun seasonPart(d: Dosha) = when (d) {
        Dosha.VATA -> "the Vata tips in autumn and early winter, in cold and wind"
        Dosha.PITTA -> "the Pitta tips in summer and hot weather"
        Dosha.KAPHA -> "the Kapha tips in spring and damp weather"
    }

    override fun seasonLead(kid: Boolean) = "Tips for more than one dosha suit you. Follow"

    override val disclaimer = "This test is based on the principles of Ayurveda and is for information only. " +
        "It does not make a diagnosis or replace a doctor's advice. If you have health problems, please see a specialist."

    override fun pairText(pair: Set<Dosha>, kid: Boolean): String = when (pair) {
        setOf(Dosha.VATA, Dosha.PITTA) -> if (kid)
            "You have a little breeze and a little flame inside 🌬️🔥. You are quick, clever and active, full of ideas and courage. " +
                "It's important not to overdo it: eat on time, rest and go to bed on time, or you may get tired, cranky or angry."
        else
            "Vata-Pitta: the lightness and speed of Vata plus the drive of Pitta. You think fast, are full of ideas and know how to make them happen. " +
                "Your weak spot is overload: anxiety and irritation, irregular meals, problems with sleep and digestion. " +
                "Routine, regular meals and learning to rest are especially important for you."

        setOf(Dosha.PITTA, Dosha.KAPHA) -> if (kid)
            "You have a little flame and a little earth inside 🔥🌿. You are strong and brave, and also calm and reliable. " +
                "You have good health and lots of energy. It's important to move more and not to eat too many sweets."
        else
            "Pitta-Kapha: the strength and drive of Pitta plus the stability and stamina of Kapha. " +
                "This usually means good health, good energy and self-confidence. " +
                "Your weak spot is a tendency to overeat, gain weight and be stubborn. Regular activity and light food help."

        else -> if (kid)
            "You have a little breeze and a little earth inside 🌬️🌿. Sometimes you are quick and cheerful, sometimes calm and dreamy. " +
                "You especially need warmth: warm clothes, warm food, cosiness and lots of movement to feel cheerful and lively."
        else
            "Vata-Kapha: the lightness of Vata plus the softness and calm of Kapha. You are a sensitive, gentle and creative person. " +
                "Both doshas are \"cold\", so warmth is especially important for you: warm food, warm clothes, spices and movement. " +
                "Weak spots: feeling cold, sluggish digestion, frequent colds and mood swings."
    }

    private const val ADULT_TRI =
        "All three doshas are almost equal in you — a rare balanced type (Vata-Pitta-Kapha). " +
            "You adapt well and usually have good health. Your main task is to keep the balance: " +
            "notice which dosha comes forward in different seasons and periods of life, and adjust your food and routine to it."

    private const val KID_TRI =
        "You have equal parts of breeze, flame and earth 🌬️🔥🌿 — that's rare! " +
            "You can be quick, brave and calm. The main thing is to keep a routine, eat well and play outside a lot."

    override val adults = mapOf(
        Dosha.VATA to DoshaProfile(
            Dosha.VATA,
            about = "Vata is the energy of air and movement. You are a light, quick and creative person full of ideas. " +
                "When Vata is in balance, you are inspired, cheerful and easy-going. When it is out of balance, " +
                "anxiety, insomnia, dryness, fatigue and digestive problems appear.",
            strengths = listOf("Creativity and imagination", "Quick mind", "Flexibility and lightness", "Enthusiasm and sociability"),
            imbalance = listOf(
                "Anxiety, restlessness, fussiness", "Poor sleep", "Dry skin and hair",
                "Bloating and constipation", "Cold hands and feet", "Distraction and fatigue",
            ),
            sections = listOf(
                TipSection("🍲", "Food", listOf(
                    "Eat warm, soft and moist food: soups, porridge, stews, cooked vegetables",
                    "Sweet, sour and salty tastes suit you",
                    "Add healthy oils: ghee, olive oil, sesame oil",
                    "Less raw, cold and dry food: crisps, crackers, iced drinks",
                    "Eat at the same times and don't skip meals",
                    "Drink warm water and herbal teas with ginger, cinnamon, cardamom",
                )),
                TipSection("⏰", "Daily routine", listOf(
                    "A steady routine is your best medicine",
                    "Go to bed by 10–10:30 pm",
                    "Start the morning calmly, without rushing",
                    "Don't plan too much for one day",
                )),
                TipSection("🧘", "Movement", listOf(
                    "Gentle exercise: yoga, swimming in warm water, walks, stretching",
                    "Avoid exhausting workouts",
                    "Dress warmly, protect yourself from wind and drafts",
                )),
                TipSection("💆", "Body care", listOf(
                    "Self-massage with warm sesame oil before a shower",
                    "Warm baths, warm socks before bed",
                )),
                TipSection("💛", "Emotions", listOf(
                    "Breathing exercises and meditation calm Vata",
                    "Fewer screens and less news in the evening",
                    "Create cosiness: warmth, soft light, calm music",
                )),
            ),
        ),
        Dosha.PITTA to DoshaProfile(
            Dosha.PITTA,
            about = "Pitta is the energy of fire and transformation. You are a driven, smart and organised person, a natural leader. " +
                "When Pitta is in balance — a clear mind, willpower, good digestion and warmth towards people. " +
                "When it is out of balance — irritability, perfectionism, heartburn and skin inflammation.",
            strengths = listOf("Determination", "Clear, sharp mind", "Leadership and courage", "Strong digestion"),
            imbalance = listOf(
                "Irritation, anger, impatience", "Heartburn and loose stools", "Rashes and red skin",
                "Overheating, heavy sweating", "Criticism of self and others", "Insomnia from thinking about work",
            ),
            sections = listOf(
                TipSection("🥗", "Food", listOf(
                    "Eat cooling, refreshing food: cucumbers, greens, salads, sweet fruit, coconut",
                    "Sweet, bitter and astringent tastes suit you",
                    "Less spicy, sour, salty and fried food, coffee and alcohol",
                    "Don't skip lunch — make it your main meal",
                    "Drink cool (not iced) water and mint tea",
                )),
                TipSection("⏰", "Daily routine", listOf(
                    "Don't overwork, plan time for rest",
                    "Go to bed by 11 pm — later you get a \"second wind\" and sleep worse",
                    "Don't work or argue on an empty stomach",
                )),
                TipSection("🏊", "Movement", listOf(
                    "Moderate exercise without a competitive edge",
                    "Swimming, cycling, walks in nature, yoga",
                    "Exercise in the morning or evening, not in the heat",
                )),
                TipSection("💆", "Body care", listOf(
                    "Avoid overheating and scorching sun",
                    "Massage with coconut oil, cool showers",
                )),
                TipSection("💛", "Emotions", listOf(
                    "Learn to let go of control and delegate",
                    "Spend time in nature, near water",
                    "Play for fun, not to win",
                    "Notice the good: gratitude instead of criticism",
                )),
            ),
        ),
        Dosha.KAPHA to DoshaProfile(
            Dosha.KAPHA,
            about = "Kapha is the energy of earth and water. You are a calm, kind, reliable and strong person. " +
                "When Kapha is in balance — patience, strength, good immunity and love for people. " +
                "When it is out of balance — extra weight, sluggishness, sleepiness and resistance to change.",
            strengths = listOf("Calm and patience", "Stamina", "Loyalty and kindness", "Strong immunity and good memory"),
            imbalance = listOf(
                "Sluggishness, sleepiness", "Extra weight", "Runny nose, mucus, swelling",
                "Apathy and laziness", "Attachment to things and the past", "Slow digestion",
            ),
            sections = listOf(
                TipSection("🌶️", "Food", listOf(
                    "Eat light, warm and dry food: vegetables, beans, buckwheat, millet",
                    "Spicy, bitter and astringent tastes suit you",
                    "Add spices: ginger, black pepper, turmeric, cinnamon",
                    "Less sweet, fatty, starchy, dairy and cold food",
                    "Don't eat when you're not hungry, have a light, early dinner",
                    "Drink warm water and ginger tea",
                )),
                TipSection("⏰", "Daily routine", listOf(
                    "Get up early, before 6–7 am",
                    "Try not to nap during the day",
                    "Add variety: new places, activities, people",
                )),
                TipSection("🏃", "Movement", listOf(
                    "Daily active exercise is your best medicine",
                    "Running, dancing, cardio, cycling, brisk walking",
                    "Exercise until you break a light sweat",
                )),
                TipSection("💆", "Body care", listOf(
                    "Dry brushing or a massage mitt",
                    "Sauna, warm dry air",
                )),
                TipSection("💛", "Emotions", listOf(
                    "Set yourself small new goals",
                    "Declutter your home — it clears your head too",
                    "Socialise more, don't shut yourself away",
                )),
            ),
        ),
    )

    override val kids = mapOf(
        Dosha.VATA to DoshaProfile(
            Dosha.VATA,
            about = "Vata is a little breeze 🌬️. You are light, quick and cheerful, with lots of fantasies and ideas! " +
                "But sometimes the breeze blows too hard — then it's hard to fall asleep, you feel scared, your tummy hurts or your hands get cold.",
            strengths = listOf("Imagination", "Curiosity", "Quickness", "Creativity"),
            imbalance = listOf(
                "Hard to fall asleep", "Fears and worries", "Tummy aches or bloating",
                "Cold hands and feet", "Crankiness and tiredness",
            ),
            sections = listOf(
                TipSection("🍲", "Food", listOf(
                    "Eat warm food: soup, porridge with butter, cooked vegetables",
                    "Eat at the same times and don't skip breakfast",
                    "Fewer crisps, crackers and cold drinks",
                    "Before bed — warm milk with a pinch of cinnamon (if you're not allergic)",
                )),
                TipSection("⏰", "Routine", listOf(
                    "Get up and go to bed at the same time every day",
                    "No cartoons or tablet for an hour before bed",
                    "Not too many clubs — leave time to rest",
                )),
                TipSection("🤸", "Play and movement", listOf(
                    "Dancing, swimming, walks, kids' yoga",
                    "Dress warmly and wear a hat when it's windy",
                )),
                TipSection("💛", "Mood", listOf(
                    "Hugs and a warm foot massage before bed",
                    "A bedtime story and a soft night light",
                    "If you're scared — tell mum or dad",
                )),
            ),
        ),
        Dosha.PITTA to DoshaProfile(
            Dosha.PITTA,
            about = "Pitta is a little flame 🔥. You are brave, clever and love to win! You understand things quickly and love being first. " +
                "But when there's too much flame — you get angry, feel hot and may get a rash.",
            strengths = listOf("Courage", "Cleverness", "Leadership", "Persistence"),
            imbalance = listOf(
                "Anger and stubbornness", "Often feeling hot", "Rashes and redness",
                "\"Hungry means grumpy\"", "Upset tummy",
            ),
            sections = listOf(
                TipSection("🥒", "Food", listOf(
                    "Don't skip meals — a hungry flame gets angry",
                    "More cucumbers, apples, pears, watermelon and greens",
                    "Less spicy, sour, fried food and fizzy drinks",
                    "Drink cool, but not iced, water",
                )),
                TipSection("⏰", "Routine", listOf(
                    "Take breaks and rest, don't overdo it",
                    "Go to bed not too late",
                )),
                TipSection("🚴", "Play and movement", listOf(
                    "Swimming, cycling, walks in nature",
                    "Games where you can not only win but also help others",
                    "Don't run around in the heat, wear a sun hat",
                )),
                TipSection("💛", "Mood", listOf(
                    "Angry? Take 5 deep breaths and count to 10",
                    "Losing is okay — that's how all champions learn",
                    "Drawing and music help you cool down",
                )),
            ),
        ),
        Dosha.KAPHA to DoshaProfile(
            Dosha.KAPHA,
            about = "Kapha is earth and water 🌿. You are calm, kind, strong and a very reliable friend. " +
                "You can do your favourite things for a long time. But sometimes there's too much earth — " +
                "then you don't feel like moving, want to sleep and eat sweets, and often get a runny nose.",
            strengths = listOf("Kindness", "Calmness", "Stamina", "Loyalty to friends"),
            imbalance = listOf(
                "Sluggish, hard to wake up", "Wanting lots of sweets", "Runny nose and cough",
                "Not wanting to move", "Sadness and boredom",
            ),
            sections = listOf(
                TipSection("🍎", "Food", listOf(
                    "More vegetables and fruit, warm and light food",
                    "Fewer sweets, buns, cold milk and ice cream",
                    "Don't eat if you're not hungry",
                    "A light dinner",
                )),
                TipSection("⏰", "Routine", listOf(
                    "Get up early and don't lie in bed for long",
                    "Try something new: new games, clubs, places",
                )),
                TipSection("⚽", "Play and movement", listOf(
                    "Active games every day: tag, football, trampoline, dancing",
                    "The more fun and faster, the better",
                    "Spend lots of time outdoors",
                )),
                TipSection("💛", "Mood", listOf(
                    "Make new friends",
                    "Sort your toys and give the ones you don't need to other kids",
                    "Put on cheerful music",
                )),
            ),
        ),
    )
}
