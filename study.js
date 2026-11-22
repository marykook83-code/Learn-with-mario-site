import { db } from "./firebase.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { quizzes } from "../data/quizzes.js";
import { units } from "../data/curriculum.js";
import { loadAttempts, el, button, marioImage, speakerButton } from "./quiz.js";
import { stopSpeech } from "./speech.js";

const LETTERS = ["A", "B", "C", "D"];

function mount(id) {
  stopSpeech();
  const root = document.getElementById(id);
  root.textContent = "";
  return root;
}

export async function renderProgress(uid, profile) {
  const root = mount("progress-body");
  root.append(el("h1", "", "Progress"), el("p", "note", "Loading..."));
  try {
    const attempts = await loadAttempts(uid);
    root.textContent = "";
    root.append(el("h1", "", "Progress"));
    const completed = Object.keys(profile.completed || {}).length;
    const total = units.reduce((sum, unit) => sum + unit.chapters.filter(c => c.available).length, 0);
    const average = attempts.length ? (attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length).toFixed(1) : "-";
    const best = attempts.length ? Math.max(...attempts.map(a => a.score)) : "-";
    const list = el("ul", "stats");
    [`Completed chapters: ${completed} of ${total}`, `Quiz attempts: ${attempts.length}`,
      `Average score: ${average}`, `Best score: ${best}`].forEach(line => list.append(el("li", "", line)));
    root.append(list);
    if (!attempts.length) root.append(el("p", "note", "Take a chapter quiz and your progress will show here."));
  } catch (error) {
    root.append(el("p", "status error", "Could not load your progress."));
  }
}

function collectMistakes(attempts) {
  const mistakes = new Map();
  attempts.forEach(attempt => {
    const quiz = quizzes[attempt.chapterId];
    if (!quiz) return;
    attempt.answers.forEach((answer, index) => {
      if (answer === quiz.questions[index].answer) return;
      const key = `${attempt.chapterId}:${index}`;
      mistakes.set(key, { chapterId: attempt.chapterId, index, count: (mistakes.get(key)?.count || 0) + 1 });
    });
  });
  return [...mistakes.values()];
}

function runSession(uid, root, picked) {
  const results = [];
  const ask = (step) => {
    root.textContent = "";
    const item = picked[step];
    const q = quizzes[item.chapterId].questions[item.index];
    const text = el("p", "english question", q.text);
    text.dir = "ltr";
    const feedback = el("div", "feedback");
    const options = el("div", "options");
    q.options.forEach((option, index) => {
      const choice = button(`${LETTERS[index]}) ${option}`, "option", async () => {
        const correct = index === q.answer;
        results.push({ chapterId: item.chapterId, index: item.index, correct });
        options.querySelectorAll("button").forEach(b => { b.disabled = true; });
        choice.classList.add(correct ? "right-choice" : "wrong-choice");
        options.children[q.answer].classList.add("right-choice");
        const reason = el("p", "arabic", q.reasons[q.answer]);
        reason.dir = "rtl";
        feedback.append(
          marioImage(correct ? "happy" : "angry", correct ? "Mario is happy" : "Mario is disappointed"),
          el("p", `status ${correct ? "success" : "error"}`, correct ? "Correct" : "Not quite"),
          reason, speakerButton(q.reasons[q.answer], "ar-EG"),
          button(step === picked.length - 1 ? "Finish" : "Next", "primary", () => (step === picked.length - 1 ? finish() : ask(step + 1)))
        );
      });
      options.append(choice);
    });
    root.append(el("p", "note", `Question ${step + 1} of ${picked.length}`), text, speakerButton(q.text.replace(/_+/g, "blank"), "en-US"), options, feedback);
  };
  const finish = async () => {
    const score = results.filter(r => r.correct).length;
    root.textContent = "";
    root.append(marioImage(score >= picked.length / 2 ? "happy" : "thinking", "Mario"), el("h1", "", `${score}/${picked.length}`));
    try {
      await addDoc(collection(db, "users", uid, "practice"), { score, total: picked.length, results, at: serverTimestamp() });
    } catch (error) {
      root.append(el("p", "status error", "Could not save this session."));
    }
    root.append(button("Back to Test Yourself", "primary", () => renderPractice(uid)));
  };
  ask(0);
}

export async function renderPractice(uid) {
  const root = mount("practice-body");
  root.append(el("h1", "", "Test Yourself"), el("p", "note", "Loading..."));
  let mistakes;
  try {
    mistakes = collectMistakes(await loadAttempts(uid));
  } catch (error) {
    root.textContent = "";
    root.append(el("h1", "", "Test Yourself"), el("p", "status error", "Could not load your quiz answers."));
    return;
  }
  root.textContent = "";
  root.append(el("h1", "", "Test Yourself"));
  if (!mistakes.length) {
    root.append(marioImage("happy", "Mario is happy"), el("p", "", "There are no mistakes to review right now. Take a chapter quiz and any missed questions will appear here."));
    return;
  }
  const input = el("input");
  input.type = "number";
  input.min = 2;
  input.max = 10;
  input.value = Math.min(5, Math.max(2, mistakes.length));
  const note = el("p", "note");
  const label = el("label", "", "Number of questions (2 to 10)");
  label.append(input);
  root.append(el("p", "", `You have ${mistakes.length} question${mistakes.length === 1 ? "" : "s"} to review.`), label, note,
    button("Start Practice", "primary", () => {
      const wanted = Math.min(10, Math.max(2, Number(input.value) || 2));
      const picked = mistakes
        .map(m => ({ ...m, weight: m.count + Math.random() * 0.99 }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, wanted);
      if (picked.length < wanted) note.textContent = `Only ${picked.length} question${picked.length === 1 ? " is" : "s are"} available, so this session is shorter.`;
      runSession(uid, root, picked);
    }));
}
