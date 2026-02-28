import { formatResponseError, unknownResponseError } from "@/features/common/response-error";
import {
  CopilotUsers1DayReportLinks,
  CopilotUsers28DayReportLinks,
  PerUserSeries,
  PerUserDailyUsage,
  PerUserIdeSummary,
  PerUserFeatureSummary,
  PerUserLanguageFeatureSummary,
  PerUserLanguageModelSummary,
  PerUserModelFeatureSummary,
} from "@/features/common/models";
import { ServerActionResponse } from "@/features/common/server-action-response";
import { ensureGitHubEnvConfig } from "./env-service";

export interface PerUserMetricsFilter {
  day?: Date;
  enterprise: string;
  organization: string;
}

type UsersReportResponse<T> = ServerActionResponse<T>;

const buildUsersReportUrl = (
  scope: "enterprise" | "organization",
  path: "users-1-day" | "users-28-day/latest",
  enterprise: string,
  organization: string,
  day?: string
): string => {
  const base =
    scope === "enterprise"
      ? `https://api.github.com/enterprises/${enterprise}/copilot/metrics/reports/${path}`
      : `https://api.github.com/orgs/${organization}/copilot/metrics/reports/${path}`;

  if (path === "users-1-day" && day) {
    const url = new URL(base);
    url.searchParams.set("day", day);
    return url.toString();
  }

  return base;
};

const fetchUsersReport = async <T>(
  url: string,
  token: string,
  version: string,
  entityName: string
): Promise<UsersReportResponse<T>> => {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": version,
      },
    });

    if (!response.ok) {
      return formatResponseError(entityName, response);
    }

    const data = (await response.json()) as T;

    return {
      status: "OK",
      response: data,
    };
  } catch (e) {
    return unknownResponseError(e);
  }
};

export const getPerUserMetrics1DayReport = async (
  filter: PerUserMetricsFilter
): Promise<UsersReportResponse<CopilotUsers1DayReportLinks>> => {
  const env = ensureGitHubEnvConfig();

  if (env.status !== "OK") {
    return env as UsersReportResponse<CopilotUsers1DayReportLinks>;
  }

  const { enterprise, organization, token, version } = env.response;

  const scope =
    process.env.GITHUB_API_SCOPE === "enterprise" ? "enterprise" : "organization";

  const effectiveEnterprise = filter.enterprise || enterprise;
  const effectiveOrganization = filter.organization || organization;

  const day =
    filter.day ??
    (filter.day === undefined ? new Date() : filter.day); // fallback to today if not provided

  const dayString = day.toISOString().slice(0, 10);

  const url = buildUsersReportUrl(
    scope,
    "users-1-day",
    effectiveEnterprise,
    effectiveOrganization,
    dayString
  );

  const entityName =
    scope === "enterprise" ? effectiveEnterprise : effectiveOrganization;

  return fetchUsersReport<CopilotUsers1DayReportLinks>(
    url,
    token,
    version,
    entityName
  );
};

export const getPerUserMetrics28DayLatestReport = async (
  filter: PerUserMetricsFilter
): Promise<UsersReportResponse<CopilotUsers28DayReportLinks>> => {
  const env = ensureGitHubEnvConfig();

  if (env.status !== "OK") {
    return env as UsersReportResponse<CopilotUsers28DayReportLinks>;
  }

  const { enterprise, organization, token, version } = env.response;

  const scope =
    process.env.GITHUB_API_SCOPE === "enterprise" ? "enterprise" : "organization";

  const effectiveEnterprise = filter.enterprise || enterprise;
  const effectiveOrganization = filter.organization || organization;

  const url = buildUsersReportUrl(
    scope,
    "users-28-day/latest",
    effectiveEnterprise,
    effectiveOrganization
  );

  const entityName =
    scope === "enterprise" ? effectiveEnterprise : effectiveOrganization;

  return fetchUsersReport<CopilotUsers28DayReportLinks>(
    url,
    token,
    version,
    entityName
  );
};

interface RawPerUserRecord {
  report_start_day: string;
  report_end_day: string;
  day: string;
  user_login: string;
  user_initiated_interaction_count: number;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  loc_suggested_to_add_sum: number;
  loc_suggested_to_delete_sum: number;
  loc_added_sum: number;
  loc_deleted_sum: number;
  totals_by_ide?: Array<{
    ide: string;
    user_initiated_interaction_count: number;
    code_generation_activity_count: number;
    code_acceptance_activity_count: number;
    loc_suggested_to_add_sum: number;
    loc_suggested_to_delete_sum: number;
    loc_added_sum: number;
    loc_deleted_sum: number;
  }>;
  totals_by_feature?: Array<{
    feature: string;
    user_initiated_interaction_count: number;
    code_generation_activity_count: number;
    code_acceptance_activity_count: number;
    loc_suggested_to_add_sum: number;
    loc_suggested_to_delete_sum: number;
    loc_added_sum: number;
    loc_deleted_sum: number;
  }>;
  totals_by_language_feature?: Array<{
    language: string;
    feature: string;
    code_generation_activity_count: number;
    code_acceptance_activity_count: number;
    loc_suggested_to_add_sum: number;
    loc_suggested_to_delete_sum: number;
    loc_added_sum: number;
    loc_deleted_sum: number;
  }>;
  totals_by_language_model?: Array<{
    language: string;
    model: string;
    code_generation_activity_count: number;
    code_acceptance_activity_count: number;
    loc_suggested_to_add_sum: number;
    loc_suggested_to_delete_sum: number;
    loc_added_sum: number;
    loc_deleted_sum: number;
  }>;
  totals_by_model_feature?: Array<{
    model: string;
    feature: string;
    user_initiated_interaction_count: number;
    code_generation_activity_count: number;
    code_acceptance_activity_count: number;
    loc_suggested_to_add_sum: number;
    loc_suggested_to_delete_sum: number;
    loc_added_sum: number;
    loc_deleted_sum: number;
  }>;
}

const parsePerUserNdjson = (text: string): RawPerUserRecord[] => {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  const records: RawPerUserRecord[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as RawPerUserRecord;
      if (parsed && parsed.user_login && parsed.day) {
        records.push(parsed);
      }
    } catch {
      // ignore malformed lines
    }
  }

  return records;
};

export const getPerUserMetrics28DayUsage = async (
  filter: PerUserMetricsFilter
): Promise<UsersReportResponse<{ series: PerUserSeries[] }>> => {
  const linksResult = await getPerUserMetrics28DayLatestReport(filter);

  if (linksResult.status !== "OK") {
    return linksResult as UsersReportResponse<{ series: PerUserSeries[] }>;
  }

  const links = linksResult.response.download_links;
  if (!links || links.length === 0) {
    return {
      status: "OK",
      response: { series: [] },
    };
  }

  try {
    const response = await fetch(links[0], { cache: "no-store" });
    if (!response.ok) {
      return formatResponseError(
        filter.organization || filter.enterprise,
        response
      ) as UsersReportResponse<{ series: PerUserSeries[] }>;
    }

    const text = await response.text();
    const records = parsePerUserNdjson(text);

    const byUser = new Map<string, PerUserSeries>();
    const ideAgg = new Map<string, Map<string, PerUserIdeSummary>>();
    const featureAgg = new Map<string, Map<string, PerUserFeatureSummary>>();
    const langFeatureAgg = new Map<
      string,
      Map<string, PerUserLanguageFeatureSummary>
    >();
    const langModelAgg = new Map<
      string,
      Map<string, PerUserLanguageModelSummary>
    >();
    const modelFeatureAgg = new Map<
      string,
      Map<string, PerUserModelFeatureSummary>
    >();

    const locAgg = new Map<
      string,
      {
        total_loc_suggested_to_add: number;
        total_loc_suggested_to_delete: number;
        total_loc_added: number;
        total_loc_deleted: number;
      }
    >();

    records.forEach((record) => {
      const existing = byUser.get(record.user_login);
      const daily: PerUserDailyUsage = {
        day: record.day,
        user_login: record.user_login,
        user_initiated_interaction_count:
          record.user_initiated_interaction_count,
        code_generation_activity_count: record.code_generation_activity_count,
        code_acceptance_activity_count: record.code_acceptance_activity_count,
      };

      if (!existing) {
        byUser.set(record.user_login, {
          user_login: record.user_login,
          total_interactions: record.user_initiated_interaction_count,
          total_generations: record.code_generation_activity_count,
          total_acceptances: record.code_acceptance_activity_count,
          total_loc_suggested_to_add: record.loc_suggested_to_add_sum || 0,
          total_loc_suggested_to_delete:
            record.loc_suggested_to_delete_sum || 0,
          total_loc_added: record.loc_added_sum || 0,
          total_loc_deleted: record.loc_deleted_sum || 0,
          daily: [daily],
          by_ide: [],
          by_feature: [],
          by_language_feature: [],
          by_language_model: [],
          by_model_feature: [],
        });
      } else {
        existing.total_interactions += record.user_initiated_interaction_count;
        existing.total_generations += record.code_generation_activity_count;
        existing.total_acceptances += record.code_acceptance_activity_count;
        existing.total_loc_suggested_to_add +=
          record.loc_suggested_to_add_sum || 0;
        existing.total_loc_suggested_to_delete +=
          record.loc_suggested_to_delete_sum || 0;
        existing.total_loc_added += record.loc_added_sum || 0;
        existing.total_loc_deleted += record.loc_deleted_sum || 0;
        existing.daily.push(daily);
      }

      const currentLoc = locAgg.get(record.user_login) || {
        total_loc_suggested_to_add: 0,
        total_loc_suggested_to_delete: 0,
        total_loc_added: 0,
        total_loc_deleted: 0,
      };
      currentLoc.total_loc_suggested_to_add +=
        record.loc_suggested_to_add_sum || 0;
      currentLoc.total_loc_suggested_to_delete +=
        record.loc_suggested_to_delete_sum || 0;
      currentLoc.total_loc_added += record.loc_added_sum || 0;
      currentLoc.total_loc_deleted += record.loc_deleted_sum || 0;
      locAgg.set(record.user_login, currentLoc);

      if (record.totals_by_ide && record.totals_by_ide.length > 0) {
        let userIdeMap = ideAgg.get(record.user_login);
        if (!userIdeMap) {
          userIdeMap = new Map<string, PerUserIdeSummary>();
          ideAgg.set(record.user_login, userIdeMap);
        }
        record.totals_by_ide.forEach((item) => {
          const existingSummary = userIdeMap!.get(item.ide) || {
            ide: item.ide,
            interactions: 0,
            generations: 0,
            acceptances: 0,
            loc_suggested_to_add_sum: 0,
            loc_suggested_to_delete_sum: 0,
            loc_added_sum: 0,
            loc_deleted_sum: 0,
          };
          existingSummary.interactions +=
            item.user_initiated_interaction_count || 0;
          existingSummary.generations +=
            item.code_generation_activity_count || 0;
          existingSummary.acceptances +=
            item.code_acceptance_activity_count || 0;
          existingSummary.loc_suggested_to_add_sum +=
            item.loc_suggested_to_add_sum || 0;
          existingSummary.loc_suggested_to_delete_sum +=
            item.loc_suggested_to_delete_sum || 0;
          existingSummary.loc_added_sum += item.loc_added_sum || 0;
          existingSummary.loc_deleted_sum += item.loc_deleted_sum || 0;
          userIdeMap!.set(item.ide, existingSummary);
        });
      }

      if (record.totals_by_feature && record.totals_by_feature.length > 0) {
        let userFeatureMap = featureAgg.get(record.user_login);
        if (!userFeatureMap) {
          userFeatureMap = new Map<string, PerUserFeatureSummary>();
          featureAgg.set(record.user_login, userFeatureMap);
        }
        record.totals_by_feature.forEach((item) => {
          const key = item.feature;
          const existingSummary = userFeatureMap!.get(key) || {
            feature: item.feature,
            interactions: 0,
            generations: 0,
            acceptances: 0,
            loc_suggested_to_add_sum: 0,
            loc_suggested_to_delete_sum: 0,
            loc_added_sum: 0,
            loc_deleted_sum: 0,
          };
          existingSummary.interactions +=
            item.user_initiated_interaction_count || 0;
          existingSummary.generations +=
            item.code_generation_activity_count || 0;
          existingSummary.acceptances +=
            item.code_acceptance_activity_count || 0;
          existingSummary.loc_suggested_to_add_sum +=
            item.loc_suggested_to_add_sum || 0;
          existingSummary.loc_suggested_to_delete_sum +=
            item.loc_suggested_to_delete_sum || 0;
          existingSummary.loc_added_sum += item.loc_added_sum || 0;
          existingSummary.loc_deleted_sum += item.loc_deleted_sum || 0;
          userFeatureMap!.set(key, existingSummary);
        });
      }

      if (
        record.totals_by_language_feature &&
        record.totals_by_language_feature.length > 0
      ) {
        let userLangFeatureMap = langFeatureAgg.get(record.user_login);
        if (!userLangFeatureMap) {
          userLangFeatureMap = new Map<
            string,
            PerUserLanguageFeatureSummary
          >();
          langFeatureAgg.set(record.user_login, userLangFeatureMap);
        }
        record.totals_by_language_feature.forEach((item) => {
          const key = `${item.language}::${item.feature}`;
          const existingSummary = userLangFeatureMap!.get(key) || {
            language: item.language,
            feature: item.feature,
            generations: 0,
            acceptances: 0,
            loc_suggested_to_add_sum: 0,
            loc_suggested_to_delete_sum: 0,
            loc_added_sum: 0,
            loc_deleted_sum: 0,
          };
          existingSummary.generations +=
            item.code_generation_activity_count || 0;
          existingSummary.acceptances +=
            item.code_acceptance_activity_count || 0;
          existingSummary.loc_suggested_to_add_sum +=
            item.loc_suggested_to_add_sum || 0;
          existingSummary.loc_suggested_to_delete_sum +=
            item.loc_suggested_to_delete_sum || 0;
          existingSummary.loc_added_sum += item.loc_added_sum || 0;
          existingSummary.loc_deleted_sum += item.loc_deleted_sum || 0;
          userLangFeatureMap!.set(key, existingSummary);
        });
      }

      if (
        record.totals_by_language_model &&
        record.totals_by_language_model.length > 0
      ) {
        let userLangModelMap = langModelAgg.get(record.user_login);
        if (!userLangModelMap) {
          userLangModelMap = new Map<string, PerUserLanguageModelSummary>();
          langModelAgg.set(record.user_login, userLangModelMap);
        }
        record.totals_by_language_model.forEach((item) => {
          const key = `${item.language}::${item.model}`;
          const existingSummary = userLangModelMap!.get(key) || {
            language: item.language,
            model: item.model,
            generations: 0,
            acceptances: 0,
            loc_suggested_to_add_sum: 0,
            loc_suggested_to_delete_sum: 0,
            loc_added_sum: 0,
            loc_deleted_sum: 0,
          };
          existingSummary.generations +=
            item.code_generation_activity_count || 0;
          existingSummary.acceptances +=
            item.code_acceptance_activity_count || 0;
          existingSummary.loc_suggested_to_add_sum +=
            item.loc_suggested_to_add_sum || 0;
          existingSummary.loc_suggested_to_delete_sum +=
            item.loc_suggested_to_delete_sum || 0;
          existingSummary.loc_added_sum += item.loc_added_sum || 0;
          existingSummary.loc_deleted_sum += item.loc_deleted_sum || 0;
          userLangModelMap!.set(key, existingSummary);
        });
      }

      if (
        record.totals_by_model_feature &&
        record.totals_by_model_feature.length > 0
      ) {
        let userModelFeatureMap = modelFeatureAgg.get(record.user_login);
        if (!userModelFeatureMap) {
          userModelFeatureMap = new Map<string, PerUserModelFeatureSummary>();
          modelFeatureAgg.set(record.user_login, userModelFeatureMap);
        }
        record.totals_by_model_feature.forEach((item) => {
          const key = `${item.model}::${item.feature}`;
          const existingSummary = userModelFeatureMap!.get(key) || {
            model: item.model,
            feature: item.feature,
            interactions: 0,
            generations: 0,
            acceptances: 0,
            loc_suggested_to_add_sum: 0,
            loc_suggested_to_delete_sum: 0,
            loc_added_sum: 0,
            loc_deleted_sum: 0,
          };
          existingSummary.interactions +=
            item.user_initiated_interaction_count || 0;
          existingSummary.generations +=
            item.code_generation_activity_count || 0;
          existingSummary.acceptances +=
            item.code_acceptance_activity_count || 0;
          existingSummary.loc_suggested_to_add_sum +=
            item.loc_suggested_to_add_sum || 0;
          existingSummary.loc_suggested_to_delete_sum +=
            item.loc_suggested_to_delete_sum || 0;
          existingSummary.loc_added_sum += item.loc_added_sum || 0;
          existingSummary.loc_deleted_sum += item.loc_deleted_sum || 0;
          userModelFeatureMap!.set(key, existingSummary);
        });
      }
    });

    byUser.forEach((series) => {
      series.daily.sort((a, b) => a.day.localeCompare(b.day));

      const userLogin = series.user_login;
      const ideMap = ideAgg.get(userLogin);
      const featureMap = featureAgg.get(userLogin);
      const langFeatureMap = langFeatureAgg.get(userLogin);
      const langModelMap = langModelAgg.get(userLogin);
      const modelFeatureMap = modelFeatureAgg.get(userLogin);

      series.by_ide = ideMap ? Array.from(ideMap.values()) : [];
      series.by_feature = featureMap ? Array.from(featureMap.values()) : [];
      series.by_language_feature = langFeatureMap
        ? Array.from(langFeatureMap.values())
        : [];
      series.by_language_model = langModelMap
        ? Array.from(langModelMap.values())
        : [];
      series.by_model_feature = modelFeatureMap
        ? Array.from(modelFeatureMap.values())
        : [];

      const totals = locAgg.get(userLogin);
      if (totals) {
        series.total_loc_suggested_to_add =
          totals.total_loc_suggested_to_add;
        series.total_loc_suggested_to_delete =
          totals.total_loc_suggested_to_delete;
        series.total_loc_added = totals.total_loc_added;
        series.total_loc_deleted = totals.total_loc_deleted;
      }
    });

    return {
      status: "OK",
      response: {
        series: Array.from(byUser.values()).sort(
          (a, b) => b.total_interactions - a.total_interactions
        ),
      },
    };
  } catch (e) {
    return unknownResponseError(e) as UsersReportResponse<{
      series: PerUserSeries[];
    }>;
  }
};

