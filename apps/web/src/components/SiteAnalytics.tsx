import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Line } from "react-chartjs-2";

import {
  ApiError,
  createSiteMetric,
  deleteSiteMetric,
  getSiteAnalytics,
} from "../lib/api";
import type {
  MetricSeriesSummary,
  MetricType,
  Site,
  SiteAnalyticsResponse,
} from "../types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
);

interface SiteAnalyticsProps {
  token: string;
  projectId: string;
  site: Site;
  onClose: () => void;
}

interface MetricDefinition {
  label: string;
  shortLabel: string;
  unit: string;
  color: string;
  fill: string;
  description: string;
}

const METRICS: Record<MetricType, MetricDefinition> = {
  carbon_tonnes: {
    label: "Stored carbon",
    shortLabel: "Carbon",
    unit: "tCO₂e",
    color: "#167452",
    fill: "rgba(22, 116, 82, 0.12)",
    description: "Estimated carbon stock in tonnes of CO₂ equivalent.",
  },
  biodiversity_index: {
    label: "Biodiversity index",
    shortLabel: "Biodiversity",
    unit: "index",
    color: "#7d5ab5",
    fill: "rgba(125, 90, 181, 0.12)",
    description: "A consistent project-defined biodiversity score.",
  },
  vegetation_cover: {
    label: "Vegetation cover",
    shortLabel: "Vegetation",
    unit: "%",
    color: "#d97920",
    fill: "rgba(217, 121, 32, 0.12)",
    description: "The percentage of the site covered by vegetation.",
  },
};

const METRIC_TYPES = Object.keys(METRICS) as MetricType[];

function localDateTimeNow() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatValue(value: string | null, unit: string) {
  if (value === null) return "—";
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SiteAnalytics({
  token,
  projectId,
  site,
  onClose,
}: SiteAnalyticsProps) {
  const [analytics, setAnalytics] = useState<SiteAnalyticsResponse | null>(
    null,
  );
  const [selectedType, setSelectedType] =
    useState<MetricType>("vegetation_cover");
  const [entryType, setEntryType] = useState<MetricType>("vegetation_cover");
  const [value, setValue] = useState("");
  const [observedAt, setObservedAt] = useState(localDateTimeNow);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async () => {
    try {
      const response = await getSiteAnalytics(token, projectId, site.id);
      setAnalytics(response);
      setSelectedType((current) =>
        response.series.length > 0 &&
        !response.series.some((series) => series.metric_type === current)
          ? (response.series[0]?.metric_type ?? current)
          : current,
      );
      setError("");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to load site analytics",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, site.id, token]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const selectedSeries = analytics?.series.find(
    (series) => series.metric_type === selectedType,
  );
  const selectedDefinition = METRICS[selectedType];

  const chartData = useMemo(
    () => ({
      labels:
        selectedSeries?.points.map((point) =>
          new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            year: "2-digit",
          }).format(new Date(point.observed_at)),
        ) ?? [],
      datasets: [
        {
          label: `${selectedDefinition.label} (${selectedDefinition.unit})`,
          data:
            selectedSeries?.points.map((point) => Number(point.value)) ?? [],
          borderColor: selectedDefinition.color,
          backgroundColor: selectedDefinition.fill,
          pointBackgroundColor: "#ffffff",
          pointBorderColor: selectedDefinition.color,
          pointBorderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 3,
          tension: 0.32,
          fill: true,
        },
      ],
    }),
    [selectedDefinition, selectedSeries],
  );

  const chartOptions: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: {
            label: (context) =>
              `${context.parsed.y?.toLocaleString() ?? "—"} ${selectedDefinition.unit}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#71817c", maxRotation: 0, autoSkip: true },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: "rgba(79, 104, 95, 0.1)" },
          ticks: { color: "#71817c" },
        },
      },
    }),
    [selectedDefinition.unit],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      setError("Enter a non-negative numeric value");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createSiteMetric(token, projectId, site.id, {
        metric_type: entryType,
        value: numericValue,
        observed_at: new Date(observedAt).toISOString(),
        source: source || null,
      });
      setSelectedType(entryType);
      setValue("");
      setSource("");
      await loadAnalytics();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to save the observation",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(metricId: string) {
    if (!window.confirm("Delete this observation?")) return;
    setError("");
    try {
      await deleteSiteMetric(token, projectId, site.id, metricId);
      await loadAnalytics();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to delete the observation",
      );
    }
  }

  function seriesFor(type: MetricType): MetricSeriesSummary | undefined {
    return analytics?.series.find((series) => series.metric_type === type);
  }

  return (
    <div className="analytics-layer" role="presentation">
      <section
        className="analytics-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-title"
      >
        <header className="analytics-header">
          <div>
            <span className="eyebrow">Site performance</span>
            <h2 id="analytics-title">{site.name}</h2>
            <p>
              {site.area_hectares
                ? `${Number(site.area_hectares).toLocaleString(undefined, { maximumFractionDigits: 2 })} hectares`
                : "Mapped site"}{" "}
              · {analytics?.total_observations ?? 0} observations
            </p>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close analytics"
          >
            ×
          </button>
        </header>

        {loading ? (
          <div className="analytics-loading">Loading site performance…</div>
        ) : (
          <div className="analytics-body">
            <main className="analytics-main">
              <div className="metric-tabs" role="tablist" aria-label="Metric">
                {METRIC_TYPES.map((type) => {
                  const definition = METRICS[type];
                  const metricSeries = seriesFor(type);
                  return (
                    <button
                      className={selectedType === type ? "active" : ""}
                      type="button"
                      role="tab"
                      aria-selected={selectedType === type}
                      onClick={() => setSelectedType(type)}
                      key={type}
                    >
                      <span
                        className="metric-tab-dot"
                        style={{ background: definition.color }}
                      />
                      {definition.shortLabel}
                      <small>{metricSeries?.observations ?? 0}</small>
                    </button>
                  );
                })}
              </div>

              <div className="analytics-section-heading">
                <div>
                  <span className="eyebrow">Trend over time</span>
                  <h3>{selectedDefinition.label}</h3>
                </div>
                <span>{selectedDefinition.unit}</span>
              </div>

              {selectedSeries ? (
                <>
                  <div className="analytics-summary-grid">
                    <article>
                      <span>Latest</span>
                      <strong>
                        {formatValue(
                          selectedSeries.latest_value,
                          selectedSeries.unit,
                        )}
                      </strong>
                      <small>
                        {formatDate(selectedSeries.latest_observed_at)}
                      </small>
                    </article>
                    <article>
                      <span>Average</span>
                      <strong>
                        {formatValue(
                          selectedSeries.average,
                          selectedSeries.unit,
                        )}
                      </strong>
                      <small>{selectedSeries.observations} observations</small>
                    </article>
                    <article>
                      <span>Last change</span>
                      <strong
                        className={
                          Number(selectedSeries.change_absolute) < 0
                            ? "negative"
                            : ""
                        }
                      >
                        {selectedSeries.change_percent === null
                          ? "—"
                          : `${Number(selectedSeries.change_percent) > 0 ? "+" : ""}${Number(selectedSeries.change_percent).toLocaleString()}%`}
                      </strong>
                      <small>Compared with prior reading</small>
                    </article>
                  </div>
                  <div className="analytics-chart">
                    <Line data={chartData} options={chartOptions} />
                  </div>
                  <p className="metric-description">
                    {selectedDefinition.description} Range:{" "}
                    {formatValue(selectedSeries.minimum, selectedSeries.unit)}–
                    {formatValue(selectedSeries.maximum, selectedSeries.unit)}.
                  </p>
                </>
              ) : (
                <div className="analytics-empty">
                  <strong>
                    No {selectedDefinition.shortLabel.toLowerCase()} data yet
                  </strong>
                  <span>
                    Add the first observation to start a performance trend.
                  </span>
                </div>
              )}

              {selectedSeries && (
                <section className="observations-section">
                  <div className="analytics-section-heading compact">
                    <div>
                      <span className="eyebrow">Audit trail</span>
                      <h3>Observations</h3>
                    </div>
                  </div>
                  <div className="observation-list">
                    {[...selectedSeries.points].reverse().map((point) => (
                      <article key={point.id}>
                        <div>
                          <strong>
                            {formatValue(point.value, point.unit)}
                          </strong>
                          <span>{formatDate(point.observed_at)}</span>
                        </div>
                        <span>{point.source ?? "Manual entry"}</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(point.id)}
                          aria-label={`Delete observation from ${formatDate(point.observed_at)}`}
                        >
                          Delete
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </main>

            <aside className="observation-editor">
              <div>
                <span className="eyebrow">New measurement</span>
                <h3>Add observation</h3>
                <p>Record a consistent measurement to extend the trend.</p>
              </div>
              <form onSubmit={handleSubmit}>
                <label>
                  Metric
                  <select
                    value={entryType}
                    onChange={(event) =>
                      setEntryType(event.target.value as MetricType)
                    }
                  >
                    {METRIC_TYPES.map((type) => (
                      <option value={type} key={type}>
                        {METRICS[type].label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Value ({METRICS[entryType].unit})
                  <input
                    type="number"
                    min="0"
                    max={entryType === "vegetation_cover" ? "100" : undefined}
                    step="any"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Observed at
                  <input
                    type="datetime-local"
                    value={observedAt}
                    onChange={(event) => setObservedAt(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Source <span>(optional)</span>
                  <input
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                    maxLength={160}
                    placeholder="e.g. Sentinel-2, field survey"
                  />
                </label>
                {error && (
                  <div className="form-error" role="alert">
                    {error}
                  </div>
                )}
                <button
                  className="primary-button"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Add observation"}
                </button>
              </form>
              <div className="observation-note">
                <strong>Comparable data</strong>
                <span>
                  Use the same method and source where possible. Units are fixed
                  automatically for each metric.
                </span>
              </div>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
