const { config } = require("dotenv");
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { resolve } = require("path");

config({ path: resolve(__dirname, "..", ".env") });

const commands = [];
const commandFiles = fs
  .readdirSync(path.join(__dirname, "commands"))
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(process.env.CLIENT_TOKEN);

(async () => {
  try {
    // console.log(`Started refreshing Guild ${commands.length} application (/) commands.`);

    // // The put method is used to fully refresh all commands in the guild with the current set
    // const data = await rest.put(
    // 	Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.DEV_GUILD_ID),
    // 	{ body: commands },
    // );

    // console.log(`Successfully reloaded Guild ${data.length} application (/) commands.`);

    // console.log(
    //   `Started refreshing Global ${commands.length} application (/) commands.`
    // );

    // const data2 = await rest.put(
    //   Routes.applicationCommands(process.env.CLIENT_ID),
    //   { body: commands }
    // );

    // console.log(
    //   `Successfully reloaded Global ${data2.length} application (/) commands.`
    // );

    // for guild-based commands
    // rest
    //   .delete(Routes.applicationGuildCommand(process.env.CLIENT_ID, process.env.DEV_GUILD_ID, "commandId"))
    //   .then(() => console.log("Successfully deleted guild command"))
    //   .catch(console.error);

    // for global commands
    // rest
    //   .delete(Routes.applicationCommand(process.env.CLIENT_ID, "commandId"))
    //   .then(() => console.log("Successfully deleted application command"))
    //   .catch(console.error);
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
})();
