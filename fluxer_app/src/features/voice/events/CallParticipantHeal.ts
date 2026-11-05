// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux: in a DM call the call view lists people from gateway voice states only. Sometimes
// a remote voice state goes missing while the media connection is fine (you still hear them),
// so they vanish from the call view. This checks every few seconds: anyone connected to the
// call's media room without a voice state gets one back. Once the gateway sends the real
// state it replaces ours, because both use the same connection id.

import type {VoiceState} from '@app/features/gateway/types/GatewayVoiceTypes';
import {Logger} from '@app/features/platform/utils/AppLogger';
import MediaEngine from '@app/features/voice/engine/MediaEngineFacade';
import {ME} from '@fluxer/constants/src/AppConstants';

const logger = new Logger('CallParticipantHeal');
const CHECK_MS = 3000;

/** connectionId -> channelId of voice states we filled in, and how many checks they were missing from media. */
const healed = new Map<string, {channelId: string; userId: string; missing: number}>();
let timer: ReturnType<typeof setInterval> | null = null;

function removeHealed(connectionId: string): void {
	const entry = healed.get(connectionId);
	healed.delete(connectionId);
	if (!entry) return;
	const current = MediaEngine.getVoiceStateByConnectionId(connectionId);
	// Only remove what is still ours (not replaced by a gateway update for another channel).
	if (current && current.channel_id !== entry.channelId) return;
	MediaEngine.handleGatewayVoiceStateUpdate(null, {
		user_id: entry.userId,
		connection_id: connectionId,
		channel_id: null,
		guild_id: null,
	} as unknown as VoiceState);
}

function check(): void {
	const channelId = MediaEngine.channelId;
	const inDmCall =
		MediaEngine.connected && channelId != null && (MediaEngine.guildId == null || MediaEngine.guildId === ME);
	if (!inDmCall) {
		for (const connectionId of [...healed.keys()]) removeHealed(connectionId);
		return;
	}
	const states = MediaEngine.getAllVoiceStatesInChannel(ME, channelId);
	const usersWithState = new Set(Object.values(states).map((state) => state.user_id));
	const inMedia = new Set<string>();
	for (const participant of Object.values(MediaEngine.participants)) {
		if (participant.isLocal || !participant.userId || !participant.connectionId) continue;
		inMedia.add(participant.connectionId);
		if (states[participant.connectionId] || usersWithState.has(participant.userId)) continue;
		logger.warn('Voice state missing for a connected call participant, restoring it', {
			userId: participant.userId,
			connectionId: participant.connectionId,
			channelId,
		});
		healed.set(participant.connectionId, {channelId, userId: participant.userId, missing: 0});
		MediaEngine.handleGatewayVoiceStateUpdate(null, {
			user_id: participant.userId,
			connection_id: participant.connectionId,
			channel_id: channelId,
			guild_id: null,
			mute: false,
			deaf: false,
			self_mute: !participant.isMicrophoneEnabled,
			self_deaf: false,
			self_video: participant.isCameraEnabled,
			self_stream: participant.isScreenShareEnabled,
		} as unknown as VoiceState);
		usersWithState.add(participant.userId);
	}
	for (const [connectionId, entry] of healed) {
		if (entry.channelId !== channelId) {
			removeHealed(connectionId);
			continue;
		}
		if (inMedia.has(connectionId)) {
			entry.missing = 0;
			continue;
		}
		// Gone from the media room for two checks in a row: they left.
		entry.missing += 1;
		if (entry.missing >= 2) removeHealed(connectionId);
	}
}

export function startCallParticipantHeal(): void {
	if (timer != null) return;
	timer = setInterval(() => {
		try {
			check();
		} catch (error) {
			logger.warn('Call participant check failed', {error});
		}
	}, CHECK_MS);
}
