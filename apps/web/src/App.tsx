import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AuthScreen } from "./components/AuthScreen";
import { ProjectDialog } from "./components/ProjectDialog";
import {
  ApiError,
  deleteProject,
  getCurrentUser,
  listProjects,
} from "./lib/api";
import type {
  AuthResponse,
  Project,
  ProjectListResponse,
  ProjectStatus,
  ProjectType,
  User,
} from "./types";

const TOKEN_KEY = "darukaa_access_token";
const SiteWorkspace = lazy(() =>
  import("./components/SiteWorkspace").then((module) => ({
    default: module.SiteWorkspace,
  })),
);
const emptyProjectPage: ProjectListResponse = {
  items: [],
  total: 0,
  page: 1,
  page_size: 10,
  pages: 0,
};

const typeLabels: Record<ProjectType, string> = {
  carbon: "Carbon",
  biodiversity: "Biodiversity",
  mixed: "Mixed impact",
};

function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem(TOKEN_KEY) ?? "",
  );
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] =
    useState<ProjectListResponse>(emptyProjectPage);
  const [checkingSession, setCheckingSession] = useState(Boolean(token));
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<ProjectType | "">("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [siteProject, setSiteProject] = useState<Project | null>(null);

  const loadProjects = useCallback(async () => {
    if (!token) return;
    setLoadingProjects(true);
    setError("");
    try {
      const response = await listProjects(token, {
        page,
        pageSize: 10,
        search,
        status: statusFilter,
        projectType: typeFilter,
      });
      setProjects(response);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setUser(null);
      } else {
        setError(
          caught instanceof ApiError
            ? caught.message
            : "Unable to load projects",
        );
      }
    } finally {
      setLoadingProjects(false);
    }
  }, [page, search, statusFilter, token, typeFilter]);

  useEffect(() => {
    if (!token) {
      setCheckingSession(false);
      return;
    }
    getCurrentUser(token)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
      })
      .finally(() => setCheckingSession(false));
  }, [token]);

  useEffect(() => {
    if (!user) return;
    const timeout = window.setTimeout(loadProjects, 250);
    return () => window.clearTimeout(timeout);
  }, [loadProjects, user]);

  const metrics = useMemo(() => {
    const active = projects.items.filter(
      (project) => project.status === "active",
    ).length;
    const sites = projects.items.reduce(
      (total, project) => total + project.site_count,
      0,
    );
    return [
      {
        label: "Total projects",
        value: String(projects.total),
        delta: "Your portfolio",
      },
      {
        label: "Active projects",
        value: String(active),
        delta: "On this page",
      },
      {
        label: "Sites monitored",
        value: String(sites),
        delta: "Mapped boundaries",
      },
      {
        label: "Portfolio status",
        value: error ? "Attention" : "Healthy",
        delta: error ? "Check API" : "Systems normal",
      },
    ];
  }, [error, projects]);

  function handleAuthenticated(response: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, response.access_token);
    setToken(response.access_token);
    setUser(response.user);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUser(null);
    setProjects(emptyProjectPage);
  }

  function openCreateDialog() {
    setEditingProject(null);
    setDialogOpen(true);
  }

  function openEditDialog(project: Project) {
    setEditingProject(project);
    setDialogOpen(true);
  }

  async function handleDelete(project: Project) {
    if (!window.confirm(`Delete “${project.name}”? This cannot be undone.`))
      return;
    try {
      await deleteProject(token, project.id);
      if (projects.items.length === 1 && page > 1)
        setPage((current) => current - 1);
      else await loadProjects();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to delete the project",
      );
    }
  }

  async function handleProjectSaved() {
    setDialogOpen(false);
    setEditingProject(null);
    await loadProjects();
  }

  if (checkingSession)
    return <div className="app-loading">Loading your workspace…</div>;
  if (!token || !user)
    return <AuthScreen onAuthenticated={handleAuthenticated} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            D
          </span>
          <span>
            Darukaa<span>.Earth</span>
          </span>
        </div>
        <nav aria-label="Primary navigation">
          <a className="nav-link active" href="#overview">
            Overview
          </a>
          <a className="nav-link" href="#projects">
            Projects
          </a>
          <a className="nav-link" href="#map">
            Map explorer
          </a>
          <a className="nav-link" href="#analytics">
            Analytics
          </a>
        </nav>
        <div className="sidebar-note">
          <span className="eyebrow">Signed in</span>
          <strong>{user.full_name}</strong>
          <small>{user.email}</small>
          <button type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main id="overview">
        <header className="topbar">
          <div>
            <span className="eyebrow">Portfolio overview</span>
            <h1>Environmental impact, mapped.</h1>
          </div>
          <div className="topbar-actions">
            <button className="secondary-button" type="button">
              Export report
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={openCreateDialog}
            >
              + New project
            </button>
          </div>
        </header>

        {error && (
          <div className="page-error" role="alert">
            {error}
            <button type="button" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}

        <section className="metrics" aria-label="Key portfolio metrics">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.delta}</small>
            </article>
          ))}
        </section>

        <section className="content-grid">
          <article className="map-card" id="map">
            <div className="card-heading">
              <div>
                <span className="eyebrow">Geospatial portfolio</span>
                <h2>Project coverage</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Expand map"
              >
                ↗
              </button>
            </div>
            <div
              className="map-preview"
              role="img"
              aria-label="Project site map placeholder"
            >
              <div className="map-grid" />
              {projects.items.slice(0, 4).map((project, index) => (
                <span
                  className={`site-marker marker-${index + 1}`}
                  key={project.id}
                >
                  <i>{project.site_count}</i>
                </span>
              ))}
              <div className="map-legend">
                <b>{metrics[2]?.value}</b> mapped sites
              </div>
            </div>
          </article>

          <article className="impact-card" id="analytics">
            <div className="card-heading">
              <div>
                <span className="eyebrow">Portfolio mix</span>
                <h2>Project activity</h2>
              </div>
              <span className="trend">Live data</span>
            </div>
            <div className="chart" aria-label="Project activity illustration">
              {[42, 55, 48, 68, 72, 86, 92].map((height, index) => (
                <span
                  key={index}
                  style={{ height: `${projects.total ? height : 10}%` }}
                >
                  <i>{2020 + index}</i>
                </span>
              ))}
            </div>
            <p>
              Site analytics will populate this chart after geographic
              boundaries and measurements are added.
            </p>
          </article>
        </section>

        <section className="projects-card" id="projects">
          <div className="card-heading project-heading">
            <div>
              <span className="eyebrow">Portfolio management</span>
              <h2>Projects</h2>
            </div>
            <div className="project-filters">
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search projects"
                aria-label="Search projects"
              />
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as ProjectStatus | "");
                  setPage(1);
                }}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
              <select
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value as ProjectType | "");
                  setPage(1);
                }}
                aria-label="Filter by project type"
              >
                <option value="">All types</option>
                <option value="carbon">Carbon</option>
                <option value="biodiversity">Biodiversity</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
          </div>

          {loadingProjects ? (
            <div className="empty-state">Loading projects…</div>
          ) : projects.items.length === 0 ? (
            <div className="empty-state">
              <strong>No projects found</strong>
              <span>
                Create your first project or change the current filters.
              </span>
              <button
                className="primary-button"
                type="button"
                onClick={openCreateDialog}
              >
                Create project
              </button>
            </div>
          ) : (
            <div className="project-table" role="table" aria-label="Projects">
              {projects.items.map((project) => (
                <div className="project-row" role="row" key={project.id}>
                  <div>
                    <span className="project-icon" aria-hidden="true">
                      ⌁
                    </span>
                    <span>
                      <strong>{project.name}</strong>
                      <small>{typeLabels[project.project_type]}</small>
                    </span>
                  </div>
                  <span>{project.site_count} sites</span>
                  <span className={`status ${project.status}`}>
                    {project.status}
                  </span>
                  <div className="row-actions">
                    <button
                      className="icon-button map-action"
                      type="button"
                      onClick={() => setSiteProject(project)}
                      aria-label={`Manage sites for ${project.name}`}
                    >
                      ⌖
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => openEditDialog(project)}
                      aria-label={`Edit ${project.name}`}
                    >
                      ✎
                    </button>
                    <button
                      className="icon-button danger"
                      type="button"
                      onClick={() => handleDelete(project)}
                      aria-label={`Delete ${project.name}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {projects.pages > 1 && (
            <div className="pagination">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                ← Previous
              </button>
              <span>
                Page {projects.page} of {projects.pages}
              </span>
              <button
                type="button"
                disabled={page >= projects.pages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </section>
      </main>

      {dialogOpen && (
        <ProjectDialog
          token={token}
          project={editingProject}
          onClose={() => setDialogOpen(false)}
          onSaved={handleProjectSaved}
        />
      )}
      {siteProject && (
        <Suspense
          fallback={
            <div className="workspace-loading">Loading map workspace…</div>
          }
        >
          <SiteWorkspace
            token={token}
            project={siteProject}
            onClose={() => setSiteProject(null)}
            onChanged={loadProjects}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
