import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(__dirname, "../..");
const dockerfile = readFileSync(resolve(repositoryRoot, "Dockerfile"), "utf8");
const dockerignore = readFileSync(resolve(repositoryRoot, ".dockerignore"), "utf8");
const distributionWorkflow = readFileSync(
  resolve(repositoryRoot, ".github/workflows/release.yml"),
  "utf8",
);

function workflowJob(name: string): string {
  const match = distributionWorkflow.match(
    new RegExp(
      `^  ${name}:\\n([\\s\\S]*?)(?=^  [a-zA-Z0-9_-]+:\\n|(?![\\s\\S]))`,
      "m",
    ),
  );

  if (!match) {
    throw new Error(`Distribution workflow is missing the ${name} job`);
  }

  return match[0];
}

function dockerBuildArgs(job: string): string[] {
  const match = job.match(/build-args: \|\n((?: {12}.+(?:\n|$))*)/);
  return (match?.[1] ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

describe("Docker release fidelity", () => {
  it("builds an optional-auth image without embedding provider secrets", () => {
    expect(dockerfile).toContain("ARG AUTH_MODE=optional");
    expect(dockerfile.match(/^ENV AUTH_MODE=/gm)).toHaveLength(2);
    expect(dockerfile).not.toMatch(/ARG (?:NEXTAUTH_SECRET|ZITADEL_CLIENT_SECRET)/);
    expect(dockerignore).toContain(".env.*");
    expect(dockerignore).toContain("!.env.example");
    expect(dockerignore).toContain(".npmrc");
    expect(dockerignore).toContain("*.pem");
    expect(dockerignore).toContain("*.key");
  });

  it("gates publication on a non-pushing build with identical build arguments", () => {
    const fidelityJob = workflowJob("docker-build");
    const publicationJob = workflowJob("publish_docker");

    expect(fidelityJob).toContain("uses: docker/build-push-action@");
    expect(fidelityJob).toContain("context: .");
    expect(fidelityJob).toContain("push: false");
    expect(publicationJob).toContain("context: .");
    expect(publicationJob).toContain("push: true");
    expect(dockerBuildArgs(fidelityJob)).toEqual(["AUTH_MODE=optional"]);
    expect(dockerBuildArgs(publicationJob)).toEqual(dockerBuildArgs(fidelityJob));
    expect(publicationJob).toMatch(/needs: \[[^\]]*docker-build[^\]]*\]/);
  });
});
