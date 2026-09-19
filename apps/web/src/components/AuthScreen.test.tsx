import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { login, register } from "../lib/api";
import type { AuthResponse } from "../types";
import { AuthScreen } from "./AuthScreen";

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    login: vi.fn(),
    register: vi.fn(),
  };
});

const response: AuthResponse = {
  access_token: "test-token",
  token_type: "bearer",
  user: {
    id: "15d45a67-c631-4f75-87db-108934049a26",
    email: "owner@example.com",
    full_name: "Project Owner",
    role: "admin",
    is_active: true,
    created_at: "2026-09-19T08:00:00Z",
  },
};

describe("AuthScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits login credentials and returns the authenticated session", async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    vi.mocked(login).mockResolvedValue(response);
    render(<AuthScreen onAuthenticated={onAuthenticated} />);

    await user.type(
      screen.getByLabelText("Email address"),
      "owner@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "secure-password-123");
    const signInButtons = screen.getAllByRole("button", { name: "Sign in" });
    await user.click(signInButtons[signInButtons.length - 1]!);

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith(
        "owner@example.com",
        "secure-password-123",
      ),
    );
    expect(onAuthenticated).toHaveBeenCalledWith(response);
  });

  it("switches to registration and submits the full administrator profile", async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    vi.mocked(register).mockResolvedValue(response);
    render(<AuthScreen onAuthenticated={onAuthenticated} />);

    await user.click(screen.getByRole("button", { name: "Register" }));
    await user.type(screen.getByLabelText("Full name"), "Project Owner");
    await user.type(
      screen.getByLabelText("Email address"),
      "owner@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "secure-password-123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith(
        "owner@example.com",
        "Project Owner",
        "secure-password-123",
      ),
    );
    expect(onAuthenticated).toHaveBeenCalledWith(response);
  });
});
