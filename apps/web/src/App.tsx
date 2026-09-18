const metrics = [
  { label: "Active projects", value: "12", delta: "+2 this quarter" },
  { label: "Protected area", value: "18,420 ha", delta: "+8.4%" },
  { label: "Carbon potential", value: "64.8 kt", delta: "CO₂e / year" },
  { label: "Sites monitored", value: "37", delta: "Across 5 regions" },
];

const projects = [
  {
    name: "Western Ghats Rewilding",
    type: "Biodiversity",
    sites: 8,
    status: "On track",
  },
  {
    name: "Sundarbans Blue Carbon",
    type: "Carbon",
    sites: 5,
    status: "Review",
  },
  {
    name: "Aravalli Restoration",
    type: "Mixed",
    sites: 11,
    status: "On track",
  },
];

function App() {
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
          <span className="eyebrow">Data health</span>
          <strong>All systems normal</strong>
          <small>Updated 4 minutes ago</small>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">Portfolio overview</span>
            <h1>Environmental impact, mapped.</h1>
          </div>
          <div className="topbar-actions">
            <button className="secondary-button" type="button">
              Export report
            </button>
            <button className="primary-button" type="button">
              + New project
            </button>
          </div>
        </header>

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
              aria-label="Stylized map preview of project sites"
            >
              <div className="map-grid" />
              <span className="site-marker marker-one">
                <i>8</i>
              </span>
              <span className="site-marker marker-two">
                <i>5</i>
              </span>
              <span className="site-marker marker-three">
                <i>11</i>
              </span>
              <span className="site-marker marker-four">
                <i>4</i>
              </span>
              <div className="map-legend">
                <b>28</b> mapped sites
              </div>
            </div>
          </article>

          <article className="impact-card" id="analytics">
            <div className="card-heading">
              <div>
                <span className="eyebrow">Annual trajectory</span>
                <h2>Carbon impact</h2>
              </div>
              <span className="trend">+12.6%</span>
            </div>
            <div
              className="chart"
              aria-label="Carbon impact trend illustration"
            >
              {[42, 55, 48, 68, 72, 86, 92].map((height, index) => (
                <span key={height} style={{ height: `${height}%` }}>
                  <i>{2020 + index}</i>
                </span>
              ))}
            </div>
            <p>
              Estimated sequestration is trending above the 2026 portfolio
              target.
            </p>
          </article>
        </section>

        <section className="projects-card" id="projects">
          <div className="card-heading">
            <div>
              <span className="eyebrow">Recently updated</span>
              <h2>Projects</h2>
            </div>
            <button className="text-button" type="button">
              View all →
            </button>
          </div>

          <div className="project-table" role="table" aria-label="Projects">
            {projects.map((project) => (
              <div className="project-row" role="row" key={project.name}>
                <div>
                  <span className="project-icon" aria-hidden="true">
                    ⌁
                  </span>
                  <span>
                    <strong>{project.name}</strong>
                    <small>{project.type}</small>
                  </span>
                </div>
                <span>{project.sites} sites</span>
                <span
                  className={`status ${project.status === "Review" ? "review" : ""}`}
                >
                  {project.status}
                </span>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Open ${project.name}`}
                >
                  →
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
