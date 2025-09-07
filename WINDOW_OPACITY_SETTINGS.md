# Window Opacity Settings Guide

This document provides a comprehensive guide to all window opacity settings in the Interview Assistant application.

## Overview

All windows in the Interview Assistant support opacity customization. Opacity values range from `0.0` (fully transparent) to `1.0` (fully opaque).

## Window Opacity Settings Locations

### 1. Main Window (Primary UI)
**File:** `src/controllers/ApplicationController.ts`  
**Method:** `createMainWindow()`  
**Line:** ~154  
**Current Setting:** `opacity: 1.0` (fully opaque)  
**Comment:** MAIN WINDOW OPACITY SETTING

```typescript
// MAIN WINDOW OPACITY SETTING: Change the value below (0.0 to 1.0) to adjust main window opacity
// 1.0 = fully opaque (default for main window), 0.8 = 80% opacity, 0.5 = 50% opacity
opacity: 1.0  // Default fully opaque for main window
```

### 2. Session Window (Chat Interface)
**File:** `src/controllers/ApplicationController.ts`  
**Method:** `createSessionWindow()`  
**Line:** ~241  
**Current Setting:** `opacity: 1.0` (fully opaque)  
**Comment:** SESSION WINDOW OPACITY SETTING

```typescript
// SESSION WINDOW OPACITY SETTING: Change the value below (0.0 to 1.0) to adjust session window opacity
// 1.0 = fully opaque (default for session), 0.9 = 90% opacity, 0.8 = 80% opacity
opacity: 1.0  // Default fully opaque for session window
```

### 3. Notepad Window (Markdown Editor)
**File:** `src/controllers/ApplicationController.ts`  
**Method:** `createNotepadWindow()`  
**Line:** ~347  
**Current Setting:** `opacity: 0.5` (50% transparent)  
**Comment:** NOTEPAD WINDOW OPACITY SETTING

```typescript
// OPACITY SETTING: Change the value below (0.0 to 1.0) to adjust notepad window opacity
// 0.5 = 50% opacity (semi-transparent), 1.0 = fully opaque, 0.0 = fully transparent
opacity: 0.5  // Default 50% opacity for notepad window
```

### 4. Settings Window
**File:** `src/services/WindowManager.ts`  
**Method:** `createSettingsWindow()`  
**Line:** ~116  
**Current Setting:** `opacity: 1.0` (fully opaque)  
**Comment:** SETTINGS WINDOW OPACITY SETTING

```typescript
// SETTINGS WINDOW OPACITY SETTING: Change the value below (0.0 to 1.0) to adjust settings window opacity
// 1.0 = fully opaque (default for settings), 0.9 = 90% opacity, 0.8 = 80% opacity
opacity: 1.0  // Default fully opaque for settings window
```

### 5. WindowManager Main Window (Alternative Main Window)
**File:** `src/services/WindowManager.ts`  
**Method:** `createMainWindow()`  
**Line:** ~23  
**Current Setting:** `opacity: 1.0` (fully opaque)  
**Comment:** WINDOW MANAGER MAIN WINDOW OPACITY SETTING

```typescript
// WINDOW MANAGER MAIN WINDOW OPACITY SETTING: Change the value below (0.0 to 1.0) to adjust opacity
// 1.0 = fully opaque (default), 0.8 = 80% opacity, 0.5 = 50% opacity
opacity: 1.0  // Default fully opaque for WindowManager main window
```

### 6. WindowManager Session Window (Alternative Session Window)
**File:** `src/services/WindowManager.ts`  
**Method:** `createSessionWindow()`  
**Line:** ~59  
**Current Setting:** `opacity: 1.0` (fully opaque)  
**Comment:** WINDOW MANAGER SESSION WINDOW OPACITY SETTING

```typescript
// WINDOW MANAGER SESSION WINDOW OPACITY SETTING: Change the value below (0.0 to 1.0) to adjust opacity
// 1.0 = fully opaque (default), 0.9 = 90% opacity, 0.8 = 80% opacity
opacity: 1.0  // Default fully opaque for WindowManager session window
```

## Opacity Value Examples

- `opacity: 1.0` - Fully opaque (100% solid)
- `opacity: 0.9` - 90% opaque (slightly transparent)
- `opacity: 0.8` - 80% opaque (moderately transparent)
- `opacity: 0.5` - 50% opaque (semi-transparent) - **Default for notepad**
- `opacity: 0.3` - 30% opaque (highly transparent)
- `opacity: 0.1` - 10% opaque (barely visible)
- `opacity: 0.0` - Fully transparent (invisible)

## Recommended Settings by Use Case

### Professional Interview Setup
- **Main Window:** `1.0` (fully opaque for clear controls)
- **Session Window:** `1.0` (fully opaque for clear chat reading)
- **Notepad Window:** `0.5` (semi-transparent to see content behind)
- **Settings Window:** `1.0` (fully opaque for clear configuration)

### Stealth Mode Enhanced
- **Main Window:** `0.8` (slightly transparent)
- **Session Window:** `0.9` (mostly opaque but subtle)
- **Notepad Window:** `0.3` (highly transparent)
- **Settings Window:** `0.9` (mostly opaque for usability)

### Distraction-Free Mode
- **Main Window:** `0.6` (moderately transparent)
- **Session Window:** `1.0` (fully opaque for focus)
- **Notepad Window:** `0.4` (transparent but readable)
- **Settings Window:** `1.0` (fully opaque when needed)

## How to Modify

1. Open the relevant file listed above
2. Navigate to the specified method and line number
3. Find the `opacity:` setting
4. Change the value between 0.0 and 1.0
5. Save the file
6. Run `npm run build` to compile changes
7. Run `npm run dev` (development) or `npm run dist` (production build)

## Notes

- **Notepad window** defaults to 50% opacity (`0.5`) for optimal overlay functionality
- **All other windows** default to full opacity (`1.0`) for maximum usability
- Changes require rebuilding the application to take effect
- Opacity settings work on all supported platforms (macOS, Windows, Linux)
- Very low opacity values (< 0.2) may make windows difficult to interact with

## Troubleshooting

- If a window becomes too transparent to see, set opacity to `1.0`
- If windows seem "invisible", check that opacity is not set to `0.0`
- Remember to rebuild (`npm run build`) after making changes
- Test opacity changes in development mode (`npm run dev`) before building for distribution
