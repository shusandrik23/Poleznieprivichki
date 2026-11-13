// Советы по привычкам (YouBoost Plus). Ключ — код привычки из js/catalog.js.
// Для своих привычек — общие советы (GENERIC). Каждый день показывается следующий совет.
import { lang } from './i18n.js';

const TIPS = {
  water: [
    { ru: 'Держите бутылку воды на виду — на столе или в сумке. Что видно, то и пьётся.', en: 'Keep a water bottle in sight — on your desk or in your bag. What you see is what you drink.' },
    { ru: 'Привяжите воду к делам, которые и так есть: стакан после пробуждения, перед каждой едой и после чистки зубов.', en: 'Tie water to things you already do: a glass after waking up, before every meal and after brushing your teeth.' },
    { ru: 'Скучно пить просто воду? Добавьте лимон, мяту или ягоды.', en: 'Bored of plain water? Add lemon, mint or berries.' },
  ],
  morning_exercise: [
    { ru: 'Положите вечером спортивную одежду рядом с кроватью — утром не придётся решать.', en: 'Lay out your workout clothes next to the bed in the evening — no decisions needed in the morning.' },
    { ru: 'Нет сил на 10 минут? Сделайте 2. Главное — не прерывать серию: привычка важнее объёма.', en: 'No energy for 10 minutes? Do 2. What matters is not breaking the streak: the habit beats the volume.' },
    { ru: 'Включите одну и ту же бодрую песню — со временем она сама будет запускать зарядку.', en: 'Play the same upbeat song every time — soon it will start the workout for you.' },
  ],
  steps: [
    { ru: 'Разговаривайте по телефону стоя и на ходу — так незаметно набирается тысяча шагов.', en: 'Take phone calls standing and walking — a thousand steps add up without noticing.' },
    { ru: 'Выходите на одну остановку раньше или паркуйтесь подальше от входа.', en: 'Get off one stop early or park farther from the entrance.' },
    { ru: 'Короткая прогулка после еды — самое лёгкое время добрать шаги.', en: 'A short walk after a meal is the easiest time to get extra steps.' },
  ],
  sleep: [
    { ru: 'Поставьте будильник не только на подъём, но и «пора готовиться ко сну» за 30 минут до отбоя.', en: 'Set an alarm not only for waking up, but also a "time to wind down" alarm 30 minutes before bed.' },
    { ru: 'Ложитесь и вставайте в одно и то же время, даже в выходные, — так засыпать становится легче.', en: 'Go to bed and get up at the same time, even on weekends — falling asleep gets easier.' },
    { ru: 'Прохладная, тёмная и тихая спальня помогает уснуть быстрее.', en: 'A cool, dark and quiet bedroom helps you fall asleep faster.' },
  ],
  veggies: [
    { ru: 'Мойте и нарезайте овощи заранее — готовая морковка в холодильнике съедается сама.', en: 'Wash and cut vegetables in advance — ready carrot sticks in the fridge get eaten.' },
    { ru: 'Поставьте вазу с фруктами на самое видное место на кухне.', en: 'Put a fruit bowl in the most visible spot in the kitchen.' },
    { ru: 'Добавляйте горсть овощей в то, что уже едите: омлет, пасту, суп.', en: 'Add a handful of vegetables to what you already eat: omelets, pasta, soup.' },
  ],
  stretch: [
    { ru: 'Растягивайтесь сразу после пробуждения или после душа, пока мышцы тёплые.', en: 'Stretch right after waking up or after a shower, while your muscles are warm.' },
    { ru: 'Дышите медленно и не тяните до боли — мягкое ежедневное растягивание полезнее резкого.', en: 'Breathe slowly and never stretch to the point of pain — gentle daily stretching beats forcing it.' },
    { ru: 'Найдите короткое видео на 5 минут и повторяйте его — не нужно каждый раз придумывать.', en: 'Find a short 5-minute video and repeat it — no need to plan each time.' },
  ],
  cold_shower: [
    { ru: 'Начинайте с 10–15 секунд прохладной воды в конце душа и добавляйте понемногу.', en: 'Start with 10–15 seconds of cool water at the end of your shower and add a little at a time.' },
    { ru: 'Медленно выдыхайте, когда включаете холодную воду, — так легче выдержать.', en: 'Breathe out slowly when you switch to cold — it makes it easier to bear.' },
    { ru: 'Если есть проблемы с сердцем или давлением, сначала посоветуйтесь с врачом.', en: 'If you have heart or blood pressure problems, check with a doctor first.' },
  ],
  pushups: [
    { ru: 'Привяжите отжимания к событию: например, сразу после того как выключили будильник.', en: 'Tie push-ups to an event, like right after you turn off your alarm.' },
    { ru: 'Тяжело с пола? Отжимайтесь от стола или стены — это тоже засчитывается.', en: 'Too hard from the floor? Do them against a table or wall — it still counts.' },
    { ru: 'Держите корпус прямым, как доску: лучше 5 правильных, чем 15 кое-как.', en: 'Keep your body straight like a plank: 5 good ones beat 15 sloppy ones.' },
  ],
  squats: [
    { ru: 'Приседайте, пока закипает чайник, — 20 приседаний как раз успеваются.', en: 'Squat while the kettle boils — 20 squats fit right in.' },
    { ru: 'Пятки на полу, колени смотрят туда же, куда носки, спина ровная.', en: 'Heels on the floor, knees in line with your toes, back straight.' },
    { ru: 'Разбейте на 2 подхода по 10 — утром и вечером.', en: 'Split it into 2 sets of 10 — morning and evening.' },
  ],
  plank: [
    { ru: 'Не получается минута сразу? Сделайте 3 раза по 20 секунд.', en: 'Can\'t do a full minute yet? Do 3 × 20 seconds.' },
    { ru: 'Таз не поднимайте и не роняйте — тело одной линией от головы до пяток.', en: 'Don\'t lift or drop your hips — one straight line from head to heels.' },
    { ru: 'Включите любимую песню и стойте до припева — так время идёт быстрее.', en: 'Play a favorite song and hold until the chorus — time flies faster.' },
  ],
  stairs: [
    { ru: 'Начните с одного-двух этажей пешком, а дальше на лифте, — и постепенно добавляйте.', en: 'Start by walking one or two floors and taking the elevator the rest — then add more.' },
    { ru: 'Спускаться по лестнице тоже полезно и намного легче, чем подниматься.', en: 'Walking down counts too and is much easier than going up.' },
    { ru: 'Сделайте правило: «до 3 этажа — только пешком».', en: 'Make a rule: "up to the 3rd floor — always on foot".' },
  ],
  read: [
    { ru: 'Чтение — поддержка для психики: исследования показывают, что даже несколько минут с книгой снижают стресс, а библиотерапия помогает при лёгкой депрессии. Это не замена лечению, но хорошая опора.', en: 'Reading supports mental health: studies show that even a few minutes with a book lowers stress, and bibliotherapy helps with mild depression. It\'s not a substitute for treatment, but a good support.' },
    { ru: 'Держите книгу там, где обычно берёте телефон: на тумбочке, в сумке, на диване.', en: 'Keep a book where you usually reach for your phone: by the bed, in your bag, on the couch.' },
    { ru: 'Скучная книга — не обязанность. Бросайте её и берите ту, от которой не оторваться.', en: 'A boring book is not an obligation. Drop it and pick one you can\'t put down.' },
    { ru: 'Аудиокниги тоже считаются — слушайте в дороге или на прогулке.', en: 'Audiobooks count too — listen on the go or on a walk.' },
  ],
  language: [
    { ru: 'Учите слова из своей жизни: то, что вы сегодня делали, ели и обсуждали.', en: 'Learn words from your own life: what you did, ate and talked about today.' },
    { ru: 'Переключите телефон или любимую игру на изучаемый язык.', en: 'Switch your phone or a favorite game to the language you\'re learning.' },
    { ru: 'Повторяйте вслух — даже 5 минут разговора с собой дают больше, чем час чтения правил.', en: 'Repeat out loud — even 5 minutes of talking to yourself beats an hour of reading rules.' },
  ],
  podcast: [
    { ru: 'Слушайте в «пустое» время: в дороге, за уборкой, на прогулке.', en: 'Listen during "empty" time: commuting, cleaning, walking.' },
    { ru: 'Запишите одну мысль из выпуска — так запоминается намного лучше.', en: 'Write down one idea from the episode — you\'ll remember far more.' },
    { ru: 'Скорость 1.25× экономит время, а понимание почти не страдает.', en: '1.25× speed saves time with almost no loss in understanding.' },
  ],
  journal: [
    { ru: 'Не нужно писать много: три предложения о дне — уже запись.', en: 'You don\'t need to write much: three sentences about your day is an entry.' },
    { ru: 'Если не знаете, о чём писать, ответьте на вопрос: «Что сегодня было самым важным?»', en: 'Not sure what to write? Answer: "What was the most important thing today?"' },
    { ru: 'Держите дневник и ручку у кровати — и пишите перед сном.', en: 'Keep the journal and a pen by your bed and write before sleep.' },
  ],
  puzzle: [
    { ru: 'Чередуйте разные головоломки: судоку, кроссворды, логические задачи.', en: 'Mix different puzzles: sudoku, crosswords, logic problems.' },
    { ru: 'Постепенно повышайте сложность — польза там, где немного трудно.', en: 'Gradually raise the difficulty — the benefit is where it\'s a bit hard.' },
    { ru: 'Головоломка вместо ленты соцсетей в очереди — отличная замена.', en: 'A puzzle instead of the social feed while waiting in line is a great swap.' },
  ],
  meditate: [
    { ru: 'Отвлеклись — это нормально. Медитация как раз и есть возвращение внимания к дыханию.', en: 'Getting distracted is normal. Meditation is exactly the act of returning attention to your breath.' },
    { ru: 'Начните с 2–3 минут, если 10 пока кажутся вечностью.', en: 'Start with 2–3 minutes if 10 feels like forever for now.' },
    { ru: 'Одно место и одно время каждый день помогают мозгу настроиться быстрее.', en: 'The same place and time each day helps your mind settle faster.' },
  ],
  gratitude: [
    { ru: 'Пишите конкретно: не «семья», а «сын сегодня сам приготовил завтрак».', en: 'Be specific: not "family", but "my son made breakfast by himself today".' },
    { ru: 'Маленькие вещи тоже считаются: вкусный кофе, солнце, хорошая песня.', en: 'Small things count too: good coffee, sunshine, a great song.' },
    { ru: 'Расскажите близкому, за что вы ему благодарны, — это вдвойне приятно.', en: 'Tell someone close what you\'re grateful to them for — it feels twice as good.' },
  ],
  walk_outside: [
    { ru: 'Гуляйте в обеденный перерыв — дневной свет ещё и помогает лучше спать.', en: 'Walk on your lunch break — daylight also helps you sleep better.' },
    { ru: 'Позовите кого-то с собой — вдвоём прогулки случаются чаще.', en: 'Invite someone along — walks happen more often in pairs.' },
    { ru: 'Плохая погода? Даже 10 минут вокруг дома засчитываются.', en: 'Bad weather? Even 10 minutes around the block counts.' },
  ],
  no_phone_bed: [
    { ru: 'Заряжайте телефон не у кровати, а в другой комнате.', en: 'Charge your phone in another room, not by the bed.' },
    { ru: 'Купите обычный будильник — тогда телефон в спальне не нужен.', en: 'Get a regular alarm clock — then you don\'t need your phone in the bedroom.' },
    { ru: 'Заранее решите, чем займёте этот час: книга, душ, разговор, растяжка.', en: 'Decide in advance what you\'ll do in that hour: a book, a shower, a talk, stretching.' },
  ],
  plan_day: [
    { ru: 'Выберите 1–3 главных дела дня, а не список из двадцати.', en: 'Pick 1–3 key tasks for the day, not a list of twenty.' },
    { ru: 'Планируйте вечером на завтра — утро начнётся без раскачки.', en: 'Plan tomorrow in the evening — the morning starts without warming up.' },
    { ru: 'Самое трудное дело ставьте на время, когда у вас больше всего сил.', en: 'Put the hardest task at the time when you have the most energy.' },
  ],
  tidy_desk: [
    { ru: 'Правило двух минут: убирайте стол в конце дня — завтра начнёте с чистого листа.', en: 'The two-minute rule: clear your desk at the end of the day — start tomorrow fresh.' },
    { ru: 'У каждой вещи — своё место. Без места вещь и копится на столе.', en: 'Give everything a home. Things without one pile up on the desk.' },
    { ru: 'Оставьте на столе только то, чем пользуетесь каждый день.', en: 'Keep only what you use every day on the desk.' },
  ],
  wake_early: [
    { ru: 'Откройте YouBoost сразу после пробуждения — до 8:00 привычка отметится сама.', en: 'Open YouBoost right after waking up — before 8 am the habit checks itself off.' },
    { ru: 'Ранний подъём начинается вечером: ложитесь на 15 минут раньше каждые несколько дней.', en: 'Waking early starts the night before: go to bed 15 minutes earlier every few days.' },
    { ru: 'Придумайте приятную причину вставать: вкусный завтрак, тихий кофе, любимый сериал за зарядкой.', en: 'Give yourself a pleasant reason to get up: a tasty breakfast, quiet coffee, a favorite show during your workout.' },
  ],
  no_snooze: [
    { ru: 'Поставьте будильник на другом конце комнаты — придётся встать, чтобы его выключить.', en: 'Put the alarm across the room — you\'ll have to get up to turn it off.' },
    { ru: 'Сразу откройте шторы или включите свет — свет помогает проснуться.', en: 'Open the curtains or turn on the light right away — light helps you wake up.' },
    { ru: 'Подъём легче, когда хватает сна: попробуйте ложиться на 20 минут раньше.', en: 'Getting up is easier with enough sleep: try going to bed 20 minutes earlier.' },
  ],
  track_spending: [
    { ru: 'Записывайте траты сразу, пока стоите у кассы, — вечером половина забудется.', en: 'Log spending right at the checkout — by evening you\'ll forget half of it.' },
    { ru: 'Раз в неделю смотрите, на что ушло больше всего, — это и есть главный вывод.', en: 'Once a week, look at where the most went — that\'s the key insight.' },
    { ru: 'Используйте простые категории: еда, дом, транспорт, удовольствия, прочее.', en: 'Use simple categories: food, home, transport, fun, other.' },
  ],
  save_money: [
    { ru: 'Откладывайте сразу в день зарплаты, а не то, что останется в конце месяца.', en: 'Save on payday, not whatever is left at the end of the month.' },
    { ru: 'Настройте автоматический перевод на отдельный счёт — без усилий воли.', en: 'Set up an automatic transfer to a separate account — no willpower needed.' },
    { ru: 'Дайте накоплениям цель и название: «отпуск», «подушка» — так тратить жалко.', en: 'Give your savings a name and a goal: "vacation", "safety cushion" — it\'s harder to spend.' },
  ],
  no_smoking: [
    { ru: 'Тяга обычно проходит за несколько минут: выпейте воды, пройдитесь, подышите глубоко.', en: 'A craving usually passes in a few minutes: drink water, walk, breathe deeply.' },
    { ru: 'Заметьте, когда тянет курить (кофе, стресс, перерыв), и придумайте замену заранее.', en: 'Notice your triggers (coffee, stress, breaks) and plan a replacement in advance.' },
    { ru: 'Поговорите с врачом о средствах, которые помогают бросить, — так получается чаще.', en: 'Talk to a doctor about quit aids — people succeed more often with them.' },
  ],
  no_sugar: [
    { ru: 'Не держите сладкое дома — в магазин за ним идти лень.', en: 'Don\'t keep sweets at home — going to the store for them is a hassle.' },
    { ru: 'Хочется сладкого? Съешьте фрукт или орехи и подождите 10 минут.', en: 'Craving sugar? Have fruit or nuts and wait 10 minutes.' },
    { ru: 'Проверяйте состав: сахар прячется в соусах, йогуртах и «полезных» батончиках.', en: 'Check labels: sugar hides in sauces, yogurts and "healthy" bars.' },
  ],
  no_alcohol: [
    { ru: 'Заранее выберите, что будете пить вместо: газированная вода с лимоном, безалкогольное пиво, морс.', en: 'Pick your alternative in advance: sparkling water with lemon, alcohol-free beer, juice.' },
    { ru: 'Достаточно сказать «я сегодня не пью» — объяснять ничего не нужно.', en: '"I\'m not drinking today" is enough — no explanation needed.' },
    { ru: 'Посчитайте, сколько денег и утренних часов вы сэкономили за серию.', en: 'Count how much money and how many mornings you\'ve saved during your streak.' },
  ],
  less_social: [
    { ru: 'Уберите соцсети с главного экрана — лишний шаг снижает автоматические заходы.', en: 'Move social apps off your home screen — an extra step cuts automatic opening.' },
    { ru: 'Включите лимит времени в настройках телефона (Цифровое благополучие).', en: 'Turn on an app timer in your phone settings (Digital Wellbeing).' },
    { ru: 'Отключите уведомления от соцсетей — пусть они ждут вас, а не вы их.', en: 'Turn off social notifications — let them wait for you, not the other way around.' },
  ],
  call_family: [
    { ru: 'Привяжите звонок к ежедневному делу: дорога домой, прогулка с собакой.', en: 'Tie the call to a daily routine: the commute home, walking the dog.' },
    { ru: 'Даже 3 минуты «как ты?» считаются — долгий разговор не обязателен.', en: 'Even a 3-minute "how are you?" counts — a long talk isn\'t required.' },
    { ru: 'Голосовое сообщение — тоже вариант, когда созвониться не получается.', en: 'A voice message works too when you can\'t catch each other.' },
  ],
  compliment: [
    { ru: 'Хвалите конкретное: не «молодец», а «классно ты объяснил этот момент».', en: 'Praise something specific: not "well done", but "you explained that part really well".' },
    { ru: 'Комплимент поступку ценится больше, чем комплимент внешности.', en: 'A compliment on an action means more than one on looks.' },
    { ru: 'Напишите комплимент в сообщении, если вживую неловко.', en: 'Send it in a message if saying it in person feels awkward.' },
  ],
  help_someone: [
    { ru: 'Помощь не обязана быть большой: придержать дверь, подсказать дорогу, ответить на вопрос.', en: 'Help doesn\'t have to be big: hold a door, give directions, answer a question.' },
    { ru: 'Спросите близкого: «Чем я могу тебе сегодня помочь?»', en: 'Ask someone close: "How can I help you today?"' },
    { ru: 'Поделитесь тем, что знаете: совет коллеге — тоже помощь.', en: 'Share what you know: advice to a colleague is help too.' },
  ],
  compliment_close: [
    { ru: 'Близким мы реже всего говорим приятное — а им это особенно важно.', en: 'We say nice things to those closest to us the least — and it matters to them most.' },
    { ru: 'Отмечайте старания, а не только результат: «Вижу, как ты стараешься».', en: 'Notice effort, not only results: "I see how hard you\'re trying".' },
    { ru: 'Оставьте записку с тёплыми словами там, где её найдут.', en: 'Leave a note with kind words where they\'ll find it.' },
  ],
  no_yelling: [
    { ru: 'Чувствуете, что закипаете? Сделайте паузу: три медленных вдоха или выйдите на минуту.', en: 'Feel yourself boiling over? Pause: take three slow breaths or step out for a minute.' },
    { ru: 'Говорите тише, а не громче, — ребёнок прислушивается к спокойному голосу.', en: 'Speak quieter, not louder — children tune in to a calm voice.' },
    { ru: 'Сорвались — извинитесь. Это тоже урок для ребёнка, а серия начнётся снова.', en: 'If you slip, apologize. That\'s a lesson for your child too, and the streak starts again.' },
  ],
  dishes: [
    { ru: 'Одна тарелка моется за 30 секунд, гора — за полчаса. Мойте сразу.', en: 'One plate takes 30 seconds, a pile takes half an hour. Wash right away.' },
    { ru: 'Замачивайте сковородки сразу после готовки — потом отмоются за минуту.', en: 'Soak pans right after cooking — they\'ll clean in a minute later.' },
    { ru: 'Включите подкаст или музыку — мытьё посуды станет приятной паузой.', en: 'Play a podcast or music — dishes become a pleasant break.' },
  ],
  make_bed: [
    { ru: 'Заправляйте сразу, как встали, — это занимает меньше минуты.', en: 'Make it as soon as you get up — it takes less than a minute.' },
    { ru: 'Меньше подушек и покрывал — быстрее заправлять.', en: 'Fewer pillows and throws — faster to make.' },
    { ru: 'Заправленная кровать — первая маленькая победа дня.', en: 'A made bed is the first small win of the day.' },
  ],
  punctual: [
    { ru: 'Планируйте выход на 10 минут раньше — запас съедят пробки и лифты.', en: 'Plan to leave 10 minutes earlier — traffic and elevators will eat the buffer.' },
    { ru: 'Ставьте напоминание не на время встречи, а на время выхода.', en: 'Set the reminder for when to leave, not for the meeting time.' },
    { ru: 'Собирайте вещи вечером: ключи, сумка, одежда.', en: 'Get things ready the night before: keys, bag, clothes.' },
  ],
  beauty_photo: [
    { ru: 'Смотрите вверх и вниз: небо, деревья, узоры на асфальте, отражения в лужах.', en: 'Look up and down: the sky, trees, patterns on the pavement, reflections in puddles.' },
    { ru: 'Утренний и вечерний свет делают обычные вещи красивыми.', en: 'Morning and evening light make ordinary things beautiful.' },
    { ru: 'Соберите лучшие фото в альбом — через месяц будет приятно пролистать.', en: 'Collect the best photos in an album — it\'s lovely to scroll through after a month.' },
  ],
  no_judging: [
    { ru: 'Заметили, что осуждаете? Спросите себя: «А что могло с ним случиться?»', en: 'Caught yourself judging? Ask: "What might have happened to them?"' },
    { ru: 'Замените оценку описанием: не «он грубый», а «он ответил резко».', en: 'Replace judgment with description: not "he\'s rude", but "he answered sharply".' },
    { ru: 'Мягкость к другим начинается с мягкости к себе.', en: 'Kindness to others starts with kindness to yourself.' },
  ],
  breathing: [
    { ru: 'Попробуйте «квадрат»: вдох на 4 счёта, пауза 4, выдох 4, пауза 4.', en: 'Try box breathing: inhale for 4, hold 4, exhale 4, hold 4.' },
    { ru: 'Выдох длиннее вдоха успокаивает: вдох на 4, выдох на 6.', en: 'An exhale longer than the inhale calms you: inhale for 4, exhale for 6.' },
    { ru: 'Дышите в стрессовый момент — так упражнение превращается в инструмент.', en: 'Breathe during a stressful moment — that turns the exercise into a tool.' },
  ],
  mood_check: [
    { ru: 'Назовите чувство одним словом: «тревожно», «спокойно», «устал». Это уже помогает.', en: 'Name the feeling in one word: "anxious", "calm", "tired". That alone helps.' },
    { ru: 'Отмечайте, что повлияло на настроение, — через пару недель увидите закономерности.', en: 'Note what affected your mood — in a couple of weeks you\'ll see patterns.' },
    { ru: 'Плохое настроение — не провал, а информация.', en: 'A bad mood isn\'t a failure, it\'s information.' },
  ],
  no_news_morning: [
    { ru: 'Первые 30 минут утра — для себя: вода, зарядка, завтрак, планы.', en: 'The first 30 minutes of the morning are for you: water, exercise, breakfast, plans.' },
    { ru: 'Выделите для новостей одно время днём — так вы ничего не пропустите.', en: 'Set one time of day for news — you won\'t miss anything.' },
    { ru: 'Отключите push-уведомления новостных приложений.', en: 'Turn off push notifications from news apps.' },
  ],
  self_kindness: [
    { ru: 'Говорите с собой так, как сказали бы лучшему другу.', en: 'Talk to yourself the way you\'d talk to your best friend.' },
    { ru: 'Хвалите себя за маленькое: «Я сегодня всё-таки сделала зарядку».', en: 'Praise yourself for small things: "I did my workout today after all".' },
    { ru: 'Ошибка — это опыт, а не приговор.', en: 'A mistake is experience, not a verdict.' },
  ],
  daylight: [
    { ru: 'Лучше всего — утром: дневной свет помогает проснуться и вечером легче уснуть.', en: 'Morning is best: daylight helps you wake up and fall asleep easier at night.' },
    { ru: 'Даже в пасмурный день на улице света гораздо больше, чем в комнате.', en: 'Even on a cloudy day there\'s far more light outside than indoors.' },
    { ru: 'Пейте утренний кофе у окна или на балконе.', en: 'Have your morning coffee by the window or on the balcony.' },
  ],
  learn_new: [
    { ru: 'Расскажите кому-нибудь, что узнали, — так знание закрепляется.', en: 'Tell someone what you learned — it locks in the knowledge.' },
    { ru: 'Задайте себе вопрос «почему?» о привычной вещи и найдите ответ.', en: 'Ask "why?" about something familiar and look up the answer.' },
    { ru: 'Ведите список «хочу узнать» и берите из него тему на день.', en: 'Keep a "want to learn" list and pick a topic from it each day.' },
  ],
  online_course: [
    { ru: 'Одно и то же время для занятий каждый день — и не нужно себя уговаривать.', en: 'The same study time every day — no need to talk yourself into it.' },
    { ru: 'Делайте заметки своими словами, а не переписывайте слайды.', en: 'Take notes in your own words instead of copying slides.' },
    { ru: 'Сразу применяйте новое на практике — хотя бы на маленьком примере.', en: 'Apply what you learn right away — even on a tiny example.' },
  ],
  write_ideas: [
    { ru: 'Идеи не обязаны быть хорошими — количество со временем рождает качество.', en: 'Ideas don\'t have to be good — quantity breeds quality over time.' },
    { ru: 'Выберите тему на день: «как улучшить работу», «подарки», «выходные».', en: 'Pick a theme for the day: "improving work", "gift ideas", "weekend plans".' },
    { ru: 'Держите заметки в телефоне — идеи приходят в самых неожиданных местах.', en: 'Keep notes on your phone — ideas come in the most unexpected places.' },
  ],
  reflect: [
    { ru: 'Три вопроса: что получилось? что нет? что сделаю завтра иначе?', en: 'Three questions: what went well? what didn\'t? what will I do differently tomorrow?' },
    { ru: 'Хватит 5 минут перед сном — главное каждый день.', en: '5 minutes before bed is enough — what matters is every day.' },
    { ru: 'Отмечайте не только ошибки, но и маленькие победы.', en: 'Note not only mistakes but small wins too.' },
  ],
  deep_work: [
    { ru: 'Телефон — в другую комнату, уведомления — выключить, на час.', en: 'Phone in another room, notifications off, for one hour.' },
    { ru: 'Заранее решите, над чем именно будете работать, — иначе час уйдёт на выбор.', en: 'Decide in advance exactly what you\'ll work on — or the hour goes into choosing.' },
    { ru: 'Утром фокус обычно лучше, чем после обеда.', en: 'Focus is usually better in the morning than after lunch.' },
  ],
};

const GENERIC = [
  { ru: 'Привяжите привычку к тому, что вы уже делаете каждый день: «после утреннего кофе я…»', en: 'Tie the habit to something you already do daily: "after my morning coffee, I…"' },
  { ru: 'Сделайте первый шаг совсем маленьким — таким, что невозможно отказаться.', en: 'Make the first step tiny — so small you can\'t say no.' },
  { ru: 'Пропустили день — не страшно. Главное — не пропускать два дня подряд.', en: 'Missed a day? No big deal. Just never miss two days in a row.' },
  { ru: 'Сделайте привычку заметной: положите нужные вещи на видное место.', en: 'Make the habit obvious: put what you need where you\'ll see it.' },
  { ru: 'Расскажите о своей цели другу или бросьте ему вызов — вместе держаться легче.', en: 'Tell a friend about your goal or challenge them — it\'s easier together.' },
  { ru: 'Отмечайте привычку сразу после выполнения — галочка сама по себе приятная награда.', en: 'Check off the habit right after doing it — the checkmark itself is a nice reward.' },
  { ru: 'Выберите для привычки постоянное время и место — так она быстрее становится автоматической.', en: 'Give the habit a fixed time and place — it becomes automatic faster.' },
  { ru: 'Думайте о себе как о человеке, который это делает: не «я пытаюсь бегать», а «я бегун».', en: 'Think of yourself as someone who does this: not "I\'m trying to run" but "I\'m a runner".' },
];

// Совет для привычки с кодом id (или null — своя привычка) на день dayNum.
export function tipFor(id, dayNum) {
  const list = (id && TIPS[id]) || GENERIC;
  const tip = list[((dayNum % list.length) + list.length) % list.length];
  return tip[lang] || tip.en;
}

export const TIP_HABITS = Object.keys(TIPS);
