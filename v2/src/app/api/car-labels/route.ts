import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  normalizeCarLabels,
  validateCarLabels,
  type CarLabelSet,
} from "@/components/carLabels";
import { CAR_CHAPTERS } from "@/components/carSequenceModel";

const LABELS_FILE = path.join(process.cwd(), "src/components/carLabels.json");

/**
 * Saves the /car placement tool's labels straight into carLabels.json, so
 * placing them never means editing code. It writes to the source tree, so it
 * only exists under `next dev`: a deployed site has no source tree to write to,
 * and nobody should be able to rewrite its labels.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ errors: ["Request was not JSON"] }, { status: 400 });
  }

  const errors = validateCarLabels(body, CAR_CHAPTERS);
  if (errors.length) return Response.json({ errors }, { status: 400 });

  const labels = normalizeCarLabels(body as CarLabelSet, CAR_CHAPTERS);
  await writeFile(LABELS_FILE, `${JSON.stringify(labels, null, 2)}\n`);
  return Response.json({ labels });
}
