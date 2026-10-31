// SPDX-License-Identifier: AGPL-3.0-or-later

import Updater from '@app/features/app/state/Updater';
import {openAccountSwitcherModal} from '@app/features/auth/commands/AccountSwitcherModalCommands';
import Authentication from '@app/features/auth/state/Authentication';
import {switchToSavedAccount} from '@app/features/auth/utils/AccountSwitcherModalUtils';
import Channels from '@app/features/channel/state/Channels';
import * as VoiceStateCommands from '@app/features/devtools/commands/VoiceStateCommands';
import {Logger} from '@app/features/platform/utils/AppLogger';
import {formatClientBuildInfo, getClientInfo, getClientInfoSync} from '@app/features/platform/utils/ClientInfo';
import Presence from '@app/features/presence/state/Presence';
import StreamerMode from '@app/features/streamer_mode/state/StreamerMode';
import * as ThemeSettingsCommands from '@app/features/theme_settings/commands/ThemeSettingsCommands';
import ThemeSettingsState from '@app/features/theme_settings/state/ThemeSettingsState';
import {getElectronAPI, isDesktop} from '@app/features/ui/utils/NativeUtils';
import UserSettings from '@app/features/user/state/UserSettings';
import MediaEngine from '@app/features/voice/engine/MediaEngineFacade';
import {
	isVoiceEngineV2AppParticipantSpeaking,
	selectVoiceEngineV2AppConnectionWithFallback,
	selectVoiceEngineV2AppParticipants,
} from '@app/features/voice/engine/v2/VoiceEngineV2AppSelectors';
import LocalVoiceState from '@app/features/voice/state/LocalVoiceState';
import {type StatusType, StatusTypes} from '@fluxer/constants/src/StatusConstants';
import {reaction} from 'mobx';

const logger = new Logger('DesktopTrayBridge');

function resolvePresenceStatus(): StatusType {
	const userId = Authentication.currentUserId;
	if (userId) {
		return Presence.getStatus(userId);
	}
	return UserSettings.status;
}

function resolveVoiceChannelLabel(channelId: string | null): string | null {
	if (!channelId) return null;
	const channel = Channels.getChannel(channelId);
	return channel?.name ?? null;
}

function toTrayStatus(status: StatusType): 'online' | 'idle' | 'dnd' | 'invisible' | null {
	switch (status) {
		case StatusTypes.ONLINE:
		case StatusTypes.IDLE:
		case StatusTypes.DND:
		case StatusTypes.INVISIBLE:
			return status;
		default:
			return null;
	}
}

function resolveVoiceConnectionProjection() {
	const context = MediaEngine.connectionContext;
	return selectVoiceEngineV2AppConnectionWithFallback(MediaEngine.voiceEngineV2Model, {
		connected: context.connected,
		connecting: context.connecting,
		reconnecting: context.reconnecting,
		guildId: context.guildId,
		channelId: context.channelId,
		sessionId: context.connectionId,
	});
}

/** ChatFlux: is the local user talking right now (drives the green tray icon). */
function resolveLocalSpeaking(connected: boolean): boolean {
	if (!connected || LocalVoiceState.getSelfMute() || LocalVoiceState.getSelfDeaf()) return false;
	const model = MediaEngine.voiceEngineV2Model;
	if (!model) return false;
	const local = selectVoiceEngineV2AppParticipants(model).participants.find((participant) => participant.isLocal);
	return isVoiceEngineV2AppParticipantSpeaking(local);
}

export function initializeDesktopTrayBridge(): (() => void) | null {
	if (!isDesktop()) return null;
	const electronApi = getElectronAPI();
	if (!electronApi?.setTrayRuntimeState || !electronApi.onTrayAction) return null;
	const pushState = () => {
		const voiceConnection = resolveVoiceConnectionProjection();
		const channelId = voiceConnection.channelId;
		electronApi.setTrayRuntimeState?.({
			voiceConnected: voiceConnection.connected,
			voiceChannelLabel: resolveVoiceChannelLabel(channelId),
			selfMute: LocalVoiceState.getSelfMute(),
			selfDeaf: LocalVoiceState.getSelfDeaf(),
			presenceStatus: toTrayStatus(resolvePresenceStatus()),
			hidePersonalInformation: StreamerMode.shouldHidePersonalInformation,
			customCssOff: ThemeSettingsState.customCssOff,
		});
	};
	// Speaking flips many times a second, so it gets its own small reaction instead of
	// rebuilding the whole tray state (and menu) every time.
	const disposeSpeakingReaction = reaction(
		() => resolveLocalSpeaking(resolveVoiceConnectionProjection().connected),
		(speaking) => electronApi.setTrayRuntimeState?.({speaking}),
		{fireImmediately: true, name: 'DesktopTrayBridge-speaking'},
	);
	void getClientInfo()
		.then((info) => {
			electronApi.setTrayRuntimeState?.({buildInfo: formatClientBuildInfo(info)});
		})
		.catch((error) => {
			logger.warn('Failed to resolve client info for tray; falling back to sync', error);
			electronApi.setTrayRuntimeState?.({buildInfo: formatClientBuildInfo(getClientInfoSync())});
		});
	const disposeReaction = reaction(
		() => {
			const voiceConnection = resolveVoiceConnectionProjection();
			return {
				mediaEngineVersion: MediaEngine.getMobxSnapshot(),
				connected: voiceConnection.connected,
				channelId: voiceConnection.channelId,
				selfMute: LocalVoiceState.getSelfMute(),
				selfDeaf: LocalVoiceState.getSelfDeaf(),
				status: resolvePresenceStatus(),
				hidePersonalInformation: StreamerMode.shouldHidePersonalInformation,
				customCssOff: ThemeSettingsState.customCssOff,
			};
		},
		pushState,
		{fireImmediately: true, name: 'DesktopTrayBridge-state'},
	);
	const disposeTrayAction = electronApi.onTrayAction((payload) => {
		switch (payload.action) {
			case 'set-status': {
				void UserSettings.setStatus(payload.status);
				break;
			}
			case 'toggle-mute': {
				void VoiceStateCommands.toggleSelfMute();
				break;
			}
			case 'toggle-deafen': {
				void VoiceStateCommands.toggleSelfDeaf();
				break;
			}
			case 'disconnect-voice': {
				void MediaEngine.disconnectFromVoiceChannel('user');
				break;
			}
			case 'check-for-updates': {
				void Updater.checkForUpdates(true, true);
				break;
			}
			case 'switch-account': {
				void switchToSavedAccount({accountKey: payload.accountKey});
				break;
			}
			case 'open-account-switcher': {
				openAccountSwitcherModal();
				break;
			}
			case 'toggle-custom-css': {
				ThemeSettingsCommands.toggleCustomCss();
				break;
			}
		}
	});
	return () => {
		disposeReaction();
		disposeSpeakingReaction();
		disposeTrayAction?.();
	};
}
