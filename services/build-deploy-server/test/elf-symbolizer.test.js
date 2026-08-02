"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { ElfSymbolizer, parseAddr2line } = require("../src/modules/elf-symbolizer");

test("addr2line output becomes source frames without guessing unresolved symbols", () => {
  assert.deepEqual(parseAddr2line("app_main\n/project/src/main.cpp:42\n??\n??:0\n", ["0x40001234", "0x40005678"]), [
    { address: "0x40001234", resolved: true, function: "app_main", file: "/project/src/main.cpp", line: 42 },
    { address: "0x40005678", resolved: false, function: "", file: "", line: 0 },
  ]);
});

test("ELF symbolization invokes addr2line without a shell", async () => {
  const calls = [];
  const symbolizer = new ElfSymbolizer({
    commands: ["test-addr2line"],
    async execute(command, args, options) {
      calls.push({ command, args, options });
      return { stdout: "setup\n/project/src/setup.cpp:7\n" };
    },
  });
  const frames = await symbolizer.symbolize(Buffer.from("elf"), ["0x40000001"]);
  assert.equal(frames[0].line, 7);
  assert.equal(calls[0].command, "test-addr2line");
  assert.deepEqual(calls[0].args.slice(0, 3), ["-f", "-C", "-e"]);
  assert.equal(calls[0].options.shell, undefined);
});

test("a worker with multiple ESP toolchains continues after an incompatible command", async () => {
  const commands = [];
  const symbolizer = new ElfSymbolizer({
    commands: ["wrong-architecture", "matching-architecture"],
    async execute(command) {
      commands.push(command);
      if (command === "wrong-architecture") throw Object.assign(new Error("file format not recognized"), { code: 1 });
      return { stdout: "app_main\n/project/src/main.cpp:17\n" };
    },
  });
  const frames = await symbolizer.symbolize(Buffer.from("elf"), ["0x42003b24"]);
  assert.deepEqual(commands, ["wrong-architecture", "matching-architecture"]);
  assert.equal(frames[0].resolved, true);
});
