import { run } from "@openai/agents";
import type { LessonPlan } from "./agent-schemas";
import { quizWriterAgent } from "./quiz-agent";
import { mapLessonPlanToWidgetData } from "./map-lesson-plan-to-widget";
import type { WidgetState } from "./widget-state-schema";

export type QuizResult = {
	lessonPlan: LessonPlan;
	widget: {
		id: string;
		data: WidgetState;
	};
};

export async function generateQuizFromText(
	text: string,
): Promise<QuizResult> {
	const quizResult = await run(quizWriterAgent, text);
	if (!quizResult.finalOutput) {
		throw new Error("Quiz agent returned no output");
	}

	const lessonPlan = quizResult.finalOutput;
	const widget = {
		id: "step_by_step_quiz",
		data: mapLessonPlanToWidgetData(lessonPlan),
	};

	return { lessonPlan, widget };
}
