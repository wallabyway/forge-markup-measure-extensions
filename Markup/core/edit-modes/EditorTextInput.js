'use strict';

const ResizeObserver = require('../../../thirdparty/resize-observer-polyfill/ResizeObserver.min.js'); // Required for Markup Text Input
import { autosize } from './EditorTextAutosize'
import { addTraitEventDispatcher } from '../MarkupsCoreUtils'
import { cloneStyle } from '../StyleUtils'
import { DomElementStyle } from '../DomElementStyle'

const av = Autodesk.Viewing;

    /**
     * Auxiliary class that handles all input for the Label Markup (MarkupText.js)
     * It instantiates a TEXTAREA where the user can input text. When user input is
     * disabled, the textarea gets hidden and further rendering is delegated to
     * MarkupText.js
     *
     * @param {HTMLElement} parentDiv
     * @param {Object} editor - Core Extension
     * @constructor
     */
    export function EditorTextInput(parentDiv, editor, singleLine, defaultText, maxLength) {

        this.parentDiv = parentDiv;
        this.editor = editor;
        this.setGlobalManager(editor.viewer.globalManager);

        // Constants
        this.EVENT_TEXT_CHANGE = 'EVENT_CO2_TEXT_CHANGE';
        this.EVENT_TEXT_SET_ACTIVE = 'EVENT_CO2_TEXT_SET_ACTIVE';
        this.EVENT_TEXT_SET_INACTIVE = 'EVENT_CO2_TEXT_SET_INACTIVE';

        const _document = this.getDocument();
        // The actual TextArea input
        if (singleLine) {
            this.textArea = _document.createElement('input');
            this.textArea.setAttribute('type', 'text');
        }
        else {
            this.textArea = _document.createElement('textarea');
            this.textArea.rows = '1';
            if (!Autodesk.Viewing.isIE11) { // auto parameter not available in IE11
                this.textArea.dir = 'auto';
            }
        }

        this.firstEdit = true;
        this.defaultText = defaultText;
        this.textArea.setAttribute('maxlength', maxLength); // TODO: Make constant? Change value?
        this.textArea.setAttribute('data-i18n', defaultText);
        this.startingHeight = 0;

        autosize.bind(this)(this.textArea);

        var ro = new ResizeObserver(function(entries, observer) {
            this.setEditFrame();
        }.bind(this));

        ro.observe(this.textArea);

        this.styleTextArea = new DomElementStyle(); // TODO: Move this to EditMode.
        this.styleTextArea
                .setAttribute('position', 'absolute')
                .setAttribute('resize', 'none')
                .setAttribute('box-sizing', 'border-box')
                .setAttribute('-moz-box-sizing', 'border-box')
                .setAttribute('-webkit-box-sizing', 'border-box')
                .setAttribute('overflow', 'hidden')
                .setAttribute('outline', 'none')
                .setAttribute('border', 'none')
                .setAttribute('z-index', '1')
                .setAttribute('padding', '10px');

        // Helper div to measure text width
        this.measureDiv = _document.createElement('div');

        // Become an event dispatcher
        addTraitEventDispatcher(this);
    }

    av.GlobalManagerMixin.call(EditorTextInput.prototype);
    var proto = EditorTextInput.prototype;

    proto.destroy = function() {

        this.setInactive();
    };

    /**
     * Initializes itself given an Label Markup (textMarkup)
     * @param {Object} textMarkup
     * @param {Boolean} firstEdit - Whether the markup is being edited for the first time.
     */
    proto.setActive = function(textMarkup, firstEdit) {

        if (this.textMarkup === textMarkup) {
            return;
        }

        var placeholderText = Autodesk.Viewing.i18n.translate(this.defaultText);
        this.textArea.setAttribute('placeholder', placeholderText);

        this.setInactive();
        this.parentDiv.appendChild(this.textArea);
        this.textMarkup = textMarkup;
        this.firstEdit = firstEdit || false;

        this.constrainToCanvas = firstEdit;

        this.initFromMarkup();

        this.constrainToCanvas = false;

        // On iOS this doesn't work quite well, the keyboard will dismiss after call focus programatically.
        // http://stackoverflow.com/questions/32407185/wkwebview-cant-open-keyboard-for-input-field
        if (!Autodesk.Viewing.isIOSDevice()) {
          // Focus on next frame
          var txtArea = this.textArea;
          const _window = this.getWindow();
          _window.requestAnimationFrame(function(){
              txtArea.focus();
          });
        }

        var dataBag = {
            markup: this.textMarkup,
            firstEdit: this.firstEdit,
            isActive: true
        };
        this.dispatchEvent({ type: this.EVENT_TEXT_SET_ACTIVE, data: dataBag });
    };

    /**
     * Closes the editor text input and goes back into normal markup edition mode.
     */
    proto.setInactive = function() {
        var dataBag = {
            markup: this.textMarkup,
            isActive: false
        };

        // In iOS10, the keyboard always show on screen after tap screen out of text
        // area or save markup to end text edit, call blur to make sure keyboard dismiss.
        if (Autodesk.Viewing.isIOSDevice())
        {
            this.textArea.blur();
        }

        this.removeWindowEventListener('resize', this.onResizeBinded);

        if (this.textMarkup) {
            this.textMarkup = null;
            this.parentDiv.removeChild(this.textArea);
        }
        this.style = null;

        this.dispatchEvent({ type: this.EVENT_TEXT_SET_INACTIVE, data: dataBag });
    };

    proto.isActive = function() {

        return !!this.textMarkup;
    };

    proto.setEditFrame = function() {
        if (this.editor.editFrame.markup && this.textMarkup && this.editor.editFrame.markup === this.textMarkup) {
            var frameWidth = parseFloat(this.textArea.style.width);
            var frameHeight = parseFloat(this.textArea.style.height);

            var position = this.textMarkup.getClientPosition();
            var rotation = this.textMarkup.getRotation();

            var xPos = position.x - (frameWidth / 2);
            var yPos = position.y - (this.startingHeight / 2);

            this.editor.editFrame.setSelection(xPos, yPos, frameWidth, frameHeight, rotation);
        }
    };

    /**
     * Applies Markup styles to TextArea used for editing.
     * It also saves a copy of the style object.
     * @private
     */
    proto.initFromMarkup = function(updateStyleFirst) {

        var markup = this.textMarkup;
        var position = markup.getClientPosition();
        var size = markup.getClientSize();

        // Text area padding is relative to the current font size
        var padding = markup.getClientFontSize() / 2;

        this.startingHeight = size.y;

        var left = position.x - size.x * 0.5;
        var top = position.y - size.y * 0.5;

        var lineHeightPercentage = markup.lineHeight + "%";
        this.styleTextArea.setAttribute('line-height', lineHeightPercentage);
        this.styleTextArea.setAttribute('padding', padding + 'px');

        this.setPosAndSize(left, top, size.x, size.y);
        if (updateStyleFirst) {
            this.setStyle(markup.getStyle());
            this.textArea.value = markup.getText();
        } else {
            this.textArea.value = markup.getText();
            this.setStyle(markup.getStyle());
        }
    };

    proto.setPosAndSize = function(left, top, width, height) {
        if (this.constrainToCanvas) {
            // Check that it doesn't overflow out of the canvas
            if (left + width >= this.editor.viewer.container.clientWidth) {
                left = this.editor.viewer.container.clientWidth - (width + 10);
            }
            if (top + height >= this.editor.viewer.container.clientHeight) {
                top = this.editor.viewer.container.clientHeight - (height + 10);
            }

            // Make sure text input left side always in the canvas area.
            // Especially on iPhone6 & iPhone7
            if (left < 5) {
                left = 5;
                width = this.editor.viewer.container.clientWidth - 10;
            }
        }

        this.styleTextArea
            // Size and position
            .setAttribute('left', left + 'px')
            .setAttribute('top', top + 'px')
            .setAttribute('width', width + 'px')
            .setAttribute('height', height + 'px');
    };

    proto.setStyle = function(style) {

        if (this.style) {
            // An already present style means that the user
            // has changed the style using the UI buttons.
            // We need to account for the user having changed the
            // width/height of the TextArea. Since there is no event
            // we can detect for it, we do it here.
            var temp = {};
            this.injectSizeValues(temp);
            this.setPosAndSize(
                temp.newPos.x - temp.width * 0.5,
                temp.newPos.y - temp.height * 0.5,
                temp.width, temp.height);
        }
        var fontHeight = this.editor.sizeFromMarkupsToClient(0, style['font-size']).y;
        var strokeWidth = this.editor.sizeFromMarkupsToClient(0, style['stroke-width']).y;
        var textAreaStyle = this.styleTextArea
            // Visuals
            .setAttribute('color', style['stroke-color'])
            .setAttribute('outline', strokeWidth + 'px solid ' + style['stroke-color'])
            .setAttribute('font-family', style['font-family'])
            .setAttribute('font-size', fontHeight + 'px')
            .setAttribute('font-weight', style['font-weight'])
            .setAttribute('font-style', style['font-style'])
            .getStyleString();
        this.textArea.setAttribute('style', textAreaStyle);
        this.style = cloneStyle(style);
        autosize.update(this.textArea);
    };

    /**
     * Helper function that, for a given markup with some text in it
     * returns an Array of lines in it.
     * @param {Object} markup
     * @returns {{text, lines}|{text: String, lines: Array.<String>}}
     */
    proto.getTextValuesForMarkup = function(markup, sizeUpdateRequired) {
        var active = this.isActive();
        var activeMarkup = this.textMarkup;
        var activeFirstEdit = this.firstEdit;

        this.setActive(markup, false);
        var textValues = this.getTextValues();

        var dataBag = {
            markup: markup,
            textValues: textValues
        };

        if (active) {
            this.setActive(activeMarkup, activeFirstEdit);
        } else {
            if (sizeUpdateRequired) {
                this.injectSizeValues(dataBag);
            }

            this.setInactive();
        }

        return dataBag;
    };

    /**
     * Returns the current text as one string and an array of lines
     * of how the text is being rendered (1 string per line)
     * @returns {{text: String, lines: Array.<String>}}
     */
    proto.getTextValues = function() {

        var newText = this.textArea.value;
        if (newText === this.defaultText) {
            newText = '';
        }
        return {
            text: newText,
            lines: this.generateLines()
        };
    };

    /**
     * Function called by UI
     */
    proto.acceptAndExit = function() {

        // If placeholder text, then remove.
        var textValues = this.getTextValues();
        var textMarkup = this.textMarkup;

        var dataBag = {
            markup: this.textMarkup,
            style: this.style,
            firstEdit: this.firstEdit,
            newText: textValues.text,
            newLines: textValues.lines
        };
        this.injectSizeValues(dataBag);

        this.dispatchEvent({ type: this.EVENT_TEXT_CHANGE, data: dataBag });
        this.setInactive();
        textMarkup.updateStyle(true); // Hack: LMV-3628
    };

    /**
     * Injects position, width and height of the textarea rect
     * @param {Object} dataBag
     * @private
     */
    proto.injectSizeValues = function(dataBag) {

        // Explicit usage of parseFloat to remove the 'px' suffix.
        var width = parseFloat(this.textArea.style.width);
        var height = parseFloat(this.textArea.style.height);
        var ox = parseFloat(this.textArea.style.left);
        var oy = parseFloat(this.textArea.style.top);

        dataBag.width = width;
        dataBag.height = height;
        dataBag.newPos = {
            x: ox + (width * 0.5),
            y: oy + (height * 0.5)
        };
    };

    /**
     * Handler for when the camera moves
     * @param {Object} event - Camera moves event
     * @private
     */
    proto.onCameraChanged = function(event) {
        var str = this.textArea.value;
        this.textMarkup.style = cloneStyle(this.style);
        this.style = null; // TODO: Revisit this code because style changes are lost by doing this.
        this.initFromMarkup(true);
        this.textArea.value = str;
        this.setEditFrame();
    };

    /**
     * Grabs the text content of the textarea and returns
     * an Array of lines.  Wrapped lines are returned as 2 lines.
     */
    proto.generateLines = function() {

        // First, get lines separated by line breaks:
        var textContent = this.textArea.value;
        var linesBreaks = textContent.split(/\r*\n/);

        var styleMeasureStr = this.styleTextArea.clone()
            .removeAttribute(['top', 'left', 'width', 'height'])
            .setAttribute('position','absolute')
            .setAttribute('white-space','nowrap')
            .setAttribute('float','left')
            .setAttribute('visibility','hidden')
            .getStyleString();
        this.measureDiv.setAttribute('style', styleMeasureStr);
        this.parentDiv.appendChild(this.measureDiv);

        var maxLineLength = this.textArea.clientWidth - (2 * parseFloat(this.textArea.style.padding));

        // Now check whether the lines are wrapped.
        // If so, subdivide into other lines.
        var linesOutput = [];

        for (var i= 0, len = linesBreaks.length; i<len; ++i) {
            var line = trimRight(linesBreaks[i]);

            // Add a space in an empty line so it appears in the lines output
            line = (line === '') ? ' ' : line;
            this.splitLine(line, maxLineLength, linesOutput);
        }

        this.parentDiv.removeChild(this.measureDiv);
        return linesOutput;
    };

    /**
     * Given a String that represents one line of text that is
     * longer than the max length a line is allowed, this method
     * cuts text into several ones that are no longer than the max
     * length.
     *
     * @param {String} text
     * @param {Number} maxLength
     * @param {Array} output
     * @private
     */
    proto.splitLine = function(text, maxLength, output) {

        // End condition
        if (text === '') {
            return;
        }

        var remaining = '';
        var done = false;

        while (!done){
            this.measureDiv.innerText = text;
            var lineLen = this.measureDiv.clientWidth - (2 * parseFloat(this.measureDiv.style.padding));
            if (lineLen <= maxLength) {
                output.push(text);
                this.splitLine(trimLeft(remaining), maxLength, output);
                done = true;
            } else {
                // Need to try with a shorter word!
                var parts = this.getShorterLine(text);
                if (parts.length === 1) {
                    // text is only one word that is way too long.
                    this.splitWord(text, remaining, maxLength, output);
                    done = true;
                } else {
                    text = parts[0];
                    remaining = parts[1] + remaining;
                }
            }
        }
    };

    /**
     * Given a line of text such as "hi there programmer", it returns
     * an array with 2 parts: ["hi there", " programmer"].
     *
     * It accounts for special cases with multi-spaces, such as for
     * "hi there  two-spaces" returns ["hi there", "  two-spaces"]
     *
     * When there is only one word, it returns the whole word:
     * "JustOneWord" returns ["JustOneWord"] (an array of 1 element)
     *
     * @param {String} line
     * @returns {Array}
     */
    proto.getShorterLine = function(line) {

        // TODO: Account for TABs
        // Will probably never do unless a bug is reported.

        var iLastSpace = line.lastIndexOf(' ');
        if (iLastSpace === -1) {
            return [line]; // This is a single word
        }

        // Else
        // Iterate back removing additional spaces (multi spaces)
        while (line.charAt(iLastSpace-1) === ' ') {
            iLastSpace--
        }

        var trailingWord = line.substr(iLastSpace); // Contains the spaces
        var shorterLine = line.substr(0,iLastSpace);
        return [shorterLine, trailingWord];
    };

    /**
     * Given a single word, splits it into multiple lines that fits in maxWidth
     * @param {String} word
     * @param {String} remaining
     * @param {Number} maxLength
     * @param {Array} output
     */
    proto.splitWord = function(word, remaining, maxLength, output) {

        var lenSoFar = 1;
        var fits = true;
        while (fits) {

            var part = word.substr(0,lenSoFar);
            this.measureDiv.innerText = part;
            var lineLen =  this.measureDiv.clientWidth - (2 * parseFloat(this.measureDiv.style.padding));

            if (lineLen > maxLength) {

                if (lenSoFar === 1) {
                    // we can't split 1 character any longer.
                    output.push(part);
                    this.splitWord(word.substr(1), remaining, maxLength, output);
                    return;
                }

                // It was fine until one less char //
                var okayWord = word.substr(0,lenSoFar-1);
                output.push(okayWord);
                var extraWord = word.substr(lenSoFar-1);
                this.splitLine(extraWord + remaining, maxLength, output);
                return;
            }

            // Try one more character
            lenSoFar++;

            // Check if we are done with all characters
            if (lenSoFar > word.length) {
                // Okay it fits
                output.push(word);
                return;
            }
        }
    };

    function trimRight(text) {
        if (text.length === 0) {
            return "";
        }
        var lastNonSpace = text.length-1;
        for (var i=lastNonSpace; i>=0; --i) {
            if (text.charAt(i) !== ' ') {
                lastNonSpace = i;
                break;
            }
        }
        return text.substr(0, lastNonSpace+1);
    }

    function trimLeft(text) {
        if (text.length === 0) {
            return "";
        }
        var firstNonSpace = 0;
        for (var i=0; i<text.length; ++i) {
            if (text.charAt(i) !== ' ') {
                firstNonSpace = i;
                break;
            }
        }
        return text.substr(firstNonSpace);
    }
