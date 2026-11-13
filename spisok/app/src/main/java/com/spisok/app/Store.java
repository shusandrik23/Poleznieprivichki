package com.spisok.app;

import android.content.Context;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;

/**
 * Хранит категории и пункты в файле items.json во внутренней памяти приложения.
 * Старый формат (просто массив пунктов) читается и превращается в новый.
 */
public class Store implements TextFormat.Resolver {
    public static final int MAX_NAME = 30;

    private final File file;
    private final List<Category> categories = new ArrayList<>();
    private final List<Entry> items = new ArrayList<>();
    private long nextId = 1;
    private int nextCatId = 0;

    /** @param defaultNames названия стандартных категорий с id 0, 1, 2 (книги, подкасты, дела) */
    public Store(Context context, String[] defaultNames) {
        file = new File(context.getFilesDir(), "items.json");
        load();
        if (categories.isEmpty()) {
            for (int i = 0; i < defaultNames.length; i++) categories.add(new Category(i, defaultNames[i]));
        }
        for (Category c : categories) nextCatId = Math.max(nextCatId, c.id + 1);
        // пункты из удалённых или неизвестных категорий не должны теряться
        for (Entry e : items) if (find(e.category) == null) e.category = categories.get(0).id;
    }

    private void load() {
        if (!file.exists()) return;
        try {
            String json = new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8).trim();
            JSONArray arr;
            if (json.startsWith("[")) {
                arr = new JSONArray(json); // версия 1.0
            } else {
                JSONObject root = new JSONObject(json);
                JSONArray cats = root.optJSONArray("categories");
                if (cats != null) {
                    for (int i = 0; i < cats.length(); i++) {
                        JSONObject c = cats.getJSONObject(i);
                        categories.add(new Category(c.getInt("id"), c.optString("name", "?")));
                    }
                }
                arr = root.optJSONArray("items");
                if (arr == null) arr = new JSONArray();
            }
            for (int i = 0; i < arr.length(); i++) {
                Entry e = Entry.fromJson(arr.getJSONObject(i));
                items.add(e);
                nextId = Math.max(nextId, e.id + 1);
            }
        } catch (Exception ex) {
            Log.e("Store", "load failed", ex);
        }
    }

    public void save() {
        try {
            JSONArray cats = new JSONArray();
            for (Category c : categories) cats.put(c.toJson());
            JSONArray arr = new JSONArray();
            for (Entry e : items) arr.put(e.toJson());
            JSONObject root = new JSONObject();
            root.put("version", 2);
            root.put("categories", cats);
            root.put("items", arr);
            byte[] bytes = root.toString().getBytes(StandardCharsets.UTF_8);
            File tmp = new File(file.getPath() + ".tmp");
            Files.write(tmp.toPath(), bytes);
            if (!tmp.renameTo(file)) Files.write(file.toPath(), bytes);
        } catch (Exception ex) {
            Log.e("Store", "save failed", ex);
        }
    }

    // ---------- категории ----------

    public List<Category> categories() {
        return new ArrayList<>(categories);
    }

    public Category find(int id) {
        for (Category c : categories) if (c.id == id) return c;
        return null;
    }

    public String name(int id) {
        Category c = find(id);
        return c == null ? "?" : c.name;
    }

    public int firstId() {
        return categories.get(0).id;
    }

    /** id стандартной категории, если её не удалили, иначе запасной вариант. */
    public int idOr(int id, int fallback) {
        return find(id) != null ? id : fallback;
    }

    public Category findByName(String name) {
        String n = norm(name);
        for (Category c : categories) if (norm(c.name).equals(n)) return c;
        return null;
    }

    public Category addCategory(String name) {
        Category c = new Category(nextCatId++, cleanName(name));
        categories.add(c);
        save();
        return c;
    }

    public void renameCategory(int id, String name) {
        Category c = find(id);
        if (c != null) {
            c.name = cleanName(name);
            save();
        }
    }

    /** Удаляет категорию вместе с её пунктами. Последнюю категорию удалить нельзя. */
    public boolean removeCategory(int id) {
        if (categories.size() <= 1) return false;
        Category c = find(id);
        if (c == null) return false;
        categories.remove(c);
        items.removeIf(e -> e.category == id);
        save();
        return true;
    }

    public void moveCategory(int id, int delta) {
        Category c = find(id);
        if (c == null) return;
        int from = categories.indexOf(c);
        int to = Math.max(0, Math.min(categories.size() - 1, from + delta));
        if (from == to) return;
        categories.remove(from);
        categories.add(to, c);
        save();
    }

    public int count(int category) {
        int n = 0;
        for (Entry e : items) if (e.category == category) n++;
        return n;
    }

    public static String cleanName(String name) {
        String s = name.replaceAll("\\s+", " ").replace("#", "").trim();
        return s.length() > MAX_NAME ? s.substring(0, MAX_NAME).trim() : s;
    }

    private static String norm(String s) {
        return s.toLowerCase(Locale.ROOT).replace('ё', 'е').trim();
    }

    /**
     * Ищет категорию по слову: «книга» → «Книги», «фильм» → «Фильмы», «дело» → «Дела».
     * Используется для заголовков в файле и для первого слова в сообщении боту.
     */
    public int matchCategory(String word) {
        String w = norm(word);
        if (w.isEmpty()) return -1;
        for (Category c : categories) if (norm(c.name).equals(w)) return c.id;
        if (w.length() >= 3 && !w.contains(" ")) {
            for (Category c : categories) {
                for (String part : norm(c.name).split("[\\s,.;:!?()-]+")) {
                    if (part.length() < 4) continue;
                    int p = 0;
                    while (p < w.length() && p < part.length() && w.charAt(p) == part.charAt(p)) p++;
                    if (p >= 3 && Math.abs(w.length() - part.length()) <= 1
                            && p >= Math.min(w.length(), part.length()) - 1) {
                        return c.id;
                    }
                }
            }
        }
        // привычные слова для стандартных категорий
        if (w.matches("прочитать|почитать|book|books|чтение")) return find(Entry.BOOKS) != null ? Entry.BOOKS : -1;
        if (w.matches("послушать|podcast|podcasts")) return find(Entry.PODCASTS) != null ? Entry.PODCASTS : -1;
        if (w.matches("задача|задачи|сделать|todo|to do|tasks?")) return find(Entry.TODO) != null ? Entry.TODO : -1;
        return -1;
    }

    @Override
    public int resolve(String header, boolean create) {
        String name = cleanName(header);
        if (name.isEmpty()) return -1;
        int id = matchCategory(name);
        if (id >= 0 || !create) return id;
        return addCategory(name).id;
    }

    // ---------- пункты ----------

    /** Пункты списка: сначала неотмеченные (в порядке добавления), потом отмеченные. */
    public List<Entry> byCategory(int category) {
        List<Entry> open = new ArrayList<>();
        List<Entry> done = new ArrayList<>();
        for (Entry e : items) {
            if (e.category != category) continue;
            (e.done ? done : open).add(e);
        }
        open.addAll(done);
        return open;
    }

    public List<Entry> all() {
        return new ArrayList<>(items);
    }

    public int countOpen(int category) {
        int n = 0;
        for (Entry e : items) if (e.category == category && !e.done) n++;
        return n;
    }

    public boolean exists(int category, String title) {
        for (Entry e : items) {
            if (e.category == category && e.title.equalsIgnoreCase(title.trim())) return true;
        }
        return false;
    }

    public void add(Entry e) {
        e.id = nextId++;
        if (e.created == 0) e.created = System.currentTimeMillis();
        if (find(e.category) == null) e.category = firstId();
        items.add(e);
        save();
    }

    /** Возвращает удалённый пункт на прежнее место (для «Вернуть»). */
    public void restore(Entry e, int position) {
        items.add(Math.max(0, Math.min(position, items.size())), e);
        save();
    }

    /** @return позиция удалённого пункта или -1 */
    public int remove(Entry e) {
        int pos = items.indexOf(e);
        if (pos >= 0) {
            items.remove(pos);
            save();
        }
        return pos;
    }

    public List<Entry> removeDone(int category) {
        List<Entry> removed = new ArrayList<>();
        for (Entry e : items) if (e.category == category && e.done) removed.add(e);
        items.removeAll(removed);
        save();
        return removed;
    }

    public void restoreAll(Collection<Entry> list) {
        items.addAll(list);
        save();
    }
}
