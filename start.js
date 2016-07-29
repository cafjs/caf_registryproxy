#!/usr/bin/env node
'use strict';
var np = require('./index.js');

np.run([], function(err) {
    if (err) {
        // eslint-disable-next-line
        console.log('Error: ' + err);
    } else {
        // eslint-disable-next-line
        console.log('Starting registry proxy ...');
    }
});
