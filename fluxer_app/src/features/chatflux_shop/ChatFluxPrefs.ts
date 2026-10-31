// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux-only preferences, kept on this device.

import {makeAutoObservable} from 'mobx';

const STORAGE_KEY = 'chatflux.prefs.v1';

interface StoredPrefs {
	animateProfiles?: boolean;
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
	animateProfiles = read().animateProfiles ?? true;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	setAnimateProfiles(value: boolean): void {
		this.animateProfiles = value;
		this.persist();
	}

	private persist(): void {
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({animateProfiles: this.animateProfiles}));
		} catch {}
	}
}

export default new ChatFluxPrefs();
