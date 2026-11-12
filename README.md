# Полезные привычки — ежедневный трекер

Веб-приложение без сборки: HTML, CSS и JavaScript-модули. Работает на GitHub Pages:
https://shusandrik23.github.io/Poleznieprivichki/

## Что умеет

- **Привычки.** Свои или из готового списка по категориям. Каждый день отмечаете, что сделали; последние 7 дней можно исправить.
- **Серии.** Для каждой привычки — текущая серия и рекорд в днях. Текущая серия не сбрасывается, пока день не закончился.
- **Цели.** Сколько дней подряд выполнять привычку (7, 21, 30, 66, 100 или своё число), с полосой прогресса.
- **Аккаунт** (вход через Google, позже — Apple). Привычки синхронизируются между устройствами. Без входа всё работает и хранится только на устройстве.
- **Друзья.** Ник для поиска и имя по желанию. Заявки в друзья, и у каждого друга — сравнение серий по общим привычкам. В карточке привычки видно серии друзей по ней же.
- **Вызовы.** Бросьте другу вызов: кто дольше продержится с привычкой N дней подряд. Пропуск дня — выбываете.
- **Удаление аккаунта** прямо в приложении (обязательно для App Store).

Друзья видят только ник, имя и серии. Все отметки по дням видны только владельцу — это гарантируют правила в `firestore.rules`.

## Файлы

| Файл | Что внутри |
|---|---|
| `index.html` | Разметка и стили |
| `js/app.js` | Интерфейс: привычки, друзья, вызовы |
| `js/core.js` | Даты, подсчёт серий, сравнение привычек |
| `js/cloud.js` | Firebase: вход, синхронизация, друзья, вызовы |
| `firebase-config.js` | Настройки вашего Firebase-проекта |
| `firestore.rules` | Правила доступа к данным |

## Подключение сервера (Firebase)

Пока в `firebase-config.js` стоит `null`, вкладки «Друзья» и «Вызовы» показывают «скоро». Чтобы включить их:

1. Откройте https://console.firebase.google.com → **Create a project** (Google Analytics можно выключить).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable → Save.**
3. **Authentication → Settings → Authorized domains → Add domain:** `shusandrik23.github.io`.
4. **Build → Firestore Database → Create database.** Режим — *production*, регион — например `eur3 (Europe)`.
5. **Firestore Database → Rules:** замените текст содержимым файла `firestore.rules` → **Publish**.
6. **Project settings (шестерёнка) → General → Your apps → значок `</>` (Web)** → зарегистрируйте приложение → скопируйте объект `firebaseConfig`.
7. Вставьте его в `firebase-config.js` вместо `null`. Эти значения не секретные, их можно хранить в открытом репозитории.

### Вход через Apple

Нужен платный Apple Developer Program. В Apple Developer создаются Services ID и ключ Sign in with Apple, затем они вводятся в Firebase: **Authentication → Sign-in method → Apple**. После этого в `firebase-config.js` ставится `appleSignInEnabled = true`.

## Путь в App Store

1. Обернуть веб-приложение в нативное через [Capacitor](https://capacitorjs.com).
2. Для входа внутри iPhone-приложения — плагин `@capacitor-firebase/authentication` (всплывающие окна входа в нативной оболочке не работают).
3. Вход через Apple обязателен, если в приложении есть вход через Google (правило App Store 4.8).
4. Нужны: Mac с Xcode, Apple Developer Program, страница с политикой конфиденциальности.

## Проверка на эмуляторе Firebase

```bash
npx firebase-tools emulators:start --project demo-habits   # нужна Java
python3 -m http.server 8765
```

Откройте http://127.0.0.1:8765/?emulator — приложение подключится к локальному эмулятору с правилами из `firestore.rules`.
