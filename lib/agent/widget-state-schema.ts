import { z } from "zod";

const Choice = z.strictObject({
	id: z.number(),
	label: z.string(),
});

const Question = z.strictObject({
	id: z.number(),
	question: z.string(),
	choices: z.array(Choice).length(5),
	hint: z.string(),
	explanation: z.string(),
	correct_choice_id: z.number(),
});

const Lesson = z.strictObject({
	title: z.string(),
	source: z.string(),
	description: z.string(),
	questions: z.array(Question),
});

const RadioOption = z.strictObject({
	label: z.string(),
	value: z.string(),
	disabled: z.boolean().optional(),
});

const AnswerState = z.strictObject({
	question_id: z.number(),
	selected_choice_id: z.number().nullable(),
	is_correct: z.boolean(),
	attempted: z.boolean(),
});

const Progress = z.strictObject({
	index: z.number(),
	total: z.number(),
});

const Controls = z.strictObject({
	can_back: z.boolean(),
	can_next: z.boolean(),
	next_label: z.string(),
});

const WidgetState = z.strictObject({
	lesson: Lesson,
	mode: z.enum(["intro", "question", "summary"]),
	current_page: z.number(),
	progress: Progress,
	header_label: z.string(),
	badge_label: z.string(),
	current_question: Question.nullable(),
	option_list: z.array(RadioOption),
	current_answer_value: z.string().optional(),
	answers: z.array(AnswerState),
	view_locked: z.boolean(),
	show_hint: z.boolean(),
	show_explanation: z.boolean(),
	controls: Controls,
	score: z.strictObject({ correct: z.number(), total: z.number() }),
});

export const widgetStateSchema = WidgetState;
export type WidgetState = z.infer<typeof widgetStateSchema>;
