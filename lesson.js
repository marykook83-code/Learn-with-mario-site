import { el, reset, button, marioImage, speakerButton } from "./quiz.js";

const LETTERS = ["A", "B", "C", "D"];
const SPEAKER_TYPES = ["m", "s", "p"];

function arabicText(tag, className, text) {
  const node = el(tag, `${className} arabic`, text);
  node.dir = "rtl";
  node.lang = "ar";
  return node;
}

function studentAvatar(student) {
  const avatar = el("div", "avatar");
  if (student && student.photoData) avatar.style.backgroundImage = `url(${student.photoData})`;
  else avatar.textContent = ((student && student.nickname) || "?").charAt(0).toUpperCase();
  return avatar;
}

function buildStep(step, student, whenAnswered) {
  if (step.t === "h") return arabicText("h2", "lesson-heading", step.text);
  if (step.t === "e") {
    const block = el("pre", "example", step.text);
    block.dir = "ltr";
    block.lang = "en";
    return block;
  }
  if (step.t === "p" || step.t === "n") {
    const block = el("div", step.t === "n" ? "paragraph callout" : "paragraph");
    block.append(arabicText("p", "", step.text), speakerButton(step.text, "ar-EG"));
    return block;
  }
  if (step.t === "m" || step.t === "s") {
    const mario = step.t === "m";
    const row = el("div", `bubble-row ${mario ? "from-mario" : "from-student"}`);
    const face = mario ? marioImage("thinking", "Mario") : studentAvatar(student);
    face.classList.add("face");
    const body = el("div", "bubble-body");
    body.append(el("strong", "speaker-name", mario ? "Mario" : (student && student.nickname) || "Student"));
    body.append(arabicText("p", "", step.text));
    if (mario) body.append(speakerButton(step.text, "ar-EG"));
    row.append(face, body);
    return row;
  }
  const box = el("div", "question-box");
  const text = el("p", "english question", step.text);
  text.dir = "auto";
  const options = el("div", "options");
  const feedback = el("div", "feedback");
  step.options.forEach((option, index) => {
    const choice = button(`${LETTERS[index]}) ${option}`, "option", () => {
      const correct = index === step.answer;
      options.querySelectorAll("button").forEach(b => { b.disabled = true; });
      choice.classList.add(correct ? "right-choice" : "wrong-choice");
      options.children[step.answer].classList.add("right-choice");
      feedback.append(
        marioImage(correct ? "happy" : "angry", correct ? "Mario is happy" : "Mario is disappointed"),
        el("p", `status ${correct ? "success" : "error"}`, correct ? "Correct" : "Not quite"),
        arabicText("p", "", step.why),
        speakerButton(step.why, "ar-EG")
      );
      whenAnswered();
    });
    options.append(choice);
  });
  box.append(
    el("p", "note", "Practice question. It does not count toward your score."),
    text,
    speakerButton(step.text.replace(/_+/g, "blank"), /[\u0600-\u06FF]/.test(step.text) ? "ar-EG" : "en-US"),
    options,
    feedback
  );
  return box;
}

export function startLesson(ctx, part) {
  reset();
  const root = document.getElementById("chapter-body");
  const feed = el("div", "feed");
  const controls = el("div", "actions");
  root.append(button("Back to Chapter", "link", ctx.reopen), el("h1", "", part.title), feed, controls);
  let index = 0;

  const showControls = () => {
    controls.textContent = "";
    if (index < part.steps.length) {
      controls.append(button("Continue", "primary", reveal));
    } else {
      controls.append(
        button("Take the Quiz", "primary", ctx.takeQuiz),
        button("Back to Chapter", "secondary", ctx.reopen)
      );
    }
  };

  function reveal() {
    controls.textContent = "";
    let last;
    do {
      last = part.steps[index++];
      feed.append(buildStep(last, ctx.student, showControls));
    } while (last.t !== "q" && index < part.steps.length && !["m", "s", "q"].includes(part.steps[index].t));
    if (last.t !== "q") showControls();
    feed.lastElementChild.scrollIntoView({ block: "nearest" });
  }

  reveal();
}
