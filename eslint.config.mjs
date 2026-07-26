// ioBroker eslint template configuration file for js and ts files
import config from "@iobroker/eslint-config";

export default [
    ...config,
    {
        ignores: [
            ".dev-server/",
            ".vscode/",
            ".cursor/",
            "build/",
            "node_modules/",
            "admin/tab.js",
            "*.config.mjs",
        ],
    },
    {
        rules: {
            "jsdoc/require-jsdoc": "off",
            "jsdoc/require-param": "off",
            "jsdoc/require-param-description": "off",
            "jsdoc/require-returns-description": "off",
            "jsdoc/require-returns-check": "off",
        },
    },
    {
        files: ["test/**/*.js"],
        languageOptions: {
            globals: {
                describe: "readonly",
                it: "readonly",
                before: "readonly",
                after: "readonly",
                beforeEach: "readonly",
                afterEach: "readonly",
            },
        },
    },
];
