const log4js = require("log4js");
log4js.configure({
  appenders: { cheese: { type: "file", filename: "cheese.log" } },
  categories: { default: { appenders: ["cheese"], level: "error" } }
});
 
const logger = log4js.getLogger("cheese");
const pause = (duration) => new Promise(res => setTimeout(res, duration));
function requests(retries, gameId, position){
    return api.Match.gettingById(gameId).catch(err => {
            if(retries>0){
                console.log("Retrying " + gameId)
                return requests(retries-1, gameId, position);
            }
    })
}



function ignoreUselessData(jsonObject, summoner){
    let { gameId, participants, participantIdentities} = jsonObject;
    for(i in participantIdentities){
        if (participantIdentities[i].player.summonerName === summoner){
            let {participantId} = participantIdentities[i];
            for(k in participants){
                if(participants[k].participantId === participantId){
                    //find team id
                    var {teamId} = participants[k];
                    var killVar = participants[k].stats.kills;
                    var deathVar = participants[k].stats.deaths;
                    var assistVar = participants[k].stats.assists;
                    var kpVar = (killVar+assistVar) / calculateTotalKills(participants,teamId,summoner);

                    return ({gameId:gameId, stats:{win:participants[k].stats.win,
                                                    kills:killVar,
                                                    deaths:deathVar,
                                                    assists:assistVar,
                                                    kp:kpVar
                                                }});
                }
            }
            break;
        }
    }
}

async function collectAllData(startTime, summoner){
    fs.mkdirSync('commands/data/'+summoner, { recursive: true }, (err) => {
        if (err) throw err;
    });
    const userData = await api.Summoner.gettingByName(summoner);
    fs.writeFileSync('commands/data/'+summoner+'/userInfo.json', JSON.stringify(userData, null, 2));
    console.log("summoner written")
    const {accountId} = userData;
    var allMatches = [];
    var gettingMatches = true;
    var startingIndex = 0;
    while (gettingMatches){
        const chickenDipper = await api.Match.gettingListByAccount(accountId, { beginIndex:startingIndex, beginTime:startTime}).catch(err => {
            gettingMatches=false;
        });
        if (chickenDipper !== undefined) {
            allMatches = allMatches.concat(chickenDipper.matches);
            if(chickenDipper.matches.length < 100){
                gettingMatches = false;
            }else{
                startingIndex+=101;
            }
        }   
    }
    
    fs.writeFileSync('commands/data/'+summoner+'/matches.json', JSON.stringify(allMatches, null, 2));
    console.log("matches written")

    if (allMatches === undefined || allMatches.length == 0) {
        fs.writeFileSync('commands/data/'+summoner+'/games.json', JSON.stringify([], null, 2));
        console.log("0 games written")
    }else{
        const gameIds = allMatches.map(({ gameId }) => gameId)
        var allRequests = []
        for(i in gameIds){
            allRequests.push(requests(5, gameIds[i], i))            
        }
        console.log("Getting All Games for user " + summoner);
        var results = await Promise.all(allRequests)
        //get data to be saved.
        results = results.map(function (x){
            return ignoreUselessData(x,summoner);
        });
        //
        
        fs.writeFileSync('commands/data/'+summoner+'/games.json', JSON.stringify(results, null, 2))
        console.log("games written")
    }
    if(results===undefined){
        results = [];
        results.unshift({name:summoner});
    }else{
        results.unshift({name:summoner});
    }
    return results;
}

async function updateData(summoner){
    var userDataContent = fs.readFileSync('commands/data/'+summoner+'/userInfo.json');
    var userData = JSON.parse(userDataContent);
    const {accountId} = userData;
    //get match file
    //check latest match
    var matchListContent = fs.readFileSync('commands/data/'+summoner+'/matches.json');
    var matchList = JSON.parse(matchListContent);

    var gamesContent = fs.readFileSync('commands/data/'+summoner+'/games.json');
    var games = JSON.parse(gamesContent);
    //get latest
    //get the latest from the 
    var latestGame = matchList[0].timestamp;
    const chickenDipper = await api.Match.gettingListByAccount(accountId, { beginTime:latestGame });
    console.log('For User ' + summoner)
    if(chickenDipper.matches.length!==1){
        chickenDipper.matches.pop();
        var matches = chickenDipper.matches;
    }

    console.log('Matches for user ' + matches)
    if(matches !== undefined){
        const gameIds = matches.map(({ gameId }) => gameId)
        var allRequests = []

        for(i in gameIds){
            allRequests.push(requests(5, gameIds[i], i))            
        }

        console.log("Getting All Games for user " + summoner);
        var results = await Promise.all(allRequests)
        console.log("Executed requests");
        //get data to be saved.
        results = results.map(function (x){
            return ignoreUselessData(x,summoner);
        });
        results = results.concat(games);
        matches = matches.concat(matchList);

        fs.writeFileSync('commands/data/'+summoner+'/games.json', JSON.stringify(results, null, 2))
        console.log("Written to games file for user " + summoner)
        fs.writeFileSync('commands/data/'+summoner+'/matches.json', JSON.stringify(matches, null, 2))
        console.log("Written to matches file for user " + summoner)
        results.unshift({name:summoner});

    }else{
        games.unshift({name:summoner});
        results = games;
    }   
           
    return results;
}

function getMax(arr, prop) {
    var max;
    for (var i=0 ; i<arr.length ; i++) {
        if (max == null || parseFloat(arr[i][prop]) > parseFloat(max[prop]))
            max = arr[i];
    }
    return max;
}

function getAverage(arr,prop){
    const sum = Object.values(arr).reduce((acc, current) => acc + parseFloat(current[prop]), 0);
    var average = sum / arr.length;
    return toFixed(average, 2);;
}

function toFixed(num, fixed) {
    var re = new RegExp('^-?\\d+(?:\.\\d{0,' + (fixed || -1) + '})?');
    return num.toString().match(re)[0];
}

const LeagueJs = require('leaguejs');
const api = new LeagueJs('RGAPI-024ae0ad-46a3-49ca-80ac-83ae3cb77f35',{PLATFORM_ID: 'euw1'});
var currentWeek = 1598828400000;
var users = [{'discordID':207222621371105280, 'summonerName':'TheEnslayer'},{'discordID':249536648906407937, 'summonerName':'2 Tentacool 4skl'},{'discordID':170580686959411200, 'summonerName':'BlackWraith'}]
const fs = require('fs');

module.exports = {
	name: 'kda',
    description: 'Who has the top KDA in a week',
    usage: '{average/max}',
    args: true,
	execute(message, args, api) {
        if(Date.now()> currentWeek+604800000 ){
            currentWeek += 604800000;
        }
        if(args.length!==0){
            var type = "";
            if(args === "average"){
                type = "Average";
            }else if (args === "max"){
                type = "Highest";
            }

            var promiseList = [];
            const embed = new Discord.MessageEmbed()
                        .setColor('#660700')
                        .setTitle(type + " KDA")
                        .setThumbnail("https://cdn.discordapp.com/attachments/110373943822540800/235649976192073728/4AyCE.png")
                        .setDescription('This Message will be edited with the result.')

            message.channel.send(embed).then(message => {
                for(i in users){
                    try {
                        if(fs.existsSync('commands/data/'+users[i].summonerName)) {
                            promiseList.push(updateData(users[i].summonerName));
                        } else {
                            //this is a promsie
                            promiseList.push(collectAllData(currentWeek, users[i].summonerName));
                        }
                    } catch (err) {
                        console.error(err);
                    }
                }
        
                Promise.all(promiseList)
                    .then(result => {
                        var highestKDAs = [];
                        for(i in result){
                            // var name = result[i]
                            // var content = fs.readFileSync('commands/data/'+name+'/games.json');
                            // var json = JSON.parse(content);
                            var name = result[i][0].name;
                            result[i].shift();
                            var json = result[i]
                            
                            var userHigh = [];
                            if(json.length===0){
                                var obj = {summoner:name,kda:0,match:-1}
                                highestKDAs.push(obj);
                            }else{
                                for(j in json){
                                    const {gameId, stats} = json[j]
                                    const {kills, deaths, assists} = stats
                                    var kda = 0;
                                    if (deaths === 0){
                                        kda = (kills+assists)/1;
                                        kda = toFixed(kda, 2);
                                    }else{
                                        kda = (kills+assists)/deaths;
                                        kda = toFixed(kda, 2);
        
                                    }
                                    var userObj = {match:gameId,killdeath:kda}
                                    userHigh.push(userObj);
                                }
                                if(args === "average"){
                                    var max = getAverage(userHigh, "killdeath");
                                    var obj = {summoner:name,kda:max,match:'-1'}
                                    highestKDAs.push(obj);
                                }else if (args === "max"){
                                    var max = getMax(userHigh, "killdeath");
                                    var obj = {summoner:name,kda:max.killdeath,match:max.match}
                                    highestKDAs.push(obj);

                                }    
                            } 
                        }
                        highestKDAs = highestKDAs.sort(function(a, b){return b.kda-a.kda});
                        var userInfo = fs.readFileSync('commands/data/'+highestKDAs[0].summoner+'/userInfo.json');
                        var { profileIconId } = JSON.parse(userInfo);
        
                        const embed = new Discord.MessageEmbed()
                            .setColor('#660700')
                            .setTitle(type +" KDA")
                            .addField(highestKDAs[0].summoner, '['+highestKDAs[0].kda+'](https://matchhistory.euw.leagueoflegends.com/en/#match-details/EUW1/'+highestKDAs[0].match+')' )
                            .addField(highestKDAs[1].summoner, '['+highestKDAs[1].kda+'](https://matchhistory.euw.leagueoflegends.com/en/#match-details/EUW1/'+highestKDAs[1].match+')')
                            .addField(highestKDAs[2].summoner, '['+highestKDAs[2].kda+'](https://matchhistory.euw.leagueoflegends.com/en/#match-details/EUW1/'+highestKDAs[2].match+')' )
                            .setThumbnail('http://ddragon.leagueoflegends.com/cdn/10.16.1/img/profileicon/'+profileIconId+'.png');
                        
                        message.edit(embed);
                        
                    })
                    .catch(err => console.log(err));
            });
        }
        








        
        
    }
};

  
  
  