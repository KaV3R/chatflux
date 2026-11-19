// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux-only preferences, kept on this device.
// Production builds remove window.localStorage, so this must go through the protected handle
// (otherwise nothing is saved and every switch jumps back to its default).

import {getProtectedLocalStorage} from '@app/features/platform/state/ProtectedWebStorage';
import {autorun, makeAutoObservable} from 'mobx';

const STORAGE_KEY = 'chatflux.prefs.v1';
/** On <html> while profile animations are off: shop cosmetics stand still too. */
export const STILL_COSMETICS_CLASS = 'chatflux-still-cosmetics';

interface StoredPrefs {
	animateProfiles?: boolean;
	userAreaNameStyle?: boolean;
}

function read(): StoredPrefs {
	try {
		const raw = getProtectedLocalStorage()?.getItem(STORAGE_KEY) ?? null;
		return raw ? (JSON.parse(raw) as StoredPrefs) : {};
	} catch {
		return {};
	}
}

class ChatFluxPrefs {
	/** Animated (GIF) avatars, banners and shop cosmetics play all the time, not only on hover. */
	animateProfiles: boolean;
	/** Show the worn display name style in the bottom-left user panel. */
	userAreaNameStyle: boolean;

	constructor() {
		const stored = read();
		this.animateProfiles = stored.animateProfiles ?? true;
		this.userAreaNameStyle = stored.userAreaNameStyle ?? true;
		makeAutoObservable(this, {}, {autoBind: true});
		if (typeof document !== 'undefined') {
			autorun(() => {
				document.documentElement.classList.toggle(STILL_COSMETICS_CLASS, !this.animateProfiles);
			});
		}
	}

	setAnimateProfiles(value: boolean): void {
		this.animateProfiles = value;
		this.persist();
	}

	setUserAreaNameStyle(value: boolean): void {
		this.userAreaNameStyle = value;
		this.persist();
	}

	private persist(): void {
		const prefs: StoredPrefs = {animateProfiles: this.animateProfiles, userAreaNameStyle: this.userAreaNameStyle};
		try {
			getProtectedLocalStorage()?.setItem(STORAGE_KEY, JSON.stringify(prefs));
		} catch {}
	}
}

export default new ChatFluxPrefs();
