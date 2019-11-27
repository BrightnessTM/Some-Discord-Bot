const { RichEmbed } = require("discord.js");
const exec = (require("util").promisify((require("child_process").exec)));

module.exports.config = {
	name: "bot",
	aliases: [],
	ownerOnly: true,
	guildOnly: false
};

module.exports.run = async (client, message, args) => {
	let cmd = args.shift();
	args.slice(1);
	switch (cmd) {
	case ("destroy"): {
		message.channel.send("Refreshing...")
			.then(() => {
				client.destroy();
			})
			.then(() => {
				client.login(process.env.TOKEN)
					.catch((e) => {
						throw new Error(e);
					});
			})
			.then((m) => {
				return m.edit("Refresh complete.");
			});
		break;
	}
	case ("restart"): {
		message.channel.send("Shutting down...")
			.then(() => {
				client.destroy();
			})
			.then(() => {
				process.exit(0);
			});
		break;
	}
	case ("reload"): {
		const commandName = args[0].toLowerCase();
		const command = message.client.commands.get(commandName)
			|| message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

		if (!command) return message.channel.send(`There is no command with name or alias \`${commandName}\`, ${message.author}!`);

		delete require.cache[require.resolve(`./${commandName}.js`)];

		try {
			const newCommand = require(`./${commandName}.js`);
			message.client.commands.set(newCommand.name, newCommand);
		} catch (err) {
			message.channel.send(CONSTANTS.errors.generic);
			throw new Error(err);
		}
		message.channel.send(`Command \`${commandName}\` was reloaded!`);

		break;
	}
	case ("ping"): {
		await message.channel.send("Loading...")
			.then((m) => {
				m.edit(`Pong! The latency is \`${m.createdTimestamp - message.createdTimestamp}ms\`. The API response time is \`${Math.round(client.ping)}ms\``);
			});
		break;
	}
	case ("eval"): {
		/**
		 * "Clean" text before returning it with eval.
		 * @param {string} text - Text to be "cleaned"
		 * @returns {string} - Cleaned text
		 */
		function clean (text) {
			if (text.includes(client.token)) text.replace(client.token, "nice try");
			if (typeof (text) === "string") {
				text = text.substring(0, 1000);
				return text.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
			}
			text = text.substring(0, 1000);
			return text;
		}

		try {
			const code = args.join(" ");
			let evaled = eval(code);
			if (typeof evaled !== "string") {
				evaled = require("util").inspect(evaled);
			}

			// TODO: make this shorter
			let successEmbed = new RichEmbed()
				.setAuthor(message.author.username, message.author.icon_url)
				.setTitle("JavaScript Eval Success!")
				.setColor("GREEN")
				.setDescription(`\`\`\`js\n${args.join(" ")}\`\`\``)
				.addField("Result:", `\`\`\`xl\n${clean(evaled)}\`\`\``)
				.setTimestamp();
			message.channel.send(successEmbed);

		} catch (err) {
			let errorEmbed = new RichEmbed()
				.setAuthor(message.author.username, message.author.icon_url)
				.setTitle("JavaScript Eval Error!")
				.setColor("DARK_RED")
				.setDescription(`\`\`\`js\n${args.join(" ")}\`\`\``)
				.addField("Error:", `\`\`\`js\n${clean(err.stack)}\`\`\``)
				.setTimestamp();
			message.channel.send(errorEmbed);
		}
		break;
	}
	case ("deploy"): {
		if (process.env.NODE_ENV !== "production" && args[0] !== "-f") return message.channel.send(":x: I am not running in the production environment. You probably don't want to deploy now."); // Don't deploy if the bot isn't running in the production environment
		let m = await message.channel.send("Loading...");
		let logMsg = await client.channels.get(CONSTANTS.config.logChannel).send("Loading...");
		await generateEmbed("Deploy command received");

		await generateEmbed("Updating code");
		exec("git fetch origin && git reset --hard origin/production") // Pull new code from the production branch on GitHub
			.then(async () => {
				await generateEmbed("Installing new NPM packages");
				return exec("npm i --production"); // Installing any new dependencies
			})
			.then(async () => {
				await generateEmbed("Shutting down");
				return process.exit(0); // Stop the bot; Glitch should automatically restart the bot after it is shut down
			});

		/**
		 * Use an embed for deploy command logs
		 * @param {string} msg - The message to be logged
		 * @returns {Promise<void>}
		 */
		async function generateEmbed (msg) {
			if (typeof generateEmbed.message == "undefined") generateEmbed.message = [];
			generateEmbed.message.push(`- ${msg}`);
			let embed = new RichEmbed()
				.setDescription(`\`\`\`md\n${generateEmbed.message.join("\n")}\`\`\``)
				.setColor("RANDOM");
			console.log(msg);
			if (m) await m.edit(embed);
			if (logMsg) await logMsg.edit(embed);
		}
		break;
	}
	case ("say"): {
		if (message.guild.me.hasPermission("MANAGE_MESSAGES")) message.delete();
		message.channel.send(args.join(" "));
		break;
	}
	default: {
		// bot info embed
		message.channel.send("Loading...")
			.then((m) => {
					m.edit(new RichEmbed()
						.setAuthor(`${message.author.username}#${message.author.discriminator}`, message.author.avatarURL)
						.setColor("DARK_BLUE")
						.setTimestamp()
						.addField("Library", "[Discord.JS](https://discord.js.org/)", true)
						.addField("Owner", "Ben.#0002", true)
						.addField("GitHub Repo", `[GitHub](${CONSTANTS.info.repo})`, true)

						.addField("Edit Time", `${m.createdTimestamp - message.createdTimestamp}ms`, true)
						.addField("API Response Time", `${Math.round(client.ping)}ms`, true)
						.addField("Version", (require("../../package.json")).version, true)
					);
				}
			);
		break;
	}
	}
};

