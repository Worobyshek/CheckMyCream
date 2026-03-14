import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBinPath = require.resolve("next/dist/bin/next");

const child = spawn(process.execPath, [nextBinPath, "build"], {
  stdio: "inherit",
  shell: false,
  env: {
    ...process.env,
    CAPACITOR_BUILD: "true",
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
