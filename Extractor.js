let minimist = require("minimist");
let fs = require("fs");
let axios = require("axios");
let jsdom = require("jsdom");
let excel = require("excel4node");
let pdf = require("pdf-lib");
let path = require("path");
//node Extractor.js --excel=worldcup.csv --dataFolder=worldcup --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-schedule-fixtures-and-results

let args = minimist(process.argv);
let responsePromise = axios.get(args.source);
responsePromise.then(function (response) {
    let html = response.data;
    //console.log(html);
    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;
    let matches = [];
    let matchDivs = document.querySelectorAll("div.ds-grow.ds-px-4")
    for (let i = 0; i < matchDivs.length; i++) {
        let match = {};

        let nameps = matchDivs[i].querySelectorAll("p.ds-text-tight-m");
        match.t1 = nameps[0].textContent;
        match.t2 = nameps[1].textContent;

        let matchScore = matchDivs[i].querySelectorAll("div.ds-text-compact-s")
        match.t1s = "";
        match.t2s = "";

        if (matchScore.length == 2) {
            match.t1s = matchScore[0].textContent;
            match.t2s = matchScore[1].textContent;
        } else if (matchScore.length == 1) {
            match.t1s = matchScore[0].textContent
        } else {
            match.t1s = "";
            match.t2s = "";
        }

        let result = matchDivs[i].querySelector("p.ds-text-tight-s > span");
        match.result = result.textContent;
        matches.push(match);
    }
    let matchesJSON = JSON.stringify(matches);
    fs.writeFileSync("matches.json", matchesJSON, "utf-8");
    let teams = [];
    //push team in teams if ot already there
    for (let i = 0; i < matches.length; i++) {
        putTeamInTeamsIfNotAlreadyThere(teams, matches[i].t1);
        putTeamInTeamsIfNotAlreadyThere(teams, matches[i].t2);
    }
    //put match at appropriate place in the team
    for (let i = 0; i < matches.length; i++) {
        putMatchesAtAppropriatePlace(teams, matches[i].t1, matches[i].t2, matches[i].t1s, matches[i].t2s, matches[i].result);
        putMatchesAtAppropriatePlace(teams, matches[i].t2, matches[i].t1, matches[i].t2s, matches[i].t1s, matches[i].result);
    }

    let teamsJSON = JSON.stringify(teams);
    fs.writeFileSync("teams.json", teamsJSON, "utf-8");

    //excel files
    prepareExcel(teams, args.excel);
    // prepareFoldersAndPdfs(teams, args.dataFolder);
})
// function prepareFoldersAndPdfs(teams, dataFolder) {
//     if (fs.existsSync(dataFolder) == true) {
//         fs.rmSync(dataFolder, {recursive : true});
//     }
//     fs.mkdirSync(dataFolder);
//     for (let i = 0; i < teams.length; i++) {
//         let teamFolderName = path.join(dataFolder, teams[i].name);
//         fs.mkdirSync(teamFolderName);
//         for (let j = 0; j < teams[i].matches.length; j++) {
//             let match = teams[i].matches[j];
//             createMatchScoreCardPdf(teamFolderName, teams[i].name, match);
//         }
//     }
// }

// function createMatchScoreCardPdf(teamFolderName, homeTeam, match) {
//     let matchFileName = path.join(teamFolderName, match.vs);
//     fs.writeFileSync(matchFileName, "", "utf-8");
//     let templateFileBytes = fs.readFileSync("template.pdf");
//     let pdfDocPromise = pdf.PDFDocument.load(templateFileBytes);
//     pdfDocPromise.then(function (pdfDoc) {
//         let page = pdfDoc.getPage(0);
//         page.drawText(homeTeam, {
//             x: 195,
//             y: 647,
//             size: 11
//         });
//         page.drawText(match.vs, {
//             x: 195,
//             y: 625,
//             size: 11
//         });
//         page.drawText(match.selfScore, {
//             x: 195,
//             y: 595,
//             size: 11
//         });
//         page.drawText(match.oppScore, {
//             x: 195,
//             y: 570,
//             size: 11
//         });
//         page.drawText(match.result, {
//             x: 195,
//             y: 550,
//             size: 11
//         });
//         let changedBytePromise = pdfDoc.save();
//         changedBytePromise.then(function (changedBytes) {
//             if(fs.existsSync(matchFileName + ".pdf") == true){
//                 fs.writeFileSync(matchFileName + "1.pdf", changedBytes);
//             }else{
//                 fs.writeFileSync(matchFileName + ".pdf", changedBytes);
//             }
            
//         })
//     })
// }

function prepareExcel(teams, excelFileName) {
    let wb = new excel.Workbook();
    for (let i = 0; i < teams.length; i++) {
        let tsheet = wb.addWorksheet(teams[i].name);

        tsheet.cell(1, 1).string("Vs");
        tsheet.cell(1, 2).string("Self Score");
        tsheet.cell(1, 3).string("Opp Score");
        tsheet.cell(1, 4).string("Result");
        for (let j = 0; j < teams[i].matches.length; j++) {
            tsheet.cell(2 + j, 1).string(teams[i].matches[j].vs);
            tsheet.cell(2 + j, 2).string(teams[i].matches[j].SelfScore);
            tsheet.cell(2 + j, 3).string(teams[i].matches[j].OppScore);
            tsheet.cell(2 + j, 4).string(teams[i].matches[j].Result);
        }
    }
    wb.write(excelFileName);
}

function putMatchesAtAppropriatePlace(teams, homeTeam, vsTeam, selfScore, oppScore, result) {
    let tidx = - 1;
    for (let j = 0; j < teams.length; j++) {
        if (teams[j].name == homeTeam) {
            tidx = j;
            break;
        }
    }
    let team = teams[tidx];
    team.matches.push({
        vs: vsTeam,
        SelfScore: selfScore,
        OppScore: oppScore,
        Result: result
    })
}
function putTeamInTeamsIfNotAlreadyThere(teams, teamName) {
    let tidx = - 1;
    for (let j = 0; j < teams.length; j++) {
        if (teams[j].name == teamName) {
            tidx = j;
            break;
        }
    }
    if (tidx == -1) {
        let team = {
            name: teamName,
            matches: []
        }
        teams.push(team);
    }
}



