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
const fs_1 = require("fs");
const path_1 = require("path");
async function run() {
    const reportsPath = '';
    const lernaJson = require("./lerna.json");
    const types = lernaJson.packages;
    try {
        types.forEach(async (type) => {
            const items = await getSubFolders(type);
            items.forEach(async (item) => {
                const itemPath = (0, path_1.resolve)(type, item);
                if (await checkIfDirectory(itemPath)) {
                    const targetFilePath = (0, path_1.resolve)(itemPath, "coverage", "coverage-final.json");
                    if ((0, fs_1.existsSync)(targetFilePath)) {
                        console.log(`Copying the coverage report for ${item}...`);
                        const destFilePath = (0, path_1.resolve)(reportsPath, `${item}.json`);
                        (0, fs_1.copyFileSync)(targetFilePath, destFilePath);
                        (0, exec_1.exec)('nyc report --reporter json-summary');
                    }
                }
            });
        });
    }
    catch (e) {
        core.setFailed(e);
    }
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
run();
