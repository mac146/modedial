import { describe, expect, it } from "vitest";
import { emptyState, evaluatePreToolUse, evaluateStop, inScope, isManifest, isMutatingBash, isVerifyCommand, updateAfterTool } from "../src/guards.js";
import { findMode, loadModes } from "../src/modes.js";

const modes = loadModes();
const mode = (id: string) => findMode(modes, id)!;
const CWD = process.platform === "win32" ? "C:\\proj" : "/proj";

describe("isMutatingBash", () => {
  it.each([
    "echo hi > a.txt", "echo hi >> a.txt", "cat a | tee b.txt", "sed -i 's/a/b/' f.js", "sed -ni 's/a/b/p' f.js", "rm -rf build", "mv a b", "cp a b",
    "mkdir out", "touch x", "git commit -m x", "git add .", "git push origin main", "git checkout -b x", "git reset --hard", "npm install lodash",
    "pnpm add left-pad", "pip install requests", "curl -o out.txt https://x.test", "wget https://x.test/a", "git diff > out.patch",
  ])("flags %s", (c) => expect(isMutatingBash(c)).toBe(true));

  it.each([
    "ls -la", "git diff", "git log --oneline -5", "git status", "grep -rn foo .", "cat src/a.js", "node test.js 2>&1", "npm test", "npm run build",
    "cat a 2>/dev/null", "echo a >/dev/null", "node test.js 2>&1 | head", "find . -name '*.ts'", "pytest -q", "git show HEAD",
  ])("allows %s", (c) => expect(isMutatingBash(c)).toBe(false));
});

describe("isVerifyCommand / isManifest", () => {
  it("recognizes commands that run code", () => {
    for (const c of ["node test.js", "npm test", "pytest -q", "cargo test", "go test ./...", "npx vitest run", "python3 main.py"]) expect(isVerifyCommand(c), c).toBe(true);
    for (const c of ["ls", "cat a.js", "git diff", "echo done"]) expect(isVerifyCommand(c), c).toBe(false);
  });
  it("recognizes dependency manifests", () => {
    for (const p of ["package.json", "sub/package-lock.json", "go.mod", "requirements.txt", "C:\\a\\Cargo.toml"]) expect(isManifest(p), p).toBe(true);
    expect(isManifest("src/index.ts")).toBe(false);
  });
});

describe("inScope", () => {
  const cwd = process.platform === "win32" ? "C:\\proj" : "/proj";
  it("matches files, directories and globs, relative to cwd", () => {
    expect(inScope("src/a.ts", ["src/a.ts"], cwd)).toBe(true);
    expect(inScope("src/deep/b.ts", ["src"], cwd)).toBe(true);
    expect(inScope("./src/deep/b.ts", ["./src/"], cwd)).toBe(true);
    expect(inScope("src/a.test.ts", ["src/*.test.ts"], cwd)).toBe(true);
    expect(inScope("src/x/a.test.ts", ["src/**/*.test.ts"], cwd)).toBe(true);
  });
  it("rejects other files, sibling-prefix names and files outside the project", () => {
    expect(inScope("lib/a.ts", ["src"], cwd)).toBe(false);
    expect(inScope("src2/a.ts", ["src"], cwd)).toBe(false);
    expect(inScope("src/x/a.ts", ["src/*.ts"], cwd)).toBe(false);
    expect(inScope("../other/a.ts", ["src"], cwd)).toBe(false);
  });
});

describe("evaluatePreToolUse", () => {
  const st = emptyState();
  it("does nothing when no mode is active", () => {
    expect(evaluatePreToolUse(undefined, st, "Edit", { file_path: "a.ts" }, CWD).decision).toBe("allow");
  });

  it("Careful Reviewer cannot write files, but can read and run read-only commands", () => {
    const m = mode("careful-reviewer");
    for (const t of ["Edit", "Write", "MultiEdit", "NotebookEdit"]) expect(evaluatePreToolUse(m, st, t, { file_path: "a.ts" }, CWD).decision, t).toBe("deny");
    expect(evaluatePreToolUse(m, st, "Read", { file_path: "a.ts" }, CWD).decision).toBe("allow");
    expect(evaluatePreToolUse(m, st, "Bash", { command: "git diff" }, CWD).decision).toBe("allow");
    expect(evaluatePreToolUse(m, st, "Bash", { command: "node test.js" }, CWD).decision).toBe("allow");
    expect(evaluatePreToolUse(m, st, "Bash", { command: "rm -rf src" }, CWD).decision).toBe("deny");
    expect(evaluatePreToolUse(m, st, "Bash", { command: "echo x > a.txt" }, CWD).decision).toBe("deny");
  });

  it("Deep Focus asks before editing outside the declared scope, and allows inside it", () => {
    const m = mode("deep-focus");
    const scoped = { ...st, scope: ["src/paginate.js"] };
    expect(evaluatePreToolUse(m, scoped, "Edit", { file_path: "src/paginate.js" }, CWD).decision).toBe("allow");
    const out = evaluatePreToolUse(m, scoped, "Edit", { file_path: "src/format.js" }, CWD);
    expect(out.decision).toBe("ask");
    expect("reason" in out && out.reason).toMatch(/outside the declared scope/);
  });

  it("Deep Focus without a declared scope does not block anything", () => {
    expect(evaluatePreToolUse(mode("deep-focus"), st, "Edit", { file_path: "anything.js" }, CWD).decision).toBe("allow");
  });

  it("Chill Refactor asks before touching dependency manifests only", () => {
    const m = mode("chill-refactor");
    expect(evaluatePreToolUse(m, st, "Edit", { file_path: "package.json" }, CWD).decision).toBe("ask");
    expect(evaluatePreToolUse(m, st, "Edit", { file_path: "src/a.ts" }, CWD).decision).toBe("allow");
  });

  it("modes without guards never interfere", () => {
    for (const id of ["creative-sprint", "fast-prototype"]) {
      expect(evaluatePreToolUse(mode(id), st, "Edit", { file_path: "package.json" }, CWD).decision, id).toBe("allow");
      expect(evaluatePreToolUse(mode(id), st, "Bash", { command: "rm -rf x" }, CWD).decision, id).toBe("allow");
    }
  });
});

describe("verify-before-finish and tells", () => {
  const dbg = mode("debug");

  it("blocks the first stop after an edit with nothing run, then lets go", () => {
    let s = updateAfterTool(emptyState(), "Edit", { file_path: "a.js" });
    expect(s.dirty && !s.verified).toBe(true);
    const r = evaluateStop(dbg, s, false, null);
    expect(r.block).toBe(true);
    s = { ...s, ...(r.block ? r.patch : {}) };
    expect(evaluateStop(dbg, s, false, null).block).toBe(false); // only one nudge per edit round
  });

  it("does not block once something ran after the edit", () => {
    let s = updateAfterTool(emptyState(), "Edit", { file_path: "a.js" });
    s = updateAfterTool(s, "Bash", { command: "node test.js" });
    expect(evaluateStop(dbg, s, false, null).block).toBe(false);
  });

  it("a new edit after verification needs a new run", () => {
    let s = updateAfterTool(emptyState(), "Edit", { file_path: "a.js" });
    s = updateAfterTool(s, "Bash", { command: "node test.js" });
    s = updateAfterTool(s, "Write", { file_path: "b.js" });
    expect(s.verified).toBe(false);
    expect(evaluateStop(dbg, s, false, null).block).toBe(true);
  });

  it("never blocks a session with no edits, or when already inside a stop hook", () => {
    expect(evaluateStop(dbg, emptyState(), false, null).block).toBe(false);
    const dirty = updateAfterTool(emptyState(), "Edit", { file_path: "a.js" });
    expect(evaluateStop(dbg, dirty, true, null).block).toBe(false);
  });

  it("requires the tell once, and accepts any capitalization", () => {
    const dfm = mode("deep-focus");
    const r = evaluateStop(dfm, emptyState(), false, "Fixed it.");
    expect(r.block).toBe(true);
    expect(evaluateStop(dfm, emptyState(), false, "goal: x\n...\nset aside: nothing").block).toBe(false);
    expect(evaluateStop(dfm, { ...emptyState(), tellBlocks: 1 }, false, "Fixed it.").block).toBe(false);
    expect(evaluateStop(dfm, emptyState(), false, null).block).toBe(false); // cannot read the reply: do not guess
  });
});
