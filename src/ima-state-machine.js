// @flow
import StateMachine from 'javascript-state-machine';
import StateMachineHistory from 'javascript-state-machine/lib/history';
import {State} from './state';
import {core, Ad, AdBreak} from 'kaltura-player-js';

const {AdBreakType, Error, Utils} = core;

/**
 * Finite state machine for ima plugin.
 * @class ImaStateMachine
 * @private
 * @param {any} context - The plugin context.
 * @classdesc
 */
class ImaStateMachine {
  constructor(context: any) {
    return new StateMachine({
      init: State.LOADING,
      transitions: [
        {
          name: 'loaded',
          from: [State.LOADING, State.LOADED, State.IDLE, State.PAUSED, State.PLAYING, State.DONE],
          to: State.LOADED
        },
        {
          name: context.player.Event.AD_STARTED,
          from: [State.LOADED, State.IDLE, State.PAUSED, State.PLAYING, State.PENDING],
          to: (adEvent: any): string => {
            let ad = adEvent.getAd();
            if (!ad.isLinear()) {
              return State.IDLE;
            }
            return State.PLAYING;
          }
        },
        {
          name: context.player.Event.AD_RESUMED,
          from: [State.PAUSED, State.PLAYING],
          to: State.PLAYING
        },
        {
          name: context.player.Event.AD_PAUSED,
          from: State.PLAYING,
          to: State.PAUSED
        },
        {
          name: context.player.Event.AD_SKIPPED,
          from: [State.PLAYING, State.PAUSED],
          to: State.IDLE
        },
        {
          name: context.player.Event.AD_COMPLETED,
          from: [State.PLAYING, State.PAUSED]
        },
        {
          name: context.player.Event.ADS_COMPLETED,
          from: [State.IDLE, State.PAUSED],
          to: State.DONE
        },
        {
          name: context.player.Event.AD_BREAK_END,
          from: [State.IDLE, State.PLAYING, State.LOADED, State.PAUSED, State.PENDING],
          to: State.IDLE
        },
        {
          name: 'adlog',
          from: [State.IDLE, State.LOADED, State.PLAYING, State.PAUSED, State.LOADING, State.PENDING],
          to: State.IDLE
        },
        {
          name: context.player.Event.AD_ERROR,
          from: [State.IDLE, State.LOADED, State.PLAYING, State.PAUSED, State.LOADING, State.PENDING],
          to: onAdError.bind(context)
        },
        {
          name: context.player.Event.AD_LOADED,
          from: [State.IDLE, State.LOADED, State.PLAYING]
        },
        {
          name: context.player.Event.AD_FIRST_QUARTILE,
          from: State.PLAYING
        },
        {
          name: context.player.Event.AD_BREAK_START,
          from: [State.IDLE, State.LOADED],
          to: State.PENDING
        },
        {
          name: context.player.Event.AD_MIDPOINT,
          from: State.PLAYING
        },
        {
          name: context.player.Event.AD_THIRD_QUARTILE,
          from: State.PLAYING
        },
        {
          name: context.player.Event.USER_CLOSED_AD,
          from: [State.IDLE, State.PLAYING, State.PAUSED]
        },
        {
          name: context.player.Event.AD_VOLUME_CHANGED,
          from: [State.PENDING, State.PLAYING, State.PAUSED, State.LOADED]
        },
        {
          name: context.player.Event.AD_MUTED,
          from: [State.PLAYING, State.PAUSED, State.LOADED]
        },
        {
          name: context.player.Event.AD_CLICKED,
          from: [State.PLAYING, State.PAUSED, State.IDLE]
        },
        {
          name: context.player.Event.AD_CAN_SKIP,
          from: [State.PLAYING, State.PAUSED, State.LOADED]
        },
        {
          name: context.player.Event.AD_PROGRESS,
          from: [State.PLAYING, State.PAUSED, State.PENDING, State.IDLE]
        },
        {
          name: context.player.Event.AD_BUFFERING,
          from: '*'
        },
        {
          name: 'goto',
          from: '*',
          to: s => s
        }
      ],
      methods: {
        onAdloaded: onAdLoaded.bind(context),
        onAdstarted: onAdStarted.bind(context),
        onAdpaused: onAdEvent.bind(context),
        onAdresumed: onAdResumed.bind(context),
        onAdclicked: onAdClicked.bind(context),
        onAdskipped: onAdSkipped.bind(context),
        onAdcompleted: onAdCompleted.bind(context),
        onAdscompleted: onAdsCompleted.bind(context),
        onAdcanskip: onAdCanSkip.bind(context),
        onAdbreakstart: onAdBreakStart.bind(context),
        onAdbreakend: onAdBreakEnd.bind(context),
        onAdfirstquartile: onAdEvent.bind(context),
        onAdmidpoint: onAdEvent.bind(context),
        onAdthirdquartile: onAdEvent.bind(context),
        onAdlog: onAdLog.bind(context),
        onUserclosedad: onAdEvent.bind(context),
        onAdvolumechanged: onAdEvent.bind(context),
        onAdmuted: onAdEvent.bind(context),
        onAdprogress: onAdProgress.bind(context),
        onAdbuffering: onAdEvent.bind(context),
        onEnterState: onEnterState.bind(context),
        onPendingTransition: onPendingTransition.bind(context)
      },
      plugins: [new StateMachineHistory()]
    });
  }
}

/**
 * LOADED event handler.
 * @param {Object} options - fsm event data.
 * @param {any} adEvent - ima event data.
 * @returns {void}
 * @private
 * @memberof ImaStateMachine
 */
function onAdLoaded(options: Object, adEvent: any): void {
  this.logger.debug(adEvent.type.toUpperCase());
  const adBreakType = getAdBreakType.call(this, adEvent);
  const adOptions = getAdOptions.call(this, adEvent);
  const ad = new Ad(adEvent.getAd().getAdId(), adOptions);
  Utils.Dom.setAttribute(this._adsContainerDiv, 'data-adtype', adBreakType);
  this.logger.warn(`adType and extraAdData fields will be deprecated soon from AD_LOADED event payload. See docs for more information`);
  this.dispatchEvent(options.transition, {
    ad: ad,
    adType: adBreakType, // for backward compatibility
    extraAdData: adEvent.getAdData() // for backward compatibility
  });
}

/**
 * STARTED event handler.
 * @param {Object} options - fsm event data.
 * @param {any} adEvent - ima event data.
 * @returns {void}
 * @private
 * @memberof ImaStateMachine
 */
function onAdStarted(options: Object, adEvent: any): void {
  this.logger.debug(adEvent.type.toUpperCase());
  this._currentAd = adEvent.getAd();
  this._adVideoTagAlreadyPlayed = true;
  this._resizeAd();
  this._maybeDisplayCompanionAds();
  if (!this._currentAd.isLinear()) {
    if (this._nextPromise) {
      this._resolveNextPromise();
    } else {
      this.player.play();
    }
  } else {
    this._showAdsContainer();
  }
  const adOptions = getAdOptions.call(this, adEvent);
  const ad = new Ad(adEvent.getAd().getAdId(), adOptions);
  this.dispatchEvent(options.transition, {ad});
}

/**
 * CLICKED event handler.
 * @param {Object} options - fsm event data.
 * @param {any} adEvent - ima event data.
 * @returns {void}
 * @private
 * @memberof ImaStateMachine
 */
function onAdClicked(options: Object, adEvent: any): void {
  this.logger.debug(adEvent.type.toUpperCase());
  if (this._currentAd.isLinear()) {
    if (this._isVideoAd()) {
      this._maybeIgnoreClickOnAd();
      if (this._stateMachine.is(State.PLAYING) && !this.player.isLive()) {
        this._adsManager.pause();
      } else if (this.player.isLive()) {
        this.resumeAd();
      }
      this._setToggleAdsCover(true);
    }
  } else {
    if (!this.player.paused) {
      this.player.pause();
    }
  }
  this.dispatchEvent(options.transition);
}

/**
 * RESUMED event handler.
 * @param {Object} options - fsm event data.
 * @param {any} adEvent - ima event data.
 * @returns {void}
 * @private
 * @memberof ImaStateMachine
 */
function onAdResumed(options: Object, adEvent: any): void {
  this.logger.debug(adEvent.type.toUpperCase());
  this._setToggleAdsCover(false);
  this.dispatchEvent(options.transition);
}

/**
 * COMPLETE event handler.
 * @param {Object} options - fsm event data.
 * @param {any} adEvent - ima event data.
 * @returns {void}
 * @private
 * @memberof ImaStateMachine
 */
function onAdCompleted(options: Object, adEvent: any): void {
  this.logger.debug(adEvent.type.toUpperCase());
  this.dispatchEvent(options.transition);
}

/**
 * ADS_COMPLETED event handler.
 * @param {Object} options - fsm event data.
 * @param {any} adEvent - ima event data.
 * @returns {void}
 * @private
 * @memberof ImaStateMachine
 */
function onAdsCompleted(options: Object, adEvent: any): void {
  this.logger.debug(options.transition.toUpperCase());
  if (this.playOnMainVideoTag() && this._contentComplete && !this.player.config.playback.playAdsWithMSE) {
    this.player.getVideoElement().src = this._contentSrc;
  }
  onAdBreakEnd.call(this, options, adEvent);
}

/**
 * CONTENT_PAUSED_REQUESTED event handler.
 * @param {Object} options - fsm event data.
 * @param {any} adEvent - ima event data.
 * @returns {void}
 * @private
 * @memberof ImaStateMachine
 */
function onAdBreakStart(options: Object, adEvent: any): void {
  this.logger.debug(adEvent.type.toUpperCase());
  this.player.pause();
  const adBreakOptions = getAdBreakOptions.call(this, adEvent);
  const adBreak = new AdBreak(adBreakOptions);
  this._maybeSavePlayerSnapshot();
  this._maybeForceExitFullScreen();
  this._maybeSaveVideoCurrentTime();
  this.dispatchEvent(options.transition, {adBreak: adBreak});
}

/**
 * CONTENT_RESUMED_REQUESTED event handler.
 * @param {Object} options - fsm event data.
 * @param {any} adEvent - ima event data.
 * @returns {void}
 * @private
 * @memberof ImaStateMachine
 */
function onAdBreakEnd(options: Object, adEvent: any): void {
  this.logger.debug(adEvent.type.toUpperCase());
  this._currentAd = null;
  if (!this._contentComplete) {
    if (this.config.forceReloadMediaAfterAds) {
      this.eventManager.listenOnce(this.player, this.player.Event.LOADED_DATA, () => {
        this._maybeSetVideoCurrentTime();
        this.player.play();
      });
      this.player.getVideoElement().load();
    }
    this._hideAdsContainer();
    this._maybeSetVideoCurrentTime();
    if (this._nextPromise) {
      this._resolveNextPromise();
    } else if (!this.config.forceReloadMediaAfterAds) {
      this.player.play();
    }
  }
  this._maybeRestorePlayerSnapshot();
  this.dispatchEvent(options.transition);
}

/**
 * LOG event handler.
 * @param {Object} options - fsm event data.
 * @param {any} adEvent - ima event data.
 * @returns {void}
 * @private
 * @memberof ImaStateMachine
 */
function onAdLog(options: Object, adEvent: any): void {
  this.logger.debug(adEvent.type.toUpperCase());
  let adError;
  if (typeof adEvent.getAdData === 'function') {
    adError = adEvent.getAdData().adError;
  } else if (typeof adEvent.getError === 'function') {
    adError = adEvent.getError();
  }
  if (adError) {
    this.logger.error('Non-fatal error occurred: ' + adError.getMessage());
    this.dispatchEvent(this.player.Event.AD_ERROR, getAdError.call(this, adError, false));
  }
}

/**
 * ERROR event handler.
 * @param {any} adEvent - ima event data.
 * @returns {string} - the state to move
 * @private
 * @memberof ImaStateMachine
 */
function onAdError(adEvent: any): string {
  let state = State.IDLE;
  if (this._playAdByConfig()) {
    this.logger.debug(adEvent.type.toUpperCase());
    let adError = adEvent.getError();
    // if this is autoplay or user already requested play then next promise will handle reset
    if (this._nextPromise) {
      //ads playing on same video tag wait to ima to end the source replacement
      if (this.playOnMainVideoTag() && this.player.env.os.name !== 'iOS') {
        setTimeout(
          () => {
            this._nextPromise.reject(adError);
          },
          0,
          adError
        );
      } else {
        this._nextPromise.reject(adError);
      }
    } else {
      this.reset();
      state = State.DONE;
    }
    this.dispatchEvent('aderror', getAdError.call(this, adError, true));
  }
  return state;
}

/**
 * SKIPPED event handler.
 * @param {Object} options - fsm event data.
 * @param {any} adEvent - ima event data.
 * @returns {void}
 * @private
 * @memberof ImaStateMachine
 */
function onAdSkipped(options: Object, adEvent: any): void {
  this.logger.debug(adEvent.type.toUpperCase());
  this.dispatchEvent(options.transition);
}

/**
 * SKIPPABLE_STATE_CHANGED event handler.
 * @param {Object} options - fsm event data.
 * @param {any} adEvent - ima event data.
 * @returns {void}
 * @private
 * @memberof ImaStateMachine
 */
function onAdCanSkip(options: Object, adEvent: any): void {
  this.logger.debug(adEvent.type.toUpperCase());
  if (this._adsManager.getAdSkippableState()) {
    this.dispatchEvent(options.transition);
  }
}

/**
 * AD_PROGRESS event handler.
 * @param {Object} options - fsm event data.
 * @param {any} adEvent - ima event data.
 * @returns {void}
 * @private
 * @memberof ImaStateMachine
 */
function onAdProgress(options: Object, adEvent: any): void {
  this.logger.debug(adEvent.type.toUpperCase());
  const remainingTime = this._adsManager.getRemainingTime();
  const duration = adEvent.getAdData() && adEvent.getAdData().duration;
  let currentTime = duration - remainingTime;
  currentTime = currentTime < 0 ? 0 : currentTime;
  if (Utils.Number.isNumber(duration) && Utils.Number.isNumber(currentTime)) {
    this.dispatchEvent(options.transition, {
      adProgress: {
        currentTime: currentTime,
        duration: duration
      }
    });
  }
}

/**
 * General event handler.
 * @param {Object} options - fsm event data.
 * @param {any} adEvent - ima event data.
 * @returns {void}
 * @private
 * @memberof ImaStateMachine
 */
function onAdEvent(options: Object, adEvent: any): void {
  this.logger.debug(adEvent.type.toUpperCase());
  this.dispatchEvent(options.transition);
}

/**
 * Enter state handler.
 * @param {Object} options - fsm event data.
 * @returns {void}
 * @private
 * @memberof ImaStateMachine
 */
function onEnterState(options: Object): void {
  if (options.from !== options.to) {
    this.logger.debug('Change state: ' + options.from + ' => ' + options.to);
  }
}

/**
 * onPendingTransition handler
 * @param {string} transition - transition
 * @param {string} from - from
 * @param {string} to - to
 * @returns {void}
 * @private
 * @memberof ImaStateMachine
 */
function onPendingTransition(transition: string, from: string, to: string): void {
  this.logger.warn('The previous transition is still in progress', {transition, from, to});
}

/**
 * Gets the ad error object.
 * @param {any} adError - The ima ad error object.
 * @param {boolean} fatal - Whether the error is fatal.
 * @returns {Error} - The ad error object.
 * @private
 * @memberof ImaStateMachine
 */
function getAdError(adError: any, fatal: boolean): Error {
  const severity = fatal ? Error.Severity.CRITICAL : Error.Severity.RECOVERABLE;
  const category = Error.Category.ADS;
  let code;
  try {
    if (adError.getVastErrorCode() !== 900) {
      code = parseInt(Error.Category.ADS + adError.getVastErrorCode());
    } else {
      code = Error.Code.AD_UNDEFINED_ERROR;
    }
  } catch (e) {
    code = Error.Code.AD_UNDEFINED_ERROR;
  }
  let ad;
  if (this._adsManager) {
    try {
      const currentAd = this._adsManager.getCurrentAd();
      const adEvent = {getAd: () => currentAd, getAdData: () => undefined};
      const adOptions = getAdOptions.call(this, adEvent);
      ad = new Ad(currentAd.getAdId(), adOptions);
    } catch (e) {
      //do nothing
    }
  }
  return new Error(severity, category, code, {
    ad,
    innerError: adError
  });
}

/**
 * Gets the ad options.
 * @param {any} adEvent - The ima ad event object.
 * @returns {Object} - The ad options.
 * @private
 * @memberof ImaStateMachine
 */
function getAdOptions(adEvent: any): Object {
  const adOptions = {};
  const ad = adEvent.getAd();
  const adData = adEvent.getAdData();
  const podInfo = ad.getAdPodInfo();
  if (adData) {
    // vpaid field exists on AD_LOADED but not on AD_STARTED
    this._isVpaid = adData.vpaid;
  }
  adOptions.system = ad.getAdSystem();
  adOptions.url = ad.getMediaUrl();
  adOptions.clickThroughUrl = adData && adData.clickThroughUrl;
  adOptions.contentType = ad.getContentType();
  adOptions.duration = ad.getDuration();
  adOptions.position = this._adPosition || podInfo.getAdPosition();
  adOptions.title = ad.getTitle();
  adOptions.linear = ad.isLinear();
  adOptions.skipOffset = ad.getSkipTimeOffset();
  adOptions.width = ad.isLinear() ? ad.getVastMediaWidth() : ad.getWidth();
  adOptions.height = ad.isLinear() ? ad.getVastMediaHeight() : ad.getHeight();
  adOptions.bitrate = ad.getVastMediaBitrate();
  adOptions.bumper = podInfo.getIsBumper() || this._isBumper;
  adOptions.vpaid = this._isVpaid;
  adOptions.wrapperAdIds = ad.getWrapperAdIds();
  adOptions.wrapperCreativeIds = ad.getWrapperCreativeIds();
  adOptions.wrapperAdSystems = ad.getWrapperAdSystems();
  return adOptions;
}

/**
 * Gets the ad break options.
 * @param {any} adEvent - The ima ad event object.
 * @returns {Object} - The ad break options.
 * @private
 * @memberof ImaStateMachine
 */
function getAdBreakOptions(adEvent: any): Object {
  const adBreakOptions = {};
  adBreakOptions.numAds = this._podLength || adEvent.getAd().getAdPodInfo().getTotalAds();
  adBreakOptions.position = this.player.ended ? -1 : this.player.currentTime;
  adBreakOptions.type = getAdBreakType.call(this, adEvent);
  return adBreakOptions;
}

/**
 * Gets the ad break type.
 * @param {any} adEvent - The ima ad event object.
 * @returns {string} - The ad break type.
 * @private
 * @memberof ImaStateMachine
 */
function getAdBreakType(adEvent: any): string {
  try {
    const ad = adEvent.getAd();
    if (!ad.isLinear()) {
      return AdBreakType.OVERLAY;
    }
  } catch (e) {
    // do nothing
  }
  if (this._playAdByConfig()) {
    return getAdBreakTypeFromSdk(adEvent);
  } else {
    return this._getAdBreakTypeFromPlayer();
  }
}

/**
 * Gets the ad break type from ima sdk.
 * @param {any} adEvent - The ima ad event object.
 * @returns {string} - The ad break type.
 * @private
 * @memberof ImaStateMachine
 */
function getAdBreakTypeFromSdk(adEvent: any): string {
  const ad = adEvent.getAd();
  const podInfo = ad.getAdPodInfo();
  const podIndex = podInfo.getPodIndex();
  if (!ad.isLinear()) {
    return AdBreakType.OVERLAY;
  }
  switch (podIndex) {
    case 0:
      return AdBreakType.PRE;
    case -1:
      return AdBreakType.POST;
    default:
      return AdBreakType.MID;
  }
}

export {ImaStateMachine};
