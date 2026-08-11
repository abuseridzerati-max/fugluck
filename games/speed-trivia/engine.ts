import { createSeededRandom, VIRTUAL_VIEWPORT } from "@arcadeclash/shared";
import { TRIVIA_RULES } from "./constants";
import { QUESTION_POOL, type ActiveQuestion, type RawQuestion } from "./questions";

export type SpeedTriviaInput = {
  selectOption?: number; // 0, 1, 2, or 3
};

export class SpeedTriviaEngine {
  public width = VIRTUAL_VIEWPORT.width;
  public height = VIRTUAL_VIEWPORT.height;
  public score = 0;
  public tickCount = 0;
  public gameOver = false;

  public currentQuestionIndex = 0;
  public questionTicksRemaining = TRIVIA_RULES.ticksPerQuestion;
  public activeQuestions: ActiveQuestion[] = [];
  public selectedAnswer: number | null = null;
  public answerFeedbackTimer = 0; // Ticks to display green/red before advancing
  public lastAnswerCorrect = false;

  private readonly seed: number;
  private rng!: () => number;

  constructor(seed: number) {
    this.seed = seed;
    this.reset();
  }

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public reset() {
    this.score = 0;
    this.tickCount = 0;
    this.gameOver = false;
    this.currentQuestionIndex = 0;
    this.questionTicksRemaining = TRIVIA_RULES.ticksPerQuestion;
    this.selectedAnswer = null;
    this.answerFeedbackTimer = 0;
    this.lastAnswerCorrect = false;

    const seededRng = createSeededRandom(this.seed);
    this.rng = seededRng.stream("gameplay");

    // Deterministically shuffle question pool and select activeQuestions
    const poolCopy: RawQuestion[] = [...QUESTION_POOL];
    for (let i = poolCopy.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [poolCopy[i], poolCopy[j]] = [poolCopy[j], poolCopy[i]];
    }

    const selectedRaw = poolCopy.slice(0, TRIVIA_RULES.totalQuestions);
    this.activeQuestions = selectedRaw.map((raw) => {
      const allOptions = [raw.correctAnswer, ...raw.incorrectAnswers];
      // Deterministically shuffle 4 options
      for (let i = allOptions.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
      }
      const correctIndex = allOptions.indexOf(raw.correctAnswer);
      return {
        id: raw.id,
        category: raw.category,
        question: raw.question,
        options: allOptions as [string, string, string, string],
        correctIndex,
      };
    });
  }

  public currentQuestion(): ActiveQuestion | undefined {
    return this.activeQuestions[this.currentQuestionIndex];
  }

  public update(dtSec: number, input: SpeedTriviaInput): "ended" | null {
    if (this.gameOver) return "ended";

    this.tickCount++;

    // 1. If currently displaying answer feedback delay
    if (this.answerFeedbackTimer > 0) {
      this.answerFeedbackTimer--;
      if (this.answerFeedbackTimer <= 0) {
        this.advanceToNextQuestion();
      }
      return this.gameOver ? "ended" : null;
    }

    // 2. Process Timer
    this.questionTicksRemaining--;

    // 3. Process Player Answer Input
    if (input.selectOption !== undefined && input.selectOption >= 0 && input.selectOption <= 3) {
      const q = this.currentQuestion();
      if (q && this.selectedAnswer === null) {
        this.selectedAnswer = input.selectOption;
        this.lastAnswerCorrect = input.selectOption === q.correctIndex;

        if (this.lastAnswerCorrect) {
          const speedFactor = Math.max(0.1, this.questionTicksRemaining / TRIVIA_RULES.ticksPerQuestion);
          const pointsEarned = Math.round(TRIVIA_RULES.baseQuestionScore * speedFactor);
          this.score += pointsEarned;
        }

        this.answerFeedbackTimer = 30; // 0.5s pause to show result
      }
    }

    // 4. Check Question Timeout
    if (this.questionTicksRemaining <= 0) {
      this.selectedAnswer = -1; // Timed out
      this.lastAnswerCorrect = false;
      this.answerFeedbackTimer = 30;
    }

    return this.gameOver ? "ended" : null;
  }

  private advanceToNextQuestion() {
    this.currentQuestionIndex++;
    this.selectedAnswer = null;
    this.answerFeedbackTimer = 0;
    this.questionTicksRemaining = TRIVIA_RULES.ticksPerQuestion;

    if (this.currentQuestionIndex >= this.activeQuestions.length) {
      this.gameOver = true;
    }
  }
}
