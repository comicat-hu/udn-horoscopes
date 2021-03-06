var axios = require('axios');
var cheerio = require('cheerio');
var dayjs = require('dayjs');
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
    appenders: { appLog: { type: 'file', filename: getEnv('LOG_PATH') }, console: { type: 'console' }},
    categories: { default: { appenders: ['appLog', 'console'], level: getEnv('LOGGER_LEVEL') || 'error' } }
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

var getErrorSenders = function () {
    var senders = [];
    if (getEnv('ERROR_SLACK_CHANNEL_ID')) {
        var bot = new bots.slackBot(getEnv('SLACK_BOT_TOKEN'));
        bot.channel = getEnv('ERROR_SLACK_CHANNEL_ID');
        senders.push(bot);
    }
    return senders;
};

var sendError = async function (err) {
    var errorSenders = getErrorSenders();
    for (var sender of errorSenders) {
        try {
            var botResponse = await sender.send(err.stack);
        } catch (err2) {
            logger.error('Send failed by ' + sender.constructor.name + ' : ');
            logger.error(err2);
        }
    }
};

var run = async function (url) {
    var response = await axios.get(url);
    var $ = cheerio.load(response.data);
    var posts = $('body > main > div > section.wrapper-left > section > div.context-box__content.story-list__holder.story-list__holder--full').children();
    var date = dayjs().format('YYYY-MM-DD');
    var result = '';
    posts.each(function(i, element) {
        var text = $(element).text();
        if ((text.includes('今日星座運勢') || text.includes('每日星座運勢')) && text.includes(date)) {
            result = $(element).find('a').attr('href');
            return false;
        }
    });

    if (!result) {
        throw new Error(`Result empty. (URL: ${url})`);
    }

    var sendText = `${date}星座運勢\n${result}`;

    var senders = getSenders();

    for (var sender of senders) {
        try {
            var botResponse = await sender.send(sendText);

            logger.info('Send success by ' + sender.constructor.name + ' : ');
            logger.info(botResponse);
        } catch (err) {
            logger.error(err);
            sendError(err);
        }
    }
};

var urls = [
    'https://udn.com/search/tagging/2/%E6%AF%8F%E6%97%A5%E6%98%9F%E5%BA%A7%E9%81%8B%E5%8B%A2',
    'https://udn.com/search/tagging/2/%E6%98%9F%E5%BA%A7%E9%81%8B%E5%8B%A2',
];

(async () => {
    for (let url of urls) {
        try {
            await run(url);
            break;
        } catch (err) {
            logger.error(err);
            await sendError(err);
        }
    }
})();
