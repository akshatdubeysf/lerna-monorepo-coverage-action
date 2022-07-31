import * as core from "@actions/core";
import { exec } from "@actions/exec";
import { copyFileSync, existsSync, readdir, stat } from "fs";
import { resolve } from "path";

async function run(): Promise<void> {
  const reportsPath = '';
  const lernaJson = require("./lerna.json");
  const types = lernaJson.packages;

  try {
    types.forEach(async (type: string) => {
      const items = await getSubFolders(type);
      items.forEach(async (item) => {
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
            copyFileSync(targetFilePath, destFilePath);
            exec('nyc report --reporter json-summary')
          }
        }
      });
    });
  } catch(e: any) {
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

run();
