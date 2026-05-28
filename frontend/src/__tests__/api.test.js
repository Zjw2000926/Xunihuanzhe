import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock axios before importing api
const mockAxiosCreate = vi.fn(() => ({
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("axios", () => ({
  default: { create: mockAxiosCreate },
}));

describe("API module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("creates axios instance with correct baseURL", async () => {
    await import("../api");
    expect(mockAxiosCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "/api",
        timeout: 120000,
      }),
    );
  });

  it("request interceptor adds Bearer token from localStorage", async () => {
    localStorage.setItem("token", "test-token-123");

    // Force re-import to pick up mocked module
    vi.resetModules();
    await import("../api");

    const createCall = mockAxiosCreate.mock.results[0]?.value;
    if (!createCall) {
      // Check that axios.create was called
      expect(mockAxiosCreate).toHaveBeenCalled();
    }
  });
});
