import {
  CLOUDLAB_URLS,
  parseTableFromHtml,
  parseMiniStats,
  parseSummaryBox,
} from "@/lib/cloudlab";
import { fetchCloudLab, validateCloudLabResponse } from "@/lib/cloudlab/http";
import { requireSession, successJson, withErrorHandler } from "@/lib/api-utils";

async function handleHistory(request: Request): Promise<Response> {
  const [cookie, authError] = requireSession(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start_date") ?? "";
  const endDate = searchParams.get("end_date") ?? "";

  const url = new URL(CLOUDLAB_URLS.history);
  if (startDate) url.searchParams.set("start_date", startDate);
  if (endDate) url.searchParams.set("end_date", endDate);

  const result = await fetchCloudLab(url.toString(), {
    cookie,
    referer: CLOUDLAB_URLS.history,
  });

  const validationError = validateCloudLabResponse(result, "history");
  if (validationError) return validationError;

  const parsed = parseTableFromHtml(result.html);
  const summary = parseMiniStats(result.html);
  const summaryProfile = parseSummaryBox(result.html) ?? undefined;

  return successJson({ ...parsed, summary, summaryProfile });
}

export const GET = withErrorHandler(handleHistory);
