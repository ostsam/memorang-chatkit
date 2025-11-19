import { NextRequest, NextResponse } from "next/server";
import {
	processPdfUpload,
	type ProcessedUpload,
	type OcrSummary,
} from "@/lib/pdf/upload-service";
import type { LessonPlan } from "@/lib/agent/agent-schemas";
import type { WidgetState } from "@/lib/agent/widget-state-schema";
import { generateQuizFromText } from "@/lib/agent/quiz-service";

export const runtime = "nodejs";

type IngestResponse = {
	metadata: ProcessedUpload["metadata"];
	needsOcr: boolean;
	sections: ProcessedUpload["sections"];
	ocr?: OcrSummary;
	message?: string;
	lessonPlan?: LessonPlan;
	widget?: {
		id: string;
		data: WidgetState;
	};
};

export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();
		const file = formData.get("file");

		if (!file || !(file instanceof File)) {
			return NextResponse.json(
				{ error: "Expected a PDF file upload under the `file` field." },
				{ status: 400 }
			);
		}

		let upload: ProcessedUpload;
		try {
			upload = await processPdfUpload(file);
		} catch (uploadError) {
			const detail =
				uploadError instanceof Error
					? uploadError.message
					: "Failed to process PDF.";
			return NextResponse.json({ error: detail }, { status: 400 });
		}

		let lessonPlan: LessonPlan | undefined;
		let widget:
			| {
					id: string;
					data: WidgetState;
			  }
			| undefined;
		let message: string | undefined = upload.message;

		if (!upload.needsOcr && upload.text.trim().length > 0) {
			try {
				const quiz = await generateQuizFromText(upload.text);
				lessonPlan = quiz.lessonPlan;
				widget = quiz.widget;
			} catch (quizError) {
				console.error(
					"[ingest] Failed to generate quiz",
					quizError
				);
				message =
					"Text parsed successfully, but quiz generation failed. Please retry.";
			}
		}

		const response: IngestResponse = {
			metadata: upload.metadata,
			needsOcr: upload.needsOcr,
			sections: upload.sections,
			ocr: upload.ocr,
			message,
			lessonPlan,
			widget,
		};

		return NextResponse.json(response);
	} catch (error) {
		console.error("[ingest] Failed to parse PDF", error);

		return NextResponse.json(
			{ error: "Unable to ingest PDF. Please try again." },
			{ status: 500 }
		);
	}
}
