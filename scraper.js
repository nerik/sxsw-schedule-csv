#!/usr/bin/env node

/* eslint-env node, es6 */
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var _ = require('underscore');
var moment = require('moment');
var json2csv = require('json2csv');
var geocodeApiKey = require('./api_key');

var start = 11;
var end = 20;
var currentDay = start;

var venues = [];
var events = [];

fetchVenues();

function fetchVenues() {
  fetchVenue(() => {
    console.error('finished');
    if (process.argv[2] === 'events') {
      toCSV(events, console.log);
    } else {
      fetchVenuesDetails();
    }
  });
}

function fetchVenue(cb) {
  var url = `http://schedule.sxsw.com/?day=${currentDay}&lsort=venue`;
  console.error(url)
  request(url, (error, response, html) => {
    var $ = cheerio.load(html);

    var currentVenue;

    $('.data').children().each((i, row) => {
      var $row = $(row);

      var classNames = $row.attr('class');

      if (classNames) {

        if (classNames === 'group_time') {
          var name = $row.find('h4 a').text();
          currentVenue = _.findWhere(venues, {name: name});

          if (!currentVenue) {
            currentVenue = {
              name: name,
              link: $row.find('h4 a').attr('href'),
              // events: [],
              eventsCount: 0
            }
            venues.push(currentVenue);
            // console.log(`no ${name} venue yet`);
          }
        } else if (classNames.split(' ')[0] === 'bar') {
          var types = classNames.split(' ')[1].split('-');
          var time = $row.find('.event-item').children().eq(1).find('.row').children().eq(2).find('.time').text().trim();
          var evt = {
            venue: currentVenue.name,
            film: types.indexOf('film') > -1,
            interactive: types.indexOf('interactive') > -1,
            music: types.indexOf('music') > -1,
            name: $row.find('.event-item').children().eq(0).find('a').text(),
            link: $row.find('.event-item').children().eq(0).find('a').attr('href'),
            type: $row.find('.event-item').children().eq(1).find('.row').children().eq(0).find('b').text(),
            startTime: moment(`2015-03-${currentDay} ${time.split(' - ')[0]}`, 'YYYY-MM-DD h:mmA').format(),
            time: time,
          };
          // console.log(evt)
          currentVenue.eventsCount++;
          // currentVenue.events.push(evt);
          events.push(evt);
        }
      }
    });

    currentDay++;
    if (currentDay>end) {
      cb();
    } else {
      fetchVenue(cb);
    }


  });
}

var currentVenue = 0;

function fetchVenuesDetails() {
  fetchVenueDetails(() => {
    // console.log('finished');
    toCSV(venues, console.log)
  });
}

function fetchVenueDetails(cb) {
  var venue = venues[currentVenue];
  var url = `http://schedule.sxsw.com/events?lsort=venue_all_days&venue=${venue.name}`;
  console.error(url)
  request(url, (error, response, html) => {

      var $ = cheerio.load(html);

    venue.address = venue.name + ' ' + $('.venue-details h3').text();

    var venueSQL = encodeURIComponent(venue.address.replace("'","''"));
    var geocode_query = `WITH latlon AS (SELECT cdb_geocode_street_point('${venueSQL}', 'Austin', 'Texas', 'United States') as ll) SELECT ST_X(ll) as lon, ST_Y(ll) as lat FROM latlon`;

    var geocode_url = `https://nerikcarto.cartodb.com/api/v2/sql?q=${geocode_query}&api_key=${geocodeApiKey}`;
    console.error(geocode_url);
    request(geocode_url, (error, response, body) => {
      if (JSON.parse(body).rows) {
        venue.lat = JSON.parse(body).rows[0].lat;
        venue.lon = JSON.parse(body).rows[0].lon;
      
      }
    });

    currentVenue++;
    if (currentVenue>= venues.length) {
      cb();
    } else {
      fetchVenueDetails(cb);
    }
  })

}

function toCSV(data, cb) {
  json2csv({ data: data }, function(err, csv) {
    if (err) {
      console.log(err);
    }
    else {
      cb(csv);
    }
  });
}
