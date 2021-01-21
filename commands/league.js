const Discord = require("discord.js");
const mysql = require("mysql");
const util = require( 'util' );

function requests(retries, gameId, position,api){
    console.log("getting game " + gameId)
    return api.Match.gettingById(gameId).catch(err => {
        if(retries>0){
            console.log("Retrying " + gameId)
            return requests(retries-1, gameId, position);
        }
    })
}

function calculateTotalKills(participants, teamId){
    var totalKills = 0;
    for(k in participants){
        if(participants[k].teamId === teamId){
            totalKills+=participants[k].stats.kills;
        }
    }
    return totalKills;
}
function ignoreUselessData(jsonObject, summoner){
    let { gameId, teams, participants, participantIdentities} = jsonObject;
    var participantIdentity = participantIdentities.filter(item => {
        if(item.player.summonerName === summoner){
            return item
        }
    });
    var {participantId} = participantIdentity[0];
    var participant = participants.filter(item => {
        if(item.participantId===participantId){
            return item;
        }
    })
    var participant = participant[0];
    
    var {teamId} = participant;
    var killVar = participant.stats.kills;
    var deathVar = participant.stats.deaths;
    var assistVar = participant.stats.assists;
    var totalMinions = participant.stats.totalMinionsKilled;
    var neutralMinions = participant.stats.neutralMinionsKilled;
    var totalDamageDealtToChamps = participant.stats.totalDamageDealtToChampions
    var goldEarned = participant.stats.goldEarned;
    var totalHeal = participant.stats.totalHeal;
    var totalDamageTaken = participant.stats.totalDamageTaken;
    totalMinions = totalMinions+neutralMinions;
    var kda = 0;
    if (deathVar === 0){
        kda = (killVar+assistVar)/1;
        kda = toFixed(kda, 2);
    }else{
        kda = (killVar+assistVar)/deathVar;
        kda = toFixed(kda, 2);
    }

    var totalKills = calculateTotalKills(participants,teamId);
    var kpVar = 0;
    if(totalKills!==0){
        var kpVar = (killVar+assistVar) / totalKills;
    }
    kpVar = kpVar * 100;
    var usersTeam = teams.filter(function(item) { return item.teamId === teamId; })
    var winVar;
    if(usersTeam[0].win === "Win"){
        winVar = true;
    }else{
        winVar = false;
    }
                    
    return ({gameId:gameId, stats:{win:winVar,
        kills:killVar,
        deaths:deathVar,
        assists:assistVar,
        kda:kda,
        kp:kpVar,
        totalMinionsKilled:totalMinions,
        totalDmgToChamps:totalDamageDealtToChamps,
        goldEarned:goldEarned,
        totalHeal:totalHeal,
        totalDamageTaken:totalDamageTaken
    }});
}

async function gatherGames(api, startingTime, account){
    var allMatches = []
    var continueLoop = true;
    var startingIndex=0;
    while(continueLoop){
        var {matches} = await api.Match.gettingListByAccount(account, {beginIndex:startingIndex,beginTime:startingTime});
        allMatches = allMatches.concat(matches);
        if(matches.length<100){
            continueLoop=false;
        }else{
            startingIndex+=101;
        }
    }
    allMatches = allMatches.filter(match => match.timestamp!==startingTime);
    return allMatches
}



function makeDb( config ) {
    const connection = mysql.createConnection( config );
    return {
        query( sql, args ) {
            return util.promisify( connection.query ).call( connection, sql, args );
        },
        close() {
            return util.promisify( connection.end ).call( connection );
        }
    };
}
const con = {
    host: "localhost",
    port: "3306",
    user: "root",
    password: "JP54MySQL#DevServer",
    database: "discordbot"
};

async function getLatestGames(api, message){ 
    var db = makeDb(con);
    try {
        const users = await db.query("SELECT * FROM users")
        var mapped = users.map(async user => {
            var {accountId, name} = user;
            var query = "SELECT MAX(timestamp) AS timestamp, matches.accountId, users.name FROM matches JOIN users on matches.accountId=users.accountId WHERE matches.accountId = '"+accountId+"'"
            var response = await db.query(query)
            //console.log("USER " + accountId + " " + name)
            var allMatches = await gatherGames(api, response[0].timestamp,response[0].accountId )
            //console.log("USER " + accountId + " " + name + " GAMES GATHERED")
            if(allMatches.length!==0){
                for(i in allMatches){
                    var sql = "INSERT INTO matches (accountId,platformId,gameId,champion,season,queue,timestamp,role,lane) VALUES ('"+accountId+"','"+allMatches[i].platformId+"',"+allMatches[i].gameId+","+allMatches[i].champion+","+allMatches[i].season+","+allMatches[i].queue+","+allMatches[i].timestamp+",'"+allMatches[i].role+"','"+allMatches[i].lane+"')";
                    await db.query(sql);
                }
                const allMatchesAsGames = allMatches.map(({ gameId }) => requests(5, gameId, i,api))
                var allGames = await Promise.all(allMatchesAsGames)
                var newResults = allGames.map(function (x){
                    return ignoreUselessData(x,name);
                });
                for(j in newResults){
                    var sql = "INSERT INTO games (accountId,gameId,win,kills,assists,deaths,kda,kp,totalMinionsKilled,totalDamageDealtToChampions,goldEarned,totalHeal,totalDamageTaken) VALUES ('"+accountId+"',"+newResults[j].gameId+",'"+newResults[j].stats.win+"',"+newResults[j].stats.kills+","+newResults[j].stats.assists+","+newResults[j].stats.deaths+","+newResults[j].stats.kda+","+newResults[j].stats.kp+","+newResults[j].stats.totalMinionsKilled+","+newResults[j].stats.totalDmgToChamps+","+newResults[j].stats.goldEarned+","+newResults[j].stats.totalHeal+","+newResults[j].stats.totalDamageTaken+")";
                    await db.query(sql)
                }
            }
        });
        await Promise.all(mapped);

        
    } catch ( err ) {
        // handle the error
        console.log(err);
    }finally {
        await db.close();
        return message;
    }
}
async function generateLeaderboard(api, message, args, propertyToBeUsed){
    var db = makeDb(con);
    try {
        const users = await db.query("SELECT * FROM users")


        var mapped = users.map(async user => {
            var {name,accountId,profileIconId,summonerLevel} = await api.Summoner.gettingByName(user.name);
            await db.query("UPDATE users SET `profileIconId`='"+profileIconId+"',`summonerLevel`='"+summonerLevel+"' WHERE users.accountId='"+accountId+"'")
            var query = "SELECT users.name, users.profileIconId, matches.accountId, games.gameId, games.win, games.kills, games.deaths, games.assists, games.kda, games.kp, games.totalMinionsKilled,games.totalDamageDealtToChampions,games.goldEarned,games.totalHeal,games.totalDamageTaken, matches.champion FROM matches JOIN games ON games.accountId=matches.accountId AND games.gameId=matches.gameId JOIN users on matches.accountId=users.accountId WHERE `timestamp`>="+currentWeek+" AND users.accountId='"+accountId+"'";
            var userResults = await db.query(query);
            if(userResults.length===0){
                var obj = {summoner:name,profileIconId:profileIconId,stat:0,match:'-1'}
                return obj
            }else{
                if(args[0]==="wr"){
                    var obj = {summoner:name,profileIconId:profileIconId,stat:toFixed(getWinRatio(userResults),2),match:'-1'}
                    return obj
                }else{
                    if(args[1] === "average"){
                        var average = getAverage(userResults, propertyToBeUsed);
                        var obj = {summoner:name,profileIconId:profileIconId,stat:average,match:'-1'}
                        return obj
                    }else if (args[1] === "max"){
                        var max = getMax(userResults, propertyToBeUsed);
                        var obj = {summoner:name,profileIconId:profileIconId,stat:toFixed(max[propertyToBeUsed],2),match:max.gameId}
                        return obj
                    }else if (args[1] === "sum"){
                        var sum = getSum(userResults, propertyToBeUsed);
                        var obj = {summoner:name,profileIconId:profileIconId,stat:sum,match:'-1'}
                        return obj
                    }
                }
            }
        });
        var leaderboard = []
        var leaderboard = await Promise.all(mapped);
        leaderboard.unshift(message)

        // do something with someRows and otherRows
    } catch ( err ) {
        // handle the error
        console.log(err);
    }finally {
        await db.close();
        return leaderboard;
    }
} 

function getWinRatio(arr){
    var wins = 0;
    var total = arr.length;
    for(i in arr){
        if(arr[i].win === 'true'){
            wins+=1;
        }
    }
    return (wins/total)*100;
}

function getMax(arr, prop) {
    var max;
    for (var i=0 ; i<arr.length ; i++) {
        if (max == null || parseFloat(arr[i][prop]) > parseFloat(max[prop]))
            max = arr[i];
    }
    return max;
}

function getSum(arr, prop) {
    const sum = Object.values(arr).reduce((acc, current) => acc + parseFloat(current[prop]), 0);
    return sum;
}


function getAverage(arr,prop){
    const sum = Object.values(arr).reduce((acc, current) => acc + parseFloat(current[prop]), 0);
    var average = sum / arr.length;
    return toFixed(average, 2);
}

function toFixed(num, fixed) {
    var re = new RegExp('^-?\\d+(?:\.\\d{0,' + (fixed || -1) + '})?');
    return num.toString().match(re)[0];
}

function setArgTwoType(args){
    arg2Type = "";
    if(args[0]!=="kda" || args[0]!=="kp" || args[0]!=="wr" ){
        if(args[1] === "sum"){
            arg2Type = "Sum";
        }
    }
    if(args[0] !== "wr"){
        if(arg2Type===""){
            if(args[1] === "average"){
                arg2Type = "Average";
            }else if (args[1] === "max"){
                arg2Type = "Highest";
            }else{
                arg2Type = "fail";
            }
        }
    }else{
        var champ = args[1];

    }
    return arg2Type
}

var currentWeek = 1598828400000;

module.exports = {
	name: 'league',
    description: 'Find out stats about all League Games in a wekk',
    usage: '<kda/kp/cs> {average/max}',
    args: true,
	execute(message, args, api) {
        while(Date.now()> currentWeek+604800000 ){
            currentWeek += 604800000;
        }
        var propertyToBeUsed = "";
        var arg1Type = "";
        var arg2Type = "";

        switch(args[0]) {
            case "kda":
                arg1Type = "KDA";
                propertyToBeUsed = "kda";
                arg2Type = setArgTwoType(args);
                break;
            case "kp":
                arg1Type = "Kill Participation";
                propertyToBeUsed = "kp";
                arg2Type = setArgTwoType(args);
                break;
            case "cs":
                arg1Type = "Minions Killed";
                propertyToBeUsed = "totalMinionsKilled";
                arg2Type = setArgTwoType(args);
                break;
            case "dmg":
                arg1Type = "Damage Dealt";
                propertyToBeUsed = "totalDamageDealtToChampions";
                arg2Type = setArgTwoType(args);
                break;
            case "gold":
                arg1Type = "Gold Earned";
                propertyToBeUsed = "goldEarned";
                arg2Type = setArgTwoType(args);
                break;
            case "kills":
                arg1Type = "Kills";
                propertyToBeUsed = "kills";
                arg2Type = setArgTwoType(args);
                break;
            case "deaths":
                arg1Type = "Deaths";
                propertyToBeUsed = "deaths";
                arg2Type = setArgTwoType(args);
                break;
            case "tanked":
                arg1Type = "Damage Tanked";
                propertyToBeUsed = "totalDamageTaken";
                arg2Type = setArgTwoType(args);
                break;
            case "heal":
                arg1Type = "Healing done";
                propertyToBeUsed = "totalHeal";
                arg2Type = setArgTwoType(args);
                break;
            case "wr":
                arg1Type = "Win Percentage";
                arg2Type = setArgTwoType(args);
                break;
            default:
                message.reply("That argument was invalid.\nCorrect usage would be !league <kda/kp/cs/dmg/gold/kills/deaths/tanked/heal> {average/max/sum}");
                return;

          }

        if(arg2Type === "fail"){
            message.reply("That argument was invalid.\nCorrect usage would be !league "+args[0].toLowerCase()+" {average/max/sum}");
            return;
        }

        

        const embed = new Discord.MessageEmbed()
            .setColor('#660700')
            .setTitle(arg2Type + " " + arg1Type)
            .setThumbnail("https://cdn.discordapp.com/attachments/110373943822540800/235649976192073728/4AyCE.png")
            .setDescription('This Message will be edited with the result.')

        
        message.channel.send(embed).then(message => {
            console.time()
            getLatestGames(api, message).then(message => {
                console.timeEnd();
                console.time();
                generateLeaderboard(api, message, args, propertyToBeUsed).then(leaderboard => {
                    console.timeEnd();
                    var message = leaderboard.shift();
                    
                    leaderboard = leaderboard.sort(function(a, b){return b.stat-a.stat});


                    const embed = new Discord.MessageEmbed()
                        .setColor('#660700')
                        .setTitle(arg2Type + " " + arg1Type)
                        .setThumbnail('http://ddragon.leagueoflegends.com/cdn/10.16.1/img/profileicon/'+leaderboard[0].profileIconId+'.png');

                    for(i in leaderboard){
                        if(leaderboard[i].match==='-1'){
                            embed.addField(leaderboard[i].summoner, leaderboard[i].stat)
                        }else{
                            embed.addField(leaderboard[i].summoner, '['+leaderboard[i].stat+'](https://matchhistory.euw.leagueoflegends.com/en/#match-details/EUW1/'+leaderboard[i].match+')' )

                        }
                    }
                    message.edit(embed);
                    console.timeEnd("TIME TAKEN")
                })
                // const connection = mysql.createConnection({
                //     host: "localhost",
                //     port: "3306",
                //     user: "root",
                //     password: "",
                //     database: "discordbot"
                // });
                // var query = "SELECT users.name, users.profileIconId, matches.accountId, games.gameId, games.win, games.kills, games.deaths, games.assists, games.kda, games.kp, games.totalMinionsKilled,games.totalDamageDealtToChampions,games.goldEarned, matches.champion FROM matches JOIN games ON games.accountId=matches.accountId AND games.gameId=matches.gameId JOIN users on matches.accountId=users.accountId WHERE `timestamp`>="+currentWeek;
                // connection.query(query, function (err, results, fields) {
                //     if (err) throw err;
                //     var theEnslayer = results.filter(function(item) { return item.accountId === '6OGUAT7OSN0ljAEsR2l0jRe_yk74Eiv41Y6rguwCVMc2p1s'; });
                //     var blackWraith = results.filter(function(item) { return item.accountId === 'MmNaEsikMaZZY4hLOgjmfG7ZriUxA6QClOIv5su6pS0VndA'; });
                //     var tentacool = results.filter(function(item) { return item.accountId === 'EieTJvIufUypLue8AnC16R0MB18lJ8PeeIcqhuVweYUNoGY'; });
                //     var results = []
                //     results.push(theEnslayer.map(getKdaObject))
                //     results.push(blackWraith.map(getKdaObject))
                //     results.push(tentacool.map(getKdaObject))

                //     var highestKDAs = []
                //     for(i in results){
                //         if(args[0]==="wr"){
                //             var obj = {summoner:results[i][0].summoner,profileIconId:results[i][0].profileIconId,stat:toFixed(getWinRatio(results[i]),2),match:'-1'}
                //             highestKDAs.push(obj);
                //         }else{
                //             if(args[1] === "average"){
                //                 var max = getAverage(results[i], propertyToBeUsed);
                //                 var obj = {summoner:results[i][0].summoner,profileIconId:results[i][0].profileIconId,stat:max,match:'-1'}
                //                 highestKDAs.push(obj);
                //             }else if (args[1] === "max"){
                //                 var max = getMax(results[i], propertyToBeUsed);
                //                 var obj = {summoner:results[i][0].summoner,profileIconId:results[i][0].profileIconId,stat:toFixed(max[propertyToBeUsed],2),match:max.match}
                //                 highestKDAs.push(obj);
                //             }  
                //         }
                //     }
                //     highestKDAs = highestKDAs.sort(function(a, b){return b.stat-a.stat});

                //     const embed = new Discord.MessageEmbed()
                //         .setColor('#660700')
                //         .setTitle(arg2Type + " " + arg1Type)
                //         .addField(highestKDAs[0].summoner, '['+highestKDAs[0].stat+'](https://matchhistory.euw.leagueoflegends.com/en/#match-details/EUW1/'+highestKDAs[0].match+')' )
                //         .addField(highestKDAs[1].summoner, '['+highestKDAs[1].stat+'](https://matchhistory.euw.leagueoflegends.com/en/#match-details/EUW1/'+highestKDAs[1].match+')')
                //         .addField(highestKDAs[2].summoner, '['+highestKDAs[2].stat+'](https://matchhistory.euw.leagueoflegends.com/en/#match-details/EUW1/'+highestKDAs[2].match+')' )
                //         .setThumbnail('http://ddragon.leagueoflegends.com/cdn/10.16.1/img/profileicon/'+highestKDAs[0].profileIconId+'.png');

                //     message.edit(embed);
                // });
            } );
        });
    }
}; 