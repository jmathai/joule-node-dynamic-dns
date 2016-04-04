/**
 * This is the boilerplate repository for creating joules.
 * Forking this repository should be the starting point when creating a joule.
 */

/*
 * The handler function for all API endpoints.
 * The `event` argument contains all input values.
 *    event.httpMethod, The HTTP method (GET, POST, PUT, etc)
 *    event.{pathParam}, Path parameters as defined in your .joule.yml
 *    event.{queryStringParam}, Query string parameters as defined in your .joule.yml
 */
var Response = require('joule-node-response');
var AWS = require('aws-sdk');
var crypto = require('crypto');
var route53 = new AWS.Route53({apiVersion: '2013-04-01'});
var zoneName = process.env.ZONE.toLowerCase();
var domainName = process.env.DOMAIN.toLowerCase();

exports.handler = function(event, context) {
	var response = new Response();
	response.setContext(context);

  // If the request is a GET then we simply return the IP address of the caller.
  // Else if the method is not a post we return a failure.
  // Otherwise we continue with a POST call.
  if(event.httpMethod === 'GET') {
    response.send({remote_addr: event.remoteAddr});
    return;
  } else if(event.httpMethod !== 'POST') {
    response.setHttpStatusCode(400);
    response.send({status: failure, message: 'Method not supported'});
    return;
  }

  /*
   * The first thing we do is check if the token passed in matches what we calculate.
   */
  var expectedToken = crypto.createHash('sha256').update(event.remoteAddr+':'+domainName+':'+process.env.SECRET).digest('hex');
  if(event.post['token'] !== expectedToken) {
    response.setHttpStatusCode(400);
    response.send({status: 'failure', message: 'Invalid token.'});
    return;
  }
  
  /*
   * We get a list of all of the Hosted Zones.
   * To get the Zone ID we will loop over them until we find process.env.DOMAIN.
   */
  route53.listHostedZones({}, function(err, zones) {
    // Coule not get a list of Hosted Zones.
    if(err) {
      console.log(err);
      response.setHttpStatusCode(400);
      response.send({status: 'failure', message: 'Unable to get hosted zones.'});
      return;
    }

    // Loop over the Hosted Zones.
    var hostedZones = zones.HostedZones
        , zoneFound = false;
    for(var zoneIdx in hostedZones) {
      // Once we find the Zone we're looking for we'll continue.
      if(hostedZones[zoneIdx].Name.toLowerCase() === zoneName) {
        var thisZone = hostedZones[zoneIdx];
        zoneFound = true;
        /*
         * List all of the Record Sets for this Zone.
         * This lets us inspect the A Record to see if the IP address needs to be changed.
         */
        route53.listResourceRecordSets({HostedZoneId: thisZone.Id}, function(err, zone) {
          // Could not get the Record Set.
          if(err) {
            console.log(err);
            response.setHttpStatusCode(400);
            response.send({status: 'failure', message: 'Unable to get record set.'});
            return;
          }

          // Loop over each Record Set to find the A record in order to check for IP change.
          // If there isn't an A record we'll continue and one will be created.
          var recordSets = zone.ResourceRecordSets
              , recordSetFound = false;
          for(var setIdx in recordSets) {
            // If we find the Record Set we're looking for we'll check.
            if(recordSets[setIdx].Name === domainName && recordSets[setIdx].Type === 'A') {
              var thisRecordSet = recordSets[setIdx];
              recordSetFound = true;

              // Check if the IP address for the A has changed.
              if(typeof(thisRecordSet.ResourceRecords[0]) !== 'undefined' && typeof(thisRecordSet.ResourceRecords[0].Value) !== 'undefined' && thisRecordSet.ResourceRecords[0].Value === event.remoteAddr)
              {
                response.send({status: 'success', message: 'No change in IP address detected.'});
                return;
              }
            }
          }

          /*
           * We need to update the IP address so we build the object.
           */
          var params = {
            HostedZoneId: thisZone.Id,
            ChangeBatch: {
              Changes: [
                {
                  Action: 'UPSERT',
                  ResourceRecordSet: {
                    Name: domainName,
                    Type: 'A',
                    TTL: '300',
                    ResourceRecords: [{
                      Value: event.remoteAddr
                    }]
                  }
                }
              ]
            }
          };
          route53.changeResourceRecordSets(params, function(err, changeResult) {
            // Trying to update the IP address failed.
            if(err) {
              console.log(err);
              response.setHttpStatusCode(400);
              response.send({status: 'failure', message: 'Could not change record set.'});
              return;
            }

            // The IP address was updated successfully.
            response.send({status: 'success', message: 'A record updated to IP address ' + event.remoteAddr + '.'});
          });
        });
      }
    }

    // The zone specified in process.env.ZONE was not found.
    if(zoneFound === false) {
      response.setHttpStatusCode(400);
      response.send({status: 'failure', message: 'Could not find zone ' + zoneName + '.'});
      return;
    }
  });
};
