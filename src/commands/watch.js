const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const User = require('../models/User');

const routingMap = {
    br1: "americas",
    eun1: "europe",
    euw1: "europe",
    jp1: "asia",
    kr: "asia",
    la1: "americas",
    la2: "americas",
    na1: "americas",
    oc1: "americas",
    tr1: "europe",
    ru: "europe",
  };

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
				'X-Riot-Token': process.env.TFT_API_KEY
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

		lolSummonerData = await axios.get(`https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${summoner}`, {
			headers: {
				'X-Riot-Token': process.env.LOL_API_KEY
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

		const routing = routingMap[region] || "europe";

		tftMatchData = await axios.get(`https://${routing}.api.riotgames.com/tft/match/v1/matches/by-puuid/${tftSummonerData.puuid}/ids?start=0&count=5`, {
			headers: {
				'X-Riot-Token': process.env.TFT_API_KEY
			}
		}).then(response => {
			return response.data;
		}).catch(error => {
			console.log('[ERROR] Failed to get match data from Riot API', error);
		});

		lolMatchData = await axios.get(`https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${lolSummonerData.puuid}/ids?start=0&count=5`, {
			headers: {
				'X-Riot-Token': process.env.LOL_API_KEY
			}
		}).then(response => {
			return response.data;
		}).catch(error => {
			console.log('[ERROR] Failed to get match data from Riot API', error);
		});

		const lastMatchIDLOL = lolMatchData[0];
		const lastMatchIDTFT = tftMatchData[0];
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
				summonerName: tftSummonerData.name,
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