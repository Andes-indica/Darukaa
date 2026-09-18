export type UserRole = "admin" | "analyst";
export type ProjectType = "carbon" | "biodiversity" | "mixed";
export type ProjectStatus = "draft" | "active" | "completed";
export type SiteStatus = "planned" | "monitored" | "archived";
export type Position = [number, number];

export interface PolygonGeometry {
  type: "Polygon";
  coordinates: Position[][];
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  user: User;
}

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  project_type: ProjectType;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  site_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectInput {
  name: string;
  description?: string | null;
  project_type: ProjectType;
  status: ProjectStatus;
  start_date?: string | null;
  end_date?: string | null;
}

export interface ProjectListResponse {
  items: Project[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ProjectFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ProjectStatus | "";
  projectType?: ProjectType | "";
}

export interface Site {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  boundary: PolygonGeometry;
  area_hectares: string | null;
  status: SiteStatus;
  created_at: string;
  updated_at: string;
}

export interface SiteInput {
  name: string;
  description?: string | null;
  boundary: PolygonGeometry;
  status: SiteStatus;
}

export interface SiteListResponse {
  items: Site[];
  total: number;
}
