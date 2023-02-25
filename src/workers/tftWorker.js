const { resolve } = require('path');
const axios = require('axios');
const User =  require('../models/User');
const { parentPort } = require("worker_threads");

const { config } = require('dotenv');
config({ path: resolve(__dirname, '..', '.env') })

const waitTime = 60000;
const userTimeout = 600;

//SECTION - Connect to MongoDB
const mongoose = require('mongoose');
mongoose.set('strictQuery', true);
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('[INFO] Connected to MongoDB - tftWorker');
}).catch((err) => {
    console.log('[ERROR] Failed to connect to MongoDB - tftWorker');
    console.log(err);
});
//!SECTION

async function checkLatestMatch(){
    const users = await User.find({});

    if(users.length == 0){
        console.log('[INFO] No users found in database - Waiting 30 seconds - tftWorker');
        return  setTimeout(checkLatestMatch, waitTime);
    }

    users.forEach(async (user) => {
        const summonerName = user.summonerName;
        const region = user.region;
        const puuid = user.puuid;
        const lastMatchID = user.lastMatchIDTFT;
        const timeout = user.timeout;
        const channels = user.channels;

        const currentEpoch = Math.floor(Date.now() / 1000);

        if(timeout > currentEpoch){
            console.log(`[INFO] ${summonerName} is on timeout - Skipping - tftWorker`);
            return;
        }

        if(channels.length == 0){
            console.log(`[INFO] ${summonerName} has no channels - Skipping - tftWorker`);
            return;
        }

        //SECTION - Get routing
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
        //!SECTION

        //SECTION - Get match IDs
        const response = await axios.get(`https://${routing}.api.riotgames.com/tft/match/v1/matches/by-puuid/${puuid}/ids?start=0&count=20`, {
            headers: {
                'X-Riot-Token': process.env.TFT_API_KEY || process.env.DEV_API_KEY
            }
        }).catch((err) => {
            console.log(`[ERROR] ${summonerName} - ${err}`);
        });

        if(response == undefined){
            return;
        }

        if(response.status === 429){
            console.log(`[INFO] API rate limit reached - Waiting 60 seconds - tftWorker`);
            return setTimeout(checkLatestMatch, 60000);
        }

        const matchIDs = response.data;
        //!SECTION

        //SECTION - Check if user has a new match
        if(matchIDs[0] !== lastMatchID){
            console.log(`[INFO] ${summonerName} has a new match - ${matchIDs[0]} - tftWorker`);

            const lastMatchIndex = matchIDs.indexOf(lastMatchID);

            if(lastMatchIndex !== -1){
                const newMatches = matchIDs.slice(0, lastMatchIndex).reverse();

                //SECTION - Get match data
                newMatches.forEach(async (matchID) => {
                    
                    const endpoints = [
                        `https://${routing}.api.riotgames.com/tft/match/v1/matches/${matchID}`,
                        `https://static.developer.riotgames.com/docs/lol/queues.json`
                    ]

                    const [matchData, queueData] = await axios.all([
                        axios.get(endpoints[0], {
                            headers: {
                                'X-Riot-Token': process.env.TFT_API_KEY || process.env.DEV_API_KEY
                            }
                        }),
                        axios.get(endpoints[1])
                    ]).then(axios.spread((matchData, queueData) => {
                        return [matchData.data, queueData.data];
                    })).catch(error => {
                        console.error(error);
                    });

                    if(matchData == undefined || queueData == undefined){
                        return;
                    }

                    if(matchData.status === 429 || queueData.status === 429){
                        console.log(`[INFO] API rate limit reached - Waiting 60 seconds - tftWorker`);
                        return setTimeout(checkLatestMatch, 60000);
                    }

                    const participant = matchData.info.participants.find(participant => participant.puuid === puuid);

                    let queueFormatted = "";

                    if(matchData.info.queue_id === 1160){
                        queueFormatted = 'Ranked Double Up';
                    }else{
                        const queue = queueData.find(queue => queue.queueId === matchData.info.queue_id).description;
                        queueFormatted = queue.replace(' games', '');
                    }

                    const gameDuration = matchData.info.game_length;
                    const gameDurationMinutes = Math.floor(gameDuration / 60);
                    const gameDurationSeconds = gameDuration % 60;
                    const gameDurationSecondsRounded = Math.round(gameDurationSeconds);

                    const gameDurationFormatted = `${gameDurationMinutes}m ${gameDurationSecondsRounded}s`;

                    const level = participant.level;
                    const roundsSurvived = participant.last_round;

                    let placement = participant.placement;
                    let placementFormatted = "";
                    let placementColor = 0x32DC65;
                    
                    if(matchData.info.queue_id === 1160){
                        placement = participant.placement / 2;
                        let placementRounded = Math.round(placement);
                        switch(placementRounded) {
                            case 1:
                                placementFormatted = '1st';
                                placementColor = 0x32DC65;
                                break;
                            case 2:
                                placementFormatted = '2nd';
                                placementColor = 0xFFA500;
                                break;
                            case 3:
                                placementFormatted = '3rd';
                                placementColor = 0xFFA500;
                                break;
                            case 4:
                                placementFormatted = '4th';
                                placementColor = 0xFFA500;
                                break;
                            default:
                                placementFormatted = `${placementRounded}th`;
                                placementColor = 0xFA4453;
                                break;
                        }
                    }else{
                        switch(placement) {
                            case 1:
                                placementFormatted = '1st';
                                placementColor = 0x32DC65;
                                break;
                            case 2:
                                placementFormatted = '2nd';
                                placementColor = 0xFFA500;
                                break;
                            case 3:
                                placementFormatted = '3rd';
                                placementColor = 0xFFA500;
                                break;
                            case 4:
                                placementFormatted = '4th';
                                placementColor = 0xFFA500;
                                break;
                            default:
                                placementFormatted = `${placement}th`;
                                placementColor = 0xFA4453;
                                break;
                        }
                    }

                    channels.forEach(async channel => {
                        parentPort.postMessage({guildID: channel.guildID, guildChannelID: channel.channelID, summonerName: summonerName, queueFormatted: queueFormatted, gameDurationFormatted: gameDurationFormatted, level: level, roundsSurvived: roundsSurvived, placementFormatted: placementFormatted, placementColor: placementColor });
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    });
                    await new Promise(resolve => setTimeout(resolve, 5000));
                });
                //!SECTION
            }

            const newTimeout = currentEpoch + userTimeout;
            await User.findOneAndUpdate({ puuid: puuid }, { lastMatchIDTFT: matchIDs[0], timeout: newTimeout });
        }
        //!SECTION
    });

    setTimeout(checkLatestMatch, waitTime);
}

checkLatestMatch();