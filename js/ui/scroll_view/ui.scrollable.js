"use strict";

var $ = require("../../core/renderer"),
    eventsEngine = require("../../events/core/events_engine"),
    support = require("../../core/utils/support"),
    browser = require("../../core/utils/browser"),
    commonUtils = require("../../core/utils/common"),
    typeUtils = require("../../core/utils/type"),
    extend = require("../../core/utils/extend").extend,
    getPublicElement = require("../../core/utils/dom").getPublicElement,
    windowUtils = require("../../core/utils/window"),
    navigator = windowUtils.getNavigator(),
    domAdapter = require("../../core/dom_adapter"),
    devices = require("../../core/devices"),
    registerComponent = require("../../core/component_registrator"),
    DOMComponent = require("../../core/dom_component"),
    selectors = require("../widget/selectors"),
    eventUtils = require("../../events/utils"),
    scrollEvents = require("./ui.events.emitter.gesture.scroll"),
    simulatedStrategy = require("./ui.scrollable.simulated"),
    NativeStrategy = require("./ui.scrollable.native"),
    when = require("../../core/utils/deferred").when;

var SCROLLABLE = "dxScrollable",
    SCROLLABLE_STRATEGY = "dxScrollableStrategy",
    SCROLLABLE_CLASS = "dx-scrollable",
    SCROLLABLE_DISABLED_CLASS = "dx-scrollable-disabled",
    SCROLLABLE_CONTAINER_CLASS = "dx-scrollable-container",
    SCROLLABLE_WRAPPER_CLASS = "dx-scrollable-wrapper",
    SCROLLABLE_CONTENT_CLASS = "dx-scrollable-content",
    VERTICAL = "vertical",
    HORIZONTAL = "horizontal",
    BOTH = "both";

var deviceDependentOptions = function() {
    return [{
        device: function() {
            return !support.nativeScrolling;
        },
        options: {
            /**
            * @name dxScrollableOptions_useNative
            * @publicName useNative
            * @default false @for desktop
            * @default true @for Mac
            */
            useNative: false
        }
    }, {
        device: function(device) {
            return !devices.isSimulator() && devices.real().platform === "generic" && device.platform === "generic";
        },
        options: {
            /**
            * @name dxScrollableOptions_bounceEnabled
            * @publicName bounceEnabled
            * @default false @for desktop
            */
            bounceEnabled: false,

            /**
            * @name dxScrollableOptions_scrollByThumb
            * @publicName scrollByThumb
            * @default true @for desktop
            */
            scrollByThumb: true,

            /**
            * @name dxScrollableOptions_scrollByContent
            * @publicName scrollByContent
            * @default false @for non-touch_devices
            */
            scrollByContent: support.touch,

            /**
            * @name dxScrollableOptions_showScrollbar
            * @publicName showScrollbar
            * @default 'onHover' @for desktop
            */
            showScrollbar: "onHover"
        }
    }];
};

/**
* @name dxScrollable
* @publicName dxScrollable
* @type object
* @inherits DOMComponent
* @namespace DevExpress.ui
* @hidden
*/
var Scrollable = DOMComponent.inherit({

    _getDefaultOptions: function() {
        return extend(this.callBase(), {
            /**
            * @name dxScrollableOptions_disabled
            * @publicName disabled
            * @type boolean
            * @default false
            */
            disabled: false,
            /**
            * @name dxScrollableOptions_onScroll
            * @publicName onScroll
            * @extends Action
            * @type function(e)
            * @type_function_param1 e:object
            * @type_function_param1_field4 jQueryEvent:jQuery.Event:deprecated(event)
            * @type_function_param1_field5 event:event
            * @type_function_param1_field6 scrollOffset:object
            * @type_function_param1_field7 reachedLeft:boolean
            * @type_function_param1_field8 reachedRight:boolean
            * @type_function_param1_field9 reachedTop:boolean
            * @type_function_param1_field10 reachedBottom:boolean
            * @action
            */
            onScroll: null,

            /**
            * @name dxScrollableOptions_direction
            * @publicName direction
            * @type Enums.ScrollDirection
            * @default "vertical"
            */
            direction: VERTICAL,

            /**
            * @name dxScrollableOptions_showScrollbar
            * @publicName showScrollbar
            * @type string
            * @acceptValues 'onScroll'|'onHover'|'always'|'never'
            * @default 'onScroll'
            */
            showScrollbar: "onScroll",

            /**
            * @name dxScrollableOptions_useNative
            * @publicName useNative
            * @type boolean
            * @default true
            */
            useNative: true,

            /**
            * @name dxScrollableOptions_bounceEnabled
            * @publicName bounceEnabled
            * @type boolean
            * @default true
            */
            bounceEnabled: true,

            /**
            * @name dxScrollableOptions_scrollByContent
            * @publicName scrollByContent
            * @type boolean
            * @default true
            */
            scrollByContent: true,

            /**
            * @name dxScrollableOptions_scrollByThumb
            * @publicName scrollByThumb
            * @type boolean
            * @default false
            */
            scrollByThumb: false,

            /**
            * @name dxScrollableOptions_onUpdated
            * @publicName onUpdated
            * @extends Action
            * @type function(e)
            * @type_function_param1 e:object
            * @type_function_param1_field4 jQueryEvent:jQuery.Event:deprecated(event)
            * @type_function_param1_field5 event:event
            * @type_function_param1_field6 scrollOffset:object
            * @type_function_param1_field7 reachedLeft:boolean
            * @type_function_param1_field8 reachedRight:boolean
            * @type_function_param1_field9 reachedTop:boolean
            * @type_function_param1_field10 reachedBottom:boolean
            * @action
            */
            onUpdated: null,

            onStart: null,
            onEnd: null,

            onBounce: null,
            onStop: null,

            useSimulatedScrollbar: false,
            useKeyboard: true,

            inertiaEnabled: true,

            pushBackValue: 0,

            updateManually: false
        });
    },

    _defaultOptionsRules: function() {
        return this.callBase().concat(deviceDependentOptions(), [
            {
                device: function() {
                    return support.nativeScrolling && devices.real().platform === "android" && !browser.mozilla;
                },
                options: {
                    useSimulatedScrollbar: true
                }
            },
            {
                device: function() {
                    return devices.real().platform === "ios";
                },
                options: {
                    pushBackValue: 1
                }
            }
        ]);
    },

    _initOptions: function(options) {
        this.callBase(options);
        if(!("useSimulatedScrollbar" in options)) {
            this._setUseSimulatedScrollbar();
        }
    },

    _setUseSimulatedScrollbar: function() {
        if(!this.initialOption("useSimulatedScrollbar")) {
            this.option("useSimulatedScrollbar", !this.option("useNative"));
        }
    },

    _init: function() {
        this.callBase();
        this._initScrollableMarkup();
        this._locked = false;
    },

    _visibilityChanged: function(visible) {
        if(visible) {
            this.update();
            this._toggleRTLDirection(this.option("rtlEnabled"));
            this._savedScrollOffset && this.scrollTo(this._savedScrollOffset);
            delete this._savedScrollOffset;
        } else {
            this._savedScrollOffset = this.scrollOffset();
        }
    },

    _initScrollableMarkup: function() {
        var $element = this.$element().addClass(SCROLLABLE_CLASS),
            $container = this._$container = $("<div>").addClass(SCROLLABLE_CONTAINER_CLASS),
            $wrapper = this._$wrapper = $("<div>").addClass(SCROLLABLE_WRAPPER_CLASS),
            $content = this._$content = $("<div>").addClass(SCROLLABLE_CONTENT_CLASS);

        if(domAdapter.hasDocumentProperty("onbeforeactivate") && browser.msie && browser.version < 12) {
            eventsEngine.on($element, eventUtils.addNamespace("beforeactivate", SCROLLABLE), function(e) {
                if(!$(e.target).is(selectors.focusable)) {
                    e.preventDefault();
                }
            });
        }

        $content.append($element.contents()).appendTo($container);
        $container.appendTo($wrapper);
        $wrapper.appendTo($element);
    },

    _dimensionChanged: function() {
        this.update();
    },

    _attachNativeScrollbarsCustomizationCss: function() {
        // NOTE: Customize native scrollbars for dashboard team

        if(devices.real().deviceType === "desktop" && !(navigator.platform.indexOf('Mac') > -1 && browser['webkit'])) {
            this.$element().addClass("dx-scrollable-customizable-scrollbars");
        }
    },

    _initMarkup: function() {
        this.callBase();
        this._renderDirection();
        this._renderStrategy();
    },

    _render: function() {
        this._attachNativeScrollbarsCustomizationCss();

        this._attachEventHandlers();
        this._renderDisabledState();
        this._createActions();
        this.update();

        this.callBase();

        this._toggleRTLDirection(this.option("rtlEnabled"));
    },

    _toggleRTLDirection: function(rtl) {
        var that = this;

        this.callBase(rtl);
        this._updateBounds();
        if(rtl && this.option("direction") !== VERTICAL) {
            commonUtils.deferUpdate(function() {
                var left = that.scrollWidth() - that.clientWidth();
                commonUtils.deferRender(function() {
                    that.scrollTo({ left: left });
                });
            });
        }
    },

    _updateBounds: function() {
        this._strategy.updateBounds();
    },

    _attachEventHandlers: function() {
        var strategy = this._strategy;

        var initEventData = {
            getDirection: strategy.getDirection.bind(strategy),
            validate: this._validate.bind(this),
            isNative: this.option("useNative"),
            scrollTarget: this._$container
        };

        eventsEngine.off(this._$wrapper, "." + SCROLLABLE);
        eventsEngine.on(this._$wrapper, eventUtils.addNamespace(scrollEvents.init, SCROLLABLE), initEventData, this._initHandler.bind(this));
        eventsEngine.on(this._$wrapper, eventUtils.addNamespace(scrollEvents.start, SCROLLABLE), strategy.handleStart.bind(strategy));
        eventsEngine.on(this._$wrapper, eventUtils.addNamespace(scrollEvents.move, SCROLLABLE), strategy.handleMove.bind(strategy));
        eventsEngine.on(this._$wrapper, eventUtils.addNamespace(scrollEvents.end, SCROLLABLE), strategy.handleEnd.bind(strategy));
        eventsEngine.on(this._$wrapper, eventUtils.addNamespace(scrollEvents.cancel, SCROLLABLE), strategy.handleCancel.bind(strategy));
        eventsEngine.on(this._$wrapper, eventUtils.addNamespace(scrollEvents.stop, SCROLLABLE), strategy.handleStop.bind(strategy));

        eventsEngine.off(this._$container, "." + SCROLLABLE);
        eventsEngine.on(this._$container, eventUtils.addNamespace("scroll", SCROLLABLE), strategy.handleScroll.bind(strategy));
    },

    _validate: function(e) {
        if(this._isLocked()) {
            return false;
        }

        this._updateIfNeed();

        return this._strategy.validate(e);
    },

    _initHandler: function() {
        var strategy = this._strategy;
        strategy.handleInit.apply(strategy, arguments);
    },

    _renderDisabledState: function() {
        this.$element().toggleClass(SCROLLABLE_DISABLED_CLASS, this.option("disabled"));

        if(this.option("disabled")) {
            this._lock();
        } else {
            this._unlock();
        }
    },

    _renderDirection: function() {
        this.$element()
            .removeClass("dx-scrollable-" + HORIZONTAL)
            .removeClass("dx-scrollable-" + VERTICAL)
            .removeClass("dx-scrollable-" + BOTH)
            .addClass("dx-scrollable-" + this.option("direction"));
    },

    _renderStrategy: function() {
        this._createStrategy();
        this._strategy.render();
        this.$element().data(SCROLLABLE_STRATEGY, this._strategy);
    },

    _createStrategy: function() {
        this._strategy = (this.option("useNative"))
            ? new NativeStrategy(this)
            : new simulatedStrategy.SimulatedStrategy(this);
    },

    _createActions: function() {
        this._strategy.createActions();
    },

    _clean: function() {
        this._strategy.dispose();
    },

    _optionChanged: function(args) {
        switch(args.name) {
            case "onStart":
            case "onEnd":
            case "onStop":
            case "onUpdated":
            case "onScroll":
            case "onBounce":
                this._createActions();
                break;
            case "direction":
                this._resetInactiveDirection();
                this._invalidate();
                break;
            case "useNative":
                this._setUseSimulatedScrollbar();
                this._invalidate();
                break;
            case "inertiaEnabled":
            case "scrollByContent":
            case "scrollByThumb":
            case "bounceEnabled":
            case "useKeyboard":
            case "showScrollbar":
            case "useSimulatedScrollbar":
            case "pushBackValue":
                this._invalidate();
                break;
            case "disabled":
                this._renderDisabledState();
                break;
            case "updateManually":
                break;
            default:
                this.callBase(args);
        }
    },

    _resetInactiveDirection: function() {
        var inactiveProp = this._getInactiveProp();
        if(!inactiveProp) {
            return;
        }

        var scrollOffset = this.scrollOffset();
        scrollOffset[inactiveProp] = 0;
        this.scrollTo(scrollOffset);
    },

    _getInactiveProp: function() {
        var direction = this.option("direction");
        if(direction === VERTICAL) {
            return "left";
        }
        if(direction === HORIZONTAL) {
            return "top";
        }
    },

    _location: function() {
        return this._strategy.location();
    },

    _normalizeLocation: function(location) {
        if(typeUtils.isPlainObject(location)) {
            var left = commonUtils.ensureDefined(location.left, location.x);
            var top = commonUtils.ensureDefined(location.top, location.y);
            return {
                left: typeUtils.isDefined(left) ? -left : undefined,
                top: typeUtils.isDefined(top) ? -top : undefined
            };
        } else {
            var direction = this.option("direction");
            return {
                left: direction !== VERTICAL ? -location : undefined,
                top: direction !== HORIZONTAL ? -location : undefined
            };
        }
    },

    _isLocked: function() {
        return this._locked;
    },

    _lock: function() {
        this._locked = true;
    },

    _unlock: function() {
        if(!this.option("disabled")) {
            this._locked = false;
        }
    },

    _isDirection: function(direction) {
        var current = this.option("direction");
        if(direction === VERTICAL) {
            return current !== HORIZONTAL;
        }
        if(direction === HORIZONTAL) {
            return current !== VERTICAL;
        }
        return current === direction;
    },

    _updateAllowedDirection: function() {
        var allowedDirections = this._strategy._allowedDirections();

        if(this._isDirection(BOTH) && allowedDirections.vertical && allowedDirections.horizontal) {
            this._allowedDirectionValue = BOTH;
        } else if(this._isDirection(HORIZONTAL) && allowedDirections.horizontal) {
            this._allowedDirectionValue = HORIZONTAL;
        } else if(this._isDirection(VERTICAL) && allowedDirections.vertical) {
            this._allowedDirectionValue = VERTICAL;
        } else {
            this._allowedDirectionValue = null;
        }
    },

    _allowedDirection: function() {
        return this._allowedDirectionValue;
    },

    _container: function() {
        return this._$container;
    },

    $content: function() {
        return this._$content;
    },

    /**
    * @name dxScrollablemethods_content
    * @publicName content()
    * @return dxElement
    */
    content: function() {
        return getPublicElement(this._$content);
    },

    /**
    * @name dxScrollablemethods_scrollOffset
    * @publicName scrollOffset()
    * @return object
    */
    scrollOffset: function() {
        var location = this._location();
        return {
            top: -location.top,
            left: -location.left
        };
    },

    /**
    * @name dxScrollablemethods_scrollTop
    * @publicName scrollTop()
    * @return numeric
    */
    scrollTop: function() {
        return this.scrollOffset().top;
    },

    /**
    * @name dxScrollablemethods_scrollLeft
    * @publicName scrollLeft()
    * @return numeric
    */
    scrollLeft: function() {
        return this.scrollOffset().left;
    },

    /**
    * @name dxScrollablemethods_clientHeight
    * @publicName clientHeight()
    * @return numeric
    */
    clientHeight: function() {
        return this._$container.height();
    },

    /**
    * @name dxScrollablemethods_scrollHeight
    * @publicName scrollHeight()
    * @return numeric
    */
    scrollHeight: function() {
        return this.$content().outerHeight() - 2 * this._strategy.verticalOffset();
    },

    /**
    * @name dxScrollablemethods_clientWidth
    * @publicName clientWidth()
    * @return numeric
    */
    clientWidth: function() {
        return this._$container.width();
    },

    /**
    * @name dxScrollablemethods_scrollWidth
    * @publicName scrollWidth()
    * @return numeric
    */
    scrollWidth: function() {
        return this.$content().outerWidth();
    },

    /**
    * @name dxScrollablemethods_update
    * @publicName update()
    * @return Promise<void>
    */
    update: function() {
        var that = this;
        return when(that._strategy.update()).done(function() {
            that._updateAllowedDirection();
        });
    },

    /**
    * @name dxScrollablemethods_scrollBy
    * @publicName scrollBy(distance)
    * @param1 distance:numeric
    */
    /**
    * @name dxScrollablemethods_scrollBy
    * @publicName scrollBy(distanceObject)
    * @param1 distanceObject:object
    */
    scrollBy: function(distance) {
        distance = this._normalizeLocation(distance);

        if(!distance.top && !distance.left) {
            return;
        }

        this._updateIfNeed();
        this._strategy.scrollBy(distance);
    },

    /**
    * @name dxScrollablemethods_scrollTo
    * @publicName scrollTo(targetLocation)
    * @param1 targetLocation:numeric
    */
    /**
    * @name dxScrollablemethods_scrollTo
    * @publicName scrollTo(targetLocationObject)
    * @param1 targetLocation:object
    */
    scrollTo: function(targetLocation) {
        targetLocation = this._normalizeLocation(targetLocation);

        this._updateIfNeed();

        var location = this._location();

        var distance = this._normalizeLocation({
            left: location.left - commonUtils.ensureDefined(targetLocation.left, location.left),
            top: location.top - commonUtils.ensureDefined(targetLocation.top, location.top)
        });

        if(!distance.top && !distance.left) {
            return;
        }

        this._strategy.scrollBy(distance);
    },

    /**
    * @name dxScrollablemethods_scrollToElement
    * @publicName scrollToElement(targetLocation)
    * @param1 element:Node|jQuery
    */
    scrollToElement: function(element, offset) {
        offset = offset || {};
        var $element = $(element);
        var elementInsideContent = this.$content().find(element).length;
        var elementIsInsideContent = ($element.parents("." + SCROLLABLE_CLASS).length - $element.parents("." + SCROLLABLE_CONTENT_CLASS).length) === 0;
        if(!elementInsideContent || !elementIsInsideContent) {
            return;
        }

        var scrollPosition = { top: 0, left: 0 };
        var direction = this.option("direction");

        if(direction !== VERTICAL) {
            scrollPosition.left = this._scrollToElementPosition($element, HORIZONTAL, offset);
        }
        if(direction !== HORIZONTAL) {
            scrollPosition.top = this._scrollToElementPosition($element, VERTICAL, offset);
        }

        this.scrollTo(scrollPosition);
    },

    _scrollToElementPosition: function($element, direction, offset) {
        var isVertical = direction === VERTICAL;
        var startOffset = (isVertical ? offset.top : offset.left) || 0;
        var endOffset = (isVertical ? offset.bottom : offset.right) || 0;
        var pushBackOffset = isVertical ? this._strategy.verticalOffset() : 0;
        var elementPositionRelativeToContent = this._elementPositionRelativeToContent($element, isVertical ? 'top' : 'left');
        var elementPosition = elementPositionRelativeToContent - pushBackOffset;
        var elementSize = $element[isVertical ? 'outerHeight' : 'outerWidth']();
        var scrollLocation = (isVertical ? this.scrollTop() : this.scrollLeft());
        var clientSize = (isVertical ? this.clientHeight() : this.clientWidth());

        var startDistance = scrollLocation - elementPosition + startOffset;
        var endDistance = scrollLocation - elementPosition - elementSize + clientSize - endOffset;

        if(startDistance <= 0 && endDistance >= 0) {
            return scrollLocation;
        }

        return scrollLocation - (Math.abs(startDistance) > Math.abs(endDistance) ? endDistance : startDistance);
    },

    _elementPositionRelativeToContent: function($element, prop) {
        var result = 0;
        while(this._hasScrollContent($element)) {
            result += $element.position()[prop];
            $element = $element.offsetParent();
        }
        return result;
    },

    _hasScrollContent: function($element) {
        var $content = this.$content();
        return $element.closest($content).length && !$element.is($content);
    },

    _updateIfNeed: function() {
        if(!this.option("updateManually")) {
            this.update();
        }
    }
});

registerComponent(SCROLLABLE, Scrollable);

module.exports = Scrollable;

module.exports.deviceDependentOptions = deviceDependentOptions;
