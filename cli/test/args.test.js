"use strict";
const { parseArgs, UsageError, HELP, COMMANDS } = require("../lib/args");

describe("parseArgs", () => {
  it("reads a command, its words and options", () => {
    expect(parseArgs(["search", "jane", "austen", "--limit", "5"])).toEqual({ command: "search", words: ["jane", "austen"], options: { limit: 5 }, json: false });
    expect(parseArgs(["library", "--status=reading", "--json"])).toEqual({ command: "library", words: [], options: { status: "reading" }, json: true });
    expect(parseArgs(["stats", "--days", "7"]).options).toEqual({ days: 7 });
  });

  it("shows help with nothing, --help or -h, and the version with --version", () => {
    expect(parseArgs([]).command).toBe("help");
    expect(parseArgs(["library", "--help"]).command).toBe("help");
    expect(parseArgs(["-h"]).command).toBe("help");
    expect(parseArgs(["--version"]).command).toBe("version");
  });

  it("refuses what it doesn't know", () => {
    for (const argv of [["delete"], ["search"], ["book"], ["book", "a", "b"], ["library", "--status", "lost"], ["stats", "--days", "0"], ["stats", "--days", "1.5"], ["stats", "--days"], ["highlights", "--limit", "201"], ["library", "--password", "x"]]) {
      expect(() => parseArgs(argv)).toThrow(UsageError);
    }
  });

  it("lists every command in the help", () => {
    for (const command of COMMANDS.filter((c) => c !== "help")) expect(HELP).toContain(`literaryworm ${command}`);
  });
});

describe("library commands", () => {
  const { parseArgs, UsageError } = require("../lib/args");
  test("add, mark and login --library", () => {
    expect(parseArgs(["add", "dracula"]).command).toBe("add");
    expect(parseArgs(["mark", "dracula", "--status", "finished"]).options.status).toBe("finished");
    expect(parseArgs(["login", "--library"]).options.library).toBe(true);
    expect(() => parseArgs(["mark", "dracula"])).toThrow(UsageError);
    expect(() => parseArgs(["library", "--library"])).toThrow(UsageError);
  });
});
