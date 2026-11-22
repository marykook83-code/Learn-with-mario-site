import { watchAuth, loginGoogle, registerEmail, loginEmail, logout, authMessage } from "./auth.js";
import { getProfile, saveProfile, resizeImage } from "./profile.js";
import { speak, stopSpeech, setSpeechSettings } from "./speech.js";
import { renderProgress, renderPractice } from "./study.js";
import { renderChapter } from "./quiz.js";
import { units } from "../data/curriculum.js";

const $ = (id) => document.getElementById(id);
const views = [...document.querySelectorAll(".view")];
const welcomeText = $("welcome-text").textContent.trim();

let user = null;
let profile = null;
let pendingPhoto = null;
let authMode = "login";

function show(id) {
  stopSpeech();
  views.forEach(view => { view.hidden = view.id !== id; });
  $("nav").hidden = !(user && profile && profile.nickname);
  document.querySelectorAll("[data-go]").forEach(link => {
    link.classList.toggle("active", link.dataset.go === id);
  });
  window.scrollTo(0, 0);
}

function notify(element, text, type = "error") {
  element.textContent = text;
  element.className = `status ${text ? type : ""}`;
}

function paintAvatar(element, photo, nickname) {
  element.textContent = "";
  element.style.backgroundImage = photo ? `url(${photo})` : "";
  if (!photo) element.textContent = (nickname || "?").trim().charAt(0).toUpperCase();
}

function renderHome() {
  $("home-name").textContent = profile.nickname;
  paintAvatar($("home-avatar"), profile.photoData, profile.nickname);
  const resume = units.flatMap(u => u.chapters.map(c => ({ ...c, unit: u.name })))
    .find(c => c.id === profile.lastChapter && c.available);
  $("continue-button").hidden = !resume;
  $("continue-button").onclick = () => resume && openChapter(resume);
  const list = $("units");
  list.textContent = "";
  units.forEach(unit => {
    const section = document.createElement("section");
    section.className = "unit";
    const title = document.createElement("h3");
    title.textContent = unit.name;
    section.append(title);
    unit.chapters.forEach(chapter => {
      const row = document.createElement("div");
      row.className = "chapter";
      const label = document.createElement("span");
      label.textContent = chapter.topic ? `${chapter.name}: ${chapter.topic}` : chapter.name;
      const done = Boolean(profile.completed && profile.completed[chapter.id]);
      const tools = document.createElement("span");
      tools.className = "row-tools";
      if (done) {
        row.classList.add("done");
        const badge = document.createElement("span");
        badge.className = "chip done-chip";
        badge.textContent = "Completed";
        tools.append(badge);
      }
      if (chapter.available) {
        const open = document.createElement("button");
        open.className = "secondary small";
        open.textContent = "Open";
        open.addEventListener("click", () => openChapter({ ...chapter, unit: unit.name }));
        tools.append(open);
      } else {
        const state = document.createElement("span");
        state.className = "chip";
        state.textContent = "Not available yet";
        tools.append(state);
      }
      row.append(label, tools);
      section.append(row);
    });
    list.append(section);
  });
}

function openChapter(chapter) {
  profile.lastChapter = chapter.id;
  saveProfile(user.uid, { lastChapter: chapter.id }).catch(() => {});
  renderChapter({
    uid: user.uid,
    student: profile,
    chapter,
    onPassed: markCompleted,
    back: () => { renderHome(); show("view-home"); }
  });
  show("view-chapter");
}

async function markCompleted(chapterId) {
  profile.completed = { ...(profile.completed || {}), [chapterId]: true };
  await saveProfile(user.uid, { completed: profile.completed });
}

function renderProfileForm(isSetup) {
  $("profile-title").textContent = isSetup ? "Set up your profile" : "My Account";
  $("profile-intro").textContent = isSetup
    ? "Choose a nickname and, if you like, a picture. You can change both later."
    : "Update your nickname or picture.";
  $("nickname").value = profile?.nickname || "";
  pendingPhoto = profile?.photoData || null;
  paintAvatar($("profile-avatar"), pendingPhoto, $("nickname").value);
  notify($("profile-status"), "");
  $("account-email").textContent = user.email || "";
  $("account-email-row").hidden = isSetup;
  $("logout-account").hidden = isSetup;
  $("settings").hidden = isSetup;
  fillSettings();
}

async function enterApp(currentUser) {
  user = currentUser;
  try {
    profile = await getProfile(user.uid);
  } catch (error) {
    profile = null;
    show("view-auth");
    notify($("auth-status"), "Could not load your profile. Check your connection and Firebase rules.");
    return;
  }
  applySettings((profile && profile.settings) || {});
  if (profile && profile.nickname) {
    renderHome();
    show("view-home");
  } else {
    renderProfileForm(true);
    show("view-profile");
  }
}

watchAuth(async (currentUser) => {
  if (currentUser) {
    await enterApp(currentUser);
  } else {
    user = null;
    profile = null;
    show("view-welcome");
  }
});

$("start-button").addEventListener("click", () => show("view-auth"));
$("speak-welcome").addEventListener("click", (event) => {
  if (!speak(welcomeText, event.currentTarget)) {
    $("welcome-note").textContent = "Your browser does not support spoken audio.";
  }
});

document.querySelectorAll("[data-mode]").forEach(tab => {
  tab.addEventListener("click", () => {
    authMode = tab.dataset.mode;
    document.querySelectorAll("[data-mode]").forEach(t => t.setAttribute("aria-selected", t === tab));
    $("auth-submit").textContent = authMode === "login" ? "Log in" : "Create account";
    $("password").autocomplete = authMode === "login" ? "current-password" : "new-password";
    notify($("auth-status"), "");
  });
});

async function runAuth(action) {
  const buttons = document.querySelectorAll("#view-auth button");
  buttons.forEach(b => { b.disabled = true; });
  notify($("auth-status"), "Please wait...", "info");
  try {
    await action();
    notify($("auth-status"), "");
  } catch (error) {
    notify($("auth-status"), authMessage(error));
  } finally {
    buttons.forEach(b => { b.disabled = false; });
  }
}

$("auth-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const email = $("email").value.trim();
  const password = $("password").value;
  runAuth(() => (authMode === "login" ? loginEmail(email, password) : registerEmail(email, password)));
});
$("google-button").addEventListener("click", () => runAuth(loginGoogle));

async function chooseImage(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    pendingPhoto = await resizeImage(file);
    paintAvatar($("profile-avatar"), pendingPhoto, $("nickname").value);
    notify($("profile-status"), "Picture ready. Save to keep it.", "info");
  } catch (error) {
    notify($("profile-status"), "That file is not a readable image.");
  }
}
$("photo-gallery").addEventListener("change", chooseImage);
$("photo-camera").addEventListener("change", chooseImage);
$("remove-photo").addEventListener("click", () => {
  pendingPhoto = null;
  paintAvatar($("profile-avatar"), null, $("nickname").value);
});
$("nickname").addEventListener("input", () => {
  if (!pendingPhoto) paintAvatar($("profile-avatar"), null, $("nickname").value);
});

$("profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const nickname = $("nickname").value.trim();
  if (nickname.length < 2 || nickname.length > 20) {
    notify($("profile-status"), "Nickname must be 2 to 20 characters.");
    return;
  }
  const wasSetup = !(profile && profile.nickname);
  $("profile-save").disabled = true;
  notify($("profile-status"), "Saving...", "info");
  try {
    await saveProfile(user.uid, { nickname, photoData: pendingPhoto });
    profile = { ...(profile || {}), nickname, photoData: pendingPhoto };
    renderHome();
    if (wasSetup) {
      show("view-home");
    } else {
      notify($("profile-status"), "Saved.", "success");
    }
  } catch (error) {
    notify($("profile-status"), "Could not save. Check your connection and try again.");
  } finally {
    $("profile-save").disabled = false;
  }
});

document.querySelectorAll("[data-go]").forEach(link => {
  link.addEventListener("click", () => {
    if (link.dataset.go === "view-profile") renderProfileForm(false);
    if (link.dataset.go === "view-progress") renderProgress(user.uid, profile);
    if (link.dataset.go === "view-practice") renderPractice(user.uid);
    show(link.dataset.go);
  });
});
document.querySelectorAll("[data-logout]").forEach(button => {
  button.addEventListener("click", () => logout());
});

const defaultSettings = { help: false, size: 100, line: 16, rate: 0.95, contrast: false, font: false };
let settings = { ...defaultSettings };

function applySettings(saved) {
  settings = { ...defaultSettings, ...saved };
  const root = document.documentElement;
  root.style.setProperty("--text-scale", settings.size / 100);
  root.style.setProperty("--line", settings.line / 10);
  document.body.classList.toggle("contrast", settings.contrast);
  document.body.classList.toggle("easy-font", settings.font);
  if (settings.font && !document.getElementById("easy-font-link")) {
    const link = document.createElement("link");
    link.id = "easy-font-link";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Lexend:wght@400;600&display=swap";
    document.head.append(link);
  }
  setSpeechSettings({ rate: settings.rate, help: settings.help });
}

function fillSettings() {
  $("set-help").checked = settings.help;
  $("set-size").value = settings.size;
  $("set-line").value = settings.line;
  $("set-rate").value = settings.rate;
  $("set-contrast").checked = settings.contrast;
  $("set-font").checked = settings.font;
}

$("settings").addEventListener("change", async () => {
  applySettings({
    help: $("set-help").checked, size: Number($("set-size").value), line: Number($("set-line").value),
    rate: Number($("set-rate").value), contrast: $("set-contrast").checked, font: $("set-font").checked
  });
  profile.settings = settings;
  try {
    await saveProfile(user.uid, { settings });
    notify($("profile-status"), "Settings saved.", "success");
  } catch (error) {
    notify($("profile-status"), "Could not save settings.");
  }
});
$("settings").addEventListener("input", () => {
  applySettings({
    help: $("set-help").checked, size: Number($("set-size").value), line: Number($("set-line").value),
    rate: Number($("set-rate").value), contrast: $("set-contrast").checked, font: $("set-font").checked
  });
});
