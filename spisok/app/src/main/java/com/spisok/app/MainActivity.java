package com.spisok.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.widget.EditText;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.IntentCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.color.DynamicColors;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.android.material.snackbar.Snackbar;
import com.google.android.material.tabs.TabLayout;
import com.google.android.material.textfield.TextInputLayout;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.List;

public class MainActivity extends AppCompatActivity implements EntryAdapter.Listener {

    private static final int[] TAB_NAMES = {R.string.tab_books, R.string.tab_podcasts, R.string.tab_todo};
    private static final int[] EMPTY_TEXTS = {R.string.empty_books, R.string.empty_podcasts, R.string.empty_todo};
    private static final int[] RADIO_IDS = {R.id.cat_books, R.id.cat_podcasts, R.id.cat_todo};

    private Store store;
    private EntryAdapter adapter;
    private TabLayout tabs;
    private RecyclerView list;
    private TextView empty;
    private FloatingActionButton fab;
    private int current = 0;

    private ActivityResultLauncher<String[]> openFile;
    private ActivityResultLauncher<String> saveFile;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        DynamicColors.applyToActivityIfAvailable(this);
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_main);

        View root = findViewById(R.id.root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        MaterialToolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);

        store = new Store(this);

        list = findViewById(R.id.list);
        empty = findViewById(R.id.empty);
        fab = findViewById(R.id.fab);
        tabs = findViewById(R.id.tabs);

        adapter = new EntryAdapter(this);
        list.setLayoutManager(new LinearLayoutManager(this));
        list.setAdapter(adapter);

        if (savedInstanceState != null) current = savedInstanceState.getInt("tab", 0);
        for (int i = 0; i < TAB_NAMES.length; i++) tabs.addTab(tabs.newTab(), i == current);
        tabs.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
            @Override public void onTabSelected(TabLayout.Tab tab) {
                current = tab.getPosition();
                refresh();
            }
            @Override public void onTabUnselected(TabLayout.Tab tab) {}
            @Override public void onTabReselected(TabLayout.Tab tab) {}
        });

        fab.setOnClickListener(v -> showEntryDialog(null, "", "", ""));

        openFile = registerForActivityResult(new ActivityResultContracts.OpenDocument(), uri -> {
            if (uri != null) importFrom(uri);
        });
        saveFile = registerForActivityResult(new ActivityResultContracts.CreateDocument("text/plain"), uri -> {
            if (uri != null) exportTo(uri);
        });

        refresh();
        if (savedInstanceState == null) handleIntent(getIntent());
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        out.putInt("tab", current);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    // ---------- список ----------

    private void refresh() {
        List<Entry> items = store.byCategory(current);
        adapter.submit(items);
        empty.setText(EMPTY_TEXTS[current]);
        empty.setVisibility(items.isEmpty() ? View.VISIBLE : View.GONE);

        for (int i = 0; i < TAB_NAMES.length; i++) {
            TabLayout.Tab tab = tabs.getTabAt(i);
            if (tab == null) continue;
            int open = store.countOpen(i);
            String name = getString(TAB_NAMES[i]);
            tab.setText(open > 0 ? getString(R.string.tab_with_count, name, open) : name);
        }
    }

    private void selectTab(int category) {
        if (category == current) {
            refresh();
        } else {
            TabLayout.Tab tab = tabs.getTabAt(category);
            if (tab != null) tab.select(); // вызовет refresh()
        }
    }

    @Override
    public void onToggle(Entry e, boolean done) {
        e.done = done;
        store.save();
        list.post(this::refresh);
    }

    @Override
    public void onOpen(Entry e) {
        showEntryDialog(e, e.title, e.link, e.note);
    }

    @Override
    public void onLink(Entry e) {
        String url = e.link.trim();
        if (!url.matches("(?i)^[a-z][a-z0-9+.-]*:.*")) url = "https://" + url;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (ActivityNotFoundException ex) {
            Toast.makeText(this, R.string.no_browser, Toast.LENGTH_SHORT).show();
        }
    }

    // ---------- диалог добавления / изменения ----------

    private void showEntryDialog(Entry existing, String title, String link, String note) {
        View v = getLayoutInflater().inflate(R.layout.dialog_entry, null);
        TextInputLayout titleLayout = v.findViewById(R.id.title_layout);
        EditText inTitle = v.findViewById(R.id.input_title);
        EditText inLink = v.findViewById(R.id.input_link);
        EditText inNote = v.findViewById(R.id.input_note);
        RadioGroup group = v.findViewById(R.id.category);

        inTitle.setText(title);
        inLink.setText(link);
        inNote.setText(note);
        group.check(RADIO_IDS[existing != null ? existing.category : current]);

        MaterialAlertDialogBuilder builder = new MaterialAlertDialogBuilder(this)
                .setTitle(existing == null ? R.string.add : R.string.edit)
                .setView(v)
                .setPositiveButton(R.string.save, null)
                .setNegativeButton(R.string.cancel, null);
        if (existing != null) builder.setNeutralButton(R.string.delete, (d, w) -> delete(existing));

        AlertDialog dialog = builder.create();
        dialog.setOnShowListener(x -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(b -> {
            String t = inTitle.getText().toString().trim();
            String l = inLink.getText().toString().trim();
            String n = inNote.getText().toString().trim();
            if (t.isEmpty() && l.isEmpty()) {
                titleLayout.setError(getString(R.string.need_title));
                return;
            }
            if (t.isEmpty()) t = l;

            int cat = current;
            for (int i = 0; i < RADIO_IDS.length; i++) {
                if (RADIO_IDS[i] == group.getCheckedRadioButtonId()) cat = i;
            }

            Entry e = existing != null ? existing : new Entry();
            e.title = t;
            e.link = l;
            e.note = n;
            e.category = cat;
            if (existing == null) store.add(e); else store.save();

            dialog.dismiss();
            selectTab(cat);
        }));
        if (existing == null && title.isEmpty()) {
            inTitle.requestFocus();
            if (dialog.getWindow() != null) {
                dialog.getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE);
            }
        }
        dialog.show();
    }

    private void delete(Entry e) {
        int pos = store.remove(e);
        refresh();
        Snackbar.make(list, R.string.deleted, Snackbar.LENGTH_LONG)
                .setAnchorView(fab)
                .setAction(R.string.undo, v -> {
                    store.restore(e, pos);
                    refresh();
                })
                .show();
    }

    // ---------- меню ----------

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.main_menu, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        int id = item.getItemId();
        if (id == R.id.action_import) {
            openFile.launch(new String[]{"text/*", "application/octet-stream"});
            return true;
        } else if (id == R.id.action_export) {
            saveFile.launch("мой-список.txt");
            return true;
        } else if (id == R.id.action_clear_done) {
            clearDone();
            return true;
        } else if (id == R.id.action_help) {
            new MaterialAlertDialogBuilder(this)
                    .setTitle(R.string.menu_help)
                    .setMessage(R.string.help_text)
                    .setPositiveButton(R.string.ok, null)
                    .show();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private void clearDone() {
        List<Entry> removed = store.removeDone(current);
        refresh();
        if (removed.isEmpty()) {
            Toast.makeText(this, R.string.nothing_to_clear, Toast.LENGTH_SHORT).show();
            return;
        }
        Snackbar.make(list, getString(R.string.cleared, removed.size()), Snackbar.LENGTH_LONG)
                .setAnchorView(fab)
                .setAction(R.string.undo, v -> {
                    store.restoreAll(removed);
                    refresh();
                })
                .show();
    }

    // ---------- файлы ----------

    private void importFrom(Uri uri) {
        String text;
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) throw new IllegalStateException("no stream");
            text = decode(readAll(in));
        } catch (Exception ex) {
            Toast.makeText(this, R.string.import_error, Toast.LENGTH_LONG).show();
            return;
        }

        List<Entry> parsed = TextFormat.parse(text, current);
        if (parsed.isEmpty()) {
            Toast.makeText(this, R.string.import_nothing, Toast.LENGTH_LONG).show();
            return;
        }
        int added = 0, skipped = 0, lastCat = current;
        for (Entry e : parsed) {
            if (store.exists(e.category, e.title)) {
                skipped++;
            } else {
                store.add(e);
                added++;
                lastCat = e.category;
            }
        }
        // если всё добавилось в один другой список — переключимся на него
        boolean allSame = true;
        for (Entry e : parsed) if (e.category != parsed.get(0).category) allSame = false;
        selectTab(allSame ? lastCat : current);

        new MaterialAlertDialogBuilder(this)
                .setMessage(getString(R.string.import_result, added, skipped))
                .setPositiveButton(R.string.ok, null)
                .show();
    }

    private void exportTo(Uri uri) {
        String[] names = new String[TAB_NAMES.length];
        for (int i = 0; i < names.length; i++) names[i] = getString(TAB_NAMES[i]);
        String text = TextFormat.format(store.all(), names);
        try (OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
            if (out == null) throw new IllegalStateException("no stream");
            out.write(text.getBytes(StandardCharsets.UTF_8));
            Toast.makeText(this, R.string.export_done, Toast.LENGTH_SHORT).show();
        } catch (Exception ex) {
            Toast.makeText(this, R.string.export_error, Toast.LENGTH_LONG).show();
        }
    }

    private static byte[] readAll(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        int n;
        while ((n = in.read(chunk)) > 0) {
            buf.write(chunk, 0, n);
            if (buf.size() > 5_000_000) break; // защита от огромных файлов
        }
        return buf.toByteArray();
    }

    /** UTF-8, а если файл сохранён старым Блокнотом — Windows-1251. */
    private static String decode(byte[] bytes) {
        String s;
        try {
            s = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes))
                    .toString();
        } catch (CharacterCodingException ex) {
            s = new String(bytes, Charset.forName("windows-1251"));
        }
        if (s.startsWith("﻿")) s = s.substring(1);
        return s;
    }

    // ---------- «Поделиться» и «Открыть с помощью» ----------

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_VIEW.equals(action) && intent.getData() != null) {
            importFrom(intent.getData());
        } else if (Intent.ACTION_SEND.equals(action)) {
            Uri stream = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri.class);
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (stream != null && text == null) {
                importFrom(stream);
            } else if (text != null) {
                String url = TextFormat.findUrl(text);
                String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
                String title = subject != null ? subject.trim()
                        : text.replace(url, "").replaceAll("\\s+", " ").trim();
                showEntryDialog(null, title, url, "");
            }
        }
        setIntent(new Intent());
    }
}
