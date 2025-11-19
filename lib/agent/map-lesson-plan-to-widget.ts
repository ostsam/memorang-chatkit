import type { LessonPlan } from "./agent-schemas";
import {
	widgetStateSchema,
	type WidgetState,
} from "./widget-state-schema";

const HEADER_LABEL = "Quiz";
const BADGE_LABEL = "PDF Generated";

const buildQuestionChoices = (
	choices: LessonPlan["questions"][number]["choices"],
) =>
	choices.map((choice, index) => ({
		id: index + 1,
		label: choice.label,
	}));

const resolveCorrectChoiceId = (
	question: LessonPlan["questions"][number],
) => {
	const correctIndex = question.choices.findIndex(
		(choice) => choice.id === question.correct_choice_id,
	);
	return correctIndex >= 0 ? correctIndex + 1 : 1;
};

export function mapLessonPlanToWidgetData(
	lessonPlan: LessonPlan,
): WidgetState {
	const questions = lessonPlan.questions.map((question, questionIndex) => ({
		id: questionIndex + 1,
		question: question.question,
		choices: buildQuestionChoices(question.choices),
		hint: question.hint,
		explanation: question.explanation,
		correct_choice_id: resolveCorrectChoiceId(question),
	}));

	const baseState: WidgetState = {
		lesson: {
			title: lessonPlan.lesson.title,
			source: lessonPlan.lesson.source,
			description: lessonPlan.lesson.description,
			questions,
		},
		mode: "intro",
		current_page: 0,
		progress: { index: 0, total: questions.length },
		header_label: HEADER_LABEL,
		badge_label: BADGE_LABEL,
		current_question: null,
		option_list: [],
		current_answer_value: "",
		answers: questions.map((question) => ({
			question_id: question.id,
			selected_choice_id: null,
			is_correct: false,
			attempted: false,
		})),
		view_locked: false,
		show_hint: false,
		show_explanation: false,
		controls: {
			can_back: false,
			can_next: true,
			next_label: "Start",
		},
		score: { correct: 0, total: questions.length },
	};

	return widgetStateSchema.parse(baseState);
}
