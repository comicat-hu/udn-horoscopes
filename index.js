var axios = require('axios');
var cheerio = require('cheerio');
var moment = require('moment');
var log4js = require('log4js');
var bots = require('./src/bots');

require('dotenv').config();

var getEnv = function (key) {
    var value = process.env[key];
    if (value.toLowerCase() === 'true') {
        return true;
    }
    if (value.toLowerCase() === 'false') {
        return false;
    }
    return value;
};

log4js.configure({
    appenders: { appLog: { type: 'file', filename: getEnv('LOG_PATH') } },
    categories: { default: { appenders: ['appLog'], level: getEnv('LOGGER_LEVEL') || 'error' } }
});
var logger = log4js.getLogger('appLog');

var getSenders = function () {
    var senders = [];
    if (getEnv('SLACK_NT') === true) {
        var bot = new bots.slackBot(getEnv('SLACK_BOT_TOKEN'));
        bot.channel = getEnv('SLACK_CHANNEL_ID');
        senders.push(bot);
    }
    return senders;
};

var run = async function () {
    try {
        var response = await axios.get('https://udn.com/search/tagging/2/%E6%98%9F%E5%BA%A7%E9%81%8B%E5%8B%A2');
        var $ = cheerio.load(response.data);
        var posts = $('#search_content > dl').children();
        var date = moment().format('YYYY-MM-DD');
        var result = '';
        posts.each(function(i, element) {
            var text = $(element).text();
            if (text.includes('今日星座運勢') && text.includes(date)) {
                result = $(element).find('a').attr('href');
                return false;
            }
        });

        if (!result) {
            throw new Error('Result empty.');
        }

        var sendText = `${date}星座運勢\n${result}`;

        var senders = getSenders();

        senders.forEach(async function (sender) {
            try {
                var botResponse = await sender.send(sendText)

                logger.info('Send by ' + sender.constructor.name + ' - ');
                logger.info(botResponse);
            } catch (err) {
                logger.error(err);
                return false;
            }
        });
    } catch (err) {
        logger.error(err);
    }
}();
