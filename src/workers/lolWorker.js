const { resolve } = require("path");
const axios = require("axios");
const User = require("../models/User");
const { parentPort } = require("worker_threads");

const { config } = require("dotenv");
config({ path: resolve(__dirname, "..", ".env") });

const waitTime = parseInt(process.env.DATABASE_CHECK_INTERVAL) || 60000;
const userTimeout = parseInt(process.env.USER_TIMEOUT) || 600;

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

//SECTION - Connect to MongoDB
const mongoose = require("mongoose");
mongoose.set("strictQuery", true);
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("[INFO] Connected to MongoDB - lolWorker");
  })
  .catch((err) => {
    console.log("[ERROR] Failed to connect to MongoDB - lolWorker");
    console.log(err);
  });
//!SECTION

async function checkLatestMatch() {
  const users = await User.find({});

  if (users.length == 0) {
    console.log(
      "[INFO] No users found in database - Waiting 30 seconds -  lolWorker"
    );
    return setTimeout(checkLatestMatch, waitTime);
  }

  const promises = users.map(async (user) => {
    const summonerName = user.summonerName;
    const region = user.region;
    const puuid = user.puuidLOL;
    const lastMatchID = user.lastMatchIDLOL;
    const timeout = user.timeout;
    const channels = user.channels;

    const currentEpoch = Math.floor(Date.now() / 1000);

    if (timeout > currentEpoch) {
      console.log(
        `[INFO] ${summonerName} is on timeout - Skipping - lolWorker`
      );
      return;
    }

    if (channels.length == 0) {
      console.log(
        `[INFO] ${summonerName} has no channels - Skipping - tftWorker`
      );
      return;
    }

    //SECTION - Get routing
    const routing = routingMap[region] || "europe";
    //!SECTION

    //SECTION - Get match IDs
    const response = await axios
      .get(
        `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=20`,
        {
          headers: {
            "X-Riot-Token": process.env.LOL_API_KEY,
          },
        }
      )
      .catch((err) => {
        console.log(`[ERROR] ${summonerName} - ${err}`);
      });

    if (response == undefined) {
      return;
    }

    if (response.status === 429) {
      console.log(
        `[INFO] API rate limit reached - Waiting 60 seconds - lolWorker`
      );
      return setTimeout(checkLatestMatch, 60000);
    }

    const matchIDs = response.data;
    //!SECTION

    //SECTION - Check if user has a new match
    if (matchIDs[0] !== lastMatchID) {
      console.log(
        `[INFO] ${summonerName} has a new match - ${matchIDs[0]} - lolWorker`
      );

      const lastMatchIndex = matchIDs.indexOf(lastMatchID);

      if (lastMatchIndex !== -1) {
        const newMatches = matchIDs.slice(0, lastMatchIndex).reverse();

        //SECTION - Get match data
        newMatches.forEach(async (matchID) => {
          const endpoints = [
            `https://${routing}.api.riotgames.com/lol/match/v5/matches/${matchID}`,
            `https://static.developer.riotgames.com/docs/lol/queues.json`,
            'http://ddragon.leagueoflegends.com/cdn/13.5.1/data/en_US/champion.json'
          ];

          const [matchData, queueData, championData] = await axios
            .all([
              axios.get(endpoints[0], {
                headers: {
                  "X-Riot-Token":
                    process.env.LOL_API_KEY,
                },
              }),
              axios.get(endpoints[1]),
              axios.get(endpoints[2]),
            ])
            .then(
              axios.spread((matchData, queueData, championData) => {
                return [matchData.data, queueData.data, championData.data];
              })
            )
            .catch((error) => {
              console.error(error);
            });

          if (matchData == undefined || queueData == undefined || championData == undefined) {
            return;
          }

          if (matchData.status === 429 || queueData.status === 429 || championData.status === 429) {
            console.log(
              `[INFO] API rate limit reached - Waiting 60 seconds - lolWorker`
            );
            return setTimeout(checkLatestMatch, 60000);
          }

          const participant = matchData.info.participants.find(
            (participant) => participant.puuid === puuid
          );

          const queue = queueData.find(
            (queue) => queue.queueId === matchData.info.queueId
          ).description;
          const queueFormatted = queue.replace(" games", "");
          const map = queueData.find(
            (queue) => queue.queueId === matchData.info.queueId
          ).map;

          const gameDuration = matchData.info.gameDuration;
          const gameDurationMinutes = Math.floor(gameDuration / 60);
          const gameDurationSeconds = gameDuration % 60;

          const gameDurationFormatted = `${gameDurationMinutes}m ${gameDurationSeconds}s`;

          const kills = participant.kills;
          const deaths = participant.deaths;
          const assists = participant.assists;

          const cs =
            participant.totalMinionsKilled + participant.neutralMinionsKilled;

          const champID = participant.championId;
          const champion = Object.keys(championData.data).find(
            (key) => championData.data[key].key == champID
          );

          const championName = championData.data[champion].id;

          const champIcon = `http://ddragon.leagueoflegends.com/cdn/13.1.1/img/champion/${championName}.png`;

          const win = participant.win;

          // [game, guildID, guildChannelID, summonerName, queueFormatted, map, gameDurationFormatted, kills, deaths, assists, cs, champIcon, win]
          channels.forEach(async (channel) => {
            parentPort.postMessage({
              guildID: channel.guildID,
              guildChannelID: channel.channelID,
              summonerName: summonerName,
              queueFormatted: queueFormatted,
              map: map,
              gameDurationFormatted: gameDurationFormatted,
              kills: kills,
              deaths: deaths,
              assists: assists,
              cs: cs,
              champIcon: champIcon,
              win: win,
            });
            await new Promise((resolve) => setTimeout(resolve, 5000));
          });
          await new Promise((resolve) => setTimeout(resolve, 5000));
        });
        //!SECTION
      }

      const newTimeout = currentEpoch + userTimeout;
      await User.findOneAndUpdate(
        { puuidLOL: puuid },
        { lastMatchIDLOL: matchIDs[0], timeout: newTimeout }
      );
    }
    //!SECTION
  });

  await Promise.all(promises);

  setTimeout(checkLatestMatch, waitTime);
}

checkLatestMatch();
