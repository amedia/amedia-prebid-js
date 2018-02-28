/**
* adploggerAnalyticsAdapter.js - analytics adapter for adplogger
*/

var events = require('src/events');
var utils = require('src/utils');
var CONSTANTS = require('src/constants.json');
var adaptermanager = require('src/adaptermanager');

var BID_REQUESTED = CONSTANTS.EVENTS.BID_REQUESTED;
var BID_TIMEOUT = CONSTANTS.EVENTS.BID_TIMEOUT;
var BID_RESPONSE = CONSTANTS.EVENTS.BID_RESPONSE;

var ADP_INITIALIZED = false;
var ADP_STORAGE = [];

exports.enableAnalytics = function ({ provider, options }) {
  var existingEvents = events.getEvents();

  var bid = null;

  utils._each(existingEvents, function (eventObj) {
    if (typeof eventObj !== 'object') {
      return;
    }
    var args = eventObj.args;

    if (eventObj.eventType === BID_REQUESTED) {
      bid = args;
      sendBidRequestToADP(bid);
    } else if (eventObj.eventType === BID_RESPONSE) {
      // bid is 2nd args
      bid = args;
      sendBidResponseToADP(bid);
    } else if (eventObj.eventType === BID_TIMEOUT) {
      const bidderArray = args;
      sendBidTimeouts(bidderArray);
    }
  });

  events.on(BID_REQUESTED, function (bidRequestObj) {
    sendBidRequestToADP(bidRequestObj);
  });

  events.on(BID_RESPONSE, function (bid) {
    sendBidResponseToADP(bid);
  });

  events.on(BID_TIMEOUT, function (bidderArray) {
    sendBidTimeouts(bidderArray);
  });

  // finally set this function to return log message, prevents multiple adapter listeners
  this.enableAnalytics = function _enable() {
    return utils.logMessage(`Analytics adapter already enabled, unnecessary call to \`enableAnalytics\`.`);
  };
};

function sendBidRequestToADP(bid) {
  if (bid && bid.bidderCode) {
    logToAdp('a_prebid_bid_request', bid.bidderCode);
  }
}

function sendBidResponseToADP(bid) {
  if (bid && bid.bidderCode) {
      logToAdp('a_prebid_bid', [bid.cpm, bid.bidderCode, bid.adUnitCode]);
      logToAdp('a_prebid_bid_load_time', [bid.timeToRespond, bid.bidderCode, bid.adUnitCode]);
  }
}

function logToAdp(event, data) {
  utils.logMessage('Sending prebid event to adplogger [' + event + '][' + data + ']');
  if (ADP_INITIALIZED) {
    window.postMessage({
      adpEventName: 'seshat-add',
      data: {
        [event]: [data],
      },
    }, '*');
  } else {
    ADP_STORAGE.push({
      adpEventName: 'seshat-add',
      data: {
        [event]: [data],
      },
    });
  }
}

var adpListener = window.addEventListener('seshat-alive', (evt) => {
  ADP_INITIALIZED = true

  // Send unsent events.
  for (var i = 0; i < ADP_STORAGE.length; i += 1) {
    window.postMessage(ADP_STORAGE[i], '*');
  }

  // Clean up
  window.removeEventListener('seshat-alive', adpListener);
});

window.postMessage({
  adpEventName: 'seshat-ping'
}, '*');

function sendBidTimeouts(timedOutBidders) {
  utils._each(timedOutBidders, function (bidderCode) {
    logToAdp('a_prebid_timeout', bidderCode);
  });
}

adaptermanager.registerAnalyticsAdapter({
  adapter: exports,
  code: 'adplogger'
});
