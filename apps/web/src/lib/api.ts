import type {
  AuthResponse,
  Project,
  ProjectFilters,
  ProjectInput,
  ProjectListResponse,
  Site,
  SiteInput,
  SiteListResponse,
  User,
} from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    let message = "Something went wrong";
    try {
      const body = (await response.json()) as {
        detail?: string | Array<{ msg: string }>;
      };
      if (typeof body.detail === "string") message = body.detail;
      if (Array.isArray(body.detail))
        message = body.detail.map((item) => item.msg).join(", ");
    } catch {
      message = response.statusText || message;
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function register(
  email: string,
  fullName: string,
  password: string,
): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, full_name: fullName, password }),
  });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  const body = new URLSearchParams({ username: email, password });
  return request<AuthResponse>("/auth/login", { method: "POST", body });
}

export function getCurrentUser(token: string): Promise<User> {
  return request<User>("/auth/me", {}, token);
}

export function listProjects(
  token: string,
  filters: ProjectFilters = {},
): Promise<ProjectListResponse> {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    page_size: String(filters.pageSize ?? 10),
  });
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.projectType) params.set("project_type", filters.projectType);
  return request<ProjectListResponse>(
    `/projects?${params.toString()}`,
    {},
    token,
  );
}

export function createProject(
  token: string,
  project: ProjectInput,
): Promise<Project> {
  return request<Project>(
    "/projects",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    },
    token,
  );
}

export function updateProject(
  token: string,
  projectId: string,
  project: Partial<ProjectInput>,
): Promise<Project> {
  return request<Project>(
    `/projects/${projectId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    },
    token,
  );
}

export function deleteProject(token: string, projectId: string): Promise<void> {
  return request<void>(`/projects/${projectId}`, { method: "DELETE" }, token);
}

export function listSites(
  token: string,
  projectId: string,
): Promise<SiteListResponse> {
  return request<SiteListResponse>(`/projects/${projectId}/sites`, {}, token);
}

export function createSite(
  token: string,
  projectId: string,
  site: SiteInput,
): Promise<Site> {
  return request<Site>(
    `/projects/${projectId}/sites`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(site),
    },
    token,
  );
}

export function updateSite(
  token: string,
  projectId: string,
  siteId: string,
  site: Partial<SiteInput>,
): Promise<Site> {
  return request<Site>(
    `/projects/${projectId}/sites/${siteId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(site),
    },
    token,
  );
}

export function deleteSite(
  token: string,
  projectId: string,
  siteId: string,
): Promise<void> {
  return request<void>(
    `/projects/${projectId}/sites/${siteId}`,
    { method: "DELETE" },
    token,
  );
}
