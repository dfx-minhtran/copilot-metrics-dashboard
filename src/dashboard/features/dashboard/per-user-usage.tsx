'use client';

import { useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useDashboard, dashboardStore } from "./dashboard-state";
import { ChartHeader } from "./charts/chart-header";

export const PerUserUsage = () => {
  const dashboard = useDashboard();

  useEffect(() => {
    dashboardStore.loadPerUserMetrics();
  }, []);

  const handleLoad28Day = () => {
    dashboardStore.loadPerUserMetrics();
  };

  const selectedSeries = dashboard.selectedUserSeries;

  const chartData =
    selectedSeries?.daily.map((d) => ({
      day: d.day,
      interactions: d.user_initiated_interaction_count,
      generations: d.code_generation_activity_count,
      acceptances: d.code_acceptance_activity_count,
    })) || [];

  const ideData =
    selectedSeries?.by_ide.map((item) => ({
      ide: item.ide,
      interactions: item.interactions,
      generations: item.generations,
      acceptances: item.acceptances,
    })) || [];

  const featureData =
    selectedSeries?.by_feature.map((item) => ({
      feature: item.feature,
      interactions: item.interactions,
      generations: item.generations,
      acceptances: item.acceptances,
    })) || [];

  const languageData = (() => {
    if (!selectedSeries) return [];
    const map = new Map<
      string,
      {
        language: string;
        generations: number;
        acceptances: number;
      }
    >();

    selectedSeries.by_language_feature.forEach((item) => {
      const current =
        map.get(item.language) || {
          language: item.language,
          generations: 0,
          acceptances: 0,
        };
      current.generations += item.generations;
      current.acceptances += item.acceptances;
      map.set(item.language, current);
    });

    selectedSeries.by_language_model.forEach((item) => {
      const current =
        map.get(item.language) || {
          language: item.language,
          generations: 0,
          acceptances: 0,
        };
      current.generations += item.generations;
      current.acceptances += item.acceptances;
      map.set(item.language, current);
    });

    return Array.from(map.values());
  })();

  const modelData =
    selectedSeries?.by_model_feature.map((item) => ({
      model: item.model,
      interactions: item.interactions,
      generations: item.generations,
      acceptances: item.acceptances,
    })) || [];

  return (
    <Card className="col-span-4">
      <ChartHeader
        title="Usage per user (28-day)"
        description="Per-user interactions, generations, and acceptances over the latest 28 days."
      />
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Users</span>
            <span className="text-xs text-muted-foreground">
              Click a row to see the daily trend for that user. Data loads automatically.
            </span>
          </div>
          <button
            type="button"
            onClick={handleLoad28Day}
            disabled={dashboard.isLoading}
            className="inline-flex items-center rounded-md border px-3 py-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {dashboard.isLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {dashboard.perUserError && (
          <p className="text-sm text-red-600">{dashboard.perUserError}</p>
        )}

        {dashboard.perUserSeries.length > 0 && (
          <div className="overflow-x-auto rounded-md border max-h-64">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">User</th>
                  <th className="px-4 py-2 text-left font-medium">Interactions</th>
                  <th className="px-4 py-2 text-left font-medium">Generations</th>
                  <th className="px-4 py-2 text-left font-medium">Acceptances</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dashboard.perUserSeries.map((series) => (
                  <tr
                    key={series.user_login}
                    className={`cursor-pointer hover:bg-muted/60 ${
                      dashboard.selectedUserLogin === series.user_login
                        ? "bg-muted"
                        : ""
                    }`}
                    onClick={() =>
                      dashboardStore.selectUser(series.user_login)
                    }
                  >
                    <td className="px-4 py-2">{series.user_login}</td>
                    <td className="px-4 py-2">{series.total_interactions}</td>
                    <td className="px-4 py-2">{series.total_generations}</td>
                    <td className="px-4 py-2">{series.total_acceptances}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!dashboard.perUserError &&
          dashboard.perUserSeries.length === 0 &&
          !dashboard.isLoading && (
            <p className="text-sm text-muted-foreground">
              Loading 28-day per-user usage from GitHub…
            </p>
          )}

        {selectedSeries && chartData.length > 0 && (
          <div className="mt-4">
            <ChartContainer
              config={timelineChartConfig}
              className="w-full h-80"
            >
              <AreaChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  allowDataOverflow
                />
                <XAxis
                  dataKey={timelineChartConfig.day.key}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                />
                <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
                <Area
                  dataKey={timelineChartConfig.interactions.key}
                  type="linear"
                  fill="hsl(var(--chart-2))"
                  stroke="hsl(var(--chart-2))"
                />
                <Area
                  dataKey={timelineChartConfig.generations.key}
                  type="linear"
                  fill="hsl(var(--chart-1))"
                  stroke="hsl(var(--chart-1))"
                  fillOpacity={0.6}
                />
                <Area
                  dataKey={timelineChartConfig.acceptances.key}
                  type="linear"
                  fill="hsl(var(--chart-3))"
                  stroke="hsl(var(--chart-3))"
                  fillOpacity={0.4}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
            <p className="mt-2 text-xs text-muted-foreground">
              Showing 28-day usage for{" "}
              <span className="font-medium">{selectedSeries.user_login}</span>.
            </p>
          </div>
        )}
        {selectedSeries && ideData.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-2">By IDE</h3>
            <ChartContainer
              config={ideChartConfig}
              className="w-full h-64"
            >
              <BarChart accessibilityLayer data={ideData}>
                <CartesianGrid vertical={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  allowDataOverflow
                />
                <XAxis
                  dataKey={ideChartConfig.ide.key}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={16}
                />
                <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
                <Bar
                  dataKey={ideChartConfig.interactions.key}
                  fill="hsl(var(--chart-2))"
                  radius={4}
                />
                <Bar
                  dataKey={ideChartConfig.generations.key}
                  fill="hsl(var(--chart-1))"
                  radius={4}
                />
                <Bar
                  dataKey={ideChartConfig.acceptances.key}
                  fill="hsl(var(--chart-3))"
                  radius={4}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </BarChart>
            </ChartContainer>
          </div>
        )}
        {selectedSeries && featureData.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-2">By feature</h3>
            <ChartContainer
              config={featureChartConfig}
              className="w-full h-64"
            >
              <BarChart accessibilityLayer data={featureData}>
                <CartesianGrid vertical={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  allowDataOverflow
                />
                <XAxis
                  dataKey={featureChartConfig.feature.key}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={16}
                />
                <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
                <Bar
                  dataKey={featureChartConfig.interactions.key}
                  fill="hsl(var(--chart-2))"
                  radius={4}
                />
                <Bar
                  dataKey={featureChartConfig.generations.key}
                  fill="hsl(var(--chart-1))"
                  radius={4}
                />
                <Bar
                  dataKey={featureChartConfig.acceptances.key}
                  fill="hsl(var(--chart-3))"
                  radius={4}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </BarChart>
            </ChartContainer>
          </div>
        )}
        {selectedSeries && languageData.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-2">By language</h3>
            <ChartContainer
              config={languageChartConfig}
              className="w-full h-64"
            >
              <BarChart accessibilityLayer data={languageData}>
                <CartesianGrid vertical={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  allowDataOverflow
                />
                <XAxis
                  dataKey={languageChartConfig.language.key}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={16}
                />
                <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
                <Bar
                  dataKey={languageChartConfig.generations.key}
                  fill="hsl(var(--chart-2))"
                  radius={4}
                />
                <Bar
                  dataKey={languageChartConfig.acceptances.key}
                  fill="hsl(var(--chart-1))"
                  radius={4}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </BarChart>
            </ChartContainer>
          </div>
        )}
        {selectedSeries && modelData.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-2">By model</h3>
            <ChartContainer
              config={modelChartConfig}
              className="w-full h-64"
            >
              <BarChart accessibilityLayer data={modelData}>
                <CartesianGrid vertical={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  allowDataOverflow
                />
                <XAxis
                  dataKey={modelChartConfig.model.key}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={16}
                />
                <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
                <Bar
                  dataKey={modelChartConfig.interactions.key}
                  fill="hsl(var(--chart-2))"
                  radius={4}
                />
                <Bar
                  dataKey={modelChartConfig.generations.key}
                  fill="hsl(var(--chart-1))"
                  radius={4}
                />
                <Bar
                  dataKey={modelChartConfig.acceptances.key}
                  fill="hsl(var(--chart-3))"
                  radius={4}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const timelineChartConfig = {
  day: {
    label: "Day",
    key: "day",
  },
  interactions: {
    label: "Interactions",
    key: "interactions",
  },
  generations: {
    label: "Generations",
    key: "generations",
  },
  acceptances: {
    label: "Acceptances",
    key: "acceptances",
  },
};

const ideChartConfig = {
  ide: {
    label: "IDE",
    key: "ide",
  },
  interactions: {
    label: "Interactions",
    key: "interactions",
  },
  generations: {
    label: "Generations",
    key: "generations",
  },
  acceptances: {
    label: "Acceptances",
    key: "acceptances",
  },
};

const featureChartConfig = {
  feature: {
    label: "Feature",
    key: "feature",
  },
  interactions: {
    label: "Interactions",
    key: "interactions",
  },
  generations: {
    label: "Generations",
    key: "generations",
  },
  acceptances: {
    label: "Acceptances",
    key: "acceptances",
  },
};

const languageChartConfig = {
  language: {
    label: "Language",
    key: "language",
  },
  generations: {
    label: "Generations",
    key: "generations",
  },
  acceptances: {
    label: "Acceptances",
    key: "acceptances",
  },
};

const modelChartConfig = {
  model: {
    label: "Model",
    key: "model",
  },
  interactions: {
    label: "Interactions",
    key: "interactions",
  },
  generations: {
    label: "Generations",
    key: "generations",
  },
  acceptances: {
    label: "Acceptances",
    key: "acceptances",
  },
};
