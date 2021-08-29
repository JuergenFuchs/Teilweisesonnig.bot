//------------------ SWITCHES ----------------------
// To enable or disble components for testing purposes
const enableDiscordBot = 1; // Set to 0 to disable discord bot from running
//--------------------------------------------------

require("dotenv").config();
require('./deploy-commands'); // Re-register slash commands
const { readdirSync } = require('fs');
const { Client, Intents, MessageEmbed, Collection } = require("discord.js");
const event = require('./events/event.js');
const { prefix, icon, securityGroups } = require('./config.json');

// Discord client setup
const serverIntents = new Intents();
serverIntents.add(
	Intents.FLAGS.GUILDS,
	Intents.FLAGS.GUILD_PRESENCES, 
	Intents.FLAGS.GUILD_MEMBERS, 
	Intents.FLAGS.GUILD_MESSAGES, 
	Intents.FLAGS.GUILD_MESSAGE_REACTIONS, 
	Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS
);
const bot = new Client({ intents: serverIntents })

// Command Setup
bot.commands = new Collection();
const commandFolders = readdirSync('./commands');
for (const folder of commandFolders) {
	const commandFiles = readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const command = require(`./commands/${folder}/${file}`);
		command.category = folder;
		if (command.data === undefined) {
			bot.commands.set(command.name, command) // For non-slash commands
		} else {
			bot.commands.set(command.data.name, command) // For slash commands
		}
	}
}

const incursionsEmbed = new MessageEmbed()
.setColor('#FF7100')
.setAuthor('The Anti-Xeno Initiative', icon)
.setTitle("**Defense Targets**")
let messageToUpdate

/**
 * Log a discord bot event in the Log Channel
 * @author  (Mgram) Marcus Ingram
 * @param	{string} event		The message to send.
 * @param	{string} severity	Message severity ("low", "medium", "high").
 */
function botLog(event, severity) {
	const logEmbed = new MessageEmbed()
	.setAuthor('Warden', icon);
	switch (severity) {
		case "low":
			logEmbed.setColor('#42f569')
			logEmbed.setDescription(`${event}`)
			break;
		case "medium":
			logEmbed.setColor('#f5bf42')
			logEmbed.setDescription(`${event}`)
			break;
		case "high":
			logEmbed.setColor('#f55142')
			logEmbed.setDescription(`${event}`)
			break;
	}
	if (process.env.LOGCHANNEL) {
		bot.channels.cache.find(x => x.id === process.env.LOGCHANNEL).send({ embeds: [logEmbed], })
	} else {
		console.warn("ERROR: No Log Channel Environment Variable Found, Logging will not work.") 
	}
}

const checkPermissions = (command, interaction) => {
	// checks for proper permissions by role against permissions.js
	let allowedRoles = securityGroups[command.permissions].roles;
	let userRoles = interaction.member._roles;
	let allowed = false; // False by default
	for (let role of allowedRoles) {
		if (userRoles.includes(role)) { allowed = true }
	}
	return allowed
}

bot.once("ready", async() => {
	botLog(`Warden is now online! ⚡`, `high`);
	console.log(`[✔] Discord bot Logged in as ${bot.user.tag}!`);
	if(!process.env.MESSAGEID) return console.log("ERROR: No incursion embed detected")
	bot.guilds.cache.get(process.env.GUILDID).channels.cache.get(process.env.CHANNELID).messages.fetch(process.env.MESSAGEID).then(message =>{
		messageToUpdate = message
		const currentEmbed = message.embeds[0]
		incursionsEmbed.description = currentEmbed.description
		currentEmbed.fields.forEach((field) => {
			//console.log(field)
			incursionsEmbed.addField(field.name, field.value)
		})
	}).catch(err => {
		console.error(err)
	})
})

// Command Handler for Non-Slash Commands
bot.on('messageCreate', message => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;

	// Argument Handler and commands
	let args;
	let commandName;
	let command;
	try {
		args = message.content.replace(/[”]/g,`"`).slice(prefix.length).trim().match(/(?:[^\s"]+|"[^"]*")+/g); // Format Arguments - Split by spaces, except where there are quotes.
		args = args.map(arg => arg.replaceAll('"', ''))
		commandName = args.shift().toLowerCase(); // Convert command to lowercase and remove first string in args (command)
		command = bot.commands.get(commandName); // Gets the command info
	} catch (err) {
		console.warn(`Invalid command input: ${err}`)
	}

	//checks if command exists, then goes to non-subfiled command
	if (!bot.commands.has(commandName)) {
		// Basic Commands
		if (message.content === `${prefix}help`) { // Unrestricted Commands.
			message.reply({ content: "Type `/` to view all commands"})
		}

		if (message.content === `${prefix}ping`) {
			message.channel.send({ content: `🏓 Latency is ${Date.now() - message.createdTimestamp}ms. API Latency is ${Math.round(bot.ws.ping)}ms` });
		}

		return;
	}

	if (command.permissions != 0) {
		if (checkPermissions(command, message) === false) { 
			botLog('**' + message.member.nickname + '** Attempted to use command: /`' + message.commandName + ' ' + args + '`' + ' Failed: Insufficient Permissions', "medium")  
			return message.reply("You don't have permission to use that command!")
		}
	}

	if (command.args && !args.length) {
		let reply = `You didn't provide any arguments, ${message.author}!`;
		if (command.usage) {
			reply = `Expected usage: \`${prefix}${command.name} ${command.usage}\``;
		}
		return message.channel.send({ content: `${reply}` });
	}
	try {
		command.execute(message, args, updateEmbedField); // Execute the command
		botLog('**' + message.author.username + '#' + message.author.discriminator + '** Used command: `' + prefix + command.name + ' ' + args + '`', "low");
	} catch (error) {
		console.error(error);
		message.reply(`there was an error trying to execute that command!: ${error}`);
	}
});

// Button Handler
bot.on('interactionCreate', b => {
	if (!b.isButton()) return;
	
	// Event Response Handler
	if (b.customId.startsWith("event")) {
		b.deferUpdate();
		let response = b.customId.split("-");
		if (response[2] === "enroll") {
			event.joinEvent(b, response[1])
		}
		if (response[2] === "leave") {
			event.leaveEvent(b, response[1])
		}
		return;
	}

	// Platform Response Handler
	if (b.customId === "platformpc") {
		b.deferUpdate();
		b.member.roles.add("428260067901571073")
		b.member.roles.add("380247760668065802")
		botLog(`Welcome Verification passed - User: **${b.member.nickname}**`, "low")
	} else if (b.customId === "platformxb") {
		b.deferUpdate();
		b.member.roles.add("533774176478035991")
		b.member.roles.add("380247760668065802")
		botLog(`Welcome Verification passed - User: **${b.member.nickname}**`, "low")
	} else if (b.customId === "platformps") {
		b.deferUpdate();
		b.member.roles.add("428259777206812682")
		b.member.roles.add("380247760668065802")
		botLog(`Welcome Verification passed - User: **${b.member.nickname}**`, "low")
	}
	b.member.roles.add("642840406580658218");
	b.member.roles.add("642839749777948683");
});

// Slash Command Handler
bot.on('interactionCreate', async interaction => {
	console.log(interaction)
	if (!interaction.isCommand()) return;
	console.log(interaction)

	const command = bot.commands.get(interaction.commandName);
	console.log(command)
	if (!command) return;

	const args = interaction.options.data

	if (command.permissions != 0) {
		if (checkPermissions(command, interaction) === false) { 
			botLog('**' + interaction.member.nickname + '** Attempted to use command: /`' + interaction.commandName + ' ' + interaction.data + '`' + ' Failed: Insufficient Permissions', "medium")  
			return interaction.reply("You don't have permission to use that command!")
		}
	}

	try {
		await command.execute(interaction, args);
		botLog('**' + interaction.member.nickname + '** Used command: `' + interaction.commandName + ' ' + interaction.data + '`', "low");
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

bot.on("error", () => { bot.login(bot.login(process.env.TOKEN)) });

/**
* Updates or adds a single field to the stored embed and updates the message
* @author   Airom
* @param    {Array} field    {name: nameOfField, value: valueOfField}
*/
function updateEmbedField(field) {
	if(!messageToUpdate) return
	if(field.name === null) return messageToUpdate.edit({ embeds: [incursionsEmbed.setDescription(field.value).setTimestamp()] })
	const temp = new MessageEmbed()
	.setColor('#FF7100')
	.setAuthor('The Anti-Xeno Initiative', icon)
	.setTitle("**Defense Targets**")
	.setDescription(incursionsEmbed.description)
	let isUpdated = false
	for(const value of incursionsEmbed.fields) {
		if(value.name === field.name) {
			if(field.value) {
				temp.addField(field.name, field.value)
			}
			isUpdated = true
			console.log("Updated existing field: " + field.name)
		} else {
			temp.addField(value.name, value.value)
			console.log("Copied existing field: " + value.name)
		}
	}
	if(!isUpdated && field.value){
		temp.addField(field.name, field.value)
		console.log("Added new field: " + field.name)
	}
	incursionsEmbed.fields = temp.fields
	messageToUpdate.edit({ embeds: [incursionsEmbed.setTimestamp()] })
	console.log(messageToUpdate.embeds[0].fields)
}

// Switch Statements
if (enableDiscordBot === 1) { bot.login(process.env.TOKEN) } else { console.error(`WARN: Discord Bot Disabled`)}