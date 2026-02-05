module.exports = {
    testTimeout: 300000,
    slowTestThreshold: 30,
    moduleNameMapper: {
        "^.+/imports/CodemirrorPlutoSetup\\.js$": "<rootDir>/__mocks__/CodemirrorPlutoSetup.js",
        "^.+/imports/lodash\\.js$": "<rootDir>/__mocks__/lodash.js",
    },
}
