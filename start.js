#!/usr/bin/env node
var np = require('./index.js');

np.run([], function(err, top) {
           if (err) {
               console.log('Error: ' + err);
           } else {
               console.log('Starting registry proxy ...');
           }
       });
