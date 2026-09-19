import { afterEach, describe, expect, it, vi } from "vitest";

import { login } from "./api";

describe("API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("surfaces the API detail and status when authentication fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ detail: "Incorrect email or password" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(login("owner@example.com", "wrong-password")).rejects.toEqual(
      expect.objectContaining({
        message: "Incorrect email or password",
        status: 401,
      }),
    );
  });
});
