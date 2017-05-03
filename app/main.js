// Create beautiful scrolling navigation lists with stacking headers.
//
// This is a clone of Slinky.js (http://slinky.iclanzan.com) with added
// features, including:
//
// - No jQuery dependency.
// - Section progress shown in headers.
// - Click to scroll.
// - Resize with a scrollbar on the window.
//
// Original implementation: http://codepen.io/rileyjshaw/pen/pIFly

/**
 * Get the pixel offset of an element relative to the top of the page.
 *
 * @param  {DOMElement}  element
 * @return {number}      (in pixels)
 */
function getTop (element) {
	var top = 0;
	do {
		top += element.offsetTop  || 0;
		element = element.offsetParent;
	} while (element);

	return top;
}

/**
 * Scroll the window smoothly to a specific offset.
 *
 * @param  {number} top  The destination offset, in pixels.
 * @return {undefined}
 */
function smoothScroll (top) {
	function scroll () {
		// Absolute value of the position difference, in pixels.
		var diff = (top - windowTop) * direction;

		// Early exit if we've reached (or overshot) the destination.
		if (diff > 0) {return;}

		windowTop += Math.min(diff, 30) * direction;
		window.scrollTo(0, windowTop);
		window.requestAnimationFrame(scroll);
	}

	var windowTop = window.pageYOffset;
	var direction;
	if (top !== windowTop) {
		direction = top - windowTop > 0 ? 1 : -1;
		window.requestAnimationFrame(scroll);
	}
}

/**
 * Create or update a section object.
 *
 * @param  {DOMElement | object} section  A <section> from the DOM on
 *                                        initialization. Otherwise, a pre-
 *                                        constructed section object to update.
 * @param  {number} i  Index.
 * @return {object}    A section object.
 */
function initSections (section, i) {
	if (section.el) {
		section.top = getTop(section.el);
		section.height = section.el.offsetHeight;
		section.header.onclick =
			function () {smoothScroll(section.top - topLatch);};
		section.fixed = null;
		section.el.style.cssText = section.header.style.cssText = '';
		return section;
	}

	var h1 = section.querySelector('h1');
	var progress;
	var height = section.offsetHeight;
	var topLatch = i * 42;
	var top = getTop(section);

	h1.innerHTML = '<span class="progress"></span><span class="text">' +
		h1.textContent + '</span>';
	progress = h1.querySelector('.progress');
	// HACK: Messy, but easy to override
	h1.onclick = function () {smoothScroll(top - topLatch);};

	return {
		el: section,
		header: h1,
		progress: progress,
		top: top,
		height: height,
		topLatch: topLatch,
		bottomLatch: (state.dom.sections.length - 1 - i) * 42,
		fixed: null,
	};
}

/**
 * Called on each section when the container has enough room to keep a header
 * stuck to the top. Updates latching / progress for the passed in section.
 *
 * @param  {object} section  The section to check and update.
 * @param  {number} top      The page's current YOffset.
 * @return {undefined}
 */
function scrollHandlerInner (section, top) {
	var diff = top - section.top;
	var progressStyle = section.progress.style;
	var progressStyleWidth = progressStyle.width;

	// If we've read or are currently reading this section:
	if (diff >= -section.topLatch) {
		// Latch the header to the top.
		if (section.fixed !== 'top') {
			section.fixed = 'top';
			section.header.style.cssText =
				'position:fixed;top:' + section.topLatch + 'px';
			section.el.style.cssText = 'padding-top: 42px';
		}

		// Update the header bar to reflect current progress (max 100%).
		if (diff < section.height) {
			progressStyle.width = Math.min(
				(diff + section.topLatch) / (section.height - 42), 1
			) * 100 + '%';
		} else if (progressStyleWidth !== '100%') {progressStyle.width = '100%';}
	} else {
		if (progressStyleWidth !== '0px') {progressStyle.width = 0;}
		if (diff + state.windowHeight - section.bottomLatch - 42 < 0) {
			// Latch the header to the bottom.
			if (section.fixed !== 'bottom') {
				section.fixed = 'bottom';
				section.header.style.cssText =
					'position: fixed;bottom:' + section.bottomLatch + 'px';
				section.el.style.cssText = 'padding-bottom: 42px';
			}
		} else if (section.fixed) {
			// Unlatch the header from the bottom.
			section.fixed = null;
			section.el.style.cssText = section.header.style.cssText = '';
		}
	}
}

/**
 * Latch a section to the bottom of the screen.
 *
 * @param  {object} section  A section object.
 * @return {undefined}
 */
function stickToBottom (section) {
	section.fixed = null;
	section.header.style.cssText =
		'position: absolute;bottom:' + section.bottomLatch + 'px';
	section.progress.style.width = '100%';
}

/**
 * Update the header latching / progress UI on scroll events.
 *
 * @return {undefined}
 */
function scrollHandler () {
	// TODO(riley): Handle scrolling past top.
	var top = window.pageYOffset;

	// If the container has less room than will be taken up by the headers:
	if (state.articleBottom - top < state.compressedHeight) {
		if (!state.stickyLatch) {
			state.stickyLatch = true;
			state.dom.sections.forEach(stickToBottom);
		}
	} else {
		if (state.stickyLatch) {state.stickyLatch = false;}
		state.dom.sections.forEach(function (section) {
			scrollHandlerInner(section, top);
		});
	}
}

/**
 * Re-initialize state on resize. Debounced on `state.resizeDone`.
 *
 * @return {undefined}
 */
function resizeHandler () {
	clearTimeout(state.resizeDone);
	state.resizeDone = setTimeout(init, 500);
}

/**
 * Initialize the plugin state.
 *
 * @return {undefined}
 */
function init () {
	state.dom.article = document.querySelector('article');
	state.dom.sections = Array.prototype.slice.call(
		state.dom.article.querySelectorAll('section'), 0);

	// Add event listeners to the window.
	window.addEventListener('scroll', scrollHandler, false);
	window.addEventListener('resize', resizeHandler, false);

	state.compressedHeight = state.dom.sections.length * 42;
	state.windowHeight = window.innerHeight;
	state.articleTop = getTop(state.dom.article);
	state.dom.sections = state.dom.sections.map(initSections);
	state.stickyLatch = false;
	state.articleBottom = state.articleTop + state.dom.article.offsetHeight;

	scrollHandler();
}

// Mutable plugin state.
var state = {
	dom: {},
	// The amount of vertical space taken up by the headers.
	compressedHeight: 0,
	windowHeight: 0,
	articleTop: 0,
	articleBottom: 0,
	stickyLatch: false,
	resizeDone: null,
};

// Exports.
exports.init = init;
exports.remove = function removeSlinky () {
	window.removeEventListener('scroll', scrollHandler);
	window.removeEventListener('resize', resizeHandler);
	window.delete(slinky);
};
