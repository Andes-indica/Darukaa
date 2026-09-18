import { type FormEvent, useEffect, useState } from "react";

import { ApiError, createProject, updateProject } from "../lib/api";
import type {
  Project,
  ProjectInput,
  ProjectStatus,
  ProjectType,
} from "../types";

interface ProjectDialogProps {
  token: string;
  project: Project | null;
  onClose: () => void;
  onSaved: () => void;
}

const emptyProject: ProjectInput = {
  name: "",
  description: "",
  project_type: "carbon",
  status: "draft",
  start_date: null,
  end_date: null,
};

export function ProjectDialog({
  token,
  project,
  onClose,
  onSaved,
}: ProjectDialogProps) {
  const [form, setForm] = useState<ProjectInput>(emptyProject);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(
      project
        ? {
            name: project.name,
            description: project.description ?? "",
            project_type: project.project_type,
            status: project.status,
            start_date: project.start_date,
            end_date: project.end_date,
          }
        : emptyProject,
    );
  }, [project]);

  function setField<K extends keyof ProjectInput>(
    field: K,
    value: ProjectInput[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        description: form.description || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      if (project) await updateProject(token, project.id, payload);
      else await createProject(token, payload);
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to save the project",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="card-heading">
          <div>
            <span className="eyebrow">Portfolio project</span>
            <h2 id="project-dialog-title">
              {project ? "Edit project" : "Create a new project"}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>
        <form className="project-form" onSubmit={handleSubmit}>
          <label className="full-field">
            Project name
            <input
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              minLength={2}
              maxLength={160}
              required
              autoFocus
            />
          </label>
          <label>
            Project type
            <select
              value={form.project_type}
              onChange={(event) =>
                setField("project_type", event.target.value as ProjectType)
              }
            >
              <option value="carbon">Carbon</option>
              <option value="biodiversity">Biodiversity</option>
              <option value="mixed">Mixed impact</option>
            </select>
          </label>
          <label>
            Status
            <select
              value={form.status}
              onChange={(event) =>
                setField("status", event.target.value as ProjectStatus)
              }
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label>
            Start date
            <input
              type="date"
              value={form.start_date ?? ""}
              onChange={(event) =>
                setField("start_date", event.target.value || null)
              }
            />
          </label>
          <label>
            End date
            <input
              type="date"
              value={form.end_date ?? ""}
              min={form.start_date ?? undefined}
              onChange={(event) =>
                setField("end_date", event.target.value || null)
              }
            />
          </label>
          <label className="full-field">
            Description
            <textarea
              value={form.description ?? ""}
              onChange={(event) => setField("description", event.target.value)}
              maxLength={2000}
              rows={4}
            />
          </label>
          {error && (
            <div className="form-error full-field" role="alert">
              {error}
            </div>
          )}
          <div className="dialog-actions full-field">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Saving…" : project ? "Save changes" : "Create project"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
