import * as core from "@actions/core";
import { exec } from "@actions/exec";
import { mkdirP, cp } from "@actions/io";
import { existsSync, readdir, stat } from "fs";
import { resolve } from "path";

async function run(): Promise<void> {
  const reportsPath = ".nyc_output";
  await mkdirP(reportsPath);
  const types = core
    .getInput("folders")
    .split(",")
    .map((v) => v.trim());
  console.log(types);
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
            await cp(targetFilePath, destFilePath, {
              recursive: true,
              force: false,
            });
          } else {
            console.log("coverage does not exists");
          }
        }
      }
    }
  } catch (e: any) {
    core.setFailed(e);
  }

  let myOutput = "";
  let myError = "";

  const options: any = {};
  options.listeners = {
    stdout: (data: Buffer) => {
      myOutput += data.toString();
    },
    stderr: (data: Buffer) => {
      myError += data.toString();
    },
  };
  await exec("ls", [".nyc_output", "-a"]);
  await exec("cat", [".nyc_output/audit-service.json"]);
  await exec("npx", ["nyc", "report", "--reporter", "text-summary"], options);
  console.log(myOutput);
  console.log(myError);
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

run();
