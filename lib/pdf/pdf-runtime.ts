import { dirname, join } from "node:path";
import type { PDFParse } from "pdf-parse";

type CreateRequireFn = typeof import("module").createRequire;

const runtimeCache: {
	createRequire?: CreateRequireFn;
	pdfParseModule?: typeof import("pdf-parse");
	workerPath?: string;
} = {};

export async function getCreateRequire(): Promise<CreateRequireFn> {
	if (runtimeCache.createRequire) {
		return runtimeCache.createRequire;
	}

	const moduleNs =
		(await import("node:module").catch(() => null)) ??
		(await import("module"));
	const createRequireFn =
		(moduleNs as { createRequire?: CreateRequireFn })?.createRequire ??
		(moduleNs as { default?: { createRequire?: CreateRequireFn } })?.default
			?.createRequire;

	if (typeof createRequireFn !== "function") {
		throw new Error("createRequire is unavailable in this runtime");
	}

	runtimeCache.createRequire = createRequireFn;
	return createRequireFn;
}

export async function getPdfParseModule(): Promise<{ PDFParse: typeof PDFParse }> {
	if (runtimeCache.pdfParseModule) {
		return runtimeCache.pdfParseModule as { PDFParse: typeof PDFParse };
	}

	const createRequireFn = await getCreateRequire();
	const require = createRequireFn(import.meta.url);
	runtimeCache.pdfParseModule = require("pdf-parse");
	return runtimeCache.pdfParseModule as { PDFParse: typeof PDFParse };
}

export async function getWorkerPath() {
	if (runtimeCache.workerPath) {
		return runtimeCache.workerPath;
	}

	const createRequireFn = await getCreateRequire();
	const appRequire = createRequireFn(import.meta.url);

	try {
		const pdfParseEntry = appRequire.resolve("pdf-parse");
		const pdfParseDir = dirname(pdfParseEntry);
		const scopedRequire = createRequireFn(join(pdfParseDir, "package.json"));
		runtimeCache.workerPath = scopedRequire.resolve(
			"pdfjs-dist/legacy/build/pdf.worker.mjs"
		);
		return runtimeCache.workerPath;
	} catch {
		runtimeCache.workerPath = appRequire.resolve(
			"pdfjs-dist/legacy/build/pdf.worker.mjs"
		);
		return runtimeCache.workerPath;
	}
}
