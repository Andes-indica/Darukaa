from __future__ import annotations

import argparse
import json
import os
from getpass import getpass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

DEFAULT_API_URL = "https://darukaa-earth-api-i790.onrender.com/api/v1"
SOURCE_NAME = "Darukaa demonstration dataset"

PROJECTS: list[dict[str, Any]] = [
    {
        "name": "Western Ghats Reforestation",
        "description": (
            "Demonstration carbon project tracking restoration blocks in Karnataka's "
            "Western Ghats. Values are synthetic and intended for product review."
        ),
        "project_type": "carbon",
        "status": "active",
        "start_date": "2025-01-15",
        "end_date": None,
        "sites": [
            {
                "name": "Brahmagiri Restoration Block",
                "description": "Native forest restoration demonstration boundary.",
                "status": "monitored",
                "boundary": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [75.585, 12.115],
                            [75.602, 12.115],
                            [75.602, 12.128],
                            [75.585, 12.128],
                            [75.585, 12.115],
                        ]
                    ],
                },
                "metrics": {
                    "carbon_tonnes": [850, 910, 985, 1040],
                    "vegetation_cover": [42, 47, 53, 58],
                },
            },
            {
                "name": "Pushpagiri Buffer Zone",
                "description": "Buffer restoration and vegetation monitoring demonstration area.",
                "status": "monitored",
                "boundary": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [75.653, 12.654],
                            [75.668, 12.654],
                            [75.668, 12.666],
                            [75.653, 12.666],
                            [75.653, 12.654],
                        ]
                    ],
                },
                "metrics": {
                    "carbon_tonnes": [620, 675, 731, 790],
                    "vegetation_cover": [38, 43, 48, 54],
                },
            },
        ],
    },
    {
        "name": "Kundapura Mangrove Recovery",
        "description": (
            "Demonstration mixed project for coastal carbon, habitat condition, and "
            "vegetation monitoring."
        ),
        "project_type": "mixed",
        "status": "active",
        "start_date": "2025-04-01",
        "end_date": None,
        "sites": [
            {
                "name": "Kodi Estuary Plot",
                "description": "Mangrove recovery demonstration boundary near Kundapura.",
                "status": "monitored",
                "boundary": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [74.675, 13.617],
                            [74.688, 13.617],
                            [74.688, 13.628],
                            [74.675, 13.628],
                            [74.675, 13.617],
                        ]
                    ],
                },
                "metrics": {
                    "carbon_tonnes": [430, 472, 520, 566],
                    "biodiversity_index": [48, 55, 61, 68],
                    "vegetation_cover": [51, 57, 63, 69],
                },
            }
        ],
    },
    {
        "name": "Dharwad Biodiversity Baseline",
        "description": (
            "Demonstration biodiversity baseline for a dry-deciduous landscape. "
            "Values are synthetic and do not represent a field survey."
        ),
        "project_type": "biodiversity",
        "status": "draft",
        "start_date": "2025-01-10",
        "end_date": "2026-12-31",
        "sites": [
            {
                "name": "Kelageri Habitat Plot",
                "description": "Baseline habitat monitoring demonstration boundary.",
                "status": "planned",
                "boundary": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [75.003, 15.443],
                            [75.015, 15.443],
                            [75.015, 15.454],
                            [75.003, 15.454],
                            [75.003, 15.443],
                        ]
                    ],
                },
                "metrics": {
                    "biodiversity_index": [35, 41, 46, 52],
                    "vegetation_cover": [29, 34, 39, 44],
                },
            }
        ],
    },
]

OBSERVATION_DATES = [
    "2025-03-31T00:00:00+00:00",
    "2025-06-30T00:00:00+00:00",
    "2025-09-30T00:00:00+00:00",
    "2025-12-31T00:00:00+00:00",
]


class ApiClient:
    def __init__(self, api_url: str) -> None:
        self.api_url = api_url.rstrip("/")
        self.token: str | None = None

    def request(
        self,
        method: str,
        path: str,
        *,
        payload: dict[str, Any] | None = None,
        form: dict[str, str] | None = None,
    ) -> tuple[int, Any]:
        headers = {"Accept": "application/json"}
        data: bytes | None = None
        if payload is not None:
            data = json.dumps(payload).encode()
            headers["Content-Type"] = "application/json"
        elif form is not None:
            data = urlencode(form).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        request = Request(
            f"{self.api_url}{path}",
            data=data,
            headers=headers,
            method=method,
        )
        try:
            with urlopen(request, timeout=90) as response:
                body = response.read()
                return response.status, json.loads(body) if body else None
        except HTTPError as error:
            body = error.read()
            try:
                detail = json.loads(body) if body else {"detail": error.reason}
            except json.JSONDecodeError:
                detail = {"detail": body.decode(errors="replace") or error.reason}
            return error.code, detail
        except URLError as error:
            raise RuntimeError(f"Unable to reach {self.api_url}: {error.reason}") from error


def require_success(status: int, body: Any, action: str) -> Any:
    if 200 <= status < 300:
        return body
    detail = body.get("detail", body) if isinstance(body, dict) else body
    raise RuntimeError(f"{action} failed with HTTP {status}: {detail}")


def authenticate(client: ApiClient, email: str, full_name: str, password: str) -> None:
    status, body = client.request(
        "POST",
        "/auth/register",
        payload={"email": email, "full_name": full_name, "password": password},
    )
    if status == 409:
        status, body = client.request(
            "POST",
            "/auth/login",
            form={"username": email, "password": password},
        )
    auth = require_success(status, body, "Authentication")
    client.token = auth["access_token"]


def seed(client: ApiClient) -> tuple[int, int, int]:
    created_projects = 0
    created_sites = 0
    created_metrics = 0

    status, body = client.request("GET", "/projects?page=1&page_size=100")
    projects = require_success(status, body, "Listing projects")["items"]
    projects_by_name = {project["name"]: project for project in projects}

    for project_definition in PROJECTS:
        project_name = project_definition["name"]
        project = projects_by_name.get(project_name)
        if project is None:
            payload = {key: value for key, value in project_definition.items() if key != "sites"}
            status, body = client.request("POST", "/projects", payload=payload)
            project = require_success(status, body, f"Creating project {project_name}")
            created_projects += 1

        project_id = project["id"]
        status, body = client.request("GET", f"/projects/{project_id}/sites")
        sites = require_success(status, body, f"Listing sites for {project_name}")["items"]
        sites_by_name = {site["name"]: site for site in sites}

        for site_definition in project_definition["sites"]:
            site_name = site_definition["name"]
            site = sites_by_name.get(site_name)
            if site is None:
                payload = {key: value for key, value in site_definition.items() if key != "metrics"}
                status, body = client.request(
                    "POST", f"/projects/{project_id}/sites", payload=payload
                )
                site = require_success(status, body, f"Creating site {site_name}")
                created_sites += 1

            site_id = site["id"]
            for metric_type, values in site_definition["metrics"].items():
                for observed_at, value in zip(OBSERVATION_DATES, values, strict=True):
                    status, body = client.request(
                        "POST",
                        f"/projects/{project_id}/sites/{site_id}/metrics",
                        payload={
                            "metric_type": metric_type,
                            "value": value,
                            "observed_at": observed_at,
                            "source": SOURCE_NAME,
                        },
                    )
                    if status == 409:
                        continue
                    require_success(status, body, f"Creating {metric_type} observation")
                    created_metrics += 1

    return created_projects, created_sites, created_metrics


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed an idempotent Darukaa.Earth demonstration portfolio via the public API."
    )
    parser.add_argument(
        "--api-url",
        default=os.getenv("DARUKAA_API_URL", DEFAULT_API_URL),
        help=f"API base URL (default: {DEFAULT_API_URL})",
    )
    parser.add_argument(
        "--email",
        default=os.getenv("DARUKAA_DEMO_EMAIL"),
        help="Demo account email (or set DARUKAA_DEMO_EMAIL)",
    )
    parser.add_argument(
        "--full-name",
        default=os.getenv("DARUKAA_DEMO_FULL_NAME", "Darukaa Demo Reviewer"),
        help="Name used when the account is created",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    email = args.email or input("Demo account email: ").strip()
    password = os.getenv("DARUKAA_DEMO_PASSWORD") or getpass("Demo account password: ")
    if not email:
        raise SystemExit("A demo account email is required")
    if len(password) < 8:
        raise SystemExit("The demo account password must contain at least 8 characters")

    client = ApiClient(args.api_url)
    authenticate(client, email, args.full_name, password)
    projects, sites, metrics = seed(client)
    print(
        "Demo data ready: "
        f"{projects} projects created, {sites} sites created, "
        f"{metrics} observations created."
    )


if __name__ == "__main__":
    main()
