import { getStyleDefaultValues } from '../core/StyleUtils'
import * as MarkupEvents from '../core/MarkupEvents' 
import * as MarkupTypes from '../core/MarkupTypes'
import { theEditModeManager } from '../core/EditModeManager'

import CSS from './MarkupsGui.css' // IMPORTANT!!

    var CORE_EXTENSION = 'Autodesk.Viewing.MarkupsCore';

    export function MarkupsGui(viewer, options) {
        Autodesk.Viewing.Extension.call(this, viewer, options);
        this.domEvents = [];
        this.name = 'markup';
        this.onEditModeEnter = this.onEditModeEnter.bind(this);
        this.onEditModeLeave = this.onEditModeLeave.bind(this);
        this.onEditModeChange = this.onEditModeChange.bind(this);
        this.onMarkupSelected = this.onMarkupSelected.bind(this);
    }

    MarkupsGui.prototype = Object.create(Autodesk.Viewing.Extension.prototype);
    MarkupsGui.prototype.constructor = MarkupsGui;
    var proto = MarkupsGui.prototype;
    var av = Autodesk.Viewing;
    var avp = av.Private;

    proto.load = function () {

        this.viewer.loadExtension(CORE_EXTENSION).then( coreExt => {

            this.core = coreExt;

            // Hook into markup core events
            this.core.addEventListener(MarkupEvents.EVENT_EDITMODE_ENTER, this.onEditModeEnter);
            this.core.addEventListener(MarkupEvents.EVENT_EDITMODE_LEAVE, this.onEditModeLeave);
            this.core.addEventListener(MarkupEvents.EVENT_EDITMODE_CHANGED, this.onEditModeChange);
            this.core.addEventListener(MarkupEvents.EVENT_MARKUP_SELECTED, this.onMarkupSelected);
        });

        return true;
    };

    proto.unload = function() {

        this.deactivate(); // not necessary, but leaves the viewer in an unusable state without it
        this.unhookAllEvents();

        this.core.removeEventListener(MarkupEvents.EVENT_EDITMODE_ENTER, this.onEditModeEnter);
        this.core.removeEventListener(MarkupEvents.EVENT_EDITMODE_LEAVE, this.onEditModeLeave);
        this.core.removeEventListener(MarkupEvents.EVENT_EDITMODE_CHANGED, this.onEditModeChange);
        this.core.removeEventListener(MarkupEvents.EVENT_MARKUP_SELECTED, this.onMarkupSelected);

        this.destroyToolUi();
        this.destroyToolbarUI();
        this.core = null;

        return true;
    };

    proto.onToolbarCreated = function(toolbar) {
        
        var self = this;
        var viewer = this.viewer;

        this.markupToolButton = new Autodesk.Viewing.UI.Button("toolbar-markupTool");
        this.markupToolButton.setToolTip("Markup");
        this.markupToolButton.setIcon("adsk-icon-markup");
        this.markupToolButton.onClick = function () {
            // Since the bar will get hidden when closed, there
            // is no need to track button state (active or not)
            self.activate();
        };

        var modelTools = toolbar.getControl(Autodesk.Viewing.TOOLBAR.MODELTOOLSID);
        if (modelTools) {
            modelTools.addControl(this.markupToolButton, {index:0});
        }
    };

    proto.destroyToolbarUI = function() {
        if (this.markupToolButton) {
            var toolbar = this.viewer.getToolbar();
            if (toolbar) {
                this.markupToolButton.removeFromParent();
            }
            this.markupToolButton = null;
        }
    };

    proto.onEditModeEnter = function() {
        avp.logger.log('ENTER edit mode');
        this.showToolsUi();
    };

    proto.onEditModeLeave = function() {
        avp.logger.log('LEAVE edit mode');
        this.hideToolsUi();
    };

    proto.onEditModeChange = function(event) {
        if (!this.domToolSelect || this.ignoreChangeEvent)
            return;
        var editMode = this.core.editMode;
        var optionList = this.domToolSelect.options;
        for (var i=0, len=optionList.length; i<len; i++) {
            var option = optionList[i];
            if (option.value === editMode.type) {
                this.domToolSelect.selectedIndex = i; // doesn't fire event
                break;
            }
        }
    };

    proto.onMarkupSelected = function(event) {

        var markup = event.markup;
        var editMode = this.core.editMode;
        this.setStylesUi(editMode, markup);
    };

    proto.showToolsUi = function() {
        this.createToolsUi();

        // Hide some UI
        var canNavigate = this.core.isNavigationAllowed();
        this.setControlVisibility('.lmv-markup-gui-enterNavMode', canNavigate, 'inline-block');
        this.exitNavigationMode();
        this.domContent.style.display = 'block'; // remove collapsed state

        // It's okay if we call these many times in a row, no biggie.
        this.viewer.container.appendChild(this.domRoot);
    };

    proto.hideToolsUi = function() {
        if (this.domRoot && this.domRoot.parentNode) {
            this.domRoot.parentNode.removeChild(this.domRoot);
        }
    };

    proto.createToolsUi = function() {

        if (this.domRoot)
            return;

        var optionIndex = 0;
        function createEditModeOption(locLabel, editModeType) {
            return [
                '<option value="', editModeType, '">',
                    locLabel,
                '</option>'
            ].join('');
        }

        var html = [
            '<div class="lmv-markup-gui-toolbar-content">',

                '<button class="lmv-markup-gui-collapse-btn">&lt;-&gt;</button>',
                '<button class="lmv-markup-editmode-done">Exit</button>',
                '<div class="lmv-markup-gui-collapse-content">',
                    '<div class="lmv-markup-gui-editMode">',
                        '<button class="lmv-markup-gui-enterNavMode">Navigate</button>',
                        '<button class="lmv-markup-gui-undo">&#8617;</button>',
                        '<button class="lmv-markup-gui-redo">&#8618;</button>',
                        '<br>',
                        '<button class="lmv-markup-gui-delete">Delete</button>',
                        '<button class="lmv-markup-gui-duplicate">Duplicate</button>',
                        '<br>',
                        '<button class="lmv-markup-gui-cut">Cut</button>',
                        '<button class="lmv-markup-gui-copy">Copy</button>',
                        '<button class="lmv-markup-gui-paste">Paste</button>',
                        '<br>',
                        '<span>Markup:</span>', // TODO: Localize
                        '<select class="lmv-markup-tool-select">',
                            createEditModeOption('Arrow', MarkupTypes.MARKUP_TYPE_ARROW),
                            createEditModeOption('Rectangle', MarkupTypes.MARKUP_TYPE_RECTANGLE),
                            createEditModeOption('Circle', MarkupTypes.MARKUP_TYPE_CIRCLE),
                            createEditModeOption('Text', MarkupTypes.MARKUP_TYPE_TEXT),
                            createEditModeOption('Callout', MarkupTypes.MARKUP_TYPE_CALLOUT),
                            createEditModeOption('Cloud', MarkupTypes.MARKUP_TYPE_CLOUD),
                            createEditModeOption('PolyLine', MarkupTypes.MARKUP_TYPE_POLYLINE),
                            createEditModeOption('Polycloud', MarkupTypes.MARKUP_TYPE_POLYCLOUD),
                            createEditModeOption('Freehand', MarkupTypes.MARKUP_TYPE_FREEHAND),
                            createEditModeOption('Highlight', MarkupTypes.MARKUP_TYPE_HIGHLIGHT),
                            createEditModeOption('Dimension', MarkupTypes.MARKUP_TYPE_DIMENSION),
                        '</select>',
                        '<br>',
                        '<div class="lmv-markup-gui-style-options"></div>',
                    '</div>',
                    '<div class="lmv-markup-gui-navMode" style="display:none;">',
                        '<button class="lmv-markup-gui-exitNavMode">Back to Markup</button>',
                    '</div>',
                '</div>',
            '</div>'
        ].join('');

        const _document = this.getDocument();
        this.domRoot = _document.createElement('div');
        this.domRoot.className = 'lmv-markup-gui-toolbar';
        this.domRoot.innerHTML = html;

        this.domContent = this.domRoot.querySelector('.lmv-markup-gui-collapse-content');
        this.domToolSelect = this.domRoot.querySelector('.lmv-markup-tool-select');
        this.domStylesRoot = this.domRoot.querySelector('.lmv-markup-gui-style-options');

        // General
        this.hookEvent('click', '.lmv-markup-gui-collapse-btn', this.onToggleCollapse.bind(this));
        this.hookEvent('click', '.lmv-markup-editmode-done', this.onEditModeDone.bind(this));
        this.hookEvent('click', '.lmv-markup-gui-enterNavMode', this.enterNavigationMode.bind(this));
        this.hookEvent('click', '.lmv-markup-gui-exitNavMode', this.exitNavigationMode.bind(this));
        this.hookEvent('click', '.lmv-markup-gui-undo', this.onUndoClick.bind(this));
        this.hookEvent('click', '.lmv-markup-gui-redo', this.onRedoClick.bind(this));
        this.hookEvent('click', '.lmv-markup-gui-delete', this.onDeleteClick.bind(this));
        this.hookEvent('click', '.lmv-markup-gui-cut', this.onCutClick.bind(this));
        this.hookEvent('click', '.lmv-markup-gui-copy', this.onCopyClick.bind(this));
        this.hookEvent('click', '.lmv-markup-gui-paste', this.onPasteClick.bind(this));
        this.hookEvent('click', '.lmv-markup-gui-duplicate', this.onDuplicateClick.bind(this));
        // Tools
        this.hookEvent('change', '.lmv-markup-tool-select', this.onSelectEditMode.bind(this));
        this.hookEvent('change', '.lmv-markup-gui-style-select', this.onStyleChange.bind(this));

        this.setStylesUi(this.core.editMode);
    };

    proto.destroyToolUi = function() {
        if (this.domRoot) {
            this.hideToolsUi();
            this.domRoot = null;
        }
    };

    proto.getEditMode = function(editModeType) {
        var EditModeClass = theEditModeManager.getClass(editModeType);
        if (!EditModeClass)
            return null;

        var editMode = new EditModeClass(this.core);
        return editMode;
    };

    proto.onToggleCollapse = function() {
        var curr = this.domContent.style.display;
        if (curr === 'none')
            this.domContent.style.display = 'block';
        else
            this.domContent.style.display = 'none';
    };

    proto.onEditModeDone = function() {
        this.deactivate();
    };

    proto.enterNavigationMode = function() {
        this.core.allowNavigation(true);
        this.setControlVisibility('.lmv-markup-gui-editMode', false);
        this.setControlVisibility('.lmv-markup-gui-navMode', true);
    };
    proto.exitNavigationMode = function() {
        this.core.allowNavigation(false);
        this.setControlVisibility('.lmv-markup-gui-editMode', true);
        this.setControlVisibility('.lmv-markup-gui-navMode', false);
    };

    proto.onUndoClick = function() {
        this.core.undo();
    };
    proto.onRedoClick = function() {
        this.core.redo();
    };
    proto.onDeleteClick = function() {
        var markup = this.core.getSelection();
        if (markup) {
            this.core.deleteMarkup(markup);
        }
    };
    proto.onCutClick = function() {
        this.core.cut();
    };
    proto.onCopyClick = function() {
        this.core.copy();
    };
    proto.onPasteClick = function() {
        this.core.paste();
    };
    proto.onDuplicateClick = function() {
        // only when there's a selection
        var markup = this.core.getSelection();
        if (markup) {
            this.core.copy();
            this.core.paste();
        }
    };

    proto.onSelectEditMode = function(event) {
        var editModeType = event.target.value;
        var editMode = this.getEditMode(editModeType);
        if (!editMode) {
            avp.logger.error('Markup editMode not found for type: ' + editModeType);
            return;
        }

        if (editMode.cancelEditModeChange) {
            avp.logger.warn('There was a problem selecting current editMode');
            return;
        }

        this.ignoreChangeEvent = true;
        this.core.changeEditMode(editMode);
        this.ignoreChangeEvent = false;
        this.setStylesUi(editMode);
        this.domToolSelect.blur(); // remove focus from UI
    };

    proto.onStyleChange = function(event) {
        var select = event.target;
        var option = select.options[select.selectedIndex];
        var styleKey = select.getAttribute('style-key');
        var valueType = select.getAttribute('value-type');
        select.blur(); // remove focus from UI

        var markup = this.core.getSelection();
        var style = markup ? markup.getStyle() : this.core.getStyle();
        style[styleKey] = getTypedValue(option.value, valueType);
        this.core.setStyle(style);

        function getTypedValue(val, type) {
            if (type === 'number')
                return Number(val);
            if (type === 'boolean')
                return val === 'true';
            return val;
        }
    };

    proto.setStylesUi = function(editMode, markup) {
        avp.logger.log('set ui for ' + editMode.type);

        var style = markup ? markup.style : editMode.style;
        var defaults = getStyleDefaultValues(style, this.core);

        this.domStylesRoot.innerHTML = ''; // flush UI
        for (var key in defaults) {
            // Quite inefiient because we are re-creating DOM constantly
            // Consider optimize if it becomes a problem
            var domElem = this.getUiForStyleKey(key, defaults[key], style[key]);
            this.domStylesRoot.appendChild(domElem);
        }
    };

    proto.getUiForStyleKey = function(key, defaults, current) {

        var selectionIndex = defaults.default;
        var options = [];
        var values = defaults.values;
        for (var i=0, len=values.length; i<len; ++i) {
            var optLine = [
                '<option value="', values[i].value,'">',
                    values[i].name,
                '</option>'
            ].join('');
            options.push(optLine);

            if (this.valueEquals(values[i].value, current)) {
                selectionIndex = i;
            }
        }

        var valueType = typeof values[0].value;

        // TODO: Build specialized controls for each style-attribute
        const _document = this.getDocument();
        var domElem = _document.createElement('div');
        var html = [
            '<span>',key,'</span>',
            '<select class="lmv-markup-gui-style-select" style-key="', key, '" value-type="', valueType,'">',
                options.join(''),
            '</select>'
        ].join('');
        domElem.innerHTML = html;

        // select index
        var domSelect = domElem.querySelector('select');
        domSelect.selectedIndex = selectionIndex;

        return domElem;
    };
    proto.valueEquals = function(value1, value2) {

        return value1 === value2;
    }

    proto.setControlVisibility = function(selector, isVisible, visibleValue) {
        var elem = this.domRoot.querySelector(selector);
        if (!visibleValue)
            visibleValue = 'block';
        elem.style.display = isVisible ? visibleValue : 'none';
    };

    proto.hookEvent = function(eventStr, selector, callbackFn) {
        var handler = function(event){
            if (this.matchesSelector(event.target, selector)){
                callbackFn(event);
            }
        }.bind(this);
        this.domRoot.addEventListener(eventStr, handler);
        this.domEvents.push({str: eventStr, handler: handler });
    };

    proto.unhookAllEvents = function() {
        var domRoot = this.domRoot;
        this.domEvents.forEach(function(event) {
            domRoot.removeEventListener(event.str, event.handler);
        });
        this.domEvents = [];
    };

    proto.matchesSelector = function(domElem, selector) {
        if (domElem.matches) return domElem.matches(selector); //Un-prefixed
        if (domElem.msMatchesSelector) return domElem.msMatchesSelector(selector);  //IE
        if (domElem.mozMatchesSelector) return domElem.mozMatchesSelector(selector); //Firefox (Gecko)
        if (domElem.webkitMatchesSelector) return domElem.webkitMatchesSelector(selector); // Opera, Safari, Chrome
        return false;
    };

    proto.getStyleOptions = function(editMode) {
        var style = editMode.getStyle();
        return getStyleDefaultValues(style, this.core);
    };

    proto.activate = function () {
        if(!this.activeStatus) {
            this.core.enterEditMode();
            this.activeStatus = true;
        }
        return true;
    };

    proto.deactivate = function () {
        if(this.activeStatus) {
            this.core.hide();
            this.activeStatus = false;
        }
        return true;
    };


    Autodesk.Viewing.theExtensionManager.registerExtension('Autodesk.Viewing.MarkupsGui', MarkupsGui);
