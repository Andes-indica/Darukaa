import {
  type FormEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ApiError,
  createSite,
  deleteSite,
  listSites,
  updateSite,
} from "../lib/api";
import type { PolygonGeometry, Project, Site, SiteStatus } from "../types";
import { SiteMap } from "./SiteMap";

const SiteAnalytics = lazy(() =>
  import("./SiteAnalytics").then((module) => ({
    default: module.SiteAnalytics,
  })),
);

interface SiteWorkspaceProps {
  token: string;
  project: Project;
  onClose: () => void;
  onChanged: () => void;
}

export function SiteWorkspace({
  token,
  project,
  onClose,
  onChanged,
}: SiteWorkspaceProps) {
  const [sites, setSites] = useState<Site[]>([]);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [analyticsSite, setAnalyticsSite] = useState<Site | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [siteStatus, setSiteStatus] = useState<SiteStatus>("planned");
  const [boundary, setBoundary] = useState<PolygonGeometry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadSites = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listSites(token, project.id);
      setSites(response.items);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Unable to load sites",
      );
    } finally {
      setLoading(false);
    }
  }, [project.id, token]);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  function resetForm() {
    setEditingSite(null);
    setName("");
    setDescription("");
    setSiteStatus("planned");
    setBoundary(null);
    setError("");
  }

  function editSite(site: Site) {
    setEditingSite(site);
    setName(site.name);
    setDescription(site.description ?? "");
    setSiteStatus(site.status);
    setBoundary(site.boundary);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!boundary) {
      setError("Draw a polygon on the map before saving the site");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name,
        description: description || null,
        status: siteStatus,
        boundary,
      };
      if (editingSite)
        await updateSite(token, project.id, editingSite.id, payload);
      else await createSite(token, project.id, payload);
      resetForm();
      await loadSites();
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Unable to save the site",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(site: Site) {
    if (!window.confirm(`Delete “${site.name}”?`)) return;
    try {
      await deleteSite(token, project.id, site.id);
      if (editingSite?.id === site.id) resetForm();
      if (analyticsSite?.id === site.id) setAnalyticsSite(null);
      await loadSites();
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to delete the site",
      );
    }
  }

  return (
    <div className="modal-backdrop site-backdrop" role="presentation">
      <section
        className="site-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-workspace-title"
      >
        <header className="site-workspace-header">
          <div>
            <span className="eyebrow">Geospatial site manager</span>
            <h2 id="site-workspace-title">{project.name}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close site manager"
          >
            ×
          </button>
        </header>

        <div className="site-workspace-grid">
          <div className="site-map-panel">
            <SiteMap
              sites={sites}
              draftBoundary={boundary}
              onBoundaryChange={setBoundary}
            />
          </div>
          <aside className="site-editor">
            <form onSubmit={handleSubmit}>
              <div className="site-form-title">
                <div>
                  <span className="eyebrow">
                    {editingSite ? "Editing boundary" : "New boundary"}
                  </span>
                  <h3>{editingSite ? editingSite.name : "Add a site"}</h3>
                </div>
                {editingSite && (
                  <button type="button" onClick={resetForm}>
                    Cancel edit
                  </button>
                )}
              </div>
              <label>
                Site name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  minLength={2}
                  maxLength={160}
                  required
                />
              </label>
              <label>
                Status
                <select
                  value={siteStatus}
                  onChange={(event) =>
                    setSiteStatus(event.target.value as SiteStatus)
                  }
                >
                  <option value="planned">Planned</option>
                  <option value="monitored">Monitored</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label>
                Description
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={2000}
                  rows={3}
                />
              </label>
              <div className={`boundary-state ${boundary ? "ready" : ""}`}>
                {boundary
                  ? "Polygon ready to save"
                  : "Use the polygon tool on the map"}
              </div>
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              <button
                className="primary-button"
                type="submit"
                disabled={saving || !boundary}
              >
                {saving ? "Saving…" : editingSite ? "Update site" : "Save site"}
              </button>
            </form>

            <div className="site-list-heading">
              <strong>Saved sites</strong>
              <span>{sites.length}</span>
            </div>
            <div className="site-list">
              {loading ? (
                <div className="site-list-empty">Loading…</div>
              ) : sites.length === 0 ? (
                <div className="site-list-empty">
                  No sites yet. Draw the first boundary.
                </div>
              ) : (
                sites.map((site) => (
                  <article className="site-list-item" key={site.id}>
                    <div>
                      <strong>{site.name}</strong>
                      <span>
                        {site.area_hectares
                          ? `${Number(site.area_hectares).toLocaleString(undefined, { maximumFractionDigits: 2 })} ha`
                          : "Area pending"}{" "}
                        · {site.status}
                      </span>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setAnalyticsSite(site)}
                      >
                        Analytics
                      </button>
                      <button type="button" onClick={() => editSite(site)}>
                        Edit
                      </button>
                      <button
                        className="danger-text"
                        type="button"
                        onClick={() => handleDelete(site)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </aside>
        </div>
        {analyticsSite && (
          <Suspense
            fallback={
              <div className="analytics-layer analytics-loading">
                Loading analytics…
              </div>
            }
          >
            <SiteAnalytics
              token={token}
              projectId={project.id}
              site={analyticsSite}
              onClose={() => setAnalyticsSite(null)}
            />
          </Suspense>
        )}
      </section>
    </div>
  );
}
