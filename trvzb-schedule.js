class SonoffTRVZScheduleCard extends HTMLElement {

  setConfig(config) {
    if (!config.climate) throw new Error("climate required");
    if (!config.schedule_prefix) throw new Error("schedule_prefix required");

    this.config = config;
    this.days = [
      "monday","tuesday","wednesday",
      "thursday","friday","saturday","sunday"
    ];
    this.selectedDay = "monday";
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.card) this._init();
  }

  getCardSize() { return 9; }

  /* ---------- Init ---------- */

  _init() {
    this.schedule = {};
    this.days.forEach(d => this.schedule[d] = []);

    this.card = document.createElement("ha-card");
    this.card.header = "TRV Weekly Schedule";
    this.card.style.padding = "12px";

    this._load();
    this._render();
    this.appendChild(this.card);
    this._savePending = false;
  }

  _load() {
    this.days.forEach(day => {
      const ent = `${this.config.schedule_prefix}${day}`;
      const st = this._hass.states[ent];
      if (!st || !st.state) return;

      this.schedule[day] = this._parseString(st.state);
    });
  }

  /* ---------- Render ---------- */

  _render() {
    this.card.innerHTML = "";

    /* Day selector */
    const dayRow = document.createElement("div");
    dayRow.style.display = "flex";
    dayRow.style.gap = "4px";
    dayRow.style.marginBottom = "8px";

    this.days.forEach(d => {
      const b = document.createElement("button");
      b.textContent = d.slice(0,3).toUpperCase();
      b.style.flex = "1";
      if (d === this.selectedDay) {
        b.style.fontWeight = "bold";
        b.style.backgroundColor = "black";
      }
      b.onclick = () => {
        this.selectedDay = d;
        this._render();
      };
      dayRow.appendChild(b);
    });

    this.card.appendChild(dayRow);

    /* Text box (single, selected day) */
    const text = document.createElement("input");
    text.type = "text";
    text.style.width = "100%";
    text.style.marginBottom = "10px";
    text.value = this._format(this.selectedDay);

    text.onchange = () => {
      try {
        this.schedule[this.selectedDay] = this._parseString(text.value);
        this._render();
      } catch {
        alert("Invalid schedule format");
        text.value = this._format(this.selectedDay);
      }
    };

    this.card.appendChild(text);

    /* All timelines */
    this.days.forEach(day => {
      const row = document.createElement("div");
      row.style.marginBottom = "10px";

      const label = document.createElement("div");
      label.textContent = day.charAt(0).toUpperCase() + day.slice(1);
      label.style.fontSize = "0.85em";
      label.style.opacity = day === this.selectedDay ? "1" : "0.6";

      row.appendChild(label);
      row.appendChild(this._timeline(day));
      this.card.appendChild(row);
    });

    /* Controls */
    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.justifyContent = "space-between";
    controls.style.marginTop = "8px";

    const add = document.createElement("button");
    add.textContent = "Add transition";
    add.onclick = () => this._addDialog(this.selectedDay);
    controls.append(add);

    const save = document.createElement("div");
    save.textContent = "Save pending";
    if (this._savePending) controls.append(save);
    this.card.appendChild(controls);
  }

  /* ---------- Timeline ---------- */

  _timeline(day) {
    const bar = document.createElement("div");
    bar.style.display = "flex";
    bar.style.height = "26px";
    bar.style.border = "1px solid var(--divider-color)";
    bar.style.borderRadius = "4px";
    bar.style.overflow = "hidden";
    bar.style.opacity = "1";

    const entries = this._sorted(day);

    entries.forEach((e, i) => {
      const start = this._min(e.time);
      const end = i + 1 < entries.length
        ? this._min(entries[i+1].time)
        : 1440;

      const seg = document.createElement("div");
      seg.textContent = e.temp;
      seg.style.flex = end - start;
      seg.style.position = "relative";
      seg.style.background = this._color(e.temp);

        seg.onclick = ev => {
          ev.stopPropagation();
          this.selectedDay = day;
          const t = prompt("Temperature (4–35°C)", e.temp);
          if (t !== null) {
            e.temp = Math.min(35, Math.max(4, parseFloat(t)));
            this._render();
          }
        };

      if (i > 0) {
        const handle = document.createElement("div");
        handle.style.position = "absolute";
        handle.style.left = "0";
        handle.style.top = "0";
        handle.style.bottom = "0";
        handle.style.width = "10px";
        handle.style.cursor = "ew-resize";
        handle.style.background = "rgba(0,0,0,0.25)";
        handle.onpointerdown = ev =>
          this._drag(ev, bar, day, i);
        seg.appendChild(handle);

        const del = document.createElement("div");
        del.textContent = "✕";
        del.style.position = "absolute";
        del.style.right = "4px";
        del.style.top = "4px";
        del.style.cursor = "pointer";
        del.onclick = ev => {
          ev.stopPropagation();
          this.schedule[day].splice(i,1);
          this.selectedDay = day;
          this._save();
          this._render();
        };
        seg.appendChild(del);
      }

      bar.appendChild(seg);
    });

    return bar;
  }

  /* ---------- Drag ---------- */

  _drag(ev, bar, day, index) {
    this.selectedDay = day;
    ev.preventDefault();
    bar.setPointerCapture(ev.pointerId);

    const entries = this._sorted(day);
    const rect = bar.getBoundingClientRect();
    const startX = ev.clientX;
    const startMin = this._min(entries[index].time);
    const prevMin = this._min(entries[index-1].time);

    const move = e => {
      const dx = e.clientX - startX;
      const minutes = Math.round((dx / rect.width) * 1440 / 5) * 5;
      let m = startMin + minutes;
      m = Math.max(prevMin + 5, Math.min(m, 1435));
      entries[index].time = this._time(m);
      this.schedule[day] = entries;
      this._save();
      this._render();
    };

    const up = () => {
      bar.releasePointerCapture(ev.pointerId);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /* ---------- Add ---------- */

  _addDialog(day) {
    if (this.schedule[day].length >= 6)
      return alert("Max 6 transitions");

    const t = prompt("Time (HH:MM)");
    const temp = prompt("Temperature");

    if (!t || !temp) return;
    this.schedule[day].push({ time: t, temp: parseFloat(temp) });
    this.selectedDay = day;
    this._render();
  }

  /* ---------- Save ---------- */

  _save() {
    if (!this._savePending) {
      this._savePending = true;
      setTimeout(() => {
        this.days.forEach(day => {
          this._hass.callService("text", "set_value", {
            entity_id: `${this.config.schedule_prefix}${day}`,
            value: this._format(day)
          });
        });
        this._savePending = false;
        this._render();
      }, 500);
    }
  }

  /* ---------- Helpers ---------- */

  _sorted(day) {
    return [...this.schedule[day]]
      .sort((a,b)=>a.time.localeCompare(b.time));
  }

  _format(day) {
    const e = this._sorted(day);
    if (!e.length || e[0].time !== "00:00")
      throw new Error("First transition must be 00:00");

    return e.slice(0,6)
      .map(x => `${x.time}/${x.temp.toFixed(1).replace(".0","")}`)
      .join(" ");
  }

  _parseString(str) {
    const p = str.trim().split(" ").map(x => {
      const [t,temp] = x.split("/");
      return { time: t, temp: parseFloat(temp) };
    });
    if (!p.length || p[0].time !== "00:00") throw 1;
    return p.slice(0,6);
  }

  _min(t) {
    const [h,m] = t.split(":").map(Number);
    return h*60+m;
  }

  _time(m) {
    return `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
  }

  _color(t) {
    const r = Math.min(255, (t - 8) * 10);
    const b = Math.min(255, (30 - t) * 10);
    return `rgb(${r},90,${b})`;
  }
}

customElements.define("sonoff-trvz-schedule-card", SonoffTRVZScheduleCard);