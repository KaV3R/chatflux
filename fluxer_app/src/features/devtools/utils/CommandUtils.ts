// SPDX-License-Identifier: AGPL-3.0-or-later

import Authentication from '@app/features/auth/state/Authentication';
import * as PrivateChannelCommands from '@app/features/channel/commands/PrivateChannelCommands';
import * as GuildCommands from '@app/features/guild/commands/GuildCommands';
import * as GuildMemberCommands from '@app/features/member/commands/GuildMemberCommands';
import GuildMembers from '@app/features/member/state/GuildMembers';
import * as MessageCommands from '@app/features/messaging/commands/MessageCommands';
import {Message} from '@app/features/messaging/models/MessagingMessage';
import {
	BAN_DELETE_MESSAGE_SECONDS_CHOICE_VALUES,
	DEFAULT_BAN_DELETE_MESSAGE_SECONDS,
} from '@app/features/moderation/constants/BanDeleteMessageOptions';
import {Logger} from '@app/features/platform/utils/AppLogger';
import {User} from '@app/features/user/models/User';
import Users from '@app/features/user/state/Users';
import * as NicknameUtils from '@app/features/user/utils/NicknameUtils';
import {FLUXERBOT_ID} from '@fluxer/constants/src/AppConstants';
import {MessageStates, MessageTypes} from '@fluxer/constants/src/ChannelConstants';
import * as SnowflakeUtils from '@fluxer/snowflake/src/SnowflakeUtils';
import type {I18n} from '@lingui/core';

const USER_MENTION_REGEX = /<@!?(\d+)>/;
const logger = new Logger('CommandUtils');

export type ParsedCommand =
	| {
			type: 'nick';
			nickname: string;
	  }
	| {
			type: 'kick';
			userId: string;
			reason?: string;
	  }
	| {
			type: 'ban';
			userId: string;
			deleteMessageSeconds: number;
			duration: number;
			reason?: string;
	  }
	| {
			type: 'msg';
			userId: string;
			message: string;
	  }
	| {
			type: 'me';
			content: string;
	  }
	| {
			type: 'spoiler';
			content: string;
	  }
	| {
			type: 'tts';
			content: string;
	  }
	| {
			type: 'saved' | 'sticker' | 'gif';
			query: string;
	  }
	| {
			type: 'unknown';
	  };

export function parseCommand(content: string): ParsedCommand {
	const trimmed = content.trim();
	if (trimmed === '/nick') {
		return {type: 'nick', nickname: ''};
	}
	if (trimmed.startsWith('/nick ')) {
		const nickname = trimmed.slice(6).trim();
		return {type: 'nick', nickname};
	}
	if (trimmed.startsWith('/kick ')) {
		const rest = trimmed.slice(6).trim();
		const userMatch = rest.match(USER_MENTION_REGEX);
		if (!userMatch) {
			return {type: 'unknown'};
		}
		const userId = userMatch[1];
		const afterMention = rest.slice(userMatch[0].length).trim();
		const reason = afterMention || undefined;
		return {type: 'kick', userId, reason};
	}
	if (trimmed.startsWith('/ban ')) {
		const rest = trimmed.slice(5).trim();
		const userMatch = rest.match(USER_MENTION_REGEX);
		if (!userMatch) {
			return {type: 'unknown'};
		}
		const userId = userMatch[1];
		const afterMention = rest.slice(userMatch[0].length).trim();
		const parts = afterMention.length === 0 ? [] : afterMention.split(/\s+/);
		let deleteMessageSeconds = DEFAULT_BAN_DELETE_MESSAGE_SECONDS;
		let reasonStart = 0;
		const firstPart = parts[0];
		if (firstPart !== undefined && BAN_DELETE_MESSAGE_SECONDS_CHOICE_VALUES.has(firstPart)) {
			deleteMessageSeconds = Number(firstPart);
			reasonStart = 1;
		} else if (firstPart !== undefined && /^\d+$/.test(firstPart)) {
			return {type: 'unknown'};
		}
		const duration = 0;
		const reasonParts = parts.slice(reasonStart);
		const reasonText = reasonParts.join(' ').trim();
		const reason = reasonText || undefined;
		return {type: 'ban', userId, deleteMessageSeconds, duration, reason};
	}
	if (trimmed.startsWith('/msg ')) {
		const rest = trimmed.slice(5).trim();
		const userMatch = rest.match(USER_MENTION_REGEX);
		if (!userMatch) {
			return {type: 'unknown'};
		}
		const userId = userMatch[1];
		const message = rest.slice(userMatch[0].length).trim();
		if (!message) {
			return {type: 'unknown'};
		}
		return {type: 'msg', userId, message};
	}
	if (trimmed.startsWith('/me ')) {
		const content = trimmed.slice(4).trim();
		if (!content) {
			return {type: 'unknown'};
		}
		return {type: 'me', content};
	}
	if (trimmed.startsWith('/spoiler ')) {
		const content = trimmed.slice(9).trim();
		if (!content) {
			return {type: 'unknown'};
		}
		return {type: 'spoiler', content};
	}
	if (trimmed.startsWith('/tts ')) {
		const content = trimmed.slice(5).trim();
		if (!content) {
			return {type: 'unknown'};
		}
		return {type: 'tts', content};
	}
	for (const type of ['saved', 'sticker', 'gif'] as const) {
		const prefix = `/${type}`;
		if (trimmed === prefix || trimmed.startsWith(`${prefix} `)) {
			const query = trimmed.slice(prefix.length).trim();
			return {type, query};
		}
	}
	return {type: 'unknown'};
}

export function transformWrappingCommands(content: string): string {
	const trimmed = content.trim();
	if (trimmed.startsWith('/me ')) {
		const messageContent = trimmed.slice(4).trim();
		if (messageContent) {
			return `_${messageContent}_`;
		}
	}
	if (trimmed.startsWith('/spoiler ')) {
		const messageContent = trimmed.slice(9).trim();
		if (messageContent) {
			return `||${messageContent}||`;
		}
	}
	return content;
}

export function isCommand(content: string): boolean {
	const trimmed = content.trim();
	return (
		trimmed === '/nick' ||
		trimmed.startsWith('/nick ') ||
		trimmed.startsWith('/kick ') ||
		trimmed.startsWith('/ban ') ||
		trimmed.startsWith('/msg ') ||
		trimmed.startsWith('/me ') ||
		trimmed.startsWith('/spoiler ') ||
		trimmed.startsWith('/tts ') ||
		trimmed === '/saved' ||
		trimmed.startsWith('/saved ') ||
		trimmed === '/sticker' ||
		trimmed.startsWith('/sticker ') ||
		trimmed === '/gif' ||
		trimmed.startsWith('/gif ') ||
		(trimmed.startsWith('_') && trimmed.endsWith('_') && trimmed.length > 2)
	);
}

export function doesCommandSendCurrentChannelMessage(command: ParsedCommand): boolean {
	return command.type === 'me' || command.type === 'spoiler' || command.type === 'tts' || command.type === 'unknown';
}

export function createSystemMessage(channelId: string, content: string): Message {
	const fluxerbotUser = new User({
		id: FLUXERBOT_ID,
		username: 'Fluxerbot',
		discriminator: '0000',
		global_name: null,
		avatar: null,
		avatar_color: null,
		bot: true,
		system: true,
		flags: 0,
	});
	const nonce = SnowflakeUtils.fromTimestamp(Date.now());
	return new Message({
		id: nonce,
		channel_id: channelId,
		author: fluxerbotUser.toJSON(),
		type: MessageTypes.CLIENT_SYSTEM,
		flags: 0,
		pinned: false,
		mention_everyone: false,
		content,
		timestamp: new Date().toISOString(),
		state: MessageStates.SENT,
		nonce,
		attachments: [],
	});
}

function updateCurrentUserNickname(guildId: string, nickname: string | null): void {
	const currentUserId = Authentication.currentUserId;
	const currentMember = GuildMembers.getMember(guildId, currentUserId);
	if (!currentMember) return;
	GuildMembers.handleMemberAdd(guildId, {
		...currentMember.toJSON(),
		nick: nickname,
	});
}

export async function executeCommand(
	command: ParsedCommand,
	channelId: string,
	guildId: string | undefined,
	_i18n: I18n,
): Promise<void> {
	switch (command.type) {
		case 'nick': {
			if (!guildId) {
				throw new Error('Cannot change nickname outside of a guild');
			}
			// ChatFlux: just change the nickname, don't post anything to the chat.
			await GuildMemberCommands.updateProfile(guildId, {
				nick: command.nickname || null,
			});
			updateCurrentUserNickname(guildId, command.nickname || null);
			break;
		}
		case 'kick': {
			if (!guildId) {
				throw new Error('Cannot kick members outside of a guild');
			}
			await GuildMemberCommands.kick(guildId, command.userId, command.reason);
			break;
		}
		case 'ban': {
			if (!guildId) {
				throw new Error('Cannot ban members outside of a guild');
			}
			await GuildCommands.banMember(
				guildId,
				command.userId,
				command.deleteMessageSeconds,
				command.reason,
				command.duration,
			);
			break;
		}
		case 'msg': {
			let dmChannelId: string;
			try {
				dmChannelId = await PrivateChannelCommands.ensureDMChannel(command.userId);
			} catch {
				const user = Users.getUser(command.userId);
				const username = user ? NicknameUtils.getDisplayName(user) : command.userId;
				const systemMessage = createSystemMessage(
					channelId,
					`Failed to send a message to **${username}**. They may have DMs disabled or you may be blocked.`,
				);
				MessageCommands.createOptimistic(channelId, systemMessage.toJSON());
				break;
			}
			try {
				const result = await MessageCommands.send(dmChannelId, {
					content: command.message,
					nonce: SnowflakeUtils.fromTimestamp(Date.now()),
					hasAttachments: false,
					flags: 0,
				});
				if (result) {
					await PrivateChannelCommands.openDMChannel(command.userId);
				}
			} catch (error) {
				logger.error('Failed to dispatch /msg command DM', error);
			}
			break;
		}
		case 'me': {
			break;
		}
		case 'spoiler': {
			break;
		}
		case 'saved':
		case 'sticker':
		case 'gif': {
			throw new Error(`Select a ${command.type} result before submitting the command`);
		}
		default:
			break;
	}
}
