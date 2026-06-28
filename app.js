(function () {
  const questions = window.ANATOMIA_QUESTIONS || [];
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const storageKey = "ucr-anatomia-parciales-v2";
  const defaultRandomFilter = "random-mix";
  const randomQuestionLimit = 100;
  const randomModes = {
    "random-2025": { label: "Aleatorio 2025 oculto", pill: "Aleatorio 2025", year: 2025 },
    "random-2026": { label: "Aleatorio 2026 oculto", pill: "Aleatorio 2026", year: 2026 },
    "random-mix": { label: "Aleatorio Mix oculto", pill: "Aleatorio Mix", year: null },
  };

  const els = {
    scoreValue: document.getElementById("scoreValue"),
    progressValue: document.getElementById("progressValue"),
    questionList: document.getElementById("questionList"),
    setLabel: document.getElementById("setLabel"),
    stopButton: document.getElementById("stopButton"),
    resetButton: document.getElementById("resetButton"),
    bankPill: document.getElementById("bankPill"),
    professorLabel: document.getElementById("professorLabel"),
    positionLabel: document.getElementById("positionLabel"),
    questionText: document.getElementById("questionText"),
    noteBanner: document.getElementById("noteBanner"),
    options: document.getElementById("options"),
    feedback: document.getElementById("feedback"),
    prevButton: document.getElementById("prevButton"),
    nextButton: document.getElementById("nextButton"),
    correctCount: document.getElementById("correctCount"),
    wrongCount: document.getElementById("wrongCount"),
    pendingCount: document.getElementById("pendingCount"),
    reviewList: document.getElementById("reviewList"),
    filters: Array.from(document.querySelectorAll(".filter-button")),
  };

  const banks = Array.from(new Map(questions.map((question) => [
    question.bankId,
    { id: question.bankId, label: question.bankLabel },
  ])).values());

  const state = {
    filter: banks[0]?.id || defaultRandomFilter,
    index: 0,
    attempts: loadAttempts(),
  };

  function loadAttempts() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return saved && typeof saved === "object" ? saved : {};
    } catch {
      return {};
    }
  }

  function saveAttempts() {
    localStorage.setItem(storageKey, JSON.stringify(state.attempts));
  }

  function isRandomMode() {
    return Boolean(randomModes[state.filter]);
  }

  function currentAttempt() {
    if (!state.attempts[state.filter]) {
      state.attempts[state.filter] = { answers: {}, randomOrder: [], stopped: false };
    }
    const attempt = state.attempts[state.filter];
    attempt.answers ||= {};
    attempt.randomOrder ||= [];
    attempt.stopped = Boolean(attempt.stopped);
    if (isRandomMode() && !isValidRandomOrder(attempt.randomOrder)) {
      attempt.randomOrder = randomSampleIds();
      attempt.answers = {};
      attempt.stopped = false;
      saveAttempts();
    }
    return attempt;
  }

  function currentAnswers() {
    return currentAttempt().answers;
  }

  function randomPool(filter = state.filter) {
    const mode = randomModes[filter];
    if (!mode || !mode.year) {
      return questions;
    }
    return questions.filter((question) => question.year === mode.year);
  }

  function isValidRandomOrder(order) {
    const poolIds = new Set(randomPool().map((question) => question.id));
    const expectedLength = Math.min(randomQuestionLimit, poolIds.size);
    return order.length === expectedLength && order.every((id) => poolIds.has(id));
  }

  function randomSampleIds(filter = state.filter) {
    const poolIds = randomPool(filter).map((question) => question.id);
    return shuffleIds(poolIds).slice(0, Math.min(randomQuestionLimit, poolIds.length));
  }

  function shuffleIds(ids) {
    const shuffled = [...ids];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  function filteredQuestions() {
    if (isRandomMode()) {
      return currentAttempt().randomOrder.map((id) => questionsById.get(id)).filter(Boolean);
    }
    return questions.filter((question) => question.bankId === state.filter);
  }

  function activeQuestion() {
    return filteredQuestions()[state.index];
  }

  function statsFor(list) {
    const answers = currentAnswers();
    const answered = list.filter((question) => answers[question.id]);
    const correct = answered.filter((question) => answers[question.id].isCorrect);
    const wrong = answered.length - correct.length;
    return {
      total: list.length,
      answered: answered.length,
      correct: correct.length,
      wrong,
      pending: list.length - answered.length,
      percent: list.length ? Math.round((answered.length / list.length) * 100) : 0,
    };
  }

  function answerLabel(question, optionId) {
    const option = question.options.find((candidate) => candidate.id === optionId);
    return option ? `${option.id}) ${option.text}` : optionId;
  }

  function currentSetLabel() {
    if (isRandomMode()) {
      return randomModes[state.filter].label;
    }
    return banks.find((bank) => bank.id === state.filter)?.label || "Base de preguntas";
  }

  function setFilter(nextFilter) {
    state.filter = nextFilter;
    state.index = 0;
    if (randomModes[nextFilter]) {
      state.attempts[nextFilter] = { answers: {}, randomOrder: randomSampleIds(nextFilter), stopped: false };
      saveAttempts();
    } else {
      currentAttempt().stopped = false;
      saveAttempts();
    }
    render();
  }

  function chooseQuestion(questionId) {
    const list = filteredQuestions();
    const nextIndex = list.findIndex((question) => question.id === questionId);
    if (nextIndex >= 0) {
      state.index = nextIndex;
      render();
    }
  }

  function chooseOption(optionId) {
    const question = activeQuestion();
    const attempt = currentAttempt();
    const answers = attempt.answers;
    if (!question || answers[question.id] || attempt.stopped) {
      return;
    }

    answers[question.id] = {
      selectedOptionId: optionId,
      isCorrect: optionId === question.correctOptionId,
      answeredAt: new Date().toISOString(),
    };
    saveAttempts();
    render();
  }

  function move(delta) {
    const list = filteredQuestions();
    if (!list.length) {
      return;
    }
    state.index = Math.min(Math.max(state.index + delta, 0), list.length - 1);
    render();
  }

  function moveToNextOpen() {
    const list = filteredQuestions();
    const answers = currentAnswers();
    if (!list.length) {
      return;
    }

    for (let offset = 1; offset <= list.length; offset += 1) {
      const candidateIndex = (state.index + offset) % list.length;
      if (!answers[list[candidateIndex].id]) {
        state.index = candidateIndex;
        render();
        return;
      }
    }

    move(1);
  }

  function resetCurrentSet() {
    const label = currentSetLabel();
    if (!window.confirm(`¿Reiniciar ${label}?`)) {
      return;
    }
    if (isRandomMode()) {
      state.attempts[state.filter] = { answers: {}, randomOrder: randomSampleIds(), stopped: false };
    } else {
      state.attempts[state.filter] = { answers: {}, randomOrder: [], stopped: false };
    }
    state.index = 0;
    saveAttempts();
    render();
  }

  function toggleStop() {
    const attempt = currentAttempt();
    attempt.stopped = !attempt.stopped;
    saveAttempts();
    render();
  }

  function render() {
    const list = filteredQuestions();
    if (state.index >= list.length) {
      state.index = Math.max(0, list.length - 1);
    }
    renderFilterButtons();
    renderScore(list);
    renderQuestionList(list);
    renderQuestion(list);
    renderReview(list);
  }

  function renderFilterButtons() {
    els.filters.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.filter === state.filter);
    });
  }

  function renderScore(list) {
    const stats = statsFor(list);
    const stopped = currentAttempt().stopped;
    els.scoreValue.textContent = `${stats.correct} / ${stats.answered}`;
    els.progressValue.textContent = `${stats.percent}%`;
    els.correctCount.textContent = stats.correct;
    els.wrongCount.textContent = stats.wrong;
    els.pendingCount.textContent = stats.pending;
    els.setLabel.textContent = `${currentSetLabel()} · ${stats.total} preguntas`;
    els.stopButton.textContent = stopped ? "Continuar" : "Detener";
    els.stopButton.classList.toggle("is-stopped", stopped);
  }

  function renderQuestionList(list) {
    const answers = currentAnswers();
    els.questionList.innerHTML = "";
    const fragment = document.createDocumentFragment();

    list.forEach((question, index) => {
      const answer = answers[question.id];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "question-nav";
      button.classList.toggle("is-current", index === state.index);
      button.classList.toggle("is-correct", Boolean(answer && answer.isCorrect));
      button.classList.toggle("is-wrong", Boolean(answer && !answer.isCorrect));
      button.addEventListener("click", () => chooseQuestion(question.id));

      const number = document.createElement("span");
      number.className = "question-number";
      number.textContent = isRandomMode() ? index + 1 : question.number;

      const preview = document.createElement("span");
      preview.className = "question-preview";
      preview.textContent = question.question;

      const dot = document.createElement("span");
      dot.className = "status-dot";
      dot.setAttribute("aria-hidden", "true");

      button.append(number, preview, dot);
      fragment.append(button);
    });

    els.questionList.append(fragment);
    keepCurrentQuestionVisible();
  }

  function keepCurrentQuestionVisible() {
    const currentButton = els.questionList.querySelector(".question-nav.is-current");
    if (!currentButton) {
      return;
    }
    const currentTop = currentButton.offsetTop - els.questionList.offsetTop;
    const currentBottom = currentTop + currentButton.offsetHeight;
    const viewTop = els.questionList.scrollTop;
    const viewBottom = viewTop + els.questionList.clientHeight;
    if (currentTop < viewTop) {
      els.questionList.scrollTop = Math.max(0, currentTop - 8);
    } else if (currentBottom > viewBottom) {
      els.questionList.scrollTop = currentBottom - els.questionList.clientHeight + 8;
    }
  }

  function renderQuestion(list) {
    const question = list[state.index];
    if (!question) {
      return;
    }

    const attempt = currentAttempt();
    const answer = attempt.answers[question.id];
    const stopped = attempt.stopped;

    els.bankPill.textContent = isRandomMode() ? randomModes[state.filter].pill : question.bankLabel;
    els.professorLabel.textContent = isRandomMode() ? "Origen oculto" : question.professor || question.partialLabel;
    els.positionLabel.textContent = `Pregunta ${state.index + 1} de ${list.length}`;
    els.questionText.textContent = question.question;

    if (stopped) {
      els.noteBanner.hidden = false;
      els.noteBanner.textContent = "Juego detenido. Puedes continuar o reiniciar el intento.";
    } else if (question.noteType === "defective") {
      els.noteBanner.hidden = false;
      els.noteBanner.textContent = "Pregunta con redacción defectuosa: anatómicamente ninguna opción A-D es completamente correcta.";
    } else if (question.noteType === "most_precise") {
      els.noteBanner.hidden = false;
      els.noteBanner.textContent = "Respuesta marcada como más precisa anatómicamente.";
    } else if (question.noteType === "probable") {
      els.noteBanner.hidden = false;
      els.noteBanner.textContent = "Respuesta marcada como probable según el contexto del examen.";
    } else {
      els.noteBanner.hidden = true;
      els.noteBanner.textContent = "";
    }

    renderOptions(question, answer, stopped);
    renderFeedback(question, answer);

    els.prevButton.disabled = stopped || state.index === 0;
    els.nextButton.disabled = stopped || !answer;
    els.nextButton.textContent = answer ? "Siguiente pendiente" : "Siguiente";
  }

  function renderOptions(question, answer, stopped) {
    els.options.innerHTML = "";
    const fragment = document.createDocumentFragment();

    question.options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-button";
      button.disabled = Boolean(answer) || stopped;
      button.addEventListener("click", () => chooseOption(option.id));

      if (answer) {
        button.classList.toggle("is-selected", answer.selectedOptionId === option.id);
        button.classList.toggle("is-correct", question.correctOptionId === option.id);
        button.classList.toggle("is-wrong", answer.selectedOptionId === option.id && !answer.isCorrect);
      }

      const letter = document.createElement("span");
      letter.className = "option-letter";
      letter.textContent = option.id;

      const text = document.createElement("span");
      text.className = "option-text";
      text.textContent = option.text;

      button.append(letter, text);
      fragment.append(button);
    });

    els.options.append(fragment);
  }

  function renderFeedback(question, answer) {
    if (!answer) {
      els.feedback.hidden = true;
      els.feedback.className = "feedback";
      els.feedback.innerHTML = "";
      return;
    }

    const expectedLine = question.examExpectedOptionId
      ? `<p>Respuesta esperada por examen: ${answerLabel(question, question.examExpectedOptionId)}</p>`
      : "";

    els.feedback.hidden = false;
    els.feedback.className = `feedback ${answer.isCorrect ? "correct" : "wrong"}`;
    els.feedback.innerHTML = `
      <h3>${answer.isCorrect ? "Correcta" : "Incorrecta"}</h3>
      <p>Elegiste: ${answerLabel(question, answer.selectedOptionId)}</p>
      <p>Respuesta correcta: ${answerLabel(question, question.correctOptionId)}</p>
      ${expectedLine}
      <p>${question.explanation}</p>
    `;
  }

  function renderReview(list) {
    const answers = currentAnswers();
    els.reviewList.innerHTML = "";
    const answered = list.filter((question) => answers[question.id]);
    const missed = answered.filter((question) => !answers[question.id].isCorrect);
    const shown = missed.length ? missed : answered.slice(-6).reverse();

    if (!shown.length) {
      const empty = document.createElement("div");
      empty.className = "review-item";
      empty.innerHTML = "<strong>Sin respuestas todavía</strong><span>El resumen se llenará durante el intento.</span>";
      els.reviewList.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    shown.forEach((question) => {
      const answer = answers[question.id];
      const item = document.createElement("button");
      item.type = "button";
      item.className = "review-item";
      item.addEventListener("click", () => chooseQuestion(question.id));
      const label = isRandomMode()
        ? `Pregunta ${list.indexOf(question) + 1}`
        : `${question.bankLabel} · Pregunta ${question.number}`;
      item.innerHTML = `
        <strong>${label}</strong>
        <span>${answer.isCorrect ? "Correcta" : `Elegida ${answer.selectedOptionId}, correcta ${question.correctOptionId}`}</span>
      `;
      fragment.append(item);
    });
    els.reviewList.append(fragment);
  }

  els.filters.forEach((button) => {
    button.addEventListener("click", () => setFilter(button.dataset.filter));
  });
  els.resetButton.addEventListener("click", resetCurrentSet);
  els.stopButton.addEventListener("click", toggleStop);
  els.prevButton.addEventListener("click", () => move(-1));
  els.nextButton.addEventListener("click", () => {
    const question = activeQuestion();
    const answer = question ? currentAnswers()[question.id] : null;
    if (answer) {
      moveToNextOpen();
      return;
    }
    move(1);
  });

  render();
})();
