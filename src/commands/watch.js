const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const User = require('../models/User');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('watch')
		.setDescription('Get game updates for a Summoner')
		.addStringOption(option => option.setName('summoner').setDescription('The summoner to watch').setRequired(true))
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
		.addChannelOption(option => option.setName('channel').setDescription('The channel to send updates to').setRequired(true)),
	async execute(interaction) {
		const summoner = interaction.options.getString('summoner');
		const region = interaction.options.getString('region');
		const guildID = interaction.guild.id;
		const channelID = interaction.options.getChannel('channel').id;

		await interaction.reply({ content: `Check if the summoner ${summoner} exists...`, ephemeral: true });

		let tftSummonerData;
		let lolSummonerData;

		//SECTION - Get summoner data from Riot API
		tftSummonerData = await axios.get(`https://${region}.api.riotgames.com/tft/summoner/v1/summoners/by-name/${summoner}`, {
			headers: {
				'X-Riot-Token': process.env.TFT_API_KEY || process.env.DEV_API_KEY
			}
		}).then(response => {
			return response.data;
		}).catch(error => {
			console.log('[ERROR] Failed to get summoner data from Riot API', error);

			if (error.response.status === 404) {
				return interaction.editReply({ content: `The summoner ${summoner} does not exist. Please double check summoner name and region!`, ephemeral: true });
			} else {
				return interaction.editReply({ content: `Failed to get summoner data from Riot API.`, ephemeral: true });
			}
		});

		tftSummonerData = await axios.get(`https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${summoner}`, {
			headers: {
				'X-Riot-Token': process.env.LOL_API_KEY || process.env.DEV_API_KEY
			}
		}).then(response => {
			return response.data;
		}).catch(error => {
			console.log('[ERROR] Failed to get summoner data from Riot API', error);

			if (error.response.status === 404) {
				return interaction.editReply({ content: `The summoner ${summoner} does not exist. Please double check summoner name and region!`, ephemeral: true });
			} else {
				return interaction.editReply({ content: `Failed to get summoner data from Riot API.`, ephemeral: true });
			}
		});
		//!SECTION

		await new Promise(resolve => setTimeout(resolve, 1000));

		//SECTION - Check if user already exists in database
		await interaction.editReply({ content: `Check if you're already watching ${summoner}...`, ephemeral: true });

		const user = await User.findOne({ summonerName: summoner, region: region });
		
		if (user) {
			const isWatching = user.channels.some(channel => channel.guildID === guildID && channel.channelID === channelID);

			if (isWatching) {
				return interaction.editReply({ content: `You are already watching ${summoner} in this channel.`, ephemeral: true });
			}
		}
		//!SECTION

		await new Promise(resolve => setTimeout(resolve, 1000));

		//SECTION - Verify users last played matches
		await interaction.editReply({ content: `Verifying last played matches...`, ephemeral: true });

		const playerUUID = tftSummonerData.puuid;
		let routing;

		switch(region) {
			case 'br1':
				routing = 'americas';
				break;
			case 'eun1':
				routing = 'europe';
				break;
			case 'euw1':
				routing = 'europe';
				break;
			case 'jp1':
				routing = 'asia';
				break;
			case 'kr':
				routing = 'asia';
				break;
			case 'la1':
				routing = 'americas';
				break;
			case 'la2':
				routing = 'americas';
				break;
			case 'na1':
				routing = 'americas';
				break;
			case 'oc1':
				routing = 'americas';
				break;
			case 'tr1':
				routing = 'europe';
				break;
			case 'ru':
				routing = 'europe';
				break;
			default:
				routing = 'europe';
				break;
		}

		const endpoints = [
			`https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${playerUUID}/ids?start=0&count=5`,
            `https://${routing}.api.riotgames.com/tft/match/v1/matches/by-puuid/${playerUUID}/ids?start=0&count=5`
		];

		const matchData = await Promise.all(endpoints.map(endpoint => axios.get(endpoint, {
			headers: {
				'X-Riot-Token': process.env.TFT_API_KEY || process.env.DEV_API_KEY
			}
		}).then(response => {
			return response.data;
		}
		).catch(error => {
			console.log('[ERROR] Failed to get match data from Riot API', error);
		})));

		const lastMatchIDLOL = matchData[0][0];
		const lastMatchIDTFT = matchData[1][0];
		//!SECTION
		
		await new Promise(resolve => setTimeout(resolve, 1000));

		//SECTION - Add user to database
		if(user){
			// Add channel to user
			const newChannel = {
				guildID: guildID,
				channelID: channelID
			};

			user.channels.push(newChannel);

			await user.save();

			return interaction.editReply({ content: `You are now watching ${summoner} in <#${channelID}>`, ephemeral: true });

		}else{
			const newChannel = {
				guildID: guildID,
				channelID: channelID
			};
	
			const newUser = {
				summonerName: summonerData.name,
				region: region,
				puuidTFT: tftSummonerData.puuid,
				puuidLOL: lolSummonerData.puuid,
				lastMatchIDLOL: lastMatchIDLOL,
				lastMatchIDTFT: lastMatchIDTFT,
				timeout: 0,
				channels: [newChannel]
			};
	
			await User.create(newUser);

			return interaction.editReply({ content: `You are now watching ${summoner} in <#${channelID}>`, ephemeral: true });
		}
		//!SECTION
	},
};