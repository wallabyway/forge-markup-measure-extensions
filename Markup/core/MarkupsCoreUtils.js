const canvg = require('../../thirdparty/canvg/canvg.js'); // Required for Markup Thumbnails
import * as MarkupType from '../core/MarkupTypes'
import { CreateArrow } from './edit-actions/CreateArrow'
import { CreateRectangle } from './edit-actions/CreateRectangle'
import { CreateText } from './edit-actions/CreateText'
import { CreateCallout } from './edit-actions/CreateCallout'
import { CreateCircle } from './edit-actions/CreateCircle'
import { CreateCloud } from './edit-actions/CreateCloud'
import { CreateFreehand } from './edit-actions/CreateFreehand'
import { CreatePolyline } from './edit-actions/CreatePolyline'
import { CreatePolycloud } from './edit-actions/CreatePolycloud'
import { CreateHighlight } from './edit-actions/CreateHighlight'
import { CreateDimension } from './edit-actions/CreateDimension'
import { DomElementStyle } from './DomElementStyle'


    var av = Autodesk.Viewing;
    var avp = Autodesk.Viewing.Private;

    const _gWindow = av.getGlobal();
    const _gDocument = _gWindow.document;

    // Change these constants to alter the default sizes in pixels of strokes and fonts.
    export var MARKUP_DEFAULT_STROKE_WIDTH_IN_PIXELS = 1;
    export var MARKUP_DEFAULT_FONT_WIDTH_IN_PIXELS = 10;
    export var MARKUP_DEFAULT_HITAREAS_MARGIN_IN_PIXELS = 15;
    export var EDIT_FRAME_DEFAULT_MARGIN = 7;

    /**
     * // isTouchDevice is an LMV function. Hammer is included by LMV as well
     * @returns {boolean}
     */
    export var isTouchDevice = function() {
        // isTouchDevice() is an LMV function.
        // Hammer (a touch detection lib) is packaged with LMV as well
        if (av.isTouchDevice && typeof Hammer === "function") {
            return av.isTouchDevice();
        }
        return false;
    };

    //// SVG  //////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     *
     * @param type
     * @returns {Element}
     */
    export var createSvgElement = function(type) {

        const _document = (this && this.getDocument && this.getDocument()) || _gDocument;
        // See https://developer.mozilla.org/en-US/docs/Web/API/Document/createElementNS
        var namespace = 'http://www.w3.org/2000/svg';
        return  _document.createElementNS(namespace, type);
    };

    /**
     *
     * @param {Element} svg - an SVGElement
     * @returns {Element} svg param is returned back
     */
    export var setSvgParentAttributes = function(svg) {

        // See: https://developer.mozilla.org/en-US/docs/Web/SVG/Namespaces_Crash_Course
        svg.setAttribute('version', '1.1'); // Notice that this is the SVG version, not the "MARKUP DATA VERSION"!
        svg.setAttribute('baseProfile', 'full');
        svg.setAttribute('layer-order-id', 'markups-svg');
        return svg;
    };

    export var createMarkupGroupSvg = function(children) {
        children = children || [];
        var svg = createSvgElement('g');
        svg.setAttribute('cursor', 'default');
        svg.setAttribute('pointer-events', 'none');

        for (var i = 0; i < children.length; i++) {
            svg.appendChild(children[i]);
        }

        return svg;
    };

    export var createMarkupPathSvg = function() {

        var svg = createSvgElement('g');
        svg.setAttribute('cursor', 'inherit');
        svg.setAttribute('pointer-events', 'none');

        var markup = createSvgElement('path');
        markup.setAttribute('id', 'markup');

        var hitarea = createSvgElement('path');
        hitarea.setAttribute('id', 'hitarea');
        hitarea.setAttribute('fill', 'transparent');
        hitarea.setAttribute('stroke', 'transparent');

        svg.markup = markup;
        svg.hitarea = hitarea;

        svg.appendChild(markup);
        svg.appendChild(hitarea);

        return svg;
    };

    export var setAttributeToMarkupSvg = function(svg, attribute, value) {

        svg.markup.setAttribute(attribute, value);
    };

    export var updateMarkupPathSvgHitarea = function(svg, editor) {

        var markup = svg.markup;
        var hitarea = svg.hitarea;

        var hitareaMargin = editor.sizeFromClientToMarkups(0, MARKUP_DEFAULT_HITAREAS_MARGIN_IN_PIXELS).y;
        hitareaMargin += parseFloat(markup.getAttribute('stroke-width')) + hitareaMargin;

        var markupFill = markup.getAttribute('fill');
        var markupStroke = markup.getAttribute('stroke');
        var strokeEnabled = markupStroke !== '' && markupStroke !== 'none';
        var fillEnabled = markupFill !== '' && markupFill !== 'none';

        hitarea.setAttribute('d', markup.getAttribute('d'));
        hitarea.setAttribute('stroke-width', hitareaMargin);
        hitarea.setAttribute('transform', markup.getAttribute('transform'));

        if (editor.duringEditMode && !editor.navigating) {
            if (strokeEnabled && fillEnabled) {
                svg.setAttribute('pointer-events', 'painted');
                return;
            }

            if (strokeEnabled) {
                svg.setAttribute('pointer-events', 'stroke');
                return;
            }

            if (fillEnabled) {
                svg.setAttribute('pointer-events', 'fill');
                return;
            }
        }

        svg.setAttribute('pointer-events', 'none');
    };
    
    export var createMarkupTextSvg = function() {

        var svg = createSvgElement('g');
        svg.setAttribute('cursor', 'default');

        var clipperId = 'markup-clipper-' + getUniqueID();
        var clipperUrl = 'url(#' + clipperId + ')';

        var clipper = createSvgElement('clipPath');
        clipper.setAttribute('id', clipperId);
        clipper.removeAttribute('pointer-events');
        clipper.rect = createSvgElement('rect');
        clipper.appendChild(clipper.rect);

        var background = createSvgElement('rect');
        background.setAttribute('id', 'markup-background');
        background.removeAttribute('pointer-events');

        var markup = createSvgElement('text');
        markup.setAttribute('id', 'markup');

        var hitarea = createSvgElement('rect');
        hitarea.setAttribute('id', 'hitarea');
        hitarea.setAttribute('fill', 'transparent');
        hitarea.setAttribute('stroke', 'none');
        hitarea.setAttribute('stroke-width', '0');

        var clippedArea = createSvgElement('g');
        clippedArea.setAttribute('clip-path', clipperUrl);
        clippedArea.appendChild(clipper);
        clippedArea.appendChild(background);
        clippedArea.appendChild(markup);

        svg.appendChild(clippedArea);
        svg.appendChild(hitarea);

        svg.clipper = clipper;
        svg.background = background;
        svg.markup = markup;
        svg.hitarea = hitarea;

        return svg;
    };

    export var setMarkupTextSvgTransform = function(svg, transform, textTransform) {

        svg.clipper.rect.setAttribute('transform', transform);
        svg.background.setAttribute('transform', transform);
        svg.markup.setAttribute('transform', textTransform);
        svg.hitarea.setAttribute('transform', transform);
    };

    export var updateMarkupTextSvgHitarea = function(svg, w, h, editor) {

        var hitarea = svg.hitarea;
        var hitareaMargin = editor.sizeFromClientToMarkups(0, MARKUP_DEFAULT_HITAREAS_MARGIN_IN_PIXELS).y;

        hitarea.setAttribute('x', -hitareaMargin);
        hitarea.setAttribute('y', -hitareaMargin);
        hitarea.setAttribute('width', w + hitareaMargin * 2);
        hitarea.setAttribute('height', h + hitareaMargin * 2);
        svg.setAttribute("pointer-events", editor.navigating ? "none" : "painted");
    };

    export var updateMarkupTextSvgBackground = function(svg, w, h, color) {

        var background = svg.background;

        background.setAttribute('x', 0);
        background.setAttribute('y', 0);
        background.setAttribute('width', w);
        background.setAttribute('height', h);
        background.setAttribute('fill', color);
    };

    export var updateMarkupTextSvgClipper = function(svg, w, h) {

        var clipper = svg.clipper;

        clipper.rect.setAttribute('x', 0);
        clipper.rect.setAttribute('y', 0);
        clipper.rect.setAttribute('width', w);
        clipper.rect.setAttribute('height', h);
    };

    /**
     * Helper function that injects metadata for the whole Markup document.
     * Metadata includes: version.
     * @param {Element} svg - an SVGElement
     * @param {Object} metadata - Dictionary with attributes
     */
    export var addSvgMetadata = function(svg ,metadata) {

        const _document = (this && this.getDocument && this.getDocument()) || _gDocument;

        var metadataNode = _document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
        var dataVersionNode = _document.createElement('markup_document');

        metadataNode.appendChild(dataVersionNode);

        // NOTE: We could iterate over the properties, but we don't because these are the only ones supported
        dataVersionNode.setAttribute("data-model-version", metadata["data-model-version"]); // Version. For example: "1"

        svg.insertBefore(metadataNode, svg.firstChild);
        return metadataNode;
    };

    /**
     * Helper function that injects metadata for specific markup svg nodes.
     * @param {Element} markupNode - an SVGElement for the markup
     * @param {Object} metadata - Dictionary where all key/value pairs are added as metadata entries.
     * @returns {Element}
     */
    export var addMarkupMetadata = function(markupNode, metadata) {

        const _document = (this && this.getDocument && this.getDocument()) || _gDocument;

        var metadataNode = _document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
        var dataVersionNode = _document.createElement('markup_element');

        metadataNode.appendChild(dataVersionNode);
        for (var key in metadata) {
            if (metadata.hasOwnProperty(key)) {
                dataVersionNode.setAttribute(key, metadata[key]);
            }
        }

        markupNode.insertBefore(metadataNode, markupNode.firstChild);
        return metadataNode;
    };

    /**
     * Removes al metadata nodes from an Svg node structure.
     * Method will remove all metadata nodes from children nodes as well.
     * @param svgNode
     */
    export var removeAllMetadata = function(svgNode) {

        if (svgNode.getElementsByTagName) {
            var nodes = svgNode.getElementsByTagName("metadata");
            for (var i=0; i<nodes.length; ++i) {
                var metadataNode = nodes[i];
                metadataNode.parentNode && metadataNode.parentNode.removeChild(metadataNode);
            }
        }

        // Transverse children nodes
        var svgChildren = svgNode.children || svgNode.childNodes;
        if (svgChildren) {
            for (i=0; i<svgChildren.length; ++i) {
                removeAllMetadata(svgChildren[i]);
            }
        }
    };

    /**
     * Utility function that transfers children from an Html/Svg node into another one.
     * @param nodeFrom - The node instance from where children will be taken.
     * @param nodeInto - The node that's going to parent the transferred children.
     */
    export var transferChildNodes = function(nodeFrom, nodeInto) {

        var svgChildren = nodeFrom.children || nodeFrom.childNodes;
        var tmpArray = [];
        for (var i=0; i<svgChildren.length; ++i){
            tmpArray.push(svgChildren[i]); // Avoid appendChild
        }
        tmpArray.forEach(function(node){
            nodeInto.appendChild(node);
        });
    };

    /**
     * Generate a unique id.
     * @returns {string}
     */
    export var getUniqueID = function() {
        return THREE.Math.generateUUID();
    };


    /**
     * Serializes an SVG node into a String.
     * @param domNode
     * @returns {string}
     */
    export var svgNodeToString = function(domNode){

        function removeHitareas(svg, hitareas) {

            var hitarea = svg.hitarea;
            var hitareaParent = hitarea && hitarea.parentNode;

            if (hitareaParent) {

                hitareas.push({hitarea: hitarea, parent: hitareaParent});
                hitareaParent.removeChild(hitarea);
            }

            var children = svg.childNodes;
            var childrenCount = children.length;

            for(var i = 0; i < childrenCount; ++i) {
                removeHitareas(children.item(i), hitareas);
            }
        }

        function addHitareas(hitareas) {

            var hitareasCount = hitareas.length;
            for(var i = 0; i < hitareasCount; ++i) {

                var hitarea = hitareas[i];
                hitarea.parent.appendChild(hitarea.hitarea);
            }
        }

        var result;
        try {
            var hitareas = [];
            removeHitareas(domNode, hitareas);

            var xmlSerializer = new XMLSerializer();
            result = xmlSerializer.serializeToString(domNode);

            addHitareas(hitareas);

        } catch (err) {
            result = '';
            console.warn('svgNodeToString failed to generate string representation of domNode.');
        }
        return result;
    };

    export var stringToSvgNode = function(stringNode){

        var node = null;
        try {
            var domParser = new DOMParser();
            var doc = domParser.parseFromString(stringNode, "text/xml");
            node = doc.firstChild; // We should only be getting 1 child anyway.
        } catch (err) {
            node = null;
            console.warn('stringToSvgNode failed to generate an HTMLElement from its string representation.');
        }
        return node;
    };

    /**
     * Injects functions and members to a client object which will
     * receive the ability to dispatch events.
     * Mechanism is the same as in Autodesk.Viewing.Viewer.
     *
     * Note: All of the code here comes from Autodesk.Viewing.Viewer
     *
     * @param {Object} client - Object that will become an event dispatcher.
     */
    export var addTraitEventDispatcher = function(client) {

        // Inject member variable
        client.listeners = {};

        // Inject functions
        client.addEventListener = function(type, listener) {
            if (typeof this.listeners[type] == "undefined"){
                this.listeners[type] = [];
            }
            this.listeners[type].push(listener);
        };
        client.hasEventListener = function (type, listener) {
            if (this.listeners === undefined) return false;
            var listeners = this.listeners;
            if (listeners[ type ] !== undefined && listeners[ type ].indexOf(listener) !== -1) {
                return true;
            }
            return false;
        };
        client.removeEventListener = function(type, listener) {
            if (this.listeners[type] instanceof Array){
                var li = this.listeners[type];
                for (var i=0, len=li.length; i < len; i++){
                    if (li[i] === listener){
                        li.splice(i, 1);
                        break;
                    }
                }
            }
        };
        client.dispatchEvent = function(event) {
            if (typeof event == "string"){
                event = { type: event };
            }
            if (!event.target){
                event.target = this;
            }

            if (!event.type){
                throw new Error("event type unknown.");
            }

            if (this.listeners[event.type] instanceof Array) {
                var typeListeners = this.listeners[event.type].slice();
                for (var i=0; i < typeListeners.length; i++) {
                    typeListeners[i].call(this, event);
                }
            }
        };
    };

    /**
     * Removes the EventDispatcher trait
     *
     * @param {Object} client
     */
    export var removeTraitEventDispatcher = function(client) {

        try {
            delete client.listeners;
            delete client.addEventListener;
            delete client.hasEventListener;
            delete client.removeEventListener;
            delete client.dispatchEvent;
        } catch (e) {
            // nothing
        }
    };

    //// Math  /////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Calculates the pixel position in client space coordinates of a point in world space.
     * @param {THREE.Vector3} point Point in world space coordinates.
     * @param viewer
     * @param snap Round values to closest pixel center.
     * @returns {THREE.Vector3} Point transformed and projected into client space coordinates.
     */
    export var worldToClient = function(point, viewer, snap) {

        var p = worldToViewport(point, viewer);
        var result = viewportToClient(p.x, p.y, viewer);
        result.z = 0;

        // snap to the center of the
        if (snap) {
            result.x = Math.floor(result.x) + 0.5;
            result.y = Math.floor(result.y) + 0.5;
        }

        return result;
    };

    export var clientToWorld = function(clientX, clientY, depth, viewer) {

        var point = clientToViewport(clientX, clientY, viewer);
        point.z = depth;

        point.unproject(viewer.impl.camera);
        return point;
    };

    export var clientToViewport = function(clientX, clientY, viewer) {

        return viewer.impl.clientToViewport(clientX, clientY);
    };

    export var viewportToClient = function(viewportX, viewportY, viewer) {

        return viewer.impl.viewportToClient(viewportX, viewportY);
    };

    /**
     * Calculates the world position of a point in client space coordinates.
     * @param {Object} point - { x:Number, y:Number, z:Number }
     * @param {Object} viewer - LMV instance
     * @returns {THREE.Vector3}
     */
    export var worldToViewport = function(point, viewer) {

        var p = new THREE.Vector3();

        p.x = point.x;
        p.y = point.y;
        p.z = point.z;

        p.project(viewer.impl.camera);
        return p;
    };

    export var metersToModel = function(meters, viewer) {

        var modelToMeter = viewer.model.getUnitScale();
        var meterToModel = 1 / modelToMeter;

        return meterToModel * meters;
    };

    export var radiansToDegrees = function (radians) {

        return radians * (180 / Math.PI);
    };

    export var degreesToRadians = function(degrees) {

        return degrees * (Math.PI / 180);
    };

    /**
     *
     * @param value
     * @returns {number}
     */
    export var sign = function (value) {

        return (value >= 0) ? 1 : -1;
    };

    /**
     *
     * @param pointA
     * @param pointB
     * @param range
     * @param editor
     * @returns {boolean}
     */
    export var areMarkupsPointsInClientRange = function(pointA, pointB, range, editor){

        range = editor.sizeFromClientToMarkups(0, range).y;

        var dx = pointA.x - pointB.x;
        var dy = pointA.y - pointB.y;

        return range * range >= dx * dx + dy * dy;
    };

    //// LMV ui ////////////////////////////////////////////////////////////////////////////////////////////////////////

    export var hideLmvUi = function(viewer) {

        // If the viewer is no gui, then there is nothing to hide
        if(!viewer.toolbar) {
            return;
        }

        // Exit other tools and hide HudMessages.
        viewer.setActiveNavigationTool();

        dismissLmvHudMessage();
        hideLmvPanels(true, viewer);
        hideLmvToolsAndPanels(viewer);
    };

    export var restoreLmvUi = function(viewer) {

        // If the viewer is no gui, then there is nothing to hide
        if(!viewer.toolbar) {
            return;
        }

        dismissLmvHudMessage();
        hideLmvPanels(false, viewer);
        showLmvToolsAndPanels(viewer);
    };

    /**
     *
     * @param hide
     * @param viewer
     */
    export var hideLmvPanels = function(hide, viewer) {

        var dockingPanels = viewer.dockingPanels;

        // Panels may not be present when dealing with an instance of Viewer3D.js
        // (as opposed to an instance of GuiViewer3D.js)
        if (!dockingPanels) return;

        for (var i = 0; i < dockingPanels.length; ++i) {

            var panel = dockingPanels[i];
            var panelContainer = panel.container;

            if (panelContainer.classList.contains("dockingPanelVisible")) {
                panelContainer.style.display = hide ? "none" : "block";

                // Call the visibility changed notification if any additional
                // stuff needs to be done (update the date i.e. PropertyPanel, etc).
                panel.visibilityChanged();
            }
        }
    };

    /**
     * Shows panels and tools in the viewer.
     * @param viewer
     */
    export var showLmvToolsAndPanels = function(viewer) {

        // Restore view cube.
        if(viewer && viewer.model && !viewer.model.is2d()) {
            viewer.getExtension("Autodesk.ViewCubeUi", function(ext) {
                ext.displayViewCube(true, false);
                ext.displayHomeButton(true);
            }); 
        }

        // TODO: Find or ask for a better way to restore this buttons.
        const _document = viewer.getDocument();
        var anim = _document.getElementsByClassName('toolbar-animation-subtoolbar');

        if (anim.length > 0) {
            anim[0].style.display = '';
        }

        // toolbar is absent when dealing with an instance of Viewer3D (instead of GuiViewer3D)
        if (viewer.toolbar) {
            var viewerContainer = viewer.toolbar.container;
            var viewerContainerChildrenCount = viewerContainer.children.length;
            for(var i = 0; i < viewerContainerChildrenCount; ++i) {
                viewerContainer.children[i].style.display = "";
            }
        }
    };

    /**
     * Hides panels and tools in the viewer.
     * @param viewer
     */
    export var hideLmvToolsAndPanels = function(viewer) {

        // Hide Panels and tools.
        if (viewer && viewer.model && !viewer.model.is2d()) {
            viewer.getExtension("Autodesk.ViewCubeUi", function(ext) {
                ext.displayViewCube(false, false);
                ext.displayHomeButton(false);
            });
            
        }

        const _document = viewer.getDocument();
        // TODO: Find or ask for a better way to hide this buttons.
        var anim = _document.getElementsByClassName('toolbar-animation-subtoolbar');

        if (anim.length > 0) {
            anim[0].style.display = 'none';

            var animator = viewer.impl.keyFrameAnimator;
            if (animator && !animator.isPaused) {
                animator.pauseCameraAnimations();
                animator.pause();

                var playButton = viewer.modelTools.getControl('toolbar-animationPlay');
                if (playButton) {
                    playButton.setIcon('toolbar-animation-pause-icon');
                    playButton.setToolTip('Pause');
                }
            }
        }

        // toolbar is absent when dealing with an instance of Viewer3D (instead of GuiViewer3D)
        if (viewer.toolbar) {
            var viewerContainer = viewer.toolbar.container;
            var viewerContainerChildrenCount = viewerContainer.children.length;
            for(var i = 0; i < viewerContainerChildrenCount; ++i) {
                viewerContainer.children[i].style.display = "none";
            }
        }
    };

    /**
     * Dismisses all LMV HudMessages
     */
    export var dismissLmvHudMessage = function() {

        // Using try/catch block since we are accessing the Private namespace of LMV.
        try {
            var keepDismissing = true;
            while (keepDismissing) {
                keepDismissing = Autodesk.Viewing.Private.HudMessage.dismiss();
            }
        } catch (ignore) {
            // Failing to show the message is an okay fallback scenario
            console.warn("[CO2]Failed to dismiss LMV HudMessage");
        }
    };

    //// Styles ////////////////////////////////////////////////////////////////////////////////////////////////////////

    export var getStrokeWidth = function(widthInPixels, editor) {

        var size = editor.sizeFromClientToMarkups(0, widthInPixels);
        return size.y;
    };

    /**
     * Creates markups from a parsed svg string child
     * @param child - child of a parsed SVG string
     * @param editor - MarkupsCore
     * @returns {*} Markup Object
     */
    export var createMarkupFromSVG = function(child, editor) {
        // var self = this;
        if (!child.childNodes[0]) {
            return null;
        }

        var meta = child.childNodes[0].childNodes[0] || '';

        var getCurrentStyle = function(editor, metadata) {

            var source = ['stroke-width', 'stroke-color', 'stroke-opacity', 'fill-color', 'fill-opacity',
                'font-family', 'font-size','font-style','font-weight','stroke-linejoin'];
            var style = {};
            for (var i=0; i < source.length; i++) {
                var value = metadata.getAttribute(source[i]);
                if(value == null) {
                    continue;
                }
                switch (source[i]) {
                    case 'font-size':
                    case 'stroke-width':
                    case 'stroke-opacity':
                    case 'fill-opacity':
                        style[source[i]] = parseFloat(value);
                        break;
                    case 'stroke-linejoin':
                        break;
                    case 'font-family':
                    case 'font-style':
                    case 'font-weight':
                    case 'stroke-color':
                    case 'fill-color':
                        style[source[i]] = value;
                        break;
                    default:
                        avp.logger.warn('Style not recognized.');
                        break;
                }
            }
            return style;
        };

        var isClosed = function() {
            var path = child.childNodes[1] || '';
            var closed = false;
            if (typeof path !== 'string'){
                var d = path.getAttribute('d').split(' ');
                if (d[d.length-1].toLowerCase() === 'z'){
                    closed = true;
                }
            }
            return closed;
        };

        var getLocations = function() {
            var locations = [];
            var locStr = meta.getAttribute('locations').split(" ") || '';

            for(var i=0; i< locStr.length; i+=2) {
                var pointPair = {x:parseFloat(locStr[i]), y:parseFloat(locStr[i+1])};
                locations.push( pointPair )
            }
            return locations;
        };

        var getAttributeVector = function(attribute) {
            var posVec = new THREE.Vector3();
            var value = meta.getAttribute(attribute) || meta.getAttribute(attribute.toLowerCase());
            var strPos = value.split(" ");
            posVec.x = parseFloat(strPos[0]);
            posVec.y = parseFloat(strPos[1]);
            return posVec;
        };

        var getPosition = function() {
            return getAttributeVector('position');
        };

        var getSize = function() {
            return getAttributeVector('size');
        };

        var getRotation = function() {
            var strRot = meta.getAttribute('rotation') || '';
            return parseFloat(strRot);
        };

        var getText = function() {
            return meta.getAttribute('text') || '';
        };

        var getIsFrameUsed = function() {
            return !!parseInt(meta.getAttribute('isframeused'));
        };

        if (typeof meta !== 'string') {
            // get the type of the child
            var position, size, rotation, locations, tail, head, closed, text, firstAnchor, secondAnchor;
            var id = editor.getId();
            var style = getCurrentStyle(editor, meta);
            var type = meta.getAttribute('type') || '';
            var createMarkup;
            switch(type) {
                case MarkupType.MARKUP_TYPE_ARROW:
                    tail = getAttributeVector('tail');
                    head = getAttributeVector('head');
                    createMarkup = new CreateArrow(editor, id, tail, head, style);
                    break;

                case MarkupType.MARKUP_TYPE_RECTANGLE:
                    position = getPosition();
                    size = getSize();
                    rotation = getRotation();
                    createMarkup = new CreateRectangle(editor, id, position, size, rotation, style);
                    break;

                case MarkupType.MARKUP_TYPE_TEXT:
                    position = getPosition();
                    size = getSize();
                    text = getText();
                    createMarkup = new CreateText(editor, id, position, size, text, style );
                    break;

                case MarkupType.MARKUP_TYPE_CALLOUT:
                    position = getPosition();
                    size = getSize();
                    text = getText();
                    var isFrameUsed = getIsFrameUsed();
                    createMarkup = new CreateCallout(editor, id, position, size, text, style, isFrameUsed);
                    break;

                case MarkupType.MARKUP_TYPE_CIRCLE:
                    position = getPosition();
                    size = getSize();
                    rotation = getRotation();
                    createMarkup = new CreateCircle(editor, id, position, size, rotation, style);
                    break;

                case MarkupType.MARKUP_TYPE_CLOUD:
                    position = getPosition();
                    size = getSize();
                    rotation = getRotation();
                    createMarkup = new CreateCloud(editor, id, position, size, rotation, style);
                    break;

                case MarkupType.MARKUP_TYPE_FREEHAND:
                    position = getPosition();
                    size = getSize();
                    rotation = getRotation();
                    locations = getLocations();
                    createMarkup = new CreateFreehand(editor, id, position, size, rotation, locations, style);
                    break;

                case MarkupType.MARKUP_TYPE_POLYLINE:
                    position = getPosition();
                    size = getSize();
                    rotation = getRotation();
                    locations = getLocations();
                    closed = isClosed();
                    createMarkup = new CreatePolyline(editor, id, position, size, rotation, locations, style, closed);
                    break;

                case MarkupType.MARKUP_TYPE_POLYCLOUD:
                    position = getPosition();
                    size = getSize();
                    rotation = getRotation();
                    locations = getLocations();
                    closed = isClosed();
                    createMarkup = new CreatePolycloud(editor, id, position, size, rotation, locations, style, closed);
                    break;

                case MarkupType.MARKUP_TYPE_HIGHLIGHT:
                    position = getPosition();
                    size = getSize();
                    rotation = getRotation();
                    locations = getLocations();
                    createMarkup = new CreateHighlight(editor, id, position, size, rotation, locations, style);
                    break;

                case MarkupType.MARKUP_TYPE_DIMENSION:
                    firstAnchor = getAttributeVector('firstAnchor');
                    secondAnchor = getAttributeVector('secondAnchor');
                    text = getText();
                    createMarkup = new CreateDimension(editor, id, firstAnchor, secondAnchor, text, style);
                    break;

                default:
                    createMarkup = null;
                    break;
            }
            if (createMarkup){
                createMarkup.addToHistory = false;
                createMarkup.execute();
                var markupList = editor.svgLayersMap[editor.activeLayer].markups;

                for(var i = 0; i < markupList.length; ++i) {
                    if (markupList[i].id === id) {
                        return markupList[i];
                    }
                }
            }
            return null;
        }
    };
    

    export var composeRGBAString = function(hexRGBString, opacity) {

        if(!hexRGBString || !opacity || opacity <= 0) {
            return 'none';
        }

        return ['rgba(' +
            parseInt('0x' + hexRGBString.substr(1,2)), ',',
            parseInt('0x' + hexRGBString.substr(3,2)), ',',
            parseInt('0x' + hexRGBString.substr(5,2)), ',', opacity, ')'].join('');
    };

    //// Id Target Collision ///////////////////////////////////////////////////////////////////////////////////////////

    /**
     *
     * @param x0
     * @param y0
     * @param x1
     * @param y1
     * @param idTarget
     */
    export var checkLineSegment = function(x0, y0, x1, y1, idTarget) {

        const _window = (this && this.getWindow && this.getWindow()) || _gWindow;
        var deviceRatio = _window.devicePixelRatio || 1;

        x0 *= deviceRatio;
        y0 *= deviceRatio;
        x1 *= deviceRatio;
        y1 *= deviceRatio;

        var idTargetWidth = idTarget.width;
        var idTargetHeight = idTarget.height;
        var idTargetBuffer = idTarget.buffer;

        x0 = Math.round(x0);
        x1 = Math.round(x1);
        y0 = Math.round(idTargetHeight - y0);
        y1 = Math.round(idTargetHeight - y1);

        function point(x, y) {

            x = Math.round(x);
            y = Math.round(y);

            var dx = 0;
            var dy = 0;

            for(var j = -deviceRatio; j <= deviceRatio; j+=deviceRatio*2){
                dy += check(x,y+j) ? j : 0;
            }

            for(var i = -deviceRatio; i <= deviceRatio; i+=deviceRatio*2){
                dx += check(x+i,y) ? i : 0;
            }

            return {
                x: Math.round(x / deviceRatio + dx),
                y: Math.round((idTargetHeight - y) / deviceRatio - dy)};
        }

        function check(x, y) {

            // Probably better to clip line at the beginning.
            if (x < 0 || x >= idTargetWidth ||
                y < 0 || y >= idTargetHeight) {
                return false;
            }

            var index = (y * idTargetWidth + x) *4;
            return (
                idTargetBuffer[index  ] !== 0xFF ||
                idTargetBuffer[index+1] !== 0xFF ||
                idTargetBuffer[index+2] !== 0xFF);
        }

        // DDA Line algorithm
        var dx = (x1 - x0);
        var dy = (y1 - y0);

        var m = dx !== 0 ? dy / dx : 1;
        var x = x0;
        var y = y0;

        if (dx !== 0 && Math.abs(m) <= 1) {

            if (x0 <= x1) {
                for (; x <= x1; ++x, y += m) {
                    if (check(x, Math.round(y))) {
                        return point(x, y);
                    }
                }
            } else {
                for (; x >= x1; --x, y -= m) {
                    if (check(x, Math.round(y))) {
                        return point(x, y);
                    }
                }
            }
        } else {

            m = dx !== 0 ? 1/m : 0;
            if (y0 <= y1) {
                for (; y <= y1; ++y, x += m) {
                    if (check(Math.round(x), y)) {
                        return point(x, y);
                    }
                }
            } else {
                for (; y >= y1; --y, x -= m) {
                    if (check(Math.round(x), y)) {
                        return point(x, y);
                    }
                }
            }
        }
    };

    /**
     *
     * @param polygon
     * @param idTarget
     */
    export var checkPolygon = function(polygon, idTarget) {

        // Return if incorrect parameters.
        if(!polygon || polygon.verxtexCount < 3 || !idTarget) {
            return null;
        }

        const _window = (this && this.getWindow && this.getWindow()) || _gWindow;
        var deviceRatio = _window.devicePixelRatio || 1;

        var idTargetWidth = idTarget.width;
        var idTargetHeight = idTarget.height;
        var idTargetBuffer = idTarget.buffer;

        var vertexCount = polygon.vertexCount;
        var xVertices = Float32Array.from(polygon.xVertices); // Clone to scale by device pixel ratio and to
        var yVertices = Float32Array.from(polygon.yVertices); // change y coordinates to OpenGL style.

        function point(x, y) {

            var dx = 0;
            var dy = 0;

            for(var j = -deviceRatio; j <= deviceRatio; j+=deviceRatio*2){
                dy += check(x,y+j) ? j : 0;
            }

            for(var i = -deviceRatio; i <= deviceRatio; i+=deviceRatio*2){
                dx += check(x+i,y) ? i : 0;
            }

            return {
                x: Math.round(x / deviceRatio) + dx,
                y: Math.round((idTargetHeight - y) / deviceRatio - dy)};
        }

        function check(x, y) {

            if (x < 0 || x >= idTargetWidth ||
                y < 0 || y >= idTargetHeight) {
                return false;
            }

            var index = (y * idTargetWidth + x) * 4;
            return (
                idTargetBuffer[index  ] !== 0xFF ||
                idTargetBuffer[index+1] !== 0xFF ||
                idTargetBuffer[index+2] !== 0xFF) && isInsidePolygon(x, y);
        }

        function isInsidePolygon(x, y) {

            var result = false;
            var vertexCount = polygon.vertexCount;
            for(var i = 0, j = vertexCount-1; i < vertexCount; j = i++) {

                if (((yVertices[i] > y) != (yVertices[j] > y)) &&
                     (x < (xVertices[j] - xVertices[i]) * (y - yVertices[i]) / (yVertices[j] - yVertices[i]) + xVertices[i]) ) {
                    result = !result;
                }
            }
            return result;
        }

        // Change coordinates to OpenGL style and calculate polygon's bounding box.
        var bbX0 = Number.POSITIVE_INFINITY;
        var bbY0 = Number.POSITIVE_INFINITY;
        var bbX1 = Number.NEGATIVE_INFINITY;
        var bbY1 = Number.NEGATIVE_INFINITY;

        for(var i = 0; i < vertexCount; ++i) {

            var bbX = xVertices[i] = xVertices[i] * deviceRatio;
            var bbY = yVertices[i] = idTargetHeight - yVertices[i] * deviceRatio;

            bbX0 = Math.min(bbX0, bbX);
            bbY0 = Math.min(bbY0, bbY);
            bbX1 = Math.max(bbX1, bbX);
            bbY1 = Math.max(bbY1, bbY);
        }

        if (bbX1 < 0 || bbX0 > idTargetWidth ||
            bbY1 < 0 || bbY0 > idTargetHeight) {
            return null;
        }

        var bbW = Math.round(bbX1 - bbX0);
        var bbH = Math.round(bbY1 - bbY0);

        var bbCenterX = Math.round((bbX0 + bbX1)*0.5);
        var bbCenterY = Math.round((bbY0 + bbY1)*0.5);

        // Check
        var x = bbCenterX;
        var y = bbCenterY;

        var w = 1;
        var h = 1;

        do {

            var endX = x + w;
            var endY = y + h;

            for(; x < endX; ++x) {
                if (check(x,y)) {
                    return point(x,y);
                }
            }

            for(; y < endY; ++y) {
                if (check(x,y)) {
                    return point(x,y);
                }
            }

            if (w < bbW) {
                endX = x - ++w; ++w;
            } else {
                endX = x - w;
            }

            if (h < bbH) {
                endY = y - ++h; ++h;
            } else {
                endY = y - h;
            }

            for(; x > endX; --x) {
                if (check(x,y)) {
                    return point(x,y);
                }
            }

            for(; y > endY; --y) {
                if (check(x,y)) {
                    return point(x,y);
                }
            }
        } while(w < bbW || h < bbH);
     };

    //// CSS ///////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     *
     * @returns {*}
     */
    export var createStyleSheet = function() {

        const _document = (this && this.getDocument && this.getDocument()) || _gDocument;
        var style = _document.createElement("style");

        // This is WebKit hack.
        style.appendChild(_document.createTextNode(""));
        _document.head.appendChild(style);

        return style.sheet;
    };

    /**
     *
     * @param styleSheet
     * @param selector
     * @param styles
     * @param index
     */
    export var addRuleToStyleSheet = function(styleSheet, selector, styles, index) {

        if("insertRule" in styleSheet) {
            styleSheet.insertRule(selector + "{" + styles + "}", index);
        }
        else if("addRule" in styleSheet) {
            styleSheet.addRule(selector, styles, index);
        }
    };

    //// SVG ///////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     *
     * @param lines
     * @param style
     * @param editor
     */
    export var measureTextLines = function(lines, style, editor) {

        // Measure div style is line style with some custom layout properties.
        var fontSize = editor.sizeFromMarkupsToClient(0, style['font-size']).y;

        var measureStyle = new DomElementStyle()
            .setAttribute('font-family', style['font-family'])
            .setAttribute('font-size', fontSize + 'px')
            .setAttribute('font-weight', style['font-weight'] ? 'bold' : '')
            .setAttribute('font-style', style['font-style'] ? 'italic' : '')

            .removeAttribute(['top', 'left', 'width', 'height', 'overflow-y'])
            .setAttribute('position','absolute')
            .setAttribute('white-space','nowrap')
            .setAttribute('float','left')
            .setAttribute('visibility','hidden')
            .getStyleString();

        const _document = (this && this.getDocument && this.getDocument()) || _gDocument;
        // Create measure div.
        var measure = _document.createElement('div');

        measure.setAttribute('style', measureStyle);
        editor.viewer.container.appendChild(measure);

        // Measure.
        var result = [];

        var linesCount = lines.length;
        for(var i = 0; i < linesCount; ++i) {

            measure.innerText = lines[i];
            result.push({
                line: lines[i],
                width: measure.clientWidth,
                height: measure.clientHeight
            });
        }

        // Remove measure div and return result.
        editor.viewer.container.removeChild(measure);
        return result;
    };

    export var createArcTo = function(x, y, xRadius, yRadius, relative, path) {

        path.push(relative ? 'a' : 'A');
        path.push(xRadius);
        path.push(yRadius);
        path.push(0);
        path.push(1);
        path.push(1);
        path.push(x);
        path.push(y);

        return path;
    };

    export var createEllipsePath = function (x, y, w, h, relative, path) {

        var halfW = w * 0.5;
        var halfH = h * 0.5;

        path.push(relative ? 'm' : 'M');
        path.push(x);
        path.push(y);

        createArcTo(w, 0, halfW, halfH, true, path);
        createArcTo(-w, 0, halfW, halfH, true, path);

        path.push('z');
    };

    export var createRectanglePath = function (x, y, w, h, relative, path) {

        path.push(relative ? 'm' : 'M');
        path.push(x);
        path.push(y);
        path.push('l');
        path.push(w);
        path.push(0);
        path.push('l');
        path.push(0);
        path.push(h);
        path.push('l');
        path.push(-w);
        path.push(0);
        path.push('z');
    };

    export var renderToCanvas = function(svg, viewBox, width, height, ctx, callback) {

        // Creating a new svg element, that will be drawn into the canvas.
        var tmpSvg = createSvgElement('svg');
        
        if (!av.isIE11) {
            tmpSvg.setAttribute('xmlns','http://www.w3.org/2000/svg');    
        }

        tmpSvg.setAttribute('width',width);
        tmpSvg.setAttribute('height',height);
        tmpSvg.setAttribute('viewBox',viewBox);
        tmpSvg.setAttribute('transform', 'scale(1,-1)');
        
        var markupGroup = svg.parentNode.cloneNode(true);

        // Adding the markup itself to the temp SVG
        tmpSvg.appendChild(markupGroup);
        
        const _window = (this && this.getWindow && this.getWindow()) || _gWindow;
        const _document = (this && this.getDocument && this.getDocument()) || _gDocument;
        // Get the SVG as string
        var temp = _document.createElement('div');
        var node = tmpSvg.cloneNode(true);
        temp.appendChild(node);
        var data = temp.innerHTML;
        
        tmpSvg = temp = node = null;

        var renderWithCanvg = function() {
            canvg(ctx.canvas, data, {ignoreMouse: true, ignoreDimensions: true, ignoreClear: true, renderCallback: callback});
        };

        // IE11 blocks 'tainted' canvas for security reasons. canvg is a library that solves that issue, and draws on the canvas without tainting it.
        if (av.isIE11) {
            renderWithCanvg();
        }
        else {
            var img = new Image();

            img.onload = function() {
                ctx.drawImage(img, 0, 0);
                callback();
            };

            img.onerror = function() {
                renderWithCanvg();
            };

            img.src = 'data:image/svg+xml;base64,' + _window.btoa(unescape( encodeURIComponent( data )));
        }
    };

    /*
     Taken from Simplify.js, a high-performance JS polyline simplification library
     (c) 2013, Vladimir Agafonkin
     mourner.github.io/simplify-js
    */
   export var simplify = function(points, tolerance, highestQuality) {

        if (points.length <= 2) return points;

        // square distance between 2 points
        function getSqDist(p1, p2) {

            var dx = p1.x - p2.x,
                dy = p1.y - p2.y;

            return dx * dx + dy * dy;
        }

        // square distance from a point to a segment
        function getSqSegDist(p, p1, p2) {

            var x = p1.x,
                y = p1.y,
                dx = p2.x - x,
                dy = p2.y - y;

            if (dx !== 0 || dy !== 0) {

                var t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);

                if (t > 1) {
                    x = p2.x;
                    y = p2.y;

                } else if (t > 0) {
                    x += dx * t;
                    y += dy * t;
                }
            }

            dx = p.x - x;
            dy = p.y - y;

            return dx * dx + dy * dy;
        }
        // rest of the code doesn't care about point format

        // basic distance-based simplification
        function simplifyRadialDist(points, sqTolerance) {

            var prevPoint = points[0],
                newPoints = [prevPoint],
                point;

            for (var i = 1, len = points.length; i < len; i++) {
                point = points[i];

                if (getSqDist(point, prevPoint) > sqTolerance) {
                    newPoints.push(point);
                    prevPoint = point;
                }
            }

            if (prevPoint !== point) newPoints.push(point);

            return newPoints;
        }

        function simplifyDPStep(points, first, last, sqTolerance, simplified) {
            var maxSqDist = sqTolerance,
                index;

            for (var i = first + 1; i < last; i++) {
                var sqDist = getSqSegDist(points[i], points[first], points[last]);

                if (sqDist > maxSqDist) {
                    index = i;
                    maxSqDist = sqDist;
                }
            }

            if (maxSqDist > sqTolerance) {
                if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
                simplified.push(points[index]);
                if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
            }
        }

        // simplification using Ramer-Douglas-Peucker algorithm
        function simplifyDouglasPeucker(points, sqTolerance) {
            var last = points.length - 1;

            var simplified = [points[0]];
            simplifyDPStep(points, 0, last, sqTolerance, simplified);
            simplified.push(points[last]);

            return simplified;
        }

        // both algorithms combined for awesome performance
        var sqTolerance = tolerance !== undefined ? tolerance * tolerance : 1;

        points = highestQuality ? points : simplifyRadialDist(points, sqTolerance);
        points = simplifyDouglasPeucker(points, sqTolerance);

        return points;
    }

