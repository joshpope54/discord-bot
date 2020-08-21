const Discord = require('discord.js');
let running = false;
var timer;
module.exports = {
	name: 'timer',
    description: 'Create a Timer',
    usage: '<mins>',
    args: true,
	execute(message, args) {
        if(running){
            if(args[0]==="stop"){
                clearInterval(timer);
                message.reply("timer stopped.");
                running = false;
            }else{
                message.reply("a timer is already active");
            }
        }else{
            running = true;
            sec = args[0]*60;
            secs = sec % 60;
            min = (sec / 60)%60;
            hours = (sec/60)/60;
            const countdownEmbed = new Discord.MessageEmbed()
                .setDescription('Timer started for '+args[0]+'(mins)\nRemaining Time: ' + Math.floor(hours) + ' : ' + Math.floor(min) + ' : ' + Math.floor(secs))
                .setColor('RED')
            message.channel.send({ embed: countdownEmbed }).then((msg) => {
                timer = setInterval(function (){
                    sec-= 5;
                    secs = sec % 60;
                    min = (sec / 60)%60;
                    hours = (sec/60)/60;
                    msg.edit(countdownEmbed.setDescription('Timer started for '+args[0]+' (mins)\nRemaining Time: ' + Math.floor(hours) + ' : ' + Math.floor(min) + ' : ' + Math.floor(secs)));
                    if (sec <= 0) {
                        clearInterval(this);
                        running = false;
                        if (!message.mentions.users.size) {
                            message.reply('Timer Ended');
                        }else{
                            const userList = message.mentions.users.map(user => {
                                return ` ${user}`;
                            });
                            message.channel.send(`Timer over, where are you` + userList);
                        }
                    }
                }, 5000);
            })
        }
        

	},
};