import { CLOUDLAB_URLS, parseStatsGrid } from "@/lib/cloudlab";
import { fetchCloudLab, validateCloudLabResponse } from "@/lib/cloudlab/http";
import { requireSession, successJson, withErrorHandler } from "@/lib/api-utils";

async function handleDashboard(request: Request): Promise<Response> {
  const [cookie, authError] = requireSession(request);
  if (authError) return authError;

  const result = await fetchCloudLab(CLOUDLAB_URLS.dashboard, {
    cookie,
    referer: CLOUDLAB_URLS.dashboard,
  });

  const validationError = validateCloudLabResponse(result, "dashboard");
  if (validationError) return validationError;

  return successJson(parseStatsGrid(result.html));
}

export const GET = withErrorHandler(handleDashboard);
