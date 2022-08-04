"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec_1 = require("@actions/exec");
const github_1 = require("@actions/github");
const io_1 = require("@actions/io");
const fs_1 = require("fs");
const markdown_table_1 = require("markdown-table");
const path_1 = require("path");
const artifact_1 = require("@actions/artifact");
async function run() {
    var _a, _b;
    // if (!context.payload.pull_request?.merged) {
    checkAndCommentCoverage(github_1.context.issue.number, (_a = github_1.context.payload.pull_request) === null || _a === void 0 ? void 0 : _a.id, (_b = github_1.context.payload.pull_request) === null || _b === void 0 ? void 0 : _b.base.ref);
    // } else {
    //   saveBranchCoverageArtifact(
    //     context.payload.pull_request?.id,
    //     context.payload.pull_request?.base.ref
    //   );
    // }
}
async function saveBranchCoverageArtifact(prId, branch) {
    console.log(`save ${branch} coverage`);
    const client = (0, artifact_1.create)();
    const file = await client.downloadArtifact(prId, "./");
    await client.uploadArtifact(branch, [file.downloadPath], ".", {
        retentionDays: 10,
    });
    console.log(`saved ${branch} coverage`);
}
async function checkAndCommentCoverage(prNumber, prId, branch) {
    const jsons = [];
    const reportsPath = ".nyc_output";
    const token = core.getInput("token");
    const octokit = (0, github_1.getOctokit)(token);
    await (0, io_1.mkdirP)(reportsPath);
    const types = core
        .getInput("folders")
        .split(",")
        .map((v) => v.trim());
    try {
        for (let type of types) {
            const items = await getSubFolders(type);
            for (let item of items) {
                const itemPath = (0, path_1.resolve)(type, item);
                if (await checkIfDirectory(itemPath)) {
                    const targetFilePath = (0, path_1.resolve)(itemPath, "coverage", "coverage-final.json");
                    if ((0, fs_1.existsSync)(targetFilePath)) {
                        console.log(`Copying the coverage report for ${item}...`);
                        const destFilePath = (0, path_1.resolve)(reportsPath, `${item}.json`);
                        jsons.push(destFilePath);
                        await (0, io_1.cp)(targetFilePath, destFilePath, {
                            recursive: true,
                            force: false,
                        });
                        // fix paths in reported json
                        await (0, exec_1.exec)("sed", [
                            "-i",
                            `s/\\/github\\/workspace/\\./g`,
                            destFilePath,
                        ]);
                    }
                    else {
                        console.log("coverage does not exists");
                    }
                }
            }
        }
    }
    catch (e) {
        core.setFailed(e);
    }
    try {
        await (0, exec_1.exec)("npx", ["nyc", "report", "--reporter", "json-summary"]);
        // const prevPath = await getPreviousCoverage(branch);
        const coveragePath = (0, path_1.resolve)("coverage", "coverage-summary.json");
        const md = await createMarkDown(coveragePath);
        // const md = await createMarkDown(coveragePath, prevPath);
        // saveTempCoverage(prId, coveragePath);
        await octokit.rest.issues.createComment({
            ...github_1.context.repo,
            issue_number: prNumber,
            body: md,
        });
    }
    catch (e) {
        core.setFailed(e);
    }
}
async function getPreviousCoverage(branch) {
    console.log(`getting prev coverage for ${branch}`);
    const client = (0, artifact_1.create)();
    try {
        const file = await client.downloadArtifact(branch, "./", {
            createArtifactFolder: true,
        });
        return file.downloadPath;
    }
    catch (e) {
        console.log("No prev branch data for diff.");
        return;
    }
}
async function saveTempCoverage(prId, coveragePath) {
    console.log(`saving temp coverage for current PR}`);
    const client = (0, artifact_1.create)();
    await client.uploadArtifact(prId, [coveragePath], ".", {
        retentionDays: 1,
    });
    console.log(`saved`);
}
async function getSubFolders(path) {
    return new Promise((resolve, reject) => {
        (0, fs_1.readdir)(path, (err, items) => {
            if (err)
                reject(err);
            else
                resolve(items);
        });
    });
}
async function checkIfDirectory(path) {
    return new Promise((resolve, reject) => {
        (0, fs_1.stat)(path, (err, stats) => {
            if (err)
                reject(err);
            else {
                if (stats.isDirectory()) {
                    resolve(true);
                }
                else {
                    resolve(false);
                }
            }
        });
    });
}
async function createMarkDown(path, prev) {
    console.log(prev);
    return new Promise((resolve, reject) => {
        (0, fs_1.readFile)(path, "utf8", function (err, data) {
            if (!err) {
                const report = JSON.parse(data);
                const md = (0, markdown_table_1.markdownTable)([
                    ["type", "coverage"],
                    ["statements", `${report.total.statements.pct}%`],
                    ["lines", `${report.total.lines.pct}%`],
                    ["functions", `${report.total.functions.pct}%`],
                    ["branches", `${report.total.branches.pct}%`],
                ]);
                resolve(md);
            }
            else {
                reject(err);
            }
        });
    });
}
run();
