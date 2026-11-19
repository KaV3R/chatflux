// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux: settings of the in-game voice overlay (desktop app only). Stored per device.

import {getProtectedLocalStorage} from '@app/features/platform/state/ProtectedWebStorage';
import {getElectronAPI} from '@app/features/ui/utils/NativeUtils';
import {makeAutoObservable} from 'mobx';

export type OverlayPosition = 'top' | 'left' | 'right';

const STORAGE_KEY = 'chatflux.overlay.settings';

interface StoredSettings {
	enabled?: boolean;
	showSelf?: boolean;
	position?: OverlayPosition;
}

function read(): StoredSettings {
	try {
		const raw = getProtectedLocalStorage()?.getItem(STORAGE_KEY) ?? null;
		return raw ? (JSON.parse(raw) as StoredSettings) : {};
	} catch {
		return {};
	}
}

class OverlaySettings {
	enabled: boolean;
	showSelf: boolean;
	position: OverlayPosition;

	constructor() {
		const stored = read();
		this.enabled = stored.enabled ?? true;
		this.showSelf = stored.showSelf ?? true;
		this.position = stored.position === 'left' || stored.position === 'right' ? stored.position : 'top';
		makeAutoObservable(this, {}, {autoBind: true});
	}

	/** The overlay needs the desktop app (it opens its own window over the game). */
	get supported(): boolean {
		return typeof getElectronAPI()?.chatfluxOverlayUpdate === 'function';
	}

	setEnabled(value: boolean): void {
		this.enabled = value;
		this.persist();
	}

	setShowSelf(value: boolean): void {
		this.showSelf = value;
		this.persist();
	}

	setPosition(value: OverlayPosition): void {
		this.position = value;
		this.persist();
	}

	private persist(): void {
		try {
			getProtectedLocalStorage()?.setItem(
				STORAGE_KEY,
				JSON.stringify({enabled: this.enabled, showSelf: this.showSelf, position: this.position}),
			);
		} catch {}
	}
}

export default new OverlaySettings();
