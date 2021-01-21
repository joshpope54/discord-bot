const fs = require('fs');
const Discord = require('discord.js');
const client = new Discord.Client();
const { prefix, token, steamToken, steamID } = require('./config.json');
const fetch = require('node-fetch');
client.commands = new Discord.Collection();
const LeagueJs = require('leaguejs');
const api = new LeagueJs('RGAPI-99ed095b-9050-4f58-a21b-8e48e55082cc', { PLATFORM_ID: 'euw1' });
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
var mysql = require('mysql');
var con = mysql.createConnection({
    host: "localhost",
    port: "3306",
    user: "root",
    password: "",
    database: "discordbot"
});

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}
var users = [{ 'discordID': 207222621371105280, 'summonerName': 'TheEnslayer' }, { 'discordID': 249536648906407937, 'summonerName': '2 Tentacool 4skl' }, { 'discordID': 170580686959411200, 'summonerName': 'BlackWraith' }]

function requests(retries, gameId, position) {
    return api.Match.gettingById(gameId).catch(err => {
        if (retries > 0) {
            console.log("Retrying " + gameId)
            return requests(retries - 1, gameId, position);
        }
    })
}

function recursiveThing(accountId, summoner, startingIndex, allMatches = []) {
    return api.Match.gettingListByAccount(accountId, { beginIndex: startingIndex, beginTime: 1598828400000 }).then(response => {
        var matches = response.matches;
        for (i in matches) {
            var sql = "INSERT INTO matches (accountId,platformId,gameId,champion,season,queue,timestamp,role,lane) VALUES ('" + accountId + "','" + matches[i].platformId + "'," + matches[i].gameId + "," + matches[i].champion + "," + matches[i].season + "," + matches[i].queue + "," + matches[i].timestamp + ",'" + matches[i].role + "','" + matches[i].lane + "')";
            con.query(sql, function (err, result) {
                if (err) throw err;
            });
            allMatches.push(matches[i])
        }
        if (response.matches.length === 100) {
            return recursiveThing(accountId, summoner, startingIndex + 101, allMatches);
        } else {
            allMatches.unshift({ summonerName: summoner })
            return allMatches
        }
    });
}

function calculateTotalKills(participants, teamId) {
    var totalKills = 0;
    for (k in participants) {
        if (participants[k].teamId === teamId) {
            totalKills += participants[k].stats.kills;
        }
    }
    console.log(totalKills)
    return totalKills;
}
function ignoreUselessData(jsonObject, summoner) {
    let { gameId, participants, participantIdentities } = jsonObject;
    for (i in participantIdentities) {
        if (participantIdentities[i].player.summonerName === summoner) {
            let { participantId } = participantIdentities[i];
            for (k in participants) {
                if (participants[k].participantId === participantId) {
                    //find team id
                    var { teamId } = participants[k];
                    var killVar = participants[k].stats.kills;
                    var deathVar = participants[k].stats.deaths;
                    var assistVar = participants[k].stats.assists;

                    var totalKills = calculateTotalKills(participants, teamId);
                    if (totalKills === 0) {
                        var kpVar = 0;
                    } else {
                        var kpVar = (killVar + assistVar) / totalKills;

                    }
                    console.log("KP" + kpVar)

                    return ({
                        gameId: gameId, stats: {
                            win: participants[k].stats.win,
                            kills: killVar,
                            deaths: deathVar,
                            assists: assistVar,
                            kp: kpVar
                        }
                    });
                }
            }
            break;
        }
    }
}

function initialSetup() {
    con.connect(function (err) {
        if (err) throw err;

        for (i in users) {
            api.Summoner.gettingByName(users[i].summonerName).then(userData => {
                var sql = "INSERT INTO users (id,accountId,puuid,name,profileIconId,summonerLevel) VALUES ('" + userData.id + "','" + userData.accountId + "','" + userData.puuid + "','" + userData.name + "'," + userData.profileIconId + "," + userData.summonerLevel + ")";
                con.query(sql, function (err, result) {
                    if (err) throw err;
                });
                var { accountId } = userData;
                //var allMatches = [];
                recursiveThing(accountId, userData.name, 0).then(allMatches => {
                    var summoner = allMatches[0].summonerName
                    allMatches.shift()
                    const gameIds = allMatches.map(({ gameId }) => gameId)
                    var allRequests = []
                    for (i in gameIds) {
                        allRequests.push(requests(5, gameIds[i], i))
                    }
                    allRequests.unshift({ summonerName: summoner })
                    Promise.all(allRequests).then(results => {
                        var summoner = results[0].summonerName
                        results.shift()
                        var newResults = results.map(function (x) {
                            return ignoreUselessData(x, summoner);
                        });

                        for (j in newResults) {
                            var sql = "INSERT INTO games (accountId,gameId,win,kills,assists,deaths,kp) VALUES ('" + accountId + "'," + newResults[j].gameId + ",'" + newResults[j].stats.win + "'," + newResults[j].stats.kills + "," + newResults[j].stats.assists + "," + newResults[j].stats.deaths + "," + newResults[j].stats.kp + ")";
                            con.query(sql, function (err, result) {
                                if (err) throw err;
                            });
                        }
                        console.log("User " + summoner + " completed");

                    });

                });
            });
        }
    });
}

client.once('ready', () => {
    console.log('Ready!');
    //initialSetup();
});

client.on('message', message => {
    if (!message.content.startsWith(prefix) || message.author.bot) {
        if (message.channel.id === '706245049687605281' && !message.author.bot) {
            const steamAddress = message.content;
            if (!steamAddress.startsWith('https://store.steampowered.com/app')) {
                message.delete({ timeout: 5000 });
                message.reply('that was not a valid steam game address').then(sent => { // 'sent' is that message you just sent
                    sent.delete({ timeout: 5000 });
                }).catch(console.error);
            }
        } else if (message.channel.id === '258693667332554753' && !message.author.bot) {
            const steamAddress = message.content;
            if (steamAddress.startsWith('https://store.steampowered.com/app')) {
                message.reply('steam games belong in <#706245049687605281>. Your game has been reposted by me.');
                message.delete({ timeout: 1500 }).then(msg => {
                    const channel = client.channels.cache.get('706245049687605281');
                    channel.send('<@' + message.author.id + '> linked: ' + steamAddress);
                });
            }
        } else {
            return;
        }
    }

    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName)
        || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command) return;

    if (command.guildOnly && message.channel.type !== 'text') {
        return message.reply('I can\'t execute that command inside DMs!');
    }

    if (command.args && !args.length) {
        let reply = `You didn't provide any arguments, ${message.author}!`;

        if (command.usage) {
            reply += `\nThe proper usage would be: \`${prefix}${command.name} ${command.usage}\``;
        }

        return message.channel.send(reply);
    }

    try {
        if (commandName === "league" || commandName === "league2") {
            console.log("kda executed")
            command.execute(message, args, api);
        } else {
            console.log("other executed")
            command.execute(message, args);
        }
    } catch (error) {
        console.error(error);
        message.reply('there was an error trying to execute that command!');
    }
});

client.login(`${token}`);
