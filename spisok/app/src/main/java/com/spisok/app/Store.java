package com.spisok.app;

import android.content.Context;
import android.util.Log;

import org.json.JSONArray;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/** Хранит все пункты в файле items.json во внутренней памяти приложения. */
public class Store {
    private final File file;
    private final List<Entry> items = new ArrayList<>();
    private long nextId = 1;

    public Store(Context context) {
        file = new File(context.getFilesDir(), "items.json");
        load();
    }

    private void load() {
        if (!file.exists()) return;
        try {
            String json = new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
            JSONArray arr = new JSONArray(json);
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
            JSONArray arr = new JSONArray();
            for (Entry e : items) arr.put(e.toJson());
            File tmp = new File(file.getPath() + ".tmp");
            Files.write(tmp.toPath(), arr.toString().getBytes(StandardCharsets.UTF_8));
            if (!tmp.renameTo(file)) {
                Files.write(file.toPath(), arr.toString().getBytes(StandardCharsets.UTF_8));
            }
        } catch (Exception ex) {
            Log.e("Store", "save failed", ex);
        }
    }

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
