var slack = require('slack');

var slackBot = function (token) {
    var bot = new slack({ token });

    this.channel = '';

    this.setChannel = function (channel) {
        this.channel = channel;
    }

    this.send = async function (text) { 
        var botResponse = await bot.chat.postMessage({
            channel: this.channel,
            text
        });
        return botResponse;
    }

    this.delete = async function (ts) {
        var botResponse = await bot.chat.delete({
            channel: this.channel,
            ts
        });
        return botResponse;
    }
}

module.exports = { slackBot };
