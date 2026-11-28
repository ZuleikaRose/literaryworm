import { describe, expect, it } from "@jest/globals";
import { demoConnectedApps, isRequestId, MCP_PUBLIC_URL, MCP_URL, parseConnectedApps, returnPlace } from "./connectedApps";

describe("connected apps", () => {
  it("knows a request id from anything else", () => {
    expect(isRequestId("0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d")).toBe(true);
    expect(isRequestId(null)).toBe(false);
    expect(isRequestId("")).toBe(false);
    expect(isRequestId("0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d/../x")).toBe(false);
  });

  it("says where an app sends the member back", () => {
    expect(returnPlace("https://claude.ai/api/mcp/auth_callback")).toEqual({ kind: "web", host: "claude.ai" });
    expect(returnPlace("https://app.example:8443/cb")).toEqual({ kind: "web", host: "app.example:8443" });
    expect(returnPlace("http://127.0.0.1:53124/callback")).toEqual({ kind: "device" });
    expect(returnPlace("http://localhost:3000/cb")).toEqual({ kind: "device" });
    expect(returnPlace("cursor://anysphere.cursor-mcp/oauth/callback")).toEqual({ kind: "app", scheme: "cursor" });
  });

  it("doesn't call a plain http website this computer", () => {
    expect(returnPlace("http://localhost.example.com/cb")).toBeNull();
    expect(returnPlace("not an address")).toBeNull();
  });

  it("keeps only well-formed apps, newest first", () => {
    const apps = parseConnectedApps([
      { id: "a", name: "Old", createdAt: "2026-11-01T00:00:00Z", lastUsedAt: null },
      { id: "b", name: "New", createdAt: "2026-11-10T00:00:00Z", lastUsedAt: "2026-11-11T00:00:00Z", scope: "read library" },
      { id: 3, name: "Bad", createdAt: "2026-11-12T00:00:00Z" },
      null,
    ]);
    expect(apps.map((a) => a.name)).toEqual(["New", "Old"]);
    expect(apps[1].lastUsedAt).toBeNull();
    // Only the library scope can change anything; anything else reads.
    expect(apps.map((a) => a.canChangeLibrary)).toEqual([true, false]);
    expect(parseConnectedApps({ apps: [] })).toEqual([]);
  });

  it("gives the demo two sample apps, newest first: the command line that may change the library, and an assistant that reads", () => {
    const [cli, app] = demoConnectedApps(new Date("2026-11-16T12:00:00Z"));
    expect(cli.name).toBe("LiteraryWorm command line on Avery's laptop");
    expect(cli.canChangeLibrary).toBe(true);
    expect(cli.createdAt).toBe("2026-11-15T12:00:00.000Z");
    expect(cli.lastUsedAt).toBe("2026-11-16T10:00:00.000Z");
    expect(app.name).toBe("Claude");
    expect(app.canChangeLibrary).toBe(false);
    expect(app.createdAt).toBe("2026-11-13T12:00:00.000Z");
    expect(app.lastUsedAt).toBe("2026-11-15T12:00:00.000Z");
  });

  it("points at the site's own addresses", () => {
    expect(MCP_URL).toBe("https://www.literaryworm.com/mcp");
    expect(MCP_PUBLIC_URL).toBe(`${MCP_URL}/public`);
  });
});
