const path = require('path');
const { tests } = require('@iobroker/testing');

// Run integration tests against a temporary ioBroker installation
tests.integration(path.join(__dirname, '..'));
