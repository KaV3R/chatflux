// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux: in-game voice overlay ("who is talking").
// A transparent, click-through, always-on-top window over the primary display. The renderer sends
// the call participants (name, avatar, speaking / muted / deafened) and the overlay settings; the
// window is only shown while a game is running, the user is in a call and ChatFlux itself is not
// focused. Works over windowed and borderless-fullscreen games (not exclusive fullscreen).

import {requirePrivilegedRendererDocumentSender} from '@electron/main/PrivilegedRendererDocuments';
import {app, BrowserWindow, ipcMain, screen, type WebContents} from 'electron';

const CHANNEL = 'chatflux-overlay:update';

export type ChatFluxOverlayPosition = 'top' | 'left' | 'right';

export interface ChatFluxOverlayParticipant {
	id: string;
	name: string;
	avatar: string | null;
	speaking: boolean;
	muted: boolean;
	deafened: boolean;
}

export interface ChatFluxOverlayState {
	visible: boolean;
	position: ChatFluxOverlayPosition;
	participants: Array<ChatFluxOverlayParticipant>;
}

let overlayWindow: BrowserWindow | null = null;
let overlayReady = false;
let lastState: ChatFluxOverlayState | null = null;
let ownerContents: WebContents | null = null;

function sanitizeState(raw: unknown): ChatFluxOverlayState | null {
	if (!raw || typeof raw !== 'object') return null;
	const value = raw as Record<string, unknown>;
	const position: ChatFluxOverlayPosition =
		value.position === 'left' || value.position === 'right' ? value.position : 'top';
	const participants: Array<ChatFluxOverlayParticipant> = [];
	if (Array.isArray(value.participants)) {
		for (const entry of value.participants.slice(0, 25)) {
			if (!entry || typeof entry !== 'object') continue;
			const p = entry as Record<string, unknown>;
			const avatar = typeof p.avatar === 'string' && /^https?:\/\//.test(p.avatar) ? p.avatar.slice(0, 2048) : null;
			participants.push({
				id: String(p.id ?? '').slice(0, 64),
				name: String(p.name ?? '').slice(0, 64),
				avatar,
				speaking: p.speaking === true,
				muted: p.muted === true,
				deafened: p.deafened === true,
			});
		}
	}
	return {visible: value.visible === true && participants.length > 0, position, participants};
}

function overlayBounds(): Electron.Rectangle {
	return screen.getPrimaryDisplay().bounds;
}

function createOverlayWindow(): BrowserWindow {
	const window = new BrowserWindow({
		...overlayBounds(),
		show: false,
		frame: false,
		transparent: true,
		backgroundColor: '#00000000',
		hasShadow: false,
		resizable: false,
		movable: false,
		minimizable: false,
		maximizable: false,
		fullscreenable: false,
		focusable: false,
		skipTaskbar: true,
		alwaysOnTop: true,
		webPreferences: {
			partition: 'chatflux-overlay',
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			spellcheck: false,
			backgroundThrottling: false,
		},
	});
	window.setIgnoreMouseEvents(true);
	window.setAlwaysOnTop(true, 'screen-saver');
	window.setVisibleOnAllWorkspaces(true, {visibleOnFullScreen: true});
	window.webContents.on('will-navigate', (event) => event.preventDefault());
	window.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
	window.webContents.on('did-finish-load', () => {
		overlayReady = true;
		pushState();
	});
	window.on('closed', () => {
		if (overlayWindow === window) {
			overlayWindow = null;
			overlayReady = false;
		}
	});
	overlayReady = false;
	void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(OVERLAY_HTML)}`);
	return window;
}

function pushState(): void {
	const window = overlayWindow;
	if (!window || window.isDestroyed() || !overlayReady || !lastState) return;
	void window.webContents.executeJavaScript(`window.__render(${JSON.stringify(lastState)})`).catch(() => {});
}

function applyState(state: ChatFluxOverlayState): void {
	lastState = state;
	if (!state.visible) {
		if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) overlayWindow.hide();
		pushState();
		return;
	}
	if (!overlayWindow || overlayWindow.isDestroyed()) overlayWindow = createOverlayWindow();
	const bounds = overlayBounds();
	const current = overlayWindow.getBounds();
	if (
		current.x !== bounds.x ||
		current.y !== bounds.y ||
		current.width !== bounds.width ||
		current.height !== bounds.height
	) {
		overlayWindow.setBounds(bounds);
	}
	pushState();
	if (!overlayWindow.isVisible()) {
		overlayWindow.showInactive();
		overlayWindow.setAlwaysOnTop(true, 'screen-saver');
	}
}

export function destroyChatFluxOverlay(): void {
	if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy();
	overlayWindow = null;
	overlayReady = false;
}

export function registerChatFluxOverlayIpc(): void {
	app.on('before-quit', destroyChatFluxOverlay);
	ipcMain.handle(CHANNEL, (event, raw: unknown) => {
		requirePrivilegedRendererDocumentSender(event, CHANNEL);
		if (ownerContents !== event.sender) {
			ownerContents = event.sender;
			// The app window closed: its call state is gone, so is the overlay.
			// Destroy (not just hide) on close, so the hidden overlay never keeps the app alive.
			event.sender.once('destroyed', () => {
				if (ownerContents === event.sender) ownerContents = null;
				lastState = null;
				destroyChatFluxOverlay();
			});
		}
		const state = sanitizeState(raw);
		if (state) applyState(state);
		return true;
	});
}

const OVERLAY_HTML = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;user-select:none;-webkit-user-select:none}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif}
#bar{position:absolute;display:none;gap:6px;padding:5px;border-radius:22px;background:rgba(10,12,16,.55)}
#bar.show{display:flex}
#bar.top{left:16px;top:16px;flex-direction:row;align-items:center}
#bar.left{left:16px;top:50%;transform:translateY(-50%);flex-direction:column;align-items:flex-start}
#bar.right{right:16px;top:50%;transform:translateY(-50%);flex-direction:column;align-items:flex-end}
.p{display:flex;flex-direction:row;align-items:center;border-radius:16px;background:transparent;opacity:.6;transition:background .25s,opacity .25s}
#bar.right .p{flex-direction:row-reverse}
.p.sp{background:rgba(91,228,155,.14);opacity:1}
.p.off{opacity:.45}
.av{position:relative;width:28px;height:28px;flex:none;border-radius:50%;box-shadow:0 0 0 2px rgba(255,255,255,.08);transition:box-shadow .15s;display:grid;place-items:center;font:700 12px 'Segoe UI',system-ui,sans-serif;color:#0b0d10;background-size:cover;background-position:center}
.p.sp .av{box-shadow:0 0 0 2px #5be49b,0 0 12px rgba(91,228,155,.55)}
.badge{position:absolute;right:-4px;bottom:-4px;width:15px;height:15px;border-radius:50%;background:#ff6b6b;border:2px solid #14181d;display:grid;place-items:center;box-sizing:border-box}
.nw{max-width:0;overflow:hidden;transition:max-width .3s ease;white-space:nowrap}
.p.sp .nw{max-width:180px}
.ni{display:flex;flex-direction:row;align-items:center;gap:6px;padding:0 10px 0 7px}
#bar.right .ni{flex-direction:row-reverse;padding:0 7px 0 10px}
.nm{font:600 13px 'Segoe UI',system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.bars{display:flex;align-items:center;gap:2px;height:14px}
.bars i{display:block;width:2px;height:3px;background:#5be49b;border-radius:1px}
.p.sp .bars i{animation:eq .9s ease-in-out infinite}
.bars i:nth-child(2){animation-delay:-.25s!important}
.bars i:nth-child(3){animation-delay:-.5s!important}
.bars i:nth-child(4){animation-delay:-.7s!important}
.bars i:nth-child(5){animation-delay:-.15s!important}
@keyframes eq{0%,100%{height:3px}50%{height:14px}}
</style></head>
<body><div id="bar"></div>
<script>
const MIC_OFF='<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#14181d" stroke-width="3.5" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M3 3l18 18"></path></svg>';
const DEAF='<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#14181d" stroke-width="3.5" stroke-linecap="round"><path d="M4 16v-4a8 8 0 0 1 16 0v4"></path><path d="M3 3l18 18"></path></svg>';
const bar=document.getElementById('bar');
const rows=new Map();
function hue(id){let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))>>>0;return h%360;}
function initial(name){const c=Array.from((name||'?').trim())[0]||'?';return c.toUpperCase();}
function makeRow(p){
  const row=document.createElement('div');row.className='p';
  const av=document.createElement('div');av.className='av';
  const nw=document.createElement('div');nw.className='nw';
  const ni=document.createElement('div');ni.className='ni';
  const nm=document.createElement('span');nm.className='nm';
  const bars=document.createElement('div');bars.className='bars';
  for(let i=0;i<5;i++)bars.appendChild(document.createElement('i'));
  ni.append(nm,bars);nw.appendChild(ni);row.append(av,nw);
  return {row,av,nm,avatar:undefined,badge:undefined};
}
window.__render=function(state){
  bar.className=(state.visible?'show ':'')+state.position;
  const seen=new Set();
  state.participants.forEach(function(p,index){
    seen.add(p.id);
    let r=rows.get(p.id);
    if(!r){r=makeRow(p);rows.set(p.id,r);}
    if(bar.children[index]!==r.row)bar.insertBefore(r.row,bar.children[index]||null);
    const off=p.muted||p.deafened;
    r.row.className='p'+(p.speaking&&!off?' sp':'')+(off?' off':'');
    r.nm.textContent=p.name;
    if(r.avatar!==p.avatar){
      r.avatar=p.avatar;
      for(const n of Array.from(r.av.childNodes)){if(n.nodeType===3)n.remove();}
      r.av.style.backgroundColor='hsl('+hue(p.id)+',55%,70%)';
      if(p.avatar){r.av.style.backgroundImage='url("'+p.avatar.replace(/"/g,'%22')+'")';}
      else{r.av.style.backgroundImage='';r.av.insertBefore(document.createTextNode(initial(p.name)),r.av.firstChild);}
    }
    const badge=p.deafened?'deaf':p.muted?'mute':'';
    if(r.badge!==badge){
      r.badge=badge;
      const old=r.av.querySelector('.badge');if(old)old.remove();
      if(badge){const b=document.createElement('div');b.className='badge';b.innerHTML=badge==='deaf'?DEAF:MIC_OFF;r.av.appendChild(b);}
    }
  });
  for(const [id,r] of rows){if(!seen.has(id)){r.row.remove();rows.delete(id);}}
};
</script></body></html>`;
