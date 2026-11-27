import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { App } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { formatInvoicePLN, invoicePeriodTotals } from "../../frontend/src/lib/invoiceDashboard.mjs";

const root = document.querySelector("#app");
const logout = document.querySelector("#logout");
const origin = PRZEMAI_API_ORIGIN;
const idleLimit = 5 * 60 * 1000;
const native = Capacitor.isNativePlatform();
let token = null;
let scope = "";
let companies = [];
let view = "Pulpit";
let sequence = 0;
let idleTimer;
let backgroundAt;
let chat = newChat();
let redrawChat;
let notificationWork = Promise.resolve();
let invoiceYear = new Date().getFullYear();
let invoicePeriod = "year";

function newChat() {
  return { conversationId: null, turns: [], draft: "", pending: null, sending: false, error: "" };
}

function node(type, text, attrs = {}) {
  const element = document.createElement(type);
  if (text != null) element.textContent = text;
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}
const button = (text, action, attrs = {}) => {
  const element = node("button", text, { type: "button", ...attrs });
  element.addEventListener("click", action);
  return element;
};
function field(label, element) {
  const wrapper = node("label");
  wrapper.append(node("span", label), element);
  return wrapper;
}

async function api(path, { method = "GET", data, dataType, session = token } = {}) {
  if (!navigator.onLine) throw Error("Brak internetu. Spróbuj ponownie po połączeniu.");
  const url = new URL(path, origin);
  if (url.origin !== origin || !url.pathname.startsWith("/api/")) throw Error("Niedozwolony adres API.");
  const options = {
    url: url.href, method, data, dataType, responseType: "json", disableRedirects: true,
    connectTimeout: 10000, readTimeout: 25000,
    headers: {
      Accept: "application/json",
      ...(data && (native || dataType !== "formData") &&
        { "Content-Type": dataType === "formData" ? "multipart/form-data" : "application/json" }),
      ...(session && { Authorization: "Bearer " + session })
    }
  };
  const response = native ? await CapacitorHttp.request(options) : await fetch(url.href, {
    method, headers: options.headers,
    body: dataType === "formData" ? data : data ? JSON.stringify(data) : undefined,
    redirect: "error", credentials: "omit", cache: "no-store"
  }).then(async reply => ({ status: reply.status, url: reply.url, data: await reply.json().catch(() => null) }));
  if (response.url && new URL(response.url).origin !== origin) throw Error("Nieoczekiwane przekierowanie.");
  if (response.status === 401 && session && session === token) endSession("Sesja wygasła. Zaloguj się ponownie.");
  if (response.status >= 300 || response.status < 200 || response.data?.success === false)
    throw Error(response.data?.error || "Nie udało się wykonać operacji (" + response.status + ").");
  if (response.data === null || typeof response.data !== "object") throw Error("Nieprawidłowa odpowiedź API.");
  return response.data;
}

function whileScheduling(action) {
  const work = notificationWork.then(action);
  notificationWork = work.catch(() => {});
  return work;
}

async function multipart(file, fields = {}) {
  if (!native) {
    const data = new FormData();
    data.append("file", file);
    for (const [key, value] of Object.entries(fields)) data.append(key, value);
    return data;
  }
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(Error("Nie udało się odczytać pliku."));
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(file);
  });
  return [
    { key: "file", type: "base64File", value: base64,
      fileName: file.name.replace(/["\r\n\\/]/g, "_"), contentType: "application/octet-stream" },
    ...Object.entries(fields).map(([key, value]) => ({ key, type: "string", value }))
  ];
}

async function clearNotifications() {
  if (!native) return;
  const { notifications } = await LocalNotifications.getPending();
  if (notifications.length) await LocalNotifications.cancel({ notifications });
  await LocalNotifications.removeAllDeliveredNotifications();
}

function endSession(message = "") {
  token = null;
  scope = "";
  companies = [];
  chat = newChat();
  redrawChat = undefined;
  sequence++;
  clearTimeout(idleTimer);
  void whileScheduling(clearNotifications).catch(() => {});
  loginView(message);
}
logout.addEventListener("click", () => endSession("Wylogowano."));
function touch() {
  if (!token) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => endSession("Sesja zablokowana po okresie bezczynności."), idleLimit);
}
document.addEventListener("pointerdown", touch);
document.addEventListener("keydown", touch);
if (native) App.addListener("appStateChange", ({ isActive }) => {
  if (!isActive) backgroundAt = Date.now();
  else if (token && backgroundAt && Date.now() - backgroundAt >= idleLimit) endSession("Sesja zablokowana.");
  else touch();
}).catch(() => {});

function loginView(message = "") {
  logout.hidden = true;
  root.replaceChildren(node("h1", "Zaloguj się"));
  if (!origin) {
    root.append(node("p", "Ten build wymaga skonfigurowanego adresu HTTPS API."));
    return;
  }
  const form = node("form");
  const email = node("input", null, { type: "email", autocomplete: "username", required: "" });
  const password = node("input", null, { type: "password", autocomplete: "current-password", required: "" });
  const submit = node("button", "Zaloguj się", { type: "submit" });
  const feedback = node("p", message, { role: "status" });
  form.append(field("E-mail", email), field("Hasło", password), submit, feedback);
  root.append(form);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    submit.disabled = true;
    feedback.textContent = "Logowanie…";
    try {
      const result = await api("/api/auth/login", {
        method: "POST", session: null, data: { email: email.value, password: password.value }
      });
      password.value = "";
      if (typeof result.token !== "string" || !result.token) throw Error("API nie potwierdziło sesji.");
      const profile = await api("/api/organizations", { session: result.token });
      if (!Array.isArray(profile.data)) throw Error("API nie potwierdziło listy spółek.");
      companies = profile.data;
      token = result.token;
      view = "Pulpit";
      touch();
      render();
    } catch (error) { password.value = ""; feedback.textContent = error.message; }
    finally { submit.disabled = false; }
  });
}

function companyPath(path, id = scope) {
  return "/api/organizations/" + encodeURIComponent(id) + path;
}
function showError(target, error) {
  target.append(node("p", error.message, { role: "alert" }));
}
function showRows(target, rows, empty, renderRow) {
  if (!rows.length) target.append(node("p", empty));
  rows.forEach(row => target.append(renderRow(row)));
}
function card(title, text) {
  const box = node("article", null, { class: "card" });
  box.append(node("h2", title), node("p", text));
  return box;
}
function render() {
  const run = ++sequence;
  redrawChat = undefined;
  const active = () => token && run === sequence;
  logout.hidden = false;
  root.replaceChildren(node("h1", view));
  const options = node("select", null, { "aria-label": "Spółka" });
  options.append(node("option", "Wszystkie spółki", { value: "" }));
  companies.forEach(company => options.append(node("option", company.displayName || company.name, { value: company.id })));
  options.value = scope;
  options.addEventListener("change", () => {
    scope = options.value;
    chat = newChat();
    render();
  });
  const navigation = node("nav", null, { "aria-label": "Moduły" });
  for (const name of Object.keys(pages)) {
    navigation.append(button(name, () => {
      view = name;
      render();
    }, view === name ? { "aria-current": "page" } : {}));
  }
  const content = node("div");
  root.append(field("Spółka", options), navigation, content);
  Promise.resolve(pages[view](content, active)).catch(error => {
    if (active()) showError(content, error);
  });
}

function finance(target, active) {
  const year = node("select", null, { "aria-label": "Rok faktur" });
  for (let value = new Date().getFullYear(); value >= 2020; value--)
    year.append(node("option", value, { value }));
  year.value = invoiceYear;
  year.addEventListener("change", () => { invoiceYear = Number(year.value); render(); });
  const period = node("select", null, { "aria-label": "Okres faktur" });
  period.append(node("option", "Cały rok", { value: "year" }));
  for (let quarter = 1; quarter <= 4; quarter++)
    period.append(node("option", "Kwartał " + quarter, { value: "q" + quarter }));
  for (let month = 1; month <= 12; month++) {
    const label = new Intl.DateTimeFormat("pl", { month: "long", timeZone: "UTC" })
      .format(new Date(Date.UTC(2020, month - 1)));
    period.append(node("option", label, { value: "m" + month }));
  }
  period.value = invoicePeriod;
  const result = node("div", null, { class: "grid", "aria-live": "polite" });
  const status = node("p", "Pobieranie faktur…", { role: "status" });
  target.append(field("Rok faktur", year), field("Okres faktur", period), status, result);
  const organizationId = scope || null;
  return api("/api/organizations/invoice-dashboard/" + invoiceYear +
    (organizationId ? "?" + new URLSearchParams({ organizationId }) : "")).then(({ data }) => {
    if (!active()) return;
    if (data?.organizationId !== organizationId || data?.year !== invoiceYear || !Array.isArray(data.rows))
      throw Error("API nie potwierdziło zakresu faktur.");
    function show() {
      const totals = invoicePeriodTotals(data, invoicePeriod);
      status.textContent = !data.included ? "Brak dostępnych danych KSeF."
        : data.excluded ? "Uwzględnione spółki: " + data.included + " z " + (data.included + data.excluded) + "." : "";
      result.replaceChildren();
      for (const [key, title] of [["purchase", "Faktury zakupowe PLN"], ["sales", "Faktury sprzedażowe PLN"]]) {
        const box = node("article", null, { class: "card" });
        box.append(node("h2", title), node("p", formatInvoicePLN(totals?.[key].net) + " netto", { class: "amount" }),
          node("p", formatInvoicePLN(totals?.[key].gross) + " brutto", { class: "gross" }));
        result.append(box);
      }
    }
    period.addEventListener("change", () => { invoicePeriod = period.value; show(); });
    show();
  }).catch(error => { if (active()) status.textContent = error.message; });
}

async function remind(task, isCurrentScope) {
  const at = new Date(task.dueDate);
  if (!native || !Number.isFinite(at.getTime()) || at <= new Date())
    throw Error("Przypomnienie wymaga aplikacji natywnej i przyszłego terminu.");
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display === "prompt" || permission.display === "prompt-with-rationale")
    permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted") throw Error("Powiadomienia są wyłączone.");
  if (!isCurrentScope()) return;
  const id = (Array.from(task.id).reduce((hash, char) => Math.imul(31, hash) + char.codePointAt(0), 0) & 0x7fffffff) || 1;
  await LocalNotifications.schedule({ notifications: [{
    id, title: "PrzemAI", body: "Sprawdź termin zadania w aplikacji.",
    schedule: { at, allowWhileIdle: false }
  }] });
  if (!isCurrentScope()) await LocalNotifications.cancel({ notifications: [{ id }] });
}

const pages = {
  async Pulpit(target, active) {
    await finance(target, active);
    if (!scope || !active()) return;
    const { data } = await api(companyPath("/workspace"));
    if (!active()) return;
    target.append(node("h2", "Zadania spółki"));
    showRows(target, data.tasks.filter(task => task.status !== "DONE").slice(0, 8), "Brak otwartych zadań.", task => {
      const box = card(task.title, task.dueDate ? new Date(task.dueDate).toLocaleDateString("pl-PL") : "");
      if (native && task.dueDate && new Date(task.dueDate) > new Date()) {
        box.append(button("Ustaw przypomnienie", async event => {
          const trigger = event.currentTarget;
          const selectedChat = chat;
          trigger.disabled = true;
          try {
            await whileScheduling(() => remind(task, () => chat === selectedChat));
            if (active()) box.append(node("p", "Przypomnienie zapisane."));
          } catch (error) {
            if (active()) showError(box, error);
            trigger.disabled = false;
          }
        }));
      }
      return box;
    });
  },
  "General Agent"(target, active) {
    const current = chat;
    const organizationId = scope;
    const form = node("form");
    const input = node("textarea", null, { rows: "4", maxlength: "12000" });
    input.value = current.draft;
    const attachment = node("input", null, { type: "file", accept: ".pdf,.docx,.xlsx,.png,.jpg,.jpeg" });
    const submit = node("button", "Wyślij", { type: "submit" });
    const result = node("div", null, { "aria-live": "polite", "aria-label": "Historia rozmowy" });
    input.addEventListener("input", () => { current.draft = input.value; });
    form.append(field("Wiadomość do General Agenta", input), field("Załącznik do 4 MB", attachment), submit);
    if (!organizationId) target.append(node("p", "Rozmowa osobista. Wybierz spółkę, aby pracować w jej zakresie."));
    target.append(form, result);
    redrawChat = () => {
      if (!active()) return;
      submit.disabled = current.sending;
      input.disabled = current.sending;
      attachment.disabled = current.sending;
      input.value = current.draft;
      result.replaceChildren(...current.turns.map(turn => card(turn.message, turn.answer)));
      if (current.sending) result.append(node("p", "Oczekiwanie na odpowiedź…"));
      if (current.error) showError(result, Error(current.error));
    };
    redrawChat();
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const message = input.value.trim();
      const file = attachment.files?.[0];
      if ((!message && !file) || current.sending || !active()) return;
      if (file && (!file.size || file.size > 4 * 1024 * 1024)) {
        current.error = "Wybierz plik do 4 MB.";
        redrawChat();
        return;
      }
      const session = token;
      const isCurrent = () => chat === current;
      const fields = {
        ...(current.conversationId && { conversationId: current.conversationId }),
        ...(organizationId && { organizationId })
      };
      current.draft = input.value;
      current.error = "";
      current.sending = true;
      redrawChat();
      try {
        let response;
        if (file) {
          const data = await multipart(file, { ...fields, ...(message && { message }) });
          if (!isCurrent()) return;
          response = await api("/api/chat/attachment", { method: "POST", session, dataType: "formData", data });
        } else {
          if (current.pending?.message !== message) current.pending = { message, requestId: crypto.randomUUID() };
          response = await api("/api/chat", { method: "POST", session, data: { ...current.pending, ...fields } });
        }
        if (!isCurrent()) return;
        if (typeof response.conversationId !== "string" || typeof response.answer !== "string")
          throw Error("API nie potwierdziło odpowiedzi General Agenta.");
        current.conversationId = response.conversationId;
        current.turns.push({ message: message || file.name, answer: response.answer });
        if (current.turns.length > 20) current.turns.shift();
        current.draft = "";
        current.pending = null;
        attachment.value = "";
      } catch (error) { if (isCurrent()) current.error = error.message; }
      finally {
        current.sending = false;
        if (isCurrent()) redrawChat?.();
      }
    });
  },
  Finanse: finance,
  async Dokumenty(target, active) {
    if (!scope) return target.append(node("p", "Wybierz spółkę, aby zobaczyć jej dokumenty."));
    const selectedScope = scope;
    const { items } = await api(companyPath("/documents", selectedScope));
    if (!active()) return;
    showRows(target, items, "Brak dokumentów w spółce.", item =>
      card(item.name, new Date(item.createdAt).toLocaleDateString("pl-PL")));
    if (!native) return;
    const form = node("form");
    const input = node("input", null, { type: "file", accept: ".pdf,.docx,.txt", required: "" });
    const submit = node("button", "Prześlij dokument", { type: "submit" });
    form.append(field("Dokument PDF, DOCX lub TXT", input), submit);
    target.append(form);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const file = input.files?.[0];
      const session = token;
      if (!file || file.size > 8 * 1024 * 1024) return showError(form, Error("Plik nie może przekraczać 8 MB."));
      submit.disabled = true;
      try {
        const data = await multipart(file);
        if (!active() || token !== session) return;
        await api(companyPath("/documents", selectedScope), { method: "POST", session, dataType: "formData", data });
        if (active()) render();
      } catch (error) { if (active()) showError(form, error); }
      finally { submit.disabled = false; }
    });
  },
  async Inwestycje(target, active) {
    if (!scope) return target.append(node("p", "Wybierz spółkę, aby zobaczyć dostępne inwestycje."));
    const selectedScope = scope;
    const { data } = await api(companyPath("/investments", selectedScope));
    if (!active()) return;
    showRows(target, data.items, "Brak dostępnych inwestycji.", item => {
      const box = card(item.name, item.progress == null ? "Brak pomiaru postępu" : "Postęp " + item.progress + "%");
      const details = node("div");
      box.append(button("Szczegóły", async event => {
        const trigger = event.currentTarget;
        trigger.disabled = true;
        details.replaceChildren();
        try {
          const { data: panel } = await api(companyPath("/investments/" + encodeURIComponent(item.id), selectedScope));
          if (!active()) return;
          details.append(node("p", panel.investment.description || ""));
          for (const [title, rows] of [["Zadania", panel.tasks], ["Dokumenty", panel.documents], ["Sprawozdania", panel.reports]]) {
            details.append(node("h2", title));
            showRows(details, rows, "Brak przypisań.", row => node("p", row.title || row.name));
          }
        } catch (error) { if (active()) showError(details, error); }
        finally { trigger.disabled = false; }
      }), details);
      return box;
    });
  }
};

loginView();
