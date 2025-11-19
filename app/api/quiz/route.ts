import { NextRequest, NextResponse } from "next/server";
import { generateQuizFromText } from "@/lib/agent/quiz-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
	try {
		const { text } = (await request.json()) as {
			text?: string;
		};

		if (!text || !text.trim()) {
			return NextResponse.json(
				{ error: "Quiz generation requires non-empty text." },
				{ status: 400 },
			);
		}

		const quiz = await generateQuizFromText(text);
		return NextResponse.json(quiz);
	} catch (error) {
		console.error("[quiz] Failed to generate quiz", error);
		const detail =
			error instanceof Error
				? error.message
				: "Unable to generate quiz.";
		return NextResponse.json({ error: detail }, { status: 500 });
	}
}
