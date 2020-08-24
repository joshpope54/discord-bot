const fs = require('fs');
const Discord = require('discord.js');
const client = new Discord.Client();
const {prefix, token, steamToken, steamID} = require('./config.json');
const fetch = require('node-fetch');
client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.name, command);
}

client.once('ready', () => {
	console.log('Ready!');
});

client.on('message', message => {
  if (!message.content.startsWith(prefix) || message.author.bot){
    if(message.channel.id === '706245049687605281' && !message.author.bot){
      const steamAddress = message.content;
      if(!steamAddress.startsWith('https://store.steampowered.com/app')){
        message.delete({timeout: 5000});
        message.reply('that was not a valid steam game address').then(sent => { // 'sent' is that message you just sent
          sent.delete({ timeout: 5000});
        }).catch(console.error);
      }
    }else if (message.channel.id === '258693667332554753' && !message.author.bot){
      const steamAddress = message.content;
      if(steamAddress.startsWith('https://store.steampowered.com/app')){
        message.reply('steam games belong in <#706245049687605281>. Your game has been reposted by me.');
        message.delete();
        const channel = client.channels.cache.get('706245049687605281');
        channel.send(steamAddress);
      }
    }else{
      return;
    }
  }

	const args = message.content.slice(prefix.length).split(/ +/);
	const commandName = args.shift().toLowerCase();

	if (!client.commands.has(commandName)) return;
  const command = client.commands.get(commandName);

  if (command.args && !args.length) {
		let reply = `You didn't provide any arguments, ${message.author}!`;
		if (command.usage) {
			reply += `\nThe proper usage would be: \`${prefix}${command.name} ${command.usage}\``;
		}
		return message.channel.send(reply);
	}

	try {
		command.execute(message, args);
	} catch (error) {
		console.error(error);
		message.reply('there was an error trying to execute that command!');
	}
});

client.login(`${token}`);


  // if(command === `${prefix}`+'game'){
  //     const { response } = await fetch('http://api.steampowered.com/IStoreService/GetAppList/v1/?key='+`${steamToken}`+'&steamid='+`${steamID}`+'&max_results=50000').then(response => response.json());
  //     var game = message.content.substr(message.content.indexOf(' ')+1);
  //     var regex = new RegExp('^'+game+'.*$', 'g');
  //     var appIDs = response.apps.filter(x => x.name.match(regex));
  //     if(appIDs.length==0){
  //       message.channel.send('No Game with name \'' + game + '\' found.');
  //     }else{
  //       var data = [];
  //       for(i=0;i<appIDs.length; i++){
  //         const gameJson = await fetch('https://store.steampowered.com/api/appdetails?appids='+appIDs[i].appid).then(response => response.json());
  //         data.push(gameJson[appIDs[i].appid].data);
  //       }
  //       data.sort(compare);
  //       if(data.length>1){
  //         message.channel.send('Multiple Games Found, Here are the most recent releases:\n');
  //         for(i=0; i<3; i++){
  //           const embed = new Discord.MessageEmbed()
  //           .setColor('#EFFF00')
  //           .setTitle(data[i].name)
  //           .setURL('https://store.steampowered.com/app/'+data[i].steam_appid)
  //           .setImage(data[i].header_image)
  //           .setDescription(data[i].short_description);

  //           // if(!data[i].is_free){
  //           //   embed.addFields(
  //           //     { name: 'Price', value: data[i].price_overview.final_formatted, inline: true},
  //           //     { name: 'Achievements', value: data[i].achievements.total, inline: true},
  //           //   );
  //           // }else{
  //           //   embed.addFields(
  //           //     { name: 'Price', value: "FREE", inline: true},
  //           //     { name: 'Achievements', value: data[i].achievements.total, inline: true},
  //           //   );
  //           // }

  //           message.channel.send(embed);
  //         }
  //       }else{
  //         const embed = new Discord.MessageEmbed()
  //         .setColor('#EFFF00')
  //         .setTitle(data[0].name)
  //         .setURL('https://store.steampowered.com/app/'+data[0].steam_appid)
  //         .setImage(data[0].header_image)
  //         .setDescription(data[0].short_description);

  //         // if(!data[0].is_free){
  //         //   embed.addFields(
  //         //     { name: 'Price', value: data[0].price_overview.final_formatted, inline: true},
  //         //     { name: 'Achievements', value: data[0].achievements.total, inline: true},
  //         //   );
  //         // }else{
  //         //   embed.addFields(
  //         //     { name: 'Price', value: "FREE", inline: true},
  //         //     { name: 'Achievements', value: data[0].achievements.total, inline: true},
  //         //   );
  //         // }
  //         message.channel.send(embed);
  //       }

  //     }
  //     // const gameJson = await fetch('https://store.steampowered.com/api/appdetails?appids='+appID).then(response => response.json());
  //     // var gameData = gameJson[appID].data;
  //     //
  //     // const embed = new Discord.MessageEmbed()
  //   	// .setColor('#EFFF00')
  //   	// .setTitle(gameData.name)
  //   	// .setURL('https://store.steampowered.com/app/'+appID)
  //     // .setImage(gameData.header_image)
  //     // .setDescription(gameData.short_description);
  //     //
  //     // if(!gameData.is_free){
  //     //   embed.addFields(
  //     //     { name: 'Price', value: gameData.price_overview.final_formatted, inline: true},
  //     //     { name: 'Achievements', value: gameData.achievements.total, inline: true},
  //     //   );
  //     // }else{
  //     //   embed.addFields(
  //     //     { name: 'Price', value: "FREE", inline: true},
  //     //     { name: 'Achievements', value: gameData.achievements.total, inline: true},
  //     //   );
  //     // }
  //     //
  //     // message.channel.send(embed);
  // }
// });

function compare( a, b ) {
  var date = new Date(a.release_date.date);
  var date2 = new Date(b.release_date.date);
  if (date > date2 ){
    return -1;
  }
  if (date < date2 ){
    return 1;
  }
  return 0;
}


