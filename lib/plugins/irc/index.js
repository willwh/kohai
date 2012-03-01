/*
 *
 * irc/index.js - broadway plugin for basic irc management in kohai.
 *
 * (c) 2011 Nodejitsu Inc.
 *
 */

var Channel = exports.Channel = require('./channel').Channel,
    path = require('path');

exports.name = 'kohai-irc';

exports.attach = function (options) {
  var self = this,
      hook;

  self.options = options || {};

  if (!self.hook) {
    throw new Error('This plugin depends on flatiron-hook.');
  }
  else {
    hook = self.hook;
  }

  // Add the irc plugin's config.json
  self.config.add('irc', { type: 'file', file: path.join(__dirname, 'config.json')});

  // Initialization to occur on hook::ready
  hook.on('hook::ready', function () {

    if ((process.getuid() === 0) && self.uid) {
      process.setuid(self.uid);
    }

    // Join channels.
    // At the moment, irc:channels seems to be undefined, hence the || [].
    // TODO: Make sure we can actually get channels here.
    self.config.get('channels').forEach(function (channel) {
      self.joinChannel(channel);
    });

  });

  // Handle the bot joining a channel.
  hook.on('*::Ijoined', function (data) {
    self.joinChannel(data.channel);
  });

  // Handler for channel joining.
  self.joinChannel = function joinChannel(channel) {

    if (!self.channels) {
      self.channels = {};
    }

    if (typeof self.channels[channel] === 'undefined') {
      self.channels[channel] = new Channel(self.channelDefaults);
    }
    else {
      self.channels[channel].join();
    }

    if (self.channels[channel].autoVolume) {
      self.channels[channel].startVolume();
    }

  };

  // Handle the bot leaving a channel.
  hook.on('*::Iparted', function (data) {
    if (typeof self.channels[data] !== 'undefined') {
      self.channels[data].part();
      self.channels = self.channels.filter(function (item) {
        return item !== data;
      });
    }
  });

  // Some sort of idCheck event.
  // This is particular to freenode. We may be able to factor this out.
  hook.on('*::idCheck', function (data) {
    self.idCheck = data.check ? true : false;
  });

  // Count Kohai's messages for the purposes of logging message rates.
  hook.on('*::Isaid', function (data) {
    if (data.to[0] === '#') {
      self.channels[data.to].messageCount++;
    }
  });

  // Handle received messages here.
  // This should get some nice routing action.
  hook.on('*::gotMessage', function (data) {

    // check auth if message is a PM to Kohai.
    if (data.to === self.nick) {
      return self.checkAuth(data);
    }

    // Otherwise, use the gotMessage handler.
    return self.gotMessage(data);
  });

  // We should be aware of errors on the hook.
  // TODO: Use the logging plugin?
  hook.on('*::error::*', function (data) {
    console.error(data);
  });

};