"use strict";

const Nut = require('node-nut');
const bent = require('bent');
var nut = new Nut(3493, 'localhost');

nut.on('error', err => {
    console.log('There was an error: ' + err);
});

nut.on('close', () => {
    console.log('Connection closed.');
});

var lastVars = {};
function monitor() {
    setTimeout(() => {
      nut.GetUPSList((upslist, err) => {
        if (err) {
          console.log('Error: ' + err)
          return;
        }
        let upsname = Object.keys(upslist)[0];
        nut.GetUPSVars(upsname, async (vars, err) => {
          if (err) {
            console.err('Error:', err);
            return;
          }
          if(!lastVars[upsname] || Object.entries(vars).toString() != Object.entries(lastVars[upsname]).toString()) {
            let dataToExport = Object.fromEntries(Object.entries(vars));
            dataToExport['ups.name'] = upsname;
            const post = bent('POST', 200);
            try {
              await post(process.env['URL'], dataToExport);
              lastVars[upsname] = vars
              console.log(`UPS name=${upsname} state updated`)
            } catch(err) {
              console.log(err);
            }
          }
          monitor();
        });
      });
    }, 5000);
};

nut.on('ready', monitor);
nut.start();

