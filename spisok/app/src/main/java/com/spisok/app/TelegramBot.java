package com.spisok.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Свой Telegram-бот без сервера: приложение само забирает сообщения боту (getUpdates)
 * каждый раз, когда его открывают. Telegram хранит такие сообщения 24 часа.
 * Все сетевые методы вызываются НЕ из главного потока.
 */
public class TelegramBot {
    private static final String API = "https://api.telegram.org/";
    private static final int MAX_FILE = 1_000_000;

    private static final Pattern KEYWORD = Pattern.compile(
            "^(книга|книги|книгу|прочитать|почитать|book|подкаст|подкасты|послушать|podcast|"
                    + "дело|дела|задача|сделать|todo)(?:$|[\\s:.,—–-]+)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    /** Сообщения из одного чата, разобранные в пункты. */
    public static class Incoming {
        public long chatId;
        public List<Entry> entries = new ArrayList<>();
        public boolean help;
        public boolean justBound;
        public String error;
    }

    public static class Fetch {
        public final List<Incoming> items = new ArrayList<>();
        public long nextOffset;
    }

    private final SharedPreferences prefs;

    public TelegramBot(Context context) {
        prefs = context.getSharedPreferences("telegram_bot", Context.MODE_PRIVATE);
    }

    // ---------- настройки ----------

    public String token() { return prefs.getString("token", ""); }
    public boolean enabled() { return !token().isEmpty(); }
    public String botName() { return prefs.getString("bot_name", ""); }
    public long owner() { return prefs.getLong("owner", 0); }
    public String ownerName() { return prefs.getString("owner_name", ""); }
    public long offset() { return prefs.getLong("offset", 0); }

    public void connect(String token, String botName) {
        prefs.edit().clear().putString("token", token).putString("bot_name", botName).apply();
    }

    public void disconnect() {
        prefs.edit().clear().apply();
    }

    public void saveOffset(long offset) {
        if (offset > offset()) prefs.edit().putLong("offset", offset).apply();
    }

    // ---------- сеть ----------

    /** Проверяет токен. @return имя бота вида @my_list_bot */
    public static String getMe(String token) throws IOException, JSONException {
        JSONObject r = call(token, "getMe", new LinkedHashMap<>());
        return "@" + r.getJSONObject("result").optString("username");
    }

    public Fetch fetch(String[] categoryNames) throws IOException, JSONException {
        String token = token();
        Map<String, String> p = new LinkedHashMap<>();
        if (offset() > 0) p.put("offset", String.valueOf(offset()));
        p.put("timeout", "0");
        p.put("allowed_updates", "[\"message\"]");
        JSONArray updates = call(token, "getUpdates", p).getJSONArray("result");

        Fetch f = new Fetch();
        f.nextOffset = offset();
        Map<Long, Incoming> byChat = new LinkedHashMap<>();
        for (int i = 0; i < updates.length(); i++) {
            JSONObject u = updates.getJSONObject(i);
            f.nextOffset = Math.max(f.nextOffset, u.getLong("update_id") + 1);
            JSONObject msg = u.optJSONObject("message");
            if (msg == null) continue;
            JSONObject chat = msg.getJSONObject("chat");
            if (!"private".equals(chat.optString("type"))) continue;
            long chatId = chat.getLong("id");

            Incoming in = byChat.get(chatId);
            if (in == null) {
                in = new Incoming();
                in.chatId = chatId;
            }
            // Бот принимает пункты только от своего хозяина — первого, кто ему написал.
            if (owner() == 0) {
                String name = chat.optString("first_name", chat.optString("username", ""));
                prefs.edit().putLong("owner", chatId).putString("owner_name", name).commit();
                in.justBound = true;
            }
            if (chatId != owner()) continue;
            byChat.put(chatId, in);

            try {
                readMessage(token, msg, in, categoryNames);
            } catch (Exception ex) {
                in.error = "Не получилось прочитать сообщение: " + ex.getMessage();
            }
        }
        f.items.addAll(byChat.values());
        return f;
    }

    private void readMessage(String token, JSONObject msg, Incoming in, String[] names)
            throws IOException, JSONException {
        String text = msg.has("text") ? msg.optString("text") : msg.optString("caption", "");
        String hiddenUrl = hiddenUrl(msg);

        JSONObject doc = msg.optJSONObject("document");
        if (doc != null) {
            String fileName = doc.optString("file_name", "").toLowerCase(Locale.ROOT);
            String mime = doc.optString("mime_type", "");
            boolean textFile = mime.startsWith("text/") || fileName.endsWith(".txt")
                    || fileName.endsWith(".md") || fileName.endsWith(".csv");
            if (!textFile) {
                in.error = "Файлы принимаю только текстовые (.txt)";
            } else if (doc.optLong("file_size") > MAX_FILE) {
                in.error = "Файл слишком большой";
            } else {
                Map<String, String> p = new LinkedHashMap<>();
                p.put("file_id", doc.getString("file_id"));
                String path = call(token, "getFile", p).getJSONObject("result").getString("file_path");
                byte[] bytes = download(API + "file/bot" + token + "/" + path);
                in.entries.addAll(TextFormat.parse(TextFormat.decode(bytes), Entry.TODO));
            }
            return;
        }

        String trimmed = text.trim();
        if (trimmed.isEmpty()) return;
        if (trimmed.startsWith("/")) {
            String cmd = trimmed.split("[\\s@]", 2)[0].toLowerCase(Locale.ROOT);
            if (cmd.equals("/start") || cmd.equals("/help")) in.help = true;
            return;
        }

        boolean forwarded = msg.has("forward_origin") || msg.has("forward_date");
        if (forwarded) {
            Entry e = wholeMessage(trimmed, hiddenUrl);
            if (e != null) in.entries.add(e);
        } else {
            in.entries.addAll(parseText(trimmed, hiddenUrl, names));
        }
    }

    /** Обычное сообщение: каждая строка — пункт, слово в начале выбирает список. */
    static List<Entry> parseText(String text, String hiddenUrl, String[] names) {
        StringBuilder sb = new StringBuilder();
        int defaultCat = -1;
        for (String raw : text.split("\\r?\\n")) {
            String line = raw.trim();
            Matcher m = KEYWORD.matcher(line);
            if (m.find()) {
                int cat = keywordCategory(m.group(1));
                if (defaultCat < 0) defaultCat = cat;
                sb.append("# ").append(names[cat]).append('\n');
                line = line.substring(m.end()).trim();
            }
            sb.append(line).append('\n');
        }
        if (defaultCat < 0) {
            String url = TextFormat.findUrl(text);
            defaultCat = guessCategory(url.isEmpty() ? hiddenUrl : url);
        }
        List<Entry> list = TextFormat.parse(sb.toString(), defaultCat);
        if (list.size() == 1 && list.get(0).link.isEmpty() && !hiddenUrl.isEmpty()) {
            list.get(0).link = hiddenUrl;
        }
        return list;
    }

    /** Пересланный пост целиком — один пункт: первая строка — название, дальше — описание. */
    static Entry wholeMessage(String text, String hiddenUrl) {
        String url = TextFormat.findUrl(text);
        if (url.isEmpty()) url = hiddenUrl;
        String[] lines = text.split("\\r?\\n");
        String title = "";
        StringBuilder note = new StringBuilder();
        for (String l : lines) {
            String s = l.replace(url.isEmpty() ? "\u0000" : url, "").trim();
            if (s.isEmpty()) continue;
            if (title.isEmpty()) title = s;
            else if (note.length() < 200) note.append(note.length() > 0 ? " " : "").append(s);
        }
        if (title.isEmpty()) title = url;
        if (title.isEmpty()) return null;
        Entry e = new Entry();
        e.category = guessCategory(url);
        e.title = cut(title, 120);
        e.link = url;
        e.note = cut(note.toString(), 200);
        return e;
    }

    static int keywordCategory(String word) {
        String w = word.toLowerCase(Locale.ROOT);
        if (w.startsWith("книг") || w.contains("чита") || w.equals("book")) return Entry.BOOKS;
        if (w.startsWith("подкаст") || w.equals("послушать") || w.equals("podcast")) return Entry.PODCASTS;
        return Entry.TODO;
    }

    /** Без слова-подсказки: по ссылке пытаемся понять, подкаст это или книга. */
    static int guessCategory(String url) {
        String u = url.toLowerCase(Locale.ROOT);
        if (u.isEmpty()) return Entry.TODO;
        String[] podcasts = {"podcast", "castbox", "music.yandex", "spotify", "soundcloud",
                "anchor.fm", "pca.st", "overcast", "podster", "mave.digital", "zvuk.com"};
        for (String s : podcasts) if (u.contains(s)) return Entry.PODCASTS;
        String[] books = {"litres", "bookmate", "goodreads", "labirint", "ozon.ru/product/kniga",
                "chitai-gorod", "mybook", "flibusta", "books.yandex", "author.today"};
        for (String s : books) if (u.contains(s)) return Entry.BOOKS;
        return Entry.TODO;
    }

    private static String hiddenUrl(JSONObject msg) {
        JSONArray ents = msg.optJSONArray("entities");
        if (ents == null) ents = msg.optJSONArray("caption_entities");
        if (ents == null) return "";
        for (int i = 0; i < ents.length(); i++) {
            JSONObject e = ents.optJSONObject(i);
            if (e != null && "text_link".equals(e.optString("type"))) return e.optString("url", "");
        }
        return "";
    }

    private static String cut(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max - 1).trim() + "…";
    }

    public void reply(long chatId, String text) {
        try {
            Map<String, String> p = new LinkedHashMap<>();
            p.put("chat_id", String.valueOf(chatId));
            p.put("text", text);
            p.put("disable_web_page_preview", "true");
            call(token(), "sendMessage", p);
        } catch (Exception ignored) {
        }
    }

    /** Сообщает Telegram, что сообщения до offset уже забраны, чтобы он их не хранил. */
    public void confirm(long offset) {
        try {
            Map<String, String> p = new LinkedHashMap<>();
            p.put("offset", String.valueOf(offset));
            p.put("limit", "1");
            p.put("timeout", "0");
            call(token(), "getUpdates", p);
        } catch (Exception ignored) {
        }
    }

    private static JSONObject call(String token, String method, Map<String, String> params)
            throws IOException, JSONException {
        StringBuilder body = new StringBuilder();
        for (Map.Entry<String, String> e : params.entrySet()) {
            if (body.length() > 0) body.append('&');
            body.append(URLEncoder.encode(e.getKey(), "UTF-8")).append('=')
                    .append(URLEncoder.encode(e.getValue(), "UTF-8"));
        }
        HttpURLConnection c = (HttpURLConnection) new URL(API + "bot" + token + "/" + method).openConnection();
        try {
            c.setConnectTimeout(15000);
            c.setReadTimeout(20000);
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
            try (OutputStream out = c.getOutputStream()) {
                out.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            int code = c.getResponseCode();
            InputStream in = code < 400 ? c.getInputStream() : c.getErrorStream();
            String resp = in == null ? "{}" : new String(readAll(in, 5_000_000), StandardCharsets.UTF_8);
            JSONObject json;
            try {
                json = new JSONObject(resp);
            } catch (JSONException ex) {
                throw new IOException("HTTP " + code);
            }
            if (!json.optBoolean("ok")) {
                if (code == 401 || code == 404) throw new IOException("Неверный токен бота");
                if (code == 409) throw new IOException("У бота включён webhook — отключите его");
                throw new IOException(json.optString("description", "HTTP " + code));
            }
            return json;
        } finally {
            c.disconnect();
        }
    }

    private static byte[] download(String url) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setConnectTimeout(15000);
            c.setReadTimeout(20000);
            try (InputStream in = c.getInputStream()) {
                return readAll(in, MAX_FILE);
            }
        } finally {
            c.disconnect();
        }
    }

    static byte[] readAll(InputStream in, int limit) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        int n;
        while ((n = in.read(chunk)) > 0) {
            buf.write(chunk, 0, n);
            if (buf.size() > limit) break;
        }
        return buf.toByteArray();
    }
}
