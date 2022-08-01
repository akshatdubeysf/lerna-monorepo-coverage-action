import * as core from "@actions/core";
import { exec } from "@actions/exec";
import { getOctokit, context } from "@actions/github";
import { mkdirP, cp } from "@actions/io";
import { existsSync, readdir, readFile, stat } from "fs";
import { markdownTable } from "markdown-table";
import { resolve } from "path";
import { ReportJson } from "./types";

async function run(): Promise<void> {
  const reportsPath = ".nyc_output";
  const token = core.getInput("token");
  const octokit = getOctokit(token);
  const jsons = [];
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
          console.log("exists");
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

  let output = "";
  let error = "";

  const options: any = {};
  options.listeners = {
    stdout: (data: Buffer) => {
      output += data.toString();
    },
    stderr: (data: Buffer) => {
      error += data.toString();
    },
  };
  try {
    const exitCode = await exec(
      "npx",
      ["nyc", "report", "--reporter", "json-summary"],
      options
    );
    console.log(output);
    const md = await createMarkDown(
      resolve("coverage", "coverage-summary.json")
    );
    if (
      context?.payload?.repository?.full_name &&
      context.payload.pull_request?.number
    ) {
      octokit.rest.issues.createComment({
        ...context.repo,
        issue_number: context.payload.pull_request?.number,
        body: md,
      });
      core.setOutput("comment", md);
    }
    core.setOutput("exitCode", exitCode);
  } catch (e: any) {
    console.log(error);
    core.setFailed(e);
  }
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

async function createMarkDown(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    readFile(path, "utf8", function (err, data) {
      if (!err) {
        const report = JSON.parse(data) as ReportJson;
        const md = markdownTable([
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
