import { describe, expect, it } from "vitest";
import { authRedirect, isBindHost, publicHost } from "./public-origin";

describe("auth redirect host", () => {
  it("does not send a loopback browser onto the bind address", () => {
    expect(authRedirect("http://localhost:38471/", "http://0.0.0.0:38471")).toBe("http://localhost:38471/");
    expect(authRedirect("http://127.0.0.1:38471/me", "http://0.0.0.0:38471")).toBe(
      "http://127.0.0.1:38471/me",
    );
    expect(authRedirect("/me", "http://0.0.0.0:38471")).toBe("/me");
  });

  it("keeps a real origin strict", () => {
    expect(authRedirect("/me", "https://mandatim.example")).toBe("https://mandatim.example/me");
    expect(authRedirect("https://mandatim.example/g/abc", "https://mandatim.example")).toBe(
      "https://mandatim.example/g/abc",
    );
    expect(authRedirect("https://evil.example", "https://mandatim.example")).toBe("https://mandatim.example");
    expect(authRedirect("https://evil.example", "http://0.0.0.0:38471")).toBe("/");
  });

  it("ignores a bind address advertised as the public host", () => {
    expect(isBindHost("0.0.0.0")).toBe(true);
    expect(publicHost("0.0.0.0:38471")).toBeNull();
    expect(publicHost("localhost:38471")).toBe("localhost:38471");
    expect(publicHost("evil.example/path")).toBeNull();
  });
});
