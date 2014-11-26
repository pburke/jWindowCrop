/*
* jWindowCrop v1.0.0
*
* Copyright (c) 2012 Tyler Brown
* Licensed under the MIT license.
*
*/

(function($){
	function fillContainer(val, targetLength, containerLength) { // ensure that no gaps are between target's edges and container's edges
	if(val + targetLength < containerLength) val = containerLength-targetLength;
	if(val > 0) val = 0;
	return val;
}

$.jWindowCrop = function(image, options){
	var base = this;
	base.$image = $(image); // target image jquery element
	base.image = image; // target image dom element
	base.$image.data("jWindowCrop", base); // target frame jquery element

	base.namespace = 'jWindowCrop';
	base.originalWidth = 0;
	base.isDragging = false;

	base.init = function(){
		base.$image.css({display:'none'}); // hide image until loaded
		base.options = $.extend({},$.jWindowCrop.defaultOptions, options);
		base.options.targetWidth = base.options.targetWidth ? base.options.targetWidth : base.options.frameWidth ;
		base.options.targetHeight = base.options.targetHeight ? base.options.targetHeight : base.options.frameHeight ;
		if(base.options.zoomSteps < 2) base.options.zoomSteps = 2;

		base.$image.addClass('jwc_image').wrap('<div class="jwc_frame" />'); // wrap image in frame
		base.$frame = base.$image.parent();
		base.$frame.append('<div class="jwc_loader">' + base.options.loadingText + '</div>');
		base.$frame.append('<div class="jwc_controls" style="display:'+(base.options.showControlsOnStart ? 'block' : 'none')+';"><span>click to drag</span><a href="#" class="jwc_zoom_in"></a><a href="#" class="jwc_zoom_out"></a></div>');
		base.$frame.css({'overflow': 'hidden', 'position': 'relative', 'width': base.options.frameWidth, 'height': base.options.frameHeight});
		base.$image.css({'position': 'absolute', 'top': '0px', 'left': '0px'});
		initializeDimensions();

		base.$frame.find('.jwc_zoom_in').on('click.'+base.namespace, base.zoomIn);
		base.$frame.find('.jwc_zoom_out').on('click.'+base.namespace, base.zoomOut);
		base.$frame.on('mouseenter.'+base.namespace, handleMouseEnter);
		base.$frame.on('mouseleave.'+base.namespace, handleMouseLeave);
		base.$image.on('load.'+base.namespace, handeImageLoad);
		base.$image.on('mousedown.'+base.namespace+' touchstart.'+base.namespace, handleMouseDown);
		$(document).on('mousemove.'+base.namespace+' touchmove.'+base.namespace, handleMouseMove);
		$(document).on('mouseup.'+base.namespace+' touchend.'+base.namespace, handleMouseUp);
	};

	base.destroy = function() {
		base.$image.removeData("jWindowCrop"); // remove data
		$(document).unbind('.'+base.namespace); // remove body binds
		base.$image.unbind('.'+base.namespace); // remove image binds
		base.$frame.unbind('.'+base.namespace); // remove frame binds
		base.$frame.find('.jwc_zoom_out').unbind('.'+base.namespace); // remove zoom triggers
		base.$frame.find('.jwc_zoom_in').unbind('.'+base.namespace);  // remove zoom triggers
		$('.jwc_loader').remove();   // remove the added text
		$('.jwc_controls').remove(); // remove the added controls
		base.$image.removeAttr( 'style' ); // undo the style
		base.$image.unwrap(); // undo the wrap
	};

	base.setZoom = function(percent) {
		if(base.minPercent >= 1) {
			percent = base.minPercent;
		} else if(percent > base.maxPercent) {
			percent = base.maxPercent;
		} else if(percent < base.minPercent) {
			percent = base.minPercent;
		}
		base.$image.width(Math.ceil(base.originalWidth*percent));
		base.workingPercent = percent;
		focusOnCenter();
		updateResult();
	};
	base.zoomIn = function() {
		var zoomIncrement = (base.maxPercent - base.minPercent) / (base.options.zoomSteps-1);
		base.setZoom(base.workingPercent+zoomIncrement);
		return false;
	};
	base.zoomOut = function() {
		var zoomIncrement = (base.maxPercent - base.minPercent) / (base.options.zoomSteps-1);
		base.setZoom(base.workingPercent-zoomIncrement);
		return false;
	};

	function initializeDimensions() {
		if(base.originalWidth == 0) {
			base.originalWidth = base.$image.width();
			base.originalHeight = base.$image.height();
		}
		if(base.originalWidth > 0) {
			var frameWidthRatio = base.options.frameWidth / base.originalWidth;
			var frameHeightRatio = base.options.frameHeight / base.originalHeight;
			var targetWidthRatio = base.options.targetWidth / base.originalWidth;
			var targetHeightRatio = base.options.targetHeight / base.originalHeight;

			// calculate the minPercent scale (the lesser of the ratios of frame:original and target:original)
			var minWidthRatio = (frameWidthRatio < targetWidthRatio) ? frameWidthRatio : targetWidthRatio ;
			var minHeightRatio = (frameHeightRatio < targetHeightRatio) ? frameHeightRatio : targetHeightRatio ;
			base.minPercent = (minWidthRatio >= minHeightRatio) ? minWidthRatio : minHeightRatio ;

			// calculate the maxPercent scale (the greater of the ratios of frame:original and target:original)
			var maxWidthRatio = (frameWidthRatio >= targetWidthRatio) ? frameWidthRatio : targetWidthRatio ;
			var maxHeightRatio = (frameHeightRatio >= targetHeightRatio) ? frameHeightRatio : targetHeightRatio ;
			var tempMax = (maxWidthRatio >= maxHeightRatio) ? minWidthRatio / maxWidthRatio : minHeightRatio / maxHeightRatio ;
			base.maxPercent = (tempMax > 1) ? 1 : tempMax ;

			base.focalPoint = {'x': Math.round(base.originalWidth/2), 'y': Math.round(base.originalHeight/2)};
			base.setZoom(base.minPercent);
			base.$image.fadeIn('fast'); //display image now that it has loaded
		}
	}
	function storeFocalPoint() {
		var x = (parseInt(base.$image.css('left'))*-1 + base.options.frameWidth/2) / base.workingPercent;
		var y = (parseInt(base.$image.css('top'))*-1 + base.options.frameHeight/2) / base.workingPercent;
		base.focalPoint = {'x': Math.round(x), 'y': Math.round(y)};
	}
	function focusOnCenter() {
		var left = fillContainer((Math.round((base.focalPoint.x*base.workingPercent) - base.options.frameWidth/2)*-1), base.$image.width(), base.options.frameWidth);
		var top = fillContainer((Math.round((base.focalPoint.y*base.workingPercent) - base.options.frameHeight/2)*-1), base.$image.height(), base.options.frameHeight);
		base.$image.css({'left': (left.toString()+'px'), 'top': (top.toString()+'px')})
		storeFocalPoint();
	}
	function updateResult() {
		base.result = {
			cropX: Math.floor(parseInt(base.$image.css('left'))/base.workingPercent*-1),
			cropY: Math.floor(parseInt(base.$image.css('top'))/base.workingPercent*-1),
			cropW: Math.round(base.options.frameWidth/base.workingPercent),
			cropH: Math.round(base.options.frameHeight/base.workingPercent),
			mustStretch: (base.minPercent > 1)
		};
		base.options.onChange.call(base.image, base.result);
	}
	function handeImageLoad() {
		initializeDimensions();
	}
	function handleMouseDown(event) {
		event.preventDefault(); //some browsers do image dragging themselves
		base.isDragging = true;
		base.dragMouseCoords = {x: event.pageX || event.originalEvent.touches[0].pageX, y: event.pageY || event.originalEvent.touches[0].pageY};
		base.dragImageCoords = {x: parseInt(base.$image.css('left')), y: parseInt(base.$image.css('top'))}
	}
	function handleMouseUp() {
		base.isDragging = false;
	}
	function handleMouseMove(event) {
		if(base.isDragging) {
			var xDif = (event.pageX || event.originalEvent.touches[0].pageX) - base.dragMouseCoords.x;
			var yDif = (event.pageY || event.originalEvent.touches[0].pageY) - base.dragMouseCoords.y;
			var newLeft = fillContainer((base.dragImageCoords.x + xDif), base.$image.width(), base.options.frameWidth);
			var newTop = fillContainer((base.dragImageCoords.y + yDif), base.$image.height(), base.options.frameHeight);
			base.$image.css({'left' : (newLeft.toString()+'px'), 'top' : (newTop.toString()+'px')});
			storeFocalPoint();
			updateResult();
		}
	}
	function handleMouseEnter() {
		if(base.options.smartControls) base.$frame.find('.jwc_controls').fadeIn('fast');
	}
	function handleMouseLeave() {
		if(base.options.smartControls) base.$frame.find('.jwc_controls').fadeOut('fast');
	}

	base.init();
};

$.jWindowCrop.defaultOptions = {
	frameWidth: 320,
	frameHeight: 180,
	zoomSteps: 10,
	loadingText: 'Loading...',
	smartControls: true,
	showControlsOnStart: true,
	onChange: function() {}
};

$.fn.jWindowCrop = function(options){
	return this.each(function(){
		(new $.jWindowCrop(this, options));
	});
};

$.fn.getjWindowCrop = function(){
	return this.data("jWindowCrop");
};
})(jQuery);
