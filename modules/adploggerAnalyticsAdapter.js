/**
* adploggerAnalyticsAdapter.js - analytics adapter for adplogger
*/

import events from '../src/events';
import { logInfo, _each } from '../src/utils';
import CONSTANTS from '../src/constants.json';
import adapterManager from '../src/adapterManager';
import adapter from "../src/AnalyticsAdapter";

var BID_REQUESTED = CONSTANTS.EVENTS.BID_REQUESTED;
var BID_TIMEOUT = CONSTANTS.EVENTS.BID_TIMEOUT;
var BID_RESPONSE = CONSTANTS.EVENTS.BID_RESPONSE;
var BID_WON = CONSTANTS.EVENTS.BID_WON;

var ADP_INITIALIZED = false;
var ADP_STORAGE = [];

var exports = adapter({
  global: 'AdpLoggerAnalytics',
  handler: 'on',
  analyticsType: 'bundle'
});

exports.enableAnalytics = (config) => {
  var existingEvents = events.getEvents();

  var bid = null;

  _each(existingEvents, function (eventObj) {
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
    } else if (eventObj.eventType === BID_WON) {
      bid = args;
      sendBidWonToGa(bid);
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

  // wins
  events.on(BID_WON, function (bid) {
    sendBidWonToGa(bid);
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
    logToAdp('a_prebid_bid_type', [bid.mediaType, bid.bidderCode, bid.adUnitCode]);
    logToAdp('a_prebid_bid_size', [bid.size, bid.bidderCode, bid.adUnitCode]);
    logToAdp('a_prebid_bid_load_time', [bid.timeToRespond, bid.bidderCode, bid.adUnitCode]);
  }
}

function sendBidWonToGa(bid) {
  logToAdp('a_prebid_win', [bid.cpm, bid.bidderCode, bid.adUnitCode]);
}

function logToAdp(event, data) {
  logInfo('Sending prebid event to adpLogger [' + event + '][' + data + ']');
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
  ADP_INITIALIZED = true;

  // Send unsent events.
  for (var i = 0; i < ADP_STORAGE.length; i += 1) {
    window.postMessage(ADP_STORAGE[i], '*');
  }

  // Clean up
  window.removeEventListener('seshat-alive', adpListener);
  ADP_STORAGE = [];
});

window.postMessage({
  adpEventName: 'seshat-ping'
}, '*');

function sendBidTimeouts(timedOutBidders) {
  _each(timedOutBidders, function (bidderCode) {
    logToAdp('a_prebid_timeout', [bidderCode.bidder, bidderCode.adUnitCode] );
  });
}

adapterManager.registerAnalyticsAdapter({
  adapter: exports,
  code: 'adplogger'
});

export default exports;
