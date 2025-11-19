import { NextRequest, NextResponse } from "next/server";
import { processPdfUpload } from "@/lib/pdf/upload-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();
		const file = formData.get("file");

		if (!file || !(file instanceof File)) {
			return NextResponse.json(
				{ error: "Expected a PDF file upload under the `file` field." },
				{ status: 400 },
			);
		}

		const upload = await processPdfUpload(file);

		return NextResponse.json({
			documentId: crypto.randomUUID(),
			metadata: upload.metadata,
			sections: upload.sections,
			message: upload.message,
			needsOcr: upload.needsOcr,
			ocr: upload.ocr,
		});
	} catch (error) {
		console.error("[uploads] Failed to process PDF", error);
		const detail =
			error instanceof Error ? error.message : "Unable to process PDF.";
		return NextResponse.json({ error: detail }, { status: 500 });
	}
}
