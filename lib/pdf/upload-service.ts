import { Buffer } from "node:buffer";

import { extractPdfText, type ParsedPdf } from "./pdf-parser";
import {
	normalizePdfText,
	type NormalizedSection,
} from "./pdf-normalizer";
import { runDocumentAiOcr } from "./document-ai-ocr";

export type OcrSummary =
	| {
			provider: "documentai";
			success: boolean;
			pageCount: number;
	  }
	| undefined;

export type ProcessedUpload = {
	metadata: ParsedPdf["metadata"];
	sections: NormalizedSection[];
	text: string;
	needsOcr: boolean;
	message?: string;
	ocr?: OcrSummary;
};

const MIN_EMBEDDED_TEXT_CHARACTERS = 25;

function requiresOcrFallback(text: string): boolean {
	const compact = text.replace(/\s+/g, "");
	if (compact.length === 0) return true;
	return compact.length < MIN_EMBEDDED_TEXT_CHARACTERS;
}

function assertPdf(file: File) {
	const isPdf =
		file.type === "application/pdf" ||
		(typeof file.name === "string" &&
			file.name.toLowerCase().endsWith(".pdf"));

	if (!isPdf) {
		throw new Error("Only PDF uploads are supported.");
	}
}

export async function processPdfUpload(file: File): Promise<ProcessedUpload> {
	assertPdf(file);

	const buffer = Buffer.from(await file.arrayBuffer());
	const parsed = await extractPdfText(buffer);

	let text = parsed.text;
	let needsOcr = requiresOcrFallback(text);
	let message: string | undefined = needsOcr
		? "Embedded text insufficient. OCR fallback required."
		: undefined;
	let ocrSummary: OcrSummary;

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
		} catch (error) {
			console.error("[upload-service] Document AI OCR failed", error);
			ocrSummary = {
				provider: "documentai",
				success: false,
				pageCount: 0,
			};
			message = "OCR fallback failed. Please try again later.";
		}
	}

	const sections = normalizePdfText(text);

	return {
		metadata: parsed.metadata,
		sections,
		text,
		needsOcr,
		message,
		ocr: ocrSummary,
	};
}
