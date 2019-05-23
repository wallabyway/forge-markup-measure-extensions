'use strict';

import { MarkupsCore } from './core/MarkupsCore'
import { MarkupsGui } from './gui/MarkupsGui'

import { Clipboard } from './core/edit-clipboard/Clipboard'
import { CloneMarkup } from './core/edit-actions/CloneMarkup'
import { CreateArrow } from './core/edit-actions/CreateArrow'
import { CreateCallout } from './core/edit-actions/CreateCallout'
import { CreateCircle } from './core/edit-actions/CreateCircle'
import { CreateCloud } from './core/edit-actions/CreateCloud'
import { CreateDimension } from './core/edit-actions/CreateDimension'
import { CreateFreehand } from './core/edit-actions/CreateFreehand'
import { CreateHighlight } from './core/edit-actions/CreateHighlight'
import { CreatePolycloud } from './core/edit-actions/CreatePolycloud'
import { CreatePolyline } from './core/edit-actions/CreatePolyline'
import { CreateRectangle } from './core/edit-actions/CreateRectangle'
import { CreateText } from './core/edit-actions/CreateText'
import { DeleteArrow } from './core/edit-actions/DeleteArrow'
import { DeleteCallout } from './core/edit-actions/DeleteCallout'
import { DeleteCircle } from './core/edit-actions/DeleteCircle'
import { DeleteCloud } from './core/edit-actions/DeleteCloud'
import { DeleteDimension } from './core/edit-actions/DeleteDimension'
import { DeleteFreehand } from './core/edit-actions/DeleteFreehand'
import { DeleteHighlight } from './core/edit-actions/DeleteHighlight'
import { DeletePolycloud } from './core/edit-actions/DeletePolycloud'
import { DeletePolyline } from './core/edit-actions/DeletePolyline'
import { DeleteRectangle } from './core/edit-actions/DeleteRectangle'
import { DeleteText } from './core/edit-actions/DeleteText'

import { EditAction } from './core/edit-actions/EditAction' 
import { EditActionGroup } from './core/edit-actions/EditActionGroup' 
import { EditActionManager } from './core/edit-actions/EditActionManager' 
import { EditFrame } from './core/EditFrame' 

import { EditMode } from './core/edit-modes/EditMode'
import { EditModeArrow } from './core/edit-modes/EditModeArrow'
import { EditModeCallout } from './core/edit-modes/EditModeCallout'
import { EditModeCircle } from './core/edit-modes/EditModeCircle'
import { EditModeCloud } from './core/edit-modes/EditModeCloud'
import { EditModeDimension } from './core/edit-modes/EditModeDimension'
import { EditModeFreehand } from './core/edit-modes/EditModeFreehand'
import { EditModeHighlight } from './core/edit-modes/EditModeHighlight'
import { EditModePen } from './core/edit-modes/EditModePen'
import { EditModePolycloud } from './core/edit-modes/EditModePolycloud'
import { EditModePolyline } from './core/edit-modes/EditModePolyline'
import { EditModeRectangle } from './core/edit-modes/EditModeRectangle'
import { EditModeText } from './core/edit-modes/EditModeText'
import { EditorTextInput } from './core/edit-modes/EditorTextInput'


import { Markup } from './core/Markup'
import { MarkupArrow } from './core/MarkupArrow'
import { MarkupCallout } from './core/MarkupCallout'
import { MarkupCircle } from './core/MarkupCircle'
import { MarkupCloud } from './core/MarkupCloud'
import { MarkupDimension } from './core/MarkupDimension'
import { MarkupFreehand } from './core/MarkupFreehand'
import { MarkupHighlight } from './core/MarkupHighlight'
import { MarkupPen } from './core/MarkupPen'
import { MarkupPolycloud } from './core/MarkupPolycloud'
import { MarkupPolyline } from './core/MarkupPolyLine'
import { MarkupRectangle } from './core/MarkupRectangle'
import { MarkupText } from './core/MarkupText'
import { MarkupTool } from './core/MarkupTool'

import { SetArrow } from './core/edit-actions/SetArrow'
import { SetCallout } from './core/edit-actions/SetCallout'
import { SetCircle } from './core/edit-actions/SetCircle'
import { SetCloud } from './core/edit-actions/SetCloud'
import { SetDimension } from './core/edit-actions/SetDimension'
import { SetFreehand } from './core/edit-actions/SetFreehand'
import { SetHighlight } from './core/edit-actions/SetHighlight'
import { SetPolycloud } from './core/edit-actions/SetPolycloud'
import { SetPolyline } from './core/edit-actions/SetPolyline'
import { SetPosition } from './core/edit-actions/SetPosition'
import { SetRectangle } from './core/edit-actions/SetRectangle'
import { SetRotation } from './core/edit-actions/SetRotation'
import { SetSize } from './core/edit-actions/SetSize'
import { SetStyle } from './core/edit-actions/SetStyle'
import { SetText } from './core/edit-actions/SetText'


import * as MarkupEvents from './core/MarkupEvents'
import * as MarkupTypes from './core/MarkupTypes'

import * as Utils from './core/MarkupsCoreUtils'
import * as StyleUtils from './core/StyleUtils'

import { theEditModeManager } from './core/EditModeManager'

// All the things
export const Core = {
    Clipboard,
    CloneMarkup,
    CreateArrow,
    CreateCallout,
    CreateCircle,
    CreateCloud,
    CreateDimension,
    CreateFreehand,
    CreateHighlight,
    CreatePolycloud,
    CreatePolyline,
    CreateRectangle,
    CreateText,
    DeleteArrow,
    DeleteCallout,
    DeleteCircle,
    DeleteCloud,
    DeleteDimension,
    DeleteFreehand,
    DeleteHighlight,
    DeletePolycloud,
    DeletePolyline,
    DeleteRectangle,
    DeleteText,

    EditAction,
    EditActionGroup,
    EditActionManager,
    EditFrame,

    EditMode,
    EditModeArrow,
    EditModeCallout,
    EditModeCircle,
    EditModeCloud,
    EditModeDimension,
    EditModeFreehand,
    EditModeHighlight,
    EditModePen,
    EditModePolycloud,
    EditModePolyline,
    EditModeRectangle,
    EditModeText,
    EditorTextInput,

    Markup,
    MarkupArrow,
    MarkupCallout,
    MarkupCircle,
    MarkupCloud,
    MarkupDimension,
    MarkupFreehand,
    MarkupHighlight,
    MarkupPen,
    MarkupPolycloud,
    MarkupPolyline,
    MarkupRectangle,
    MarkupText,
    MarkupTool,
    
    MarkupsCore,

    SetArrow,
    SetCallout,
    SetCircle,
    SetCloud,
    SetDimension,
    SetFreehand,
    SetHighlight,
    SetPolycloud,
    SetPolyline,
    SetPosition,
    SetRectangle,
    SetRotation,
    SetSize,
    SetStyle,
    SetText,


    MarkupEvents,
    MarkupTypes,
    theEditModeManager,
    Utils,
};

// Spread the markup types to minimize breaking changes (sigh)
for (var markupType in MarkupTypes) {
    Core[markupType] = MarkupTypes[markupType];
}

// Spread the event ids to minimize breaking changes (sigh)
for (var eventType in MarkupEvents) {
    Core[eventType] = MarkupEvents[eventType];
}

// Merge StyleUtils with utils (because those methods used to live in Utils)
for (var thing in StyleUtils) {
    if (thing in Core.Utils)
        throw new Error(`Property ${thing} from StyleUtils already present in MarkupsCoreUtils.`);

    Core.Utils[thing] = StyleUtils[thing];
}


export const Gui = {
    MarkupsGui
}


// Also map back to legacy namespace
Autodesk.Viewing.Extensions.Markups = {
    Core
};
