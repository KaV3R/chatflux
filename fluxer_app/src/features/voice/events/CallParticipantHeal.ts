// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux: in a DM call the call view lists people from gateway voice states only. Sometimes
// a remote voice state goes missing while the media connection is fine (you still hear them),
// so they vanish from the call view. This checks every few seconds: anyone connected to the
// call's media room without a voice state gets one back. Once the gateway sends the real
// state it replaces ours, because both use the same connection id.

import type {VoiceState} from '@app/features/gateway/types/GatewayVoiceTypes';
import {Logger} from '@app/features/platform/utils/AppLogger';
import MediaEngine from '@app/features/voice/engine/MediaEngineFacade';
import CallState from '@app/features/voice/state/CallState';
import {ME} from '@fluxer/constants/src/AppConstants';

const logger = new Logger('CallParticipantHeal');
const CHECK_MS = 3000;

/** connectionId -> channelId of voice states we filled in, and how many checks they were missing from media. */
const healed = new Map<string, {channelId: string; userId: string; missing: number}>();
/** DM channels whose call we put back ourselves. */
const restoredCalls = new Set<string>();
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

/**
 * Sometimes the call itself goes missing (e.g. a CALL_DELETE arrives when someone stops a
 * screen share) while we are still talking in its media room. Then the call view and the
 * "in a call" line disappear. Put a call back while someone else is still in the room.
 */
function maybeRestoreCall(channelId: string): void {
	if (CallState.getCall(channelId)) return;
	const someoneElseInMedia = Object.values(MediaEngine.participants).some(
		(participant) => !participant.isLocal && participant.userId,
	);
	if (!someoneElseInMedia) return;
	logger.warn('Call missing while still connected to its media room, restoring it', {channelId});
	restoredCalls.add(channelId);
	CallState.handleCallCreate({channelId, call: {channel_id: channelId, ringing: []}});
}

function check(): void {
	const channelId = MediaEngine.channelId;
	const inDmCall =
		MediaEngine.connected && channelId != null && (MediaEngine.guildId == null || MediaEngine.guildId === ME);
	for (const restoredChannelId of [...restoredCalls]) {
		if (inDmCall && restoredChannelId === channelId) continue;
		restoredCalls.delete(restoredChannelId);
		// Only drop our placeholder, not a call the gateway has since sent for real.
		if (CallState.getCall(restoredChannelId)?.messageId == null) {
			CallState.handleCallDelete({channelId: restoredChannelId});
		}
	}
	if (!inDmCall) {
		for (const connectionId of [...healed.keys()]) removeHealed(connectionId);
		return;
	}
	maybeRestoreCall(channelId);
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
