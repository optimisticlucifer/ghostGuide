"use strict";
// Core interfaces and types
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioSource = exports.ActionType = void 0;
var ActionType;
(function (ActionType) {
    ActionType["SCREENSHOT"] = "screenshot";
    ActionType["DEBUG"] = "debug";
    ActionType["GENERAL"] = "general";
})(ActionType || (exports.ActionType = ActionType = {}));
var AudioSource;
(function (AudioSource) {
    AudioSource["INTERVIEWER"] = "internal";
    AudioSource["INTERVIEWEE"] = "microphone";
    AudioSource["BOTH"] = "both";
    AudioSource["SYSTEM"] = "system";
})(AudioSource || (exports.AudioSource = AudioSource = {}));
