require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { Worker } = require("worker_threads");
mongoose.set("strictQuery", true);

const {
  Client,
  Collection,
  GatewayIntentBits,
  EmbedBuilder,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

//SECTION - Database connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("[INFO] Connected to MongoDB - Index");
  })
  .catch((err) => {
    console.log("[ERROR] Failed to connect to MongoDB - Index");
    console.log(err);
  });
//!SECTION

//SECTION - Worker registration
const lolWorker = new Worker(path.join(__dirname, "workers", "lolWorker.js"));
const tftWorker = new Worker(path.join(__dirname, "workers", "tftWorker.js"));

lolWorker.on("message", async (message) => {
  const guildID = message.guildID;
  const guildChannelID = message.guildChannelID;

  const summonerName = message.summonerName;
  const queueFormatted = message.queueFormatted;
  const map = message.map;
  const gameDurationFormatted = message.gameDurationFormatted;
  const kills = message.kills;
  const deaths = message.deaths;
  const assists = message.assists;
  const cs = message.cs;
  const champIcon = message.champIcon;
  const win = message.win;

  if (win) {
    const embed = new EmbedBuilder()
      .setTitle(`${summonerName} won their match!`)
      .setThumbnail(champIcon)
      .setColor(0x32dc65)
      .addFields({
        name: `${queueFormatted} - ${map}`,
        value: `${cs} CS - ${kills}/${deaths}/${assists} KDA`,
        inline: true,
      })
      .setFooter({ text: `League of Legends - ${gameDurationFormatted}` });

    console.log(`[INFO] Sending embed to ${guildID} - ${guildChannelID}`);

    try {
      client.guilds.cache
        .get(`${guildID}`)
        .channels.cache.get(`${guildChannelID}`)
        .send({ embeds: [embed] });
    } catch (err) {
      console.log(err);
    }
  } else {
    const embed = new EmbedBuilder()
      .setTitle(`${summonerName} lost their match!`)
      .setThumbnail(champIcon)
      .setColor(0xfa4453)
      .addFields({
        name: `${queueFormatted} - ${map}`,
        value: `${cs} CS - ${kills}/${deaths}/${assists} KDA`,
        inline: true,
      })
      .setFooter({ text: `League of Legends - ${gameDurationFormatted}` });

    console.log(`[INFO] Sending embed to ${guildID} - ${guildChannelID}`);

    try {
      client.guilds.cache
        .get(`${guildID}`)
        .channels.cache.get(`${guildChannelID}`)
        .send({ embeds: [embed] });
    } catch (err) {
      console.log(err);
    }
  }
});

tftWorker.on("message", async (message) => {
  const guildID = message.guildID;
  const guildChannelID = message.guildChannelID;

  const summonerName = message.summonerName;
  const queueFormatted = message.queueFormatted;
  const gameDurationFormatted = message.gameDurationFormatted;
  const level = message.level;
  const roundsSurvived = message.roundsSurvived;
  const placementFormatted = message.placementFormatted;
  const placementColor = message.placementColor;

  const embed = new EmbedBuilder()
    .setTitle(`${summonerName} placed ${placementFormatted} in their match!`)
    .setThumbnail(
      `https://teamfighttactics.leagueoflegends.com/static/24eaaf3a8fb2a932281f8990cd93f475/c74cc/pengu.png`
    )
    .setColor(placementColor)
    .addFields({
      name: `${queueFormatted}`,
      value: `Level ${level} - Survived ${roundsSurvived} rounds`,
      inline: true,
    })
    .setFooter({ text: `Teamfight Tactics - ${gameDurationFormatted}` });

  console.log(`[INFO] Sending embed to ${guildID} - ${guildChannelID}`);

  try {
    client.guilds.cache
      .get(`${guildID}`)
      .channels.cache.get(`${guildChannelID}`)
      .send({ embeds: [embed] });
  } catch (err) {
    console.log(err);
  }
});
//!SECTION

//SECTION - Command registration
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(path.join(__dirname, "commands"))
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
    console.log(`[INFO] Loaded command ${command.data.name} from ${filePath}`);
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
    );
  }
}
//!SECTION

//SECTION - Event registration
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(path.join(__dirname, "events"))
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}
//!SECTION

client.login(process.env.CLIENT_TOKEN);
