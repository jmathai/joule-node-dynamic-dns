#!/usr/bin/env node

/*
 * Usage:
 *  ./client.js username joule-name test.example.com. secret 
 */

var client = require('request');
var crypto = require('crypto');
var username = process.argv[2];
var joulename = process.argv[3];
var domain = process.argv[4];
var secret = process.argv[5];
var endpoint = 'https://api.joule.run/' + username + '/' + joulename;

client.get(
  endpoint,
  function(error, response, body) {
    var remoteAddr = JSON.parse(body).remote_addr
        , token = crypto.createHash('sha256').update(remoteAddr+':'+domain+':'+secret).digest('hex');
    client.post(
      endpoint,
      { form: { token:  token } },
      function (error, response, body) {
        console.log(body)
      }
    );
  }
);
