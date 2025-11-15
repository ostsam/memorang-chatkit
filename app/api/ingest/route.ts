import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { extractPdfText, type ParsedPdf } from "@/lib/pdf/pdf-parser";
import {
	normalizePdfText,
	type NormalizedSection,
} from "@/lib/pdf/pdf-normalizer";
import { runDocumentAiOcr } from "@/lib/pdf/document-ai-ocr";

export const runtime = "nodejs";

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY!,
});

type IngestResponse = {
	metadata: ParsedPdf["metadata"];
	needsOcr: boolean;
	sections: NormalizedSection[];
	ocr?: {
		provider: "documentai";
		success: boolean;
		pageCount: number;
	};
	message?: string;
	lessonWorkflow?: {
		responseId: string;
	};
};

const MIN_EMBEDDED_TEXT_CHARACTERS = 25;

function requiresOcrFallback(text: string): boolean {
	const compact = text.replace(/\s+/g, "");
	if (compact.length === 0) return true;
	return compact.length < MIN_EMBEDDED_TEXT_CHARACTERS;
}

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

		const isPdf =
			file.type === "application/pdf" ||
			(typeof file.name === "string" &&
				file.name.toLowerCase().endsWith(".pdf"));

		if (!isPdf) {
			return NextResponse.json(
				{ error: "Only PDF uploads are supported." },
				{ status: 400 }
			);
		}

		// 1) Read the PDF into a buffer
		const buffer = Buffer.from(await file.arrayBuffer());

		// 2) Try embedded text extraction first
		const parsed = await extractPdfText(buffer);

		let text = parsed.text;
		let needsOcr = requiresOcrFallback(text);
		let message: string | undefined = needsOcr
			? "Embedded text insufficient. OCR fallback required."
			: undefined;
		let ocrSummary: IngestResponse["ocr"];

		// 3) Fallback to OCR if needed
		if (needsOcr) {
			try {
				const ocrResult = await runDocumentAiOcr(buffer);
				ocrSummary = {
					provider: "documentai",
					success: ocrResult.text.length > 0,
					pageCount: ocrResult.pageCount,
				};

				if (ocrResult.text.length > 0) {
					text = ocrResult.text;
					needsOcr = false;
					message = "Text extracted via Document AI OCR.";
				} else {
					message = "Document AI OCR did not detect readable text.";
				}
			} catch (ocrError) {
				console.error("[ingest] Document AI OCR failed", ocrError);
				ocrSummary = {
					provider: "documentai",
					success: false,
					pageCount: 0,
				};
				message = "OCR fallback failed. Please try again later.";
			}
		}

		// 4) Normalize text into sections for your own UI
		const sections = normalizePdfText(text);

		// 5) Call your Agent Builder workflow:
		//    - Start node has `input_as_text`
		//    - We pass the PDF text as `input` (a plain string)
		let lessonWorkflow: IngestResponse["lessonWorkflow"] | undefined;

		if (!needsOcr && text.trim().length > 0 && process.env.LESSON_WORKFLOW_ID) {
			try {
				const workflowResponse = await openai.responses.create({
					// For workflows, you typically set model to the workflow id
					// (or `workflow://<id>` depending on how it was given to you).
					model: process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID,
					input: text,
				});

				lessonWorkflow = {
					responseId: workflowResponse.id,
				};
			} catch (workflowError) {
				console.error(
					"[ingest] Failed to trigger lesson workflow",
					workflowError
				);
			}
		}

		const response: IngestResponse = {
			metadata: parsed.metadata,
			needsOcr,
			sections,
			ocr: ocrSummary,
			message,
			lessonWorkflow,
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
