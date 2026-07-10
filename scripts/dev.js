import { spawn, spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function waitForPostgres() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const result = spawnSync(
      "docker",
      ["compose", "exec", "-T", "postgres", "pg_isready", "-U", "bioo3", "-d", "bioo3"],
      { stdio: "ignore" }
    );

    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }

  console.error("PostgreSQL did not become ready in time.");
  process.exit(1);
}

console.log("Starting PostgreSQL...");
run("docker", ["compose", "up", "-d", "postgres"]);
waitForPostgres();

console.log("Preparing the database...");
run(npm, ["run", "prisma:generate"]);
run(npm, ["run", "prisma:deploy"]);
run(npm, ["run", "seed"]);

const children = [
  spawn(npm, ["run", "dev:server"], { stdio: "inherit" }),
  spawn(npm, ["run", "dev:client"], { stdio: "inherit" })
];

let shuttingDown = false;
function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(exitCode), 250);
}

for (const child of children) {
  child.on("exit", (code) => shutdown(code ?? 1));
  child.on("error", () => shutdown(1));
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
