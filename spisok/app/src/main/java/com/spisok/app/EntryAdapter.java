package com.spisok.app;

import android.graphics.Paint;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

public class EntryAdapter extends RecyclerView.Adapter<EntryAdapter.Holder> {

    public interface Listener {
        void onToggle(Entry e, boolean done);
        void onOpen(Entry e);
        void onLink(Entry e);
    }

    private final Listener listener;
    private List<Entry> items = new ArrayList<>();

    public EntryAdapter(Listener listener) {
        this.listener = listener;
    }

    public void submit(List<Entry> list) {
        items = list;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public Holder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View v = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_entry, parent, false);
        return new Holder(v);
    }

    @Override
    public void onBindViewHolder(@NonNull Holder h, int position) {
        Entry e = items.get(position);

        h.check.setOnCheckedChangeListener(null);
        h.check.setChecked(e.done);
        h.check.setOnCheckedChangeListener((b, checked) -> listener.onToggle(e, checked));

        h.title.setText(e.title);
        int flags = h.title.getPaintFlags();
        h.title.setPaintFlags(e.done ? flags | Paint.STRIKE_THRU_TEXT_FLAG : flags & ~Paint.STRIKE_THRU_TEXT_FLAG);

        h.note.setText(e.note);
        h.note.setVisibility(e.note.isEmpty() ? View.GONE : View.VISIBLE);

        h.link.setText(e.link);
        h.link.setVisibility(e.link.isEmpty() ? View.GONE : View.VISIBLE);
        h.link.setOnClickListener(v -> listener.onLink(e));

        h.itemView.setAlpha(e.done ? 0.55f : 1f);
        h.itemView.setOnClickListener(v -> listener.onOpen(e));
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    static class Holder extends RecyclerView.ViewHolder {
        final CheckBox check;
        final TextView title, note, link;

        Holder(View v) {
            super(v);
            check = v.findViewById(R.id.check);
            title = v.findViewById(R.id.title);
            note = v.findViewById(R.id.note);
            link = v.findViewById(R.id.link);
        }
    }
}
