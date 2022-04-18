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
            await sendError(err);
        }
    }
};

var sendMessage = async function (message) {
    var senders = getSenders();

    for (var sender of senders) {
        try {
            var botResponse = await sender.send(message);

            logger.info('Send success by ' + sender.constructor.name + ' : ');
            logger.info(botResponse);
        } catch (err) {
            logger.error(err);
            await sendError(err);
        }
    }
};

var getContentFromPage = async function (url) {
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
        throw new Error(`Result empty from page. (URL: ${url})`);
    }

    var sendText = `${date}星座運勢\n${result}`;
    return sendText;
};

var getContentFromApi = async function (url) {
    var response = await axios.get(url);
    var posts = response.data.lists;
    var date = dayjs().format('YYYY-MM-DD');
    var result = '';
    posts.forEach(function(element, i) {
        var text = element.title;
        var datetime = element.time.date;
        if ((text.includes('今日星座運勢') || text.includes('每日星座運勢')) && datetime.includes(date)) {
            var link = element.titleLink;
            result = `https://udn.com${link.substring(0, link.indexOf('?'))}`;
            return false;
        }
    });

    if (!result) {
        throw new Error(`Result empty from api. (URL: ${url})`);
    }

    var sendText = `${date}星座運勢\n${result}`;
    return sendText;
};

var contentFunctionCalls = [
    async function () {
        return await getContentFromPage('https://udn.com/search/tagging/2/%E6%AF%8F%E6%97%A5%E6%98%9F%E5%BA%A7%E9%81%8B%E5%8B%A2')
    },
    async function () {
        return await getContentFromPage('https://udn.com/search/tagging/2/%E6%98%9F%E5%BA%A7%E9%81%8B%E5%8B%A2')
    },
    async function () {
        return await getContentFromApi('https://udn.com/api/more?page=0&channelId=2&type=subcate_articles&cate_id=6649&sub_id=7268&totalRecNo=336&is_paywall=0&is_bauban=0&is_vision=0')
    },
];

(async () => {
    for (let functionCall of contentFunctionCalls) {
        try {
            let message = await functionCall();
            await sendMessage(message);
            break;
        } catch (err) {
            logger.error(err);
            await sendError(err);
        }
    }
})();
