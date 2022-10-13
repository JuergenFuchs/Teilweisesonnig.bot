const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
	.setName('cg')
	.setDescription('Get current CG info'),
    permissions: 0,
    async execute (interaction) {
        const Discord = require('discord.js');
        const https = require('https');

        const options = {
            hostname: 'api.orerve.net',
            port: 443,
            path: '/2.0/website/initiatives/list?lang=en',
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        }

        const req = https.request(options, res => {
            console.log(`CG Request StatusCode: ${res.statusCode}`)

            res.on('data', d => {
                let response = JSON.parse(d).activeInitiatives; //prints inara's output to the node console, process it further here
                
                const menu = new Discord.MessageSelectMenu().setCustomId('select').setPlaceholder('Nothing selected')
				
                for (let data of response) {
                    menu.addOptions([
                        {
                            label: `${data.objective}`,
                            description: `${data.title}`,
                            value: `${data.id}`,
                        },
                    ])
                }
                const row = new Discord.MessageActionRow().addComponents(menu);
                interaction.reply({ content: `Please select which Community Goal to view:`, components: [row], ephemeral:true})
                
                const filter = i => i.user.id === interaction.member.id;
                const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

                collector.on('collect', async interaction => {
                    if (!interaction.isSelectMenu()) return;
                    for (let data of response) {
                        if (interaction.values[0] === data.id) {
                            interaction.deferUpdate();
                            try {
                                const returnEmbed = new Discord.MessageEmbed()
                                    .setColor('#FF7100')
                                    .setTitle(`#${data.id} - ${data.title}`)
                                    .setDescription(`${data.bulletin}`)
                                    .addFields(
                                        {name: "Location", value: `${data.market_name} - ${data.starsystem_name}`, inline: true},
                                        {name: "Objective", value: `${data.objective}`, inline: true},
                                        {name: "Progress", value: `${data.qty}/${data.target_qty}`, inline: false},
                                        {name: "Expiry", value: `${data.expiry}`, inline: true},
                                    )
                                interaction.channel.send({ embeds: [returnEmbed.setTimestamp()] });
                            } catch (err) {
                                console.error(err);
                                interaction.channel.send({ content: `Something went wrong. Error: ${err}` });
                            }
                        }
                    }
                });
            })
        })

        req.on('error', error => {
            console.error(error)
        })

        req.end()
    }
}
