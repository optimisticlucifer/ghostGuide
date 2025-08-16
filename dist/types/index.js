"use strict";
// Core interfaces and types
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioSource = exports.AudioPromptType = exports.PromptCategory = exports.ActionType = void 0;
var ActionType;
(function (ActionType) {
    ActionType["SCREENSHOT"] = "screenshot";
    ActionType["DEBUG"] = "debug";
    ActionType["GENERAL"] = "general";
})(ActionType || (exports.ActionType = ActionType = {}));
var PromptCategory;
(function (PromptCategory) {
    PromptCategory["SYSTEM"] = "system";
    PromptCategory["ACTION"] = "action";
    PromptCategory["AUDIO_COACHING"] = "audio_coaching";
    PromptCategory["FALLBACK"] = "fallback";
    PromptCategory["OPENAI_SYSTEM"] = "openai_system";
})(PromptCategory || (exports.PromptCategory = PromptCategory = {}));
var AudioPromptType;
(function (AudioPromptType) {
    AudioPromptType["INTERVIEWER_QUESTION"] = "interviewer_question";
    AudioPromptType["INTERVIEWEE_RESPONSE"] = "interviewee_response";
    AudioPromptType["GENERAL_TRANSCRIPT"] = "general_transcript";
})(AudioPromptType || (exports.AudioPromptType = AudioPromptType = {}));
var AudioSource;
(function (AudioSource) {
    AudioSource["INTERVIEWER"] = "internal";
    AudioSource["INTERVIEWEE"] = "microphone";
    AudioSource["BOTH"] = "both";
    AudioSource["SYSTEM"] = "system";
})(AudioSource || (exports.AudioSource = AudioSource = {}));
