import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { quizzes } from "../data/quizzes.js";
import { speak, stopSpeech } from "./speech.js";
import { lessons } from "../data/lessons.js";
import { startLesson } from "./lesson.js";

const root = document.getElementById("chapter-body");
const PASS_SCORE = 7;
const LETTERS = ["A", "B", "C", "D"];

const passMessage = "برافو! نتيجة جميلة جدًا، والفكرة واضحة. يلا نكمل بنفس الحماس.";
const retryMessage = "مفيش مشكلة، ده جزء من التعلم. خلينا نراجع الدرس مع بعض ونجرب تاني، وأكيد النتيجة هتتحسن.";

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function reset() {
  stopSpeech();
  root.textContent = "";
  window.scrollTo(0, 0);
}

export function marioImage(name, alt) {
  const image = el("img", "mario-small");
  image.src = `assets/mario/${name}.png`;
  image.alt = alt;
  return image;
}

export function button(label, className, handler) {
  const node = el("button", className, label);
  node.type = "button";
  node.addEventListener("click", handler);
  return node;
}

export function speakerButton(text, lang) {
  const node = button("Listen", "speaker small", () => {
    if (!speak(text, node, lang)) node.textContent = "Audio not supported";
  });
  return node;
}

const attemptsRef = (uid) => collection(db, "users", uid, "attempts");

export async function loadAttempts(uid) {
  const snapshot = await getDocs(query(attemptsRef(uid), orderBy("at", "desc")));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

function formatDate(attempt) {
  return attempt.at ? attempt.at.toDate().toLocaleDateString() : "";
}

function calculateScore(quiz, answers) {
  return quiz.questions.filter((q, index) => answers[index] === q.answer).length;
}

function buildReview(quiz, answers) {
  const list = el("div", "review");
  quiz.questions.forEach((q, index) => {
    const correct = answers[index] === q.answer;
    const item = el("article", `review-item ${correct ? "right" : "wrong"}`);
    item.append(el("h3", "", `Question ${index + 1}: ${correct ? "Correct" : "Incorrect"}`));
    const text = el("p", "english", q.text);
    text.dir = "ltr";
    item.append(text);
    item.append(el("p", "", `Your answer: ${LETTERS[answers[index]]}) ${q.options[answers[index]]}`));
    if (!correct) item.append(el("p", "", `Correct answer: ${LETTERS[q.answer]}) ${q.options[q.answer]}`));
    const details = el("ul", "reasons");
    q.options.forEach((option, optionIndex) => {
      const line = el("li");
      const mark = optionIndex === q.answer ? "✅" : "❌";
      line.append(el("strong", "english", `${LETTERS[optionIndex]}) ${option} ${mark}`));
      const reason = el("span", "arabic", q.reasons[optionIndex]);
      reason.dir = "rtl";
      reason.lang = "ar";
      line.append(reason);
      details.append(line);
    });
    item.append(details);
    item.append(speakerButton(`${q.options[q.answer]}. ${q.reasons[q.answer]}`, "ar-EG"));
    list.append(item);
  });
  return list;
}

function showResult(ctx, quiz, answers, saveFailed) {
  const score = calculateScore(quiz, answers);
  const passed = score >= PASS_SCORE;
  reset();
  root.append(
    marioImage(passed ? "happy" : "angry", passed ? "Mario is happy" : "Mario is disappointed"),
    el("h1", "", `${score}/${quiz.questions.length}`)
  );
  const message = el("p", "arabic big", passed ? passMessage : retryMessage);
  message.dir = "rtl";
  message.lang = "ar";
  root.append(message, speakerButton(passed ? passMessage : retryMessage, "ar-EG"));
  if (saveFailed) root.append(el("p", "status error", "Your attempt could not be saved. Check your connection."));
  const actions = el("div", "actions");
  actions.append(
    button("Retake Quiz", "primary", () => startQuiz(ctx)),
    button("Back to Chapter", "secondary", () => renderChapter(ctx))
  );
  root.append(actions, el("h2", "", "Review"), buildReview(quiz, answers));
}

async function submitQuiz(ctx, quiz, answers) {
  const score = calculateScore(quiz, answers);
  let saveFailed = false;
  try {
    await addDoc(attemptsRef(ctx.uid), {
      chapterId: ctx.chapter.id, score, total: quiz.questions.length, answers, at: serverTimestamp()
    });
    if (score >= PASS_SCORE) await ctx.onPassed(ctx.chapter.id);
  } catch (error) {
    saveFailed = true;
  }
  showResult(ctx, quiz, answers, saveFailed);
}

function startQuiz(ctx) {
  const quiz = quizzes[ctx.chapter.id];
  const answers = [];
  const total = quiz.questions.length;

  const ask = (index) => {
    reset();
    const q = quiz.questions[index];
    const bar = el("progress");
    bar.max = total;
    bar.value = index + 1;
    root.append(el("p", "note", `Question ${index + 1} of ${total}`), bar);
    const text = el("p", "english question", q.text);
    text.dir = "ltr";
    root.append(text, speakerButton(q.text.replace(/_+/g, "blank"), "en-US"));
    const next = button(index === total - 1 ? "Submit Quiz" : "Next", "primary", () => {
      if (index === total - 1) submitQuiz(ctx, quiz, answers);
      else ask(index + 1);
    });
    next.disabled = answers[index] === undefined;
    const options = el("div", "options");
    q.options.forEach((option, optionIndex) => {
      const choice = button(`${LETTERS[optionIndex]}) ${option}`, "option", () => {
        answers[index] = optionIndex;
        options.querySelectorAll(".option").forEach(o => o.classList.remove("selected"));
        choice.classList.add("selected");
        next.disabled = false;
      });
      if (answers[index] === optionIndex) choice.classList.add("selected");
      options.append(choice);
    });
    const controls = el("div", "actions");
    if (index > 0) controls.append(button("Previous", "secondary", () => ask(index - 1)));
    controls.append(next);
    root.append(options, controls);
  };
  ask(0);
}

function lessonButtons(ctx) {
  const full = { ...ctx, reopen: () => renderChapter(ctx), takeQuiz: () => startQuiz(ctx) };
  return (lessons[ctx.chapter.id] || []).map(part =>
    button(`Lesson: ${part.title}`, "secondary lesson-link", () => startLesson(full, part)));
}

export async function renderChapter(ctx) {
  reset();
  const quiz = quizzes[ctx.chapter.id];
  const history = el("div", "history");
  history.append(el("p", "note", "Loading attempts..."));
  root.append(
    button("Back to Home", "link", ctx.back),
    marioImage("thinking", "Mario thinking"),
    el("h1", "", `${ctx.chapter.unit}, ${ctx.chapter.name}`),
    el("p", "", ctx.chapter.topic),
    el("p", "", `The quiz has ${quiz.questions.length} questions. A score of ${PASS_SCORE} or more completes the chapter.`),
    ...lessonButtons(ctx),
    button("Start Quiz", "primary", () => startQuiz(ctx)),
    el("h2", "", "Quiz History"),
    history
  );
  try {
    const attempts = await loadAttempts(ctx.uid);
    history.textContent = "";
    if (!attempts.length) history.append(el("p", "note", "No attempts yet. Your scores will appear here."));
    attempts.forEach(attempt => {
      const row = el("div", `attempt ${attempt.score >= PASS_SCORE ? "right" : "wrong"}`);
      row.append(el("span", "", `${attempt.score}/${attempt.total}  ${formatDate(attempt)}`));
      row.append(button("Review", "secondary small", () => {
        reset();
        root.append(
          button("Back to Chapter", "link", () => renderChapter(ctx)),
          el("h1", "", `${attempt.score}/${attempt.total}`),
          buildReview(quiz, attempt.answers)
        );
      }));
      history.append(row);
    });
  } catch (error) {
    history.textContent = "";
    history.append(el("p", "status error", "Could not load your attempts."));
  }
}
