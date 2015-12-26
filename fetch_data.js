var request = require('request'),
    cheerio = require('cheerio'),
    jsonfile = require('jsonfile'),
    path = require('path'),
    fs = require('fs'),
    player_list = {},
    argv = require('minimist')(process.argv.slice(2));

function get_player_list(year, callback) {
    url = 'http://football.myfantasyleague.com/' + year + '/player_listing';

    request(url, function (error, response, body) {
	if (error) {
	    console.log("We've encountered an error: " + error);
	    return;
	}
	var $ = cheerio.load(body),
	    rows = $('#player_listing').find('tr');

	rows.each(function(i, row) {
	    var link = $(this).children()[1].children[0];
	    if (link.children) {
		var player_key = link.attribs.href.split('=')[1],
		    player_data = link.children[0].data.split(' ');
		player_list[player_key] = {
		    'name': player_data.slice(0, -2).join(' '),
		    'team': player_data.slice(-2)[0],
		    'position': player_data.slice(-1)[0],
		}
	    }
	});
	jsonfile.writeFile(
	    path.join(argv.prefix, 'player_list.json'),
	    player_list,
	    function (err) {
		if (err) return console.error(err);
		callback(year);
	    }
	);
    });
}

function get_player_info(year, player_id) {
    var url = 'http://football.myfantasyleague.com/'
	      + year + '/player?P=' + player_id;

    request(url, function (error, response, body) {
	if (error) {
	    console.log("We've encountered an error: " + error);
	    return;
	}
	var $ = cheerio.load(body),
	    rows = $('#player_stats_table').find('tr'),
	    headers = [],
	    player_stats = {};

	rows.get(2).children.forEach(function(column) {
	    if (column.type == 'tag'){
		if (column.attribs.title) headers.push(column.attribs.title)
		else if (column.children.length) {
		    headers.push(column.children[0].data)
		}
	    }
	});
	rows.slice(2).each(function(i, row) {
	    var columns = $(this).children();
	    if (columns.get(0).attribs['class'] == 'week'){
		var week_stats = {}
		columns.each(function(i, col) {
		    //console.log(headers[i]);
		    week_stats[headers[i]] = $(this).text();
		});
		player_stats[week_stats['Week']] = week_stats;
	    }
	});
	jsonfile.writeFile(
	    path.join(argv.prefix, 'player_stats_' + player_id + '.json'),
	    player_stats,
	    function (err) {
		if (err) return console.error(err);
	    }
	);
    });
}

function refresh_data(year) {
    var RateLimiter = require('limiter').RateLimiter;
    // understands 'second', 'minute', 'day', or a number of milliseconds
    var limiter = new RateLimiter(1, 500);

    get_player_list(year, function (year){
	Object.keys(player_list).forEach(function (key) {
	    // Throttle requests
	    limiter.removeTokens(1, function(err, remainingRequests) {
		// err will only be set if we request more than the maximum number of
		// requests we set in the constructor

		// remainingRequests tells us how many additional requests could be sent
		// right this moment
		console.log('Getting info for ' + player_list[key].name);
		get_player_info(year, key);
	    });
	});
    });
}

if (!argv.year) {
    console.err('Year not specified');
    return;
    }

if (!argv.prefix) argv.prefix = 'json'
if (!fs.existsSync(argv.prefix)) fs.mkdirSync(argv.prefix)
if (argv.getlist) return get_player_list(argv.year, function(year){})
else if (argv.info) return get_player_info(argv.year, argv.info)
else if (argv.refresh) return refresh_data(argv.year)
