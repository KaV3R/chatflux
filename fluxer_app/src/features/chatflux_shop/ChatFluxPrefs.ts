// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux-only preferences, kept on this device.

import {makeAutoObservable} from 'mobx';

const STORAGE_KEY = 'chatflux.prefs.v1';

interface StoredPrefs {
	animateProfiles?: boolean;
	userAreaNameStyle?: boolean;
}

function read(): StoredPrefs {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as StoredPrefs) : {};
	} catch {
		return {};
	}
}

class ChatFluxPrefs {
	/** Animated (GIF) avatars and banners play all the time, not only on hover. */
	animateProfiles: boolean;
	/** Show the worn display name style in the bottom-left user panel. */
	userAreaNameStyle: boolean;

	constructor() {
		const stored = read();
		this.animateProfiles = stored.animateProfiles ?? true;
		this.userAreaNameStyle = stored.userAreaNameStyle ?? true;
		makeAutoObservable(this, {}, {autoBind: true});
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
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
		} catch {}
	}
}

export default new ChatFluxPrefs();
