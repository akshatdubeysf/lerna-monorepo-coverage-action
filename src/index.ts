import * as core from "@actions/core";
import { exec } from "@actions/exec";
import { getOctokit, context } from "@actions/github";
import { mkdirP, cp } from "@actions/io";
import { existsSync, readdir, readFile, stat } from "fs";
import { markdownTable } from "markdown-table";
import { resolve } from "path";
import { ReportJson } from "./types";
import { create } from "@actions/artifact";

async function run(): Promise<void> {
  if (context.payload.pull_request?.merged) {
    checkAndCommentCoverage(
      context.issue.number,
      context.payload.pull_request?.id,
      context.payload.pull_request?.base.ref
    );
  } else {
    saveBranchCoverageArtifact(
      context.payload.pull_request?.id,
      context.payload.pull_request?.base.ref
    );
  }
}

async function saveBranchCoverageArtifact(prId: string, branch: string) {
  console.log(`save ${branch} coverage`);
  const client = create();
  const file = await client.downloadArtifact(prId, "./");
  await client.uploadArtifact(branch, [file.downloadPath], ".", {
    retentionDays: 10,
  });
  console.log(`saved ${branch} coverage`);
}

async function checkAndCommentCoverage(
  prNumber: number,
  prId: string,
  branch: string
) {
  const jsons = [];
  const reportsPath = ".nyc_output";
  const token = core.getInput("token");

  const octokit = getOctokit(token);

  await mkdirP(reportsPath);
  const types = core
    .getInput("folders")
    .split(",")
    .map((v) => v.trim());
  try {
    for (let type of types) {
      const items = await getSubFolders(type);
      for (let item of items) {
        const itemPath = resolve(type, item);
        if (await checkIfDirectory(itemPath)) {
          const targetFilePath = resolve(
            itemPath,
            "coverage",
            "coverage-final.json"
          );

          if (existsSync(targetFilePath)) {
            console.log(`Copying the coverage report for ${item}...`);
            const destFilePath = resolve(reportsPath, `${item}.json`);
            jsons.push(destFilePath);
            await cp(targetFilePath, destFilePath, {
              recursive: true,
              force: false,
            });
            // fix paths in reported json
            await exec("sed", [
              "-i",
              `s/\\/github\\/workspace/\\./g`,
              destFilePath,
            ]);
          } else {
            console.log("coverage does not exists");
          }
        }
      }
    }
  } catch (e: any) {
    core.setFailed(e);
  }

  try {
    await exec("npx", ["nyc", "report", "--reporter", "json-summary"]);
    const prevPath = await getPreviousCoverage(branch);
    const coveragePath = resolve("coverage", "coverage-summary.json");
    const md = await createMarkDown(coveragePath, prevPath);
    saveTempCoverage(prId, coveragePath);
    await octokit.rest.issues.createComment({
      ...context.repo,
      issue_number: prNumber,
      body: md,
    });
  } catch (e: any) {
    core.setFailed(e);
  }
}

async function getPreviousCoverage(branch: string) {
  console.log(`getting prev coverage for ${branch}`);
  const client = create();
  try {
    const file = await client.downloadArtifact(branch, "./", {
      createArtifactFolder: true,
    });
    return file.downloadPath;
  } catch (e) {
    console.log("No prev branch data for diff.");
    return;
  }
}

async function saveTempCoverage(prId: string, coveragePath: string) {
  console.log(`saving temp coverage for current PR}`);
  const client = create();
  await client.uploadArtifact(prId, [coveragePath], ".", {
    retentionDays: 1,
  });
  console.log(`saved`);
}

async function getSubFolders(path: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    readdir(path, (err, items) => {
      if (err) reject(err);
      else resolve(items);
    });
  });
}

async function checkIfDirectory(path: string) {
  return new Promise((resolve, reject) => {
    stat(path, (err, stats) => {
      if (err) reject(err);
      else {
        if (stats.isDirectory()) {
          resolve(true);
        } else {
          resolve(false);
        }
      }
    });
  });
}

async function createMarkDown(path: string, prev?: string): Promise<string> {
  console.log(prev);
  return new Promise((resolve, reject) => {
    readFile(path, "utf8", function (err, data) {
      if (!err) {
        const report = JSON.parse(data) as ReportJson;
        const md = markdownTable([
          ["type", "coverage"],
          ["statements", `${report.total.statements.pct}%`],
          ["lines", `${report.total.lines.pct}%`],
          ["functions", `${report.total.functions.pct}%`],
          ["branches", `${report.total.branches.pct}%`],
        ]);
        resolve(md);
      } else {
        reject(err);
      }
    });
  });
}

run();
