import { Buffer } from "node:buffer";
import type { LoadParameters } from "pdf-parse";
import { pathToFileURL } from "node:url";

import { getPdfParseModule, getWorkerPath } from "./pdf-runtime";
import type { PDFParse } from "pdf-parse";

// Configure worker for Node.js environment (Next.js requires explicit path)
let workerConfigured = false;
type PdfParseInstance = import("pdf-parse").PDFParse;
// Quick heuristics to skip pdf-parse when the document is clearly image-only.
const SAMPLE_BYTES = 32 * 1024;
const MIN_TEXTUAL_RATIO = 0.015;
const TEXT_MARKERS = ["/Font", "/ToUnicode", "BT", "Tf"];

async function ensureWorkerConfigured() {
	if (!workerConfigured) {
		try {
			const workerPath = await getWorkerPath();
			const { PDFParse } = await getPdfParseModule();

			// Convert to file:// URL for Node.js dynamic import
			const workerUrl = pathToFileURL(workerPath).href;

			// Set worker with the file URL
			PDFParse.setWorker(workerUrl);

			workerConfigured = true;
		} catch (error) {
			console.error("[pdf-parser] Failed to configure worker:", error);
			throw new Error("Failed to configure PDF worker");
		}
	}
}

/**
 * Metadata extracted from a PDF document
 */
export interface PdfMetadata {
	title?: string;
	author?: string;
	creator?: string;
	producer?: string;
	subject?: string;
	keywords?: string;
	creationDate?: Date | null;
	modificationDate?: Date | null;
	pageCount: number;
}

/**
 * Result of parsing a PDF document
 */
export interface ParsedPdf {
	text: string;
	metadata: PdfMetadata;
}

/**
 * Extracts text and metadata from a PDF buffer
 *
 * @param buffer - PDF file as a Buffer or Uint8Array
 * @returns Parsed PDF with text content and metadata
 *
 * @example
 * ```typescript
 * const buffer = await fs.readFile('document.pdf');
 * const result = await extractPdfText(buffer);
 * console.log(result.text);
 * console.log(result.metadata.title);
 * ```
 */
export async function extractPdfText(
	buffer: Buffer | Uint8Array
): Promise<ParsedPdf> {
	if (isLikelyImageOnlyPdf(buffer)) {
		return {
			text: "",
			metadata: {
				pageCount: 0,
			},
		};
	}

	let parser: PdfParseInstance | null = null;
	const pdfParseModule = await getPdfParseModule();
	const PDFParseCtor: typeof PDFParse | undefined = pdfParseModule?.PDFParse;
	if (!PDFParseCtor) {
		throw new Error("PDFParse constructor unavailable");
	}

	try {
		// Ensure worker is configured before creating parser instance
		await ensureWorkerConfigured();

		// Configure pdf-parse with the buffer data
		const loadParams: LoadParameters = {
			data: buffer,
		};

	parser = new PDFParseCtor(loadParams);

		// Extract text content
		const textResult = await parser.getText();

		// Extract metadata and document info
		const infoResult = await parser.getInfo();

		// Build metadata object with basic fields
		const metadata: PdfMetadata = {
			title: infoResult.info?.Title,
			author: infoResult.info?.Author,
			creator: infoResult.info?.Creator,
			producer: infoResult.info?.Producer,
			subject: infoResult.info?.Subject,
			keywords: infoResult.info?.Keywords,
			creationDate: infoResult.info?.CreationDate,
			modificationDate: infoResult.info?.ModDate,
			pageCount: infoResult.total,
		};

		return {
			text: textResult.text.trim(),
			metadata,
		};
	} catch (error) {
		// Log the error for debugging but return empty result gracefully
		console.error("[pdf-parser] Failed to extract PDF text:", error);

		// Return empty text with minimal metadata
		return {
			text: "",
			metadata: {
				pageCount: 0,
			},
		};
	} finally {
		// Always clean up resources
		if (parser) {
			try {
				await parser.destroy();
			} catch (cleanupError) {
				console.error("[pdf-parser] Failed to cleanup parser:", cleanupError);
			}
		}
	}
}

function isLikelyImageOnlyPdf(buffer: Buffer | Uint8Array): boolean {
	const sampleSource = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
	const sampleLength = Math.min(sampleSource.length, SAMPLE_BYTES);

	if (sampleLength === 0) {
		return true;
	}

	const sample = sampleSource.subarray(0, sampleLength).toString("latin1");
	const asciiMatches = sample.match(/[A-Za-z0-9]{3,}/g) ?? [];
	const asciiCharacterCount = asciiMatches.reduce(
		(total, match) => total + match.length,
		0
	);

	const asciiRatio = asciiCharacterCount / sampleLength;
	const hasTextMarkers = TEXT_MARKERS.some((marker) =>
		sample.includes(marker)
	);

	return asciiRatio < MIN_TEXTUAL_RATIO && !hasTextMarkers;
}
