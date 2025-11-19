import { lessonPlanSchema, type LessonPlan } from "./agent-schemas";
import { mapLessonPlanToWidgetData } from "./map-lesson-plan-to-widget";
import { widgetStateSchema } from "./widget-state-schema";

type QuizResponse = {
	lessonPlan: LessonPlan;
	widget: {
		id: string;
		data: unknown;
	};
};

const WIDGET_ID = "step_by_step_quiz";

export function buildQuizResponse(rawLessonPlan: unknown): QuizResponse {
	const lessonPlan = lessonPlanSchema.parse(rawLessonPlan);
	const widgetData = mapLessonPlanToWidgetData(lessonPlan);
	const validatedWidgetData = widgetStateSchema.parse(widgetData);

	return {
		lessonPlan,
		widget: {
			id: WIDGET_ID,
			data: validatedWidgetData,
		},
	};
}
