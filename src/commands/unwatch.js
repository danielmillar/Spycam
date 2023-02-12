const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const User = require('../models/User');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unwatch')
		.setDescription('Stop getting game updates for a Summoner')
		.addStringOption(option => option.setName('summoner').setDescription('The summoner to unwatch').setRequired(true))
		.addStringOption(option => option.setName('region').setDescription('The region of the summoner').setRequired(true).addChoices(
			{ name: 'BR', value: 'br1' },
			{ name: 'EUNE', value: 'eun1' },
			{ name: 'EUW', value: 'euw1' },
			{ name: 'JP', value: 'jp1' },
			{ name: 'KR', value: 'kr' },
			{ name: 'LAN', value: 'la1' },
			{ name: 'LAS', value: 'la2' },
			{ name: 'NA', value: 'na1' },
			{ name: 'OCE', value: 'oc1' },
			{ name: 'TR', value: 'tr1' },
			{ name: 'RU', value: 'ru' },
		))
		.addChannelOption(option => option.setName('channel').setDescription('The channel to unwatch').setRequired(true)),
	async execute(interaction) {
		const summoner = interaction.options.getString('summoner');
		const region = interaction.options.getString('region');
		const guildID = interaction.guild.id;
		const channelID = interaction.options.getChannel('channel').id;

		await interaction.reply({ content: `Check if the summoner ${summoner} exists in database`, ephemeral: true });

		//SECTION - Check if user already exists in database
		const user = await User.findOne({ summonerName: summoner, region: region});

		if (!user) {
			await interaction.editReply({ content: `Summoner ${summoner} does not exist in database`, ephemeral: true });
			return;
		}

		const channels = user.channels;
		const channelIndex = channels.findIndex(channel => channel.guildID === guildID && channel.channelID === channelID);

		if (channelIndex === -1) {
			await interaction.editReply({ content: `Summoner ${summoner} is not being watched in this channel`, ephemeral: true });
			return;
		}

		channels.splice(channelIndex, 1);

		await user.save();

		await interaction.editReply({ content: `Summoner ${summoner} is no longer being watched in this channel`, ephemeral: true });
	},
};